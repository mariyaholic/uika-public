// skills.test.mjs — `uika skills validate` findings and their stable codes (src/validate-codes.json).
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync, existsSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { findSkills, skillFindings, skillProblems, skills, VALIDATE_CODES, skillHomes, skillCurrent, copySkill } from "./skills.mjs";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "uika-skills-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (name, body) => {
    mkdirSync(join(root, "skills", name), { recursive: true });
    writeFileSync(join(root, "skills", name, "SKILL.md"), body);
  };
  put("good-one", "---\nname: good-one\ndescription: fine\n---\nbody\n");
  put("bom-ok", "\uFEFF---\nname: bom-ok\ndescription: \"quoted: fine\"\n---\nbody\n");
  put("bad-name", "---\nname: other\ndescription: fine\n---\nbody\n");
  put("colon-desc", "---\nname: colon-desc\ndescription: Use when: things happen\n---\nbody\n");
  put("no-front", "no frontmatter here\n");
  put("long-desc", `---\nname: long-desc\ndescription: ${"x".repeat(1025)}\n---\nbody\n`);
  return root;
}

const codesOf = (root, name) => skillFindings(findSkills(root).find((s) => s.name === name)).map((x) => x.code);

test("each problem carries its stable code", (t) => {
  const root = fixture(t);
  assert.deepEqual(codesOf(root, "good-one"), []);
  assert.deepEqual(codesOf(root, "bom-ok"), []);
  assert.deepEqual(codesOf(root, "bad-name"), ["SKV001"]);
  assert.deepEqual(codesOf(root, "colon-desc"), ["SKV002"]);
  assert.deepEqual(codesOf(root, "no-front"), ["SKV001", "SKV003"]);
  assert.deepEqual(codesOf(root, "long-desc"), ["SKV004"]);
});

test("the code registry lists exactly the codes the validator emits, all as warnings", () => {
  assert.deepEqual(Object.keys(VALIDATE_CODES).sort(), ["SKV001", "SKV002", "SKV003", "SKV004"]);
  for (const [code, c] of Object.entries(VALIDATE_CODES)) {
    assert.equal(c.severity, "warn", code);
    for (const k of ["message", "when", "fix"]) assert.ok(c[k], `${code}.${k}`);
  }
});

test("skillProblems keeps the historical message after the code (lint uses it)", (t) => {
  const root = fixture(t);
  const s = findSkills(root).find((x) => x.name === "bad-name");
  assert.deepEqual(skillProblems(s), ['SKV001 name "other" != directory']);
});

test("validate prints coded WARN lines and does not throw, so the CLI exits 0", async (t) => {
  const root = fixture(t);
  const lines = [];
  const log = console.log;
  console.log = (m) => lines.push(String(m));
  try { await skills({ root, rest: ["validate"] }); } finally { console.log = log; }
  assert.ok(lines.includes('WARN  SKV001  bad-name: name "other" != directory'), lines.join("\n"));
  assert.ok(lines.some((l) => l.startsWith("WARN  SKV004  long-desc: description 1025 chars")));
  assert.equal(lines.at(-1), "skills: 5 problem(s) in 6");
});

test("skills pack is not a 0.1 command: it fails with usage and writes nothing", async (t) => {
  const root = fixture(t);
  await assert.rejects(skills({ root, rest: ["pack"], apply: true }), /usage: skills validate\|place /);
  assert.equal(existsSync(join(root, "dist")), false);
});

test("no shipped module builds shell source: no PowerShell, -Command, or shell: true", () => {
  const src = dirname(fileURLToPath(import.meta.url));
  const files = [...readdirSync(src).filter((f) => f.endsWith(".mjs") && !f.endsWith(".test.mjs")).map((f) => join(src, f)), join(src, "..", "bin", "uika.mjs")];
  const hits = files.flatMap((f) => (/powershell|["']-Command["']|shell:\s*true/i.test(readFileSync(f, "utf8")) ? [f] : []));
  assert.deepEqual(hits, []);
});

test("skills fail clearly for unknown names, strict findings and invalid placement", async (t) => {
  const root = fixture(t);
  await assert.rejects(skills({ root, rest: ["validate", "absent"] }), /unknown skill/);
  await assert.rejects(skills({ root, rest: ["validate"], opts: { strict: true } }), /validation failed/);
  await assert.rejects(skills({ root, rest: ["place"], apply: true }), /cannot place invalid skills/);
  mkdirSync(join(root, "skills", "vendor", "good-one"), { recursive: true });
  writeFileSync(join(root, "skills", "vendor", "good-one", "SKILL.md"), "---\nname: good-one\ndescription: duplicate\n---\n");
  assert.throws(() => findSkills(root), /duplicate skill name/);
});

test("skill homes preserve empty configuration and reject corruption without fallback", (t) => {
  const root = fixture(t);
  const file = join(root, "estate.json");
  writeFileSync(file, "{bad");
  assert.throws(() => skillHomes(root), /cannot read skill homes/);
  for (const homes of [null, "bad", [null], [""]]) {
    writeFileSync(file, JSON.stringify({ estate: { skills: { homes } } }));
    assert.throws(() => skillHomes(root), /homes must be an array/);
  }
  writeFileSync(file, JSON.stringify({ estate: { skills: { homes: [] } } }));
  assert.deepEqual(skillHomes(root), []);
  writeFileSync(file, JSON.stringify({ estate: { skills: { homes: [root] } } }));
  assert.deepEqual(skillHomes(root), [root]);
});

test("skill copy checks the whole tree and rejects destination links before writing", (t) => {
  const root = fixture(t);
  const source = join(root, "skills", "good-one");
  const destination = join(root, "copy");
  const external = join(root, "external");
  mkdirSync(external);
  copySkill(source, destination);
  assert.equal(skillCurrent(source, destination), true);
  mkdirSync(join(source, "nested"));
  writeFileSync(join(source, "nested", "helper.md"), "first");
  assert.equal(skillCurrent(source, destination), false);
  copySkill(source, destination);
  assert.equal(skillCurrent(source, destination), true);
  rmSync(join(destination, "nested"), { recursive: true });
  symlinkSync(external, join(destination, "nested"), "junction");
  assert.throws(() => copySkill(source, destination), /unsafe skill destination link/);
  assert.equal(existsSync(join(external, "helper.md")), false);
});

test("empty libraries are explicit and cannot pass strict validation or placement", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "uika-no-skills-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  await assert.rejects(skills({ root, rest: ["validate"], opts: { strict: true } }), /no skills found/);
  await assert.rejects(skills({ root, rest: ["place"], apply: true }), /no skills found/);
  assert.deepEqual(readdirSync(root), []);
});
