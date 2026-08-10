import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CubeBabyClient } from "@tonehub/cube-baby-api";
import type { MidiTransport } from "@tonehub/midi-core";
import { bytesFromBankFile } from "../bank-file.js";
import { bytesToCompactHex } from "../format.js";

export interface RestoreBankOptions {
  readonly input: string;
  readonly output: string;
  readonly file: string;
  readonly liveSlot?: string;
  readonly timeout?: string;
  readonly confirmRestore?: boolean;
  readonly json?: boolean;
}

function parseLiveSlot(value: string | undefined): number {
  if (value === undefined) return 0;
  const slot = value.trim().toUpperCase();
  if (slot === "A" || slot === "0") return 0;
  if (slot === "B" || slot === "1") return 1;
  if (slot === "C" || slot === "2") return 2;
  throw new Error("--live-slot must be A, B, or C");
}

export async function restoreBankCommand(
  transport: MidiTransport,
  options: RestoreBankOptions,
): Promise<void> {
  if (!options.confirmRestore) {
    throw new Error(
      "Refusing to transmit without --confirm-restore; this overwrites the full A+B+C bank",
    );
  }

  const timeoutMs = options.timeout === undefined ? 3_000 : Number(options.timeout);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 10_000) {
    throw new Error("--timeout must be an integer from 1 to 10000 milliseconds");
  }

  const absolutePath = resolve(options.file);
  const raw = JSON.parse(await readFile(absolutePath, "utf8")) as unknown;
  const data = bytesFromBankFile(raw);
  const liveSlotIndex = parseLiveSlot(options.liveSlot);

  const result = await new CubeBabyClient(transport).restoreBank({
    inputPortId: options.input,
    outputPortId: options.output,
    data,
    liveSlotIndex,
    timeoutMs,
  });

  const payload = {
    path: absolutePath,
    liveSlotIndex,
    beforeHex: bytesToCompactHex(result.before),
    writtenHex: bytesToCompactHex(result.written),
    afterHex: bytesToCompactHex(result.after),
    verified: result.verified,
    bankAck: result.bankAck,
    liveAckCount: result.liveAcks.length,
    observedAt: new Date(result.observedAtMs).toISOString(),
  };

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`RestoreBank from ${absolutePath} verified=${result.verified}`);
  console.log(
    `bank ACK accepted=${result.bankAck.accepted} raw=${result.bankAck.rawValue}; ` +
      `live fields pushed from slot index ${liveSlotIndex}`,
  );
  console.log(`afterHex: ${payload.afterHex}`);
}
