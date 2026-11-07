---
name: supply-layer
description: "TEMPLATE — Pull shared cross-repository assets (design tokens, components, schemas, style bibles, reference art) from a central catalog with audience-tier enforcement."
---

# Supply layer (Template)

Manages cross-repository shared assets through `<SUPPLY_CLI>` and `<SUPPLY_CATALOG>` rather than manual file copying, enforcing audience tiers and cryptographic hash locks (`<SUPPLY_LOCK_FILE>`).

## Trigger

Use when a repository needs a shared asset (design tokens, navigation components, i18n bundles, schemas, style bibles, or reference art) or whenever you are tempted to copy a shared file between repositories by hand.

## Inputs

- `<SUPPLY_CLI>`: Command-line interface for querying, pulling, adding, promoting, and verifying supplied assets.
- `<SUPPLY_CATALOG>`: Central catalog manifest and small-contract store (`<SUPPLY_STORE_DIR>`).
- `<EXTERNAL_BLOB_STORE>`: External storage path for large binary assets referenced by path and SHA-256 hash.
- `<TARGET_REPO>`: Consumer repository path receiving the pulled asset.
- `<SUPPLY_LOCK_FILE>`: Lockfile written in `<TARGET_REPO>` (e.g., `supply.lock.json`) recording pulled asset IDs, versions, and hashes.

## Steps

1. List available catalog assets and their audience tiers before creating or copying any shared file:
   ```sh
   <SUPPLY_CLI> list [--audience <AUDIENCE_TIER>]
   ```
2. Check for drift or audience-law violations in `<TARGET_REPO>`:
   ```sh
   <SUPPLY_CLI> status <TARGET_REPO>
   ```
3. Pull an approved (`supplied`) asset into `<TARGET_REPO>/supply/<asset-id>/` and update `<TARGET_REPO>/<SUPPLY_LOCK_FILE>`:
   ```sh
   <SUPPLY_CLI> pull <asset-id> --to <TARGET_REPO> --apply
   ```
4. If you discover a duplicate or improved shared asset in a repository, register the best copy as a `candidate` without deleting existing copies, and open a `<WORKSTACK_FILE>` thread:
   ```sh
   <SUPPLY_CLI> add <asset-id> --from <path> --kind <kind> --audience <AUDIENCE_TIER> --origin <repo>
   ```
5. Verify source files against catalog hashes after any catalog update:
   ```sh
   <SUPPLY_CLI> verify
   ```

## Gates

- **Audience law**: Enforce strict ordering `client-safe` < `public` < `personal`. An asset tagged `personal` must never be pulled into a `public` or `client-safe` repository; when uncertain, default new candidates to `personal` until the owner downgrades them.
- **No consumer edits**: Never hand-edit pulled files under `<TARGET_REPO>/supply/<asset-id>/`. Modify the canonical source in `<SUPPLY_CATALOG>`, have the owner run `<SUPPLY_CLI> promote <asset-id>`, and re-pull.
- **No unpromoted pulls**: `candidate` assets cannot be pulled into consumers; only owner-promoted `supplied` assets are deliverable.
- **Binary storage split**: Keep small contracts/tokens in `<SUPPLY_STORE_DIR>` and store large binaries in `<EXTERNAL_BLOB_STORE>` referenced by path and SHA-256 hash.

## Outputs

- Pulled asset files in `<TARGET_REPO>/supply/<asset-id>/`.
- Updated `<TARGET_REPO>/<SUPPLY_LOCK_FILE>` with asset provenance and SHA-256 digests.
- Verification status from `<SUPPLY_CLI> status` and `<SUPPLY_CLI> verify`.

## Placeholders

| Placeholder | Meaning |
| --- | --- |
| `<SUPPLY_CLI>` | CLI entrypoint for the asset catalog (e.g., `uika supply` or `node tools/supply.mjs`) |
| `<SUPPLY_CATALOG>` | Path to the catalog manifest JSON listing asset IDs, status (`candidate`/`supplied`), audience, and hashes |
| `<SUPPLY_STORE_DIR>` | Directory inside the control repo holding small shared contracts and token files |
| `<EXTERNAL_BLOB_STORE>` | Local or mounted directory for large binary assets referenced by content hash |
| `<TARGET_REPO>` | Consumer repository path |
| `<SUPPLY_LOCK_FILE>` | Lockfile in `<TARGET_REPO>` tracking pulled assets and their SHA-256 hashes (e.g., `supply.lock.json`) |
| `<AUDIENCE_TIER>` | Visibility classification (`client-safe`, `public`, or `personal`) |
| `<WORKSTACK_FILE>` | Per-repo active thread ledger filename (e.g., `WORKSTACK.md`) |
