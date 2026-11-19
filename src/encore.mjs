// encore.mjs — SIM learnings manager (uika encore ingest|push|pull-github|list|lint|summary) per arXiv:2611.18856v1
import { readFileSync, existsSync, writeFileSync, renameSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { discoverGithubRepos } from "./aurora.mjs";

const VALID_AREAS = new Set(["skills", "video", "deploy", "design", "state-machines", "delegation", "cli", "security", "data"]);
const REPO_SLUG_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

export function parseLearnings(content) {
  const lines = content.split(/\r?\n/);
  const entries = [];
  let current = null;

  for (const line of lines) {
    const headerMatch = line.match(/^###\s+(.+)$/);
    if (headerMatch) {
      if (current) entries.push(current);
      current = { title: headerMatch[1].trim(), raw: [line], area: null, skill: null, fields: {} };
      continue;
    }
    if (current) {
      current.raw.push(line);
      const kvMatch = line.match(/^- \*\*([^:]+):\*\*\s*(.*)$/);
      if (kvMatch) {
        const key = kvMatch[1].toLowerCase().replace(/\s+/g, "-");
        const val = kvMatch[2].trim();
        current.fields[key] = val;
        if (key === "area" && VALID_AREAS.has(val)) {
          current.area = val;
        }
        if (key === "skill") {
          current.skill = val;
        }
      }
    }
  }
  if (current) entries.push(current);
  return entries;
}

export function lintLearnings(content) {
  const entries = parseLearnings(content);
  const errors = [];
  const requiredFields = ["area", "problem-cluster", "root-cause", "rationale", "predicted-vs-observed", "provenance"];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    for (const rf of requiredFields) {
      if (!entry.fields[rf]) {
        errors.push(`Learning entry "${entry.title}" missing required field: **${rf}**`);
      }
    }
    if (entry.fields.area && !VALID_AREAS.has(entry.fields.area)) {
      errors.push(`Learning entry "${entry.title}" has invalid area: "${entry.fields.area}"`);
    }
  }
  return { entries, errors };
}

export function ingestSimContent({ learningsPath, existingContent, incomingContent, apply = true }) {
  const { entries: newEntries, errors } = lintLearnings(incomingContent);
  if (errors.length > 0) {
    throw new Error(`cannot ingest invalid SIM file:\n- ${errors.join("\n- ")}`);
  }
  const existingTitles = new Set(parseLearnings(existingContent).map((e) => e.title.toLowerCase()));
  const freshEntries = newEntries.filter((e) => !existingTitles.has(e.title.toLowerCase()));
  const skipped = newEntries.length - freshEntries.length;
  const byArea = {};
  for (const e of freshEntries) {
    byArea[e.area] = (byArea[e.area] ?? 0) + 1;
  }
  if (freshEntries.length === 0) {
    return { ingested: 0, planned: 0, skipped, byArea: {}, dryRun: !apply };
  }
  if (!apply) {
    return { ingested: 0, planned: freshEntries.length, skipped, byArea, dryRun: true };
  }
  const block = freshEntries.map((e) => e.raw.join("\n")).join("\n\n");
  const sep = existingContent.endsWith("\n") ? "\n" : "\n\n";
  const tmpPath = `${learningsPath}.tmp.${process.pid}.${Date.now()}`;
  try {
    writeFileSync(tmpPath, `${existingContent}${sep}${block}\n`, "utf8");
    renameSync(tmpPath, learningsPath);
  } catch (err) {
    rmSync(tmpPath, { force: true });
    throw err;
  }
  return { ingested: freshEntries.length, planned: freshEntries.length, skipped, byArea, dryRun: false };
}

function defaultExecRunner(cmd, args, options = {}) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
}

export async function encorePush({
  root,
  srcPath,
  repoSlug,
  autoMerge = false,
  apply = false,
  execRunner = defaultExecRunner,
}) {
  const resolvedRepo = repoSlug ?? process.env.UIKA_ESTATE_REPO;
  if (!resolvedRepo) {
    throw new Error("usage: encore push <file> --repo <owner/name> [--auto-merge] [--apply] (or set UIKA_ESTATE_REPO)");
  }
  if (!REPO_SLUG_RE.test(resolvedRepo)) {
    throw new Error(`Invalid repository slug "${resolvedRepo}": expected <owner>/<name>`);
  }
  if (!srcPath || !existsSync(srcPath)) {
    throw new Error("usage: encore push <file> --repo <owner/name> [--auto-merge] [--apply] (or set UIKA_ESTATE_REPO)");
  }
  const incoming = readFileSync(srcPath, "utf8");
  const { entries: validEntries, errors } = lintLearnings(incoming);
  if (errors.length > 0) {
    throw new Error(`cannot push invalid SIM file:\n- ${errors.join("\n- ")}`);
  }
  if (validEntries.length === 0) {
    return { ok: true, dryRun: !apply, pushed: 0, planned: 0, skipped: 0, prUrl: null };
  }
  if (!apply) {
    return { ok: true, dryRun: true, pushed: 0, planned: validEntries.length, skipped: 0, prUrl: null };
  }

  const tmpRoot = mkdtempSync(join(tmpdir(), "uika-encore-push-"));
  const estateDir = join(tmpRoot, "estate");
  const sourceRepo = basename(root);
  const branch = `chore/encore-ingest-${sourceRepo.toLowerCase().replace(/[^a-z0-9._-]+/g, "-")}`;

  try {
    execRunner("gh", ["repo", "clone", resolvedRepo, estateDir, "--", "--depth", "1"]);
    let defaultBranch = "main";
    try {
      const branchOut = execRunner("git", ["-C", estateDir, "symbolic-ref", "--short", "HEAD"]);
      if (branchOut && branchOut.trim()) defaultBranch = branchOut.trim();
    } catch {}

    const targetLearnings = join(estateDir, "register", "LEARNINGS.md");
    if (!existsSync(targetLearnings)) {
      throw new Error(`Target repo ${resolvedRepo} lacks register/LEARNINGS.md`);
    }
    const existingContent = readFileSync(targetLearnings, "utf8");
    const res = ingestSimContent({ learningsPath: targetLearnings, existingContent, incomingContent: incoming, apply: true });
    if (res.ingested === 0) {
      return { ok: true, dryRun: false, pushed: 0, skipped: res.skipped, prUrl: null };
    }

    execRunner("git", ["-C", estateDir, "checkout", "-B", branch]);
    execRunner("git", ["-C", estateDir, "add", "register/LEARNINGS.md"]);
    execRunner("git", ["-C", estateDir, "commit", "-m", `chore(encore): ingest ${res.ingested} SIM learning(s) from ${sourceRepo}`]);
    execRunner("git", ["-C", estateDir, "push", "-f", "origin", branch]);

    const existingPr = execRunner("gh", ["pr", "list", "--repo", resolvedRepo, "--head", branch, "--state", "open", "--json", "url", "--jq", ".[0].url"]).trim();
    const prUrl = existingPr || execRunner("gh", [
      "pr", "create", "--repo", resolvedRepo, "--base", defaultBranch, "--head", branch,
      "--title", `chore(encore): ingest SIM learnings from ${sourceRepo}`,
      "--body", `Automated Encore SIM learning sync from \`${sourceRepo}\` (${res.ingested} new entries, ${res.skipped} duplicate(s) skipped).`,
    ]).trim();

    let merged = false;
    if (autoMerge && prUrl) {
      try {
        execRunner("gh", ["pr", "merge", prUrl, "--repo", resolvedRepo, "--auto", "--squash"]);
        merged = true;
      } catch {
        try {
          execRunner("gh", ["pr", "merge", prUrl, "--repo", resolvedRepo, "--squash"]);
          merged = true;
        } catch {}
      }
    }

    return { ok: true, dryRun: false, pushed: res.ingested, skipped: res.skipped, prUrl, merged };
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

export async function encorePullGithub({
  root,
  repos,
  owner,
  apply = false,
  execRunner = defaultExecRunner,
}) {
  const resolvedOwner = owner ?? process.env.UIKA_GITHUB_OWNER;
  const learningsPath = join(root, "register", "LEARNINGS.md");
  if (!existsSync(learningsPath)) {
    throw new Error("No register/LEARNINGS.md found in estate root");
  }
  if ((!repos || repos.length === 0) && !resolvedOwner) {
    throw new Error("encore pull-github requires --owner <owner> (or UIKA_GITHUB_OWNER) or qualified --repos owner/name");
  }
  const repoList = repos && repos.length > 0 ? repos : discoverGithubRepos({ owner: resolvedOwner, execRunner });
  if (!repoList || repoList.length === 0) {
    throw new Error("encore pull-github requires --owner <owner> (or UIKA_GITHUB_OWNER) or qualified --repos owner/name");
  }

  const slugs = [];
  for (const rawName of repoList) {
    const trimmed = rawName.trim();
    if (!trimmed) continue;
    if (!trimmed.includes("/") && !resolvedOwner) {
      throw new Error("encore pull-github requires --owner <owner> (or UIKA_GITHUB_OWNER) or qualified --repos owner/name");
    }
    const slug = trimmed.includes("/") ? trimmed : `${resolvedOwner}/${trimmed}`;
    if (!REPO_SLUG_RE.test(slug)) {
      throw new Error(`Invalid repository slug "${slug}": expected <owner>/<name>`);
    }
    slugs.push(slug);
  }

  let totalIngested = 0;
  let totalPlanned = 0;
  let totalSkipped = 0;
  const repoResults = [];

  for (const slug of slugs) {
    let fetched = null;
    for (const candidate of ["register/LEARNINGS.md", "LEARNINGS.md"]) {
      try {
        const b64 = execRunner("gh", ["api", `repos/${slug}/contents/${candidate}`, "--jq", ".content"]);
        if (b64 && b64.trim()) {
          fetched = Buffer.from(b64.replace(/\s+/g, ""), "base64").toString("utf8");
          break;
        }
      } catch {}
    }
    if (!fetched || !fetched.includes("<!-- encore:sim -->")) {
      repoResults.push({ repo: slug, ingested: 0, planned: 0, skipped: 0, status: "no-sim" });
      continue;
    }
    const current = readFileSync(learningsPath, "utf8");
    try {
      const res = ingestSimContent({ learningsPath, existingContent: current, incomingContent: fetched, apply });
      totalIngested += res.ingested;
      totalPlanned += res.planned;
      totalSkipped += res.skipped;
      const status = apply
        ? (res.ingested ? "ingested" : "up-to-date")
        : (res.planned ? "planned" : "up-to-date");
      repoResults.push({ repo: slug, ingested: res.ingested, planned: res.planned, skipped: res.skipped, status });
    } catch (err) {
      repoResults.push({ repo: slug, ingested: 0, planned: 0, skipped: 0, status: "invalid", error: err.message });
    }
  }

  const hasInvalid = repoResults.some((r) => r.status === "invalid");
  return { ok: !hasInvalid, dryRun: !apply, totalIngested, totalPlanned, totalSkipped, repoResults };
}

export async function encore({ root, rest, apply = false, opts = {} }) {
  const [sub = "list", filterAreaArg] = rest;
  const isApply = Boolean(apply || opts?.apply);

  if (sub === "push") {
    const srcPath = filterAreaArg ?? (existsSync(join(root, "register", "LEARNINGS.md")) ? join(root, "register", "LEARNINGS.md") : join(root, "LEARNINGS.md"));
    const repoSlug = opts?.repo ?? process.env.UIKA_ESTATE_REPO;
    if (!repoSlug) {
      throw new Error("usage: encore push <file> --repo <owner/name> [--auto-merge] [--apply] (or set UIKA_ESTATE_REPO)");
    }
    const autoMerge = Boolean(opts?.["auto-merge"]);
    const res = await encorePush({ root, srcPath, repoSlug, autoMerge, apply: isApply });
    if (!isApply) {
      console.log(`Encore push dry run (${repoSlug}): would push ${res.planned} SIM entry(s); pass --apply to write.`);
    } else {
      console.log(`Encore push (${repoSlug}): ${res.pushed} pushed, ${res.skipped} duplicate(s) skipped${res.prUrl ? ` -> ${res.prUrl}` : ""}.`);
    }
    return res;
  }

  const learningsPath = join(root, "register/LEARNINGS.md");
  if (!existsSync(learningsPath)) {
    if (opts?.json) {
      console.log(JSON.stringify(sub === "summary" ? { total: 0, byArea: {}, bySkill: {} } : [], null, 2));
    } else {
      console.log("No LEARNINGS.md found at register/LEARNINGS.md");
    }
    return { ok: true, entries: [], errors: [] };
  }

  if (sub === "pull-github") {
    const repos = opts?.repos ? String(opts.repos).split(",").map((s) => s.trim()).filter(Boolean) : undefined;
    const owner = opts?.owner ?? process.env.UIKA_GITHUB_OWNER;
    if ((!repos || repos.length === 0) && !owner) {
      throw new Error("encore pull-github requires --owner <owner> (or UIKA_GITHUB_OWNER) or qualified --repos owner/name");
    }
    const res = await encorePullGithub({ root, repos, owner, apply: isApply });
    if (!isApply) {
      console.log(`Encore pull-github dry run: would ingest ${res.totalPlanned}, ${res.totalSkipped} duplicate(s) skipped; pass --apply to write.`);
    } else {
      console.log(`Encore pull-github complete: ${res.totalIngested} ingested, ${res.totalSkipped} duplicate(s) skipped.`);
    }
    for (const r of res.repoResults) {
      if (r.ingested > 0 || r.planned > 0 || r.status === "invalid") {
        const count = isApply ? r.ingested : r.planned;
        console.log(`  [${r.status}] ${r.repo}: +${count}${r.error ? ` (${r.error})` : ""}`);
      }
    }
    return res;
  }

  const content = readFileSync(learningsPath, "utf8");
  if (sub === "lint") {
    const { entries, errors } = lintLearnings(content);
    console.log(`Encore lint checked ${entries.length} learning entries.`);
    if (errors.length > 0) {
      console.log("Learnings lint errors:");
      for (const e of errors) console.log(`- ${e}`);
      return { ok: false, entries, errors };
    }
    console.log("All learning entries pass SIM validation.");
    return { ok: true, entries, errors: [] };
  }

  if (sub === "summary") {
    const { entries } = lintLearnings(content);
    const byArea = {};
    const bySkill = {};
    for (const e of entries) {
      const a = e.area ?? "unassigned";
      byArea[a] = (byArea[a] ?? 0) + 1;
      if (e.skill) {
        bySkill[e.skill] = (bySkill[e.skill] ?? 0) + 1;
      }
    }
    if (opts?.json) {
      console.log(JSON.stringify({ total: entries.length, byArea, bySkill }, null, 2));
      return { ok: true, total: entries.length, byArea, bySkill };
    }
    console.log(`Encore Summary: total entries = ${entries.length}`);
    console.log("By Area:");
    for (const [a, count] of Object.entries(byArea)) {
      console.log(`  - ${a}: ${count}`);
    }
    if (Object.keys(bySkill).length > 0) {
      console.log("By Skill:");
      for (const [s, count] of Object.entries(bySkill)) {
        console.log(`  - ${s}: ${count}`);
      }
    }
    return { ok: true, total: entries.length, byArea, bySkill };
  }

  if (sub === "list") {
    const { entries } = lintLearnings(content);
    const filterSkill = opts?.skill;
    if (filterAreaArg && !VALID_AREAS.has(filterAreaArg)) {
      throw new Error(`unknown area "${filterAreaArg}". Valid areas: ${[...VALID_AREAS].join(", ")}`);
    }
    let filtered = entries;
    if (filterAreaArg) {
      filtered = filtered.filter((e) => e.area === filterAreaArg);
    }
    if (filterSkill) {
      filtered = filtered.filter((e) => e.skill === filterSkill);
    }
    if (opts?.json) {
      console.log(JSON.stringify(filtered.map((e) => ({ title: e.title, area: e.area, skill: e.skill, fields: e.fields })), null, 2));
      return { ok: true, entries: filtered };
    }
    console.log(`Found ${filtered.length} learning entries${filterAreaArg ? ` in area "${filterAreaArg}"` : ""}${filterSkill ? ` for skill "${filterSkill}"` : ""}:`);
    for (const e of filtered) {
      console.log(`- [${e.area ?? "unassigned"}${e.skill ? ` / ${e.skill}` : ""}] ${e.title}`);
    }
    return { ok: true, entries: filtered };
  }

  if (sub === "ingest") {
    const srcPath = filterAreaArg;
    if (!srcPath || !existsSync(srcPath)) {
      throw new Error("usage: encore ingest <file> [--apply]");
    }
    const incoming = readFileSync(srcPath, "utf8");
    const res = ingestSimContent({ learningsPath, existingContent: content, incomingContent: incoming, apply: isApply });
    if (!isApply) {
      console.log(`Encore ingest dry run: would ingest ${res.planned} SIM entries into register/LEARNINGS.md (${res.skipped} duplicate(s) skipped); pass --apply to write.`);
      return { ok: true, dryRun: true, ingested: 0, planned: res.planned, skipped: res.skipped, byArea: res.byArea };
    }
    if (res.ingested === 0) {
      console.log(`Encore ingest found 0 new SIM entries (${res.skipped} duplicate(s) skipped).`);
      return { ok: true, dryRun: false, ingested: 0, skipped: res.skipped, byArea: {} };
    }
    console.log(`Encore ingested ${res.ingested} SIM entries into register/LEARNINGS.md (${res.skipped} duplicate(s) skipped).`);
    return { ok: true, dryRun: false, ingested: res.ingested, skipped: res.skipped, byArea: res.byArea };
  }

  throw new Error("usage: encore list [area] [--skill <name>] [--json] | summary [--json] | lint | ingest <file> [--apply] | push <file> --repo <owner/name> [--auto-merge] [--apply] | pull-github --owner <owner> | --repos <a,b> [--apply]");
}
