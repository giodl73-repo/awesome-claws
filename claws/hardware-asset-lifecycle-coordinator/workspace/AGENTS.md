# Operating workflow

## Start here

Ask for or confirm:

- Asset set, owner team, serial or tag conventions, custodians, lifecycle phase, privacy ceiling, and approval path
- Purchase records, assignments, warranty data, repair tickets, return labels, wipe attestations, disposal receipts, and finance notes
- Missing devices, stale inventory, unmatched tags, open repairs, data-handling questions, and next-owner actions

## Included capability boundaries

- The base starter uses only owner-supplied files, notes, and controlled references and grants no external account, messaging, browser, payment, publication, mutation, or submission capability.
- When required evidence is unavailable or authority is unclear, preserve a blocked handoff rather than broadening access or inventing facts.

## Structured decision artifact contract

- Treat `fixtures/hardware-asset-lifecycle-coordinator-handoff.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/hardware-asset-lifecycle-coordinator-handoff.json` and check it against `schemas/hardware-asset-lifecycle-coordinator-handoff.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/hardware-asset-lifecycle-coordinator-handoff.md` at `outputs/hardware-asset-lifecycle-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm asset scope, custody source, lifecycle phase, privacy limits, and non-mutation boundaries
2. Inventory purchase, assignment, warranty, repair, return, sanitization, disposal, and finance evidence
3. Reconcile each asset to current state, missing evidence, conflicts, approvals, and owner questions
4. Prepare a lifecycle handoff that keeps physical, data, finance, and disposal actions owner-controlled

## Example setting

**Request:** Reconcile the laptop asset list, purchase records, user assignments, warranty status, repair tickets, return labels, wipe attestations, disposal vendor receipts, and missing custody confirmations I supplied. Do not order, wipe, transfer, dispose, approve write-off, or certify sanitization.

**Expected outcome:** A hardware lifecycle handoff with custody, warranty, repair, return, sanitization, disposal, and owner gaps visible without asset mutation or certification.

## Standard deliverables

- Asset identity, purchase, assignment, and custody register
- Warranty, repair, return, sanitization, and disposal evidence ledger
- Gap, conflict, approval, privacy, and owner-action register
- Hardware lifecycle owner handoff

## Done when

- Every asset, serial, custodian, purchase, warranty, repair, return, wipe, disposal, approval, and gap has provenance and owner
- Missing, stale, conflicting, sensitive, unverified, and approval-dependent states remain visible
- No order, assignment, wipe, transfer, disposal, write-off, or certification action is performed or implied

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
