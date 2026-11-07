# Manual: Building Your Own Model Registry & Role-Assignment Pipeline (`setup-uika-models`)

This manual explains to another user's agent how to build the model registry (`<MODEL_REGISTRY>`), prompt-of-truth cards (`<POT_CLI>`), and checker CLI (`<MODELS_CLI>`) required by `skills/setup-uika-models`.

---

## 1. What to Build

Build a single source of truth for model providers, stable family aliases, role aptitudes, and model-specific prompting guidance ("Prompts of Truth" / PoT), paired with a read-only CLI that checks environment variable presence without ever reading secret values.

### Why It Exists
Hardcoding versioned model IDs (e.g., `claude-3-5-sonnet-20241022`) across skills and agent configs causes silent rot when models update. Furthermore, letting the same model family both implement (`impl`) and review (`review`) code introduces self-preference bias. Binding stable family aliases in a central registry with declared aptitudes and cross-family checks keeps skills portable and reviews independent.

---

## 2. Minimal Components

1. **Provider & Alias Registry (`<MODEL_REGISTRY>`, e.g., `providers/registry.json`)**:
   ```json
   {
     "providers": {
       "anthropic": { "keyEnv": "ANTHROPIC_API_KEY", "baseUrl": "https://api.anthropic.com" },
       "openai": { "keyEnv": "OPENAI_API_KEY", "baseUrl": "https://api.openai.com/v1" }
     },
     "aliases": {
       "sonnet": {
         "family": "claude",
         "provider": "anthropic",
         "id": "claude-sonnet-4-20250514",
         "cli": ["claude-code", "opencode"],
         "effort": ["low", "medium", "high"],
         "aptitude": ["scout", "impl", "review"],
         "pot": "providers/pot/sonnet.md"
       },
       "gpt-codex": {
         "family": "gpt",
         "provider": "openai",
         "id": "gpt-5-codex",
         "cli": ["codex", "opencode"],
         "effort": ["low", "medium", "high"],
         "aptitude": ["impl", "review", "judge"],
         "pot": "providers/pot/gpt-codex.md"
       }
     }
   }
   ```
2. **Prompt-of-Truth Cards (`providers/pot/<alias>.md`)**:
   - Short (5–15 line) temperament cards per model family describing known failure modes (e.g., over-refactoring, premature stop, verbosity) and counter-instructions to paste into delegation briefs.
3. **Models & PoT CLI (`<MODELS_CLI>` / `<POT_CLI>`)**:
   - `<MODELS_CLI> list`: prints bound vs. unbound family aliases, their `family`, `cli`, and `aptitude`.
   - `<MODELS_CLI> check`: checks `Boolean(process.env[provider.keyEnv])` for each bound provider (reporting `SET` or `MISSING` without ever printing the value) and validates that all `pot` file paths exist.
   - `<POT_CLI> <alias>`: prints the contents of the alias's `pot` file so an orchestrator can embed it in a `skills/delegation-protocol` brief.
   - `<MODELS_CLI> render <harness>`: outputs a config snippet for `opencode`, `codex`, or `claude-code` referencing environment variable names (`{env:OPENAI_API_KEY}`).

---

## 3. How to Wire It

1. **Strict Secret Hygiene**:
   - In `<MODELS_CLI> check`, inspect only `Object.prototype.hasOwnProperty.call(process.env, keyEnv) && process.env[keyEnv].length > 0`. Never print or log `process.env[keyEnv]`, and add a linter rule that rejects secret-shaped literals in `<MODEL_REGISTRY>`.
2. **Cross-Family Review Enforcement**:
   - When validating a role assignment table, compare `aliases[implAlias].family` against `aliases[reviewAlias].family`. Warn if they match when more than one model family is bound in `<MODEL_REGISTRY>`.
3. **Self-Edit Lock**:
   - Configure `<MODELS_CLI>` and the skill so that agents write proposals to `<PROPOSAL_OUT>` (`register/proposals/setup-models.md`) rather than mutating `<MODEL_REGISTRY>` or harness dotfiles directly.

---

## 4. How to Verify It

1. **Schema & Unbound Check**:
   - Add an unbound alias (`"id": null`) to `<MODEL_REGISTRY>` and verify `<MODELS_CLI> check` reports it as unbound and excludes it from candidate selection.
2. **Zero-Leak Secret Check**:
   - Run `FAKE_API_KEY="FAKE-TEST-VALUE-12345" <MODELS_CLI> check` and verify the string `FAKE-TEST-VALUE-12345` never appears in stdout, stderr, or logs.
3. **PoT Resolution**:
   - Run `<POT_CLI> <alias>` for each bound family alias and verify it exits `0` and prints a non-empty temperament card.
4. **Replace Placeholders**:
   - Replace `<MODEL_REGISTRY>`, `<MODELS_CLI>`, `<POT_CLI>`, `<PROPOSAL_OUT>`, and `<GOVERNANCE_CONFIG>` in `SKILL.md` with your concrete paths and commands.
