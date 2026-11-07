# Multi-phase plan

## When

Design work spanning several verifiable phases before implementation begins.

## Phrase hooks

"make a phased plan", "plan the migration", "break this into phases"

## Principles

- principle-guard-the-context-window
- principle-laziness-protocol
- principle-prove-it-works

## Steps

1. Run the session start: freshness scan, read WORKSTACK.md, confirm harness.
2. Define the outcome, exclusions, constraints, and final acceptance check so the plan has a finish predicate.
3. Inspect only the evidence needed to identify dependencies, risks, and reusable capabilities so assumptions are listed.
4. Draft an ADR before any new repo-level decision so the plan references its decision basis.
5. Divide the work into dependency-ordered phases with deliverables, touched paths, and a check ending every phase.
6. Specify serial implementation under ADR-0005 and any separately authorized read-only research so execution order is explicit.
7. Define rollback points, approval boundaries, and failure responses so each phase has a safe stopping state.
8. Review the plan against the final acceptance check and record a WORKSTACK handoff naming the first executable phase.
9. Apply `skills/wrap-checklist` and deliver the plan with implementation explicitly unstarted.

## Done when

Each phase ends in a check, dependencies and approval boundaries are explicit, and the first action is executable.

## Stop and escalate

- Stop for an unresolved owner decision, uncheckable acceptance criteria, or a request to parallelize implementation.
