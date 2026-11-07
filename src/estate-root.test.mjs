import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { npmCli as locateNpmCli } from "../tools/scrub_privacy.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("installed CLI uses explicit, environment, then current-directory estate roots", (t) => {
  const scratch = mkdtempSync(join(tmpdir(), "uika-root-contract-"));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));

  const npmCli = locateNpmCli();
  const packDir = join(scratch, "pack");
  const prefix = join(scratch, "install");
  const runner = join(scratch, "runner");
  const isolatedHome = join(scratch, "home");
  const initEstate = join(scratch, "initialized-estate");
  const envEstate = join(scratch, "env-estate");
  const explicitEstate = join(scratch, "explicit-estate");
  const statusRepo = join(scratch, "status-repo");
  const poisonTarget = join(scratch, "package-parent-target");
  for (const dir of [packDir, prefix, runner, isolatedHome, statusRepo, join(statusRepo, ".git"), poisonTarget]) mkdirSync(dir, { recursive: true });

  const npmUserConfig = join(scratch, "user.npmrc");
  const npmGlobalConfig = join(scratch, "global.npmrc");
  const gitConfig = join(scratch, "gitconfig");
  writeFileSync(npmUserConfig, "");
  writeFileSync(npmGlobalConfig, "");
  writeFileSync(gitConfig, "");
  execFileSync("git", ["init", "-q", statusRepo], { env: { ...process.env, GIT_CONFIG_GLOBAL: gitConfig, GIT_CONFIG_NOSYSTEM: "1" } });
  const npmEnv = {
    ...process.env,
    GIT_CONFIG_GLOBAL: gitConfig,
    npm_config_cache: join(scratch, "npm-cache"),
    npm_config_globalconfig: npmGlobalConfig,
    npm_config_userconfig: npmUserConfig,
  };

  const npm = (args, cwd) => execFileSync(process.execPath, [npmCli, ...args], {
    cwd,
    env: npmEnv,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const packed = JSON.parse(npm(["pack", "--json", "--pack-destination", packDir], packageRoot));
  const tarball = join(packDir, packed[0].filename);
  npm(["install", "--offline", "--no-audit", "--no-fund", "--prefix", prefix, tarball], scratch);

  const installedCli = join(prefix, "node_modules", "uika", "bin", "uika.mjs");
  const envTarget = join(scratch, "env-target");
  const explicitTarget = join(scratch, "explicit-target");
  const cwdTarget = join(scratch, "cwd-target");
  for (const dir of [envTarget, explicitTarget, cwdTarget]) mkdirSync(dir, { recursive: true });
  writeFileSync(join(envTarget, "env-marker.txt"), "env\n");
  writeFileSync(join(explicitTarget, "explicit-marker.txt"), "explicit\n");
  writeFileSync(join(cwdTarget, "cwd-marker.txt"), "cwd\n");

  const writeEstate = (root, project, targetName, targetPath) => {
    mkdirSync(join(root, "projects"), { recursive: true });
    writeFileSync(join(root, "estate.json"), JSON.stringify({
      estate: { distribution: { targets: [{ repo: targetName, path: targetPath }] } },
    }));
    writeFileSync(join(root, "projects", "registry.json"), JSON.stringify({
      projects: { [project]: { aliases: [], paths: [targetPath], default: true } },
    }));
  };
  writeEstate(envEstate, "env-project", "env-target", envTarget);
  writeEstate(explicitEstate, "explicit-project", "explicit-target", explicitTarget);
  writeEstate(runner, "cwd-project", "cwd-target", cwdTarget);
  mkdirSync(join(explicitEstate, ".git"), { recursive: true });

  // The old package-relative resolver lands here. A selected estate must never read it.
  writeFileSync(join(prefix, "estate.json"), JSON.stringify({
    estate: { distribution: { targets: [{ repo: "package-parent-poison", path: poisonTarget }] } },
  }));

  const run = (args, cwd, estateHome) => {
    const env = { ...process.env, GIT_CONFIG_GLOBAL: gitConfig, GIT_CONFIG_NOSYSTEM: "1", HOME: isolatedHome, USERPROFILE: isolatedHome };
    if (estateHome === undefined) delete env.UIKA_ESTATE_HOME;
    else env.UIKA_ESTATE_HOME = estateHome;
    const r = spawnSync(process.execPath, [installedCli, ...args], { cwd, env, encoding: "utf8" });
    assert.equal(r.status, 0, `uika ${args.join(" ")} failed: ${r.stderr}`);
    assert.doesNotMatch(r.stderr, /fatal:/i, `uika ${args.join(" ")} leaked a Git diagnostic`);
    return r.stdout;
  };

  const envTargets = run(["deploy", "targets"], scratch, envEstate);
  assert.match(envTargets, /env-target/);
  assert.doesNotMatch(envTargets, /package-parent-poison/);

  const explicitTargets = run(["deploy", "targets", "--root", explicitEstate], scratch, envEstate);
  assert.match(explicitTargets, /explicit-target/);
  assert.doesNotMatch(explicitTargets, /env-target|package-parent-poison/);

  const status = JSON.parse(run(["deploy", "status", "--json", "--root", explicitEstate], statusRepo, envEstate));
  assert.equal(resolve(status.estateRoot), resolve(explicitEstate));
  // The repo comes from the process cwd, which the OS reports canonically (macOS: /var -> /private/var).
  assert.equal(realpathSync(status.repo), realpathSync(statusRepo));

  assert.ok(run(["deploy", "auto", "status", "--root", explicitEstate], scratch, envEstate).includes(explicitEstate));

  const initialized = run(["init", initEstate, "--apply"], scratch, initEstate);
  assert.match(initialized, /Initialized:/);
  const lintOutput = run(["lint", "--strict"], initEstate, initEstate);
  assert.match(lintOutput, /lint: clean/, "a fresh init estate passes lint --strict");
  assert.match(run(["docs", "version"], scratch, envEstate), /docs v1/);
  assert.match(run(["find", "--project", "env-project", "--ext", "txt"], scratch, envEstate), /env-marker\.txt/);

  // Lint against a non-repo estate and a missing one: no inherited Git stderr.
  run(["lint"], scratch, scratch);
  run(["lint", "--root", join(scratch, "does-not-exist")], scratch, undefined);

  // CLI-only package: importing it is rejected by metadata and never runs the CLI.
  const imported = spawnSync(process.execPath, ["--input-type=module", "-e", 'await import("uika")'], { cwd: prefix, encoding: "utf8" });
  assert.notEqual(imported.status, 0);
  assert.match(imported.stderr, /ERR_PACKAGE_PATH_NOT_EXPORTED/);
  assert.equal(imported.stdout, "", "importing the package must not print CLI usage");

  const cwdTargets = run(["deploy", "targets"], runner, undefined);
  assert.match(cwdTargets, /cwd-target/);
  assert.doesNotMatch(cwdTargets, /package-parent-poison/);
});
