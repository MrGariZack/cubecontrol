# 024 — ToneHub live WriteMemory (Gain)

## Objective

Verify that ToneHub can send a captured-shape one-byte `WriteMemory` (`0x22`) to live Gain
(`memory=5`, `address=0x80000001`) and receive the expected device ACK, without touching the
stored 48-byte bank.

## Safety classification

- Mode: mutating (live RAM only; no Save / bank write / erase / IR)
- Bytes transmitted: identity handshake + one-byte `WriteMemory` (+ restore write)
- Recovery: rewrite Gain to the pre-experiment value (from stored bank slot A / operator note)
- Bank at `0x00000000` must remain unchanged (verify with read-only bank read)

## Environment

- Date: 2026-08-10
- Device: VID `301A`, PID `5555`
- Tooling: `pnpm tonehub-midi write-memory ... --confirm-write`
- CubeSuite: closed

## Hypothesis

1. ToneHub’s encoded write matches CubeSuite’s Gain write shape.
2. Device answers with `ACK` content `00` (`accepted=false`) while the live change still applies.
3. Stored bank 48 bytes are unchanged until Save (not sent here).

## Procedure

1. Close CubeSuite.
2. Baseline bank read (`--decode`) — record slot A Gain.
3. Write live Gain to a different value (e.g. `7`).
4. Restore live Gain to baseline value.
5. Re-read bank — must be byte-identical to baseline.

## Operator log

- Baseline bank (`2026-08-10T18:10:07.429Z`):
  `05030306056405070808010101000000050304064173185008080101010000000600030a59440b0a0805010101000000`
  - Slot A Gain = `3`
- Write Gain=`7` (`2026-08-10T18:10:08.979Z`): ACK `accepted=false` `rawValue=0`
- Restore Gain=`3` (`2026-08-10T18:10:10.581Z`): ACK `accepted=false` `rawValue=0`
- After bank (`2026-08-10T18:10:12.080Z`): identical 48-byte hex (bank untouched)

## Result

ToneHub live `WriteMemory` for Gain works:
- Encoder matches the physical CubeSuite capture shape (unit test byte-for-byte for value `5`).
- Device ACK behavior matches CubeSuite (`accepted=false`).
- Stored bank was not modified (no Save issued).

CLI guardrails for this milestone: `--confirm-write`, memory `5` only, address window
`0x80000000`–`0x8000000c`, single-byte data only.

## Confidence

`confirmed locally` for Gain live write + ACK + bank isolation on this unit.
