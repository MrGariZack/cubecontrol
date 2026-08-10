import { loadMidiMessages } from "../capture-file.js";

interface ByteDifference {
  readonly offset: number;
  readonly left: number | null;
  readonly right: number | null;
}

interface MessageDifference {
  readonly messageIndex: number;
  readonly leftLength: number;
  readonly rightLength: number;
  readonly bytes: readonly ByteDifference[];
}

export interface CompareOptions {
  readonly json?: boolean;
}

function compareMessage(
  messageIndex: number,
  left: Uint8Array,
  right: Uint8Array,
): MessageDifference | undefined {
  const bytes: ByteDifference[] = [];
  const length = Math.max(left.length, right.length);
  for (let offset = 0; offset < length; offset += 1) {
    const leftByte = left[offset] ?? null;
    const rightByte = right[offset] ?? null;
    if (leftByte !== rightByte) bytes.push({ offset, left: leftByte, right: rightByte });
  }
  if (bytes.length === 0) return undefined;
  return { messageIndex, leftLength: left.length, rightLength: right.length, bytes };
}

const byteLabel = (value: number | null): string =>
  value === null ? "--" : value.toString(16).padStart(2, "0");

export async function compareCommand(
  leftFile: string,
  rightFile: string,
  options: CompareOptions,
): Promise<void> {
  const [leftMessages, rightMessages] = await Promise.all([
    loadMidiMessages(leftFile),
    loadMidiMessages(rightFile),
  ]);
  const differences: MessageDifference[] = [];
  const messageCount = Math.max(leftMessages.length, rightMessages.length);
  for (let index = 0; index < messageCount; index += 1) {
    const difference = compareMessage(
      index,
      leftMessages[index] ?? new Uint8Array(),
      rightMessages[index] ?? new Uint8Array(),
    );
    if (difference) differences.push(difference);
  }

  const result = {
    equal: differences.length === 0,
    leftMessageCount: leftMessages.length,
    rightMessageCount: rightMessages.length,
    differences,
  };
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Messages: left=${leftMessages.length}, right=${rightMessages.length}`);
  if (differences.length === 0) {
    console.log("Captures are byte-for-byte equal.");
    return;
  }
  for (const difference of differences) {
    console.log(
      `Message #${difference.messageIndex}: ${difference.leftLength} -> ${difference.rightLength} bytes`,
    );
    for (const byte of difference.bytes) {
      console.log(`  offset ${byte.offset}: ${byteLabel(byte.left)} -> ${byteLabel(byte.right)}`);
    }
  }
}
