// check.mjs — probe machine posture: runtimes, harness homes, WSL gate, drive space
import os from "node:os";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { resolveEstateRoot } from "./targets.mjs";

// Fallback when estate.json is unreadable; the manifest's harness configHome is the source of truth.
const FALLBACK = {
  opencode: "~/.config/opencode", "claude-code": "~/.claude", codex: "~/.codex", gemini: "~/.gemini",
  cline: "~/.cline", workbuddy: "~/.workbuddy", commandcode: "~/.commandcode", antigravity: "~/.antigravity",
};

function homeDirs(root) {
  const out = {};
  try {
    for (const h of JSON.parse(readFileSync(path.join(root, "estate.json"), "utf8")).estate?.harnesses ?? []) {
      const c = String(h.configHome ?? "");
      const rel = c.startsWith("~") ? c.replace(/^~[\\/]/, "") : (FALLBACK[h.id] ?? "").replace(/^~[\\/]/, "");
      if (rel) out[h.id] = path.join(homedir(), rel);
    }
  } catch { /* fall back */ }
  return Object.keys(out).length ? out : Object.fromEntries(Object.entries(FALLBACK).map(([k, v]) => [k, path.join(homedir(), v.replace(/^~[\\/]/, ""))]));
}

function probe(cmd, args) {
  const fallbacks = {
    gh: ["C:\\Program Files\\GitHub CLI\\gh.exe"],
    pnpm: [`${process.env.APPDATA ?? ""}\\npm\\pnpm.cmd`],
  };
  const candidates = [cmd, ...(fallbacks[cmd] ?? [])];
  for (const c of candidates) {
    try {
      const r = spawnSync(c, args, { encoding: "utf8", windowsHide: true });
      if (r.status === 0) return String(r.stdout).trim().split("\n")[0];
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function check({ root } = {}) {
  const homes = homeDirs(resolveEstateRoot(root));
  const rows = [];
  for (const [name, dir] of Object.entries(homes)) {
    rows.push([name, existsSync(dir) ? "home-present" : "absent", dir]);
  }
  const runtimes = {
    node: probe("node", ["--version"]),
    pnpm: probe("pnpm", ["--version"]),
    python: probe("python", ["--version"]),
    git: probe("git", ["--version"]),
    gh: probe("gh", ["--version"]),
    wsl: probe("wsl", ["--status"]) ? "installed" : "not-installed",
  };
  console.log("== har harness homes ==");
  for (const [n, s, d] of rows) console.log(`${n.padEnd(12)} ${s.padEnd(14)} ${d}`);
  console.log("\n== runtimes ==");
  for (const [n, v] of Object.entries(runtimes)) console.log(`${n.padEnd(8)} ${v ?? "MISSING"}`);
  console.log("\n== posture reminders (estate.json) ==");
  console.log("session: mtime-first freshness scan, then WORKSTACK.md");
  console.log("git: free except main | secrets: egress-locked | self-edit: full lock");
}
