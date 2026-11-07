---
name: principle-guard-the-context-window
description: "Use when exploration or output threatens useful context. Keep bounded evidence in the main thread and delegate only authorized read-only work."
---

# Principle · Guard the Context Window

**Rule.** Preserve decision-relevant context through bounded reads, concise evidence, and scoped read-only delegation when authorized.

**Why.** Raw payloads can displace the task, constraints, and evidence. Focused summaries preserve room for sound decisions.

## Do
- Use `skills/freshness-scan` and `skills/find-fast` with `uika find` or `uika where` to locate relevant material.
- Read targeted sections and bound command output.
- Keep artifact paths, findings, uncertainties, and next actions in summaries.
- When delegation is authorized, follow `skills/delegation-protocol` with disjoint read-only briefs and explicit budgets.
- Keep implementation serial under ADR-0005.
- Preserve open threads through `WORKSTACK.md` and `skills/handoff-protocol` when writes are authorized.

## Don't
- Paste bulk logs or entire documents when excerpts suffice.
- Spawn agents without authorization or the required brief.
- Delegate parallel implementation.
- Cite a principle leaf that you have not read.

## Done signal
The active context retains the objective, boundaries, evidence locations, blockers, and next action.

Indexed in skills/uika-mode/principles-index.md. Read this leaf before citing it in a reply.
