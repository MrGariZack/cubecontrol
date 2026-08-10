# 035 — One-shot `load-ir` (WAV → upload → Cabinet)

## Objective

Validate the convenience command that backs up (optional), persists a WAV-derived IR to the
upload ROM slot, and selects Cabinet 8 so the pedal loads it into IR RAM.

## Safety classification

- Mode: mutating upload slot 7 + live Cabinet
- Optional `--backup` dump before overwrite; restore from backup after the run
- Factory slots still require `--confirm-overwrite-cabinet`

## Environment

- Date: 2026-08-10
- Device: VID `301A`, PID `5555`
- Fixture: `test/fixtures/ir/033-tonehub-impulse.wav`
- Tooling: `pnpm tonehub-midi load-ir ... --confirm-load`

## Hypothesis

`load-ir --confirm-load` equals `import-ir-wav --persist-rom --slot 7 --cabinet 8` with a single
confirm flag, and reports `liveMatch=68/68` after the Cabinet nudge.

## Procedure

1. Close CubeSuite.
2. `load-ir --backup … --confirm-load --json`.
3. Confirm persist verified + liveMatch perfect.
4. Restore backup sector to slot 7; Cabinet back to 8.

## Operator log

| Step | Time (UTC) | Result |
|---|---|---|
| load-ir | `19:41:48Z` | backup written; persist `verified=true`; **liveMatch=68/68** |
| Restore slot 7 + Cabinet 8 | `19:42:07Z` | previous upload image restored |

Artifacts: `backup-slot-7.bin`, `loaded-sector.bin`.

## Result

One-shot load path works. Defaults (slot 7 / Cabinet 8 / upload presence) are correct for
user IR loading on this unit.

## Confidence

`confirmed locally`.
