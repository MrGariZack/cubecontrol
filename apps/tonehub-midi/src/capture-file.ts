import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { MidiMessageAssembler } from "@tonehub/midi-core";

interface JsonLineRecord {
  readonly type?: unknown;
  readonly dataHex?: unknown;
  readonly receivedAtMs?: unknown;
}

function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) {
    throw new Error("Capture contains invalid hexadecimal data");
  }
  return Uint8Array.from(hex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
}

export async function loadMidiMessages(file: string): Promise<readonly Uint8Array[]> {
  const data = await readFile(file);
  if (extname(file).toLowerCase() !== ".jsonl") {
    const messages: Uint8Array[] = [];
    const assembler = new MidiMessageAssembler((message) => messages.push(message.data));
    assembler.push(data, 0);
    return messages;
  }

  const messages: Uint8Array[] = [];
  const lines = data.toString("utf8").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line?.trim()) continue;
    let record: JsonLineRecord;
    try {
      record = JSON.parse(line) as JsonLineRecord;
    } catch {
      throw new Error(`Invalid JSON on capture line ${index + 1}`);
    }
    if (record.type === "message" && typeof record.dataHex === "string") {
      messages.push(fromHex(record.dataHex));
    }
  }
  return messages;
}
