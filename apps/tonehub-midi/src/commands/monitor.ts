import {
  MidiMessageAssembler,
  MidiPortNotFoundError,
  type MidiPort,
  type MidiTransport,
} from "@tonehub/midi-core";
import { bytesToHex } from "../format.js";

export interface MonitorOptions {
  readonly input?: string;
  readonly duration?: string;
  readonly raw?: boolean;
}

export function parseDuration(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const durationMs = Number(value);
  if (!Number.isFinite(durationMs) || durationMs <= 0 || !Number.isInteger(durationMs)) {
    throw new Error("--duration must be a positive integer in milliseconds");
  }
  return durationMs;
}

export function chooseInput(ports: readonly MidiPort[], requestedId: string | undefined): MidiPort {
  const inputs = ports.filter((port) => port.direction === "input");
  if (requestedId) {
    const requested = inputs.find((port) => port.id === requestedId);
    if (!requested) throw new MidiPortNotFoundError(requestedId);
    return requested;
  }
  if (inputs.length === 1 && inputs[0]) return inputs[0];
  if (inputs.length === 0) throw new Error("No MIDI input ports detected");
  throw new Error("Multiple MIDI inputs detected; select one with --input <id>");
}

export function waitForStop(durationMs: number | undefined): Promise<void> {
  return new Promise((resolve) => {
    let timer: NodeJS.Timeout | undefined;
    const stop = () => {
      if (timer) clearTimeout(timer);
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      resolve();
    };

    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    if (durationMs !== undefined) timer = setTimeout(stop, durationMs);
  });
}

export async function monitorCommand(
  transport: MidiTransport,
  options: MonitorOptions,
): Promise<void> {
  const inputPort = chooseInput(await transport.listPorts(), options.input);
  const durationMs = parseDuration(options.duration);
  let messageCount = 0;

  const assembler = new MidiMessageAssembler((message) => {
    messageCount += 1;
    console.log(
      `${new Date(message.receivedAtMs).toISOString()} message ${bytesToHex(message.data)}`,
    );
  });

  const connection = await transport.openInput(inputPort.id, (chunk) => {
    if (options.raw) {
      console.log(
        `${new Date(chunk.receivedAtMs).toISOString()} chunk   ${bytesToHex(chunk.data)}`,
      );
    }
    assembler.push(chunk.data, chunk.receivedAtMs);
  });

  console.log(
    `Monitoring ${connection.port.id} (${connection.port.name}) passively. Press Ctrl+C to stop.`,
  );
  try {
    await waitForStop(durationMs);
  } finally {
    await connection.close();
  }
  console.log(`Monitor stopped. Complete MIDI messages received: ${messageCount}.`);
}
