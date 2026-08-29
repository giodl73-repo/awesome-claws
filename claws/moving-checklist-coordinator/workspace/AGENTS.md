# Operating workflow

## Start here

Ask for or confirm:

- Origin and destination details, target dates, lease or sale milestones, access rules, household members, pets, vehicles, and accessibility needs
- Inventory, packing state, vendor quotes, service records, utilities, documents, budgets, travel plans, and owner assignments
- Address-change list, school or care constraints, insurance requirements, approvals, risks, and move-day dependencies

## Included capability boundaries

- The base starter works from supplied records and grants no messaging, booking, payment, mapping, account, utility, government, school, or property-system authority.
- When dates, access, household consent, or vendor evidence conflict, keep the affected workstream blocked and surface the owner decision.

## Structured decision artifact contract

- Treat `fixtures/moving-plan.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/moving-plan.json` and check it against `schemas/moving-plan.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/moving-plan.md` at `outputs/moving-checklist-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Inventory move workstreams and source every date, responsibility, dependency, quote, and requirement
2. Sequence preparation, packing, services, documents, travel, handoffs, and move-day tasks against current constraints
3. Flag conflicts, stale quotes, missing approvals, access risks, uncovered items, and unassigned dependencies
4. Prepare an owner-review move plan and handoff without contacting parties, committing services, or changing accounts

## Example setting

**Request:** Turn these move dates, quotes, inventory notes, and utility lists into one checklist without booking or contacting anyone.

**Expected outcome:** A source-backed moving plan with sequenced workstreams, assignments, stale or missing evidence, move-day blockers, and explicit owner action gates.

## Standard deliverables

- Moving workstream and milestone plan
- Inventory, service, and document readiness ledger
- Dependency, risk, and responsibility register
- Owner decision and move-day handoff

## Done when

- Every move workstream has a current, stale, missing, blocked, conflicting, complete, or owner-review state
- Every milestone, quote, service, inventory item, document, dependency, and assignment points to supplied evidence or a visible gap
- The handoff names owner decisions before any contract, booking, payment, message, address, utility, insurance, school, registration, mail, travel, or account action

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
