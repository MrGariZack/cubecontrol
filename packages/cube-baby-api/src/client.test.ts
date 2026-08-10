import { encodeIdentityRequest } from "@tonehub/cube-baby-protocol";
import type {
  MidiChunk,
  MidiInputConnection,
  MidiOutputConnection,
  MidiPort,
  MidiTransport,
} from "@tonehub/midi-core";
import { describe, expect, it } from "vitest";
import { CubeBabyClient } from "./client.js";

const INPUT: MidiPort = {
  id: "fake:input",
  direction: "input",
  name: "Fake CUBE Baby",
  state: "connected",
};
const OUTPUT: MidiPort = {
  id: "fake:output",
  direction: "output",
  name: "Fake CUBE Baby",
  state: "connected",
};
const IDENTITY_RESPONSE = Uint8Array.from(
  "f00032455801004029491c0d7a5465503a624a090a262c1e10204000011260040a152c5c40114307f7"
    .match(/.{2}/g)
    ?.map((byte) => Number.parseInt(byte, 16)) ?? [],
);

class FakeTransport implements MidiTransport {
  readonly sent: Uint8Array[] = [];
  #listener: ((chunk: MidiChunk) => void) | undefined;

  async listPorts(): Promise<readonly MidiPort[]> {
    return [INPUT, OUTPUT];
  }

  async openInput(
    _portId: string,
    onChunk: (chunk: MidiChunk) => void,
  ): Promise<MidiInputConnection> {
    this.#listener = onChunk;
    return { port: INPUT, close: async () => undefined };
  }

  async openOutput(_portId: string): Promise<MidiOutputConnection> {
    return {
      port: OUTPUT,
      send: async (data) => {
        this.sent.push(data);
        this.#listener?.({
          portId: INPUT.id,
          data: IDENTITY_RESPONSE.slice(0, 12),
          receivedAtMs: 42,
        });
        this.#listener?.({
          portId: INPUT.id,
          data: IDENTITY_RESPONSE.slice(12),
          receivedAtMs: 43,
        });
      },
      close: async () => undefined,
    };
  }

  onPortsChanged(): () => void {
    return () => undefined;
  }

  async dispose(): Promise<void> {}
}

describe("CubeBabyClient", () => {
  it("identifies a device through the captured read-only request/response", async () => {
    const transport = new FakeTransport();
    const client = new CubeBabyClient(transport);

    const identity = await client.identify({
      inputPortId: INPUT.id,
      outputPortId: OUTPUT.id,
      timeoutMs: 100,
    });

    expect(transport.sent).toEqual([encodeIdentityRequest()]);
    expect(identity.reportedName).toBe("SINCO-CubeBaby");
    expect(identity.rawNameByteLength).toBe(19);
    expect([...identity.metadata]).toEqual([1, 19, 20, 21, 22, 23, 24, 25]);
  });
});
