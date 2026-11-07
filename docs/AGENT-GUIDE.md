# Uika Agent Guide — Cross-Harness Architecture & Conventions

This guide provides deep technical context for AI coding agents and human engineers working on or with the Uika open-source estate layer.

---

## 1. Architectural Philosophy

### The Multi-Harness Problem
Modern development teams and power users run multiple AI coding harnesses:
- **Claude Code** (scans `~/.claude/` and project `CLAUDE.md`)
- **Codex CLI** (scans `~/.codex/` with a strict 32 KiB cap on context)
- **OpenCode** (scans `~/.config/opencode/` and `opencode.jsonc`)
- **DeepSeek Harness (DSH)** (first loads user-global `~/.dsh/AGENTS.md`)
- **Hermes** (walks directories loading `.hermes.md`)
- **Gemini / Antigravity** (scans `~/.gemini/` and active workspace root)
- **Cline / Roo Code** (scans project rules and custom instructions)

Without an estate layer, these harnesses quickly drift:
- Prompts give conflicting instructions across harnesses.
- Hand-maintained rule files become stale or out of sync.
- Context budgets are exceeded, causing agent hallucination.
- Files edited in one harness are overlooked by another.

### The Uika Solution
Uika centralizes the estate contract into:
1. `estate.json` — The machine-readable manifest (fleet, posture, budgets, distribution targets).
2. `AGENTS.md` — The single human-authored canonical lawbook (strictly <=200 lines).

Everything downstream is **generated, fingerprinted, and drift-audited**:
- Repositories receive an injected `uika:law` block sealed with a SHA256 hash.
- Harness instruction files (`CLAUDE.md`, `~/.dsh/AGENTS.md`, `~/.hermes.md`) are generated adapters.
- Once the owner installs the post-commit hook (`uika deploy install --apply`, requires Git), commits touching law or skills distribute updates via `uika deploy`.
- `uika lint` (run on demand, or in CI with `--strict`) warns when the estate or a managed repository drifts.

---

## 2. The Law-Block Protocol

When Uika adopts a repository (`uika adopt <repo> --apply`), it injects a marked block into that repository's `AGENTS.md`:

```markdown
<!-- uika:law:begin -->
## Estate law (generated — do not edit inside the markers)
This project is part of the managed estate.
...
<!-- uika:generated from estate.json; edit the source, not this file -->
<!-- uika:docs v1 · sha256:54b31598afc2 -->
<!-- uika:law:end -->
```

### Inviolable Rules for Agents:
1. **Never edit between the markers**: Modifying text inside `<!-- uika:law:begin -->` and `<!-- uika:law:end -->` will break the SHA256 fingerprint.
2. **Project-specific rules go below the block**: Custom project instructions, build steps, and conventions must be placed outside the markers.
3. **Drift Detection**: Running `uika docs check` computes the SHA256 hash of the generated block. If it disagrees with the marker hash, Uika flags it as drift.
4. **Thin CLAUDE.md Adapters**: In adopted repositories, `CLAUDE.md` should be a thin generated adapter pointing to `AGENTS.md`. It must not exceed 15 lines.

---

## 3. Session Discipline & Rituals

Uika replaces informal folklore with machine-enforced rituals:

### A. Session Start: Mtime-First Freshness Scan
Agents must inspect recently modified files before exploring or executing code:
Linux / macOS (POSIX shell):
```sh
find . -type f -not -path '*/.git/*' -not -path '*/node_modules/*' -not -path '*/.venv/*' -not -path '*/dist/*' -printf '%T@ %p\n' | sort -rn | head -15
```
(`-printf` is GNU find; on macOS use `stat -f '%m %N'` via `-exec`, or `uika find --since 1d`.)

Windows (PowerShell):
```powershell
Get-ChildItem -Recurse -File | Where-Object { $_.FullName -notmatch '\\(\.git|node_modules|\.venv|dist)\\' } | Sort-Object LastWriteTime -Descending | Select-Object -First 15 FullName, LastWriteTime
```
*Why*: In fast-paced agent workflows, the most recent code changes are often untracked or in unstaged files. Relying on `git status` alone misses critical context.

### B. The WORKSTACK Ledger & 6-Line Handoff
Every active repository maintains a `WORKSTACK.md` file tracking open and completed threads.
Handoffs between agents or sessions must use the strict 6-line block:
```markdown
From→To: <harness>.<role> → <harness>.<role>
Done: Specific summary of verified changes completed in this session
Next: The immediate, concrete next action to execute
Files: List of modified, created, or relevant paths
Verify: Exact commands executed to prove the feature works
Blockers: None (or explicit unresolved questions requiring human input)
```
*Handles*: Must follow `<harness>.<role>` (e.g. `claude.tower`, `codex.impl`, `opencode.scout`).

### C. Wrap Checklist
Before an agent declares a task complete:
1. Run `node --test` (assert all tests pass).
2. Run `uika lint` (assert 0 warnings).
3. Run `uika docs check` (assert 0 doc warnings).
4. Check `git status` to ensure no temporary files or accidental secrets were left behind.
5. Update `WORKSTACK.md` with the verified handoff block.

---

## 4. Operating Posture

Agents operating in Uika must respect the four posture principles:
1. **Near-Autopilot**: Read and modify code freely within the project sandbox. Run tests, linters, and verification scripts without blocking on trivial confirmations.
2. **Light-Touch Secrets**: Local credentials (`.env`, auth stores, tokens) remain unread and unprinted. Configuration files reference environment variable names only (`secretEnv: "API_KEY"`).
3. **Full Self-Edit Lock**: Agents must NEVER silently edit files that govern agents:
   - Root `AGENTS.md`
   - `estate.json`
   - Harness configuration files (`.claude/`, `.codex/`, `.opencode/`)
   - Home-law files (`~/.dsh/AGENTS.md`, `~/.hermes.md`)
   *Protocol*: Propose the exact diff in chat; the human owner reviews and commits.
4. **Git Discipline**: Never commit or push directly to `main`. Create branches shaped `<feat|fix|docs|chore>/<kebab, up to 4 words>` (checked by `uika lint`) and leave pull requests for human review.

---

## 5. Development Standards for Uika Core

When contributing code to Uika itself:
- **Zero npm runtime dependencies**: Core CLI modules must not introduce `npm` dependencies. Use standard Node.js APIs (`node:fs`, `node:path`, `node:crypto`, `node:child_process`, `node:util`).
- **Node Engine**: Target Node.js >= 22 (using standard ESM, `parseArgs`, and `node:test`).
- **Path Normalization**: Windows uses backslashes `\`; POSIX uses forward slashes `/`. Always normalize paths with `.replace(/\\/g, "/")` when comparing or storing paths.
- **Scrub Gate**: Never include personal names, local machine drive paths, or private credentials in code, tests, or documentation. Use synthetic mocks (`C:/Users/x/...`).
- **Test-Driven Changes**: Every module in `src/` must have a corresponding `src/<name>.test.mjs` test suite. All tests must pass under `node --test`.
