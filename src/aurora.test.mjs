// aurora.test.mjs — tests for Aurora auto-sync helper
import test from "node:test";
import assert from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { aurora } from "./aurora.mjs";

test("aurora sync detects missing targets, skill drift, and home parity safely", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "uika-aurora-"));
  const fakeHome = join(tmp, "fakehome");
  mkdirSync(join(tmp, "skills/sample-skill"), { recursive: true });
  writeFileSync(join(tmp, "skills/sample-skill/SKILL.md"), "---\nname: sample-skill\ndescription: \"test\"\n---\n# Sample\n");
  mkdirSync(join(fakeHome, ".agents/skills"), { recursive: true });

  writeFileSync(
    join(tmp, "estate.json"),
    JSON.stringify({
      estate: {
        skills: { homes: ["~/.agents/skills"] },
        distribution: {
          targets: [{ repo: "fake-repo", path: join(tmp, "nonexistent") }],
        },
      },
    })
  );

  const origHome = process.env.HOME;
  process.env.HOME = fakeHome;
  try {
    const res = await aurora({ root: tmp, rest: ["sync"], opts: { homeDir: fakeHome } });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.drift, true);
    // 1 target missing + 1 skill missing in ~/.agents/skills + 2 home faces absent (dsh, hermes)
    assert.ok(res.driftCount >= 3);
  } finally {
    process.env.HOME = origHome;
  }
});

test("aurora propagate plans and applies Setlist workstack split and Encore SIM header", async () => {
  const { existsSync, readFileSync } = await import("node:fs");
  const tmp = mkdtempSync(join(tmpdir(), "uika-propagate-"));
  const target = join(tmp, "sibling-repo");
  mkdirSync(target, { recursive: true });

  const longLines = Array.from({ length: 130 }, (_, i) => `- item ${i + 1}`);
  longLines.unshift("From→To: codex.impl → gemini.review\nDate: 2026-11-18\nDone: test\n");
  writeFileSync(join(target, "WORKSTACK.md"), longLines.join("\n"), "utf8");
  writeFileSync(join(target, "LEARNINGS.md"), "# Old Learnings\n- Prior entry\n", "utf8");

  // Dry-run plans without mutating
  const plan = await aurora({ root: tmp, rest: ["propagate"], opts: { target, apply: false } });
  assert.strictEqual(plan.ok, true);
  assert.strictEqual(plan.applied, false);
  assert.strictEqual(plan.changes.length, 2);
  assert.strictEqual(existsSync(join(target, "WORKSTACK-FULL.md")), false);

  // Apply mutates cleanly and is idempotent on second run
  const applied = await aurora({ root: tmp, rest: ["propagate"], opts: { target, apply: true } });
  assert.strictEqual(applied.ok, true);
  assert.strictEqual(applied.applied, true);
  assert.strictEqual(existsSync(join(target, "WORKSTACK-FULL.md")), true);

  const newWorkstack = readFileSync(join(target, "WORKSTACK.md"), "utf8");
  assert.ok(newWorkstack.includes("Setlist"));
  assert.ok(newWorkstack.includes("From→To: codex.impl → gemini.review"));

  const newLearnings = readFileSync(join(target, "LEARNINGS.md"), "utf8");
  assert.ok(newLearnings.includes("<!-- encore:sim -->"));
  assert.ok(newLearnings.includes("- Prior entry"));

  const second = await aurora({ root: tmp, rest: ["propagate"], opts: { target, apply: true } });
  assert.strictEqual(second.changes.length, 0);
});

test("propagateGithub clones, propagates, opens PR, and auto-merges via injected runner", async () => {
  const { propagateGithub } = await import("./aurora.mjs");
  const tmp = mkdtempSync(join(tmpdir(), "uika-gh-prop-"));
  const calls = [];

  const execRunner = (cmd, args) => {
    calls.push([cmd, ...args]);
    if (cmd === "gh" && args[0] === "repo" && args[1] === "clone") {
      const dest = args[3];
      mkdirSync(dest, { recursive: true });
      writeFileSync(join(dest, "LEARNINGS.md"), "# Learnings\n- item\n", "utf8");
      return "";
    }
    if (cmd === "git" && args[2] === "symbolic-ref") return "main\n";
    if (cmd === "git" && args[2] === "status") return " M LEARNINGS.md\n";
    if (cmd === "gh" && args[0] === "pr" && args[1] === "list") return "";
    if (cmd === "gh" && args[0] === "pr" && args[1] === "create") return "https://github.com/example-owner/demo-repo/pull/99\n";
    return "";
  };

  const res = await propagateGithub({
    root: tmp,
    repos: ["demo-repo"],
    owner: "example-owner",
    apply: true,
    autoMerge: true,
    execRunner,
  });

  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.results.length, 1);
  assert.strictEqual(res.results[0].prUrl, "https://github.com/example-owner/demo-repo/pull/99");
  assert.strictEqual(res.results[0].merged, true);
  assert.ok(calls.some((c) => c[0] === "gh" && c[1] === "pr" && c[2] === "create"));
  assert.ok(calls.some((c) => c[0] === "gh" && c[1] === "pr" && c[2] === "merge" && c.includes("--auto")));
});

test("discoverGithubRepos and discoverLocalRepos include private repos and exclude Uika", async () => {
  const { discoverGithubRepos, discoverLocalRepos } = await import("./aurora.mjs");
  const list = discoverGithubRepos({
    owner: "example-owner",
    execRunner: () => JSON.stringify([
      { nameWithOwner: "example-owner/Uika" },
      { nameWithOwner: "example-owner/uika-public" },
      { nameWithOwner: "example-owner/private-vault" },
      { nameWithOwner: "example-owner/sample-repo" },
    ]),
  });
  assert.deepStrictEqual(list, ["example-owner/private-vault", "example-owner/sample-repo"]);

  const tmp = mkdtempSync(join(tmpdir(), "uika-local-disc-"));
  const root = join(tmp, "Uika");
  const localRepo = join(tmp, "sample-project");
  mkdirSync(join(root, "projects"), { recursive: true });
  mkdirSync(join(localRepo, ".git"), { recursive: true });
  writeFileSync(join(root, "estate.json"), JSON.stringify({ estate: { distribution: { targets: [{ path: localRepo }] } } }));
  writeFileSync(join(root, "projects", "registry.json"), JSON.stringify({ projects: { sp: { paths: [localRepo] } } }));

  const localList = discoverLocalRepos(root);
  assert.deepStrictEqual(localList, [localRepo]);
});
