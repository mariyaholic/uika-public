import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeWorkstack, runChecks, stopSentinel } from "./session.mjs";

const BLOCK = [
  "From→To: claude.impl → codex.review   model: sonnet",
  "Done: wrote the thing",
  "Next: review it",
  "Files: src/session.mjs",
  "Verify: node --test src",
  "Blockers: none",
].join("\n");

test("analyzeWorkstack accepts a complete handle-shaped block", () => {
  const a = analyzeWorkstack("# WORKSTACK\n\n" + BLOCK + "\n");
  assert.equal(a.blocks, 1);
  assert.equal(a.completeBlock, true);
  assert.deepEqual(a.badHandles, []);
});

test("analyzeWorkstack flags a non-<harness>.<role> handle", () => {
  const a = analyzeWorkstack("From→To: opus-5-48 → claude.tower\nDone: x\n");
  assert.deepEqual(a.badHandles, ["opus-5-48"]);
});

test("analyzeWorkstack grandfathers the migrated section", () => {
  const text = "<!-- uika:migrated -->\nFrom→To: opus-5-48 → claude.tower\nDone: x\n";
  const a = analyzeWorkstack(text);
  assert.equal(a.migrated, true);
  assert.deepEqual(a.badHandles, []);
});

test("analyzeWorkstack reports an incomplete block", () => {
  const a = analyzeWorkstack("From→To: claude.impl → codex.review\nDone: x\n");
  assert.equal(a.blocks, 1);
  assert.equal(a.completeBlock, false);
});

test("runChecks passes a compliant repo", () => {
  const dir = mkdtempSync(join(tmpdir(), "uika-session-"));
  writeFileSync(join(dir, "WORKSTACK.md"), "# WORKSTACK\n\n" + BLOCK + "\n");
  assert.equal(runChecks(dir).ok, true);
});

test("runChecks fails a repo with no handoff block", () => {
  const dir = mkdtempSync(join(tmpdir(), "uika-session-"));
  writeFileSync(join(dir, "WORKSTACK.md"), "# WORKSTACK\n\n## Threads\n- [open] x\n");
  const r = runChecks(dir);
  assert.equal(r.ok, false);
  assert.match(r.findings.join(" "), /no handoff block/);
});

test("handoff completeness is checked per block, including Markdown list indentation", () => {
  const split = "From→To: codex.impl → codex.review\nDone: first\n\nFrom→To: codex.review → codex.impl\nNext: second\nFiles: x\nVerify: x\nBlockers: none\n";
  assert.equal(analyzeWorkstack(split).completeBlock, false);
  assert.equal(analyzeWorkstack(BLOCK + "\n\n" + split).completeBlock, false);
  const indented = BLOCK.split("\n").map((line, i) => `${i ? "  " : "- "}${line}`).join("\n");
  assert.equal(analyzeWorkstack(indented).completeBlock, true);
});

test("stop sentinel identities preserve punctuation and long session suffixes", () => {
  const target = tmpdir();
  assert.notEqual(stopSentinel(target, "a-b"), stopSentinel(target, "ab"));
  assert.notEqual(stopSentinel(target, "x".repeat(40) + "1"), stopSentinel(target, "x".repeat(40) + "2"));
  assert.equal(stopSentinel(target, "a-b"), stopSentinel(target, "a-b"));
});

test("malformed handoffs and unrelated sections cannot complete a session", () => {
  const malformed = analyzeWorkstack(BLOCK + "\nFrom→To: codex.review →\nDone: partial\n");
  assert.equal(malformed.blocks, 2);
  assert.equal(malformed.completeBlock, false);
  assert.deepEqual(malformed.badHandles, ["(malformed From→To)"]);
  const borrowed = "From→To: codex.impl → codex.review\nDone: partial\n\n## Other\nNext: later\nFiles: x\nVerify: y\nBlockers: none\n";
  assert.equal(analyzeWorkstack(borrowed).completeBlock, false);
  assert.equal(analyzeWorkstack(BLOCK.replace("Done: wrote the thing", "Done:")).completeBlock, false);
});

test("Stop hook blocks once per exact session ID and separates punctuation variants", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "uika-stop-lifecycle-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, ".git"));
  const cli = fileURLToPath(new URL("../bin/uika.mjs", import.meta.url));
  const call = (id) => {
    const result = spawnSync(process.execPath, [cli, "session", "check", "--stop", "--root", dir], { input: JSON.stringify({ session_id: id }), encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  assert.equal(call("a-b").decision, "block");
  assert.equal(call("a-b").suppressOutput, true);
  assert.equal(call("ab").decision, "block");
  assert.equal(call("ab").suppressOutput, true);
});
