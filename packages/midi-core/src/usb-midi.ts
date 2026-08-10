function dataBytesForCin(cin: number): number | undefined {
  if (cin === 0x5 || cin === 0xf) return 1;
  if (cin === 0x2 || cin === 0x6 || cin === 0xc || cin === 0xd) return 2;
  if (cin >= 0x3 && cin <= 0xe) return 3;
  return undefined;
}

/**
 * Removes USB-MIDI 1.0 event-packet headers from one USB transfer.
 *
 * The high nibble of the first byte is the cable number and the low nibble is
 * the Code Index Number (CIN), which determines how many MIDI bytes follow.
 */
export function decodeUsbMidiTransfer(data: Uint8Array): Uint8Array {
  if (data.length % 4 !== 0) {
    throw new Error(`USB-MIDI transfer length must be divisible by 4; got ${data.length}`);
  }

  const midiBytes: number[] = [];
  for (let offset = 0; offset < data.length; offset += 4) {
    const header = data[offset];
    if (header === undefined) continue;
    const cin = header & 0x0f;
    const byteCount = dataBytesForCin(cin);
    if (byteCount === undefined) {
      throw new Error(`Unsupported or reserved USB-MIDI CIN: 0x${cin.toString(16)}`);
    }

    for (let index = 1; index <= byteCount; index += 1) {
      const byte = data[offset + index];
      if (byte === undefined) throw new Error("Truncated USB-MIDI event packet");
      midiBytes.push(byte);
    }
  }
  return Uint8Array.from(midiBytes);
}
