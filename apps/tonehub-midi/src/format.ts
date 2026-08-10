export function hexId(value: number | undefined): string {
  return value === undefined ? "unavailable" : `0x${value.toString(16).padStart(4, "0")}`;
}

export function bytesToHex(data: Uint8Array): string {
  return [...data].map((byte) => byte.toString(16).padStart(2, "0")).join(" ");
}

export function bytesToCompactHex(data: Uint8Array): string {
  return [...data].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function compactHexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().toLowerCase().replace(/\s+/g, "");
  if (normalized.length === 0 || normalized.length % 2 !== 0 || !/^[0-9a-f]+$/.test(normalized)) {
    throw new Error("expected even-length hexadecimal string");
  }
  const pairs = normalized.match(/.{2}/g) ?? [];
  return Uint8Array.from(pairs.map((pair) => Number.parseInt(pair, 16)));
}
