# Changelog

All notable changes to uika are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). Before 1.0 the CLI surface, manifest fields,
law-block format and harness mappings may change in any minor release.

## [Unreleased]

### Added

- **Skills library.** 22 ports join the original 17 skills, for 39 estate-authored skills,
  including video, figure, explainer and creative-gates packs. Six ports are workflow
  templates with setup manuals. The whole `skills/` tree is included in local npm packs;
  [skills scope and provenance](docs/SKILL_PORT_AUDIT.md) describes the library and its limits.
  Third-party skills are not vendored, as stated in [NOTICE](NOTICE).
- **`uika video`** — `ls` (breadth-first film finder), `qa` (decode, duration, loudness, true peak,
  silence and twin checks; exits 1 on any FAIL), `sheet` and `frame` (contact sheet and single
  frames), `structure` (cut-rhythm profile, `uika.video-structure.v1`), `diff` (two-axis clone
  rule) and `prompt lint` (mechanical subset of the video prompt pack closure rules). It uses your
  installed `ffmpeg`/`ffprobe` and fails with an install hint when they are missing.
- **`uika figure`** — `check`, `render`, `ls` and `theme` over the figure-craft engine. SVG and
  HTML output need nothing extra; PNG and PDF need Playwright, which is not bundled.
- **`uika ref`** — `ls`, `show`, `hash` and `check` over `references/library.json`.
- **`uika eval`** — `ls`, `run` and `compare` for your own grader tasks with train/test splits and
  a keep/revert verdict. uika runs only the commands in your task files and calls no model API.
- Every new command that writes is a dry run unless you pass `--apply`.

### Fixed

- CLI help exits successfully, malformed arguments have concise errors, and conflicting
  `--apply`/`--dry-run` flags fail before any writes.
- Skill distribution includes helper/playbook changes and rejects links within copied trees.
  Unknown skill names, invalid placement, strict validation findings, and malformed home
  configuration fail clearly; empty home lists stay empty.
- Target registries reject corruption without overwriting it and use atomic replacement.
  Git change detection preserves Unicode/whitespace paths and rejects invalid revisions.
- Session checks require complete individual handoffs and keep distinct session IDs separate.
- Reference validation rejects malformed or duplicate identities instead of omitting records.
- Eval comparisons require matching task identities/definitions and consistent statistics,
  and revert held-out regressions. Invalid tasks or output paths fail before grader execution.
- Documentation describes the source preview separately from a future npm release, with
  current-revision verification commands and explicit platform limits.

- Reference integrity uses versioned full-content hashes. Legacy shape hashes
  are reported as unverified, and relative paths resolve from the selected estate.
- `deploy`: the auto-adopt guards compare symlink-resolved paths, so an estate reached through a
  Windows junction or a symlinked home folder is recognised.

## [0.1.0] preview (unpublished)

The initial source preview. The npm package is unpublished; source publication is a
separate step.

### Scope

- A zero-runtime-dependency Node 22+ CLI with 15 commands: `init`, `check`, `lint`, `sync`,
  `skills`, `audit`, `find`, `where`, `path`, `layout`, `session`, `adopt`, `deploy`, `docs`,
  `home`.
- An estate root chosen in this order: `--root <dir>`, then `UIKA_ESTATE_HOME`, then the current
  directory. The package's own location is never used as an estate.
- Fingerprinted law blocks (`adopt`, `docs render`), generated harness adapters (`sync`), harness
  home-law files (`home regen`) and commit-triggered distribution (`deploy`, which needs Git).
- A library of estate-authored skills in the Agent Skills format under `skills/`.
- A JSON schema for `estate.json`, synthetic examples, a user manual, an agent guide and a
  harness matrix with a per-row status (verified, doc-checked, probed, planned).

### Changed before release

- Every command that writes is a dry run unless you pass `--apply`. `sync` and `deploy forget`
  now follow this rule; they used to write straight away. `init` no longer creates `data/deploy/`
  during a dry run, `deploy adopt` no longer registers its target during a dry run, and
  `session check --stop` no longer creates a `.git/` folder in a non-Git target.
- `lint --strict` now exits 1 when there are warnings. Plain `lint` stays advisory.
- The npm package is CLI only: no `main`, and `exports` exposes only `package.json`. It ships an
  explicit `files` list without tests.
- A privacy scrub (`npm run scrub`) checks the source tree and the packed tarball.
- Line endings are LF everywhere (`.gitattributes`).

### Removed

- `skills pack` and the deploy zip legs, which ran PowerShell with interpolated paths. Zip one
  `skills/<name>/` folder with your platform's archiver if a harness wants an upload.
- The `ref` and `supply` CLI entry points. Their modules remain as internal libraries used by
  `lint`.
- The hand-written Windows shim `uika.cmd`. npm generates one on install.
- The internal draft notes file, along with private paths, names and incident history in
  comments and fixtures.

### Known limitations

- The included CI matrix targets Node 22 on Linux, Windows and macOS. Verify the exact source
  revision before making a platform-support claim; a Linux run does not verify the other OSes.
- No harness row in `docs/harness-matrix.md` is marked verified.
- MCP, model, usage and reference-rendering commands are not bundled. The current `ref`
  command reads the registry and verifies content hashes.

