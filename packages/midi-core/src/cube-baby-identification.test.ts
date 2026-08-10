import { describe, expect, it } from "vitest";
import { classifyCubeBabyPort } from "./cube-baby-identification.js";
import type { MidiPort } from "./types.js";

const port = (overrides: Partial<MidiPort>): MidiPort => ({
  id: "input:0",
  direction: "input",
  name: "Unknown",
  state: "connected",
  ...overrides,
});

describe("classifyCubeBabyPort", () => {
  it("confirms the known USB VID/PID", () => {
    expect(classifyCubeBabyPort(port({ vendorId: 0x301a, productId: 0x5555 }))).toBe("confirmed");
  });

  it("treats a name-only match as a candidate", () => {
    expect(classifyCubeBabyPort(port({ name: "SINCO-CubeBaby" }))).toBe("candidate");
  });

  it("does not guess unrelated devices", () => {
    expect(classifyCubeBabyPort(port({ name: "Other MIDI Device" }))).toBe("none");
  });
});
