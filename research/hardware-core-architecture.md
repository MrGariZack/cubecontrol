# Hardware core architecture

## Dependency direction

```text
Application
  -> @tonehub/cube-baby-api
    -> @tonehub/cube-baby-protocol
      -> @tonehub/midi-core
        <- platform transport adapters
```

`midi-core` owns platform-neutral ports, chunks, connections, errors, USB-MIDI event decoding, and
MIDI byte-stream assembly. It knows the confirmed USB identifiers only for classification; it
does not know the proprietary protocol.

`midi-transport-node` owns RtMidi and optional Windows PnP enrichment.

Mobile / non-Node adapters (no Node imports):
- `@tonehub/midi-transport-web` — Web MIDI API (browser / WebView).
- `@tonehub/midi-transport-native` — `NativeMidiTransport` over a `NativeMidiHost` bridge
  (Android `MidiManager` / iOS CoreMIDI plugins supply the host).

`cube-baby-protocol` is pure TypeScript. It owns 7-bit packing, envelopes, checksum, message
codecs, preset/IR layout helpers, live-param map, and WAV↔IR conversion. It does not open MIDI
ports.

`cube-baby-api` owns device operations over `MidiTransport`: identity, memory R/W, bank
save/restore, IR live/ROM, and high-level helpers (`writeLiveParam`, `selectCabinet`,
`loadIrFromWav`, `readPresetBank`). Callers gate destructive use; the API itself is not a UI.

## Callback boundary

Native MIDI callbacks are chunks, not messages. `MidiMessageAssembler` reconstructs SysEx across
callbacks and emits Real-Time bytes separately. This is validated by the physical USB capture,
where one device response spans two USB transfers.

## Current safety boundary

- Passive: `list`, `monitor`, `capture`, `decode`, `compare`.
- Read-only with explicit confirmation: `identify`, `read-memory` (optional `--decode` for
  the 48-byte A+B+C bank).
- Mutating with explicit confirmation:
  - `write-memory` for single-byte live params (`memory=5`, `0x80000000`–`0x8000000c`)
  - `save-param` for CubeSuite Save path (live + full 48-byte bank + verify)
  - `restore-bank` for full A+B+C bank images (`backup-bank` is read-only)
  - `apply-live-ir` for IR live RAM (`memory=4`)
  - `persist-ir-rom --slot 0..7` for ROM persist (`0x69000 + slot×0x1000`; default slot 7;
    2056→4096 zero-pad by default; `--no-pad-sector` for CubeSuite FF-tail)
  - `scan-ir-rom` / `dump-ir-rom` for read-only IR ROM headers / full 4096 B sectors
  - `probe-cabinet-ir` for live Cabinet→IR RAM/ROM correlation
  - `import-ir-wav` / `export-ir-wav` for WAV↔IR sector conversion (+ optional persist/apply/Cabinet)
  - `load-ir` one-shot WAV → ROM slot (default 7) → Cabinet (default 8)
- Not implemented: firmware flash; product UI; native Android/iOS plugin binaries (TS host contract exists).

## Library roadmap (step-by-step)

1. **Done:** high-level API surface on `@tonehub/cube-baby-api` + docs sync.
2. **Done:** `CubeBabySession` / `CubeBabyLink` (open ports once, serialize requests).
3. **Done:** `FakeCubeBabyTransport` + API integration tests (bank / live / IR / session).
4. **Done:** `@tonehub/midi-transport-web` + `@tonehub/midi-transport-native` (host contract).
5. **Product (separate repo):** `../tonehub-app` — Expo/TypeScript UI + native MIDI plugins.
   Consumes this core via pnpm workspace link; does not reimplement protocol.
