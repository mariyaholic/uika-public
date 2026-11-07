// package.test.mjs — the npm artifact is exactly what the release promises: an explicit file list (plus the whole skills/ tree),
// no tests, no estate fixtures, and no packaged link to a file the tarball does not carry.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packToTemp, readTarball } from "../tools/scrub_privacy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Every file under skills/ ships (the skills library is part of the package); caches never do.
const walkFiles = (rel) => readdirSync(join(root, rel), { withFileTypes: true }).flatMap((e) => {
  if (e.name === "__pycache__" || e.name.endsWith(".pyc")) return [];
  const r = `${rel}/${e.name}`;
  return e.isDirectory() ? walkFiles(r) : [r];
});
const SKILL_FILES = walkFiles("skills");
const MODULES = ["adopt", "check", "deploy", "docs", "eval", "figure", "find", "home", "init", "layout", "lint", "ref", "session", "skills", "supply", "sync", "targets", "uika", "video"];
export const EXPECTED_FILES = [
  "CHANGELOG.md", "CONTRIBUTING.md", "LICENSE", "NOTICE", "README.md", "ROADMAP.md", "SECURITY.md", "package.json",
  "bin/uika.mjs",
  "docs/AGENT-GUIDE.md", "docs/SKILL_PORT_AUDIT.md", "docs/harness-matrix.md", "docs/manual.md", "docs/roadmap.md",
  "examples/estate.example.json", "examples/mcp.example.json", "examples/projects.example.json",
  "schema/estate.schema.json",
  ...SKILL_FILES,
  ...MODULES.map((m) => `src/${m}.mjs`), "src/validate-codes.json",
  "templates/agents-project.md", "templates/readme-project.md",
].sort();

let packed;
const pack = (t) => {
  if (!packed) { packed = packToTemp(root); process.on("exit", packed.cleanup); }
  return packed;
};

test("npm pack ships exactly the expected files", (t) => {
  const { tarball, meta } = pack(t);
  const names = readTarball(readFileSync(tarball)).map((e) => e.name).sort();
  assert.deepEqual(names, EXPECTED_FILES);
  assert.equal(meta.entryCount, EXPECTED_FILES.length);
  assert.ok(!names.some((n) => n.endsWith(".test.mjs")), "tests are not shipped");
  assert.ok(!names.includes("estate.json") && !names.includes("AGENTS.md"), "dev-estate fixtures are not shipped");
});

test("package metadata is CLI-only: no main, and exports exposes only package.json", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(pkg.main, undefined);
  assert.deepEqual(pkg.exports, { "./package.json": "./package.json" });
  assert.deepEqual(pkg.bin, { uika: "bin/uika.mjs" });
  assert.equal(pkg.dependencies, undefined, "zero npm runtime dependencies");
});

test("every relative link in a packaged Markdown file resolves inside the tarball", (t) => {
  const entries = readTarball(readFileSync(pack(t).tarball));
  const names = new Set(entries.map((e) => e.name));
  const dirs = new Set([...names].flatMap((n) => n.split("/").slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join("/"))));
  const broken = [];
  for (const e of entries.filter((x) => x.name.endsWith(".md"))) {
    const text = e.data.toString("utf8").replace(/```[\s\S]*?```/g, "");
    for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const href = m[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#")) continue;
      const target = posix.normalize(posix.join(posix.dirname(e.name), decodeURIComponent(href.split("#")[0]))).replace(/\/$/, "");
      if (!names.has(target) && !dirs.has(target)) broken.push(`${e.name} -> ${href}`);
    }
    // Package-relative file mentions in code spans (README and docs name files this way).
    for (const m of text.matchAll(/`((?:docs|examples|schema|templates|bin)\/[\w./-]+\.\w+|NOTICE|LICENSE|ROADMAP\.md|CHANGELOG\.md|SECURITY\.md|CONTRIBUTING\.md|DRAFT-NOTES\.md|OPEN_RELEASE_READINESS\.md)`/g)) {
      if (!names.has(m[1])) broken.push(`${e.name} -> \`${m[1]}\``);
    }
  }
  assert.deepEqual(broken, []);
});

test("README command count and help text agree with the dispatcher", () => {
  const src = readFileSync(join(root, "src/uika.mjs"), "utf8");
  const names = src.match(/const commands = \{([^}]*)\}/)[1].split(",").map((s) => s.trim().split(":")[0].trim()).filter(Boolean);
  const readme = readFileSync(join(root, "README.md"), "utf8");
  const n = Number(readme.match(/The dispatcher registers (\d+) commands/)[1]);
  assert.equal(n, names.length, `README says ${n}, dispatcher registers ${names.length}`);
  const help = src.slice(src.indexOf("console.log(`uika <command>"));
  for (const c of names) assert.match(help, new RegExp(`\\n\\s+${c} |\\| ${c} `), `help lists ${c}`);
  for (const c of names) assert.ok(readme.includes(`\`${c}`), `README mentions ${c}`);
});

test("repository envelope: LF everywhere, generated state ignored, release docs present", () => {
  const crlf = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if ([".git", "node_modules"].includes(name)) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(mjs|js|json|md|yml|yaml|css|txt)$|^(LICENSE|NOTICE|\.gitignore|\.gitattributes)$/.test(name) && readFileSync(p).includes(13)) crlf.push(posix.normalize(p.slice(root.length + 1).replace(/\\/g, "/")));
    }
  };
  walk(root);
  assert.deepEqual(crlf, [], "text files use LF (.gitattributes: * text=auto eol=lf)");
  assert.match(readFileSync(join(root, ".gitattributes"), "utf8"), /^\* text=auto eol=lf$/m);
  const ignore = readFileSync(join(root, ".gitignore"), "utf8").split("\n");
  for (const entry of ["node_modules/", "dist/", "coverage/", "*.tgz", "data/deploy/"]) assert.ok(ignore.includes(entry), `.gitignore lists ${entry}`);
  for (const doc of ["CHANGELOG.md", "SECURITY.md", "CONTRIBUTING.md", "RELEASE_CHECKLIST.md"]) assert.ok(statSync(join(root, doc)).size > 0, `${doc} exists`);
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.match(readFileSync(join(root, "CHANGELOG.md"), "utf8"), new RegExp(`## \\[${pkg.version.replace(/\./g, "\\.")}\\] preview`), "CHANGELOG names the package version");
});
