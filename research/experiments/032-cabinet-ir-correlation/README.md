# 032 — Cabinet → IR RAM/ROM correlation

## Objective

Determine whether changing the live Cabinet parameter (0–8) loads a corresponding IR ROM
sector into IR live RAM (`memory=4`, `0x768`).

## Safety classification

- Mode: mutating live only (Cabinet `WriteMemory` at `0x80000009`)
- No ROM erase/write
- Restores Cabinet from bank slot A after the sweep

## Environment

- Date: 2026-08-10
- Device: VID `301A`, PID `5555`
- Tooling: `pnpm tonehub-midi probe-cabinet-ir --confirm-write`

## Hypothesis

1. Cabinet `N` (0–7) selects ROM at `0x69000 + N×0x1000` into live IR audio.
2. Cabinet `8` maps to upload slot `0x70000` or leaves RAM unchanged.
3. Live IR at `0x768` = distance float32 + 512 samples; ROM audio starts at sector offset 8.

## Procedure

1. Close CubeSuite.
2. Read bank (Cabinet restore target from slot A).
3. Fingerprint ROM slots 0–7 (72-byte headers).
4. For Cabinet 0…8: write live → read live IR → score vs each ROM fingerprint.
5. Restore Cabinet to bank A value.

## Operator log

Run `2026-08-10T19:21:29.942Z` (bank A/B Cabinet=8, C=5). Raw: `probe-result.json`.

| Cabinet | Live IR changed | Best ROM slot | Address | Match |
|---|---|---|---|---|
| 0 | no (stale) | 7 | `0x70000` | 60/60 (leftover) |
| 1 | yes | 0 | `0x69000` | 60/60 |
| 2 | yes | 1 | `0x6a000` | 60/60 |
| 3 | yes | 2 | `0x6b000` | 60/60 |
| 4 | yes | 3 | `0x6c000` | 60/60 |
| 5 | yes | 4 | `0x6d000` | 60/60 |
| 6 | yes | 5 | `0x6e000` | 60/60 |
| 7 | yes | 6 | `0x6f000` | 60/60 |
| 8 | yes* | 7 | `0x70000` | 60/60 |

\* vs baseline already at upload IR, `liveChangedFromBaseline=false` for Cabinet 8 only because baseline was already that image; Cabinet 0 likewise left RAM untouched.

Live layout after load (marker-01 cabinets): distance float = ROM volume (bytes 4–7);
samples = ROM audio from offset 8. Non-marker slots (0/6/7) load similarly from their volume/audio region.

## Result

**Confirmed mapping on this unit:**

```text
Cabinet 1..8  →  ROM slot (Cabinet - 1) at 0x69000 + (Cabinet - 1)×0x1000
Cabinet 0     →  no IR RAM reload (previous live IR remains)
Cabinet 8     →  upload ROM slot 7 at 0x70000
```

Hypothesis (1) was off-by-one: factory Cabinets are **1-based** relative to our ROM index 0 at `0x69000`.

## Confidence

`confirmed locally` for live Cabinet → IR RAM load mapping on this firmware.
