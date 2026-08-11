import type { IrRomPresenceStyle, LiveParamName } from "@tonehub/cube-baby-protocol";

export interface CubeBabyIdentity {
  readonly reportedName: string;
  readonly rawNameByteLength: number;
  readonly metadata: Uint8Array;
  readonly observedAtMs: number;
}

export interface IdentifyCubeBabyOptions {
  readonly inputPortId: string;
  readonly outputPortId: string;
  readonly timeoutMs?: number;
}

export interface CubeBabyMemoryRead {
  readonly memory: number;
  readonly address: number;
  readonly length: number;
  readonly data: Uint8Array;
  readonly observedAtMs: number;
}

export interface ReadCubeBabyMemoryOptions {
  readonly inputPortId: string;
  readonly outputPortId: string;
  readonly memory: number;
  readonly address: number;
  readonly length: number;
  readonly timeoutMs?: number;
  /** Send the captured identity request before the read (CubeSuite startup order). */
  readonly handshake?: boolean;
}

export interface CubeBabyMemoryWriteAck {
  readonly memory: number;
  readonly address: number;
  readonly length: number;
  readonly data: Uint8Array;
  readonly accepted: boolean;
  readonly rawValue: number;
  readonly observedAtMs: number;
}

export interface WriteCubeBabyMemoryOptions {
  readonly inputPortId: string;
  readonly outputPortId: string;
  readonly memory: number;
  readonly address: number;
  readonly data: Uint8Array;
  readonly timeoutMs?: number;
  /** Send the captured identity request before the write (CubeSuite startup order). */
  readonly handshake?: boolean;
}

export interface SaveCubeBabyParamOptions {
  readonly inputPortId: string;
  readonly outputPortId: string;
  /** 0=A, 1=B, 2=C */
  readonly slotIndex: number;
  /** Field offset 0..12 */
  readonly offset: number;
  readonly value: number;
  readonly timeoutMs?: number;
}

export interface CubeBabySaveParamResult {
  readonly slotIndex: number;
  readonly offset: number;
  readonly previousValue: number;
  readonly value: number;
  readonly before: Uint8Array;
  readonly written: Uint8Array;
  readonly after: Uint8Array;
  readonly verified: boolean;
  readonly liveAck: { readonly accepted: boolean; readonly rawValue: number };
  readonly bankAck: { readonly accepted: boolean; readonly rawValue: number };
  readonly observedAtMs: number;
}

export interface RestoreCubeBabyBankOptions {
  readonly inputPortId: string;
  readonly outputPortId: string;
  readonly data: Uint8Array;
  /** Slot whose offsets 0–12 are pushed to live RAM after the bank write (default 0 = A). */
  readonly liveSlotIndex?: number;
  readonly timeoutMs?: number;
}

export interface CubeBabyRestoreBankResult {
  readonly before: Uint8Array;
  readonly written: Uint8Array;
  readonly after: Uint8Array;
  readonly verified: boolean;
  readonly bankAck: { readonly accepted: boolean; readonly rawValue: number };
  readonly liveSlotIndex: number;
  readonly liveAcks: readonly {
    readonly offset: number;
    readonly accepted: boolean;
    readonly rawValue: number;
  }[];
  readonly observedAtMs: number;
}

export interface WriteCubeBabyRegisterOptions {
  readonly inputPortId: string;
  readonly outputPortId: string;
  readonly memory: number;
  readonly address: number;
  readonly value: number;
  readonly timeoutMs?: number;
  readonly handshake?: boolean;
}

export interface CubeBabyRegisterWriteAck {
  readonly memory: number;
  readonly address: number;
  readonly value: number;
  readonly accepted: boolean;
  readonly rawValue: number;
  readonly observedAtMs: number;
}

export interface ApplyLiveIrOptions {
  readonly inputPortId: string;
  readonly outputPortId: string;
  /** 2052-byte live IR block starting at 0x768 (float32 distance + samples). */
  readonly payload: Uint8Array;
  /** Optional distance override written as float32 LE into the first 4 payload bytes. */
  readonly distance?: number;
  readonly timeoutMs?: number;
}

export interface CubeBabyApplyLiveIrResult {
  readonly payloadLength: number;
  readonly distance: number;
  readonly chunkCount: number;
  readonly flagOffAck: { readonly accepted: boolean; readonly rawValue: number };
  readonly flagOnAck: { readonly accepted: boolean; readonly rawValue: number };
  readonly registerAcks: readonly {
    readonly address: number;
    readonly value: number;
    readonly accepted: boolean;
    readonly rawValue: number;
  }[];
  readonly chunkAcks: readonly {
    readonly address: number;
    readonly length: number;
    readonly accepted: boolean;
  }[];
  readonly observedAtMs: number;
}

export interface EraseCubeBabyMemoryOptions {
  readonly inputPortId: string;
  readonly outputPortId: string;
  readonly memory: number;
  readonly address: number;
  readonly timeoutMs?: number;
  readonly handshake?: boolean;
}

export interface CubeBabyEraseAck {
  readonly memory: number;
  readonly address: number;
  readonly accepted: boolean;
  readonly rawValue: number;
  readonly observedAtMs: number;
}

export interface PersistIrRomOptions {
  readonly inputPortId: string;
  readonly outputPortId: string;
  /** 2056-byte CubeSuite image or full 4096-byte sector dump. */
  readonly payload: Uint8Array;
  /**
   * Factory slot 0..7 (default 7 = upload `0x00070000`).
   * Address = `0x69000 + slotIndex * 0x1000`.
   */
  readonly slotIndex?: number;
  /**
   * When true (default), 2056-byte payloads are zero-padded to 4096 before write.
   * Set false only to reproduce CubeSuite's erase-tail `0xFF` behavior.
   */
  readonly padSector?: boolean;
  readonly timeoutMs?: number;
}

export interface CubeBabyPersistIrRomResult {
  readonly slotIndex: number;
  readonly address: number;
  readonly payloadLength: number;
  readonly writtenLength: number;
  readonly padded: boolean;
  readonly eraseAck: { readonly accepted: boolean; readonly rawValue: number };
  readonly writeChunkCount: number;
  readonly verifyBytes: number;
  readonly verified: boolean;
  readonly observedAtMs: number;
}

export interface DumpIrRomOptions {
  readonly inputPortId: string;
  readonly outputPortId: string;
  /** Factory slot 0..7, or 8 to read the empty sentinel at `0x71000`. */
  readonly slotIndex: number;
  readonly timeoutMs?: number;
}

export interface CubeBabyDumpIrRomResult {
  readonly slotIndex: number;
  readonly address: number;
  readonly length: number;
  readonly data: Uint8Array;
  readonly observedAtMs: number;
}

export interface WriteLiveParamOptions {
  readonly inputPortId: string;
  readonly outputPortId: string;
  /** Named live field, or use `offset`. */
  readonly param?: LiveParamName;
  /** Within-slot offset 0..12 when not using `param`. */
  readonly offset?: number;
  /**
   * Active preset foot A/B/C → 0/1/2. Live address = slotIndex*16 + field offset
   * (exp. 038). Default 0 (slot A).
   */
  readonly slotIndex?: number;
  readonly value: number;
  readonly timeoutMs?: number;
  readonly handshake?: boolean;
}

export interface SelectCabinetOptions {
  readonly inputPortId: string;
  readonly outputPortId: string;
  /** Cabinet value 0..8. */
  readonly cabinet: number;
  /** Preset slot band for the cabinet live byte (default 0 = A). */
  readonly slotIndex?: number;
  /**
   * When true (default), write a different Cabinet first so firmware reloads IR RAM
   * even if the target value was already selected (experiment 033/035).
   */
  readonly nudge?: boolean;
  readonly timeoutMs?: number;
}

export interface CubeBabySelectCabinetResult {
  readonly cabinet: number;
  readonly romSlot: number | null;
  readonly nudgedFrom: number | null;
  readonly ack: { readonly accepted: boolean; readonly rawValue: number };
  readonly observedAtMs: number;
}

export interface LoadIrFromWavOptions {
  readonly inputPortId: string;
  readonly outputPortId: string;
  readonly wav: Uint8Array;
  /** ROM slot 0..7 (default 7 = upload). */
  readonly slotIndex?: number;
  /** Live Cabinet after persist (default 8 for upload slot). */
  readonly cabinet?: number;
  readonly volume?: number;
  readonly presence?: IrRomPresenceStyle;
  readonly timeoutMs?: number;
}

export interface CubeBabyLoadIrFromWavResult {
  readonly slotIndex: number;
  readonly cabinet: number;
  readonly romSlot: number | null;
  readonly sectorLength: number;
  readonly persist: CubeBabyPersistIrRomResult;
  readonly select: CubeBabySelectCabinetResult;
  readonly liveMatchPrefix: number;
  readonly liveMatchTotal: number;
}
