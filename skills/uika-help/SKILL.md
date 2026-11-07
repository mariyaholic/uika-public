---
name: uika-help
description: "Human-invoked guide to Uika playbooks and skills. Clarify the desired outcome in one question when needed, name the applicable route, and return a ready-to-paste uika-mode prompt with a concrete completion condition."
---

# uika-help

Help the Manager choose a route. If the desired outcome is unclear, ask one question.

"What outcome do you want, and what observable result will count as done?"

Name the matching playbook or skill. Use `uika-mode/playbooks/README.md` for engineering routes. Resolve it under `skills/` in Uika or beside the sibling `uika-mode` skill in a placed skill home.

Default unclear engineering work to investigation. Route observable design forks to prototype.

Return a ready-to-paste prompt. Replace every placeholder with task-specific wording.

```text
Use uika-mode. Playbook: <name>. Task: <...>. Done when: <...>.
```

When a skill is the primary fit, name it and include its use in the Task field. This prompt grants no additional authority.

| Playbook | When |
|---|---|
| investigation | Explain behavior or compare evidence |
| bug-fix | Correct a reproducible defect |
| feature | Add observable behavior |
| refactoring | Change structure while preserving behavior |
| prototype | Settle a fork through observation |
| babysit | Watch a job, PR, or CI |
| shipping | Deliver verified changes within authorization |
| session-pickup | Resume recorded work |
| pause-safely | Checkpoint unfinished work |
| multi-phase-plan | Design several verifiable phases |
| opening-a-pr | Prepare or update a reviewable PR |
| autonomous-run | Run a bounded task to a declared finish |
