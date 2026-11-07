// sync.mjs — distribute canonical estate configs into an operating repo (ADR-0003)
import { copyFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, isAbsolute } from "node:path";

const FINGERPRINT = "<!-- uika:generated from estate.json; edit the source, not this file -->";

// Marker blocks that adopt (ADR-0033) embeds in a repo's hand-maintained files. The block is
// generated; the file around it is not — and adopt puts THIS SAME fingerprint inside it.
const MARKERS = [
  ["<!-- uika:law:begin -->", "<!-- uika:law:end -->"],
  ["<!-- uika:claude:begin -->", "<!-- uika:claude:end -->"],
];

// Scope decides ownership (ADR-0042): a fingerprint standing free of every marker block means
// sync wrote the whole file and may refresh it; a marker-contained fingerprint means only the
// block is generated, so the file is hand-maintained and must be skipped unless --force.
// An unterminated marker block before the fingerprint counts as contained — a malformed file is
// protected, never clobbered. Without this, `uika sync <repo>` would read adopt's block
// fingerprint as consent and overwrite that repo's entire hand-maintained lawbook.
export function syncGenerated(text) {
  for (let i = text.indexOf(FINGERPRINT); i !== -1; i = text.indexOf(FINGERPRINT, i + 1)) {
    const contained = MARKERS.some(([b, e]) => {
      const bi = text.lastIndexOf(b, i);
      if (bi === -1) return false;
      const ei = text.indexOf(e, bi + b.length);
      return ei === -1 || ei > i;
    });
    if (!contained) return true;
  }
  return false;
}

function renderClaudeAdapter(repo, claudeExtras) {
  const lines = ["@AGENTS.md", ""];
  if (claudeExtras) lines.push(claudeExtras.trim(), "");
  lines.push(`${FINGERPRINT} (rendered CLAUDE adapter)`);
  return lines.join("\n");
}

// Dry run unless `apply`: every WROTE line is printed as "would write" and nothing is written.
export async function sync({ root, rest, force, apply = false }) {
  const [repoArg] = rest;
  if (!repoArg) throw new Error("usage: uika sync <repo-path> [--force] [--apply]");
  const wrote = (file, why) => console.log(`${apply ? "WROTE" : "would write"} ${file} (${why})`);
  const repo = isAbsolute(repoArg) ? repoArg : join(process.cwd(), repoArg);
  if (!existsSync(repo)) throw new Error(`repo not found: ${repo}`);

  const canonical = join(root, "AGENTS.md");
  const manifest = JSON.parse(readFileSync(join(root, "estate.json"), "utf8"));

  const targets = [
    { src: canonical, dest: join(repo, "AGENTS.md") },
  ];

  // AGENTS.md guard: operating repos with a hand-maintained lawbook keep it (ADR-0004:
  // the estate layer lives in harness homes; repo files stay repo-specific). This guard
  // exists because a sync once overwrote a managed repo's own contract.
  const agentsDest = join(repo, "AGENTS.md");
  if (existsSync(agentsDest)) {
    const existing = readFileSync(agentsDest, "utf8");
    const generated = syncGenerated(existing);
    if (!generated && !force) {
      console.log(`SKIP  ${agentsDest} — hand-maintained repo lawbook; estate layer stays in harness homes`);
    } else {
      if (apply) copyFileSync(canonical, agentsDest);
      wrote(agentsDest, generated ? "generated refresh" : "adopted, --force");
    }
  } else {
    if (apply) copyFileSync(canonical, agentsDest);
    wrote(agentsDest, "canonical copy, estate source of truth");
  }
  targets.length = 0; // handled above

  // Claude adapter: thin import (Windows-safe; no symlinks per ADR-0003)
  const claudeEx = manifest.estate.harnesses.find((h) => h.id === "claude-code")?.adapterExtras || "";
  const claudeDest = join(repo, "CLAUDE.md");
  if (existsSync(claudeDest)) {
    const existing = readFileSync(claudeDest, "utf8");
    const generated = syncGenerated(existing);
    if (!generated && !force) {
      console.log(`SKIP  ${claudeDest} — hand-maintained; pass --force to adopt`);
    } else {
      if (apply) writeFileSync(claudeDest, renderClaudeAdapter(repo, claudeEx));
      wrote(claudeDest, generated ? "generated" : "adopted, --force");
    }
  } else {
    if (apply) writeFileSync(claudeDest, renderClaudeAdapter(repo, claudeEx));
    wrote(claudeDest, "generated");
  }

  

  // Codex discovers root AGENTS.md natively — no adapter file is generated (32KiB cap watched by lint).
  // WORKSTACK ledger (ADR-0006)
  const ws = join(repo, "WORKSTACK.md");
  if (!existsSync(ws)) {
    if (apply) writeFileSync(ws, "# WORKSTACK\n\n## Threads\n- (none open)\n\n## Verification\n- (runbook pending)\n");
    wrote(ws, "empty ledger");
  } else {
    console.log(`KEEP  ${ws} (ledger exists)`);
  }

  console.log(apply ? "sync: complete — run the repo's verification suite before trusting the configs" : "sync: dry run; add --apply to write");
}

