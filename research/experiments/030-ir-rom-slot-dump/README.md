# 030 — IR ROM slot dump + multi-slot address API

## Objective

Read full 4096-byte IR ROM sectors to learn what sits after CubeSuite’s 2056-byte upload
payload, and wire ToneHub addressing as `0x69000 + slot×0x1000` for slots `0..7`.

## Safety classification

- Phase A: read-only (`dump-ir-rom`) — no erase/write
- Phase B: `persist-ir-rom --slot 7` only (upload slot already used in 028)
- Factory slots `0..6` require `--confirm-overwrite-cabinet` and were **not** overwritten

## Environment

- Date: 2026-08-10
- Device: VID `301A`, PID `5555`
- Tooling: `dump-ir-rom`, `persist-ir-rom --slot`

## Hypothesis

1. Physical sector is 4096 bytes; CubeSuite writes 2056 into the upload slot.
2. Bytes `[2056..4095]` after a CubeSuite upload are erased/`FF`, zeros, or residual audio.
3. `irRomSlotAddress(7) === 0x70000`.

## Procedure

1. Close CubeSuite.
2. Dump slots `1` (marker-01), `7` (upload), `8` (sentinel) to `.bin` + JSON stats.
3. Re-persist fixture to `--slot 7` and dump again.
4. Update protocol-status.

## Operator log

Dumps (`2026-08-10T19:11:45Z` … `19:12:07Z`):

| Slot | Address | afterPayload (bytes 2056..4095) | Header (16 B) |
|---|---|---|---|
| 1 | `0x6a000` | **all-zero** | `01 00 00 00` + floats |
| 7 | `0x70000` | **all-ff** | matches 021 upload fixture |
| 8 | `0x71000` | all-zero (entire sector) | zeros |

Persist `--slot 7` (`2026-08-10T19:12:34Z`): `verified=true`, erase ACK `accepted=false`, then dump still `afterPayload=all-ff`.

Artifacts: `slot-1.bin`, `slot-7.bin`, `slot-8.bin` (4096 B each).

## Result

- Sector size **4096** confirmed by full read.
- Usable CubeSuite image length remains **2056**; the second half is not filled with samples on this unit.
- Factory slot 1 pads the tail with **zeros**; erased+partially-written upload leaves **`0xFF`**.
- Multi-slot address API works: `persist-ir-rom --slot 7` → `0x70000`.
- Slot **8** (`0x71000`) is an empty sentinel, not a cabinet target for persist (`0..7` only).

## Confidence

`confirmed locally` for dump layout + slot-7 addressed persist on this firmware.
