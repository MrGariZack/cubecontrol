# 001 — Device detection

## Objective

Determine whether the desktop MIDI backend enumerates the physical CUBE Baby and record its input
and output port identities without opening either port.

## Safety classification

- Mode: passive
- Bytes transmitted: none
- Recovery plan: not applicable

## Procedure

1. Close CubeSuite and any program that may reserve MIDI ports.
2. Connect the CUBE Baby directly over USB.
3. Run `pnpm tonehub-midi list --json`.
4. Save the terminal output and environment details below.
5. Disconnect the pedal, rerun the command, and compare the port list.

## Expected identification

- Confirmed hardware identifiers: VID `0x301A`, PID `0x5555`.
- Name-only matches are candidates, not confirmed identities.
- RtMidi/WinMM may expose only port names; OS-level VID/PID correlation requires a separate,
  read-only observation.

## Result

Run on Windows 11 (`10.0.26100`) on 2026-08-08:

```text
node:input:0  | input  | USB-Midi | VID 301A | PID 5555 | confirmed
node:output:1 | output | USB-Midi | VID 301A | PID 5555 | confirmed
```

RtMidi/WinMM initially exposed only the name `USB-Midi`. A read-only
`Win32_PnPEntity` query correlated that exact MEDIA endpoint with:

```text
USB\VID_301A&PID_5555&MI_03\6&18E6BAD0&1&0003
```

The composite device and audio interface were also present as the expected parent device and
`MI_00`; neither was treated as a MIDI port. The transport now enriches Windows MIDI ports with
PnP metadata only when a port name maps to exactly one matching MEDIA record.

No MIDI port was opened and no bytes were transmitted.

## Confidence

`confirmed locally` for detection of this connected unit. A future repeat should include the
connected/disconnected comparison and record the ToneHub Git revision once the repository is
initialized.
