// eval.test.mjs — `uika eval`: task loading, dry-run planning, real runs with scores, and keep/revert verdicts.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { compareRuns, RUN_SCHEMA, loadTasks, summarize } from "./eval.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "uika.mjs");
const run = (args, root) => spawnSync(process.execPath, [CLI, ...args, "--root", root], { encoding: "utf8" });

function estate(t) {
  const root = mkdtempSync(join(tmpdir(), "uika-eval-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const tasks = join(root, "labs", "eval", "tasks");
  mkdirSync(tasks, { recursive: true });
  const task = (id, split, code) => writeFileSync(join(tasks, `${id}.json`), JSON.stringify({ id, split, run: ["node", "-e", code] }));
  task("passes", "train", "require('fs').appendFileSync('ran.txt', 'p')");
  task("fails", "train", "process.exit(3)");
  task("scored", "test", "console.log(JSON.stringify({ score: 0.5 }))");
  return root;
}

test("eval ls reads tasks and rejects malformed ones", (t) => {
  const root = estate(t);
  const r = run(["eval", "ls"], root);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /3 task\(s\): 2 train, 1 test/);
  writeFileSync(join(root, "labs", "eval", "tasks", "broken.json"), JSON.stringify({ split: "dev", run: ["x"] }));
  assert.throws(() => loadTasks(join(root, "labs", "eval", "tasks")), /split must be train or test/);
  const none = mkdtempSync(join(tmpdir(), "uika-eval-none-"));
  t.after(() => rmSync(none, { recursive: true, force: true }));
  assert.match(run(["eval", "ls"], none).stderr, /no eval tasks folder/);
});

test("eval run plans without --apply and executes with it", (t) => {
  const root = estate(t);
  const out = join(root, "results.json");
  const dry = run(["eval", "run", "--out", out], root);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /dry run: would run 3 task\(s\) × 1/);
  assert.equal(existsSync(join(root, "ran.txt")), false, "dry run executed a grader");
  assert.equal(existsSync(out), false);
  const wet = run(["eval", "run", "--n", "2", "--out", out, "--apply"], root);
  assert.equal(wet.status, 0, wet.stderr);
  assert.equal(readFileSync(join(root, "ran.txt"), "utf8"), "pp");
  const doc = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(doc.schema, RUN_SCHEMA);
  assert.deepEqual(doc.summary, { train: { tasks: 2, mean: 0.5, max_spread: 0 }, test: { tasks: 1, mean: 0.5, max_spread: 0 } });
  assert.equal(doc.tasks.find((x) => x.id === "fails").runs[0].exit, 3);
  const train = run(["eval", "run", "--split", "test", "--apply"], root);
  assert.match(train.stdout, /PART\s+scored/);
  assert.match(run(["eval", "run", "--split", "dev"], root).stderr, /--split must be/);
  assert.match(run(["eval", "run", "--n", "0"], root).stderr, /--n must be/);
});

test("eval compare keeps a real train gain and reverts noise or regressions", () => {
  const doc = (train, test, spread = 0.1) => {
    const tasks = [["train", train], ["test", test]].filter(([, score]) => score != null).map(([split, score]) => ({
      id: split, split, definitionHash: "a".repeat(64), mean: score, spread,
      runs: [{ score: score - spread / 2 }, { score: score + spread / 2 }],
    }));
    return { schema: RUN_SCHEMA, tasks, summary: summarize(tasks) };
  };
  assert.equal(compareRuns(doc(0.5, 0.5), doc(0.75, 0.5)).verdict, "keep");
  assert.equal(compareRuns(doc(0.5, 0.5), doc(0.55, 0.5)).verdict, "revert");
  assert.match(compareRuns(doc(0.5, 0.5), doc(0.8, 0.2)).reason, /test regressed/);
  assert.equal(compareRuns(doc(0.3, 0.8, 0.2), doc(0.8, 0.7, 0)).verdict, "revert");
  assert.equal(compareRuns(doc(0.5, null), doc(0.8, null)).verdict, "keep?");
  assert.throws(() => compareRuns({}, doc(0.5, 0.5)), /not a uika\.eval-run\.v1/);
});

test("eval compares matching task identities and validates recorded statistics", (t) => {
  const root = estate(t);
  const out = join(root, "results.json");
  assert.equal(run(["eval", "run", "--apply", "--out", out], root).status, 0);
  const before = JSON.parse(readFileSync(out, "utf8"));
  const candidate = () => structuredClone(before);
  const dropped = candidate();
  dropped.tasks.splice(0, 1);
  dropped.summary = summarize(dropped.tasks);
  assert.throws(() => compareRuns(before, dropped), /not comparable/);
  const redefined = candidate();
  redefined.tasks[0].definitionHash = "b".repeat(64);
  assert.throws(() => compareRuns(before, redefined), /not comparable/);
  const resplit = candidate();
  resplit.tasks[0].split = "test";
  resplit.summary = summarize(resplit.tasks);
  assert.throws(() => compareRuns(before, resplit), /not comparable/);
  const forged = candidate();
  forged.summary.train.mean = 1;
  assert.throws(() => compareRuns(before, forged), /inconsistent split summary/);
  const invalid = candidate();
  invalid.tasks[0].runs[0].score = null;
  assert.throws(() => compareRuns(before, invalid), /invalid samples/);
  assert.throws(() => compareRuns({ schema: RUN_SCHEMA, summary: {} }, before), /need task records/);
  assert.equal(compareRuns(before, candidate()).verdict, "revert");
});

test("malformed eval tasks and unusable result paths fail before executing graders", (t) => {
  const root = estate(t);
  const taskDir = join(root, "labs", "eval", "tasks");
  for (const value of [null, [], { id: 1, split: "train", run: ["node"] }, { split: "train", run: [""] }, { split: "train", run: ["node"], timeout_s: 0 }, { split: "train", run: ["node"], timeout_s: "1" }, { split: "train", run: ["node"], cwd: null }]) {
    writeFileSync(join(taskDir, "broken.json"), JSON.stringify(value));
    assert.throws(() => loadTasks(taskDir));
  }
  rmSync(join(taskDir, "broken.json"));
  const result = run(["eval", "run", "--apply", "--out", join(root, "missing", "results.json")], root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--out needs a file/);
  assert.equal(existsSync(join(root, "ran.txt")), false);
});

test("sub-millipoint held-out regressions cannot round into a keep verdict", () => {
  const doc = (train, heldout) => {
    const tasks = [["train", train], ["test", heldout]].map(([split, score]) => ({ id: split, split, definitionHash: "a".repeat(64), runs: [{ score }], mean: +score.toFixed(3), spread: 0 }));
    return { schema: RUN_SCHEMA, tasks, summary: summarize(tasks) };
  };
  const result = compareRuns(doc(0.2, 0.5004), doc(0.8, 0.5001));
  assert.equal(result.verdict, "revert");
  assert.equal(result.test_delta, -0.0003);
});

test("atomic eval results preserve restrictive POSIX file permissions", { skip: process.platform === "win32" }, (t) => {
  const root = estate(t), out = join(root, "private-results.json");
  writeFileSync(out, "old", { mode: 0o600 });
  const result = run(["eval", "run", "--apply", "--out", out], root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(statSync(out).mode & 0o777, 0o600);
});

test("sub-millipoint train noise cannot round into a keep verdict", () => {
  const doc = (scores) => {
    const tasks = [
      { id: "train", split: "train", definitionHash: "a".repeat(64), runs: scores.map((score) => ({ score })), mean: +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3), spread: +(Math.max(...scores) - Math.min(...scores)).toFixed(3) },
      { id: "test", split: "test", definitionHash: "b".repeat(64), runs: [{ score: 0.5 }], mean: 0.5, spread: 0 },
    ];
    return { schema: RUN_SCHEMA, tasks, summary: summarize(tasks) };
  };
  const result = compareRuns(doc([0.3, 0.3004]), doc([0.3005, 0.3005]));
  assert.equal(result.verdict, "revert");
  assert.ok(result.noise > result.train_delta);
});
