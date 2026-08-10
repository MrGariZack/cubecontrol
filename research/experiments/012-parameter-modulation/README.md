# 012 — Parameter change: Modulation

## Objective

Observe which SysEx CubeSuite sends when only the Modulation control changes.

## Safety classification

- Mode: passive USB observation
- Bytes transmitted by ToneHub: none
- External client: CubeSuite GUI only

## Environment

- Date: 2026-08-08
- Device: VID `301A`, PID `5555`
- Capture tools: USBPcap on `\\.\USBPcap2`, USB address `11` only
- Raw capture: `research/captures/012-parameter-modulation.pcap`
- SHA-256: `4805240445c4d28cff737c231f83002c3d4c6688329bac87ef7dc3310db97775`
- Curated fixture: `test/fixtures/captures/012-parameter-modulation.jsonl`

## Hypothesis (before decode)

Modulation is written like the other knobs: `WriteMemory` (`0x22`) to memory `0x05`, address
`0x80000008` (offset `8`), length `1`, data = Modulation value (reported range 0–15).

## Procedure

1. Start USBPcap for USB address 11.
2. Open CubeSuite and wait until the pedal is detected.
3. Change **only Modulation**. Do not touch other controls.
4. Close CubeSuite and stop USBPcap (`Ctrl+C`).
5. Reply `mod listo`.
6. Decode offline.

## Operator log

- Sequence: not reported (`listo` only)

## Data captured

Observed data-byte sequence:

`9 → 10 → 11 → 12 → 13 → 14 → 15 → 14 → 13 → 12 → 11 → 10 → 9 → 8`

Example clear payload contents:

| Captured data byte | Clear payload content (hex) |
|---|---|
| 8 | `05 08 00 00 80 01 00 00 08` |
| 12 | `05 08 00 00 80 01 00 00 0c` |
| 15 | `05 08 00 00 80 01 00 00 0f` |

Decoded write fields:

- Message type: `0x22` (`memory-write-request`)
- Memory selector: `0x05`
- Address: `0x80000008`
- Length: `1`
- Data: the Modulation value itself

Values reached `15`, matching the reported Modulation ceiling. Every write was answered by `ACK`
(`0x00`) content `00` (`accepted=false`). Checksums were valid.

## Changed bytes

Only the final data byte changed. Address and length stayed fixed at `0x80000008` / `1`.

## Result

Confirmed locally for this unit: Modulation maps to preset RAM offset `8`. No ToneHub write
command was added.

## Confidence

`confirmed locally` for address/value encoding.

## Follow-up

Capture Cabinet (offset `9`), Type (offset `0`), or section toggles (offsets `10`–`12`).
