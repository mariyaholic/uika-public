// docs.mjs — `uika docs check|render|init|migrate|version` (ADR-0053).
// The markdown standard: one generated law block + a hand-written project body in AGENTS.md, a
// generated-only CLAUDE.md adapter, and a hand-written README. `check` measures drift without
// writing; `render` regenerates only the marked regions; `init` scaffolds missing files;
// `migrate` repairs the legacy corpus (pasted canon copies, hand-maintained second lawbooks).
import { existsSync, readFileSync, writeFileSync, cpSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { lawBlock, claudeBlock, LAW_BEGIN, LAW_END, CLAUDE_BEGIN, CLAUDE_END, DOCS_VERSION, versionLine, blockHash } from "./adopt.mjs";
import { ESTATE, targetsOf } from "./targets.mjs";

const TEMPLATES = fileURLToPath(new URL("../templates/", import.meta.url));
const SECTIONS = ["What this repo is", "Build / test / run", "Layout", "Conventions", "Gotchas"];
const README_SECTIONS = ["What / why", "Requirements", "Run", "Layout", "Status"];
const VERSION_RE = /<!-- uika:docs (v\d+) · sha256:([0-9a-f]+) -->/;
const LEGACY_RE = /This repo is Uika|Uika estate laws — the canonical source|# Target: ≤200 lines/;
const CLAUDE_HAND_MAX = 15; // lines; beyond this it is a lawbook, not an adapter
const LAW_BUDGET = 200;

const read = (file) => (existsSync(file) ? readFileSync(file, "utf8") : null);
const date = () => new Date().toISOString().slice(0, 10);
const backup = (file) => { const bak = `${file}.bak-${date()}`; cpSync(file, bak); return bak; };
const template = (name, project) => readFileSync(join(TEMPLATES, name), "utf8").replace(/\{project\}/g, project);

export function blockOf(text, begin, end) {
  if (!text) return null;
  const i = text.indexOf(begin);
  if (i === -1) return null;
  const j = text.indexOf(end, i);
  return j === -1 ? null : text.slice(i, j + end.length);
}

export const stripVersion = (block) => block.split(/\r?\n/).filter((l) => !VERSION_RE.test(l)).join("\n");

// current | upgrade (generator-owned older block) | edited (hand-edited after versioning) | missing.
// Pre-version blocks are treated as generator-owned: they were written under "do not edit inside the
// markers", and their old render is reproducible, so an upgrade may replace them (self-heal). After
// the version line exists, a hash mismatch means a hand edit and is never silently replaced.
export function blockState(text, begin, end, expected) {
  const cur = blockOf(text, begin, end);
  if (!cur) return { state: "missing" };
  if (cur === expected) return { state: "current" };
  const v = VERSION_RE.exec(cur);
  if (!v) return { state: "upgrade", from: "unversioned" };
  if (v[1] === DOCS_VERSION && v[2] === blockHash(stripVersion(cur))) return { state: "upgrade", from: v[1] };
  return { state: "edited" };
}

function insertBlock(text, begin, end, expected) {
  const i = text.indexOf(begin), j = text.indexOf(end, i);
  if (i !== -1 && j !== -1) return text.slice(0, i) + expected + text.slice(j + end.length);
  const sep = text.length === 0 ? "" : text.endsWith("\n") ? "\n" : "\n\n";
  return `${text}${sep}${expected}\n`;
}

// Render one marked block into a file. Never clobbers a hand edit unless `force` (backup kept).
export function renderBlock(file, expected, { begin, end, apply, force, log = console.log, label = "" }) {
  const have = read(file);
  const state = blockState(have ?? "", begin, end, expected);
  if (state.state === "current") { log(`keep    ${label}${basename(file)} (current)`); return { ...state, changed: false }; }
  if (state.state === "edited") {
    if (!(force && apply)) { log(`SKIP    ${label}${basename(file)} (edited inside the markers; --force to replace, backup kept)`); return { ...state, changed: false }; }
    const bak = backup(file);
    log(`FORCED  ${label}${basename(file)} (backup ${basename(bak)})`);
    writeFileSync(file, insertBlock(have, begin, end, expected));
    return { state: "forced", changed: true };
  }
  const verb = state.state === "missing" ? "INSERT" : "UPGRADE";
  log(`${apply ? verb : `would ${verb.toLowerCase()}`}  ${label}${basename(file)}${state.from ? ` (from ${state.from})` : ""}`);
  if (apply) writeFileSync(file, insertBlock(have ?? "", begin, end, expected));
  return { ...state, changed: true };
}

function headings(text) {
  return [...text.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((m) => ({ level: m[1].length, title: m[2].trim(), index: m.index }));
}

function titleSet(text) { return new Set(headings(text).map((h) => h.title.toLowerCase().replace(/\s+/g, " "))); }

// Sections of `text` whose heading does not exist in `otherTitles` — used to fold a hand CLAUDE
// lawbook into AGENTS.md without copying the parts both files already share.
export function uniqueSections(text, otherTitles) {
  const hs = headings(text);
  const out = [];
  for (let i = 0; i < hs.length; i++) {
    const h = hs[i];
    const key = h.title.toLowerCase().replace(/\s+/g, " ");
    if (otherTitles.has(key)) continue;
    const body = text.slice(h.index, i + 1 < hs.length ? hs[i + 1].index : text.length).trimEnd();
    out.push(body.replace(/^(#{1,6})\s+/, (m, hashes) => (h.level === 1 ? "## " : `${hashes} `)));
  }
  return out;
}

function ensureH1(text, project) {
  const first = text.replace(/^\uFEFF/, "").trimStart();
  if (first.startsWith("# ")) return text;
  return `# ${project} — agent instructions\n\n${text}`;
}

function missingSections(text) {
  const present = new Set(headings(text).map((h) => h.title.toLowerCase().replace(/\s+/g, " ")));
  return SECTIONS.filter((s) => !present.has(s.toLowerCase().replace(/\s+/g, " ")));
}

function insertBeforeBlock(text, chunk, begin) {
  const i = text.indexOf(begin);
  if (i === -1) return `${text.trimEnd()}\n\n${chunk}\n`;
  return `${text.slice(0, i)}${chunk}\n${text.slice(i)}`;
}

function templateSections(project) { return template("agents-project.md", project); }

function ensureProjectSections(text, project) {
  const missing = missingSections(text);
  if (!missing.length) return { text, added: [] };
  const chunk = missing.map((s) => {
    const line = templateSections(project).split("\n");
    const at = line.findIndex((l) => l.toLowerCase() === `## ${s.toLowerCase()}`);
    if (at === -1) return `## ${s}\n\n_TODO._\n`;
    const end = line.findIndex((l, i) => i > at && /^## /.test(l));
    return line.slice(at, end === -1 ? line.length : end).join("\n").trimEnd();
  }).join("\n\n");
  return { text: insertBeforeBlock(text, `${chunk}\n`, LAW_BEGIN), added: missing };
}

// Scaffold missing files only; never rewrites a project's own prose (migrate does repairs).
export async function docsInit(repo, { apply = false, root = ESTATE, quiet = false } = {}) {
  const log = quiet ? () => {} : console.log;
  const name = basename(repo);
  const actions = [];
  const agents = join(repo, "AGENTS.md");
  const claude = join(repo, "CLAUDE.md");
  const readme = join(repo, "README.md");

  if (!existsSync(agents)) {
    log(`${apply ? "WROTE" : "would write"} ${agents} (project scaffold + law block)`);
    if (apply) writeFileSync(agents, `${templateSections(name).trimEnd()}\n\n${lawBlock(root)}\n`);
    actions.push("agents-created");
  } else {
    const r = renderBlock(agents, lawBlock(root), { begin: LAW_BEGIN, end: LAW_END, apply, log, label: `${name}/` });
    if (r.changed) actions.push("agents-block");
    const text = read(agents);
    if (!text.trimStart().startsWith("# ")) {
      log(`${apply ? "INSERT" : "would insert"} ${agents} (H1)`);
      if (apply) writeFileSync(agents, ensureH1(text, name));
      actions.push("agents-h1");
    }
  }

  if (!existsSync(claude)) {
    log(`${apply ? "WROTE" : "would write"} ${claude} (adapter)`);
    if (apply) writeFileSync(claude, `${claudeBlock()}\n`);
    actions.push("claude-created");
  } else {
    const r = renderBlock(claude, claudeBlock(), { begin: CLAUDE_BEGIN, end: CLAUDE_END, apply, log, label: `${name}/` });
    if (r.changed) actions.push("claude-block");
  }

  if (!existsSync(readme)) {
    log(`${apply ? "WROTE" : "would write"} ${readme} (README skeleton)`);
    if (apply) writeFileSync(readme, template("readme-project.md", name));
    actions.push("readme-created");
  }
  return actions;
}

// One-shot repair of the legacy corpus: strip a pasted canonical law, fold a hand CLAUDE into
// AGENTS.md, then scaffold and seal. Every touched file is backed up inside the repo first.
export async function docsMigrate({ root = ESTATE, repo, apply = false } = {}) {
  const targets = repo ? [{ repo: basename(repo), path: repo }] : targetsOf(root).filter((t) => t.law !== false);
  const report = [];
  for (const t of targets) {
    const name = t.repo;
    const agentsFile = join(t.path, "AGENTS.md");
    const claudeFile = join(t.path, "CLAUDE.md");
    if (!existsSync(agentsFile) && !existsSync(claudeFile)) { report.push({ repo: name, actions: ["skipped (no law files)"] }); continue; }
    const actions = [];

    // 1. Pasted canonical law above the block → replace with the project scaffold.
    let text = read(agentsFile) ?? "";
    const block = blockOf(text, LAW_BEGIN, LAW_END);
    const prefix = block ? text.slice(0, text.indexOf(block)) : text;
    if (block && LEGACY_RE.test(prefix)) {
      const bak = apply ? backup(agentsFile) : `${agentsFile}.bak-${date()}`;
      actions.push(`removed pasted Uika canon (${prefix.split(/\r?\n/).filter(Boolean).length} lines; backup ${basename(bak)})`);
      if (apply) {
        text = `${templateSections(name).trimEnd()}\n\n${block}\n`;
        writeFileSync(agentsFile, text);
      } else text = `${templateSections(name).trimEnd()}\n\n${block}\n`;
    }

    // 2. Fold a hand CLAUDE lawbook into AGENTS.md, then collapse CLAUDE to the adapter.
    const claudeText = read(claudeFile);
    if (claudeText) {
      const claudeHand = claudeText.split(/\r?\n/).length > CLAUDE_HAND_MAX;
      if (claudeHand) {
        const stripped = claudeText.replace(blockOf(claudeText, CLAUDE_BEGIN, CLAUDE_END) ?? "", "");
        const unique = uniqueSections(stripped, titleSet(text));
        if (unique.length) {
          const chunk = `<!-- migrated from CLAUDE.md on ${date()} by uika docs migrate (ADR-0053) -->\n\n${unique.join("\n\n")}\n`;
          const bak = apply ? backup(claudeFile) : `${claudeFile}.bak-${date()}`;
          actions.push(`folded ${unique.length} CLAUDE-only section(s) into AGENTS.md (backup ${basename(bak)})`);
          if (apply) { writeFileSync(claudeFile, `${claudeBlock()}\n`); text = insertBeforeBlock(text, chunk, LAW_BEGIN); writeFileSync(agentsFile, text); }
        } else if (apply) {
          backup(claudeFile);
          writeFileSync(claudeFile, `${claudeBlock()}\n`);
          actions.push("collapsed hand CLAUDE.md to the adapter");
        }
      }
    }

    // 3. Estate-managed header + project sections. Placeholder sections are only injected into a
    // block-only file: a hand lawbook with its own headings keeps its structure (check reports gaps).
    const current = apply ? (read(agentsFile) ?? text) : text;
    const hasOwnHeadings = headings(current).some((h) => h.level > 1 && !/Uika estate law/i.test(h.title));
    const ensured = hasOwnHeadings ? { text: ensureH1(current, name), added: [] } : ensureProjectSections(ensureH1(current, name), name);
    if (ensured.added.length) {
      actions.push(`added project section placeholder(s): ${ensured.added.join(", ")}`);
      if (apply) writeFileSync(agentsFile, ensured.text);
    } else if (ensured.text !== current && apply) writeFileSync(agentsFile, ensured.text);

    // 4. Scaffold the remaining gaps and seal the law block.
    const initActions = await docsInit(t.path, { apply, root, quiet: true });
    actions.push(...initActions.filter((a) => a !== "agents-created" && a !== "claude-created"));
    report.push({ repo: name, actions: actions.length ? actions : ["current"] });
  }
  for (const r of report) console.log(`${r.actions[0] === "current" ? "ok  " : "MIGRATE"} ${r.repo}: ${r.actions.join("; ")}`);
  if (!apply) console.log("\ndry run; add --apply to migrate (per-file .bak-<date> backups are kept inside each repo)");
  return report;
}

// --- checks ---

function gitTracked(repo, file) {
  try { execFileSync("git", ["-C", repo, "ls-files", "--error-unmatch", "--", file], { stdio: ["ignore", "ignore", "ignore"] }); return true; } catch { return false; }
}

function linkFindings(repo, text) {
  const out = [];
  for (const m of text.matchAll(/\]\((?!https?:|#|mailto:)([^)\s]+)\)/g)) {
    const target = m[1].split("#")[0].trim();
    if (!target || /^[a-z]+:/i.test(target)) continue;
    if (!existsSync(resolve(repo, target))) out.push(target);
  }
  return out;
}

export function checkRepo(root, path, { repo = basename(path), source = false } = {}) {
  const findings = [];
  const warn = (file, code, message) => findings.push({ repo, file, level: "warn", code, message });
  const info = (file, code, message) => findings.push({ repo, file, level: "info", code, message });

  const agents = read(join(path, "AGENTS.md"));
  const claude = read(join(path, "CLAUDE.md"));
  const readme = read(join(path, "README.md"));

  if (!agents) warn("AGENTS.md", "missing", "no AGENTS.md");
  else {
    const block = blockOf(agents, LAW_BEGIN, LAW_END);
    if (block) {
      const st = blockState(agents, LAW_BEGIN, LAW_END, lawBlock(root));
      if (st.state === "upgrade") warn("AGENTS.md", "stale-block", `law block is ${st.from}, run: uika docs render`);
      if (st.state === "edited") warn("AGENTS.md", "edited-block", "law block was hand-edited inside the markers");
      const prefix = agents.slice(0, agents.indexOf(block));
      if (LEGACY_RE.test(prefix)) warn("AGENTS.md", "legacy-copy", "pasted Uika canon above the block; run: uika docs migrate");
      if ((agents.match(/Uika estate law/g) || []).length > 1) warn("AGENTS.md", "duplicate-law", "estate law appears more than once");
    } else if (!source) warn("AGENTS.md", "no-block", "no uika:law block");
    if (!agents.trimStart().startsWith("# ")) warn("AGENTS.md", "no-h1", "no H1 heading (estate-managed header)");
    if (!source) {
      const missing = missingSections(agents);
      if (missing.length) info("AGENTS.md", "no-project-sections", `missing project section(s): ${missing.join(", ")}`);
    }
    const blockLines = block ? block.split(/\r?\n/).length : 0;
    if (agents.split(/\r?\n/).length > LAW_BUDGET) warn("AGENTS.md", "budget", `${agents.split(/\r?\n/).length} lines > ${LAW_BUDGET}`);
    if (blockLines > 40) warn("AGENTS.md", "block-budget", `law block ${blockLines} lines > 40`);
    if (!source && !gitTracked(path, "AGENTS.md")) warn("AGENTS.md", "untracked", "AGENTS.md is untracked — adoption is not committed");
  }

  if (!source) {
    if (!claude) warn("CLAUDE.md", "missing", "no CLAUDE.md adapter");
    else {
      const lines = claude.split(/\r?\n/).length;
      if (lines > CLAUDE_HAND_MAX) warn("CLAUDE.md", "hand-maintained", `${lines} lines: CLAUDE.md must stay a generated adapter (fold rules into AGENTS.md)`);
      if (!claude.includes("@AGENTS.md")) warn("CLAUDE.md", "no-import", "CLAUDE.md does not import @AGENTS.md");
      const st = blockState(claude, CLAUDE_BEGIN, CLAUDE_END, claudeBlock());
      if (st.state === "edited") warn("CLAUDE.md", "edited-block", "adapter block was hand-edited");
      if (st.state === "upgrade") warn("CLAUDE.md", "stale-block", `adapter block is ${st.from}, run: uika docs render`);
      if (!gitTracked(path, "CLAUDE.md")) warn("CLAUDE.md", "untracked", "CLAUDE.md is untracked");
    }
  }

  if (!readme) warn("README.md", "missing", "no README.md");
  else {
    // A YAML front-matter block is allowed before the H1 (pot-bench uses one).
    const readmeBody = readme.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
    if (!readmeBody.trimStart().startsWith("# ")) warn("README.md", "no-h1", "no H1 heading");
    const broken = linkFindings(path, readme);
    if (broken.length) warn("README.md", "broken-links", `link target(s) missing: ${broken.join(", ")}`);
    const present = new Set(headings(readme).map((h) => h.title.toLowerCase()));
    const missing = README_SECTIONS.filter((s) => !present.has(s.toLowerCase()));
    if (missing.length === README_SECTIONS.length) info("README.md", "no-standard-sections", "README has none of the standard sections");
    else if (missing.length) info("README.md", "partial-sections", `missing README section(s): ${missing.join(", ")}`);
    if (/TODO/.test(readme)) info("README.md", "placeholder", "README still has TODO placeholders");
    const claims = [...readme.matchAll(/(\d+)\s+(?:coding\s+)?harnesses/gi)].map((m) => Number(m[1]));
    if (claims.some((n) => n !== 10)) warn("README.md", "stale-claim", `harness count claim ${claims.join("/")} != 10`);
    if (!gitTracked(path, "README.md")) info("README.md", "untracked", "README.md is untracked");
  }
  return findings;
}

export function docsCheck({ root = ESTATE, repo, json = false, strict = false, silent = false } = {}) {
  const raw = repo ? [{ repo: basename(repo), path: repo, source: false }] : [...targetsOf(root).filter((t) => t.law !== false).map((t) => ({ repo: t.repo, path: t.path, source: false })), { repo: "Uika", path: root, source: true }];
  // Two repos can share a basename (e.g. a desktop checkout and a second-drive mirror): disambiguate the display label.
  const counts = raw.reduce((m, t) => m.set(t.repo, (m.get(t.repo) ?? 0) + 1), new Map());
  const targets = raw.map((t) => ({ ...t, repo: counts.get(t.repo) > 1 ? `${t.repo} (${t.path})` : t.repo }));
  const findings = targets.flatMap((t) => checkRepo(root, t.path, { repo: t.repo, source: t.source }));
  if (silent) return findings;
  if (json) { console.log(JSON.stringify({ targets: targets.map((t) => ({ repo: t.repo, path: t.path })), findings }, null, 2)); return findings; }
  console.log(`docs check  ${root}`);
  for (const t of targets) {
    const own = findings.filter((f) => f.repo === t.repo);
    const bad = own.filter((f) => f.level === "warn").length;
    console.log(`  ${bad ? "WARN" : "ok  "}  ${t.repo.padEnd(14)} ${bad ? `${bad} issue(s)` : "clean"}${t.source ? "  (source)" : ""}`);
    for (const f of own) console.log(`        ${f.level === "warn" ? "!" : "·"} ${f.file}: ${f.message}`);
  }
  const warns = findings.filter((f) => f.level === "warn").length;
  console.log(`\n${targets.length} target(s) · ${warns} warning(s) · ${findings.length - warns} note(s)`);
  if (strict && warns) throw new Error(`docs: ${warns} standard warning(s)`);
  return findings;
}

export function docsRender({ root = ESTATE, repo, apply = false, force = false } = {}) {
  const targets = repo ? [{ repo: basename(repo), path: repo }] : targetsOf(root).filter((t) => t.law !== false);
  console.log(`docs render ${apply ? "APPLY" : "plan"}  ${root}`);
  let changed = 0;
  for (const t of targets) {
    const r1 = renderBlock(join(t.path, "AGENTS.md"), lawBlock(root), { begin: LAW_BEGIN, end: LAW_END, apply, force, label: `${t.repo}/` });
    const r2 = renderBlock(join(t.path, "CLAUDE.md"), claudeBlock(), { begin: CLAUDE_BEGIN, end: CLAUDE_END, apply, force, label: `${t.repo}/` });
    if (r1.changed) changed++;
    if (r2.changed) changed++;
  }
  console.log(`\n${changed ? `${apply ? "updated" : "would update"} ${changed} block(s)` : "all blocks current"}`);
  if (!apply && changed) console.log("dry run; add --apply");
  return { targets: targets.length, changed };
}

export function docsVersion({ root = ESTATE, repo } = {}) {
  const expected = lawBlock(root);
  const hash = blockHash(stripVersion(expected));
  console.log(`docs ${DOCS_VERSION} · law block sha256:${hash} · ${expected.split(/\r?\n/).length} lines`);
  for (const t of repo ? [{ repo: basename(repo), path: repo }] : targetsOf(root).filter((t) => t.law !== false)) {
    const text = read(join(t.path, "AGENTS.md")) ?? "";
    const st = blockState(text, LAW_BEGIN, LAW_END, expected);
    console.log(`  ${st.state.padEnd(9)} ${t.repo}`);
  }
}

export async function docs({ root, rest = [], apply = false, force = false, opts = {} }) {
  const [sub = "check", arg] = rest;
  if (sub === "check") return docsCheck({ root, repo: arg ? resolve(arg) : undefined, json: Boolean(opts.json), strict: Boolean(opts.strict) });
  if (sub === "render") return docsRender({ root, repo: arg ? resolve(arg) : undefined, apply, force });
  if (sub === "init") { if (!arg) throw new Error("usage: docs init <repo> [--apply]"); return docsInit(resolve(arg), { apply, root }); }
  if (sub === "migrate") return docsMigrate({ root, repo: arg ? resolve(arg) : undefined, apply });
  if (sub === "version") return docsVersion({ root, repo: arg ? resolve(arg) : undefined });
  throw new Error("usage: docs check [repo|--json|--strict] | render [repo] [--apply] | init <repo> [--apply] | migrate [repo] [--apply] | version");
}
