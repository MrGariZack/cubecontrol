# 015 — Parameter change: IR Section toggle

## Objective

Observe which SysEx CubeSuite sends when only the IR / Cabinet section enable toggle changes.

## Safety classification

- Mode: passive USB observation
- Bytes transmitted by ToneHub: none
- External client: CubeSuite GUI only

## Environment

- Date: 2026-08-08
- Device: VID `301A`, PID `5555`
- Capture tools: USBPcap on `\\.\USBPcap2`, USB address `11` only
- Raw capture: `research/captures/015-parameter-ir-section.pcap`
- SHA-256: `97fce13e8beef47a1685624fa74f119386c2cba50305fad24b50ec225e78c356`
- Curated fixture: `test/fixtures/captures/015-parameter-ir-section.jsonl`

## Hypothesis (before decode)

IRSection is written like the other fields: `WriteMemory` (`0x22`) to memory `0x05`, address
`0x8000000a` (offset `10`), length `1`, data = `0` or `1`.

## Procedure

1. Start USBPcap for USB address 11.
2. Open CubeSuite and wait until the pedal is detected.
3. Toggle **only** the IR / Cabinet section enable control (on/off), a few times.
4. Do not change Cabinet slot or other knobs.
5. Close CubeSuite and stop USBPcap (`Ctrl+C`).
6. Reply `ir listo`.
7. Decode offline.

## Operator log

- Sequence: not reported; operator initially could not identify a labeled toggle in CubeSuite
  (USB Loopback is unrelated). Capture still produced a clean `0/1` write stream at offset `10`.

## UI note

CubeSuite does not show a labeled "IR Section" switch. Upstream maps this field to footswitch
`A` / `IR+REV`. In the CubeSuite preset panel, section enables appear as unlabeled circular
controls between slider groups, not as the USB Loopback switch.

## Data captured

Observed data-byte sequence:

`0 → 1 → 0 → 1 → 0 → 1 → 0 → 1 → 0 → 1 → 0 → 1 → 0 → 1`

Example clear payload contents:

| Captured data byte | Clear payload content (hex) |
|---|---|
| 0 | `05 0a 00 00 80 01 00 00 00` |
| 1 | `05 0a 00 00 80 01 00 00 01` |

Decoded write fields:

- Message type: `0x22` (`memory-write-request`)
- Memory selector: `0x05`
- Address: `0x8000000a`
- Length: `1`
- Data: `0` or `1`

Every write was answered by `ACK` (`0x00`) content `00` (`accepted=false`). Checksums were valid.

## Changed bytes

Only the final data byte toggled between `0` and `1`. Address stayed fixed at `0x8000000a`.

## Result

Confirmed locally for this unit: IRSection maps to preset RAM offset `10`. No ToneHub write
command was added.

## Confidence

`confirmed locally` for address/value encoding.

## Follow-up

Capture DelaySection (offset `11`, footswitch B / MOD+DLY) and ToneSection (offset `12`,
footswitch C / AMP).
