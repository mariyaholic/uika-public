---
name: correct-structure
description: "Use when repeated mistakes reveal a missing constraint. Mine incidents, prevent recurrence structurally, and prove each enforcer rejects a real past mistake."
---

# Correct Structure

Turn repeated corrections into constraints at the earliest effective boundary.

## Compose
Read and apply `skills/principle-encode-lessons-in-structure/SKILL.md`.
For implementation, read and apply the `test-driven-development` skill (from obra/superpowers, if installed).
Use its red-green-refactor procedure rather than restating it here.

## Mine
1. Bound the review to a repository, time range, and relevant paths.
2. Inspect git history and reverts, available review comments, and workaround notes.
3. Read relevant entries in `register/LEARNINGS.md`, `register/postmortems/`,
   and blockers in `WORKSTACK.md`.
4. Record incident pointers and observed failures. Label inferences explicitly.
5. Two distinct incidents with the same causal failure make a mistake class.
   Duplicate reports of one incident count once.
6. Keep lone incidents as candidates. Do not invent recurrence.

## Choose the highest effective constraint
For each class, try these levels in order.
Record why an earlier level cannot prevent the mistake before moving lower.

1. Architecture. Give state one owner and tasks one supported path.
   Hide internals and remove dead examples that invite copying.
2. Types. Make the invalid state impossible to express.
3. Lint. Add an actionable warning through `uika lint`.
   Its message must name the fix. Preserve Uika's warn-only lint behavior.
4. Behavior tests. Exercise observable behavior through
   `npm test` in the uika repo for uika CLI changes.
5. Docs last. Explain the remaining judgment that executable checks cannot enforce.

Search existing tools with `skills/script-hygiene` before adding a checker.
Draft an ADR before implementing an estate-level enforcer change.
Treat AGENTS.md variants, estate.json, and harness configuration edits as proposals
for owner application. Never apply them through this skill.

## Prove
1. Reproduce a real past mistake in an isolated fixture or scratch checkout.
   Record its source commit, review, or incident pointer.
2. Demonstrate that the proposed check rejects it for the intended reason.
   For a structural constraint, show the old operation is rejected or unavailable.
3. Confirm the failure is not a missing dependency or unrelated setup error.
4. Apply the smallest correction and show valid behavior passes.
5. Run relevant checks. For Uika CLI changes, run
   `npm test` in the uika repo and inspect `uika lint` warnings.
6. A clean lint exit alone is not proof because warnings do not fail the command.
7. Keep both rejection and corrected-case evidence. Unrun proof stays pending.

## Rule table
Produce this table with concrete evidence pointers.

| rule | mistake class | enforcer | proof it fails | status |
| --- | --- | --- | --- | --- |
| <constraint> | <two incident pointers> | <boundary or check> | <reproduction and observed rejection> | <proposed, proven, or blocked> |

Review existing rules during each pass.
Drop rules whose mistake can no longer happen and record the structural reason.
Keep rules while their failure remains reachable.
Do not retain redundant reminders as permanent policy.

## Finish
Record findings in `register/LEARNINGS.md` and update `WORKSTACK.md`.
Apply `skills/wrap-checklist/SKILL.md`.
Report measured proof, unresolved classes, and proposals awaiting owner application.
