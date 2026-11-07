import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { layout, path as suggestPath } from "./layout.mjs";

test("layout scans the selected root and reports names that break the layout rules", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "uika-layout-estate-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "01_Bad Folder"));
  writeFileSync(join(root, "notes_copy.txt"), "fixture");
  const logs = [], original = console.log;
  console.log = (...args) => logs.push(args.join(" "));
  try { await layout({ root, rest: [] }); }
  finally { console.log = original; }
  assert.ok(logs.join("\n").includes(root));
  assert.match(logs.join("\n"), /whitespace in name: 1/);
  assert.match(logs.join("\n"), /numeric-prefix dir \(order lives in README\): 1/);
  const suggested = [];
  console.log = (...args) => suggested.push(args.join(" "));
  try { await suggestPath({ root, rest: ["doc", "Core Guide"], apply: false, opts: {} }); }
  finally { console.log = original; }
  assert.equal(suggested[0], "docs/core-guide.md");
});
