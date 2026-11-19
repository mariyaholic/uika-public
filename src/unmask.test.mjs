// unmask.test.mjs — tests for Unmask UI & implicit state-machine auditor
import test from "node:test";
import assert from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { auditFile, auditDirectory } from "./unmask.mjs";

test("auditFile detects buttons without handlers, inert hrefs, and missing focus-visible", () => {
  const html = `<!doctype html><html><body>
    <button>Inert Button</button>
    <a href="#">Inert Link</a>
  </body></html>`;

  const findings = auditFile(html, "test.html");
  assert.ok(findings.some((f) => f.message.includes("Button missing")));
  assert.ok(findings.some((f) => f.message.includes("Inert href")));
  assert.ok(findings.some((f) => f.message.includes("focus-visible")));
});

test("auditFile detects unguarded async click listeners and missing reduced-motion", () => {
  const html = `<style>@keyframes pulse { to { opacity: 0.5; } }</style>
    <button type="button" id="go">Go</button>
    <script>
      go.addEventListener("click", async () => {
        await fetch("/api");
      });
    </script>`;

  const findings = auditFile(html, "app.html");
  assert.ok(findings.some((f) => f.message.includes("Async event listener")));
  assert.ok(findings.some((f) => f.message.includes("prefers-reduced-motion")));
});

test("auditFile allows guarded controls and decorative pseudo-element pointer-events", () => {
  const html = `<style>
    button:focus-visible { outline: 2px solid gold; }
    .masthead::before { pointer-events: none; }
    @media (prefers-reduced-motion: reduce) { * { animation: none; } }
  </style>
  <button type="button" id="faceBtn">Toggle</button>`;

  const findings = auditFile(html, "clean.html");
  assert.strictEqual(findings.length, 0);
});

test("auditDirectory skips skills/vendor/ by default and includes it when includeVendor is true", () => {
  const tmp = mkdtempSync(join(tmpdir(), "uika-unmask-"));
  try {
    const vendorDir = join(tmp, "skills/vendor");
    mkdirSync(vendorDir, { recursive: true });
    writeFileSync(join(vendorDir, "bad.html"), "<button>Bad</button>", "utf8");

    const defaultFindings = auditDirectory(tmp);
    assert.strictEqual(defaultFindings.length, 0);

    const includedFindings = auditDirectory(tmp, { includeVendor: true });
    assert.ok(includedFindings.length > 0);
    assert.ok(includedFindings.some((f) => f.file.includes("bad.html")));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("auditDirectory skips symlinks cleanly", () => {
  const tmp = mkdtempSync(join(tmpdir(), "uika-unmask-sym-"));
  try {
    const sub = join(tmp, "sub");
    mkdirSync(sub, { recursive: true });
    writeFileSync(join(sub, "ok.html"), "<button type=\"button\">Ok</button><style>button:focus-visible{}</style>", "utf8");
    symlinkSync(tmp, join(sub, "loop"));
    const outside = join(tmp, "outside.html");
    writeFileSync(outside, "<button>Bad</button>", "utf8");
    symlinkSync(outside, join(sub, "linked.html"));

    const findings = auditDirectory(sub);
    assert.strictEqual(findings.length, 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
