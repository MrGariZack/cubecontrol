import { describe, expect, it } from "vitest";
import { MidiMessageAssembler } from "./message-assembler.js";

describe("MidiMessageAssembler", () => {
  it("reassembles fragmented SysEx", () => {
    const messages: number[][] = [];
    const assembler = new MidiMessageAssembler((message) => {
      messages.push([...message.data]);
    });

    assembler.push(Uint8Array.of(0xf0, 0x00, 0x32), 1);
    assembler.push(Uint8Array.of(0x01, 0xf7), 2);

    expect(messages).toEqual([[0xf0, 0x00, 0x32, 0x01, 0xf7]]);
  });

  it("emits real-time bytes separately inside SysEx", () => {
    const messages: number[][] = [];
    const assembler = new MidiMessageAssembler((message) => {
      messages.push([...message.data]);
    });

    assembler.push(Uint8Array.of(0xf0, 0x01, 0xf8, 0x02, 0xf7), 1);

    expect(messages).toEqual([[0xf8], [0xf0, 0x01, 0x02, 0xf7]]);
  });

  it("supports channel running status", () => {
    const messages: number[][] = [];
    const assembler = new MidiMessageAssembler((message) => {
      messages.push([...message.data]);
    });

    assembler.push(Uint8Array.of(0x90, 60, 100, 61, 101), 1);

    expect(messages).toEqual([
      [0x90, 60, 100],
      [0x90, 61, 101],
    ]);
  });
});
