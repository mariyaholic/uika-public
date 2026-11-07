import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { upsertBlock, lawBlock, placeTokenBridge, BRIDGE_MARKER } from "./adopt.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const B = "<!-- uika:x:begin -->";
const E = "<!-- uika:x:end -->";
const BLOCK = `${B}\nNEW\n${E}`;

test("upsertBlock appends once when no markers exist", () => {
  const out = upsertBlock("hand-written law\n", B, E, BLOCK);
  assert.match(out, /hand-written law/);
  assert.equal((out.match(/<!-- uika:x:begin -->/g) || []).length, 1);
});

test("upsertBlock is idempotent (re-running changes nothing)", () => {
  const once = upsertBlock("hand-written law\n", B, E, BLOCK);
  const twice = upsertBlock(once, B, E, BLOCK);
  assert.equal(once, twice);
});

test("upsertBlock replaces between markers and preserves the rest", () => {
  const text = `before\n${B}\nOLD\n${E}\nafter\n`;
  const out = upsertBlock(text, B, E, BLOCK);
  assert.match(out, /^before\n/);
  assert.match(out, /after\n$/);
  assert.doesNotMatch(out, /OLD/);
  assert.match(out, /NEW/);
});

test("lawBlock carries the law markers and the fingerprint", () => {
  const b = lawBlock(root);
  assert.match(b, /uika:law:begin/);
  assert.match(b, /uika:law:end/);
  assert.match(b, /uika:generated/);
  assert.match(b, /From→To/);
});

// --- token bridge (ADR-0043): five cases + dry-run + estate-source guard ---

const canonPath = join(root, "design", "uika-canonical.css");
const canon = readFileSync(canonPath, "utf8");

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), "uika-bridge-"));
  mkdirSync(join(dir, "design"), { recursive: true });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function capture() {
  const logs = [];
  return { logs, log: (m) => logs.push(m) };
}

test("bridge: absent destination is placed as marker + canon (parents created)", (t) => {
  const dest = join(tempDir(t), "nested", "design", "uika-canonical.css");
  const { logs, log } = capture();
  assert.equal(placeTokenBridge(canonPath, dest, true, log), "placed");
  const got = readFileSync(dest, "utf8");
  assert.ok(got.startsWith(BRIDGE_MARKER), "bridge marker missing");
  assert.equal(got.slice(BRIDGE_MARKER.length), canon);
  assert.match(logs.join("\n"), /PLACED/);
});

test("bridge: marker + canon is idempotent (KEEP, byte-stable)", (t) => {
  const dest = join(tempDir(t), "design", "uika-canonical.css");
  writeFileSync(dest, BRIDGE_MARKER + canon);
  const { logs, log } = capture();
  assert.equal(placeTokenBridge(canonPath, dest, true, log), "kept");
  assert.match(logs.join("\n"), /KEEP.*bridge current/);
});

test("bridge: a bare-canon copy adopts in place (marker added, bytes preserved)", (t) => {
  const dest = join(tempDir(t), "design", "uika-canonical.css");
  writeFileSync(dest, canon);
  const { logs, log } = capture();
  assert.equal(placeTokenBridge(canonPath, dest, true, log), "adopted");
  assert.equal(readFileSync(dest, "utf8").slice(BRIDGE_MARKER.length), canon);
  assert.match(logs.join("\n"), /ADOPTED/);
});

test("bridge: a marked copy diverged from canon is refreshed (canon wins)", (t) => {
  const dest = join(tempDir(t), "design", "uika-canonical.css");
  writeFileSync(dest, BRIDGE_MARKER + canon + "\n--local-drift: red;\n");
  const { logs, log } = capture();
  assert.equal(placeTokenBridge(canonPath, dest, true, log), "refreshed");
  assert.equal(readFileSync(dest, "utf8"), BRIDGE_MARKER + canon, "canon did not win");
  assert.match(logs.join("\n"), /REFRESHED.*canon wins/);
});

test("bridge: an older marker revision still counts as estate-owned (marker drift)", (t) => {
  const dest = join(tempDir(t), "design", "uika-canonical.css");
  const oldMarker = BRIDGE_MARKER.replace("(ADR-0043)", "(ADR-0038)");
  writeFileSync(dest, oldMarker + canon);
  const { logs, log } = capture();
  assert.equal(placeTokenBridge(canonPath, dest, true, log), "refreshed");
  assert.equal(readFileSync(dest, "utf8"), BRIDGE_MARKER + canon, "old marker copy was not brought current");
  assert.match(logs.join("\n"), /REFRESHED/);
});

test("bridge: an unmarked foreign file collides and is never written", (t) => {
  const dest = join(tempDir(t), "design", "uika-canonical.css");
  writeFileSync(dest, ":root { --own: 1px; }\n");
  const { logs, log } = capture();
  assert.equal(placeTokenBridge(canonPath, dest, true, log), "collision");
  assert.equal(readFileSync(dest, "utf8"), ":root { --own: 1px; }\n", "foreign file was clobbered");
  assert.match(logs.join("\n"), /COLLISION/);
});

test("bridge: dry run reports without writing", (t) => {
  const dest = join(tempDir(t), "design", "uika-canonical.css");
  const { logs, log } = capture();
  assert.equal(placeTokenBridge(canonPath, dest, false, log), "placed");
  assert.equal(existsSync(dest), false, "dry run wrote a file");
  assert.match(logs.join("\n"), /would place/);
});

test("bridge: the estate source path is never marker-prefixed (self-adopt guard)", () => {
  const before = readFileSync(canonPath, "utf8");
  const { logs, log } = capture();
  assert.equal(placeTokenBridge(canonPath, canonPath, true, log), "source");
  assert.equal(readFileSync(canonPath, "utf8"), before, "estate source was modified");
  assert.match(logs.join("\n"), /KEEP.*estate source/);
});
