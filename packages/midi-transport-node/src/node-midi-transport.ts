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

/** WinMM drops SysEx if hosts burst; keep a floor between sends. */
const MIN_SYSEX_GAP_MS = 28;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

type PortProbe = {
  getPortCount: () => number;
  getPortName: (index: number) => string;
};

/**
 * WinMM throws from `closePort` when the USB device is already gone, and that
 * exception is not caught in the native addon — it aborts the process.
 * Park the object so its destructor never runs `midiInUnprepareHeader`.
 */
const parkedInputs: Input[] = [];
const parkedOutputs: Output[] = [];

function portStillPresent(port: PortProbe, name: string): boolean {
  try {
    const count = port.getPortCount();
    for (let index = 0; index < count; index += 1) {
      if (port.getPortName(index) === name) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function releaseEnumerator(port: { closePort: () => void; destroy: () => void }): void {
  try {
    port.closePort();
  } catch {
    // Already closed.
  }
  try {
    port.destroy();
  } catch {
    // Native handle already released.
  }
}

/**
 * RtMidi picks an API in the constructor and keeps it. With zero devices it
 * settles on the last compiled API (often the dummy one). A reused instance
 * then reports no ports forever, so each scan must construct a new pair.
 */
function scanPortNames(): { input: readonly string[]; output: readonly string[] } {
  const inputPort = new Input();
  const outputPort = new Output();
  try {
    const input: string[] = [];
    for (let index = 0; index < inputPort.getPortCount(); index += 1) {
      input.push(inputPort.getPortName(index));
    }
    const output: string[] = [];
    for (let index = 0; index < outputPort.getPortCount(); index += 1) {
      output.push(outputPort.getPortName(index));
    }
    return { input, output };
  } finally {
    releaseEnumerator(inputPort);
    releaseEnumerator(outputPort);
  }
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
  #sendChain: Promise<unknown> = Promise.resolve();
  #lastSendAtMs = 0;

  async listPorts(): Promise<readonly MidiPort[]> {
    const metadata = uniqueMetadataByName(await getWindowsMidiMetadata());
    const names = scanPortNames();
    const ports: MidiPort[] = [];
    names.input.forEach((name, index) => {
      ports.push(createPort("input", index, name, metadata));
    });
    names.output.forEach((name, index) => {
      ports.push(createPort("output", index, name, metadata));
    });
    return ports;
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
        if (portStillPresent(input, port.name)) {
          input.closePort();
        } else {
          parkedInputs.push(input);
        }
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
        const bytes = [...data];
        const run = this.#sendChain.then(async () => {
          const elapsed = Date.now() - this.#lastSendAtMs;
          if (elapsed < MIN_SYSEX_GAP_MS) {
            await sleep(MIN_SYSEX_GAP_MS - elapsed);
          }
          try {
            output.sendMessage(bytes);
          } catch (error) {
            // One calm retry; if WinMM is wedged a second failure must surface.
            await sleep(120);
            if (closed) throw error;
            try {
              output.sendMessage(bytes);
            } catch (retryError) {
              const wrapped = new Error(
                `MIDI WinMM output failed (${requestedPortId}): ${
                  retryError instanceof Error ? retryError.message : String(retryError)
                }`,
              );
              (wrapped as Error & { cause?: unknown }).cause = retryError;
              throw wrapped;
            }
          } finally {
            this.#lastSendAtMs = Date.now();
          }
        });
        this.#sendChain = run.then(
          () => undefined,
          () => undefined,
        );
        await run;
      },
      close: async () => {
        if (closed) return;
        closed = true;
        if (portStillPresent(output, port.name)) {
          output.closePort();
        } else {
          parkedOutputs.push(output);
        }
        this.#connections.delete(connection);
      },
    };
    this.#connections.add(connection);
    return connection;
  }

  onPortsChanged(listener: () => void): () => void {
    this.#listeners.add(listener);
    if (!this.#pollTimer) {
      this.#startPolling();
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

  #startPolling(): void {
    this.#lastFingerprint = this.#portFingerprint();
    this.#pollTimer = setInterval(() => {
      this.#pollOnce();
    }, 1_000);
    this.#pollTimer.unref();
  }

  #pollOnce(): void {
    let fingerprint = "";
    try {
      fingerprint = this.#portFingerprint();
    } catch {
      return;
    }
    if (fingerprint === this.#lastFingerprint) return;
    this.#lastFingerprint = fingerprint;
    for (const listener of this.#listeners) listener();
  }

  /** Names only — hotplug must not spawn a PowerShell WMI query every second. */
  #portFingerprint(): string {
    const names = scanPortNames();
    return [
      ...names.input.map((name, index) => `in:${index}:${name}`),
      ...names.output.map((name, index) => `out:${index}:${name}`),
    ].join("|");
  }
}
