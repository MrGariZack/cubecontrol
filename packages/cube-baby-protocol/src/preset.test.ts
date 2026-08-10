import { describe, expect, it } from "vitest";
import {
  decodePresetBank,
  decodePresetSlot,
  isPresetTrailingPadding,
  PRESET_BANK_BYTE_LENGTH,
  PRESET_SLOT_BYTE_LENGTH,
} from "./preset.js";

/** Bank hex from experiment 022/023 local ReadMemory (memory=5, address=0). */
const BANK_HEX =
  "05030306056405070808010101000000050304064173185008080101010000000600030a59440b0a0805010101000000";

function hexToBytes(hex: string): Uint8Array {
  const pairs = hex.match(/.{1,2}/g) ?? [];
  return Uint8Array.from(pairs.map((pair) => Number.parseInt(pair, 16)));
}

describe("decodePresetSlot / decodePresetBank", () => {
  const bankBytes = hexToBytes(BANK_HEX);

  it("rejects wrong lengths", () => {
    expect(() => decodePresetSlot(new Uint8Array(15))).toThrow(/16/);
    expect(() => decodePresetBank(new Uint8Array(47))).toThrow(/48/);
  });

  it("decodes the captured 48-byte bank into A/B/C with live-map fields", () => {
    expect(bankBytes.length).toBe(PRESET_BANK_BYTE_LENGTH);
    const bank = decodePresetBank(bankBytes);

    const [slotA, slotB, slotC] = bank.slots;
    expect(slotA.slot).toBe("A");
    expect(slotA.type).toBe(5);
    expect(slotA.gain).toBe(3);
    expect(slotA.tone).toBe(3);
    expect(slotA.reverb).toBe(6);
    expect(slotA.feedback).toBe(5);
    expect(slotA.volume).toBe(100);
    expect(slotA.time).toBe(5);
    expect(slotA.mix).toBe(7);
    expect(slotA.modulation).toBe(8);
    expect(slotA.cabinet).toBe(8);
    expect(slotA.irSection).toBe(1);
    expect(slotA.delaySection).toBe(1);
    expect(slotA.toneSection).toBe(1);
    expect(slotA.trailing).toEqual([0, 0, 0]);
    expect(isPresetTrailingPadding(slotA)).toBe(true);

    expect(slotB.slot).toBe("B");
    expect(slotB.gain).toBe(3);
    expect(slotB.volume).toBe(115);
    expect(slotB.trailing).toEqual([0, 0, 0]);

    expect(slotC.slot).toBe("C");
    expect(slotC.type).toBe(6);
    expect(slotC.gain).toBe(0);
    expect(slotC.cabinet).toBe(5);
    expect(slotC.trailing).toEqual([0, 0, 0]);

    for (const slot of bank.slots) {
      expect(slot.raw.length).toBe(PRESET_SLOT_BYTE_LENGTH);
      expect(isPresetTrailingPadding(slot)).toBe(true);
    }
  });

  it("keeps slot A bytes identical to the first 16 bank bytes", () => {
    const bank = decodePresetBank(bankBytes);
    expect([...bank.slots[0].raw]).toEqual([...bankBytes.subarray(0, 16)]);
  });
});
