# uika-mode playbooks (v1)

The router selects one playbook under ADR-0056 §3 and copies its Steps verbatim into todos, keeping any skipped step listed as "skip: <reason>". Read the applicable principle leaves before citing them.

| playbook | when |
|---|---|
| [investigation](investigation.md) | Answer a question about behavior, rationale, or alternatives through read-only evidence. |
| [bug-fix](bug-fix.md) | Correct a reproducible defect with a failing check before the fix. |
| [feature](feature.md) | Build new or changed behavior with observable acceptance criteria. |
| [refactoring](refactoring.md) | Change structure while preserving existing observable behavior. |
| [prototype](prototype.md) | Settle an empirical design fork by observing a small throwaway implementation. |
| [babysit](babysit.md) | Watch an existing job, PR, or CI run until its declared green condition or stop condition. |
| [shipping](shipping.md) | Prepare verified changes for delivery and perform only the landing actions already authorized. |
| [session-pickup](session-pickup.md) | Resume a prior thread or take over an existing branch using its recorded handoff. |
| [pause-safely](pause-safely.md) | Checkpoint unfinished work so another session can resume without guessing or unsafe partial changes. |
| [multi-phase-plan](multi-phase-plan.md) | Design work spanning several verifiable phases before implementation begins. |
| [opening-a-pr](opening-a-pr.md) | Publish or update a reviewable feature-branch PR, or finalize an existing PR handoff. |
| [autonomous-run](autonomous-run.md) | Drive one declared task to an observable finish condition through bounded, verified iterations. |

## Deferred

- hillclimb
- runtime/trace forensics
- visual parity
- eval
- orchestrate
- autopilot-*
- worktree-cleanup
- authoring-a-skill

Existing skill-authoring decisions continue to apply.
