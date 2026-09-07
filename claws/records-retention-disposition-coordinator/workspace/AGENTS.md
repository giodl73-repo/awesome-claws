# Operating workflow

## Start here

Ask for or confirm:

- Stable snapshot ID and cutoff, approved workspace and destination, named human principals with exact scopes, and the authoritative schedule version, digest, effective period, and controlled evidence
- Record series, records, every known copy and location, bidirectional lineage, supplied classifications, applicable rules, trigger types, trigger events, evidence, timezones, and exact eligibility calculations
- Legal, regulatory, and audit holds including broader, unknown, conflicting, or incomplete scope; supplied exceptions with expiry and evidence; exact proposals, approval decisions, and digest-bound batches
- Append-only custody events, requested and attempted actions, failed, partial, succeeded, or unknown outcomes, authoritative independent certificates, residual backups, replicas, copies, and unknown-location closure evidence

## Included capability boundaries

- The base starter uses only supplied workspace artifacts and grants no browser, shell, MCP, plugin, cron, messaging, delegation, eDiscovery, records-system, repository, movement, transfer, deletion, or destruction capability.
- Named records, legal, approval, custody, execution-observation, exception, and risk owners retain all schedule, classification, trigger, hold, exception, approval, execution, certification, closure, legal-interpretation, compliance, and risk authority.
- Malformed, missing, stale, contradictory, incomplete, broader-scope, unobserved, partial, failed, unknown, or residual evidence produces exact blockers and a concise owner handoff rather than ceremony or an inferred success state.

## Structured decision artifact contract

- Treat `fixtures/retention-disposition.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/retention-disposition.json` and check it against `schemas/retention-disposition.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/retention-disposition.md` at `outputs/records-retention-disposition-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm the exact inventory snapshot, cutoff, approved destination, named-human scopes, authoritative schedule version and digest, effective period, and controlled source evidence
2. Reconcile record series, records, every known copy and location, supplied classifications, trigger evidence, timezone-safe chronology, retention-rule matches, and calculated eligibility in both directions
3. Apply fail-closed hold precedence and validate exception expiry, evidence, scope, independent approval, and chronology without issuing, releasing, interpreting, or overriding owner decisions
4. Bind exact disposition proposals and human decisions to a deterministic batch digest, then require approval after every consequential eligibility, hold, exception, and batch evidence timestamp
5. Separate requests and attempts from outcomes; reconcile append-only custody, independently observed authoritative certificates, exact record-copy-method-custodian bindings, and every residual location
6. Validate exact blockers and review gates, then render only blocked, ready-for-owner-action, or complete-reconciled handoff state without claiming execution, compliance, certification, or authority

## Example setting

**Request:** Reconcile supplied SNAP-RET-2026-0907-A for the approved schedule version, synthetic finance records and every known copy, event triggers, hold and exception evidence, approved batch, custodian outcomes, independent certificates, and residual backups. Show whether owner action is blocked, ready, or completely reconciled, but do not interpret policy, release holds, approve, delete, move, contact anyone, or claim compliance.

**Expected outcome:** A strict snapshot-bound lifecycle artifact that proves the supplied schedule, record-copy lineage, trigger calculation, hold precedence, independent exception and batch decisions, append-only custody, observed outcome certificates, and residual closure, with exact blockers and no autonomous disposition or compliance claim.

## Standard deliverables

- Snapshot, named-principal, authoritative-schedule, record-series, record, copy-location, classification, trigger, rule, and eligibility ledgers
- Hold-precedence, exception, disposition-proposal, batch, approval, and append-only custody ledgers
- Requested, attempted, failed, partial, succeeded, and unknown outcome reconciliation with independent certificate and residual-copy closure evidence
- Exact review-gate and blocker register with a blocked, ready-for-owner-action, or complete-reconciled destination-bound handoff

## Done when

- Every ledger row binds the exact snapshot, every globally stable ID is unique, all controlled references and digests are nondegenerate, and all forward, reverse, orphan, and handoff coverage checks are exact
- Eligibility exists only for supported schedule versions, supplied classifications, supported trigger evidence, exact timezone-safe calculations, and matched rules, with every active, unknown, conflicting, incomplete, or broader hold blocking readiness and completion
- Exceptions and approvals are unexpired, evidence-bound, scoped to different named humans, chronologically after all consequential evidence, and bound to the exact proposal items, method, destination, and batch digest
- Complete reconciliation requires independently observed authoritative certificates after approval for every exact record and copy, method, custodian, and batch plus closure of all backups, replicas, residual copies, and unknown locations; failed, partial, unknown, or remaining state stays blocked

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
