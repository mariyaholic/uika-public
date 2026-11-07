// figure.mjs — `uika figure check|render|ls|theme`: a thin CLI over the figure engine that ships in
// `skills/figure-craft/kit/figure.mjs` (one declarative spec -> SVG, HTML, PNG, PDF + an evidence manifest).
//   check <spec>                       compile and run the guards; writes nothing
//   render <spec> [--formats svg,html,png,pdf] [--out dir] [--apply]
//                                      dry run unless --apply; png/pdf need Playwright (detected, never bundled)
//   ls [dir]                           list *.figure.json specs (default: current directory)
//   theme [name]                       list themes, or print one theme's resolved roles
// Tokens: --theme <name> (kit/themes/<name>.json, DTCG) wins; else --tokens <sheet.css> (--face night reads
// :root, --face light reads [data-face="light"]); else <root>/design/uika-canonical.css when present; else the
// engine's built-in fallback palette.
import { chmodSync, existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { compile, figureToHtml, listSpecs, parseTokens, fromDtcg, resolveTheme } from "../skills/figure-craft/kit/figure.mjs";

const KIT_THEMES = join(dirname(fileURLToPath(import.meta.url)), "..", "skills", "figure-craft", "kit", "themes");
const FORMATS = ["svg", "html", "png", "pdf"];
const readJson = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, ""));

// Theme folders, estate copy first so a repo can override a packaged theme.
const themeDirs = (root) => [join(root, "skills", "figure-craft", "kit", "themes"), KIT_THEMES].filter((d, i, a) => existsSync(d) && a.indexOf(d) === i);

export function listThemes(root) {
  const seen = new Map();
  for (const d of themeDirs(root)) for (const f of readdirSync(d).filter((x) => x.endsWith(".json")).sort()) {
    const name = f.slice(0, -5);
    if (!seen.has(name)) seen.set(name, join(d, f));
  }
  return seen;
}

// -> { tokens, fonts, from }
export function loadTokens(root, opts = {}) {
  if (opts.theme) {
    const p = listThemes(root).get(opts.theme);
    if (!p) throw new Error(`unknown theme "${opts.theme}" (see \`uika figure theme\`)`);
    const doc = readJson(p);
    return { tokens: doc.tokens ?? fromDtcg(doc), fonts: doc.fonts, from: p };
  }
  const face = opts.face ?? "night";
  if (!["night", "light"].includes(face)) throw new Error(`--face must be night or light, got "${face}"`);
  const selector = face === "light" ? '[data-face="light"]' : ":root";
  const sheet = opts.tokens ? resolve(opts.tokens) : join(root, "design", "uika-canonical.css");
  if (opts.tokens && !existsSync(sheet)) throw new Error(`token sheet not found: ${opts.tokens}`);
  if (existsSync(sheet)) {
    const tokens = parseTokens(readFileSync(sheet, "utf8"), selector);
    if (face === "light" && !Object.keys(tokens).length) throw new Error(`${sheet} has no [data-face="light"] block`);
    return { tokens, fonts: undefined, from: `${sheet} ${selector}` };
  }
  return { tokens: {}, fonts: undefined, from: "built-in fallback" };
}

function compileSpec(root, file, opts) {
  if (!file) throw new Error("needs a spec file (*.figure.json)");
  if (!existsSync(file)) throw new Error(`spec not found: ${file}`);
  const spec = readJson(file);
  const { tokens, fonts, from } = loadTokens(root, opts);
  return { spec, from, ...compile(spec, { tokens, fonts, root }) };
}

// png/pdf go through a headless browser; detect Playwright without bundling it.
async function playwright(root) {
  let entry;
  try { entry = createRequire(join(root, "package.json")).resolve(join(root, "node_modules", "playwright")); }
  catch (e) { if (e.code !== "MODULE_NOT_FOUND") throw e; }
  let mod;
  if (entry) mod = await import(pathToFileURL(entry).href);
  else {
    try { mod = await import("playwright"); }
    catch (e) {
      if (e.code !== "ERR_MODULE_NOT_FOUND") throw e;
      throw new Error("png/pdf need Playwright, which uika does not bundle: run `npm i -D playwright && npx playwright install chromium` in this project, or ask for --formats svg,html");
    }
  }
  return mod.chromium ? mod : mod.default;
}

export async function figure({ root, rest, apply, opts }) {
  const [sub, arg] = rest;
  if (sub === "check") {
    const { spec, model, from } = compileSpec(root, arg, opts);
    console.log(`OK ${spec.id ?? basename(arg)} · form ${spec.form} · ${model.width}x${model.height} · guards passed · tokens: ${from}`);
    return;
  }
  if (sub === "render") {
    const formats = (opts.formats ?? "svg").split(",").map((s) => s.trim()).filter(Boolean);
    const bad = formats.filter((f) => !FORMATS.includes(f));
    if (bad.length) throw new Error(`unknown format(s) ${bad.join(", ")} (svg|html|png|pdf)`);
    const { spec, svg, manifest, model } = compileSpec(root, arg, opts);
    const id = spec.id ?? basename(arg).replace(/\.figure\.json$/, "");
    if (typeof id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) || id.endsWith(".") || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(id)) throw new Error("figure id must be a safe filename (letters, digits, dot, underscore or hyphen)");
    const outDir = resolve(opts.out ?? dirname(arg));
    const files = [...new Set([`${id}.svg`, `${id}.manifest.json`, ...formats.filter((f) => f !== "svg").map((f) => `${id}.${f}`)])].map((f) => join(outDir, f));
    const needsBrowser = formats.some((f) => f === "png" || f === "pdf");
    if (!apply) {
      console.log(`dry run: guards passed; would write\n${files.map((f) => `  ${f}`).join("\n")}\n(pass --apply to write${needsBrowser ? "; png/pdf need Playwright" : ""})`);
      return;
    }
    const pw = needsBrowser ? await playwright(root) : null;
    // Stage browser work before touching any destination, including when Chromium fails to launch.
    const stage = mkdtempSync(join(tmpdir(), "uika-figure-"));
    try {
      writeFileSync(join(stage, `${id}.svg`), svg);
      writeFileSync(join(stage, `${id}.manifest.json`), JSON.stringify(manifest, null, 2) + "\n");
      if (formats.includes("html")) writeFileSync(join(stage, `${id}.html`), figureToHtml(svg, manifest) + "\n");
      if (pw) {
        const browser = await pw.chromium.launch();
        try {
          const page = await browser.newPage({ viewport: { width: model.width, height: model.height } });
          await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
          if (formats.includes("png")) await page.screenshot({ path: join(stage, `${id}.png`), clip: { x: 0, y: 0, width: model.width, height: model.height } });
          if (formats.includes("pdf")) await page.pdf({ path: join(stage, `${id}.pdf`), width: `${model.width}px`, height: `${model.height}px`, printBackground: true });
        } finally { await browser.close(); }
      }
      // Refuse links before publication. Replacing directory entries instead of truncating
      // existing inodes also preserves hard-link targets and closes final-component link races.
      const modes = new Map();
      for (const f of files) {
        try {
          const old = lstatSync(f);
          if (old.isSymbolicLink()) throw new Error(`refusing symlink output: ${f}`);
          if (!old.isFile()) throw new Error(`output is not a regular file: ${f}`);
          modes.set(f, old.mode & 0o777);
        }
        catch (e) { if (e.code !== "ENOENT") throw e; }
      }
      mkdirSync(outDir, { recursive: true });
      const publication = mkdtempSync(join(outDir, ".uika-figure-"));
      try {
        for (const f of files) {
          const temporary = join(publication, basename(f));
          writeFileSync(temporary, readFileSync(join(stage, basename(f))), { flag: "wx", mode: 0o600 });
          chmodSync(temporary, modes.get(f) ?? (0o666 & ~process.umask()));
        }
        for (const f of files) renameSync(join(publication, basename(f)), f);
      } finally { rmSync(publication, { recursive: true, force: true }); }
    } finally { rmSync(stage, { recursive: true, force: true }); }
    for (const f of files) console.log(`wrote ${f}`);
    return;
  }
  if (sub === "ls") {
    const dir = resolve(arg ?? ".");
    if (!existsSync(dir)) throw new Error(`no such directory: ${arg}`);
    const specs = listSpecs(dir);
    for (const f of specs) {
      let line = f;
      try { const s = readJson(join(dir, f)); line = `${f.padEnd(36)} ${String(s.form ?? "?").padEnd(10)} ${s.title ?? ""}`; } catch { line = `${f}  (unreadable JSON)`; }
      console.log(line);
    }
    console.log(`${specs.length} spec${specs.length === 1 ? "" : "s"} in ${dir}`);
    return;
  }
  if (sub === "theme") {
    const themes = listThemes(root);
    if (!arg) {
      for (const [name, p] of themes) console.log(`${name.padEnd(16)} ${p}`);
      console.log(`${themes.size} themes · use --theme <name> with render/check`);
      return;
    }
    const { tokens, fonts, from } = loadTokens(root, { theme: arg });
    const roles = resolveTheme(tokens, { fonts });
    if (opts.json) { console.log(JSON.stringify(roles, null, 2)); return; }
    console.log(`${arg} — ${from}`);
    for (const [k, v] of Object.entries(roles)) if (typeof v === "string") console.log(`  ${k.padEnd(14)} ${v}`);
    for (const [k, v] of Object.entries(roles.fonts)) console.log(`  font ${k.padEnd(9)} ${v.family}`);
    return;
  }
  throw new Error(`unknown subcommand "${sub ?? ""}" (check|render|ls|theme)`);
}
