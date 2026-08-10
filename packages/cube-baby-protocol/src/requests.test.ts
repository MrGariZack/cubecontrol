import { describe, expect, it } from "vitest";
import { decodeCubeBabyMessage } from "./decoder.js";
import {
  cabinetToRomSlot,
  encodeAckResponse,
  encodeMemoryReadResponse,
  expandIrRomSector,
  IR_ROM_PAYLOAD_LENGTH,
  IR_ROM_SLOT_SIZE,
  IR_ROM_UPLOAD_ADDRESS,
  irRomSlotAddress,
} from "./requests.js";

describe("irRomSlotAddress", () => {
  it("maps slot 7 to the upload address", () => {
    expect(irRomSlotAddress(7)).toBe(IR_ROM_UPLOAD_ADDRESS);
  });

  it("rejects out-of-range slots", () => {
    expect(() => irRomSlotAddress(8)).toThrow(/slotIndex/);
  });
});

describe("cabinetToRomSlot", () => {
  it("maps Cabinet 1..8 to ROM slots 0..7 and Cabinet 0 to null", () => {
    expect(cabinetToRomSlot(0)).toBeNull();
    expect(cabinetToRomSlot(1)).toBe(0);
    expect(cabinetToRomSlot(8)).toBe(7);
    const uploadSlot = cabinetToRomSlot(8);
    expect(uploadSlot).toBe(7);
    if (uploadSlot !== null) {
      expect(irRomSlotAddress(uploadSlot)).toBe(IR_ROM_UPLOAD_ADDRESS);
    }
  });
});

describe("expandIrRomSector", () => {
  it("zero-pads a 2056-byte CubeSuite image to 4096", () => {
    const payload = new Uint8Array(IR_ROM_PAYLOAD_LENGTH);
    payload[0] = 0x01;
    payload[2055] = 0xab;
    const sector = expandIrRomSector(payload);
    expect(sector.length).toBe(IR_ROM_SLOT_SIZE);
    expect(sector[0]).toBe(0x01);
    expect(sector[2055]).toBe(0xab);
    expect(sector[2056]).toBe(0x00);
    expect(sector[4095]).toBe(0x00);
  });

  it("passes through a full sector unchanged", () => {
    const sector = new Uint8Array(IR_ROM_SLOT_SIZE);
    sector[3000] = 0x55;
    const out = expandIrRomSector(sector);
    expect(out).not.toBe(sector);
    expect(out[3000]).toBe(0x55);
  });
});

describe("encodeAckResponse / encodeMemoryReadResponse", () => {
  it("encodes a rejected ACK (live-write style)", () => {
    const message = decodeCubeBabyMessage(encodeAckResponse(false));
    expect(message.kind).toBe("ack");
    if (message.kind !== "ack") return;
    expect(message.accepted).toBe(false);
    expect(message.rawValue).toBe(0);
    expect(message.envelope.checksumValid).toBe(true);
  });

  it("encodes a memory-read response with payload", () => {
    const data = Uint8Array.of(1, 2, 3, 4);
    const message = decodeCubeBabyMessage(encodeMemoryReadResponse(5, 0x8000_0001, data));
    expect(message.kind).toBe("memory-read-response");
    if (message.kind !== "memory-read-response") return;
    expect(message.memory).toBe(5);
    expect(message.address).toBe(0x8000_0001);
    expect(message.length).toBe(4);
    expect(message.data).toEqual(data);
    expect(message.envelope.checksumValid).toBe(true);
  });
});
