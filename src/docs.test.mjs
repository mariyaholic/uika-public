// docs.test.mjs — the markdown standard and `uika docs` automation (ADR-0053).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { lawBlock, claudeBlock, LAW_BEGIN, LAW_END, CLAUDE_BEGIN, CLAUDE_END } from "./adopt.mjs";
import {
  blockState, stripVersion, renderBlock, docsInit, docsMigrate, checkRepo, docsCheck, docsVersion,
} from "./docs.mjs";

function temp(t, prefix = "uika-docs-") {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function estateRoot(t) {
  const root = temp(t, "uika-docs-estate-");
  writeFileSync(join(root, "estate.json"), JSON.stringify({ estate: { distribution: { targets: [] }, skills: { homes: [] } } }));
  return root;
}
function project(t, name) {
  const dir = temp(t, "uika-docs-repo-");
  mkdirSync(dir, { recursive: true });
  return dir;
}
function commitAll(dir) {
  const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
  execFileSync("git", ["-C", dir, "init", "-q"], { env });
  execFileSync("git", ["-C", dir, "add", "-A"], { env });
  execFileSync("git", ["-C", dir, "commit", "-qm", "init", "--allow-empty"], { env });
}
const LEGACY = `# Uika estate laws — the canonical source. All harness adapters are generated from this file.

This repo is Uika: a laboratory and control tower.

## Session start (mandatory)
freshness scan

## Operating posture
near-autopilot

`;
const HAND_CLAUDE = `# Working contract — demo project

This file and AGENTS.md carry the same contract.

## Commands

Run \`npm test\` before every wrap.

## Unique rule

Never delete the ledger.

<!-- uika:claude:begin -->
@AGENTS.md

The estate law block is generated inside \`AGENTS.md\` (markers \`uika:law\`).
<!-- uika:generated from estate.json; edit the source, not this file --> (rendered CLAUDE adapter)
<!-- uika:claude:end -->
`;

test("blockState: current, unversioned upgrade, edited, missing", (t) => {
  const root = estateRoot(t);
  const expected = lawBlock(root);
  const body = expected.split(/\r?\n/).filter((l) => !/uika:docs v1/.test(l)).join("\n");
  assert.equal(blockState(`${expected}\n`, LAW_BEGIN, LAW_END, expected).state, "current");
  assert.equal(blockState(`${body}\n`, LAW_BEGIN, LAW_END, expected).state, "upgrade");
  assert.equal(blockState(`${body.replace("never this block", "never ever this block")}\n`, LAW_BEGIN, LAW_END, expected).state, "upgrade", "pre-version blocks are generator-owned");
  const versioned = expected.replace("never this block", "never ever this block");
  assert.equal(blockState(`${versioned}\n`, LAW_BEGIN, LAW_END, expected).state, "edited");
  assert.equal(blockState("no block here\n", LAW_BEGIN, LAW_END, expected).state, "missing");
  assert.equal(blockState(expected, LAW_BEGIN, LAW_END, expected).state, "current");
});

test("law/claude blocks carry the docs version line and a stable hash", (t) => {
  const root = estateRoot(t);
  const block = lawBlock(root);
  assert.match(block, /<!-- uika:law:begin -->/);
  assert.match(block, /<!-- uika:docs v1 · sha256:[0-9a-f]{12} -->/);
  assert.match(block, /<!-- uika:law:end -->/);
  assert.equal(stripVersion(block), stripVersion(lawBlock(root)), "block hash must be deterministic");
  assert.match(claudeBlock(), /<!-- uika:claude:begin -->/);
  assert.match(claudeBlock(), /<!-- uika:docs v1 · sha256:[0-9a-f]{12} -->/);
});

test("renderBlock inserts, keeps, and refuses a hand edit unless forced (backup kept)", (t) => {
  const root = estateRoot(t);
  const file = join(temp(t), "AGENTS.md");
  const expected = lawBlock(root);
  const dry = renderBlock(file, expected, { begin: LAW_BEGIN, end: LAW_END, apply: false, log: () => {} });
  assert.equal(dry.changed, true);
  assert.equal(existsSync(file), false, "dry run wrote a file");
  renderBlock(file, expected, { begin: LAW_BEGIN, end: LAW_END, apply: true, log: () => {} });
  assert.match(readFileSync(file, "utf8"), /uika:law:begin/);
  assert.equal(renderBlock(file, expected, { begin: LAW_BEGIN, end: LAW_END, apply: true, log: () => {} }).changed, false);

  writeFileSync(file, `${expected.replace("Never push", "Never ever push")}\n`);
  const skip = renderBlock(file, expected, { begin: LAW_BEGIN, end: LAW_END, apply: true, log: () => {} });
  assert.equal(skip.state, "edited");
  assert.equal(skip.changed, false, "a hand-edited versioned block was overwritten");
  const forced = renderBlock(file, expected, { begin: LAW_BEGIN, end: LAW_END, apply: true, force: true, log: () => {} });
  assert.equal(forced.changed, true);
  assert.ok(readdirSync(join(file, "..")).some((f) => f.startsWith("AGENTS.md.bak-")), "forced render kept no backup");
});

test("docsInit scaffolds AGENTS/CLAUDE/README and is idempotent", async (t) => {
  const root = estateRoot(t);
  const repo = project(t);
  const actions = await docsInit(repo, { apply: true, root, quiet: true });
  assert.deepEqual(actions.sort(), ["agents-created", "claude-created", "readme-created"].sort());
  const agents = readFileSync(join(repo, "AGENTS.md"), "utf8");
  assert.match(agents, /^# .* — agent instructions/);
  assert.match(agents, /## Build \/ test \/ run/);
  assert.match(agents, /uika:law:begin/);
  assert.match(readFileSync(join(repo, "CLAUDE.md"), "utf8"), /@AGENTS\.md/);
  assert.match(readFileSync(join(repo, "README.md"), "utf8"), /## Requirements/);
  writeFileSync(join(repo, "AGENTS.md"), readFileSync(join(repo, "AGENTS.md"), "utf8").replace("_TODO: one paragraph", "_TODO: project explanation"));
  const again = await docsInit(repo, { apply: true, root, quiet: true });
  assert.deepEqual(again, [], "init rewrote files on the second run");
});

test("checkRepo flags legacy canon, hand CLAUDE, missing README and untracked files", (t) => {
  const root = estateRoot(t);
  const repo = project(t);
  writeFileSync(join(repo, "AGENTS.md"), `${LEGACY}${lawBlock(root)}\n`);
  writeFileSync(join(repo, "CLAUDE.md"), HAND_CLAUDE);
  const findings = checkRepo(root, repo, { repo: "demo" });
  const codes = findings.map((f) => f.code);
  assert.ok(codes.includes("legacy-copy"), "pasted canon not detected");
  assert.ok(codes.includes("duplicate-law"), "duplicated law not detected");
  assert.ok(codes.includes("hand-maintained"), "hand CLAUDE not detected");
  assert.ok(codes.includes("missing"), "missing README not detected");
  assert.ok(codes.includes("untracked"), "untracked files not detected");
  assert.ok(codes.includes("no-h1") === false, "repo has an H1");
});

test("checkRepo passes a clean repo and detects a stale harness-count claim", (t) => {
  const root = estateRoot(t);
  const repo = project(t);
  const agents = `# Demo — agent instructions

## What this repo is
demo

## Build / test / run
\`node --test\`

## Layout
src/

## Conventions
kebab

## Gotchas
none

${lawBlock(root)}
`;
  writeFileSync(join(repo, "AGENTS.md"), agents);
  writeFileSync(join(repo, "CLAUDE.md"), `${claudeBlock()}\n`);
  writeFileSync(join(repo, "README.md"), "# Demo\n\n## What / why\nx\n## Requirements\nnode\n## Run\nx\n## Layout\nx\n## Status\nok\n");
  commitAll(repo);
  assert.deepEqual(checkRepo(root, repo, { repo: "demo" }), []);
  writeFileSync(join(repo, "README.md"), "# Demo\n\nThe estate runs 9 harnesses.\n");
  assert.ok(checkRepo(root, repo, { repo: "demo" }).some((f) => f.code === "stale-claim"));
});

test("migrate strips a pasted canon, folds a hand CLAUDE and seals the block", async (t) => {
  const root = estateRoot(t);
  const repo = project(t);
  writeFileSync(join(repo, "AGENTS.md"), `${LEGACY}${lawBlock(root)}\n`);
  writeFileSync(join(repo, "CLAUDE.md"), HAND_CLAUDE);
  const report = await docsMigrate({ root, repo, apply: true });
  assert.equal(report.length, 1);
  const agents = readFileSync(join(repo, "AGENTS.md"), "utf8");
  assert.doesNotMatch(agents, /This repo is Uika/, "pasted canon survived migration");
  assert.match(agents, /^# .* — agent instructions/);
  assert.match(agents, /Never delete the ledger/, "unique CLAUDE rule was not folded into AGENTS");
  assert.match(agents, /Run `npm test` before every wrap/);
  assert.match(agents, /uika:docs v1/);
  const claude = readFileSync(join(repo, "CLAUDE.md"), "utf8");
  assert.ok(claude.split(/\r?\n/).length <= 15, "CLAUDE was not collapsed to the adapter");
  assert.ok(readdirSync(repo).some((f) => f.startsWith("AGENTS.md.bak-")), "no AGENTS backup");
  assert.ok(readdirSync(repo).some((f) => f.startsWith("CLAUDE.md.bak-")), "no CLAUDE backup");
  assert.ok(existsSync(join(repo, "README.md")), "migration did not scaffold a README");
});

test("docsCheck reports per repo and --strict raises on warnings", (t) => {
  const root = estateRoot(t);
  const repo = project(t);
  writeFileSync(join(repo, "AGENTS.md"), `${LEGACY}${lawBlock(root)}\n`);
  const findings = docsCheck({ root, repo });
  assert.ok(findings.some((f) => f.code === "legacy-copy"));
  assert.throws(() => docsCheck({ root, repo, strict: true }), /standard warning/);
});

test("docsVersion reports the expected block hash", (t) => {
  const root = estateRoot(t);
  const lines = [];
  const orig = console.log;
  console.log = (...a) => lines.push(a.join(" "));
  try { docsVersion({ root }); } finally { console.log = orig; }
  assert.match(lines.join("\n"), /docs v1 · law block sha256:[0-9a-f]{12}/);
});
