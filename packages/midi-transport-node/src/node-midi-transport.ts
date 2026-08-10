import { Input, Output } from "@julusian/midi";
import {
  MidiPortNotFoundError,
  type MidiChunk,
  type MidiInputConnection,
  type MidiOutputConnection,
  type MidiPort,
  type MidiTransport,
} from "@tonehub/midi-core";
import { getWindowsMidiMetadata, type WindowsMidiMetadata } from "./windows-midi-metadata.js";

type OpenConnection = MidiInputConnection | MidiOutputConnection;

function portId(direction: "input" | "output", index: number): string {
  return `node:${direction}:${index}`;
}

function parsePortId(id: string, direction: "input" | "output"): number | undefined {
  const match = new RegExp(`^node:${direction}:(\\d+)$`).exec(id);
  if (!match?.[1]) return undefined;
  return Number.parseInt(match[1], 10);
}

function uniqueMetadataByName(
  metadata: readonly WindowsMidiMetadata[],
): ReadonlyMap<string, WindowsMidiMetadata> {
  const grouped = new Map<string, WindowsMidiMetadata[]>();
  for (const item of metadata) {
    const existing = grouped.get(item.name) ?? [];
    existing.push(item);
    grouped.set(item.name, existing);
  }

  const unique = new Map<string, WindowsMidiMetadata>();
  for (const [name, items] of grouped) {
    if (items.length === 1 && items[0]) unique.set(name, items[0]);
  }
  return unique;
}

function createPort(
  direction: "input" | "output",
  index: number,
  name: string,
  metadata: ReadonlyMap<string, WindowsMidiMetadata>,
): MidiPort {
  const identity = metadata.get(name);
  return {
    id: portId(direction, index),
    direction,
    name,
    state: "connected",
    ...(identity?.manufacturer ? { manufacturer: identity.manufacturer } : {}),
    ...(identity ? { vendorId: identity.vendorId, productId: identity.productId } : {}),
  };
}

export class NodeMidiTransport implements MidiTransport {
  readonly #connections = new Set<OpenConnection>();
  readonly #listeners = new Set<() => void>();
  #pollTimer: NodeJS.Timeout | undefined;
  #lastFingerprint = "";

  async listPorts(): Promise<readonly MidiPort[]> {
    const input = new Input();
    const output = new Output();
    const metadata = uniqueMetadataByName(await getWindowsMidiMetadata());

    try {
      const ports: MidiPort[] = [];
      for (let index = 0; index < input.getPortCount(); index += 1) {
        ports.push(createPort("input", index, input.getPortName(index), metadata));
      }
      for (let index = 0; index < output.getPortCount(); index += 1) {
        ports.push(createPort("output", index, output.getPortName(index), metadata));
      }
      return ports;
    } finally {
      input.closePort();
      output.closePort();
    }
  }

  async openInput(
    requestedPortId: string,
    onChunk: (chunk: MidiChunk) => void,
  ): Promise<MidiInputConnection> {
    const index = parsePortId(requestedPortId, "input");
    const input = new Input();
    if (index === undefined || index >= input.getPortCount()) {
      input.closePort();
      throw new MidiPortNotFoundError(requestedPortId);
    }

    const port: MidiPort = {
      id: requestedPortId,
      direction: "input",
      name: input.getPortName(index),
      state: "connected",
    };

    // RtMidi ignores SysEx, timing and active-sensing messages by default.
    input.ignoreTypes(false, false, false);
    input.on("message", (_deltaTime: number, bytes: number[]) => {
      onChunk({
        portId: requestedPortId,
        data: Uint8Array.from(bytes),
        receivedAtMs: Date.now(),
      });
    });
    input.openPort(index);

    let closed = false;
    const connection: MidiInputConnection = {
      port,
      close: async () => {
        if (closed) return;
        closed = true;
        input.removeAllListeners("message");
        input.closePort();
        this.#connections.delete(connection);
      },
    };
    this.#connections.add(connection);
    return connection;
  }

  async openOutput(requestedPortId: string): Promise<MidiOutputConnection> {
    const index = parsePortId(requestedPortId, "output");
    const output = new Output();
    if (index === undefined || index >= output.getPortCount()) {
      output.closePort();
      throw new MidiPortNotFoundError(requestedPortId);
    }

    const port: MidiPort = {
      id: requestedPortId,
      direction: "output",
      name: output.getPortName(index),
      state: "connected",
    };
    output.openPort(index);

    let closed = false;
    const connection: MidiOutputConnection = {
      port,
      send: async (data) => {
        if (closed) throw new Error(`MIDI output is closed: ${requestedPortId}`);
        output.sendMessage([...data]);
      },
      close: async () => {
        if (closed) return;
        closed = true;
        output.closePort();
        this.#connections.delete(connection);
      },
    };
    this.#connections.add(connection);
    return connection;
  }

  onPortsChanged(listener: () => void): () => void {
    this.#listeners.add(listener);
    if (!this.#pollTimer) {
      void this.#startPolling();
    }

    return () => {
      this.#listeners.delete(listener);
      if (this.#listeners.size === 0 && this.#pollTimer) {
        clearInterval(this.#pollTimer);
        this.#pollTimer = undefined;
      }
    };
  }

  async dispose(): Promise<void> {
    if (this.#pollTimer) {
      clearInterval(this.#pollTimer);
      this.#pollTimer = undefined;
    }
    await Promise.all([...this.#connections].map((connection) => connection.close()));
    this.#listeners.clear();
  }

  async #startPolling(): Promise<void> {
    this.#lastFingerprint = await this.#fingerprint();
    this.#pollTimer = setInterval(() => {
      void this.#pollOnce();
    }, 1_000);
    this.#pollTimer.unref();
  }

  async #pollOnce(): Promise<void> {
    const fingerprint = await this.#fingerprint();
    if (fingerprint === this.#lastFingerprint) return;
    this.#lastFingerprint = fingerprint;
    for (const listener of this.#listeners) listener();
  }

  async #fingerprint(): Promise<string> {
    const ports = await this.listPorts();
    return JSON.stringify(ports.map(({ id, name }) => [id, name]));
  }
}
