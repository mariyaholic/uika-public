---
name: principle-encode-lessons-in-structure
description: "Use when a recurring correction reveals a missing constraint. Encode the lesson in an executable check or structural invariant."
---

# Principle · Encode Lessons in Structure

**Rule.** Turn recurring corrections into executable checks or structural invariants at their source.

**Why.** Repeated reminders leave the same failure available. A structural constraint makes the lesson enforceable.

## Do
- Record the observed failure and lesson in `register/LEARNINGS.md`.
- Identify the earliest boundary where the invalid state can be prevented.
- Search existing tools using `skills/script-hygiene` before adding a checker.
- Draft an ADR in `register/adr/` before an estate-level structural change.
- Add the smallest relevant invariant, validator, or behavior test and demonstrate rejection of the original failure.
- Propose protected-file changes in chat for owner application.

## Don't
- Add another reminder when a structural fix is available.
- Create a competing source of estate law.
- Edit `AGENTS.md`, `estate.json`, or harness configuration.

## Done signal
A repeatable check or invariant catches the original failure and permits valid behavior.

Indexed in skills/uika-mode/principles-index.md. Read this leaf before citing it in a reply.
