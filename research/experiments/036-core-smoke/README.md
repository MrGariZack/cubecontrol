# 036 — Core freeze smoke (post-session/API)

## Hypothesis

After freezing the library milestone (`CubeBabySession` / high-level API / fake transport /
web+native adapters), the physical CLI path still works end-to-end:
identify → bank read → live write → load-ir → restore IR.

## Safety

- Ports: `node:input:0` / `node:output:1` (CUBE Baby confirmed).
- Live Gain written to `7` then restored to bank slot A value `3`.
- Slot 7 backed up before `load-ir`; restored with `persist-ir-rom` after.
- Cabinet nudged `1` → `8` after IR restore.

## Log (2026-08-10)

| Step | Result |
|---|---|
| identify | `SINCO-CubeBaby` OK |
| read-memory bank 48 B + decode | A/B/C decoded; A gain=3, cabinet=8 |
| write-memory Gain=`7` | ACK `accepted=false` (expected); applied |
| write-memory Gain=`3` | restored |
| load-ir fixture WAV → slot 7 → Cab 8 | `persistVerified=true`, `liveMatch=68/68` |
| persist-ir-rom backup → slot 7 | `verified=true` (4096 B) |
| Cabinet `1`→`8` | OK |

Artifacts: `backup-slot-7.bin`, `loaded-sector.bin`.

## Result

**Pass.** Physical stack healthy on commit `23e531f` baseline.

## Confidence

High — exercised session-era CLI against real hardware with restore.
