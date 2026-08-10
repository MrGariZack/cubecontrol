# 017 — Parameter change: Tone Section toggle

## Objective

Observe which SysEx CubeSuite sends when only the Tone / AMP section enable toggle changes.

## Safety classification

- Mode: passive USB observation
- Bytes transmitted by ToneHub: none
- External client: CubeSuite GUI only

## Environment

- Date: 2026-08-08
- Device: VID `301A`, PID `5555`
- Capture tools: USBPcap on `\\.\USBPcap2`, USB address `11` only
- Raw capture: `research/captures/017-parameter-tone-section.pcap`
- SHA-256: `1a9e0209f2b93fbe6335bc5369ddbbfbba13c1de8c468982648c1a898b962358`
- Curated fixture: `test/fixtures/captures/017-parameter-tone-section.jsonl`

## Hypothesis (before decode)

ToneSection is written like the other section toggles: `WriteMemory` (`0x22`) to memory `0x05`,
address `0x8000000c` (offset `12`), length `1`, data = `0` or `1`.

Maps to footswitch C / `AMP` in upstream references.

## Procedure

1. Start USBPcap for USB address 11.
2. Open CubeSuite and wait until the pedal is detected.
3. Toggle **only** footswitch C / AMP section enable (on/off), a few times.
4. Do not change Type/Gain/Tone knobs.
5. Close CubeSuite and stop USBPcap (`Ctrl+C`).
6. Reply `amp listo`.
7. Decode offline.

## Operator log

- Sequence: not reported (`ya` only)

## Data captured

Observed data-byte sequence:

`0 → 1 → 0 → 1 → 0 → 1 → 0 → 1`

Example clear payload contents:

| Captured data byte | Clear payload content (hex) |
|---|---|
| 0 | `05 0c 00 00 80 01 00 00 00` |
| 1 | `05 0c 00 00 80 01 00 00 01` |

Decoded write fields:

- Message type: `0x22` (`memory-write-request`)
- Memory selector: `0x05`
- Address: `0x8000000c`
- Length: `1`
- Data: `0` or `1`

Every write was answered by `ACK` (`0x00`) content `00` (`accepted=false`). Checksums were valid.

## Changed bytes

Only the final data byte toggled between `0` and `1`. Address stayed fixed at `0x8000000c`.

## Result

Confirmed locally for this unit: ToneSection maps to preset RAM offset `12`. Together with
experiments 004–016, the full 13-parameter live-write map (offsets `0`–`12`) is now confirmed.
No ToneHub write command was added.

## Confidence

`confirmed locally` for address/value encoding.

## Follow-up

Safe next steps: verify CubeSuite save/persist traffic, preset A/B/C switching, or a ToneHub
read-only decode of the 16-byte preset block already returned at startup.
