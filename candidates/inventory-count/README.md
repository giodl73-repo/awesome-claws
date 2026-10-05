# Inventory count evaluation

Approved route: [#230](https://github.com/giodl73-repo/awesome-claws/issues/230).
Evaluation only, using existing Spreadsheet Analyst. No new Claw ID, installed
resource, runtime change or inventory engine. Replenishment #208 remains held.
The catalog remains at 145. This example is not a package quality rating.

`outputs/inventory-review.xlsx` contains the review and preserved source sheets.
`inputs/inventory-source.xlsx` is the separate original synthetic workbook.
All records and supplied owner decisions are invented test data, not real approvals.
The warehouse owner supplies scope, item/bin/lot identity, unit, physical ownership
and hold basis, movement inclusion/completeness, and count/recount selection.
Each example has one signed movement in the stated interval, not a movement ledger.
An already-included movement contributes zero; an excluded movement contributes its
signed units. No hold subtraction or eligibility-to-physical conversion occurs.

The review retains separate -2/+2 bin variances, receipt comparison 13 and variance
-1, ten physical units including two held, and missing versus actual zero counts.
Conflicting recounts without an owner selection remain unavailable. Editable review
selections are separate from preserved source decisions. No zero variance certifies
stock or closes a case. Identity and revision mismatches block that row.

Source JSON bytes, original XLSX bytes, output bytes and manifest bytes are bound in
`outputs/calculation-proof.json`. Editing sources, decisions, workbook or manifest
invalidates that saved proof: regenerate and obtain fresh owner review. Excel does
not hash external files or authenticate owner assertions. The manifest schema is
generic spreadsheet governance, not an inventory semantic validator.

## Reproduce

Run `node --test candidates/inventory-count/evaluation.test.mjs` from the repo root
after `npm ci`. Tests are opt-in and do not alter shared CI or runtime behavior.
Run `npm run check` separately for repository validation.

To regenerate, expose the supported artifact runtime's `@oai/artifact-tool` through
a local ignored `node_modules` junction in this directory, then run `node build.mjs`.
Do not add it to repository dependencies. The builder exercises actual input edits,
recalculates, exports/reopens and renders both sheets. Inspect the PNGs before
claiming visual verification. Recalculation is Artifact Tool, not native Excel.
Ordinary candidate tests check saved proof and real manifest schema/semantics,
not native Excel behavior or model execution.

`outputs/private-handoff.md` is a synthetic internal review handoff, not a public
inventory instruction. This public repository contains no real private stock data.
No writes, adjustments, write-offs, purchases, valuation, cause determination,
physical counting, hold release, certification, external contact or publication.
