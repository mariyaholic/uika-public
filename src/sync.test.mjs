// sync.test.mjs — regression tests for sync's generated-file guard (ADR-0042).
// The 2026-10-02 bug: adopt embeds the estate fingerprint inside uika:law/uika:claude marker
// blocks in a repo's hand-maintained files, and sync's old `existing.includes(FINGERPRINT)`
// guard read that as consent to overwrite the whole file. Marker-contained must skip;
// free-standing (sync's own output) must still refresh; --force must still adopt.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sync, syncGenerated } from "./sync.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FP = "<!-- uika:generated from estate.json; edit the source, not this file -->";
const CANON = readFileSync(join(root, "AGENTS.md"), "utf8");

const LAW_FILE = `# Project law (hand-maintained above and below the block)\r\n\r\nkeep this line\r\n\r\n<!-- uika:law:begin -->\r\n## Uika estate law (generated)\r\n\r\n- **Finish:** run the wrap checklist.\r\n${FP}\r\n<!-- uika:law:end -->\r\n`;
const CLAUDE_FILE = `# hand-maintained commands\r\n\r\n/project-start\r\n\r\n<!-- uika:claude:begin -->\r\n@AGENTS.md\r\n\r\nThe estate law block is generated inside \`AGENTS.md\` (markers \`uika:law\`).\r\n${FP} (rendered CLAUDE adapter)\r\n<!-- uika:claude:end -->\r\n`;

function tempRepo(files) {
  const dir = mkdtempSync(join(tmpdir(), "uika-sync-test-"));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}

async function runSync(dir, force = false, apply = true) {
  const logs = [];
  const orig = console.log;
  console.log = (...a) => logs.push(a.join(" "));
  try { await sync({ root, rest: [dir], force, apply }); }
  finally { console.log = orig; }
  return logs.join("\n");
}

test("syncGenerated: no fingerprint is not ours", () => {
  assert.equal(syncGenerated("# hand lawbook\nno markers here\n"), false);
});

test("syncGenerated: a marker-contained fingerprint means the BLOCK is generated, not the file", () => {
  assert.equal(syncGenerated(LAW_FILE), false);
  assert.equal(syncGenerated(CLAUDE_FILE), false);
});

test("syncGenerated: a free-standing fingerprint means sync owns the file", () => {
  assert.equal(syncGenerated(`old copy\n${FP}\n`), true);
});

test("syncGenerated: a free fingerprint outside the block wins over a contained one", () => {
  assert.equal(syncGenerated(`${LAW_FILE}hand edit later\n${FP}\n`), true);
});

test("syncGenerated: unterminated marker block before the fingerprint is protected (conservative)", () => {
  assert.equal(syncGenerated(`<!-- uika:law:begin -->\nblock with ${FP}\nno end marker\n`), false);
});

test("sync skips an adopt-ed hand-maintained lawbook and CLAUDE.md (the 2026-10-02 regression)", async (t) => {
  const dir = tempRepo({ "AGENTS.md": LAW_FILE, "CLAUDE.md": CLAUDE_FILE, "WORKSTACK.md": "# WORKSTACK\n" });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const out = await runSync(dir);
  assert.equal(readFileSync(join(dir, "AGENTS.md"), "utf8"), LAW_FILE, "lawbook was clobbered");
  assert.equal(readFileSync(join(dir, "CLAUDE.md"), "utf8"), CLAUDE_FILE, "CLAUDE adapter was clobbered");
  assert.match(out, /SKIP.*AGENTS\.md/);
  assert.match(out, /SKIP.*CLAUDE\.md/);
  assert.match(out, /KEEP.*WORKSTACK\.md/);
});

test("sync still refreshes a file carrying a free-standing fingerprint (sync's own output)", async (t) => {
  const dir = tempRepo({
    "AGENTS.md": `stale generated copy\n${FP}\n`,
    "CLAUDE.md": `@AGENTS.md\n\n${FP} (rendered CLAUDE adapter)\n`,
  });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const out = await runSync(dir);
  assert.equal(readFileSync(join(dir, "AGENTS.md"), "utf8"), CANON, "generated lawbook not refreshed");
  assert.match(readFileSync(join(dir, "CLAUDE.md"), "utf8"), /\(rendered CLAUDE adapter\)/);
  assert.match(out, /WROTE.*AGENTS\.md \(generated refresh\)/);
});

test("--force adopts a marker-contained lawbook (explicit override still works)", async (t) => {
  const dir = tempRepo({ "AGENTS.md": LAW_FILE, "CLAUDE.md": CLAUDE_FILE });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const out = await runSync(dir, true);
  assert.equal(readFileSync(join(dir, "AGENTS.md"), "utf8"), CANON);
  assert.match(out, /WROTE.*AGENTS\.md \(adopted, --force\)/);
});

test("sync seeds a fresh repo: canonical lawbook, thin CLAUDE adapter, empty WORKSTACK", async (t) => {
  const dir = tempRepo({});
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  await runSync(dir);
  assert.equal(readFileSync(join(dir, "AGENTS.md"), "utf8"), CANON);
  assert.match(readFileSync(join(dir, "CLAUDE.md"), "utf8"), /^@AGENTS\.md/);
  assert.match(readFileSync(join(dir, "WORKSTACK.md"), "utf8"), /## Threads/);
});
