import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { CubeBabyClient } from "@tonehub/cube-baby-api";
import { PRESET_BANK_BYTE_LENGTH } from "@tonehub/cube-baby-protocol";
import type { MidiTransport } from "@tonehub/midi-core";
import { bankFileFromBytes } from "../bank-file.js";

export interface BackupBankOptions {
  readonly input: string;
  readonly output: string;
  readonly file: string;
  readonly timeout?: string;
  readonly confirmReadOnly?: boolean;
  readonly json?: boolean;
}

export async function backupBankCommand(
  transport: MidiTransport,
  options: BackupBankOptions,
): Promise<void> {
  if (!options.confirmReadOnly) {
    throw new Error(
      "Refusing to transmit without --confirm-read-only; this only reads the 48-byte bank",
    );
  }

  const timeoutMs = options.timeout === undefined ? 3_000 : Number(options.timeout);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 10_000) {
    throw new Error("--timeout must be an integer from 1 to 10000 milliseconds");
  }

  const result = await new CubeBabyClient(transport).readMemory({
    inputPortId: options.input,
    outputPortId: options.output,
    memory: 5,
    address: 0,
    length: PRESET_BANK_BYTE_LENGTH,
    timeoutMs,
  });

  const bankFile = bankFileFromBytes(result.data, result.observedAtMs);
  const absolutePath = resolve(options.file);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(bankFile, null, 2)}\n`, "utf8");

  if (options.json) {
    console.log(JSON.stringify({ ...bankFile, path: absolutePath }, null, 2));
    return;
  }

  console.log(`BackupBank wrote ${absolutePath}`);
  console.log(`dataHex: ${bankFile.dataHex}`);
  for (const slot of bankFile.slots) {
    console.log(
      `slot ${slot.slot}: type=${slot.type} gain=${slot.gain} volume=${slot.volume} cabinet=${slot.cabinet}`,
    );
  }
}
