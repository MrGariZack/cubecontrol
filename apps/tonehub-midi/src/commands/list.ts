import { classifyCubeBabyPort, type MidiPort, type MidiTransport } from "@tonehub/midi-core";
import { hexId } from "../format.js";

export interface ListOptions {
  readonly json?: boolean;
}

function printablePort(port: MidiPort): Record<string, unknown> {
  return {
    id: port.id,
    direction: port.direction,
    name: port.name,
    manufacturer: port.manufacturer ?? null,
    vendorId: port.vendorId ?? null,
    productId: port.productId ?? null,
    cubeBabyMatch: classifyCubeBabyPort(port),
  };
}

export async function listCommand(transport: MidiTransport, options: ListOptions): Promise<void> {
  const ports = await transport.listPorts();

  if (options.json) {
    process.stdout.write(`${JSON.stringify(ports.map(printablePort), null, 2)}\n`);
    return;
  }

  if (ports.length === 0) {
    console.log("No MIDI ports detected.");
    return;
  }

  console.log(`Detected ${ports.length} MIDI port(s):`);
  for (const port of ports) {
    const match = classifyCubeBabyPort(port);
    const label =
      match === "confirmed"
        ? " [CUBE Baby: confirmed VID/PID]"
        : match === "candidate"
          ? " [CUBE Baby: name-only candidate]"
          : "";
    console.log(`- ${port.id} | ${port.direction} | ${port.name}${label}`);
    console.log(
      `  manufacturer=${port.manufacturer ?? "unavailable"} vid=${hexId(port.vendorId)} pid=${hexId(port.productId)}`,
    );
  }
}
