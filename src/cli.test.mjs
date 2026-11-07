import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("CLI dispatcher gives explicit --root precedence over UIKA_ESTATE_HOME", (t) => {
  const root = mkdtempSync(join(tmpdir(), "uika-cli-root-"));
  const other = mkdtempSync(join(tmpdir(), "uika-cli-other-"));
  t.after(() => { rmSync(root, { recursive: true, force: true }); rmSync(other, { recursive: true, force: true }); });
  for (const [dir, key] of [[root, "selected_root"], [other, "environment_root"]]) {
    mkdirSync(join(dir, "projects"));
    writeFileSync(join(dir, "projects", "registry.json"), JSON.stringify({ projects: { [key]: { paths: [dir] } } }));
  }
  const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "uika.mjs");
  const run = spawnSync(process.execPath, [cli, "where", "selected root", "--root", root], { encoding: "utf8", env: { ...process.env, UIKA_ESTATE_HOME: other } });
  assert.equal(run.status, 0, run.stderr);
  assert.ok(run.stdout.includes(root));
  assert.ok(!run.stdout.includes(other));
});

test("CLI help succeeds and malformed arguments fail without a stack trace", () => {
  const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "uika.mjs");
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
  assert.equal(run("--help").status, 0);
  assert.equal(run("skills", "--help").status, 0);
  for (const args of [["--unknown"], ["--root"], ["unknown-command"], ["constructor"], ["toString"]]) {
    const result = run(...args);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /uika:/);
    assert.doesNotMatch(result.stderr, /\n\s+at |node:internal/);
  }
});

test("conflicting write flags fail before creating any estate files", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "uika-cli-conflict-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "uika.mjs");
  const target = join(dir, "new-estate");
  const result = spawnSync(process.execPath, [cli, "init", target, "--apply", "--dry-run"], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--apply and --dry-run cannot be combined/);
  assert.equal(existsSync(target), false);
});
