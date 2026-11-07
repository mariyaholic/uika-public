// video.mjs — `uika video ls|qa|sheet|frame|structure|diff|prompt lint`: generic film checks over ffmpeg/ffprobe.
// ffmpeg is an external tool: uika never bundles it. It is found on PATH, or at UIKA_FFMPEG / UIKA_FFPROBE, and
// every subcommand that needs it fails with an install hint when it is missing. `ls`, `diff` and `prompt lint` need
// no ffmpeg. Commands that write a file (sheet, frame, structure --out) are dry runs unless --apply.
//   ls <dir> [--since 3d] [--deep] [--json]        films breadth-first, newest first; media/ pruned unless --deep
//   qa <file> [--expect-duration s] [--against twin] [--json]
//                                                   streams, decode errors, frame count, duration, loudness,
//                                                   true peak, loudness range, silent stretches, twin comparison
//   sheet <file> [--at 5,20,end-3] [--out f.png] [--apply]        contact sheet (12 frames, 4 columns, by default)
//   frame <file> <t|end-N> [--crop w:h:x:y] [--width 960] [--out f.png] [--apply]
//   structure <file> [--threshold 0.3] [--out profile.json] [--apply]   scene-cut profile (cuts, shot statistics)
//   diff <a.json> <b.json> [--json]                compare two structure profiles; exits 1 on a clone (< 2 axes differ)
//   prompt lint <pack.vprompt.md> [--json]         machine-checkable subset of the video-prompt closure rules
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { window } from "./find.mjs";

export const VIDEO_EXT = new Set([".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi"]);
export const STRUCTURE_SCHEMA = "uika.video-structure.v1";
const PRUNE = new Set([".git", "node_modules", "__pycache__"]);

// ------------------------------------------------------------------ tools --

function tool(name) {
  const env = name === "ffmpeg" ? "UIKA_FFMPEG" : "UIKA_FFPROBE";
  return process.env[env] || name;
}

// Runs ffmpeg/ffprobe with an argv array (no shell). A missing binary becomes one clear error.
export function runTool(name, args) {
  const bin = tool(name);
  const r = spawnSync(bin, args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, windowsHide: true });
  if (r.error && (r.error.code === "ENOENT" || r.error.code === "EACCES")) {
    throw new Error(`${name} not found (looked for "${bin}"): install ffmpeg (https://ffmpeg.org/download.html) so ${name} is on PATH, or set ${name === "ffmpeg" ? "UIKA_FFMPEG" : "UIKA_FFPROBE"} to its full path`);
  }
  if (r.error) throw r.error;
  return r;
}

function probe(file) {
  if (!existsSync(file)) throw new Error(`no such file: ${file}`);
  const r = runTool("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]);
  if (r.status !== 0) throw new Error(`ffprobe could not read ${file}: ${(r.stderr || "").trim().split("\n")[0]}`);
  const j = JSON.parse(r.stdout);
  const v = (j.streams ?? []).find((s) => s.codec_type === "video");
  const a = (j.streams ?? []).find((s) => s.codec_type === "audio");
  const duration = Number(j.format?.duration ?? v?.duration ?? 0);
  const [num, den] = String(v?.avg_frame_rate && v.avg_frame_rate !== "0/0" ? v.avg_frame_rate : v?.r_frame_rate ?? "0/1").split("/").map(Number);
  return { video: v, audio: a, duration, fps: den ? num / den : 0, size: Number(j.format?.size ?? 0), width: v?.width, height: v?.height };
}

// "12.5" | "end" | "end-3" -> seconds (clamped inside the film)
export function parseTime(s, duration) {
  const m = String(s).trim().match(/^end(?:-(\d+(?:\.\d+)?))?$/);
  let t;
  if (m) t = duration - Number(m[1] ?? 0);
  else if (/^\d+(?:\.\d+)?$/.test(String(s).trim())) t = Number(s);
  else throw new Error(`time must be seconds (12.5), end, or end-N, got "${s}"`);
  if (t > duration) throw new Error(`time ${s} is past the end (${duration.toFixed(3)} s)`);
  return Math.max(0, Math.min(t, Math.max(0, duration - 0.05)));
}

function writeGate(apply, files) {
  if (apply) return true;
  console.log(`dry run: would write\n${files.map((f) => `  ${f}`).join("\n")}\n(pass --apply to write)`);
  return false;
}

// --------------------------------------------------------------------- ls --

export function listVideos(dir, { since, deep = false } = {}) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error(`no such directory: ${dir}`);
  const [from, to] = window({ since });
  const out = [];
  const queue = [dir];
  while (queue.length) {
    const d = queue.shift();
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)); } catch { continue; }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) { if (!PRUNE.has(e.name) && (deep || e.name !== "media")) queue.push(p); continue; }
      if (!VIDEO_EXT.has(extname(e.name).toLowerCase())) continue;
      const st = statSync(p);
      if (st.mtimeMs >= from && st.mtimeMs < to) out.push({ path: p, bytes: st.size, mtime: new Date(st.mtimeMs).toISOString() });
    }
  }
  return out.sort((a, b) => b.mtime.localeCompare(a.mtime) || a.path.localeCompare(b.path));
}

// --------------------------------------------------------------------- qa --

const num = (re, s) => { const m = [...s.matchAll(re)].pop(); return m ? (m[1] === "-inf" ? -Infinity : Number(m[1])) : null; };

export function qaFile(file, { expectDuration, against, targetLufs = -14 } = {}) {
  const p = probe(file);
  const checks = [];
  const add = (level, name, detail) => checks.push({ level, name, detail });
  add(p.video ? "PASS" : "FAIL", "video stream", p.video ? `${p.video.codec_name} ${p.width}x${p.height} @ ${p.fps.toFixed(3)} fps` : "none");
  add(p.audio ? "PASS" : "WARN", "audio stream", p.audio ? `${p.audio.codec_name} ${p.audio.sample_rate} Hz ${p.audio.channels} ch` : "none (silent film?)");
  add(p.size > 0 ? "PASS" : "FAIL", "size", `${p.size} bytes`);
  if (p.video) {
    const r = runTool("ffmpeg", ["-hide_banner", "-nostats", "-v", "error", "-progress", "pipe:1", "-i", file, "-map", "0:v:0", "-f", "null", "-"]);
    const errors = (r.stderr || "").trim().split("\n").filter(Boolean);
    const frames = num(/^frame=(\d+)/gm, r.stdout || "");
    const completed = frames > 0 && /^progress=end\s*$/m.test(r.stdout || "");
    const failed = r.status !== 0 || errors.length > 0 || !completed;
    add(failed ? "FAIL" : "PASS", "decode", errors.length ? `${errors.length} decoder error line(s): ${errors[0]}` : r.status !== 0 ? `ffmpeg ${r.signal ? `terminated by ${r.signal}` : `exited ${r.status}`}` : !completed ? "completed frame decode was not reported" : "clean");
    const expected = Math.round(p.duration * p.fps);
    if (frames == null) add("WARN", "frames", "decoded frame count unavailable");
    else add(Math.abs(frames - expected) <= 2 ? "PASS" : "WARN", "frames", `${frames} decoded, ${expected} expected from duration × fps`);
  }
  if (expectDuration != null) {
    const want = Number(expectDuration);
    if (!Number.isFinite(want)) throw new Error(`--expect-duration must be seconds, got "${expectDuration}"`);
    const tol = Math.max(0.05, p.fps ? 1 / p.fps : 0.05);
    add(Math.abs(p.duration - want) <= tol ? "PASS" : "FAIL", "duration", `${p.duration.toFixed(3)} s, expected ${want} s ±${tol.toFixed(3)}`);
  } else add("PASS", "duration", `${p.duration.toFixed(3)} s`);
  if (p.audio) {
    const r = runTool("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-map", "0:a:0", "-af", "ebur128=peak=true,silencedetect=noise=-50dB:d=2", "-f", "null", "-"]);
    const err = r.stderr || "";
    if (r.status !== 0) add("FAIL", "audio analysis", `ffmpeg ${r.signal ? `terminated by ${r.signal}` : `exited ${r.status}`}${err.trim() ? `: ${err.trim().split("\n").at(-1)}` : ""}`);
    else {
      const I = num(/^\s+I[:]\s+(-?[\d.]+|-inf) LUFS/gm, err), LRA = num(/^\s+LRA:\s+(-?[\d.]+) LU/gm, err), peak = num(/^\s+Peak:\s+(-?[\d.]+|-inf) dBFS/gm, err);
      const level = (v) => Number.isFinite(v) || v === -Infinity;
      if (!level(I) || !Number.isFinite(LRA) || LRA < 0 || !level(peak)) add("FAIL", "audio analysis", "complete ebur128 summary unavailable");
      else {
        add(Math.abs(I - targetLufs) <= 2 ? "PASS" : "WARN", "loudness", `${I} LUFS integrated (target ${targetLufs} ±2)`);
        add(peak <= -1.0 ? "PASS" : "FAIL", "true peak", `${peak} dBFS (ceiling -1.0)`);
        add(LRA >= 1 ? "PASS" : "WARN", "loudness range", `${LRA} LU${LRA < 1 ? " — flat" : ""}`);
        const starts = [...err.matchAll(/silence_start: (-?[\d.]+)/g)].map((m) => Number(m[1]));
        const ends = [...err.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
        const spans = starts.map((s, i) => [Math.max(0, s), ends[i] ?? p.duration]);
        add(spans.length ? "WARN" : "PASS", "silence", spans.length ? `${spans.length} stretch(es) ≥ 2 s below -50 dB: ${spans.map(([a, b]) => `${a.toFixed(1)}-${b.toFixed(1)} s`).join(", ")}` : "no stretch ≥ 2 s below -50 dB");
      }
    }
  }
  if (against) {
    const q = probe(against);
    const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
    if (sha(file) === sha(against)) add("FAIL", "twin", `byte-identical to ${against}: the pair is one file twice`);
    else {
      const dd = Math.abs(p.duration - q.duration);
      add(dd <= 0.5 ? "PASS" : "FAIL", "twin", `duration differs by ${dd.toFixed(3)} s from ${against}${dd > 0.5 ? " — one of the pair is damaged or cut" : ""}`);
      if (p.width !== q.width || p.height !== q.height) add("WARN", "twin size", `${p.width}x${p.height} vs ${q.width}x${q.height}`);
    }
  }
  return { file, duration: p.duration, fps: p.fps, checks, fail: checks.filter((c) => c.level === "FAIL").length };
}

// ------------------------------------------------------- sheet and frame --

function extractFrame(file, t, out, { crop, width } = {}) {
  const vf = [];
  if (crop) { if (!/^\d+:\d+:\d+:\d+$/.test(crop)) throw new Error(`--crop must be w:h:x:y, got "${crop}"`); vf.push(`crop=${crop}`); }
  if (width) { if (!/^\d+$/.test(String(width))) throw new Error(`--width must be pixels, got "${width}"`); vf.push(`scale=${width}:-2`); }
  const r = runTool("ffmpeg", ["-hide_banner", "-v", "error", "-y", "-ss", String(t), "-i", file, "-frames:v", "1", ...(vf.length ? ["-vf", vf.join(",")] : []), out]);
  if (r.status !== 0 || !existsSync(out)) throw new Error(`ffmpeg could not extract a frame at ${t} s: ${(r.stderr || "").trim().split("\n")[0]}`);
}

export function sheetTimes(duration, at, n = 12) {
  if (at) return at.split(",").map((s) => parseTime(s, duration));
  return Array.from({ length: n }, (_, i) => +(((i + 0.5) / n) * duration).toFixed(3));
}

// ---------------------------------------------------------------- structure --

const quantile = (xs, q) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b), i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
};

// cuts (seconds) + duration -> the profile. Log2 bins: <0.5, 0.5-1, 1-2, 2-4, 4-8, 8-16, >=16 s.
export function profileFrom(cuts, duration, { threshold = 0.3, fps = 0, file = null } = {}) {
  const edges = [0, ...cuts.filter((c) => c > 0 && c < duration), duration];
  const shots = edges.slice(1).map((e, i) => +(e - edges[i]).toFixed(3)).filter((d) => d > 0);
  const bins = [0.5, 1, 2, 4, 8, 16];
  const hist = new Array(bins.length + 1).fill(0);
  for (const d of shots) { let k = bins.findIndex((b) => d < b); if (k < 0) k = bins.length; hist[k]++; }
  const total = shots.length || 1;
  const entropy = -hist.filter(Boolean).reduce((s, c) => s + (c / total) * Math.log2(c / total), 0);
  return {
    schema: STRUCTURE_SCHEMA, file, duration: +duration.toFixed(3), fps: +fps.toFixed(3), threshold,
    cuts: cuts.map((c) => +c.toFixed(3)), shots: shots.length,
    shot_seconds: { median: +quantile(shots, 0.5).toFixed(3), iqr: +(quantile(shots, 0.75) - quantile(shots, 0.25)).toFixed(3), min: shots.length ? Math.min(...shots) : 0, max: shots.length ? Math.max(...shots) : 0 },
    log_histogram: { bins_seconds: ["<0.5", "0.5-1", "1-2", "2-4", "4-8", "8-16", ">=16"], counts: hist },
    entropy_bits: +entropy.toFixed(3),
    transitions: { status: "deferred", note: "cut vs dissolve vs wipe classification is not implemented; only hard-cut scene scores are measured" },
  };
}

export function structureOf(file, threshold = 0.3) {
  const p = probe(file);
  if (!p.video) throw new Error(`${file} has no video stream`);
  const r = runTool("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-map", "0:v:0", "-vf", `select='gt(scene,${threshold})',metadata=print`, "-f", "null", "-"]);
  if (r.status !== 0) throw new Error(`ffmpeg scene detection failed: ${(r.stderr || "").trim().split("\n").pop()}`);
  const cuts = [...(r.stderr || "").matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
  return profileFrom(cuts, p.duration, { threshold, fps: p.fps, file: basename(file) });
}

export function diffProfiles(a, b) {
  for (const [n, x] of [["a", a], ["b", b]]) {
    if (x?.schema !== STRUCTURE_SCHEMA) throw new Error(`${n}: not a ${STRUCTURE_SCHEMA} profile`);
    for (const [field, value] of [["shots", x.shots], ["shot_seconds.median", x.shot_seconds?.median], ["shot_seconds.iqr", x.shot_seconds?.iqr], ["entropy_bits", x.entropy_bits]]) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (field === "shots" && (!Number.isInteger(value) || value === 0))) throw new Error(`${n}: invalid ${field} in structure profile`);
    }
  }
  const ratio = (x, y) => (x > 0 && y > 0 ? y / x : null);
  const shotRatio = ratio(a.shots, b.shots), medRatio = ratio(a.shot_seconds.median, b.shot_seconds.median);
  const axes = [
    { axis: "shots", a: a.shots, b: b.shots, close: shotRatio != null && shotRatio >= 2 / 3 && shotRatio <= 1.5 },
    { axis: "median shot s", a: a.shot_seconds.median, b: b.shot_seconds.median, close: medRatio != null && Math.abs(Math.log2(medRatio)) < 0.5 },
    { axis: "IQR s", a: a.shot_seconds.iqr, b: b.shot_seconds.iqr, close: Math.abs(a.shot_seconds.iqr - b.shot_seconds.iqr) <= Math.max(0.5, 0.5 * Math.max(a.shot_seconds.iqr, b.shot_seconds.iqr)) },
    { axis: "entropy bits", a: a.entropy_bits, b: b.entropy_bits, close: Math.abs(a.entropy_bits - b.entropy_bits) < 0.5 },
  ];
  const apart = axes.filter((x) => !x.close).length;
  return { axes, differing: apart, verdict: apart >= 2 ? "distinct" : "clone", note: "two-axis rule on cut rhythm only (fewer than two differing axes is a clone); transition family, colour and content are not compared" };
}

// -------------------------------------------------------------- prompt lint --

const cells = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

function tables(body, off = 0) {
  const out = [];
  const lines = body.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    if (!/^\s*\|/.test(lines[i]) || !/^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) continue;
    const header = cells(lines[i]).map((h) => h.toLowerCase());
    const rows = [];
    let j = i + 2;
    for (; j < lines.length && /^\s*\|/.test(lines[j]); j++) rows.push({ line: j + 1 + off, cells: cells(lines[j]) });
    out.push({ header, rows, line: i + 1 + off });
    i = j - 1;
  }
  return out;
}

const REQUIRED_KEYS = ["pack", "title", "spec", "theme_pack", "audio", "output", "owner", "hand_seed", "precedence"];
const REQUIRED_SECTIONS = [1, 2, 4, 5, 7, 9, 10, 11, 12];

export function lintPack(file) {
  if (!existsSync(file)) throw new Error(`no such file: ${file}`);
  const text = readFileSync(file, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const res = [];
  const add = (rule, level, message) => res.push({ rule, level, message });
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
  const front = {};
  if (!fm) add("F", "fail", "no YAML front matter");
  else for (const line of fm[1].split("\n")) { const m = line.match(/^([\w-]+):\s*(.*)$/); if (m) front[m[1]] = m[2].replace(/^"(.*)"$/, "$1").trim(); }
  const body = fm ? text.slice(fm[0].length) : text;
  for (const k of REQUIRED_KEYS) if (!front[k]) add("F", "fail", `front matter lacks \`${k}\``);
  const stem = basename(file).replace(/\.vprompt\.md$/, "");
  if (front.pack && front.pack !== stem) add("F", "fail", `pack "${front.pack}" does not equal the file stem "${stem}"`);
  const headings = new Set([...body.matchAll(/^##\s+(\d+)\./gm)].map((m) => Number(m[1])));
  for (const n of REQUIRED_SECTIONS) if (!headings.has(n)) add("F", "fail", `section ${n} is missing (\`## ${n}. …\`)`);

  // L1 — spec arithmetic, cut table, scene frame ranges
  const spec = (front.spec ?? "").match(/([\d.]+)\s*s\s*·\s*([\d.]+)\s*fps\s*·\s*(\d+)\s*frames\s*·\s*(\d+)x(\d+)\s*native/);
  let fps = 0, frames = 0, W = 0, H = 0;
  if (!spec) add("L1", "fail", "spec is not `<L> s · <fps> fps · <frames> frames · <W>x<H> native · …`");
  else {
    const L = Number(spec[1]); fps = Number(spec[2]); frames = Number(spec[3]); W = Number(spec[4]); H = Number(spec[5]);
    if (Math.abs(L * fps - frames) > 1e-6) add("L1", "fail", `spec: ${L} s × ${fps} fps = ${+(L * fps).toFixed(3)}, not ${frames} frames`);
    else add("L1", "pass", `spec closes: ${L} s × ${fps} fps = ${frames} frames`);
  }
  const off = fm ? fm[0].split("\n").length - 1 : 0;
  const all = tables(body, off);
  const find = (...cols) => all.filter((t) => cols.every((c, i) => t.header[i] === c));
  const cutT = find("#", "frame", "g s", "lands on")[0];
  if (cutT) {
    let prev = -1, ok = true;
    for (const r of cutT.rows) {
      const f = Number(r.cells[1]), g = Number(r.cells[2]);
      if (!Number.isInteger(f)) { add("L1", "fail", `line ${r.line}: cut frame "${r.cells[1]}" is not an integer`); ok = false; continue; }
      if (f <= prev) { add("L1", "fail", `line ${r.line}: cut frame ${f} does not increase`); ok = false; }
      if (frames && f >= frames) { add("L1", "fail", `line ${r.line}: cut frame ${f} is past the last frame ${frames - 1}`); ok = false; }
      if (fps && Number.isFinite(g) && Math.abs(g - f / fps) > 0.5 / fps + 1e-3) { add("L1", "fail", `line ${r.line}: ${g} s does not match frame ${f} at ${fps} fps (${(f / fps).toFixed(3)} s)`); ok = false; }
      prev = f;
      if (/\b(beat|bar|onset|section) \d+\b/i.test(r.cells[3] ?? "")) add("L3", "fail", `line ${r.line}: bare index "${r.cells[3]}" — name the event as kind@seconds`);
      else if (!/(onset|beat|section|bar)@[\d.]+/.test(r.cells[3] ?? "")) add("L3", "warn", `line ${r.line}: cut lands on "${r.cells[3]}" — no kind@seconds event`);
    }
    if (ok) add("L1", "pass", `${cutT.rows.length} cut(s): integer frames, strictly increasing, times match`);
  } else add("L1", "warn", "no cut table (`| # | frame | G s | lands on | …`)");
  const scenes = [...body.matchAll(/^###\s+(\S+)\s+—\s+.+?\s+—\s+frames\s+(\d+)-(\d+)/gm)].map((m) => ({ id: m[1], a: Number(m[2]), b: Number(m[3]) }));
  if (scenes.length) {
    let ok = true;
    if (scenes[0].a !== 0) { add("L1", "fail", `first scene starts at frame ${scenes[0].a}, not 0`); ok = false; }
    for (let i = 1; i < scenes.length; i++) if (scenes[i].a !== scenes[i - 1].b + 1) { add("L1", "fail", `scene ${scenes[i].id} starts at ${scenes[i].a}, previous ended at ${scenes[i - 1].b}`); ok = false; }
    if (frames && scenes.at(-1).b !== frames - 1) { add("L1", "fail", `last scene ends at frame ${scenes.at(-1).b}, not ${frames - 1}`); ok = false; }
    if (ok) add("L1", "pass", `${scenes.length} scene(s) tile frames 0-${scenes.at(-1).b}`);
  } else add("L1", "warn", "no scene headings (`### <id> — <name> — frames <a>-<b> …`)");

  // L5 — palette
  const palT = find("slot", "hex", "meaning")[0];
  const slots = new Set();
  if (!palT) add("L5", "fail", "no palette table (`| slot | hex | meaning |`)");
  else {
    let ok = true;
    if (palT.rows.length > 16) { add("L5", "fail", `${palT.rows.length} palette slots (max 16)`); ok = false; }
    for (const r of palT.rows) {
      const [name, hex] = r.cells;
      if (slots.has(name)) { add("L5", "fail", `line ${r.line}: slot "${name}" defined twice`); ok = false; }
      slots.add(name);
      if (!/^#[0-9a-f]{6}$/i.test(hex ?? "")) { add("L5", "fail", `line ${r.line}: slot "${name}" hex "${hex}" is not #rrggbb`); ok = false; }
    }
    if (ok) add("L5", "pass", `${palT.rows.length} slot(s), named and hexed`);
  }
  const strayHex = body.split("\n").map((l, i) => ({ l, n: i + 1 + off })).filter(({ l, n }) => /#[0-9a-f]{6}\b/i.test(l) && !(palT && n >= palT.line && n <= palT.line + 1 + palT.rows.length));
  if (strayHex.length) add("L5", "warn", `hex colour outside the palette table on line(s) ${strayHex.map((x) => x.n).join(", ")} — use a slot name`);

  // L2 / L5 / L6 — element tables
  let elements = 0;
  for (const t of find("id", "scene", "element", "rect", "slot")) for (const r of t.rows) {
    elements++;
    const get = (c) => r.cells[t.header.indexOf(c)] ?? "";
    const id = get("id").replace(/`/g, "");
    if (slots.size && !slots.has(get("slot"))) add("L5", "fail", `line ${r.line}: element ${id} uses undefined slot "${get("slot")}"`);
    const rect = get("rect").match(/^\((\d+),(\d+)\)-\((\d+),(\d+)\)$/);
    if (!rect) add("L6", "fail", `line ${r.line}: element ${id} rect "${get("rect")}" is not (x0,y0)-(x1,y1)`);
    else if (W && H) {
      const [x0, y0, x1, y1] = rect.slice(1).map(Number);
      if (x0 < 0 || y0 < 0 || x1 > W || y1 > H || x0 >= x1 || y0 >= y1) add("L6", "fail", `line ${r.line}: element ${id} rect ${get("rect")} is outside the ${W}x${H} canvas or empty`);
    }
    const reveal = get("reveal (+)").replace(/`/g, "");
    if (!reveal || reveal === "—") add("L2", "fail", `line ${r.line}: element ${id} has no reveal`);
    else if (!/^(G@[\d.]+|\+[\d.]+)$/.test(reveal)) add("L2", "warn", `line ${r.line}: element ${id} reveal "${reveal}" is not tagged G@<s> or +<s>`);
    if (!get("hold") || get("hold") === "—") add("L2", "fail", `line ${r.line}: element ${id} has no hold`);
  }
  if (elements) add("L2", "pass", `${elements} element row(s) read`); else add("L2", "warn", "no element tables (`| id | scene | element | rect | slot | …`)");

  // L8 — acceptance gate declared
  const accT = find("id", "tool", "command")[0];
  if (!accT || !accT.rows.length) add("L8", "fail", "no acceptance table (`| id | tool | command | expected | tolerance | consequence |`)");
  else add("L8", "pass", `${accT.rows.length} acceptance row(s) declared`);

  for (const rule of ["L3 (event resolution against the timing file)", "L4 (claims vs evidence)", "L6 (text width, label cells, centring)", "L7 (graphic arithmetic)", "L9 (still times vs reveal + hold)", "L10 (free/fixed coverage)"]) add(rule.split(" ")[0], "manual", `not machine-checked: walk ${rule} by hand`);
  return { file, results: res, fail: res.filter((r) => r.level === "fail").length };
}

// ------------------------------------------------------------------ command --

export function video({ rest, apply, opts }) {
  const [sub, a, b] = rest;
  if (sub === "ls") {
    const rows = listVideos(resolve(a ?? "."), { since: opts.since, deep: opts.deep });
    if (opts.json) { console.log(JSON.stringify(rows, null, 2)); return; }
    for (const r of rows) console.log(`${r.mtime.slice(0, 16).replace("T", " ")}Z ${String(Math.round(r.bytes / 1024)).padStart(8)} KB  ${r.path}`);
    console.log(`${rows.length} film${rows.length === 1 ? "" : "s"}${opts.deep ? "" : " (media/ pruned; --deep to include)"}`);
    return;
  }
  if (sub === "qa") {
    if (!a) throw new Error("qa needs a film file");
    const r = qaFile(a, { expectDuration: opts["expect-duration"], against: opts.against, targetLufs: opts["target-lufs"] != null ? Number(opts["target-lufs"]) : -14 });
    if (opts.json) console.log(JSON.stringify(r, null, 2));
    else { for (const c of r.checks) console.log(`${c.level.padEnd(4)}  ${c.name.padEnd(15)} ${c.detail}`); console.log(r.fail ? `FAIL ${r.fail} check(s)` : "PASS 0 fail"); }
    if (r.fail) throw new Error(`${r.fail} failing check(s) on ${a}`);
    return;
  }
  if (sub === "sheet") {
    if (!a) throw new Error("sheet needs a film file");
    const p = probe(a);
    if (!p.video) throw new Error(`${a} has no video stream`);
    const times = sheetTimes(p.duration, opts.at);
    const out = resolve(opts.out ?? join(dirname(a), `${basename(a, extname(a))}.sheet.png`));
    if (!writeGate(apply, [out])) { console.log(`frames at ${times.join(", ")} s`); return; }
    const tmp = mkdtempSync(join(tmpdir(), "uika-sheet-"));
    try {
      times.forEach((t, i) => extractFrame(a, t, join(tmp, `${String(i).padStart(3, "0")}.png`), { width: 320 }));
      const cols = Math.min(4, times.length), rows = Math.ceil(times.length / cols);
      const r = runTool("ffmpeg", ["-hide_banner", "-v", "error", "-y", "-start_number", "0", "-i", join(tmp, "%03d.png"), "-vf", `tile=${cols}x${rows}:padding=4:color=black`, "-frames:v", "1", out]);
      if (r.status !== 0 || !existsSync(out)) throw new Error(`ffmpeg could not tile the sheet: ${(r.stderr || "").trim().split("\n")[0]}`);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
    console.log(`wrote ${out} (${times.length} frames at ${times.join(", ")} s)`);
    return;
  }
  if (sub === "frame") {
    if (!a || b == null) throw new Error("frame needs a film file and a time (seconds, end, or end-N)");
    const p = probe(a);
    if (!p.video) throw new Error(`${a} has no video stream`);
    const t = parseTime(b, p.duration);
    const out = resolve(opts.out ?? join(dirname(a), `${basename(a, extname(a))}_t${String(b).replace(/[^\w.-]/g, "_")}.png`));
    if (opts.crop && !/^\d+:\d+:\d+:\d+$/.test(opts.crop)) throw new Error(`--crop must be w:h:x:y, got "${opts.crop}"`);
    if (!writeGate(apply, [out])) return;
    extractFrame(a, t, out, { crop: opts.crop, width: opts.width });
    console.log(`wrote ${out} (t=${t.toFixed(3)} s)`);
    return;
  }
  if (sub === "structure") {
    if (!a) throw new Error("structure needs a film file");
    const threshold = opts.threshold != null ? Number(opts.threshold) : 0.3;
    if (!(threshold > 0 && threshold < 1)) throw new Error(`--threshold must be between 0 and 1, got "${opts.threshold}"`);
    const prof = structureOf(a, threshold);
    if (!opts.out) { console.log(JSON.stringify(prof, null, 2)); return; }
    const out = resolve(opts.out);
    if (!writeGate(apply, [out])) { console.log(`${prof.shots} shots · median ${prof.shot_seconds.median} s · IQR ${prof.shot_seconds.iqr} s · entropy ${prof.entropy_bits} bits`); return; }
    writeFileSync(out, JSON.stringify(prof, null, 2) + "\n");
    console.log(`wrote ${out}: ${prof.shots} shots · median ${prof.shot_seconds.median} s · IQR ${prof.shot_seconds.iqr} s · entropy ${prof.entropy_bits} bits`);
    return;
  }
  if (sub === "diff") {
    if (!a || !b) throw new Error("diff needs two structure profiles (from `uika video structure --out`)");
    const read = (f) => { if (!existsSync(f)) throw new Error(`no such file: ${f}`); return JSON.parse(readFileSync(f, "utf8")); };
    const d = diffProfiles(read(a), read(b));
    if (opts.json) console.log(JSON.stringify(d, null, 2));
    else {
      for (const x of d.axes) console.log(`${x.close ? "close" : "apart"}  ${x.axis.padEnd(14)} ${x.a} → ${x.b}`);
      console.log(`verdict: ${d.verdict.toUpperCase()} — ${d.differing} of ${d.axes.length} axes differ (${d.note})`);
    }
    if (d.verdict === "clone") throw new Error(`clone: only ${d.differing} axis differs (need 2)`);
    return;
  }
  if (sub === "prompt") {
    if (a !== "lint") throw new Error(`unknown subcommand "prompt ${a ?? ""}" (prompt lint <pack.vprompt.md>)`);
    if (!b) throw new Error("prompt lint needs a pack file (*.vprompt.md)");
    const r = lintPack(b);
    if (opts.json) console.log(JSON.stringify(r, null, 2));
    else { for (const x of r.results) console.log(`${x.level.toUpperCase().padEnd(6)} ${x.rule.padEnd(3)} ${x.message}`); console.log(r.fail ? `${r.fail} failing rule check(s)` : "machine-checkable rules clean; walk the MANUAL rows by hand"); }
    if (r.fail) throw new Error(`${r.fail} failing rule check(s) in ${b}`);
    return;
  }
  throw new Error(`unknown subcommand "${sub ?? ""}" (ls|qa|sheet|frame|structure|diff|prompt lint)`);
}
