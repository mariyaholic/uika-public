# Contributing

Thank you for helping. uika is small on purpose, so these rules keep it that way.

## Ground rules

- **Zero npm runtime dependencies.** Use Node 22 built-ins only. `package.json` has no
  `dependencies`, and `src/package.test.mjs` fails if one appears.
- **Dry run by default.** A command that writes must print what it would do and write nothing
  unless `--apply` is passed. Add your case to `src/dryrun.test.mjs`.
- **The estate root contract.** The root is `--root <dir>`, then `UIKA_ESTATE_HOME`, then the
  current directory. Never resolve it from the package's own location.
- **No private data.** No personal paths, emails, secrets or private project names in code,
  comments, fixtures or docs. Examples are synthetic.
- **LF line endings.** `.gitattributes` enforces them.

## Checks

Run these from the repository root on Node 22. The included CI workflow is configured to
run the same checks on Windows, macOS and Linux; inspect results for your exact revision.

```sh
npm run scrub                           # privacy scrub: source tree and packed tarball
npm test                                # unit tests plus an isolated packed-tarball install
node bin/uika.mjs lint --strict         # estate lint; any warning fails
node bin/uika.mjs docs check --strict   # documentation standard
npm pack --dry-run --json               # package contents
```

`npm test` and `node --test` both run the install smoke. The test locates npm from
`npm_execpath` or the active Node installation. Use a writable `npm_config_cache`
when running in a sandbox with a read-only home.

## Protected files

`AGENTS.md` and `estate.json` at the repository root describe how this project governs itself.
Do not change them in a feature pull request. Open an issue with the exact diff and the
maintainer will apply it.

## Pull requests

- Use branch names `feat/…`, `fix/…`, `docs/…` or `chore/…` in kebab case (`lint` checks this).
- Keep one change per pull request, with a test that fails without it.
- Update `CHANGELOG.md` under Unreleased for anything a user would notice.
- If you add a shipped file, add it to `files` in `package.json` and to `EXPECTED_FILES` in
  `src/package.test.mjs`.
