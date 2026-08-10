# 006 — Parameter change: Tone

## Objective

Observe which SysEx CubeSuite sends when only the Tone control changes, and correlate each
write with the on-screen Tone values reported by the operator.

## Safety classification

- Mode: passive USB observation
- Bytes transmitted by ToneHub: none
- External client: CubeSuite GUI only

## Environment

- Date: 2026-08-08
- Device: VID `301A`, PID `5555`
- Capture tools: USBPcap on `\\.\USBPcap2`, USB address `11` only
- Raw capture: `research/captures/006-parameter-tone.pcap`
- SHA-256: `8944e707b0bb24b35f311827a31f90371ea396fa49572242a69f9529274b8501`
- Curated fixture: `test/fixtures/captures/006-parameter-tone.jsonl`

## Hypothesis (before decode)

Tone is written like Gain: `WriteMemory` (`0x22`) to memory `0x05`, address `0x80000002`
(offset `2`), length `1`, data = Tone value (reported range 0–15).

## Procedure

1. Start USBPcap for USB address 11.
2. Open CubeSuite and wait until the pedal is detected.
3. Change **only Tone**. Do not touch Gain or other controls.
4. For each change, wait ~1 second and write the on-screen sequence, e.g. `8 → 10 → 12 → 9`.
5. Close CubeSuite and stop USBPcap (`Ctrl+C` in the USBPcap console).
6. Reply in chat with `tone listo` plus the value sequence.
7. Decode offline and compare bytes vs reported values.

## Operator log

- Starting Tone value: not reported
- Sequence: not reported (`tone listo` only)
- Ending Tone value: not reported

Correlation for this run used address offset + observed value range, not a screen log.

## Data captured

After the CubeSuite startup handshake, Tone changes produced repeated host writes:

| Captured data byte | Clear payload content (hex) |
|---|---|
| 2 | `05 02 00 00 80 01 00 00 02` |
| 4 | `05 02 00 00 80 01 00 00 04` |
| 6 | `05 02 00 00 80 01 00 00 06` |
| 7 | `05 02 00 00 80 01 00 00 07` |
| 8 | `05 02 00 00 80 01 00 00 08` |
| 9 | `05 02 00 00 80 01 00 00 09` |
| 10 | `05 02 00 00 80 01 00 00 0a` |
| 11 | `05 02 00 00 80 01 00 00 0b` |
| 13 | `05 02 00 00 80 01 00 00 0d` |

Write sequence observed:
`2 → 6 → 7 → 9 → 6 → 4 → 8 → 10 → 11 → 8 → 6 → 8 → 11 → 13`

Decoded write fields:

- Message type: `0x22` (`memory-write-request`)
- Memory selector: `0x05`
- Address: `0x80000002`
- Length: `1`
- Data: the Tone value itself

Every write was answered by the device with `ACK` (`0x00`) content `00` (`accepted=false`).
Checksums were valid for all captured write and ACK messages.

## Changed bytes

Only the final data byte of the write content changed with Tone. Address and length stayed fixed at
`0x80000002` / `1`. Values included `8`–`13`, which are outside Gain's reported 0–7 range.

## Result

Confirmed locally for this unit: Tone maps to preset RAM offset `2`, matching the prior Gain =
offset `1` pattern. No ToneHub write command was added.

## Confidence

`confirmed locally` for address/value encoding. Screen-value pairing remains incomplete because the
operator log was empty.

## Follow-up

Capture the next parameter (Reverb / Delay / Volume) with an explicit on-screen sequence.
