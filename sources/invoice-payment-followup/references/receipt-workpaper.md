# Receipt workpaper contract

Implementation in progress for approved extension #223. This separate
`awesomeClaws.receiptWorkpaperInput.v1` / `awesomeClaws.receiptWorkpaperReport.v1`
contract does not change `awesomeClaws.invoiceReceivables.v1`. Existing invoice
amounts keep their existing units and balance semantics. Never add workpaper
amounts to legacy paymentEvidence or use them to recompute an invoice balance.

## Evidence and scope

Supply one owner-controlled ledger/account scope alias, not a bank account
number, payment credential, or client contact detail. Each source must assert
that same scope. The owner supplies currency codes and minor-unit scales (0 to
6), positive safe-integer minor-unit amounts, source revisions, native record
references, capture times, and event times with explicit UTC offsets.

Receipt and allocation identity references are owner-supplied controlled aliases
for the underlying cash receipt or allocation, stable across exports and source
revisions. These are distinct from per-record IDs. Use null when identity or
source scope cannot be established; never mint a new identity merely to make a
duplicate pass. These assertions do not authenticate records or prove a human's
authority. Source truth and cross-system mapping remain owner responsibilities.

Receipt evidence, remittance advice, owner allocation decisions, and observed
accounting applications are distinct source kinds. Earlier remittance advice
can describe a later receipt; an application cannot predate its receipt.
Remittance and owner decisions do not establish accounting application.

## Conservation and unresolved records

Conservation uses exact integer arithmetic. One receipt's supplied allocations
plus its unallocated remainder equal its supplied receipt amount. No fuzzy
matching, implied invoice, fees, rounding, netting, FX, or refund is introduced.
Currency display uses the supplied scale without converting the stored amount.

Unknown identities, cross-scope sources, source-revision disagreement, duplicate
native records or identities, currency mismatches, future/invalid chronology,
overallocations, and noncurrent records block derived totals. This initial
contract conservatively blocks the entire supplied workpaper, not only one row.
The complete source input and every original record remain in the report.

Corrections, reversals, conflicting rows, and superseded rows remain visible;
the helper does not pick a winning revision or execute an accounting reversal.
An owner must resolve the evidence before a new current-only workpaper can be
assessed, while retaining the prior blocked handoff in controlled storage.
Unknown derived amounts render as unknown, never zero.

## Handoff and limits

The Markdown renderer recomputes the report from input, displays receipt and
allocation tables, lists owner questions, and embeds the exact complete JSON
report. Ready-for-owner-review means only that these workpaper checks passed;
it does not authorize posting, collection, messaging, refunds, balance changes,
or accounting-close certification.

## Linked legacy review

The separate `awesomeClaws.receiptLegacyMap.v1` mapping is evaluated against the
actual legacy artifact and receipt input. The resulting review embeds all three
inputs, rather than trusting a detached mapping's stale snapshot references.
The renderer recomputes the review. No legacy monetary field is reinterpreted
as a minor-unit field: comparison converts its decimal value exactly at the
owner-supplied scale, rejecting excess precision and unsafe magnitude.

Give every legacy payment exactly one represented, outside-scope or unresolved
disposition. Represented rows require explicit invoice equivalence and whole
allocation references used at most once; their exact sum must match the legacy
amount and currency. Confirmed payment mappings require current application
evidence, not remittance intention. A nonconfirmed legacy row is not upgraded by
an application. Outside-scope records require a different owner-asserted scope,
an evidence reference and no allocation link; known mapped invoices cannot be
dismissed as outside scope. Represented payments require current legacy source
references dated no later than the legacy snapshot. The owner attests
snapshot/cutoff compatibility, but this cannot override observable chronology:
confirmed receipt/application events must fall no later than the snapshot's
calendar day in the declared ledger timezone. An unknown timezone blocks the
review; no precise event time is invented from a legacy date-only field.

Mapping readiness is separate from the legacy handoff state and receipt-only
conservation. The legacy handoff remains unchanged, including when blocked.
No combined cash total is produced. Both handoffs require controlled owner-only
storage; the embedded legacy record is not a redacted sharing artifact.

## Validation and output selection

Invoice-only reviews retain the original schema. Receipt-only reviews use
`schemas/receipt-workpaper-report.schema.json`; linked legacy reviews use
`schemas/receipt-legacy-review.schema.json`. The runtime selects by the exact
schemaVersion. All three formats use `outputs/invoice-receivables.json` with
the corresponding Markdown at `outputs/invoice-payment-followup-handoff.md`.
Do not substitute an input or a mapping sidecar for a complete report.

Load each report schema's declared `$ref` dependencies from this package into
a draft-2020-12 JSON Schema validator; no network schema retrieval is needed.
The repository's artifact validator performs schema validation and then exact
recomputation from the complete embedded inputs. Removed blockers, changed
coverage, altered derived totals and changed legacy handoff state are invalid.
A correctly represented blocked workpaper is a valid artifact, not clearance.
Recomputation proves internal agreement, not the truth of owner-supplied input.

The current helper and renderer changes passed independent manual review.
Current Control UI proof and final full validation remain required before this
extension is ready to merge or publish.
