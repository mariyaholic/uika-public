# Opening a PR

## When

Publish or update a reviewable feature-branch PR, or finalize an existing PR handoff.

## Phrase hooks

"open a PR", "prepare the PR", "submit for review", "update this PR"

## Principles

- principle-prove-it-works
- principle-guard-the-context-window

## Steps

1. Run the session start: freshness scan, read WORKSTACK.md, confirm harness.
2. Confirm a feature branch named <type>/<kebab> with at most four words under `skills/handoff-protocol` so the branch is eligible.
3. Inspect the complete diff and intended base so scope, protected files, generated files, and unrelated changes are accounted for.
4. Run acceptance checks and required repo checks, including applicable uika validation, so current evidence matches the reviewed diff.
5. Prepare the PR briefing with what changed, why, verification evidence, limitations, and ADR references so reviewers can assess the result.
6. Apply `skills/wrap-checklist` and write the six-line WORKSTACK handoff block so verification, open threads, and the next action are recorded.
7. Commit scoped changes in ordered conventional commits and inspect status so the intended PR content is committed.
8. Push only the feature branch, never main, and create or update the PR with a conventional title and the prepared briefing.
9. Verify the remote head and PR diff against the checked commits and report the PR link and any pending gates.

## Done when

The PR targets the intended base, contains the verified commits and briefing, and has a WORKSTACK handoff.

## Stop and escalate

- Stop for failed checks, unexpected remote changes, protected-file edits, or an action requiring unavailable approval.
- If already delivered, verify the existing PR record and explicitly mark inapplicable publication steps skipped without creating a duplicate.
