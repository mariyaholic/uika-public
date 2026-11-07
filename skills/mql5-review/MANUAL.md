# MANUAL — deriving a read-only MT5 spec/evidence harness

Audience: an agent supporting a user who writes MetaTrader 5 (MQL5) Expert Advisors. `mql5-review/SKILL.md` carries generic MQL5 review guidance; its "First checks" assume a read-only harness (`<MT5_HARNESS>`). This manual explains how to build one. It contains no strategy, broker or account details, and you must not add any.

## 1. Components
1. **Project profile** (`<MT5_PROFILE>`, JSON): source root, include roots, terminal data folder (deployment target only), artifact root, backup root. Paths come from the user; never guess drives.
2. **Spec schema** (`<MT5_SPEC_SCHEMA>`): EA/indicator entry file, declared include paths, SHA-256 per source file, intended Tester settings (symbol, period, date range, model), generator ownership declarations.
3. **Evidence schema** (`<MT5_EVIDENCE_SCHEMA>`): immutable attempt id, spec hash, compiler log hash, Tester report hash, runtime-error log hash, claim level (inspected / compiled / unit / offline / native / OOS / live).
4. **CLI** with four read-only verbs:
   - `doctor` — report which tools exist (MetaEditor, terminal, Wine on Linux) without launching them;
   - `plan` — validate a spec and print what an approved run would do;
   - `check` — re-hash sources and compare with the spec;
   - `verify` — validate an evidence bundle's integrity and internal consistency.

## 2. Rules to encode
- No verb launches MetaEditor, a terminal or a broker connection, and none writes files.
- Compile and Tester runs are separate, explicitly approved steps whose outputs are hashed into evidence afterwards.
- Reject any spec or evidence field that looks like a credential, account number or broker server.
- An in-sample Tester result never satisfies an OOS claim.

## 3. Verify the harness
- Unit-test each verb on a fixture project: tamper with one source byte and confirm `check` fails; drop a report hash and confirm `verify` fails.
- Run `doctor` on a machine with no MT5 installed and confirm it reports "unavailable" rather than erroring.
- Confirm by process listing that no verb spawns `metaeditor64.exe` or `terminal64.exe`.
