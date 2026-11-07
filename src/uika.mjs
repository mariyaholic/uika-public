// uika.mjs — dispatcher (0.1.0 preview).
// Commands: init | check | lint | sync | skills | audit | find | where | path | layout | session | adopt | deploy | docs | home
//           | video | figure | ref | eval
//
// The usage, registry (mcp/models/pot/prompt), supply, backup, limiter and mt5 planes of the
// estate tool are documented in docs/roadmap.md and are not bundled.
import { parseArgs } from "node:util";
import { init } from "./init.mjs";
import { check } from "./check.mjs";
import { lint } from "./lint.mjs";
import { sync } from "./sync.mjs";
import { skills, audit } from "./skills.mjs";
import { find, where } from "./find.mjs";
import { path, layout } from "./layout.mjs";
import { session } from "./session.mjs";
import { adopt } from "./adopt.mjs";
import { deploy } from "./deploy.mjs";
import { docs } from "./docs.mjs";
import { home } from "./home.mjs";
import { video } from "./video.mjs";
import { figure } from "./figure.mjs";
import { ref } from "./ref.mjs";
import { evalCmd } from "./eval.mjs";
import { resolveEstateRoot } from "./targets.mjs";

const argv = process.argv.slice(2);
let parsed;
try {
parsed = parseArgs({
  allowPositionals: true,
  options: {
    root: { type: "string" },
    force: { type: "boolean", default: false },
    apply: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    stop: { type: "boolean", default: false },
    json: { type: "boolean", default: false },
    all: { type: "boolean", default: false },
    "skills-only": { type: "boolean", default: false },
    strict: { type: "boolean", default: false },
    deep: { type: "boolean", default: false },
    project: { type: "string" },
    since: { type: "string" },
    on: { type: "string" },
    ext: { type: "string" },
    n: { type: "string" },
    from: { type: "string" },
    kind: { type: "string" },
    name: { type: "string" },
    to: { type: "string" },
    at: { type: "string" },
    out: { type: "string" },
    "expect-duration": { type: "string" },
    against: { type: "string" },
    "target-lufs": { type: "string" },
    crop: { type: "string" },
    width: { type: "string" },
    threshold: { type: "string" },
    formats: { type: "string" },
    tokens: { type: "string" },
    face: { type: "string" },
    theme: { type: "string" },
    split: { type: "string" },
    help: { type: "boolean", short: "h", default: false },
  },
});
} catch (err) {
  console.error(`uika: ${err.message}\nRun uika --help for usage.`);
  process.exit(2);
}
const { positionals, values } = parsed;
const [cmd, ...rest] = positionals;
const root = resolveEstateRoot(values.root);

const commands = { init, check, lint, sync, skills, audit, find, where, path, layout, session, adopt, deploy, docs, home, video, figure, ref, eval: evalCmd };

const run = Object.hasOwn(commands, cmd) ? commands[cmd] : undefined;
if (values.apply && values["dry-run"]) {
  console.error("uika: --apply and --dry-run cannot be combined");
  process.exit(2);
}
if (!run || values.help) {
  if (cmd && !run && !values.help) console.error(`uika: unknown command "${cmd}"`);
  console.log(`uika <command>  (0.1.0 preview — run inside an estate directory, or pass --root <dir> / set UIKA_ESTATE_HOME)
  init [dir] [--name n] [--apply] — bootstrap a compliant new estate from scratch
  check — machine probe: runtimes, harness homes, drive space
  lint [--strict] — context-budget linter: always-loaded file lines, law-block drift, skill hygiene (advisory; --strict exits 1 on any warning)
  sync <repo> [--force] [--apply] — distribute estate config into a clean target repo (ADR-0003 pattern)
  skills validate|place [--apply] | audit [repo] [--deep] — skill tiers into harness homes (ADR-0015 pattern)
  find [words] [--project p] [--since 3h|2d|yesterday|YYYY-MM-DD] [--on date] [--ext md] [--n 15] | where [name] — estate search & nickname resolution (ADR-0019 pattern)
  path <kind> <name> [--project p] [--from handle] [--apply] | layout [dir] — where a file goes (ADR-0022 pattern)
  session check [repo] [--stop] — freshness scan + WORKSTACK handoff + wrap gate (session protocol)
  adopt <repo> [--apply] [--dry-run] — inject the fingerprinted law block into a managed repo
  deploy status|targets|adopt <repo>|forget <repo> [--apply]|install|uninstall|auto|hook-run [--apply] [--skills-only] — commit-triggered distribution
  docs check [repo] [--json] [--strict] | render [repo] [--apply] | init <repo> [--apply] | migrate [repo] [--apply] | version — markdown standard & law-block automation
  home status [--json] | regen [--apply] [--force] [--json] — render harness home-law files from the estate
  video ls <dir> [--since 3d] [--deep] | qa <file> [--expect-duration s] [--against twin] | sheet <file> [--at 5,end-3] | frame <file> <t|end-N> [--crop w:h:x:y] [--width px] | structure <file> [--out f] | diff <a> <b> | prompt lint <pack> — film checks over ffmpeg (not bundled; writes need --apply)
  figure check <spec> | render <spec> [--formats svg,html,png,pdf] [--out dir] [--theme name | --tokens css --face night|light] [--apply] | ls [dir] | theme [name] — figure engine (png/pdf need Playwright)
  ref ls [--kind k] | show <id> | hash <id> [--json] | check — read-only reference views and integrity checks
  eval ls | run [--split train|test|all] [--n 3] [--out f] [--apply] | compare <before> <after> — local eval harness for hillclimbing

Not bundled (see docs/roadmap.md): usage tracker, mcp/models/pot/prompt registries, supply,
backup, limiter, mt5.`);
  process.exit(values.help ? 0 : 2);
}
try {
  await run({ root, rest, force: values.force, apply: values.apply, opts: values, argv });
  process.exit(0);
} catch (err) {
  console.error(`uika ${cmd}: ${err.message}`);
  process.exit(1);
}

