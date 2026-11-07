import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { find, resolveProject, window } from "./find.mjs";

test("find resolves aliases and scans only the selected project root", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "uika-find-estate-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const project = join(root, "fixture-project");
  mkdirSync(project);
  mkdirSync(join(root, "projects"));
  const hit = join(project, "needle-note.txt");
  writeFileSync(hit, "fixture");
  writeFileSync(join(root, "projects", "registry.json"), JSON.stringify({ projects: { fixture_project: { aliases: ["fixture-alias"], paths: [project] } } }));
  assert.equal(resolveProject(root, "fixture alias")[0][0], "fixture_project");
  const logs = [], original = console.log;
  console.log = (...args) => logs.push(args.join(" "));
  try { await find({ root, rest: ["needle"], opts: { project: "fixture-alias", ext: "txt", since: "2020-01-01", n: "5" } }); }
  finally { console.log = original; }
  assert.ok(logs.join("\n").includes(hit.replace(/\\/g, "/")));
});

test("find date windows reject malformed dates and use a half-open day", () => {
  const [from, to] = window({ on: "2026-10-23" });
  assert.equal(to - from, 86_400_000);
  assert.throws(() => window({ on: "not-a-date" }), /--on: use today\|yesterday\|YYYY-MM-DD/);
});
