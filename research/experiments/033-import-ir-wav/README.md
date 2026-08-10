# 033 — Import IR WAV → upload ROM → Cabinet load

## Objective

Convert a mono WAV impulse into a ToneHub IR ROM sector, persist it to upload slot 7, select
Cabinet 8, and verify live IR RAM matches the imported image.

## Safety classification

- Mode: mutating upload ROM slot 7 + live Cabinet/IR
- Backup slot 7 before write; restore afterward
- Factory slots untouched

## Environment

- Date: 2026-08-10
- Device: VID `301A`, PID `5555`
- Fixture: `test/fixtures/ir/033-tonehub-impulse.wav` (synthetic PCM16 @ 48 kHz)
- Tooling: `import-ir-wav --persist-rom --cabinet 8`

## Hypothesis

1. WAV → 512 float32 samples → 4096-byte sector (upload presence + volume + samples).
2. After persist + Cabinet 8, live IR at `0x768` matches `irRomSectorToLivePayload(sector)`.

## Procedure

1. Close CubeSuite.
2. Dump/backup slot 7.
3. `import-ir-wav --persist-rom --cabinet 8` (CLI nudges Cabinet via a different value first).
4. Confirm `liveMatch=68/68`; restore backup sector to slot 7; restore Cabinet 8.

## Operator log

| Step | Time (UTC) | Result |
|---|---|---|
| Backup slot 7 | `19:31:26Z` | prior CubeSuite upload image (tail `FF`) |
| Import+persist (no nudge) | `19:31:46Z` | ROM `verified=true`, liveMatch **23/68** (Cabinet already 8) |
| Import+persist with nudge 1→8 | `19:34:37Z` | ROM `verified=true`, liveMatch **68/68** |
| Restore backup + Cabinet 8 | `19:34:56Z` | slot 7 restored, Cabinet returned to 8 |

Artifacts: `backup-slot-7.bin`, `imported-sector.bin`.

## Result

WAV→IR ROM→Cabinet load works end-to-end on the upload slot. Firmware reloads IR RAM only when
the Cabinet value **changes**; the CLI now nudges via an alternate Cabinet before the target.

## Confidence

`confirmed locally` for synthetic PCM16 @ 48 kHz → slot 7 → Cabinet 8 on this firmware.
