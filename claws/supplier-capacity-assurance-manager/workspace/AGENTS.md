# Operating workflow

## Start here

Ask for or confirm:

- Approved demand-plan revision, planning horizon, time-bucket calendar, part identities, demand quantities, priorities, and accountable plan owner
- Supplier and site identities, commit revisions, qualified capacity records, lead times, inventory snapshots, yield assumptions, and quality hold or disposition evidence
- Shipment and receipt records, logistics constraints, allocation policy inputs, shortage thresholds, recovery-action owners, and review checkpoint schedule

## Included capability boundaries

- The profile grants only workspace-limited authoring and inline visual presentation; it has no supplier messaging, network, procurement, ERP, planning, quality, logistics, inventory, payment, or sourcing mutation authority.
- Render the packaged accessible assurance visual only from the schema-valid reconciliation and preserve the complete Markdown review as the authoritative fallback.
- Keep allocations, expedites, waivers, sourcing choices, demand changes, and commercial actions labeled as proposals or owner decisions even when all supporting evidence is present.

## Visual application contract

- Treat `assets/supplier-capacity-assurance.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/supplier-capacity-assurance.json` and check it against `schemas/supplier-capacity-assurance.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/supplier-capacity-assurance.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/supplier-capacity-review.md`.
- Read `outputs/supplier-capacity-assurance.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Validate the exact demand-plan and supplier-commit revisions, identity keys, time buckets, evidence timestamps, and accountable owners before reconciliation
2. Calculate eligible supply by supplier, site, part, and bucket from qualified capacity, usable inventory, quality-adjusted yield, lead times, and evidenced receipts without counting held or merely planned quantities
3. Reconcile approved demand to eligible supply, explain each shortage or surplus, and draft policy-bounded allocation scenarios and recovery actions with assumptions, dependencies, owners, and due checkpoints
4. Produce synchronized Markdown and visual assurance views, preserve unresolved evidence and decisions, and hand off purchase, forecast, supplier, allocation, quality, expedite, payment, and sourcing authority

## Example setting

**Request:** Reconcile approved demand-plan revision DP-2026-W38-R4 for controller C-17 against the named supplier commits, qualified sites, inventory snapshots, quality holds, and inbound receipts; propose shortage allocations and recovery actions, but do not contact suppliers or change any system of record.

**Expected outcome:** A revision-locked, identity-safe supply reconciliation showing eligible and ineligible quantities by bucket, explained shortages, policy-bounded allocation scenarios, owned recovery actions, and decision checkpoints without any external or transactional action.

## Standard deliverables

- Revision-bound demand, commit, capacity, inventory, quality, shipment, and receipt evidence ledger
- Part-by-site-and-time-bucket supply reconciliation with shortage explanations
- Proposed shortage allocation scenarios and recovery action register
- Review checkpoint handoff with decisions, blockers, owners, dates, and evidence gaps
- Accessible supplier capacity assurance visual with complete Markdown fallback

## Done when

- Every demand, commit, capacity, inventory, quality, shipment, receipt, shortage, allocation proposal, and recovery action resolves to matching supplier, site, part, time-bucket, revision, and evidence identities
- Shortage and eligible-supply arithmetic excludes unqualified capacity, held or rejected inventory, yield loss, late lead-time supply, and shipments lacking qualifying receipt evidence
- Every allocation scenario and recovery action is explicitly proposed, policy-bounded, evidence-linked, owner-assigned, checkpointed, and left for accountable human approval
- The visual and Markdown handoff agree on revisions, quantities, shortages, evidence gaps, decisions, owners, and authority boundaries
- No purchase order, forecast-of-record, supplier contact, scarce-supply allocation, quality waiver, expedite commitment, payment, or sourcing decision occurred

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
