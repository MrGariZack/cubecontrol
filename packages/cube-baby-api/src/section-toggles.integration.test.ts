import {
  LIVE_PARAM_MODULATION_OFF,
  LIVE_PARAM_NAMES,
  type LiveParamName,
  liveParamAddress,
  liveParamLiveOffset,
  liveParamOffset,
} from "@tonehub/cube-baby-protocol";
import { describe, expect, it } from "vitest";
import { CubeBabyClient } from "./client.js";
import { CubeBabySession } from "./session.js";
import { FAKE_INPUT, FAKE_OUTPUT, FakeCubeBabyTransport } from "./testing/fake-cube-baby.js";

const PORTS = {
  inputPortId: FAKE_INPUT.id,
  outputPortId: FAKE_OUTPUT.id,
  timeoutMs: 200,
  handshake: false as const,
};

/** Foot A/B/C = preset slots 0/1/2; section enables are bytes 10–12 within each slot. */
const SECTION_PARAMS = [
  { foot: "A", param: "irSection" as const, slotIndex: 0, offset: 0x0a },
  { foot: "B", param: "delaySection" as const, slotIndex: 1, offset: 0x1b },
  { foot: "C", param: "toneSection" as const, slotIndex: 2, offset: 0x2c },
];

describe("section toggles (library, no UI)", () => {
  it("maps section names to slot-scaled live offsets", () => {
    expect(liveParamOffset("irSection")).toBe(10);
    expect(liveParamLiveOffset("irSection", 0)).toBe(0x0a);
    expect(liveParamLiveOffset("delaySection", 1)).toBe(0x1b);
    expect(liveParamLiveOffset("toneSection", 2)).toBe(0x2c);
    for (const row of SECTION_PARAMS) {
      expect(liveParamAddress(row.param, row.slotIndex)).toBe(0x8000_0000 + row.offset);
    }
  });

  it("toggles section bits in the active slot band only", async () => {
    const transport = new FakeCubeBabyTransport();
    const client = new CubeBabyClient(transport);

    for (const row of SECTION_PARAMS) {
      expect(transport.live[row.offset]).toBe(1);

      const off = await client.writeLiveParam({
        ...PORTS,
        param: row.param,
        slotIndex: row.slotIndex,
        value: 0,
      });
      expect(off.accepted).toBe(false);
      expect(off.address).toBe(liveParamAddress(row.param, row.slotIndex));
      expect(transport.live[row.offset]).toBe(0);

      const on = await client.writeLiveParam({
        ...PORTS,
        param: row.param,
        slotIndex: row.slotIndex,
        value: 1,
      });
      expect(on.accepted).toBe(false);
      expect(transport.live[row.offset]).toBe(1);
    }
  });

  it("writes mix to slot B/C bands (exp. 038)", async () => {
    const transport = new FakeCubeBabyTransport();
    const client = new CubeBabyClient(transport);

    await client.writeLiveParam({ ...PORTS, param: "mix", slotIndex: 1, value: 80 });
    expect(transport.live[0x17]).toBe(80);

    await client.writeLiveParam({ ...PORTS, param: "feedback", slotIndex: 2, value: 64 });
    expect(transport.live[0x24]).toBe(64);
  });

  it("applies UI-style delay bypass (section off + mix/mod park)", async () => {
    const transport = new FakeCubeBabyTransport();
    const session = await CubeBabySession.open(transport, {
      inputPortId: FAKE_INPUT.id,
      outputPortId: FAKE_OUTPUT.id,
    });
    try {
      await session.writeLiveParam({ param: "mix", value: 80, ...PORTS });
      await session.writeLiveParam({ param: "modulation", value: 8, ...PORTS });
      await session.writeLiveParam({ param: "delaySection", value: 1, ...PORTS });

      await session.writeLiveParam({ param: "delaySection", value: 0, ...PORTS });
      await session.writeLiveParam({ param: "mix", value: 0, ...PORTS });
      await session.writeLiveParam({
        param: "modulation",
        value: LIVE_PARAM_MODULATION_OFF,
        ...PORTS,
      });

      expect(transport.live[0x0b]).toBe(0);
      expect(transport.live[7]).toBe(0);
      expect(transport.live[8]).toBe(LIVE_PARAM_MODULATION_OFF);

      await session.writeLiveParam({ param: "delaySection", value: 1, ...PORTS });
      await session.writeLiveParam({ param: "mix", value: 80, ...PORTS });
      await session.writeLiveParam({ param: "modulation", value: 8, ...PORTS });
      expect(transport.live[0x0b]).toBe(1);
      expect(transport.live[7]).toBe(80);
      expect(transport.live[8]).toBe(8);
    } finally {
      await session.close();
    }
  });

  it("after pushing bank slot B to live, delaySection still toggles", async () => {
    const transport = new FakeCubeBabyTransport();
    const session = await CubeBabySession.open(transport, {
      inputPortId: FAKE_INPUT.id,
      outputPortId: FAKE_OUTPUT.id,
    });
    try {
      const bank = await session.readPresetBank({ ...PORTS });
      const slotB = bank.slots[1];
      const slotIndex = 1;
      for (const name of LIVE_PARAM_NAMES) {
        if (name === "cabinet") continue;
        await session.writeLiveParam({
          param: name as LiveParamName,
          value: slotB[name as keyof typeof slotB] as number,
          slotIndex,
          ...PORTS,
        });
      }

      await session.writeLiveParam({
        param: "delaySection",
        value: 0,
        slotIndex,
        ...PORTS,
      });
      await session.writeLiveParam({ param: "mix", value: 0, slotIndex, ...PORTS });
      await session.writeLiveParam({
        param: "modulation",
        value: LIVE_PARAM_MODULATION_OFF,
        slotIndex,
        ...PORTS,
      });
      expect(transport.live[0x1b]).toBe(0);
      expect(transport.live[0x17]).toBe(0);
      expect(transport.live[0x18]).toBe(LIVE_PARAM_MODULATION_OFF);
    } finally {
      await session.close();
    }
  });

  it("toneSection toggles after slot C push (foot C path)", async () => {
    const transport = new FakeCubeBabyTransport();
    const session = await CubeBabySession.open(transport, {
      inputPortId: FAKE_INPUT.id,
      outputPortId: FAKE_OUTPUT.id,
    });
    try {
      const bank = await session.readPresetBank({ ...PORTS });
      const slotC = bank.slots[2];
      const slotIndex = 2;
      for (const name of LIVE_PARAM_NAMES) {
        if (name === "cabinet") continue;
        await session.writeLiveParam({
          param: name as LiveParamName,
          value: slotC[name as keyof typeof slotC] as number,
          slotIndex,
          ...PORTS,
        });
      }
      await session.writeLiveParam({
        param: "toneSection",
        value: 0,
        slotIndex,
        ...PORTS,
      });
      expect(transport.live[0x2c]).toBe(0);
      await session.writeLiveParam({
        param: "toneSection",
        value: 1,
        slotIndex,
        ...PORTS,
      });
      expect(transport.live[0x2c]).toBe(1);
    } finally {
      await session.close();
    }
  });
});
