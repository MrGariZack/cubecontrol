# Reference analysis

Reviewed on 2026-08-08.

## `F1LIP3/cubeBabyPresetsLive`

- Source: <https://github.com/F1LIP3/cubeBabyPresetsLive>
- Reviewed revision: `9832c90b720b459e0dcce22cee81cdcea60b6462`
- Stack: TypeScript, React, Electron, Capacitor, native Android MIDI plugin.
- License status: GitHub reports no license and the clone has no `LICENSE` file. The README says
  MIT, which is not sufficient permission to copy code.
- Useful evidence: platform separation, protocol message examples, operational reports about
  preset and IR behavior.
- Limitation: much of the hardware behavior is reported for another unit/firmware and must be
  reproduced.

## `pferreir/cuvave-midi`

- Source: <https://github.com/pferreir/cuvave-midi>
- Reviewed revision: `1ec042829751a9f32e3692612ef7b734531e2e0c`
- Stack: Rust with `nom`, `serde`, `midir`, and CLI examples.
- License: GPL-3.0.
- Useful evidence: compact parser model, 7-bit codec examples, checksum tests, and memory-read
  experiments.
- Reuse decision: do not copy, translate line-for-line, link, or vendor its code. Reimplement only
  independently described behavior and validate it with ToneHub captures.

## Turbofish reverse-engineering article

- Source: <https://garden.turbofish.cc/notes/Reverse-engineering-the-Cuvave-Cube-Baby>
- License: no explicit reuse license identified.
- Useful evidence: methodology, decoded envelope, 7-bit packing explanation, checksum and memory
  operation interpretation.
- Limitation: it is not a manufacturer specification.

## Cross-source conclusions

USB-MIDI SysEx, `F0`/`F7` framing, the decoded `00 59` magic, 7-bit packing and the major message
families are corroborated. Addresses, command semantics, ACK behavior, maximum write sizes, preset
layout and all IR behavior remain unconfirmed for the target VID `301A` / PID `5555`.
