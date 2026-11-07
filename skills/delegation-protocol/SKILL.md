---
name: delegation-protocol
description: Use when spawning any subagent — the mandatory four-section task brief plus default turn budgets and effort-scaling rules.
---

# Delegation protocol

Every subagent spawn carries a four-section brief. No brief, no spawn.

## The brief (four sections, verbatim order)

```
Handle: <harness.role per skills/handoff-protocol; model in a field, not the name>
PoT: <model alias; orchestrator pastes the alias's prompt-of-truth here (ADR-0020), or "none">
Read first: <absolute path to uika-mode/SKILL.md>; <absolute path to uika-mode/principles-index.md> (required for code and review delegates; read-only scouts may skip)
Objective: <one sentence. what must exist when you're done — outcome, not process>
Output format: <exact artifacts + shape: file paths, table columns, compact markdown, JSON keys>
Tools allowed: <explicit list: e.g. Read, Grep, Glob, Bash(git -C ...) ; deny by omission>
Boundaries: <what NOT to touch: paths, the self-edit lock target files, turns, egress>

Budget: <turns [default 15] — hard stop at the cap, partial-output is acceptable>
```

On return, the subagent answers with the handoff block from `skills/handoff-protocol` (ADR-0014), not free prose.

## Fifth requirement for code and review delegates (ADR-0056)

Keep the four brief sections in their prescribed order. Add a `Read first:` line for code and review delegates. Read-only scouts may skip it.

The parent resolves absolute paths to `uika-mode/SKILL.md` and its adjacent `principles-index.md`. Use `skills/uika-mode/` in the Uika repo or `uika-mode/` in the placed skill home. Pass both resolved paths in the brief.

Read both files before assigned work. Read the applicable playbook and principle leaves before relevant work or citation. Execute only the bounded assignment. Never select, run, or chain a playbook independently.

Missing copy: stop and report; do not run the playbook yourself; the parent owns the todos.

## Effort scaling (bake these into orchestrator prompts)

| Task type | Subagents | Calls each |
|---|---|---|
| Fact-finding / single lookup | 1 | 3–10 |
| Comparison / analysis | 2–4 | 10–15 |
| Broad sweep / audit / research | 3–6 | 15+ |

- Read-only fan-out is always allowed; implementation stays in the primary session (ADR-0005).
- Subagents hand back artifacts on disk, not in chat, when the output is bulky — return the path plus a ≤10-line distillate ("bypass the phone game").
- Describe each subagent's task concretely enough that two briefs never produce identical searches: objective + boundaries make them disjoint, output format makes them mergeable.

## Cancellation
If a subagent exceeds budget or returns off-topic output, kill it; never argue with it. Rewrite the brief with a sharper Objective before respawning.

## Toolchain
Name the language toolchain a delegate should use in the brief's Tools line (skills/toolchains) so it does not hand-roll what a standard tool provides.
