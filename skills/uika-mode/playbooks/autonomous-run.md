# Autonomous run

## When

Drive one declared task to an observable finish condition through bounded, verified iterations.

## Phrase hooks

"run until done", "work unattended", "keep going", "overnight run"

## Principles

- principle-prove-it-works
- principle-never-block-on-the-human
- principle-attack-the-premise
- principle-guard-the-context-window

## Steps

1. Run the session start: freshness scan, read WORKSTACK.md, confirm harness.
2. Declare allowed paths, actions, exclusions, and serial implementation scope so unattended authority is explicit.
3. Define an observable finish predicate and its verification command, stating that a duration is not a finish condition.
4. Declare resource and iteration limits, no-progress thresholds, failure conditions, and approval boundaries so stopping rules are checkable.
5. Select the applicable task playbook and copy its steps verbatim into todos so each iteration follows a declared method.
6. Execute one authorized serial iteration and record its hypothesis, changes, verification command, result, and evidence path.
7. Compare each iteration with the finish predicate and stop rules so continuation has a recorded justification.
8. Stop at any approval boundary under ADR-0056 §7 and prepare a reviewable handoff without treating silence as consent.
9. Apply `skills/wrap-checklist` and record the finish evidence or stop reason in a six-line WORKSTACK handoff block.

## Done when

The finish predicate is proven, or a declared boundary ends the run with an explicit incomplete handoff.

## Stop and escalate

- Stop for any required approval, exhausted limit, repeated failure, no progress, or scope expansion.
- Stop for protected-target changes or owner-applied deployment; unattended authority does not bypass the self-edit lock.
