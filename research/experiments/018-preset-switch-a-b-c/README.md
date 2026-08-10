# 018 — Preset switch A / B / C

## Objective

Observe which SysEx CubeSuite sends when switching between presets A, B, and C without
pressing Save.

## Safety classification

- Mode: passive USB observation
- Bytes transmitted by ToneHub: none
- External client: CubeSuite GUI only
- Constraint: do **not** press Save

## Environment

- Date: 2026-08-08
- Device: VID `301A`, PID `5555`
- Capture tools: USBPcap on `\\.\USBPcap2`, USB address `12` only
- Raw capture: `research/captures/018-preset-switch-a-b-c.pcap`
- SHA-256: `0847741b9a66262d317cdd1c92390225ccbf54cfe730c15d7be13a558f84e851`
- Curated fixture: `test/fixtures/captures/018-preset-switch-a-b-c.jsonl`
- Note: first attempt failed (empty pcap) because the pedal moved from USB address
  `11` to `12` after reconnect; capture was restarted on address `12`.

## Hypothesis (before decode)

Switching presets may:
1. write a slot selector (memory/register), and/or
2. read the 16-byte preset block for the selected slot, and/or
3. issue a different message family (`0x21` / `0x24`) not yet seen locally.

## Procedure

1. Start USBPcap for USB address 12.
2. Open CubeSuite and wait until the pedal is detected.
3. Switch presets only: `A → B → C → A` (or similar), pausing ~1 s between switches.
4. Do **not** change knobs and do **not** press Save.
5. Close CubeSuite and stop USBPcap (`Ctrl+C`).
6. Reply `abc listo` plus the switch sequence if noted.
7. Decode offline.

## Operator log

- Sequence: not reported (`ya` only)

## Data captured

Only the normal CubeSuite startup handshake was present (10 SysEx messages). After that,
**zero** additional host→device or device→host messages appeared while switching A/B/C.

Startup already reads all three presets in one 48-byte block:

- Memory selector `0x05`, address `0x00000000`, length `48`
- Layout: slot A bytes `0..15`, slot B `16..31`, slot C `32..47`

Observed slot-A/B/C contents in this capture:

| Slot | First 13 bytes |
|---|---|
| A | `05 03 03 06 05 63 05 07 08 08 01 01 01` |
| B | `05 03 04 06 41 73 18 50 08 08 01 01 01` |
| C | `06 00 03 0a 59 44 0b 0a 08 05 01 01 01` |

## Changed bytes

None after handshake. No `WriteMemory`, no slot-selector write, no `0x21`/`0x24`.

## Result

For this CubeSuite build/session, changing the preset dropdown A/B/C does **not** emit SysEx.
CubeSuite appears to keep all three slots locally after the startup 48-byte read and only talk to
the pedal again when a parameter is edited (live writes to `0x80000000+offset`).

This is a useful negative result: GUI slot selection ≠ pedal preset recall traffic.

## Confidence

`confirmed locally` for “no SysEx on CubeSuite dropdown A/B/C switch” in this unit/session.

## Follow-up

1. Retry while pressing physical footswitches A/B/C with CubeSuite open, or
2. Capture CubeSuite Save (persist) traffic, or
3. Capture whether editing after switching slot A vs B still writes the same live RAM base.
