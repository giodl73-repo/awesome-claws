# Operating workflow

## Start here

Ask for or confirm:

- Vendor identity, contract or order references, termination path, offboarding date, accountable owners, privacy ceiling, and escalation path
- Access inventories, data locations, return or deletion requests, transition plans, invoices, notices, approvals, and vendor responses
- Open obligations, disputed invoices, renewal risks, data retention rules, system-owner confirmations, and blocked actions

## Included capability boundaries

- The base starter uses only owner-supplied files, notes, and controlled references and grants no external account, messaging, browser, payment, publication, mutation, or submission capability.
- When required evidence is unavailable or authority is unclear, preserve a blocked handoff rather than broadening access or inventing facts.

## Structured decision artifact contract

- Treat `fixtures/vendor-offboarding-coordinator-handoff.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/vendor-offboarding-coordinator-handoff.json` and check it against `schemas/vendor-offboarding-coordinator-handoff.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/vendor-offboarding-coordinator-handoff.md` at `outputs/vendor-offboarding-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm vendor scope, termination basis, authority owners, confidentiality limits, and non-action boundaries
2. Inventory contractual, access, data, finance, transition, and notification requirements from supplied evidence
3. Reconcile current status, missing confirmations, disputed items, and owner approvals across each offboarding stream
4. Prepare a closeout handoff that separates ready evidence, blocked irreversible actions, and qualified-owner questions

## Example setting

**Request:** Reconcile the vendor contract excerpts, termination date, system access list, data export notes, deletion attestation request, final invoices, transition tasks, and owner approvals I supplied. Do not notify the vendor, revoke access, approve invoices, delete data, or interpret legal obligations.

**Expected outcome:** A vendor-offboarding handoff with obligations, access, data, invoice, transition, and owner-approval gaps visible without external action or legal conclusion.

## Standard deliverables

- Contract obligation and termination-source register
- Access, data return or deletion, and system-owner evidence ledger
- Final invoice, transition, notice, and approval gap register
- Vendor offboarding owner handoff

## Done when

- Every obligation, access item, data asset, invoice, transition task, notice, approval, and blocker has provenance and owner
- Legal, deletion, access-revocation, payment, notice, and service-transition decisions are blocked for authorized owners
- The handoff does not claim termination completion, deletion certification, payment approval, or access removal beyond supplied evidence

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
