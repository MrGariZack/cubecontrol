import { describe, expect, it } from "vitest";
import {
  buildIrLivePayload,
  buildIrRomSector,
  decodeWavToMonoFloat32,
  encodeMonoPcm16Wav,
  IR_LIVE_SAMPLE_COUNT,
  irRomSectorToLivePayload,
  irRomSectorToUploadPayload,
  irRomSectorToWav,
  parseIrRomSector,
  prepareIrSamples,
} from "./ir.js";
import { IR_LIVE_PAYLOAD_LENGTH, IR_ROM_PAYLOAD_LENGTH, IR_ROM_SLOT_SIZE } from "./requests.js";

describe("IR builders", () => {
  it("builds a zero-padded 4096-byte upload-style sector", () => {
    const samples = new Float32Array(IR_LIVE_SAMPLE_COUNT);
    samples[0] = 0.25;
    samples[1] = -0.5;
    const sector = buildIrRomSector({ samples, volume: 0.5, presence: "upload" });
    expect(sector.length).toBe(IR_ROM_SLOT_SIZE);
    expect([...sector.subarray(0, 4)]).toEqual([0, 0, 0, 0]);
    const view = new DataView(sector.buffer);
    expect(view.getFloat32(4, true)).toBeCloseTo(0.5);
    expect(view.getFloat32(8, true)).toBeCloseTo(0.25);
    expect(view.getFloat32(12, true)).toBeCloseTo(-0.5);
    expect(sector[2056]).toBe(0);
    expect(irRomSectorToUploadPayload(sector).length).toBe(IR_ROM_PAYLOAD_LENGTH);
  });

  it("maps ROM sector to live payload like Cabinet load", () => {
    const samples = new Float32Array(IR_LIVE_SAMPLE_COUNT);
    samples[0] = 0.125;
    const sector = buildIrRomSector({ samples, volume: 0.7, presence: "factory" });
    const live = irRomSectorToLivePayload(sector);
    expect(live.length).toBe(IR_LIVE_PAYLOAD_LENGTH);
    const view = new DataView(live.buffer);
    expect(view.getFloat32(0, true)).toBeCloseTo(0.7);
    expect(view.getFloat32(4, true)).toBeCloseTo(0.125);
    expect(buildIrLivePayload({ samples, distance: 0.7 })).toEqual(live);
  });
});

describe("WAV round-trip", () => {
  it("decodes PCM16 mono and prepares 512 IR samples", () => {
    const raw = new Float32Array(1000);
    raw[0] = 1;
    raw[10] = -1;
    const wav = encodeMonoPcm16Wav(raw, 48_000);
    const decoded = decodeWavToMonoFloat32(wav);
    expect(decoded.sampleRate).toBe(48_000);
    expect(decoded.channels).toBe(1);
    expect(decoded.samples[0]).toBeCloseTo(1, 2);
    const prepared = prepareIrSamples(decoded.samples, decoded.sampleRate);
    expect(prepared.length).toBe(IR_LIVE_SAMPLE_COUNT);
    expect(prepared[0]).toBeCloseTo(1, 2);
  });

  it("exports a ROM sector to WAV and re-imports matching primary samples", () => {
    const samples = new Float32Array(IR_LIVE_SAMPLE_COUNT);
    samples[0] = 0.5;
    samples[3] = -0.25;
    const sector = buildIrRomSector({ samples, volume: 0.7, presence: "factory" });
    const parsed = parseIrRomSector(sector);
    expect(parsed.presence).toBe("factory");
    expect(parsed.volume).toBeCloseTo(0.7);
    const { wav } = irRomSectorToWav(sector);
    const decoded = decodeWavToMonoFloat32(wav);
    const prepared = prepareIrSamples(decoded.samples, decoded.sampleRate);
    expect(prepared[0]).toBeCloseTo(0.5, 2);
    expect(prepared[3]).toBeCloseTo(-0.25, 2);
    const rebuilt = buildIrRomSector({
      samples: prepared,
      volume: parsed.volume,
      presence: "factory",
    });
    expect(rebuilt.subarray(0, 8)).toEqual(sector.subarray(0, 8));
  });
});
