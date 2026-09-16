# Operating workflow

## Start here

Ask for or confirm:

- Exact current and predecessor critical-process register revisions with owner, scope, criticality, and source evidence
- Business-impact analyses and named-owner approvals for exact RTO and RPO requirements
- Service, vendor, site, facility, people, data, and upstream or downstream dependency revisions with accountable dependency-owner attestations
- Continuity-plan versions, revision lineage, process coverage, recovery strategies, invocation authority, and approval evidence
- Exercise charters, exact scope, scenarios and injects, observations, result evidence, finding identity, corrective-action receipts, exceptions, and independent recertification

## Included capability boundaries

- The recurring isolated job uses only supplied workspace records and grants no external system, shell, browser, messaging, vendor, incident, traffic, deployment, recovery, or production capability.
- Process owners, service and vendor owners, exercise authorities, remediation owners, exception approvers, risk owners, disaster authorities, recovery executors, and independent recertifiers retain their native authority.

## Visual application contract

- Treat `assets/business-continuity-program.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/business-continuity-program.json` and check it against `schemas/business-continuity-program.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/business-continuity-program.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/business-continuity-program-manager-handoff.md`.
- Read `outputs/business-continuity-program.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Reconcile the current critical-process register against its predecessor into one exact added, retained, revised, and retired process universe
2. Bind each current process to one current BIA and exact named-owner RTO and RPO approvals without making or carrying forward the owner decision
3. Reconcile every declared service, vendor, site, facility, people, data, and process dependency to the exact process, source revision, owner, and freshness state
4. Revise continuity-plan records only as owner-authored versions whose lineage, process scope, requirements, dependencies, strategies, and invocation authority are content-bound
5. Plan exercises by exact plan and process revisions; preserve approved scope and injects, externally produced evidence and results, stable findings, and separately executed corrective-action receipts
6. Track independently approved exceptions with exact scope and expiry, and require independent recertification after material revision, exercise finding, remediation receipt, or exception change
7. Emit exact blockers and an owner handoff while preserving all declaration, invocation, execution, risk, exception, and certification authority

## Example setting

**Request:** Run the quarterly continuity-program reconciliation over this exact critical-process register, approved BIA exports, dependency attestations, plan revisions, and exercise evidence. Preserve findings, corrective-action receipts, exceptions, and recertification state, but do not invoke a plan, contact vendors, fail over anything, approve exceptions, accept risk, or certify readiness.

**Expected outcome:** A revision-bound continuity-program artifact accounts for every critical process, records owner-approved RTO and RPO requirements, maps current service/vendor/site dependencies, links plan revisions and exercise evidence, preserves stable findings, remediation receipts, and one active exception, requires independent recertification, and hands exact blockers to named owners without readiness or compliance claims.

## Standard deliverables

- Versioned critical-process and business-impact register with exact owner-approved RTO and RPO evidence
- Process-to-service, vendor, site, facility, people, data, and process dependency map
- Continuity-plan revision and approval ledger
- Exercise scope, inject, evidence, result, and stable finding register
- Corrective-action receipt, exception, blocker, independent recertification, and owner-handoff ledger

## Done when

- The current process universe exactly equals the owner-supplied register and every add, retain, revise, and retire transition binds current and predecessor revisions
- Every current critical process has one current BIA, named-owner RTO and RPO approval, complete dependency set or an exact blocker, and one current continuity-plan coverage record
- Every plan revision binds exact process, recovery-requirement, dependency, strategy, approval, and predecessor content
- Every exercise binds exact approved scope, plan versions, process revisions, injects, evidence, results, stable findings, and causal corrective-action receipts without claiming execution
- Every exception is independently approved, scope-bound, time-bounded, and non-certifying, and every affected process has independent recertification after the latest material evidence
- The exact blocker set and handoff make no disaster declaration, plan invocation, production failover, traffic shift, vendor contact, risk acceptance, exception approval, or readiness or compliance certification claim

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
