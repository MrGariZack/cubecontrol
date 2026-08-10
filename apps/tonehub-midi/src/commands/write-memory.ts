import { CubeBabyClient } from "@tonehub/cube-baby-api";
import type { MidiTransport } from "@tonehub/midi-core";
import { bytesToCompactHex } from "../format.js";

/** Live parameter RAM window confirmed by experiments 004–017. */
const LIVE_MEMORY = 5;
const LIVE_BASE = 0x8000_0000;
const LIVE_MAX_OFFSET = 12;

export interface WriteMemoryOptions {
  readonly input: string;
  readonly output: string;
  readonly memory: string;
  readonly address: string;
  readonly data: string;
  readonly timeout?: string;
  readonly confirmWrite?: boolean;
  /** Commander maps `--no-handshake` to `handshake: false`. */
  readonly handshake?: boolean;
  readonly json?: boolean;
}

function parseUint(value: string, label: string): number {
  const parsed =
    value.startsWith("0x") || value.startsWith("0X") ? Number.parseInt(value, 16) : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer (decimal or 0x hex)`);
  }
  return parsed;
}

function parseDataByte(value: string): Uint8Array {
  const trimmed = value.trim();
  if (/^[0-9a-fA-F]{2}$/.test(trimmed)) {
    return Uint8Array.of(Number.parseInt(trimmed, 16));
  }
  const asNumber = parseUint(trimmed, "--data");
  if (asNumber > 0xff) {
    throw new Error("--data must be a single byte (0–255 or two hex digits)");
  }
  return Uint8Array.of(asNumber);
}

export async function writeMemoryCommand(
  transport: MidiTransport,
  options: WriteMemoryOptions,
): Promise<void> {
  if (!options.confirmWrite) {
    throw new Error(
      "Refusing to transmit without --confirm-write; this sends a live WriteMemory (0x22)",
    );
  }

  const memory = parseUint(options.memory, "--memory");
  const address = parseUint(options.address, "--address");
  const data = parseDataByte(options.data);
  const timeoutMs = options.timeout === undefined ? 2_000 : Number(options.timeout);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 10_000) {
    throw new Error("--timeout must be an integer from 1 to 10000 milliseconds");
  }

  if (memory !== LIVE_MEMORY) {
    throw new Error(`--memory must be ${LIVE_MEMORY} for the approved live-parameter window`);
  }
  if (address < LIVE_BASE || address > LIVE_BASE + LIVE_MAX_OFFSET) {
    throw new Error(
      `--address must be in 0x${LIVE_BASE.toString(16)}..0x${(LIVE_BASE + LIVE_MAX_OFFSET).toString(16)} (live params only)`,
    );
  }
  if (data.length !== 1) {
    throw new Error("only single-byte live writes are allowed in this CLI milestone");
  }

  const result = await new CubeBabyClient(transport).writeMemory({
    inputPortId: options.input,
    outputPortId: options.output,
    memory,
    address,
    data,
    timeoutMs,
    handshake: options.handshake !== false,
  });

  const payload = {
    memory: result.memory,
    address: result.address,
    addressHex: `0x${result.address.toString(16)}`,
    length: result.length,
    dataHex: bytesToCompactHex(result.data),
    data: [...result.data],
    accepted: result.accepted,
    rawValue: result.rawValue,
    observedAt: new Date(result.observedAtMs).toISOString(),
  };

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(
    `WriteMemory mem=${payload.memory} addr=${payload.addressHex} data=${payload.dataHex} ` +
      `ACK accepted=${payload.accepted} raw=${payload.rawValue}`,
  );
}
