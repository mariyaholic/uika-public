# Harness matrix (generic)

How common agent harnesses expose the seams uika manages: instruction files, skill homes,
MCP configuration, and load budgets.

**Context:** written for uika `0.1.0 preview`; rows last reviewed **2026-10-25**. Harness
versions move — re-check a row against its source before trusting it, and send a patch when
one drifts.

**Status key**
- **verified** — checked against a live install of the harness. *No row is verified in this
  release;* the review host had no harness installs.
- **doc-checked** — matches the vendor's primary documentation (linked) on the date above.
- **probed** — observed on one machine or from secondary sources; not confirmed by vendor docs.
- **planned** — named in the roadmap; no mapping yet.

| Harness | Status | Config home | Instruction chain | Skill home | Notes | Source |
|---|---|---|---|---|---|---|
| **Claude Code** | doc-checked | `~/.claude` | `CLAUDE.md` (user `~/.claude/CLAUDE.md`, project, local); imports via `@AGENTS.md`; reads `AGENTS.md` natively when no `CLAUDE.md` exists (v2.1.277+); `.claude/rules/*.md` with `paths` frontmatter are path-scoped | `~/.claude/skills` | Sandboxing on Windows may need WSL — check per machine | [memory docs](https://code.claude.com/docs/en/memory) |
| **Codex** | doc-checked | `~/.codex` (`CODEX_HOME`) | `AGENTS.md` chain from repo root to cwd; `AGENTS.override.md` beats `AGENTS.md` per directory | user `~/.agents/skills`; repo `.agents/skills` (cwd up to repo root); admin `/etc/codex/skills` | Project doc cap `project_doc_max_bytes`, default 32 KiB | [AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md), [skills](https://developers.openai.com/codex/skills) |
| **OpenCode** | doc-checked | `~/.config/opencode` | `AGENTS.md` (falls back to `CLAUDE.md`); global `~/.config/opencode/AGENTS.md`; `opencode.json` `instructions[]` | `~/.config/opencode/skills`, also `~/.claude/skills` and `~/.agents/skills` | Config is JSON; instructions are an explicit array | [rules](https://opencode.ai/docs/rules/), [skills](https://opencode.ai/docs/skills/) |
| **Cline** | doc-checked | `~/Documents/Cline/Rules` (global rules; also `~/.cline/rules`) | `.clinerules/` or `.cline/rules/` directories in the repo; also reads `AGENTS.md` and `~/.agents/AGENTS.md` | — (rules only) | Rule files are plain markdown | [Cline rules](https://docs.cline.bot/features/cline-rules) |
| **Gemini CLI** | doc-checked (instructions); probed (skills) | `~/.gemini` | `~/.gemini/GEMINI.md` then project hierarchy; `context.fileName` setting can add `AGENTS.md` | `~/.gemini/skills` (probed) | Antigravity variants add `~/.gemini/antigravity{,-ide}/skills` (probed). Google moved unpaid tiers to Antigravity CLI on 2026-06-18 | [GEMINI.md docs](https://geminicli.com/docs/cli/gemini-md/) |
| **DSH** (DeepSeek Harness) | probed | `~/.dsh` | user-global `$DSH_HOME/AGENTS.md` first (always), then project `AGENTS.md`/`CLAUDE.md` chain from git root to cwd; `.local` overlays | `~/.agents/skills` | ~64 KiB budget; Stop hook can run `uika session check --stop`; home law generated as `~/.dsh/AGENTS.md` | no public primary source checked |
| **Hermes** | probed | `~/AppData/Local/hermes` (Windows) | `AGENTS.md` chain; `.hermes.md` walk-to-git-root; `SOUL.md` identity | `~/.agents/skills` (read-only external dir) | MCP servers in YAML; home law generated as `~/.hermes.md` | no public primary source checked |
| Cursor, Windsurf, Roo Code | planned | — | — | — | 0.3 roadmap | `docs/roadmap.md` |

## Design consequences

1. **One lawbook, many adapters.** Harnesses disagree on file names and budgets; they agree on
   "read a markdown file at session start". The estate generates one block per repo and lets
   each harness's own chain find it.
2. **No symlinks.** Adapters are imports-and-copies: a symlinked `AGENTS.md` breaks on
   Windows checkouts, zip exports, and harnesses that copy files into sandboxes.
3. **Budgets are per-harness minima.** The 200-line always-loaded budget is the binding
   constraint for most harnesses; Codex's 32 KiB cap binds first for byte-heavy files.
4. **Skills are the portable unit.** The Agent Skills folder format is harness-neutral; the
   only per-harness work is knowing *where* to copy it (`skills.homes` in `estate.json`).

## Adding a harness

1. Add a census row to `estate.json harnesses[]` (id, tier, configHome, instructions, notes).
2. Add its skill home to `estate.json skills.homes[]`.
3. If it needs a generated native config (YAML/JSON), write a renderer later — the census row
   alone already gives `check` something to probe and `lint` something to budget.
