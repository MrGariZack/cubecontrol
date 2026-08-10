/** Live parameter RAM (memory selector 5) confirmed in experiments 004–017. */
export const LIVE_PARAM_MEMORY = 5;
export const LIVE_PARAM_BASE_ADDRESS = 0x8000_0000;
export const LIVE_PARAM_COUNT = 13;

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

const NAME_TO_OFFSET: Record<LiveParamName, number> = {
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

export function liveParamOffset(name: LiveParamName): number {
  return NAME_TO_OFFSET[name];
}

export function liveParamAddress(offsetOrName: number | LiveParamName): number {
  const offset = typeof offsetOrName === "number" ? offsetOrName : liveParamOffset(offsetOrName);
  if (!Number.isInteger(offset) || offset < 0 || offset >= LIVE_PARAM_COUNT) {
    throw new Error(`live param offset must be 0..${LIVE_PARAM_COUNT - 1}`);
  }
  return LIVE_PARAM_BASE_ADDRESS + offset;
}

export function liveParamName(offset: number): LiveParamName {
  const name = LIVE_PARAM_NAMES[offset];
  if (name === undefined) {
    throw new Error(`live param offset must be 0..${LIVE_PARAM_COUNT - 1}`);
  }
  return name;
}
