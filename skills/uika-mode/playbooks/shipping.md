# Shipping

## When

Prepare verified changes for delivery and perform only the landing actions already authorized.

## Phrase hooks

"ship this", "land the stack", "prepare this for delivery"

## Principles

- principle-prove-it-works
- principle-never-block-on-the-human

## Steps

1. Run the session start: freshness scan, read WORKSTACK.md, confirm harness.
2. Enumerate the delivery scope, dependency order, exact heads, and authorized landing actions so authority is explicit.
3. Inspect each diff and independently run applicable acceptance checks against its exact head so every candidate has a verdict.
4. Resolve blockers serially within scope and invalidate old verdicts whenever a patch or base changes.
5. Record the contiguous verified delivery order and rollback or recovery procedure so landing readiness is reviewable.
6. Execute only explicitly authorized landing actions in dependency order and verify each resulting state before continuing.
7. Record delivered and pending items with exact heads and evidence so any approval-dependent remainder has a clear handoff.
8. Follow `playbooks/opening-a-pr.md`.

## Done when

Every scoped item is delivered with verified results or explicitly pending approval with a reviewable PR handoff.

## Stop and escalate

- Stop for stale verification, failed delivery checks, missing landing authority, or owner-applied deployment.
- Never push or rewrite main; protected-target changes remain owner-applied.
