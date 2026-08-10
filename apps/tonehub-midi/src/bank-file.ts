import {
  decodePresetBank,
  isPresetTrailingPadding,
  PRESET_BANK_BYTE_LENGTH,
} from "@tonehub/cube-baby-protocol";
import { bytesToCompactHex, compactHexToBytes } from "./format.js";

export const BANK_FILE_FORMAT = "tonehub-cube-baby-bank-v1";

export interface ToneHubBankFile {
  readonly format: typeof BANK_FILE_FORMAT;
  readonly memory: 5;
  readonly address: 0;
  readonly length: typeof PRESET_BANK_BYTE_LENGTH;
  readonly dataHex: string;
  readonly observedAt: string;
  readonly slots: readonly {
    readonly slot: "A" | "B" | "C";
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
    readonly trailingLooksLikePadding: boolean;
  }[];
}

export function bankFileFromBytes(data: Uint8Array, observedAtMs: number): ToneHubBankFile {
  if (data.length !== PRESET_BANK_BYTE_LENGTH) {
    throw new Error(`bank must be exactly ${PRESET_BANK_BYTE_LENGTH} bytes`);
  }
  const decoded = decodePresetBank(data);
  return {
    format: BANK_FILE_FORMAT,
    memory: 5,
    address: 0,
    length: PRESET_BANK_BYTE_LENGTH,
    dataHex: bytesToCompactHex(data),
    observedAt: new Date(observedAtMs).toISOString(),
    slots: decoded.slots.map((slot) => ({
      slot: slot.slot,
      type: slot.type,
      gain: slot.gain,
      tone: slot.tone,
      reverb: slot.reverb,
      feedback: slot.feedback,
      volume: slot.volume,
      time: slot.time,
      mix: slot.mix,
      modulation: slot.modulation,
      cabinet: slot.cabinet,
      irSection: slot.irSection,
      delaySection: slot.delaySection,
      toneSection: slot.toneSection,
      trailing: [...slot.trailing] as [number, number, number],
      trailingLooksLikePadding: isPresetTrailingPadding(slot),
    })),
  };
}

export function bytesFromBankFile(raw: unknown): Uint8Array {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("bank file must be a JSON object");
  }
  const file = raw as Partial<ToneHubBankFile>;
  if (file.format !== BANK_FILE_FORMAT) {
    throw new Error(`unsupported bank format (expected ${BANK_FILE_FORMAT})`);
  }
  if (typeof file.dataHex !== "string") {
    throw new Error("bank file missing dataHex");
  }
  const data = compactHexToBytes(file.dataHex);
  if (data.length !== PRESET_BANK_BYTE_LENGTH) {
    throw new Error(`dataHex must decode to ${PRESET_BANK_BYTE_LENGTH} bytes`);
  }
  return data;
}
