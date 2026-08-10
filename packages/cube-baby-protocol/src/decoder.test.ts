import { describe, expect, it } from "vitest";
import { decodeCubeBabyMessage, decodeEnvelope } from "./decoder.js";
import {
  encodeEraseRequest,
  encodeIdentityRequest,
  encodeMemoryReadRequest,
  encodeMemoryWriteRequest,
  encodeRegisterWriteRequest,
} from "./requests.js";
import { decodeSevenBit, encodeSevenBit } from "./seven-bit.js";

const fromHex = (hex: string): Uint8Array =>
  Uint8Array.from(hex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);

describe("Cube Baby protocol decoding", () => {
  it("round-trips the documented 7-bit transform", () => {
    const clear = fromHex("005911000000ff");
    expect(decodeSevenBit(encodeSevenBit(clear))).toEqual(clear);
  });

  it("decodes the identity request captured from CubeSuite", () => {
    const capturedRequest = fromHex("f0003245000000407ff7");
    expect(encodeIdentityRequest()).toEqual(capturedRequest);
    const message = decodeCubeBabyMessage(capturedRequest);

    expect(message.kind).toBe("identity-request");
    expect(message.envelope.checksumValid).toBe(true);
  });

  it("encodes the captured 48-byte preset bank read request", () => {
    const capturedRequest = fromHex("f000320d410000400200000000000600004a01f7");
    expect(encodeMemoryReadRequest(0x05, 0x00000000, 48)).toEqual(capturedRequest);
    const message = decodeCubeBabyMessage(capturedRequest);
    expect(message.kind).toBe("memory-read-request");
    if (message.kind !== "memory-read-request") return;
    expect(message.memory).toBe(5);
    expect(message.address).toBe(0);
    expect(message.length).toBe(48);
  });

  it("decodes the physical pedal identity response", () => {
    const message = decodeCubeBabyMessage(
      fromHex("f00032455801004029491c0d7a5465503a624a090a262c1e10204000011260040a152c5c40114307f7"),
    );

    expect(message.kind).toBe("identity-response");
    if (message.kind !== "identity-response") return;
    expect(message.name).toBe("SINCO-CubeBaby");
    expect(message.nameByteLength).toBe(19);
    expect([...message.metadata]).toEqual([1, 19, 20, 21, 22, 23, 24, 25]);
    expect(message.envelope.checksumValid).toBe(true);
  });

  it("decodes the captured 48-byte preset read response", () => {
    const message = decodeCubeBabyMessage(
      fromHex(
        "f000320d4103004002000000000006000005060c305060580207102008102000000000141840404120733040420021400001000000600040010a32115a20014202010204000000000ef7",
      ),
    );

    expect(message.kind).toBe("memory-read-response");
    if (message.kind !== "memory-read-response") return;
    expect(message.memory).toBe(5);
    expect(message.address).toBe(0);
    expect(message.length).toBe(48);
    expect(message.data).toHaveLength(48);
    expect(message.envelope.checksumValid).toBe(true);
  });

  it("preserves an unclassified captured handshake message", () => {
    const message = decodeCubeBabyMessage(fromHex("f000324930000040000000000000403ff7"));

    expect(message.kind).toBe("unknown");
    expect(message.envelope.messageType).toBe(0x12);
    expect(message.envelope.checksumValid).toBe(true);
  });

  it("encodes the captured Gain write (value 5) byte-for-byte", () => {
    const capturedWrite = fromHex("f000320949000040020100000018000000056601f7");
    expect(encodeMemoryWriteRequest(0x05, 0x80000001, Uint8Array.of(5))).toEqual(capturedWrite);
  });

  it("encodes the captured Volume write (value 100) including trailing septet 0x00", () => {
    const capturedWrite = fromHex("f000320949000040020500000018000000642000f7");
    expect(encodeMemoryWriteRequest(0x05, 0x80000005, Uint8Array.of(100))).toEqual(capturedWrite);
  });

  it("encodes the captured 48-byte bank Save write byte-for-byte", () => {
    const capturedWrite = fromHex(
      "f00032094103004002000000000006000005060c305000590207102008102000000000141840404120733040420021400001000000600040010a32115a20014202010204000000400df7",
    );
    const bank = fromHex(
      "05030306056405070808010101000000050304064173185008080101010000000600030a59440b0a0805010101000000",
    );
    expect(encodeMemoryWriteRequest(0x05, 0x00000000, bank)).toEqual(capturedWrite);
  });

  it("decodes a Gain write and its ACK:false response from the physical capture", () => {
    const write = decodeCubeBabyMessage(fromHex("f000320949000040020100000018000000056601f7"));
    expect(write.kind).toBe("memory-write-request");
    if (write.kind !== "memory-write-request") return;
    expect(write.memory).toBe(5);
    expect(write.address).toBe(0x80000001);
    expect(write.length).toBe(1);
    expect([...write.data]).toEqual([5]);
    expect(write.envelope.checksumValid).toBe(true);

    const ack = decodeCubeBabyMessage(fromHex("f000320108000000007f01f7"));
    expect(ack.kind).toBe("ack");
    if (ack.kind !== "ack") return;
    expect(ack.accepted).toBe(false);
    expect(ack.rawValue).toBe(0);
  });

  it("reports an invalid checksum without hiding the envelope", () => {
    const envelope = decodeEnvelope(fromHex("f0003245000000407ef7"));
    expect(envelope.checksumValid).toBe(false);
  });

  it("encodes/decodes captured IR register writes (0x24)", () => {
    const flagReg = fromHex("f00032114900000002640e000010000000001e02f7");
    expect(encodeRegisterWriteRequest(0x04, 0x00000764, 1)).toEqual(flagReg);
    const decodedFlag = decodeCubeBabyMessage(flagReg);
    expect(decodedFlag.kind).toBe("register-write-request");
    if (decodedFlag.kind !== "register-write-request") return;
    expect(decodedFlag.memory).toBe(4);
    expect(decodedFlag.address).toBe(0x764);
    expect(decodedFlag.value).toBe(1);

    const lengthReg = fromHex("f00032114900000002680e000040000200000002f7");
    expect(encodeRegisterWriteRequest(0x04, 0x00000768, 2052)).toEqual(lengthReg);
  });

  it("encodes/decodes the captured IR erase request (0x21) for ROM persist", () => {
    const captured = fromHex("f0003205290000000000001c00001ff7");
    expect(encodeEraseRequest(0x00, 0x00070000)).toEqual(captured);
    const decoded = decodeCubeBabyMessage(captured);
    expect(decoded.kind).toBe("erase-request");
    if (decoded.kind !== "erase-request") return;
    expect(decoded.memory).toBe(0);
    expect(decoded.address).toBe(0x70000);
  });
});
