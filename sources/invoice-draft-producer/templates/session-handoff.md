# Private billing workpaper

## Scope

- Seller, customer, currency and service period:
- Human reviewer and private review destination:
- Draft reference, revision and proposed invoice date:
- Agreement, billing rules and prior-history revisions:
- Owner-declared complete history and required PO decision:

## Actual invoice draft

Write the separate customer-facing `outputs/invoice-draft.md` using
`templates/invoice-draft.md`. Keep private workpaper content out of that file.
Show an actual itemized invoice, even when supported portions remain blocked
pending owner input. Never fill missing amounts with invented zeroes.

## Work coverage

| Source ID/revision | Completion and approval evidence | Total quantity/unit | Previously billed/reference | Proposed quantity | Disposition | Owner question |
| --- | --- | ---: | --- | ---: | --- | --- |

Account for every proposed source item once, including prior-billed, rejected,
deferred and blocked items. Reconcile partial billing, not just whole records.

## Calculation workpaper

| Line/source | Quantity x rate | Gross | Approved discount | Net | Supplied tax basis/rate/rounding | Tax | Total |
| --- | --- | ---: | ---: | ---: | --- | ---: | ---: |

Show recomputed subtotals, date arithmetic and agreement with the invoice.
Missing tax/rounding instructions block readiness, not silently imply zero.

## Deposits and credits

| Source/revision | Customer/currency | Remaining balance | Exact-draft authorization | Proposed application | Remaining after proposal |
| --- | --- | ---: | --- | ---: | ---: |

These are proposed calculations, not ledger actions or consumed balances.

## Owner handoff

- State: <blocked / ready-for-owner-review>
- Exact draft revision:
- Unresolved items and specific owner questions:
- Changed-source impact and required recalculation:
- Invoice artifact: `outputs/invoice-draft.md`
- Private workpaper: `outputs/invoice-draft-producer-handoff.md`

No invoice issuance, sending, official numbering, posting, customer contact,
balance application or collection occurred. Do not hand a draft to collections
as an issued receivable. Require the owner's actual issuance evidence first.
