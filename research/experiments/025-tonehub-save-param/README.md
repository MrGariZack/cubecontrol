# 025 — ToneHub Save path (live + bank + verify)

## Objective

Reproduce CubeSuite’s Save sequence from ToneHub: one-byte live write, full 48-byte bank
write at `memory=5` / `address=0x00000000`, then verify read — and restore the original bank.

## Safety classification

- Mode: mutating (persists storage)
- Bytes transmitted: identity handshakes + live `WriteMemory` + 48-byte bank `WriteMemory` +
  `ReadMemory` verify (change + restore)
- Recovery: rewrite original value via the same Save path
- Risk: one bank write rewrites slots A+B+C (only one byte intentionally patched)

## Environment

- Date: 2026-08-10
- Device: VID `301A`, PID `5555`
- Tooling: `pnpm tonehub-midi save-param ... --confirm-save`
- CubeSuite: closed

## Hypothesis

ToneHub can persist a single parameter change using the same three-step path as experiment 020,
and can restore the prior bank image the same way.

## Procedure

1. Close CubeSuite.
2. Baseline bank read (via save-param’s internal read).
3. `save-param` slot A offset `5` (Volume) to baseline+1.
4. Verify bank reflects the change; B/C unchanged.
5. `save-param` restore Volume A to baseline.
6. Verify bank matches original baseline hex.

## Operator log

- Normalize restore `101→100` (`2026-08-10T18:21:57.563Z`): verified (cleanup from prior probe)
- Change `100→101` (`2026-08-10T18:22:00.513Z`): verified; B/C volumes unchanged (`115` / `68`)
- Restore `101→100` (`2026-08-10T18:22:03.464Z`): verified
- Final bank Volume A = `100`
- Live + bank ACKs: `accepted=false` / `rawValue=0` (matches CubeSuite)

## Encoding fix discovered during this experiment

Some live writes (e.g. Volume=`100`) were ignored until `encodeSevenBit` padded the packed
payload to `ceil(clearLength * 8 / 7)` septets with trailing `0x00`, matching CubeSuite captures.
Without that pad, decode still succeeded locally but the pedal returned no ACK.

## Result

ToneHub Save path works end-to-end:
1. live one-byte `WriteMemory` at `0x80000000+offset`
2. full 48-byte bank `WriteMemory` at `0x00000000`
3. verify `ReadMemory` of the bank

CLI: `save-param --slot A|B|C --offset 0..12 --value <byte> --confirm-save`.

## Confidence

`confirmed locally` for Volume slot A on this unit, including restore.
