# uika

This is my **estate layer for AI coding agents**: one lawbook, generated adapters, measured sessions. I made it because my repos kept drifting apart. It is close to my heart, and I hope it helps you as much as it helps me.

Uika makes the agent-facing layer generated, versioned, fingerprinted, and drift-audited instead of hand-copied. A law block goes into every managed repo, skills land in each harness's skill home, and every session starts with a freshness scan and ends with a handoff. [The core ideas](docs/manual.md#part-1--the-estate-model) live in the manual.

**Status: `0.1.1 preview`.** APIs, `estate.json` manifest fields, the law-block format, and
harness mappings may change before 1.0.

## Install

You need [Node.js](https://nodejs.org) 22 or later. Then run:

```sh
npm install -g @mariyaholic/uika
uika check                       # machine probe: runtimes, harness homes, drives
```

The command is `uika`. npm blocks the unscoped name `uika` as too similar to other packages, so the
package is published under my scope. uika uses Node built-ins only, so it installs no other
packages. Run `npm install -g @mariyaholic/uika@latest` to update, and
`npm uninstall -g @mariyaholic/uika` to remove it.

To try it once without installing:

```sh
npx @mariyaholic/uika check
```

To install the newest source from GitHub instead, which also needs [Git](https://git-scm.com):

```sh
npm install -g github:mariyaholic/uika-public
```

<details>
<summary>Run from a clone instead</summary>

```sh
git clone https://github.com/mariyaholic/uika-public
cd uika-public
node bin/uika.mjs check
```

Use `node bin/uika.mjs <command>` wherever this README says `uika <command>`, or run
`npm install -g .` inside the clone to put that checkout on your PATH.

</details>

## Get started

uika works on an **estate directory**: a folder with your `estate.json`, your rules and your
skills. Make one and check it:

```sh
uika init my-estate --apply
cd my-estate
uika lint
```

The bootstrap makes a scaffold but does not copy the bundled skills. Read them in
[`skills/`](skills/), choose the ones you want, then copy and validate them. My own small
operating set, and the full recipe, are in [the manual](docs/manual.md#part-2--running-the-tool)
and [the agent guide](docs/AGENT-GUIDE.md). Commands that write files are dry runs until you
pass `--apply`.

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
