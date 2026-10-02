# Medical billing reconciliation

Use `schemas/medical-billing.schema.json` for `outputs/medical-billing.json`
and leave the patient-readable summary in
`outputs/medical-bill-reconciliation-coordinator-handoff.md`.

## Intake and privacy

Confirm the patient owner and explicitly authorized helpers before reading
documents. Helpers may organize evidence, not decide liability or act for the
patient. Use pseudonymous references; keep the identity mapping separately in
the patient's controlled workspace. Never include account/member numbers,
birth dates, addresses, clinical descriptions, credentials, or portal URLs.
The structured validator checks consistency, not the authenticity of supplied
evidence, identity, consent, or the absence of all sensitive content.

## Source register

Inventory every supplied document and service line in `scope.documentRefs`
and `scope.lineRefs`. Record issuer, exact revision, currency, and a controlled
source reference. Preserve prior EOBs and bills. Corrections and reversals must
form a single same-issuer chain. Unknown or conflicting lineage stays a blocked
intake question; never invent a predecessor or silently discard a document.
Missing bill or EOB itemization also blocks completion of the structured ledger;
retain the document and the request for itemization in the intake handoff.

## Line reconciliation

Each service line belongs to exactly one association, including historical and
unmatched lines. A documented link needs an explicitly supplied `link-record`
whose `relatedLineRefs` name both exact lines. Do not infer a match from similar
amounts, dates, procedure codes, or names. Ambiguous or many-to-many links stay
unmatched. Use one patient and currency per artifact; retain excluded material
in the intake handoff and create separate artifacts only with owner approval.

Compare only current provider charges with insurer-reported charges for an
explicitly linked pair. `differenceMinor` is provider charge minus insurer
reported charge, in integer minor units. Preserve null for missing amounts,
never zero. Preserve issuer signs for credits, adjustments, and reversals; do
not normalize negative values into charges. Transfer documents use a nonnegative
magnitude with payment/refund direction recorded by kind. Keep allowed amounts,
adjustments, and insurer-reported patient
responsibility separate. None is a Claw decision about coverage or what to pay.
Reversed and superseded EOBs remain visible but cannot enter current arithmetic.

## Payment and refund evidence

A payment receipt is distinct from a provider posting. A refund notice is
distinct from an independently issued refund receipt. Associate only exact
transaction, service-line, patient, provider, currency, and amount matches.
Partial/split or ambiguous matches stay separate and patient-owned. Preserve
unmatched postings and receipts. Duplicate transaction observations require
clarification before a completed structured ledger; record them in the handoff
instead of manufacturing unique transaction identifiers.

## Patient handoff

List every unmatched line, historical/reversed link, missing charge, charge
difference, transfer evidence gap, correspondence item, and published deadline
as a patient-owned question. Copy a deadline only from its exact source; do not
calculate appeal rights or interpret ambiguous correspondence as a deadline.
Write what each issuer reported, what evidence is absent, and what the patient
may need to ask an appropriate qualified human. No contact, disclosure,
submission, appeal, negotiation, payment, refund request, liability decision,
or settlement/closure claim is authorized by this Claw.
