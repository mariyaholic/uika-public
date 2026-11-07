---
name: principle-prove-it-works
description: "Use when accepting work or declaring completion. Verify the real artifact against the requested behavior and report evidence."
---

# Principle · Prove It Works

**Rule.** Verify the real artifact against the requested behavior before accepting work or declaring completion.

**Why.** A successful build or a delegate report can miss the behavior the owner needs. Evidence must exercise the delivered result.

## Do
- Define observable success before implementation.
- Use the applicable the `verification-before-completion` skill (from obra/superpowers, if installed) and `skills/toolchains` guidance.
- Run relevant checks such as `uika lint`, `uika check`, `uika skills validate`, or `uika docs check`.
- For CLI changes, exercise the command and run the applicable `node --test` suites (`npm test` in the uika repo).
- For generated media, run the project's own QA tool and inspect the output yourself; a file that exists is not a file that plays.
- Apply `skills/wrap-checklist` and report measured results with unresolved failures.

## Don't
- Treat compilation, file existence, or a delegate summary as sufficient proof.
- Claim an unrun check passed.
- Broaden testing without a relevant change, failure, or unresolved concern.

## Done signal
The actual artifact meets the stated behavior, with check results and limitations recorded.

Indexed in skills/uika-mode/principles-index.md. Read this leaf before citing it in a reply.
