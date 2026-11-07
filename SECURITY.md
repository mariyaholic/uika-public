# Security

uika writes configuration into places other tools trust: Git hooks, your global Git config,
harness home folders and other repositories. This page says exactly what each command can
change, so you can decide what to run.

## The rule

Every command that writes is a dry run unless you pass `--apply`. A dry run prints what it
would do and leaves the filesystem byte for byte unchanged; `src/dryrun.test.mjs` checks this.
There are two documented exceptions:

- `deploy hook-run` is the post-commit hook. It writes when Git runs it, because you installed
  it with `--apply`.
- `session check --stop` writes a one-byte sentinel, `uika_stop_<session>`, so that a Stop hook
  blocks at most once per session. It goes inside an existing `.git/` folder, or in the OS temp
  directory if the target has none.

## What `--apply` changes

| Command | Writes |
|---|---|
| `init <dir> --apply` | A new estate in `<dir>`, including the empty `data/deploy/` folder |
| `adopt <repo> --apply`, `docs render/init/migrate --apply` | Marked law blocks and docs scaffolding inside `<repo>` |
| `sync <repo> --apply` | `AGENTS.md`, `CLAUDE.md` and `WORKSTACK.md` in `<repo>`; hand-maintained files are skipped unless you add `--force` |
| `skills place --apply` | Copies skill folders into every harness skill home listed in `estate.json` |
| `home regen --apply` | Harness home-law files under your home folder |
| `deploy install --apply` | `.git/hooks/post-commit` in the estate repository |
| `deploy auto install --apply` | Sets `git config --global init.templateDir` to `data/deploy/git-template`, which plants the hook in every repository you create from then on. The previous value is saved in `data/deploy/state.json`. `deploy auto uninstall --apply` only unsets the key, and only if it still points at the uika template, so restore any earlier value by hand from `state.json` |
| `deploy adopt <repo> --apply`, `deploy forget <repo> --apply` | `data/deploy/targets.json` |
| `video sheet\|frame --apply`, `video structure --out <file> --apply` | One PNG or JSON file at the named (or default) path; ffmpeg reads the film and never modifies it |
| `figure render --apply` | `<id>.svg`, `<id>.manifest.json` and any requested `.html`/`.png`/`.pdf` beside the spec or in `--out` |
| `eval run --apply` | Runs each task's own command (no shell) in its `cwd`; with `--out`, writes one results JSON. The task commands are yours: uika adds no network calls and no keys |
| post-commit hook | Copies changed skills and law blocks to harness homes and adopted repositories, and logs to `data/deploy/deploy.log` |

To switch the hook off, set `UIKA_DEPLOY_DISABLE=1`. To stop new repositories from adopting
themselves, set `UIKA_DEPLOY_NO_AUTO=1`, or run `git config uika.deploy.auto false` in one
repository.

## Privacy boundaries

- uika has no telemetry or built-in network client. Commands you supply to `eval`, installed
  Git hooks, and separately configured skill tools may access the network.
- Configuration holds environment variable names (`keyEnv`, `secretEnv`), never secret values.
- `data/deploy/` is machine-local state and is ignored by Git.
- `npm run scrub` rejects personal paths, email addresses, secret shapes and private names in
  the source and in the packed tarball.

## Reporting a vulnerability

Keep vulnerability details private. Use the repository's Security tab and "Report a
vulnerability" when that channel is enabled. If it is unavailable, ask the maintainer for a
private reporting channel without posting exploit details or secrets. Include the uika
version, platform and steps to reproduce in the private report.

Only the latest 0.x release receives fixes.
