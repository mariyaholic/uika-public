import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { lint } from "./lint.mjs";

test("lint reports an always-loaded file over budget from the selected root", async (t) => {
  const root = mkdtempSync(join(process.cwd(), ".lint-fixture-"));
  t.after(() => { rmSync(root, { recursive: true, force: true }); assert.equal(existsSync(root), false); });
  const agents = join(root, "AGENTS.md");
  writeFileSync(agents, Array.from({ length: 201 }, (_, i) => `line ${i + 1}`).join("\n"));
  const logs = [], original = console.log;
  console.log = (...args) => logs.push(args.join(" "));
  try { await lint({ root }); }
  finally { console.log = original; }
  assert.ok(logs.join("\n").includes(`${agents}: 201 lines (> 200 always-loaded budget)`));
});

test("lint does not leak Git diagnostics for a non-repo or missing root", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "uika-lint-nogit-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "uika.mjs");
  for (const root of [dir, join(dir, "missing")]) {
    const r = spawnSync(process.execPath, [cli, "lint", "--root", root], { cwd: dir, encoding: "utf8", env: { ...process.env, GIT_CEILING_DIRECTORIES: dir } });
    assert.doesNotMatch(r.stderr, /fatal:/i, r.stderr);
  }
});

test("lint is advisory by default and --strict exits 1 on a warning fixture", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "uika-lint-strict-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "uika.mjs");
  const env = { ...process.env, GIT_CEILING_DIRECTORIES: dir };
  const lintAt = (root, ...flags) => spawnSync(process.execPath, [cli, "lint", "--root", root, ...flags], { cwd: dir, encoding: "utf8", env });
  const bad = join(dir, "bad");
  mkdirSync(bad);
  writeFileSync(join(bad, "AGENTS.md"), Array.from({ length: 201 }, (_, i) => `line ${i + 1}`).join("\n"));
  const advisory = lintAt(bad);
  assert.equal(advisory.status, 0, advisory.stderr);
  assert.match(advisory.stdout, /WARN {2}.*201 lines/);
  const strict = lintAt(bad, "--strict");
  assert.equal(strict.status, 1, "strict rejects warnings");
  assert.match(strict.stdout, /WARN {2}.*201 lines/);
  assert.match(strict.stderr, /uika lint: --strict: \d+ warning\(s\)/);
  const good = join(dir, "good");
  mkdirSync(good);
  writeFileSync(join(good, "AGENTS.md"), "# ok\n");
  writeFileSync(join(good, "README.md"), "# ok\n");
  for (const flags of [[], ["--strict"]]) {
    const r = lintAt(good, ...flags);
    assert.equal(r.status, 0, `clean estate passes lint ${flags.join(" ")}: ${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /lint: clean/);
  }
});

test("lint checks real branch names only: a detached HEAD (CI checkouts) is not a branch", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "uika-lint-branch-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "uika.mjs");
  const gitConfig = join(dir, "gitconfig");
  writeFileSync(gitConfig, "");
  const env = { ...process.env, GIT_CONFIG_GLOBAL: gitConfig, GIT_CONFIG_NOSYSTEM: "1", GIT_CEILING_DIRECTORIES: dir };
  const repo = join(dir, "estate");
  mkdirSync(repo);
  writeFileSync(join(repo, "AGENTS.md"), "# ok\n");
  writeFileSync(join(repo, "README.md"), "# ok\n");
  const git = (...a) => { const r = spawnSync("git", ["-C", repo, ...a], { env, encoding: "utf8" }); assert.equal(r.status, 0, r.stderr); };
  const lintStrict = () => spawnSync(process.execPath, [cli, "lint", "--strict", "--root", repo], { cwd: dir, encoding: "utf8", env });
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qm", "init");
  git("checkout", "-q", "--detach");
  const detached = lintStrict();
  assert.equal(detached.status, 0, `detached HEAD on main passes --strict: ${detached.stdout}${detached.stderr}`);
  git("branch", "Not_Kebab");
  const bad = lintStrict();
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /branch "Not_Kebab" breaks/);
  assert.doesNotMatch(bad.stdout, /HEAD detached/);
});
