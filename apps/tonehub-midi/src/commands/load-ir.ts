import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { CubeBabyClient } from "@tonehub/cube-baby-api";
import { irRomSlotAddress, type IrRomPresenceStyle } from "@tonehub/cube-baby-protocol";
import type { MidiTransport } from "@tonehub/midi-core";

export interface LoadIrCommandOptions {
  readonly input: string;
  readonly output: string;
  readonly file: string;
  readonly slot?: string;
  readonly cabinet?: string;
  readonly volume?: string;
  readonly presence?: string;
  readonly backup?: string;
  readonly out?: string;
  readonly timeout?: string;
  /** Single confirm for persist + Cabinet select (upload slot default). */
  readonly confirmLoad?: boolean;
  /** Still required when --slot is 0..6. */
  readonly confirmOverwriteCabinet?: boolean;
  readonly json?: boolean;
}

/**
 * One-shot: WAV → padded ROM sector → persist slot (default 7) → select Cabinet (default 8).
 */
export async function loadIrCommand(
  transport: MidiTransport,
  options: LoadIrCommandOptions,
): Promise<void> {
  if (!options.confirmLoad) {
    throw new Error(
      "Refusing to transmit without --confirm-load; this overwrites an IR ROM slot and sets Cabinet",
    );
  }

  const slotIndex = options.slot === undefined ? 7 : Number(options.slot);
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 7) {
    throw new Error("--slot must be an integer 0..7 (default 7 = upload)");
  }
  if (slotIndex !== 7 && !options.confirmOverwriteCabinet) {
    throw new Error(
      `Refusing slot ${slotIndex}: factory cabinets need --confirm-overwrite-cabinet`,
    );
  }

  const cabinet = options.cabinet === undefined ? 8 : Number(options.cabinet);
  if (!Number.isInteger(cabinet) || cabinet < 0 || cabinet > 8) {
    throw new Error("--cabinet must be an integer 0..8 (default 8)");
  }

  const volume = options.volume === undefined ? 0.5 : Number(options.volume);
  if (!Number.isFinite(volume)) {
    throw new Error("--volume must be a finite number");
  }

  const presenceRaw = options.presence ?? "upload";
  if (presenceRaw !== "upload" && presenceRaw !== "factory") {
    throw new Error("--presence must be upload or factory");
  }
  const presence = presenceRaw as IrRomPresenceStyle;

  const timeoutMs = options.timeout === undefined ? 5_000 : Number(options.timeout);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 10_000) {
    throw new Error("--timeout must be an integer from 1 to 10000 milliseconds");
  }

  const client = new CubeBabyClient(transport);
  const ports = {
    inputPortId: options.input,
    outputPortId: options.output,
    timeoutMs,
  };

  let backupPath: string | undefined;
  if (options.backup !== undefined) {
    backupPath = resolve(options.backup);
    const dump = await client.dumpIrRom({ ...ports, slotIndex });
    await mkdir(dirname(backupPath), { recursive: true });
    await writeFile(backupPath, dump.data);
  }

  const wav = new Uint8Array(await readFile(resolve(options.file)));
  const result = await client.loadIrFromWav({
    ...ports,
    wav,
    slotIndex,
    cabinet,
    volume,
    presence,
  });

  let outPath: string | undefined;
  if (options.out !== undefined) {
    // Rebuild sector is inside persist path; re-dump for exact on-device image.
    outPath = resolve(options.out);
    const dump = await client.dumpIrRom({ ...ports, slotIndex });
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, dump.data);
  }

  const payload = {
    backup: backupPath,
    outPath,
    slotIndex: result.slotIndex,
    addressHex: `0x${irRomSlotAddress(result.slotIndex).toString(16)}`,
    cabinet: result.cabinet,
    romSlot: result.romSlot,
    persistVerified: result.persist.verified,
    writtenLength: result.persist.writtenLength,
    liveMatch: `${result.liveMatchPrefix}/${result.liveMatchTotal}`,
    observedAt: new Date(result.select.observedAtMs).toISOString(),
  };

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (backupPath !== undefined) console.log(`LoadIr backup → ${backupPath}`);
  console.log(
    `LoadIr slot=${result.slotIndex} cabinet=${result.cabinet} verified=${result.persist.verified} ` +
      `liveMatch=${result.liveMatchPrefix}/${result.liveMatchTotal}`,
  );
  if (outPath !== undefined) console.log(`wrote ${outPath}`);
}
