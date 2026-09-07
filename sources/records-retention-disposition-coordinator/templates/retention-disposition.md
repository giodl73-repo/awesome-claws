# Records retention and disposition reconciliation

Snapshot: {{snapshot.id}}
As of: {{snapshot.asOf}} ({{snapshot.timezone}})
Inventory: {{snapshot.inventoryState}}
Destination: {{snapshot.destinationRef}}
State: {{handoff.state}}
Compliance: {{handoff.complianceState}}
Certification: {{handoff.certificationState}}

## Named human authority

Render every principal with exact scopes and controlled authority evidence. A
bare role, package, agent, service, or system identity cannot own schedule,
classification, trigger, hold, exception, approval, custody, observation,
residual-closure, review, compliance, certification, or risk authority.

## Authoritative schedule and exact inventory

Show the schedule key, exact version and digest, effective period, authority,
controlled evidence, series, records, and every known authoritative, working,
backup, and replica copy. Preserve every copy's controlled location, custodian,
and bidirectional record lineage. Never copy raw record content into this
artifact.

## Classification, trigger, rule, and eligibility

Render only supplied classifications and supported trigger events. Show the
trigger date, IANA timezone, confirmation evidence, matching schedule rule,
calendar-year calculation, local eligible date, exact instant, and calculation
time. Unsupported schedules, inferred classifications, unsupported triggers,
rule mismatches, invalid timezones, or calculation drift block eligibility.

## Hold precedence and exceptions

Show every legal, regulatory, and audit hold with issue evidence, exact scope,
state, and any separately authorized release evidence. Active, unknown,
conflicting, incomplete, or broader-scope holds block eligibility, readiness,
and completion. Show exception request, independent approval, scope, evidence,
and expiry; never treat a self-approved, expired, unsupported, or unscoped
exception as valid.

## Proposals, batches, and approvals

List exact proposed records, copies, eligibility rows, method, and approved
destination. Recompute the batch digest over the exact proposal, record, copy,
method, destination, creator, and creation timestamp. Approval must bind those
same values and occur after all consequential schedule, inventory,
classification, trigger, eligibility, hold, exception, proposal, and batch
evidence. The Claw records supplied approval; it never approves.

## Custody, outcomes, certificates, and residual closure

Render each copy's append-only custody chain. Keep `requested`, `attempted`,
`failed`, `partial`, `succeeded`, and `unknown` outcomes distinct and ordered
after approval. Requests, commands, attempts, tool results, and custodian
assertions are not independent proof of execution.

For completion, require an authoritative independently observed certificate
after approval and a succeeded outcome, bound to the exact batch digest, record,
copy, method, custodian, observer, timestamp, controlled evidence, and
certificate digest. Then require independently observed closure for every
primary, working, backup, replica, and unknown-location residual. Any failed,
partial, unknown, remaining, or unclosed state blocks completion.

## Review, blockers, and handoff

Render all nine review gates, all fourteen authority gates, every open blocker,
and exact equality among the blocker ledger, snapshot, and handoff. Use only:

- `blocked` when evidence, authority, execution proof, or closure is incomplete;
- `ready-for-owner-action` after exact independent approval and before any
  attempt;
- `complete-reconciled` only after every copy has succeeded, authoritative
  independent certificate evidence, and residual closure.

Always keep compliance `not-claimed` and certification
`evidence-reconciled-not-certified`. Name the next scoped human owner.
