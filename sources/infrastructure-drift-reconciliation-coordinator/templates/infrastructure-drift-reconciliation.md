# Infrastructure drift reconciliation artifact

Current reconciliation snapshot: {{snapshot.id}}
Current reconciliation digest: {{snapshot.digest}}
Cutoff: {{snapshot.asOf}}
Workspace: {{snapshot.workspaceRef}}
Review destination: {{snapshot.destinationRef}}
Handoff state: {{handoff.state}}

## Snapshot and controlled export binding

Render the current reconciliation snapshot and the exact desired and observed
snapshot ids, digests, timestamps, and controlled export evidence. Every
snapshot and resource must be reciprocally named by the appropriate controlled
export at its exact digest and timestamp. Render the current snapshot indexes
and report any missing, duplicate, dangling, or cross-snapshot row.

## Named human authority

Render named principals, their controlled authority-roster evidence, and exact
scopes. Configuration repositories, inventory systems, change systems, and
named infrastructure owners remain authoritative. A role, system, package, or
agent name is not a human owner. This package records supplied deviation
evidence and never grants, approves, or accepts a deviation.

## Resolved symmetric tuple universe

For each owner-supplied resolved tuple:

`(environment, providerScope, canonicalResourceId)`

render the desired and observed provenance, supplied comparable digest, and
exactly one derived disposition:

- `converged`: both snapshots have the tuple and their owner-supplied comparable
  digests are equal;
- `drifted`: both snapshots have the tuple and their supplied comparable digests
  are unequal;
- `missing`: only the desired snapshot has the tuple; or
- `unmanaged`: only the observed snapshot has the tuple.

The coverage index must equal that union exactly. The `nativeId` is provenance
only: never join it to a provider id, name, tag, address, or normalized field.
Never compare raw configuration fields or invent a comparable digest.

## Unresolved identity correspondence

Render no tuple or disposition for an `unresolved` resource. Instead, list its
exact open `identity-correspondence-unresolved` blocker, the supplied resource
rows it names, source export evidence, and named infrastructure owner. A
blocker does not turn two native identifiers into a match. The handoff remains
`blocked` while any open blocker exists.

## Drift deviation overlay

Keep unapproved drift visible. If a drifted tuple names a deviation, render the
exact tuple, desired and observed snapshot digests, requester, independently
scoped approver, approval time, approver-authored controlled approval evidence,
and expiry. The deviation is usable only when it is consumed exactly once by
that exact drifted tuple, binds both complete current source digests, has a
different named requester and approver, and remains unexpired at the cutoff.
Any digest change, expiry, scope mismatch, reuse, unused record, chronology
failure, or absent named human makes the handoff blocked.

## Owner handoff

Render the destination-bound next named infrastructure owner, exact blocker
references, all visible drift, and the explicit non-claims for infrastructure,
remediation, change, risk acceptance, compliance, security, and correctness.
Do not access cloud or IaC systems, run plans or applies, propose or execute
remediation, change tickets, approve a deviation, accept risk, or gate a
release or change.
