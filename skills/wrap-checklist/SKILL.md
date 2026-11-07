---
name: wrap-checklist
description: Mandatory session-ending routine — verification suite, WORKSTACK update, memory hygiene, estate learnings.
---

# Wrap checklist

Before declaring a session done, in order:

## 1. Verify what you did
Run the repo's suite per its WORKSTACK "Verification" section — usually: lint → typecheck → tests. If any fails, either fix now or move the fix onto WORKSTACK as an open thread. Don't launder failures into "done".

## 2. Update WORKSTACK.md
- Mark closed threads closed (one line each).
- Add open threads for anything you left unbuilt/untesteed, with the smallest next action.
- Update the "Verification" section if the runbook changed.

## 3. Memory hygiene
- If the estate (Claude) wrote auto-memory: skim what it saved; delete stale, merge duplicates, keep ≤ a line per entry in MEMORY.md.
- Anything that hardened into decision/behavior → real home: ADR (decisions), LEARNINGS.md (what worked/what snapped), or the repo's AGENTS.md via chat proposal only (self-edit lock).

## 4. Register (Uika sessions only)
- New estate-level decision made today without an ADR → draft it before wrap (register/adr/).
- LEARNINGS.md gets one explicit entry for: the one thing that surprised you.

## 5. Clean exit
- No uncommitted sorcery: `git status --porcelain` either matches the wrap plan (committed to a feature branch) or is an understood WIP state.
- No background agents left running; report token/cost if the harness emits it.

## Output

```
Wrap: verified (N tests green) / workstack updated (M threads) / memory pruned / registered
```

## Toolchain
Run the row for the language you touched (skills/toolchains): Python `ruff check` + `pytest`; TypeScript `tsc --noEmit` + `vitest`; JavaScript `node --test`; Rust `cargo fmt --check` + `cargo clippy` + `cargo test`; C++ `cmake --build build` + `ctest`; HTML/CSS Playwright screenshots. Missing tool: say so, do not skip silently.
