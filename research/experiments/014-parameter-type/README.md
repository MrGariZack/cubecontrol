# 014 — Parameter change: Type

## Objective

Observe which SysEx CubeSuite sends when only the Type / Drive Type control changes.

## Safety classification

- Mode: passive USB observation
- Bytes transmitted by ToneHub: none
- External client: CubeSuite GUI only

## Environment

- Date: 2026-08-08
- Device: VID `301A`, PID `5555`
- Capture tools: USBPcap on `\\.\USBPcap2`, USB address `11` only
- Raw capture: `research/captures/014-parameter-type.pcap`
- SHA-256: `5ca714b465aadf884dc9a1e42a5043c405c79b460c03018cab36ee845af6ce94`
- Curated fixture: `test/fixtures/captures/014-parameter-type.jsonl`

## Hypothesis (before decode)

Type is written like the other knobs: `WriteMemory` (`0x22`) to memory `0x05`, address
`0x80000000` (offset `0`), length `1`, data = Type value (reported range 0–8).

## Procedure

1. Start USBPcap for USB address 11.
2. Open CubeSuite and wait until the pedal is detected.
3. Change **only Type / Drive Type**. Do not touch other controls.
4. Close CubeSuite and stop USBPcap (`Ctrl+C`).
5. Reply `type listo`.
6. Decode offline.

## Operator log

- Sequence: not reported (`listo` only)

## Data captured

Observed data-byte sequence:

`6 → 7 → 8 → 7 → 6 → 5 → 4 → 3 → 2 → 1 → 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8`

Example clear payload contents:

| Captured data byte | Clear payload content (hex) |
|---|---|
| 0 | `05 00 00 00 80 01 00 00 00` |
| 4 | `05 00 00 00 80 01 00 00 04` |
| 8 | `05 00 00 00 80 01 00 00 08` |

Decoded write fields:

- Message type: `0x22` (`memory-write-request`)
- Memory selector: `0x05`
- Address: `0x80000000`
- Length: `1`
- Data: the Type value itself

This sweep covered the full reported Type range 0–8. Every write was answered by `ACK` (`0x00`)
content `00` (`accepted=false`). Checksums were valid.

## Changed bytes

Only the final data byte changed. Address and length stayed fixed at `0x80000000` / `1`.

## Result

Confirmed locally for this unit: Type maps to preset RAM offset `0`. With Cabinet at offset `9`,
the continuous 0–9 parameter map matches the reported 13-parameter layout for the first ten
fields. No ToneHub write command was added.

## Confidence

`confirmed locally` for address/value encoding across the full 0–8 range.

## Follow-up

Capture section toggles: IRSection (`10`), DelaySection (`11`), ToneSection (`12`).
