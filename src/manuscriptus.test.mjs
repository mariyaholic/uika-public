// manuscriptus.test.mjs — tests for Manuscriptus ADR linter
import test from "node:test";
import assert from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { parseAdrs, getNextAdrNumber, lintPlainProse, lintGuidebooksProse, manuscriptus } from "./manuscriptus.mjs";

test("manuscriptus parses valid ADRs and calculates next number", () => {
  const tmp = mkdtempSync(join(tmpdir(), "uika-manuscriptus-"));
  try {
    const adrDir = join(tmp, "register/adr");
    mkdirSync(adrDir, { recursive: true });

    writeFileSync(
      join(adrDir, "ADR-0001-test.md"),
      "# ADR-0001: Test ADR\n\nDate: 2026-11-18 · Status: accepted\n\n## Context\nSome context.\n\n## Decision\nOur decision.\n\n## Consequences\nGood ones.\n"
    );

    const { adrs, errors } = parseAdrs(tmp);
    assert.strictEqual(errors.length, 0);
    assert.strictEqual(adrs.length, 1);
    assert.strictEqual(adrs[0].idStr, "0001");
    assert.strictEqual(getNextAdrNumber(tmp), "0002");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("lintPlainProse flags em-dash, negation-first reveal, and significance designation for idNum >= 70 ADRs", () => {
  const content = `# ADR-0070: Test ADR

Date: 2026-11-18 · Status: accepted

## Context
The actual question is the key point. It is not working. The system is broken.
We use an em-dash — here outside code.

## Decision
Decision.

## Consequences
Consequences.
`;

  const warnings = lintPlainProse(content, "register/adr/ADR-0070-test.md");
  assert.ok(warnings.length >= 3);
  assert.ok(warnings.some((w) => w.includes("em-dash")));
  assert.ok(warnings.some((w) => w.includes("negation-first")));
  assert.ok(warnings.some((w) => w.includes("significance")));
});

test("lintPlainProse exempts every heading level and table rows from the em-dash warning", () => {
  const content = [
    "# h1 — separator",
    "",
    "## h2 — separator",
    "",
    "### h3 — separator",
    "",
    "| col | col |",
    "|---|---|",
    "| a | — |",
    "",
    "Prose here — with a dash."
  ].join("\n");

  const warnings = lintPlainProse(content, "docs/guide.md").filter((w) => w.includes("em-dash"));
  assert.strictEqual(warnings.length, 1, warnings.join("\n"));
  assert.match(warnings[0], /:11:/);
});

test("lintGuidebooksProse checks docs and register/guidebooks", () => {
  const tmp = mkdtempSync(join(tmpdir(), "uika-manuscriptus-guides-"));
  try {
    const docsDir = join(tmp, "docs");
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, "guide.md"), "Here is an em-dash — inside docs.\n");

    const warnings = lintGuidebooksProse(tmp);
    assert.ok(warnings.length > 0);
    assert.ok(warnings.some((w) => w.includes("docs/guide.md")));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("getNextAdrNumber with scanRefs discovers unmerged branch ADRs", () => {
  const tmp = mkdtempSync(join(tmpdir(), "uika-manuscriptus-git-"));
  try {
    // execFileSync passes each argument as-is, so no shell quoting is involved and the test
    // behaves the same under cmd.exe on Windows and sh elsewhere.
    const git = (...args) => execFileSync("git", args, { cwd: tmp, stdio: "ignore" });
    git("init");
    git("config", "user.name", "Test");
    git("config", "user.email", "test@example.com");
    writeFileSync(join(tmp, "README.md"), "# Init\n", "utf8");
    git("add", "README.md");
    git("commit", "-m", "init");

    git("checkout", "-b", "feature/adr-80");
    const adrDir = join(tmp, "register/adr");
    mkdirSync(adrDir, { recursive: true });
    writeFileSync(
      join(adrDir, "ADR-0080-branch.md"),
      "# ADR-0080: Branch ADR\n\nDate: 2026-11-18 · Status: proposed\n\n## Context\nC\n\n## Decision\nD\n\n## Consequences\nC\n"
    );
    git("add", "register/adr/ADR-0080-branch.md");
    git("commit", "-m", "add 80");

    try {
      git("checkout", "main");
    } catch {
      try {
        git("checkout", "master");
      } catch {
        git("checkout", "-b", "main");
      }
    }

    const nextNormal = getNextAdrNumber(tmp, { scanRefs: false });
    assert.strictEqual(nextNormal, "0001");

    const nextScanned = getNextAdrNumber(tmp, { scanRefs: true });
    assert.strictEqual(nextScanned, "0081");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("parseAdrs ignores links inside fenced code blocks and rejects links escaping root", () => {
  const tmp = mkdtempSync(join(tmpdir(), "uika-manuscriptus-links-"));
  try {
    const adrDir = join(tmp, "register/adr");
    mkdirSync(adrDir, { recursive: true });
    writeFileSync(join(tmp, "README.md"), "# Root\n", "utf8");
    writeFileSync(
      join(adrDir, "ADR-0002-links.md"),
      "# ADR-0002: Links\n\nDate: 2026-11-18 · Status: accepted\n\n## Context\nSee [readme](../../README.md).\n```md\n[ignored](nonexistent.md)\n```\n\n## Decision\nD\n\n## Consequences\nC\n"
    );
    const clean = parseAdrs(tmp);
    assert.strictEqual(clean.errors.length, 0);

    writeFileSync(
      join(adrDir, "ADR-0003-escape.md"),
      "# ADR-0003: Escape\n\nDate: 2026-11-18 · Status: accepted\n\n## Context\nSee [escape](../../../outside.md).\n\n## Decision\nD\n\n## Consequences\nC\n"
    );
    const escaped = parseAdrs(tmp);
    assert.ok(escaped.errors.some((e) => e.includes("broken relative link")));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
