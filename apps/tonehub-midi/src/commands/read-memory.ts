import { CubeBabyClient } from "@tonehub/cube-baby-api";
import {
  decodePresetBank,
  isPresetTrailingPadding,
  PRESET_BANK_BYTE_LENGTH,
} from "@tonehub/cube-baby-protocol";
import type { MidiTransport } from "@tonehub/midi-core";
import { bytesToCompactHex } from "../format.js";

export interface ReadMemoryOptions {
  readonly input: string;
  readonly output: string;
  readonly memory: string;
  readonly address: string;
  readonly length: string;
  readonly timeout?: string;
  readonly confirmReadOnly?: boolean;
  /** Commander maps `--no-handshake` to `handshake: false`. */
  readonly handshake?: boolean;
  readonly decode?: boolean;
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

function slotToPlain(slot: ReturnType<typeof decodePresetBank>["slots"][number]) {
  return {
    slot: slot.slot,
    type: slot.type,
    gain: slot.gain,
    tone: slot.tone,
    reverb: slot.reverb,
    feedback: slot.feedback,
    volume: slot.volume,
    time: slot.time,
    mix: slot.mix,
    modulation: slot.modulation,
    cabinet: slot.cabinet,
    irSection: slot.irSection,
    delaySection: slot.delaySection,
    toneSection: slot.toneSection,
    trailing: [...slot.trailing],
    trailingLooksLikePadding: isPresetTrailingPadding(slot),
  };
}

export async function readMemoryCommand(
  transport: MidiTransport,
  options: ReadMemoryOptions,
): Promise<void> {
  if (!options.confirmReadOnly) {
    throw new Error(
      "Refusing to transmit without --confirm-read-only; this sends only a ReadMemory request",
    );
  }

  const memory = parseUint(options.memory, "--memory");
  const address = parseUint(options.address, "--address");
  const length = parseUint(options.length, "--length");
  const timeoutMs = options.timeout === undefined ? 2_000 : Number(options.timeout);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 10_000) {
    throw new Error("--timeout must be an integer from 1 to 10000 milliseconds");
  }

  if (options.decode && length !== PRESET_BANK_BYTE_LENGTH) {
    throw new Error(`--decode requires --length ${PRESET_BANK_BYTE_LENGTH} (A+B+C bank)`);
  }

  const result = await new CubeBabyClient(transport).readMemory({
    inputPortId: options.input,
    outputPortId: options.output,
    memory,
    address,
    length,
    timeoutMs,
    handshake: options.handshake !== false,
  });

  const bank =
    options.decode && result.data.length === PRESET_BANK_BYTE_LENGTH
      ? decodePresetBank(result.data)
      : undefined;

  const payload = {
    memory: result.memory,
    address: result.address,
    addressHex: `0x${result.address.toString(16)}`,
    length: result.length,
    dataHex: bytesToCompactHex(result.data),
    data: [...result.data],
    observedAt: new Date(result.observedAtMs).toISOString(),
    ...(bank === undefined
      ? {}
      : {
          bank: {
            slots: bank.slots.map(slotToPlain),
          },
        }),
  };

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`ReadMemory mem=${payload.memory} addr=${payload.addressHex} len=${payload.length}`);
  console.log(`dataHex: ${payload.dataHex}`);
  console.log(`data: [${payload.data.join(", ")}]`);

  if (bank !== undefined) {
    for (const slot of bank.slots) {
      const plain = slotToPlain(slot);
      console.log(
        `slot ${plain.slot}: type=${plain.type} gain=${plain.gain} tone=${plain.tone} ` +
          `reverb=${plain.reverb} feedback=${plain.feedback} volume=${plain.volume} ` +
          `time=${plain.time} mix=${plain.mix} modulation=${plain.modulation} ` +
          `cabinet=${plain.cabinet} irSection=${plain.irSection} ` +
          `delaySection=${plain.delaySection} toneSection=${plain.toneSection} ` +
          `trailing=[${plain.trailing.join(", ")}]` +
          (plain.trailingLooksLikePadding ? " (padding)" : ""),
      );
    }
  }
}
