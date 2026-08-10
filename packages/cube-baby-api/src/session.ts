import type { MidiTransport } from "@tonehub/midi-core";
import { CubeBabyClient } from "./client.js";
import type { CubeBabyLinkPorts } from "./link.js";
import type {
  ApplyLiveIrOptions,
  DumpIrRomOptions,
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

type Ports = CubeBabyLinkPorts;

/**
 * Long-lived CUBE Baby session: one MIDI input/output pair, serialized requests.
 * Prefer this over constructing ad-hoc `CubeBabyClient` calls in application code.
 */
export class CubeBabySession {
  private constructor(
    private readonly client: CubeBabyClient,
    private readonly ports: Ports,
  ) {}

  static async open(transport: MidiTransport, ports: Ports): Promise<CubeBabySession> {
    const client = new CubeBabyClient(transport);
    await client.connect(ports);
    return new CubeBabySession(client, ports);
  }

  get connected(): boolean {
    return this.client.connected;
  }

  async close(): Promise<void> {
    await this.client.disconnect();
  }

  identify(options: Omit<IdentifyCubeBabyOptions, "inputPortId" | "outputPortId"> = {}) {
    return this.client.identify({ ...this.ports, ...options });
  }

  readMemory(options: Omit<ReadCubeBabyMemoryOptions, "inputPortId" | "outputPortId">) {
    return this.client.readMemory({ ...this.ports, ...options });
  }

  writeMemory(options: Omit<WriteCubeBabyMemoryOptions, "inputPortId" | "outputPortId">) {
    return this.client.writeMemory({ ...this.ports, ...options });
  }

  writeRegister(options: Omit<WriteCubeBabyRegisterOptions, "inputPortId" | "outputPortId">) {
    return this.client.writeRegister({ ...this.ports, ...options });
  }

  saveParam(options: Omit<SaveCubeBabyParamOptions, "inputPortId" | "outputPortId">) {
    return this.client.saveParam({ ...this.ports, ...options });
  }

  restoreBank(options: Omit<RestoreCubeBabyBankOptions, "inputPortId" | "outputPortId">) {
    return this.client.restoreBank({ ...this.ports, ...options });
  }

  applyLiveIr(options: Omit<ApplyLiveIrOptions, "inputPortId" | "outputPortId">) {
    return this.client.applyLiveIr({ ...this.ports, ...options });
  }

  dumpIrRom(options: Omit<DumpIrRomOptions, "inputPortId" | "outputPortId">) {
    return this.client.dumpIrRom({ ...this.ports, ...options });
  }

  persistIrRom(options: Omit<PersistIrRomOptions, "inputPortId" | "outputPortId">) {
    return this.client.persistIrRom({ ...this.ports, ...options });
  }

  readPresetBank(options: { readonly timeoutMs?: number } = {}) {
    return this.client.readPresetBank({ ...this.ports, ...options });
  }

  writeLiveParam(options: Omit<WriteLiveParamOptions, "inputPortId" | "outputPortId">) {
    return this.client.writeLiveParam({ ...this.ports, ...options });
  }

  selectCabinet(options: Omit<SelectCabinetOptions, "inputPortId" | "outputPortId">) {
    return this.client.selectCabinet({ ...this.ports, ...options });
  }

  loadIrFromWav(options: Omit<LoadIrFromWavOptions, "inputPortId" | "outputPortId">) {
    return this.client.loadIrFromWav({ ...this.ports, ...options });
  }
}
