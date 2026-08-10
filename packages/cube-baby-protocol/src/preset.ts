export const PRESET_SLOT_BYTE_LENGTH = 16;
export const PRESET_BANK_SLOT_COUNT = 3;
export const PRESET_BANK_BYTE_LENGTH = PRESET_SLOT_BYTE_LENGTH * PRESET_BANK_SLOT_COUNT;

export type PresetSlotId = "A" | "B" | "C";

/**
 * One stored/live-shaped 16-byte preset slot.
 * Offsets 0–12 match the confirmed live WriteMemory map at 0x80000000.
 * Bytes 13–15 are retained as raw trailing bytes (observed as 00 padding locally).
 */
export interface CubeBabyPresetSlot {
  readonly slot: PresetSlotId;
  readonly type: number;
  readonly gain: number;
  readonly tone: number;
  readonly reverb: number;
  readonly feedback: number;
  readonly volume: number;
  readonly time: number;
  readonly mix: number;
  readonly modulation: number;
  readonly cabinet: number;
  readonly irSection: number;
  readonly delaySection: number;
  readonly toneSection: number;
  readonly trailing: readonly [number, number, number];
  readonly raw: Uint8Array;
}

export interface CubeBabyPresetBank {
  readonly slots: readonly [CubeBabyPresetSlot, CubeBabyPresetSlot, CubeBabyPresetSlot];
  readonly raw: Uint8Array;
}

const SLOT_IDS: readonly PresetSlotId[] = ["A", "B", "C"];

export function decodePresetSlot(data: Uint8Array, slot: PresetSlotId = "A"): CubeBabyPresetSlot {
  if (data.length !== PRESET_SLOT_BYTE_LENGTH) {
    throw new Error(`preset slot must be exactly ${PRESET_SLOT_BYTE_LENGTH} bytes`);
  }

  return {
    slot,
    type: data[0] ?? 0,
    gain: data[1] ?? 0,
    tone: data[2] ?? 0,
    reverb: data[3] ?? 0,
    feedback: data[4] ?? 0,
    volume: data[5] ?? 0,
    time: data[6] ?? 0,
    mix: data[7] ?? 0,
    modulation: data[8] ?? 0,
    cabinet: data[9] ?? 0,
    irSection: data[10] ?? 0,
    delaySection: data[11] ?? 0,
    toneSection: data[12] ?? 0,
    trailing: [data[13] ?? 0, data[14] ?? 0, data[15] ?? 0],
    raw: data.slice(),
  };
}

export function decodePresetBank(data: Uint8Array): CubeBabyPresetBank {
  if (data.length !== PRESET_BANK_BYTE_LENGTH) {
    throw new Error(`preset bank must be exactly ${PRESET_BANK_BYTE_LENGTH} bytes`);
  }

  const slots = SLOT_IDS.map((slotId, index) => {
    const start = index * PRESET_SLOT_BYTE_LENGTH;
    return decodePresetSlot(data.subarray(start, start + PRESET_SLOT_BYTE_LENGTH), slotId);
  }) as [CubeBabyPresetSlot, CubeBabyPresetSlot, CubeBabyPresetSlot];

  return {
    slots,
    raw: data.slice(),
  };
}

/** True when trailing bytes are all zero (local observation / upstream padding report). */
export function isPresetTrailingPadding(slot: CubeBabyPresetSlot): boolean {
  return slot.trailing[0] === 0 && slot.trailing[1] === 0 && slot.trailing[2] === 0;
}
