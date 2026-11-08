import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { CubeBabyClient } from "@tonehub/cube-baby-api";
import {
  buildIrRomSector,
  cabinetToRomSlot,
  decodeWavToMonoFloat32,
  IR_LIVE_DATA_ADDRESS,
  IR_LIVE_MEMORY,
  irRomSectorToLivePayload,
  irRomSlotAddress,
  prepareIrSamples,
  type IrRomPresenceStyle,
} from "@tonehub/cube-baby-protocol";
import type { MidiTransport } from "@tonehub/midi-core";
import { bytesToCompactHex } from "../format.js";

export interface ImportIrWavCommandOptions {
  readonly input?: string;
  readonly output?: string;
  readonly file: string;
  readonly out?: string;
  readonly slot?: string;
  readonly cabinet?: string;
  readonly volume?: string;
  readonly presence?: string;
  readonly timeout?: string;
  readonly applyLive?: boolean;
  readonly persistRom?: boolean;
  readonly confirmIrRomPersist?: boolean;
  readonly confirmLiveIr?: boolean;
  readonly confirmWrite?: boolean;
  readonly json?: boolean;
}

function equalPrefix(a: Uint8Array, b: Uint8Array, length: number): number {
  let matched = 0;
  for (let i = 0; i < length; i += 1) {
    if (a[i] === b[i]) matched += 1;
  }
  return matched;
}

export async function importIrWavCommand(
  transport: MidiTransport,
  options: ImportIrWavCommandOptions,
): Promise<void> {
  const wavBytes = await readFile(resolve(options.file));
  const decoded = decodeWavToMonoFloat32(wavBytes);
  const samples = prepareIrSamples(decoded.samples, decoded.sampleRate);
  const volume = options.volume === undefined ? 0.5 : Number(options.volume);
  if (!Number.isFinite(volume)) {
    throw new Error("--volume must be a finite number");
  }

  const presenceRaw = options.presence ?? "upload";
  if (presenceRaw !== "upload" && presenceRaw !== "factory") {
    throw new Error("--presence must be upload or factory");
  }
  const presence = presenceRaw as IrRomPresenceStyle;
  const sector = buildIrRomSector({ samples, volume, presence });
  const livePayload = irRomSectorToLivePayload(sector);

  let outPath: string | undefined;
  if (options.out !== undefined) {
    outPath = resolve(options.out);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, sector);
  }

  const wantsDevice =
    options.applyLive === true || options.persistRom === true || options.cabinet !== undefined;
  if (wantsDevice && (options.input === undefined || options.output === undefined)) {
    throw new Error("--input/--output required when applying, persisting, or setting Cabinet");
  }

  const timeoutMs = options.timeout === undefined ? 5_000 : Number(options.timeout);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 10_000) {
    throw new Error("--timeout must be an integer from 1 to 10000 milliseconds");
  }

  let slotIndex: number | undefined;
  if (options.slot !== undefined) {
    slotIndex = Number(options.slot);
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 7) {
      throw new Error("--slot must be an integer 0..7");
    }
  }

  let cabinet: number | undefined;
  if (options.cabinet !== undefined) {
    cabinet = Number(options.cabinet);
    if (!Number.isInteger(cabinet) || cabinet < 0 || cabinet > 8) {
      throw new Error("--cabinet must be an integer 0..8");
    }
  }

  if (options.persistRom === true) {
    if (slotIndex === undefined) {
      throw new Error("--persist-rom requires --slot");
    }
    if (!options.confirmIrRomPersist) {
      throw new Error("Refusing ROM persist without --confirm-ir-rom-persist");
    }
  }

  if (options.applyLive === true && !options.confirmLiveIr) {
    throw new Error("Refusing live IR apply without --confirm-live-ir");
  }
  if (cabinet !== undefined && !options.confirmWrite) {
    throw new Error("Refusing Cabinet write without --confirm-write");
  }

  const client =
    wantsDevice && options.input !== undefined && options.output !== undefined
      ? new CubeBabyClient(transport)
      : undefined;
  const ports =
    options.input !== undefined && options.output !== undefined
      ? {
          inputPortId: options.input,
          outputPortId: options.output,
          timeoutMs,
        }
      : undefined;

  let persist:
    | {
        slotIndex: number;
        addressHex: string;
        verified: boolean;
        writtenLength: number;
      }
    | undefined;
  if (client && ports && options.persistRom === true && slotIndex !== undefined) {
    const result = await client.persistIrRom({
      ...ports,
      payload: sector,
      slotIndex,
      padSector: true,
      timeoutMs,
    });
    if (!result.verified) {
      throw new Error(
        "IR ROM read-back did not match the written sector. Cabinet selection stopped.",
      );
    }
    persist = {
      slotIndex: result.slotIndex,
      addressHex: `0x${result.address.toString(16)}`,
      verified: result.verified,
      writtenLength: result.writtenLength,
    };
  }

  let liveApplied = false;
  if (client && ports && options.applyLive === true) {
    await client.applyLiveIr({
      ...ports,
      payload: livePayload,
      timeoutMs,
    });
    liveApplied = true;
  }

  let cabinetResult:
    | {
        cabinet: number;
        romSlot: number | null;
        liveMatch: number;
        liveTotal: number;
      }
    | undefined;
  if (client && ports && cabinet !== undefined) {
    // Firmware only reloads IR RAM when Cabinet changes; nudge via a different value first.
    const nudge = cabinet === 1 ? 2 : 1;
    await client.writeMemory({
      ...ports,
      memory: 5,
      address: 0x8000_0009,
      data: Uint8Array.of(nudge),
      handshake: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 350));
    await client.writeMemory({
      ...ports,
      memory: 5,
      address: 0x8000_0009,
      data: Uint8Array.of(cabinet),
      handshake: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 350));
    const live = await client.readMemory({
      ...ports,
      memory: IR_LIVE_MEMORY,
      address: IR_LIVE_DATA_ADDRESS,
      length: 68,
      handshake: false,
    });
    const expected = livePayload.subarray(0, 68);
    const romSlot = cabinetToRomSlot(cabinet);
    cabinetResult = {
      cabinet,
      romSlot,
      liveMatch: equalPrefix(live.data, expected, 68),
      liveTotal: 68,
    };
  }

  const out = {
    source: {
      file: resolve(options.file),
      sampleRate: decoded.sampleRate,
      channels: decoded.channels,
      sourceSamples: decoded.samples.length,
      irSamples: samples.length,
    },
    sector: {
      length: sector.length,
      presence,
      volume,
      addressHint:
        slotIndex === undefined ? undefined : `0x${irRomSlotAddress(slotIndex).toString(16)}`,
      headerHex: bytesToCompactHex(sector.subarray(0, 16)),
    },
    outPath,
    persist,
    liveApplied,
    cabinetResult,
    observedAt: new Date().toISOString(),
  };

  if (options.json) {
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  console.log(
    `ImportIrWav samples=${samples.length} sector=${sector.length} presence=${presence} volume=${volume}`,
  );
  if (outPath !== undefined) console.log(`wrote ${outPath}`);
  if (persist !== undefined) {
    console.log(
      `persist slot=${persist.slotIndex} ${persist.addressHex} verified=${persist.verified}`,
    );
  }
  if (liveApplied) console.log("apply-live: ok");
  if (cabinetResult !== undefined) {
    console.log(
      `cabinet=${cabinetResult.cabinet} romSlot=${cabinetResult.romSlot} ` +
        `liveMatch=${cabinetResult.liveMatch}/${cabinetResult.liveTotal}`,
    );
  }
}
