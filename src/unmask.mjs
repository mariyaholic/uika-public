// unmask.mjs — Implicit state-machine & UI interactibility auditor (uika unmask check [dir] [--json])
import { readFileSync, existsSync, readdirSync, lstatSync } from "node:fs";
import { join, resolve } from "node:path";

export function auditFile(content, filename) {
  const findings = [];
  const lines = content.split(/\r?\n/);

  // Multi-line <button ...> check
  const buttonRe = /<button\b([^>]*)>/gi;
  let btnMatch;
  while ((btnMatch = buttonRe.exec(content)) !== null) {
    const attrs = btnMatch[1] ?? "";
    if (!/onclick|type=|formaction|hx-|@click|v-on:|data-action|id=|aria-controls/i.test(attrs)) {
      const lineNum = content.slice(0, btnMatch.index).split(/\r?\n/).length;
      findings.push({ file: filename, line: lineNum, message: "Button missing click handler, type, or form action" });
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // href="#"
    if (/href\s*=\s*"#"/i.test(line) || /href\s*=\s*'#'/i.test(line)) {
      findings.push({ file: filename, line: lineNum, message: "Inert href=\"#\" link found" });
    }

    // pointer-events: none on non-decorative controls
    if (/pointer-events\s*:\s*none/i.test(line)) {
      const prevLine = i > 0 ? lines[i - 1] : "";
      const isDecorative = /::before|::after|gearwork|veil|backdrop|overlay|aria-hidden/i.test(prevLine + "\n" + line);
      if (!isDecorative) {
        findings.push({ file: filename, line: lineNum, message: "pointer-events: none on control" });
      }
    }

    // Implicit async state overwrite: click/submit/change async listener without abort, generation guard, or try/catch
    if (/\baddEventListener\s*\(\s*['"](?:click|submit|change)['"]\s*,\s*async\b/.test(line)) {
      const windowText = lines.slice(i, Math.min(lines.length, i + 12)).join("\n");
      if (!/disabled|busy|AbortController|generation|inflight|try\s*\{/i.test(windowText)) {
        findings.push({ file: filename, line: lineNum, message: "Async event listener lacks inflight/generation/try guard" });
      }
    }
  }

  // Flag HTML documents that toggle theme/face attributes without prefers-reduced-motion or explicit focus-visible styling
  if (/\.html?$/i.test(filename)) {
    const hasInteractiveControls = /<(button|input|select|textarea)\b/i.test(content);
    if (hasInteractiveControls && !/:focus-visible\b/i.test(content)) {
      findings.push({ file: filename, line: 1, message: "Interactive HTML page missing :focus-visible style rule" });
    }
    if (/@keyframes\b/i.test(content) && !/prefers-reduced-motion/i.test(content)) {
      findings.push({ file: filename, line: 1, message: "Animated HTML page missing prefers-reduced-motion guard" });
    }
  }

  return findings;
}

export function auditDirectory(dir, { includeVendor = false } = {}) {
  const findings = [];
  if (!existsSync(dir)) return findings;

  const stRoot = lstatSync(dir, { throwIfNoEntry: false });
  if (!stRoot || stRoot.isSymbolicLink()) return findings;
  if (stRoot.isFile()) {
    try {
      return auditFile(readFileSync(dir, "utf8"), dir);
    } catch {
      return findings;
    }
  }

  const normalizedRoot = dir.replace(/\\/g, "/").replace(/\/+$/, "");
  const explicitVendor = /(?:^|\/)skills\/vendor(?:\/|$)/.test(normalizedRoot);

  function walk(currentDir) {
    let entries;
    try {
      entries = readdirSync(currentDir);
    } catch {
      return;
    }
    const normCurrent = currentDir.replace(/\\/g, "/").replace(/\/+$/, "");
    for (const e of entries) {
      if (e === "node_modules" || e === ".git" || e === "dist") continue;
      if (!includeVendor && !explicitVendor && e === "vendor" && /(?:^|\/)skills$/.test(normCurrent)) continue;
      if (e === "unmask.mjs" || e.endsWith(".test.mjs")) continue;
      const full = join(currentDir, e);
      let st;
      try {
        st = lstatSync(full);
      } catch {
        continue;
      }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) {
        walk(full);
      } else if (/\.(html|js|ts|mjs)$/i.test(e)) {
        try {
          const content = readFileSync(full, "utf8");
          findings.push(...auditFile(content, full));
        } catch {
          // unreadable
        }
      }
    }
  }

  walk(dir);
  return findings;
}

export async function unmask({ root, rest, opts = {} }) {
  const [sub = "check", ...targets] = rest;
  if (sub !== "check") throw new Error("usage: unmask check [path...] [--json] [--include-vendor]");

  const includeVendor = Boolean(opts?.["include-vendor"]);
  const scanTargets = targets.length > 0 ? targets : [root];
  const findings = [];
  for (const t of scanTargets) {
    const resolved = resolve(root, t);
    findings.push(...auditDirectory(resolved, { includeVendor }));
  }

  if (opts.json) {
    console.log(JSON.stringify(findings, null, 2));
  } else {
    console.log(`Unmask auditor scanned ${scanTargets.length} target(s) and found ${findings.length} UI interactibility issue(s).`);
    for (const f of findings) {
      console.log(`- ${f.file}:${f.line}: ${f.message}`);
    }
  }

  return { ok: findings.length === 0, findings };
}
