import { describe, expect, it, vi } from "vitest";
import { WebMidiTransport } from "./web-midi-transport.js";

interface FakePort {
  readonly id: string;
  readonly name: string;
  readonly manufacturer?: string;
  state: MIDIPortDeviceState;
  readonly listeners: Set<(event: MIDIMessageEvent) => void>;
  addEventListener(type: string, listener: (event: MIDIMessageEvent) => void): void;
  removeEventListener(type: string, listener: (event: MIDIMessageEvent) => void): void;
  send?: (data: Uint8Array) => void;
}

function createFakePort(id: string, name: string, withSend = false): FakePort {
  const listeners = new Set<(event: MIDIMessageEvent) => void>();
  return {
    id,
    name,
    manufacturer: "Fake",
    state: "connected",
    listeners,
    addEventListener(type, listener) {
      if (type === "midimessage") listeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === "midimessage") listeners.delete(listener);
    },
    ...(withSend
      ? {
          send: vi.fn(),
        }
      : {}),
  };
}

function createAccess(input: FakePort, output: FakePort): MIDIAccess {
  const stateListeners = new Set<() => void>();
  return {
    inputs: new Map([[input.id, input as unknown as MIDIInput]]),
    outputs: new Map([[output.id, output as unknown as MIDIOutput]]),
    sysexEnabled: true,
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (type === "statechange" && typeof listener === "function") {
        stateListeners.add(listener as () => void);
      }
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (type === "statechange" && typeof listener === "function") {
        stateListeners.delete(listener as () => void);
      }
    },
  } as unknown as MIDIAccess;
}

describe("WebMidiTransport", () => {
  it("lists ports with web: ids and opens send/receive", async () => {
    const input = createFakePort("in-1", "CUBE In");
    const output = createFakePort("out-1", "CUBE Out", true);
    const access = createAccess(input, output);
    const transport = new WebMidiTransport({
      requestMIDIAccess: async () => access,
    });

    const ports = await transport.listPorts();
    expect(ports.map((port) => port.id)).toEqual(["web:input:in-1", "web:output:out-1"]);

    const chunks: Uint8Array[] = [];
    const inputConn = await transport.openInput("web:input:in-1", (chunk) => {
      chunks.push(chunk.data);
    });
    const outputConn = await transport.openOutput("web:output:out-1");

    for (const listener of input.listeners) {
      listener({
        data: new Uint8Array([0xf0, 0x01, 0xf7]),
        timeStamp: 12,
      } as MIDIMessageEvent);
    }
    await outputConn.send(Uint8Array.of(0xf0, 0x02, 0xf7));

    expect(chunks).toEqual([Uint8Array.of(0xf0, 0x01, 0xf7)]);
    expect(output.send).toHaveBeenCalledWith(Uint8Array.of(0xf0, 0x02, 0xf7));

    await inputConn.close();
    await outputConn.close();
    await transport.dispose();
  });

  it("throws when a port id is unknown", async () => {
    const input = createFakePort("in-1", "CUBE In");
    const output = createFakePort("out-1", "CUBE Out", true);
    const transport = new WebMidiTransport({
      requestMIDIAccess: async () => createAccess(input, output),
    });
    await expect(transport.openInput("web:input:missing", () => undefined)).rejects.toThrow(
      /not found/i,
    );
  });
});
