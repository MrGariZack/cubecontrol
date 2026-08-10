# 010 — Parameter change: Feedback

## Objective

Observe which SysEx CubeSuite sends when only the Feedback control changes.

## Safety classification

- Mode: passive USB observation
- Bytes transmitted by ToneHub: none
- External client: CubeSuite GUI only

## Environment

- Date: 2026-08-08
- Device: VID `301A`, PID `5555`
- Capture tools: USBPcap on `\\.\USBPcap2`, USB address `11` only
- Raw capture: `research/captures/010-parameter-feedback.pcap`
- SHA-256: `1e1129f5fe6b464c49fd6ed39cf20d12ad899f602480846148f8b16692725c02`
- Curated fixture: `test/fixtures/captures/010-parameter-feedback.jsonl`

## Hypothesis (before decode)

Feedback is written like the other knobs: `WriteMemory` (`0x22`) to memory `0x05`, address
`0x80000004` (offset `4`), length `1`, data = Feedback value (reported range 0–127).

## Procedure

1. Start USBPcap for USB address 11.
2. Open CubeSuite and wait until the pedal is detected.
3. Change **only Feedback**. Do not touch other controls.
4. Close CubeSuite and stop USBPcap (`Ctrl+C`).
5. Reply `feedback listo`.
6. Decode offline.

## Operator log

- Sequence: not reported (`listo` only)

## Data captured

Observed data-byte sequence:

`6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 14 → 13 → 12 → 11 → 10`

Example clear payload contents:

| Captured data byte | Clear payload content (hex) |
|---|---|
| 6 | `05 04 00 00 80 01 00 00 06` |
| 10 | `05 04 00 00 80 01 00 00 0a` |
| 15 | `05 04 00 00 80 01 00 00 0f` |

Decoded write fields:

- Message type: `0x22` (`memory-write-request`)
- Memory selector: `0x05`
- Address: `0x80000004`
- Length: `1`
- Data: the Feedback value itself

This run only swept `6`–`15`; that is enough to pin the address, but does not prove the full
reported 0–127 ceiling. Every write was answered by `ACK` (`0x00`) content `00`
(`accepted=false`). Checksums were valid.

## Changed bytes

Only the final data byte changed. Address and length stayed fixed at `0x80000004` / `1`.

## Result

Confirmed locally for this unit: Feedback maps to preset RAM offset `4`. No ToneHub write command
was added.

## Confidence

`confirmed locally` for address/value encoding on the observed sweep.

## Follow-up

Capture Mix (offset `7`) or Modulation (offset `8`).
