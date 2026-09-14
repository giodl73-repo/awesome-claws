# Repository compliance program handoff

Use the structured checkpoint as the source of truth. This view is private,
review-oriented, and must not imply that the Claw changed code or settings,
closed an issue, approved an exception or extension, accepted risk, performed
remediation, or established compliance.

## Exact checkpoint

- Program and revision:
- Review period and trusted as-of:
- Control catalog and version:
- SLA policy and revision:
- Predecessor checkpoint and current checkpoint digest:
- Source snapshot roots:
- Private owner:

## Universe and predecessor delta

| Layer | Exact current count | Added | Changed | Reopened | Verified | Unchanged |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Controls |  |  |  |  |  |  |
| Assets |  |  |  |  |  |  |
| Source signals |  |  |  |  |  |  |
| Canonical findings |  |  |  |  |  |  |
| Remediation obligations |  |  |  |  |  |  |
| Tracking issues |  |  |  |  |  |  |

List each duplicate-signal group with every retained source identity. Never
collapse the source records themselves.

## Obligation and issue ledger

| Obligation | Control revision | Asset revision | Finding revision | Source signals | Owner | Issue | ETA | Due | SLA | State |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Every obligation must have exactly one issue. For each planned create or update,
show the approved destination, repository/asset, template, route, labels,
mutable fields, exact obligation revision, policy digest, idempotency key,
preview digest, conflict state, and external receipt. Proposed owner, due, ETA,
SLA, and obligation-state values must equal the bound obligation. Preserve
owner-authored issue content and block rather than overwrite when the observed
pre-mutation revision or owner-content digest changed. Show the resulting
revision separately, and link replay receipts to the original receipt and
identical result.

## SLA, blockers, and escalation

| Obligation | Missing ETA | Priority | SLA state | Extension | Exception | Blocker | Escalation route | State |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

Extensions and exceptions must name a separate eligible authority, exact
obligation/control/asset/issue scope, approval evidence, expiry, and current
state. Escalations must carry the same exact scope. An escalation records
routing only; it is not approval or risk acceptance.

## Remediation verification and reopen

| Obligation | Remediation revision | Remediation author | Verification author | Exact bindings | Outcome | Reopen predecessor/reason |
| --- | --- | --- | --- | --- | --- | --- |

Verified remediation requires independent evidence bound to the exact
obligation, control revision, asset revision, issue revision, and remediation
revision. A pull-request merge, passing check, scanner status, incident recovery,
or self-authored evidence has no closure effect. A superseding control, asset,
or finding revision creates a newly keyed reopened obligation.

## Capability and receipts

- Issue-writer dependency and provenance digest:
- Allowed operations:
- Approved destination and asset roster:
- Template, mutable fields, labels, and route:
- Dry-run and conflict requirements:
- Create/update receipt coverage:
- Idempotent replay coverage:
- Installed lifecycle evidence: inspect, add preview, add, status, upgrade
  preview/apply, rollback preview/apply, remove preview/apply, reinstall, final
  removal.

## Structural authority

Copy every structural non-claim from `authority`. Do not replace these fields
with narrative assurance.

## Private next-owner handoff

- Open blockers:
- Queued or dispatched escalations:
- Next review time:
- Accountable human owner:
- Private destination:
- Publication state: false
