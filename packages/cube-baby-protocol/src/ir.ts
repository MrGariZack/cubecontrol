import { IR_LIVE_PAYLOAD_LENGTH, IR_ROM_PAYLOAD_LENGTH, IR_ROM_SLOT_SIZE } from "./requests.js";

/** Confirmed live IR sample count (512 × float32 after distance). */
export const IR_LIVE_SAMPLE_COUNT = 512;
/** ROM audio region after 8-byte header: 1022 × float32. */
export const IR_ROM_AUDIO_SAMPLE_COUNT = 1022;
/** Samples CubeSuite/ToneHub place in the first half of a ROM sector. */
export const IR_ROM_PRIMARY_SAMPLE_COUNT = IR_LIVE_SAMPLE_COUNT;
export const IR_ROM_HEADER_BYTES = 8;
export const IR_TARGET_SAMPLE_RATE = 48_000;

export const IR_ROM_PRESENCE_FACTORY = Uint8Array.of(0x01, 0x00, 0x00, 0x00);
export const IR_ROM_PRESENCE_UPLOAD = Uint8Array.of(0x00, 0x00, 0x00, 0x00);

export type IrRomPresenceStyle = "factory" | "upload";

export interface BuildIrRomSectorOptions {
  readonly samples: Float32Array;
  readonly volume?: number;
  readonly presence?: IrRomPresenceStyle;
}

export interface BuildIrLivePayloadOptions {
  readonly samples: Float32Array;
  readonly distance?: number;
}

function writeFloat32LE(target: Uint8Array, offset: number, value: number): void {
  new DataView(target.buffer, target.byteOffset, target.byteLength).setFloat32(offset, value, true);
}

function readFloat32LE(source: Uint8Array, offset: number): number {
  return new DataView(source.buffer, source.byteOffset, source.byteLength).getFloat32(offset, true);
}

/** Truncate or zero-pad samples to `count`. */
export function normalizeIrSamples(samples: Float32Array, count: number): Float32Array {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("sample count must be a positive integer");
  }
  if (samples.length === count) return samples.slice();
  const out = new Float32Array(count);
  out.set(samples.subarray(0, Math.min(samples.length, count)));
  return out;
}

/**
 * Linear-resample mono float samples to `IR_TARGET_SAMPLE_RATE`, then take the first
 * `IR_LIVE_SAMPLE_COUNT` samples (impulse-style head window used by the pedal IR path).
 */
export function prepareIrSamples(
  samples: Float32Array,
  sourceSampleRate: number,
  targetCount: number = IR_LIVE_SAMPLE_COUNT,
): Float32Array {
  if (!Number.isFinite(sourceSampleRate) || sourceSampleRate <= 0) {
    throw new Error("sourceSampleRate must be a positive finite number");
  }
  if (samples.length === 0) {
    throw new Error("WAV / IR source has no samples");
  }

  let mono = samples;
  if (sourceSampleRate !== IR_TARGET_SAMPLE_RATE) {
    const ratio = sourceSampleRate / IR_TARGET_SAMPLE_RATE;
    const outLength = Math.max(1, Math.round(samples.length / ratio));
    const resampled = new Float32Array(outLength);
    for (let i = 0; i < outLength; i += 1) {
      const src = i * ratio;
      const i0 = Math.floor(src);
      const i1 = Math.min(i0 + 1, samples.length - 1);
      const frac = src - i0;
      const s0 = samples[i0] ?? 0;
      const s1 = samples[i1] ?? 0;
      resampled[i] = s0 + (s1 - s0) * frac;
    }
    mono = resampled;
  }

  return normalizeIrSamples(mono, targetCount);
}

/** Build a 4096-byte IR ROM sector (header + primary samples + zero pad). */
export function buildIrRomSector(options: BuildIrRomSectorOptions): Uint8Array {
  const volume = options.volume ?? 0.5;
  if (!Number.isFinite(volume)) {
    throw new Error("volume must be a finite number");
  }
  const presence =
    options.presence === "factory" ? IR_ROM_PRESENCE_FACTORY : IR_ROM_PRESENCE_UPLOAD;
  const samples = normalizeIrSamples(options.samples, IR_ROM_PRIMARY_SAMPLE_COUNT);
  const sector = new Uint8Array(IR_ROM_SLOT_SIZE);
  sector.set(presence, 0);
  writeFloat32LE(sector, 4, volume);
  const view = new DataView(sector.buffer, sector.byteOffset, sector.byteLength);
  for (let i = 0; i < samples.length; i += 1) {
    view.setFloat32(IR_ROM_HEADER_BYTES + i * 4, samples[i] ?? 0, true);
  }
  return sector;
}

/** Build the 2052-byte live IR block at `0x768` (distance + 512 samples). */
export function buildIrLivePayload(options: BuildIrLivePayloadOptions): Uint8Array {
  const distance = options.distance ?? 0.5;
  if (!Number.isFinite(distance)) {
    throw new Error("distance must be a finite number");
  }
  const samples = normalizeIrSamples(options.samples, IR_LIVE_SAMPLE_COUNT);
  const payload = new Uint8Array(IR_LIVE_PAYLOAD_LENGTH);
  writeFloat32LE(payload, 0, distance);
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  for (let i = 0; i < samples.length; i += 1) {
    view.setFloat32(4 + i * 4, samples[i] ?? 0, true);
  }
  return payload;
}

/** Derive live IR payload from a ROM sector (matches Cabinet load observed in 032). */
export function irRomSectorToLivePayload(sector: Uint8Array): Uint8Array {
  if (sector.length !== IR_ROM_SLOT_SIZE) {
    throw new Error(`ROM sector must be ${IR_ROM_SLOT_SIZE} bytes`);
  }
  const distance = readFloat32LE(sector, 4);
  const samples = new Float32Array(IR_LIVE_SAMPLE_COUNT);
  const view = new DataView(sector.buffer, sector.byteOffset, sector.byteLength);
  for (let i = 0; i < IR_LIVE_SAMPLE_COUNT; i += 1) {
    samples[i] = view.getFloat32(IR_ROM_HEADER_BYTES + i * 4, true);
  }
  return buildIrLivePayload({ samples, distance });
}

/** CubeSuite-length 2056-byte image = sector bytes `[0 .. 2056)`. */
export function irRomSectorToUploadPayload(sector: Uint8Array): Uint8Array {
  if (sector.length !== IR_ROM_SLOT_SIZE) {
    throw new Error(`ROM sector must be ${IR_ROM_SLOT_SIZE} bytes`);
  }
  return sector.slice(0, IR_ROM_PAYLOAD_LENGTH);
}

export interface ParsedIrRomSector {
  readonly presence: IrRomPresenceStyle | "other";
  readonly volume: number;
  readonly samples: Float32Array;
  /** Count of non-finite float32 values replaced with 0 in the primary window. */
  readonly sanitizedSampleCount: number;
}

function detectPresence(header: Uint8Array): IrRomPresenceStyle | "other" {
  if (
    header[0] === IR_ROM_PRESENCE_FACTORY[0] &&
    header[1] === IR_ROM_PRESENCE_FACTORY[1] &&
    header[2] === IR_ROM_PRESENCE_FACTORY[2] &&
    header[3] === IR_ROM_PRESENCE_FACTORY[3]
  ) {
    return "factory";
  }
  if (
    header[0] === IR_ROM_PRESENCE_UPLOAD[0] &&
    header[1] === IR_ROM_PRESENCE_UPLOAD[1] &&
    header[2] === IR_ROM_PRESENCE_UPLOAD[2] &&
    header[3] === IR_ROM_PRESENCE_UPLOAD[3]
  ) {
    return "upload";
  }
  return "other";
}

/** Parse a 4096-byte ROM sector into volume + primary 512 samples (NaN/Inf → 0). */
export function parseIrRomSector(sector: Uint8Array): ParsedIrRomSector {
  if (sector.length !== IR_ROM_SLOT_SIZE) {
    throw new Error(`ROM sector must be ${IR_ROM_SLOT_SIZE} bytes`);
  }
  const volumeRaw = readFloat32LE(sector, 4);
  const volume = Number.isFinite(volumeRaw) ? volumeRaw : 0.5;
  const samples = new Float32Array(IR_ROM_PRIMARY_SAMPLE_COUNT);
  const view = new DataView(sector.buffer, sector.byteOffset, sector.byteLength);
  let sanitizedSampleCount = 0;
  for (let i = 0; i < IR_ROM_PRIMARY_SAMPLE_COUNT; i += 1) {
    const sample = view.getFloat32(IR_ROM_HEADER_BYTES + i * 4, true);
    if (Number.isFinite(sample)) {
      samples[i] = sample;
    } else {
      samples[i] = 0;
      sanitizedSampleCount += 1;
    }
  }
  return {
    presence: detectPresence(sector.subarray(0, 4)),
    volume,
    samples,
    sanitizedSampleCount,
  };
}

/** Export primary IR samples from a ROM sector as mono PCM16 WAV @ 48 kHz. */
export function irRomSectorToWav(sector: Uint8Array): {
  readonly wav: Uint8Array;
  readonly parsed: ParsedIrRomSector;
} {
  const parsed = parseIrRomSector(sector);
  return {
    wav: encodeMonoPcm16Wav(parsed.samples, IR_TARGET_SAMPLE_RATE),
    parsed,
  };
}

export interface DecodedWav {
  readonly sampleRate: number;
  readonly samples: Float32Array;
  readonly channels: number;
}

function findChunk(view: DataView, id: string, from: number): { offset: number; size: number } {
  let offset = from;
  while (offset + 8 <= view.byteLength) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    );
    const size = view.getUint32(offset + 4, true);
    if (chunkId === id) {
      return { offset: offset + 8, size };
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error(`WAV missing ${id} chunk`);
}

/**
 * Decode a PCM or IEEE-float WAV to mono float32 in `-1..1`.
 * Supports 16/24/32-bit PCM and 32-bit float; downmixes by averaging channels.
 */
export function decodeWavToMonoFloat32(bytes: Uint8Array): DecodedWav {
  if (bytes.length < 44) {
    throw new Error("WAV too small");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3),
  );
  const wave = String.fromCharCode(
    view.getUint8(8),
    view.getUint8(9),
    view.getUint8(10),
    view.getUint8(11),
  );
  if (riff !== "RIFF" || wave !== "WAVE") {
    throw new Error("not a RIFF/WAVE file");
  }

  const fmt = findChunk(view, "fmt ", 12);
  const audioFormat = view.getUint16(fmt.offset, true);
  const channels = view.getUint16(fmt.offset + 2, true);
  const sampleRate = view.getUint32(fmt.offset + 4, true);
  const bitsPerSample = view.getUint16(fmt.offset + 14, true);
  if (channels < 1) {
    throw new Error("WAV has no channels");
  }

  const data = findChunk(view, "data", 12);
  const frameSize = (bitsPerSample / 8) * channels;
  if (!Number.isInteger(frameSize) || frameSize <= 0) {
    throw new Error("unsupported WAV frame size");
  }
  const frameCount = Math.floor(data.size / frameSize);
  const mono = new Float32Array(frameCount);
  let o = data.offset;

  for (let i = 0; i < frameCount; i += 1) {
    let sum = 0;
    for (let ch = 0; ch < channels; ch += 1) {
      if (audioFormat === 3 && bitsPerSample === 32) {
        sum += view.getFloat32(o, true);
        o += 4;
      } else if (audioFormat === 1 && bitsPerSample === 16) {
        sum += view.getInt16(o, true) / 32768;
        o += 2;
      } else if (audioFormat === 1 && bitsPerSample === 24) {
        const b0 = view.getUint8(o);
        const b1 = view.getUint8(o + 1);
        const b2 = view.getUint8(o + 2);
        o += 3;
        let sample = (b2 << 16) | (b1 << 8) | b0;
        if (sample & 0x800000) sample |= ~0xffffff;
        sum += sample / 8388608;
      } else if (audioFormat === 1 && bitsPerSample === 32) {
        sum += view.getInt32(o, true) / 2147483648;
        o += 4;
      } else {
        throw new Error(
          `unsupported WAV format (audioFormat=${audioFormat}, bits=${bitsPerSample})`,
        );
      }
    }
    mono[i] = sum / channels;
  }

  return { sampleRate, samples: mono, channels };
}

/** Encode a minimal mono PCM16 WAV (for fixtures / export). */
export function encodeMonoPcm16Wav(samples: Float32Array, sampleRate: number): Uint8Array {
  if (!Number.isInteger(sampleRate) || sampleRate <= 0) {
    throw new Error("sampleRate must be a positive integer");
  }
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) bytes[offset + i] = text.charCodeAt(i);
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
  }
  return bytes;
}
