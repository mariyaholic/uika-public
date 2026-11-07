// targets.mjs — the distribution target registry (ADR-0033/0052).
// The owner-curated `estate.json` `distribution.targets` list plus the machine-local repos that
// auto-adoption registered in `data/deploy/targets.json`. Manifest entries win on a path collision.
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, statSync, chmodSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join, resolve, dirname, basename } from "node:path";

// One root contract for the public CLI and its helpers: explicit --root, environment, then cwd.
export function resolveEstateRoot(root, { env = process.env, cwd = process.cwd() } = {}) {
  return resolve(root ?? env.UIKA_ESTATE_HOME ?? cwd);
}

export const ESTATE = resolveEstateRoot();
export const TARGETS_REL = join("data", "deploy", "targets.json");
export const norm = (p) => {
  const path = resolve(p).replace(/\\/g, "/").replace(/\/+$/, "");
  return process.platform === "win32" ? path.toLowerCase() : path;
};

function validateTargets(list, label) {
  if (!Array.isArray(list) || list.some((t) => !t || typeof t !== "object" || typeof t.path !== "string" || !t.path.trim())) throw new Error(`${label}: targets must be an array of objects with non-empty paths`);
  return list;
}

export function readAutoTargets(root = ESTATE) {
  const file = join(root, TARGETS_REL);
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return validateTargets(parsed?.targets, TARGETS_REL);
  } catch (error) { throw new Error(`${TARGETS_REL}: cannot read registry (${error.message}); repair it before changing targets`); }
}

export function writeAutoTargets(list, root = ESTATE) {
  validateTargets(list, TARGETS_REL);
  const file = join(root, TARGETS_REL), temporary = `${file}.${randomUUID()}.tmp`;
  const previous = statSync(file, { throwIfNoEntry: false });
  const mode = previous ? previous.mode & 0o777 : 0o600;
  mkdirSync(dirname(file), { recursive: true });
  try {
    writeFileSync(temporary, JSON.stringify({ _note: "Machine-local repos auto-adopted by uika deploy (ADR-0052). The estate.json distribution.targets list stays the owner's.", targets: list }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    chmodSync(temporary, mode);
    renameSync(temporary, file);
  } finally { rmSync(temporary, { force: true }); }
}

// Merge-manifest-by-path into the machine-local auto-target list. Re-registering one path updates
// its flags without duplicating it; the original `added` date is kept.
// `write: false` plans the entry without touching data/deploy/targets.json (dry runs).
export function registerTarget(entry, root = ESTATE, { write = true } = {}) {
  const list = readAutoTargets(root);
  const key = norm(entry.path);
  const next = { repo: entry.repo ?? basename(entry.path), path: String(entry.path).replace(/\\/g, "/"), law: entry.law !== false, skills: entry.skills !== false, added: new Date().toISOString().slice(0, 10) };
  const i = list.findIndex((t) => norm(t.path) === key);
  if (i === -1) list.push(next);
  else list[i] = { ...list[i], ...next, added: list[i].added ?? next.added };
  if (write) writeAutoTargets(list, root);
  return next;
}

export function unregisterTarget(path, root = ESTATE, { write = true } = {}) {
  const list = readAutoTargets(root);
  const kept = list.filter((t) => norm(t.path) !== norm(path));
  if (write && kept.length !== list.length) writeAutoTargets(kept, root);
  return list.length - kept.length;
}

// Manifest targets first (they win on a path collision), then auto-adopted ones, existing only.
export function targetsOf(root) {
  const out = [];
  if (existsSync(join(root, "estate.json"))) {
    const est = JSON.parse(readFileSync(join(root, "estate.json"), "utf8"));
    for (const t of validateTargets(est?.estate?.distribution?.targets ?? [], "estate.json")) out.push({ repo: t.repo, path: resolve(root, t.path), law: true, skills: true, source: "manifest" });
  }
  for (const t of readAutoTargets(root)) out.push({ repo: t.repo, path: t.path, law: t.law !== false, skills: t.skills !== false, source: "auto" });
  const seen = new Set(), unique = [];
  for (const t of out) {
    if (!t.path || !existsSync(t.path)) continue;
    const key = norm(t.path);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(t);
  }
  return unique;
}

// A target counts as law-injected only if its AGENTS.md already carries the estate law marker.
export const isAdopted = (dir) => { const f = join(dir, "AGENTS.md"); return existsSync(f) && readFileSync(f, "utf8").includes("<!-- uika:law:begin -->"); };
export const adoptedTargets = (targets) => targets.filter((t) => isAdopted(t.path));
