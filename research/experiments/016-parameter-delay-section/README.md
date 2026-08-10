# 016 — Parameter change: Delay Section toggle

## Objective

Observe which SysEx CubeSuite sends when only the Delay / MOD+DLY section enable toggle changes.

## Safety classification

- Mode: passive USB observation
- Bytes transmitted by ToneHub: none
- External client: CubeSuite GUI only

## Environment

- Date: 2026-08-08
- Device: VID `301A`, PID `5555`
- Capture tools: USBPcap on `\\.\USBPcap2`, USB address `11` only
- Raw capture: `research/captures/016-parameter-delay-section.pcap`
- SHA-256: `5bc899007c0a691de9d7d42350a7e741f2cafcdf8c745fff24979fe814822dcf`
- Curated fixture: `test/fixtures/captures/016-parameter-delay-section.jsonl`

## Hypothesis (before decode)

DelaySection is written like IRSection: `WriteMemory` (`0x22`) to memory `0x05`, address
`0x8000000b` (offset `11`), length `1`, data = `0` or `1`.

Maps to footswitch B / `MOD+DLY` in upstream references.

## Procedure

1. Start USBPcap for USB address 11.
2. Open CubeSuite and wait until the pedal is detected.
3. Toggle **only** footswitch B / MOD+DLY section enable (on/off), a few times.
4. Do not change Mix/FB/Time/Mod knobs.
5. Close CubeSuite and stop USBPcap (`Ctrl+C`).
6. Reply `delay listo`.
7. Decode offline.

## Operator log

- Sequence: not reported (`ya` only)

## Data captured

Observed data-byte sequence:

`0 → 1 → 0 → 1 → 0 → 1 → 0 → 1 → 0 → 1 → 0 → 1 → 0 → 1 → 0 → 1 → 0`

Example clear payload contents:

| Captured data byte | Clear payload content (hex) |
|---|---|
| 0 | `05 0b 00 00 80 01 00 00 00` |
| 1 | `05 0b 00 00 80 01 00 00 01` |

Decoded write fields:

- Message type: `0x22` (`memory-write-request`)
- Memory selector: `0x05`
- Address: `0x8000000b`
- Length: `1`
- Data: `0` or `1`

Every write was answered by `ACK` (`0x00`) content `00` (`accepted=false`). Checksums were valid.

## Changed bytes

Only the final data byte toggled between `0` and `1`. Address stayed fixed at `0x8000000b`.

## Result

Confirmed locally for this unit: DelaySection maps to preset RAM offset `11`. No ToneHub write
command was added.

## Confidence

`confirmed locally` for address/value encoding.

## Follow-up

Capture ToneSection (offset `12`, footswitch C / AMP).
