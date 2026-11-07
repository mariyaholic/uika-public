// session.mjs — `uika session check [<repo>] [--stop]` (ADR-0028 §2)
// Checks the session discipline a pushed repo is expected to keep: a handle claimed,
// a handoff block present in WORKSTACK.md, and a LEARNINGS entry at wrap. Usable as a
// Stop hook by any harness: --stop prints the host's hook JSON and blocks at most once.
// Documented ephemeral state: to block only once per session, --stop writes a one-byte sentinel
// `uika_stop_<session>` inside an existing `.git/` directory, or in the OS temp directory when the
// target has no `.git/` directory. It never creates `.git/` and writes nothing else.
import { readFileSync, existsSync, writeFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir, tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { resolveProject } from "./find.mjs";
import { HANDLE } from "./lint.mjs";

const HANDOFF_KEYS = ["From→To", "Done", "Next", "Files", "Verify", "Blockers"];
const MIGRATED = /<!--\s*uika:migrated\s*-->/;
const HANDLE_IN_BLOCK = /^From→To:\s*(\S+)\s*→\s*(\S+)/;

// Pure analysis of a WORKSTACK body — the unit tests drive this directly.
export function analyzeWorkstack(text) {
  const lines = text.split(/\r?\n/);
  let migrated = false;
  const badHandles = [];
  let blocks = 0;
  const handoffs = [];
  let seen;

  for (const raw of lines) {
    const line = raw.replace(/^\s*(?:-\s+)?/, "");
    if (MIGRATED.test(line)) migrated = true;
    const h = line.match(HANDLE_IN_BLOCK);
    if (/^From→To:/.test(line)) {
      blocks++;
      seen = new Set();
      handoffs.push(seen);
      if (!h) badHandles.push("(malformed From→To)");
      else if (!migrated) for (const x of h.slice(1)) if (!HANDLE.test(x)) badHandles.push(x);
    }
    const key = HANDOFF_KEYS.find((k) => new RegExp(`^${k}:\\s*\\S`).test(line));
    if (seen && key) seen.add(key);
    else seen = undefined; // Blank lines, headings, fences and prose end this six-line block.
  }
  return {
    blocks,
    badHandles,
    completeBlock: blocks > 0 && handoffs.every((keys) => keys.size === HANDOFF_KEYS.length),
    hasHandle: /[a-z]+\.[a-z]+/i.test(text),
    migrated,
  };
}

function read(path) {
  try {
    return readFileSync(path, "utf8").replace(/^﻿/, "");
  } catch {
    return "";
  }
}

function readHookPayload() {
  try {
    if (process.stdin.isTTY || process.stdin.destroyed) return {};
    const data = readFileSync(0, "utf8");
    return JSON.parse(data) || {};
  } catch {
    return {};
  }
}

export function runChecks(root) {
  const ws = read(join(root, "WORKSTACK.md"));
  const a = analyzeWorkstack(ws);
  const findings = [];
  if (!a.blocks) findings.push("no handoff block in WORKSTACK.md — write a 6-line From→To block (skills/handoff-protocol)");
  if (a.badHandles.length) findings.push(`handle(s) not <harness>.<role>: ${a.badHandles.join(", ")}`);
  if (a.blocks && !a.completeBlock) findings.push("a handoff block is missing keys — From→To/Done/Next/Files/Verify/Blockers");
  const learnings = join(root, "LEARNINGS.md");
  if (existsSync(learnings)) {
    const body = read(learnings).replace(/^#.*$/gm, "").trim();
    if (!body) findings.push("LEARNINGS.md exists but has no entry for this wrap");
  }
  return { ok: findings.length === 0, findings, analyzed: a };
}

export async function session({ root, rest, opts }) {
  const [sub = "check", repoArg] = rest;
  if (sub !== "check") throw new Error("usage: session check [<repo>] [--stop]");

  let target = root;
  if (repoArg) {
    const hit = resolveProject(root, repoArg);
    if (!hit.length) throw new Error(`unknown project "${repoArg}" (run: uika where)`);
    target = hit[0][1].paths.find(existsSync) ?? hit[0][1].paths[0];
  }

  const { ok, findings } = runChecks(target);

  if (opts.stop) {
    const sid = String(readHookPayload().session_id ?? "nosession");
    const sentinel = stopSentinel(target, sid);
    if (ok) {
      console.log(JSON.stringify({ suppressOutput: true }));
      return;
    }
    if (existsSync(sentinel)) {
      console.log(JSON.stringify({ suppressOutput: true }));
      return;
    }
    try {
      writeFileSync(sentinel, "1", "utf8");
    } catch {
      /* the block is best-effort; never fail the hook on a write error */
    }
    console.log(JSON.stringify({
      decision: "block",
      reason: `Uika session: ${findings.join("; ")}`,
      systemMessage: "Uika: stopping with an unclaimed/unlogged session — protocol reminder sent.",
    }));
    return;
  }

  console.log(`session check: ${target}`);
  if (ok) {
    console.log("ok — handle claimed, handoff block present, learnings in order");
    return;
  }
  for (const f of findings) console.log(`FAIL  ${f}`);
  process.exit(1);
}

export function stopSentinel(target, sid) {
  // Preserve short alphanumeric IDs; hash all others instead of collapsing distinct sessions.
  const keyId = /^[A-Za-z0-9]{1,32}$/.test(sid) ? sid : `sha256-${createHash("sha256").update(String(sid)).digest("hex")}`;
  const gitDir = join(target, ".git");
  let isDir = false;
  try { isDir = statSync(gitDir).isDirectory(); } catch { /* no .git */ }
  if (isDir) return join(gitDir, `uika_stop_${keyId}`);
  const key = createHash("sha256").update(resolve(target)).digest("hex").slice(0, 12);
  return join(tmpdir(), `uika_stop_${key}_${keyId}`);
}
