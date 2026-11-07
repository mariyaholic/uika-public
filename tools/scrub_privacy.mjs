#!/usr/bin/env node
// scrub_privacy.mjs — release privacy gate. Scans the source checkout and the exact `npm pack`
// tarball for local user paths, private drive paths, private project/agent/user names, email
// addresses, and secret-shaped values. Exits 1 on any finding.
//
//   node tools/scrub_privacy.mjs              # source tree + freshly packed tarball
//   node tools/scrub_privacy.mjs --source     # source tree only
//   node tools/scrub_privacy.mjs --pack       # pack the package and scan the tarball only
//   node tools/scrub_privacy.mjs --tarball uika-0.1.0.tgz   # scan an existing tarball
//
// Private names are listed as truncated sha256 token hashes so the gate does not itself publish
// them (obfuscation against casual reading, not a secret). The public owner handle is allowed
// only in the exact places listed in ALLOW_OWNER. Synthetic fixture paths are allowed only in the
// exact forms listed in SYNTHETIC_USERS. There are no directory exclusions apart from VCS and
// dependency stores (.git, node_modules) and generated tarballs (*.tgz).
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const h16 = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

// Private project, agent, machine and user names (lower-case token or two-word phrase hashes).
export const PRIVATE_TOKEN_HASHES = new Set([
  "1752f1694c5426d1", "2dd411308b37266d", "347d83e5c9a1d0d8", "693b286515bd1dd0", "f4eef58cee525710",
  "b0bb54e07200506e", "b80a2ed11594d2a4", "678a36ae0db3b837", "1aaf3025033c8e43", "561eff66cff07790",
  "b6785e444411f815", "9001ab368dcc6b54", "f1c1a5b6cc84770c", "36587856dfca5de5", "b3e6a84ce22c9166",
  "79151125b95ce165", "ecd84424dbae83a2", "dccb7d2e2c505df3", "dcea39981df69f9d", "e3c7366318812e39",
  "eeda9c8d5884b58c", "bf446ea38129b6f1", "970ec274ca867815", "0573e210e217cab7", "84fe5cc65e8bb989",
]);

// The public owner handle: allowed in licence/package metadata and in the canonical repo slug.
export const PUBLIC_OWNER = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")).author;
const ALLOW_OWNER_FILES = new Set(["LICENSE", "NOTICE", "package.json"]);
const OWNER_SLUG = new RegExp(`(?:github\\.com/|repos/)?${PUBLIC_OWNER}/uika\\b`, "gi");

// Synthetic user names allowed in fixture/documentation paths (C:/Users/x/..., C:\Users\...).
const SYNTHETIC_USERS = new Set(["x", "...", "<user>", "%username%", "$user", "you"]);

const RULES = [
  { id: "windows-user-path", re: /\b[A-Za-z]:[\\/]{1,2}Users[\\/]{1,2}([^\\/\s'"`)\]]+)/gi, user: 1 },
  { id: "posix-home-path", re: /(?<![\w.~:])\/(?:home|Users)\/([A-Za-z_][\w.-]*)/g, user: 1 },
  { id: "private-drive-path", re: /(?<![\w$%])[D-Z]:(?:[\\/]|\s+(?:drive|mirror|mirrors)\b)/g },
  { id: "email-address", re: /(?<![\\\w.+-])[\w.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g },
  { id: "secret-shaped", re: /\b(?:sk-|ghp_|gho_|ghs_|github_pat_|AKIA|xox[bap]-|AIza)[A-Za-z0-9_-]{16,}/g },
  { id: "private-key-block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
];
// Placeholder emails used in docs; anything else is flagged.
const ALLOW_EMAIL = /@(?:example\.(?:com|org|net)|users\.noreply\.github\.com)$/i;

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/** Scan one text. Returns [{ file, line, rule, match }]. `deny` overrides the hash set (tests). */
export function scanText(file, text, { deny = PRIVATE_TOKEN_HASHES } = {}) {
  const findings = [];
  const add = (rule, index, match) => findings.push({ file, line: lineOf(text, index), rule, match: match.slice(0, 80) });
  for (const r of RULES) {
    for (const m of text.matchAll(r.re)) {
      if (r.user && SYNTHETIC_USERS.has(m[r.user].toLowerCase().replace(/[.,;:]+$/, (s) => (s === "..." ? s : "")))) continue;
      if (r.id === "email-address" && ALLOW_EMAIL.test(m[0])) continue;
      add(r.id, m.index, m[0]);
    }
  }
  // Owner handle outside its allowed places. Mask allowed slugs first.
  const masked = ALLOW_OWNER_FILES.has(file) ? text.replaceAll(new RegExp(PUBLIC_OWNER, "gi"), (s) => " ".repeat(s.length)) : text.replace(OWNER_SLUG, (s) => " ".repeat(s.length));
  // Private names: single tokens, hyphen/underscore compounds and two-word phrases.
  const words = [...masked.matchAll(/[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*/g)];
  for (let i = 0; i < words.length; i++) {
    const w = words[i][0].toLowerCase();
    const parts = w.split(/[-_]/);
    const candidates = new Set([w, ...parts]);
    if (i + 1 < words.length && /^\s+$/.test(masked.slice(words[i].index + words[i][0].length, words[i + 1].index))) candidates.add(`${w} ${words[i + 1][0].toLowerCase()}`);
    if (w === PUBLIC_OWNER || parts.includes(PUBLIC_OWNER)) { add("owner-handle-outside-allowlist", words[i].index, words[i][0]); continue; }
    if ([...candidates].some((c) => deny.has(h16(c)))) add("private-name", words[i].index, words[i][0]);
  }
  return findings;
}

const isBinary = (buf) => buf.subarray(0, 8000).includes(0);

/** Every file under `dir` except .git, node_modules and *.tgz, as posix-relative paths. */
export function listTree(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === ".git" || e.name === "node_modules") continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && !e.name.endsWith(".tgz")) out.push(relative(dir, p).split(sep).join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

export function scanTree(dir, opts) {
  const files = listTree(dir);
  const findings = [];
  for (const f of files) {
    const buf = readFileSync(join(dir, f));
    if (isBinary(buf)) continue;
    findings.push(...scanText(f, buf.toString("utf8"), opts));
  }
  return { files: files.length, findings };
}

/** Minimal ustar reader for an npm tarball: [{ name, data }] with the "package/" prefix removed. */
export function readTarball(gz) {
  const tar = gunzipSync(gz);
  const entries = [];
  let off = 0, longName = null;
  while (off + 512 <= tar.length) {
    const hdr = tar.subarray(off, off + 512);
    if (hdr.every((b) => b === 0)) break;
    const str = (a, b) => hdr.subarray(a, b).toString("utf8").replace(/\0.*$/s, "");
    let name = str(0, 100);
    const prefix = str(345, 500);
    if (prefix) name = `${prefix}/${name}`;
    const size = parseInt(str(124, 136).trim() || "0", 8);
    const type = String.fromCharCode(hdr[156] || 48);
    const data = tar.subarray(off + 512, off + 512 + size);
    if (type === "L") longName = data.toString("utf8").replace(/\0.*$/s, "");
    else if (type === "0" || type === "\0") { entries.push({ name: (longName ?? name).replace(/^package\//, ""), data }); longName = null; }
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

export function scanTarball(file, opts) {
  const entries = readTarball(readFileSync(file));
  const findings = [];
  for (const e of entries) if (!isBinary(e.data)) findings.push(...scanText(e.name, e.data.toString("utf8"), opts));
  return { files: entries.length, findings };
}

export function npmCli() {
  if (process.env.npm_execpath && /npm-cli\.js$/.test(process.env.npm_execpath)) return process.env.npm_execpath;
  const bin = dirname(process.execPath);
  for (const c of [join(bin, "node_modules", "npm", "bin", "npm-cli.js"), join(bin, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js")]) if (existsSync(c)) return c;
  throw new Error("scrub: cannot locate npm-cli.js next to node; set npm_execpath or run through npm");
}

/** Pack the package into a temp dir (no lifecycle scripts) and return the tarball path + cleanup. */
export function packToTemp(root = PACKAGE_ROOT) {
  const dir = mkdtempSync(join(tmpdir(), "uika-scrub-pack-"));
  const out = execFileSync(process.execPath, [npmCli(), "pack", "--json", "--ignore-scripts", "--pack-destination", dir], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const meta = JSON.parse(out)[0];
  return { tarball: join(dir, meta.filename), meta, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function report(label, res) {
  console.log(`scrub ${label}: ${res.files} file(s) scanned, ${res.findings.length} finding(s)`);
  for (const f of res.findings) console.log(`  ${f.file}:${f.line}  ${f.rule}  ${JSON.stringify(f.match)}`);
  return res.findings.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const ti = args.indexOf("--tarball");
  let bad = 0;
  if (ti >= 0) {
    if (!args[ti + 1] || !statSync(args[ti + 1], { throwIfNoEntry: false })) { console.error("scrub: --tarball needs an existing .tgz path"); process.exit(2); }
    bad += report(`tarball ${args[ti + 1]}`, scanTarball(args[ti + 1]));
  } else {
    const wantSource = args.includes("--source") || !args.includes("--pack");
    const wantPack = args.includes("--pack") || !args.includes("--source");
    if (wantSource) bad += report(`source ${PACKAGE_ROOT}`, scanTree(PACKAGE_ROOT));
    if (wantPack) {
      const p = packToTemp();
      try { bad += report(`tarball ${p.meta.filename} (${p.meta.entryCount} entries, ${p.meta.size} bytes)`, scanTarball(p.tarball)); } finally { p.cleanup(); }
    }
  }
  if (bad) { console.error(`scrub: FAIL (${bad} finding(s))`); process.exit(1); }
  console.log("scrub: clean");
}
