# 019 — Physical footswitches A / B / C

## Objective

Observe whether pressing the physical pedal footswitches A/B/C produces USB-MIDI traffic
while CubeSuite is connected (and what that traffic is).

## Safety classification

- Mode: passive USB observation
- Bytes transmitted by ToneHub: none
- External client: CubeSuite GUI open for handshake only
- Constraint: do **not** press Save; do not move knobs in CubeSuite

## Environment

- Date: 2026-08-08
- Device: VID `301A`, PID `5555`
- Capture tools: USBPcap on `\\.\USBPcap2`, USB address `10` only
- Raw capture: `research/captures/019-footswitch-a-b-c.pcap`
- SHA-256: `741a63c2ae73125119cdbda6e42cad93e29f5995877826e51e89f16e6ecd9d0f`
- Curated fixture: `test/fixtures/captures/019-footswitch-a-b-c.jsonl`
- Note: after PC reboot the pedal moved to USB address `10` (was `11`/`12`).

## Hypothesis (before decode)

Possible outcomes:
1. No SysEx (footswitch recall is local to the pedal).
2. CubeSuite reacts by reading/writing the active preset.
3. Pedal emits a slot-select or section-toggle message family not yet seen.

Earlier monitor sessions without CubeSuite saw silence for physical controls. This experiment
keeps CubeSuite connected so any host reaction is visible.

## Procedure

1. Rediscover USB address after reboot (`10`).
2. Start USBPcap for address `10` only.
3. Open CubeSuite and wait until the pedal is detected.
4. Press physical footswitches only: `A → B → C → A` (~1 s between presses).
5. Do not touch CubeSuite controls or Save.
6. Close CubeSuite and stop USBPcap (`Ctrl+C`).
7. Reply `fs listo`.
8. Decode offline.

## Operator log

- Sequence: not reported (`ya` only)

## Data captured

Only the CubeSuite startup handshake (10 SysEx messages). After detection completed, pressing
physical footswitches produced **zero** additional USB-MIDI messages in either direction.

No `WriteMemory`, no slot selector, no `0x21`/`0x24`, and no spontaneous device→host events.

## Changed bytes

None after handshake.

## Result

Physical A/B/C footswitch presses do not appear on USB-MIDI even with CubeSuite connected.
Preset/section recall on the pedal is local hardware behavior; CubeSuite does not poll or mirror
those presses in this session.

Combined with experiment 018 (GUI dropdown also silent), host-visible preset switching requires an
explicit host write path (not yet captured from CubeSuite Save / apply), not footswitch observation.

## Confidence

`confirmed locally` for “no USB-MIDI on physical A/B/C while CubeSuite is connected” in this unit.

## Follow-up

Capture CubeSuite **Save** traffic, or a host-driven apply/switch if CubeSuite exposes one.
