// video.test.mjs — `uika video`: listing, argument validation, the missing-ffmpeg path, profile maths,
// the pack linter, and (only where ffmpeg is installed) real QA, frame and structure runs.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, utimesSync, readdirSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseTime, profileFrom, diffProfiles, listVideos, lintPack, sheetTimes } from "./video.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "uika.mjs");
const run = (args, env = {}) => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, ...env } });
const temp = (t) => { const d = mkdtempSync(join(tmpdir(), "uika-video-")); t.after(() => rmSync(d, { recursive: true, force: true })); return d; };
const HAVE_FFMPEG = spawnSync(process.env.UIKA_FFMPEG || "ffmpeg", ["-version"]).status === 0 && spawnSync(process.env.UIKA_FFPROBE || "ffprobe", ["-version"]).status === 0;

test("video ls walks breadth-first, prunes media/ unless --deep, and honours --since", (t) => {
  const d = temp(t);
  for (const p of ["media", "deep/er", "node_modules"]) mkdirSync(join(d, p), { recursive: true });
  for (const f of ["top.mp4", "media/raw.mov", "deep/er/cut.webm", "node_modules/x.mp4", "notes.txt"]) writeFileSync(join(d, f), "x");
  const old = new Date(Date.now() - 10 * 86400e3);
  utimesSync(join(d, "deep/er/cut.webm"), old, old);
  const names = (rows) => rows.map((r) => r.path.slice(d.length + 1).replace(/\\/g, "/")).sort();
  assert.deepEqual(names(listVideos(d)), ["deep/er/cut.webm", "top.mp4"]);
  assert.deepEqual(names(listVideos(d, { deep: true })), ["deep/er/cut.webm", "media/raw.mov", "top.mp4"]);
  assert.deepEqual(names(listVideos(d, { since: "3d" })), ["top.mp4"]);
  const r = run(["video", "ls", d, "--json"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).length, 2);
  const missing = run(["video", "ls", join(d, "nope")]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /no such directory/);
});

test("video commands that need ffmpeg fail with an install hint when it is missing", (t) => {
  const d = temp(t);
  const film = join(d, "a.mp4");
  writeFileSync(film, "not really a film");
  const env = { UIKA_FFPROBE: join(d, "no-such-ffprobe"), UIKA_FFMPEG: join(d, "no-such-ffmpeg") };
  for (const args of [["qa", film], ["sheet", film], ["frame", film, "1"], ["structure", film]]) {
    const r = run(["video", ...args], env);
    assert.equal(r.status, 1, `${args[0]} should fail`);
    assert.match(r.stderr, /ffprobe not found .*install ffmpeg/, args[0]);
  }
  assert.deepEqual(readdirSync(d), ["a.mp4"], "nothing written");
});

test("video argument validation names the problem", () => {
  assert.match(run(["video", "frame"]).stderr, /needs a film file and a time/);
  assert.match(run(["video", "qa"]).stderr, /qa needs a film file/);
  assert.match(run(["video", "bogus"]).stderr, /unknown subcommand "bogus"/);
  assert.match(run(["video", "prompt", "check", "x"]).stderr, /prompt lint/);
  assert.equal(run(["video", "diff", "a.json"]).status, 1);
});

test("time parsing and sheet times", () => {
  assert.equal(parseTime("2.5", 10), 2.5);
  assert.equal(parseTime("end-3", 10), 7);
  assert.ok(parseTime("end", 10) < 10 && parseTime("end", 10) > 9.9);
  assert.throws(() => parseTime("1m", 10), /seconds/);
  assert.throws(() => parseTime("12", 10), /past the end/);
  assert.equal(sheetTimes(12).length, 12);
  assert.deepEqual(sheetTimes(10, "1,end-2"), [1, 8]);
});

test("structure profile maths and profile diff", () => {
  const p = profileFrom([2, 3, 7], 10, { fps: 25 });
  assert.equal(p.shots, 4);
  assert.deepEqual(p.cuts, [2, 3, 7]);
  assert.equal(p.shot_seconds.median, 2.5);
  assert.equal(p.log_histogram.counts.reduce((s, c) => s + c, 0), 4);
  assert.equal(p.transitions.status, "deferred");
  assert.equal(diffProfiles(p, p).verdict, "clone");
  const q = profileFrom([0.4, 0.8, 1.2, 1.6, 2, 2.4, 2.8, 3.2, 3.6, 4, 4.4], 30);
  assert.equal(diffProfiles(p, q).verdict, "distinct");
  assert.throws(() => diffProfiles({}, p), /not a uika\.video-structure\.v1/);
});

test("profile diff rejects missing, non-numeric and invalid comparison values", () => {
  const good = profileFrom([1], 2);
  for (const bad of [{ schema: good.schema }, { ...good, shots: NaN }, { ...good, shots: -1 }, { ...good, shots: 1.2 }, { ...good, entropy_bits: null }, { ...good, shot_seconds: { ...good.shot_seconds, median: Infinity } }, { ...good, shot_seconds: { ...good.shot_seconds, iqr: "1" } }]) {
    assert.throws(() => diffProfiles(good, bad), /invalid .*structure profile/);
  }
});

test("qa fails when ffmpeg exits or is killed without stderr", { skip: (!HAVE_FFMPEG || process.platform === "win32") && "requires ffmpeg and a POSIX shell" }, (t) => {
  const d = temp(t), film = join(d, "clip.mp4");
  const gen = spawnSync(process.env.UIKA_FFMPEG || "ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=size=64x64:rate=5:duration=1", "-pix_fmt", "yuv420p", film], { encoding: "utf8" });
  assert.equal(gen.status, 0, gen.stderr);
  for (const [name, body, detail] of [["exit", "exit 7", /exited 7/], ["signal", "kill -TERM $$", /terminated by SIGTERM/]]) {
    const wrapper = join(d, name); writeFileSync(wrapper, `#!/bin/sh\n${body}\n`); chmodSync(wrapper, 0o755);
    const r = run(["video", "qa", film], { UIKA_FFMPEG: wrapper });
    assert.notEqual(r.status, 0);
    assert.match(r.stdout, /FAIL\s+decode/);
    assert.match(r.stdout, detail);
  }
});

test("qa fails when only ffmpeg audio analysis fails silently", { skip: (!HAVE_FFMPEG || process.platform === "win32") && "requires ffmpeg and a POSIX shell" }, (t) => {
  const d = temp(t), film = join(d, "audio.mp4"), wrapper = join(d, "ffmpeg-wrapper");
  const ffmpeg = process.env.UIKA_FFMPEG || "ffmpeg";
  const gen = spawnSync(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "color=size=64x64:rate=5:duration=1", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "1", "-pix_fmt", "yuv420p", "-c:a", "aac", film], { encoding: "utf8" });
  assert.equal(gen.status, 0, gen.stderr);
  // Delegate decode to the same executable while forcing the audio filter command to fail.
  writeFileSync(wrapper, '#!/bin/sh\nfor arg do [ "$arg" = "-af" ] && exit 7; done\nexec "$REAL_FFMPEG" "$@"\n'); chmodSync(wrapper, 0o755);
  const r = run(["video", "qa", film], { UIKA_FFMPEG: wrapper, REAL_FFMPEG: ffmpeg });
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /PASS\s+decode/);
  assert.match(r.stdout, /FAIL\s+audio analysis\s+ffmpeg exited 7/);
  assert.doesNotMatch(r.stdout, /PASS\s+silence/);
});

test("qa requires actual decode progress and audio measurements even after exit zero", { skip: (!HAVE_FFMPEG || process.platform === "win32") && "requires ffmpeg and a POSIX shell" }, (t) => {
  const d = temp(t), film = join(d, "audio.mp4"), wrapper = join(d, "ffmpeg-wrapper");
  const ffmpeg = process.env.UIKA_FFMPEG || "ffmpeg";
  const gen = spawnSync(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "color=size=64x64:rate=5:duration=1", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "1", "-pix_fmt", "yuv420p", "-c:a", "aac", film], { encoding: "utf8" });
  assert.equal(gen.status, 0, gen.stderr);
  writeFileSync(wrapper, '#!/bin/sh\nexit 0\n'); chmodSync(wrapper, 0o755);
  const noop = run(["video", "qa", film], { UIKA_FFMPEG: wrapper });
  assert.equal(noop.status, 1);
  assert.match(noop.stdout, /FAIL\s+decode\s+completed frame decode was not reported/);
  assert.match(noop.stdout, /FAIL\s+audio analysis\s+complete ebur128 summary unavailable/);
  assert.doesNotMatch(noop.stdout, /PASS\s+(decode|silence)/);
  writeFileSync(wrapper, '#!/bin/sh\nfor arg do [ "$arg" = "-af" ] && exit 0; done\nexec "$REAL_FFMPEG" "$@"\n');
  const audioOnly = run(["video", "qa", film], { UIKA_FFMPEG: wrapper, REAL_FFMPEG: ffmpeg });
  assert.equal(audioOnly.status, 1);
  assert.match(audioOnly.stdout, /PASS\s+decode/);
  assert.match(audioOnly.stdout, /FAIL\s+audio analysis/);
  assert.doesNotMatch(audioOnly.stdout, /PASS\s+silence/);
  assert.equal(run(["video", "qa", film]).status, 0, "real silent audio remains valid");
});

test("video diff exits non-zero on a clone and zero on a distinct pair", (t) => {
  const d = temp(t);
  const a = join(d, "a.json"), b = join(d, "b.json");
  writeFileSync(a, JSON.stringify(profileFrom([2, 3, 7], 10)));
  writeFileSync(b, JSON.stringify(profileFrom([0.4, 0.8, 1.2, 1.6, 2, 2.4, 2.8, 3.2, 3.6, 4, 4.4], 30)));
  const same = run(["video", "diff", a, a]);
  assert.equal(same.status, 1);
  assert.match(same.stdout, /verdict: CLONE/);
  const other = run(["video", "diff", a, b]);
  assert.equal(other.status, 0, other.stderr);
  assert.match(other.stdout, /verdict: DISTINCT/);
});

const PACK = (over = {}) => {
  const o = { spec: "2 s · 25 fps · 50 frames · 640x360 native · 1920x1080 export", cut2: "25 | 1.000", slot: "white", rect: "(10,10)-(200,40)", ...over };
  return `---
pack: demo
title: "Demo"
spec: ${o.spec}
theme_pack: skills/retro-pixel
audio: inputs/demo_bed.wav
output: out/demo.mp4
owner: me.author
hand_seed: seed-1
precedence: law > scene-spec > usage-table > example
---

# Pack: Demo

## 1. Brief and creative hand
Brief.
## 2. What the film claims
Claim.
## 3. Timing

| # | frame | G s | lands on | scene after | visible change |
|---|---|---|---|---|---|
| 1 | ${o.cut2} | \`onset@1.000\` ±0.04 | two | colour flips |

## 4. Style bible
Style.
## 5. Palette and colour law

| slot | hex | meaning |
|---|---|---|
| black | #000000 | field |
| white | #ffffff | text |

## 7. Scenes

### one — Open — frames 0-24 (0.000G-0.960G)

| id | scene | element | rect | slot | reveal (+) | hold | content | guard | evidence |
|---|---|---|---|---|---|---|---|---|---|
| \`title\` | one | title | ${o.rect} | ${o.slot} | \`+0.20\` | to cut | \`DEMO\` | data | — |

### two — Close — frames 25-49 (1.000G-1.960G)

## 9. Acceptance tests

| id | tool | command | expected | tolerance | consequence |
|---|---|---|---|---|---|
| \`a-qa\` | uika video qa | \`uika video qa out/demo.mp4 --expect-duration 2\` | PASS 0 fail | exact | build fails |

## 10. Deliberately free
Easing.
## 11. Deliberately fixed
Text.
## 12. Build report required
Report.
`;
};

test("video prompt lint passes a closed pack and names each broken rule", (t) => {
  const d = temp(t);
  const good = join(d, "demo.vprompt.md");
  writeFileSync(good, PACK());
  const ok = run(["video", "prompt", "lint", good]);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /MANUAL L4/);
  const r = lintPack(good);
  assert.equal(r.fail, 0);
  writeFileSync(good, PACK({ spec: "2 s · 25 fps · 48 frames · 640x360 native · x", cut2: "25 | 1.300", slot: "red", rect: "(10,10)-(700,40)" }));
  const bad = run(["video", "prompt", "lint", good, "--json"]);
  assert.equal(bad.status, 1);
  const rules = JSON.parse(bad.stdout).results.filter((x) => x.level === "fail").map((x) => `${x.rule}:${x.message}`).join("\n");
  assert.match(rules, /L1:spec: 2 s × 25 fps = 50, not 48 frames/);
  assert.match(rules, /L1:.*does not match frame 25/);
  assert.match(rules, /L5:.*undefined slot "red"/);
  assert.match(rules, /L6:.*outside the 640x360 canvas/);
  const renamed = join(d, "other.vprompt.md");
  writeFileSync(renamed, PACK());
  assert.match(lintPack(renamed).results.map((x) => x.message).join("\n"), /does not equal the file stem "other"/);
});

test("video qa, frame, sheet and structure on a generated film (needs ffmpeg)", { skip: !HAVE_FFMPEG && "ffmpeg/ffprobe not installed" }, (t) => {
  const d = temp(t);
  const film = join(d, "clip.mp4");
  const gen = spawnSync(process.env.UIKA_FFMPEG || "ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc=size=160x90:rate=25:duration=1", "-f", "lavfi", "-i", "color=red:size=160x90:rate=25:duration=1", "-filter_complex", "[0:v][1:v]concat=n=2:v=1[v]", "-map", "[v]", "-pix_fmt", "yuv420p", film], { encoding: "utf8" });
  assert.equal(gen.status, 0, gen.stderr);
  const qa = run(["video", "qa", film, "--expect-duration", "2"]);
  assert.equal(qa.status, 0, qa.stdout + qa.stderr);
  assert.match(qa.stdout, /PASS\s+decode/);
  assert.match(qa.stdout, /WARN\s+audio stream/);
  const wrong = run(["video", "qa", film, "--expect-duration", "5"]);
  assert.equal(wrong.status, 1);
  assert.match(wrong.stdout, /FAIL\s+duration/);
  const twin = run(["video", "qa", film, "--against", film]);
  assert.match(twin.stdout, /FAIL\s+twin\s+byte-identical/);
  const dry = run(["video", "sheet", film]);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /dry run: would write/);
  assert.deepEqual(readdirSync(d), ["clip.mp4"], "sheet without --apply writes nothing");
  const out = join(d, "f.png");
  const fr = run(["video", "frame", film, "end-0.5", "--crop", "80:45:0:0", "--width", "40", "--out", out, "--apply"]);
  assert.equal(fr.status, 0, fr.stderr);
  assert.ok(existsSync(out));
  const st = run(["video", "structure", film]);
  assert.equal(st.status, 0, st.stderr);
  const prof = JSON.parse(st.stdout);
  assert.equal(prof.shots, 2);
  assert.ok(Math.abs(prof.cuts[0] - 1) < 0.05, `cut near 1 s: ${prof.cuts}`);
});
