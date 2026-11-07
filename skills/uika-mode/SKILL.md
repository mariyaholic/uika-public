---
name: uika-mode
description: "Human-invoked or pinned Uika task router. Select one engineering playbook, copy its Steps verbatim into todos, apply principles read this session, and carry authorized work through verification and handoff under AGENTS.md."
---

# uika-mode

## 1. Entry

Enter when human-invoked or pinned by the human. This contract uses portable prose across harnesses. Omit harness-specific invocation keys.

`AGENTS.md` remains the governing law. Read `principles-index.md` at task start. Read applicable principle leaves before applying or citing them. The decision record is ADR-0056 at `register/adr/ADR-0056-uika-mode-router.md` in the Uika repo; read it at that path rather than guessing a filename.

In the Uika repo, resolve router resources under `skills/uika-mode/`. In a placed skill home, resolve `playbooks/` and `principles-index.md` beside this `SKILL.md`. Resolve principle leaves in sibling skill folders.

## 2. Match

Read `playbooks/README.md`. Match task intent and phrase hooks to one playbook. Read that playbook before execution. Default to investigation when intent remains unclear. Playbook files live in `playbooks/` beside this file; the principles index is `principles-index.md` beside this file.

Route an empirical fork to prototype. If running something can settle the choice, observe the result. Do not ask the Manager to predict it.

For compound tasks, choose the outer playbook and chain required playbooks at their applicable steps. Code-shipping playbooks end by chaining opening-a-pr. Each chain remains subject to the autonomy contract. Planning is not the default for every task.

| Phrase hook | Playbook |
|---|---|
| "why", "investigate", "compare alternatives" | investigation |
| "fix this bug", "regression" | bug-fix |
| "add", "build this behavior" | feature |
| "refactor", "preserve behavior" | refactoring |
| "try both", "which performs better" | prototype |
| "babysit this PR", "watch CI" | babysit |
| "ship", "land the stack" | shipping |
| "resume", "take over this branch" | session-pickup |
| "pause", "checkpoint", "hand off" | pause-safely |
| "plan phases", "design the rollout" | multi-phase-plan |
| "open a PR", "prepare the PR" | opening-a-pr |
| "run until done", "work unattended" | autonomous-run |

## 3. Todos

Before execution, copy the selected playbook's Steps verbatim into the todo list as its first items. Put task-specific detail beneath those steps as sub-items.

Never rewrite, reorder, or silently drop a step. Keep a skipped step listed with its original text and a sub-item saying "skip: <reason>".

Apply the same rule when chaining another playbook. Preserve the outer playbook's order.

## 4. Autonomy contract

Reversible work inside the sandbox is free within the authorized scope. Keep network egress on the allowlist.

Pause before an irreversible or protected action unless the session already supplies the required explicit authorization. This includes force-pushing shared branches, deletion outside the workspace, and messages to people.

Never push or rewrite main. Do not execute `uika deploy --apply` or `uika skills place --apply`. Prepare reviewable output for owner application.

Never edit self-governance files. This includes `AGENTS.md` variants, `estate.json`, harness homes, and harness configuration. Propose changes for the owner to apply.

Keep local credential files unread and untouched. Never read, print, write, or transmit secret values. Refer to keys only by environment-variable name.

Read `principle-never-block-on-the-human` when an approval boundary blocks progress. Continue useful authorized work, record the blocker, and prepare a reviewable handoff. Silence and unattended-run instructions grant no additional authority.

## 5. Reply law

Write short declarative sentences with one thought each. Use no em dashes. Avoid mid-sentence colons.

Label factual claims measured, inferred, or guess in the same sentence. Attach evidence to measured claims. Never fabricate links, citations, or transcript references. Link only to artifacts read or produced this session.

Name each principle that changed a decision and the specific choice it changed. Cite only principle leaves read during this session. Do not claim principle use from the index alone.

## 6. Delegation

Follow `skills/delegation-protocol` before every spawn. Use its four-section brief in its prescribed order. Include Handle, PoT, Objective, Output format, Tools allowed, Boundaries, and Budget. Default to 15 turns.

Require each delegate to read `uika-mode` and `principles-index.md`. Require the applicable playbook and principle leaves before relevant work or citation. Pass file pointers and a bounded task.

Delegates execute only their assigned task. They never select, run, or chain the playbook themselves.

Read-only fan-out is allowed. Implementation remains serial in the primary session under ADR-0005.

Prefer fresh agents. Resume an agent only when the task requires its local state. The parent owns todos, verifies returned evidence, reviews the diff, and writes the diff summary.

Resolve model roles through `setup-uika-models` and `providers/registry.json`. Use the alias's prompt-of-truth card for the resolved temperament card. Do not hardcode model names.

## 7. Finish

Read and apply `principle-prove-it-works`. Verify the real artifact against the requested behavior before declaring completion.

Run `skills/wrap-checklist`. Record completed work, remaining work, verification evidence, and blockers in `WORKSTACK.md`. Use the six-line handoff from `skills/handoff-protocol`.

Respect explicit read-only scope. When writing is forbidden, return the ready-to-record WORKSTACK handoff in the response.

## 8. Skill routing

Compose these skills when their conditions apply. Resolve skill folders under `skills/` in Uika and as sibling folders in a placed skill home.

| Condition | Skill |
|---|---|
| Recent work, dates, project nicknames | find-fast |
| Session entry and freshness trail | freshness-scan |
| Transfer or checkpoint | handoff-protocol |
| Script creation or reuse | script-hygiene |
| Writing file content | shell-safe-writes |
| Language tools and checks | toolchains |
| MCP configuration or key references | mcp-and-keys |
| Creative brief | creative-gates |
| Programmatic video | video-pipeline plus an applicable theme pack |
| Generated video verification | video-review |
