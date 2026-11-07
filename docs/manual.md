# uika — the manual (0.1.0 preview, generic edition)

One book for the estate layer. Terse files win when they disagree with this text — when they do,
fix this text.

## Part 1 — The estate model

An **estate** is a directory that contains `estate.json` and, usually, a `skills/` library and
a `projects/registry.json`. The estate is not a framework your code imports; it is the
**governing layer above your repos**: one lawbook, many managed repositories, many agent harnesses.

Two canonical sources, everything else generated:

| Source | Hand-written? | Consumers |
|---|---|---|
| `estate.json` — posture, harnesses, targets, registries | yes, by the owner | every command that needs to know how the estate is arranged |
| estate lawbook (`AGENTS.md`) | yes, by the owner | `docs render` / `adopt` generate the marked law block from it |

Generation rules:

1. Generated regions are wrapped in `uika:law:begin` / `uika:law:end` markers and carry a
   fingerprint line (`uika:docs v1 · sha256:…`). Never hand-edit inside the markers.
2. Generated content is only ever written *between* the markers; everything outside them
   belongs to the repo.
3. A repo without markers is adopted, not overwritten: `adopt` appends the block and preserves
   the existing body.
4. `docs check` fails (or warns) when a block has drifted, was hand-pasted twice, or the body
   exceeds the load budget.

Why fingerprints: they make "generated vs hand-written" a machine-checkable boundary. A block
that no longer hashes to its header is a block somebody edited — the one thing the model forbids.

## Part 2 — Running the tool

Requires Node ≥ 22; zero npm runtime dependencies (Node built-ins only). Git is required by the
`deploy` subcommands that read commits or install hooks (`status`, `install`, `uninstall`, `auto`,
`hook-run`) and is optional for `find`, `lint`, and `docs check`; the README's Requirements table
lists every command. Compatibility: this is a 0.1.0 preview — the CLI surface, `estate.json`
manifest fields, the law-block format, and harness mappings may change before 1.0.

- **In-estate mode (default):** the current working directory is the estate root. Running the CLI
  from the checkout root uses that checkout as the estate; the installed package location is never
  used as an implicit fallback.
- **Separate-estate mode:** pass `--root <dir>` or set `UIKA_ESTATE_HOME` to run an installed CLI
  against a private estate directory. Explicit `--root` takes precedence over the environment; if
  neither is set, the current working directory remains the root.

Every command takes `--help`. Exit codes: `0` ok, `1` command error, `2` usage/help.

### Media, figures, references and evals

These four commands serve the creative and evaluation skills. They are optional: nothing else in
uika depends on them, and each one checks for its external tool before doing any work.

- `uika video ls [dir] [--since 3d] [--deep] [--json]` lists films newest first and skips `.git`,
  `node_modules` and `media/` scratch unless you pass `--deep`.
- `uika video qa <film> [--expect-duration s] [--against twin] [--target-lufs -14]` runs ffprobe
  and ffmpeg checks and exits 1 on any FAIL. `sheet`, `frame <t|end-N>` and `structure` sample or
  profile the film; they write only with `--apply`. `diff a.json b.json` compares two structure
  profiles and exits 1 when fewer than two axes differ. `prompt lint <pack.vprompt.md>` checks the
  mechanical closure rules of a video prompt pack and lists the rest as MANUAL.
  ffmpeg is found on `PATH`, or set `UIKA_FFMPEG` and `UIKA_FFPROBE` to its binaries.
- `uika figure check|render|ls|theme` drives the figure-craft engine. Tokens come from `--theme`,
  then `--tokens <sheet.css>` with `--face night|light`, then `design/uika-canonical.css` in the
  estate, then a built-in fallback. PNG and PDF output need Playwright.
- `uika ref ls|show|hash|check` reads `references/library.json`. `check` verifies versioned hashes of live non-theme collections and reports legacy or missing hashes as unverified. `hash <id> --json` reads the entire selected collection and prints a new baseline without writing the registry. Review and update `hashVersion`, `sha256`, `files` and `bytes` together. A legacy shape hash cannot certify past contents; the new baseline describes only the bytes observed now.
- `uika eval ls|run|compare` reads tasks from `labs/eval/tasks/*.json`
  (`{ "id", "split": "train"|"test", "run": [argv…], "cwd"?, "timeout_s"? }`). A task scores 1 on
  exit 0, 0 otherwise, or the `score` (0–1) in a JSON last line of its output. `run --n 3 --apply
  --out runs/a.json` repeats each task; `compare a.json b.json` says keep or revert, treating the
  train spread across repeats as noise. Any held-out mean regression reverts. Comparison requires
  matching task IDs, splits, and hashes of argv/cwd/timeout definitions, and checks recorded
  sample statistics. Older result files without those identities must be rerun; no automatic
  migration is performed. These definition hashes do not bind grader code, external data,
  environment, or provider versions. Keep those fixed and review their provenance separately.
  Output directories must already exist; result files are replaced atomically after execution.

## Part 3 — The law block and the markdown standard

The generated block is deliberately small: session start, handoff format, naming, branch shape,
posture, find commands, finish ritual. It carries **only what every session must obey** — the
full law lives in ADRs, not in the always-loaded file.

Budgets (defaults, configurable): any always-loaded file ≤ 200 lines; Codex project docs
≤ 32 KiB. `lint` enforces them as warnings; `--strict` turns them into failures in CI.

`lint` also reads `references/library.json` when it exists. It validates every record
and resolves reference paths without performing the full content hash. Use `ref check`
for content verification. The `supply` command is not bundled; its internal module supplies
reference hash helpers. Uika exposes no JavaScript API (the package is CLI-only).

`docs check` audits, `docs render` regenerates, `docs init` scaffolds a new repo's
`AGENTS.md` from `templates/agents-project.md` (plus a README from
`templates/readme-project.md`), `docs migrate [repo] [--apply]` repairs a legacy repo (strips a
pasted copy of the canonical law above the block, folds a hand-written `CLAUDE.md` lawbook into
`AGENTS.md`, keeps per-file `.bak-<date>` backups), and `docs version` prints the docs-standard
version. The `v1` in `uika:docs v1` is the docs-format version, not the release version.

## Part 4 — The session protocol

The protocol exists because agents forget between sessions, and humans forget what the last
agent did.

1. **Session start — freshness scan (mtime-first).** List the 10–15 most recently modified
   non-ignored files. Ambiguous? Fall back to `git status` + the workstack ledger.
2. **The ledger.** `WORKSTACK.md` at every managed repo root; open threads written as
   one block each.
3. **Handoff — six lines per thread:** `From→To / Done / Next / Files / Verify / Blockers`.
   No prose epics; state what changed, what to do next, where the evidence is.
4. **Finish — wrap checklist.** Verification suite run, ledger updated, learnings appended.
5. **`session check`** verifies the ledger mechanically: valid harness handles, all six keys
   in each handoff, and nonempty root `LEARNINGS.md` when that file exists. It does not prove
   that a freshness scan or the stated verification actually ran. Retain those observations
   in the session evidence. Indented Markdown list handoffs are supported.

A freshly initialized ledger is deliberately unclaimed. Replace the bootstrap placeholder
with the acting harness’s real six-line handoff before expecting `session check` to pass.
The Stop-hook mode emits one reminder per supplied session ID; missing IDs share the
`nosession` fallback, so the harness must supply a stable unique ID for separate sessions.

## Part 5 — Harnesses

A harness is any agent surface with its own instruction file, skill home, and MCP wiring:
Claude Code, Codex, OpenCode, Cline, Gemini CLI, DSH, Hermes, and friends. `estate.json`
records a **seam census** per harness — config home, instruction chain, skill home, budgets.
See `docs/harness-matrix.md`. Adding a harness = adding one census row + (optionally) a
renderer; nothing else in the estate changes.

## Part 6 — Skills

Skills are folders with `SKILL.md` (frontmatter `name` + `description`), scripts, and
references. Three tiers:

- **core** — the operating set every session may load (delegation, handoff, wrap, freshness,
  find, script hygiene, shell-safe writes, toolchains, mcp-and-keys).
- **principles** — short decision cards (prove-it-works, guard-the-context-window, …).
- **craft** — domain method packs (design, video, docs); load on demand, never always-on.

`uika skills validate` checks discovered skill frontmatter; `--strict` fails on findings.
A requested skill name must exist. Placement rejects invalid skills and malformed home
configuration; an explicitly empty home list stays empty. `skills place --apply` copies the
selected estate library into configured homes whose parent directories already exist.
The package also ships a bundled `skills/` library. `init` leaves library selection to the
owner, so a new estate has zero discovered skills until selected folders are copied there. Third-party skills stay **pinned, not
vendored**: record the upstream and version, install on demand.

0.1 does not build skill archives. A skill is a plain folder, so a harness that wants an upload
archive (for example a desktop app's skill upload) takes a zip of one `skills/<name>/` folder
made with your platform's own archiver. Earlier internal builds had a Windows-only
`skills pack`; it was removed because it quoted paths into PowerShell source.

## Part 7 — Distribution

Three verbs, three jobs:

| Verb | Target shape | What it does |
|---|---|---|
| `sync <repo> [--apply]` | clean, generated targets | copies estate config in; refuses to clobber hand-maintained blocks |
| `adopt <repo>` | hand-maintained lawbooks | injects/updates the marked block, ensures `WORKSTACK.md`, places skills + design tokens |
| `deploy …` | the whole estate | commit-triggered fan-out: law refresh, skill placement, target registry, auto-adopt on first commit (needs Git) |

Auto-adopt registers machine-local targets in `data/deploy/targets.json`; the owner-curated
`estate.json distribution.targets` list always wins on a path collision. `deploy status`
shows both, plus adoption state per target. Corrupt target registries fail closed and remain
unchanged; successful writes replace the registry atomically. Skill freshness checks include
helper files and playbooks. Distribution is copy-only: extra destination files and deleted
skills remain for owner review. It rejects links within a copied skill tree.

An interrupted apply can leave a partial fan-out; rerun the same authorized operation to
repair missing or stale source files. Auto-adoption is not a transaction across a target and
the registry. If interrupted after writing the law but before registration, inspect the
target and finish with an explicitly authorized `deploy adopt <repo> --apply`. Do not assume
that the next commit will recover this state. Concurrent writers to one registry should be
serialized by the harness. Atomic replacements preserve POSIX mode bits and new files use
mode 0600. Replacement does not promise preservation of custom ACLs, ownership or extended
attributes; review such policies before using managed output files.

## Part 8 — Keys, secrets, and the audience law

- Configuration carries **env-var names only**. `secretEnv: "GITHUB_MCP_TOKEN"` is legal;
  a token value is not. The tool never reads or writes secret values.
- Work products carry an audience: `client-safe < public < personal`. Anything not cleared
  for the wider audience stays out of the repo that serves it.
- Reference collections (study material, captures) are indexed, rights-noted, and **never
  redistributed**; the registry records provenance, not payloads.

## Part 9 — Correction rule

The estate prefers terse, executable truth over narrative. When a manual sentence and a
shipped file disagree, the file wins and the manual is corrected in the same session. This
is why `docs check` exists: drift is normal; unmeasured drift is the failure.

