export class MidiPortNotFoundError extends Error {
  constructor(portId: string) {
    super(`MIDI port not found: ${portId}`);
    this.name = "MidiPortNotFoundError";
  }
}

export class MidiPortDirectionError extends Error {
  constructor(portId: string, expected: "input" | "output") {
    super(`MIDI port ${portId} is not an ${expected} port`);
    this.name = "MidiPortDirectionError";
  }
}
