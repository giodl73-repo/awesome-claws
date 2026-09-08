# Infrastructure drift reconciliation owner handoff

## Request

Record the supplied desired-state and observed-state snapshot ids, exact digests,
cutoff, approved workspace, and approved review destination. This artifact
reconciles supplied exports only; it is not a cloud, IaC, change, or remediation
operation.

## Current reconciliation snapshot and destination

- State `snapshot.id`, `snapshot.digest`, `snapshot.asOf`, `workspaceRef`, and
  `destinationRef`.
- State whether every indexed ledger and the handoff bind that exact current
  snapshot and destination. Do not name a ready state if any semantic finding
  or open blocker exists.

## Controlled desired and observed exports

- Name each desired and observed snapshot, source digest, source timestamp, and
  controlled export evidence.
- For every resource, retain the owner-supplied native id as provenance and the
  owner-supplied canonical id as identity. Never infer correspondence from an
  IaC address, provider id, name, tag, or normalized field.

## Exact symmetric resource coverage

- Render the exact tuple `(environment, providerScope, canonicalResourceId)`
  for every resolved identity in the desired/observed union.
- Render exactly one derived state per tuple: `converged` for both sides with
  equal owner-supplied comparable digests, `drifted` for both sides with
  unequal digests, `missing` for desired-only, and `unmanaged` for
  observed-only.
- Never compare raw configuration semantics. An unresolved identity derives no
  tuple or disposition.

## Drift and deviation overlay

- Keep every `drifted` tuple visible, including tuples with no deviation.
- For each asserted deviation, show its exact tuple, both complete current
  source snapshot digests, requester, independently scoped approver,
  approver-authored approval evidence at the approval time, and expiry.
- A changed source digest, scope mismatch, use other than once, invalid
  chronology, unknown requester, self-approval, missing approver scope, or
  expiry is a blocker, not an approval decision.

## Unresolved identity blockers

- List every unresolved resource and its exact open
  `identity-correspondence-unresolved` blocker. A blocker names the supplied
  rows it covers and does not establish a match between them.
- Make the handoff `blocked` while any blocker or semantic finding remains.

## Authority boundary and next named owner

- Name the scoped human owner for review at the approved destination.
- State only that supplied evidence was reconciled. Do not access infrastructure,
  run plans or applies, propose or execute remediation, act on tickets, approve
  a deviation, accept risk, gate a release/change, or claim compliance,
  security, correctness, safety, desiredness, or remediation.
