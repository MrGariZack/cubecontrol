# 002 — Passive MIDI monitor

## Objective

Verify that ToneHub can open the CUBE Baby MIDI input and receive complete MIDI messages without
opening an output or transmitting bytes.

## Safety classification

- Mode: passive
- Bytes transmitted: none
- Recovery plan: close the input and reconnect USB if the OS driver stops reporting the endpoint

## Procedure

1. Close CubeSuite and other MIDI clients.
2. Run `pnpm tonehub-midi monitor --input node:input:0 --raw`.
3. Change one physical pedal control or footswitch once.
4. Wait two seconds and repeat the same action.
5. Stop with Ctrl+C.
6. Record raw chunks and assembled messages in a capture experiment.

## Data captured

Two passive sessions were run on 2026-08-08:

- 10 seconds: input opened successfully, 0 chunks, 0 complete messages.
- 120 seconds: input opened successfully, 0 chunks, 0 complete messages.
- 60 seconds with repeated physical button presses and control changes: 0 chunks, 0 complete
  messages.

No raw capture file was produced because there were no events.

## Changed bytes

None observed.

## Hypothesis

The device may emit MIDI or SysEx when a physical control changes. It is also possible that it is
silent unless first initialized by CubeSuite; passive silence must not be interpreted as transport
failure.

## Result

The transport can exclusively open and close `node:input:0` (`USB-Midi`) without error. Physical
controls do not produce unsolicited MIDI on this unit. Experiment 003 later confirmed that the
device does respond over USB-MIDI after CubeSuite requests, and experiment 005 confirmed ToneHub
can elicit the identity response with the exact captured request.

## Confidence

`confirmed locally` for opening/closing the real input and for the conclusion that physical
controls are silent without a prior host handshake.
