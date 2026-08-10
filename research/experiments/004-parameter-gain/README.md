# 004 — Parameter change: Gain

## Objective

Observe which SysEx CubeSuite sends when only the Gain control changes, and whether the
device replies.

## Safety classification

- Mode: passive USB observation
- Bytes transmitted by ToneHub: none
- External client: CubeSuite GUI only

## Environment

- Date: 2026-08-08
- Device: VID `301A`, PID `5555`
- Capture tools: USBPcap on `\\.\USBPcap2`, USB address `11` only
- Raw capture: `research/captures/004-parameter-gain.pcap`
- SHA-256: `6585b1de9d6c290fb9c91a54af3eb7f707430bd532cda72e0e7d4981274e4e2f`
- Curated fixture: `test/fixtures/captures/004-parameter-gain.jsonl`

## Procedure

1. Start USBPcap for USB address 11.
2. Open CubeSuite and wait until the pedal is detected.
3. Change only Gain several times.
4. Close CubeSuite and stop USBPcap.
5. Decode offline.

## Data captured

After the normal CubeSuite startup handshake, Gain changes produced repeated host writes:

| Observed Gain value | Clear payload content (hex) |
|---|---|
| 3 | `05 01 00 00 80 01 00 00 03` |
| 4 | `05 01 00 00 80 01 00 00 04` |
| 5 | `05 01 00 00 80 01 00 00 05` |
| 6 | `05 01 00 00 80 01 00 00 06` |
| 7 | `05 01 00 00 80 01 00 00 07` |

Decoded write fields:

- Message type: `0x22` (`memory-write-request`)
- Memory selector: `0x05`
- Address: `0x80000001`
- Length: `1`
- Data: the Gain value itself

Every write was answered by the device with:

- Message type: `0x00`
- Content: `00`
- Meaning: `ACK` with `accepted=false` / `rawValue=0`

Checksums were valid for all captured write and ACK messages.

## Changed bytes

Only the final data byte of the write content changed with Gain. Address and length stayed fixed at
`0x80000001` / `1`.

## Hypothesis

Gain is live-written as a one-byte memory write at preset RAM base `0x80000000` + offset `1`.
`ACK:false` does not mean the write was rejected; CubeSuite continues and the pedal still tracks the
value.

## Result

Confirmed locally for this unit. No ToneHub write command was added; this experiment only documents
CubeSuite traffic.

## Confidence

`confirmed locally`.
