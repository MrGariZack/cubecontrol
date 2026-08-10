# 009 — Parameter change: Delay Time

## Objective

Observe which SysEx CubeSuite sends when only the Delay Time control changes.

## Safety classification

- Mode: passive USB observation
- Bytes transmitted by ToneHub: none
- External client: CubeSuite GUI only

## Environment

- Date: 2026-08-08
- Device: VID `301A`, PID `5555`
- Capture tools: USBPcap on `\\.\USBPcap2`, USB address `11` only
- Raw capture: `research/captures/009-parameter-delay-time.pcap`
- SHA-256: `1cef8e2c5dbdfe394549020bf980fcc642d73f353d2b7b3637dfced028dcbb3d`
- Curated fixture: `test/fixtures/captures/009-parameter-delay-time.jsonl`

## Hypothesis (before decode)

Delay Time is written like the other knobs: `WriteMemory` (`0x22`) to memory `0x05`, address
`0x80000006` (offset `6`), length `1`, data = Time value (reported range 0–31).

## Procedure

1. Start USBPcap for USB address 11.
2. Open CubeSuite and wait until the pedal is detected.
3. Change **only Delay Time / Time**. Do not touch other controls.
4. Close CubeSuite and stop USBPcap (`Ctrl+C`).
5. Reply `time listo`.
6. Decode offline.

## Operator log

- Sequence: not reported (`time listo` only)

## Data captured

Observed data-byte sequence:

`6 → 7 → 8 → 9 → 10 → 9 → 8 → 7 → 6 → 5 → 6 → 7 → 8`

Example clear payload contents:

| Captured data byte | Clear payload content (hex) |
|---|---|
| 5 | `05 06 00 00 80 01 00 00 05` |
| 8 | `05 06 00 00 80 01 00 00 08` |
| 10 | `05 06 00 00 80 01 00 00 0a` |

Decoded write fields:

- Message type: `0x22` (`memory-write-request`)
- Memory selector: `0x05`
- Address: `0x80000006`
- Length: `1`
- Data: the Delay Time value itself

Values stay within the reported 0–31 Time range. Every write was answered by `ACK` (`0x00`)
content `00` (`accepted=false`). Checksums were valid.

## Changed bytes

Only the final data byte changed. Address and length stayed fixed at `0x80000006` / `1`.

## Result

Confirmed locally for this unit: Delay Time maps to preset RAM offset `6`. No ToneHub write
command was added.

## Confidence

`confirmed locally` for address/value encoding.

## Follow-up

Capture Feedback (offset `4`), Mix (offset `7`), or Modulation (offset `8`).
