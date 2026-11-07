# uika-mode · principles index

The router reads this index at task start under ADR-0056. Cite a principle only after reading its leaf file during the current session.

| name | group | one-line rule | path |
|---|---|---|---|
| principle-prove-it-works | verification | Verify the real artifact against requested behavior before declaring completion. | skills/principle-prove-it-works/SKILL.md |
| principle-encode-lessons-in-structure | meta | Turn recurring corrections into executable checks or structural invariants. | skills/principle-encode-lessons-in-structure/SKILL.md |
| principle-never-block-on-the-human | delegation | Continue useful authorized work, record blockers, and prepare reviewable handoffs. | skills/principle-never-block-on-the-human/SKILL.md |
| principle-guard-the-context-window | delegation | Preserve decision-relevant context through bounded reads and authorized read-only delegation. | skills/principle-guard-the-context-window/SKILL.md |
| principle-laziness-protocol | core | Prefer deletion, reuse, and the smallest change that satisfies requested behavior. | skills/principle-laziness-protocol/SKILL.md |
| principle-attack-the-premise | core | Test the shared premise when repeated fixes fail the same gate. | skills/principle-attack-the-premise/SKILL.md |

Deferred: the remaining pstack principles stay out of v1 (ADR-0056 §4).
