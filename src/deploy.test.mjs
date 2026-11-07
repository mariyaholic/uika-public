// deploy.test.mjs — commit-triggered distribution (ADR-0051).
// The git-range read (`changedPaths`) needs a real git subprocess, so these tests drive the
// distribution engine with an explicit changed-file list (the same input the hook supplies) and
// cover repository detection, the legs, the hook lifecycle, and hook safety on the filesystem.
import test from "node:test";
import { adopt } from "./adopt.mjs";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync, symlinkSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, basename } from "node:path";
import {
  classify, relevant, runDeploy, repoRoot, hookPath, hookInstalled, install, uninstall, hookRun, isAdopted,
  decideAuto, registerTarget, readAutoTargets, targetsOf, unregisterTarget, autoAdopt, syncExistingSkills,
  deployAdopt, deployAll, autoTemplate, changedPaths,
} from "./deploy.mjs";

function temp(t, prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
const capture = () => { const logs = []; return { logs, emit: (m) => logs.push(m) }; };
const SKILL = "---\nname: demo\ndescription: demo skill\n---\nbody v1\n";

function estateRoot(t, { targets = [] } = {}) {
  const root = temp(t, "uika-deploy-estate-");
  mkdirSync(join(root, "skills", "demo"), { recursive: true });
  writeFileSync(join(root, "skills", "demo", "SKILL.md"), SKILL);
  mkdirSync(join(root, "design"), { recursive: true });
  writeFileSync(join(root, "design", "uika-canonical.css"), ":root{--demo:1}\n");
  writeFileSync(join(root, "AGENTS.md"), "# estate law\n");
  writeFileSync(join(root, "estate.json"), JSON.stringify({ estate: { distribution: { targets }, skills: { homes: [] } } }));
  return root;
}
function fakeRepo(t, { estate = false } = {}) {
  const repo = temp(t, "uika-deploy-repo-");
  mkdirSync(join(repo, ".git"), { recursive: true });
  if (estate) {
    mkdirSync(join(repo, "skills", "demo"), { recursive: true });
    writeFileSync(join(repo, "skills", "demo", "SKILL.md"), SKILL);
    writeFileSync(join(repo, "AGENTS.md"), "# estate law\n");
    writeFileSync(join(repo, "estate.json"), JSON.stringify({ estate: { distribution: { targets: [] }, skills: { homes: [] } } }));
  }
  return repo;
}
function adoptedTarget(t) {
  const dir = temp(t, "uika-deploy-target-");
  writeFileSync(join(dir, "AGENTS.md"), "hand law above\n\n<!-- uika:law:begin -->\nOLD BLOCK\n<!-- uika:law:end -->\nhand tail\n");
  return dir;
}

// --- classification (pure) ---

test("classify sorts a commit into legs and ignores unrelated paths", () => {
  const c = classify([
    { status: "M", path: "skills/copy-craft/SKILL.md" },
    { status: "A", path: "skills/vendor/vendored/SKILL.md" },
    { status: "D", path: "skills/retired/SKILL.md" },
    { status: "M", path: "AGENTS.md" },
    { status: "M", path: "estate.json" },
    { status: "M", path: "design/uika-canonical.css" },
    { status: "M", path: "mcp/servers.json" },
    { status: "M", path: "providers/registry.json" },
    { status: "M", path: "README.md" },
    { status: "M", path: "skills/README.md" },
    { status: "M", path: "src/deploy.mjs" },
  ]);
  assert.deepEqual([...c.skills].sort(), ["copy-craft", "vendored"]);
  assert.deepEqual([...c.removed], ["retired"]);
  assert.deepEqual([...c.law].sort(), ["AGENTS.md", "design/uika-canonical.css", "estate.json"]);
  assert.equal(c.plugins.length, 1);
  assert.equal(c.models.length, 1);
  assert.deepEqual(c.notes, ["README.md"]);
  assert.equal(c.other, 2, "skills/README.md and src/deploy.mjs are not distributable");
  assert.equal(relevant(c), true);
});

test("docs and tooling commits are not distribution-worthy", () => {
  assert.equal(relevant(classify([{ status: "M", path: "README.md" }, { status: "M", path: "src/uika.mjs" }])), false);
  assert.equal(relevant(classify([])), false);
});

// --- skills leg ---

test("skills leg: dry run plans, apply copies only into the given homes, second run is a keep", (t) => {
  const root = estateRoot(t);
  const a = temp(t, "uika-home-a-"), b = temp(t, "uika-home-b-");
  const files = [{ status: "M", path: "skills/demo/SKILL.md" }];
  const dry = capture();
  runDeploy({ root, files, homes: [a, b], targets: [], emit: dry.emit });
  assert.equal(existsSync(join(a, "demo", "SKILL.md")), false, "dry run wrote a skill");
  assert.match(dry.logs.join("\n"), /would place demo/);

  const applied = capture();
  const summary = runDeploy({ root, files, homes: [a, b], targets: [], apply: true, emit: applied.emit });
  assert.equal(readFileSync(join(a, "demo", "SKILL.md"), "utf8"), SKILL);
  assert.equal(readFileSync(join(b, "demo", "SKILL.md"), "utf8"), SKILL);
  assert.deepEqual(summary.skills, ["demo"]);
  assert.match(applied.logs.join("\n"), /PLACED demo -> 2 home/);

  const again = capture();
  runDeploy({ root, files, homes: [a, b], targets: [], apply: true, emit: again.emit });
  assert.match(again.logs.join("\n"), /keep  demo/);
});

test("skills leg: adopted targets get repo-local copies, unadopted targets are untouched", (t) => {
  const root = estateRoot(t);
  const adopted = adoptedTarget(t);
  mkdirSync(join(adopted, ".claude"), { recursive: true });
  const raw = temp(t, "uika-deploy-raw-");
  mkdirSync(join(raw, ".codex"), { recursive: true });
  const files = [{ status: "M", path: "skills/demo/SKILL.md" }];
  runDeploy({ root, files, targets: [{ repo: "adopted", path: adopted }, { repo: "raw", path: raw }], homes: [], apply: true, emit: () => {} });
  assert.equal(existsSync(join(adopted, ".claude", "skills", "demo", "SKILL.md")), true);
  assert.equal(existsSync(join(raw, ".codex", "skills", "demo", "SKILL.md")), false);
});

test("skills leg: a deleted skill is reported, never removed from homes", (t) => {
  const home = temp(t, "uika-home-");
  mkdirSync(join(home, "gone"), { recursive: true });
  writeFileSync(join(home, "gone", "SKILL.md"), "old\n");
  const out = capture();
  const root = estateRoot(t);
  const summary = runDeploy({ root, files: [{ status: "D", path: "skills/gone/SKILL.md" }], homes: [home], targets: [], apply: true, emit: out.emit });
  assert.deepEqual(summary.removed, ["gone"]);
  assert.equal(existsSync(join(home, "gone", "SKILL.md")), true, "copy-only homes must not be pruned");
  assert.match(out.logs.join("\n"), /deleted/);
});

// --- law leg ---

test("law leg: refreshes the marked block and bridge in an adopted target, preserving hand text", (t) => {
  const root = estateRoot(t);
  const target = adoptedTarget(t);
  const out = capture();
  const summary = runDeploy({ root, files: [{ status: "M", path: "AGENTS.md" }], homes: [], targets: [{ repo: "adopted", path: target }], apply: true, emit: out.emit });
  const agents = readFileSync(join(target, "AGENTS.md"), "utf8");
  assert.match(agents, /Uika estate law/);
  assert.match(agents, /hand law above/);
  assert.match(agents, /hand tail/);
  assert.doesNotMatch(agents, /OLD BLOCK/);
  assert.ok(existsSync(join(target, "CLAUDE.md")), "CLAUDE adapter not written");
  const bridge = readFileSync(join(target, "design", "uika-canonical.css"), "utf8");
  assert.ok(bridge.startsWith("/* uika:bridge:"), "token bridge missing its marker");
  assert.deepEqual(summary.repos, ["adopted"]);
  assert.equal(isAdopted(target), true);
});

test("law leg: an unadopted target is reported, never auto-adopted", (t) => {
  const root = estateRoot(t);
  const target = temp(t, "uika-deploy-target-");
  writeFileSync(join(target, "AGENTS.md"), "hand law only\n");
  const out = capture();
  const summary = runDeploy({ root, files: [{ status: "M", path: "estate.json" }], homes: [], targets: [{ repo: "raw", path: target }], apply: true, emit: out.emit });
  assert.equal(readFileSync(join(target, "AGENTS.md"), "utf8"), "hand law only\n", "unadopted repo was modified");
  assert.equal(existsSync(join(target, "CLAUDE.md")), false);
  assert.deepEqual(summary.repos, []);
  assert.match(out.logs.join("\n"), /NOTE  raw: not law-injected/);
});

test("law leg: a current block is a KEEP, not a rewrite (no mtime churn)", (t) => {
  const root = estateRoot(t);
  const target = adoptedTarget(t);
  const files = [{ status: "M", path: "AGENTS.md" }];
  runDeploy({ root, files, homes: [], targets: [{ repo: "adopted", path: target }], apply: true, emit: () => {} });
  const first = readFileSync(join(target, "AGENTS.md"), "utf8");
  const out = capture();
  const summary = runDeploy({ root, files, homes: [], targets: [{ repo: "adopted", path: target }], apply: true, emit: out.emit });
  assert.equal(readFileSync(join(target, "AGENTS.md"), "utf8"), first, "law block was rewritten");
  assert.match(out.logs.join("\n"), /KEEP  .*AGENTS\.md \(current\)/);
  assert.deepEqual(summary.repos, ["adopted"]);
});

// --- render-only legs ---

test("plugin and model registry changes are reported render-only, never written", (t) => {
  const root = estateRoot(t);
  mkdirSync(join(root, "mcp"), { recursive: true });
  writeFileSync(join(root, "mcp", "servers.json"), JSON.stringify({ servers: { demo: { harnesses: ["dsh", "hermes"] } } }));
  const out = capture();
  const summary = runDeploy({ root, files: [{ status: "M", path: "mcp/servers.json" }, { status: "M", path: "providers/registry.json" }], homes: [], targets: [], emit: out.emit });
  const text = out.logs.join("\n");
  assert.match(text, /render-only/);
  assert.match(text, /dsh, hermes/);
  assert.match(text, /models .*render-only/);
  assert.equal(summary.plugins, true);
  assert.equal(summary.models, true);
});

// --- repository detection + hook lifecycle ---

test("repoRoot walks up to the worktree root and reads a worktree .git file", (t) => {
  const repo = temp(t, "uika-deploy-repo-");
  mkdirSync(join(repo, ".git"));
  mkdirSync(join(repo, "nested", "deeper"), { recursive: true });
  assert.equal(repoRoot(join(repo, "nested", "deeper")), resolve(repo));

  // A linked worktree: `.git` is a file pointing at the per-worktree git dir.
  const worktree = temp(t, "uika-deploy-wt-");
  const gitdir = temp(t, "uika-deploy-gitdir-");
  writeFileSync(join(worktree, ".git"), `gitdir: ${gitdir}\n`);
  assert.equal(repoRoot(join(worktree, "sub")), resolve(worktree));
  assert.equal(hookPath(worktree), join(resolve(gitdir), "hooks", "post-commit"));
});

test("hook lifecycle: install, idempotence, foreign refusal, forced backup, uninstall", (t) => {
  const repo = fakeRepo(t);
  const p = hookPath(repo);
  install(repo, { apply: false });
  assert.equal(existsSync(p), false, "dry run installed a hook");
  install(repo, { apply: true });
  assert.equal(hookInstalled(repo), true);
  const body = readFileSync(p, "utf8");
  assert.match(body, /uika-deploy \(ADR-0051\)/);
  assert.match(body, /deploy hook-run/);
  assert.match(body, /UIKA_DEPLOY_DISABLE/);
  install(repo, { apply: true }); // idempotent, prints "already installed"
  assert.equal(readFileSync(p, "utf8"), body);

  const foreign = fakeRepo(t);
  mkdirSync(join(foreign, ".git", "hooks"), { recursive: true });
  writeFileSync(hookPath(foreign), "#!/bin/sh\necho foreign\n");
  assert.throws(() => install(foreign, { apply: true }), /foreign post-commit hook/);
  install(foreign, { apply: true, force: true });
  assert.ok(readFileSync(hookPath(foreign), "utf8").includes("uika-deploy"), "forced install did not replace the hook");
  const backups = readdirSync(join(foreign, ".git", "hooks")).filter((f) => f.startsWith("post-commit.bak-"));
  assert.equal(backups.length, 1, "foreign hook was not backed up");

  uninstall(foreign, { apply: true });
  assert.equal(existsSync(hookPath(foreign)), false);
});

// --- hook safety + hook execution ---

test("hookRun stays silent outside the estate repo", async (t) => {
  const repo = fakeRepo(t);
  await hookRun(repo, { homes: [] });
  assert.equal(existsSync(join(repo, "data", "deploy", "deploy.log")), false);
});

test("hookRun honours UIKA_DEPLOY_DISABLE", async (t) => {
  const repo = fakeRepo(t, { estate: true });
  const home = temp(t, "uika-home-");
  process.env.UIKA_DEPLOY_DISABLE = "1";
  try { await hookRun(repo, { estate: repo, files: [{ status: "M", path: "skills/demo/SKILL.md" }], homes: [home], targets: [] }); }
  finally { delete process.env.UIKA_DEPLOY_DISABLE; }
  assert.equal(existsSync(join(home, "demo", "SKILL.md")), false);
});

test("hookRun skips during git surgery and records the skip", async (t) => {
  const repo = fakeRepo(t, { estate: true });
  const home = temp(t, "uika-home-");
  mkdirSync(join(repo, ".git", "rebase-merge"));
  await hookRun(repo, { estate: repo, files: [{ status: "M", path: "skills/demo/SKILL.md" }], homes: [home], targets: [] });
  assert.equal(existsSync(join(home, "demo", "SKILL.md")), false);
  const log = readFileSync(join(repo, "data", "deploy", "deploy.log"), "utf8");
  assert.match(log, /git state in progress/);
});

test("hookRun distributes a relevant commit and logs one action record", async (t) => {
  const repo = fakeRepo(t, { estate: true });
  const home = temp(t, "uika-home-");
  await hookRun(repo, { estate: repo, files: [{ status: "M", path: "skills/demo/SKILL.md" }], homes: [home], targets: [] });
  assert.equal(readFileSync(join(home, "demo", "SKILL.md"), "utf8"), SKILL);
  const log = readFileSync(join(repo, "data", "deploy", "deploy.log"), "utf8").trim().split(/\r?\n/);
  assert.equal(log.length, 1);
  const entry = JSON.parse(log[0]);
  assert.deepEqual(entry.skills, 1);
  assert.ok(entry.ts, "log record has no timestamp");
});

// --- new-project auto-adoption (ADR-0052) ---

test("decideAuto adopts only a local project's first commit", () => {
  const base = { repo: "C:/Users/x/Desktop/proj", estate: "C:/Users/x/Desktop/Uika", temp: "C:/Users/x/AppData/Local/Temp", env: {}, origin: "", hasParent: false, adopted: false, config: "" };
  assert.equal(decideAuto(base), true);
  assert.equal(decideAuto({ ...base, origin: "https://github.com/x/y.git" }), false, "a clone is not a new project");
  assert.equal(decideAuto({ ...base, hasParent: true }), false, "a later commit is not a first commit");
  assert.equal(decideAuto({ ...base, adopted: true }), false, "already adopted");
  assert.equal(decideAuto({ ...base, config: "false" }), false, "per-repo opt-out");
  assert.equal(decideAuto({ ...base, env: { UIKA_DEPLOY_NO_AUTO: "1" } }), false, "env opt-out");
  assert.equal(decideAuto({ ...base, repo: "C:/Users/x/Desktop/Uika/worktree" }), false, "the estate itself");
  assert.equal(decideAuto({ ...base, repo: "C:/Users/x/AppData/Local/Temp/scratch" }), false, "temp scratch repo");
  assert.equal(decideAuto({ ...base, repo: "C:/Users/x/Desktop/proj/node_modules/dep" }), false, "dependency checkout");
});

test("decideAuto compares canonical paths: a symlinked temp or estate still excludes its repos", (t) => {
  // macOS reports a hook's cwd as /private/var/... while TMPDIR says /var/...; same for any linked estate.
  const s = mkdtempSync(join(tmpdir(), "uika-canon-"));
  t.after(() => rmSync(s, { recursive: true, force: true }));
  const realTemp = join(s, "real-temp"), realEstate = join(s, "real-estate");
  for (const d of [join(realTemp, "scratch"), join(realEstate, "worktree")]) mkdirSync(d, { recursive: true });
  const linkTemp = join(s, "link-temp"), linkEstate = join(s, "link-estate");
  symlinkSync(realTemp, linkTemp, "junction");
  symlinkSync(realEstate, linkEstate, "junction");
  const base = { repo: join(s, "proj"), estate: linkEstate, temp: linkTemp, env: {}, origin: "", hasParent: false, adopted: false, config: "" };
  assert.equal(decideAuto(base), true);
  assert.equal(decideAuto({ ...base, repo: join(realTemp, "scratch") }), false, "temp scratch repo reached through the real path");
  assert.equal(decideAuto({ ...base, repo: realEstate }), false, "the estate reached through the real path");
  assert.equal(decideAuto({ ...base, repo: join(realEstate, "worktree") }), false, "inside the estate reached through the real path");
});

test("auto-target registry merges by path, keeps flags, and honours the manifest first", (t) => {
  const root = estateRoot(t);
  const a = temp(t, "uika-auto-a-"), b = temp(t, "uika-auto-b-"), c = temp(t, "uika-auto-c-");
  writeFileSync(join(root, "estate.json"), JSON.stringify({ estate: { distribution: { targets: [{ repo: "manifest-c", path: c }] }, skills: { homes: [] } } }));
  registerTarget({ repo: "a", path: a }, root);
  registerTarget({ repo: "a", path: a }, root);
  registerTarget({ repo: "b", path: b, law: false }, root);
  registerTarget({ repo: "c", path: c }, root); // same path as the manifest target
  const list = readAutoTargets(root);
  assert.equal(list.length, 3, "duplicate path was registered twice");
  const targets = targetsOf(root);
  const samePath = (a, b) => a.replace(/\\/g, "/").toLowerCase() === b.replace(/\\/g, "/").toLowerCase();
  assert.equal(targets.length, 3, "manifest/auto collision should collapse to one path");
  assert.equal(targets.find((x) => samePath(x.path, c)).source, "manifest", "manifest should win on a path collision");
  assert.equal(targets.find((x) => samePath(x.path, b)).law, false);
  assert.equal(unregisterTarget(a, root), 1);
  assert.equal(targetsOf(root).length, 2);
});

test("syncExistingSkills updates existing copies only, never adds skills", (t) => {
  const root = estateRoot(t);
  const repo = temp(t, "uika-existing-");
  mkdirSync(join(repo, ".claude", "skills", "demo"), { recursive: true });
  writeFileSync(join(repo, ".claude", "skills", "demo", "SKILL.md"), "stale\n");
  mkdirSync(join(repo, ".claude", "skills", "local-only"), { recursive: true });
  writeFileSync(join(repo, ".claude", "skills", "local-only", "SKILL.md"), "mine\n");
  const out = capture();
  const res = syncExistingSkills(root, repo, true, out.emit);
  assert.equal(res.checked, 2);
  assert.equal(res.updated, 1);
  assert.equal(readFileSync(join(repo, ".claude", "skills", "demo", "SKILL.md"), "utf8"), SKILL);
  assert.equal(readFileSync(join(repo, ".claude", "skills", "local-only", "SKILL.md"), "utf8"), "mine\n");
  assert.equal(existsSync(join(repo, ".claude", "skills", "vendored-or-new")), false);
});

test("deploy adopt --skills-only registers a skills-only target and adds no law", async (t) => {
  const root = estateRoot(t);
  const repo = temp(t, "uika-skills-only-");
  mkdirSync(join(repo, ".agents", "skills", "demo"), { recursive: true });
  writeFileSync(join(repo, ".agents", "skills", "demo", "SKILL.md"), "stale\n");
  const entry = await deployAdopt(repo, { apply: true, skillsOnly: true, root });
  assert.equal(entry.law, false);
  assert.equal(entry.skills, true);
  assert.equal(readFileSync(join(repo, ".agents", "skills", "demo", "SKILL.md"), "utf8"), SKILL);
  assert.equal(existsSync(join(repo, "AGENTS.md")), false, "skills-only must not inject law");
  assert.equal(readAutoTargets(root).length, 1);
});

test("autoAdopt force runs the full adoption and records the target", async (t) => {
  const root = estateRoot(t);
  const proj = temp(t, "uika-new-project-");
  mkdirSync(join(proj, ".git"));
  const entry = await autoAdopt(proj, { root, quiet: true, force: true });
  assert.equal(entry.repo, basename(proj));
  assert.match(readFileSync(join(proj, "AGENTS.md"), "utf8"), /uika:law:begin/);
  assert.equal(readAutoTargets(root).length, 1);
  assert.ok(existsSync(join(root, "data", "deploy", "deploy.log")));
});

test("deploy all treats the whole library as changed and reports the target split", (t) => {
  const root = estateRoot(t);
  const out = capture();
  const summary = deployAll({ root, apply: false, emit: out.emit });
  assert.deepEqual(summary.skills, ["demo"]);
  assert.ok(summary.all);
  assert.match(out.logs.join("\n"), /targets: 0 manifest \+ 0 auto-adopted/);
});

test("deploy auto installs/uninstalls the global git template without touching the real config", (t) => {
  const root = estateRoot(t);
  const cfg = join(temp(t, "uika-gitconfig-"), "config");
  writeFileSync(cfg, "");
  const prev = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = cfg;
  try {
    autoTemplate(["install"], { apply: true, root });
    assert.equal(existsSync(join(root, "data", "deploy", "git-template", "hooks", "post-commit")), true);
    const written = readFileSync(cfg, "utf8");
    assert.match(written, /templateDir/);
    autoTemplate(["uninstall"], { apply: true, root });
    assert.doesNotMatch(readFileSync(cfg, "utf8"), /templateDir/);
  } finally {
    if (prev === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = prev;
  }
});

test("helper-only skill changes and interrupted copies are repaired on repeat", (t) => {
  const root = estateRoot(t), home = temp(t, "uika-home-");
  const files = [{ status: "M", path: "skills/demo/helper.md" }];
  writeFileSync(join(root, "skills", "demo", "helper.md"), "one");
  runDeploy({ root, files, homes: [home], targets: [], apply: true, emit: () => {} });
  writeFileSync(join(root, "skills", "demo", "helper.md"), "two");
  const dry = capture();
  runDeploy({ root, files, homes: [home], targets: [], emit: dry.emit });
  assert.match(dry.logs.join("\n"), /would place/);
  assert.equal(readFileSync(join(home, "demo", "helper.md"), "utf8"), "one");
  runDeploy({ root, files, homes: [home], targets: [], apply: true, emit: () => {} });
  assert.equal(readFileSync(join(home, "demo", "helper.md"), "utf8"), "two");
  rmSync(join(home, "demo", "helper.md"));
  runDeploy({ root, files, homes: [home], targets: [], apply: true, emit: () => {} });
  assert.equal(readFileSync(join(home, "demo", "helper.md"), "utf8"), "two");
  const repo = temp(t, "uika-skill-repo-");
  mkdirSync(join(repo, ".claude", "skills", "demo"), { recursive: true });
  writeFileSync(join(repo, ".claude", "skills", "demo", "SKILL.md"), SKILL);
  assert.equal(syncExistingSkills(root, repo, true, () => {}).updated, 1);
  assert.equal(syncExistingSkills(root, repo, true, () => {}).updated, 0);
});

test("corrupt target registries are preserved and fail before auto-adoption writes", async (t) => {
  const root = estateRoot(t), repo = temp(t, "uika-corrupt-target-");
  const folder = join(root, "data", "deploy"), file = join(folder, "targets.json");
  mkdirSync(folder, { recursive: true });
  for (const contents of ["{bad", "null", "{}", '{"targets":{}}', '{"targets":[{}]}']) {
    writeFileSync(file, contents);
    assert.throws(() => registerTarget({ path: repo }, root), /cannot read registry/);
    assert.throws(() => unregisterTarget(repo, root), /cannot read registry/);
    await assert.rejects(autoAdopt(repo, { root, force: true }), /cannot read registry/);
    assert.equal(readFileSync(file, "utf8"), contents);
    assert.equal(existsSync(join(repo, "AGENTS.md")), false);
  }
  rmSync(file);
  registerTarget({ path: repo }, root);
  registerTarget({ path: repo }, root);
  assert.equal(readAutoTargets(root).length, 1);
  assert.deepEqual(readdirSync(folder), ["targets.json"]);
});

test("Git range detection preserves Unicode and whitespace and rejects bad revisions", (t) => {
  const root = temp(t, "uika-git-paths-");
  const git = (...args) => execFileSync("git", ["-c", "user.name=Example", "-c", "user.email=example@example.com", "-c", "core.hooksPath=/dev/null", "-C", root, ...args], { encoding: "utf8", env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: join(root, "absent-config") } });
  git("init", "-q");
  const names = ["café", "with space", ...(process.platform === "win32" ? [] : ["with\ttab", "with\nnewline"])];
  for (const name of names) {
    mkdirSync(join(root, "skills", name), { recursive: true });
    writeFileSync(join(root, "skills", name, "SKILL.md"), "example\n");
  }
  git("add", "."); git("commit", "-qm", "fixture");
  assert.deepEqual([...classify(changedPaths(root)).skills].sort(), names.sort());
  assert.throws(() => changedPaths(root, "missing-revision"));
  const before = git("rev-parse", "HEAD").trim();
  writeFileSync(join(root, "skills", "café", "SKILL.md"), "changed\n");
  git("add", "."); git("commit", "-qm", "update");
  assert.deepEqual(changedPaths(root, before), [{ status: "M", path: "skills/café/SKILL.md" }]);
});

test("case-distinct Linux targets stay distinct and relative manifest paths use the estate", { skip: process.platform !== "linux" }, (t) => {
  const root = estateRoot(t);
  for (const name of ["Case", "case"]) mkdirSync(join(root, name));
  writeFileSync(join(root, "estate.json"), JSON.stringify({ estate: { distribution: { targets: [{ path: "Case" }, { path: "case" }] } } }));
  assert.equal(targetsOf(root).length, 2);
  registerTarget({ path: join(root, "Case") }, root);
  registerTarget({ path: join(root, "case") }, root);
  assert.equal(readAutoTargets(root).length, 2);
  unregisterTarget(join(root, "Case"), root);
  assert.equal(readAutoTargets(root)[0].path, join(root, "case").replace(/\\/g, "/"));
});

test("atomic target updates preserve restrictive POSIX permissions", { skip: process.platform === "win32" }, (t) => {
  const root = estateRoot(t), repo = temp(t, "uika-private-target-");
  registerTarget({ path: repo }, root);
  const file = join(root, "data", "deploy", "targets.json");
  assert.equal(statSync(file).mode & 0o777, 0o600);
  registerTarget({ path: repo }, root);
  assert.equal(statSync(file).mode & 0o777, 0o600);
});

test("adoption preflight refuses linked skill destinations before target or registry writes", async (t) => {
  const root = estateRoot(t), repo = temp(t, "uika-linked-adopt-"), external = temp(t, "uika-external-skill-");
  const destination = join(repo, ".claude", "skills", "demo");
  mkdirSync(join(repo, ".claude", "skills"), { recursive: true });
  writeFileSync(join(external, "SKILL.md"), "owner bytes\n");
  symlinkSync(external, destination, "junction");
  await assert.rejects(adopt({ root, rest: [repo], apply: true, opts: {} }), /unsafe .*link/);
  await assert.rejects(autoAdopt(repo, { root, force: true }), /unsafe .*link/);
  await assert.rejects(deployAdopt(repo, { root, apply: true }), /unsafe .*link/);
  assert.equal(readFileSync(join(external, "SKILL.md"), "utf8"), "owner bytes\n");
  assert.equal(existsSync(join(repo, "AGENTS.md")), false);
  assert.equal(existsSync(join(root, "data", "deploy", "targets.json")), false);
  rmSync(destination);
  symlinkSync(external, join(root, "skills", "demo", "linked"), "junction");
  await assert.rejects(adopt({ root, rest: [repo], apply: true, opts: {} }), /unsupported skill entry/);
  assert.equal(existsSync(join(repo, "AGENTS.md")), false);
});
