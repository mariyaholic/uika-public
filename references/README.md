# references/

The creative **reference library** registry (schema `uika.reference-library.v1`).

- `library.json` is the committed index: ids, kinds, provenance, rights notes, status.
- Payloads (the actual videos/images/themes) live in a **local store you own**
  (`root` in the registry — create `references/store/` or point it anywhere).
- Rights law: reference collections are **study-only** — never redistribute them,
  never ship them in a product. The registry records provenance, not payloads.
- `uika lint` checks paths without hashing content. `uika ref check` verifies
  versioned content hashes; legacy hashes are reported as unverified. Run
  `uika ref hash <id> --json` to compute a read-only baseline for review. It
  reads the full collection and may take time. Update `hashVersion`, `sha256`,
  `files` and `bytes` together after review. A new baseline cannot prove what
  bytes existed when a legacy shape hash was recorded.
- Reference paths are relative to the selected estate root unless absolute.
  The selected collection root may be a trusted junction; links inside the
  collection are rejected. Resolution cannot prevent concurrent path changes.

