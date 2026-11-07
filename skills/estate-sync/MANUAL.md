# Manual: Building Your Own Multi-Repo Governance Sync (`estate-sync`)

This manual is addressed to coding agents setting up a multi-repository, multi-harness configuration sync pipeline for their user. The `estate-sync` skill assumes a "control tower" repository that distributes canonical agent instructions and guardrails into operating repositories without symlinks.

---

## 1. What to Build

Build a deterministic synchronization CLI (`<SYNC_COMMAND>`) and manifest (`<ESTATE_MANIFEST>`) that propagate a single canonical instruction sheet (`AGENTS.md`) and per-repo concern rules into any target repository (`<TARGET_REPO>`) across multiple agent harnesses (such as Claude Code, Codex CLI, OpenCode, Gemini/Antigravity).

### Design Principles
- **Copies & imports, never symlinks**: Symlinks break across containers, OS boundaries, and git clones. Copy the canonical `AGENTS.md` into `<TARGET_REPO>/AGENTS.md` and stamp it with a content hash header.
- **Thin harness shims**: Harnesses that do not read `AGENTS.md` natively receive a thin import file (e.g., `CLAUDE.md` containing `@AGENTS.md`) rather than a second diverging copy.
- **Lazy, single-repo sync**: Sync one repository on demand when starting work in it, rather than mass-pushing commits across dormant repositories.
- **Fingerprint-guarded overwrites**: Stamp generated files with a comment header containing the SHA-256 hash of the rendered content. Refuse to overwrite a target file if its current on-disk content does not match the last recorded hash, preventing accidental loss of local edits.

---

## 2. Minimal Components

1. **Canonical Instruction Source (`<CANONICAL_AGENTS_FILE>`)**:
   - A root `AGENTS.md` in your control repository defining universal engineering principles, autonomy boundaries, and handoff formats.
2. **Manifest (`<ESTATE_MANIFEST>`)**:
   - A JSON file (e.g., `estate.json`) with two sections:
     - `harnesses`: Per-harness adapter rules (which filenames each harness reads, whether it supports `@file` imports, and where deny-list settings live).
     - `profiles`: Named repository profiles (e.g., `web-app`, `data-pipeline`, `library`) mapping repositories to path-scoped rule templates (`distribution.targets`).
3. **Rule Templates (`rules/<concern>.md`)**:
   - Modular markdown rule files (e.g., `typescript.md`, `python.md`, `db-migrations.md`) with YAML frontmatter specifying `paths:` globs.
4. **Sync CLI (`<SYNC_COMMAND>`)**:
   - A Node.js or Python script accepting `<TARGET_REPO>` (and optional `--check` / `--force` flags).

---

## 3. How to Wire It

1. **Manifest Resolution**:
   - When `<SYNC_COMMAND> <TARGET_REPO>` runs, look up `<TARGET_REPO>` in `<ESTATE_MANIFEST>` to find its assigned profile and concern list.
2. **File Generation**:
   - Compute `sha256` of `<CANONICAL_AGENTS_FILE>` and write `<TARGET_REPO>/AGENTS.md` with `<!-- synced-sha256: <hash> -->`.
   - Write `<TARGET_REPO>/CLAUDE.md` with `@AGENTS.md` and any Claude-specific adapter notes.
   - If `<TARGET_REPO>/opencode.json` exists, merge `"instructions": ["AGENTS.md"]` into its JSON AST without clobbering existing keys.
   - Render each concern rule assigned to the repo's profile into `<TARGET_REPO>/.claude/rules/<concern>.md`.
3. **Self-Edit Guardrails**:
   - Ensure `<TARGET_REPO>/.claude/settings.json` (or equivalent harness permissions file) denies automated agent edits to `AGENTS.md`, `CLAUDE.md`, and `.claude/settings.json` so agents cannot weaken their own rules mid-session.
4. **Ledger Initialization**:
   - If `<TARGET_REPO>/WORKSTACK.md` does not exist, create an empty ledger template with `## Active Threads` and `## Verification`.

---

## 4. How to Verify It

1. **Dry-Run & Drift Check**:
   - Run `<SYNC_COMMAND> <TARGET_REPO> --check` on a clean disposable repository and verify it exits non-zero when out of sync and zero immediately after syncing.
2. **Dirty-Edit Protection Test**:
   - Append a manual line to `<TARGET_REPO>/AGENTS.md` in a test directory and re-run `<SYNC_COMMAND> <TARGET_REPO>`. Verify the CLI refuses to overwrite the modified file and reports a fingerprint mismatch.
3. **Idempotency Test**:
   - Run `<SYNC_COMMAND> <TARGET_REPO>` twice in a row and verify `git status --porcelain` shows zero changes on the second run.
4. **Replace Placeholders**:
   - Once verified, replace `<CONTROL_REPO_ROOT>`, `<CANONICAL_AGENTS_FILE>`, `<ESTATE_MANIFEST>`, `<HARNESS_MATRIX_DIR>`, `<SYNC_COMMAND>`, `<TARGET_REPO>`, and `<WORKSTACK_FILE>` in `SKILL.md` with your concrete paths and commands.
