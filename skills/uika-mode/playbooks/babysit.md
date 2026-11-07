# Babysit

## When

Watch an existing job, PR, or CI run until its declared green condition or stop condition.

## Phrase hooks

"babysit this PR", "watch CI", "monitor this job", "get this green"

## Principles

- principle-prove-it-works
- principle-never-block-on-the-human
- principle-guard-the-context-window

## Steps

1. Run the session start: freshness scan, read WORKSTACK.md, confirm harness.
2. Record the target identity, watch-only or repair mode, green predicate, polling interval, deadline, and stop conditions.
3. Inspect the current run or PR head and record its status and blocking evidence.
4. Poll at the declared bounded interval until a status change, green predicate, or stop condition is observed.
5. Diagnose failures from logs and repair only within declared authorization so every attempted repair has recorded evidence.
6. Recheck the latest run or exact PR head after each repair until all declared gates pass or a stop condition is recorded.
7. Apply `skills/wrap-checklist` and write a WORKSTACK handoff block containing the final status and next action.

## Done when

The declared target is green with current evidence, or monitoring ends with an explicit blocker. Green alone does not authorize merging.

## Stop and escalate

- Stop at the deadline, repeated failure limit, scope change, or approval boundary.
