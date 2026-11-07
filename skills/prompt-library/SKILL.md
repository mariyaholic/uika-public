---
name: prompt-library
description: "TEMPLATE — Render prebuilt, variable-checked task prompts from a shared prompt catalog instead of improvising."
---

# Prompt library (Template)

Renders standardized, variable-checked prompts from `<PROMPTS_DIR>` for recurring engineering and creative workflows (bugfixes, reviews, research, onboarding, handoffs, briefs) so agents follow verified instructions rather than improvising.

## Trigger

Use when starting a common recurring task (feature, bugfix, code review, research spike, onboarding, handoff, design/video brief, or model/MCP configuration change).

## Inputs

- `<PROMPT_CLI>`: Command-line tool that lists and renders prompt templates.
- `<PROMPTS_DIR>`: Directory containing markdown prompt templates (`*.md`) with YAML frontmatter (`name`, `use`, `vars`).
- `<PROMPT_NAME>`: Identifier of the template to render (e.g., `bugfix`, `review`, `verify`).
- `<PROMPT_VARS>`: Key-value pairs (`key="value"`) required by the selected template's `vars` frontmatter.

## Steps

1. List available templates with `<PROMPT_CLI>` to match the task to an existing prompt in `<PROMPTS_DIR>`.
2. Inspect required variables and render the prompt to stdout:
   ```sh
   <PROMPT_CLI> <PROMPT_NAME> <PROMPT_VARS>
   ```
3. Execute the rendered prompt's instructions and run its explicit `Verify` command before claiming completion.
4. When delegating the rendered prompt to a subagent, wrap it in the four-section brief with `Handle:` per `skills/delegation-protocol` and require return via `skills/handoff-protocol`.
5. To improve a prompt template, edit its canonical file in `<PROMPTS_DIR>` and evaluate the change against held-out tasks via `skills/eval-hillclimb` rather than forking ad-hoc prompt variants.

## Gates

- Missing required template variables in `<PROMPT_VARS>` must fail loudly with a non-zero exit code; never render a prompt with unresolved `<var>` placeholders.
- Never claim a prompted task is complete without running the rendered prompt's `Verify` line.
- Never fork duplicate prompt files (`bugfix-v2.md`); improve the canonical file in `<PROMPTS_DIR>` under `skills/eval-hillclimb`.

## Outputs

- Rendered, variable-substituted prompt text written to stdout.
- Verification output from running the prompt's `Verify` check.
- Structured handoff block returned via `skills/handoff-protocol`.

## Placeholders

| Placeholder | Meaning |
| --- | --- |
| `<PROMPT_CLI>` | CLI command used to list and render prompt templates (e.g., `uika prompt` or `node tools/prompt.mjs`) |
| `<PROMPTS_DIR>` | Directory storing prompt `.md` files with `name`, `use`, and `vars` frontmatter |
| `<PROMPT_NAME>` | Template name matching a file in `<PROMPTS_DIR>` |
| `<PROMPT_VARS>` | Space-separated `key="value"` arguments required by the template |
