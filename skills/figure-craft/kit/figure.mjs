// figure.mjs — the Uika figure engine (ADR-0034).
//
// One declarative spec -> one figure, in four formats. Pure ESM, zero dependencies.
// This file is the source of truth: it lives in the skill kit so it syncs to every repo;
// uika's src/figure.mjs (`uika figure`) is a thin CLI over it. Deterministic: same spec + tokens => same bytes.
//
// Pipeline:  spec -> resolveTheme(tokens) -> form(model) -> guards(model) -> SVG + manifest.
// Guards fail the RENDER, not a later review (mirrors manim_guards.py, ADR-0025).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

export const FORMS = [
  "flow", "layers", "sequence", "timeline", "quadrant", "tree",
  "bar", "line", "scatter", "distribution", "matrix", "custom-svg", "pattern",
];

export const MANIFEST_SCHEMA = "uika.figure-manifest.v1";
const DEFAULT_W = 960;
const DEFAULT_H = 600;
const MARGIN = 28;
const TYPE_FLOOR = 12;

export class GuardError extends Error {
  constructor(msg) { super(msg); this.name = "GuardError"; }
}

/* ----------------------------------------------------------------- tokens -- */

// Parse CSS custom properties from a named block (default :root).
export function parseTokens(css, selector = ":root") {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([\\s\\S]*?)\\}");
  const block = css.match(re);
  if (!block) return {};
  const out = {};
  for (const m of block[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out["--" + m[1]] = m[2].trim();
  // Resolve var(--x) indirection (e.g. --text-bright: var(--platinum)) so forms get a real paint.
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const k of Object.keys(out)) {
      const m = out[k].match(/^var\(\s*(--[\w-]+)\s*\)$/);
      if (m && out[m[1]] !== undefined && out[m[1]] !== out[k]) { out[k] = out[m[1]]; changed = true; }
    }
    if (!changed) break;
  }
  return out;
}

// DTCG bridge (ADR-0040 Q9; TH-1..TH-3). Themes carry design tokens in the shape of the Design
// Tokens Format Module: groups declare `$type`, leaves carry `$value`. The CSS role name is the
// token key, so `--bg-ground` is `color.bg-ground.$value`; this reconstructs the custom properties
// the forms consume. Legacy `{ "tokens": { ... } }` themes stay readable.
export function fromDtcg(doc = {}) {
  const out = {};
  const walk = (node) => {
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith("$") || key === "fonts" || key === "_note") continue;
      if (!value || typeof value !== "object") continue;
      if ("$value" in value) out[`--${key}`] = value.$value;
      else walk(value);
    }
  };
  walk(doc);
  return out;
}

// Inverse: a token map to a DTCG document, so a theme can be exported for other tooling.
export function toDtcg(tokens = {}, { description } = {}) {
  const color = {};
  const fontFamily = {};
  for (const [key, value] of Object.entries(tokens)) {
    const name = key.replace(/^--/, "");
    (name.startsWith("font-") ? fontFamily : color)[name] = { $value: value };
  }
  const doc = {};
  if (description) doc.$description = description;
  if (Object.keys(color).length) doc.color = { $type: "color", ...color };
  if (Object.keys(fontFamily).length) doc.fontFamily = { $type: "fontFamily", ...fontFamily };
  return doc;
}

// Canonical fallback so the engine works with no token file (subset of design/uika-canonical.css).
const FALLBACK = {
  "--bg-ground": "#0b0913", "--bg-panel": "#14101c", "--bg-panel-2": "#1a1424",
  "--line": "#2e2440", "--line-strong": "#3c2f52",
  "--gold": "#bb9955", "--gold-bright": "#d8b878", "--lavender": "#a497d6",
  "--platinum": "#e9e4da", "--marigold": "#e08d3c", "--lining": "#a2434d",
  "--sage": "#6e9c7e", "--wine": "#881144",
  "--text": "#d8d4ce", "--muted": "#97908f", "--slate": "#6d6676",
  "--font-display": "'Cinzel', serif", "--font-brand": "'Outfit', sans-serif", "--font-mono": "'JetBrains Mono', monospace",
};

// Map a raw token sheet onto semantic roles. Estate palette never hard-coded in a form.
export function resolveTheme(tokens = {}, { fonts } = {}) {
  const t = { ...FALLBACK, ...tokens };
  const f = fonts || {};
  return {
    bg: t["--bg-ground"], surface: t["--bg-panel"], surface2: t["--bg-panel-2"],
    rule: t["--line"], ruleStrong: t["--line-strong"],
    accent: t["--gold"], accentBright: t["--gold-bright"],
    info: t["--lavender"], negative: t["--lining"],
    ink: t["--text"], inkBright: t["--text-bright"] || t["--platinum"], muted: t["--muted"],
    fonts: {
      display: f.display || { family: t["--font-display"], system: true },
      brand: f.brand || { family: t["--font-brand"], system: true },
      mono: f.mono || { family: t["--font-mono"], system: true },
    },
  };
}

/* ------------------------------------------------------------------ model -- */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// Deterministic width estimate (no font metrics without a renderer; conservative).
const textW = (s, size, mono) => String(s).length * size * (mono ? 0.62 : 0.56);
const fmtNum = (v) => (typeof v === "number" && Number.isFinite(v) ? (Number.isInteger(v) ? String(v) : String(+v.toFixed(3))) : String(v));
// Axis ticks are derived and get few decimals so their labels stay inside the gutter.
const fmtTick = (v) => { const a = Math.abs(v); return String(+v.toFixed(a >= 100 ? 0 : a >= 10 ? 1 : 2)); };

function mk() {
  return { width: DEFAULT_W, height: DEFAULT_H, margin: MARGIN, prims: [] };
}
function rect(m, o) { m.prims.push({ t: "rect", ...o, box: boxOf("rect", o) }); }
function line(m, o) { m.prims.push({ t: "line", ...o, box: boxOf("line", o) }); }
function circ(m, o) { m.prims.push({ t: "circle", ...o, box: boxOf("circle", o) }); }
function path(m, o) { m.prims.push({ t: "path", ...o, box: o.box || { x0: 0, y0: 0, x1: m.width, y1: m.height } }); }
function text(m, o) {
  const mono = !!o.mono;
  const w = textW(o.text, o.size, mono);
  const x0 = o.anchor === "middle" ? o.x - w / 2 : o.anchor === "end" ? o.x - w : o.x;
  const box = { x0, y0: o.y - o.size, x1: x0 + w, y1: o.y + o.size * 0.25 };
  m.prims.push({ t: "text", mono, ...o, box });
}
function boxOf(type, o) {
  if (type === "rect") return { x0: o.x, y0: o.y, x1: o.x + (o.w || 0), y1: o.y + (o.h || 0) };
  if (type === "line") return { x0: Math.min(o.x1, o.x2), y0: Math.min(o.y1, o.y2), x1: Math.max(o.x1, o.x2), y1: Math.max(o.y1, o.y2) };
  if (type === "circle") return { x0: o.cx - o.r, y0: o.cy - o.r, x1: o.cx + o.r, y1: o.cy + o.r };
  return { x0: 0, y0: 0, x1: 0, y1: 0 };
}

/* ------------------------------------------------------------------ forms -- */

function frame(m, theme, spec) {
  rect(m, { x: 0, y: 0, w: m.width, h: m.height, fill: theme.bg, deco: true });
  const title = spec.title || spec.id;
  if (title) text(m, { x: MARGIN, y: MARGIN + 4, text: title, size: 22, weight: 600, fill: theme.inkBright, role: "title", anchor: "start", evidence: false, deco: true });
  const cap = spec.caption;
  if (cap) text(m, { x: MARGIN, y: m.height - 12, text: cap, size: 13, fill: theme.muted, role: "caption", anchor: "start", evidence: false, deco: true });
  // Inset for chart axes (left) and the category-label row (bottom). Decoration in the
  // margin band (title/caption/background) is exempt from inFrame by `deco`.
  // Matrix row labels sit in the left gutter, so widen it to fit the longest row label.
  let left = 48;
  if (spec.form === "matrix" && Array.isArray(spec.data?.rows)) {
    left = Math.min(160, Math.max(48, Math.max(...spec.data.rows.map((r) => textW(r, 13))) + 18));
  }
  return { x0: MARGIN + left, y0: MARGIN + 30, x1: m.width - MARGIN - 8, y1: m.height - MARGIN - 46 };
}

function arrow(m, x1, y1, x2, y2, color) {
  line(m, { x1, y1, x2, y2, stroke: color, sw: 1.4, deco: true });
  const a = Math.atan2(y2 - y1, x2 - x1), s = 7;
  path(m, { d: `M${x2} ${y2} L${x2 - s * Math.cos(a - 0.4)} ${y2 - s * Math.sin(a - 0.4)} L${x2 - s * Math.cos(a + 0.4)} ${y2 - s * Math.sin(a + 0.4)} Z`, fill: color, box: { x0: x2 - s, y0: y2 - s, x1: x2 + s, y1: y2 + s } });
}

function formFlow(m, theme, spec, area) {
  const nodes = spec.data.nodes || [];
  const edges = spec.data.edges || [];
  const layers = [...new Set(nodes.map((n) => n.layer ?? 0))].sort((a, b) => a - b);
  const cols = Math.max(1, layers.length);
  const bw = Math.min(200, (area.x1 - area.x0 - (cols - 1) * 46) / cols), bh = 54;
  const pos = {};
  for (const L of layers) {
    const inLayer = nodes.filter((n) => (n.layer ?? 0) === L);
    const cx = area.x0 + (L + 0.5) * ((area.x1 - area.x0) / cols);
    const gap = (area.y1 - area.y0) / (inLayer.length + 1);
    inLayer.forEach((n, i) => { pos[n.id] = { x: cx - bw / 2, y: area.y0 + gap * (i + 1) - bh / 2, w: bw, h: bh }; });
  }
  for (const [a, b] of edges) {
    if (!pos[a] || !pos[b]) throw new GuardError(`flow edge ${a}->${b}: endpoint not declared`);
    arrow(m, pos[a].x + pos[a].w, pos[a].y + pos[a].h / 2, pos[b].x, pos[b].y + pos[b].h / 2, theme.ruleStrong);
  }
  for (const n of nodes) {
    const p = pos[n.id];
    rect(m, { x: p.x, y: p.y, w: p.w, h: p.h, rx: 8, fill: theme.surface2, stroke: theme.accent, sw: 1.2, id: n.id });
    text(m, { x: p.x + p.w / 2, y: p.y + p.h / 2 + 5, text: n.label ?? n.id, size: 15, anchor: "middle", fill: theme.ink, role: "node", id: n.id });
  }
}

function formSequence(m, theme, spec, area) {
  const parts = spec.data.participants || [];
  const msgs = spec.data.messages || [];
  const slot = (area.x1 - area.x0) / Math.max(1, parts.length);
  const bw = Math.min(150, slot * 0.8);
  const pos = {};
  parts.forEach((p, i) => {
    const cx = area.x0 + slot * (i + 0.5);
    pos[p.id] = cx;
    rect(m, { x: cx - bw / 2, y: area.y0, w: bw, h: 34, rx: 6, fill: theme.surface2, stroke: theme.accent, sw: 1.2, id: p.id });
    text(m, { x: cx, y: area.y0 + 22, text: p.label ?? p.id, size: 14, anchor: "middle", fill: theme.ink, role: "node", id: p.id });
    line(m, { x1: cx, y1: area.y0 + 34, x2: cx, y2: area.y1, stroke: theme.rule, sw: 1, dash: "4 5", deco: true });
  });
  const step = (area.y1 - area.y0 - 60) / Math.max(1, msgs.length + 1);
  msgs.forEach((msg, i) => {
    if (pos[msg.from] === undefined || pos[msg.to] === undefined) throw new GuardError(`sequence message ${msg.from}->${msg.to}: participant not declared`);
    const y = area.y0 + 60 + step * i;
    arrow(m, pos[msg.from], y, pos[msg.to], y, theme.ruleStrong);
    text(m, { x: (pos[msg.from] + pos[msg.to]) / 2, y: y - 8, text: msg.label, size: 13, anchor: "middle", fill: theme.ink, role: "event", id: `msg${i}` });
  });
}

function formLayers(m, theme, spec, area) {
  const layers = spec.data.layers || [];
  const gap = 10, h = (area.y1 - area.y0 - (layers.length - 1) * gap) / layers.length;
  layers.forEach((L, i) => {
    const y = area.y0 + i * (h + gap);
    rect(m, { x: area.x0, y, w: area.x1 - area.x0, h, rx: 6, fill: theme.surface, stroke: theme.rule, sw: 1, id: L.id });
    text(m, { x: area.x0 + 16, y: y + h / 2 + 5, text: L.label ?? L.id, size: 15, fill: theme.accentBright, role: "node", anchor: "start", id: L.id });
    if (L.note) text(m, { x: area.x1 - 16, y: y + h / 2 + 5, text: L.note, size: 13, fill: theme.muted, anchor: "end", role: "note", evidence: false });
  });
}

function formTimeline(m, theme, spec, area) {
  const ev = spec.data.events || [];
  const [lo, hi] = spec.data.range || [Math.min(...ev.map((e) => e.at)), Math.max(...ev.map((e) => e.at))];
  const y = area.y0 + (area.y1 - area.y0) / 2;
  const X = (v) => area.x0 + ((v - lo) / (hi - lo || 1)) * (area.x1 - area.x0);
  line(m, { x1: area.x0, y1: y, x2: area.x1, y2: y, stroke: theme.ruleStrong, sw: 1.6 });
  ev.forEach((e, i) => {
    const x = X(e.at), up = i % 2 === 0, ty = up ? y - 14 : y + 30;
    line(m, { x1: x, y1: y, x2: x, y2: up ? y - 8 : y + 8, stroke: theme.ruleStrong, sw: 1 });
    circ(m, { cx: x, cy: y, r: 5, fill: theme.accent, stroke: theme.bg, sw: 2 });
    text(m, { x, y: ty, text: e.label, size: 13, anchor: "middle", fill: theme.ink, role: "event", id: String(e.id ?? e.label ?? i) });
    text(m, { x, y: up ? ty - 18 : ty + 18, text: fmtNum(e.at), size: 12, anchor: "middle", fill: theme.muted, role: "axis", mono: true, evidence: false });
  });
}

function formQuadrant(m, theme, spec, area) {
  const mid = { x: (area.x0 + area.x1) / 2, y: (area.y0 + area.y1) / 2 };
  rect(m, { x: area.x0, y: area.y0, w: area.x1 - area.x0, h: area.y1 - area.y0, fill: theme.surface, stroke: theme.rule, sw: 1 });
  line(m, { x1: mid.x, y1: area.y0, x2: mid.x, y2: area.y1, stroke: theme.ruleStrong, sw: 1, dash: "4 4" });
  line(m, { x1: area.x0, y1: mid.y, x2: area.x1, y2: mid.y, stroke: theme.ruleStrong, sw: 1, dash: "4 4" });
  const q = spec.data.quadrants || [];
  const corners = [[area.x0, area.y0], [mid.x, area.y0], [area.x0, mid.y], [mid.x, mid.y]];
  q.forEach((label, i) => text(m, { x: corners[i][0] + 12, y: corners[i][1] + 22, text: label, size: 13, anchor: "start", fill: theme.accentBright, role: "quadrant", evidence: false }));
  if (spec.data.x) { text(m, { x: area.x1, y: mid.y + 20, text: spec.data.x.right, size: 12, anchor: "end", fill: theme.muted, role: "axis", evidence: false }); text(m, { x: area.x0, y: mid.y + 20, text: spec.data.x.left, size: 12, anchor: "start", fill: theme.muted, role: "axis", evidence: false }); }
  for (const p of (spec.data.points || [])) {
    const x = area.x0 + p.x * (area.x1 - area.x0), y = area.y1 - p.y * (area.y1 - area.y0);
    circ(m, { cx: x, cy: y, r: 4, fill: theme.accent });
    const right = x > (area.x0 + area.x1) / 2;
    text(m, { x: x + (right ? -8 : 8), y: y + 4, text: p.label, size: 12, anchor: right ? "end" : "start", fill: theme.ink, role: "point" });
  }
}

function formTree(m, theme, spec, area) {
  const root = spec.data.root;
  if (!root) throw new GuardError("tree: data.root required");
  const depth = (function d(n) { return 1 + Math.max(0, ...(n.children || []).map(d)); })(root);
  const levelY = (lvl) => area.y0 + (lvl + 0.5) * ((area.y1 - area.y0) / depth);
  const w = Math.min(150, (area.x1 - area.x0) / 2), h = 40;
  const nodes = [];
  (function walk(n, lvl, span) {
    const [x0, x1] = span;
    const x = (x0 + x1) / 2, y = levelY(lvl);
    nodes.push({ n, x, y, w, h });
    const kids = n.children || [];
    kids.forEach((c, i) => walk(c, lvl + 1, [x0 + (i * (x1 - x0)) / kids.length, x0 + ((i + 1) * (x1 - x0)) / kids.length]));
  })(root, 0, [area.x0 + w / 2, area.x1 - w / 2]);
  for (const { n, x, y, w, h } of nodes) for (const c of (n.children || [])) {
    const child = nodes.find((z) => z.n === c);
    line(m, { x1: x, y1: y + h / 2, x2: child.x, y2: child.y - h / 2, stroke: theme.ruleStrong, sw: 1.2, deco: true });
  }
  for (const { n, x, y, w, h } of nodes) {
    rect(m, { x: x - w / 2, y: y - h / 2, w, h, rx: 8, fill: theme.surface2, stroke: theme.rule, sw: 1, id: n.id || n.label });
    text(m, { x, y: y + 5, text: n.label, size: 14, anchor: "middle", fill: theme.ink, role: "node", id: n.id || n.label });
  }
}

function axes(m, theme, area, series, opts = {}) {
  const vals = series.flatMap((s) => (s.value !== undefined ? [s.value] : (s.points || []).map((p) => p.y)));
  const min = opts.min ?? Math.min(0, ...vals), max = opts.max ?? Math.max(...vals, 1);
  const y = (v) => area.y1 - ((v - min) / (max - min || 1)) * (area.y1 - area.y0);
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = min + (i * (max - min)) / ticks, yy = y(v);
    line(m, { x1: area.x0, y1: yy, x2: area.x1, y2: yy, stroke: theme.rule, sw: 1, deco: true });
    const lab = fmtTick(v);
    text(m, { x: Math.max(area.x0 - 8, MARGIN + textW(lab, 12, true)), y: yy + 4, text: lab, size: 12, anchor: "end", fill: theme.muted, role: "axis", mono: true, evidence: false });
  }
  line(m, { x1: area.x0, y1: area.y1, x2: area.x1, y2: area.y1, stroke: theme.ruleStrong, sw: 1.4, deco: true });
  return { y };
}

function formBar(m, theme, spec, area) {
  const series = spec.data.series || [];
  const { y } = axes(m, theme, area, series);
  const slot = (area.x1 - area.x0) / series.length, bw = Math.min(96, slot * 0.6);
  series.forEach((s, i) => {
    const cx = area.x0 + slot * (i + 0.5), yy = y(s.value);
    rect(m, { x: cx - bw / 2, y: yy, w: bw, h: Math.max(2, area.y1 - yy), rx: 4, fill: s.fill || theme.accent, id: s.label });
    text(m, { x: cx, y: yy - 8, text: fmtNum(s.value), size: 14, anchor: "middle", fill: theme.inkBright, role: "value" });
    text(m, { x: cx, y: area.y1 + 20, text: s.label, size: 13, anchor: "middle", fill: theme.ink, role: "label", id: s.label });
  });
}

function formLine(m, theme, spec, area) {
  const series = spec.data.series || [{ points: spec.data.points || [] }];
  const { y } = axes(m, theme, area, series);
  const xOf = (i, n) => area.x0 + (i / Math.max(1, n - 1)) * (area.x1 - area.x0);
  series.forEach((s) => {
    const pts = s.points || [];
    const d = pts.map((p, i) => `${i ? "L" : "M"}${xOf(i, pts.length)} ${y(p.y)}`).join(" ");
    path(m, { d, fill: "none", stroke: s.color || theme.accent, sw: 2, box: { x0: area.x0, y0: area.y0, x1: area.x1, y1: area.y1 } });
    pts.forEach((p, i) => circ(m, { cx: xOf(i, pts.length), cy: y(p.y), r: 3, fill: s.color || theme.accent }));
  });
}

function formScatter(m, theme, spec, area) {
  const pts = spec.data.points || [];
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  const X = (v) => area.x0 + ((v - xmin) / (xmax - xmin || 1)) * (area.x1 - area.x0);
  const Y = (v) => area.y1 - ((v - ymin) / (ymax - ymin || 1)) * (area.y1 - area.y0);
  line(m, { x1: area.x0, y1: area.y1, x2: area.x1, y2: area.y1, stroke: theme.ruleStrong, sw: 1.4, deco: true });
  line(m, { x1: area.x0, y1: area.y0, x2: area.x0, y2: area.y1, stroke: theme.ruleStrong, sw: 1.4, deco: true });
  for (const p of pts) {
    circ(m, { cx: X(p.x), cy: Y(p.y), r: 4, fill: theme.accent });
    if (p.label) {
      const right = X(p.x) > (area.x0 + area.x1) / 2;
      text(m, { x: X(p.x) + (right ? -8 : 8), y: Y(p.y) + 4, text: p.label, size: 12, anchor: right ? "end" : "start", fill: theme.ink, role: "point" });
    }
  }
}

function formDistribution(m, theme, spec, area) {
  let series = spec.data.series;
  if (spec.data.values !== undefined) {
    const values = spec.data.values, bins = spec.data.bins ?? 8;
    const min = Math.min(...values), max = Math.max(...values), w = (max - min) / bins || 1;
    const counts = Array(bins).fill(0);
    for (const v of values) counts[Math.min(bins - 1, Math.floor((v - min) / w))]++;
    series = counts.map((c, i) => ({ label: `${fmtNum(+(min + i * w).toFixed(2))}`, value: c }));
  }
  const { y } = axes(m, theme, area, series);
  const slot = (area.x1 - area.x0) / series.length;
  series.forEach((s, i) => {
    const cx = area.x0 + slot * (i + 0.5), yy = y(s.value);
    rect(m, { x: cx - slot * 0.42, y: yy, w: slot * 0.84, h: area.y1 - yy, fill: theme.info, id: s.label });
    // Bin edges are derived (not printed by the source), so they are axis values, not evidence.
    text(m, { x: cx, y: area.y1 + 20, text: s.label, size: 12, anchor: "middle", fill: theme.ink, role: "axis", id: s.label });
  });
}

function formMatrix(m, theme, spec, area) {
  const { rows = [], cols = [], values = [] } = spec.data;
  const cw = (area.x1 - area.x0) / Math.max(1, cols.length), ch = (area.y1 - area.y0) / Math.max(1, rows.length);
  const flat = values.flat(), vmax = Math.max(...flat.map(Math.abs), 1);
  values.forEach((row, r) => row.forEach((v, c) => {
    const t = Math.abs(v) / vmax, x = area.x0 + c * cw, y = area.y0 + r * ch;
    rect(m, { x, y, w: cw, h: ch, fill: v >= 0 ? theme.accent : theme.negative, opacity: 0.15 + 0.85 * t, id: `${rows[r]}/${cols[c]}` });
    text(m, { x: x + cw / 2, y: y + ch / 2 + 5, text: fmtNum(v), size: 13, anchor: "middle", fill: theme.inkBright, role: "value", id: `${rows[r]}/${cols[c]}` });
  }));
  rows.forEach((r, i) => text(m, { x: area.x0 - 10, y: area.y0 + (i + 0.5) * ch + 4, text: r, size: 13, anchor: "end", fill: theme.ink, role: "label" }));
  cols.forEach((c, i) => text(m, { x: area.x0 + (i + 0.5) * cw, y: area.y1 + 20, text: c, size: 13, anchor: "middle", fill: theme.ink, role: "label" }));
}

function formCustom(m, theme, spec, area) {
  if (!spec.data.svg) throw new GuardError("custom-svg: data.svg required");
  // Raw geometry: the engine cannot bound it, so it is exempt from inFrame (the author owns the coordinates).
  path(m, { d: "", raw: spec.data.svg, fill: "none", stroke: "none", deco: true });
}

function formPattern(m, theme, spec, area) {
  const seed = spec.data.seed ?? 1;
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const n = spec.data.count ?? 48;
  for (let i = 0; i < n; i++) {
    const x = area.x0 + rnd() * (area.x1 - area.x0), y = area.y0 + rnd() * (area.y1 - area.y0);
    const r = 2 + rnd() * (spec.data.max ?? 14);
    circ(m, { cx: x, cy: y, r, fill: i % 3 ? theme.accent : theme.info, opacity: 0.5 + 0.4 * rnd(), deco: true });
  }
}

const FORM_FN = { flow: formFlow, sequence: formSequence, layers: formLayers, timeline: formTimeline, quadrant: formQuadrant, tree: formTree, bar: formBar, line: formLine, scatter: formScatter, distribution: formDistribution, matrix: formMatrix, "custom-svg": formCustom, pattern: formPattern };

/* ----------------------------------------------------------------- guards -- */

const overlaps = (a, b, pad = 0) => a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad;

export function runGuards(model, spec) {
  const { margin, width, height } = model;
  // 1-3. one pass: identity labels, frame, type floor — and the font roles actually used.
  const ids = [], roles = new Set();
  for (const p of model.prims) {
    for (const [key, value] of Object.entries(p)) {
      if (typeof value === "number" && !Number.isFinite(value)) throw new GuardError(`finiteGeometry: ${p.t}.${key} must be finite`);
    }
    if (p.box && Object.values(p.box).some((v) => typeof v !== "number" || !Number.isFinite(v))) throw new GuardError(`finiteGeometry: ${p.t} bounds must be finite`);
    if (!p.raw && p.t === "path" && /(?:NaN|Infinity)/.test(p.d)) throw new GuardError("finiteGeometry: path coordinates must be finite");
    if (p.t === "text") {
      if (p.id) ids.push(p.id);
      roles.add(p.mono ? "mono" : "brand");
      if (p.size < TYPE_FLOOR) throw new GuardError(`typeFloor: "${p.text.slice(0, 30)}" is ${p.size}px (< ${TYPE_FLOOR})`);
    }
    if (!p.deco && (p.box.x0 < margin - 0.5 || p.box.x1 > width - margin + 0.5 || p.box.y0 < margin - 0.5 || p.box.y1 > height - margin + 0.5)) {
      throw new GuardError(`inFrame: ${p.t} "${(p.text || p.id || "").slice(0, 30)}" spans x[${p.box.x0.toFixed(0)},${p.box.x1.toFixed(0)}] y[${p.box.y0.toFixed(0)},${p.box.y1.toFixed(0)}], outside [${margin},${width - margin}]`);
    }
  }
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) throw new GuardError(`uniqueLabels: duplicate labels ${[...new Set(dup)].join(", ")}`);

  // 4. no overlap between evidence-bearing text (labels/values), not axis/notes
  const labels = model.prims.filter((p) => p.t === "text" && ["node", "value", "label", "point", "event", "quadrant"].includes(p.role));
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
    if (overlaps(labels[i].box, labels[j].box, -1) && !(labels[i].id && labels[i].id === labels[j].id))
      throw new GuardError(`noOverlap: "${labels[i].text}" overlaps "${labels[j].text}"`);
  }

  // 5. evidence digits — every number drawn (except axis/caption/note/title) must exist in the data
  const allowed = new Set();
  const collect = (v) => {
    if (typeof v === "number") allowed.add(round3(v));
    else if (typeof v === "string") for (const m of v.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)) allowed.add(round3(Number(m[0].replace(/,/g, ""))));
  };
  if (spec.data) for (const v of Object.values(spec.data)) walk(v, collect);
  for (const p of model.prims) {
    if (p.t !== "text" || p.evidence === false || ["axis", "caption", "note", "title"].includes(p.role)) continue;
    for (const m of String(p.text).matchAll(/-?\d[\d,]*(?:\.\d+)?/g)) {
      const n = round3(Number(m[0].replace(/,/g, "")));
      if (!allowed.has(n)) throw new GuardError(`evidenceDigits: "${p.text}" renders ${m[0]}, which is not in the source data`);
    }
  }

  // 6. fonts bound — every used role must resolve to a declared family
  for (const r of roles) if (!model.theme.fonts[r]?.family) throw new GuardError(`fontsBound: font role "${r}" has no declared family`);
  return true;
}

const round3 = (n) => Math.round(n * 1000) / 1000;
function walk(v, fn) {
  if (v == null) return;
  if (Array.isArray(v)) return v.forEach((x) => walk(x, fn));
  if (typeof v === "object") return Object.values(v).forEach((x) => walk(x, fn));
  fn(v);
}

/* ------------------------------------------------------------------ render -- */

function serialize(model) {
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${model.width} ${model.height}" width="${model.width}" height="${model.height}" role="img">`];
  for (const p of model.prims) {
    if (p.t === "rect") out.push(`<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}"${p.rx ? ` rx="${p.rx}"` : ""} fill="${p.fill}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.sw ?? 1}"` : ""}${p.opacity != null ? ` opacity="${p.opacity}"` : ""}/>`);
    else if (p.t === "line") out.push(`<line x1="${n(p.x1)}" y1="${n(p.y1)}" x2="${n(p.x2)}" y2="${n(p.y2)}" stroke="${p.stroke}" stroke-width="${p.sw ?? 1}"${p.dash ? ` stroke-dasharray="${p.dash}"` : ""}/>`);
    else if (p.t === "circle") out.push(`<circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.r)}" fill="${p.fill}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.sw ?? 1}"` : ""}${p.opacity != null ? ` opacity="${p.opacity}"` : ""}/>`);
    else if (p.t === "path") out.push(p.raw ? p.raw : `<path d="${p.d}" fill="${p.fill}"${p.stroke && p.stroke !== "none" ? ` stroke="${p.stroke}" stroke-width="${p.sw ?? 1}"` : ""}/>`);
    else if (p.t === "text") out.push(`<text x="${n(p.x)}" y="${n(p.y)}" font-family="${esc(p.mono ? model.theme.fonts.mono.family : model.theme.fonts.brand.family)}" font-size="${p.size}"${p.weight ? ` font-weight="${p.weight}"` : ""} text-anchor="${p.anchor || "start"}" fill="${p.fill}">${esc(p.text)}</text>`);
  }
  out.push("</svg>");
  return out.join("\n");
}
const n = (v) => (typeof v === "number" ? +v.toFixed(2) : v);

/* -------------------------------------------------------------------- api -- */

export function compile(spec, opts = {}) {
  if (!spec || typeof spec !== "object") throw new GuardError("spec must be an object");
  if (!FORMS.includes(spec.form)) throw new GuardError(`unknown form "${spec.form}"; known: ${FORMS.join(", ")}`);
  for (const k of ["width", "height"]) if (spec[k] !== undefined && (!Number.isSafeInteger(spec[k]) || spec[k] <= 0))
    throw new GuardError(`${k} must be a positive integer`);
  if (!spec.data || typeof spec.data !== "object" || Array.isArray(spec.data)) throw new GuardError("data must be an object");
  const finite = (v, field) => { if (typeof v !== "number" || !Number.isFinite(v)) throw new GuardError(`${field} must be a finite number`); };
  const items = (v, field) => { if (!Array.isArray(v)) throw new GuardError(`${field} must be an array`); return v; };
  const points = (ps, field, xy = false) => items(ps, field).forEach((p, i) => { if (xy) finite(p?.x, `${field}[${i}].x`); finite(p?.y, `${field}[${i}].y`); });
  if (spec.form === "bar") items(spec.data.series ?? [], "data.series").forEach((s, i) => finite(s?.value, `data.series[${i}].value`));
  if (spec.form === "line") {
    if (spec.data.series !== undefined) items(spec.data.series, "data.series").forEach((s, i) => points(s?.points ?? [], `data.series[${i}].points`));
    else points(spec.data.points ?? [], "data.points");
  }
  if (["scatter", "quadrant"].includes(spec.form)) points(spec.data.points ?? [], "data.points", true);
  if (spec.form === "timeline") {
    items(spec.data.events ?? [], "data.events").forEach((e, i) => finite(e?.at, `data.events[${i}].at`));
    if (spec.data.range !== undefined) { const range = items(spec.data.range, "data.range"); if (range.length !== 2 || range[0] >= range[1]) throw new GuardError("data.range must have two increasing numbers"); range.forEach((v, i) => finite(v, `data.range[${i}]`)); }
  }
  if (spec.form === "matrix") items(spec.data.values ?? [], "data.values").forEach((row, i) => items(row, `data.values[${i}]`).forEach((v, j) => finite(v, `data.values[${i}][${j}]`)));
  if (spec.form === "flow") items(spec.data.nodes ?? [], "data.nodes").forEach((v, i) => { if (v?.layer !== undefined && (!Number.isSafeInteger(v.layer) || v.layer < 0)) throw new GuardError(`data.nodes[${i}].layer must be a non-negative integer`); });
  if (spec.form === "pattern") {
    for (const k of ["seed", "count"]) if (spec.data[k] !== undefined && (!Number.isSafeInteger(spec.data[k]) || spec.data[k] < 0 || (k === "count" && spec.data[k] > 10000))) throw new GuardError(`data.${k} must be a non-negative integer${k === "count" ? " at most 10000" : ""}`);
    if (spec.data.max !== undefined) { finite(spec.data.max, "data.max"); if (spec.data.max < 0) throw new GuardError("data.max must be non-negative"); }
  }
  if (spec.form === "distribution") {
    if (spec.data.bins !== undefined && (!Number.isSafeInteger(spec.data.bins) || spec.data.bins < 1 || spec.data.bins > 10000)) throw new GuardError("data.bins must be an integer from 1 to 10000");
    if (spec.data.series !== undefined) items(spec.data.series, "data.series").forEach((s, i) => { finite(s?.value, `data.series[${i}].value`); if (s.value < 0 || s.value > 10000) throw new GuardError(`data.series[${i}].value must be between 0 and 10000`); });
    if (spec.data.values !== undefined) {
      const values = items(spec.data.values, "data.values");
      if (!values.length) throw new GuardError("data.values must not be empty");
      values.forEach((v, i) => finite(v, `data.values[${i}]`));
    } else if (!spec.data.series?.length) throw new GuardError("distribution needs non-empty data.values or data.series");
  }
  walk(spec.data, (v) => { if (typeof v === "number" && !Number.isFinite(v)) throw new GuardError("data must contain finite numbers"); });
  const tokens = opts.tokens || {};
  const theme = resolveTheme(tokens, { fonts: opts.fonts });
  const m = mk();
  m.theme = theme;
  if (spec.width !== undefined) m.width = spec.width;
  if (spec.height !== undefined) m.height = spec.height;
  const area = frame(m, theme, spec);
  (FORM_FN[spec.form])(m, theme, spec, area);
  runGuards(m, spec);
  const svg = serialize(m);
  const manifest = buildManifest(spec, svg, tokens, opts);
  return { svg, manifest, model: m };
}

function buildManifest(spec, svg, tokens, opts) {
  let source = spec.data?.source || null;
  let sourceText = null;
  if (source && opts.root) {
    const p = join(opts.root, source);
    if (existsSync(p)) sourceText = readFileSync(p, "utf8");
  }
  const sha = (s) => createHash("sha256").update(s).digest("hex");
  return {
    schema: MANIFEST_SCHEMA,
    id: spec.id,
    form: spec.form,
    title: spec.title || null,
    source,
    source_sha256: sourceText != null ? sha(sourceText) : sha(JSON.stringify(spec.data ?? {})),
    tokens_sha256: sha(JSON.stringify(tokens)),
    figure_sha256: sha(svg),
    rows: spec.data?.rows ?? spec.data?.series ?? spec.data?.events ?? spec.data?.points ?? null,
    interpretation: spec.notes ?? {},
  };
}

// Embeddable HTML block (the frontend rung, ADR-0034 §9).
export function figureToHtml(svg, manifest) {
  const cap = manifest.interpretation?.provenance || manifest.source || "";
  return `<figure class="uika-figure">\n${svg}\n<figcaption>${esc(manifest.title || manifest.id)}${cap ? ` — <span class="source">${esc(cap)}</span>` : ""}</figcaption>\n</figure>`;
}

export function listSpecs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".figure.json")).sort();
}
