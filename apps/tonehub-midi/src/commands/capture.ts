import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { finished } from "node:stream/promises";
import { MidiMessageAssembler, type MidiTransport } from "@tonehub/midi-core";
import { bytesToCompactHex } from "../format.js";
import { chooseInput, parseDuration, waitForStop } from "./monitor.js";

export interface CaptureOptions {
  readonly input?: string;
  readonly duration?: string;
  readonly force?: boolean;
}

export async function captureCommand(
  transport: MidiTransport,
  outputFile: string,
  options: CaptureOptions,
): Promise<void> {
  const inputPort = chooseInput(await transport.listPorts(), options.input);
  const durationMs = parseDuration(options.duration);
  const absolutePath = resolve(outputFile);
  await mkdir(dirname(absolutePath), { recursive: true });

  const stream = createWriteStream(absolutePath, {
    encoding: "utf8",
    flags: options.force ? "w" : "wx",
  });
  await new Promise<void>((resolveOpen, reject) => {
    stream.once("open", () => resolveOpen());
    stream.once("error", reject);
  });

  const startedAtMs = Date.now();
  let sequence = 0;
  let completeMessages = 0;
  const writeRecord = (record: Record<string, unknown>): void => {
    sequence += 1;
    stream.write(`${JSON.stringify({ sequence, ...record })}\n`);
  };

  stream.write(
    `${JSON.stringify({
      type: "tonehub-midi-capture",
      version: 1,
      createdAt: new Date(startedAtMs).toISOString(),
      port: inputPort,
    })}\n`,
  );

  const assembler = new MidiMessageAssembler((message) => {
    completeMessages += 1;
    writeRecord({
      type: "message",
      receivedAtMs: message.receivedAtMs,
      dataHex: bytesToCompactHex(message.data),
    });
  });

  const connection = await transport.openInput(inputPort.id, (chunk) => {
    writeRecord({
      type: "chunk",
      receivedAtMs: chunk.receivedAtMs,
      dataHex: bytesToCompactHex(chunk.data),
    });
    assembler.push(chunk.data, chunk.receivedAtMs);
  });

  console.log(`Capturing ${connection.port.id} (${connection.port.name}) to ${absolutePath}.`);
  console.log("Input only: no MIDI output is opened. Press Ctrl+C to stop.");
  try {
    await waitForStop(durationMs);
  } finally {
    await connection.close();
    stream.end();
    await finished(stream);
  }

  console.log(`Capture saved. Complete MIDI messages: ${completeMessages}.`);
}
