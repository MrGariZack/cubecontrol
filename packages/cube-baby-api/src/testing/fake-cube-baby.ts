import {
  decodeCubeBabyMessage,
  encodeAckResponse,
  encodeMemoryReadResponse,
  IR_ROM_FACTORY_BASE,
  IR_ROM_SLOT_SIZE,
  LIVE_PARAM_BASE_ADDRESS,
  LIVE_PARAM_MEMORY,
  PRESET_BANK_BYTE_LENGTH,
} from "@tonehub/cube-baby-protocol";
import type {
  MidiChunk,
  MidiInputConnection,
  MidiOutputConnection,
  MidiPort,
  MidiTransport,
} from "@tonehub/midi-core";

const IDENTITY_RESPONSE = Uint8Array.from(
  "f00032455801004029491c0d7a5465503a624a090a262c1e10204000011260040a152c5c40114307f7"
    .match(/.{2}/g)
    ?.map((byte) => Number.parseInt(byte, 16)) ?? [],
);

/** Captured local bank from experiments 022/023. */
export const FAKE_PRESET_BANK = Uint8Array.from(
  "05030306056405070808010101000000050304064173185008080101010000000600030a59440b0a0805010101000000"
    .match(/.{2}/g)
    ?.map((byte) => Number.parseInt(byte, 16)) ?? [],
);

export const FAKE_INPUT: MidiPort = {
  id: "fake:input",
  direction: "input",
  name: "Fake CUBE Baby",
  state: "connected",
};

export const FAKE_OUTPUT: MidiPort = {
  id: "fake:output",
  direction: "output",
  name: "Fake CUBE Baby",
  state: "connected",
};

export interface FakeCubeBabyOptions {
  readonly bank?: Uint8Array;
  /** Optional full IR ROM image starting at factory base (default: zeros). */
  readonly irRom?: Uint8Array;
}

/**
 * In-memory CUBE Baby stand-in for unit tests (no hardware).
 * Handles identity, memory R/W, erase, and register ACK patterns used by the API.
 */
export class FakeCubeBabyTransport implements MidiTransport {
  readonly sent: Uint8Array[] = [];
  openInputCount = 0;
  openOutputCount = 0;
  readonly bank: Uint8Array;
  readonly live = new Uint8Array(13);
  readonly irRom: Uint8Array;
  #listener: ((chunk: MidiChunk) => void) | undefined;

  constructor(options: FakeCubeBabyOptions = {}) {
    this.bank = (options.bank ?? FAKE_PRESET_BANK).slice();
    if (this.bank.length !== PRESET_BANK_BYTE_LENGTH) {
      throw new Error(`fake bank must be ${PRESET_BANK_BYTE_LENGTH} bytes`);
    }
    // Seed live params from slot A.
    this.live.set(this.bank.subarray(0, 13));
    this.irRom = options.irRom?.slice() ?? new Uint8Array(IR_ROM_SLOT_SIZE * 8);
  }

  async listPorts(): Promise<readonly MidiPort[]> {
    return [FAKE_INPUT, FAKE_OUTPUT];
  }

  async openInput(
    _portId: string,
    onChunk: (chunk: MidiChunk) => void,
  ): Promise<MidiInputConnection> {
    this.openInputCount += 1;
    this.#listener = onChunk;
    return { port: FAKE_INPUT, close: async () => undefined };
  }

  async openOutput(_portId: string): Promise<MidiOutputConnection> {
    this.openOutputCount += 1;
    return {
      port: FAKE_OUTPUT,
      send: async (data) => {
        this.sent.push(data.slice());
        this.#reply(data);
      },
      close: async () => undefined,
    };
  }

  onPortsChanged(): () => void {
    return () => undefined;
  }

  async dispose(): Promise<void> {}

  #emit(sysex: Uint8Array): void {
    const mid = Math.min(12, sysex.length);
    this.#listener?.({
      portId: FAKE_INPUT.id,
      data: sysex.subarray(0, mid),
      receivedAtMs: Date.now(),
    });
    if (mid < sysex.length) {
      this.#listener?.({
        portId: FAKE_INPUT.id,
        data: sysex.subarray(mid),
        receivedAtMs: Date.now(),
      });
    }
  }

  #reply(requestSysex: Uint8Array): void {
    let message;
    try {
      message = decodeCubeBabyMessage(requestSysex);
    } catch {
      return;
    }

    if (message.kind === "identity-request") {
      this.#emit(IDENTITY_RESPONSE);
      return;
    }

    if (message.kind === "memory-read-request") {
      const data = this.#readBytes(message.memory, message.address, message.length);
      this.#emit(encodeMemoryReadResponse(message.memory, message.address, data));
      return;
    }

    if (message.kind === "memory-write-request") {
      this.#writeBytes(message.memory, message.address, message.data);
      this.#emit(encodeAckResponse(false));
      return;
    }

    if (message.kind === "erase-request") {
      if (message.memory === 0) {
        const offset = message.address - IR_ROM_FACTORY_BASE;
        if (offset >= 0 && offset < this.irRom.length) {
          const end = Math.min(offset + IR_ROM_SLOT_SIZE, this.irRom.length);
          this.irRom.fill(0xff, offset, end);
        }
      }
      this.#emit(encodeAckResponse(false));
      return;
    }

    if (message.kind === "register-write-request") {
      this.#emit(encodeAckResponse(true));
    }
  }

  #readBytes(memory: number, address: number, length: number): Uint8Array {
    const out = new Uint8Array(length);
    if (memory === 5 && address === 0 && length === PRESET_BANK_BYTE_LENGTH) {
      out.set(this.bank);
      return out;
    }
    if (memory === LIVE_PARAM_MEMORY && address >= LIVE_PARAM_BASE_ADDRESS) {
      const offset = address - LIVE_PARAM_BASE_ADDRESS;
      for (let i = 0; i < length; i += 1) {
        out[i] = this.live[offset + i] ?? 0;
      }
      return out;
    }
    if (memory === 0) {
      const offset = address - IR_ROM_FACTORY_BASE;
      for (let i = 0; i < length; i += 1) {
        out[i] = offset + i >= 0 && offset + i < this.irRom.length ? (this.irRom[offset + i] ?? 0) : 0;
      }
      return out;
    }
    return out;
  }

  #writeBytes(memory: number, address: number, data: Uint8Array): void {
    if (memory === 5 && address === 0 && data.length === PRESET_BANK_BYTE_LENGTH) {
      this.bank.set(data);
      return;
    }
    if (memory === LIVE_PARAM_MEMORY && address >= LIVE_PARAM_BASE_ADDRESS) {
      const offset = address - LIVE_PARAM_BASE_ADDRESS;
      for (let i = 0; i < data.length; i += 1) {
        if (offset + i >= 0 && offset + i < this.live.length) {
          this.live[offset + i] = data[i] ?? 0;
        }
      }
      return;
    }
    if (memory === 0) {
      const offset = address - IR_ROM_FACTORY_BASE;
      for (let i = 0; i < data.length; i += 1) {
        if (offset + i >= 0 && offset + i < this.irRom.length) {
          this.irRom[offset + i] = data[i] ?? 0;
        }
      }
    }
  }
}
