# Incident response handoff

Use `outputs/incident-state.json` as the source of truth. This view is
review-oriented and must not imply that the Claw performed an external action
or exercised an incident, risk, communication, or compliance authority.

## Exact incident snapshot

- Incident, severity, state, environment, builds, and snapshot/revision:
- Current impact and evidence observation window:

## Technical DRI loop

- Named Technical DRI:
- Investigation and evidence:
- Hypotheses:
- Mitigation proposals and technical-owner coordination:
- Owner-execution evidence reconciliation:
- Service-recovery criteria:

## Incident Manager loop

- Named Incident Manager:
- Severity and state:
- Cadence and next update:
- Decision and action chronology:
- Escalations:
- Communication drafts and exact approvals:
- Shift handoff:
- Incident-recovery and closure recommendations:

Technical DRI and Incident Manager must be different named human principals.
Neither role may be the Claw, agent, assistant, bot, automation, or a bare role
label.

## Update cadence

Record the cadence revision, anchor, interval, and non-future as-of. Include
every elapsed occurrence plus exactly one next scheduled occurrence.

| Sequence / id | Revision / snapshot | Due | Issued | Observed through | Author | Required sections | State | Next |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |

Do not render an update as issued before all referenced evidence was observed
or when a prior sequence is missing. Preserve overdue and missed rows.

## Decision chronology

| Decision | Incident / snapshot | Maker / authority | Type | Subject / revision | Exact inputs | Time | Supersedes |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |

## Proposed and owner-executed actions

Keep disruptive actions proposed unless a different named owner supplied
execution evidence after exact independent approval. The Claw never mutates
production, shifts traffic, revokes credentials or sessions, or executes a
mitigation.

## Communication drafts

Keep audience, revision, channel, timing, author, and independent approval exact.
The Claw never sends a communication.

## Recovery and closure

- Service-recovery criteria and independent evidence:
- Technical DRI incident-recovery recommendation:
- Incident Manager review:
- Owner-controlled closure state:

Recovery does not imply incident closure.

## Durable follow-up obligations

| Identity / key | Incident and origin refs | Asset / service / control | Owner | Due / SLA | State | Compliance handoff |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

For compliance-required work, preserve the deterministic key in a typed
`repository-compliance-program-manager` proposed/ready handoff. Do not imply
that this Claw created or updated an issue, remediated or verified a control,
closed compliance work, or accepted risk.

## Structural authority and next owner

Copy every authority non-claim and prohibited action. Name the human incident
authority, open blockers, next update, and shift-handoff owner.
