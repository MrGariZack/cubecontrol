import {
  MidiPortNotFoundError,
  type MidiChunk,
  type MidiInputConnection,
  type MidiOutputConnection,
  type MidiPort,
  type MidiTransport,
} from "@tonehub/midi-core";

type OpenConnection = MidiInputConnection | MidiOutputConnection;

export type WebMidiAccessFactory = (options?: MIDIOptions) => Promise<MIDIAccess>;

function portId(direction: "input" | "output", midiId: string): string {
  return `web:${direction}:${midiId}`;
}

function parsePortId(id: string, direction: "input" | "output"): string | undefined {
  const prefix = `web:${direction}:`;
  if (!id.startsWith(prefix)) return undefined;
  const midiId = id.slice(prefix.length);
  return midiId.length > 0 ? midiId : undefined;
}

function toMidiPort(direction: "input" | "output", port: MIDIPort): MidiPort {
  return {
    id: portId(direction, port.id),
    direction,
    name: port.name ?? port.id,
    state: port.state === "connected" ? "connected" : "disconnected",
    ...(port.manufacturer ? { manufacturer: port.manufacturer } : {}),
  };
}

/**
 * Browser / WebView `MidiTransport` via Web MIDI API (SysEx must be allowed).
 * Works in Chromium and in Capacitor WebViews that expose `navigator.requestMIDIAccess`.
 */
export class WebMidiTransport implements MidiTransport {
  readonly #requestAccess: WebMidiAccessFactory;
  readonly #connections = new Set<OpenConnection>();
  readonly #listeners = new Set<() => void>();
  #access: MIDIAccess | undefined;
  #onStateChange: ((event: Event) => void) | undefined;

  constructor(options: { readonly requestMIDIAccess?: WebMidiAccessFactory } = {}) {
    this.#requestAccess =
      options.requestMIDIAccess ??
      ((midiOptions) => {
        if (typeof navigator === "undefined" || navigator.requestMIDIAccess === undefined) {
          return Promise.reject(new Error("Web MIDI API is not available in this environment"));
        }
        return navigator.requestMIDIAccess(midiOptions);
      });
  }

  async #ensureAccess(): Promise<MIDIAccess> {
    if (this.#access !== undefined) return this.#access;
    const access = await this.#requestAccess({ sysex: true });
    this.#access = access;
    this.#onStateChange = () => {
      for (const listener of this.#listeners) listener();
    };
    access.addEventListener("statechange", this.#onStateChange);
    return access;
  }

  async listPorts(): Promise<readonly MidiPort[]> {
    const access = await this.#ensureAccess();
    const ports: MidiPort[] = [];
    for (const input of access.inputs.values()) {
      ports.push(toMidiPort("input", input));
    }
    for (const output of access.outputs.values()) {
      ports.push(toMidiPort("output", output));
    }
    return ports;
  }

  async openInput(
    requestedPortId: string,
    onChunk: (chunk: MidiChunk) => void,
  ): Promise<MidiInputConnection> {
    const midiId = parsePortId(requestedPortId, "input");
    const access = await this.#ensureAccess();
    const input = midiId === undefined ? undefined : access.inputs.get(midiId);
    if (input === undefined) {
      throw new MidiPortNotFoundError(requestedPortId);
    }

    const port = toMidiPort("input", input);
    const handler = (event: MIDIMessageEvent) => {
      if (event.data === null) return;
      onChunk({
        portId: requestedPortId,
        data: new Uint8Array(event.data),
        receivedAtMs: typeof event.timeStamp === "number" ? event.timeStamp : Date.now(),
      });
    };
    input.addEventListener("midimessage", handler);

    const connection: MidiInputConnection = {
      port,
      close: async () => {
        input.removeEventListener("midimessage", handler);
        this.#connections.delete(connection);
      },
    };
    this.#connections.add(connection);
    return connection;
  }

  async openOutput(requestedPortId: string): Promise<MidiOutputConnection> {
    const midiId = parsePortId(requestedPortId, "output");
    const access = await this.#ensureAccess();
    const output = midiId === undefined ? undefined : access.outputs.get(midiId);
    if (output === undefined) {
      throw new MidiPortNotFoundError(requestedPortId);
    }

    const port = toMidiPort("output", output);
    const connection: MidiOutputConnection = {
      port,
      send: async (data) => {
        output.send(data);
      },
      close: async () => {
        this.#connections.delete(connection);
      },
    };
    this.#connections.add(connection);
    return connection;
  }

  onPortsChanged(listener: () => void): () => void {
    this.#listeners.add(listener);
    void this.#ensureAccess().catch(() => undefined);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  async dispose(): Promise<void> {
    for (const connection of [...this.#connections]) {
      await connection.close();
    }
    this.#connections.clear();
    this.#listeners.clear();
    if (this.#access !== undefined && this.#onStateChange !== undefined) {
      this.#access.removeEventListener("statechange", this.#onStateChange);
    }
    this.#onStateChange = undefined;
    this.#access = undefined;
  }
}
