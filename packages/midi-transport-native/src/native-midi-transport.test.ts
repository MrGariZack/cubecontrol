import { describe, expect, it, vi } from "vitest";
import type { NativeMidiHost, NativeMidiPortInfo } from "./native-midi-host.js";
import { NativeMidiTransport } from "./native-midi-transport.js";

function createHost(ports: NativeMidiPortInfo[]): NativeMidiHost & {
  readonly sent: Uint8Array[];
  emitInput(portId: string, data: Uint8Array): void;
} {
  const sent: Uint8Array[] = [];
  let inputCallback: ((data: Uint8Array, receivedAtMs: number) => void) | undefined;
  let inputPortId: string | undefined;
  const listeners = new Set<() => void>();

  return {
    sent,
    emitInput(portId, data) {
      if (inputPortId === portId) inputCallback?.(data, 99);
    },
    async listPorts() {
      return ports;
    },
    async openInput(portId, onBytes) {
      if (!ports.some((port) => port.id === portId && port.direction === "input")) {
        throw new Error("missing");
      }
      inputPortId = portId;
      inputCallback = onBytes;
      return { close: async () => undefined };
    },
    async openOutput(portId) {
      if (!ports.some((port) => port.id === portId && port.direction === "output")) {
        throw new Error("missing");
      }
      return {
        send: async (data) => {
          sent.push(data.slice());
        },
        close: async () => undefined,
      };
    },
    onPortsChanged(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: vi.fn(async () => undefined),
  };
}

describe("NativeMidiTransport", () => {
  it("adapts a native host into MidiTransport", async () => {
    const host = createHost([
      {
        id: "android:input:0",
        direction: "input",
        name: "USB-Midi",
        vendorId: 0x301a,
        productId: 0x5555,
      },
      {
        id: "android:output:0",
        direction: "output",
        name: "USB-Midi",
        vendorId: 0x301a,
        productId: 0x5555,
      },
    ]);
    const transport = new NativeMidiTransport(host);
    const listed = await transport.listPorts();
    expect(listed[0]?.vendorId).toBe(0x301a);

    const chunks: Uint8Array[] = [];
    await transport.openInput("android:input:0", (chunk) => {
      chunks.push(chunk.data);
    });
    const output = await transport.openOutput("android:output:0");
    await output.send(Uint8Array.of(0xf0, 0x11, 0xf7));
    host.emitInput("android:input:0", Uint8Array.of(0xf0, 0x00, 0xf7));

    expect(host.sent).toEqual([Uint8Array.of(0xf0, 0x11, 0xf7)]);
    expect(chunks).toEqual([Uint8Array.of(0xf0, 0x00, 0xf7)]);
    await transport.dispose();
    expect(host.dispose).toHaveBeenCalled();
  });
});
