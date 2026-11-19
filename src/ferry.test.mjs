// ferry.test.mjs — tests for Ferry cache deferral helper
import test from "node:test";
import assert from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, symlinkSync, rmSync } from "node:fs";
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
  rmSync(tmp, { recursive: true, force: true });
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
  rmSync(tmp, { recursive: true, force: true });
});

test("ferry stage and restore default to dry-run and round-trip with --apply", async () => {
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

  try {
    // Dry run stage writes nothing and does not call gdrive
    const dryStage = await ferry({ root: tmp, rest: ["stage"], apply: false, opts: { maxSize: 1024 * 1024, execRunner: mockRunner } });
    assert.strictEqual(dryStage.ok, true);
    assert.strictEqual(dryStage.dryRun, true);
    assert.strictEqual(dryStage.staged, 0);
    assert.strictEqual(dryStage.planned, 1);
    assert.strictEqual(hookCalled, false);
    assert.strictEqual(existsSync(heavyFile), true);
    assert.strictEqual(existsSync(driveRoot), false);

    // Apply stage moves artifact and runs hook
    const stageRes = await ferry({ root: tmp, rest: ["stage"], apply: true, opts: { maxSize: 1024 * 1024, execRunner: mockRunner } });
    assert.strictEqual(stageRes.ok, true);
    assert.strictEqual(stageRes.dryRun, false);
    assert.strictEqual(stageRes.staged, 1);
    assert.strictEqual(hookCalled, true);
    assert.strictEqual(existsSync(heavyFile), false);

    // Dry run restore writes nothing
    const dryRestore = await ferry({ root: tmp, rest: ["restore"], apply: false, opts: {} });
    assert.strictEqual(dryRestore.ok, true);
    assert.strictEqual(dryRestore.dryRun, true);
    assert.strictEqual(dryRestore.restored, 0);
    assert.strictEqual(dryRestore.planned, 1);
    assert.strictEqual(existsSync(heavyFile), false);

    // Apply restore writes artifact back
    const restoreRes = await ferry({ root: tmp, rest: ["restore"], apply: true, opts: {} });
    assert.strictEqual(restoreRes.ok, true);
    assert.strictEqual(restoreRes.dryRun, false);
    assert.strictEqual(restoreRes.restored, 1);
    assert.strictEqual(existsSync(heavyFile), true);
  } finally {
    delete process.env.UIKA_DRIVE_ROOT;
    delete process.env.UIKA_DRIVE_FOLDER_ID;
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("ferry validates UIKA_DRIVE_FOLDER_ID before mutating and refuses destination symlinks", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "uika-ferry-sec-"));
  const heavyFile = join(tmp, "heavy.bin");
  writeFileSync(heavyFile, Buffer.alloc(1024 * 1024 + 5));
  const driveRoot = join(tmp, "drive-cache");
  process.env.UIKA_DRIVE_ROOT = driveRoot;
  process.env.UIKA_DRIVE_FOLDER_ID = "bad/folder?id";

  try {
    await assert.rejects(
      () => ferry({ root: tmp, rest: ["stage"], apply: true, opts: { maxSize: 1024 * 1024 } }),
      /Invalid UIKA_DRIVE_FOLDER_ID/
    );
    assert.strictEqual(existsSync(heavyFile), true);
    assert.strictEqual(existsSync(driveRoot), false);

    delete process.env.UIKA_DRIVE_FOLDER_ID;
    // Stage legitimately first
    await ferry({ root: tmp, rest: ["stage"], apply: true, opts: { maxSize: 1024 * 1024 } });
    assert.strictEqual(existsSync(heavyFile), false);

    // Plant a symlink at restore destination and verify restore refuses even with --force
    const outsideTarget = join(tmp, "outside.txt");
    writeFileSync(outsideTarget, "keep-me", "utf8");
    symlinkSync(outsideTarget, heavyFile);
    await assert.rejects(
      () => ferry({ root: tmp, rest: ["restore"], apply: true, opts: { force: true } }),
      /Unsafe symlink/
    );
    assert.strictEqual(readFileSync(outsideTarget, "utf8"), "keep-me");
  } finally {
    delete process.env.UIKA_DRIVE_ROOT;
    delete process.env.UIKA_DRIVE_FOLDER_ID;
    rmSync(tmp, { recursive: true, force: true });
  }
});
