# Uika — Agent Laws & Operating Guide
# Target: ≤200 lines when loaded. Enforce by hand per ADR-0002; lint warns on breach.

This repository is Uika: an open-source estate layer for multi-harness AI coding agents.
It governs how coding harnesses (Claude Code, Codex, OpenCode, Gemini, DSH, Hermes, Cline)
operate across repositories with one consistent law, fingerprinted blocks, and verified sessions.

## Session Start (Mandatory)
1. **Freshness scan (mtime-first)**: list the 10-15 most recently modified non-ignored files
   under the working directory before exploring further.
2. **Read WORKSTACK.md** at the repo root if it exists; it is the ledger of open threads.
3. **Confirm your harness identity** before writing anything harness-specific.

## Estate Architecture & Layout
- `bin/` — executable entrypoints (`bin/uika.mjs`, `bin/uika.cmd`).
- `src/` — zero-dependency CLI modules and test suites (`*.test.mjs`).
- `templates/` — project scaffolds (`agents-project.md`, `readme-project.md`).
- `schema/` — JSON schema definitions (`estate.schema.json` v2).
- `skills/` — shared Agent Skills libraries in portable format.
- `examples/` — synthetic starting points for estate initialization.
- `docs/` — comprehensive manuals, harness matrix, and release roadmaps.
- `estate.json` — machine manifest defining posture, fleet, targets, and registries.
- `AGENTS.md` — this canonical lawbook; downstream adapters are generated from it.

## Operating Posture
- **Near-autopilot**: read and edit freely inside the sandbox; network egress stays locked.
- **Light-touch secrets**: credential files remain unread and untouched; configuration
  references environment variable *names* only (`secretEnv`), never literal values.
- **Full self-edit lock**: never edit files governing agents (`AGENTS.md`, `estate.json`,
  `.claude/`, `.codex/`, `.opencode/`, harness home laws) without explicit human proposal.
- **Git workflow**: branch and commit freely (`feat/<kebab>`, `fix/<kebab>`); push only to
  feature branches; never push or rewrite `main`.
- **Handoff protocol**: record thread state in `WORKSTACK.md` using the 6-line block:
  `From→To / Done / Next / Files / Verify / Blockers`.

## Core Code Conventions
1. **Zero external dependencies**: Core CLI modules must rely exclusively on Node.js ≥22 built-ins
   (`node:fs`, `node:path`, `node:crypto`, `node:child_process`, `node:util`).
2. **Plain ESM**: Use standard `import`/`export` and `import.meta.url`.
3. **Cross-platform paths**: Always normalize paths with forward slashes (`/`) for cross-platform
   compatibility across Windows, macOS, and Linux.
4. **Scrub gate**: Never introduce personal usernames, local user paths (`C:\Users\...`, `/home/...`),
   or private email addresses. Use synthetic test fixtures (`C:/Users/x/...`).
5. **Law block immutability**: Generated content lives between `<!-- uika:*:begin -->` and
   `<!-- uika:*:end -->` markers with a SHA256 fingerprint. Never hand-edit inside them.

## Verification Checklist (Before Declaring Done)
- Run test suite: `node --test` (assert all tests pass, 0 failures).
- Run estate linter: `node bin/uika.mjs lint` (assert `lint: clean`).
- Run docs audit: `node bin/uika.mjs docs check` (assert 0 warnings).
- Inspect git status: verify no untracked temp files, secret tokens, or broken symlinks remain.

See `docs/AGENT-GUIDE.md` for extended agent architecture and cross-harness coordination patterns.
