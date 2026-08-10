# 026 — ToneHub bank backup / restore

## Objective

Verify ToneHub can read the 48-byte A+B+C bank to a versioned JSON file and restore that image
to the pedal with verify, without CubeSuite.

## Safety classification

- Backup: read-only (`ReadMemory` bank)
- Restore: mutating (full bank write + live push of one slot’s offsets 0–12)
- Recovery: keep the backup JSON and re-run restore
- Risk: restore overwrites all three stored slots

## Environment

- Date: 2026-08-10
- Device: VID `301A`, PID `5555`
- Tooling: `backup-bank` / `restore-bank`
- CubeSuite: closed

## Hypothesis

1. Backup JSON (`tonehub-cube-baby-bank-v1`) round-trips the exact 48 bank bytes.
2. Restore writes the bank, pushes slot A to live RAM, and verify read matches the file.

## Procedure

1. `backup-bank` to a temp JSON path.
2. Change one stored field with `save-param` (e.g. Volume A +1).
3. `restore-bank` from the backup JSON.
4. Confirm verify=true and Volume A restored.

## Operator log

- Backup (`2026-08-10T18:25:29.389Z`):
  `research/experiments/026-tonehub-bank-backup-restore/backup.json`
  Volume A = `100`
- Mutate: `save-param` Volume A `100→102` verified
- Restore (`2026-08-10T18:25:38.090Z`): `verified=true`, afterHex matches backup,
  `liveAckCount=13`, Volume A back to `100`

## Result

Backup/restore round-trip works on this unit. Format `tonehub-cube-baby-bank-v1` carries
`dataHex` plus decoded slot fields for inspection.

## Confidence

`confirmed locally`.
