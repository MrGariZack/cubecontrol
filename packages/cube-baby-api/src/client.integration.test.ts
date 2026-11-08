import { readFile } from "node:fs/promises";
import {
  buildIrRomSector,
  decodeCubeBabyMessage,
  encodeIdentityRequest,
  encodeMemoryWriteRequest,
  IR_ROM_FACTORY_BASE,
  IR_ROM_SLOT_SIZE,
  liveParamAddress,
} from "@tonehub/cube-baby-protocol";
import { describe, expect, it } from "vitest";
import { CubeBabyClient } from "./client.js";
import { CubeBabySession } from "./session.js";
import {
  FAKE_INPUT,
  FAKE_OUTPUT,
  FAKE_PRESET_BANK,
  FakeCubeBabyTransport,
} from "./testing/fake-cube-baby.js";

describe("CubeBabyClient against FakeCubeBabyTransport", () => {
  it("does not send any cabinet selection when the IR read-back differs", async () => {
    class FaultyFlash extends FakeCubeBabyTransport {
      override async openOutput(portId: string) {
        const output = await super.openOutput(portId);
        return {
          ...output,
          send: async (data: Uint8Array) => {
            await output.send(data);
            const frame = decodeCubeBabyMessage(data);
            if (
              frame.kind === "memory-write-request" &&
              frame.memory === 0 &&
              frame.address === IR_ROM_FACTORY_BASE
            ) {
              this.irRom[0] = (this.irRom[0] ?? 0) ^ 0xff;
            }
          },
        };
      }
    }
    const transport = new FaultyFlash();
    const client = new CubeBabyClient(transport);
    const wav = await readFile(
      new URL("../../../test/fixtures/ir/033-tonehub-impulse.wav", import.meta.url),
    );
    await expect(
      client.loadIrFromWav({
        inputPortId: FAKE_INPUT.id,
        outputPortId: FAKE_OUTPUT.id,
        wav,
        slotIndex: 0,
        cabinet: 1,
      }),
    ).rejects.toThrow("Cabinet selection stopped");
    expect(
      transport.sent
        .map(decodeCubeBabyMessage)
        .some((frame) => frame.kind === "memory-write-request" && frame.memory === 5),
    ).toBe(false);
  }, 15_000);

  it("reads and decodes the preset bank", async () => {
    const transport = new FakeCubeBabyTransport();
    const client = new CubeBabyClient(transport);
    const bank = await client.readPresetBank({
      inputPortId: FAKE_INPUT.id,
      outputPortId: FAKE_OUTPUT.id,
      timeoutMs: 200,
    });
    expect(bank.raw).toEqual(FAKE_PRESET_BANK);
    expect(bank.slots[0]?.gain).toBe(3);
    expect(bank.slots[0]?.cabinet).toBe(8);
  });

  it("writes a live Gain param and updates fake live RAM", async () => {
    const transport = new FakeCubeBabyTransport();
    const client = new CubeBabyClient(transport);
    const ack = await client.writeLiveParam({
      inputPortId: FAKE_INPUT.id,
      outputPortId: FAKE_OUTPUT.id,
      param: "gain",
      value: 5,
      handshake: false,
      timeoutMs: 200,
    });
    expect(ack.accepted).toBe(false);
    expect(ack.address).toBe(liveParamAddress("gain"));
    expect(transport.live[1]).toBe(5);
    expect(transport.sent.at(-1)).toEqual(
      encodeMemoryWriteRequest(5, liveParamAddress("gain"), Uint8Array.of(5)),
    );
  });

  it("connect() reuses ports across identify calls", async () => {
    const transport = new FakeCubeBabyTransport();
    const client = new CubeBabyClient(transport);
    await client.connect({ inputPortId: FAKE_INPUT.id, outputPortId: FAKE_OUTPUT.id });
    await client.identify({
      inputPortId: FAKE_INPUT.id,
      outputPortId: FAKE_OUTPUT.id,
      timeoutMs: 200,
    });
    await client.identify({
      inputPortId: FAKE_INPUT.id,
      outputPortId: FAKE_OUTPUT.id,
      timeoutMs: 200,
    });
    await client.disconnect();
    expect(transport.openInputCount).toBe(1);
    expect(transport.openOutputCount).toBe(1);
    expect(transport.sent.filter((m) => m[0] === 0xf0).length).toBeGreaterThanOrEqual(2);
  });

  it("dumpIrRom + persistIrRom round-trips a sector on one ephemeral link", async () => {
    const samples = new Float32Array(512);
    samples[0] = 0.25;
    samples[1] = -0.5;
    const sector = buildIrRomSector({ samples, volume: 0.5, presence: "upload" });
    // Place sector at upload slot index 7.
    const irRom = new Uint8Array(IR_ROM_SLOT_SIZE * 8);
    irRom.set(sector, 7 * IR_ROM_SLOT_SIZE);

    const transport = new FakeCubeBabyTransport({ irRom });
    const client = new CubeBabyClient(transport);
    const ports = {
      inputPortId: FAKE_INPUT.id,
      outputPortId: FAKE_OUTPUT.id,
      timeoutMs: 500,
    };

    const dumped = await client.dumpIrRom({ ...ports, slotIndex: 7 });
    expect(dumped.data).toEqual(sector);
    // One open for the whole dump (not per chunk).
    expect(transport.openInputCount).toBe(1);

    const blank = new Uint8Array(IR_ROM_SLOT_SIZE);
    blank.fill(0xff);
    transport.irRom.set(blank, 7 * IR_ROM_SLOT_SIZE);
    transport.openInputCount = 0;
    transport.openOutputCount = 0;

    const persist = await client.persistIrRom({
      ...ports,
      slotIndex: 7,
      payload: sector,
    });
    expect(persist.verified).toBe(true);
    expect(persist.writtenLength).toBe(IR_ROM_SLOT_SIZE);
    expect(transport.openInputCount).toBe(1);
    expect(transport.irRom.subarray(7 * IR_ROM_SLOT_SIZE, 8 * IR_ROM_SLOT_SIZE)).toEqual(sector);
  }, 20_000);
});

describe("CubeBabySession against FakeCubeBabyTransport", () => {
  it("queues a bank read while a multi-step cabinet change is running", async () => {
    const transport = new FakeCubeBabyTransport();
    const session = await CubeBabySession.open(transport, {
      inputPortId: FAKE_INPUT.id,
      outputPortId: FAKE_OUTPUT.id,
    });
    try {
      const [cabinet, bank] = await Promise.all([
        session.selectCabinet({ cabinet: 2 }),
        session.readPresetBank(),
      ]);
      expect(cabinet.cabinet).toBe(2);
      expect(bank.raw).toEqual(FAKE_PRESET_BANK);
      expect(transport.sent.map((data) => decodeCubeBabyMessage(data).kind)).toEqual([
        "memory-write-request",
        "memory-write-request",
        "identity-request",
        "memory-read-request",
      ]);
    } finally {
      await session.close();
    }
  });

  it("selectCabinet nudges then sets cabinet", async () => {
    const transport = new FakeCubeBabyTransport();
    const session = await CubeBabySession.open(transport, {
      inputPortId: FAKE_INPUT.id,
      outputPortId: FAKE_OUTPUT.id,
    });
    try {
      const result = await session.selectCabinet({ cabinet: 8, timeoutMs: 200 });
      expect(result.romSlot).toBe(7);
      expect(result.nudgedFrom).toBe(1);
      expect(transport.live[9]).toBe(8);
      expect(transport.openInputCount).toBe(1);
    } finally {
      await session.close();
    }
  });

  it("identifies without reopening ports", async () => {
    const transport = new FakeCubeBabyTransport();
    const session = await CubeBabySession.open(transport, {
      inputPortId: FAKE_INPUT.id,
      outputPortId: FAKE_OUTPUT.id,
    });
    try {
      const identity = await session.identify({ timeoutMs: 200 });
      expect(identity.reportedName).toBe("SINCO-CubeBaby");
      expect(transport.sent[0]).toEqual(encodeIdentityRequest());
    } finally {
      await session.close();
    }
  });
});
