// init.mjs — `uika init [<dir>] [--name <name>] [--apply]`
// Bootstrap a fresh, fully compliant Uika estate from scratch in seconds.
import { existsSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveEstateRoot } from "./targets.mjs";

const EXAMPLES = fileURLToPath(new URL("../examples/", import.meta.url));

export async function init({ root, rest, apply = false, force = false, opts = {} }) {
  const targetDir = resolve(rest[0] ?? resolveEstateRoot(root));
  const estateName = opts.name ?? basename(targetDir);

  console.log(`uika init ${apply ? "APPLY" : "plan"}  ${targetDir}`);

  const files = [
    {
      rel: "estate.json",
      content: () => {
        let text = readFileSync(join(EXAMPLES, "estate.example.json"), "utf8");
        try {
          const json = JSON.parse(text);
          if (json.estate) {
            json.estate.name = estateName;
            json.estate.root = targetDir.replace(/\\/g, "/");
          }
          return JSON.stringify(json, null, 2) + "\n";
        } catch {
          return text;
        }
      },
    },
    {
      rel: "AGENTS.md",
      content: () => `# ${estateName} — estate laws
# Target: ≤200 lines when loaded. Enforce by hand per ADR-0002; lint warns on breach.

This repo is ${estateName}: an estate of repositories operated through rostered AI coding harnesses.

## Session start (mandatory)
1. Freshness scan (mtime-first): list the 10-15 most recently modified non-ignored files.
2. Read WORKSTACK.md at the repo root if it exists; it is the ledger of open threads.
3. Confirm which harness you are before writing anything harness-specific.

## Estate layout
- projects/ — project names and paths registry
- skills/ — shared Agent Skills libraries
- data/ — local operational state (git templates, deploy targets)

## Operating posture
- Near-autopilot: read and edit freely inside the sandbox; network egress stays on the allowlist.
- Light-touch secrets: local credential files stay unread/untouched; keys referenced by env-var names.
- Full self-edit lock: never edit any file governing agents without explicit human proposal.
- Git: branch and commit freely; push only to feature branches; never push or rewrite main.
- Verification: run tests and lint checks before declaring done.
`,
    },
    {
      rel: "README.md",
      content: () => `# ${estateName}

An estate layer for AI coding agents across multiple harnesses.

## What / why
${estateName} maintains one canonical lawbook and manifest, generating adapters and fingerprinted law blocks for all managed repositories.

## Requirements
- Node.js >= 22
- Git >= 2.40

## Run
\`\`\`sh
uika check       # verify runtimes & harness homes
uika lint        # audit estate health
uika find        # search across registered projects
\`\`\`

## Layout
- \`estate.json\` — machine manifest
- \`AGENTS.md\` — canonical estate lawbook
- \`projects/\` — projects registry
- \`register/\` — architectural decisions (ADRs) and learnings
- \`references/\` — creative and study reference sets

## Status
Active. Managed by uika.
`,
    },
    {
      rel: "projects/registry.json",
      content: () => JSON.stringify({
        _note: "Project name registry. Lets agents resolve spoken names to real paths.",
        projects: {
          [estateName.toLowerCase()]: {
            paths: [targetDir.replace(/\\/g, "/")],
            aliases: ["estate", "tower", estateName.toLowerCase()],
            default: true,
            audience: "personal"
          }
        }
      }, null, 2) + "\n",
    },
    {
      rel: "register/adr/.gitkeep",
      content: () => "# ADR directory\n",
    },
    {
      rel: "register/LEARNINGS.md",
      content: () => `# ${estateName} · LEARNINGS — verified insights across harnesses

- [${new Date().toISOString().slice(0, 10)}] estate initialized via uika init.
`,
    },
    {
      rel: "references/library.json",
      content: () => JSON.stringify({
        schema: "uika.reference-library.v1",
        root: "./references/store",
        entries: [
          { id: "starter-reference", kind: "themes", title: "Starter Reference", status: "planned", rights: "study-only" }
        ]
      }, null, 2) + "\n",
    },
    {
      rel: "references/store/.gitkeep",
      content: () => "# references store\n",
    },
    {
      rel: "design/uika-canonical.css",
      content: () => `:root {
  --uika-bg-canvas: #121316;
  --uika-fg-primary: #e6e8ee;
  --uika-fg-muted: #8b90a0;
  --uika-accent-gold: #bb9955;
  --uika-border-subtle: #242730;
}
`,
    },
    {
      rel: "WORKSTACK.md",
      content: () => `# ${estateName} · WORKSTACK — ledger of open threads

## Threads
- [open] estate-bootstrap (${new Date().toISOString().slice(0, 10)}, ${estateName.toLowerCase()}.tower): initialize estate layer and adopt first projects.
  \`\`\`
  From→To: user → (owner)
  Done: estate scaffolded with \`uika init\`
  Next: adopt repositories with \`uika adopt <repo> --apply\`
  Files: estate.json, AGENTS.md, projects/registry.json
  Verify: uika check && uika lint
  Blockers: none
  \`\`\`
`,
    }
  ];

  let created = 0;
  let skipped = 0;

  for (const item of files) {
    const fullPath = join(targetDir, item.rel);
    const exists = existsSync(fullPath);

    if (exists && !force) {
      console.log(`  skip  ${item.rel} (already exists; use --force to overwrite)`);
      skipped++;
      continue;
    }

    if (apply) {
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, item.content(), "utf8");
      console.log(`  write ${item.rel}`);
      created++;
    } else {
      console.log(`  would write ${item.rel}`);
      created++;
    }
  }

  if (apply) mkdirSync(join(targetDir, "data", "deploy"), { recursive: true });
  else console.log("  would create data/deploy/");

  console.log(`\n${apply ? "Initialized" : "Plan"}: ${created} file(s) ${apply ? "written" : "to create"}, ${skipped} skipped.`);
  if (!apply) {
    console.log("Run again with --apply to write these files.");
  } else {
    console.log(`\nNext steps:
  1. cd "${targetDir}"
  2. uika check           # verify harness homes & runtimes
  3. uika lint            # audit estate health
  4. uika adopt <project> # adopt your projects into this estate`);
  }
}
