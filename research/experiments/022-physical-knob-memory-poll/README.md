# 022 — Physical knob vs readable memory poll

## Objective

Determine whether turning a physical pedal knob (Gain) changes any memory region that ToneHub can
read over USB (`0x80000000` live and/or `0x00000000` stored bank).

## Safety classification

- Mode: read-only transmission
- Bytes transmitted: identity request + `ReadMemory` (`0x23`) only
- No writes, erase, Save, or IR commands
- Recovery: not applicable

## Environment

- Date: 2026-08-08
- Device: VID `301A`, PID `5555`
- Tooling: `pnpm tonehub-midi read-memory ... --confirm-read-only`
- CubeSuite: closed (exclusive MIDI ports)

## Hypothesis (before run)

1. Physical Gain updates live RAM at `memory=5` / `address=0x80000000` offset `1`, or
2. Physical Gain only affects local DSP and USB reads stay unchanged.

## Procedure

1. Close CubeSuite.
2. Baseline read live 16 bytes at `0x80000000` and bank 48 bytes at `0x00000000`.
3. Operator turns physical Gain substantially (several steps).
4. Repeat the same two reads.
5. Compare Gain byte (offset `1` in each 16-byte slot / live block).

## Operator log

- Physical action: operator turned physical Gain substantially between baseline and after
- Baseline live: **timeout** — device does not answer `ReadMemory` at `0x80000000`
  (tried length `16` and `1` at `0x80000000` / `0x80000001`; CubeSuite startup also never reads this region)
- After live: n/a (unreadable)
- Baseline bank (`2026-08-09T03:19:25.008Z`):
  `05030306056405070808010101000000050304064173185008080101010000000600030a59440b0a0805010101000000`
  - A Gain (offset 1) = `3`
  - B Gain (offset 17) = `3`
  - C Gain (offset 33) = `0`
- After bank (`2026-08-09T03:21:16.418Z`):
  `05030306056405070808010101000000050304064173185008080101010000000600030a59440b0a0805010101000000`
  - identical 48 bytes; Gain A/B/C unchanged

## Result

Physical Gain does **not** update USB-readable bank memory at `memory=5` / `0x00000000`.
Live address `0x80000000` is not readable via `ReadMemory` (write-only from host perspective).

Implication for ToneHub: reflecting physical knobs over USB is not possible with a simple
memory poll of the known bank/live addresses. Pedal state for knobs appears local-only unless
changed/saved through the host protocol.

## Confidence

High for bank unchanged (byte-identical before/after).
High for live-read negative at `0x80000000` (timeouts + no CubeSuite startup reads of that region).
