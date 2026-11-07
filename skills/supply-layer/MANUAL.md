# Manual: Building Your Own Cross-Repo Asset Supply Plane (`supply-layer`)

This manual explains to another user's agent how to build the cross-repository asset catalog (`<SUPPLY_CATALOG>`) and CLI (`<SUPPLY_CLI>`) that `skills/supply-layer` depends on.

---

## 1. What to Build

Build a content-addressed asset catalog and CLI that shares design tokens, UI components, JSON schemas, style bibles, and reference assets across multiple repositories while preventing accidental leakage of private/internal assets into public or client repositories.

### Core Invariants
1. **Single Canonical Source**: Consumers never edit `<TARGET_REPO>/supply/<id>/`; edits happen in `<SUPPLY_STORE_DIR>` and are pulled via lockfile.
2. **Audience Tier Enforcement**: Every asset and every repository has an audience classification (`client-safe` < `public` < `personal`). Pulling a higher-sensitivity asset into a lower-sensitivity repo is blocked by the CLI.
3. **Two-Stage Promotion (`candidate` -> `supplied`)**: Agents can register discovered assets as `candidate`, but only human-promoted `supplied` assets can be pulled by consumers.

---

## 2. Minimal Components

1. **Catalog Manifest (`<SUPPLY_CATALOG>`, e.g., `supply/catalog.json`)**:
   ```json
   {
     "repos": {
       "marketing-site": { "audience": "public", "path": "/path/to/marketing-site" },
       "client-portal": { "audience": "client-safe", "path": "/path/to/client-portal" },
       "internal-lab": { "audience": "personal", "path": "/path/to/internal-lab" }
     },
     "assets": {
       "canonical-tokens": {
         "kind": "design-tokens",
         "status": "supplied",
         "audience": "public",
         "version": 2,
         "origin": "internal-lab",
         "storePath": "supply/store/canonical-tokens",
         "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
         "toolchain": "none"
       }
     }
   }
   ```
2. **Storage Directories**:
   - `<SUPPLY_STORE_DIR>` (`supply/store/<id>/`): version-controlled directory for small text contracts (CSS tokens, schemas, rubrics).
   - `<EXTERNAL_BLOB_STORE>`: external directory for large media/binaries (fonts, reference packs) where `catalog.json` stores the external file path + `sha256` instead of checking binaries into git.
3. **Consumer Lockfile (`<TARGET_REPO>/supply.lock.json`)**:
   - Records each pulled `<id>`, `version`, `sha256`, `audience`, and timestamp inside `<TARGET_REPO>`.
4. **Supply CLI (`<SUPPLY_CLI>`)**:
   - Implements `list`, `add`, `promote`, `pull`, `status`, and `verify`.

---

## 3. How to Wire It

1. **Audience Matrix Check**:
   - Rank tiers numerically: `{"client-safe": 1, "public": 2, "personal": 3}`.
   - In `<SUPPLY_CLI> pull <id> --to <repo>`, require `rank[asset.audience] <= rank[repo.audience]`. If `rank[asset.audience] > rank[repo.audience]`, abort with a non-zero exit code.
2. **Candidate vs. Supplied Gate**:
   - `<SUPPLY_CLI> add` writes new entries with `"status": "candidate"` and `"audience": "personal"` by default.
   - `<SUPPLY_CLI> pull` rejects any asset where `status !== "supplied"`.
3. **Drift Detection (`status` & `verify`)**:
   - `<SUPPLY_CLI> status <repo>` hashes every file in `<repo>/supply/<id>/` and compares it against `<repo>/supply.lock.json` (detecting local consumer edits) and `<SUPPLY_CATALOG>` (detecting upstream updates).
   - `<SUPPLY_CLI> verify` hashes every canonical asset in `<SUPPLY_STORE_DIR>` and `<EXTERNAL_BLOB_STORE>` against `<SUPPLY_CATALOG>`.

---

## 4. How to Verify It

1. **Audience Violation Test**:
   - Register a `personal` test asset, promote it, and attempt `<SUPPLY_CLI> pull <id> --to <public-repo>`. Confirm the command exits non-zero and writes no files.
2. **Candidate Pull Block Test**:
   - Register a `candidate` asset with `client-safe` audience and attempt to pull it before promotion. Confirm `<SUPPLY_CLI> pull` refuses.
3. **Consumer Drift Detection Test**:
   - Pull a `supplied` asset into a test repo, modify one byte inside `<repo>/supply/<id>/`, and run `<SUPPLY_CLI> status <repo>`. Confirm it flags local drift and refuses to overwrite without `--force`.
4. **Replace Placeholders**:
   - Update `<SUPPLY_CLI>`, `<SUPPLY_CATALOG>`, `<SUPPLY_STORE_DIR>`, `<EXTERNAL_BLOB_STORE>`, `<TARGET_REPO>`, `<SUPPLY_LOCK_FILE>`, `<AUDIENCE_TIER>`, and `<WORKSTACK_FILE>` in `SKILL.md` with your actual paths.
