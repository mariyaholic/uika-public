# uika

A personal **estate layer for AI coding agents** — one lawbook, generated adapters, measured sessions.

**Status: `0.1.0 source preview`; npm package unpublished.** This checkout is the source
preview. Source: [source repository](https://github.com/mariyaholic/uika-public).
Source publication and an npm release are separate steps.
APIs, `estate.json` manifest fields, the law-block format, and harness mappings may change
before 1.0.

## What / why

You run agents (Claude Code, Codex, OpenCode, Cline, Gemini CLI, DSH, Hermes, …) across many
repositories. Without an estate layer, every repo drifts: hand-maintained `AGENTS.md` files go
stale, instructions get pasted between repos, skills exist in one harness home but not another,
and nobody can tell a session what changed since last time. uika makes the agent-facing layer
**generated, versioned, fingerprinted, and drift-audited** instead of hand-copied.

```
estate.json + AGENTS.md (canonical, hand-written)
        │  uika adopt / docs render / deploy
        ▼
law blocks (uika:law:begin … sha256 fingerprint) in every managed repo
skill placement into each harness's skill home
freshness scan + WORKSTACK.md handoff protocol at session start/end
```

### The core ideas

1. **Two canonical sources.** `estate.json` (machine manifest: posture, harnesses, targets,
   registries) and your estate lawbook. Everything agent-facing downstream is *generated*.
2. **Fingerprinted law blocks.** `uika adopt` injects a marked, versioned block into a repo's
   `AGENTS.md`:

   ```markdown
   <!-- uika:law:begin -->
   ## Estate law (generated — do not edit inside the markers)
   ...
   <!-- uika:generated from estate.json; edit the source, not this file -->
   <!-- uika:docs v1 · sha256:54b31598afc2 -->
   <!-- uika:law:end -->
   ```

   `uika docs check` audits drift; `uika lint` warns when always-loaded files blow budgets
   (≤200 lines, 32 KiB harness caps) or blocks go stale.
3. **Public tool, private estate.** The tool carries zero personal data. Your estate —
   registries, targets, archives — lives in its own directory; point
   `UIKA_ESTATE_HOME` (or `--root`) at it. `examples/` holds synthetic starting points.
4. **Keys by reference.** Configuration contains environment-variable *names* only
   (`secretEnv: "GITHUB_MCP_TOKEN"`); values never enter any file.
5. **A session protocol, not folklore.** mtime-first freshness scan at session start, a
   `WORKSTACK.md` ledger with 6-line handoffs (`From→To / Done / Next / Files / Verify /
   Blockers`), a wrap checklist at session end, and `uika session check` to enforce it.

## Requirements

- **Node.js ≥ 22.** uika has **zero npm runtime dependencies**: it uses Node built-ins only.
- **Platform verification:** the included CI workflow targets Node 22 on Linux, Windows,
  and macOS. Run `npm test` for the revision you use and check its CI results. A Linux
  test run alone does not verify native Windows or macOS behavior. Optional media tools,
  provider setup, and live harness integrations need separate checks in your environment.
- **Git** is needed only by some commands:

  | Command | Git |
  |---|---|
  | `deploy status`, `deploy install\|uninstall`, `deploy auto …`, `deploy hook-run` | required (reads commits, installs hooks, sets `init.templateDir`) |
  | `deploy targets`, `deploy adopt`, `deploy forget` | not used |
  | `find` | optional: uses `git ls-files` in Git roots, walks the tree otherwise |
  | `lint` | optional: the branch-name check is skipped outside a Git repo |
  | `docs check` | optional: used to tell tracked from untracked link targets |
  | `check` | probes for Git and reports its version, or that it is missing |
  | all other commands | not used |

- No archive tool is needed: 0.1.0 does not pack skills into zips (the Windows-only
  `skills pack` leg was removed; see `docs/manual.md` Part 6).

## Install

The 0.1.0 npm package is not published. `npm i -g uika` and `npx uika` are not installation
methods for this preview. Run from this source tree or install a tarball you build from it:

```sh
# from a checkout
node bin/uika.mjs check          # machine probe: runtimes, harness homes, drives

# or: build and install a local tarball
npm pack                         # writes uika-0.1.0.tgz
npm install -g ./uika-0.1.0.tgz  # puts `uika` on PATH
```

## Run

uika runs against an **estate directory**: `--root <dir>`, else `UIKA_ESTATE_HOME`, else the
current directory.

```sh
# A — tool lives inside the estate (monorepo pattern): the checkout IS the estate root
node bin/uika.mjs lint

# B — the CLI against a separate estate directory (public tool / private estate)
UIKA_ESTATE_HOME=~/estate node bin/uika.mjs docs version
# or: node bin/uika.mjs docs version --root ~/estate
```

Bootstrap an estate in one command, then verify it:

```sh
node bin/uika.mjs init my-estate --apply
cd my-estate && node ../bin/uika.mjs lint
```

The bootstrap creates an estate scaffold. Its ledger starts unclaimed, and it does not copy
the bundled skills into your estate. Read the bundled `skills/` from the checkout or installed
package, then choose the skills to copy into your estate’s `skills/` directory. Run
`uika skills validate --strict` against that estate. Record your real harness handoff in
`WORKSTACK.md` and run `uika session check` before treating a session as complete.

For example, from the checkout, choose this small operating set for the new estate:

```sh
node -e "const fs = require('node:fs'); for (const name of ['freshness-scan', 'handoff-protocol', 'principle-prove-it-works', 'wrap-checklist']) fs.cpSync('skills/' + name, 'my-estate/skills/' + name, {recursive: true, force: false, errorOnExist: true});"
node bin/uika.mjs skills validate --root my-estate --strict
```

The copy refuses existing destinations so local skill edits are preserved. For a tarball
installation, use its packaged `skills/` folder as the source. Strict validation fails if
no skills were discovered; ordinary validation reports the empty library explicitly.

Commands that write are dry runs unless you pass `--apply`. Combining `--apply` and
`--dry-run` is an error before any command executes. Two documented exceptions:
`deploy hook-run` is the post-commit hook the owner installed with `--apply`, so it writes when
Git runs it; `session check --stop` records a one-byte once-per-session sentinel (inside an
existing `.git/`, else the OS temp directory) so a Stop hook blocks at most once. Verify a checkout with `npm test`.

## Commands

The dispatcher registers 19 commands:

| Command | What it does |
|---|---|
| `init [dir] [--name n] [--apply]` | Bootstrap a compliant new estate from scratch in one command |
| `check` | Machine probe: runtimes, harness homes, drive space |
| `lint [--strict]` | Context-budget linter — always-loaded file lines, law-block drift, skill hygiene |
| `sync <repo> [--force] [--apply]` | Distribute estate config into a clean target repo |
| `skills validate [--strict]\|place` / `audit` | Validate skills, place into harness skill homes; audit script bloat |
| `find` / `where` | Estate-wide fuzzy file search by project/mtime; project nickname resolution |
| `path` / `layout` | Where a file goes in an estate-managed repo |
| `session check [repo]` | Freshness + WORKSTACK handoff + wrap gate |
| `adopt <repo>` | Inject the fingerprinted law block into a managed repo (`--apply`, `--dry-run`) |
| `deploy …` | Commit-triggered distribution: status/targets/adopt/forget/install/uninstall/auto/hook-run |
| `docs check\|render\|init\|migrate\|version` | The markdown standard: generated law block + hand-written body, audited; `migrate [repo] [--apply]` repairs legacy repos (strips pasted law, folds a hand-written `CLAUDE.md` into `AGENTS.md`, keeps `.bak-<date>` backups) |
| `home status\|regen` | Render harness home-law files (`~/.dsh/AGENTS.md`, `~/.hermes.md` style) |
| `video ls\|qa\|sheet\|frame\|structure\|diff\|prompt lint` | Find, QA, sample and profile rendered films; lint a video prompt pack. Needs `ffmpeg`/`ffprobe` on `PATH` (or `UIKA_FFMPEG`/`UIKA_FFPROBE`) for everything except `ls`, `diff` and `prompt lint` |
| `figure check\|render\|ls\|theme` | Deterministic SVG/HTML figures from `*.figure.json` specs with guards and a provenance manifest; PNG/PDF need Playwright, which is not bundled |
| `ref ls\|show\|hash\|check` | Read the reference registry and verify versioned content hashes; `hash <id> --json` prints a read-only baseline for review |
| `eval ls\|run\|compare` | Run your own grader tasks (`labs/eval/tasks/*.json`) with train/test splits and a keep/revert verdict; no model API is called by uika |

Commands that write files (`video sheet|frame|structure --out`, `figure render`, `eval run`) are dry runs
until you pass `--apply`. Not bundled (see `docs/roadmap.md`): usage tracker, MCP/model/prompt
registries, supply layer, `creative` ledger/deck/divergence commands, backup, limiter, mt5.

## Layout

| Path | What lives there |
|---|---|
| `bin/uika.mjs` | the CLI entry point |
| `src/` | command modules and their `node:test` suites (`*.test.mjs`) |
| `skills/` | the estate-authored skills library |
| `templates/`, `schema/`, `examples/` | scaffolding, JSON schemas, synthetic starting points |
| `docs/` | the manual, harness matrix, agent guide, roadmap |
| `tools/` | maintainer tools (the privacy scrub); not packed |

### The skills library

`skills/` contains 39 estate-authored skills in the [Agent Skills](https://agentskills.io)
format (one folder, one `SKILL.md`): the original 17 operating and principle skills plus
22 ports covering creative work, media, figures, evaluation, and workflow templates.
Third-party skills are not vendored; see [NOTICE](NOTICE) and the
[skills scope and provenance](docs/SKILL_PORT_AUDIT.md).

Six ports are templates with `MANUAL.md` setup guides. Media kits and raster export need
optional tools that are not installed by the CLI package. Read each skill's requirements
before running its helpers. `uika skills place --apply` copies your estate's selected
skills into its configured harness skill homes.

### Documentation

- `docs/manual.md` — the book: estate model, law blocks, session protocol, distribution.
- `docs/harness-matrix.md` — how each harness exposes instructions/skills/MCP, with a
  verification status per row.
- `docs/roadmap.md` — what later releases add.
- `CHANGELOG.md` — release notes and known limitations.
- `SECURITY.md` — what each command can write, the dry-run rule, and how to report a
  vulnerability.
- `CONTRIBUTING.md` — ground rules and the checks to run before a pull request.

## Status

**`0.1.0 developer preview`.** Uika supplies the estate, skills, and session layer used by
an agent harness. The harness provides model execution, tool access, and its own authorization
controls. Uika does not include a model-running autonomous engine. Provider setup and live
harness integrations require separate verification.

Verify this source revision with `npm test`, `npm run scrub`,
`node bin/uika.mjs lint --strict`, and `node bin/uika.mjs docs check --strict`.
The test suite includes package-content checks and an isolated tarball install.
Compatibility: APIs, manifest fields, and harness mappings may change before 1.0.
License: MIT (see `NOTICE` for what is and is not in this repository).

