---
name: eval-hillclimb
description: Use when improving a skill, instruction file, prompt, or tool description against the eval forest — one change per iteration, train/test split, noise baseline, keep-or-revert. Adopted from claude.dev hillclimbing and RRSI (ADR-0018).
---

# Eval hillclimb (ADR-0018)

## Setup (once)
- Tasks in `labs/eval/tasks/` carry `split: train|test`. Roughly two thirds train.
- **Noise baseline**: run every task 3x on the unchanged config. Note the spread; improvements below it are noise.
- Work on a branch `chore/hillclimb-<topic>`; each iteration is one commit (candidate provenance).

## Loop
1. Read the previous **train** failures (root causes, not transcripts).
2. Propose **one** change to **one** file (skill text, instruction line, tool description).
3. Run train and test.
4. **Keep** if train improves and test does not regress. **Revert** if train-only gain or any regression.
5. Shrink the edit size each round. Track cost (tokens per pass) as a metric; a cheaper equal-score config is a win.

## Stall rule
Three flat rounds → stop editing. Categorise the remaining failures by root cause (ambiguous task, contradictory grader, harness quirk, genuine skill gap). Fix the eval first when the cause is ambiguity.

## Guardrails
- Never paste failure transcripts or reference answers into the prompt being tuned (transcript isolation).
- Do not choose tasks just because today's model fails them; sample from real incidents and human-hard cases.
- Persistent failure = suspect the eval before the harness.
- Log each kept change in `register/LEARNINGS.md` with the score delta.

## Toolchain
Graders are ordinary programs: Python with `pytest` (numpy/scipy for noise statistics) or Node `node --test`. Pin grader dependencies so a re-run is comparable. See skills/toolchains.
