import { decodeCubeBabyMessage, type CubeBabyMessage } from "@tonehub/cube-baby-protocol";
import { loadMidiMessages } from "../capture-file.js";
import { bytesToCompactHex, bytesToHex } from "../format.js";

export interface DecodeOptions {
  readonly json?: boolean;
}

function summarize(message: CubeBabyMessage): Record<string, unknown> {
  const common = {
    kind: message.kind,
    messageType: message.envelope.messageType,
    contentLength: message.envelope.declaredContentLength,
    checksumValid: message.envelope.checksumValid,
    contentHex: bytesToCompactHex(message.envelope.content),
  };

  switch (message.kind) {
    case "identity-response":
      return {
        ...common,
        name: message.name,
        nameByteLength: message.nameByteLength,
        metadataHex: bytesToCompactHex(message.metadata),
      };
    case "memory-read-request":
      return {
        ...common,
        memory: message.memory,
        address: message.address,
        length: message.length,
      };
    case "memory-read-response":
    case "memory-write-request":
      return {
        ...common,
        memory: message.memory,
        address: message.address,
        length: message.length,
        dataHex: bytesToCompactHex(message.data),
      };
    case "ack":
      return {
        ...common,
        accepted: message.accepted,
        rawValue: message.rawValue,
      };
    default:
      return common;
  }
}

export async function decodeCommand(file: string, options: DecodeOptions): Promise<void> {
  const midiMessages = await loadMidiMessages(file);
  const results = midiMessages.map((raw, index) => {
    try {
      return {
        index,
        rawHex: bytesToCompactHex(raw),
        decoded: summarize(decodeCubeBabyMessage(raw)),
      };
    } catch (error) {
      return {
        index,
        rawHex: bytesToCompactHex(raw),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (results.length === 0) {
    console.log("No complete MIDI messages found.");
    return;
  }
  for (const result of results) {
    console.log(`#${result.index} ${bytesToHex(midiMessages[result.index] ?? new Uint8Array())}`);
    if ("error" in result) {
      console.log(`  undecoded: ${result.error}`);
    } else {
      console.log(`  ${JSON.stringify(result.decoded)}`);
    }
  }
}
