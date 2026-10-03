# Accounting workpaper example

Accepted route: [#192](https://github.com/giodl73-repo/awesome-claws/issues/192),
under [#196](https://github.com/giodl73-repo/awesome-claws/issues/196).
This improves Spreadsheet Analyst and composes an existing account-reconciliation
output. It does not admit a Period-Close Evidence Coordinator.

Open `outputs/close-review.xlsx` for the actual workpaper. The original synthetic
source is `inputs/close-source.xlsx`. The review copy shows the USD 12,000 to 15,500
balance change, USD 3,000 supported by schedules and USD 500 unexplained. Two
separate operating-account residuals remain visible. Sources are synthetic,
not live accounting records; no source-system action or accountant approval occurs.

The existing reconciliation fixture stays authoritative at
`sources/financial-account-reconciliation-coordinator/fixtures/financial-account-reconciliation.example.json`.
The input records the synthetic owner's entity/basis binding because the existing
reconciliation schema does not attest those fields. Its historical review context
is September 2, 2026; this is not refreshed evidence for a later close.

Financial Analyst's enriched model requires at least three scenarios and per-case
assumptions/sensitivities. This deterministic balance-change schedule does not
invent scenarios to fit it. Spreadsheet Analyst owns the workbook and existing
change manifest; the reconciliation owner owns matching. Financial Analyst can
consume the supported narrative without granting accounting approval.

## Reproduce

Run `node --test scripts/close-workpaper.test.mjs` from the repository root.
It checks source-bound arithmetic, scope/revision changes, narrative, the real
reconciliation owner's validator, the Spreadsheet Analyst schema/semantics and
saved workbook byte hashes. It does not recalculate XLSX files during ordinary CI.

For actual workbook regeneration, make `@oai/artifact-tool` available via the
supported artifact runtime in this directory, then run `node build.mjs`. The
builder recalculates 12 input changes, restores all source cells, exports/reopens,
checks source preservation, scans formula errors and renders both sheets. Inspect
both generated previews before claiming visual proof. No package dependency or
capability is added to the catalog. Native Microsoft Excel execution is not tested.

Binary workbook fixtures stay here because the catalog resource materializer is
text-only. The installed Claw receives a recipe, source/result fixtures, schedule
and reusable template. Obtain/create actual workbooks using its existing XLSX
skill when available; absence of that capability is not permission to fake one.
The repository example can be downloaded separately with the source and output
kept in their distinct paths.

This exact-example checker is not a universal financial narrative validator or
source authentication service. A changed source or workbook requires regenerating
the relevant proof and fresh accountant review, not manually updating hashes to
claim acceptance. No journal posting, certification, close approval or publishing.
