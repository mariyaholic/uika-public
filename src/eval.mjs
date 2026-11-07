// eval.mjs — `uika eval ls|run|compare`: a small local harness for the eval-hillclimb loop.
// Tasks are JSON files in <root>/labs/eval/tasks/ (override with --from <dir>):
//   { "id": "t1", "split": "train"|"test", "run": ["node", "graders/t1.mjs"], "cwd": ".", "timeout_s": 300 }
// `run` is an argv array executed without a shell, from <root>/<cwd>; "node" means the running Node binary.
// A task passes when it exits 0. If the last stdout line is JSON with a numeric "score" (0..1), that is the
// score; otherwise the score is 1 for exit 0 and 0 for anything else. uika calls no model and holds no keys:
// a grader that needs a model API reads its own key from its own environment and fails clearly without it.
//   ls [--from dir] [--json]
//   run [--split train|test|all] [--n 3] [--out results.json] [--apply]   executes graders only with --apply
//   compare <before.json> <after.json>   keep/revert verdict: train beats the noise band, test does not regress
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync, statSync, renameSync, rmSync, chmodSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { createHash, randomUUID } from "node:crypto";

export const TASKS_REL = join("labs", "eval", "tasks");
export const RUN_SCHEMA = "uika.eval-run.v1";
const SPLITS = ["train", "test"];

export function loadTasks(dir) {
  if (!existsSync(dir)) throw new Error(`no eval tasks folder at ${dir} (create ${TASKS_REL}/<task>.json, or pass --from <dir>)`);
  const tasks = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    let t;
    try { t = JSON.parse(readFileSync(join(dir, f), "utf8").replace(/^\uFEFF/, "")); } catch (e) { throw new Error(`${f}: invalid JSON (${e.message})`); }
    if (!t || typeof t !== "object" || Array.isArray(t)) throw new Error(`${f}: task must be an object`);
    if (t.id === undefined) t.id = f.slice(0, -5);
    if (typeof t.id !== "string" || !t.id.trim()) throw new Error(`${f}: id must be a non-empty string`);
    if (!SPLITS.includes(t.split)) throw new Error(`${f}: split must be train or test, got "${t.split}"`);
    if (!Array.isArray(t.run) || !t.run.length || !t.run[0] || !t.run.every((x) => typeof x === "string" && !x.includes("\0"))) throw new Error(`${f}: run must be a non-empty argv array of strings without NUL bytes`);
    if (t.cwd !== undefined && (typeof t.cwd !== "string" || !t.cwd || t.cwd.includes("\0"))) throw new Error(`${f}: cwd must be a non-empty path`);
    if (t.timeout_s !== undefined && (!Number.isFinite(t.timeout_s) || t.timeout_s <= 0 || t.timeout_s * 1000 > 2147483647)) throw new Error(`${f}: timeout_s must be a positive finite duration below 2147483.647 seconds`);
    tasks.push(t);
  }
  const ids = tasks.map((t) => t.id);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) throw new Error(`duplicate task id "${dup}"`);
  return tasks;
}

export function runTask(root, t) {
  const [cmd, ...args] = t.run;
  const bin = cmd === "node" ? process.execPath : cmd;
  const started = Date.now();
  const r = spawnSync(bin, args, { cwd: resolve(root, t.cwd ?? "."), encoding: "utf8", timeout: (t.timeout_s ?? 300) * 1000, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  const ms = Date.now() - started;
  if (r.error?.code === "ENOENT") return { exit: null, score: 0, ms, error: `command not found: ${cmd}` };
  if (r.error?.code === "ETIMEDOUT") return { exit: null, score: 0, ms, error: `timed out after ${t.timeout_s ?? 300} s` };
  const last = (r.stdout || "").trim().split("\n").pop() ?? "";
  let score = r.status === 0 ? 1 : 0;
  try { const j = JSON.parse(last); if (typeof j.score === "number" && j.score >= 0 && j.score <= 1) score = r.status === 0 ? j.score : 0; } catch { /* plain output */ }
  return { exit: r.status, score, ms, ...(r.status !== 0 ? { tail: (r.stderr || r.stdout || "").trim().split("\n").slice(-3).join("\n") } : {}) };
}

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const r3 = (x) => +x.toFixed(3);
const definitionHash = (t) => createHash("sha256").update(JSON.stringify([t.run, t.cwd ?? ".", t.timeout_s ?? 300])).digest("hex");

export function summarize(tasks) {
  const out = {};
  for (const s of SPLITS) {
    const ts = tasks.filter((t) => t.split === s);
    if (ts.length) out[s] = { tasks: ts.length, mean: r3(mean(ts.map((t) => t.mean))), max_spread: r3(Math.max(...ts.map((t) => t.spread))) };
  }
  return out;
}

export function compareRuns(before, after) {
  for (const [n, x] of [["before", before], ["after", after]]) {
    if (x?.schema !== RUN_SCHEMA) throw new Error(`${n}: not a ${RUN_SCHEMA} results file`);
    if (!Array.isArray(x.tasks) || !x.tasks.length) throw new Error(`${n}: results need task records; rerun with the current uika`);
    const ids = new Set();
    for (const t of x.tasks) {
      if (!t || typeof t.id !== "string" || !t.id.trim() || ids.has(t.id) || !SPLITS.includes(t.split) || !/^[a-f0-9]{64}$/.test(t.definitionHash ?? "")) throw new Error(`${n}: invalid task identity or missing definition hash; rerun with the current uika`);
      ids.add(t.id);
      if (!Array.isArray(t.runs) || !t.runs.length || t.runs.some((r) => !Number.isFinite(r?.score) || r.score < 0 || r.score > 1)) throw new Error(`${n}: invalid samples for ${t.id}`);
      const scores = t.runs.map((r) => r.score);
      if (t.mean !== r3(mean(scores)) || t.spread !== r3(Math.max(...scores) - Math.min(...scores))) throw new Error(`${n}: inconsistent task statistics for ${t.id}`);
    }
    const summary = summarize(x.tasks);
    if (!x.summary || Object.keys(x.summary).length !== Object.keys(summary).length || Object.entries(summary).some(([split, value]) => Object.entries(value).some(([key, expected]) => x.summary[split]?.[key] !== expected))) throw new Error(`${n}: inconsistent split summary`);
  }
  const identities = (x) => x.tasks.map((t) => JSON.stringify([t.id, t.split, t.definitionHash])).sort();
  if (JSON.stringify(identities(before)) !== JSON.stringify(identities(after))) throw new Error("runs are not comparable: task IDs, splits and command definitions must match");
  const noise = Math.max(0, ...[before, after].flatMap((x) => x.tasks.filter((t) => t.split === "train").map((t) => {
    const scores = t.runs.map((r) => r.score);
    return Math.max(...scores) - Math.min(...scores);
  })));
  const rawMean = (x, s) => mean(x.tasks.filter((t) => t.split === s).map((t) => mean(t.runs.map((r) => r.score))));
  const d = (s) => (before.summary[s] && after.summary[s] ? rawMean(after, s) - rawMean(before, s) : null);
  const train = d("train"), test = d("test");
  let verdict, reason;
  if (train == null) { verdict = "revert"; reason = "no train split in both runs"; }
  else if (test != null && test < 0) { verdict = "revert"; reason = `test regressed by ${Number((-test).toPrecision(8))}`; }
  else if (train <= noise) { verdict = "revert"; reason = `train gain ${train} is within the noise band ${noise}${noise === 0 ? " (run with --n 3 to measure noise)" : ""}`; }
  else if (test == null) { verdict = "keep?"; reason = `train +${train} beats noise ${noise}, but there is no test split to rule out overfitting`; }
  else { verdict = "keep"; reason = `train +${train} beats noise ${noise}; test ${test >= 0 ? "+" : ""}${test} did not regress`; }
  return { train_delta: train == null ? null : Number(train.toPrecision(8)), test_delta: test == null ? null : Number(test.toPrecision(8)), noise, verdict, reason };
}

export function evalCmd({ root, rest, apply, opts }) {
  const [sub, a, b] = rest;
  const dir = opts.from ? resolve(opts.from) : join(root, TASKS_REL);
  if (sub === "ls") {
    const tasks = loadTasks(dir);
    if (opts.json) { console.log(JSON.stringify(tasks, null, 2)); return; }
    for (const t of tasks) console.log(`${t.id.padEnd(28)} ${t.split.padEnd(6)} ${t.run.join(" ")}`);
    const train = tasks.filter((t) => t.split === "train").length;
    console.log(`${tasks.length} task(s): ${train} train, ${tasks.length - train} test · ${dir}`);
    return;
  }
  if (sub === "run") {
    const split = opts.split ?? "all";
    if (![...SPLITS, "all"].includes(split)) throw new Error(`--split must be train, test or all, got "${split}"`);
    const n = opts.n != null ? Number(opts.n) : 1;
    if (!Number.isInteger(n) || n < 1 || n > 20) throw new Error(`--n must be an integer 1..20, got "${opts.n}"`);
    const tasks = loadTasks(dir).filter((t) => split === "all" || t.split === split);
    if (!tasks.length) throw new Error(`no ${split} tasks in ${dir}`);
    for (const t of tasks) if (!statSync(resolve(root, t.cwd ?? "."), { throwIfNoEntry: false })?.isDirectory()) throw new Error(`${t.id}: cwd is not an existing directory`);
    const out = opts.out ? resolve(opts.out) : null;
    if (out && (!statSync(dirname(out), { throwIfNoEntry: false })?.isDirectory() || statSync(out, { throwIfNoEntry: false })?.isDirectory())) throw new Error("--out needs a file in an existing directory");
    if (!apply) {
      console.log(`dry run: would run ${tasks.length} task(s) × ${n}:`);
      for (const t of tasks) console.log(`  ${t.id} (${t.split}): ${t.run.join(" ")}  [cwd ${resolve(root, t.cwd ?? ".")}]`);
      console.log(`(pass --apply to execute these commands${opts.out ? ` and write ${resolve(opts.out)}` : ""})`);
      return;
    }
    const results = tasks.map((t) => {
      const runs = Array.from({ length: n }, () => runTask(root, t));
      const scores = runs.map((r) => r.score);
      const row = { id: t.id, split: t.split, definitionHash: definitionHash(t), runs, mean: r3(mean(scores)), spread: r3(Math.max(...scores) - Math.min(...scores)) };
      console.log(`${row.mean === 1 ? "PASS" : row.mean === 0 ? "FAIL" : "PART"}  ${t.id.padEnd(28)} ${t.split.padEnd(6)} mean ${row.mean} spread ${row.spread}${runs.find((r) => r.error) ? ` (${runs.find((r) => r.error).error})` : ""}`);
      return row;
    });
    const doc = { schema: RUN_SCHEMA, at: new Date().toISOString(), split, n, tasks: results, summary: summarize(results) };
    for (const [s, v] of Object.entries(doc.summary)) console.log(`${s}: mean ${v.mean} over ${v.tasks} task(s), max spread ${v.max_spread}`);
    if (out) {
      const temporary = `${out}.${randomUUID()}.tmp`;
      const previous = statSync(out, { throwIfNoEntry: false });
      const mode = previous ? previous.mode & 0o777 : 0o600;
      try {
        writeFileSync(temporary, JSON.stringify(doc, null, 2) + "\n", { flag: "wx", mode: 0o600 });
        chmodSync(temporary, mode);
        renameSync(temporary, out);
      } finally { rmSync(temporary, { force: true }); }
      console.log(`wrote ${out}`);
    }
    return;
  }
  if (sub === "compare") {
    if (!a || !b) throw new Error("compare needs two results files (from `uika eval run --out`)");
    const read = (f) => { if (!existsSync(f)) throw new Error(`no such file: ${f}`); return JSON.parse(readFileSync(f, "utf8")); };
    const c = compareRuns(read(a), read(b));
    if (opts.json) console.log(JSON.stringify(c, null, 2));
    else console.log(`train ${c.train_delta ?? "-"} · test ${c.test_delta ?? "-"} · noise ${c.noise}\nverdict: ${c.verdict.toUpperCase()} — ${c.reason}`);
    return;
  }
  throw new Error(`unknown subcommand "${sub ?? ""}" (ls|run|compare)`);
}
