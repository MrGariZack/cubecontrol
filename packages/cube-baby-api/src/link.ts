import { decodeCubeBabyMessage, type CubeBabyMessage } from "@tonehub/cube-baby-protocol";
import {
  MidiMessageAssembler,
  type MidiInputConnection,
  type MidiOutputConnection,
  type MidiTransport,
} from "@tonehub/midi-core";
import { CubeBabySessionClosedError } from "./errors.js";

export interface CubeBabyLinkPorts {
  readonly inputPortId: string;
  readonly outputPortId: string;
}

export interface CubeBabyExchangeOptions<T> {
  readonly request: Uint8Array;
  readonly timeoutMs: number;
  readonly timeoutError: Error;
  /** Optional prelude (e.g. identity handshake) before the request. */
  readonly beforeSend?: () => Promise<void>;
  /**
   * Return a value to complete the exchange, or `undefined` to keep waiting
   * (unrelated / malformed traffic is ignored).
   */
  readonly match: (message: CubeBabyMessage, receivedAtMs: number) => T | undefined;
}

/**
 * Persistent MIDI input/output pair with a serialized request queue and one SysEx assembler.
 */
export class CubeBabyLink {
  #input: MidiInputConnection;
  #output: MidiOutputConnection;
  #assembler: MidiMessageAssembler;
  #queue: Promise<unknown> = Promise.resolve();
  #closed = false;
  #pending:
    | {
        match: CubeBabyExchangeOptions<unknown>["match"];
        resolve: (value: unknown) => void;
      }
    | undefined;

  readonly ports: CubeBabyLinkPorts;

  private constructor(
    ports: CubeBabyLinkPorts,
    input: MidiInputConnection,
    output: MidiOutputConnection,
  ) {
    this.ports = ports;
    this.#input = input;
    this.#output = output;
    this.#assembler = new MidiMessageAssembler((assembled) => {
      const pending = this.#pending;
      if (pending === undefined) return;
      try {
        const message = decodeCubeBabyMessage(assembled.data);
        const value = pending.match(message, assembled.receivedAtMs);
        if (value !== undefined) {
          this.#pending = undefined;
          pending.resolve(value);
        }
      } catch {
        // Ignore unrelated or malformed MIDI while waiting.
      }
    });
  }

  static async open(transport: MidiTransport, ports: CubeBabyLinkPorts): Promise<CubeBabyLink> {
    let link: CubeBabyLink | undefined;
    const input = await transport.openInput(ports.inputPortId, (chunk) => {
      if (link === undefined) return;
      link.#assembler.push(chunk.data, chunk.receivedAtMs);
    });
    try {
      const output = await transport.openOutput(ports.outputPortId);
      link = new CubeBabyLink(ports, input, output);
      return link;
    } catch (error) {
      await input.close();
      throw error;
    }
  }

  get closed(): boolean {
    return this.#closed;
  }

  samePorts(ports: CubeBabyLinkPorts): boolean {
    return (
      this.ports.inputPortId === ports.inputPortId && this.ports.outputPortId === ports.outputPortId
    );
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    this.#pending = undefined;
    await Promise.all([this.#input.close(), this.#output.close()]);
  }

  /** Serialize work on this link (one exchange / multi-step op at a time). */
  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    if (this.#closed) throw new CubeBabySessionClosedError();
    const previous = this.#queue;
    let release!: () => void;
    this.#queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous.then(
      () => undefined,
      () => undefined,
    );
    try {
      if (this.#closed) throw new CubeBabySessionClosedError();
      return await fn();
    } finally {
      release();
    }
  }

  async send(data: Uint8Array): Promise<void> {
    if (this.#closed) throw new CubeBabySessionClosedError();
    await this.#output.send(data);
  }

  async exchange<T>(options: CubeBabyExchangeOptions<T>): Promise<T> {
    return this.runExclusive(() => this.#exchangeUnlocked(options));
  }

  /** Like `exchange`, but caller already holds `runExclusive`. */
  async exchangeUnlocked<T>(options: CubeBabyExchangeOptions<T>): Promise<T> {
    return this.#exchangeUnlocked(options);
  }

  async #exchangeUnlocked<T>(options: CubeBabyExchangeOptions<T>): Promise<T> {
    if (this.#closed) throw new CubeBabySessionClosedError();
    if (this.#pending !== undefined) {
      throw new Error("CUBE Baby link exchange already in progress");
    }

    let settle!: (value: T) => void;
    const response = new Promise<T>((resolve) => {
      settle = resolve;
    });
    this.#pending = {
      match: options.match as CubeBabyExchangeOptions<unknown>["match"],
      resolve: (value) => settle(value as T),
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (options.beforeSend !== undefined) {
        await options.beforeSend();
      }
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(options.timeoutError), options.timeoutMs);
      });
      await this.#output.send(options.request);
      return await Promise.race([response, timeout]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      this.#pending = undefined;
    }
  }
}
