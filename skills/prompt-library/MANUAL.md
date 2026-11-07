# Manual: Building Your Own Prompt Library Pipeline (`prompt-library`)

This manual explains to another user's agent how to build the prompt template catalog (`<PROMPTS_DIR>`) and strict renderer (`<PROMPT_CLI>`) that `skills/prompt-library` depends on.

---

## 1. What to Build

Build a lightweight prompt catalog and CLI renderer that stores reusable task prompts as Markdown files with YAML frontmatter and renders them with strict variable substitution.

### Why It Exists
Agents improvising prompts for recurring tasks (bugfixes, adversarial reviews, verification passes, handoffs) frequently omit critical constraints or verification steps. A strict prompt library turns best-practice task framing into versioned code that fails loudly when required context variables are omitted.

---

## 2. Minimal Components

1. **Prompt Directory (`<PROMPTS_DIR>`, e.g., `prompts/`)**:
   - Markdown files (`prompts/<name>.md`) with YAML frontmatter:
     ```markdown
     ---
     name: bugfix
     use: Reproduce, isolate, and fix a defect with a regression test.
     vars:
       - symptom
       - repro
     ---
     # Bugfix: {{symptom}}

     Reproduce with: `{{repro}}`
     1. Confirm the failure before editing code.
     2. Fix the root cause in the lowest layer that owns it.
     3. Verify: re-run `{{repro}}` and the project's test suite (`skills/wrap-checklist`).
     ```
2. **Prompt Renderer CLI (`<PROMPT_CLI>`)**:
   - A zero-dependency Node.js (`prompt.mjs`) or Python (`prompt.py`) script supporting two modes:
     - **List mode** (`<PROMPT_CLI>` with no arguments): parses frontmatter of all `prompts/*.md` files and prints a table of `name | vars | use`.
     - **Render mode** (`<PROMPT_CLI> <name> key="value" ...`): loads `prompts/<name>.md`, verifies every variable listed in `vars:` is provided and non-empty, substitutes `{{key}}` tokens, checks that no unreplaced `{{...}}` tokens remain, and prints the body to stdout.

---

## 3. How to Wire It

1. **Frontmatter Parser**:
   - Split each `.md` file on leading `---` fences and parse `name`, `use`, and `vars` (array of strings).
2. **Strict Variable Gate**:
   - Parse CLI `key=value` arguments into a map.
   - Compare against `frontmatter.vars`:
     - If any required variable is missing or empty, print `Error: missing required variable '<var>' for prompt '<name>'` to stderr and `process.exit(1)`.
     - If unknown variables are passed, warn or fail so typos (`symptm=...`) are caught immediately.
3. **Skill Integration**:
   - Pair rendered prompts with `skills/delegation-protocol` when spawning subagents and `skills/eval-hillclimb` when iterating on prompt wording.

---

## 4. How to Verify It

1. **List Check**:
   - Run `<PROMPT_CLI>` with no arguments and confirm every file in `<PROMPTS_DIR>` appears with its declared variables.
2. **Missing-Variable Failure Check**:
   - Run `<PROMPT_CLI> bugfix symptom="crash"` (omitting `repro`) and confirm it exits non-zero and names `repro` as missing.
3. **Complete Render Check**:
   - Run `<PROMPT_CLI> bugfix symptom="crash" repro="npm test"` and confirm stdout contains the substituted prompt with zero `{{...}}` placeholders remaining.
4. **Replace Placeholders**:
   - Update `<PROMPT_CLI>`, `<PROMPTS_DIR>`, `<PROMPT_NAME>`, and `<PROMPT_VARS>` in `SKILL.md` to match your repository's paths.
