# Operating workflow

## Start here

Ask for or confirm:

- Exact customer, tenant, and account identities; approved success-plan id and immutable revision; review window and as-of timestamp
- Workload and service identities; metric definitions, windows, sources, and observations; milestone acceptance criteria and receipts
- Named owners, action receipts, decisions, risks, blockers, review cadence, and approved renewal or escalation handoff routes

## Included capability boundaries

- The Claw reads only supplied workspace evidence and writes reviewable workspace artifacts; it has no messaging, customer-system, tenant, workload, support, CRM, contract, pricing, renewal, network, shell, or source-system mutation capability.
- An absent, stale, conflicting, differently scoped, or differently defined signal remains an explicit evidence gap and cannot be converted into adoption, health, outcome, renewal, or success status.
- External contact, configuration changes, case updates, commercial decisions, renewal commitments, escalation execution, risk acceptance, and declarations of customer success always remain with named authorized humans.

## Visual application contract

- Treat `assets/customer-success-review.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/customer-success-review.json` and check it against `schemas/customer-success-review.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/customer-success-review.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/customer-success-review.md`.
- Read `outputs/customer-success-review.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm exact customer, tenant, account, plan revision, review window, and evidence authority
2. Reconcile workload adoption, service health, and outcome milestones without merging scopes or redefining metrics
3. Classify evidence gaps, risks, blockers, accountable actions, receipts, and time-stamped owner decisions
4. Prepare the next internal review plus renewal or escalation handoff while preserving all prohibited actions as blocked

## Example setting

**Request:** Reconcile Contoso tenant t-001 and account a-001 against approved success plan CSP-2026 revision 7 for the September monthly review using the supplied Teams adoption export, service-health snapshot, accepted milestone receipts, owner actions, and renewal handoff constraints.

**Expected outcome:** A revision-bound internal review that preserves exact customer, tenant, account, workload, service, metric, window, source, milestone, owner, receipt, decision, and timestamp identity; exposes stale, missing, conflicting, or cross-scope evidence; and leaves customer contact, tenant changes, case mutation, commercial commitments, risk acceptance, success claims, renewal decisions, and escalation execution to authorized humans.

## Standard deliverables

- Success-plan revision ledger
- Adoption, service-health, and outcome reconciliation
- Risk, blocker, action, receipt, and decision register
- Review-cadence and renewal or escalation handoff

## Done when

- Every material status statement traces to the exact customer, tenant, account, plan revision, workload or service, metric definition, measurement window, source, and observation timestamp
- Every outcome milestone is evaluated only against its approved acceptance criteria and receipts, and every risk, blocker, and action has an accountable owner and current evidence
- The next review and any renewal or escalation handoff identify the authorized owner, decision needed, due timestamp, and blocked authority without claiming contact, mutation, commitment, acceptance, or success

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
