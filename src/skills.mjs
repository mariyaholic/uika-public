// skills.mjs — `uika skills validate|place` and `uika audit <repo>` (ADR-0015)
import { readdirSync, readFileSync, existsSync, cpSync, lstatSync } from "node:fs";
import { join, dirname, extname, resolve } from "node:path";
import { homedir } from "node:os";

const DEFAULT_HOMES = [".claude/skills", ".codex/skills", ".agents/skills", ".config/opencode/skills", ".gemini/skills", ".gemini/antigravity/skills", ".gemini/antigravity-ide/skills"]
  .map((p) => join(homedir(), p));

// Source of truth is estate.skills.homes (ADR-0015); fall back to the historical list.
export function skillHomes(root) {
  const file = join(root, "estate.json");
  if (!existsSync(file)) return DEFAULT_HOMES;
  let manifest;
  try { manifest = JSON.parse(readFileSync(file, "utf8")); }
  catch (error) { throw new Error(`estate.json: cannot read skill homes (${error.message})`); }
  const homes = manifest?.estate?.skills?.homes;
  if (homes === undefined) return DEFAULT_HOMES;
  if (!Array.isArray(homes) || homes.some((p) => typeof p !== "string" || !p.trim())) throw new Error("estate.json: skills.homes must be an array of non-empty paths");
  return homes.map((p) => resolve(homedir(), p.replace(/^~[\\/]/, "")));
}

export function findSkills(root) {
  const out = [];
  for (const base of ["skills", "skills/vendor"]) {
    const dir = join(root, base);
    if (!existsSync(dir)) continue;
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      if (d.isDirectory() && existsSync(join(dir, d.name, "SKILL.md"))) out.push({ name: d.name, dir: join(dir, d.name) });
    }
  }
  const seen = new Set();
  for (const s of out) {
    if (seen.has(s.name)) throw new Error(`duplicate skill name "${s.name}" in skills and skills/vendor`);
    seen.add(s.name);
  }
  return out;
}

// Copy-only distribution compares every source file, including helper scripts and playbooks.
// Extra destination files stay owner-managed. Links within either tree are never followed.
export function skillCurrent(source, destination) {
  const from = lstatSync(source);
  const to = lstatSync(destination, { throwIfNoEntry: false });
  if (from.isSymbolicLink() || (!from.isDirectory() && !from.isFile())) throw new Error(`unsupported skill entry: ${source}`);
  if (to?.isSymbolicLink()) throw new Error(`unsafe skill destination link: ${destination}`);
  if (from.isDirectory()) {
    if (to && !to.isDirectory()) throw new Error(`skill destination is not a directory: ${destination}`);
    let current = Boolean(to);
    for (const name of readdirSync(source)) if (!skillCurrent(join(source, name), join(destination, name))) current = false;
    return current;
  }
  if (to && !to.isFile()) throw new Error(`skill destination is not a file: ${destination}`);
  return Boolean(to) && readFileSync(source).equals(readFileSync(destination));
}

export function copySkill(source, destination) {
  skillCurrent(source, destination); // Validate the entire copy before writing any file.
  cpSync(source, destination, { recursive: true, force: true });
}

export function frontmatter(dir) {
  const m = readFileSync(join(dir, "SKILL.md"), "utf8").replace(/^﻿/, "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = {};
  const unsafe = [];
  if (m) for (const l of m[1].split(/\r?\n/)) {
    const k = l.match(/^([\w-]+):\s*(.*)$/); if (!k) continue;
    fm[k[1]] = k[2].replace(/^["']|["']$/g, "");
    // an unquoted YAML scalar may not contain ": " or " #"; harnesses then drop the whole frontmatter
    if (!/^["'|>]/.test(k[2]) && /: | #/.test(k[2])) unsafe.push(k[1]);
  }
  Object.defineProperty(fm, "unsafe", { value: unsafe });
  return fm;
}

// Stable warning codes live in src/validate-codes.json; the messages keep their historical text.
export const VALIDATE_CODES = JSON.parse(readFileSync(new URL("./validate-codes.json", import.meta.url), "utf8")).skills;

export function skillFindings(s) {
  const fm = frontmatter(s.dir);
  const f = [];
  const add = (code, message) => f.push({ code, severity: VALIDATE_CODES[code]?.severity ?? "warn", message });
  if (fm.name !== s.name) add("SKV001", `name "${fm.name}" != directory`);
  for (const k of fm.unsafe) add("SKV002", `${k}: unquoted value contains ": " or " #" (invalid YAML; quote it)`);
  if (!fm.description) add("SKV003", "no description");
  else if (fm.description.length > 1024) add("SKV004", `description ${fm.description.length} chars (> 1024)`);
  return f;
}

export function skillProblems(s) {
  return skillFindings(s).map((x) => `${x.code} ${x.message}`);
}

export async function skills({ root, rest, apply, opts = {} }) {
  const [sub = "validate", only] = rest;
  const all = findSkills(root).filter((s) => !only || s.name === only);
  if (only && !all.length) throw new Error(`unknown skill "${only}" (run: uika skills validate)`);
  if (["validate", "place"].includes(sub) && !all.length) {
    const message = "no skills found in the selected estate's skills/ directory; select and copy a library first";
    if (opts.strict || sub === "place") throw new Error(message);
    console.log(`skills: ${message}`);
    return;
  }
  if (sub === "validate") {
    let bad = 0;
    for (const s of all) for (const x of skillFindings(s)) { bad++; console.log(`${x.severity === "error" ? "ERROR" : "WARN "} ${x.code}  ${s.name}: ${x.message}`); }
    console.log(bad ? `skills: ${bad} problem(s) in ${all.length}` : `skills: ${all.length} valid`);
    if (bad && opts.strict) throw new Error(`skills validation failed: ${bad} problem(s)`);
  } else if (sub === "place") {
    const invalid = all.flatMap((s) => skillProblems(s).map((problem) => `${s.name}: ${problem}`));
    if (invalid.length) throw new Error(`cannot place invalid skills: ${invalid.join("; ")}`);
    const homes = skillHomes(root).filter((h) => existsSync(dirname(h)));
    if (!homes.length) throw new Error("no configured skill homes have an existing parent directory");
    for (const h of homes) for (const s of all) skillCurrent(s.dir, join(h, s.name));
    for (const h of homes) {
      for (const s of all) if (apply) copySkill(s.dir, join(h, s.name));
      console.log(`${apply ? "PLACED" : "would place"} ${all.length} skills -> ${h}`);
    }
    if (!apply) console.log("dry run; add --apply to copy");
  } else throw new Error("usage: skills validate|place [name] [--apply]");
}

const VARIANT = /(_v\d+|_retry|_\d+passes|_remaining|_missing|_final|_tmp|_old|_new|_backup|_failure_stories|_copy)+$/;

export async function audit({ root, rest }) {
  const dir = join(rest[0] ?? root, "tools");
  if (!existsSync(dir)) throw new Error(`no tools/ in ${rest[0] ?? root}`);
  const files = readdirSync(dir).filter((f) => /\.(py|ps1|sh|mjs|js)$/.test(f));
  const groups = {};
  const variants = [];
  for (const f of files) {
    const stem = f.slice(0, -extname(f).length);
    if (VARIANT.test(stem)) variants.push(f);
    (groups[stem.replace(VARIANT, "")] ??= []).push(f);
  }
  const clusters = Object.entries(groups).filter(([, v]) => v.length > 1);
  console.log(`${files.length} scripts in ${dir}: ${variants.length} variant-suffixed, ${clusters.length} clusters, ${existsSync(join(dir, "REGISTRY.md")) ? "REGISTRY.md present" : "no REGISTRY.md"}`);
  for (const [s, v] of clusters) console.log(`  cluster ${s}: ${v.join(", ")}`);
  const lone = variants.filter((f) => !clusters.some(([, v]) => v.includes(f)));
  if (lone.length) console.log(`  variant-named, no base: ${lone.join(", ")}`);
}
