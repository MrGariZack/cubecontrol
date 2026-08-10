# `@tonehub/cube-baby-api`

High-level CUBE Baby operations over a `MidiTransport`.

## Session (preferred for apps)

```ts
const session = await CubeBabySession.open(transport, {
  inputPortId: "node:input:0",
  outputPortId: "node:output:1",
});
try {
  await session.identify();
  await session.writeLiveParam({ param: "gain", value: 4 });
  await session.loadIrFromWav({ wav });
} finally {
  await session.close();
}
```

One MIDI input/output pair stays open; requests are serialized on a single SysEx assembler.
Multi-step ops (`dumpIrRom`, `persistIrRom`, `loadIrFromWav`, …) reuse that link.

`CubeBabyClient` remains available for one-shot CLI calls (`connect()` / `disconnect()` optional).

## Low-level (protocol plumbing)

`identify`, `readMemory`, `writeMemory`, `eraseMemory`, `writeRegister`, `saveParam`,
`restoreBank`, `applyLiveIr`, `dumpIrRom`, `persistIrRom`.

## High-level

| Method | Purpose |
|---|---|
| `readPresetBank` | Decode A+B+C bank |
| `writeLiveParam` | Set a live field by name (`gain`, `cabinet`, …) or offset |
| `selectCabinet` | Set Cabinet with IR-RAM reload nudge |
| `loadIrFromWav` | WAV → ROM slot → Cabinet (default upload 7 / Cabinet 8) |

## Testing without hardware

```ts
import { FakeCubeBabyTransport, FAKE_INPUT, FAKE_OUTPUT } from "@tonehub/cube-baby-api/testing";

const transport = new FakeCubeBabyTransport();
const client = new CubeBabyClient(transport);
await client.readPresetBank({
  inputPortId: FAKE_INPUT.id,
  outputPortId: FAKE_OUTPUT.id,
});
```

`FakeCubeBabyTransport` answers identity, memory R/W, erase, and register ACKs in-process.

## Safety

This package does **not** enforce CLI confirm flags. Callers (CLI, UI) must gate destructive
ops. Prefer session + high-level methods instead of raw address writes when possible.
