# Mock+ deterministic validation

Mock+ mutates packaged synthetic Claw fixtures and deterministic harness inputs
against Awesome Claws' existing schemas, semantic validators, regression
contracts, runtime safety gates, workspace containment, and disabled-side-effect
capability adapters.

Mock+ is not live Runtime Evidence. It makes no provider or model call, adds no
points to either quality rubric, installs no Gateway hook or plugin, and never
reads or writes `openclaw.json`. Every output is labeled
`evidenceClass: "mock-deterministic"` and `mode: "mock"`; Runtime Evidence
aggregation rejects that evidence class.

## Profiles

The default bounded vertical covers:

- `sales-operations`: structured X3 artifact and semantic references;
- `data-analyst`: visual capability classification and analysis lineage;
- `software-maintainer`: profile extension, OAuth MCP, workspace execution, and
  change-delivery references.

It runs valid controls before schema, semantic, authority, false-success,
sensitive-data, path-escape, user-state, cleanup, and capability mutations. The
schema portfolio runs fixture-backed artifact controls, schema mutations, and
all required safety recipes for all 100 maintained Claws. Schema cases are
path-qualified and cover every applicable constraint reached through the
fixture-active composition and conditional branches. `coverage.json` records
applicable and killed counts by keyword and by Claw; any survivor or unsupported
active constraint blocks the profile. It does not yet claim per-Claw semantic
mutation coverage. The semantic portfolio is that separate profile: it replays
a checked registry of schema-valid mutations against every registered
owner-defined semantic validator and requires the exact committed finding-code
set. Claws without a semantic validator remain explicitly non-applicable rather
than passing through a fallback oracle.

The lifecycle portfolio classifies inspect identity drift, stale consent,
missing installed state, user-owned state mutation, and unsafe cleanup for every
Claw. It also removes each applicable deterministic capability adapter one at a
time. The separate `proof:openclaw` and `proof:portfolio` commands exercise the
real public OpenClaw lifecycle in disposable local state; Mock+ does not
reimplement that lifecycle.

## Commands

```powershell
npm run mock-plus -- --inventory
npm run mock-plus -- --check
npm run mock-plus -- --portfolio --check
npm run mock-plus -- --semantics --check
npm run mock-plus -- --lifecycle --check
npm run mock-plus:semantics:recipes:check
npm run mock-plus -- --only sales-operations
npm run mock-plus -- --only sales-operations --case semantic-dangling-reference --explain
```

`--explain` prints only stable validator codes, paths, type-level mutation
deltas, gates, and redacted excerpts. It does not print raw fixture values.

## Evidence

The complete qualifying vertical writes under
`.tmp\mock-plus\vertical\<canonical-digest>\`.
The schema portfolio writes under
`.tmp\mock-plus\schema-portfolio\<canonical-digest>\`.
The semantic portfolio writes under
`.tmp\mock-plus\semantic-portfolio\<canonical-digest>\`.
The lifecycle portfolio writes under
`.tmp\mock-plus\lifecycle-portfolio\<canonical-digest>\`.
Selections and one-case replays write under `.tmp\mock-plus\diagnostic\` so
they cannot overwrite qualifying evidence. Both roots are ignored by git.

- `manifest.json`: content identities, recipe ids, seed, and hard limits;
- `results.json`: per-case expected oracle and observed outcome;
- `coverage.json`: controls, kills, survivors, safety split, and inventory gaps;
- `inventory.json`: source-derived applicability for all maintained Claws;
- `provenance.json`: non-canonical runtime metadata;
- `report.md`: concise non-live summary.

The canonical digest excludes platform, architecture, commit, timestamps, and
durations. Content identity includes the harness, package, regression contract,
fixture, schema, semantic validator, capability adapters, recipe, and seed.

The slice runs sequentially, caps fixture input at 1 MiB, uses a one-second
per-case evaluation budget, caps run output at 25 MiB, and fails if a synthetic
canary reaches persisted evidence. Safety survivors block and cannot be
allowlisted.
