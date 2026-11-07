// ref.test.mjs — the creative reference library registry and its checks (ADR-0054).
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { digest } from "./supply.mjs";
import { SCHEMA, LIBRARY_REL, loadLibrary, entriesOf, refProblems, ref } from "./ref.mjs";

function temp(t) {
  const dir = mkdtempSync(join(tmpdir(), "uika-ref-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function fixture(t) {
  const root = temp(t);
  const libroot = join(root, "library");
  mkdirSync(join(libroot, "video", "set"), { recursive: true });
  writeFileSync(join(libroot, "video", "set", "index.html"), "<html>gallery</html>");
  const shape = digest(join(libroot, "video", "set"));
  mkdirSync(join(root, "skills", "pack"), { recursive: true });
  writeFileSync(join(root, "skills", "pack", "SKILL.md"), "# pack");
  mkdirSync(join(root, "old-set-location"), { recursive: true });
  mkdirSync(join(libroot, "themes", "pack"), { recursive: true });
  const lib = {
    schema: SCHEMA,
    root: libroot,
    entries: [
      {
        id: "set", kind: "video", title: "A video set", path: join(libroot, "video", "set"),
        aliases: [join(root, "old-set-location")], audience: "personal", rights: "study only",
        gallery: "index.html", pack: "skills/pack", ...shape,
      },
      {
        id: "pack", kind: "themes", title: "A theme pack", path: join(libroot, "themes", "pack"),
        pack: "skills/pack",
      },
      {
        id: "later", kind: "video", title: "Not collected", path: join(libroot, "video", "later"),
        status: "planned",
      },
    ],
  };
  mkdirSync(join(root, "references"), { recursive: true });
  writeFileSync(join(root, LIBRARY_REL), JSON.stringify(lib));
  return { root, libroot, lib };
}

test("loadLibrary reads the registry and rejects bad shapes", (t) => {
  const { root } = fixture(t);
  const lib = loadLibrary(root);
  assert.equal(lib.schema, SCHEMA);
  assert.equal(entriesOf(lib).length, 3);

  const bad = temp(t);
  mkdirSync(join(bad, "references"), { recursive: true });
  writeFileSync(join(bad, LIBRARY_REL), JSON.stringify({ schema: "wrong", root: "x", entries: [] }));
  assert.throws(() => loadLibrary(bad), /unknown schema/);
  assert.throws(() => loadLibrary(temp(t)), /no reference library registry/);
});

test("refProblems passes a clean library", (t) => {
  const { root, lib } = fixture(t);
  const problems = refProblems(root, lib);
  assert.deepEqual(problems.filter((p) => p.level !== "note"), []);
  assert.equal(problems.filter((p) => p.level === "note").length, 1, "planned entry noted, not failed");
});

test("refProblems catches a missing path, drift, gallery, pack and alias", (t) => {
  const { root, lib, libroot } = fixture(t);
  lib.entries[0].sha256 = "0".repeat(64);
  lib.entries[0].aliases = [join(root, "does-not-exist")];
  lib.entries[0].gallery = "missing.html";
  lib.entries[1].pack = "skills/missing";
  const msgs = refProblems(root, lib).map((p) => `${p.level} ${p.message}`).join("\n");
  assert.match(msgs, /drift: registry/);
  assert.match(msgs, /gallery missing: missing.html/);
  assert.match(msgs, /pack missing: skills\/missing/);
  assert.match(msgs, /alias missing/);
  assert.doesNotMatch(msgs, /path missing/, "path still present");

  lib.entries[0].path = join(libroot, "video", "gone");
  assert.match(refProblems(root, lib).map((p) => p.message).join("\n"), /path missing/);
});

test("refProblems --no-hash skips content identity", (t) => {
  const { root, lib } = fixture(t);
  lib.entries[0].sha256 = "0000000000000000";
  assert.equal(refProblems(root, lib, { hash: false }).filter((p) => p.level === "fail").length, 0);
});

test("legacy and future hashes cannot silently certify content", (t) => {
  const { root, lib, libroot } = fixture(t);
  lib.entries[0].id = "sample; echo unsafe";
  const collection = join(libroot, "video", "set");
  symlinkSync(join(libroot, "themes"), join(collection, "nested-link"), "junction");
  lib.entries[0].sha256 = "a".repeat(16);
  delete lib.entries[0].hashVersion;
  let messages = refProblems(root, lib).map((p) => p.message).join("\n");
  assert.match(messages, /unverified legacy/);
  assert.doesNotMatch(messages, /hash sample; echo unsafe/);
  assert.doesNotMatch(messages, /content unverifiable/);
  lib.entries[0].hashVersion = "future-version";
  delete lib.entries[0].sha256;
  messages = refProblems(root, lib).map((p) => p.message).join("\n");
  assert.match(messages, /unsupported reference hash version/);
  assert.doesNotMatch(messages, /unverified legacy|content unverifiable/);
  lib.entries[0].hashVersion = "sha256-tree-v1";
  lib.entries[0].sha256 = "a".repeat(64);
  assert.match(refProblems(root, lib).map((p) => p.message).join("\n"), /content unverifiable/);
});

test("versioned hashes detect equal-size edits and empty directories", (t) => {
  const { root, lib, libroot } = fixture(t);
  const dir = join(libroot, "video", "set");
  const original = readFileSync(join(dir, "index.html"), "utf8");
  writeFileSync(join(dir, "index.html"), original.replace("gallery", "GALLERY"));
  assert.match(refProblems(root, lib).map((p) => p.message).join("\n"), /drift: registry/);
  writeFileSync(join(dir, "index.html"), original);
  mkdirSync(join(dir, "empty"));
  assert.match(refProblems(root, lib).map((p) => p.message).join("\n"), /drift: registry/);
});

test("selected root resolves relative reference paths and a junction", (t) => {
  const { root, lib, libroot } = fixture(t);
  const link = join(root, "reference-junction");
  symlinkSync(libroot, link, "junction");
  lib.root = "reference-junction";
  lib.entries[0].path = "reference-junction/video/set";
  assert.equal(refProblems(root, lib).filter((p) => p.level === "fail").length, 0);
  symlinkSync(join(libroot, "themes"), join(libroot, "video", "set", "nested-link"), "junction");
  assert.match(refProblems(root, lib).map((p) => p.message).join("\n"), /content unverifiable/);
});

test("reference hash is explicit, read-only, versioned and rejects files", (t) => {
  const { root, lib, libroot } = fixture(t);
  const registry = join(root, LIBRARY_REL), before = readFileSync(registry, "utf8");
  const logs = [], old = console.log;
  try { console.log = (line) => logs.push(line); ref({ root, rest: ["hash", "set"], opts: { json: true } }); }
  finally { console.log = old; }
  const result = JSON.parse(logs[0]);
  assert.equal(result.hashVersion, "sha256-tree-v1");
  assert.equal(result.sha256.length, 64);
  assert.equal(readFileSync(registry, "utf8"), before);
  lib.entries[0].path = join(libroot, "video", "set", "index.html");
  writeFileSync(registry, JSON.stringify(lib));
  assert.throws(() => ref({ root, rest: ["hash", "set"], opts: { json: true } }), /collection directory/);
});

test("the selected root is used and a missing registry never falls back to the package parent", (t) => {
  const lib = loadLibrary(process.cwd());
  assert.equal(lib.schema, SCHEMA);
  assert.ok(lib.entries.length >= 6, "the estate registry carries the library entries");
  assert.throws(() => loadLibrary(temp(t)), /no reference library registry/);
  const { root } = fixture(t);
  assert.equal(loadLibrary(root).root, join(root, "library"), "the selected root's own registry is read");
});

test("uika ref ls|show|check reads the registry through the CLI", async (t) => {
  const { spawnSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const { dirname } = await import("node:path");
  const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "uika.mjs");
  const root = temp(t);
  const libroot = join(root, "library");
  mkdirSync(join(libroot, "video", "set"), { recursive: true });
  writeFileSync(join(libroot, "video", "set", "index.html"), "<html></html>");
  mkdirSync(join(root, "references"));
  const entry = { id: "set", kind: "video", title: "A video set", path: join(libroot, "video", "set"), gallery: "index.html", ...digest(join(libroot, "video", "set")) };
  writeFileSync(join(root, LIBRARY_REL), JSON.stringify({ schema: SCHEMA, root: libroot, entries: [entry, { id: "later", kind: "video", title: "Later", status: "planned" }] }));
  const run = (...args) => spawnSync(process.execPath, [cli, "ref", ...args, "--root", root], { encoding: "utf8" });
  const ls = run("ls");
  assert.equal(ls.status, 0, ls.stderr);
  assert.match(ls.stdout, /^set\s+video\s+live\s+A video set/m);
  assert.match(ls.stdout, /2 entries/);
  assert.match(run("ls", "--kind", "themes").stdout, /no entries of kind "themes"/);
  const show = run("show", "set");
  assert.match(show.stdout, /open: .*index\.html/);
  assert.equal(JSON.parse(run("show", "set", "--json").stdout).id, "set");
  assert.match(run("show", "nope").stderr, /no entry "nope"/);
  assert.equal(run("check").status, 0);
  const registry = join(root, LIBRARY_REL);
  const { hashVersion, ...legacy } = entry;
  legacy.sha256 = "a".repeat(16);
  writeFileSync(registry, JSON.stringify({ schema: SCHEMA, root: libroot, entries: [legacy] }));
  const before = readFileSync(registry, "utf8");
  const oldCheck = run("check");
  assert.equal(oldCheck.status, 1);
  assert.match(oldCheck.stdout, /unverified legacy/);
  const hashed = run("hash", "set", "--json");
  assert.equal(hashed.status, 0, hashed.stderr);
  assert.equal(JSON.parse(hashed.stdout).hashVersion, "sha256-tree-v1");
  assert.equal(readFileSync(registry, "utf8"), before);
  writeFileSync(registry, JSON.stringify({ schema: SCHEMA, root: "library", entries: [{ ...entry, path: "library/video/set" }] }));
  assert.equal(run("check").status, 0, "relative paths must resolve from --root");
  writeFileSync(join(libroot, "video", "set", "extra.txt"), "drift");
  const drift = run("check");
  assert.equal(drift.status, 1);
  assert.match(drift.stdout, /FAIL\s+set: drift/);
  const empty = temp(t);
  assert.match(spawnSync(process.execPath, [cli, "ref", "ls", "--root", empty], { encoding: "utf8" }).stderr, /no reference library registry/);
});


test("reference records cannot disappear from full or lightweight validation", (t) => {
  const { root, lib } = fixture(t);
  for (const entries of [null, {}, [null], [{ kind: "video", path: "missing" }], [{ id: "" }], [{ id: 4 }], [{ id: "same" }, { id: "same" }], [{ id: "unknown", status: "disabled" }]]) {
    const malformed = { ...lib, entries };
    writeFileSync(join(root, LIBRARY_REL), JSON.stringify(malformed));
    assert.throws(() => loadLibrary(root), /entries must|entry .* id|duplicate id|unsupported status/);
    assert.throws(() => refProblems(root, malformed, { hash: false }));
  }
  assert.deepEqual(entriesOf({ entries: [] }), []);
});
