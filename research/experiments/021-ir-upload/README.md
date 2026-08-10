# 021 — CubeSuite IR traffic

## Objective

Observe which SysEx CubeSuite sends when interacting with the IR cabinets editor, preferably a
bounded action (slot select / Factory IR) before any destructive reset.

## Safety classification

- Mode: passive USB observation
- Bytes transmitted by ToneHub: none
- External client: CubeSuite GUI
- **Risk:** IR upload/save/reset can overwrite IR slots on the device
- Avoid: Factory Reset unless explicitly intended

## Environment

- Date: 2026-08-08
- Device: VID `301A`, PID `5555`
- Capture tools: USBPcap on `\\.\USBPcap2`, USB address `10` only
- Raw capture: `research/captures/021-ir-upload.pcap`
- SHA-256: `7c8dd4ca92affb293c3a8766deb63b513017acea56c492fdc0b6768363047645`
- Curated fixture: `test/fixtures/captures/021-ir-upload.jsonl`

## Hypothesis (before decode)

IR operations may use large `WriteMemory` blocks, erase (`0x21`), and/or DSP register writes
(`0x24`) distinct from the 1-byte live preset parameter path.

## Procedure

1. Confirm USB address (`10`).
2. Start USBPcap for address `10` only.
3. Open CubeSuite and wait until detected.
4. Perform IR-related UI actions (operator reported moving several controls).
5. Close CubeSuite and stop USBPcap (`Ctrl+C`).
6. Decode offline.

## Operator log

- Action performed: “moví varios” (multiple IR UI controls)
- Slot / IR CAB values: not reported

## Data captured

128 SysEx messages total. After startup handshake, a single IR apply/persist sequence appeared
(~93–96 s into the capture). Message-type counts in the whole file:

| Type | Count | Role |
|---|---|---|
| `0x22` | 36 | memory writes |
| `0x23` | 44 | memory reads |
| `0x00` | 40 | ACKs |
| `0x24` | 3 | first local confirmation of this family |
| `0x21` | 1 | first local confirmation of erase |
| `0x11`/`0x12` | handshake | already known |

### Phase 1 — Live IR RAM (memory selector `0x04`)

1. `WriteMemory` `0x04` / `0x00000764` / len `1` / data `00` (IR flag off)
2. Message `0x24` with same 9-byte content → device `ACK` **accepted=true**
3. Chunked `WriteMemory` starting at `0x00000768` in 128-byte blocks (total payload bytes written
   on selector `0x04`: **2054**)
4. First 4 data bytes at `0x768` are `00 00 00 3f` (= float32 `0.5`), matching CubeSuite Distance
   at 50%
5. `WriteMemory` `0x04` / `0x00000764` / len `1` / data `01` (IR flag on)
6. Additional `0x24` messages around the flag/distance updates (`ACK:true`)

This matches the reported live IR RAM map (`0x764` flag, `0x768` distance, IR sample data following).

### Phase 2 — ROM persist to upload slot `0x00070000` (memory selector `0x00`)

1. Erase `0x21` content `00 00 00 07 00` (= selector `0`, address `0x00070000`)
2. Chunked `WriteMemory` from `0x00070000` in 128-byte blocks (total **2056** bytes)
3. Verify `ReadMemory` of the same region in 113-byte chunks (also totaling **2056** bytes)

Address `0x00070000` is the reported user upload IR ROM target.

### ACK behavior

- Live IR RAM / ROM `WriteMemory` (`0x22`): `ACK` content `00` (`accepted=false`), as with presets
- Message family `0x24`: `ACK` content `01` (`accepted=true`) — first time observed locally

## Changed bytes

One IR load/persist cycle. No second independent IR sequence was found despite multiple UI moves;
likely only one action (Factory IR / Save IR / import) triggered USB traffic, while slider moves
alone did not.

## Result

Confirmed locally:

- IR live path uses memory selector `0x04` around `0x764`/`0x768`
- IR ROM persist uses erase `0x21` + chunked writes at `0x00070000`
- Message families `0x21` and `0x24` are no longer only “reported”

No ToneHub IR write/erase API was added; this experiment only documents CubeSuite traffic.

## Confidence

`confirmed locally` for this IR apply+persist path on this unit/session.

## Follow-up

Decode/classify `0x21` and `0x24` in `@tonehub/cube-baby-protocol`, or capture a second IR slot
to confirm address stride (`0x1000`).
