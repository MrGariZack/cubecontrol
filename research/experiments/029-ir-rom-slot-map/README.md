# 029 — IR ROM slot map (read-only)

## Objective

Confirm on this unit which IR ROM base address and stride hold cabinet slots, by reading only
the first bytes of candidate sectors (no erase/write).

## Safety classification

- Mode: read-only transmission
- Bytes transmitted: identity + `ReadMemory` of small headers only
- No erase, ROM write, or live IR apply in this experiment

## Environment

- Date: 2026-08-10
- Device: VID `301A`, PID `5555`
- Tooling: `pnpm tonehub-midi scan-ir-rom --confirm-read-only --json`

## Hypothesis

1. Slot headers start with presence marker `01 00 00 00` (or empty/`FF` if unused).
2. Upload slot `0x00070000` appears in the same grid.
3. Stride is `4096` (`0x1000`), not `2048`.

## Procedure

1. Close CubeSuite.
2. Scan candidate bases/slots with header reads (16 bytes).
3. Tabulate address → header hex → presence/volume guess.
4. Update protocol-status with confirmed local map.

## Operator log

```text
pnpm tonehub-midi scan-ir-rom \
  --input node:input:0 --output node:output:1 \
  --confirm-read-only --json --timeout 5000
```

Raw JSON: `scan-result.json` (same directory).

## Result

**Confirmed locally:**

| Field | Value |
|---|---|
| Stride | `0x1000` (4096) |
| Factory base | `0x00069000` |
| Upload slot | `0x00070000` = factory index **7** |
| Empty sentinel | `0x00071000` all zeros |
| Extended prelude | `0x00068000` readable but not a standard `01 00 00 00` cabinet header |

### Factory grid (`0x69000 + i×0x1000`)

| i | Address | Presence | Notes |
|---|---|---|---|
| 0 | `0x69000` | other | Header `00…003f` + floats; vol≈0.5 |
| 1 | `0x6a000` | marker-01 | vol≈0.69 |
| 2 | `0x6b000` | marker-01 | vol≈0.70 |
| 3 | `0x6c000` | marker-01 | vol≈0.74 |
| 4 | `0x6d000` | marker-01 | vol≈0.74 |
| 5 | `0x6e000` | marker-01 | vol≈0.74 |
| 6 | `0x6f000` | other | Header style like slot 0; vol≈0.5 |
| 7 | `0x70000` | other | **User upload slot** (post-028 payload header) |
| 8 | `0x71000` | zero | Unused / empty |

Scanning from `0x68000` overlaps the factory grid starting at index 1; only `0x68000` is unique and looks like metadata (`01 07 00 00…`), not a cabinet IR header.

### Implications

- Physical ROM sectors are **4096 B**; do not write 2048-only payloads into a slot after erase.
- Safe multi-slot addressing for this unit: `address = 0x69000 + cabinetIndex * 0x1000` for `cabinetIndex` in `0…8`.
- Persist to non-upload cabinets remains out of scope until an explicit per-slot experiment; upload path stays `0x70000`.

## Confidence

High for stride/base/upload placement on this firmware. Medium for interpreting non-`marker-01` headers as “occupied factory IR” vs alternate layout — content beyond 16 B was not decoded.
