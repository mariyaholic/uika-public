---
name: shell-safe-writes
description: Use when about to create or edit a file through a shell (heredoc, echo, python -c, PowerShell here-string) or when a shell command fails with quote/EOF/escape errors — routes file content around shell quoting. For deep PowerShell, also load powershell-safe-execution.
---

# Shell-safe writes (ADR-0015)

## The rule
**File content never travels through shell quoting.** Use the Write tool (new/whole file) or Edit (partial). If a script must run, Write it to a file first, then run the file.

## Why (seen 2026-09-29)
- A multi-line heredoc containing apostrophes, `$`, backticks or regexes failed with `unexpected EOF while looking for matching '` and nothing executed.
- `python -` heredocs with JS regexes in normal strings raised invalid-escape warnings and silently corrupted `\/`, `\s`, `\[` — the written JS was broken. Use raw strings or, better, Edit.

## Do
- Bash tool = POSIX syntax (`/dev/null`, `$VAR`, forward slashes). PowerShell tool = PowerShell 5.1: **no `&&`/`||`**, use `;` and `if ($?) {}`.
- Only for short, quote-free commands may you inline; otherwise script file.
- PowerShell writing text: `Set-Content -Encoding utf8` (5.1 `>` may add a BOM; `Set-Content` defaults to ANSI). Here-strings `@'...'@` need the closer at column 0.
- Preserve the file's line endings (CRLF vs LF) and BOM when scripting edits; prefer the Edit tool, which does.
- Chain with `&&` in Bash only when the first command's exit code is meaningful (a linter that prints warnings but exits 0 will not stop a commit).
- Verify a write with a cheap check (`node --check`, run the tool, `git diff --stat`), not by re-reading the file.

## Don't
- Don't mix syntaxes (PowerShell `$env:X` in Bash; `&&` in PS 5.1).
- Don't generate config or code with `echo >>` line-by-line.
- Don't put credentials in any command line.

## Toolchain
Edit structured files with a parser, not a regex: Python `json`/`tomllib`/`ruamel.yaml`, Node `JSON.parse`/`yaml`. Write scripts to files and run them with `uv run` (Python) or `node` (ESM). See skills/toolchains.
