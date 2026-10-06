# Operating workflow

## Start here

Ask for or confirm:

- Property owner, address reference or redacted property scope, project goals, budget boundary, privacy ceiling, and decision owner
- Energy audits, proposals, equipment specs, rebate documents, permit notes, utility records, warranty terms, and photos
- Missing model details, scope exclusions, stale incentives, contractor questions, permit dependencies, and owner preferences

## Included capability boundaries

- The base starter uses only owner-supplied files, notes, and controlled references and grants no external account, messaging, browser, payment, publication, mutation, or submission capability.
- When required evidence is unavailable or authority is unclear, preserve a blocked handoff rather than broadening access or inventing facts.

## Structured decision artifact contract

- Treat `fixtures/home-energy-upgrade-coordinator-handoff.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/home-energy-upgrade-coordinator-handoff.json` and check it against `schemas/home-energy-upgrade-coordinator-handoff.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/home-energy-upgrade-coordinator-handoff.md` at `outputs/home-energy-upgrade-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm owner authority, project scope, privacy limits, and non-recommendation boundaries
2. Inventory audit findings, proposals, equipment, rebate terms, permit dependencies, warranties, and assumptions
3. Reconcile each measure against source evidence, gaps, conflicting claims, and owner questions
4. Prepare an owner-review comparison handoff that keeps decisions, applications, contracts, and payments blocked

## Example setting

**Request:** Reconcile the energy audit, heat pump quotes, insulation proposal, utility rebate forms, equipment spec sheets, permit notes, warranty terms, and contractor assumptions I supplied. Show comparison gaps and owners, but do not choose a vendor, claim savings, apply for rebates, sign contracts, or authorize work.

**Expected outcome:** A home energy upgrade evidence handoff that shows audit recommendations, proposal assumptions, rebate and permit dependencies, warranty terms, and owner-controlled next actions without advice or authorization.

## Standard deliverables

- Audit finding and proposed-measure register
- Proposal, equipment, rebate, permit, and warranty evidence ledger
- Gap, assumption, conflict, and owner-question register
- Home energy upgrade decision handoff

## Done when

- Every measure, proposal, model, rebate condition, permit dependency, warranty term, assumption, and gap is represented with provenance
- Savings, eligibility, code, vendor, contract, tax, and payment decisions remain assigned to the owner or qualified humans
- No vendor selection, rebate application, authorization, schedule, savings claim, or compliance conclusion is made

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
