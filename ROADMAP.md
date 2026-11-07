# Uika Open Source Roadmap

**Release state: `0.1.0 source preview`; npm package unpublished.** This tree is being
prepared for a clean public source repository. Publishing the source and publishing an npm
package are separate milestones. Until 1.0, the CLI surface, manifest fields, law-block format,
and harness mappings may change without a deprecation period.

Checked items below describe code present in this tree. Run the checks in
[CONTRIBUTING.md](CONTRIBUTING.md) and inspect CI for the exact revision before treating a
feature as verified on your platform.

## Vision & Architecture

Uika provides a cross-repository estate layer for AI coding harnesses:

1. One human-authored lawbook (`AGENTS.md`) and one machine manifest (`estate.json`).
2. Generated adapters and law blocks with versioned SHA256 fingerprints and drift checks.
3. Session freshness scans, six-line handoffs, and wrap checks.
4. A portable tool with user-owned estate configuration selected through `--root` or
   `UIKA_ESTATE_HOME`.

The harness supplies model execution, tools, and authorization. Uika supplies estate
configuration, skills, distribution, and session checks; live harness integrations require
their own verification.

## Present in the source preview

- [x] **Zero npm runtime dependencies:** plain ESM on Node 22+, with 19 registered commands:
  `init check lint sync skills audit find where path layout session adopt deploy docs home
  video figure ref eval`.
- [x] **Estate bootstrap:** `uika init` creates a synthetic starting estate. Choose and copy
  bundled skills into that estate before validating or placing them.
- [x] **Fingerprinted law blocks and docs:** adopt, render, check, initialize, migrate, and
  version generated instruction blocks while preserving project-specific content.
- [x] **Distribution:** sync generated adapters, place skills, and opt into Git commit hooks
  for distribution and new-repository adoption.
- [x] **Search and session protocol:** fuzzy file search, project nicknames, freshness checks,
  claimed handles, complete handoffs, and wrap gates.
- [x] **Harness home-law generation:** `uika home status|regen`.
- [x] **39 estate-authored skills:** the original 17 operating/principle skills and 22 ports,
  including six templates with setup manuals. See
  [skills scope and provenance](docs/SKILL_PORT_AUDIT.md).
- [x] **Media and figures:** video QA, frames/contact sheets, structure comparison and prompt
  lint; declarative SVG/HTML figures. Media tools and PNG/PDF export have optional dependencies.
- [x] **References and evaluation:** versioned content-hash verification and local grader
  tasks with train/test splits and keep/revert comparisons.
- [x] **Release checks:** privacy scrub, tests, strict lint/docs checks, exact package-content
  checks, an isolated tarball install test, and a Node 22 CI workflow for Linux, Windows and
  macOS. Workflow configuration is separate from a passing run for a particular revision.

## Next: source publication and distribution hardening

- [ ] Publish the reviewed source tree in its clean repository and verify that repository's
  links, metadata, and CI results.
- [ ] Record successful Node 22 CI results for the exact release revision on Linux, Windows,
  and macOS. Native platform behavior and optional toolchains need their own evidence.
- [ ] Prepare an npm release separately: verify package-name availability, review the exact
  tarball, and test the published install before documenting npm/npx installation.
- [ ] Add portable skills packing without restoring the removed Windows-only packer.
- [ ] Improve the dry-run placement display for `uika skills place`.
- [ ] Add runtime schema validation with useful field-level manifest errors.

See the repository's release checklist for maintainer steps. The npm package remains
unpublished while these distribution steps are pending.

## Later: harness and estate ergonomics

- [ ] Expand direct adapters and verification across more harnesses.
- [ ] Repair older unedited generated blocks while preserving user content.
- [ ] Improve Git worktree handling for search and distribution.
- [ ] Add a health doctor for PATH, runtime, link, and harness-home problems.

## Later: registries, observability, and supply

- [ ] Render centralized MCP configuration into harness-native formats.
- [ ] Add model/provider registries and role-to-model assignment tools.
- [ ] Add optional local usage and cost tracking.
- [ ] Add cross-repository asset distribution with audience and content-hash checks.
- [ ] Build the creative divergence deck and taste-ledger commands described by some skills.

These are planned commands, not bundled integrations. Template skills explain the contracts
for user-owned implementations.

## Later: optional plugins

Basic `video`, `figure`, `ref`, and `eval` commands already exist in the source preview.
Possible plugins would isolate heavier media analysis, additional rendering backends, and
creative tooling while keeping the core CLI small.

## Contribution principles

1. Keep core modules on Node 22+ built-ins with zero npm runtime dependencies.
2. Store environment-variable names in configuration; keep secret values out of files.
3. Keep telemetry out of the tool. User-supplied graders, Git hooks, and separately configured
   skill tools retain their own behavior and permissions.
4. Verify behavior before promoting support claims, and report limitations for each revision.
