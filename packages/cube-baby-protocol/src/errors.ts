export class CubeBabyDecodeError extends Error {
  constructor(
    message: string,
    readonly code: "invalid-markers" | "payload-too-short" | "invalid-magic" | "length-mismatch",
  ) {
    super(message);
    this.name = "CubeBabyDecodeError";
  }
}
