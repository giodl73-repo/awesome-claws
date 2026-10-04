# Operating workflow

## Start here

Ask for or confirm:

- Exact partner, joint-business-plan, revision, coverage period, predecessor revision, accountable owners, decision-right matrix, and approved evidence scope
- Attributable capability and designation evidence, solution-play records, co-sell opportunity references, commitments, benefit and incentive eligibility evidence, dependencies, risks, actions, and QBR decisions
- Source identities, versions, timestamps, freshness rules, authors or issuing authorities, confidentiality scopes, conflicts, gaps, and escalation paths

## Included capability boundaries

- The base starter uses only supplied workspace artifacts and a packaged inert visual; it grants no Partner Center, CRM, finance, messaging, agreement, or customer-system access.
- Future read integrations must remain identity-bound, source-attributable, and non-mutating; all reserved actions require handoff to the named authorized owner.

## Visual application contract

- Treat `assets/partner-business-plan-review.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/partner-business-plan.json` and check it against `schemas/partner-business-plan.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/partner-business-plan-review.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/partner-business-plan-review.md`.
- Read `outputs/partner-business-plan-review.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Validate one partner-plan-revision identity, predecessor relationship, period coverage, owner roster, decision rights, and evidence scope before reconciliation
2. Reconcile capabilities and designations, solution plays, attributable co-sell references, commitments, and benefit or incentive eligibility evidence without converting evidence into official status
3. Build chronological action, dependency, risk, and QBR-decision ledgers with source attribution, conflicts, gaps, owners, due dates, and authority gates
4. Produce an X4 review package with coverage accounting, change-from-prior-revision trace, owner actions, blocked authority-sensitive requests, and Markdown fallback

## Example setting

**Request:** Reconcile Contoso Cloud Services' FY27 joint business plan JBP-CCS-2027 revision 4 for the Q1 through Q2 review using the supplied partner-center exports, co-sell references, commitment evidence, action log, risk register, and QBR minutes. Show what changed from revision 3, but do not enroll, award, approve, pay, mutate, contact, commit, modify, decide, or accept anything.

**Expected outcome:** A partner-plan-revision-bound X4 review package with attributable evidence, exact period coverage, revision deltas, chronological actions and decisions, owned gaps and risks, and every reserved-authority action blocked for its authorized owner.

## Standard deliverables

- Partner, plan, revision, predecessor, period, owner, and decision-right identity block
- Evidence-attributed capability, designation, solution-play, opportunity-reference, commitment, benefit, and incentive reconciliation
- Chronological dependency, risk, owner-action, and QBR-decision ledgers
- Coverage and conflict accounting with revision delta and blocked-authority register
- X4 joint-business-plan review visual with equivalent Markdown handoff

## Done when

- The record proves one exact partner, plan, revision, predecessor, and period and rejects mixed-identity or mixed-revision evidence
- Every material capability, designation, solution play, opportunity reference, commitment, benefit, and incentive observation has attributable evidence or an explicit gap
- Every action and decision is chronologically ordered and tied to an accountable owner, decision right, source, and status
- Every declared period segment and required plan domain is covered, explicitly not applicable with authority, or blocked with an owner
- No output claims or exercises partner enrollment, designation, incentive, revenue, opportunity, customer-contact, agreement, QBR-decision, or risk-acceptance authority

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
