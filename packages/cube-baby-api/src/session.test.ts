import { encodeIdentityRequest } from "@tonehub/cube-baby-protocol";
import type {
  MidiChunk,
  MidiInputConnection,
  MidiOutputConnection,
  MidiPort,
  MidiTransport,
} from "@tonehub/midi-core";
import { describe, expect, it } from "vitest";
import { CubeBabySession } from "./session.js";

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

class CountingFakeTransport implements MidiTransport {
  readonly sent: Uint8Array[] = [];
  openInputCount = 0;
  openOutputCount = 0;
  #listener: ((chunk: MidiChunk) => void) | undefined;

  async listPorts(): Promise<readonly MidiPort[]> {
    return [INPUT, OUTPUT];
  }

  async openInput(
    _portId: string,
    onChunk: (chunk: MidiChunk) => void,
  ): Promise<MidiInputConnection> {
    this.openInputCount += 1;
    this.#listener = onChunk;
    return { port: INPUT, close: async () => undefined };
  }

  async openOutput(_portId: string): Promise<MidiOutputConnection> {
    this.openOutputCount += 1;
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

describe("CubeBabySession", () => {
  it("reuses one input/output pair across serialized identifies", async () => {
    const transport = new CountingFakeTransport();
    const session = await CubeBabySession.open(transport, {
      inputPortId: INPUT.id,
      outputPortId: OUTPUT.id,
    });

    const a = await session.identify({ timeoutMs: 100 });
    const b = await session.identify({ timeoutMs: 100 });
    await session.close();

    expect(transport.openInputCount).toBe(1);
    expect(transport.openOutputCount).toBe(1);
    expect(transport.sent).toEqual([encodeIdentityRequest(), encodeIdentityRequest()]);
    expect(a.reportedName).toBe("SINCO-CubeBaby");
    expect(b.reportedName).toBe("SINCO-CubeBaby");
    expect(session.connected).toBe(false);
  });
});
