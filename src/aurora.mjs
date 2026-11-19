// aurora.mjs — Daily/session-start auto-sync & cross-repo propagation (uika aurora sync|propagate)
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { adopt, FINGERPRINT } from "./adopt.mjs";
import { skillHomes, findSkills } from "./skills.mjs";
import { homeStates } from "./home.mjs";

export const DEFAULT_GITHUB_REPOS = [];

const ENCORE_SIM_HEADER = `<!-- encore:sim -->
# Learnings (Encore SIM Memory, ADR-0071)

New entries follow the Structured Incident Memory schema (\`arXiv:2611.18856v1\`):
\`Area\` (\`skills|video|deploy|design|state-machines|delegation|cli|security|data\`), \`Problem cluster\`, \`Root cause\`, \`Rationale\`, \`Predicted vs observed\`, and \`Provenance\`.

`;

function extractLatestHandoff(text) {
  const lines = text.split(/\r?\n/);
  const idx = lines.findIndex((l) => /^From(?:->|→)To:/i.test(l.trim()));
  if (idx === -1) return null;
  const block = [];
  for (let i = idx; i < Math.min(lines.length, idx + 8); i++) {
    if (!lines[i].trim()) break;
    block.push(lines[i]);
  }
  return block.length >= 2 ? block.join("\n") : null;
}

export async function propagateRepo({ root, targetDir, apply = false, force = false }) {
  const absTarget = resolve(targetDir);
  if (!existsSync(absTarget)) {
    throw new Error(`Target directory does not exist: ${absTarget}`);
  }

  const changes = [];
  const repoName = basename(absTarget);

  // 1. Setlist / Mythologia two-tier Workstack split (ADR-0073)
  const workstackPath = join(absTarget, "WORKSTACK.md");
  const fullWorkstackPath = join(absTarget, "WORKSTACK-FULL.md");
  if (existsSync(workstackPath) && !existsSync(fullWorkstackPath)) {
    const raw = readFileSync(workstackPath, "utf8");
    const lineCount = raw.split(/\r?\n/).length;
    if (lineCount > 120) {
      changes.push({ kind: "workstack-split", file: "WORKSTACK.md", detail: `Split ${lineCount}-line WORKSTACK.md into Setlist (WORKSTACK.md) and Mythologia (WORKSTACK-FULL.md)` });
      if (apply) {
        const handoff = extractLatestHandoff(raw);
        const setlistLines = [
          `# WORKSTACK (${repoName} Setlist, ADR-0073)`,
          "",
          `Active open threads and latest handoff. Full historical archive: [WORKSTACK-FULL.md](./WORKSTACK-FULL.md).`,
          "",
          "## Latest Handoff",
          handoff || "No active handoff block recorded; see WORKSTACK-FULL.md for historical context.",
          "",
        ];
        renameSync(workstackPath, fullWorkstackPath);
        writeFileSync(workstackPath, setlistLines.join("\n"), "utf8");
      }
    }
  }

  // 2. Encore SIM Learnings header (ADR-0071)
  const learningsCandidates = [join(absTarget, "register", "LEARNINGS.md"), join(absTarget, "LEARNINGS.md")];
  const learningsPath = learningsCandidates.find((p) => existsSync(p));
  if (learningsPath) {
    const raw = readFileSync(learningsPath, "utf8");
    if (!raw.includes("<!-- encore:sim -->")) {
      const rel = learningsPath.slice(absTarget.length + 1).replace(/\\/g, "/");
      changes.push({ kind: "encore-sim-header", file: rel, detail: `Prepend Encore SIM schema header to ${rel}` });
      if (apply) {
        writeFileSync(learningsPath, `${ENCORE_SIM_HEADER}${raw}`, "utf8");
      }
    }
  }

  // 3. uika:law AGENTS.md fingerprint sync (when opted in)
  const agentsPath = join(absTarget, "AGENTS.md");
  if (existsSync(agentsPath)) {
    const agentsText = readFileSync(agentsPath, "utf8");
    if (agentsText.includes("uika:law") && !agentsText.includes(FINGERPRINT)) {
      changes.push({ kind: "uika-law-sync", file: "AGENTS.md", detail: "Update uika:law block to current FINGERPRINT" });
      if (apply) {
        await adopt({ root, rest: [absTarget, force ? "--force" : ""].filter(Boolean), apply: true, opts: { force } });
      }
    }
  }

  return { ok: true, targetDir: absTarget, changes, applied: apply };
}

function defaultExecRunner(cmd, args, options = {}) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
}

export async function propagateGithub({
  root,
  repos = DEFAULT_GITHUB_REPOS,
  owner,
  apply = false,
  force = false,
  autoMerge = false,
  execRunner = defaultExecRunner,
}) {
  const resolvedOwner = owner ?? process.env.UIKA_GITHUB_OWNER;
  const workRoot = mkdtempSync(join(tmpdir(), "uika-aurora-gh-"));
  const results = [];
  let failedCount = 0;

  try {
    for (const rawName of repos) {
      const trimmed = rawName.trim();
      if (!trimmed) continue;
      if (!trimmed.includes("/") && !resolvedOwner) {
        throw new Error("propagateGithub requires --owner <owner> (or UIKA_GITHUB_OWNER) or qualified repo names");
      }
      const slug = trimmed.includes("/") ? trimmed : `${resolvedOwner}/${trimmed}`;
      if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(slug)) {
        results.push({ repo: slug, ok: false, error: "Invalid repository slug" });
        failedCount++;
        continue;
      }

      const repoName = slug.split("/")[1];
      const repoDir = join(workRoot, repoName);

      try {
        execRunner("gh", ["repo", "clone", slug, repoDir, "--", "--depth", "1"]);
        let defaultBranch = "main";
        try {
          const branchOut = execRunner("git", ["-C", repoDir, "symbolic-ref", "--short", "HEAD"]);
          if (branchOut && branchOut.trim()) defaultBranch = branchOut.trim();
        } catch {}

        execRunner("git", ["-C", repoDir, "checkout", "-B", "chore/prima-aurora-sync"]);
        const propRes = await propagateRepo({ root, targetDir: repoDir, apply, force });

        let prUrl = null;
        let merged = false;

        if (apply && propRes.changes.length > 0) {
          const statusOut = execRunner("git", ["-C", repoDir, "status", "--porcelain"]);
          if (statusOut && statusOut.trim()) {
            execRunner("git", ["-C", repoDir, "add", "-A"]);
            execRunner("git", ["-C", repoDir, "commit", "-m", "chore(aurora): sync Setlist workstack and Encore SIM header from Uika"]);
            execRunner("git", ["-C", repoDir, "push", "-f", "origin", "chore/prima-aurora-sync"]);

            const existingOut = execRunner("gh", [
              "pr", "list", "--repo", slug, "--head", "chore/prima-aurora-sync", "--state", "open", "--json", "url", "--jq", ".[0].url",
            ]);
            prUrl = existingOut ? existingOut.trim() : "";

            if (!prUrl) {
              const createOut = execRunner("gh", [
                "pr", "create", "--repo", slug, "--base", defaultBranch, "--head", "chore/prima-aurora-sync",
                "--title", "chore(aurora): sync Setlist workstack and Encore SIM header",
                "--body", "Automated Prima Aurora propagation (ADR-0071, ADR-0072, ADR-0073).",
              ]);
              prUrl = createOut ? createOut.trim() : null;
            }

            if (autoMerge && prUrl) {
              try {
                execRunner("gh", ["pr", "merge", prUrl, "--repo", slug, "--auto", "--squash"]);
                merged = true;
              } catch {
                try {
                  execRunner("gh", ["pr", "merge", prUrl, "--repo", slug, "--squash"]);
                  merged = true;
                } catch {}
              }
            }
          }
        }

        results.push({ repo: slug, ok: true, changes: propRes.changes, prUrl, merged });
      } catch (err) {
        failedCount++;
        results.push({ repo: slug, ok: false, error: err.message });
      }
    }
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }

  return { ok: failedCount === 0, applied: apply, autoMerge, failedCount, results };
}

export function discoverGithubRepos({ owner, execRunner = defaultExecRunner } = {}) {
  const resolvedOwner = owner ?? process.env.UIKA_GITHUB_OWNER;
  if (!resolvedOwner) {
    return DEFAULT_GITHUB_REPOS;
  }
  try {
    const out = execRunner("gh", [
      "repo", "list", resolvedOwner, "--no-archived", "--source", "--limit", "200", "--json", "nameWithOwner",
    ]);
    const parsed = JSON.parse(out || "[]");
    const excluded = new Set([`${resolvedOwner}/Uika`, `${resolvedOwner}/uika-public`]);
    const list = parsed.map((r) => r.nameWithOwner).filter((slug) => slug && !excluded.has(slug));
    if (list.length > 0) return list;
  } catch {}
  return DEFAULT_GITHUB_REPOS;
}

export function discoverLocalRepos(root) {
  const seen = new Set();
  const absRoot = resolve(root);
  const dirs = [];
  const addPath = (p) => {
    if (!p || typeof p !== "string") return;
    const abs = resolve(p);
    if (abs === absRoot || seen.has(abs) || !existsSync(abs)) return;
    if (existsSync(join(abs, ".git"))) {
      seen.add(abs);
      dirs.push(abs);
    }
  };

  try {
    const estate = JSON.parse(readFileSync(join(root, "estate.json"), "utf8"));
    for (const t of estate.estate?.distribution?.targets ?? []) addPath(t.path);
  } catch {}
  try {
    const reg = JSON.parse(readFileSync(join(root, "projects", "registry.json"), "utf8"));
    for (const entry of Object.values(reg.projects ?? {})) {
      for (const p of entry.paths ?? []) addPath(p);
    }
  } catch {}
  return dirs;
}

export async function aurora({ root, rest, opts }) {
  const [sub = "sync"] = rest;
  if (sub === "propagate") {
    const apply = Boolean(opts?.apply);
    const force = Boolean(opts?.force);
    const autoMerge = Boolean(opts?.["auto-merge"]);
    const allMode = Boolean(opts?.all);
    const owner = opts?.owner ?? process.env.UIKA_GITHUB_OWNER;

    if (allMode || opts?.github || opts?.repos) {
      let localResults = [];
      if (allMode) {
        for (const dir of discoverLocalRepos(root)) {
          const r = await propagateRepo({ root, targetDir: dir, apply, force });
          localResults.push(r);
          console.log(`[local:${r.changes.length ? (apply ? "applied" : "planned") : "clean"}] ${r.targetDir}: ${r.changes.length} change(s)`);
        }
      }

      const repoList = opts?.repos
        ? String(opts.repos).split(",").map((s) => s.trim()).filter(Boolean)
        : discoverGithubRepos({ owner });
      const res = await propagateGithub({ root, repos: repoList, owner, apply, force, autoMerge });
      for (const item of res.results) {
        if (!item.ok) {
          console.log(`[error] ${item.repo}: ${item.error}`);
        } else {
          const suffix = item.prUrl ? ` -> ${item.prUrl}${item.merged ? " (merged)" : ""}` : "";
          console.log(`[${item.changes.length ? (apply ? "applied" : "planned") : "clean"}] ${item.repo}: ${item.changes.length} change(s)${suffix}`);
        }
      }
      return { ...res, localResults };
    }

    const targetDir = opts?.target ?? rest[1];
    if (!targetDir) throw new Error("usage: aurora propagate (--target <dir> | --github | --all [--repos a,b] [--auto-merge]) [--apply] [--force]");
    const res = await propagateRepo({ root, targetDir, apply, force });
    console.log(`Aurora propagate (${res.targetDir}, apply: ${res.applied}): ${res.changes.length} change(s).`);
    for (const c of res.changes) {
      console.log(`  [${res.applied ? "applied" : "planned"}] ${c.kind}: ${c.detail}`);
    }
    return res;
  }
  if (sub !== "sync") throw new Error("usage: aurora sync [--apply] [--force] | aurora propagate (--target <dir> | --github | --all) [--apply] [--force]");

  const apply = Boolean(opts.apply);
  const force = Boolean(opts.force);

  console.log(`Aurora checking estate synchronization (apply: ${apply}, force: ${force})...`);

  let driftCount = 0;
  let failedCount = 0;

  const strictPaths = Boolean(opts?.["strict-paths"] || process.env.UIKA_STRICT_PATHS === "1");
  const skipWindows = process.platform !== "win32" && !strictPaths;
  const isWinPath = (p) => typeof p === "string" && (/^[A-Za-z]:(?:[/\\]|$)/.test(p) || /^\\\\[^\\]/.test(p));

  // 1. Repo distribution targets in estate.json
  const estatePath = join(root, "estate.json");
  if (existsSync(estatePath)) {
    let estate;
    try {
      estate = JSON.parse(readFileSync(estatePath, "utf8"));
      const targets = estate.estate?.distribution?.targets ?? [];
      for (const t of targets) {
        if (!t.path || !existsSync(t.path)) {
          if (skipWindows && isWinPath(t.path)) continue;
          console.log(`[drift] Target "${t.repo}" path missing: ${t.path}`);
          driftCount++;
          continue;
        }
        const agentsPath = join(t.path, "AGENTS.md");
        const hasAgents = existsSync(agentsPath);
        const agentsText = hasAgents ? readFileSync(agentsPath, "utf8") : "";
        const isStale = !hasAgents || (agentsText.includes("uika:law") && !agentsText.includes(FINGERPRINT));
        if (isStale) {
          console.log(`[drift] Target "${t.repo}" ${hasAgents ? "has drifted AGENTS.md" : "lacks AGENTS.md"}`);
          driftCount++;
          if (apply) {
            console.log(`Applying adoption to ${t.repo}...`);
            try {
              await adopt({ root, rest: [t.repo, force ? "--force" : ""].filter(Boolean), apply: true, opts: { force } });
            } catch (err) {
              failedCount++;
              console.log(`Adoption failed for ${t.repo}: ${err.message}`);
            }
          }
        }
      }
    } catch (err) {
      console.log(`Failed to parse estate.json: ${err.message}`);
      failedCount++;
    }
  }

  // 2. Local harness skill homes drift (only check initialized skill homes)
  try {
    const homes = skillHomes(root);
    const sourceSkills = findSkills(root);
    for (const h of homes) {
      const homeDir = typeof h === "string" ? h : h.homeDir;
      if (homeDir && existsSync(homeDir)) {
        for (const s of sourceSkills) {
          const targetSkillFile = join(homeDir, s.name, "SKILL.md");
          const sourceContent = readFileSync(join(s.dir, "SKILL.md"), "utf8");
          if (!existsSync(targetSkillFile)) {
            console.log(`[drift] Skill home missing skill "${s.name}" at ${targetSkillFile}`);
            driftCount++;
          } else {
            const targetContent = readFileSync(targetSkillFile, "utf8");
            if (targetContent !== sourceContent) {
              console.log(`[drift] Skill home drifted for skill "${s.name}" at ${targetSkillFile}`);
              driftCount++;
            }
          }
        }
      }
    }
  } catch (err) {
    console.log(`Skill homes check warning: ${err.message}`);
  }

  // 3. Home status parity (homeStates)
  try {
    const homeDir = opts?.homeDir ?? undefined;
    const states = homeStates({ root, ...(homeDir ? { home: homeDir } : {}) });
    for (const st of states) {
      if (st.state !== "current") {
        console.log(`[drift] Home state parity issue for ${st.id} at ${st.file} (state: ${st.state}) — advisory only`);
        driftCount++;
      }
    }
  } catch (err) {
    console.log(`Home states check warning: ${err.message}`);
  }

  console.log(`Aurora sync complete. Drift items detected: ${driftCount}, failures: ${failedCount}`);
  return { ok: failedCount === 0, driftCount, failedCount, drift: driftCount > 0 };
}
