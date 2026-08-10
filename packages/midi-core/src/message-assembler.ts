export interface AssembledMidiMessage {
  readonly data: Uint8Array;
  readonly receivedAtMs: number;
}

const isRealtime = (byte: number): boolean => byte >= 0xf8;
const isChannelStatus = (byte: number): boolean => byte >= 0x80 && byte <= 0xef;

function messageLength(status: number): number | undefined {
  if (status >= 0x80 && status <= 0xef) {
    const family = status & 0xf0;
    return family === 0xc0 || family === 0xd0 ? 2 : 3;
  }

  switch (status) {
    case 0xf1:
    case 0xf3:
      return 2;
    case 0xf2:
      return 3;
    case 0xf6:
    case 0xf7:
      return 1;
    default:
      return undefined;
  }
}

/**
 * Stateful MIDI 1.0 byte-stream assembler.
 *
 * Native APIs may split one SysEx across callbacks or combine several messages
 * in one callback. Real-Time bytes are emitted separately even inside SysEx.
 */
export class MidiMessageAssembler {
  readonly #emit: (message: AssembledMidiMessage) => void;
  #buffer: number[] = [];
  #expectedLength: number | undefined;
  #runningStatus: number | undefined;
  #inSysEx = false;

  constructor(emit: (message: AssembledMidiMessage) => void) {
    this.#emit = emit;
  }

  push(chunk: Uint8Array, receivedAtMs: number): void {
    for (const byte of chunk) {
      if (isRealtime(byte)) {
        this.#emitMessage([byte], receivedAtMs);
        continue;
      }

      if (this.#inSysEx) {
        this.#buffer.push(byte);
        if (byte === 0xf7) {
          this.#emitMessage(this.#buffer, receivedAtMs);
          this.#resetMessage();
          this.#inSysEx = false;
        }
        continue;
      }

      if (byte === 0xf0) {
        this.#resetMessage();
        this.#runningStatus = undefined;
        this.#buffer.push(byte);
        this.#inSysEx = true;
        continue;
      }

      if (byte >= 0x80) {
        this.#startStatus(byte);
        this.#flushIfComplete(receivedAtMs);
        continue;
      }

      if (this.#buffer.length === 0 && this.#runningStatus !== undefined) {
        this.#buffer.push(this.#runningStatus);
        this.#expectedLength = messageLength(this.#runningStatus);
      }

      if (this.#buffer.length > 0) {
        this.#buffer.push(byte);
        this.#flushIfComplete(receivedAtMs);
      }
    }
  }

  reset(): void {
    this.#resetMessage();
    this.#runningStatus = undefined;
    this.#inSysEx = false;
  }

  #startStatus(status: number): void {
    this.#resetMessage();
    this.#buffer.push(status);
    this.#expectedLength = messageLength(status);
    this.#runningStatus = isChannelStatus(status) ? status : undefined;
  }

  #flushIfComplete(receivedAtMs: number): void {
    if (this.#expectedLength !== undefined && this.#buffer.length === this.#expectedLength) {
      this.#emitMessage(this.#buffer, receivedAtMs);
      this.#resetMessage();
    }
  }

  #emitMessage(bytes: readonly number[], receivedAtMs: number): void {
    this.#emit({ data: Uint8Array.from(bytes), receivedAtMs });
  }

  #resetMessage(): void {
    this.#buffer = [];
    this.#expectedLength = undefined;
  }
}
