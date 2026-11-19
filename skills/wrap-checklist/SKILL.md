---
name: wrap-checklist
description: Mandatory session-ending routine — verification suite, WORKSTACK update, memory hygiene, estate learnings.
---

# Wrap checklist

Before declaring a session done, in order:

## 1. Verify what you did
Run the repo's suite per its WORKSTACK "Verification" section — usually: lint → typecheck → tests. If any fails, either fix now or move the fix onto WORKSTACK as an open thread. Don't launder failures into "done".

## 2. Update WORKSTACK.md (Setlist ≤ 120 lines)
- Keep `WORKSTACK.md` concise (`<= 120` lines, ADR-0073) and archive closed/long threads verbatim into `WORKSTACK-FULL.md`.
- Mark closed threads closed (one line each) and preserve a complete 6-line `From→To` handoff block verified by `uika session check`.
- Add open threads for anything left unbuilt or untested, with the smallest next action.
- Update the "Verification" section if the runbook changed.

## 3. Memory hygiene & Cross-Repo SIM Sync
- If auto-memory was written: skim what it saved; delete stale, keep ≤ a line per entry in MEMORY.md.
- Anything that hardened into decision/behavior → real home: ADR (decisions, checked with `uika manuscriptus check|next`), LEARNINGS.md (`Encore` SIM schema, ADR-0071), or the repo's AGENTS.md via chat proposal only (self-edit lock).
- In sibling repos, after adding an `Encore` SIM entry to `LEARNINGS.md`, sync it back to the canonical estate repo:
  - If the main estate is on local disk: `node <UIKA_ROOT>/bin/uika.mjs encore ingest LEARNINGS.md --root <UIKA_ROOT>`.
  - In cloud sessions without local disk access (when `gh` can access `<owner>/<estate-repo>`): `uika encore push LEARNINGS.md --auto-merge` (otherwise keep it committed in `LEARNINGS.md` for `uika encore pull-github`).

## 4. Register
- New estate-level decision made today without an ADR → draft it before wrap (`register/adr/`) after running `uika manuscriptus next`.
- `register/LEARNINGS.md` gets one `Encore` SIM block (`### <title>` with `Area`, `Problem cluster`, `Root cause`, `Rationale`, `Predicted vs observed`, `Provenance`), validated with `uika encore lint`.
- For HTML/JS/CSS edits, run `uika unmask check` before declaring done.

## 5. Clean exit
- No uncommitted sorcery: `git status --porcelain` either matches the wrap plan (committed to a feature branch) or is an understood WIP state.
- No background agents left running; report token/cost if the harness emits it.

## Output

```
Wrap: verified (N tests green) / workstack updated (M threads) / memory pruned / registered
```

## Toolchain
Run the row for the language you touched (skills/toolchains): Python `ruff check` + `pytest`; TypeScript `tsc --noEmit` + `vitest`; JavaScript `node --test`; Rust `cargo fmt --check` + `cargo clippy` + `cargo test`; C++ `cmake --build build` + `ctest`; HTML/CSS Playwright screenshots. Missing tool: say so, do not skip silently.
