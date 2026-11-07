# Session pickup

## When

Resume a prior thread or take over an existing branch using its recorded handoff.

## Phrase hooks

"resume", "pick this up", "take over this branch", "continue the handoff"

## Principles

- principle-guard-the-context-window
- principle-prove-it-works

## Steps

1. Run the freshness scan, read WORKSTACK.md, and confirm harness so the active thread and receiver identity are established.
2. Locate the six-line handoff block and extract From→To, Done, Next, Files, Verify, and Blockers before further task exploration.
3. Run the handoff's Verify command before other task work and record the result.
4. Compare the branch, working tree, and listed files against the handoff so drift and existing changes are identified.
5. Reconcile blockers and continue only the recorded Next within Files so resumed scope stays checkable.
6. Select the applicable execution playbook and copy its steps verbatim into todos so the continuation follows one declared path.
7. Record the pickup verification and current ownership in WORKSTACK.md so the next receiver can identify the active state.

## Done when

The handoff is verified, ownership is recorded, and authorized continuation has a declared playbook.

## Stop and escalate

- Stop for a missing handoff, failed Verify, unexplained drift, or work outside Files.
