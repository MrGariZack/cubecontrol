import { describe, expect, it } from "vitest";
import { parseWindowsMidiMetadata } from "./windows-midi-metadata.js";

describe("parseWindowsMidiMetadata", () => {
  it("extracts USB identifiers from one CIM record", () => {
    const result = parseWindowsMidiMetadata(
      JSON.stringify({
        Name: "USB-Midi",
        Manufacturer: "M-VAVE",
        PNPDeviceID: "USB\\VID_301A&PID_5555&MI_03\\ABC",
      }),
    );

    expect(result).toEqual([
      {
        name: "USB-Midi",
        manufacturer: "M-VAVE",
        vendorId: 0x301a,
        productId: 0x5555,
      },
    ]);
  });

  it("ignores malformed and non-USB records", () => {
    expect(
      parseWindowsMidiMetadata(
        JSON.stringify([
          { Name: "Software Synth", PNPDeviceID: "SWD\\MMDEVAPI\\123" },
          { PNPDeviceID: "USB\\VID_301A&PID_5555" },
        ]),
      ),
    ).toEqual([]);
  });
});
