# 031 — IR ROM factory round-trip (pad sector + restore)

## Objective

Prove ToneHub can overwrite a non-upload cabinet slot safely: dump → write padded sector →
verify → restore original 4096-byte image. Also confirm zero-padding prevents erase-tail `0xFF`.

## Safety classification

- Mode: mutating / destructive to **one** factory cabinet (slot 1 / `0x6a000`) for a short window
- Always restore from a pre-write dump before ending the session
- Bytes: identity + erase `0x21` + full-sector `WriteMemory` + verify `ReadMemory`
- Not in this experiment: permanent custom IR on a factory slot

## Environment

- Date: 2026-08-10
- Device: VID `301A`, PID `5555`
- Target slot: **1** (`0x6a000`, marker-01 in 029/030)
- Fixture write: `test/fixtures/ir/021-rom-ir-payload.bin` (2056 → pad 4096)
- Tooling: `dump-ir-rom`, `persist-ir-rom --slot 1 --confirm-overwrite-cabinet`

## Hypothesis

1. Zero-padding 2056→4096 after erase yields `afterPayload=all-zero` (not `all-ff`).
2. Full 4096 restore from dump returns the original factory header/samples.

## Procedure

1. Close CubeSuite.
2. Fresh dump slot 1 → `backup-slot-1.bin`.
3. `persist-ir-rom --slot 1 --file 021-rom… --confirm-ir-rom-persist --confirm-overwrite-cabinet`.
4. Dump slot 1; confirm header matches fixture prefix and tail zeros.
5. `persist-ir-rom --slot 1 --file backup-slot-1.bin …` (4096 restore).
6. Dump slot 1; byte-compare to backup.

## Operator log

| Step | Time (UTC) | Result |
|---|---|---|
| Backup dump | `19:16:36Z` | header `01000000d7a3303f…`, tail zeros |
| Persist fixture (padded) | `19:16:55Z` | `writtenLength=4096`, `padded=true`, `verified=true`, 32 chunks |
| Dump after write | `19:17:06Z` | header = fixture, `afterPayload=all-zero` |
| Restore backup | `19:17:26Z` | `payloadLength=4096`, `verified=true` |
| Dump after restore | `19:17:37Z` | header restored `01000000d7a3303f…` |

Byte checks: `restoreMatch=True`, `prefixMatchFixture=True`, `afterWriteTailZero=True`.

Artifacts: `backup-slot-1.bin`, `after-write-slot-1.bin`, `after-restore-slot-1.bin`.

## Result

Factory slot round-trip works end-to-end. Default sector pad (2056→4096 zeros) avoids the
erase-tail `0xFF` seen in 030 upload dumps. Original cabinet image restored byte-identical.

## Confidence

`confirmed locally` for slot 1 on this firmware. Other factory slots use the same addressing;
not every index was overwritten in this session.
