# 008 — Parameter change: Volume

## Objective

Observe which SysEx CubeSuite sends when only the Volume control changes.

## Safety classification

- Mode: passive USB observation
- Bytes transmitted by ToneHub: none
- External client: CubeSuite GUI only

## Environment

- Date: 2026-08-08
- Device: VID `301A`, PID `5555`
- Capture tools: USBPcap on `\\.\USBPcap2`, USB address `11` only
- Raw capture: `research/captures/008-parameter-volume.pcap`
- SHA-256: `ce59ff395a1f18d5cde6738c436d0af70ca2991b742bade40b816572ac5a8c14`
- Curated fixture: `test/fixtures/captures/008-parameter-volume.jsonl`

## Hypothesis (before decode)

Volume is written like Gain/Tone/Reverb: `WriteMemory` (`0x22`) to memory `0x05`, address
`0x80000005` (offset `5`), length `1`, data = Volume value (reported range 0–127).

## Procedure

1. Start USBPcap for USB address 11.
2. Open CubeSuite and wait until the pedal is detected.
3. Change **only Volume**. Do not touch other controls.
4. Optionally note the on-screen sequence (e.g. `40 → 60 → 80 → 50`).
5. Close CubeSuite and stop USBPcap (`Ctrl+C`).
6. Reply `volume listo` (plus sequence if noted).
7. Decode offline.

## Operator log

- Sequence: not reported (`volume listo` only)

## Data captured

After the CubeSuite startup handshake, Volume changes produced repeated host writes to a single
address. Observed data-byte sequence:

`100 → 101 → … → 109 → … → 96 → … → 107`

Example clear payload contents:

| Captured data byte | Clear payload content (hex) |
|---|---|
| 96 | `05 05 00 00 80 01 00 00 60` |
| 100 | `05 05 00 00 80 01 00 00 64` |
| 109 | `05 05 00 00 80 01 00 00 6d` |

Decoded write fields:

- Message type: `0x22` (`memory-write-request`)
- Memory selector: `0x05`
- Address: `0x80000005`
- Length: `1`
- Data: the Volume value itself

Values sit in the high end of the reported 0–127 Volume range (far above Gain/Tone/Reverb scales).
Every write was answered by `ACK` (`0x00`) content `00` (`accepted=false`). Checksums were valid.

## Changed bytes

Only the final data byte changed. Address and length stayed fixed at `0x80000005` / `1`.

## Result

Confirmed locally for this unit: Volume maps to preset RAM offset `5`. No ToneHub write command was
added.

## Confidence

`confirmed locally` for address/value encoding.

## Follow-up

Capture Delay Time (offset `6`) or Feedback (offset `4`).
