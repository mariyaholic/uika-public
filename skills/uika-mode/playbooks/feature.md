# Feature

## When

Build new or changed behavior with observable acceptance criteria.

## Phrase hooks

"add a feature", "implement this", "support this behavior"

## Principles

- principle-prove-it-works
- principle-laziness-protocol
- principle-guard-the-context-window

## Steps

1. Run the session start: freshness scan, read WORKSTACK.md, confirm harness.
2. Define the user behavior, domain data shape, scope, and acceptance checks so success is observable.
3. Search existing capabilities and draft an ADR before a repo-level change so the approach has a recorded basis.
4. Divide nontrivial work into serial units with a check at each boundary so implementation order is explicit.
5. Implement the smallest complete behavior on a feature branch and verify each unit before starting the next.
6. Check progress midway through nontrivial work against remaining scope and record any justified plan adjustment.
7. Exercise the real user path and applicable toolchain checks until acceptance evidence and limitations are recorded.
8. Follow `playbooks/opening-a-pr.md`.

## Done when

Requested behavior passes its acceptance checks and the PR handoff is complete.

## Stop and escalate

- Stop for unresolved product requirements, failed acceptance gates, or required owner approval.
