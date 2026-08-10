export class CubeBabyReadTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`CUBE Baby did not answer the read request within ${timeoutMs} ms`);
    this.name = "CubeBabyReadTimeoutError";
  }
}

export class CubeBabyWriteTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`CUBE Baby did not answer the write request within ${timeoutMs} ms`);
    this.name = "CubeBabyWriteTimeoutError";
  }
}

export class CubeBabySessionClosedError extends Error {
  constructor() {
    super("CUBE Baby session is closed");
    this.name = "CubeBabySessionClosedError";
  }
}

export class CubeBabySessionPortMismatchError extends Error {
  constructor() {
    super("CUBE Baby session is open on different MIDI ports");
    this.name = "CubeBabySessionPortMismatchError";
  }
}
