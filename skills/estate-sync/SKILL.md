---
name: estate-sync
description: "TEMPLATE — Pull fresh control-tower governance and harness adapter configs into an operating repository."
---

# Estate sync (Template)

Distributes canonical multi-harness governance files and path-scoped rules from `<CONTROL_REPO_ROOT>` into `<TARGET_REPO>` usingowned copies and imports rather than symlinks.

## Trigger

Use when onboarding a repository or pulling updated canonical agent instructions, harness adapters, and self-edit guardrails from `<CONTROL_REPO_ROOT>` into `<TARGET_REPO>`.

## Inputs

- `<CONTROL_REPO_ROOT>`: Path to the central control repository holding canonical instructions and manifests.
- `<CANONICAL_AGENTS_FILE>`: Canonical root instructions file (e.g., `<CONTROL_REPO_ROOT>/AGENTS.md`).
- `<ESTATE_MANIFEST>`: Multi-harness adapter and repo-profile manifest (e.g., `<CONTROL_REPO_ROOT>/estate.json`).
- `<HARNESS_MATRIX_DIR>`: Directory documenting per-harness discovery rules (e.g., `<CONTROL_REPO_ROOT>/labs/harness-matrix`).
- `<SYNC_COMMAND>`: CLI command or script that performs the synchronization into `<TARGET_REPO>`.
- `<TARGET_REPO>`: Target operating repository path to synchronize.

## Steps

1. Run `<SYNC_COMMAND> <TARGET_REPO>` to synchronize one repository at a time (lazy onboarding: sync a repository when it is next worked).
2. Copy `<CANONICAL_AGENTS_FILE>` into `<TARGET_REPO>/AGENTS.md` as a full owned copy tracked in `<TARGET_REPO>`'s version history.
3. Render a thin `<TARGET_REPO>/CLAUDE.md` containing `@AGENTS.md` plus any harness-specific extras defined in `<HARNESS_MATRIX_DIR>`.
4. Render harness adapter fragments from `<ESTATE_MANIFEST>`:
   - `.codex/AGENTS.notes`
   - `.opencode/` pointer and `opencode.json` `instructions` entry only if `<TARGET_REPO>/opencode.json` already exists (never create a file that overrides global harness homes).
5. Generate path-scoped rules under `<TARGET_REPO>/.claude/rules/*.md` from the repository's profile entry (`distribution.targets`) in `<ESTATE_MANIFEST>`.
6. Ensure `<TARGET_REPO>/.claude/settings.json` includes self-edit-lock deny entries if missing, and touch `<TARGET_REPO>/<WORKSTACK_FILE>` if absent.
7. Run `<TARGET_REPO>`'s verification suite as recorded in `<WORKSTACK_FILE>`.

## Gates

- Never edit a generated file in `<TARGET_REPO>` by hand; update `<CANONICAL_AGENTS_FILE>`, `<ESTATE_MANIFEST>`, or the repo profile in `<CONTROL_REPO_ROOT>` and re-run `<SYNC_COMMAND>`.
- Refuse to overwrite locally modified generated files unless the diff matches only the sync fingerprint or explicit owner authorization is provided.
- Never use symlinks for distributed instruction files; every synced repository must remain self-contained in git history.
- Verify postconditions against `<HARNESS_MATRIX_DIR>` and the target repository's verification suite before claiming completion.

## Outputs

- Updated `<TARGET_REPO>/AGENTS.md`, `<TARGET_REPO>/CLAUDE.md`, and harness adapter fragments.
- Generated path-scoped rules in `<TARGET_REPO>/.claude/rules/*.md` and guardrail settings in `<TARGET_REPO>/.claude/settings.json`.
- Initialized or preserved `<TARGET_REPO>/<WORKSTACK_FILE>`.
- Printed postcondition checklist and verification results.

## Placeholders

| Placeholder | Meaning |
| --- | --- |
| `<CONTROL_REPO_ROOT>` | Absolute path to your central governance/control-tower repository |
| `<CANONICAL_AGENTS_FILE>` | Path to the canonical `AGENTS.md` source file inside `<CONTROL_REPO_ROOT>` |
| `<ESTATE_MANIFEST>` | Path to the JSON/YAML manifest declaring harness adapters and per-repo profiles |
| `<HARNESS_MATRIX_DIR>` | Directory or document specifying how each coding harness discovers rules and imports |
| `<SYNC_COMMAND>` | Your sync CLI entrypoint (e.g., `uika sync` or `node tools/sync.mjs`) |
| `<TARGET_REPO>` | Path to the operating repository receiving the synced configuration |
| `<WORKSTACK_FILE>` | Per-repo active thread and verification ledger filename (e.g., `WORKSTACK.md`) |
