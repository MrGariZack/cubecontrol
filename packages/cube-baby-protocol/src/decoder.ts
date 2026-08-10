import { CubeBabyDecodeError } from "./errors.js";
import { decodeSevenBit } from "./seven-bit.js";
import type { CubeBabyEnvelope, CubeBabyMessage } from "./types.js";

const MAGIC_0 = 0x00;
const MAGIC_1 = 0x59;

function readUint24LE(data: Uint8Array, offset: number): number {
  return (data[offset] ?? 0) | ((data[offset + 1] ?? 0) << 8) | ((data[offset + 2] ?? 0) << 16);
}

function readUint32LE(data: Uint8Array, offset: number): number {
  return (
    ((data[offset] ?? 0) |
      ((data[offset + 1] ?? 0) << 8) |
      ((data[offset + 2] ?? 0) << 16) |
      ((data[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

export function calculateChecksum(content: Uint8Array): number {
  let sum = 0;
  for (const byte of content) sum = (sum + byte) & 0xff;
  return ~sum & 0xff;
}

export function decodeEnvelope(sysex: Uint8Array): CubeBabyEnvelope {
  if (sysex[0] !== 0xf0 || sysex.at(-1) !== 0xf7) {
    throw new CubeBabyDecodeError("Expected F0/F7 SysEx markers", "invalid-markers");
  }

  const encodedPayload = sysex.slice(1, -1);
  const clearPayload = decodeSevenBit(encodedPayload);
  if (clearPayload.length < 7) {
    throw new CubeBabyDecodeError(
      "Decoded payload is shorter than its envelope",
      "payload-too-short",
    );
  }
  if (clearPayload[0] !== MAGIC_0 || clearPayload[1] !== MAGIC_1) {
    throw new CubeBabyDecodeError("Decoded payload has an unknown magic value", "invalid-magic");
  }

  const messageType = clearPayload[2] ?? 0;
  const declaredContentLength = readUint24LE(clearPayload, 3);
  const expectedPayloadLength = 7 + declaredContentLength;
  if (clearPayload.length !== expectedPayloadLength) {
    throw new CubeBabyDecodeError(
      `Decoded length mismatch: expected ${expectedPayloadLength}, got ${clearPayload.length}`,
      "length-mismatch",
    );
  }

  const content = clearPayload.slice(6, 6 + declaredContentLength);
  const checksum = clearPayload[6 + declaredContentLength] ?? 0;
  return {
    messageType,
    declaredContentLength,
    content,
    checksum,
    checksumValid: checksum === calculateChecksum(content),
    clearPayload,
    encodedPayload,
  };
}

export function decodeCubeBabyMessage(sysex: Uint8Array): CubeBabyMessage {
  const envelope = decodeEnvelope(sysex);

  if (envelope.messageType === 0x11) {
    if (envelope.content.length === 0) return { kind: "identity-request", envelope };
    if (envelope.content.length > 0) {
      const firstNonPrintable = envelope.content.findIndex((byte) => byte < 0x20 || byte > 0x7e);
      const nameByteLength =
        firstNonPrintable === -1 ? Math.min(16, envelope.content.length) : firstNonPrintable;
      const name = String.fromCharCode(...envelope.content.slice(0, nameByteLength)).trimEnd();
      return {
        kind: "identity-response",
        envelope,
        name,
        nameByteLength,
        metadata: envelope.content.slice(nameByteLength),
      };
    }
  }

  if (envelope.messageType === 0x00 && envelope.content.length === 1) {
    const rawValue = envelope.content[0] ?? 0;
    return { kind: "ack", envelope, accepted: rawValue > 0, rawValue };
  }

  if (envelope.messageType === 0x22 && envelope.content.length >= 8) {
    const memory = envelope.content[0] ?? 0;
    const address = readUint32LE(envelope.content, 1);
    const length = readUint24LE(envelope.content, 5);
    const data = envelope.content.slice(8);
    return { kind: "memory-write-request", envelope, memory, address, length, data };
  }

  if (envelope.messageType === 0x23 && envelope.content.length >= 8) {
    const memory = envelope.content[0] ?? 0;
    const address = readUint32LE(envelope.content, 1);
    const length = readUint24LE(envelope.content, 5);
    const data = envelope.content.slice(8);
    if (data.length === 0) {
      return { kind: "memory-read-request", envelope, memory, address, length };
    }
    return { kind: "memory-read-response", envelope, memory, address, length, data };
  }

  if (envelope.messageType === 0x21 && envelope.content.length === 5) {
    const memory = envelope.content[0] ?? 0;
    const address = readUint32LE(envelope.content, 1);
    return { kind: "erase-request", envelope, memory, address };
  }

  if (envelope.messageType === 0x24 && envelope.content.length === 9) {
    const memory = envelope.content[0] ?? 0;
    const address = readUint32LE(envelope.content, 1);
    const value = readUint32LE(envelope.content, 5);
    return { kind: "register-write-request", envelope, memory, address, value };
  }

  return { kind: "unknown", envelope };
}
