# 013 — Parameter change: Cabinet

## Objective

Observe which SysEx CubeSuite sends when only the Cabinet control changes.

## Safety classification

- Mode: passive USB observation
- Bytes transmitted by ToneHub: none
- External client: CubeSuite GUI only

## Environment

- Date: 2026-08-08
- Device: VID `301A`, PID `5555`
- Capture tools: USBPcap on `\\.\USBPcap2`, USB address `11` only
- Raw capture: `research/captures/013-parameter-cabinet.pcap`
- SHA-256: `f7c2093e879a7eefe0003eadb0b9a91d6ee852567dde93368bdaab90f5ea4baf`
- Curated fixture: `test/fixtures/captures/013-parameter-cabinet.jsonl`

## Hypothesis (before decode)

Cabinet is written like the other knobs: `WriteMemory` (`0x22`) to memory `0x05`, address
`0x80000009` (offset `9`), length `1`, data = Cabinet value (reported range 0–8).

## Procedure

1. Start USBPcap for USB address 11.
2. Open CubeSuite and wait until the pedal is detected.
3. Change **only Cabinet**. Do not touch other controls.
4. Close CubeSuite and stop USBPcap (`Ctrl+C`).
5. Reply `cabinet listo`.
6. Decode offline.

## Operator log

- Sequence: not reported (`listo` only)

## Data captured

Observed data-byte sequence:

`7 → 6 → 5 → 4 → 3 → 2 → 1 → 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8`

Example clear payload contents:

| Captured data byte | Clear payload content (hex) |
|---|---|
| 0 | `05 09 00 00 80 01 00 00 00` |
| 4 | `05 09 00 00 80 01 00 00 04` |
| 8 | `05 09 00 00 80 01 00 00 08` |

Decoded write fields:

- Message type: `0x22` (`memory-write-request`)
- Memory selector: `0x05`
- Address: `0x80000009`
- Length: `1`
- Data: the Cabinet value itself

This sweep covered the full reported Cabinet range 0–8. Every write was answered by `ACK`
(`0x00`) content `00` (`accepted=false`). Checksums were valid.

## Changed bytes

Only the final data byte changed. Address and length stayed fixed at `0x80000009` / `1`.

## Result

Confirmed locally for this unit: Cabinet maps to preset RAM offset `9`. No ToneHub write command
was added.

## Confidence

`confirmed locally` for address/value encoding across the full 0–8 range.

## Follow-up

Capture Type (offset `0`) or section toggles (offsets `10`–`12`).
