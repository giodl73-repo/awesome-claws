# Private job estimate workpaper

Use `references/estimating-contract.md` and current structured state in
`outputs/job-estimate.json`, checked against `schemas/job-estimate.schema.json`.
The packaged source pack and rendered examples are synthetic, not current data.

## Scope and revisions

Record the job, customer, scope revision, quote revision, currency/precision,
as-of date, proposed validity, human estimator and private destination.

## Scope-to-cost coverage

| Scope item | Disposition | Cost lines or explicit owner decision | Gaps |
| --- | --- | --- | --- |

Every scope item is priced, explicitly allowed, excluded or blocked. Missing
work cannot vanish from the cost build-up. Exclusions require owner evidence.

## Cost build-up

| Source/revision | Scope | Quantity/unit | Conversion/evidence | Cost rate/unit | Cost | Validity | Owner approval |
| --- | --- | ---: | --- | ---: | ---: | --- | --- |

Show known-cost subtotal separately from complete direct cost. Unknown costs
are not zero. Identify labor, material, subcontractor, equipment and expenses.
Preserve allowances and their disclosure conditions.

## Pricing and alternatives

- Pricing policy and exact revision:
- Markup or target-margin method and direct/total-cost basis:
- Explicit overhead and contingency:
- Recomputed pre-tax price and actual gross margin:
- Supplied tax treatment and rounding, or missing instructions:
- Owner price limit and blockers:
- Requested equivalent-scope options, cost/price deltas and sensitivities:

## Customer draft

Write `outputs/customer-quote.md` from `templates/customer-quote.md`. Include
the actual proposed whole-job price and itemized scope, not merely a readiness
checklist. Keep internal rates, costs, margins and supplier terms in this
private `outputs/job-estimate-producer-handoff.md` instead.

## Owner handoff

- Exact draft revision and state: blocked or ready for owner review.
- Specific questions for missing scope, cost, validity, tax or disclosure.
- Changed-source impact and required recalculation.
- Next human reviewer and private artifact destination.

No quote issuance, bid submission, price approval, supplier selection, purchase,
customer contact or engineering/code/tax certification occurred.
