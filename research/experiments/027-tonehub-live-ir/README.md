# 027 — ToneHub live IR apply (RAM only)

## Objective

Replay CubeSuite’s live IR RAM sequence from ToneHub using the captured 2052-byte payload at
memory `0x04` / `0x768`, without erase (`0x21`) or ROM writes at `0x00070000`.

## Safety classification

- Mode: mutating live IR RAM only
- Bytes transmitted: identity handshakes + flag/chunk `WriteMemory` (`0x22`) + register writes
  (`0x24`) on selector `0x04`
- **Not transmitted:** erase `0x21`, ROM `0x00070000` writes
- Recovery: reboot or re-apply factory IR from CubeSuite (ROM untouched)

## Environment

- Date: 2026-08-10
- Device: VID `301A`, PID `5555`
- Fixture: `test/fixtures/ir/021-live-ir-payload.bin` (2052 bytes from capture 021 @ `0x768+`)
- Tooling: `pnpm tonehub-midi apply-live-ir ... --confirm-live-ir`
- CubeSuite: closed

## Hypothesis

ToneHub can apply the captured live IR block and receive ACKs matching experiment 021
(`0x22` → accepted=false, `0x24` → accepted=true).

## Procedure

1. Close CubeSuite.
2. Apply fixture with `apply-live-ir --confirm-live-ir --json`.
3. Record ACK summary; confirm `eraseSent=false` / `romPersist=false`.

## Operator log

- Run (`2026-08-10T18:33:30.395Z`):
  - payloadLength `2052`, distance `0.5`, chunks `17`
  - flag off/on `WriteMemory` ACK `accepted=false`
  - three `0x24` register ACKs `accepted=true` (flag addr, length 2052, flag addr)
  - `romPersist=false`, `eraseSent=false`

## Result

ToneHub live IR apply works on this unit. Sequence matches capture 021 phase 1.
ROM persist remains blocked / unimplemented.

## Confidence

`confirmed locally` for live RAM replay of the 021 fixture.
