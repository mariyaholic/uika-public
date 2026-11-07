# Preview verification

This source preview contains the reviewed figure and video repairs with synthetic regression coverage. The core CLI has zero npm runtime dependencies.

## Verification commands

```sh
npm test
npm run scrub
node bin/uika.mjs lint --strict
node bin/uika.mjs docs check --strict
node bin/uika.mjs skills validate --strict
npm pack --dry-run --json
```

The test suite includes isolated tarball installation and installed CLI smoke checks. Run these commands with Node.js 22 or later.

## Historical reviewed repair identity

These hashes identify the original five-file repair as first exported. The portability follow-up changes only the test fixture identified below; the four remaining files retain these hashes.

| File | SHA-256 |
| --- | --- |
| skills/figure-craft/kit/figure.mjs | `673a1b95cd4e50f41cacc31d41ec9033d29b8c5cdde1802661a642cc5895cdf6` |
| src/figure.mjs | `e99f1529d75aa8e7e5c3e4adcc306ae054c33953e2c0196e6b174380eb6d1df5` |
| src/figure.test.mjs | `d7b11111d23f228eef238f0ca00777ba3e816a587c5855de8a13a4da6f7914ad` |
| src/video.mjs | `354836454c03f220900d86fd14c885f6065588877a588d7b2f26dd0efae7f7b1` |
| src/video.test.mjs | `512de188d4d20ba303a5c6fa70c522afa1d8bca9e925da14fcd8fe00614ebd92` |

## Windows test portability follow-up

The [initial CI run](https://github.com/mariyaholic/uika-public/actions/runs/42328807053) passed Linux and macOS but failed two Windows figure tests before their intended assertions: filesystem paths were passed directly to Node ESM loading options. This follow-up uses file URLs for both options and gives those fixtures paths containing spaces, `#` and `%` to exercise URL encoding on every platform. The behavioral assertions are unchanged.

Current `src/figure.test.mjs` SHA-256: `c51fd0a19132cdd8fc56c565d32a1b488378f51549ffdb099e33d67acc537a4d`.

At preparation of this follow-up, its exact-head remote CI had not run. Consult the workflow results for the revision you use.

## Evidence boundaries

Earlier local checks of these exact repair files passed 160 tests on Node 22.23.4 and 160 on Node 24.19.0. A separate synthetic isolation harness passed 39 cases. Those earlier runs do not substitute for rerunning the selected source tree.

The CI workflow targets Node 22 on Linux, Windows and macOS. Successful native browser PNG/PDF export, real browser/media integrations on Windows and macOS, and live provider or other-harness integration remain unverified. Browser-stub regressions verify failure handling, not native image export. Synthetic media checks do not demonstrate rights for user-supplied assets.

No npm package or release is published by this source verification.
