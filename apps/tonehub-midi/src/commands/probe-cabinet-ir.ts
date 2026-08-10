import { CubeBabyClient } from "@tonehub/cube-baby-api";
import {
  decodePresetBank,
  IR_LIVE_DATA_ADDRESS,
  IR_LIVE_MEMORY,
  IR_ROM_HEADER_LENGTH,
  IR_ROM_MEMORY,
  IR_ROM_SLOT_COUNT,
  irRomSlotAddress,
  PRESET_BANK_BYTE_LENGTH,
} from "@tonehub/cube-baby-protocol";
import type { MidiTransport } from "@tonehub/midi-core";
import { bytesToCompactHex } from "../format.js";

const BANK_MEMORY = 5;
const BANK_ADDRESS = 0x0000_0000;
const LIVE_MEMORY = 5;
const LIVE_CABINET_ADDRESS = 0x8000_0009;
/** Bytes read from each ROM sector: flag+volume+start of audio. */
const ROM_PROBE_LENGTH = 72;
/** Live IR probe: distance float + start of sample block. */
const LIVE_PROBE_LENGTH = 68;
const AUDIO_COMPARE_LENGTH = 60;

export interface ProbeCabinetIrOptions {
  readonly input: string;
  readonly output: string;
  readonly timeout?: string;
  readonly confirmWrite?: boolean;
  readonly json?: boolean;
}

interface RomFingerprint {
  readonly slotIndex: number;
  readonly addressHex: string;
  readonly headerHex: string;
  readonly audio: Uint8Array;
}

function equalBytes(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  let matched = 0;
  for (let i = 0; i < n; i += 1) {
    if (a[i] === b[i]) matched += 1;
  }
  return matched;
}

function bestRomMatch(
  liveProbe: Uint8Array,
  roms: readonly RomFingerprint[],
): { readonly slotIndex: number; readonly matched: number; readonly total: number } | null {
  // Live layout: [distance f32][samples…]. ROM layout: [flag][volume][samples…].
  if (liveProbe.length < 4 + AUDIO_COMPARE_LENGTH) return null;
  const liveAudio = liveProbe.subarray(4, 4 + AUDIO_COMPARE_LENGTH);
  let best: { slotIndex: number; matched: number; total: number } | null = null;
  for (const rom of roms) {
    const matched = equalBytes(liveAudio, rom.audio);
    if (best === null || matched > best.matched) {
      best = { slotIndex: rom.slotIndex, matched, total: AUDIO_COMPARE_LENGTH };
    }
  }
  return best;
}

export async function probeCabinetIrCommand(
  transport: MidiTransport,
  options: ProbeCabinetIrOptions,
): Promise<void> {
  if (!options.confirmWrite) {
    throw new Error(
      "Refusing to transmit without --confirm-write; this sweeps live Cabinet and reads IR RAM",
    );
  }

  const timeoutMs = options.timeout === undefined ? 5_000 : Number(options.timeout);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 10_000) {
    throw new Error("--timeout must be an integer from 1 to 10000 milliseconds");
  }

  const client = new CubeBabyClient(transport);
  const ports = {
    inputPortId: options.input,
    outputPortId: options.output,
    timeoutMs,
  };

  const bankRead = await client.readMemory({
    ...ports,
    memory: BANK_MEMORY,
    address: BANK_ADDRESS,
    length: PRESET_BANK_BYTE_LENGTH,
  });
  const bank = decodePresetBank(bankRead.data);
  const restoreCabinet = bank.slots[0]?.cabinet ?? 0;

  const roms: RomFingerprint[] = [];
  for (let slotIndex = 0; slotIndex < IR_ROM_SLOT_COUNT; slotIndex += 1) {
    const address = irRomSlotAddress(slotIndex);
    const read = await client.readMemory({
      ...ports,
      memory: IR_ROM_MEMORY,
      address,
      length: ROM_PROBE_LENGTH,
      handshake: false,
    });
    roms.push({
      slotIndex,
      addressHex: `0x${address.toString(16)}`,
      headerHex: bytesToCompactHex(read.data.subarray(0, IR_ROM_HEADER_LENGTH)),
      audio: read.data.subarray(8, 8 + AUDIO_COMPARE_LENGTH),
    });
    await new Promise((resolve) => setTimeout(resolve, 40));
  }

  const baselineLive = await client.readMemory({
    ...ports,
    memory: IR_LIVE_MEMORY,
    address: IR_LIVE_DATA_ADDRESS,
    length: LIVE_PROBE_LENGTH,
    handshake: false,
  });
  const baselineMatch = bestRomMatch(baselineLive.data, roms);

  const sweeps: {
    readonly cabinet: number;
    readonly livePrefixHex: string;
    readonly bestSlot: number | null;
    readonly matched: number;
    readonly total: number;
    readonly liveChangedFromBaseline: boolean;
  }[] = [];

  for (let cabinet = 0; cabinet <= 8; cabinet += 1) {
    await client.writeMemory({
      ...ports,
      memory: LIVE_MEMORY,
      address: LIVE_CABINET_ADDRESS,
      data: Uint8Array.of(cabinet),
      handshake: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 350));

    const live = await client.readMemory({
      ...ports,
      memory: IR_LIVE_MEMORY,
      address: IR_LIVE_DATA_ADDRESS,
      length: LIVE_PROBE_LENGTH,
      handshake: false,
    });
    const match = bestRomMatch(live.data, roms);
    const liveChangedFromBaseline = !live.data.every(
      (byte, index) => byte === baselineLive.data[index],
    );
    sweeps.push({
      cabinet,
      livePrefixHex: bytesToCompactHex(live.data.subarray(0, 16)),
      bestSlot: match?.slotIndex ?? null,
      matched: match?.matched ?? 0,
      total: match?.total ?? AUDIO_COMPARE_LENGTH,
      liveChangedFromBaseline,
    });
  }

  await client.writeMemory({
    ...ports,
    memory: LIVE_MEMORY,
    address: LIVE_CABINET_ADDRESS,
    data: Uint8Array.of(restoreCabinet),
    handshake: false,
  });

  const anyLiveChange = sweeps.some((row) => row.liveChangedFromBaseline);
  const perfect = sweeps.filter((row) => row.matched === AUDIO_COMPARE_LENGTH);
  const payload = {
    restoreCabinet,
    bankCabinets: bank.slots.map((slot) => ({ slot: slot.slot, cabinet: slot.cabinet })),
    baseline: {
      livePrefixHex: bytesToCompactHex(baselineLive.data.subarray(0, 16)),
      bestSlot: baselineMatch?.slotIndex ?? null,
      matched: baselineMatch?.matched ?? 0,
    },
    roms: roms.map((rom) => ({
      slotIndex: rom.slotIndex,
      addressHex: rom.addressHex,
      headerHex: rom.headerHex,
    })),
    sweeps,
    summary: {
      anyLiveIrChangeAcrossCabinetSweep: anyLiveChange,
      perfectMatches: perfect.map((row) => ({ cabinet: row.cabinet, romSlot: row.bestSlot })),
    },
    observedAt: new Date().toISOString(),
  };

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`ProbeCabinetIr restoreCabinet=${restoreCabinet} anyLiveIrChange=${anyLiveChange}`);
  for (const row of sweeps) {
    console.log(
      `cabinet=${row.cabinet} bestRom=${row.bestSlot} match=${row.matched}/${row.total} ` +
        `changed=${row.liveChangedFromBaseline} live=${row.livePrefixHex}`,
    );
  }
}
