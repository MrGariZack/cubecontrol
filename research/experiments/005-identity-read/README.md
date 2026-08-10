# 005 — Read-only identity request

## Objective

Verify that ToneHub can send the exact CubeSuite identity SysEx captured in experiment 003 and
receive a valid identity response from this physical unit.

## Safety classification

- Mode: read-only transmit
- Bytes transmitted: exactly `F0 00 32 45 00 00 00 40 7F F7`
- Recovery plan: close ports; reconnect USB if the device stops enumerating

## Environment

- Date: 2026-08-08
- OS: Windows 11 24H2
- Device: VID `301A`, PID `5555`, WinMM ports `node:input:0` / `node:output:1`
- Command:
  `pnpm tonehub-midi identify --input node:input:0 --output node:output:1 --confirm-read-only --timeout 3000 --json`

## Procedure

1. Confirm the device with `tonehub-midi list`.
2. Send only the identity request reproduced from capture 003.
3. Wait up to 3000 ms for a checksum-valid identity response.
4. Close ports without sending additional messages.

## Data captured

- Response name: `SINCO-CubeBaby`
- Raw name byte length: `19` (includes trailing spaces)
- Unclassified metadata: `01 13 14 15 16 17 18 19`
- Observed at: `2026-08-08T20:04:52.870Z`

## Changed bytes

None. This operation does not write device memory.

## Hypothesis

The captured identity request is sufficient by itself; CubeSuite's later memory reads are not
required for identity.

## Result

Confirmed. The device answered with the same identity content observed in the CubeSuite startup
capture.

## Confidence

`confirmed locally`.
