import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check } from "./check.mjs";

test("check reads harness homes from the selected estate under an isolated user home", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "uika-check-estate-"));
  const home = mkdtempSync(join(tmpdir(), "uika-check-home-"));
  t.after(() => { rmSync(root, { recursive: true, force: true }); rmSync(home, { recursive: true, force: true }); });
  writeFileSync(join(root, "estate.json"), JSON.stringify({ estate: { harnesses: [{ id: "fixture", configHome: "~/.fixture-home" }] } }));
  mkdirSync(join(home, ".fixture-home"));
  const env = process.platform === "win32" ? "USERPROFILE" : "HOME";
  const previous = process.env[env];
  process.env[env] = home;
  const logs = [], original = console.log;
  console.log = (...args) => logs.push(args.join(" "));
  try { await check({ root }); }
  finally { console.log = original; if (previous === undefined) delete process.env[env]; else process.env[env] = previous; }
  assert.ok(logs.join("\n").includes("fixture"));
  assert.ok(logs.join("\n").includes(join(home, ".fixture-home")));
});
