# Bug fix

## When

Correct a reproducible defect with a failing check before the fix.

## Phrase hooks

"fix this bug", "this is broken", "regression", "reproduce and fix"

## Principles

- principle-prove-it-works
- principle-laziness-protocol
- principle-attack-the-premise
- principle-encode-lessons-in-structure

## Steps

1. Run the session start: freshness scan, read WORKSTACK.md, confirm harness.
2. Reproduce the reported symptom using `prompts/bugfix.md` and record the failing command and output.
3. Apply the `systematic-debugging` skill (from obra/superpowers, if installed) and trace the failure to a root cause supported by evidence.
4. Apply the `test-driven-development` skill (from obra/superpowers, if installed) and run a regression check that fails for the intended reason before changing production code.
5. Draft an ADR before any repo-level change and apply the smallest authorized fix on a feature branch with a reviewable diff.
6. Run the regression check, surrounding suite, and real reproduction until the defect is absent and results are recorded.
7. Review the diff for scope and record unrelated defects or recurring lessons in their appropriate homes.
8. Follow `playbooks/opening-a-pr.md`.

## Done when

The original reproduction and regression check pass, relevant checks pass, and the PR handoff is complete.

## Stop and escalate

- Stop if reproduction fails, the root cause remains unproven, or the fix crosses an approval boundary.
