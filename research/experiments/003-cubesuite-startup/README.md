# 003 — CubeSuite startup handshake

## Objective

Observe the official CubeSuite startup exchange without transmitting from ToneHub, then establish
whether the pedal sends real USB-MIDI responses.

## Safety classification

- Mode: passive USB observation
- Bytes transmitted by ToneHub: none
- External client: official CubeSuite, opened without changing parameters

## Environment

- Date: 2026-08-08
- OS: Windows 11 24H2, build 26100
- Device: USB composite device, VID `301A`, PID `5555`
- MIDI interface: `MI_03`, WinMM name `USB-Midi`
- Capture tools: USBPcap 1.5.4.0 and Wireshark/TShark 4.6.7
- USBPcap filter: `\\.\USBPcap2`
- Selected USB address: `11` only; keyboard and mouse traffic was excluded

## Procedure

1. Start USBPcap on USB address 11 with descriptor injection.
2. Open CubeSuite.
3. Wait for CubeSuite to detect the pedal; do not change parameters.
4. Close CubeSuite.
5. Stop USBPcap.

## Data captured

- Raw file: `research/captures/003-cubesuite-startup.pcap`
- Format: pcap, USBPcap encapsulation
- Packets: 28
- Duration: 100.379934 seconds
- Size: 1,937 bytes
- SHA-256: `4de062061953fe36f09a6811908ab1834a3df84572d2b0b2c5f4121b77d24e05`
- Curated fixture: `test/fixtures/captures/003-cubesuite-startup.json`

The raw pcap is intentionally ignored by Git. The curated fixture contains only USB-MIDI payloads
from the selected pedal and is safe for deterministic tests.

## Observations

- Host-to-device USB-MIDI traffic uses endpoint `0x03`.
- Device-to-host USB-MIDI traffic uses endpoint `0x83`.
- USB-MIDI event packets carry SysEx split into four-byte USB event records.
- CubeSuite sent several requests and the device returned several real responses.
- One response spans two USB transfers, confirming that callback boundaries are not message
  boundaries.
- Physical controls remained silent without the CubeSuite exchange.

## Changed bytes

Not applicable. This experiment compared traffic direction and framing, not parameter mutations.

## Result

Real device responses are physically confirmed. The next safe step is offline reconstruction and
decoding of these captured SysEx messages. No ToneHub command may transmit during that work.

## Confidence

`confirmed locally`.
