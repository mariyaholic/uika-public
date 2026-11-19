// ferry.test.mjs — tests for Ferry cache deferral helper
import test from "node:test";
import assert from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanHeavyArtifacts, checkGitignoreSafety, ferry } from "./ferry.mjs";

test("ferry scans heavy or old files correctly", () => {
  const tmp = mkdtempSync(join(tmpdir(), "uika-ferry-"));
  const heavyFile = join(tmp, "heavy.bin");
  writeFileSync(heavyFile, Buffer.alloc(1024 * 1024 + 1));

  const candidates = scanHeavyArtifacts(tmp, { maxSize: 1024 * 1024 });
  assert.strictEqual(candidates.length, 1);
  assert.strictEqual(candidates[0].path, "heavy.bin");
});

test("ferry gitignore safety check detects missing or present entry", () => {
  const tmp = mkdtempSync(join(tmpdir(), "uika-ferry-"));
  const driveRoot = join(tmp, ".ferry_cache");

  // Without .gitignore
  assert.strictEqual(checkGitignoreSafety(tmp, driveRoot), true);

  // With .gitignore missing entry
  writeFileSync(join(tmp, ".gitignore"), "node_modules/\n");
  assert.strictEqual(checkGitignoreSafety(tmp, driveRoot), false);

  // With .gitignore including entry
  writeFileSync(join(tmp, ".gitignore"), ".ferry_cache/\n");
  assert.strictEqual(checkGitignoreSafety(tmp, driveRoot), true);
});

test("ferry stage and restore round-trip with SHA-256 verification and gdrive hook", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "uika-ferry-"));
  const heavyFile = join(tmp, "cache.dat");
  writeFileSync(heavyFile, Buffer.alloc(1024 * 1024 + 5));

  const driveRoot = join(tmp, "drive-cache");
  process.env.UIKA_DRIVE_ROOT = driveRoot;
  process.env.UIKA_DRIVE_FOLDER_ID = "fake-folder-id";

  let hookCalled = false;
  const mockRunner = (cmd, args) => {
    if (cmd === "gdrive" && Array.isArray(args) && args[0] === "upload") hookCalled = true;
  };

  const stageRes = await ferry({ root: tmp, rest: ["stage"], opts: { maxSize: 1024 * 1024, execRunner: mockRunner } });
  assert.strictEqual(stageRes.ok, true);
  assert.strictEqual(stageRes.staged, 1);
  assert.strictEqual(hookCalled, true);
  assert.strictEqual(existsSync(heavyFile), false);

  const restoreRes = await ferry({ root: tmp, rest: ["restore"], opts: {} });
  assert.strictEqual(restoreRes.ok, true);
  assert.strictEqual(restoreRes.restored, 1);
  assert.strictEqual(existsSync(heavyFile), true);

  delete process.env.UIKA_DRIVE_ROOT;
  delete process.env.UIKA_DRIVE_FOLDER_ID;
});
