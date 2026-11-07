# Skills scope and provenance

The source preview contains **39 estate-authored skills** in `skills/`: the original 17
operating/principle skills plus 22 ports. Each folder has a `SKILL.md`; some also contain
manuals, reference material, examples, schemas, or helper kits. The package includes the
skills tree and this document.

As stated in [NOTICE](../NOTICE), these are estate-authored materials. Third-party skills
are not vendored. References to upstream tools or skills do not include those tools or grant
rights to external assets. See [LICENSE](../LICENSE) for the repository license and NOTICE
for its lineage.

## Original operating and principle skills (17)

correct-structure, create-verification-skill, delegation-protocol, find-fast, freshness-scan,
handoff-protocol, mcp-and-keys, principle-attack-the-premise,
principle-encode-lessons-in-structure, principle-guard-the-context-window,
principle-laziness-protocol, principle-never-block-on-the-human, principle-prove-it-works,
script-hygiene, shell-safe-writes, toolchains, wrap-checklist.

## Additional ports (22)

copy-craft, creative-gates, document-craft, estate-sync, eval-hillclimb, explainer,
figure-craft, keynote-launch, mql5-review, prompt-library, retro-pixel, setup-uika-models,
supply-layer, theme-craft, tower-bridge, uika-help, uika-mode, video-direction,
video-pipeline, video-prompt, video-review, visual-direction.

Six ports are workflow templates: `estate-sync`, `mql5-review`, `prompt-library`,
`setup-uika-models`, `supply-layer`, and `tower-bridge`. Their `MANUAL.md` files explain
the interfaces and infrastructure a user must provide. A template does not install or
implement that infrastructure.

## Dependencies and limits

- The core CLI has zero npm runtime dependencies. This does not mean every skill helper
  runs on Node alone.
- Video operations need ffmpeg/ffprobe where documented. Python media kits may need Python
  3.11+, NumPy, Pillow, SciPy, Manim, fonts, or separately configured speech tools.
- Figure SVG/HTML output uses the bundled engine. PNG/PDF export needs a separately installed
  Playwright environment.
- Read the chosen skill's requirements and inspect its helpers before executing them.
  External tools, fonts, services, reference assets, and credentials are user-provided.
- The CLI includes `video`, `figure`, `ref`, and `eval`. Skills that describe creative,
  prompt, model, supply, or MT5 infrastructure may require commands absent from this preview.
- Skills guide an agent's work. They do not supply model execution, bypass harness
  authorization, or establish that a provider or live harness integration has been verified.

## Validation

Use `uika skills validate --strict` against an estate containing the skills you selected.
Bootstrap does not copy bundled skills automatically; follow the [README](../README.md)
for an example. Placement copies that estate's skills to its configured harness homes.

Repository tests check the expected package contents, including the skills tree.
`npm run scrub` checks source and packed content for the configured privacy patterns.
These checks support review; they do not prove every optional toolchain or end-to-end
creative workflow. Run the chosen workflow in your own environment and record its evidence.
