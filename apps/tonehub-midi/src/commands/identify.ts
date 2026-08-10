import { CubeBabyClient } from "@tonehub/cube-baby-api";
import type { MidiTransport } from "@tonehub/midi-core";
import { bytesToCompactHex } from "../format.js";

export interface IdentifyOptions {
  readonly input: string;
  readonly output: string;
  readonly timeout?: string;
  readonly confirmReadOnly?: boolean;
  readonly json?: boolean;
}

export async function identifyCommand(
  transport: MidiTransport,
  options: IdentifyOptions,
): Promise<void> {
  if (!options.confirmReadOnly) {
    throw new Error(
      "Refusing to transmit without --confirm-read-only; this sends only the captured identity request",
    );
  }
  const timeoutMs = options.timeout === undefined ? 1_500 : Number(options.timeout);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 10_000) {
    throw new Error("--timeout must be an integer from 1 to 10000 milliseconds");
  }

  const identity = await new CubeBabyClient(transport).identify({
    inputPortId: options.input,
    outputPortId: options.output,
    timeoutMs,
  });
  const result = {
    reportedName: identity.reportedName,
    rawNameByteLength: identity.rawNameByteLength,
    metadataHex: bytesToCompactHex(identity.metadata),
    observedAt: new Date(identity.observedAtMs).toISOString(),
  };
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`CUBE Baby identity: ${result.reportedName}`);
    console.log(`Name bytes: ${result.rawNameByteLength}`);
    console.log(`Unclassified metadata: ${result.metadataHex}`);
  }
}
