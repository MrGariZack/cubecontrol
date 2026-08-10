/**
 * Platform bridge that Android (MidiManager) / iOS (CoreMIDI) plugins must implement.
 * Keep native code out of this package — only the host contract lives here.
 */
export interface NativeMidiPortInfo {
  readonly id: string;
  readonly direction: "input" | "output";
  readonly name: string;
  readonly manufacturer?: string;
  readonly vendorId?: number;
  readonly productId?: number;
  readonly state?: "connected" | "disconnected";
}

export interface NativeMidiInputHandle {
  close(): Promise<void>;
}

export interface NativeMidiOutputHandle {
  send(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

export interface NativeMidiHost {
  listPorts(): Promise<readonly NativeMidiPortInfo[]>;
  openInput(
    portId: string,
    onBytes: (data: Uint8Array, receivedAtMs: number) => void,
  ): Promise<NativeMidiInputHandle>;
  openOutput(portId: string): Promise<NativeMidiOutputHandle>;
  onPortsChanged(listener: () => void): () => void;
  dispose(): Promise<void>;
}
