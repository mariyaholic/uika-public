---
name: mql5-review
description: "TEMPLATE — Use when authoring, debugging, or reviewing MetaTrader 5 MQL5 Expert Advisors, scripts, indicators, or test evidence. Triggers on .mq5/.mqh files, MT5 strategy tester, iCustom/buffer math, or portfolio backtesting asks."
---

# mql5-review — the seventh string

> TEMPLATE. The domain guidance below is generic; the private read-only MT5 harness it was written against is replaced by `<MT5_HARNESS>` placeholders. Build your own from `MANUAL.md`.

MQL5/MT5 domain guidance for estate work. It is an on-demand reference, not a claim of measured MQL5 competence or original authorship.

## Domain contract

- Choose `.mq5`/`.mqh` organization for the project. The six-string metaphor is review vocabulary, not a required file layout: signal, risk/sizing, context/filter, execution, exit/position management, telemetry/provenance.
- **Price and volume are different lattices.** Use `SYMBOL_TRADE_TICK_SIZE` for valid price increments and `SYMBOL_DIGITS` for display/serialization. Check volume against `SYMBOL_VOLUME_MIN`, `SYMBOL_VOLUME_MAX`, and `SYMBOL_VOLUME_STEP`; respect stop/freeze constraints and use `OrderCheck` where applicable. State rounding direction and risk units.
- **Indicator buffers are contracts.** Bound indices by `rates_total` and actual array sizes; state series orientation. `prev_calculated` is the prior return value, not an array bound. Handle first calculation, new bars, warm-up, history-reset-to-zero, and last-bar updates. Compare incremental output with full recomputation.
- **Trade results require reconciliation.** Classify return codes by operation: `PLACED` is not a fill and `DONE_PARTIAL` is distinct. Reconcile order/deal/position state, including transaction events, before retrying an uncertain request. Retry only a specifically transient, reconciled case; never blindly repeat a possibly accepted order.
- **Evidence is a matrix, not a magic PASS.** Keep inspected, compiled, unit, offline, native, OOS, live, and promotion claims separate. Require evidence appropriate to the change. A Tester report is needed for a native claim, but static/unit/offline evidence remains useful. Do not require R² when absent or infer OOS validity/promotion from one in-sample metric.
- **Includes have two forms and search rules:** `#include "Entry.mqh"` and `#include <Trade/Trade.mqh>`. Preserve their namespace and dependency closure; do not silently flatten or relocate files.
- **Generated means declared ownership.** A generator may own only declared outputs with schema, generator identity, input hashes, and a regeneration rule. File extension alone does not make source generated; hand-owned code stays hand-owned.

## Non-negotiables

1. Use `double` for prices, volumes, and money calculations; document units and conversions.
2. For time/risk rules, define the clock, timezone/DST handling, equity or balance basis, realized/unrealized components, scope, and breach action. Server time alone does not define a complete policy.
3. Match `#property indicator_plots` to registered plots and test buffer indices/orientation.
4. Do not treat a chart, cached session, skill load, or plan as permission. Any later side-effectful operation needs current, explicit action/run scope and must re-check approval.
5. Do not infer a universal grid/martingale permission or prohibition from this skill. Follow stricter project/estate policy; without an explicit approved strategy-specific risk policy, mark it unapproved and do not generate or execute it. Preserve any separate-control/specialist requirements.
6. Keep `OnTick` bounded and move suitable housekeeping to `OnTimer`; tick events can coalesce while one is queued or processing, so do not promise one handler call per incoming tick.

## Review dimensions

Use the six-string vocabulary to ask whether signal, risk/sizing, context/filter, execution, exit/position management, and telemetry/provenance are addressed. Projects may combine, split, rename, or omit files when justified. A generated layer is optional and must follow the declared-ownership rule above; Uika sync does not regenerate MT5 files.

## Estate ties and authority
- Source truth, deployment destination, artifact root and backup location come from an explicit project profile (`<MT5_PROFILE>`). The terminal is a deployment target, not the canonical source. Never assume a mounted drive.
- `<MT5_HARNESS> doctor|plan|check|verify` must be read-only: no MetaEditor, terminal, broker connection or file writes. Compile, Tester execution, report parsing and deployment are separately approved steps.
- A plan or evidence bundle is not authorization. Never put credentials, account IDs, broker server names or private conversation data in specs, plans, evidence or logs.
- UI visibility does not prove completion. Native claims require matching run identity, completion evidence, expected report identity and runtime-error review; an in-sample Tester result is not OOS evidence.
- Report results in a precise, unemotional register regardless of profitability.

## Include syntax reminder

```mql5
#include "Entry.mqh"
#include <Trade/Trade.mqh>
// Keep the project's declared include paths and source ownership intact.
```

## First checks
1. Run `<MT5_HARNESS> doctor` to list read-only capabilities and unavailable dependencies.
2. Use a strict spec (`<MT5_SPEC_SCHEMA>`) with declared source/include paths and SHA-256 hashes; `plan` and `check` never compile or execute.
3. Use an evidence schema (`<MT5_EVIDENCE_SCHEMA>`) with immutable attempt identity and hashed artifacts; `verify` checks integrity and internal consistency, not truth or profitability.
4. For MQL5 correctness use primary MetaQuotes documentation and a separately approved compiler/Tester workflow.

## Placeholders
| Placeholder | Meaning |
|---|---|
| `<MT5_HARNESS>` | Your read-only CLI for MT5 specs and evidence (not bundled in uika 0.1.0) |
| `<MT5_PROFILE>` | Per-project file naming source root, terminal data folder, artifact root, backup |
| `<MT5_SPEC_SCHEMA>` | JSON schema id for a build/test spec |
| `<MT5_EVIDENCE_SCHEMA>` | JSON schema id for an evidence bundle |
