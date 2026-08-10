# 011 — Parameter change: Mix

## Objective

Observe which SysEx CubeSuite sends when only the Mix control changes.

## Safety classification

- Mode: passive USB observation
- Bytes transmitted by ToneHub: none
- External client: CubeSuite GUI only

## Environment

- Date: 2026-08-08
- Device: VID `301A`, PID `5555`
- Capture tools: USBPcap on `\\.\USBPcap2`, USB address `11` only
- Raw capture: `research/captures/011-parameter-mix.pcap`
- SHA-256: `cd6578e8a5088ec1d0c03afe2fe8514e1243259224bac4f838b7c9d02c04d764`
- Curated fixture: `test/fixtures/captures/011-parameter-mix.jsonl`

## Hypothesis (before decode)

Mix is written like the other knobs: `WriteMemory` (`0x22`) to memory `0x05`, address
`0x80000007` (offset `7`), length `1`, data = Mix value (reported range 0–118).

## Procedure

1. Start USBPcap for USB address 11.
2. Open CubeSuite and wait until the pedal is detected.
3. Change **only Mix**. Do not touch other controls.
4. Close CubeSuite and stop USBPcap (`Ctrl+C`).
5. Reply `mix listo`.
6. Decode offline.

## Operator log

- Sequence: not reported (`listo` only)

## Data captured

Observed data-byte sequence:

`8 → 9 → 10 → 11 → 12 → 13 → 14 → 13 → 12 → 11 → 10 → 9 → 8 → 7`

Example clear payload contents:

| Captured data byte | Clear payload content (hex) |
|---|---|
| 7 | `05 07 00 00 80 01 00 00 07` |
| 10 | `05 07 00 00 80 01 00 00 0a` |
| 14 | `05 07 00 00 80 01 00 00 0e` |

Decoded write fields:

- Message type: `0x22` (`memory-write-request`)
- Memory selector: `0x05`
- Address: `0x80000007`
- Length: `1`
- Data: the Mix value itself

This run only swept `7`–`14`; enough to pin the address. Every write was answered by `ACK`
(`0x00`) content `00` (`accepted=false`). Checksums were valid.

## Changed bytes

Only the final data byte changed. Address and length stayed fixed at `0x80000007` / `1`.

## Result

Confirmed locally for this unit: Mix maps to preset RAM offset `7`. No ToneHub write command was
added.

## Confidence

`confirmed locally` for address/value encoding on the observed sweep.

## Follow-up

Capture Modulation (offset `8`).
