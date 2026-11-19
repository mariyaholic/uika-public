# uika

This is my **estate layer for AI coding agents**: one lawbook, generated adapters, measured sessions. I made it because my repos kept drifting apart. It is close to my heart, and I hope it helps you as much as it helps me.

Uika makes the agent-facing layer generated, versioned, fingerprinted, and drift-audited instead of hand-copied. A law block goes into every managed repo, skills land in each harness's skill home, and every session starts with a freshness scan and ends with a handoff. [The core ideas](docs/manual.md#part-1--the-estate-model) live in the manual.

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
and the full recipe, are in [the manual](docs/manual.md#part-2--running-the-tool)
and [the agent guide](docs/AGENT-GUIDE.md). Commands that write files are dry runs until you pass `--apply`.

To keep the tool public and the estate private, point uika at your own directory with
`UIKA_ESTATE_HOME` or `--root`. The tool carries no personal data, and your estate stays
yours.

## Commands

The dispatcher registers 24 commands: `init`, `check`, `lint`, `sync`, `skills`, `audit`, `find`, `where`, `path`, `layout`, `session`, `adopt`, `deploy`, `docs`, `home`, `video`, `figure`, `ref`, `eval`, `manuscriptus`, `encore`, `aurora`, `ferry`, and `unmask`. See [the command guidebook](docs/cadenza-commands.md) and [the manual](docs/manual.md) for usage and flags.

## Everything else

The technical detail lives in the packaged documentation:

- [The manual](docs/manual.md) — two canonical sources, fingerprinted law blocks, keys by reference, and session discipline
- [The agent guide](docs/AGENT-GUIDE.md) — cross-harness architecture, law-block protocol, and contributor standards
- [The command guidebook](docs/cadenza-commands.md) — all 24 bundled commands, plus notes on unbundled estate-plane commands
- [Stageplay design and modern web](docs/stageplay-design-and-web.md) — design tokens, UIverse adaptation, and `unmask check` interactibility gates
- [Skills scope and provenance](docs/SKILL_PORT_AUDIT.md) — 40 skills, provenance, templates, and optional tools
- [The harness matrix](docs/harness-matrix.md) — per-harness config homes, instruction chains, and skill homes
- [The roadmap](docs/roadmap.md) — present scope and planned milestones (see also `ROADMAP.md`, `CHANGELOG.md`, `SECURITY.md`, and `CONTRIBUTING.md`)

License: MIT (see `NOTICE` for what is and is not in this repository).

Thank you for stopping by. ♡
