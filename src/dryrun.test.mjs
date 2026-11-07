// dryrun.test.mjs — Gate 7 contract: every command that writes is a dry run unless --apply,
// proven by hashing every file and directory in the estate, target repos and an isolated home
// before and after each dry run. The only allowed durable change is the documented
// `session check --stop` sentinel in the OS temp directory.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { registerTarget } from "./targets.mjs";

const CLI = resolve(dirname(fileURLToPath(import.meta.url)), "uika.mjs");

export function snapshot(...roots) {
  const out = [];
  const walk = (base, dir) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      const st = statSync(p);
      const rel = `${base}:${relative(base, p)}`;
      if (st.isDirectory()) { out.push(`d ${rel}`); walk(base, p); }
      else out.push(`f ${rel} ${createHash("sha256").update(readFileSync(p)).digest("hex")}`);
    }
  };
  for (const r of roots) existsSync(r) ? (out.push(`root ${r}`), walk(r, r)) : out.push(`absent ${r}`);
  return out;
}

function fixture(t) {
  const s = mkdtempSync(join(tmpdir(), "uika-dryrun-"));
  t.after(() => rmSync(s, { recursive: true, force: true }));
  const home = join(s, "home"), tmp = join(s, "tmp"), gitConfig = join(s, "gitconfig");
  for (const d of [home, tmp]) mkdirSync(d);
  writeFileSync(gitConfig, "");
  const env = { ...process.env, HOME: home, USERPROFILE: home, TMPDIR: tmp, TEMP: tmp, TMP: tmp, GIT_CONFIG_GLOBAL: gitConfig, GIT_CONFIG_NOSYSTEM: "1" };
  delete env.UIKA_ESTATE_HOME; delete env.UIKA_DEPLOY_DISABLE;
  const run = (args, input = "", cwd = s) => spawnSync(process.execPath, [CLI, ...args], { cwd, env, input, encoding: "utf8" });
  const estate = join(s, "estate");
  assert.equal(run(["init", estate, "--name", "dryrun", "--apply"]).status, 0);
  execFileSync("git", ["init", "-q", estate], { env });
  const repo = join(s, "repo");
  mkdirSync(repo);
  execFileSync("git", ["init", "-q", repo], { env });
  writeFileSync(join(repo, "README.md"), "# repo\n");
  writeFileSync(join(repo, "AGENTS.md"), "# hand lawbook\n\nRepo-specific rules.\n");
  writeFileSync(join(repo, "CLAUDE.md"), "# Claude\n\nPasted law that migrate would strip.\n");
  const bare = join(s, "bare");
  mkdirSync(bare);
  writeFileSync(join(bare, "notes.txt"), "plain\n");
  return { s, home, tmp, env, run, estate, repo, bare, gitConfig };
}

const R = (estate) => ["--root", estate];

test("dry runs leave estate, targets, home and git config byte-for-byte unchanged", (t) => {
  const f = fixture(t);
  const figSpec = join(f.bare, "dry.figure.json");
  writeFileSync(figSpec, JSON.stringify({ id: "dry", title: "Dry run", form: "bar", data: { series: [{ label: "a", value: 3 }, { label: "b", value: 5 }] } }));
  const evalTasks = join(f.bare, "tasks");
  mkdirSync(evalTasks);
  writeFileSync(join(evalTasks, "marker.json"), JSON.stringify({ id: "marker", split: "train", run: ["node", "-e", "require('fs').writeFileSync('ran.txt', 'x')"], cwd: f.bare }));
  const cases = [
    ["init <nonexistent>", ["init", join(f.s, "fresh"), "--name", "x"], [join(f.s, "fresh")]],
    ["init <existing empty>", ["init", (mkdirSync(join(f.s, "empty")), join(f.s, "empty")), "--name", "x"], [join(f.s, "empty")]],
    ["adopt", ["adopt", f.repo, ...R(f.estate)]],
    ["adopt --dry-run", ["adopt", f.repo, "--dry-run", ...R(f.estate)]],
    ["deploy adopt", ["deploy", "adopt", f.repo, ...R(f.estate)]],
    ["deploy install", ["deploy", "install", ...R(f.estate)], [], f.estate],
    ["deploy auto install", ["deploy", "auto", "install", ...R(f.estate)], [], f.estate],
    ["deploy uninstall", ["deploy", "uninstall", ...R(f.estate)], [], f.estate],
    ["deploy auto uninstall", ["deploy", "auto", "uninstall", ...R(f.estate)], [], f.estate],
    ["sync", ["sync", f.repo, ...R(f.estate)]],
    ["sync --force", ["sync", f.repo, "--force", ...R(f.estate)]],
    ["sync <bare>", ["sync", f.bare, ...R(f.estate)]],
    ["docs render", ["docs", "render", f.repo, ...R(f.estate)]],
    ["docs init", ["docs", "init", f.bare, ...R(f.estate)]],
    ["docs migrate", ["docs", "migrate", f.repo, ...R(f.estate)]],
    ["skills place", ["skills", "place", ...R(f.estate)]],
    ["home regen", ["home", "regen", ...R(f.estate)]],
    ["home regen --force", ["home", "regen", "--force", ...R(f.estate)]],
    ["path adr", ["path", "adr", "dry", "run", ...R(f.estate)]],
    ["path log", ["path", "log", "x", "--from", "codex.impl", ...R(f.estate)]],
    ["figure render", ["figure", "render", figSpec, "--formats", "svg,html", ...R(f.estate)]],
    ["eval run", ["eval", "run", "--from", evalTasks, "--out", join(f.bare, "results.json"), ...R(f.estate)]],
  ];
  const ran = [];
  for (const [label, args, extra = [], cwd] of cases) {
    const roots = [f.estate, f.repo, f.bare, f.home, f.tmp, ...extra];
    const before = snapshot(...roots);
    const gitBefore = readFileSync(f.gitConfig, "utf8");
    const r = f.run(args, "", cwd);
    assert.deepEqual(snapshot(...roots), before, `${label} wrote durable state (exit ${r.status})\n${r.stdout}\n${r.stderr}`);
    assert.equal(readFileSync(f.gitConfig, "utf8"), gitBefore, `${label} changed global git config`);
    ran.push(`${label}=${r.status}`);
  }
  t.diagnostic(`dry runs checked: ${ran.length} (${ran.join(", ")})`);
  assert.equal(ran.length, cases.length);
});

test("dry-run paths print what they would do", (t) => {
  const f = fixture(t);
  const sync = f.run(["sync", f.bare, ...R(f.estate)]);
  assert.equal(sync.status, 0, sync.stderr);
  assert.match(sync.stdout, /would write .*AGENTS\.md/);
  assert.match(sync.stdout, /sync: dry run; add --apply to write/);
  const init = f.run(["init", join(f.s, "fresh"), "--name", "x"]);
  assert.match(init.stdout, /would create data\/deploy\//);
});

test("deploy adopt and forget write targets.json only with --apply", (t) => {
  const f = fixture(t);
  const targets = join(f.estate, "data", "deploy", "targets.json");
  registerTarget({ repo: "repo", path: f.repo, law: true, skills: true }, f.estate);
  const before = readFileSync(targets, "utf8");
  const dry = f.run(["deploy", "forget", f.repo, ...R(f.estate)]);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /would forget .*dry run, add --apply/);
  assert.equal(readFileSync(targets, "utf8"), before, "deploy forget without --apply rewrote targets.json");
  const wet = f.run(["deploy", "forget", f.repo, "--apply", ...R(f.estate)]);
  assert.match(wet.stdout, /forgot /);
  assert.ok(!readFileSync(targets, "utf8").includes(JSON.stringify(f.repo).slice(1, -1)), "--apply forgets the target");
});

test("session check --stop never creates .git and keeps its sentinel in the OS temp directory", (t) => {
  const f = fixture(t);
  const before = snapshot(f.bare, f.estate, f.home);
  const first = f.run(["session", "check", "--stop", ...R(f.bare)], JSON.stringify({ session_id: "dry1" }));
  assert.deepEqual(snapshot(f.bare, f.estate, f.home), before, `--stop wrote into the target\n${first.stdout}${first.stderr}`);
  assert.equal(existsSync(join(f.bare, ".git")), false, "--stop created .git in a non-git target");
  const sentinels = readdirSync(f.tmp).filter((n) => n.startsWith("uika_stop_"));
  assert.ok(sentinels.length <= 1 && sentinels.every((n) => n.endsWith("_dry1")), `unexpected temp state: ${sentinels}`);
  // inside a git repo the sentinel lives in the existing .git directory only
  const repoBefore = snapshot(f.repo).filter((l) => !l.includes("uika_stop_"));
  f.run(["session", "check", "--stop", ...R(f.repo)], JSON.stringify({ session_id: "dry2" }));
  assert.deepEqual(snapshot(f.repo).filter((l) => !l.includes("uika_stop_")), repoBefore);
  // snapshot() renders paths with the platform separator, so build the expected path the same way.
  const repoSentinels = snapshot(f.repo).filter((l) => l.includes("uika_stop_"));
  assert.equal(repoSentinels.length, 1, `expected one sentinel in .git: ${repoSentinels}`);
  assert.ok(repoSentinels[0].includes(`:${join(".git", "uika_stop_dry2")} `), `sentinel outside .git: ${repoSentinels}`);
});
