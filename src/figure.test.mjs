// figure.test.mjs — `uika figure`: guards, dry-run rendering, deterministic output, themes and token faces,
// and the clear failure when png/pdf are asked for without Playwright.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, symlinkSync, linkSync, chmodSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { compile } from "../skills/figure-craft/kit/figure.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "bin", "uika.mjs");
const EXAMPLES = join(ROOT, "skills", "figure-craft", "examples");
const temp = (t) => { const d = mkdtempSync(join(tmpdir(), "uika-figure-")); t.after(() => rmSync(d, { recursive: true, force: true })); return d; };
const run = (args, root) => spawnSync(process.execPath, [CLI, ...args, "--root", root], { encoding: "utf8" });
const SPEC = { id: "demo", title: "Demo bars", form: "bar", data: { series: [{ label: "alpha", value: 3 }, { label: "beta", value: 5 }] }, notes: { provenance: "synthetic" } };
let HAVE_PLAYWRIGHT = true;
try { await import("playwright"); } catch { HAVE_PLAYWRIGHT = false; }

test("figure check runs the guards on a packaged example and on a bad spec", (t) => {
  const d = temp(t);
  const ok = run(["figure", "check", join(EXAMPLES, "eval-gates-pass.figure.json")], d);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /guards passed · tokens: built-in fallback/);
  const bad = join(d, "bad.figure.json");
  writeFileSync(bad, JSON.stringify({ ...SPEC, form: "pie-of-doom" }));
  const r = run(["figure", "check", bad], d);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /unknown form "pie-of-doom"/);
  assert.match(run(["figure", "check", join(d, "missing.figure.json")], d).stderr, /spec not found/);
});

test("figure render is a dry run without --apply and deterministic with it", (t) => {
  const d = temp(t);
  const spec = join(d, "demo.figure.json");
  writeFileSync(spec, JSON.stringify(SPEC));
  const out = join(d, "out");
  const dry = run(["figure", "render", spec, "--formats", "svg,html", "--out", out], d);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /would write/);
  assert.deepEqual(readdirSync(d), ["demo.figure.json"]);
  assert.equal(run(["figure", "render", spec, "--formats", "svg,html", "--out", out, "--apply"], d).status, 0);
  assert.deepEqual(readdirSync(out).sort(), ["demo.html", "demo.manifest.json", "demo.svg"]);
  const first = readFileSync(join(out, "demo.svg"), "utf8");
  run(["figure", "render", spec, "--out", out, "--apply"], d);
  assert.equal(readFileSync(join(out, "demo.svg"), "utf8"), first, "same spec + tokens => same bytes");
  assert.equal(JSON.parse(readFileSync(join(out, "demo.manifest.json"), "utf8")).schema, "uika.figure-manifest.v1");
  assert.match(run(["figure", "render", spec, "--formats", "svg,gif"], d).stderr, /unknown format\(s\) gif/);
});

test("figure render png fails clearly, before writing, when Playwright is absent", { skip: HAVE_PLAYWRIGHT && "Playwright is installed here" }, (t) => {
  const d = temp(t);
  const spec = join(d, "demo.figure.json");
  writeFileSync(spec, JSON.stringify(SPEC));
  const r = run(["figure", "render", spec, "--formats", "svg,png", "--out", join(d, "out"), "--apply"], d);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /png\/pdf need Playwright/);
  assert.deepEqual(readdirSync(d), ["demo.figure.json"]);
});

test("figure rejects unsafe names and output symlinks before writing", (t) => {
  const d = temp(t), out = join(d, "out"), spec = join(d, "demo.figure.json");
  mkdirSync(out);
  for (const id of ["../escaped", "/absolute", "..\\escaped", "CON", "bad."]) {
    writeFileSync(spec, JSON.stringify({ ...SPEC, id }));
    const r = run(["figure", "render", spec, "--out", out, "--apply"], d);
    assert.notEqual(r.status, 0, id);
    assert.match(r.stderr, /safe filename/);
  }
  assert.equal(existsSync(join(d, "escaped.svg")), false);
  assert.deepEqual(readdirSync(out), []);
  const victim = join(d, "victim.svg");
  writeFileSync(victim, "unchanged");
  try { symlinkSync(victim, join(out, "demo.svg")); } catch (e) { if (["EPERM", "EACCES"].includes(e.code)) return; throw e; }
  writeFileSync(spec, JSON.stringify(SPEC));
  const r = run(["figure", "render", spec, "--out", out, "--apply"], d);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /refusing symlink output/);
  assert.equal(readFileSync(victim, "utf8"), "unchanged");
  assert.deepEqual(readdirSync(out), ["demo.svg"]);
});

test("figure rejects invalid dimensions and chart numbers", (t) => {
  const d = temp(t), spec = join(d, "demo.figure.json");
  const bad = [{ width: 0 }, { width: -1 }, { width: "960" }, { width: 1.5 }, { height: null }, { data: { series: [{ label: "A", value: "oops" }] } }, { data: { series: [{ label: "A" }] } }];
  for (const over of bad) {
    writeFileSync(spec, JSON.stringify({ ...SPEC, ...over }));
    const r = run(["figure", "check", spec], d);
    assert.notEqual(r.status, 0, JSON.stringify(over));
    assert.match(r.stderr, /positive integer|finite number/);
  }
  writeFileSync(spec, JSON.stringify(SPEC).replace('"value":3', '"value":1e309'));
  assert.match(run(["figure", "check", spec], d).stderr, /finite number/);
  for (const [form, data] of [["pattern", { max: "oops" }], ["pattern", { seed: "bad" }], ["distribution", { values: [], bins: 4 }], ["distribution", { values: [1], bins: 0 }], ["timeline", { events: [], range: [0] }]]) {
    writeFileSync(spec, JSON.stringify({ ...SPEC, form, data }));
    const r = run(["figure", "check", spec], d);
    assert.notEqual(r.status, 0, `${form}: ${JSON.stringify(data)}`);
  }
});

test("figure atomically replaces an output hard link without changing its other name", (t) => {
  const d = temp(t), out = join(d, "out"), victim = join(d, "outside.svg"), spec = join(d, "demo.figure.json");
  mkdirSync(out); writeFileSync(victim, "outside bytes"); chmodSync(victim, 0o640);
  linkSync(victim, join(out, "demo.svg")); writeFileSync(spec, JSON.stringify(SPEC));
  const preload = join(d, "umask.mjs"); writeFileSync(preload, "process.umask(0o022);\n");
  const r = spawnSync(process.execPath, ["--import", preload, CLI, "figure", "render", spec, "--out", out, "--formats", "svg,html", "--apply", "--root", d], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(victim, "utf8"), "outside bytes");
  assert.match(readFileSync(join(out, "demo.svg"), "utf8"), /^<svg/);
  if (process.platform !== "win32") {
    assert.equal(statSync(join(out, "demo.svg")).mode & 0o777, 0o640);
    assert.equal(statSync(join(out, "demo.html")).mode & 0o777, 0o644, "new outputs retain normal umask permissions");
  }
  assert.deepEqual(readdirSync(out).sort(), ["demo.html", "demo.manifest.json", "demo.svg"]);
});

test("distribution rejects lost observations and preserves supplied bin frequencies", () => {
  const spec = { ...SPEC, form: "distribution" };
  for (const values of [[1, 2, "garbage"], ["garbage"], [1, null], [1, true], ["1", "2"], [1, Infinity]]) {
    assert.throws(() => compile({ ...spec, data: { values, bins: 2 } }), /finite number/);
  }
  assert.doesNotMatch(compile({ ...spec, data: { values: [1, 2, 3, 4], bins: 2 } }).svg, /NaN|Infinity/);
  const result = compile({ ...spec, data: { series: [{ label: "low", value: 1 }, { label: "high", value: 3 }] } });
  const bars = result.model.prims.filter(p => p.t === "rect" && ["low", "high"].includes(p.id));
  assert.equal(bars.length, 2, "pre-binned series must retain its two bins");
  assert.ok(Math.abs(bars[1].h / bars[0].h - 3) < 1e-9, "supplied frequencies retain their 1:3 ratio");
});

test("figure leaves existing destination untouched when browser launch fails", (t) => {
  const d = temp(t), spec = join(d, "demo.figure.json"), out = join(d, "out"), loader = join(d, "loader.mjs");
  mkdirSync(out); writeFileSync(join(out, "demo.svg"), "original"); writeFileSync(spec, JSON.stringify(SPEC));
  writeFileSync(loader, `export async function resolve(s,c,n){if(s==='playwright')return {url:'data:text/javascript,export const chromium={launch:async()=>{throw new Error("synthetic launch failure")}}',shortCircuit:true};return n(s,c)}\n`);
  const r = spawnSync(process.execPath, ["--no-warnings", "--experimental-loader", loader, CLI, "figure", "render", spec, "--out", out, "--formats", "svg,html,png", "--apply", "--root", d], { encoding: "utf8" });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /synthetic launch failure/);
  assert.equal(readFileSync(join(out, "demo.svg"), "utf8"), "original");
  assert.deepEqual(readdirSync(out), ["demo.svg"]);
});

test("figure resolves Playwright installed in the selected project", (t) => {
  const d = temp(t), spec = join(d, "demo.figure.json"), out = join(d, "out"), pkg = join(d, "node_modules", "playwright");
  mkdirSync(pkg, { recursive: true }); writeFileSync(spec, JSON.stringify(SPEC));
  writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "playwright", main: "index.cjs" }));
  writeFileSync(join(pkg, "index.cjs"), `const fs = require('node:fs'); exports.chromium = { launch: async () => ({ newPage: async () => ({ setContent: async () => {}, screenshot: async ({path}) => fs.writeFileSync(path, 'fake png'), pdf: async ({path}) => fs.writeFileSync(path, 'fake pdf') }), close: async () => {} }) };\n`);
  const r = run(["figure", "render", spec, "--out", out, "--formats", "svg,png,pdf", "--apply"], d);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(readdirSync(out).sort(), ["demo.manifest.json", "demo.pdf", "demo.png", "demo.svg"]);
  assert.equal(readFileSync(join(out, "demo.png"), "utf8"), "fake png");
});

test("figure themes and token faces resolve in the documented order", (t) => {
  const d = temp(t);
  const list = run(["figure", "theme"], d);
  assert.equal(list.status, 0, list.stderr);
  assert.match(list.stdout, /^paper\s/m);
  const paper = run(["figure", "theme", "paper", "--json"], d);
  assert.equal(JSON.parse(paper.stdout).bg, "#ffffff");
  assert.match(run(["figure", "theme", "no-such-theme"], d).stderr, /unknown theme "no-such-theme"/);
  const spec = join(d, "demo.figure.json");
  writeFileSync(spec, JSON.stringify(SPEC));
  const css = join(d, "sheet.css");
  writeFileSync(css, ":root { --bg-ground: #101010; }\n[data-face=\"light\"] { --bg-ground: #fafafa; }\n");
  assert.match(run(["figure", "check", spec, "--tokens", css, "--face", "light"], d).stdout, /\[data-face="light"\]/);
  assert.match(run(["figure", "check", spec, "--theme", "paper"], d).stdout, /paper\.json/);
  writeFileSync(css, ":root { --bg-ground: #101010; }\n");
  assert.match(run(["figure", "check", spec, "--tokens", css, "--face", "light"], d).stderr, /no \[data-face="light"\] block/);
  mkdirSync(join(d, "design"));
  writeFileSync(join(d, "design", "uika-canonical.css"), ":root { --gold: #123456; }\n");
  assert.match(run(["figure", "check", spec], d).stdout, /uika-canonical\.css :root/);
  const ls = run(["figure", "ls", EXAMPLES], d);
  assert.match(ls.stdout, /3 specs/);
});
