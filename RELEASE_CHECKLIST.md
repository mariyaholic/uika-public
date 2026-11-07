# Release checklist

Use this maintainer checklist for a source preview or package release. Record the source
revision, commands, exit codes, test results, CI links, and artifact hashes in the release
record. This checklist is kept in the repository and is not included in the npm package.

Source publication and npm publication are separate decisions. The 0.1.0 npm package is
currently unpublished.

## Source review

- [ ] Review the complete source tree and confirm the release revision and intended files.
- [ ] Keep credentials, personal paths, local state, internal task records, and generated
      verification artifacts out of the source release.
- [ ] Preserve LICENSE, NOTICE, required skill/helper assets, and tests.
- [ ] Run `npm run scrub`; require zero findings in source and packed content.
- [ ] Run `npm test`; require zero failures and record the result.
- [ ] Run `node bin/uika.mjs lint --strict` and
      `node bin/uika.mjs docs check --strict`; require clean results.
- [ ] Confirm the working tree contains no unexpected files or changes.

## Exact package review

- [ ] Run `npm pack --dry-run --json` and review the full file list.
- [ ] Require the package-content tests to pass against the expected files in
      `src/package.test.mjs`, including the complete skills tree.
- [ ] Confirm no tests, development `estate.json`/`AGENTS.md`, credentials, local state,
      or internal verification records are packed.
- [ ] Run `npm pack --json --pack-destination <empty-temp-dir>`. Record the resulting
      tarball's filename, file count, size, and SHA256.
- [ ] Run `node tools/scrub_privacy.mjs --tarball <file>`; require zero findings.
- [ ] Verify an isolated install of that exact tarball using an isolated HOME, npm cache,
      prefix, and Git configuration. Check the CLI help and bootstrap a temporary estate.
- [ ] Verify `check`, strict lint/docs checks, `docs version`, `find`, `where`, and
      `deploy targets` in that temporary estate. Confirm bootstrap leaves its skill
      library empty until skills are explicitly selected and copied.

## Links, metadata, and CI

- [ ] Verify the actual destination repository before setting repository, bugs, or homepage
      URLs in package metadata. Do not use guessed destinations.
- [ ] Review Markdown links and schema identifiers; use working relative links where suitable.
- [ ] Keep preview status and optional-dependency limits consistent across README, roadmaps,
      CHANGELOG, NOTICE, CLI help, and package version.
- [ ] Run the included Node 22 CI matrix on Linux, Windows, and macOS for the exact source
      revision. Record the run URL and platform results.
- [ ] Report optional toolchain and live harness/provider checks separately from core CI.

## Source publication

- [ ] Publish only the reviewed source revision to the verified repository.
- [ ] Check the visible files, links, default branch, and CI results after publication.
- [ ] Describe the npm package as unpublished until a separate package release is complete.

## Later npm release

- [ ] Confirm npm account access, package-name availability, version, 2FA, access level,
      and provenance configuration.
- [ ] Move applicable Unreleased notes under the intended version and date, then repeat the
      checks above for the final revision and tarball.
- [ ] Publish the exact reviewed tarball through the authorized release process.
- [ ] Confirm the published metadata, license, README, integrity, and CLI installation in a
      clean environment before documenting npm/npx install commands.
- [ ] Create the agreed version tag and release notes, recording the source commit, tag,
      npm integrity, tarball SHA256, and verified URLs.
