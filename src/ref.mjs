// ref.mjs — `uika ref ls [--kind k] [--json] | show <id> [--json] | check [--json]` over the reference registry.
// Read-only. `uika lint` also uses loadLibrary/refProblems (without content hashes) to check `references/library.json`.
// The registry is committed in the estate (`references/library.json`); payloads stay outside git under the
// library root. Theme packs are junction views of `skills/<pack>`; study collections are directories with their own
// README/manifest. Nothing here copies payloads into git.
import { readFileSync, existsSync, statSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { digest, HASH_VERSION } from "./supply.mjs";

export const LIBRARY_REL = "references/library.json";
export const SCHEMA = "uika.reference-library.v1";

// The caller passes the selected estate root; a missing registry is an error there, never a reason to read
// the package parent.

const read = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
const statusOf = (e) => e.status ?? "live";
// Paths in an estate registry are rooted at the selected estate, not cwd.
// Only the selected collection root is resolved; links inside it are rejected.
const estatePath = (root, path) => resolve(root, path);
const referenceDigest = (path) => digest(realpathSync(path));

export function loadLibrary(root) {
  const p = join(root, LIBRARY_REL);
  if (!existsSync(p)) throw new Error(`no reference library registry at ${LIBRARY_REL}`);
  const lib = read(p);
  if (lib?.schema !== SCHEMA) throw new Error(`${LIBRARY_REL}: unknown schema "${lib?.schema}" (want ${SCHEMA})`);
  if (typeof lib.root !== "string" || !lib.root.trim()) throw new Error(`${LIBRARY_REL}: missing or invalid root`);
  entriesOf(lib); // Invalid records must never disappear from verification or the light linter.
  return lib;
}

export function entriesOf(lib) {
  if (!Array.isArray(lib?.entries)) throw new Error(`${LIBRARY_REL}: entries must be an array`);
  const ids = new Set();
  for (const [i, e] of lib.entries.entries()) {
    if (!e || typeof e !== "object" || typeof e.id !== "string" || !e.id.trim()) throw new Error(`${LIBRARY_REL}: entry ${i + 1} needs a non-empty string id`);
    if (ids.has(e.id)) throw new Error(`${LIBRARY_REL}: duplicate id "${e.id}"`);
    ids.add(e.id);
    if (!["live", "planned"].includes(statusOf(e))) throw new Error(`${LIBRARY_REL}: ${e.id}: unsupported status "${e.status}"`);
  }
  return lib.entries;
}

// Light checks are cheap; versioned content verification reads the whole tree.
export function refProblems(root, lib, { hash = true } = {}) {
  const out = [];
  if (!existsSync(estatePath(root, lib.root))) out.push({ id: "(root)", level: "fail", message: `library root missing: ${lib.root}` });
  for (const e of entriesOf(lib)) {
    const id = e.id;
    if (statusOf(e) === "planned") { out.push({ id, level: "note", message: "planned: not collected yet" }); continue; }
    if (!e.path) { out.push({ id, level: "fail", message: "no path" }); continue; }
    const path = estatePath(root, e.path);
    if (!existsSync(path)) { out.push({ id, level: "fail", message: `path missing: ${e.path}` }); continue; }
    if (e.kind !== "themes") {
      if (!statSync(path).isDirectory()) out.push({ id, level: "fail", message: "path is not a directory" });
      else {
        if (e.gallery && !existsSync(join(path, e.gallery))) out.push({ id, level: "warn", message: `gallery missing: ${e.gallery}` });
        if (hash) {
          if (e.hashVersion && e.hashVersion !== HASH_VERSION) {
            out.push({ id, level: "fail", message: `unsupported reference hash version: ${e.hashVersion}` });
          } else if (!e.sha256 || !e.hashVersion) {
            out.push({ id, level: "fail", message: "unverified legacy or missing content hash; use uika ref hash <id> --json and review before updating the registry" });
          } else if (!/^[a-f0-9]{64}$/.test(e.sha256)) {
            out.push({ id, level: "fail", message: "invalid versioned content hash" });
          } else try {
            const d = referenceDigest(path);
            const drift = d.sha256 !== e.sha256 || (e.files != null && d.files !== e.files) || (e.bytes != null && d.bytes !== e.bytes);
            if (drift) out.push({ id, level: "fail", message: `drift: registry ${e.sha256}/${e.files}/${e.bytes} vs disk ${d.sha256}/${d.files}/${d.bytes}` });
          } catch (error) { out.push({ id, level: "fail", message: `content unverifiable: ${error.message}` }); }
        }
      }
    }
    if (e.pack && !existsSync(join(root, e.pack))) out.push({ id, level: "fail", message: `pack missing: ${e.pack}` });
    for (const a of e.aliases ?? []) if (!existsSync(estatePath(root, a))) out.push({ id, level: "warn", message: `alias missing: ${a}` });
  }
  return out;
}

const show = (n) => (n == null ? "-" : String(n));

// `uika ref ...` — read-only views of the registry in the selected estate root.
export function ref({ root, rest, opts }) {
  const [sub = "ls", id] = rest;
  const lib = loadLibrary(root);
  const entries = entriesOf(lib);
  if (sub === "ls") {
    const rows = entries.filter((e) => !opts.kind || e.kind === opts.kind);
    if (opts.json) { console.log(JSON.stringify(rows, null, 2)); return; }
    if (!rows.length) { console.log(`no entries${opts.kind ? ` of kind "${opts.kind}"` : ""} in ${LIBRARY_REL}`); return; }
    for (const e of rows) console.log(`${e.id.padEnd(28)} ${String(e.kind ?? "-").padEnd(8)} ${statusOf(e).padEnd(8)} ${e.title ?? ""}`);
    console.log(`${rows.length} entr${rows.length === 1 ? "y" : "ies"} · library root ${lib.root}`);
    return;
  }
  if (sub === "show") {
    if (!id) throw new Error("show needs an id (see `uika ref ls`)");
    const e = entries.find((x) => x.id === id);
    if (!e) throw new Error(`no entry "${id}" in ${LIBRARY_REL}`);
    if (opts.json) { console.log(JSON.stringify(e, null, 2)); return; }
    console.log(`${e.id} — ${e.title ?? ""}`);
    for (const k of ["kind", "status", "path", "gallery", "pack", "audience", "rights"]) {
      const v = k === "status" ? statusOf(e) : e[k];
      if (v != null) console.log(`  ${k}: ${v}`);
    }
    if (e.gallery && e.path) console.log(`  open: ${join(estatePath(root, e.path), e.gallery)}`);
    if (e.sha256) console.log(`  identity: ${e.hashVersion ?? "legacy/unverified"} ${e.sha256} · ${show(e.files)} files · ${show(e.bytes)} bytes`);
    for (const a of e.aliases ?? []) console.log(`  alias: ${a}`);
    return;
  }
  if (sub === "hash") {
    const e = entries.find((x) => x.id === id);
    if (!e || statusOf(e) !== "live" || e.kind === "themes" || !e.path) throw new Error("hash needs a live non-theme collection path");
    const path = estatePath(root, e.path);
    if (!statSync(path).isDirectory()) throw new Error("hash needs a reference collection directory");
    const result = { id: e.id, ...referenceDigest(path) };
    if (opts.json) return console.log(JSON.stringify(result));
    console.log(`${result.id}: ${result.hashVersion} ${result.sha256} (${result.files} files, ${result.bytes} bytes)`);
    console.log("Read-only result. Review before updating the reference registry.");
    return;
  }
  if (sub === "check") {
    const problems = refProblems(root, lib, { hash: true });
    if (opts.json) console.log(JSON.stringify(problems, null, 2));
    else {
      for (const p of problems) console.log(`${p.level.toUpperCase().padEnd(5)} ${p.id}: ${p.message}`);
      console.log(`${entries.length} entries checked`);
    }
    const fails = problems.filter((p) => p.level === "fail").length;
    if (fails) throw new Error(`${fails} failing entr${fails === 1 ? "y" : "ies"}`);
    return;
  }
  throw new Error(`unknown subcommand "${sub}" (ls|show|hash|check)`);
}

