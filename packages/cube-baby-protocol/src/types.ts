export interface CubeBabyEnvelope {
  readonly messageType: number;
  readonly declaredContentLength: number;
  readonly content: Uint8Array;
  readonly checksum: number;
  readonly checksumValid: boolean;
  readonly clearPayload: Uint8Array;
  readonly encodedPayload: Uint8Array;
}

export type CubeBabyMessage =
  | {
      readonly kind: "identity-request";
      readonly envelope: CubeBabyEnvelope;
    }
  | {
      readonly kind: "identity-response";
      readonly envelope: CubeBabyEnvelope;
      readonly name: string;
      readonly nameByteLength: number;
      readonly metadata: Uint8Array;
    }
  | {
      readonly kind: "memory-read-request";
      readonly envelope: CubeBabyEnvelope;
      readonly memory: number;
      readonly address: number;
      readonly length: number;
    }
  | {
      readonly kind: "memory-read-response";
      readonly envelope: CubeBabyEnvelope;
      readonly memory: number;
      readonly address: number;
      readonly length: number;
      readonly data: Uint8Array;
    }
  | {
      readonly kind: "memory-write-request";
      readonly envelope: CubeBabyEnvelope;
      readonly memory: number;
      readonly address: number;
      readonly length: number;
      readonly data: Uint8Array;
    }
  | {
      readonly kind: "ack";
      readonly envelope: CubeBabyEnvelope;
      readonly accepted: boolean;
      readonly rawValue: number;
    }
  | {
      readonly kind: "erase-request";
      readonly envelope: CubeBabyEnvelope;
      readonly memory: number;
      readonly address: number;
    }
  | {
      readonly kind: "register-write-request";
      readonly envelope: CubeBabyEnvelope;
      readonly memory: number;
      readonly address: number;
      readonly value: number;
    }
  | {
      readonly kind: "unknown";
      readonly envelope: CubeBabyEnvelope;
    };
