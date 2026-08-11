import { describe, expect, it } from "vitest";
import {
  clampLiveParamValue,
  isModulationOff,
  liveParamAddress,
  liveParamLiveOffset,
  liveParamName,
  liveParamOffset,
  LIVE_PARAM_BASE_ADDRESS,
  LIVE_PARAM_MAX,
  LIVE_PARAM_MODULATION_OFF,
} from "./live.js";

describe("live param map", () => {
  it("maps names to within-slot offsets and slot-scaled addresses", () => {
    expect(liveParamOffset("gain")).toBe(1);
    expect(liveParamOffset("mix")).toBe(7);
    expect(liveParamOffset("irSection")).toBe(10);
    expect(liveParamAddress("cabinet")).toBe(LIVE_PARAM_BASE_ADDRESS + 9);
    expect(liveParamName(5)).toBe("volume");
    expect(liveParamName(0x17)).toBe("mix");
    expect(liveParamName(0x24)).toBe("feedback");

    expect(liveParamLiveOffset("mix", 0)).toBe(0x07);
    expect(liveParamLiveOffset("mix", 1)).toBe(0x17);
    expect(liveParamLiveOffset("mix", 2)).toBe(0x27);
    expect(liveParamLiveOffset("feedback", 2)).toBe(0x24);

    expect(liveParamAddress("mix", 0)).toBe(LIVE_PARAM_BASE_ADDRESS + 0x07);
    expect(liveParamAddress("mix", 1)).toBe(LIVE_PARAM_BASE_ADDRESS + 0x17);
    expect(liveParamAddress("mix", 2)).toBe(LIVE_PARAM_BASE_ADDRESS + 0x27);
    expect(liveParamAddress("feedback", 2)).toBe(LIVE_PARAM_BASE_ADDRESS + 0x24);

    expect(liveParamAddress("delaySection", 0)).toBe(LIVE_PARAM_BASE_ADDRESS + 0x0b);
    expect(liveParamAddress("delaySection", 1)).toBe(LIVE_PARAM_BASE_ADDRESS + 0x1b);
    expect(liveParamAddress("toneSection", 2)).toBe(LIVE_PARAM_BASE_ADDRESS + 0x2c);
  });

  it("treats MOD 7–8 as off (bipolar chorus/phaser)", () => {
    expect(LIVE_PARAM_MODULATION_OFF).toBe(8);
    expect(isModulationOff(7)).toBe(true);
    expect(isModulationOff(8)).toBe(true);
    expect(isModulationOff(0)).toBe(false);
    expect(isModulationOff(6)).toBe(false);
    expect(isModulationOff(9)).toBe(false);
  });

  it("clamps modulation to CubeSuite 0–15", () => {
    expect(LIVE_PARAM_MAX.modulation).toBe(15);
    expect(clampLiveParamValue("modulation", 255)).toBe(15);
    expect(clampLiveParamValue("modulation", -1)).toBe(0);
  });
});
