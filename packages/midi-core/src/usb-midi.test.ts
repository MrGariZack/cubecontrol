import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MidiMessageAssembler } from "./message-assembler.js";
import { decodeUsbMidiTransfer } from "./usb-midi.js";

interface FixtureTransfer {
  readonly frame: number;
  readonly atSeconds: number;
  readonly direction: "host-to-device" | "device-to-host";
  readonly capdata: string;
}

interface Fixture {
  readonly transfers: readonly FixtureTransfer[];
}

const fromHex = (hex: string): Uint8Array =>
  Uint8Array.from(hex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);

describe("decodeUsbMidiTransfer", () => {
  it("removes USB event headers and padding", () => {
    expect(
      decodeUsbMidiTransfer(Uint8Array.of(0x04, 0xf0, 0x00, 0x32, 0x06, 0x01, 0xf7, 0x00)),
    ).toEqual(Uint8Array.of(0xf0, 0x00, 0x32, 0x01, 0xf7));
  });

  it("reconstructs real CubeSuite traffic captured from the physical pedal", () => {
    const fixtureUrl = new URL(
      "../../../test/fixtures/captures/003-cubesuite-startup.json",
      import.meta.url,
    );
    const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8")) as Fixture;
    const messages = {
      "host-to-device": [] as Uint8Array[],
      "device-to-host": [] as Uint8Array[],
    };
    const assemblers = {
      "host-to-device": new MidiMessageAssembler((message) => {
        messages["host-to-device"].push(message.data);
      }),
      "device-to-host": new MidiMessageAssembler((message) => {
        messages["device-to-host"].push(message.data);
      }),
    };

    for (const transfer of fixture.transfers) {
      assemblers[transfer.direction].push(
        decodeUsbMidiTransfer(fromHex(transfer.capdata)),
        transfer.atSeconds * 1_000,
      );
    }

    expect(messages["host-to-device"]).toHaveLength(5);
    expect(messages["device-to-host"]).toHaveLength(5);
    for (const message of [...messages["host-to-device"], ...messages["device-to-host"]]) {
      expect(message[0]).toBe(0xf0);
      expect(message.at(-1)).toBe(0xf7);
    }
    expect(messages["device-to-host"].some((message) => message.length > 48)).toBe(true);
  });
});
