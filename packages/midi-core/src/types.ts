export type MidiPortDirection = "input" | "output";
export type MidiPortState = "connected" | "disconnected";

export interface MidiPort {
  readonly id: string;
  readonly direction: MidiPortDirection;
  readonly name: string;
  readonly manufacturer?: string;
  readonly state: MidiPortState;
  readonly vendorId?: number;
  readonly productId?: number;
}

export interface MidiChunk {
  readonly portId: string;
  readonly data: Uint8Array;
  readonly receivedAtMs: number;
}

export interface MidiInputConnection {
  readonly port: MidiPort;
  close(): Promise<void>;
}

export interface MidiOutputConnection {
  readonly port: MidiPort;
  send(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

export interface MidiTransport {
  listPorts(): Promise<readonly MidiPort[]>;
  openInput(portId: string, onChunk: (chunk: MidiChunk) => void): Promise<MidiInputConnection>;
  openOutput(portId: string): Promise<MidiOutputConnection>;
  onPortsChanged(listener: () => void): () => void;
  dispose(): Promise<void>;
}
