# 023 — Preset bank 16-byte layout / offsets 13–15

## Objective

Confirm that the USB-readable 48-byte bank at memory `0x05` / address `0x00000000`
is three 16-byte slots (A/B/C) whose offsets `0`–`12` match the live-write map, and
classify bytes `13`–`15` (padding vs unknown fields).

## Safety classification

- Mode: read-only transmission
- Bytes transmitted: identity request (handshake) + `ReadMemory` (`0x23`) only
- No writes, erase, Save, or IR commands
- Recovery: not applicable

## Environment

- Date: 2026-08-10
- Device: VID `301A`, PID `5555`
- Tooling: `pnpm tonehub-midi read-memory ... --confirm-read-only [--decode]`
- CubeSuite: closed (exclusive MIDI ports)

## Hypothesis

1. Each 16-byte slot uses the same field map as live writes at `0x80000000+offset`
   (offsets `0`–`12`).
2. Bytes `13`–`15` are unused padding (`00`) on this unit, matching upstream reports.

## Procedure

1. Close CubeSuite.
2. Read 48 bytes from memory `5`, address `0x00000000`.
3. Split into slots A/B/C (16 bytes each).
4. Label offsets `0`–`12` with the confirmed live-parameter names.
5. Record whether bytes `13`–`15` are zero or carry values across slots.
6. Add a ToneHub read-only decoder + CLI `--decode` for bank layouts.

## Operator log

- Bank read (`2026-08-10T18:06:34.356Z`):
  `05030306056405070808010101000000050304064173185008080101010000000600030a59440b0a0805010101000000`
  (identical to experiment 022 baseline)

### Slot decode

| Offset | Field | A | B | C |
|---|---|---|---|---|
| 0 | Type | 5 | 5 | 6 |
| 1 | Gain | 3 | 3 | 0 |
| 2 | Tone | 3 | 4 | 3 |
| 3 | Reverb | 6 | 6 | 10 |
| 4 | Feedback | 5 | 65 | 89 |
| 5 | Volume | 100 | 115 | 68 |
| 6 | Time | 5 | 24 | 11 |
| 7 | Mix | 7 | 80 | 10 |
| 8 | Modulation | 8 | 8 | 8 |
| 9 | Cabinet | 8 | 8 | 5 |
| 10 | IRSection | 1 | 1 | 1 |
| 11 | DelaySection | 1 | 1 | 1 |
| 12 | ToneSection | 1 | 1 | 1 |
| 13–15 | trailing | `00 00 00` | `00 00 00` | `00 00 00` |

## Result

- Bank is three contiguous 16-byte slots A/B/C at `memory=5` / `address=0x00000000`.
- Offsets `0`–`12` align with the confirmed live WriteMemory map (exps 004–017).
- Bytes `13`–`15` are `00` in all three slots on this unit → treat as padding (confidence:
  local observation; no CubeSuite field was seen writing these bytes).
- ToneHub now exposes `decodePresetSlot` / `decodePresetBank` and CLI `--decode`.

## Confidence

`confirmed locally` for 0–12 layout match and trailing zeros on this bank image.
Padding semantics remain observational (no deliberate non-zero write of 13–15 observed).

## Follow-up

Safe next steps: ToneHub `WriteMemory` experiment for a single live offset, or read-only
probes of memory selector `0x00` (`0x2100` / `0x3000`).
