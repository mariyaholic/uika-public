// deploy.mjs — `uika deploy status|install|uninstall|adopt|targets|auto|hook-run` (ADR-0051/0052).
// Commit-triggered distribution: when a commit touches the estate's skills, law, or registries,
// push the changed surfaces out to this machine's consumers — every harness skill home, the
// adopted repos' repo-local homes and marked law blocks — while
// reporting the legs that stay owner-applied (MCP/models are render-only, ADR-0017).
// New projects adopt themselves: a global git `init.templateDir` plants the post-commit hook in
// every repository created on this machine, and the hook adopts a repo on its first commit when
// it is a local project (root commit, no origin remote). Auto-adopted repos are recorded in
// data/deploy/targets.json (machine-local) and join the deploy fan-out.
// Dry-run by default; writes only with --apply. The post-commit hook runs `deploy hook-run`,
// always exits 0, and records actions in data/deploy/deploy.log.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, rmSync, cpSync, statSync, chmodSync, readdirSync, realpathSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { findSkills, skillHomes, skillCurrent, copySkill } from "./skills.mjs";
import { refreshLaw, LOCAL_HOMES, adopt, resolveTarget, LAW_BEGIN, adoptionSkills } from "./adopt.mjs";
import { ESTATE, TARGETS_REL, norm, resolveEstateRoot, readAutoTargets, registerTarget, unregisterTarget, targetsOf, isAdopted, adoptedTargets } from "./targets.mjs";
import { docsInit } from "./docs.mjs";
import { homeStates } from "./home.mjs";

// Shared with `uika docs` (ADR-0053) and kept re-exported for callers/tests.
export { ESTATE, TARGETS_REL, norm, readAutoTargets, writeAutoTargets, registerTarget, unregisterTarget, targetsOf, isAdopted, adoptedTargets } from "./targets.mjs";

const MARK = "# uika-deploy (ADR-0051)";
const LOG_REL = join("data", "deploy", "deploy.log");
const STATE_REL = join("data", "deploy", "state.json");
const TEMPLATE_REL = join("data", "deploy", "git-template");
const LAW_PATHS = new Set(["AGENTS.md", "estate.json", "design/uika-canonical.css"]);
const NOTE_PATHS = new Set(["README.md", "MANUAL.md", "manual.html", "llms.txt", "tool/README.md"]);
const GIT_STATE = ["rebase-merge", "rebase-apply", "MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD"];

const git = (repo, args, opts = {}) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();
const tryGit = (repo, args) => { try { return git(repo, args); } catch { return ""; } };

// Repository detection is filesystem-only (no subprocess): the deploy hook must work even where
// spawning git is restricted, and `.git` as a file already names a worktree's git dir.
export function repoRoot(dir = process.cwd()) {
  let cur = resolve(dir);
  for (;;) {
    if (existsSync(join(cur, ".git"))) return cur;
    const parent = dirname(cur);
    if (parent === cur) return "";
    cur = parent;
  }
}

function readGitFile(file) {
  const m = /^gitdir:\s*(.+)$/m.exec(readFileSync(file, "utf8"));
  return m ? resolve(dirname(file), m[1].trim()) : "";
}

function gitDirs(repo) {
  const dot = join(repo, ".git");
  if (!existsSync(dot)) return { dir: "", common: "" };
  const dir = statSync(dot).isDirectory() ? dot : readGitFile(dot);
  if (!dir) return { dir: "", common: "" };
  const commonFile = join(dir, "commondir");
  const common = existsSync(commonFile) ? resolve(dir, readFileSync(commonFile, "utf8").trim()) : dir;
  return { dir, common };
}

export const hookPath = (repo) => join(gitDirs(repo).common, "hooks", "post-commit");
export const hookInstalled = (repo) => { const p = hookPath(repo); return existsSync(p) && readFileSync(p, "utf8").includes(MARK); };
const shellQuote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;
const hookBody = (root = ESTATE) => `#!/bin/sh\n${MARK}\n[ -n "$UIKA_DEPLOY_DISABLE" ] && exit 0\nexec node ${shellQuote(fileURLToPath(new URL("./uika.mjs", import.meta.url)).replace(/\\/g, "/"))} deploy hook-run --root ${shellQuote(String(root).replace(/\\/g, "/"))}\n`;

// Changed paths for the deploy range: one commit by default (root-commit aware), or `<since>..HEAD`.
export function changedPaths(repo, since) {
  let out;
  git(repo, ["rev-parse", "--git-dir"]); // Distinguish an unborn branch from an invalid repository.
  if (!since && !tryGit(repo, ["rev-parse", "--verify", "HEAD"])) return [];
  if (since) {
    const base = git(repo, ["rev-parse", "--verify", "--end-of-options", `${since}^{commit}`]);
    out = git(repo, ["diff", "--name-status", "-z", "--no-renames", `${base}..HEAD`, "--"]);
  }
  else if (tryGit(repo, ["rev-parse", "--verify", "HEAD^"])) out = git(repo, ["diff", "--name-status", "-z", "--no-renames", "HEAD^..HEAD", "--"]);
  else out = git(repo, ["diff-tree", "--root", "-r", "--no-commit-id", "--name-status", "-z", "--no-renames", "HEAD", "--"]);
  const files = [];
  const fields = out.split("\0");
  for (let i = 0; i + 1 < fields.length; i += 2) if (fields[i] && fields[i + 1]) files.push({ status: fields[i][0], path: fields[i + 1] });
  return files;
}

// Pure classification of a commit into distribution legs. Nothing here touches disk.
export function classify(files) {
  const c = { skills: new Set(), removed: new Set(), law: new Set(), plugins: [], models: [], notes: [], other: 0 };
  for (const f of files) {
    const p = f.path;
    const skill = /^skills\/(?:vendor\/)?([^/]+)\//.exec(p);
    if (skill) { (f.status === "D" ? c.removed : c.skills).add(skill[1]); continue; }
    if (LAW_PATHS.has(p)) { c.law.add(p); continue; }
    if (p === "mcp/servers.json") { c.plugins.push(p); continue; }
    if (p === "providers/registry.json") { c.models.push(p); continue; }
    if (NOTE_PATHS.has(p)) { c.notes.push(p); continue; }
    c.other++;
  }
  return c;
}

export const relevant = (c) => c.skills.size > 0 || c.removed.size > 0 || c.law.size > 0 || c.plugins.length > 0 || c.models.length > 0;

// --- the target registry itself lives in targets.mjs (shared with `uika docs`, ADR-0053) ---

function mcpHarnesses(root) {
  try {
    const servers = JSON.parse(readFileSync(join(root, "mcp", "servers.json"), "utf8")).servers ?? {};
    return [...new Set(Object.values(servers).flatMap((s) => s.harnesses ?? []))].sort();
  } catch { return []; }
}

function repoHomes(targets) {
  const out = [];
  for (const t of targets) for (const rel of LOCAL_HOMES) {
    const home = join(t.path, rel);
    if (existsSync(join(home, "..")) || existsSync(home)) out.push({ home, repo: t.repo });
  }
  return out;
}

function writeLog(root, entry) {
  try {
    mkdirSync(join(root, "data", "deploy"), { recursive: true });
    appendFileSync(join(root, LOG_REL), JSON.stringify(entry) + "\n");
  } catch { /* logging must never break a commit */ }
}

// Plan or apply the legs for a set of changed files (default: the last commit of `repo`).
// `all: true` means "treat the whole estate library as changed" — the retrofit/sweep mode.
export function runDeploy({ root, repo = repoRoot(root), files, apply = false, emit = console.log, homes, targets, all = false, homeDir = homedir() }) {
  const changed = all
    ? [...findSkills(root).map((s) => ({ status: "M", path: `skills/${s.name}/SKILL.md` })), { status: "M", path: "AGENTS.md" }]
    : (files ?? changedPaths(repo));
  const c = classify(changed);
  const r = repo || "";
  const summary = {
    repo: r || null,
    commit: r ? tryGit(r, ["rev-parse", "--short", "HEAD"]) : "",
    subject: r ? tryGit(r, ["log", "-1", "--format=%s"]) : "",
    skills: [...c.skills].sort(), removed: [...c.removed].sort(), law: [...c.law].sort(),
    repos: [], plugins: c.plugins.length > 0, models: c.models.length > 0, notes: c.notes, all,
  };
  if (!relevant(c)) return summary;

  const isEstate = existsSync(join(root, "estate.json"));
  const targetList = targets ?? (isEstate ? targetsOf(root) : []);
  const lawTargets = targetList.filter((t) => t.law !== false);
  const adopted = adoptedTargets(lawTargets);
  const notAdopted = lawTargets.filter((t) => !isAdopted(t.path));
  const homeList = (homes ?? (isEstate ? skillHomes(root).filter((h) => existsSync(h)) : [])).map((h) => (typeof h === "string" ? { home: h } : h));
  // Repo-local skill copies go to adopted repos, plus skills-only targets (law deliberately off,
  // e.g. a public repo that already carries a curated subset).
  const skillsTargets = targetList.filter((t) => t.skills !== false && (t.law === false || isAdopted(t.path)));
  const destinations = [...homeList, ...repoHomes(skillsTargets)];
  const byName = new Map(findSkills(root).map((s) => [s.name, s]));

  // Skills leg: copy changed skill dirs to harness homes + adopted repo-local homes.
  for (const name of summary.skills) {
    const src = byName.get(name);
    if (!src) { emit(`SKIP  ${name} (no SKILL.md in the estate; not a distributable skill)`); continue; }
    if (!destinations.length) { emit(`NOTE  ${name}: no skill homes exist on this machine`); continue; }
    const stale = destinations.filter((d) => !skillCurrent(src.dir, join(d.home, name)));
    if (!stale.length) { emit(`keep  ${name} (already current in ${destinations.length} home(s))`); continue; }
    if (!apply) { emit(`would place ${name} -> ${stale.length} home(s): ${stale.map((d) => d.home).join(", ")}`); continue; }
    for (const d of stale) copySkill(src.dir, join(d.home, name));
    emit(`PLACED ${name} -> ${stale.length} home(s) (${destinations.length} checked)`);
  }
  for (const name of summary.removed) emit(`NOTE  ${name} was deleted from the estate; skill homes are copy-only, remove it by hand if wanted`);

  // Law leg: refresh the marked blocks in every adopted law target; report (never write) the
  // home-law files, which the self-edit lock keeps out of reach. Freshness is by content against
  // `uika home regen` (ADR-0051 amendment), not by mtime.
  if (summary.law.length) {
    emit(`law  ${summary.law.join(", ")} changed -> marked blocks in ${adopted.length} adopted target(s)`);
    for (const t of adopted) {
      refreshLaw(root, t.path, apply, (m) => emit(`  ${t.repo}: ${m}`));
      if (apply) summary.repos.push(t.repo);
    }
    for (const t of notAdopted) emit(`NOTE  ${t.repo}: not law-injected (no ${LAW_BEGIN} marker) — run uika deploy adopt "${t.path}" --apply; skipped`);
    if (existsSync(join(root, "estate.json"))) {
      let states = [];
      try { states = homeStates({ root, home: homeDir }); } catch (e) { emit(`  home law: not checked (${String(e.message ?? e).split("\n")[0]})`); }
      for (const st of states) emit(`  home law ${st.id}: ${st.state === "current" ? "current" : `${st.state.toUpperCase()} — review \`uika home regen\`; the owner applies with --apply (--force for edited/unmanaged; self-edit lock)`} (${st.file})`);
    }
  }

  // Render-only legs: name the harnesses to re-render, never apply (ADR-0017).
  if (summary.plugins) {
    const hs = mcpHarnesses(root);
    emit(`plugins  mcp/servers.json changed — render-only (ADR-0017). Re-render the native config for ${hs.length ? hs.join(", ") : "each registered harness"} and apply it yourself (no MCP renderer is bundled in 0.1.0)`);
  }
  if (summary.models) emit("models  providers/registry.json changed — render-only (ADR-0017). Re-render each harness's model config and apply it yourself (no model renderer is bundled in 0.1.0)");

  if (apply) {
    writeLog(root, { ts: new Date().toISOString(), commit: summary.commit, subject: summary.subject, skills: summary.skills.length, removed: summary.removed, law: summary.law, repos: summary.repos, plugins: summary.plugins, models: summary.models, ...(all ? { all: true } : {}) });
  }
  return summary;
}

// --- new-project auto-adoption (ADR-0052) ---

// Pure decision for the hook: adopt only a LOCAL project's first commit. Clones have an origin,
// later commits have a parent, already-adopted repos have the law marker, and scratch/temp repos
// are excluded. Per-repo opt-out: `git config uika.deploy.auto false`.
// A hook's cwd arrives canonical from the OS (macOS: /private/var/...) while the estate and temp
// paths arrive as configured (/var/...), so compare symlink-resolved paths. Missing paths stay as given.
const canon = (p) => { try { return norm(realpathSync(p)); } catch { return norm(p); } };

export function decideAuto({ repo, estate = ESTATE, origin = "", hasParent = false, adopted = false, config = "", env = process.env, temp = tmpdir() }) {
  if (env.UIKA_DEPLOY_NO_AUTO) return false;
  if (!repo) return false;
  const r = canon(repo), e = canon(estate);
  if (r === e || r.startsWith(`${e}/`)) return false;
  if (r.startsWith(canon(temp))) return false;
  if (r.includes("/node_modules/")) return false;
  if (origin) return false;
  if (hasParent) return false;
  if (adopted) return false;
  if (config === "false") return false;
  return true;
}

export function autoAdoptAllowed(repo, { root = ESTATE } = {}) {
  if (tryGit(repo, ["rev-parse", "--is-bare-repository"]) === "true") return false;
  return decideAuto({
    repo,
    estate: root,
    origin: tryGit(repo, ["config", "--get", "remote.origin.url"]),
    hasParent: Boolean(tryGit(repo, ["rev-parse", "--verify", "HEAD^"])),
    adopted: isAdopted(repo),
    config: tryGit(repo, ["config", "--get", "uika.deploy.auto"]),
  });
}

// Adopt a new project into the estate and remember it as a machine-local target. `force` is for
// explicit `uika deploy adopt` runs and tests; the hook uses the guards above.
export async function autoAdopt(repo, { root = ESTATE, quiet = false, force = false } = {}) {
  if (!force && !autoAdoptAllowed(repo, { root })) return null;
  // Fail before touching the target if registration cannot safely read its prior state.
  registerTarget({ repo: basename(repo), path: repo, law: true, skills: true }, root, { write: false });
  const quietLog = quiet ? () => {} : console.log;
  const prev = console.log;
  if (quiet) console.log = () => {};
  try { await adopt({ root, rest: [repo], apply: true, opts: {} }); }
  finally { if (quiet) console.log = prev; }
  try { await docsInit(repo, { apply: true, root, quiet: true }); } catch { /* scaffolding must never break adoption */ }
  const entry = registerTarget({ repo: basename(repo), path: repo, law: true, skills: true }, root);
  writeLog(root, { ts: new Date().toISOString(), autoAdopted: entry.repo, path: entry.path });
  if (quiet) console.error(`uika deploy: new project "${entry.repo}" adopted (law, skills, bridge) — ${entry.path}`);
  else quietLog(`ADOPTED ${entry.repo} -> ${entry.path} (registered as a deploy target)`);
  return entry;
}

// Refresh only the skill copies a repo already carries (never adds skills to a repo that did not
// opt into them) — used for repos under an audience law, e.g. a public repo with its own audience law.
export function syncExistingSkills(root, repo, apply, emit = console.log) {
  const estate = new Map(findSkills(root).map((s) => [s.name, s]));
  let updated = 0, checked = 0;
  for (const rel of LOCAL_HOMES) {
    const home = join(repo, rel);
    if (!existsSync(home)) continue;
    for (const d of readdirSync(home, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      checked++;
      const src = estate.get(d.name);
      if (!src) continue;
      if (skillCurrent(src.dir, join(home, d.name))) continue;
      if (apply) copySkill(src.dir, join(home, d.name));
      updated++;
      emit(`${apply ? "UPDATED" : "would update"} ${join(home, d.name)}`);
    }
  }
  emit(`skills-only: ${updated} ${apply ? "updated" : "to update"}, ${checked} existing copy(ies) checked in ${repo}`);
  return { updated, checked };
}

// `uika deploy adopt <repo>` — one-shot adoption + registration for a repo that already exists.
export async function deployAdopt(target, { apply, skillsOnly = false, root = ESTATE }) {
  const resolved = resolveTarget(root, target);
  const repo = resolved.path; // the repo root the owner named; never walk up into an enclosing repo
  adoptionSkills(root, repo); // Preflight before registering or touching the target.
  const entry = registerTarget({ repo: resolved.name === resolved.path ? basename(repo) : resolved.name, path: repo, law: !skillsOnly, skills: true }, root, { write: apply });
  if (!apply) { console.log(`would register ${entry.repo} -> ${entry.path} (law ${entry.law ? "on" : "off"}, skills on) in data/deploy/targets.json`); }
  else console.log(`REGISTERED ${entry.repo} -> ${entry.path} (law ${entry.law ? "on" : "off"}, skills on)`);
  if (skillsOnly) { syncExistingSkills(root, repo, apply, console.log); return entry; }
  await adopt({ root, rest: [repo], apply, opts: {} });
  await docsInit(repo, { apply, root });
  return entry;
}

// `uika deploy --all` — the retrofit sweep: whole estate library to every target.
export function deployAll({ repo, apply, root = repo, emit = console.log }) {
  const summary = runDeploy({ root, repo, apply, emit, all: true });
  const t = targetsOf(root);
  emit(`targets: ${t.filter((x) => x.source === "manifest").length} manifest + ${t.filter((x) => x.source === "auto").length} auto-adopted`);
  return summary;
}

// --- global git template (new repos pick the hook up without anyone installing it) ---

const templateDir = (root = ESTATE) => join(root, TEMPLATE_REL);
const templateHook = (root = ESTATE) => join(templateDir(root), "hooks", "post-commit");
const globalTemplateDir = (root = ESTATE) => tryGit(root, ["config", "--global", "--get", "init.templateDir"]);

export function autoTemplate(rest = [], { apply, root = ESTATE } = {}) {
  const [sub = "status"] = rest;
  const dir = templateDir(root);
  const hook = templateHook(root);
  const current = globalTemplateDir(root);
  if (sub === "status") {
    console.log(`git init.templateDir: ${current ? `${current}${norm(current) === norm(dir) ? " (uika)" : ""}` : "unset"}`);
    console.log(`template hook:        ${existsSync(hook) ? hook : "missing"}`);
    console.log(`auto targets:         ${readAutoTargets(root).length} registered (${join(root, TARGETS_REL)})`);
    return { current, hook, targets: readAutoTargets(root).length };
  }
  if (sub === "install") {
    console.log(`${apply ? "WROTE" : "would write"} ${hook}`);
    console.log(`${apply ? "SET" : "would set"} git --global init.templateDir = ${dir}`);
    if (!apply) return console.log("dry run; add --apply (affects every repo created from now on)");
    mkdirSync(dirname(hook), { recursive: true });
    writeFileSync(hook, hookBody(root), { mode: 0o755 });
    try { chmodSync(hook, 0o755); } catch { /* windows */ }
    const state = (() => { try { return JSON.parse(readFileSync(join(root, STATE_REL), "utf8")); } catch { return {}; } })();
    const backup = state.gitConfigBackup ?? [];
    if (!backup.some((b) => b.key === "init.templateDir")) backup.push({ key: "init.templateDir", previous: current ?? "" });
    mkdirSync(dirname(join(root, STATE_REL)), { recursive: true });
    writeFileSync(join(root, STATE_REL), JSON.stringify({ ...state, gitConfigBackup: backup }, null, 2) + "\n");
    git(root, ["config", "--global", "init.templateDir", dir]);
  } else if (sub === "uninstall") {
    if (norm(current) !== norm(dir)) return console.log(`git init.templateDir is ${current || "unset"}; not the uika template — left untouched`);
    console.log(`${apply ? "UNSET" : "would unset"} git --global init.templateDir`);
    if (apply) {
      tryGit(root, ["config", "--global", "--unset", "init.templateDir"]);
      console.log(`template left at ${dir} (harmless; new repos will not copy it)`);
    }
  } else throw new Error("usage: deploy auto status | install [--apply] | uninstall [--apply]");
}

// --- hooks ---

// The hook entry point. Never throws, never blocks a commit: skips during git surgery, distributes
// in the estate repo, and adopts a brand-new local project on its first commit (ADR-0052).
export async function hookRun(root = process.cwd(), opts = {}) {
  const est = resolveEstateRoot(opts.estate);
  const note = (entry) => writeLog(est, { ts: new Date().toISOString(), ...entry });
  try {
    if (process.env.UIKA_DEPLOY_DISABLE) return;
    const repo = repoRoot(root);
    if (!repo) return;
    if (canon(repo) !== canon(est)) return autoAdopt(repo, { root: est, quiet: true });
    const state = gitDirs(repo).dir;
    if (GIT_STATE.some((m) => existsSync(join(state, m)))) return note({ skipped: "git state in progress" });
    const files = opts.files ?? changedPaths(repo);
    if (!relevant(classify(files))) return;
    const summary = runDeploy({ root: repo, repo, files, apply: true, emit: () => {}, homes: opts.homes, targets: opts.targets });
    const bits = [];
    if (summary.skills.length) bits.push(`${summary.skills.length} skill(s)`);
    if (summary.repos.length) bits.push(`law in ${summary.repos.length} repo(s)`);
    if (summary.plugins) bits.push("mcp render needed");
    if (summary.models) bits.push("models render needed");
    if (bits.length) console.error(`uika deploy: ${bits.join(", ")} — log: ${LOG_REL}`);
  } catch (e) {
    const msg = String(e?.message ?? e).split("\n")[0];
    note({ error: msg });
    console.error(`uika deploy: failed (${msg}); see ${LOG_REL}`);
  }
}

export function install(repo, { apply, force, root = ESTATE }) {
  const p = hookPath(repo);
  const body = hookBody(root);
  const present = existsSync(p);
  if (present && readFileSync(p, "utf8").includes(MARK)) return console.log(`already installed ${p}`);
  if (present && !force) throw new Error(`foreign post-commit hook at ${p}; --force to replace (it is backed up first)`);
  if (present) {
    const bak = `${p}.bak-${new Date().toISOString().slice(0, 10)}`;
    console.log(`${apply ? "backup" : "would back up"} ${bak}`);
    if (apply) cpSync(p, bak);
  }
  console.log(`${apply ? "INSTALL" : "would install"} ${p}`);
  if (!apply) return console.log("dry run; add --apply");
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body, { mode: 0o755 });
  try { chmodSync(p, 0o755); } catch { /* windows */ }
}

export function uninstall(repo, { apply }) {
  const p = hookPath(repo);
  if (!hookInstalled(repo)) return console.log(`no uika deploy hook at ${p}`);
  console.log(`${apply ? "REMOVE" : "would remove"} ${p}`);
  if (apply) rmSync(p);
}

export async function deploy({ root, rest = [], apply = false, force = false, opts = {} }) {
  const estateRoot = resolveEstateRoot(root);
  const [sub = "status", arg] = rest;
  if (sub === "hook-run") return hookRun(process.cwd(), { estate: estateRoot });
  if (sub === "auto") return autoTemplate(rest.slice(1), { apply, root: estateRoot });
  if (sub === "targets") {
    const list = targetsOf(estateRoot);
    for (const t of list) console.log(`${isAdopted(t.path) ? "adopted" : "raw    "}  ${t.source.padEnd(8)}  law=${t.law ? "on " : "off"}  skills=${t.skills ? "on " : "off"}  ${t.repo.padEnd(14)} ${t.path}`);
    console.log(`${list.length} target(s): ${list.filter((t) => t.source === "manifest").length} manifest, ${list.filter((t) => t.source === "auto").length} auto-adopted`);
    return list;
  }
  if (sub === "adopt") {
    if (!arg) throw new Error("usage: deploy adopt <repo|project> [--skills-only] [--apply]");
    return deployAdopt(arg, { apply, skillsOnly: Boolean(opts["skills-only"]), root: estateRoot });
  }
  if (sub === "forget") {
    if (!arg) throw new Error("usage: deploy forget <repo> [--apply]");
    const n = unregisterTarget(resolve(arg), estateRoot, { write: apply });
    if (!n) return console.log(`not a registered auto target: ${resolve(arg)}`);
    return console.log(apply ? `forgot ${resolve(arg)}` : `would forget ${resolve(arg)}; dry run, add --apply`);
  }
  const repo = repoRoot(process.cwd());
  if (!repo) throw new Error(`not a git repo: ${resolve(process.cwd())}`);
  if (sub === "install") return install(repo, { apply, force, root: estateRoot });
  if (sub === "uninstall") return uninstall(repo, { apply });
  if (sub !== "status") throw new Error("usage: deploy status|targets|adopt <repo>|install|uninstall|auto|hook-run [--all] [--since <rev>] [--apply]");
  if (opts.all) return deployAll({ repo, apply, root: estateRoot });
  const selectedEstate = estateRoot;
  const since = opts.since === undefined ? undefined : String(opts.since);
  const files = changedPaths(repo, since);
  const c = classify(files);
  if (opts.json) {
    return console.log(JSON.stringify({
      estateRoot: selectedEstate, repo, range: since ? `${since}..HEAD` : "HEAD^..HEAD", hook: hookInstalled(repo), changed: files,
      targets: targetsOf(selectedEstate).map((t) => ({ ...t, adopted: isAdopted(t.path) })),
      legs: { skills: [...c.skills].sort(), removed: [...c.removed].sort(), law: [...c.law].sort(), plugins: c.plugins, models: c.models, notes: c.notes, other: c.other },
    }, null, 2));
  }
  console.log(`deploy ${apply ? "APPLY" : "plan"}  ${selectedEstate}`);
  console.log(`  range ${since ? `${since}..HEAD` : "HEAD^..HEAD"}  ·  hook ${hookInstalled(repo) ? "on" : "off"}  ·  ${files.length} changed file(s)  ·  ${targetsOf(selectedEstate).length} target(s)`);
  if (!relevant(c)) return console.log("  nothing to distribute in this range (skills / law / plugin registries untouched)");
  const summary = runDeploy({ root: selectedEstate, repo, files, apply });
  if (!apply) console.log("\ndry run; add --apply to distribute. Install the hook: uika deploy install --apply");
  return summary;
}
