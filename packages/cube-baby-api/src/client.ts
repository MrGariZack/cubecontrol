import {
  buildIrRomSector,
  cabinetToRomSlot,
  decodePresetBank,
  decodeWavToMonoFloat32,
  encodeEraseRequest,
  encodeIdentityRequest,
  encodeMemoryReadRequest,
  encodeMemoryWriteRequest,
  encodeRegisterWriteRequest,
  expandIrRomSector,
  IR_LIVE_CHUNK_SIZE,
  IR_LIVE_DATA_ADDRESS,
  IR_LIVE_FLAG_ADDRESS,
  IR_LIVE_MEMORY,
  IR_LIVE_PAYLOAD_LENGTH,
  IR_ROM_CHUNK_SIZE,
  IR_ROM_FACTORY_BASE,
  IR_ROM_MEMORY,
  IR_ROM_PAYLOAD_LENGTH,
  IR_ROM_SLOT_COUNT,
  IR_ROM_SLOT_SIZE,
  IR_ROM_SLOT_STRIDE,
  IR_ROM_UPLOAD_ADDRESS,
  IR_ROM_VERIFY_CHUNK_SIZE,
  irRomSectorToLivePayload,
  irRomSlotAddress,
  liveParamAddress,
  LIVE_PARAM_MEMORY,
  prepareIrSamples,
  PRESET_BANK_BYTE_LENGTH,
  PRESET_SLOT_BYTE_LENGTH,
  type CubeBabyPresetBank,
} from "@tonehub/cube-baby-protocol";
import type { MidiTransport } from "@tonehub/midi-core";
import {
  CubeBabyReadTimeoutError,
  CubeBabySessionPortMismatchError,
  CubeBabyWriteTimeoutError,
} from "./errors.js";
import { CubeBabyLink, type CubeBabyLinkPorts } from "./link.js";
import type {
  ApplyLiveIrOptions,
  CubeBabyApplyLiveIrResult,
  CubeBabyDumpIrRomResult,
  CubeBabyEraseAck,
  CubeBabyIdentity,
  CubeBabyLoadIrFromWavResult,
  CubeBabyMemoryRead,
  CubeBabyMemoryWriteAck,
  CubeBabyPersistIrRomResult,
  CubeBabyRegisterWriteAck,
  CubeBabyRestoreBankResult,
  CubeBabySaveParamResult,
  CubeBabySelectCabinetResult,
  DumpIrRomOptions,
  EraseCubeBabyMemoryOptions,
  IdentifyCubeBabyOptions,
  LoadIrFromWavOptions,
  PersistIrRomOptions,
  ReadCubeBabyMemoryOptions,
  RestoreCubeBabyBankOptions,
  SaveCubeBabyParamOptions,
  SelectCabinetOptions,
  WriteCubeBabyMemoryOptions,
  WriteCubeBabyRegisterOptions,
  WriteLiveParamOptions,
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 1_500;
const BANK_MEMORY = 5;
const BANK_ADDRESS = 0x0000_0000;
const LIVE_BASE = 0x8000_0000;
const STEP_GAP_MS = 250;

export class CubeBabyClient {
  #sessionLink: CubeBabyLink | undefined;
  #activeLink: CubeBabyLink | undefined;

  constructor(private readonly transport: MidiTransport) {}

  /** Whether `connect()` opened a long-lived MIDI session. */
  get connected(): boolean {
    return this.#sessionLink !== undefined && !this.#sessionLink.closed;
  }

  /**
   * Open input/output once for subsequent calls (serialized on one assembler).
   * Call `disconnect()` when finished.
   */
  async connect(ports: CubeBabyLinkPorts): Promise<void> {
    if (this.#sessionLink !== undefined) {
      throw new Error("CUBE Baby client already connected; call disconnect() first");
    }
    this.#sessionLink = await CubeBabyLink.open(this.transport, ports);
  }

  async disconnect(): Promise<void> {
    const link = this.#sessionLink;
    this.#sessionLink = undefined;
    this.#activeLink = undefined;
    if (link !== undefined) await link.close();
  }

  async #withLink<T>(ports: CubeBabyLinkPorts, fn: (link: CubeBabyLink) => Promise<T>): Promise<T> {
    if (this.#activeLink !== undefined) {
      if (!this.#activeLink.samePorts(ports)) {
        throw new CubeBabySessionPortMismatchError();
      }
      return fn(this.#activeLink);
    }

    if (this.#sessionLink !== undefined) {
      if (!this.#sessionLink.samePorts(ports)) {
        throw new CubeBabySessionPortMismatchError();
      }
      const session = this.#sessionLink;
      return session.runExclusive(async () => {
        this.#activeLink = session;
        try {
          return await fn(session);
        } finally {
          this.#activeLink = undefined;
        }
      });
    }

    const link = await CubeBabyLink.open(this.transport, ports);
    try {
      return await link.runExclusive(async () => {
        this.#activeLink = link;
        try {
          return await fn(link);
        } finally {
          this.#activeLink = undefined;
        }
      });
    } finally {
      await link.close();
    }
  }

  async #handshake(link: CubeBabyLink): Promise<void> {
    await link.send(encodeIdentityRequest());
    await sleep(80);
  }

  async identify(options: IdentifyCubeBabyOptions): Promise<CubeBabyIdentity> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error("timeoutMs must be a positive integer");
    }
    const ports = { inputPortId: options.inputPortId, outputPortId: options.outputPortId };
    return this.#withLink(ports, (link) =>
      link.exchangeUnlocked({
        request: encodeIdentityRequest(),
        timeoutMs,
        timeoutError: new CubeBabyReadTimeoutError(timeoutMs),
        match: (message, receivedAtMs) => {
          if (message.kind !== "identity-response" || !message.envelope.checksumValid) {
            return undefined;
          }
          return {
            reportedName: message.name,
            rawNameByteLength: message.nameByteLength,
            metadata: message.metadata,
            observedAtMs: receivedAtMs,
          };
        },
      }),
    );
  }

  async readMemory(options: ReadCubeBabyMemoryOptions): Promise<CubeBabyMemoryRead> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error("timeoutMs must be a positive integer");
    }
    const ports = { inputPortId: options.inputPortId, outputPortId: options.outputPortId };
    const request = encodeMemoryReadRequest(options.memory, options.address, options.length);
    return this.#withLink(ports, (link) =>
      link.exchangeUnlocked({
        request,
        timeoutMs,
        timeoutError: new CubeBabyReadTimeoutError(timeoutMs),
        ...(options.handshake === false ? {} : { beforeSend: async () => this.#handshake(link) }),
        match: (message, receivedAtMs) => {
          if (
            message.kind !== "memory-read-response" ||
            !message.envelope.checksumValid ||
            message.memory !== options.memory ||
            message.address !== options.address ||
            message.length !== options.length
          ) {
            return undefined;
          }
          return {
            memory: message.memory,
            address: message.address,
            length: message.length,
            data: message.data,
            observedAtMs: receivedAtMs,
          };
        },
      }),
    );
  }

  async writeMemory(options: WriteCubeBabyMemoryOptions): Promise<CubeBabyMemoryWriteAck> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error("timeoutMs must be a positive integer");
    }
    const ports = { inputPortId: options.inputPortId, outputPortId: options.outputPortId };
    const request = encodeMemoryWriteRequest(options.memory, options.address, options.data);
    return this.#withLink(ports, (link) =>
      link.exchangeUnlocked({
        request,
        timeoutMs,
        timeoutError: new CubeBabyWriteTimeoutError(timeoutMs),
        ...(options.handshake === false ? {} : { beforeSend: async () => this.#handshake(link) }),
        match: (message, receivedAtMs) => {
          if (message.kind !== "ack" || !message.envelope.checksumValid) return undefined;
          return {
            memory: options.memory,
            address: options.address,
            length: options.data.length,
            data: options.data.slice(),
            accepted: message.accepted,
            rawValue: message.rawValue,
            observedAtMs: receivedAtMs,
          };
        },
      }),
    );
  }

  async eraseMemory(options: EraseCubeBabyMemoryOptions): Promise<CubeBabyEraseAck> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error("timeoutMs must be a positive integer");
    }
    const ports = { inputPortId: options.inputPortId, outputPortId: options.outputPortId };
    const request = encodeEraseRequest(options.memory, options.address);
    return this.#withLink(ports, (link) =>
      link.exchangeUnlocked({
        request,
        timeoutMs,
        timeoutError: new CubeBabyWriteTimeoutError(timeoutMs),
        ...(options.handshake === false ? {} : { beforeSend: async () => this.#handshake(link) }),
        match: (message, receivedAtMs) => {
          if (message.kind !== "ack" || !message.envelope.checksumValid) return undefined;
          return {
            memory: options.memory,
            address: options.address,
            accepted: message.accepted,
            rawValue: message.rawValue,
            observedAtMs: receivedAtMs,
          };
        },
      }),
    );
  }

  async writeRegister(options: WriteCubeBabyRegisterOptions): Promise<CubeBabyRegisterWriteAck> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error("timeoutMs must be a positive integer");
    }
    const ports = { inputPortId: options.inputPortId, outputPortId: options.outputPortId };
    const request = encodeRegisterWriteRequest(options.memory, options.address, options.value);
    return this.#withLink(ports, (link) =>
      link.exchangeUnlocked({
        request,
        timeoutMs,
        timeoutError: new CubeBabyWriteTimeoutError(timeoutMs),
        ...(options.handshake === false ? {} : { beforeSend: async () => this.#handshake(link) }),
        match: (message, receivedAtMs) => {
          if (message.kind !== "ack" || !message.envelope.checksumValid) return undefined;
          return {
            memory: options.memory,
            address: options.address,
            value: options.value,
            accepted: message.accepted,
            rawValue: message.rawValue,
            observedAtMs: receivedAtMs,
          };
        },
      }),
    );
  }

  /**
   * CubeSuite Save path:
   * read bank → live 1-byte write → 48-byte bank write → verify read.
   */
  async saveParam(options: SaveCubeBabyParamOptions): Promise<CubeBabySaveParamResult> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error("timeoutMs must be a positive integer");
    }
    if (!Number.isInteger(options.slotIndex) || options.slotIndex < 0 || options.slotIndex > 2) {
      throw new Error("slotIndex must be 0, 1, or 2");
    }
    if (!Number.isInteger(options.offset) || options.offset < 0 || options.offset > 12) {
      throw new Error("offset must be an integer from 0 to 12");
    }
    if (!Number.isInteger(options.value) || options.value < 0 || options.value > 0xff) {
      throw new Error("value must be an integer from 0 to 255");
    }

    const ports = {
      inputPortId: options.inputPortId,
      outputPortId: options.outputPortId,
      timeoutMs,
    };

    return this.#withLink(ports, async () => {
      const before = await this.readMemory({
        ...ports,
        memory: BANK_MEMORY,
        address: BANK_ADDRESS,
        length: PRESET_BANK_BYTE_LENGTH,
        handshake: false,
      });
      await sleep(STEP_GAP_MS);

      const written = before.data.slice();
      const byteIndex = options.slotIndex * PRESET_SLOT_BYTE_LENGTH + options.offset;
      const previousValue = written[byteIndex] ?? 0;
      written[byteIndex] = options.value;

      const liveAck = await this.writeMemory({
        ...ports,
        memory: BANK_MEMORY,
        address: LIVE_BASE + options.offset,
        data: Uint8Array.of(options.value),
        handshake: false,
      });
      await sleep(STEP_GAP_MS);

      const bankAck = await this.writeMemory({
        ...ports,
        memory: BANK_MEMORY,
        address: BANK_ADDRESS,
        data: written,
        handshake: false,
      });
      await sleep(STEP_GAP_MS);

      const after = await this.readMemory({
        ...ports,
        memory: BANK_MEMORY,
        address: BANK_ADDRESS,
        length: PRESET_BANK_BYTE_LENGTH,
        handshake: false,
      });

      const verified =
        after.data.length === written.length && after.data.every((byte, i) => byte === written[i]);

      return {
        slotIndex: options.slotIndex,
        offset: options.offset,
        previousValue,
        value: options.value,
        before: before.data.slice(),
        written,
        after: after.data.slice(),
        verified,
        liveAck: { accepted: liveAck.accepted, rawValue: liveAck.rawValue },
        bankAck: { accepted: bankAck.accepted, rawValue: bankAck.rawValue },
        observedAtMs: after.observedAtMs,
      };
    });
  }

  /**
   * Restore a full 48-byte A+B+C bank, then push one slot's fields 0–12 into live RAM.
   */
  async restoreBank(options: RestoreCubeBabyBankOptions): Promise<CubeBabyRestoreBankResult> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const liveSlotIndex = options.liveSlotIndex ?? 0;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error("timeoutMs must be a positive integer");
    }
    if (options.data.length !== PRESET_BANK_BYTE_LENGTH) {
      throw new Error(`bank data must be exactly ${PRESET_BANK_BYTE_LENGTH} bytes`);
    }
    if (!Number.isInteger(liveSlotIndex) || liveSlotIndex < 0 || liveSlotIndex > 2) {
      throw new Error("liveSlotIndex must be 0, 1, or 2");
    }

    const ports = {
      inputPortId: options.inputPortId,
      outputPortId: options.outputPortId,
      timeoutMs,
    };

    return this.#withLink(ports, async () => {
      const before = await this.readMemory({
        ...ports,
        memory: BANK_MEMORY,
        address: BANK_ADDRESS,
        length: PRESET_BANK_BYTE_LENGTH,
        handshake: false,
      });
      await sleep(STEP_GAP_MS);

      const written = options.data.slice();
      const bankAck = await this.writeMemory({
        ...ports,
        memory: BANK_MEMORY,
        address: BANK_ADDRESS,
        data: written,
        handshake: false,
      });
      await sleep(STEP_GAP_MS);

      const slotStart = liveSlotIndex * PRESET_SLOT_BYTE_LENGTH;
      const liveAcks: { offset: number; accepted: boolean; rawValue: number }[] = [];
      for (let offset = 0; offset <= 12; offset += 1) {
        const value = written[slotStart + offset] ?? 0;
        const ack = await this.writeMemory({
          ...ports,
          memory: BANK_MEMORY,
          address: LIVE_BASE + offset,
          data: Uint8Array.of(value),
          handshake: false,
        });
        liveAcks.push({ offset, accepted: ack.accepted, rawValue: ack.rawValue });
        await sleep(40);
      }
      await sleep(STEP_GAP_MS);

      const after = await this.readMemory({
        ...ports,
        memory: BANK_MEMORY,
        address: BANK_ADDRESS,
        length: PRESET_BANK_BYTE_LENGTH,
        handshake: false,
      });

      const verified =
        after.data.length === written.length && after.data.every((byte, i) => byte === written[i]);

      return {
        before: before.data.slice(),
        written,
        after: after.data.slice(),
        verified,
        bankAck: { accepted: bankAck.accepted, rawValue: bankAck.rawValue },
        liveSlotIndex,
        liveAcks,
        observedAtMs: after.observedAtMs,
      };
    });
  }

  /**
   * Apply an IR into live RAM only (memory 0x04). Never sends erase (0x21) or ROM writes.
   */
  async applyLiveIr(options: ApplyLiveIrOptions): Promise<CubeBabyApplyLiveIrResult> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error("timeoutMs must be a positive integer");
    }
    if (options.payload.length !== IR_LIVE_PAYLOAD_LENGTH) {
      throw new Error(`live IR payload must be exactly ${IR_LIVE_PAYLOAD_LENGTH} bytes`);
    }
    if (options.distance !== undefined && !Number.isFinite(options.distance)) {
      throw new Error("distance must be a finite number when provided");
    }

    const payload = options.payload.slice();
    if (options.distance !== undefined) {
      const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
      view.setFloat32(0, options.distance, true);
    }
    const distanceView = new DataView(payload.buffer, payload.byteOffset, 4);
    const distance = distanceView.getFloat32(0, true);

    const ports = {
      inputPortId: options.inputPortId,
      outputPortId: options.outputPortId,
      timeoutMs,
    };

    return this.#withLink(ports, async () => {
      const registerAcks: {
        address: number;
        value: number;
        accepted: boolean;
        rawValue: number;
      }[] = [];
      const chunkAcks: { address: number; length: number; accepted: boolean }[] = [];

      const flagOff = await this.writeMemory({
        ...ports,
        memory: IR_LIVE_MEMORY,
        address: IR_LIVE_FLAG_ADDRESS,
        data: Uint8Array.of(0),
        handshake: false,
      });
      await sleep(80);

      const regFlagOff = await this.writeRegister({
        ...ports,
        memory: IR_LIVE_MEMORY,
        address: IR_LIVE_FLAG_ADDRESS,
        value: 1,
        handshake: false,
      });
      registerAcks.push({
        address: regFlagOff.address,
        value: regFlagOff.value,
        accepted: regFlagOff.accepted,
        rawValue: regFlagOff.rawValue,
      });
      await sleep(80);

      for (let offset = 0; offset < payload.length; offset += IR_LIVE_CHUNK_SIZE) {
        const chunk = payload.subarray(offset, offset + IR_LIVE_CHUNK_SIZE);
        const address = IR_LIVE_DATA_ADDRESS + offset;
        const ack = await this.writeMemory({
          ...ports,
          memory: IR_LIVE_MEMORY,
          address,
          data: chunk,
          handshake: false,
        });
        chunkAcks.push({ address, length: chunk.length, accepted: ack.accepted });
        await sleep(40);
      }

      const regLength = await this.writeRegister({
        ...ports,
        memory: IR_LIVE_MEMORY,
        address: IR_LIVE_DATA_ADDRESS,
        value: payload.length,
        handshake: false,
      });
      registerAcks.push({
        address: regLength.address,
        value: regLength.value,
        accepted: regLength.accepted,
        rawValue: regLength.rawValue,
      });
      await sleep(80);

      const flagOn = await this.writeMemory({
        ...ports,
        memory: IR_LIVE_MEMORY,
        address: IR_LIVE_FLAG_ADDRESS,
        data: Uint8Array.of(1),
        handshake: false,
      });
      await sleep(80);

      const regFlagOn = await this.writeRegister({
        ...ports,
        memory: IR_LIVE_MEMORY,
        address: IR_LIVE_FLAG_ADDRESS,
        value: 1,
        handshake: false,
      });
      registerAcks.push({
        address: regFlagOn.address,
        value: regFlagOn.value,
        accepted: regFlagOn.accepted,
        rawValue: regFlagOn.rawValue,
      });

      return {
        payloadLength: payload.length,
        distance,
        chunkCount: chunkAcks.length,
        flagOffAck: { accepted: flagOff.accepted, rawValue: flagOff.rawValue },
        flagOnAck: { accepted: flagOn.accepted, rawValue: flagOn.rawValue },
        registerAcks,
        chunkAcks,
        observedAtMs: regFlagOn.observedAtMs,
      };
    });
  }

  /**
   * Read a full IR ROM sector (4096 bytes) for slot index 0..7, or sentinel 8 at `0x71000`.
   */
  async dumpIrRom(options: DumpIrRomOptions): Promise<CubeBabyDumpIrRomResult> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error("timeoutMs must be a positive integer");
    }
    const slotIndex = options.slotIndex;
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > IR_ROM_SLOT_COUNT) {
      throw new Error(`slotIndex must be an integer 0..${IR_ROM_SLOT_COUNT} (8 = empty sentinel)`);
    }
    const address =
      slotIndex === IR_ROM_SLOT_COUNT
        ? IR_ROM_FACTORY_BASE + IR_ROM_SLOT_COUNT * IR_ROM_SLOT_STRIDE
        : irRomSlotAddress(slotIndex);

    const ports = {
      inputPortId: options.inputPortId,
      outputPortId: options.outputPortId,
      timeoutMs,
    };

    return this.#withLink(ports, async () => {
      const parts: number[] = [];
      let observedAtMs = Date.now();
      for (let offset = 0; offset < IR_ROM_SLOT_SIZE; offset += IR_ROM_VERIFY_CHUNK_SIZE) {
        const length = Math.min(IR_ROM_VERIFY_CHUNK_SIZE, IR_ROM_SLOT_SIZE - offset);
        const read = await this.readMemory({
          ...ports,
          memory: IR_ROM_MEMORY,
          address: address + offset,
          length,
          handshake: false,
        });
        parts.push(...read.data);
        observedAtMs = read.observedAtMs;
        await sleep(40);
      }

      return {
        slotIndex,
        address,
        length: parts.length,
        data: Uint8Array.from(parts),
        observedAtMs,
      };
    });
  }

  /**
   * Persist an IR image to a factory ROM slot: erase → chunked write → verify read.
   * Default slot is 7 (upload `0x00070000`). Accepts 2056 (zero-padded to 4096 by default)
   * or a full 4096-byte sector dump.
   */
  async persistIrRom(options: PersistIrRomOptions): Promise<CubeBabyPersistIrRomResult> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error("timeoutMs must be a positive integer");
    }
    const padSector = options.padSector !== false;
    const inputLength = options.payload.length;
    if (inputLength !== IR_ROM_PAYLOAD_LENGTH && inputLength !== IR_ROM_SLOT_SIZE) {
      throw new Error(
        `ROM IR payload must be ${IR_ROM_PAYLOAD_LENGTH} or ${IR_ROM_SLOT_SIZE} bytes`,
      );
    }
    if (!padSector && inputLength !== IR_ROM_PAYLOAD_LENGTH) {
      throw new Error("padSector=false requires a 2056-byte CubeSuite payload");
    }

    const slotIndex = options.slotIndex ?? 7;
    const address = irRomSlotAddress(slotIndex);
    if (slotIndex === 7 && address !== IR_ROM_UPLOAD_ADDRESS) {
      throw new Error("internal: upload slot address mismatch");
    }

    const ports = {
      inputPortId: options.inputPortId,
      outputPortId: options.outputPortId,
      timeoutMs,
    };
    const padded = padSector && inputLength === IR_ROM_PAYLOAD_LENGTH;
    const payload = padSector ? expandIrRomSector(options.payload) : options.payload.slice();

    return this.#withLink(ports, async () => {
      const eraseAck = await this.eraseMemory({
        ...ports,
        memory: IR_ROM_MEMORY,
        address,
        handshake: false,
      });
      await sleep(STEP_GAP_MS);

      let writeChunkCount = 0;
      for (let offset = 0; offset < payload.length; offset += IR_ROM_CHUNK_SIZE) {
        const chunk = payload.subarray(offset, offset + IR_ROM_CHUNK_SIZE);
        await this.writeMemory({
          ...ports,
          memory: IR_ROM_MEMORY,
          address: address + offset,
          data: chunk,
          handshake: false,
        });
        writeChunkCount += 1;
        await sleep(40);
      }
      await sleep(STEP_GAP_MS);

      const verifiedParts: number[] = [];
      let observedAtMs = eraseAck.observedAtMs;
      for (let offset = 0; offset < payload.length; offset += IR_ROM_VERIFY_CHUNK_SIZE) {
        const length = Math.min(IR_ROM_VERIFY_CHUNK_SIZE, payload.length - offset);
        const read = await this.readMemory({
          ...ports,
          memory: IR_ROM_MEMORY,
          address: address + offset,
          length,
          handshake: false,
        });
        verifiedParts.push(...read.data);
        observedAtMs = read.observedAtMs;
        await sleep(40);
      }

      const verifiedBytes = Uint8Array.from(verifiedParts);
      const verified =
        verifiedBytes.length === payload.length &&
        verifiedBytes.every((byte, index) => byte === payload[index]);

      return {
        slotIndex,
        address,
        payloadLength: inputLength,
        writtenLength: payload.length,
        padded,
        eraseAck: { accepted: eraseAck.accepted, rawValue: eraseAck.rawValue },
        writeChunkCount,
        verifyBytes: verifiedBytes.length,
        verified,
        observedAtMs,
      };
    });
  }

  /** Read and decode the A+B+C preset bank (48 bytes @ memory 5 / address 0). */
  async readPresetBank(options: {
    readonly inputPortId: string;
    readonly outputPortId: string;
    readonly timeoutMs?: number;
  }): Promise<CubeBabyPresetBank> {
    const read = await this.readMemory({
      inputPortId: options.inputPortId,
      outputPortId: options.outputPortId,
      memory: BANK_MEMORY,
      address: BANK_ADDRESS,
      length: PRESET_BANK_BYTE_LENGTH,
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    });
    return decodePresetBank(read.data);
  }

  /** Write one live parameter by name or offset (memory 5 / `0x80000000+n`). */
  async writeLiveParam(options: WriteLiveParamOptions): Promise<CubeBabyMemoryWriteAck> {
    if (options.param === undefined && options.offset === undefined) {
      throw new Error("writeLiveParam requires param or offset");
    }
    if (options.param !== undefined && options.offset !== undefined) {
      throw new Error("writeLiveParam accepts param or offset, not both");
    }
    if (!Number.isInteger(options.value) || options.value < 0 || options.value > 255) {
      throw new Error("value must be an integer 0..255");
    }
    const address =
      options.param !== undefined
        ? liveParamAddress(options.param)
        : liveParamAddress(options.offset as number);
    return this.writeMemory({
      inputPortId: options.inputPortId,
      outputPortId: options.outputPortId,
      memory: LIVE_PARAM_MEMORY,
      address,
      data: Uint8Array.of(options.value),
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
      ...(options.handshake === undefined ? {} : { handshake: options.handshake }),
    });
  }

  /**
   * Select live Cabinet (0..8). Nudges via another value first so IR RAM reloads
   * when the target Cabinet was already active.
   */
  async selectCabinet(options: SelectCabinetOptions): Promise<CubeBabySelectCabinetResult> {
    if (!Number.isInteger(options.cabinet) || options.cabinet < 0 || options.cabinet > 8) {
      throw new Error("cabinet must be an integer 0..8");
    }
    const timeout = options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs };
    const ports = {
      inputPortId: options.inputPortId,
      outputPortId: options.outputPortId,
      ...timeout,
    };
    return this.#withLink(ports, async () => {
      const nudge = options.nudge !== false;
      let nudgedFrom: number | null = null;
      if (nudge) {
        nudgedFrom = options.cabinet === 1 ? 2 : 1;
        await this.writeLiveParam({
          ...ports,
          param: "cabinet",
          value: nudgedFrom,
          handshake: false,
        });
        await sleep(350);
      }
      const ack = await this.writeLiveParam({
        ...ports,
        param: "cabinet",
        value: options.cabinet,
        handshake: false,
      });
      await sleep(350);
      return {
        cabinet: options.cabinet,
        romSlot: cabinetToRomSlot(options.cabinet),
        nudgedFrom,
        ack: { accepted: ack.accepted, rawValue: ack.rawValue },
        observedAtMs: ack.observedAtMs,
      };
    });
  }

  /**
   * High-level IR load: WAV → ROM sector → persist slot → select Cabinet.
   * Defaults: upload slot 7 + Cabinet 8.
   */
  async loadIrFromWav(options: LoadIrFromWavOptions): Promise<CubeBabyLoadIrFromWavResult> {
    const slotIndex = options.slotIndex ?? 7;
    const cabinet = options.cabinet ?? 8;
    const decoded = decodeWavToMonoFloat32(options.wav);
    const samples = prepareIrSamples(decoded.samples, decoded.sampleRate);
    const sector = buildIrRomSector({
      samples,
      volume: options.volume ?? 0.5,
      presence: options.presence ?? "upload",
    });
    const expectedLive = irRomSectorToLivePayload(sector);
    const timeoutMs = options.timeoutMs ?? 5_000;

    const ports = {
      inputPortId: options.inputPortId,
      outputPortId: options.outputPortId,
      timeoutMs,
    };
    return this.#withLink(ports, async () => {
      const persist = await this.persistIrRom({
        ...ports,
        payload: sector,
        slotIndex,
        padSector: true,
      });
      const select = await this.selectCabinet({
        ...ports,
        cabinet,
        nudge: true,
      });
      const live = await this.readMemory({
        ...ports,
        memory: IR_LIVE_MEMORY,
        address: IR_LIVE_DATA_ADDRESS,
        length: 68,
        handshake: false,
      });
      let liveMatchPrefix = 0;
      for (let i = 0; i < 68; i += 1) {
        if (live.data[i] === expectedLive[i]) liveMatchPrefix += 1;
      }
      return {
        slotIndex,
        cabinet,
        romSlot: select.romSlot,
        sectorLength: sector.length,
        persist,
        select,
        liveMatchPrefix,
        liveMatchTotal: 68,
      };
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
