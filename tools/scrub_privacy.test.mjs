// scrub_privacy.test.mjs — the release privacy gate rejects leaks and accepts public metadata.
// Leak fixtures are assembled at runtime so this file itself stays scrub-clean.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PACKAGE_ROOT, PRIVATE_TOKEN_HASHES, PUBLIC_OWNER, packToTemp, scanTarball, scanText, scanTree } from "./scrub_privacy.mjs";

const h16 = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const rules = (findings) => findings.map((f) => f.rule).sort();

test("rejects local paths, emails, secrets and an injected private project name", () => {
  const deny = new Set([h16("zephyrine")]);
  const leaks = [
    "C:/Users/" + "realperson/Desktop/repo",
    "/home/" + "realperson/src",
    "payloads live on " + "D" + ":/library",
    "mail " + "someone" + "@" + "corp.io",
    "token " + "gh" + "p_" + "a".repeat(24),
    "see the Zephyrine repo",
  ].join("\n");
  assert.deepEqual(rules(scanText("src/leak.mjs", leaks, { deny })), ["email-address", "posix-home-path", "private-drive-path", "private-name", "secret-shaped", "windows-user-path"]);
});

test("accepts synthetic fixture paths and placeholder emails", () => {
  const ok = 'const p = "C:/Users/x/Desktop/demo"; // C:\\Users\\...\nuser@example.com\nnpm i -g uika@0.1.0\n@AGENTS.md';
  assert.deepEqual(scanText("src/fixture.test.mjs", ok), []);
});

test("public owner identity is allowed only in metadata files and the canonical repo slug", () => {
  assert.equal(scanText("LICENSE", `Copyright (c) 2026 ${PUBLIC_OWNER}`).length, 0);
  assert.equal(scanText("package.json", `"author": "${PUBLIC_OWNER}"`).length, 0);
  assert.equal(scanText("README.md", `git clone https://github.com/${PUBLIC_OWNER}/uika`).length, 0);
  assert.equal(scanText("schema/estate.schema.json", `"$id": "https://github.com/${PUBLIC_OWNER}/uika/schema"`).length, 0);
  assert.deepEqual(rules(scanText("src/adopt.mjs", `// ${PUBLIC_OWNER} carries the old text`)), ["owner-handle-outside-allowlist"]);
  assert.deepEqual(rules(scanText("README.md", `https://github.com/${PUBLIC_OWNER}/private-estate`)), ["owner-handle-outside-allowlist"]);
});

test("the shipped private-name list is hashed, not plaintext", () => {
  assert.ok(PRIVATE_TOKEN_HASHES.size >= 10);
  for (const h of PRIVATE_TOKEN_HASHES) assert.match(h, /^[0-9a-f]{16}$/);
});

test("tarball scan reads the packed files and catches a leak inside them", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "uika-scrub-fixture-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "lib"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "scrub-fixture", version: "0.0.0", files: ["lib/"] }));
  writeFileSync(join(dir, "lib", "leak.txt"), "C:\\Users\\" + "realperson\\notes\n");
  const tree = scanTree(dir);
  assert.deepEqual(rules(tree.findings), ["windows-user-path"]);
  const p = packToTemp(dir);
  t.after(p.cleanup);
  const res = scanTarball(p.tarball);
  assert.deepEqual(res.findings.map((f) => `${f.file}:${f.rule}`), ["lib/leak.txt:windows-user-path"]);
});

test("this package's source tree and packed tarball are scrub-clean", (t) => {
  const tree = scanTree(PACKAGE_ROOT);
  assert.deepEqual(tree.findings, []);
  const p = packToTemp(PACKAGE_ROOT);
  t.after(p.cleanup);
  const res = scanTarball(p.tarball);
  assert.equal(res.files, p.meta.entryCount, "every packed entry was scanned");
  assert.deepEqual(res.findings, []);
});
