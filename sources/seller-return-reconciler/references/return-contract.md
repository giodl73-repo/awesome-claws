# Seller return evidence contract

Reconcile one bounded seller return batch using supplied records. Return
authorization, physical receipt, human disposition and executed downstream work
are different states. None implies the next. Use approved aliases, not customer
addresses, payment details, credentials, raw serial numbers or unrestricted
customer records.

## Intake and ownership

Name the accountable human coordinator, batch revision and explicit-offset
as-of instant. Preserve each source snapshot's identity, revision and capture
instant. Each line, receipt and disposition cites an exact source record.
Missing authorization or conflicting current revisions block reconciliation;
never resolve an amendment by selecting a convenient quantity.

Each authorized return line has its own return ID, line ID, product alias,
compatible unit and explicitly human-authorized quantity. Same-product lines
stay separate. Whole-unit quantities must be exactly representable; fractional
units require an owner-approved conversion before this bounded contract can be
used. Never round a discrepancy away.

## Receipt evidence

Each physical receipt line links to one authorized return line and identifies
the receiving event and lot using supplied aliases. Multiple partial receipts
retain separate receiving identities. Duplicate source records or repeated
current records for the same physical receipt allocation are conflicts, not
additional goods. Unmatched goods remain explicit blocked records.

Void and superseded records remain covered but do not count as current received
quantity. A correction must explicitly identify its current replacement for the
same receipt allocation; ambiguous correction chains require owner clarification.
No receipt can postdate its source capture or the as-of cutoff.

## Human disposition evidence

A disposition records a supplied human decision; the Claw never chooses one.
Name the deciding human, source coordinates and decision instant. Link the
decision to specific units within a current receipt, not merely the return's
aggregate quantity. Preserve supplied decision labels without interpreting
them as executed repairs, replacement shipments, stock eligibility or credits.

For a quantity-based receipt lot, identify covered units by one-based inclusive
ordinal ranges within that receipt. These are supplied reconciliation aliases,
not manufactured serial numbers. Ranges must stay inside the received quantity,
must not overlap, and must not be inferred from a disposition's total alone.
An owner must supply a partition when the existing records do not distinguish
the units. This prevents two dispositions from silently covering the same goods.

Disposition labels are supplied records: repair, replace, return-to-stock,
scrap, hold or other. Even return-to-stock is not evidence that goods are safe or
eligible inventory. A current recorded hold remains a visible hold alongside
any return-line holds. Voided or explicitly superseded dispositions stay in the
event ledger but do not count as current unit coverage. A superseded disposition
must name a current replacement for the same receipt; do not infer one.

Disposition cannot precede its linked receipt or postdate its source snapshot
or batch cutoff. Disposition against a void or superseded receipt requires a
corrected source linkage; do not transfer it automatically to the replacement.

## Balances and exceptions

For each compatible return line:

1. Authorized quantity is the supplied current human-authorized quantity.
2. Received quantity is the sum of current linked physical receipt quantities.
3. Disposition-evidenced quantity is the count of distinct received units with
   supplied human disposition records.
4. Not evidenced received = authorized minus received.
5. Awaiting disposition evidence = received minus disposition-evidenced.

Check over-receipt per return line and disposition coverage per receipt. Another
line's shortage cannot offset an excess. A missing receipt is not proof of a
lost shipment. Missing disposition evidence is not a product diagnosis.

Identity, authority, revision, chronology, unit, overlap or quantity conflicts
block derived balances for the batch. Preserve coverage of every supplied line,
receipt and disposition, with record-specific blockers for the coordinator.
Holds remain visible even when every unit has disposition evidence. Supplied
safety or recall holds require human escalation, not ordinary return clearance.

## Handoff and revisions

The structured artifact and Markdown must agree on balances, evidence gaps,
holds, record coverage, current source revisions and human ownership. Bind the
report to the complete input snapshot. Recompute after any revision; prior
clearance, approval or closure cannot carry forward.

Write `outputs/seller-return.json` as `{ "input": ..., "report": ... }` using
`schemas/seller-return.schema.json`, and the matching Markdown backlog at
`outputs/seller-return-reconciler-handoff.md`. Raw intake lives in
`fixtures/return-input.example.json`; matching synthetic outputs are
`fixtures/seller-return.example.json` and `fixtures/return-handoff.example.md`.
Maintainers regenerate these with `node scripts/generate-seller-return-example.mjs`.
That repository reference tool is not a packaged agent execution capability.

The accepted synthetic example has five authorized units, three current received
units and two distinct received units with recorded disposition. Two authorized
units lack receipt evidence; one received unit lacks disposition evidence.
Those figures say nothing about whether a repair, replacement or refund occurred.

Only draft a downstream handoff. No return authorization, warranty entitlement
decision, inspection, diagnosis, disposition choice, safety clearance, credit,
refund, account adjustment, inventory write, label creation, carrier booking,
replacement shipment, customer contact or ERP update is performed.

Repository fixtures and deterministic checks can establish contract arithmetic
and boundary handling. They cannot establish source authenticity, live-model
quality, real-world goods movements or privacy filtering inside allowed text.
