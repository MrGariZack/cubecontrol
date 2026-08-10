import { CubeBabyClient } from "@tonehub/cube-baby-api";
import {
  IR_ROM_EXTENDED_BASE,
  IR_ROM_FACTORY_BASE,
  IR_ROM_HEADER_LENGTH,
  IR_ROM_MEMORY,
  IR_ROM_SLOT_STRIDE,
  IR_ROM_UPLOAD_ADDRESS,
} from "@tonehub/cube-baby-protocol";
import type { MidiTransport } from "@tonehub/midi-core";
import { bytesToCompactHex } from "../format.js";

export interface ScanIrRomOptions {
  readonly input: string;
  readonly output: string;
  readonly timeout?: string;
  readonly confirmReadOnly?: boolean;
  readonly json?: boolean;
}

interface SlotProbe {
  readonly label: string;
  readonly slotIndex: number;
  readonly address: number;
  readonly addressHex: string;
  readonly headerHex: string;
  readonly presence: "marker-01" | "empty-ff" | "zero" | "other";
  readonly volumeFloat: number | null;
}

function classifyHeader(header: Uint8Array): Pick<SlotProbe, "presence" | "volumeFloat"> {
  const b0 = header[0] ?? 0;
  const b1 = header[1] ?? 0;
  const b2 = header[2] ?? 0;
  const b3 = header[3] ?? 0;
  let presence: SlotProbe["presence"] = "other";
  if (b0 === 0x01 && b1 === 0x00 && b2 === 0x00 && b3 === 0x00) presence = "marker-01";
  else if (header.slice(0, 8).every((byte) => byte === 0xff)) presence = "empty-ff";
  else if (header.slice(0, 8).every((byte) => byte === 0x00)) presence = "zero";

  let volumeFloat: number | null = null;
  if (header.length >= 8) {
    volumeFloat = new DataView(header.buffer, header.byteOffset + 4, 4).getFloat32(0, true);
    if (!Number.isFinite(volumeFloat)) volumeFloat = null;
  }
  return { presence, volumeFloat };
}

export async function scanIrRomCommand(
  transport: MidiTransport,
  options: ScanIrRomOptions,
): Promise<void> {
  if (!options.confirmReadOnly) {
    throw new Error(
      "Refusing to transmit without --confirm-read-only; this only reads IR ROM headers",
    );
  }

  const timeoutMs = options.timeout === undefined ? 3_000 : Number(options.timeout);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 10_000) {
    throw new Error("--timeout must be an integer from 1 to 10000 milliseconds");
  }

  const client = new CubeBabyClient(transport);
  const targets: { label: string; slotIndex: number; address: number }[] = [];

  for (let slot = 0; slot < 9; slot += 1) {
    targets.push({
      label: "factory-base",
      slotIndex: slot,
      address: IR_ROM_FACTORY_BASE + slot * IR_ROM_SLOT_STRIDE,
    });
  }
  for (let slot = 0; slot < 9; slot += 1) {
    targets.push({
      label: "extended-base",
      slotIndex: slot,
      address: IR_ROM_EXTENDED_BASE + slot * IR_ROM_SLOT_STRIDE,
    });
  }
  // Explicit upload address in case grids diverge.
  if (!targets.some((target) => target.address === IR_ROM_UPLOAD_ADDRESS)) {
    targets.push({ label: "upload", slotIndex: -1, address: IR_ROM_UPLOAD_ADDRESS });
  }

  const probes: SlotProbe[] = [];
  for (const target of targets) {
    const read = await client.readMemory({
      inputPortId: options.input,
      outputPortId: options.output,
      memory: IR_ROM_MEMORY,
      address: target.address,
      length: IR_ROM_HEADER_LENGTH,
      timeoutMs,
    });
    const { presence, volumeFloat } = classifyHeader(read.data);
    probes.push({
      label: target.label,
      slotIndex: target.slotIndex,
      address: target.address,
      addressHex: `0x${target.address.toString(16)}`,
      headerHex: bytesToCompactHex(read.data),
      presence,
      volumeFloat,
    });
  }

  const payload = {
    stride: IR_ROM_SLOT_STRIDE,
    factoryBaseHex: `0x${IR_ROM_FACTORY_BASE.toString(16)}`,
    extendedBaseHex: `0x${IR_ROM_EXTENDED_BASE.toString(16)}`,
    uploadAddressHex: `0x${IR_ROM_UPLOAD_ADDRESS.toString(16)}`,
    probes,
    observedAt: new Date().toISOString(),
  };

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(
    `ScanIrRom stride=0x${IR_ROM_SLOT_STRIDE.toString(16)} factoryBase=${payload.factoryBaseHex} extendedBase=${payload.extendedBaseHex}`,
  );
  for (const probe of probes) {
    console.log(
      `${probe.label} slot=${probe.slotIndex} ${probe.addressHex} presence=${probe.presence} ` +
        `vol=${probe.volumeFloat ?? "n/a"} header=${probe.headerHex}`,
    );
  }
}
