// Internal reference integrity helpers. The supply command is not bundled.
import { lstatSync, readdirSync, openSync, readSync, fstatSync, closeSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, join } from "node:path";

export const RANK = { "client-safe": 0, public: 1, personal: 2 };
export const HASH_VERSION = "sha256-tree-v1";
const SKIP = new Set(["node_modules", ".git", "__pycache__"]);

// Bind types, relative names, empty directories, lengths and file contents.
// Do not follow links or silently omit entries from a verified tree.
export function digest(path) {
  const h = createHash("sha256");
  h.update(`${HASH_VERSION}\n`);
  let files = 0, bytes = 0;
  const walk = (current, rel) => {
    if (SKIP.has(basename(current).toLowerCase())) throw new Error(`excluded reference entry: ${current}`);
    const st = lstatSync(current);
    if (st.isSymbolicLink() || (!st.isFile() && !st.isDirectory())) throw new Error(`unsupported reference entry: ${current}`);
    if (st.isDirectory()) {
      h.update(JSON.stringify(["directory", rel]) + "\n");
      const names = readdirSync(current).sort();
      if (new Set(names.map((name) => name.toLowerCase())).size !== names.length) throw new Error(`portable entry name collision: ${current}`);
      for (const name of names) walk(join(current, name), rel ? `${rel}/${name}` : name);
      return;
    }
    h.update(JSON.stringify(["file", rel, st.size]) + "\n");
    const fd = openSync(current, "r"), buffer = Buffer.allocUnsafe(64 * 1024);
    try {
      const opened = fstatSync(fd);
      if (!opened.isFile() || opened.dev !== st.dev || opened.ino !== st.ino) throw new Error(`reference changed while hashing: ${current}`);
      let read = 0, n;
      while ((n = readSync(fd, buffer, 0, buffer.length, null)) !== 0) { h.update(buffer.subarray(0, n)); read += n; }
      const after = fstatSync(fd), now = lstatSync(current);
      if (read !== st.size || after.size !== st.size || after.mtimeMs !== st.mtimeMs || now.ino !== st.ino || now.dev !== st.dev || now.isSymbolicLink()) throw new Error(`reference changed while hashing: ${current}`);
      files++; bytes += read;
    } finally { closeSync(fd); }
  };
  walk(path, "");
  return { hashVersion: HASH_VERSION, sha256: h.digest("hex"), files, bytes };
}
