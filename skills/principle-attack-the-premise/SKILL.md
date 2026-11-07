---
name: principle-attack-the-premise
description: "Use when fixes sharing one assumption repeatedly fail the same gate. State that assumption and test it directly before another patch."
---

# Principle · Attack the Premise

**Rule.** When fixes sharing one premise repeatedly fail the same gate, state the premise and test it directly.

**Why.** Repeated failure can indicate that the shared explanation is wrong. A discriminating experiment can expose that error before more patches accumulate.

## Do
- Record the repeated failure and the assumption shared by attempted fixes.
- Use the `systematic-debugging` skill (from obra/superpowers, if installed) to trace evidence to its source.
- Design the smallest experiment that distinguishes the premise from an alternative.
- Label findings measured, inferred, or guess.
- Record lab findings under the lab README's `Findings` heading.
- Draft an ADR before adopting an estate-level change revealed by the experiment.

## Don't
- Stack another patch on an untested premise.
- Weaken the failing gate merely to obtain a pass.
- Treat one failed implementation as proof that the requirement is wrong.

## Done signal
A discriminating experiment supports or rejects the premise and determines the next justified action.

Indexed in skills/uika-mode/principles-index.md. Read this leaf before citing it in a reply.
