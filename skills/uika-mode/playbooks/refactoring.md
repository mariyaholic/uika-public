# Refactoring

## When

Change structure while preserving existing observable behavior.

## Phrase hooks

"refactor", "simplify this", "restructure without changing behavior"

## Principles

- principle-laziness-protocol
- principle-prove-it-works
- principle-encode-lessons-in-structure

## Steps

1. Run the session start: freshness scan, read WORKSTACK.md, confirm harness.
2. Define the structural goal and behavior invariants so preservation has explicit checks.
3. Run representative behavior checks before editing and record the baseline.
4. Search for reusable structures and draft an ADR before repo-level changes so the chosen approach is recorded.
5. Refactor in serial increments on a feature branch and rerun invariant checks after each increment.
6. Remove superseded paths within scope and inspect callers until no unintended legacy references remain.
7. Compare the real behavior against the baseline and record applicable suite results and any differences.
8. Follow `playbooks/opening-a-pr.md`.

## Done when

The structural goal is met, behavior invariants hold, and the PR handoff is complete.

## Stop and escalate

- Stop when behavior changes, coverage cannot establish preservation, or the change exceeds authorized scope.
