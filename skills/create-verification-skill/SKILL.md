---
name: create-verification-skill
description: "Use when a project needs repeatable verification of real user journeys. Inspect the repo, generate a grounded verification skill, and prove it passes and detects a broken variant."
---

# Create Verification Skill

Interview the repository before asking the user.
A skill never executed is a draft.

## Compose
Read and apply `skills/principle-prove-it-works/SKILL.md` and
the `verification-before-completion` skill (from obra/superpowers, if installed).
Use that evidence gate for completion claims rather than duplicating it.

## Discover
1. Surface. Inspect entry points, manifests, routes, existing tests, and runbooks.
   Identify what users can actually do.
2. Run. Discover and execute the supported launch command.
   Observe both readiness and a usable entry surface.
   A passing health check alone does not establish usability.
3. Drive. Find real selectors, CLI arguments, API operations, or stable handles.
   Exercise actual controls rather than guessed interfaces.
4. Observe. Identify resulting state, persistence, logs, and external side effects.
   Check dry-run behavior by observation rather than its name.
5. Isolate. Use dedicated ports, profiles, fixtures, and disposable state.
   Refuse to double-drive a shared instance.
   Continue independent discovery and report any isolation blocker.

Ask only about material facts the repo and authorized runtime cannot establish.
Never read credentials or print secret values.

## Choose the destination
Default to `<project-repo>/skills/verify-<project>/SKILL.md`.
Use a stable project slug and make frontmatter `name` equal `verify-<project>`.
Keep `description` on one quote-safe YAML line.

If the same verification asset is intended for multiple estate consumers,
keep one canonical copy in the estate's `supply/` catalog (the supply plane is not bundled in uika 0.1.0; see `docs/roadmap.md`).
Register the shared asset with its audience.
Owner promotion precedes delivery. Consumers pull supplied copies.
Do not publish a shared candidate as a delivered skill.

## Generate these six sections
Replace every placeholder with observed commands, handles, and expectations.

### Launch
Give the exact command, working directory, prerequisites, and ready signal.
Record how to confirm the entry surface is usable.
Capture the identity of each process and resource this run starts.

### Doctor
Give one read-only check that establishes whether the instance is worth driving.
State its expected output and the failure that stops the run.

### Drive
Give reproducible steps with real selectors or stable handles.
Seed a feature map of the top 3–5 user journeys.
For each, record setup, actions, expected state, side effects, and evidence location.
Failures must report the failed journey and observation.
Never weaken expectations, silently skip a journey, or substitute a health check.

### Evidence
For each journey, capture the user action, resulting state, and side effects.
Include expected absences such as no write during a dry run.
Record exact commands, outputs, artifact locations, and source revision.
Distinguish measured results from inference and untested scope.

### Cleanup
Stop only processes this run started using captured identities.
Never kill by process name.
Remove only disposable resources this run owns.
Preserve user state and useful failure evidence.

### Helpers
Reference existing supported tools first.
Give helper commands, dependencies, scope, and expected outputs.
Use `skills/script-hygiene` before adding scripts.
Use `skills/shell-safe-writes` for file creation.

## Prove before handover
1. Run the generated skill end to end on the intended working revision.
2. In an isolated disposable variant, introduce a known journey-breaking defect.
3. Run the generated skill end to end against that variant.
   Show the relevant journey fails because of the defect.
   Setup errors do not count as failure proof.
4. Restore the working variant and rerun successfully.
   Run Cleanup for each instance, including failed runs.
5. Record working and broken revisions, commands, observations, and evidence.
6. Run `uika skills validate` with the generated skill in validation scope.
   Confirm its name matches its folder.
7. If execution, failure proof, or validation is blocked, label the skill draft.

Apply `skills/wrap-checklist/SKILL.md` and update `WORKSTACK.md`.
Hand over the skill path, feature map, validation result, and pass/fail evidence.
