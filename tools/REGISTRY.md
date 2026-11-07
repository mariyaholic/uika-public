# tools/ registry

Repository maintenance tools. They are not part of the npm package.

| Tool | Purpose | Owner |
|---|---|---|
| `scrub_privacy.mjs` | Release privacy gate: scans the source tree and the exact `npm pack` tarball for local paths, private names, emails and secret-shaped values. `npm run scrub`. | maintainers |
