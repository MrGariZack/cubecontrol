# CUBE Baby protocol status

## Confirmed locally

- Transport: USB MIDI 1.0 SysEx on interface `MI_03`.
- USB endpoints: host-to-device `0x03`, device-to-host `0x83`.
- Outer framing: `F0 <7-bit payload> F7`.
- Decoded prefix: `00 59`.
- Decoded envelope: message type, three-byte little-endian content length, content, checksum.
- Checksum: one's complement of the overflowing sum of decoded content bytes.
- Identity request: message type `0x11`, empty content.
- Identity response: message type `0x11`; reported name `SINCO-CubeBaby` occupies 19 bytes
  including trailing spaces, followed by eight unclassified metadata bytes.
- Memory read request/response: message type `0x23`, memory byte, LE32 address, LE24 length.
- CubeSuite reads 48 bytes from selector `0x05`, address `0x00000000` during startup.
- CubeSuite also reads 20 bytes from selector `0x00`, address `0x00002100`, and one byte from
  selector `0x00`, address `0x00003000`.
- Message type `0x12` participates in startup but its semantics remain unknown.
- Gain changes from CubeSuite are `WriteMemory` (`0x22`) to memory `0x05`, address
  `0x80000001`, length `1`, data = Gain value.
- Tone changes from CubeSuite are `WriteMemory` (`0x22`) to memory `0x05`, address
  `0x80000002`, length `1`, data = Tone value (observed up to `13`, above Gain's 0–7 range).
- Reverb changes from CubeSuite are `WriteMemory` (`0x22`) to memory `0x05`, address
  `0x80000003`, length `1`, data = Reverb value.
- Volume changes from CubeSuite are `WriteMemory` (`0x22`) to memory `0x05`, address
  `0x80000005`, length `1`, data = Volume value (observed `96`–`109`, consistent with 0–127).
- Delay Time changes from CubeSuite are `WriteMemory` (`0x22`) to memory `0x05`, address
  `0x80000006`, length `1`, data = Time value (observed `5`–`10`, consistent with 0–31).
- Feedback changes from CubeSuite are `WriteMemory` (`0x22`) to memory `0x05`, address
  `0x80000004`, length `1`, data = Feedback value (observed `6`–`15` in this sweep).
- Mix changes from CubeSuite are `WriteMemory` (`0x22`) to memory `0x05`, address
  `0x80000007`, length `1`, data = Mix value (observed `7`–`14` in this sweep).
- Modulation changes from CubeSuite are `WriteMemory` (`0x22`) to memory `0x05`, address
  `0x80000008`, length `1`, data = Modulation value (observed up to `15`).
- Cabinet changes from CubeSuite are `WriteMemory` (`0x22`) to memory `0x05`, address
  `0x80000009`, length `1`, data = Cabinet value (full sweep `0`–`8`).
- Type / Drive Type changes from CubeSuite are `WriteMemory` (`0x22`) to memory `0x05`, address
  `0x80000000`, length `1`, data = Type value (full sweep `0`–`8`).
- IRSection toggle changes from CubeSuite are `WriteMemory` (`0x22`) to memory `0x05`, address
  `0x8000000a`, length `1`, data = `0`/`1`.
- DelaySection toggle changes from CubeSuite are `WriteMemory` (`0x22`) to memory `0x05`, address
  `0x8000000b`, length `1`, data = `0`/`1`.
- ToneSection toggle changes from CubeSuite are `WriteMemory` (`0x22`) to memory `0x05`, address
  `0x8000000c`, length `1`, data = `0`/`1`.
- Device answers those writes with `ACK` (`0x00`) content `00` (`accepted=false`), while the UI
  parameter still tracks.
- Confirmed live-write map (13 fields) at base `0x80000000`, memory selector `0x05`:

  | Offset | Field |
  |---|---|
  | 0 | Type |
  | 1 | Gain |
  | 2 | Tone |
  | 3 | Reverb |
  | 4 | Feedback |
  | 5 | Volume |
  | 6 | Time |
  | 7 | Mix |
  | 8 | Modulation |
  | 9 | Cabinet |
  | 10 | IRSection (A / IR+REV) |
  | 11 | DelaySection (B / MOD+DLY) |
  | 12 | ToneSection (C / AMP) |

Evidence: `research/experiments/004-parameter-gain` through
`research/experiments/017-parameter-tone-section`, plus startup
`research/experiments/003-cubesuite-startup/README.md`.

## Confirmed locally (stored bank layout)

- Memory `0x05` / address `0x00000000` / length `48` is three 16-byte slots A, B, C.
- Each slot uses the same offsets `0`–`12` as the live WriteMemory map above.
- Bytes `13`–`15` are `00` in all three slots on the observed bank image (padding /
  unused; no local evidence of a CubeSuite field there).
- ToneHub decoder: `decodePresetSlot` / `decodePresetBank` in `@tonehub/cube-baby-protocol`;
  CLI `read-memory --decode` for length `48`.
- Evidence: `research/experiments/023-preset-bank-layout/README.md`.

## Confirmed locally (negative / behavioral)

- CubeSuite preset dropdown A/B/C switch emits no SysEx after startup. All three 16-byte slots are
  already loaded by the startup 48-byte read at memory `0x05` / address `0x00000000`.
  Evidence: `research/experiments/018-preset-switch-a-b-c/README.md`.
- Physical footswitches A/B/C also emit no USB-MIDI while CubeSuite is connected; recall stays
  local to the pedal.
  Evidence: `research/experiments/019-footswitch-a-b-c/README.md`.
- Physical Gain knob does not change the USB-readable 48-byte bank at memory `0x05` /
  address `0x00000000` (byte-identical before/after).
- `ReadMemory` of live base `0x80000000` (lengths `1` and `16`) times out; CubeSuite startup also
  never reads that region. Live addresses appear host-write-only from USB.
  Evidence: `research/experiments/022-physical-knob-memory-poll/README.md`.

## Confirmed locally (ToneHub live write)

- ToneHub can send one-byte live `WriteMemory` (`0x22`) in the approved window
  `memory=5` / `0x80000000`–`0x8000000c`.
- Gain write at `0x80000001` returns `ACK` `accepted=false` / `rawValue=0`, matching CubeSuite.
- Without Save, the stored 48-byte bank at `0x00000000` stays unchanged.
- CLI: `write-memory --confirm-write` (single-byte live window only).
- Evidence: `research/experiments/024-tonehub-live-write-gain/README.md`.
- `encodeSevenBit` must pad packed payloads to `ceil(clearLength * 8 / 7)` septets; otherwise some
  writes (e.g. Volume) decode locally but receive no device ACK.

## Confirmed locally (ToneHub Save)

- ToneHub can persist one field via CubeSuite’s Save path: live write → 48-byte bank write →
  verify read.
- CLI: `save-param --confirm-save` (rewrites full A+B+C bank image with one patched byte).
- Local proof: Volume slot A `100↔101` with verify + restore.
- Evidence: `research/experiments/025-tonehub-save-param/README.md`.

## Confirmed locally (ToneHub backup / restore)

- `backup-bank` writes format `tonehub-cube-baby-bank-v1` (48-byte `dataHex` + decoded slots).
- `restore-bank --confirm-restore` writes the bank, pushes one slot’s offsets `0`–`12` to live RAM,
  then verify-reads the bank.
- Local proof: Volume A `100→102→100` via backup → save-param → restore.
- Evidence: `research/experiments/026-tonehub-bank-backup-restore/README.md`.

## Confirmed locally (Save / persist)

- CubeSuite Save path observed:
  1. live `WriteMemory` to `0x80000000+paramOffset`, then
  2. `WriteMemory` of the full 48-byte A+B+C bank to memory `0x05` / address `0x00000000`, then
  3. `ReadMemory` of that same 48-byte bank for verify.
- Both writes still receive `ACK` content `00` (`accepted=false`).
- Evidence: `research/experiments/020-cubesuite-save/README.md`.

## Confirmed locally (IR)

- Live IR apply uses memory selector `0x04`:
  - flag at `0x00000764`
  - distance/header at `0x00000768` (float32; `0.5` observed for Distance 50%)
  - chunked sample payload (2052 bytes from `0x768`) via `WriteMemory` (`0x22`)
- Register/DSP writes (`0x24`) content = memory + address LE32 + value LE32; ACK `accepted=true`.
- ROM persist uses erase `0x21` then chunked `WriteMemory` at `0x00070000` (upload slot), then
  verify reads (113-byte chunks).
- ToneHub live replay: `apply-live-ir --confirm-live-ir`.
- ToneHub ROM persist: `persist-ir-rom --confirm-ir-rom-persist` (upload slot only; verified locally).
- IR ROM slot map (read-only headers): stride `0x1000`, factory base `0x00069000`,
  upload `0x00070000` = index 7, empty `0x00071000`, prelude `0x00068000` not a std cabinet header.
  CLI: `scan-ir-rom --confirm-read-only`.
- Full sector dump (4096 B): CubeSuite image is 2056 B; factory tails are zeros, upload tails after
  erase+2056-write are `0xFF`. CLI: `dump-ir-rom --slot N`, `persist-ir-rom --slot 0..7`
  (`0..6` needs `--confirm-overwrite-cabinet`).
- Full-sector persist: 2056 payloads are zero-padded to 4096 by default (`--no-pad-sector` to keep
  CubeSuite FF-tail). Factory round-trip on slot 1 (backup → padded write → restore) verified
  byte-identical (`research/experiments/031-ir-rom-factory-roundtrip/README.md`).
- Live Cabinet → IR RAM: Cabinet `1..8` loads ROM slot `Cabinet-1`
  (`0x69000 + (Cabinet-1)×0x1000`); Cabinet `0` does not reload IR RAM. CLI: `probe-cabinet-ir`.
  IR RAM reloads only when the Cabinet **value changes** (nudge required if already selected).
- WAV → IR: PCM/float WAV → 512 samples @ 48 kHz → 4096-byte sector; persist + Cabinet load
  verified on upload slot (`import-ir-wav`).
- IR → WAV: ROM sector primary samples export to PCM16 @ 48 kHz (`export-ir-wav`); PCM round-trip
  keeps all 512 samples within 1 LSB (`research/experiments/034-export-ir-wav/README.md`).
- One-shot load: `load-ir --confirm-load` (default slot 7 + Cabinet 8, optional `--backup`)
  verified `liveMatch=68/68` (`research/experiments/035-load-ir/README.md`).
- Evidence: `research/experiments/021-ir-upload/README.md`,
  `research/experiments/027-tonehub-live-ir/README.md`,
  `research/experiments/028-tonehub-ir-rom-persist/README.md`,
  `research/experiments/029-ir-rom-slot-map/README.md`,
  `research/experiments/030-ir-rom-slot-dump/README.md`,
  `research/experiments/031-ir-rom-factory-roundtrip/README.md`,
  `research/experiments/032-cabinet-ir-correlation/README.md`,
  `research/experiments/033-import-ir-wav/README.md`,
  `research/experiments/034-export-ir-wav/README.md`,
  `research/experiments/035-load-ir/README.md`.

## Corroborated, pending local reproduction

- Exact semantics of every `0x24` payload variant.

## Reported, not confirmed on this device

- Init empty/`ACK:true` handshake semantics before identity.
- Semantics of memory selectors `00`, `04`, and `05` beyond the observed reads/writes.
- Whether bank trailing bytes `13`–`15` can ever be non-zero on this firmware.
- Erase, register/DSP (`0x24`), and persist/save semantics beyond the observed Save path.
- Misleading negative ACK behavior.
- 128-byte write limit.
- Exact float32 sample layout / IR distance semantics beyond observed headers.
- Whether the pedal DSP ever reads past the first 2056 bytes of a ROM sector.

## Open questions

- Can any USB-readable region reflect physical knob position (beyond the known bank / live map)?
- What does startup message type `0x12` mean?
- What do the eight identity metadata bytes represent?
- How are requests correlated with responses, errors, and timeouts?
- Are different branded/firmware CUBE Baby units protocol-compatible?

## Safety rule

CLI transmission requires explicit confirmation flags. Allowed today: captured identity request,
reviewed `ReadMemory` (`0x23`), single-byte live `WriteMemory` (`0x22`) in
`memory=5` / `0x80000000`–`0x8000000c` with `--confirm-write`, Save via `save-param --confirm-save`,
bank backup/restore via `backup-bank` / `restore-bank --confirm-restore`, live IR via
`apply-live-ir --confirm-live-ir`, IR ROM persist via
`persist-ir-rom --confirm-ir-rom-persist` (`--slot 7` default; `0..6` also needs
`--confirm-overwrite-cabinet`), IR ROM header scan via `scan-ir-rom --confirm-read-only`,
full sector dump via `dump-ir-rom --confirm-read-only`, Cabinet↔IR probe via
`probe-cabinet-ir --confirm-write`, WAV import/export via `import-ir-wav` / `export-ir-wav`,
and one-shot `load-ir --confirm-load` (device ops need the matching confirm flags).
