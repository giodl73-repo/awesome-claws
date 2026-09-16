# Customer success plan revision review

Render `outputs/customer-success-review.json` only after it passes the strict
JSON Schema and registered semantic validator. Render this Markdown handoff from
the same validated record as the inline visual. Copy narrative text only from
that validated record; do not synthesize additional narrative claims in either
rendered artifact.

## Exact review scope

- Customer, tenant, and account:
- Approved success plan and immutable revision:
- Review window and trusted as-of:
- Accountable review owner:
- Plan approval decision, owner, source, and timestamp:
- Trusted approved-plan signer key id (supply customer-specific keys to
  `validate:artifact` with `--approved-plan-public-key <key-id>=<base64-spki>`):
- Trusted metric digest for the immutable plan revision (supply it with
  `--approved-plan-metric-digest <plan-id>@<revision>#<metric-id>=<sha256-digest>`):

Do not merge evidence from another customer, tenant, account, plan, revision,
workload, service, metric definition, or time window.

## Workload adoption

For each signal, show the exact workload and service, approved metric definition,
unit, aggregation, direction, target, source, measurement window, observation
timestamp, value, and derived status. Preserve missing, stale, conflicting,
differently defined, and differently scoped evidence as a gap.

## Service health

For each health observation, show the workload, service, controlled source,
measurement window, observation timestamp, status, and incident reference.
Service health is not adoption, milestone acceptance, renewal evidence, or a
claim of customer success.

## Outcome milestones

List each plan milestone's exact workload and service, accountable owner, due
time, acceptance criteria, state, and exact acceptance receipts. An accepted
milestone requires one human-owned receipt and decision for every criterion.
A metric-backed accepted criterion must cite its exact observation and source;
that observation must be on target under the immutable metric definition and
target for the review window. Do not infer acceptance from activity, adoption,
service health, or narrative status.

## Risks, blockers, actions, and receipts

List every risk and blocker with severity, owner, source evidence, linked
actions, and current state. List every action and receipt with its exact
workload and service, owner, due time, state, and source evidence. Reject null
or cross-workload/service evidence. Never close a risk before all linked action
receipts resolve.

## Decisions and review cadence

Record each decision's kind, accountable human, timestamp, source evidence, and
result. Show the prior review, next review, timezone, frequency, and cadence
owner. A route or handoff is not approval, acceptance, commitment, or execution.

## Renewal and escalation handoff

Name the accountable renewal and escalation owners, evidence or risk references,
decision needed, and due time. Keep the review blocked while evidence, outcomes,
risks, or actions remain unresolved.

## Authority boundary

The Claw does not contact the customer or send messages; change workloads,
tenants, accounts, services, or support cases; make commercial promises; change
pricing or contracts; commit renewal; accept risk; or claim customer success.
