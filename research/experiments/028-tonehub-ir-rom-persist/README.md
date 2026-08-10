# 028 — ToneHub IR ROM persist (upload slot)

## Objective

Reproduce CubeSuite’s IR ROM persist path from ToneHub: erase `0x21` at `0x00070000`, chunked
`WriteMemory` (2056 bytes), then verify reads — using the payload extracted from capture 021.

## Safety classification

- Mode: mutating / destructive to the user IR upload slot
- Bytes transmitted: identity + erase `0x21` + ROM `WriteMemory` + verify `ReadMemory`
- Target: memory `0x00` / address `0x00070000` only (upload slot from 021)
- Recovery: re-upload from CubeSuite or re-run with a known-good ROM fixture
- **Not in this experiment:** other cabinet ROM slots / stride map

## Environment

- Date: 2026-08-10
- Device: VID `301A`, PID `5555`
- Fixture: `test/fixtures/ir/021-rom-ir-payload.bin` (2056 bytes)
- Tooling: `pnpm tonehub-midi persist-ir-rom ... --confirm-ir-rom-persist`
- CubeSuite: closed

## Hypothesis

ToneHub can erase + write + verify the upload slot and match the written image on readback.

## Procedure

1. Close CubeSuite.
2. `persist-ir-rom --file test/fixtures/ir/021-rom-ir-payload.bin --confirm-ir-rom-persist --json`.
3. Confirm `verified=true`, erase ACK observed, no live-RAM path required.

## Operator log

- Run (`2026-08-10T18:43:34.377Z`):
  - erase ACK `accepted=false` / `rawValue=0`
  - write chunks `17`, payload `2056`
  - verifyBytes `2056`, **verified=true**
  - target `memory=0` / `0x70000`

## Result

ToneHub can persist the IR upload ROM slot end-to-end (erase → write → verify) using the 021
fixture. Other IR ROM slots / stride remain unconfirmed.

## Confidence

`confirmed locally` for upload slot `0x00070000` on this unit.
