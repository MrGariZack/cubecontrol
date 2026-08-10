# 034 — Export IR ROM → WAV (+ round-trip)

## Objective

Export a device IR ROM sector to a mono PCM16 WAV @ 48 kHz, and confirm offline re-import
rebuilds a compatible sector header/samples.

## Safety classification

- Mode: read-only when using `--slot` (`dumpIrRom` only)
- Offline `--file` path transmits nothing

## Environment

- Date: 2026-08-10
- Device: VID `301A`, PID `5555`
- Tooling: `export-ir-wav`, `import-ir-wav --out`

## Hypothesis

1. Primary 512 float32 samples after the 8-byte ROM header round-trip through PCM16 WAV.
2. Factory slot 1 and upload slot 7 both export cleanly (NaN/`FF` tails sanitized).

## Procedure

1. `export-ir-wav --slot 1` and `--slot 7` to `.wav`.
2. Offline: `import-ir-wav --file exported.wav --out rebuilt.bin` and compare headers/samples.
3. Update protocol-status.

## Operator log

| Step | Time (UTC) | Result |
|---|---|---|
| Export slot 1 | `19:39:26Z` | presence `factory`, volume ≈0.69, sanitized=0 |
| Export slot 7 | `19:39:37Z` | presence `upload`, volume 0.5, sanitized=0 |
| Offline round-trip | `19:39:39Z` | PCM16: **512/512** samples within 1/32768; volume close |

Artifacts: `slot-1.wav`, `slot-7.wav`, `rebuilt-slot-1.bin`.

## Result

Export works on-device and offline. Float32→PCM16→float32 loses only quantization noise
(`maxAbsErr ≈ 3.05e-5`). Presence/volume are restored when re-importing with matching flags.

## Confidence

`confirmed locally` for slots 1 and 7 on this firmware.
