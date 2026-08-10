import {
  MidiPortNotFoundError,
  type MidiChunk,
  type MidiInputConnection,
  type MidiOutputConnection,
  type MidiPort,
  type MidiTransport,
} from "@tonehub/midi-core";
import type { NativeMidiHost, NativeMidiPortInfo } from "./native-midi-host.js";

type OpenConnection = MidiInputConnection | MidiOutputConnection;

function toMidiPort(info: NativeMidiPortInfo): MidiPort {
  return {
    id: info.id,
    direction: info.direction,
    name: info.name,
    state: info.state ?? "connected",
    ...(info.manufacturer ? { manufacturer: info.manufacturer } : {}),
    ...(info.vendorId === undefined ? {} : { vendorId: info.vendorId }),
    ...(info.productId === undefined ? {} : { productId: info.productId }),
  };
}

/**
 * `MidiTransport` over a native host (Android MidiManager / CoreMIDI via RN/Capacitor plugin).
 */
export class NativeMidiTransport implements MidiTransport {
  readonly #host: NativeMidiHost;
  readonly #connections = new Set<OpenConnection>();

  constructor(host: NativeMidiHost) {
    this.#host = host;
  }

  async listPorts(): Promise<readonly MidiPort[]> {
    const ports = await this.#host.listPorts();
    return ports.map(toMidiPort);
  }

  async openInput(
    portId: string,
    onChunk: (chunk: MidiChunk) => void,
  ): Promise<MidiInputConnection> {
    const ports = await this.#host.listPorts();
    const info = ports.find((port) => port.id === portId && port.direction === "input");
    if (info === undefined) {
      throw new MidiPortNotFoundError(portId);
    }

    const handle = await this.#host.openInput(portId, (data, receivedAtMs) => {
      onChunk({ portId, data, receivedAtMs });
    });

    const connection: MidiInputConnection = {
      port: toMidiPort(info),
      close: async () => {
        await handle.close();
        this.#connections.delete(connection);
      },
    };
    this.#connections.add(connection);
    return connection;
  }

  async openOutput(portId: string): Promise<MidiOutputConnection> {
    const ports = await this.#host.listPorts();
    const info = ports.find((port) => port.id === portId && port.direction === "output");
    if (info === undefined) {
      throw new MidiPortNotFoundError(portId);
    }

    const handle = await this.#host.openOutput(portId);
    const connection: MidiOutputConnection = {
      port: toMidiPort(info),
      send: async (data) => handle.send(data),
      close: async () => {
        await handle.close();
        this.#connections.delete(connection);
      },
    };
    this.#connections.add(connection);
    return connection;
  }

  onPortsChanged(listener: () => void): () => void {
    return this.#host.onPortsChanged(listener);
  }

  async dispose(): Promise<void> {
    for (const connection of [...this.#connections]) {
      await connection.close();
    }
    this.#connections.clear();
    await this.#host.dispose();
  }
}
