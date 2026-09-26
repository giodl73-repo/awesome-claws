# Operating workflow

## Start here

Ask for or confirm:

- Case owner, explicitly authorized helpers, carrier and policy references, supplied claim reference state, relevant jurisdictions, privacy and sharing ceiling, loss-discovery time, review cadence, and urgent human safety escalation path
- Owner observations, incident records, qualified safety or damage assessments, photos and inventories through controlled references, affected rooms or items, mitigation records, and known landlord, association, lender, or provider dependencies
- Dated policy and endorsement evidence, official carrier claim instructions, document requests, inspection notices, deadlines, reservation or coverage correspondence, deductible statements, and retention requirements
- Owner-executed calls, filings, submissions, inspections, mitigation, repair or replacement choices, independent receipts, estimates, invoices, payment notices and receipts, failed attempts, and unresolved questions
- Carrier-issued claim status and positions, adjuster or specialist observations, estimate line scopes, payment or holdback statements, repair or replacement evidence, contradictions, and remaining property exposure

## Included capability boundaries

- The base starter reads only owner-supplied minimized claim records and dated official instructions and writes a private local claim ledger; it has no browser, messaging, calling, carrier portal, policy, account, identity, upload, payment, scheduling, form-submission, file-mutation, or external-system capability.
- Treat policy language, official requirements, deadlines, adjuster correspondence, estimates, coverage or payment positions, and repair records as dated attributed evidence rather than universal guidance; route interpretation, safety, valuation, construction, appraisal, and legal questions to the issuing organization or qualified human.
- Use redacted policy, claim, address, property, serial, payment, and provider references; keep every disclosure or submission candidate draft-only; and refuse credentials, payment data, secrets, or unredacted sensitive evidence when minimized references suffice.

## Structured decision artifact contract

- Treat `fixtures/property-claim-ledger.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/property-claim-ledger.json` and check it against `schemas/property-claim-ledger.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/property-claim-ledger.md` at `outputs/property-insurance-claim-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm case authority, privacy, declared jurisdictions, supplied policy and claim identity, evidence ceiling, source hierarchy, and emergency, safety, habitability, professional, and legal escalation boundaries
2. Build an assertion-separated chronology for owner observations, qualified assessments, official requirements, owner attempts, independent receipts, carrier-issued positions, payments, and repair or replacement evidence
3. Inventory each affected area or item with a redacted identifier and bind its observed condition, mitigation, estimate scopes, carrier positions, repairs, payments, contradictions, and residual gaps without making a damage or coverage determination
4. Map dated official claim requirements and deadlines into ordered owner-action candidates with prerequisites, disclosure scope, expected receipts, external execution blocked, and superseded instructions retained
5. Reconcile owner-executed actions and independent same-subject receipts against filing, document, inspection, inventory, estimate, mitigation, repair, replacement, payment, appeal, and follow-up requirements
6. Reconcile provider and carrier estimates, carrier-issued positions, payment statements, repair or replacement records, and owner decisions at exact affected-property scope without netting differences into a valuation, recommendation, settlement, or closure conclusion
7. Version the private claim ledger after new evidence, revised instructions, estimates, carrier correspondence, owner choices, payments, repairs, or corrections, then hand off exact deadlines, missing receipts, scope differences, safety questions, residual exposure, and next owners

## Example setting

**Request:** Organize my supplied renters-insurance claim records after a burst pipe affected the living room flooring, desk, and laptop. Reconcile the carrier's document requests and deadlines, the inventory and mitigation submission I completed, contractor and carrier estimates, the carrier-issued scope and payment notices, and repair or replacement receipts. Show missing receipts, scope differences, and remaining exposure. Do not contact anyone, file or amend anything, decide coverage or cause, value the loss, recommend a settlement, authorize repairs, accept payment, or declare the claim closed.

**Expected outcome:** A private versioned claim ledger separates the owner's observations from qualified and carrier-issued facts, maps three affected-property units to current official requirements, confirms one owner submission through an independent same-subject receipt, exposes a missing mitigation-upload receipt and a flooring-scope difference between dated estimates, and returns exact owner, carrier, and qualified-specialist questions without filing, contacting, valuing, advising, authorizing, accepting, or claiming closure.

## Standard deliverables

- Private claim authority, source, policy-reference, and chronology register
- Affected-property, evidence, mitigation, safety-boundary, and residual-exposure inventory
- Official claim-requirement, deadline, owner-action, attempt, and independent-receipt matrix
- Estimate-scope, carrier-position, payment-statement, repair, replacement, and owner-decision reconciliation ledger
- Sensitive-data minimization and controlled-disclosure register
- Missing-receipt, contradiction, scope-difference, escalation, deadline, and next-owner handoff

## Done when

- Every in-scope loss event, affected property unit, authority, source, official requirement, owner attempt, receipt, estimate, carrier position, payment statement, repair or replacement record, owner decision, and residual gap is represented once with provenance, chronology, privacy, and authority state
- Every affected property unit maps to current dated official requirements plus exact estimate, carrier-position, payment, repair or replacement, and unresolved-gap indexes without inferring coverage, cause, value, liability, safety, or entitlement
- Every owner-completed external action has an independent same-subject receipt, while planned, attempted, failed, blocked, withdrawn, superseded, and unreceipted actions remain distinguishable
- Every deadline, missing receipt, estimate or scope difference, carrier-issued pending or disputed state, payment or holdback statement, safety or professional question, residual exposure, and next owner is indexed exactly in the private handoff
- The handoff makes no coverage, causation, fault, liability, valuation, depreciation, deductible, code, habitability, safety, entitlement, settlement, fraud, bad-faith, repair-sufficiency, claim-validity, filing, contact, submission, scheduling, authorization, payment, purchase, disposal, account, policy-change, advice, recovery-completion, or claim-closure claim

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
