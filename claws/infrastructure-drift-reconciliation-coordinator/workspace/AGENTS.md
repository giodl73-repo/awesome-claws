# Operating workflow

## Start here

Ask for or confirm:

- Stable reconciliation snapshot id, cutoff, approved workspace and destination, plus named human infrastructure owners and deviation approvers with exact scopes
- Desired-state snapshot id, digest, timestamp, controlled export, and resource rows carrying native identifiers, owner-supplied canonical identities or unresolved identity state, and owner-supplied comparable digests
- Observed-state snapshot id, digest, timestamp, controlled export, and the same resource identity and comparable-digest contract across every approved provider and account scope
- Optional time-bounded deviation approvals naming one exact drifted resource and binding both complete snapshot digests, requester, independent scoped approver, approval evidence, and expiry

## Included capability boundaries

- The base starter uses only supplied workspace artifacts and grants no browser, shell, network, cloud, IaC, registry, MCP, plugin, cron, messaging, ticketing, deployment, or infrastructure capability.
- Configuration repositories, inventory systems, change systems, and named infrastructure and risk owners retain all identity, comparability, desired-state, remediation, deviation, acceptance, deployment, and closure authority.
- Malformed, duplicated, unresolved, stale, future, mismatched, expired, self-approved, or incompletely covered evidence produces exact blockers and an owner handoff rather than inferred identity, hidden drift, or accepted deviation.

## Structured decision artifact contract

- Treat `fixtures/infrastructure-drift-reconciliation.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/infrastructure-drift-reconciliation.json` and check it against `schemas/infrastructure-drift-reconciliation.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/infrastructure-drift-reconciliation.md` at `outputs/infrastructure-drift-reconciliation-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm the reconciliation cutoff, approved destination, named-human scopes, both complete snapshot identities and digests, and reciprocal controlled export evidence
2. Reject duplicate or unresolved owner-system identities; never join native IaC and provider identifiers by inference
3. Derive the exact union of environment, provider scope, and canonical resource identity across the desired and observed snapshots
4. Classify each resolved identity from symmetric membership and supplied comparable-digest equality only: converged, drifted, missing, or unmanaged
5. Require exactly one disposition per derived identity and an exact blocker for every unresolved identity, with no hidden, duplicate, or extra row
6. Validate any asserted deviation as an exactly-once overlay on one drifted resource, independently approved and bound to both current snapshot digests and an unexpired interval; changing either snapshot or reaching expiry revokes it
7. Render only blocked or ready-for-owner state with the exact resource coverage index, visible unapproved drift, approved-deviation status, unresolved correspondence, and next named owner

## Example setting

**Request:** Reconcile these supplied production IaC and cloud-inventory exports. Show every resource that is converged, drifted, missing, unmanaged, or blocked on unresolved identity, and verify whether the database deviation still binds both snapshots; do not access the cloud, run Terraform, change anything, approve risk, or claim compliance.

**Expected outcome:** A strict reconciliation artifact proving one disposition for every resolved resource in the symmetric union, preserving the inventory-only unmanaged resource, blocking an unevidenced IaC-to-provider identity match, revoking any deviation whose desired or observed snapshot digest changed or expired, and handing all interpretation and action to the named infrastructure owners.

## Standard deliverables

- Reconciliation snapshot, named-principal, controlled-evidence, desired-state, and observed-state ledgers
- Exact symmetric resource-universe index with converged, drifted, missing, and unmanaged membership dispositions
- Deviation ledger with exact resource scope, dual-snapshot digest binding, independent approval evidence, expiry, and revoked-state blockers
- Exact blocker register and destination-bound owner handoff that preserves visible drift without infrastructure, change, risk, or compliance authority

## Done when

- The derived symmetric resource union equals the declared coverage index exactly, with no duplicate identity, hidden row, extra disposition, or resolved identity lacking exactly one disposition
- Every desired and observed row is reciprocally named by its exact controlled snapshot export, and unresolved cross-namespace identity correspondence derives no disposition and carries an exact open blocker
- Converged versus drifted is derived only from owner-supplied comparable digest equality, while desired-only and observed-only membership derives missing and unmanaged respectively
- Every asserted deviation is consumed exactly once by the drifted resource it names, is approved by a different scoped named human with evidence that approver supplied, binds both current snapshot digests, and is unexpired; any change or expiry prevents ready state
- The handoff is blocked whenever evidence, identity, totality, chronology, deviation, or destination binding is invalid and makes no infrastructure, remediation, security, risk, release, or compliance claim

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
