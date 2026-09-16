# Operating workflow

## Start here

Ask for or confirm:

- One organization, agreement, license program, exact predecessor-round reference, reconciliation-round id, fixed period start and end, caller-supplied cutoff and validation asOf, approved private destination, and versioned owner authority roster
- One owner-supplied canonical rights manifest and SKU mapping version with immutable digest, agreement and program binding, metric and conversion definitions, complete right and pool indexes, named source owner, and reciprocal evidence
- Complete entitlement-pool and assignment exports plus complete measured-consumption exports, each fixed to the same organization, agreement, program, period, cutoff, source owner, source revision, source digest, and reciprocal evidence
- Typed named-human source owners, reviewers, approvers, and handoff owner with exact current-round grants, active intervals, separation rules, and reciprocal authority evidence
- Exact exceptions and fresh human decisions bound to one affected right, pool, assignment, or consumption record, with deterministic coverage and destination handoff records

## Included capability boundaries

- The profile grants only workspace-limited file authoring and inline visual presentation; it has no licensing portal, directory, identity, procurement, billing, vendor, messaging, network, shell, plugin, MCP, scheduler, or source-system authority.
- Treat the owner-supplied versioned rights manifest and SKU mapping as external trust roots whose authenticity and semantic correctness must be independently verified by their named human source owners.
- Render the packaged accessible review only from a schema-valid, semantically clean artifact and preserve the complete Markdown review as the authoritative fallback.

## Visual application contract

- Treat `assets/license-position-review.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/license-entitlement-reconciliation.json` and check it against `schemas/license-entitlement-reconciliation.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/license-position-review.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/license-position-review.md`.
- Read `outputs/license-position-review.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Validate caller-supplied temporal context, organization and program scope, predecessor continuity, the canonical rights and SKU mapping trust root, typed authority, and reciprocal evidence before reconciliation
2. Recompute locale-independent digests and prove exact equality among declared right, pool, assignment, consumption, exception, decision, evidence, and coverage indexes
3. Resolve SKU and metric identities only through the owner-supplied mapping, allocate each assignment and consumption record exactly once to its declared pool and right, and preserve unmapped or conflicting rows as blockers
4. Calculate purchased, assigned, consumed, available, unassigned, and overage quantities in fixed integer units using only mapped owner-supplied arithmetic and the fixed period and cutoff
5. Require one exact exception or fresh named-human reviewed decision for every non-balanced position, carry predecessor references only as lineage, and produce a blocked or ready-for-owner-review handoff without recommending or executing action

## Example setting

**Request:** Reconcile organization Northwind's owner-supplied Enterprise Agreement EA-204 license-program LP-2026 rights manifest v4 and SKU mapping v7 against the complete assignment and measured-consumption exports for 2026-08, using cutoff 2026-09-01T00:00:00Z, validation asOf 2026-09-03T18:00:00Z, reconciliation round round-2026-08-r2, and predecessor round-2026-07-r1. Preserve every right, pool, assignment, consumption record, exception, and fresh human decision exactly once. Do not interpret agreement text, infer access or usage, purchase, assign, revoke, renew, mutate accounts, submit a true-up, recommend action, or declare compliance.

**Expected outcome:** A deterministic rights-to-pool-to-assignment-and-consumption reconciliation for one fixed organization, agreement, program, period, cutoff, and round, with exact coverage, mapped integer arithmetic, reciprocal evidence, typed named-human authority, explicit exceptions and decisions, and an owner-review handoff that performs no licensing or account action and makes no compliance claim.

## Standard deliverables

- Version-bound organization, agreement, program, round, predecessor, rights-manifest, SKU-mapping, principal, authority, and evidence ledgers
- Closed right, entitlement-pool, assignment, and measured-consumption reconciliation with deterministic integer-unit arithmetic
- Exact unmapped, conflicting, incomplete, out-of-period, under-assigned, over-assigned, under-consumed, and over-consumed exception ledger
- Fresh named-human decision ledger with exact scope, authority, chronology, and reciprocal evidence
- Accessible license-position review with complete Markdown fallback and a destination-bound blocked or ready-for-owner-review handoff carrying structural not-performed and not-claimed fields

## Done when

- The organization, agreement, license program, predecessor, round, period, cutoff, rights manifest, SKU mapping, authority roster, and destination bindings are exact and every internal digest recomputes deterministically
- Every declared right, pool, assignment, consumption record, exception, decision, and evidence record appears exactly once in its closed index with reciprocal lineage and no duplicate or dangling identity
- Every in-period mapped assignment and consumption record resolves only through the canonical owner-supplied SKU mapping to one declared right and pool with exact integer arithmetic, while unmapped, conflicting, or out-of-period rows remain excluded from position arithmetic under one exact blocker
- Every non-balanced or blocked position has one exact exception and either one fresh authorized named-human decision or an explicit pending-decision state, while predecessor decisions remain lineage only
- The visual and Markdown views agree, the handoff is blocked whenever evidence, mapping, authority, chronology, coverage, arithmetic, exception, or decision validity fails, and no purchase, assignment, revocation, renewal, account mutation, true-up submission, recommendation, effective-access inference, effective-usage inference, or compliance claim occurred

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
