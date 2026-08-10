import { CubeBabyClient } from "@tonehub/cube-baby-api";
import { decodePresetBank, type PresetSlotId } from "@tonehub/cube-baby-protocol";
import type { MidiTransport } from "@tonehub/midi-core";
import { bytesToCompactHex } from "../format.js";

const SLOT_INDEX: Record<PresetSlotId, number> = { A: 0, B: 1, C: 2 };

export interface SaveParamOptions {
  readonly input: string;
  readonly output: string;
  readonly slot: string;
  readonly offset: string;
  readonly value: string;
  readonly timeout?: string;
  readonly confirmSave?: boolean;
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

function parseSlot(value: string): PresetSlotId {
  const slot = value.trim().toUpperCase();
  if (slot !== "A" && slot !== "B" && slot !== "C") {
    throw new Error("--slot must be A, B, or C");
  }
  return slot;
}

export async function saveParamCommand(
  transport: MidiTransport,
  options: SaveParamOptions,
): Promise<void> {
  if (!options.confirmSave) {
    throw new Error(
      "Refusing to transmit without --confirm-save; this persists the full A+B+C bank",
    );
  }

  const slot = parseSlot(options.slot);
  const offset = parseUint(options.offset, "--offset");
  const value = parseUint(options.value, "--value");
  const timeoutMs = options.timeout === undefined ? 3_000 : Number(options.timeout);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 10_000) {
    throw new Error("--timeout must be an integer from 1 to 10000 milliseconds");
  }

  const result = await new CubeBabyClient(transport).saveParam({
    inputPortId: options.input,
    outputPortId: options.output,
    slotIndex: SLOT_INDEX[slot],
    offset,
    value,
    timeoutMs,
  });

  const decoded = decodePresetBank(result.after);
  const payload = {
    slot,
    offset: result.offset,
    previousValue: result.previousValue,
    value: result.value,
    liveAck: result.liveAck,
    bankAck: result.bankAck,
    beforeHex: bytesToCompactHex(result.before),
    writtenHex: bytesToCompactHex(result.written),
    afterHex: bytesToCompactHex(result.after),
    verified: result.verified,
    slots: decoded.slots.map((entry) => ({
      slot: entry.slot,
      volume: entry.volume,
      gain: entry.gain,
    })),
    observedAt: new Date(result.observedAtMs).toISOString(),
  };

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(
    `SaveParam slot=${slot} offset=${offset} ${result.previousValue}->${result.value} verified=${result.verified}`,
  );
  console.log(
    `live ACK accepted=${result.liveAck.accepted} raw=${result.liveAck.rawValue}; ` +
      `bank ACK accepted=${result.bankAck.accepted} raw=${result.bankAck.rawValue}`,
  );
  console.log(`afterHex: ${payload.afterHex}`);
}
