# Uika Roadmap

See the root [ROADMAP.md](../ROADMAP.md) for the full roadmap.

**Release state: `0.1.0 source preview`; npm package unpublished.** This tree is being
prepared for a clean public source repository. Source publication and npm distribution are
separate steps. APIs, manifest fields, and harness mappings may change before 1.0.

1. **Present in this tree:** the 19-command estate CLI, fingerprinted law blocks, docs and
   session checks, opt-in Git distribution, search, bootstrap, and 39 estate-authored skills
   (17 original skills plus 22 ports). Basic `video`, `figure`, `ref`, and `eval` commands
   are included; optional media/rendering dependencies are not installed by the CLI.
2. **Next:** publish the reviewed source in its clean repository, verify links and CI for the
   exact revision on Linux/Windows/macOS, then prepare npm distribution as a separate step.
   Portable skill packing, clearer placement previews, and runtime schema validation follow.
3. **Later:** expand harness adapters, repair generated-block drift, improve worktree support,
   and add a health doctor.
4. **Later registries:** MCP/model configuration, optional local usage tracking, and
   audience-aware asset distribution.
5. **Later tooling:** creative divergence/taste-ledger commands and optional plugins for
   heavier media and rendering features.

Run the checks in [CONTRIBUTING.md](../CONTRIBUTING.md) for your source revision.
A Linux test run does not establish native Windows or macOS support, and live harness,
provider, and optional media workflows require separate verification.
