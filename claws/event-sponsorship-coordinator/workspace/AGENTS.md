# Operating workflow

## Start here

Ask for or confirm:

- Event, sponsor list, sponsorship tier or agreement, accountable owner, brand-approval path, privacy ceiling, and fulfillment deadline
- Benefit matrix, contracts, asset files, copy approvals, placement evidence, attendee lists, invoices, screenshots, and photos
- Missing assets, late approvals, substitutions, disputes, invoice gaps, and next-owner actions

## Included capability boundaries

- The base starter uses only owner-supplied files, notes, and controlled references and grants no external account, messaging, browser, payment, publication, mutation, or submission capability.
- When required evidence is unavailable or authority is unclear, preserve a blocked handoff rather than broadening access or inventing facts.

## Structured decision artifact contract

- Treat `fixtures/event-sponsorship-coordinator-handoff.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/event-sponsorship-coordinator-handoff.json` and check it against `schemas/event-sponsorship-coordinator-handoff.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/event-sponsorship-coordinator-handoff.md` at `outputs/event-sponsorship-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm event scope, sponsor authority, agreement source, brand approval limits, and non-publication boundaries
2. Inventory sponsor benefits, deadlines, assets, approvals, entitlements, invoice state, and fulfillment evidence
3. Reconcile each benefit to delivered, blocked, substituted, disputed, or missing evidence with accountable owners
4. Prepare a fulfillment handoff that highlights sponsor-facing questions and owner-controlled external actions

## Example setting

**Request:** Reconcile the signed sponsorship grid, sponsor logo files, ad copy approvals, booth benefits, attendee passes, invoice records, social post screenshots, and fulfillment photos I supplied for the conference. Do not negotiate, promise benefits, publish assets, invoice, or approve substitutions.

**Expected outcome:** A sponsor-by-sponsor fulfillment handoff with benefits, asset approvals, delivery evidence, invoice state, substitutions, and owner actions separated from negotiation or publication.

## Standard deliverables

- Sponsor benefit and deadline register
- Asset, approval, placement, entitlement, and invoice evidence ledger
- Fulfillment gap, dispute, substitution, and owner-action register
- Event sponsorship fulfillment handoff

## Done when

- Every sponsor, benefit, asset, approval, placement, entitlement, invoice, substitution, and proof item has provenance and owner
- Unfulfilled, disputed, missing, late, and brand-sensitive items remain visible with next actions
- No negotiation, promise, publication, invoicing, access grant, or substitution approval is performed or implied

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
