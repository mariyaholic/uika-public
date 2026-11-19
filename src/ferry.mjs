// ferry.mjs — Google Drive temp/cache deferral helper (uika ferry status|plan|stage|restore)
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readdirSync, lstatSync, statSync, mkdirSync, cpSync, rmSync, writeFileSync, readFileSync, renameSync, realpathSync } from "node:fs";
import { join, relative, resolve, dirname, basename, sep } from "node:path";
import { execFileSync } from "node:child_process";

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function realAncestor(targetPath) {
  let cur = resolve(targetPath);
  const tail = [];
  while (true) {
    const st = lstatSync(cur, { throwIfNoEntry: false });
    if (st) {
      if (st.isSymbolicLink()) return null;
      return join(realpathSync(cur), ...tail);
    }
    const parent = dirname(cur);
    if (parent === cur) break;
    tail.unshift(basename(cur));
    cur = parent;
  }
  return resolve(targetPath);
}

function assertNoChildSymlinks(baseDir, targetPath) {
  const rel = relative(resolve(baseDir), resolve(targetPath));
  if (!rel || rel.startsWith("..") || rel.startsWith(sep) || /^[A-Za-z]:/.test(rel)) return;
  let cur = resolve(baseDir);
  for (const part of rel.split(sep).filter(Boolean)) {
    cur = join(cur, part);
    const st = lstatSync(cur, { throwIfNoEntry: false });
    if (st?.isSymbolicLink()) {
      throw new Error(`Unsafe symlink along destination path: ${cur}`);
    }
  }
}

function isInsideDir(baseDir, targetPath) {
  const baseSt = lstatSync(resolve(baseDir), { throwIfNoEntry: false });
  if (baseSt?.isSymbolicLink()) return false;
  const realBase = realAncestor(baseDir);
  const realTarget = realAncestor(targetPath);
  if (!realBase || !realTarget) return false;
  const rel = relative(realBase, realTarget);
  return rel !== "" && !rel.startsWith("..") && !rel.startsWith(sep) && !/^[A-Za-z]:/.test(rel);
}

export function scanHeavyArtifacts(root, options = {}) {
  const maxSize = options.maxSize ?? 10 * 1024 * 1024; // 10MB default
  const maxAgeDays = options.maxAgeDays ?? 7;
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const skipResolved = options.skipRoot ? resolve(options.skipRoot) : null;

  const candidates = [];
  const ignoreDirs = new Set(["node_modules", ".git", ".venv", "dist", ".gemini", ".ferry_cache"]);

  function walk(dir) {
    if (skipResolved && resolve(dir) === skipResolved) return;
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const e of entries) {
      if (ignoreDirs.has(e)) continue;
      const full = join(dir, e);
      if (skipResolved && resolve(full) === skipResolved) continue;
      let st;
      try {
        st = lstatSync(full);
      } catch {
        continue;
      }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) {
        walk(full);
      } else if (st.isFile()) {
        const ageMs = now - st.mtimeMs;
        if (st.size > maxSize || ageMs > maxAgeMs) {
          candidates.push({
            path: relative(root, full),
            fullPath: full,
            size: st.size,
            mtimeMs: st.mtimeMs,
            ageDays: Math.floor(ageMs / (24 * 60 * 60 * 1000)),
          });
        }
      }
    }
  }

  walk(root);
  return candidates;
}

export function checkGitignoreSafety(root, driveRoot) {
  const gitignorePath = join(root, ".gitignore");
  if (!existsSync(gitignorePath)) return true;

  try {
    const content = readFileSync(gitignorePath, "utf8");
    const relDrive = relative(root, driveRoot).split(sep).join("/");
    const targetPattern = relDrive || ".ferry_cache";
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    const negated = lines.some((l) => l === `!${targetPattern}` || l === "!.ferry_cache" || l === "!.ferry_cache/");
    if (negated) return false;
    return lines.some((l) => l === targetPattern || l === `${targetPattern}/` || l === ".ferry_cache" || l === ".ferry_cache/");
  } catch {
    return true;
  }
}

export async function ferry({ root, rest, apply = false, opts = {} }) {
  const [sub = "status"] = rest;
  const isApply = Boolean(apply || opts?.apply);
  const driveRoot = resolve(process.env.UIKA_DRIVE_ROOT || join(root, ".ferry_cache"));

  if (sub === "status" || sub === "plan") {
    const isIgnored = checkGitignoreSafety(root, driveRoot);
    if (!isIgnored) {
      console.log(`[warning] Drive cache directory "${relative(root, driveRoot) || ".ferry_cache"}" is not listed in .gitignore!`);
    }
    const heavy = scanHeavyArtifacts(root, { ...opts, skipRoot: driveRoot });
    console.log(`Ferry found ${heavy.length} deferred artifact candidates.`);
    for (const h of heavy) {
      console.log(`- [${(h.size / (1024 * 1024)).toFixed(2)} MB, age ${h.ageDays}d] ${h.path}`);
    }
    return { ok: true, candidates: heavy, ignored: isIgnored };
  }

  if (sub === "stage") {
    const driveFolderId = process.env.UIKA_DRIVE_FOLDER_ID;
    if (driveFolderId && !/^[A-Za-z0-9_-]+$/.test(driveFolderId)) {
      throw new Error(`Invalid UIKA_DRIVE_FOLDER_ID format: ${driveFolderId}`);
    }

    const isIgnored = checkGitignoreSafety(root, driveRoot);
    if (!isIgnored) {
      console.log("[warning] Drive cache directory is not in .gitignore. Continuing.");
    }

    const heavy = scanHeavyArtifacts(root, { ...opts, skipRoot: driveRoot });
    for (const h of heavy) {
      const dest = resolve(driveRoot, h.path);
      assertNoChildSymlinks(driveRoot, dest);
      if (!isInsideDir(driveRoot, dest)) {
        throw new Error(`Unsafe stage destination outside drive root: ${h.path}`);
      }
    }

    if (!isApply) {
      console.log(`dry run: would stage ${heavy.length} artifact(s) to ${driveRoot}`);
      for (const h of heavy) {
        console.log(`  would stage ${h.path} (${(h.size / (1024 * 1024)).toFixed(2)} MB)`);
      }
      console.log("dry run; add --apply to stage");
      return { ok: true, dryRun: true, staged: 0, planned: heavy.length, candidates: heavy, driveRoot };
    }

    mkdirSync(driveRoot, { recursive: true });

    const manifestPath = join(driveRoot, "manifest.json");
    const manifestSt = lstatSync(manifestPath, { throwIfNoEntry: false });
    if (manifestSt?.isSymbolicLink()) {
      throw new Error(`Unsafe symlink at ferry manifest: ${manifestPath}`);
    }

    let existingItems = [];
    if (existsSync(manifestPath)) {
      try {
        const prev = JSON.parse(readFileSync(manifestPath, "utf8"));
        if (Array.isArray(prev.items)) existingItems = prev.items;
      } catch {
        existingItems = [];
      }
    }

    const stagedItems = [];
    for (const h of heavy) {
      const srcHash = sha256File(h.fullPath);
      let dest = resolve(driveRoot, h.path);
      assertNoChildSymlinks(driveRoot, dest);
      if (!isInsideDir(driveRoot, dest)) {
        throw new Error(`Unsafe stage destination outside drive root: ${h.path}`);
      }
      let needCopy = true;
      const destSt = lstatSync(dest, { throwIfNoEntry: false });
      if (destSt?.isSymbolicLink()) {
        throw new Error(`Unsafe symlink at stage destination: ${dest}`);
      }
      if (destSt) {
        const destHash = sha256File(dest);
        if (destHash === srcHash) {
          needCopy = false;
        } else {
          dest = resolve(driveRoot, `${h.path}.${srcHash.slice(0, 8)}`);
          assertNoChildSymlinks(driveRoot, dest);
          if (!isInsideDir(driveRoot, dest)) {
            throw new Error(`Unsafe stage destination outside drive root: ${h.path}`);
          }
          const altSt = lstatSync(dest, { throwIfNoEntry: false });
          if (altSt?.isSymbolicLink()) {
            throw new Error(`Unsafe symlink at stage destination: ${dest}`);
          }
        }
      }
      if (needCopy) {
        mkdirSync(dirname(dest), { recursive: true });
        cpSync(h.fullPath, dest);
        const copiedStat = statSync(dest);
        const copiedHash = sha256File(dest);
        if (copiedStat.size !== h.size || copiedHash !== srcHash) {
          throw new Error(`Ferry verification failed for ${h.path}: size or SHA-256 mismatch after copy`);
        }
      }
      stagedItems.push({ path: h.path, dest: relative(driveRoot, dest), size: h.size, sha256: srcHash, fullPath: h.fullPath });
    }

    const byPath = new Map();
    for (const item of existingItems) byPath.set(item.path, item);
    for (const item of stagedItems) {
      byPath.set(item.path, { path: item.path, dest: item.dest, size: item.size, sha256: item.sha256 });
    }
    const merged = {
      stagedAt: new Date().toISOString(),
      items: [...byPath.values()],
    };
    const tmpManifest = `${manifestPath}.tmp.${process.pid}.${randomBytes(4).toString("hex")}`;
    try {
      writeFileSync(tmpManifest, JSON.stringify(merged, null, 2), "utf8");
      renameSync(tmpManifest, manifestPath);
    } catch (err) {
      rmSync(tmpManifest, { force: true });
      throw err;
    }

    for (const item of stagedItems) {
      rmSync(item.fullPath);
    }

    const runner = opts?.execRunner;
    if (driveFolderId) {
      try {
        const filesToUpload = [manifestPath, ...stagedItems.map((i) => join(driveRoot, i.dest))];
        if (runner) {
          console.log(`Uploading Ferry manifest/cache to Google Drive folder ${driveFolderId}...`);
          for (const f of filesToUpload) {
            runner("gdrive", ["upload", "--parent", driveFolderId, f]);
          }
        } else {
          try {
            execFileSync("gdrive", ["--version"], { stdio: ["ignore", "pipe", "ignore"] });
          } catch {
            throw new Error("gdrive CLI is not available on PATH");
          }
          console.log(`Uploading Ferry manifest/cache to Google Drive folder ${driveFolderId}...`);
          for (const f of filesToUpload) {
            execFileSync("gdrive", ["upload", "--parent", driveFolderId, f], { stdio: "inherit" });
          }
        }
      } catch (err) {
        console.log(`gdrive upload hook skipped/warning: ${err.message}`);
      }
    }

    console.log(`Ferry staged ${stagedItems.length} artifacts to ${driveRoot}`);
    return { ok: true, dryRun: false, staged: stagedItems.length, driveRoot };
  }

  if (sub === "restore") {
    const manifestPath = join(driveRoot, "manifest.json");
    if (!existsSync(manifestPath)) {
      console.log("No Ferry manifest found in drive root.");
      return { ok: true, dryRun: !isApply, restored: 0, planned: 0 };
    }

    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch (err) {
      throw new Error(`Failed to parse ferry manifest: ${err.message}`);
    }

    const items = manifest.items ?? [];
    const toRestore = [];
    for (const item of items) {
      const srcDest = resolve(driveRoot, item.dest ?? item.path);
      const targetPath = resolve(root, item.path);
      assertNoChildSymlinks(driveRoot, srcDest);
      assertNoChildSymlinks(root, targetPath);
      if (!isInsideDir(driveRoot, srcDest) || !isInsideDir(root, targetPath)) {
        throw new Error(`Path traversal rejected during ferry restore for "${item.path}"`);
      }
      const targetSt = lstatSync(targetPath, { throwIfNoEntry: false });
      if (targetSt?.isSymbolicLink()) {
        throw new Error(`Unsafe symlink at restore destination: ${item.path}`);
      }
      const srcSt = lstatSync(srcDest, { throwIfNoEntry: false });
      if (srcSt?.isSymbolicLink()) {
        throw new Error(`Unsafe symlink at staged source: ${item.path}`);
      }
      if (!srcSt) {
        console.log(`[warning] Staged artifact missing in drive cache: ${item.path}`);
        continue;
      }
      if (targetSt && !opts?.force) {
        console.log(`[skip] Local file already exists at ${item.path} (pass --force to overwrite)`);
        continue;
      }
      const actualHash = sha256File(srcDest);
      if (actualHash !== item.sha256) {
        throw new Error(`SHA-256 mismatch on restore for ${item.path}: expected ${item.sha256}, got ${actualHash}`);
      }
      toRestore.push({ item, srcDest, targetPath });
    }

    if (!isApply) {
      console.log(`dry run: would restore ${toRestore.length} artifact(s) from ${driveRoot}`);
      for (const r of toRestore) {
        console.log(`  would restore ${r.item.path}`);
      }
      console.log("dry run; add --apply to restore");
      return { ok: true, dryRun: true, restored: 0, planned: toRestore.length };
    }

    let restoredCount = 0;
    for (const { srcDest, targetPath } of toRestore) {
      mkdirSync(dirname(targetPath), { recursive: true });
      cpSync(srcDest, targetPath);
      restoredCount++;
    }

    console.log(`Ferry restored ${restoredCount} artifacts from ${driveRoot}`);
    return { ok: true, dryRun: false, restored: restoredCount };
  }

  throw new Error("usage: ferry status|plan|stage [--apply]|restore [--apply]");
}
