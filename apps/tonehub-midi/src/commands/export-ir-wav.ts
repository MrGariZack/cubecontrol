import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { CubeBabyClient } from "@tonehub/cube-baby-api";
import { IR_ROM_SLOT_SIZE, irRomSectorToWav, irRomSlotAddress } from "@tonehub/cube-baby-protocol";
import type { MidiTransport } from "@tonehub/midi-core";
import { bytesToCompactHex } from "../format.js";

export interface ExportIrWavCommandOptions {
  readonly input?: string;
  readonly output?: string;
  readonly slot?: string;
  readonly file?: string;
  readonly out: string;
  readonly timeout?: string;
  readonly confirmReadOnly?: boolean;
  readonly json?: boolean;
}

export async function exportIrWavCommand(
  transport: MidiTransport,
  options: ExportIrWavCommandOptions,
): Promise<void> {
  const fromSlot = options.slot !== undefined;
  const fromFile = options.file !== undefined;
  if (fromSlot === fromFile) {
    throw new Error("Provide exactly one of --slot or --file");
  }

  let sector: Uint8Array;
  let source:
    | { kind: "slot"; slotIndex: number; addressHex: string }
    | { kind: "file"; path: string };

  if (fromFile && options.file !== undefined) {
    const path = resolve(options.file);
    const raw = await readFile(path);
    if (raw.byteLength !== IR_ROM_SLOT_SIZE) {
      throw new Error(
        `--file must be a ${IR_ROM_SLOT_SIZE}-byte ROM sector (got ${raw.byteLength})`,
      );
    }
    sector = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
    source = { kind: "file", path };
  } else {
    if (!options.confirmReadOnly) {
      throw new Error(
        "Refusing to transmit without --confirm-read-only; this reads one IR ROM sector",
      );
    }
    if (options.input === undefined || options.output === undefined) {
      throw new Error("--input/--output required when exporting --slot from the device");
    }
    const slotIndex = Number(options.slot);
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 7) {
      throw new Error("--slot must be an integer 0..7");
    }
    const timeoutMs = options.timeout === undefined ? 5_000 : Number(options.timeout);
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 10_000) {
      throw new Error("--timeout must be an integer from 1 to 10000 milliseconds");
    }
    const dump = await new CubeBabyClient(transport).dumpIrRom({
      inputPortId: options.input,
      outputPortId: options.output,
      slotIndex,
      timeoutMs,
    });
    sector = dump.data;
    source = {
      kind: "slot",
      slotIndex,
      addressHex: `0x${irRomSlotAddress(slotIndex).toString(16)}`,
    };
  }

  const { wav, parsed } = irRomSectorToWav(sector);
  const outPath = resolve(options.out);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, wav);

  const payload = {
    source,
    presence: parsed.presence,
    volume: parsed.volume,
    sampleCount: parsed.samples.length,
    sanitizedSampleCount: parsed.sanitizedSampleCount,
    headerHex: bytesToCompactHex(sector.subarray(0, 16)),
    outPath,
    wavBytes: wav.length,
    observedAt: new Date().toISOString(),
  };

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(
    `ExportIrWav presence=${parsed.presence} volume=${parsed.volume} samples=${parsed.samples.length} → ${outPath}`,
  );
}
