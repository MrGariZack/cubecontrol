import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CubeBabyClient } from "@tonehub/cube-baby-api";
import { IR_ROM_PAYLOAD_LENGTH, IR_ROM_SLOT_SIZE } from "@tonehub/cube-baby-protocol";
import type { MidiTransport } from "@tonehub/midi-core";
import { compactHexToBytes } from "../format.js";

export interface PersistIrRomCommandOptions {
  readonly input: string;
  readonly output: string;
  readonly file: string;
  /** Explicit ROM slot 0..7. */
  readonly slot: string;
  readonly timeout?: string;
  readonly confirmIrRomPersist?: boolean;
  /**
   * Commander: `--no-pad-sector` → false. Default pads 2056→4096 with zeros.
   */
  readonly padSector?: boolean;
  readonly json?: boolean;
}

async function loadPayload(filePath: string): Promise<Uint8Array> {
  const absolutePath = resolve(filePath);
  const raw = await readFile(absolutePath);
  const lower = absolutePath.toLowerCase();

  if (lower.endsWith(".json")) {
    const parsed = JSON.parse(raw.toString("utf8")) as { dataHex?: string };
    if (typeof parsed.dataHex !== "string") {
      throw new Error("JSON IR file must contain dataHex");
    }
    return compactHexToBytes(parsed.dataHex);
  }

  if (lower.endsWith(".hex")) {
    return compactHexToBytes(raw.toString("utf8"));
  }

  if (raw.byteLength === IR_ROM_PAYLOAD_LENGTH || raw.byteLength === IR_ROM_SLOT_SIZE) {
    return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  }

  const asText = raw.toString("utf8").trim().replace(/\s+/g, "");
  if (/^[0-9a-fA-F]+$/.test(asText)) {
    if (asText.length === IR_ROM_PAYLOAD_LENGTH * 2 || asText.length === IR_ROM_SLOT_SIZE * 2) {
      return compactHexToBytes(asText);
    }
  }

  throw new Error(
    `unsupported IR ROM file (need ${IR_ROM_PAYLOAD_LENGTH}- or ${IR_ROM_SLOT_SIZE}-byte .bin or matching hex/JSON)`,
  );
}

export async function persistIrRomCommand(
  transport: MidiTransport,
  options: PersistIrRomCommandOptions,
): Promise<void> {
  if (!options.confirmIrRomPersist) {
    throw new Error(
      "Refusing to transmit without --confirm-ir-rom-persist; this erases and rewrites an IR ROM slot",
    );
  }

  const slotIndex = Number(options.slot);
  if (!options.slot?.trim() || !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 7) {
    throw new Error("--slot must be an integer 0..7");
  }

  const timeoutMs = options.timeout === undefined ? 5_000 : Number(options.timeout);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 10_000) {
    throw new Error("--timeout must be an integer from 1 to 10000 milliseconds");
  }

  const payload = await loadPayload(options.file);
  const padSector = options.padSector !== false;

  const result = await new CubeBabyClient(transport).persistIrRom({
    inputPortId: options.input,
    outputPortId: options.output,
    payload,
    slotIndex,
    padSector,
    timeoutMs,
  });

  const out = {
    slotIndex: result.slotIndex,
    payloadLength: result.payloadLength,
    writtenLength: result.writtenLength,
    padded: result.padded,
    eraseAck: result.eraseAck,
    writeChunkCount: result.writeChunkCount,
    verifyBytes: result.verifyBytes,
    verified: result.verified,
    target: { memory: 0, addressHex: `0x${result.address.toString(16)}` },
    observedAt: new Date(result.observedAtMs).toISOString(),
  };

  if (options.json) {
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  console.log(
    `PersistIrRom slot=${result.slotIndex} addr=0x${result.address.toString(16)} ` +
      `in=${result.payloadLength} written=${result.writtenLength} padded=${result.padded} ` +
      `chunks=${result.writeChunkCount} verified=${result.verified}`,
  );
  console.log(
    `erase ACK accepted=${result.eraseAck.accepted} raw=${result.eraseAck.rawValue}; verifyBytes=${result.verifyBytes}`,
  );
}
