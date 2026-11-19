# Cadenza Command Guidebook (`docs/cadenza-commands.md`)

Categorized CLI command index for `uika-public` (`node bin/uika.mjs` or `uika`).

## 1. Core Check, Lint & Manuscriptus (`ADR-0076`)
- `uika init`: Initialize workspace config and layout structure.
- `uika check`: Probe machine runtimes, harness homes, and drive space.
- `uika lint`: Warn-only budget, drift, docs, ADR, and Setlist (`WORKSTACK.md` ≤ 120 lines) linter.
- `uika eval`: Validate the cross-harness eval forest and run declared task graders.
- `uika manuscriptus check|next`: Validate ADR filenames, Context/Decision/Consequences sections, relative links, and next free ADR ID (`ADR-0070`).
- `uika session check [<repo>] [--stop]`: Verify handle claim, complete 6-line handoff block, and wrap learnings (`ADR-0028`).

## 2. Sync, Encore, Deploy & Documentation
- `uika sync <repo> [--force] [--apply]`: Copy canonical `AGENTS.md`, render thin `CLAUDE.md`, and refresh generated adapters.
- `uika adopt <repo> [--apply]`: Inject `uika:law` block, token bridge, and place repo-local skills.
- `uika deploy status|targets|adopt|forget|auto|hook-run`: Commit-triggered distribution (`ADR-0051/0052`).
- `uika docs check|render|init|migrate|version`: Cross-repo markdown standard checks (`ADR-0053`).
- `uika home status|regen [--apply] [--force]`: Check and render global agent configuration files.
- `uika encore list [area] | summary | lint | ingest <file> [--apply] | push <file> --repo owner/name [--auto-merge] [--apply] | pull-github --owner owner | --repos a,b [--apply]`: Parse, categorize by skill/area, validate, and aggregate SIM entries (`ADR-0071`).
- `uika aurora sync [--apply] [--force] | propagate (--target <dir> | --github | --all) [--apply] [--force]`: Detect target drift and propagate Setlist + Encore SIM updates (`ADR-0072`).

## 3. Ferry, Unmask & Audit
- `uika ferry status|plan|stage [--apply]|restore [--apply]`: Scan and stage heavy temp/cache artifacts off local disk toward remote storage (`ADR-0074`).
- `uika unmask check [dir] [--json] [--include-vendor]`: Audit HTML/JS/TS/MJS files for inert buttons, `href="#"` placeholders, `pointer-events: none` traps, and implicit UI state errors (`ADR-0075`).
- `uika audit [repo]`: Report variant-suffixed script clusters (`skills/script-hygiene`).

## 4. Skills & Discovery
- `uika skills validate|place [name] [--apply]`: Validate `SKILL.md` frontmatter and place into harness homes (`ADR-0015`).
- `uika find [words] [--since ..]` / `where [name]`: Fast mtime-first search across projects (`ADR-0019`).
- `uika path <kind> <name>` / `layout [dir]`: Resolve canonical file locations (`ADR-0022`).

## 5. Visuals, Figures & Media
- `uika video qa|sheet|frame|ls|structure`: Zero-dep ffmpeg QA gates and structural profiling (`ADR-0025/0040`).
- `uika figure check|render|ls|theme`: Token-aligned figure generation (`ADR-0034`).
- `uika ref ls|show|hash|check`: Creative reference library management (`ADR-0054`).

## 6. Note on Unbundled Estate-Plane Commands
The following estate-plane management commands (`backup`, `prompt`, `mcp`, `models`, `pot`, `supply`, `creative`, `observe`, `tower`, `limiter`, `usage`, `mt5`) are described in `docs/roadmap.md` and are NOT bundled in this public preview release.
