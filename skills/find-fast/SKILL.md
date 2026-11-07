---
name: find-fast
description: Use whenever the user refers to something by recency ("recently made", "yesterday", "last week", "from Sept 27") or by a project or nickname ("the api", "the music player", "the docs site", "the retro port") — resolves it to real paths in one command instead of exploring directories.
---

# Find fast (ADR-0019)

Never start with `ls`, recursive `find`, or a broad Glob when the request is fuzzy. Translate the phrase, run one command, read the top hit.

```
uika where [name]                                      # spoken name -> paths ("where" alone lists all)
uika find [words..] [--project p|all] [--since W] [--on D] [--ext md,py] [--n 15]
```

## Phrase → flags
| User says | Run |
|---|---|
| "the thing I just made / recently / a moment ago" | `find --since 3h` (widen: `1d`, then `1w`) |
| "yesterday" / "today" | `find --on yesterday` / `--on today` |
| "on Sept 27" / "from the 27th" | `find --on 2026-09-27` (convert to ISO; assume the current year) |
| "last week" / "this month" | `find --since week` / `--since month` |
| "in the api" / "the api repo" | `find --project api` (aliases resolve; see `where`) |
| "the retro port stuff from Tuesday" | `find --project retro --on <ISO date>` |
| "that notes file about X" | `find X --ext md --since 1w` (words match anywhere in the path) |
| "the videos I made / renders / keynotes" | `find --project <p> --ext mp4,mov --since 3d` (no video plane is bundled in uika 0.1.0) |

## Rules
1. Combine filters; it is one call. Start narrow, widen once (3h → 1d → 1w → all projects) before asking the user.
2. Results are mtime-sorted and include uncommitted files (git would miss them, ADR-0006).
3. If a name is unknown, run `where` (lists every registered project) and pick the closest; if two plausible candidates, name both and ask one question.
4. When you learn a new nickname, add it to `projects/registry.json` aliases (an unlocked file) so the next agent is faster.
5. After `find`, `Read` the top hit; use `Grep` only inside the resolved path.
6. `--project all` is slower (it walks every registered root, including mirror drives); the scan self-limits at 25s and says when truncated.

## Toolchain
Uses `git ls-files` and Node built-ins. ripgrep (`rg`) and `fd` are welcome accelerators when installed (`winget install BurntSushi.ripgrep.MSVC`); fall back to `Grep`/`Glob` when they are not. See skills/toolchains.
