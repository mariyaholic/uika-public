---
name: setup-uika-models
description: "TEMPLATE — Interview the user using model-registry family aliases and prepare a role-to-model assignment proposal."
---

# Set up model assignments (Template)

Resolves agent workflow roles (`tower`, `scout`, `impl`, `review`, `judge`, plus mapped `verify`) against `<MODEL_REGISTRY>` and prepares a reviewable assignment proposal without hardcoding versioned model IDs or reading secret values.

## Trigger

Use when setting up or revising role-to-model assignments across coding harnesses, onboarding a new model provider, or auditing cross-family review coverage.

## Inputs

- `<MODEL_REGISTRY>`: Path to the provider and model alias registry JSON file (e.g., `providers/registry.json`).
- `<MODELS_CLI>`: CLI tool that lists bound aliases, checks environment variable presence, and renders harness setup snippets.
- `<POT_CLI>`: CLI subcommand that prints the "prompt-of-truth" (temperament and operating guidance card) for a model alias.
- `<PROPOSAL_OUT>`: Path where the generated role-map proposal is written for human approval (e.g., `register/proposals/setup-models.md`).
- `<GOVERNANCE_CONFIG>`: Protected governance manifest that agents must never self-edit (e.g., `estate.json`).

## Steps

1. Confirm the active harness and read `skills/handoff-protocol` and `skills/mcp-and-keys`.
2. Run `<MODELS_CLI> list` and `<MODELS_CLI> check` to inspect `<MODEL_REGISTRY>`. Read only provider `keyEnv` names and model `provider`, `id`, `cli`, `pot`, and `aptitude` fields.
3. Map workflow roles using the closed set `tower`, `scout`, `impl`, `review`, and `judge` (treating `verify` as a workflow assignment mapped to `review` aptitude, never a new handle role). Use `<harness>.<role>` handles and keep the model alias in a separate field.
4. Filter `<MODEL_REGISTRY>` to bound family aliases (`provider` and `id` both non-null) whose `aptitude` includes the target role. Never offer versioned aliases, raw model slugs, or unbound aliases.
5. Run `<POT_CLI> <alias>` for each candidate primary and fallback alias to read its temperament card.
6. Interview the user with at most one bundled question per unresolved role (covering primary alias, effort `low`/`medium`/`high` where supported, harness CLI, and fallback alias).
7. Write `<PROPOSAL_OUT>` containing the assignment table for all five roles plus `verify`, unresolved gaps, and the governing rule paragraph for the user to apply to harness homes.
8. Re-run `<MODELS_CLI> check` and finish with `skills/wrap-checklist` and the `skills/handoff-protocol` block.

## Gates

- Never read, print, log, or write secret API key values or open credential files; reference keys strictly by environment-variable name (`keyEnv`).
- Never write directly to harness homes, `AGENTS.md`, or `<GOVERNANCE_CONFIG>`; write only `<PROPOSAL_OUT>` for human application.
- Ensure `review` and `verify` use a different model family from `impl` when available (cross-family review rule); if unavailable, record the limitation explicitly in `<PROPOSAL_OUT>`.
- Never invent model aptitudes, bindings, CLI support, or effort settings not present in `<MODEL_REGISTRY>`.

## Outputs

- Role-to-model assignment proposal at `<PROPOSAL_OUT>` with table (`role | alias | effort | harness cli | PoT | fallback alias`).
- Optional provider configuration guidance from `<MODELS_CLI> render <harness>` for human application.
- Verification summary from `<MODELS_CLI> check`.

## Placeholders

| Placeholder | Meaning |
| --- | --- |
| `<MODEL_REGISTRY>` | Path to the JSON registry defining providers (`keyEnv`) and model family aliases (`aptitude`, `cli`, `pot`) |
| `<MODELS_CLI>` | CLI command for listing/checking model aliases and rendering harness snippets (e.g., `uika models`) |
| `<POT_CLI>` | CLI command that outputs the prompt-of-truth temperament card for a model alias (e.g., `uika pot`) |
| `<PROPOSAL_OUT>` | Output markdown path for the human-reviewed role assignment proposal |
| `<GOVERNANCE_CONFIG>` | Protected repository/estate configuration file that agents must not self-edit |
