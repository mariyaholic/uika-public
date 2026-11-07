# Investigation

## When

Answer a question about behavior, rationale, or alternatives through read-only evidence.

## Phrase hooks

"investigate", "how does this work", "why was this built", "compare these options"

## Principles

- principle-guard-the-context-window
- principle-prove-it-works
- principle-attack-the-premise

## Steps

1. Run the session start: freshness scan, read WORKSTACK.md, confirm harness.
2. State the question, competing explanations, and read-only boundary so the investigation has a checkable scope.
3. Locate relevant sources with `uika find` or `uika where` (skills/find-fast) and record the evidence paths.
4. Trace the behavior through targeted reads and non-mutating checks until each explanation has supporting or contradicting evidence.
5. Test any repeatedly failing premise with a non-mutating check and record the observed result.
6. Report the answer with claims labelled measured, inferred, or guess and unresolved questions listed.
7. Apply `skills/wrap-checklist` within the read-only boundary and provide proposed ledger updates in the handoff.

## Done when

The question has an evidence-backed answer or an explicit evidence gap. No implementation ships.

## Stop and escalate

- Stop when answering requires mutation, unavailable access, or owner approval.
