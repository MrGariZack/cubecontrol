import { describe, expect, it } from "vitest";
import { BANK_FILE_FORMAT, bankFileFromBytes, bytesFromBankFile } from "./bank-file.js";

const BANK_HEX =
  "05030306056405070808010101000000050304064173185008080101010000000600030a59440b0a0805010101000000";

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from((hex.match(/.{2}/g) ?? []).map((pair) => Number.parseInt(pair, 16)));
}

describe("bank file codec", () => {
  it("round-trips a 48-byte bank through the v1 JSON shape", () => {
    const bytes = hexToBytes(BANK_HEX);
    const file = bankFileFromBytes(bytes, Date.parse("2026-08-10T18:00:00.000Z"));
    expect(file.format).toBe(BANK_FILE_FORMAT);
    expect(file.dataHex).toBe(BANK_HEX);
    expect(file.slots[0]?.volume).toBe(100);
    expect(file.slots[0]?.trailingLooksLikePadding).toBe(true);
    expect([...bytesFromBankFile(file)]).toEqual([...bytes]);
  });

  it("rejects unsupported formats", () => {
    expect(() => bytesFromBankFile({ format: "nope", dataHex: BANK_HEX })).toThrow(/format/);
  });
});
