# 020 — CubeSuite Save / persist

## Objective

Observe which SysEx CubeSuite sends when the operator presses Save after a small, intentional
parameter change.

## Safety classification

- Mode: passive USB observation
- Bytes transmitted by ToneHub: none
- External client: CubeSuite GUI
- **Mutating on device:** Save persists storage; observed as a full 48-byte bank write
- Recovery: re-save previous personal values if needed

## Environment

- Date: 2026-08-08
- Device: VID `301A`, PID `5555`
- Capture tools: USBPcap on `\\.\USBPcap2`, USB address `10` only
- Raw capture: `research/captures/020-cubesuite-save.pcap`
- SHA-256: `a4c5ba356c7b60b4746051ed28ef55e1586cf0c83730407a2e13c72a8b19f80d`
- Curated fixture: `test/fixtures/captures/020-cubesuite-save.jsonl`

## Hypothesis (before decode)

Save may:
1. write the full 16-byte preset block to memory `0x05` / address `0x00000000` (+ slot offset),
2. write to live RAM `0x80000000` then a persist/commit command, and/or
3. use message family `0x21` / erase / other not yet seen locally.

## Procedure

1. Confirm USB address (`10`).
2. Start USBPcap for address `10` only.
3. Open CubeSuite and wait until the pedal is detected.
4. Select one slot you are willing to overwrite temporarily (recommend slot you can restore).
5. Note the current value of one knob (e.g. Gain).
6. Change that knob by **one step only**.
7. Press **Save** once.
8. Optionally restore the previous knob value and Save again so your personal preset stays intact.
9. Close CubeSuite and stop USBPcap (`Ctrl+C`).
10. Reply `save listo` with: slot + knob + before/after values.
11. Decode offline.

## Operator log

- Slot: not reported (`ya` only)
- Knob: inferred from capture as Volume (offset `5`)
- Before → after: `99 → 100` in slot A of the bank image
- Restored after capture: not reported

## Data captured

After startup handshake, the Save sequence was:

1. Live write: `WriteMemory` (`0x22`) memory `0x05`, address `0x80000005`, length `1`, data=`100`
2. Persist write: `WriteMemory` (`0x22`) memory `0x05`, address `0x00000000`, length `48`,
   data = full three-slot bank (48 bytes)
3. Device `ACK` (`0x00`) content `00` (`accepted=false`) for both writes
4. Verify read: `ReadMemory` (`0x23`) memory `0x05`, address `0x00000000`, length `48`
5. Device returned the same 48-byte image just written

Slot A volume byte changed; slots B and C were unchanged in this capture:

| Slot | Bytes 0..12 before | Bytes 0..12 after |
|---|---|---|
| A | `05 03 03 06 05 63 ...` (Volume=`99`) | `05 03 03 06 05 64 ...` (Volume=`100`) |
| B | unchanged | unchanged |
| C | unchanged | unchanged |

## Changed bytes

- Live RAM: `0x80000005` = `100`
- Stored bank: only slot-A offset `5` (`99`→`100`) inside the 48-byte write to `0x00000000`

## Result

CubeSuite Save is not a separate mysterious persist opcode in this capture. It:

1. applies the live one-byte write at `0x80000000+offset`, then
2. writes the **entire 48-byte A+B+C bank** back to memory `0x05` / address `0x00000000`, then
3. re-reads that bank to confirm.

Safety implication: one Save rewrites all three stored slots (even if only one byte changed).

## Confidence

`confirmed locally` for this Save path on this unit/session.

## Follow-up

IR upload, or encode a ToneHub read-only bank decoder for the 48-byte startup/save image.
