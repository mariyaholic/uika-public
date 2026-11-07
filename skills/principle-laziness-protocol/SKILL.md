---
name: principle-laziness-protocol
description: "Use when choosing an implementation approach. Prefer deletion, reuse, and the smallest change that fully satisfies the requested behavior."
---

# Principle · Laziness Protocol

**Rule.** Prefer deletion, reuse, and the smallest change that fully satisfies the requested behavior.

**Why.** Every added mechanism creates maintenance and verification work. Removing unnecessary structure reduces both.

## Do
- State the required behavior and identify what can be removed safely.
- Use `uika find` or `uika where` to locate existing estate capabilities.
- Follow `skills/script-hygiene` before introducing a script.
- Reuse established tools and `skills/toolchains` where they fit.
- Verify the simplified result through `skills/wrap-checklist`.

## Don't
- Trade required behavior or verification for fewer edits.
- Add speculative abstractions, compatibility layers, or variant-suffix scripts.
- Delete private `attic/` artifacts casually.

## Done signal
The smallest justified change satisfies the behavior with relevant verification and no unnecessary mechanism.

Indexed in skills/uika-mode/principles-index.md. Read this leaf before citing it in a reply.
