# Fulfillment evidence contract

Use one bounded, owner-supplied snapshot. This is a seller order-line
reconciliation, not inventory allocation, shipping execution, customer contact,
invoicing, or return authorization. Use approved aliases, not customer addresses,
payment data, credentials, or unrestricted tracking URLs.

## Intake

- Name the human coordinator, batch revision, and explicit-offset as-of instant.
- List each source snapshot once, with its current revision and capture instant.
- Preserve each accepted order ID and order-line ID separately, even for the
  same SKU. Each row retains its exact source ID, revision, and source-record ID.
- Supply the accepted cancellation quantity and its authorization explicitly,
  including zero. Unknown cancellations or unaccepted changes block balances.
- Quantities in this first contract are whole units, at most JavaScript's safe
  integer limit. Obtain a human-approved common unit before reconciling fractional
  quantities or unit conversions; never round to make the contract accept them.
- Supply promised instants with an explicit timezone offset, or null when unknown.
  Date-only promises require owner clarification; do not assume local midnight.
- Retain holds as supplied. No hold is cleared by quantity completion.

## Movement identity

Every shipment line names its order line, SKU, unit, physical shipment ID, and
source coordinates. Only one current departed record may exist for a physical
shipment/order-line pair. A shared physical shipment may contain multiple order
lines, but each allocation remains separate. Multiple departures for one order
line require distinct physical shipment identities.

Label, void, and superseded records remain in coverage but do not count as
departed. A superseded record must explicitly name a current departed replacement
for the same physical shipment and order line. Ambiguous chains need a corrected
source snapshot; do not select a convenient revision or infer a replacement.

Delivery confirmations name exact current shipment-line identities and quantities.
An ETA, label, or tracking status without an explicit confirmed quantity is not
delivery evidence. Confirmation must not precede departure. Neither event can
postdate its supporting source capture or the batch cutoff. If delivery evidence
refers to a void or superseded line, request a corrected linkage rather than
silently moving it to the replacement.

## Reconciliation

For each compatible order line:

1. Net ordered = accepted ordered minus explicitly authorized cancellations.
2. Evidenced shipped = sum of current departed shipment-line quantities.
3. Delivery-confirmed = sum of explicit confirmations for those shipment lines.
4. Not evidenced shipped = net ordered minus evidenced shipped.
5. Shipped without confirmation = evidenced shipped minus delivery-confirmed.

Check over-delivery per shipment line as well as over-shipment per order line.
Never let another order's excess hide a shortage. Unknown evidence is not evidence
of zero real-world movement: these balances describe only supplied records.

An identity, revision, chronological, unit, or quantity conflict blocks the batch
and suppresses derived balances. Preserve the complete record-coverage lists and
the named blockers so the coordinator can correct the input. This conservative
behavior avoids publishing unaffected-looking totals from a broken source graph.
Known holds remain visible alongside otherwise valid balances.

## Handoff and revisions

Return a draft structured report bound to the complete input digest, plus a
Markdown handoff with matching line balances, source revisions, coverage, holds,
blockers, and the human owner. `quantity-evidenced` means quantity evidence only,
not a completed business transaction. The past-promise flag identifies missing
full delivery evidence after the supplied instant, not a legal service breach.

The structured artifact is `{ "input": ..., "report": ... }` and must satisfy
`schemas/fulfillment.schema.json`. The raw intake example is
`fixtures/fulfillment-input.example.json`; it is not a completed artifact.
`fixtures/fulfillment.example.json` and `fixtures/fulfillment-handoff.example.md`
are matching synthetic output examples. Repository maintainers can regenerate
them with `node scripts/generate-fulfillment-example.mjs`; this script is a
reference proof tool, not a shipped agent execution capability.

Any input change requires a new reconciliation. Neither an earlier digest nor
an earlier report grants shipping or communication authority. Keep approval and
external-action flags false. The coordinator decides the follow-up and reviews
customer wording; the base Claw never performs those actions.

The repository reference checker and synthetic tests validate this deterministic
contract. They do not prove model behavior, source authenticity, privacy filtering
inside allowed text, operational outcomes, or live system integration.
