# ToneHub Hardware Core

USB-MIDI protocol library and CLI for the M-VAVE/Cuvave **CUBE Baby**.  
No product UI here — that is **CubeControl**: [cubecontrol-app](https://github.com/MrGariZack/cubecontrol-app).

| | |
|--|--|
| **This repo** | https://github.com/MrGariZack/cubecontrol |
| **Desktop app** | https://github.com/MrGariZack/cubecontrol-app |
| **Version** | `0.1.0` — [`CHANGELOG.md`](CHANGELOG.md) |
| **License** | MIT — [`LICENSE`](LICENSE) |

This repository intentionally contains no application UI, backend, authentication, marketplace,
or community features.

## Safety boundary

The diagnostic CLI is passive by default. Unknown or destructive SysEx commands must not be
transmitted without explicit `--confirm-*` flags. Use at your own risk; not affiliated with M-VAVE.

## Requirements

- Node.js 22 or newer
- pnpm 10
- A class-compliant USB-MIDI device

## Commands

```sh
pnpm install
pnpm check
pnpm build
pnpm tonehub-midi list
pnpm tonehub-midi monitor --input node:input:0
pnpm tonehub-midi capture ./captures/session.jsonl --input node:input:0
pnpm tonehub-midi decode test/fixtures/captures/003-cubesuite-startup.jsonl
pnpm tonehub-midi compare capture-a.jsonl capture-b.jsonl
```

Local protocol lab notes and USB captures live under `research/` on your machine and are
**gitignored** — this repo ships the library, CLI, and fixtures only.

Transmitting commands require explicit confirmation flags. Identity and ReadMemory are allowed:

```sh
pnpm tonehub-midi identify \
  --input node:input:0 \
  --output node:output:1 \
  --confirm-read-only

pnpm tonehub-midi read-memory \
  --input node:input:0 \
  --output node:output:1 \
  --memory 5 \
  --address 0x00000000 \
  --length 48 \
  --confirm-read-only \
  --decode
```

Live single-byte writes (approved window only) require `--confirm-write`:

```sh
pnpm tonehub-midi write-memory \
  --input node:input:0 \
  --output node:output:1 \
  --memory 5 \
  --address 0x80000001 \
  --data 7 \
  --confirm-write
```

Persist one preset field (rewrites the full A+B+C bank image) with `--confirm-save`:

```sh
pnpm tonehub-midi save-param \
  --input node:input:0 \
  --output node:output:1 \
  --slot A \
  --offset 5 \
  --value 101 \
  --confirm-save
```

Backup / restore the full A+B+C bank:

```sh
pnpm tonehub-midi backup-bank \
  --input node:input:0 \
  --output node:output:1 \
  --file presets/my-bank.json \
  --confirm-read-only

pnpm tonehub-midi restore-bank \
  --input node:input:0 \
  --output node:output:1 \
  --file presets/my-bank.json \
  --confirm-restore
```

Apply a captured live IR block to RAM only (does not persist to ROM):

```sh
pnpm tonehub-midi apply-live-ir \
  --input node:input:0 \
  --output node:output:1 \
  --file test/fixtures/ir/021-live-ir-payload.bin \
  --confirm-live-ir
```

Persist an IR to a ROM slot (default slot 7 / `0x00070000`; 2056 B zero-padded to 4096):

```sh
pnpm tonehub-midi persist-ir-rom \
  --input node:input:0 \
  --output node:output:1 \
  --file test/fixtures/ir/021-rom-ir-payload.bin \
  --slot 7 \
  --confirm-ir-rom-persist
```

Factory cabinets (`--slot 0..6`) also need `--confirm-overwrite-cabinet`. Pass a 4096-byte
dump to restore a sector exactly. Use `--no-pad-sector` only to reproduce CubeSuite’s FF tail.

Scan IR ROM slot headers (read-only; stride `0x1000`, base `0x69000`):

```sh
pnpm tonehub-midi scan-ir-rom \
  --input node:input:0 \
  --output node:output:1 \
  --confirm-read-only --json
```

Dump one full IR ROM sector (4096 bytes; slots `0..7`, or `8` sentinel):

```sh
pnpm tonehub-midi dump-ir-rom \
  --input node:input:0 \
  --output node:output:1 \
  --slot 7 \
  --file ./slot-7.bin \
  --confirm-read-only --json
```

Probe live Cabinet → IR ROM mapping (restores Cabinet from bank A afterward):

```sh
pnpm tonehub-midi probe-cabinet-ir \
  --input node:input:0 \
  --output node:output:1 \
  --confirm-write --json
```

Cabinet `1..8` loads ROM slot `Cabinet-1`; Cabinet `0` does not reload IR RAM.

Convert a WAV impulse to an IR sector (optional ROM persist + Cabinet select):

```sh
pnpm tonehub-midi import-ir-wav \
  --file test/fixtures/ir/033-tonehub-impulse.wav \
  --out ./imported-sector.bin \
  --input node:input:0 \
  --output node:output:1 \
  --slot 7 \
  --persist-rom \
  --cabinet 8 \
  --confirm-ir-rom-persist \
  --confirm-write \
  --json
```

Export a ROM slot (or local sector `.bin`) to WAV:

```sh
pnpm tonehub-midi export-ir-wav \
  --input node:input:0 \
  --output node:output:1 \
  --slot 1 \
  --out ./slot-1.wav \
  --confirm-read-only --json
```

One-shot load (WAV → upload slot 7 → Cabinet 8):

```sh
pnpm tonehub-midi load-ir \
  --input node:input:0 \
  --output node:output:1 \
  --file test/fixtures/ir/033-tonehub-impulse.wav \
  --backup ./backup-slot-7.bin \
  --confirm-load --json
```

## Packages

- `@tonehub/midi-core`: platform-neutral contracts and MIDI stream assembly.
- `@tonehub/midi-transport-node`: desktop transport backed by RtMidi.
- `@tonehub/midi-transport-web`: Web MIDI API transport (browser / WebView).
- `@tonehub/midi-transport-native`: `MidiTransport` over an Android/CoreMIDI host bridge.
- `@tonehub/cube-baby-protocol`: pure SysEx codec + preset/IR helpers.
- `@tonehub/cube-baby-api`: device operations + session (`CubeBabySession`).
- `@tonehub/midi-cli`: diagnostic command-line application.

## Product UI

Application UI (**CubeControl**) lives in the sibling repo `../tonehub-app`.  
Open-core / cloud boundary for the product: `../tonehub-app/docs/open-core.md`.
