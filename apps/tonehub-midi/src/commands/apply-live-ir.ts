import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CubeBabyClient } from "@tonehub/cube-baby-api";
import { IR_LIVE_PAYLOAD_LENGTH } from "@tonehub/cube-baby-protocol";
import type { MidiTransport } from "@tonehub/midi-core";
import { compactHexToBytes } from "../format.js";

export interface ApplyLiveIrCommandOptions {
  readonly input: string;
  readonly output: string;
  readonly file: string;
  readonly distance?: string;
  readonly timeout?: string;
  readonly confirmLiveIr?: boolean;
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

  if (raw.byteLength === IR_LIVE_PAYLOAD_LENGTH) {
    return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  }

  const asText = raw.toString("utf8").trim().replace(/\s+/g, "");
  if (/^[0-9a-fA-F]+$/.test(asText) && asText.length === IR_LIVE_PAYLOAD_LENGTH * 2) {
    return compactHexToBytes(asText);
  }

  throw new Error(
    `unsupported IR file (need ${IR_LIVE_PAYLOAD_LENGTH}-byte .bin or matching hex/JSON)`,
  );
}

export async function applyLiveIrCommand(
  transport: MidiTransport,
  options: ApplyLiveIrCommandOptions,
): Promise<void> {
  if (!options.confirmLiveIr) {
    throw new Error(
      "Refusing to transmit without --confirm-live-ir; this writes IR live RAM only (no ROM/erase)",
    );
  }

  const timeoutMs = options.timeout === undefined ? 3_000 : Number(options.timeout);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 10_000) {
    throw new Error("--timeout must be an integer from 1 to 10000 milliseconds");
  }

  const distance = options.distance === undefined ? undefined : Number(options.distance);
  if (distance !== undefined && !Number.isFinite(distance)) {
    throw new Error("--distance must be a finite number");
  }

  const payload = await loadPayload(options.file);
  if (payload.length !== IR_LIVE_PAYLOAD_LENGTH) {
    throw new Error(`IR payload must be ${IR_LIVE_PAYLOAD_LENGTH} bytes (got ${payload.length})`);
  }

  const result = await new CubeBabyClient(transport).applyLiveIr({
    inputPortId: options.input,
    outputPortId: options.output,
    payload,
    timeoutMs,
    ...(distance === undefined ? {} : { distance }),
  });

  const payloadOut = {
    payloadLength: result.payloadLength,
    distance: result.distance,
    chunkCount: result.chunkCount,
    flagOffAck: result.flagOffAck,
    flagOnAck: result.flagOnAck,
    registerAcks: result.registerAcks,
    chunkAckAcceptedFalseCount: result.chunkAcks.filter((chunk) => !chunk.accepted).length,
    romPersist: false,
    eraseSent: false,
    observedAt: new Date(result.observedAtMs).toISOString(),
  };

  if (options.json) {
    console.log(JSON.stringify(payloadOut, null, 2));
    return;
  }

  console.log(
    `ApplyLiveIr bytes=${result.payloadLength} chunks=${result.chunkCount} distance=${result.distance}`,
  );
  console.log(
    `flag off ACK accepted=${result.flagOffAck.accepted}; flag on ACK accepted=${result.flagOnAck.accepted}`,
  );
  console.log(
    `register ACKs: ${result.registerAcks
      .map((ack) => `0x${ack.address.toString(16)}=${ack.accepted}`)
      .join(", ")}`,
  );
  console.log("ROM persist: not sent (live RAM only)");
}
