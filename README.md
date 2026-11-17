# uika

This is my **estate layer for AI coding agents**: one lawbook, generated adapters, measured sessions. I made it because my repos kept drifting apart. It is close to my heart, and I hope it helps you as much as it helps me.

Uika makes the agent-facing layer generated, versioned, fingerprinted, and drift-audited instead of hand-copied. A law block goes into every managed repo, skills land in each harness's skill home, and every session starts with a freshness scan and ends with a handoff. [The core ideas](https://mariyaholic.github.io/docs/uika-public/#why) live on the docs page.

**Status: `0.1.0 source preview`; npm package unpublished.** This checkout is the source
preview. Source: [source repository](https://github.com/mariyaholic/uika-public).
Source publication and an npm release are separate steps.
APIs, `estate.json` manifest fields, the law-block format, and harness mappings may change
before 1.0.

## Install

uika runs on Node.js 22 or later and uses Node built-ins only — no npm dependencies. The
npm package is not published, so `npm i -g uika` and `npx uika` are not ways in. Run it from
this source tree:

```sh
node bin/uika.mjs check          # machine probe: runtimes, harness homes, drives
```

To put `uika` on your PATH, build and install a tarball:

```sh
npm pack                         # writes uika-0.1.0.tgz
npm install -g ./uika-0.1.0.tgz
```

## Get started

uika works on an **estate directory**: a folder with your `estate.json`, your rules and your
skills. Make one and check it:

```sh
node bin/uika.mjs init my-estate --apply
cd my-estate && node ../bin/uika.mjs lint
```

The bootstrap makes a scaffold but does not copy the bundled skills. Read them in the
checkout, choose the ones you want, then copy and validate them. My own small operating set,
and the full recipe, are in [Make an estate](https://mariyaholic.github.io/docs/uika-public/#estate)
on the docs page. Commands that write files are dry runs until you pass `--apply`.

To keep the tool public and the estate private, point uika at your own directory with
`UIKA_ESTATE_HOME` or `--root`. The tool carries no personal data, and your estate stays
yours.

## Everything else

The technical detail lives in [uika's documentation](https://mariyaholic.github.io/docs/uika-public/) on my site:

- [Why an estate layer](https://mariyaholic.github.io/docs/uika-public/#why) — two canonical sources, fingerprinted law blocks, keys by reference
- [Check what you need](https://mariyaholic.github.io/docs/uika-public/#requirements) — Node, platform verification, and when Git matters
- [The commands](https://mariyaholic.github.io/docs/uika-public/#commands) — all 19 of them, plus the media, reference and eval detail
- [Use the skills library](https://mariyaholic.github.io/docs/uika-public/#skills) — 39 skills, provenance, templates and optional tools
- [Keep a session honest](https://mariyaholic.github.io/docs/uika-public/#session) — freshness scan, WORKSTACK.md handoffs, wrap checklist
- [See where things live](https://mariyaholic.github.io/docs/uika-public/#layout) — the layout of this checkout
- [Verify a checkout](https://mariyaholic.github.io/docs/uika-public/#verify) — the checks that must pass
- [Reference](https://mariyaholic.github.io/docs/uika-public/#reference) — the manual, harness matrix, roadmap, changelog, security and contributing

License: MIT (see `NOTICE` for what is and is not in this repository).

Thank you for stopping by. ♡
