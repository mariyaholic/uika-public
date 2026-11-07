// ADR-0022: canonical locations and names. `uika path <kind> <name>` says where a thing goes;
// `uika layout [dir]` reports names/structure that break the standard (warn-only).
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const today = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
const kebab = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// kind -> [template, description]; {n}=name, {d}=date, {y}/{m}=year/month, {h}=handle, {p}=project, {x}=ext
const KINDS = {
  app: ["apps/{n}/", "a runnable product; one folder per app, own README"],
  lib: ["libs/{n}/", "shared code used by two or more apps"],
  tool: ["tools/{n}.{x}", "estate/repo script (search tools/ first; ADR-0015)"],
  doc: ["docs/{n}.md", "durable human-facing document"],
  adr: ["register/adr/ADR-{num}-{n}.md", "decision record; number is next free"],
  log: ["logs/{y}/{m}/{d}-{h}-{n}.md", "session log; handle is <harness>.<role> (ADR-0014)"],
  research: ["research/{p}/{d}-{n}.md", "dated research note under a topic"],
  artifact: ["artifacts/{p}/{d}-{n}/", "generated output (gitignored); one dated folder per run"],
  data: ["data/{n}/", "datasets and fixtures"],
  scratch: ["scratch/{d}-{n}/", "throwaway work (gitignored); safe to delete"],
  archive: ["archive/{y}/{n}/", "retired material; never delete casually"],
};

function nextAdr(root) {
  const dir = join(root, "register/adr");
  const nums = existsSync(dir) ? readdirSync(dir).map((f) => /^ADR-(\d+)/.exec(f)?.[1]).filter(Boolean).map(Number) : [];
  return String(Math.max(0, ...nums) + 1).padStart(4, "0");
}

export async function path({ root, rest, apply, opts }) {
  const [kind, ...words] = rest;
  if (!kind || !KINDS[kind]) {
    console.log("uika path <kind> <name> [--project p] [--ext py] [--from handle] [--apply]\nkinds:");
    for (const [k, [t, d]] of Object.entries(KINDS)) console.log(`  ${k.padEnd(9)} ${t.padEnd(36)} ${d}`);
    return;
  }
  if (!words.length) throw new Error(`name required: uika path ${kind} <name>`);
  const n = kebab(words.join(" ")).replace(/-(v\d+|final|new|old|copy|backup|tmp)$/, "");
  const d = today();
  const vars = { n, d, y: d.slice(0, 4), m: d.slice(5, 7), h: opts.from ?? "claude.impl", p: kebab(opts.project ?? "general"), x: opts.ext ?? "mjs", num: nextAdr(root) };
  const rel = KINDS[kind][0].replace(/\{(\w+)\}/g, (_, k) => vars[k]);
  const abs = resolve(root, rel);
  console.log(rel);
  if (apply) {
    mkdirSync(rel.endsWith("/") ? abs : join(abs, ".."), { recursive: true });
    console.log(`created ${rel.endsWith("/") ? rel : rel.replace(/[^/]+$/, "")}`);
  }
}

const SKIP = new Set([".git", "node_modules", "target", "__pycache__", "dist", ".venv", "venv", ".next", "build", "attic"]);
const VERSIONED = /([_-](v\d+|final|new|old|copy|backup|tmp|temp)|\(\d+\))(\.[a-z0-9]+)?$/i;

export async function layout({ root, rest }) {
  const top = resolve(rest[0] ?? root);
  const found = { spaces: [], upper: [], numbered: [], versioned: [], crowded: [], deep: [] };
  let dirs = 0, files = 0;
  const walk = (dir, depth) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    if (entries.length > 40) found.crowded.push(`${dir} (${entries.length})`);
    for (const e of entries) {
      if (SKIP.has(e.name) || (e.isDirectory() && e.name.startsWith("."))) continue;
      const p = join(dir, e.name);
      if (/\s/.test(e.name)) found.spaces.push(p);
      if (VERSIONED.test(e.name)) found.versioned.push(p);
      if (e.isDirectory()) {
        dirs++;
        if (/^[0-9]{2}_/.test(e.name)) found.numbered.push(p);
        else if (/[A-Z]/.test(e.name) && !/^[A-Z][A-Z0-9_.-]*$/.test(e.name)) found.upper.push(p);
        if (depth >= 6) found.deep.push(p);
        else walk(p, depth + 1);
      } else files++;
    }
  };
  walk(top, 0);
  console.log(`${top}: ${dirs} dirs, ${files} files scanned (ADR-0022)`);
  const label = { spaces: "whitespace in name", upper: "mixed-case dir (want kebab-case)", numbered: "numeric-prefix dir (order lives in README)", versioned: "version/copy suffix in name", crowded: "dir with >40 entries (split or index)", deep: "deeper than 6 levels" };
  for (const [k, v] of Object.entries(found)) {
    if (!v.length) continue;
    console.log(`  ${label[k]}: ${v.length}`);
    for (const p of v.slice(0, 5)) console.log(`    ${p}`);
  }
}
