---
name: script-hygiene
description: Use before writing any helper script (py, ps1, sh, mjs) or when a repo's tools/ folder is growing — search first, use the three tiers, never create variant-suffix scripts. Stops workaround-script bloat.
---

# Script hygiene (ADR-0015)

## Before you write a script
1. Search: `Grep`/`Glob` the repo's `tools/` (and `tools/REGISTRY.md` if present) for the capability. If it exists, **extend it with a flag**.
2. Ask: is this a one-off? Then it is *scratch*.

## Three tiers
| Tier | Lives in | Rules |
|---|---|---|
| scratch | the session scratchpad, never the repo | delete at wrap; never committed |
| repo tool | `tools/<verb>_<noun>.<ext>` | docstring + `--help`, one capability, listed in `tools/REGISTRY.md` |
| estate tool | the uika CLI (`src/` in the uika repo) | needs an ADR |

A scratch script used a second time is promoted (tier 2) — or deleted. It never lingers in `tools/`.

## Forbidden names
No variant suffixes: `_v2 _retry _3passes _remaining _missing _final _tmp _old _new _backup _failure_stories`. A variant is a **flag or argument** on the existing tool (`--retry`, `--only-missing`, `--passes 3`). Two scripts that share a stem are a defect.

## At wrap
Prune scratch, update `tools/REGISTRY.md` (name, one line, owner handle), run `uika audit <repo>` and clear any cluster you created.

## Why
A `tools/` directory once reached 189 scripts with clusters like `pipeline_{remaining,missing,retry,3passes}`. Cataloging afterwards did not stop it; only gating creation does.

## Toolchain
Scripts may use dependencies (ADR-0023): Python via `uv run` with PEP 723 inline metadata, Node ESM with a `package.json`, and declare them beside the script. Reach for a library before hand-rolling parsers, HTTP or date math. See skills/toolchains.
