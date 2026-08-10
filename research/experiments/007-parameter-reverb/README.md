# 007 — Parameter change: Reverb

## Objective

Observe which SysEx CubeSuite sends when only the Reverb control changes, and correlate each
write with the on-screen Reverb values reported by the operator.

## Safety classification

- Mode: passive USB observation
- Bytes transmitted by ToneHub: none
- External client: CubeSuite GUI only

## Environment

- Date: 2026-08-08
- Device: VID `301A`, PID `5555`
- Capture tools: USBPcap on `\\.\USBPcap2`, USB address `11` only
- Raw capture: `research/captures/007-parameter-reverb.pcap`
- SHA-256: `5e35a69a3922d5083b777fff21fbde9c828b90ee9ac809d0de5b114836fdc60e`
- Curated fixture: `test/fixtures/captures/007-parameter-reverb.jsonl`

## Hypothesis (before decode)

Reverb is written like Gain/Tone: `WriteMemory` (`0x22`) to memory `0x05`, address
`0x80000003` (offset `3`), length `1`, data = Reverb value (reported range 0–15).

## Procedure

1. Start USBPcap for USB address 11.
2. Open CubeSuite and wait until the pedal is detected.
3. Change **only Reverb**. Do not touch Gain, Tone, or other controls.
4. For each change, wait ~1 second and write the on-screen sequence, e.g. `5 → 8 → 12 → 7`.
5. Close CubeSuite and stop USBPcap (`Ctrl+C` in the USBPcap console).
6. Reply in chat with `reverb listo` plus the value sequence.
7. Decode offline and compare bytes vs reported values.

## Operator log

- Starting Reverb value: not reported
- Sequence: not reported (`ya` only)
- Ending Reverb value: not reported

Correlation for this run used address offset + observed value sweep, not a screen log.

## Data captured

After the CubeSuite startup handshake, Reverb changes produced repeated host writes to a single
address. Observed data-byte sequence:

`7 → 8 → 7 → 8 → 9 → 10 → 11 → 10 → 9 → 8 → 7 → 6 → 5 → 4 → 3 → 2 → 1 → 2 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10`

Example clear payload contents:

| Captured data byte | Clear payload content (hex) |
|---|---|
| 1 | `05 03 00 00 80 01 00 00 01` |
| 6 | `05 03 00 00 80 01 00 00 06` |
| 11 | `05 03 00 00 80 01 00 00 0b` |

Decoded write fields:

- Message type: `0x22` (`memory-write-request`)
- Memory selector: `0x05`
- Address: `0x80000003`
- Length: `1`
- Data: the Reverb value itself

Every write was answered by the device with `ACK` (`0x00`) content `00` (`accepted=false`).
Checksums were valid for all captured write and ACK messages.

## Changed bytes

Only the final data byte of the write content changed with Reverb. Address and length stayed fixed
at `0x80000003` / `1`.

## Result

Confirmed locally for this unit: Reverb maps to preset RAM offset `3`, continuing the Gain =
offset `1` and Tone = offset `2` pattern. No ToneHub write command was added.

## Confidence

`confirmed locally` for address/value encoding. Screen-value pairing remains incomplete because the
operator log was empty.

## Follow-up

Capture the next parameter (Volume / Delay Time / Modulation) with an explicit on-screen sequence.
