# Operating workflow

## Start here

Ask for or confirm:

- Round identity with the opaque prior-round reference, cutoff, review window, fresh-decision cadence, approved private destination, the exact owner authority-roster reference, and one content-addressed export naming the round, the snapshot, and every assignment row
- Assignment snapshot whose digest is the recomputed, locale-independent manifest of every owner-supplied row field, with an in-scope flag and closed exclusion code per row, direct or owner-expanded resolution mode, a per-row assignment digest, the declared owner source system, the owner entitlement catalog, and the fixed register of access paths the export does not cover
- Owner authority roster whose digest is recomputed from every principal id, name, kind, and exact scope set, bound to one content-addressed custodian export naming the roster and every principal in the ledger
- Principal ledger that separates named people from teams, service identities, systems, agents, and roles, with round-running scopes for humans including the declared execution-handoff recipient, supplier scopes for the declared source system, and the owner-supplied grantor for every assignment row
- Reviewer authority grants naming the exact resource and entitlement, review and privileged-review scopes, an active interval wholly contained by the current round, a rostered issuing owner who is not the subject, and reciprocal controlled evidence issued between the snapshot cutoff and grant activation
- Source-system signals bound to the current round, snapshot digest, row reference and row digest, carrying a typed inactive-day count or a typed recommendation code and exactly one reciprocal content-addressed record from the declared source system

## Included capability boundaries

- The base starter uses only supplied workspace artifacts and grants no directory, IAM, HR, cloud, browser, shell, network, MCP, plugin, cron, messaging, or ticketing capability.
- IAM systems, resource and entitlement catalogs, HR and identity sources, access owners, reviewers, and executors retain all identity, scope, privilege, authority, alternative-access planning, and execution authority.
- Malformed, duplicated, excluded, unscoped, expired, self-reviewed, machine-sourced, changed, stale, or incompletely covered evidence produces exact blockers and an owner handoff rather than an inferred decision, a hidden row, or an executed change.

## Structured decision artifact contract

- Treat `fixtures/access-entitlement-review.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/access-entitlement-review.json` and check it against `schemas/access-entitlement-review.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/access-entitlement-review.md` at `outputs/access-entitlement-review-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Recompute the assignment-manifest and authority-roster digests under code-unit ordering, confirm the round cutoff, review window, cadence, approved private destination, declared handoff recipient, roster boundary, source system, entitlement catalog, source-signal index, and not-covered access paths all match the exact content-addressed owner export before reading any assignment row
2. Derive the exact in-scope assignment key universe from owner-supplied scope only, and hold every excluded row visible under the closed exclusion code its owner supplied
3. Validate every decision maker as a named human whose current-round grant covers the exact resource and entitlement, was active at the decision instant, and was issued by a rostered owner who is not the subject
4. Refuse every non-human decision maker and every system default, auto-apply, no-response default, or accepted recommendation, and render source-system signals structurally without letting one settle a row
5. Bind each decision to the exact assignment reference, row digest, current snapshot manifest digest, current round, and one controlled record its decider authored at the decision instant that binds that decision's exact semantic payload, and hold every decision, non-decision, and blocker to one window rule: after the snapshot cutoff, no earlier than the window opens, no later than it closes
6. Require exactly one retain, revoke, or non-decision for each in-scope key, and fail closed on unknown or absent privilege, missing authority, escalation without a scoped next reviewer, and any coverage gap
7. Render only blocked or ready-for-owner-execution to the recipient the round declared, with the exact key coverage index, exclusion index, blocker index, rendered signal index under a constant not-a-decision presentation, and the access paths the snapshot does not cover

## Example setting

**Request:** Coordinate our Q3 entitlement recertification from these supplied access exports. Show every in-scope assignment with its named-human retain or revoke decision for this round, prove each reviewer was authorized for that exact resource and entitlement by someone the owner roster names, keep the source-system inactivity and recommendation signals visible without letting them decide anything, and do not let last quarter's approvals stand in for this quarter's. Do not reach our directory, expand groups, compute effective access, change access, or claim we are compliant.

**Expected outcome:** A strict review artifact whose snapshot digest is the recomputed owner assignment manifest and whose authority roster is a content-bound custodian record, proving exactly one fresh named-human decision or one exact non-decision for every in-scope assignment key, refusing a service-account reviewer and an auto-applied default, keeping an owner-excluded workload-identity row visibly out of scope under a closed exclusion code, recording a privileged revoke by a reviewer who is neither its subject nor its grantor, recording a third current retain against a source-system deny recommendation, rendering the six access paths this snapshot does not cover, and handing execution to the named access owner with no replacement, modification, or field anywhere in which to claim the change was made.

## Standard deliverables

- Round, snapshot, principal, and evidence ledgers bound to one recomputed assignment-manifest digest, with every controlled record content-addressed, payload-bound to the row it supports, uniquely identified, and consumed exactly once
- Exact in-scope assignment key coverage index carrying one named-human retain or revoke decision or one exact non-decision per key
- Reviewer authority ledger proving per-row resource and entitlement coverage, active interval, privileged separation from subject and grantor, and a rostered issuing owner for every decision
- Content-bound owner authority roster naming its independent custodian, its recomputed digest over every principal, and the point past which this package proves nothing about who may authorize whom
- Blocked or ready-for-owner-execution handoff to a named human holding the owner execution-handoff scope who is not a reviewed subject, with the exclusion index, rendered signal index, not-covered access paths, and no summary, outcome, certificate, attestation, or compliance lane

## Done when

- The recomputed assignment-manifest digest equals the declared snapshot digest, the recomputed roster digest equals the declared roster digest under an independent custodian export, and the derived in-scope key universe equals the declared coverage index exactly, with no duplicate key, hidden row, laundered exclusion, or key carrying more than one terminal record
- Every decision, non-decision, and blocker sits after this snapshot cutoff, no earlier than the review window opens and no later than it closes, and every decision is a fresh named-human retain or revoke bound to the exact assignment reference, row digest, current snapshot manifest digest, and current round, evidenced by exactly one content-addressed record its decider authored at the decision instant
- Every decision maker holds an owner-supplied grant whose active interval is wholly contained by the current round and covers the exact resource and entitlement at the decision instant, every evidence record is observed between the snapshot cutoff and round close, excluded rows assert no privilege value, privileged rows separate the reviewer from the subject and the owner-supplied grantor under privileged-review scope, and unknown or absent privilege blocks instead of defaulting
- No system default, auto-apply, no-response default, accepted recommendation, prior-round decision, or source-system signal reaches a terminal state, and every controlled record is content-addressed, uniquely identified, consumed exactly once, and bound to the exact semantic payload of the row it supports as well as its exact subjects, author, instant, and snapshot digest
- The handoff goes to the recipient the round declared, who holds the owner execution-handoff scope and is no reviewed subject, and it is blocked whenever a non-decision, blocker, evidence, payload, authority, scope, chronology, manifest, roster, source-authority, or coverage gap exists, and it carries no field in which execution, attestation, certification, compliance, or effective-access coverage could be claimed

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
