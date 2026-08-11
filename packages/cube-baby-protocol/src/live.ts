import { PRESET_SLOT_BYTE_LENGTH } from "./preset.js";

/** Live parameter RAM (memory selector 5). Knobs: experiments 004–014 / 038. */
export const LIVE_PARAM_MEMORY = 5;
export const LIVE_PARAM_BASE_ADDRESS = 0x8000_0000;
/** Contiguous knob/preset-mirror field count (offsets 0–12) used in bank slots. */
export const LIVE_PARAM_COUNT = 13;
/**
 * Highest live offset: slot C toneSection = 2*16 + 12 = 0x2c.
 * Live RAM mirrors the three bank slots contiguously (exp. 037/038):
 *   slot A @ 0x00, slot B @ 0x10, slot C @ 0x20.
 */
export const LIVE_PARAM_MAX_OFFSET = 0x2c;

export const LIVE_PARAM_NAMES = [
  "type",
  "gain",
  "tone",
  "reverb",
  "feedback",
  "volume",
  "time",
  "mix",
  "modulation",
  "cabinet",
  "irSection",
  "delaySection",
  "toneSection",
] as const;

export type LiveParamName = (typeof LIVE_PARAM_NAMES)[number];

/**
 * CubeSuite-reported ceilings (experiments 004–017). Values above these are
 * ignored or clamped by the pedal — UI must not expose a wider sweep.
 */
export const LIVE_PARAM_MAX: Readonly<Record<LiveParamName, number>> = {
  type: 8,
  gain: 7,
  tone: 15,
  reverb: 15,
  feedback: 127,
  volume: 127,
  time: 31,
  mix: 118,
  modulation: 15,
  cabinet: 8,
  irSection: 1,
  delaySection: 1,
  toneSection: 1,
};

/**
 * MOD is bipolar (Cube Baby manual / CubeSuite):
 * 0–6 chorus, 7–8 off, 9–15 phaser. Parking/off must use the center, not 0.
 */
export const LIVE_PARAM_MODULATION_OFF = 8;

export function isModulationOff(value: number): boolean {
  return value === 7 || value === 8;
}

/**
 * Byte index within one 16-byte preset/live slot (always 0–12 for named fields).
 * USB live address = `0x80000000 + slotIndex * 16 + LIVE_PARAM_BANK_OFFSET[name]`
 * (validated exp. 038: MIX A/B/C → 0x07/0x17/0x27, FB C → 0x24).
 */
export const LIVE_PARAM_BANK_OFFSET: Readonly<Record<LiveParamName, number>> = {
  type: 0,
  gain: 1,
  tone: 2,
  reverb: 3,
  feedback: 4,
  volume: 5,
  time: 6,
  mix: 7,
  modulation: 8,
  cabinet: 9,
  irSection: 10,
  delaySection: 11,
  toneSection: 12,
};

/** @deprecated Slot C section offsets; prefer liveParamLiveOffset(name, 2). */
export const LIVE_PARAM_SECTION_ALT_OFFSET: Readonly<
  Record<"irSection" | "delaySection" | "toneSection", number>
> = {
  irSection: 0x2a,
  delaySection: 0x2b,
  toneSection: 0x2c,
};

export function clampLiveParamValue(name: LiveParamName, value: number): number {
  if (!Number.isFinite(value)) return 0;
  const max = LIVE_PARAM_MAX[name];
  return Math.max(0, Math.min(max, Math.round(value)));
}

/** Within-slot offset 0–12 for a named param. */
export function liveParamOffset(name: LiveParamName): number {
  return LIVE_PARAM_BANK_OFFSET[name];
}

/**
 * Absolute live RAM offset for a named param on preset slot A/B/C (0/1/2).
 * `slotIndex * 16 + bankOffset`.
 */
export function liveParamLiveOffset(name: LiveParamName, slotIndex = 0): number {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 2) {
    throw new Error("slotIndex must be 0 (A), 1 (B), or 2 (C)");
  }
  return slotIndex * PRESET_SLOT_BYTE_LENGTH + LIVE_PARAM_BANK_OFFSET[name];
}

function assertLiveOffset(offset: number): void {
  if (!Number.isInteger(offset) || offset < 0 || offset > LIVE_PARAM_MAX_OFFSET) {
    throw new Error(`live param offset must be 0..${LIVE_PARAM_MAX_OFFSET}`);
  }
  const within = offset % PRESET_SLOT_BYTE_LENGTH;
  if (within >= LIVE_PARAM_COUNT) {
    throw new Error(`live param within-slot offset must be 0..${LIVE_PARAM_COUNT - 1}`);
  }
}

/**
 * Full USB address for a live field.
 * - `liveParamAddress("mix")` → slot A MIX (`0x80000007`)
 * - `liveParamAddress("mix", 2)` → slot C MIX (`0x80000027`)
 * - `liveParamAddress(7, 1)` → slot B MIX (`0x80000017`) — raw = within-slot offset
 */
export function liveParamAddress(offsetOrName: number | LiveParamName, slotIndex = 0): number {
  const offset =
    typeof offsetOrName === "number"
      ? (() => {
          if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 2) {
            throw new Error("slotIndex must be 0 (A), 1 (B), or 2 (C)");
          }
          return slotIndex * PRESET_SLOT_BYTE_LENGTH + offsetOrName;
        })()
      : liveParamLiveOffset(offsetOrName, slotIndex);
  assertLiveOffset(offset);
  return LIVE_PARAM_BASE_ADDRESS + offset;
}

/** Resolve a named param from an absolute live offset (any slot). */
export function liveParamName(absoluteOffset: number): LiveParamName {
  const within = absoluteOffset % PRESET_SLOT_BYTE_LENGTH;
  const entry = (Object.entries(LIVE_PARAM_BANK_OFFSET) as [LiveParamName, number][]).find(
    ([, value]) => value === within,
  );
  if (entry === undefined) {
    throw new Error(`no live param name for offset ${absoluteOffset}`);
  }
  return entry[0];
}
