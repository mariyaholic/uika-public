// adopt.mjs — `uika adopt <repo> [--apply]` (ADR-0033, ADR-0022, ADR-0043, ADR-0053)
// Repo-profile sync that consumes estate.json distribution.targets and delivers the estate
// law to an operating repo WITHOUT clobbering its hand-maintained lawbook: the law lands in a
// marked, fingerprinted block, idempotent and reversible; everything outside the markers is
// preserved. Dry-run by default; --apply writes.
import { readFileSync, existsSync, writeFileSync, mkdirSync, lstatSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, isAbsolute, dirname, resolve } from "node:path";
import { resolveProject } from "./find.mjs";
import { findSkills, skillCurrent, copySkill } from "./skills.mjs";

export const FINGERPRINT = "<!-- uika:generated from estate.json; edit the source, not this file -->";
export const LAW_BEGIN = "<!-- uika:law:begin -->";
export const LAW_END = "<!-- uika:law:end -->";
export const CLAUDE_BEGIN = "<!-- uika:claude:begin -->";
export const CLAUDE_END = "<!-- uika:claude:end -->";
export const LOCAL_HOMES = [".agents/skills", ".claude/skills", ".codex/skills", ".opencode/skills"];

// Generated blocks carry a docs version + a hash of their own body (ADR-0053). That makes drift
// detectable without a date in the file: an unedited old block compares equal after stripping the
// version line, while any hand edit inside the markers fails the hash and is never silently lost.
export const DOCS_VERSION = "v1";
const sha12 = (s) => createHash("sha256").update(s).digest("hex").slice(0, 12);
export const versionLine = (hash) => `<!-- uika:docs ${DOCS_VERSION} · sha256:${hash} -->`;
export const blockHash = (text) => sha12(text);
function seal(lines) { const body = lines.join("\n"); return [...lines.slice(0, -1), versionLine(sha12(body)), lines.at(-1)].join("\n"); }

// Ownership claim for the distributed token sheet (ADR-0043): a first-line CSS comment marking
// the file as an estate bridge, mirroring ADR-0042's scope rule for lawbooks — marker present
// means estate-owned (refresh wins), no marker means the repo's own file (never clobbered).
export const BRIDGE_MARKER =
  "/* uika:bridge: design/uika-canonical.css — copy of the Uika canon sheet (ADR-0043); edit the estate source, not this file */\n";
// Ownership is the marker PREFIX, not its text. The ADR number inside the marker has already
// drifted once (older adopted repos carry the ADR-0038-era text), and a byte-exact
// match read those estate-owned copies as foreign collisions — so only the stable prefix decides.
export const BRIDGE_MARKER_PREFIX = "/* uika:bridge:";
const sameText = (a, b) => a.replace(/\r\n/g, "\n") === b.replace(/\r\n/g, "\n");

// Place (or refresh) the token bridge in a target repo. Dry-run by default; the estate source is
// never touched. Five cases, each with its own log line — see ADR-0043.
export function placeTokenBridge(source, destFile, apply, log = console.log) {
  if (resolve(source) === resolve(destFile)) { log(`KEEP  ${destFile} (estate source)`); return "source"; }
  const canon = readFileSync(source, "utf8");
  const want = BRIDGE_MARKER + canon;
  const have = existsSync(destFile) ? readFileSync(destFile, "utf8") : null;
  if (have === null) {
    log(`${apply ? "PLACED" : "would place"} ${destFile} (token bridge, ADR-0043)`);
    if (apply) { mkdirSync(dirname(destFile), { recursive: true }); writeFileSync(destFile, want); }
    return "placed";
  }
  if (have === want) { log(`KEEP  ${destFile} (bridge current)`); return "kept"; }
  if (sameText(have, want)) { log(`KEEP  ${destFile} (bridge current; line endings differ)`); return "kept"; }
  if (have === canon || sameText(have, canon)) {
    log(`${apply ? "ADOPTED" : "would adopt"} ${destFile} (estate bytes confirmed; bridge marker added)`);
    if (apply) writeFileSync(destFile, want);
    return "adopted";
  }
  if (have.replace(/^\uFEFF/, "").startsWith(BRIDGE_MARKER_PREFIX)) {
    log(`${apply ? "REFRESHED" : "would refresh"} ${destFile} (diverged from canon: ${have.length} vs ${canon.length} chars; canon wins, ADR-0043)`);
    if (apply) writeFileSync(destFile, want);
    return "refreshed";
  }
  log(`COLLISION ${destFile} — exists without the estate bridge marker and differs from canon; rename it, the bridge was not placed (ADR-0043)`);
  return "collision";
}

export function lawBlock(root) {
  const est = JSON.parse(readFileSync(join(root, "estate.json"), "utf8"));
  const e = est.estate;
  const roles = e.roster?.roles?.join(", ") ?? "tower, scout, impl, review, judge";
  const harnesses = e.roster?.harnesses?.join(", ") ?? "claude, codex, opencode, cline, gemini, commandcode, dsh";
  return seal([
    LAW_BEGIN,
    "## Uika estate law (generated — do not edit inside the markers)",
    "",
    "This repo is part of the Uika estate. The estate layer lives in the harness homes; this",
    "block carries only what every session here must obey. Edit the source (Uika `estate.json`),",
    "never this block; `uika docs render` regenerates it.",
    "",
    `- **Session start:** freshness scan (mtime-first), then read \`WORKSTACK.md\`.`,
    `- **Handoff:** one 6-line block in the WORKSTACK thread — \`From→To / Done / Next / Files / Verify / Blockers\` (skills/handoff-protocol).`,
    `- **Names:** handle \`<harness>.<role>\`; harness ∈ {${harnesses}}; role ∈ {${roles}}. Model is a field, never a name.`,
    `- **Branches:** \`<feat|fix|docs|chore>/<kebab-topic>\`, ≤ 4 words, no agent names. Never push or rewrite main.`,
    `- **Posture:** ${e.posture?.mode ?? "near-autopilot"}, secrets egress-locked, self-edit lock ${e.posture?.selfEditLock ?? "full"}.`,
    `- **Find things:** \`uika find\` / \`uika where\` before exploring; \`uika path\` / \`uika layout\` for where a file goes.`,
    `- **Finish:** run the wrap checklist; update \`WORKSTACK.md\`.`,
    "",
    "Full laws: Uika `AGENTS.md` and `register/adr/`. Skills: skills/handoff-protocol, find-fast, estate-sync.",
    FINGERPRINT,
    LAW_END,
  ]);
}

export function claudeBlock() {
  return seal([
    CLAUDE_BEGIN,
    "@AGENTS.md",
    "",
    "The estate law block is generated inside `AGENTS.md` (markers `uika:law`).",
    FINGERPRINT + " (rendered CLAUDE adapter)",
    CLAUDE_END,
  ]);
}

// Replace the block between markers, or append it once. Never touches text outside the markers.
export function upsertBlock(text, begin, end, block) {
  const i = text.indexOf(begin);
  const j = text.indexOf(end);
  if (i !== -1 && j !== -1 && j > i) return text.slice(0, i) + block + text.slice(j + end.length);
  const sep = text.length && !text.endsWith("\n") ? "\n" : "";
  return text + sep + "\n" + block + "\n";
}

export function resolveTarget(root, arg) {
  if (!arg) throw new Error("usage: adopt <repo> [--apply]");
  if (isAbsolute(arg) || /[\\/]/.test(arg)) {
    if (!existsSync(arg)) throw new Error(`repo not found: ${arg}`);
    return { name: arg, path: arg };
  }
  const hit = resolveProject(root, arg);
  if (!hit.length) throw new Error(`unknown project "${arg}" (run: uika where)`);
  const path = hit[0][1].paths.find(existsSync);
  if (!path) throw new Error(`project "${hit[0][0]}" has no path on disk`);
  return { name: hit[0][0], path };
}

function writeGuarded(file, block, begin, end, apply, log) {
  const before = existsSync(file) ? readFileSync(file, "utf8") : "";
  const after = upsertBlock(before, begin, end, block);
  // A no-op refresh must not touch the file: mtime is the estate's freshness signal (SPEC §1),
  // and a commit hook re-running this on every law commit would otherwise churn adopted repos.
  if (after === before) { log(`KEEP  ${file} (current)`); return; }
  const state = before.includes(begin) ? "refresh" : "insert";
  log(`${apply ? state.toUpperCase() : `would ${state}`}  ${file}`);
  if (apply) writeFileSync(file, after);
}

// Refresh only the injects in an already-adopted repo: the marked law block, the thin CLAUDE
// adapter, and the marked token bridge. Nothing outside the markers is touched. Extracted from
// adopt() so `uika deploy` (ADR-0051) runs the same law refresh without re-doing the WORKSTACK
// seed and the repo-local skill placement.
export function refreshLaw(root, targetPath, apply, log = console.log) {
  writeGuarded(join(targetPath, "AGENTS.md"), lawBlock(root), LAW_BEGIN, LAW_END, apply, log);
  writeGuarded(join(targetPath, "CLAUDE.md"), claudeBlock(), CLAUDE_BEGIN, CLAUDE_END, apply, log);
  const sheetSrc = join(root, "design", "uika-canonical.css");
  if (existsSync(sheetSrc)) placeTokenBridge(sheetSrc, join(targetPath, "design", "uika-canonical.css"), apply, log);
  else log("SKIP  token bridge — design/uika-canonical.css missing in the estate root");
}

export function adoptionSkills(root, targetPath) {
  const skills = findSkills(root);
  // Repo-local harness directories are part of this target, not redirects to another home.
  for (const rel of [...LOCAL_HOMES, "AGENTS.md", "CLAUDE.md", "WORKSTACK.md", "design/uika-canonical.css"]) {
    let current = targetPath;
    for (const part of rel.split("/")) {
      current = join(current, part);
      if (lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error(`unsafe adoption destination link: ${current}`);
    }
  }
  const homes = LOCAL_HOMES.map((h) => join(targetPath, h)).filter((h) => existsSync(dirname(h)) || existsSync(h));
  for (const home of homes) for (const skill of skills) skillCurrent(skill.dir, join(home, skill.name));
  return { skills, homes };
}

export async function adopt({ root, rest, apply, opts }) {
  const dryRun = opts?.["dry-run"] === true || !apply;
  const target = resolveTarget(root, rest[0]);
  const est = JSON.parse(readFileSync(join(root, "estate.json"), "utf8"));
  const { skills, homes } = adoptionSkills(root, target.path);
  const log = (m) => console.log(m);

  const entry = { repo: target.name, path: target.path.replace(/\\/g, "/"), synced: new Date().toISOString().slice(0, 10), concerns: [] };
  const known = (est.estate?.distribution?.targets ?? []).some((t) => t.repo === entry.repo || t.path === entry.path);
  console.log(`adopt ${target.name} -> ${target.path}`);
  console.log(known
    ? "  distribution.targets: already declared"
    : `  distribution.targets: ADD (owner-authorised edit of estate.json):\n    ${JSON.stringify(entry)}`);

  refreshLaw(root, target.path, !dryRun, log);

  const ws = join(target.path, "WORKSTACK.md");
  if (existsSync(ws)) log(`KEEP  ${ws} (ledger exists)`);
  else { log(`${!dryRun ? "WROTE" : "would write"}  ${ws} (empty ledger)`); if (!dryRun) writeFileSync(ws, "# WORKSTACK\n\n## Threads\n- (none open)\n\n## Verification\n- (runbook pending)\n"); }

  for (const h of homes) {
    log(`${!dryRun ? "PLACED" : "would place"} ${skills.length} skills -> ${h}`);
    if (!dryRun) { mkdirSync(h, { recursive: true }); for (const s of skills) copySkill(s.dir, join(h, s.name)); }
  }

  // Token bridge (ADR-0043) is refreshed inside refreshLaw(), above.

  if (dryRun) console.log("\ndry run; add --apply to write. Originals outside the markers are never modified.");
}
