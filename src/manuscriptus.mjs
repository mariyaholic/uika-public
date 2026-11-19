// manuscriptus.mjs — ADR numbering & markdown linter (uika manuscriptus check|next)
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";

export function lintPlainProse(content, filename) {
  const warnings = [];
  let cleanContent = content
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ""))
    .replace(/`[^`\n]*`/g, "");

  const negMatch = cleanContent.match(/\b(?:is|was|are|were)\s+not\s+[^.!?\n]{1,60}\.\s+(?:It|They|This|That|The\s+\w+)\s+(?:is|was|are|were)\b/gi);
  if (negMatch) {
    for (const m of negMatch) {
      const idx = cleanContent.indexOf(m);
      const lineNum = cleanContent.slice(0, idx).split(/\r?\n/).length;
      warnings.push(`${filename}:${lineNum}: ADR-0062 warning: negation-first reveal pattern`);
    }
  }

  const lines = cleanContent.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (!/^#\s+/.test(line) && /—/.test(line)) {
      warnings.push(`${filename}:${lineNum}: ADR-0062 warning: em-dash ('—') used`);
    }

    if (/\b(?:the\s+actual\s+question|is\s+the\s+key(?:\s+(?:thing|part|point))?|cannot\s+be\s+overstated)\b/i.test(line)) {
      warnings.push(`${filename}:${lineNum}: ADR-0062 warning: significance designation pattern`);
    }
  }
  return warnings;
}

export function lintGuidebooksProse(root) {
  const warnings = [];
  const guideDirs = [
    join(root, "docs"),
    join(root, "register/guidebooks")
  ];
  for (const guideDir of guideDirs) {
    if (!existsSync(guideDir)) continue;
    let files = [];
    try {
      files = readdirSync(guideDir).filter((f) => f.endsWith(".md") && f !== "README.md");
    } catch {
      continue;
    }
    const relSub = relativePathSub(root, guideDir);
    for (const file of files) {
      try {
        const content = readFileSync(join(guideDir, file), "utf8");
        warnings.push(...lintPlainProse(content, `${relSub}/${file}`));
      } catch {
        // ignore
      }
    }
  }
  return warnings;
}

function relativePathSub(root, target) {
  return relative(root, target).replace(/\\/g, "/");
}

export function parseReservedAdrs(root) {
  const reserved = new Set();
  const readmePath = join(root, "register/README.md");
  if (!existsSync(readmePath)) return reserved;

  try {
    const content = readFileSync(readmePath, "utf8");
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      if (/^\|\s*(?:ADR-)?\d{4}/i.test(line)) {
        const parts = line.split("|");
        if (parts.length >= 3) {
          const rangeCol = parts[1].trim();
          const segments = rangeCol.split(",");
          for (const seg of segments) {
            const s = seg.trim();
            const rangeMatch = s.match(/^(?:ADR-)?(\d{4})\s*[–-]\s*(?:ADR-)?(\d{4})$/i);
            if (rangeMatch) {
              const start = parseInt(rangeMatch[1], 10);
              const end = parseInt(rangeMatch[2], 10);
              if (start <= end && (end - start) <= 1000) {
                for (let i = start; i <= end; i++) {
                  reserved.add(String(i).padStart(4, "0"));
                }
              }
            } else {
              const matches = s.match(/\d{4}/g);
              if (matches) {
                for (const m of matches) reserved.add(m);
              }
            }
          }
        }
      }
    }
  } catch { /* ignore */ }
  return reserved;
}

export function parseAdrs(root) {
  const adrDir = join(root, "register/adr");
  if (!existsSync(adrDir)) return { adrs: [], errors: [], warnings: [] };

  const files = readdirSync(adrDir).filter((f) => f.endsWith(".md") && f !== "README.md");
  const adrs = [];
  const errors = [];
  const warnings = [];
  const seenIds = new Set();

  for (const file of files) {
    const match = file.match(/^ADR-(\d{4})-(.*)\.md$/);
    if (!match) {
      errors.push(`invalid ADR filename format: ${file}`);
      continue;
    }
    const idNum = parseInt(match[1], 10);
    const idStr = match[1];
    if (seenIds.has(idStr)) {
      errors.push(`duplicate ADR number: ADR-${idStr}`);
    }
    seenIds.add(idStr);

    const fullPath = join(adrDir, file);
    let content = "";
    try {
      content = readFileSync(fullPath, "utf8");
    } catch (err) {
      errors.push(`cannot read ${file}: ${err.message}`);
      continue;
    }

    const lines = content.split(/\r?\n/);
    const h1Line = lines.find((l) => l.startsWith("# "));
    if (!h1Line || !h1Line.includes(`ADR-${idStr}`)) {
      errors.push(`${file}: H1 header missing or does not match ADR-${idStr}`);
    }

    const topLines = lines.slice(0, 10).join("\n");
    const hasDate = /\bDate\s*:/i.test(topLines);
    const hasStatus = /\bStatus\s*:/i.test(topLines);
    if (!hasDate || !hasStatus) {
      errors.push(`${file}: missing required Date/Status metadata header`);
    }

    const strictSections = idNum >= 70 || (idNum >= 62 && idNum <= 69);
    const hasContext = /^##\s+Context\b/im.test(content) || (!strictSections && /^##\s+(The canon|Evidence)\b/im.test(content));
    const hasDecision = /^##\s+Decision\b/im.test(content) || (!strictSections && /^##\s+Proposed scoped correction\b/im.test(content));
    const hasConsequences = /^##\s+Consequences\b/im.test(content) || (!strictSections && /^##\s+(Verification and limits|Implementation and review gates)\b/im.test(content));

    if (!hasContext) errors.push(`${file}: missing "Context" section`);
    if (!hasDecision) errors.push(`${file}: missing "Decision" section`);
    if (!hasConsequences) errors.push(`${file}: missing "Consequences" section`);

    const absRoot = resolve(root);
    const isInsideRoot = (p) => {
      const r = relative(absRoot, p);
      return r === "" || (!r.startsWith("..") && !r.startsWith(sep) && !/^[A-Za-z]:/.test(r));
    };
    const linkScanContent = content
      .replace(/```[\s\S]*?```/g, "")
      .replace(/~~~[\s\S]*?~~~/g, "");
    const linkRegex = /\[([^\]]+)\]\((?!http|mailto|#)([^)]+)\)/g;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(linkScanContent)) !== null) {
      const linkTarget = linkMatch[2].split("#")[0];
      if (linkTarget) {
        const fromAdr = resolve(adrDir, linkTarget);
        const fromRoot = resolve(absRoot, linkTarget);
        const validAdr = isInsideRoot(fromAdr) && existsSync(fromAdr);
        const validRoot = isInsideRoot(fromRoot) && existsSync(fromRoot);
        if (!validAdr && !validRoot) {
          errors.push(`${file}: broken relative link "${linkMatch[2]}"`);
        }
      }
    }

    if (idNum >= 70) {
      warnings.push(...lintPlainProse(content, `register/adr/${file}`));
    }

    adrs.push({ idNum, idStr, file, content });
  }

  adrs.sort((a, b) => a.idNum - b.idNum);
  return { adrs, errors, warnings };
}

export function getNextAdrNumber(root, { scanRefs = false } = {}) {
  const { adrs } = parseAdrs(root);
  const reserved = parseReservedAdrs(root);

  if (scanRefs) {
    try {
      const refsOut = execFileSync("git", ["-C", root, "for-each-ref", "--format=%(refname:short)"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      const refs = refsOut.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
      for (const ref of refs) {
        if (ref === "HEAD" || ref.endsWith("/HEAD")) continue;
        try {
          const filesOut = execFileSync("git", ["-C", root, "ls-tree", "-r", "--name-only", ref, "--", "register/adr"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
          const files = filesOut.split(/\r?\n/).map((f) => f.trim()).filter(Boolean);
          for (const f of files) {
            const m = f.match(/(?:^|\/)ADR-(\d{4})-.*\.md$/);
            if (m) {
              reserved.add(m[1]);
            }
          }
        } catch {
          // ignore branch missing register/adr
        }
      }
    } catch {
      // not a git repo or git failure
    }
  }

  let maxId = adrs.length > 0 ? Math.max(...adrs.map((a) => a.idNum)) : 0;
  let maxReserved = 0;
  for (const r of reserved) {
    const num = parseInt(r, 10);
    if (!isNaN(num) && num > maxReserved) maxReserved = num;
  }
  let candidate = Math.max(maxId, maxReserved) + 1;
  while (reserved.has(String(candidate).padStart(4, "0")) || adrs.some((a) => a.idNum === candidate)) {
    candidate++;
  }
  return String(candidate).padStart(4, "0");
}

export async function manuscriptus({ root, rest, opts }) {
  const [sub = "check"] = rest;
  const scanRefsFlag = opts?.["scan-refs"] || opts?.scanRefs || false;

  if (sub === "next") {
    const nextNum = getNextAdrNumber(root, { scanRefs: scanRefsFlag });
    console.log(`Next available ADR number: ADR-${nextNum}`);
    return { next: nextNum };
  }

  if (sub === "check") {
    const { adrs, errors, warnings } = parseAdrs(root);
    const guidebookWarnings = lintGuidebooksProse(root);
    const allWarnings = [...warnings, ...guidebookWarnings];

    console.log(`Manuscriptus checked ${adrs.length} ADRs.`);
    if (errors.length > 0) {
      console.log("ADR lint errors found:");
      for (const err of errors) console.log(`- ${err}`);
      if (allWarnings.length > 0) {
        console.log("Warnings:");
        for (const w of allWarnings) console.log(`- ${w}`);
      }
      return { ok: false, errors, warnings: allWarnings, adrs };
    }
    if (allWarnings.length > 0) {
      console.log("Warnings:");
      for (const w of allWarnings) console.log(`- ${w}`);
    }
    console.log("All ADRs pass Manuscriptus checks.");
    return { ok: true, errors: [], warnings: allWarnings, adrs };
  }

  throw new Error("usage: manuscriptus check|next [--scan-refs]");
}
