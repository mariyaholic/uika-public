// lint.mjs — warn-only context-budget linter (ADR-0004 #3)
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { findSkills, skillProblems } from "./skills.mjs";
import { RANK } from "./supply.mjs";
import { docsCheck } from "./docs.mjs";
import { loadLibrary, refProblems } from "./ref.mjs";

const ALWAYS_LOADED_LIMIT = 200; // lines (warn)
const CODEX_CAP_BYTES = 32 * 1024; // ADR-0002: project_doc_max_bytes default
const FINGERPRINT = "uika:generated";

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (e === "node_modules" || e === ".git" || e === ".venv") continue;
    const p = join(dir, e);
    const st = statSync(p, { throwIfNoEntry: false });
    if (!st) continue;
    if (st.isDirectory()) walk(p, out);
    else if (/(AGENTS\.md|CLAUDE\.md|CLAUDE\.local\.md|\.rules?\.md|rules\.md)$/i.test(e) || p.includes(".claude") && e.endsWith(".md")) out.push(p);
  }
  return out;
}

export const HANDLE = /^(claude|codex|opencode|cline|gemini|commandcode|dsh|freebuff|mimo|hermes)\.(tower|scout|impl|review|judge)(#\d+)?$/;
export const BRANCH = /^(main|(feat|fix|docs|chore)\/[a-z0-9]+(-[a-z0-9]+){0,3})$/;
const LAW_BEGIN = "<!-- uika:law:begin -->";
const LAW_END = "<!-- uika:law:end -->";
const exists = (p) => existsSync(p) || (existsSync(dirname(p)) && readdirSync(dirname(p)).some((f) => f.startsWith(basename(p)))); // ADR-0011 -> ADR-0011-*.md
const read = (root, f) => { try { return readFileSync(join(root, f), "utf8"); } catch { return ""; } };

// Doc-drift + ADR-0014 naming checks (warnings; fatal only under --strict).
function drift(root, warn) {
  // eval README checklist vs task files; vs WORKSTACK's claim
  const tdir = join(root, "labs/eval/tasks");
  const tasks = existsSync(tdir) ? readdirSync(tdir).filter((f) => /^task-\d+/.test(f)).length : 0;
  const readme = read(root, "labs/eval/README.md");
  const done = (readme.match(/^- \[x\] task-/gim) || []).length;
  const open = (readme.match(/^- \[ \] task-/gim) || []).length;
  if (done + open && done + open !== tasks) warn(`labs/eval/README.md: ${done + open} checklist tasks vs ${tasks} task files`);
  if (open && /20\/20/.test(read(root, "WORKSTACK.md"))) warn(`labs/eval/README.md: ${open} unchecked task(s) but WORKSTACK claims 20/20`);

  // estate.json: dangling paths, stale status
  const est = read(root, "estate.json");
  for (const m of new Set(est.match(/(?:register|labs|design|tool|skills)\/[\w./-]+/g) || [])) {
    if (!exists(join(root, m.replace(/\/$/, "")))) warn(`estate.json: path "${m}" does not exist`);
  }
  if (/"observability"[^}]*"planned"/.test(est) && existsSync(join(root, "tool/observatory.html"))) warn('estate.json: observability is "planned" but tool/observatory.html exists');

  // ADR-0015/0017: skill frontmatter; registries must hold env-var names, never secret-shaped values
  for (const s of findSkills(root)) for (const p of skillProblems(s)) warn(`skill ${s.name}: ${p}`);
  for (const f of ["mcp/servers.json", "providers/registry.json"]) {
    if (/\b(sk-|cc_|ghp_|AKIA)[\w-]{16,}|"(api)?key"\s*:\s*"[^"]{12,}"/i.test(read(root, f))) warn(`${f}: secret-shaped value; registries may hold env var NAMES only`);
  }

  // ADR-0019/0020: registered project paths exist; persona files carry a valid confidence label
  try {
    for (const [k, p] of Object.entries(JSON.parse(read(root, "projects/registry.json") || "{}").projects ?? {})) {
      for (const path of p.paths) if (!existsSync(path)) warn(`projects/registry.json: ${k} path "${path}" does not exist`);
    }
  } catch { warn("projects/registry.json: unreadable"); }
  const pdir = join(root, "register/personas");
  if (existsSync(pdir)) for (const f of readdirSync(pdir).filter((x) => x.endsWith(".md") && x !== "README.md")) {
    if (!/^confidence: (grounded|provisional|unprofiled)$/m.test(read(root, `register/personas/${f}`))) warn(`register/personas/${f}: missing/invalid confidence label`);
  }

  // ADR-0033: adopted repos declare a distribution target whose path exists and carries the law block
  try {
    for (const t of JSON.parse(read(root, "estate.json") || "{}").estate?.distribution?.targets ?? []) {
      if (t.path && !existsSync(t.path)) { warn(`estate.json: distribution target "${t.repo}" path does not exist: ${t.path}`); continue; }
      if (t.path && t.synced) {
        let agents = "";
        try { agents = readFileSync(join(t.path, "AGENTS.md"), "utf8"); } catch { /* no lawbook */ }
        if (agents && (!agents.includes(LAW_BEGIN) || !agents.includes(FINGERPRINT))) warn(`distribution target "${t.repo}": AGENTS.md lacks the uika:law block (run: uika adopt ${t.repo} --apply)`);
      }
    }
  } catch { warn("estate.json: distribution.targets unreadable"); }

  // ADR-0021: catalog sanity + audience law
  try {
    const projs = JSON.parse(read(root, "projects/registry.json")).projects;
    for (const a of JSON.parse(read(root, "supply/catalog.json") || '{"assets":[]}').assets) {
      if (!(a.audience in RANK)) warn(`supply/catalog.json: ${a.id} has invalid audience "${a.audience}"`);
      if (a.status === "supplied" && !a.store && !existsSync(a.source)) warn(`supply/catalog.json: supplied asset ${a.id} source missing`);
      for (const c of a.consumers ?? []) if (RANK[a.audience] > RANK[projs[c]?.audience ?? "client-safe"]) warn(`supply/catalog.json: ${a.audience} asset ${a.id} consumed by lower-audience repo ${c}`);
    }
  } catch { /* no catalog yet */ }

  // ADR-0054: reference library entries resolve; content hashes are skipped here (lint stays cheap)
  try {
    const lib = loadLibrary(root);
    for (const p of refProblems(root, lib, { hash: false })) if (p.level === "fail") warn(`references/library.json: ${p.id} — ${p.message}`);
  } catch { /* no library registry yet */ }

  // ADR-0014 naming: branch shape, handoff handles, model/version slugs in thread titles
  try {
    const out = execFileSync("git", ["-C", root, "for-each-ref", "--format=%(refname:short)", "refs/heads"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    for (const b of out.split("\n").filter(Boolean)) if (!BRANCH.test(b)) warn(`branch "${b}" breaks ADR-0014 (<feat|fix|docs|chore>/<up-to-4-word-kebab>)`);
  } catch { /* not a git repo */ }
  let inMigrated = false;
  for (const line of read(root, "WORKSTACK.md").split(/\r?\n/)) {
    if (/<!--\s*uika:migrated\s*-->/.test(line)) inMigrated = true;
    if (inMigrated) continue; // grandfathered migrated history (ADR-0033)
    const h = line.match(/^From→To:\s*(\S+)\s*→\s*(\S+)/);
    if (h) for (const x of h.slice(1)) if (!HANDLE.test(x)) warn(`WORKSTACK.md: handle "${x}" is not <harness>.<role>`);
    if (/^- \[(open|done)\]/.test(line) && /\b(opus|sonnet|haiku|fable|deepseek|gpt)[-\s]?\d/i.test(line.split("→")[0])) warn(`WORKSTACK.md: model/version in thread title: ${line.slice(0, 60)}`);
  }
}

// Plain `lint` is advisory: it prints warnings and succeeds. `lint --strict` throws after
// printing when any warning exists, so the dispatcher exits 1 (CI gate).
export async function lint({ root, opts = {} }) {
  const warnings = [];
  const candidates = walk(root).filter((f) => !f.includes("attic"));
  for (const file of candidates) {
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/).length;
    const bytes = Buffer.byteLength(text, "utf8");
    if (lines > ALWAYS_LOADED_LIMIT && !/WORKSTACK|LEARNINGS|README/.test(file)) {
      warnings.push(`${file}: ${lines} lines (> ${ALWAYS_LOADED_LIMIT} always-loaded budget)`);
    }
    if (bytes > CODEX_CAP_BYTES && /(AGENTS|CLAUDE)/i.test(file)) {
      warnings.push(`${file}: ${bytes} bytes exceeds Codex 32KiB project_doc cap`);
    }
    if (text.includes(FINGERPRINT) && !existsSync(join(root, ".sync-ok"))) {
      warnings.push(`${file}: generated content may have drifted (re-sync to refresh)`);
    }
  }
  drift(root, (w) => warnings.push(w));
  // ADR-0053: the docs standard is checked across every registered distribution target, not only
  // in the estate root (this is where the 14-repo corpus drift becomes visible).
  try {
    for (const f of docsCheck({ root, silent: true }).filter((x) => x.level === "warn")) warnings.push(`docs ${f.repo}: ${f.file}: ${f.message}`);
  } catch { warnings.push("docs: check failed"); }
  if (warnings.length === 0) console.log("lint: clean");
  else for (const w of warnings) console.log(`WARN  ${w}`);
  if (opts.strict && warnings.length) throw new Error(`--strict: ${warnings.length} warning(s)`);
  return warnings;
}
