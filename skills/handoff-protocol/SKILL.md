---
name: handoff-protocol
description: Use when naming an agent, branch, or commit tag, or when handing work to another agent or session — closed handle vocabulary plus the 6-line handoff block. Replaces ad-hoc slugs.
---

# Naming and handoff (ADR-0014)

## Handles — never invent
`<harness>.<role>`, lowercase. Harness: claude, codex, opencode, cline, gemini, commandcode, dsh, freebuff, mimo, hermes. Role: tower, scout, impl, review, judge. Duplicate handle → suffix `#2`.
Model goes in a `model:` field (family alias from `providers/registry.json`, e.g. opus, sonnet, gemini, kimi) — never in a handle, branch, filename, or thread title. No versions, dates, or counters in names.

## Branches and commits
Branch `<feat|fix|docs|chore>/<kebab-topic>`, at most 4 words, no agent names. Commit subject states the change; attribution lives in trailers.

## Handoff block (write into the WORKSTACK thread, not chat)
```
From→To: claude.impl → codex.review   model: sonnet
Done: <one line>
Next: <one line, imperative>
Files: <paths touched or to touch>
Verify: <exact command; receiver runs this first>
Blockers: <none | one line>
```
At most 10 lines. If it doesn't fit, the thread is too big: split it. Bulky output goes to a file; the block links the path.

## Receiver rules
1. Run `Verify` before anything else.
2. Continue only `Next`.
3. Anything outside `Files` needs a new block or a question to the estate.
