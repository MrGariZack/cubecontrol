# ToneHub research

This directory records evidence, experiments, and open questions. Conclusions are classified as:

- **Confirmed locally:** reproduced on the target unit and linked to a raw capture.
- **Corroborated:** independently present in multiple references, not yet reproduced locally.
- **Reported:** claimed by one source or one hardware/firmware variant.
- **Hypothesis:** plausible interpretation that still requires an experiment.

Upstream repositories live in `upstream/` only as local, ignored research inputs. ToneHub must not
copy code from them. In particular, `cuvave-midi` is GPL-3.0.

Raw captures are ignored by default. Curated, reviewed fixtures belong in
`test/fixtures/captures/`, alongside provenance metadata.
