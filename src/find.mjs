// find.mjs — `uika find` / `uika where`: resolve fuzzy references (project names, "recent", dates) to files in one call (ADR-0019)
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
import { join } from "node:path";

const SKIP = new Set(["node_modules", ".git", "__pycache__", ".venv", "venv", "unsloth_compiled_cache", "dist", ".next", "target", ".cache", "worktrees", ".playwright-mcp", "$RECYCLE.BIN", "System Volume Information", ".dsh_tmp"]);
const DAY = 864e5;
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const names = (k, p) => [k, ...(p.aliases ?? [])].map(norm);

export const loadProjects = (root) => JSON.parse(readFileSync(join(root, "projects/registry.json"), "utf8").replace(/^﻿/, "")).projects;

export function resolveProject(root, q) {
  const n = norm(q), all = Object.entries(loadProjects(root));
  const exact = all.filter(([k, p]) => names(k, p).includes(n));
  return exact.length ? exact : all.filter(([k, p]) => names(k, p).some((a) => a.length >= 4 && (a.includes(n) || n.includes(a))));
}

const local = (s) => { const m = s.match(/^(\d{4})-(\d\d)-(\d\d)$/); return m ? new Date(+m[1], m[2] - 1, +m[3]).getTime() : NaN; };
const midnight = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

// -> [from, to) in ms. --on = that calendar day; --since = from then until now.
export function window({ since, on }) {
  const now = Date.now();
  const named = { today: midnight(now), yesterday: midnight(now - DAY), week: now - 7 * DAY, month: now - 30 * DAY };
  if (on) {
    const t = on in named ? named[on] : local(on);
    if (isNaN(t)) throw new Error(`--on: use today|yesterday|YYYY-MM-DD, got "${on}"`);
    return [midnight(t), midnight(t) + DAY];
  }
  if (!since) return [0, Infinity];
  const m = since.match(/^(\d+)([hdw])$/);
  if (m) return [now - m[1] * { h: 36e5, d: DAY, w: 7 * DAY }[m[2]], Infinity];
  const t = since in named ? named[since] : local(since);
  if (isNaN(t)) throw new Error(`--since: use 3h|2d|1w|today|yesterday|week|month|YYYY-MM-DD, got "${since}"`);
  return [t, Infinity];
}

function scan(dir, keep, out, deadline, st, depth = 0) {
  if (depth > 9) return;
  if (Date.now() > deadline) { st.truncated = true; return; }
  let es;
  try { es = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of es) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) { scan(p, keep, out, deadline, st, depth + 1); continue; }
    st.files++;
    if (keep(p)) out.push(p);
  }
}

// git roots: `git ls-files` is ~3x faster than walking and honours .gitignore; non-git roots are walked
async function list(r, keep, st, deadline) {
  if (existsSync(join(r, ".git"))) {
    try {
      const { stdout } = await run("git", ["-C", r, "ls-files", "-z", "--cached", "--others", "--exclude-standard"], { maxBuffer: 1 << 28 });
      const out = [];
      for (const f of stdout.split("\0")) {
        if (!f || f.split("/").some((s) => SKIP.has(s))) continue;
        st.files++;
        const p = join(r, f);
        if (keep(p)) out.push(p);
      }
      return out;
    } catch { /* fall through to a walk */ }
  }
  const out = [];
  scan(r, keep, out, deadline, st);
  return out;
}

// stat in concurrent batches: per-file synchronous stat is the bottleneck on Windows
async function stamp(paths, deadline, st) {
  const res = [];
  for (let i = 0; i < paths.length; i += 256) {
    if (Date.now() > deadline) { st.truncated = true; break; }
    const batch = await Promise.all(paths.slice(i, i + 256).map((p) => stat(p).then((s) => ({ p, t: s.mtimeMs }), () => null)));
    res.push(...batch.filter(Boolean));
  }
  return res;
}

export async function find({ root, rest, opts }) {
  const projs = loadProjects(root);
  let picked;
  if (opts.project && opts.project !== "all") {
    picked = resolveProject(root, opts.project);
    if (!picked.length) throw new Error(`unknown project "${opts.project}". Known: ${Object.keys(projs).join(", ")}`);
  } else picked = Object.entries(projs).filter(([, p]) => opts.project === "all" || p.default);
  const roots = picked.flatMap(([, p]) => p.paths).filter(existsSync);
  const [from, to] = window(opts);
  const words = rest.map((w) => w.toLowerCase());
  const exts = opts.ext ? opts.ext.split(",").map((e) => "." + e.replace(/^\./, "").toLowerCase()) : null;
  const keep = (p) => { const l = p.toLowerCase(); return words.every((w) => l.includes(w)) && (!exts || exts.some((e) => l.endsWith(e))); };
  const paths = [], st = { files: 0, truncated: false }, t0 = Date.now(), deadline = t0 + 25000;
  paths.push(...(await Promise.all(roots.map((r) => list(r, keep, st, deadline)))).flat());
  const out = await stamp(paths, deadline, st);
  const hits = out.filter((f) => f.t >= from && f.t < to).sort((a, b) => b.t - a.t).slice(0, +(opts.n ?? 15));
  console.log(`# ${picked.map(([k]) => k).join(",")} | scanned ${st.files} files in ${Date.now() - t0}ms${st.truncated ? " (TRUNCATED at 25s: narrow with --project/--ext)" : ""} | ${hits.length} shown`);
  for (const h of hits) console.log(`${new Date(h.t).toISOString().slice(0, 16).replace("T", " ")}  ${h.p.replace(/\\/g, "/")}`);
}

export async function where({ root, rest }) {
  const q = rest.join(" ");
  if (!q) { for (const [k, p] of Object.entries(loadProjects(root))) console.log(`${k.padEnd(18)} ${p.paths.join(", ")}`); return; }
  const hit = resolveProject(root, q);
  if (!hit.length) throw new Error(`no project matches "${q}" (run: uika where)`);
  for (const [k, p] of hit) console.log(`${k}  ${p.paths.join(", ")}${p.note ? `  # ${p.note}` : ""}`);
}
