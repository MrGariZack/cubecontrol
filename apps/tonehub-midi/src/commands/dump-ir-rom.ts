import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { CubeBabyClient } from "@tonehub/cube-baby-api";
import { IR_ROM_PAYLOAD_LENGTH, IR_ROM_SLOT_SIZE } from "@tonehub/cube-baby-protocol";
import type { MidiTransport } from "@tonehub/midi-core";
import { bytesToCompactHex } from "../format.js";

export interface DumpIrRomCommandOptions {
  readonly input: string;
  readonly output: string;
  readonly slot: string;
  readonly file?: string;
  readonly timeout?: string;
  readonly confirmReadOnly?: boolean;
  readonly json?: boolean;
}

function classifyTail(data: Uint8Array): {
  readonly payloadPrefixHex: string;
  readonly afterPayload: "all-zero" | "all-ff" | "mixed" | "short";
  readonly nonzeroAfterPayload: number;
  readonly ffAfterPayload: number;
} {
  const prefix = data.subarray(0, Math.min(16, data.length));
  if (data.length < IR_ROM_PAYLOAD_LENGTH) {
    return {
      payloadPrefixHex: bytesToCompactHex(prefix),
      afterPayload: "short",
      nonzeroAfterPayload: 0,
      ffAfterPayload: 0,
    };
  }
  const tail = data.subarray(IR_ROM_PAYLOAD_LENGTH);
  let nonzero = 0;
  let ff = 0;
  for (const byte of tail) {
    if (byte !== 0) nonzero += 1;
    if (byte === 0xff) ff += 1;
  }
  let afterPayload: "all-zero" | "all-ff" | "mixed" = "mixed";
  if (nonzero === 0) afterPayload = "all-zero";
  else if (ff === tail.length) afterPayload = "all-ff";
  return {
    payloadPrefixHex: bytesToCompactHex(prefix),
    afterPayload,
    nonzeroAfterPayload: nonzero,
    ffAfterPayload: ff,
  };
}

export async function dumpIrRomCommand(
  transport: MidiTransport,
  options: DumpIrRomCommandOptions,
): Promise<void> {
  if (!options.confirmReadOnly) {
    throw new Error(
      "Refusing to transmit without --confirm-read-only; this only reads one IR ROM sector",
    );
  }

  const slotIndex = Number(options.slot);
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 8) {
    throw new Error("--slot must be an integer 0..8 (8 = empty sentinel 0x71000)");
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

  if (dump.data.length !== IR_ROM_SLOT_SIZE) {
    throw new Error(`expected ${IR_ROM_SLOT_SIZE} bytes, got ${dump.data.length}`);
  }

  const stats = classifyTail(dump.data);
  let writtenPath: string | undefined;
  if (options.file !== undefined) {
    writtenPath = resolve(options.file);
    await mkdir(dirname(writtenPath), { recursive: true });
    await writeFile(writtenPath, dump.data);
  }

  const out = {
    slotIndex: dump.slotIndex,
    addressHex: `0x${dump.address.toString(16)}`,
    length: dump.length,
    ...stats,
    file: writtenPath,
    observedAt: new Date(dump.observedAtMs).toISOString(),
  };

  if (options.json) {
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  console.log(
    `DumpIrRom slot=${dump.slotIndex} ${out.addressHex} bytes=${dump.length} afterPayload=${stats.afterPayload}`,
  );
  console.log(`header=${stats.payloadPrefixHex}`);
  if (writtenPath !== undefined) console.log(`wrote ${writtenPath}`);
}
