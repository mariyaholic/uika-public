// init.test.mjs — tests for `uika init`
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { init } from "./init.mjs";

test("init: dry run plans files without writing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "uika-init-dry-"));
  try {
    await init({ root: dir, rest: [dir], apply: false });
    assert.equal(existsSync(join(dir, "estate.json")), false);
    assert.equal(existsSync(join(dir, "AGENTS.md")), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("init: --apply writes estate files and creates clean structure", async () => {
  const dir = mkdtempSync(join(tmpdir(), "uika-init-apply-"));
  try {
    await init({ root: dir, rest: [dir], apply: true, opts: { name: "TestEstate" } });
    assert.equal(existsSync(join(dir, "estate.json")), true);
    assert.equal(existsSync(join(dir, "AGENTS.md")), true);
    assert.equal(existsSync(join(dir, "projects", "registry.json")), true);
    assert.equal(existsSync(join(dir, "references", "library.json")), true);
    assert.equal(existsSync(join(dir, "references", "store", ".gitkeep")), true);
    assert.equal(existsSync(join(dir, "design", "uika-canonical.css")), true);
    assert.equal(existsSync(join(dir, "WORKSTACK.md")), true);

    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    assert.ok(agents.includes("TestEstate"));

    const reg = JSON.parse(readFileSync(join(dir, "projects", "registry.json"), "utf8"));
    assert.ok(reg.projects.testestate);

    // Idempotent: re-running with apply skips existing files
    await init({ root: dir, rest: [dir], apply: true, force: false });
    assert.equal(existsSync(join(dir, "estate.json")), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
