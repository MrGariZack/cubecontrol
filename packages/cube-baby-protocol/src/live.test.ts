import { describe, expect, it } from "vitest";
import {
  liveParamAddress,
  liveParamName,
  liveParamOffset,
  LIVE_PARAM_BASE_ADDRESS,
} from "./live.js";

describe("live param map", () => {
  it("maps names to confirmed addresses", () => {
    expect(liveParamOffset("gain")).toBe(1);
    expect(liveParamAddress("cabinet")).toBe(LIVE_PARAM_BASE_ADDRESS + 9);
    expect(liveParamName(5)).toBe("volume");
  });
});
