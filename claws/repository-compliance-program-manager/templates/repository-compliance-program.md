# Repository compliance program checkpoint

Render `outputs/repository-compliance-program.json` only after it passes the
strict JSON Schema and the registered semantic validator.

## 1. Program identity and source totality

Record the exact program, review period, control catalog, SLA policy, trusted
as-of, predecessor, current checkpoint, custodian, issue destination, and every
complete source snapshot root. Show any missing or conflicting source as a
blocker; do not infer it.

## 2. Controls, assets, owners, signals, and findings

List every control and asset with its computed revision. Preserve source-owned
severity, applicability, status, identity, and evidence. Show canonical finding
groups separately so deduplication never erases a source signal.

## 3. Remediation-obligation universe

List exactly one obligation for every canonical
control-revision/asset-revision/finding-revision tuple. Include its deterministic
obligation key, owner, team, source priority, open/ETA/due dates, SLA state,
tracking issue, extension or exception, verification, reopen lineage, and
blockers.

## 4. Issue mutation reconciliation

For each issue create or update, show:

- approved destination, asset roster, template, route, labels, and operation;
- mutable fields and proposed managed values;
- deterministic idempotency key and dry-run preview digest;
- exact obligation revision and issue-policy digest;
- proposed owner, due, ETA, SLA, and obligation-state values derived from that
  obligation, plus template, labels, and route derived from that policy;
- expected issue revision equal to the authoritative pre-mutation revision and
  owner-content digest;
- conflict state and applied, replayed, or blocked state;
- exact external receipt where a mutation is claimed, with the resulting issue
  revision and any replay linked to the original receipt and identical result.

Never render an owner-content conflict as applied. Never render an issue as
closed.

## 5. SLA, extension, exception, blocker, and escalation state

Compute within/near/out state at the trusted as-of. Surface missing ETA and
high/critical priority alongside near/out-of-SLA state. Bind each extension,
exception, and escalation to its exact obligation, control revision, asset
revision, and issue scope. Bind extensions and exceptions to an independent
eligible authority, approval time, expiry, state, and evidence. Escalation
routes do not approve anything.

## 6. Verification and reopen

Show remediation and independent verification chronology and exact obligation,
control, asset, issue, and remediation revisions. Separately show merge,
passing-check, scanner-status, and incident-recovery observations with
`closureEffect: none`. Show a new obligation key and predecessor lineage for
every revision-driven reopen.

## 7. Checkpoint delta and private handoff

Render the exact opened/changed/verified/reopened/unchanged partition, open
blockers, next review, and accountable human owner. Copy the structural
authority non-claims exactly and retain `published: false`.
