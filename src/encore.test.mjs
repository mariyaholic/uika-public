// encore.test.mjs — tests for Encore SIM learnings manager
import test from "node:test";
import assert from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseLearnings, lintLearnings, encore } from "./encore.mjs";

test("parseLearnings parses SIM fields, categories, and skill correctly", () => {
  const markdown = `
# SIM Learnings

### Fast test execution
- **Area:** skills
- **Skill:** squad
- **Problem cluster:** flaky timeouts in node tests
- **Root cause:** tight async limits
- **Rationale:** increase wait budget
- **Provenance:** session 42
`;

  const entries = parseLearnings(markdown);
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].title, "Fast test execution");
  assert.strictEqual(entries[0].area, "skills");
  assert.strictEqual(entries[0].skill, "squad");
  assert.strictEqual(entries[0].fields["problem-cluster"], "flaky timeouts in node tests");
});

test("lintLearnings catches missing required SIM fields", () => {
  const markdown = `
### Incomplete learning
- **Area:** invalid-area
- **Problem cluster:** something broke
`;

  const { errors } = lintLearnings(markdown);
  assert.ok(errors.length > 0);
  assert.ok(errors.some((e) => e.includes("root-cause")));
  assert.ok(errors.some((e) => e.includes("invalid area")));
});

test("encore ingest appends valid SIM entries and groups counts by area", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "uika-encore-"));
  try {
    mkdirSync(join(tmp, "register"), { recursive: true });
    writeFileSync(join(tmp, "register/LEARNINGS.md"), "# LEARNINGS.md\n", "utf8");
    const patchFile = join(tmp, "new-entry.md");
    writeFileSync(
      patchFile,
      [
        "### Scoped CSS aliases",
        "- **Area:** design",
        "- **Skill:** generative_ui",
        "- **Problem cluster:** stale CSS tokens after face switch",
        "- **Root cause:** alias variables only declared at :root",
        "- **Rationale:** redeclare derived variables inside [data-face]",
        "- **Predicted vs observed:** Predicted automatic cascade; observed stale tokens until redeclared",
        "- **Provenance:** sample survey",
      ].join("\n"),
      "utf8"
    );

    const dryRes = await encore({ root: tmp, rest: ["ingest", patchFile], apply: false });
    assert.strictEqual(dryRes.ok, true);
    assert.strictEqual(dryRes.dryRun, true);
    assert.strictEqual(dryRes.ingested, 0);
    assert.strictEqual(dryRes.planned, 1);
    assert.doesNotMatch(readFileSync(join(tmp, "register/LEARNINGS.md"), "utf8"), /Scoped CSS aliases/);

    const res = await encore({ root: tmp, rest: ["ingest", patchFile], apply: true });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.dryRun, false);
    assert.strictEqual(res.ingested, 1);
    assert.deepStrictEqual(res.byArea, { design: 1 });
    assert.match(readFileSync(join(tmp, "register/LEARNINGS.md"), "utf8"), /Scoped CSS aliases/);

    const summaryRes = await encore({ root: tmp, rest: ["summary"] });
    assert.strictEqual(summaryRes.ok, true);
    assert.strictEqual(summaryRes.total, 1);
    assert.deepStrictEqual(summaryRes.bySkill, { generative_ui: 1 });

    // Test --json output for summary and list
    const logs = [];
    const origLog = console.log;
    console.log = (msg) => logs.push(msg);
    try {
      await encore({ root: tmp, rest: ["summary"], opts: { json: true } });
      await encore({ root: tmp, rest: ["list"], opts: { json: true } });
    } finally {
      console.log = origLog;
    }

    assert.ok(logs.some((l) => l.includes('"total": 1')));
    assert.ok(logs.some((l) => l.includes('"Scoped CSS aliases"')));

    const filtered = await encore({ root: tmp, rest: ["list"], opts: { skill: "generative_ui" } });
    assert.strictEqual(filtered.entries.length, 1);

    const dup = await encore({ root: tmp, rest: ["ingest", patchFile], apply: true });
    assert.strictEqual(dup.ok, true);
    assert.strictEqual(dup.skipped, 1);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("encorePush and encorePullGithub respect dry-run, validate slugs, detect base branch, and propagate invalid ok:false", async () => {
  const { encorePush, encorePullGithub } = await import("./encore.mjs");
  const tmp = mkdtempSync(join(tmpdir(), "uika-encore-gh-"));
  try {
    const srcLearnings = join(tmp, "LEARNINGS.md");
    const simEntry = `<!-- encore:sim -->
### Cloud session fix

- **Area:** state-machines
- **Problem cluster:** cloud-wrap
- **Root cause:** missing sync
- **Rationale:** push SIM entries to estate
- **Predicted vs observed:** expected sync, observed gap
- **Provenance:** demo-repo#99
`;
    writeFileSync(srcLearnings, simEntry, "utf8");

    await assert.rejects(
      () => encorePush({ root: tmp, srcPath: srcLearnings, repoSlug: "bad slug/with spaces", apply: true }),
      /Invalid repository slug/
    );

    const dryPushCalls = [];
    const dryPush = await encorePush({
      root: tmp,
      srcPath: srcLearnings,
      repoSlug: "example-owner/example-repo",
      apply: false,
      execRunner: (cmd, args) => { dryPushCalls.push([cmd, ...args]); return ""; },
    });
    assert.strictEqual(dryPush.ok, true);
    assert.strictEqual(dryPush.dryRun, true);
    assert.strictEqual(dryPush.planned, 1);
    assert.strictEqual(dryPushCalls.length, 0);

    const pushCalls = [];
    const pushRes = await encorePush({
      root: tmp,
      srcPath: srcLearnings,
      repoSlug: "example-owner/example-repo",
      autoMerge: true,
      apply: true,
      execRunner: (cmd, args) => {
        pushCalls.push([cmd, ...args]);
        if (cmd === "gh" && args[0] === "repo" && args[1] === "clone") {
          const dest = args[3];
          mkdirSync(join(dest, "register"), { recursive: true });
          writeFileSync(join(dest, "register", "LEARNINGS.md"), "# Learnings\n", "utf8");
          return "";
        }
        if (cmd === "git" && args[2] === "symbolic-ref") return "trunk\n";
        if (cmd === "gh" && args[0] === "pr" && args[1] === "list") return "";
        if (cmd === "gh" && args[0] === "pr" && args[1] === "create") return "https://github.com/example-owner/example-repo/pull/55\n";
        return "";
      },
    });
    assert.strictEqual(pushRes.ok, true);
    assert.strictEqual(pushRes.dryRun, false);
    assert.strictEqual(pushRes.pushed, 1);
    assert.strictEqual(pushRes.prUrl, "https://github.com/example-owner/example-repo/pull/55");
    assert.strictEqual(pushRes.merged, true);
    const prCreateCall = pushCalls.find((c) => c[0] === "gh" && c[1] === "pr" && c[2] === "create");
    assert.ok(prCreateCall);
    assert.strictEqual(prCreateCall[prCreateCall.indexOf("--base") + 1], "trunk");

    const estateRoot = join(tmp, "estate-local");
    mkdirSync(join(estateRoot, "register"), { recursive: true });
    writeFileSync(join(estateRoot, "register", "LEARNINGS.md"), "# Learnings\n", "utf8");

    await assert.rejects(
      () => encorePullGithub({ root: estateRoot, repos: ["owner/bad?repo"], apply: true }),
      /Invalid repository slug/
    );

    const dryPull = await encorePullGithub({
      root: estateRoot,
      repos: ["demo-repo"],
      owner: "example-owner",
      apply: false,
      execRunner: (cmd, args) => {
        if (cmd === "gh" && args[0] === "api" && args[1] === "repos/example-owner/demo-repo/contents/LEARNINGS.md") {
          return Buffer.from(simEntry, "utf8").toString("base64");
        }
        throw new Error("not found");
      },
    });
    assert.strictEqual(dryPull.ok, true);
    assert.strictEqual(dryPull.dryRun, true);
    assert.strictEqual(dryPull.totalIngested, 0);
    assert.strictEqual(dryPull.totalPlanned, 1);
    assert.doesNotMatch(readFileSync(join(estateRoot, "register", "LEARNINGS.md"), "utf8"), /Cloud session fix/);

    const pullRes = await encorePullGithub({
      root: estateRoot,
      repos: ["demo-repo"],
      owner: "example-owner",
      apply: true,
      execRunner: (cmd, args) => {
        if (cmd === "gh" && args[0] === "api" && args[1] === "repos/example-owner/demo-repo/contents/LEARNINGS.md") {
          return Buffer.from(simEntry, "utf8").toString("base64");
        }
        throw new Error("not found");
      },
    });
    assert.strictEqual(pullRes.ok, true);
    assert.strictEqual(pullRes.totalIngested, 1);

    const badPull = await encorePullGithub({
      root: estateRoot,
      repos: ["broken-repo"],
      owner: "example-owner",
      apply: true,
      execRunner: () => Buffer.from("<!-- encore:sim -->\n### Incomplete\n- **Area:** bad-area\n", "utf8").toString("base64"),
    });
    assert.strictEqual(badPull.ok, false);
    assert.strictEqual(badPull.repoResults[0].status, "invalid");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
