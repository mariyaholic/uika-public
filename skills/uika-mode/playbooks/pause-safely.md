# Pause safely

## When

Checkpoint unfinished work so another session can resume without guessing or unsafe partial changes.

## Phrase hooks

"pause", "checkpoint this", "stop safely", "leave a handoff"

## Principles

- principle-guard-the-context-window
- principle-never-block-on-the-human
- principle-prove-it-works

## Steps

1. Run the session start: freshness scan, read WORKSTACK.md, confirm harness.
2. Inventory the current step, working tree, and running jobs so unfinished operations and ownership are explicit.
3. Finish or safely reverse the current operation and confirm no protected-file change remains half-applied.
4. Stop owned background work or transfer its monitoring with a recorded target and stop condition.
5. Run applicable checkpoint checks and record passing results, failures, and unrun checks without claiming completion.
6. Write the six-line `skills/handoff-protocol` block in WORKSTACK.md with an exact Verify command and smallest Next action.
7. Apply `skills/wrap-checklist` and commit scoped WIP on a feature branch using a conventional commit so the checkpoint has a commit ID.
8. Inspect the final working tree and report the branch, commit, and understood remaining state so resumption is unambiguous.

## Done when

WIP is committed on a feature branch, the handoff is complete, and no unsafe partial operation remains.

## Stop and escalate

- Stop for uncertain file ownership, an operation that cannot safely finish or reverse, or protected-file changes requiring owner recovery.
