import { calculateChecksum } from "./decoder.js";
import { encodeSevenBit } from "./seven-bit.js";

const IDENTITY_MESSAGE_TYPE = 0x11;
const ERASE_MESSAGE_TYPE = 0x21;
const MEMORY_WRITE_MESSAGE_TYPE = 0x22;
const MEMORY_READ_MESSAGE_TYPE = 0x23;
const REGISTER_WRITE_MESSAGE_TYPE = 0x24;

function writeUint24LE(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff);
}

function writeUint32LE(value: number): Uint8Array {
  return Uint8Array.of(
    value & 0xff,
    (value >> 8) & 0xff,
    (value >> 16) & 0xff,
    (value >>> 24) & 0xff,
  );
}

function encodeEnvelope(messageType: number, content: Uint8Array): Uint8Array {
  const clearPayload = Uint8Array.of(
    0x00,
    0x59,
    messageType,
    ...writeUint24LE(content.length),
    ...content,
    calculateChecksum(content),
  );
  const encoded = encodeSevenBit(clearPayload);
  return Uint8Array.of(0xf0, ...encoded, 0xf7);
}

export function encodeIdentityRequest(): Uint8Array {
  return encodeEnvelope(IDENTITY_MESSAGE_TYPE, new Uint8Array());
}

/**
 * Builds a ReadMemory request matching CubeSuite's captured shape:
 * content = memory(1) + address LE32 + length LE24.
 */
export function encodeMemoryReadRequest(
  memory: number,
  address: number,
  length: number,
): Uint8Array {
  if (!Number.isInteger(memory) || memory < 0 || memory > 0xff) {
    throw new Error("memory must be an integer from 0 to 255");
  }
  if (!Number.isInteger(address) || address < 0 || address > 0xffffffff) {
    throw new Error("address must be an unsigned 32-bit integer");
  }
  if (!Number.isInteger(length) || length < 1 || length > 0xffffff) {
    throw new Error("length must be an integer from 1 to 16777215");
  }

  const content = Uint8Array.of(memory, ...writeUint32LE(address), ...writeUint24LE(length));
  return encodeEnvelope(MEMORY_READ_MESSAGE_TYPE, content);
}

/**
 * Builds a WriteMemory request matching CubeSuite's captured shape:
 * content = memory(1) + address LE32 + length LE24 + data.
 */
export function encodeMemoryWriteRequest(
  memory: number,
  address: number,
  data: Uint8Array,
): Uint8Array {
  if (!Number.isInteger(memory) || memory < 0 || memory > 0xff) {
    throw new Error("memory must be an integer from 0 to 255");
  }
  if (!Number.isInteger(address) || address < 0 || address > 0xffffffff) {
    throw new Error("address must be an unsigned 32-bit integer");
  }
  if (data.length < 1 || data.length > 0xffffff) {
    throw new Error("data length must be from 1 to 16777215");
  }

  const content = Uint8Array.of(
    memory,
    ...writeUint32LE(address),
    ...writeUint24LE(data.length),
    ...data,
  );
  return encodeEnvelope(MEMORY_WRITE_MESSAGE_TYPE, content);
}

/**
 * Builds a register/DSP write (`0x24`) matching CubeSuite IR traffic:
 * content = memory(1) + address LE32 + value LE32.
 */
export function encodeRegisterWriteRequest(
  memory: number,
  address: number,
  value: number,
): Uint8Array {
  if (!Number.isInteger(memory) || memory < 0 || memory > 0xff) {
    throw new Error("memory must be an integer from 0 to 255");
  }
  if (!Number.isInteger(address) || address < 0 || address > 0xffffffff) {
    throw new Error("address must be an unsigned 32-bit integer");
  }
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error("value must be an unsigned 32-bit integer");
  }

  const content = Uint8Array.of(memory, ...writeUint32LE(address), ...writeUint32LE(value));
  return encodeEnvelope(REGISTER_WRITE_MESSAGE_TYPE, content);
}

/**
 * Builds an erase request (`0x21`). Only the reviewed ROM-persist CLI may transmit this.
 */
export function encodeEraseRequest(memory: number, address: number): Uint8Array {
  if (!Number.isInteger(memory) || memory < 0 || memory > 0xff) {
    throw new Error("memory must be an integer from 0 to 255");
  }
  if (!Number.isInteger(address) || address < 0 || address > 0xffffffff) {
    throw new Error("address must be an unsigned 32-bit integer");
  }

  const content = Uint8Array.of(memory, ...writeUint32LE(address));
  return encodeEnvelope(ERASE_MESSAGE_TYPE, content);
}

/** ACK response (`0x00`); CubeSuite live writes often use `accepted=false` (`rawValue=0`). */
export function encodeAckResponse(accepted: boolean): Uint8Array {
  return encodeEnvelope(0x00, Uint8Array.of(accepted ? 1 : 0));
}

/**
 * Memory-read response (`0x23`) with payload bytes.
 * Content = memory(1) + address LE32 + length LE24 + data.
 */
export function encodeMemoryReadResponse(
  memory: number,
  address: number,
  data: Uint8Array,
): Uint8Array {
  if (!Number.isInteger(memory) || memory < 0 || memory > 0xff) {
    throw new Error("memory must be an integer from 0 to 255");
  }
  if (!Number.isInteger(address) || address < 0 || address > 0xffffffff) {
    throw new Error("address must be an unsigned 32-bit integer");
  }
  if (data.length < 1 || data.length > 0xffffff) {
    throw new Error("data length must be from 1 to 16777215");
  }
  const content = Uint8Array.of(
    memory,
    ...writeUint32LE(address),
    ...writeUint24LE(data.length),
    ...data,
  );
  return encodeEnvelope(MEMORY_READ_MESSAGE_TYPE, content);
}

/** Live IR RAM constants confirmed in experiment 021. */
export const IR_LIVE_MEMORY = 0x04;
export const IR_LIVE_FLAG_ADDRESS = 0x0000_0764;
export const IR_LIVE_DATA_ADDRESS = 0x0000_0768;
export const IR_LIVE_CHUNK_SIZE = 128;
export const IR_LIVE_PAYLOAD_LENGTH = 2052;

/** IR ROM upload-slot constants confirmed in experiment 021. */
export const IR_ROM_MEMORY = 0x00;
export const IR_ROM_UPLOAD_ADDRESS = 0x0007_0000;
export const IR_ROM_CHUNK_SIZE = 128;
export const IR_ROM_VERIFY_CHUNK_SIZE = 113;
/** CubeSuite upload write length (experiment 021/028); physical sector is larger. */
export const IR_ROM_PAYLOAD_LENGTH = 2056;
/** Physical ROM sector stride reported upstream; validated by experiment 029 scan. */
export const IR_ROM_SLOT_STRIDE = 0x1000;
export const IR_ROM_SLOT_SIZE = IR_ROM_SLOT_STRIDE;

/**
 * Expand a CubeSuite 2056-byte IR image to a full ROM sector by zero-padding.
 * Full 4096-byte dumps pass through unchanged. Prevents erase-tail `0xFF` (silence risk).
 */
export function expandIrRomSector(payload: Uint8Array): Uint8Array {
  if (payload.length === IR_ROM_SLOT_SIZE) {
    return payload.slice();
  }
  if (payload.length !== IR_ROM_PAYLOAD_LENGTH) {
    throw new Error(
      `IR ROM payload must be ${IR_ROM_PAYLOAD_LENGTH} or ${IR_ROM_SLOT_SIZE} bytes (got ${payload.length})`,
    );
  }
  const sector = new Uint8Array(IR_ROM_SLOT_SIZE);
  sector.set(payload, 0);
  return sector;
}
export const IR_ROM_FACTORY_BASE = 0x0006_9000;
export const IR_ROM_EXTENDED_BASE = 0x0006_8000;
export const IR_ROM_HEADER_LENGTH = 16;
/** Factory cabinets indexed 0..7; address = base + index×stride (upload = 7). */
export const IR_ROM_SLOT_COUNT = 8;

/** Resolve factory IR ROM address for slot index 0..7. */
export function irRomSlotAddress(slotIndex: number): number {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= IR_ROM_SLOT_COUNT) {
    throw new Error(`IR ROM slotIndex must be an integer 0..${IR_ROM_SLOT_COUNT - 1}`);
  }
  return IR_ROM_FACTORY_BASE + slotIndex * IR_ROM_SLOT_STRIDE;
}

/**
 * Map live Cabinet parameter (0..8) to ROM slot index.
 * Confirmed locally in experiment 032: Cabinet 1..8 → slot Cabinet-1; Cabinet 0 → null (no reload).
 */
export function cabinetToRomSlot(cabinet: number): number | null {
  if (!Number.isInteger(cabinet) || cabinet < 0 || cabinet > 8) {
    throw new Error("cabinet must be an integer 0..8");
  }
  if (cabinet === 0) return null;
  return cabinet - 1;
}
