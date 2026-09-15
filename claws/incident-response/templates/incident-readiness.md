# Incident response readiness

## Exact incident snapshot

Record incident, severity, state, environment, builds, snapshot/revision, start,
and as-of time. Do not infer missing identity or authority.

## Named role loops

### Technical DRI

Name the human principal and show only technical investigation, hypotheses,
mitigation proposals, technical-owner coordination, execution-evidence
reconciliation, and service-recovery criteria.

### Incident Manager

Name a different human principal and show only severity/state/cadence, decision
chronology, action loop, escalation, communication drafts and approvals, shift
handoff, incident-recovery review, and closure recommendation.

Neither role may be represented by the Claw, agent, assistant, bot, automation,
or a bare role label.

## Update cadence

Show the cadence revision, anchor, interval, and non-future as-of. For every
elapsed occurrence plus the next scheduled occurrence, show sequence and
deterministic id, revision, due time, issued time or `null`, observed-through
time, Incident Manager author, exact snapshot, required sections, evidence
refs, scheduled/issued/overdue/missed state, and next-update id. Never omit an
occurrence or issue an update before its due time or evidence.

## Decision chronology

For every decision show incident and snapshot, decision maker and exact
authority scope, decision type, subject and revision, input evidence, timestamp,
and superseded decision where relevant. Decisions cannot predate their inputs.

## Technical investigation and action loop

Show observations separately from Technical DRI hypotheses. For each disruptive
action show the exact target, timing, verification, rollback condition,
Technical DRI proposal/reconciliation, independent approval decision, named
execution owner, and external execution evidence. The Claw never executes it.

## Communication drafts

Show audience, exact draft revision, channel, timing, author, independent
approval decision, and state. Communications remain drafts; the Claw never
sends them.

## Recovery and closure

Render service-recovery criteria and independent checks separately from the
Technical DRI incident-recovery recommendation, Incident Manager review, and
owner-controlled closure. Service recovery and an incident recovery
recommendation never declare or close the incident.

## Durable follow-up and compliance handoff

For every follow-up show deterministic identity, incident, originating
evidence/decision/action, asset/service/control scope, owner, opened and due
times, SLA, and state. When compliance tracking is required, render the typed
`repository-compliance-program-manager.incident-obligation-handoff.v1` record
as `proposed` or `ready` with the same deduplication key. State explicitly that
no compliance issue was created or updated and no remediation, verification,
risk acceptance, or closure occurred.

## Authority boundary and next owner

Copy the structural authority non-claims and prohibited actions. Name the
incident authority who owns declaration and closure, unresolved blockers, the
next update, and any shift handoff.

## Compatibility

Write new records as `awesomeClaws.incidentResponse.v2`. The schema keeps the
strict legacy record and enriched v1 record as separate compatibility branches;
never mix their fields into v2. Migration is fail-closed: add every required v2
role, cadence, decision, recovery, closure, authority, follow-up, and compliance
handoff field before changing the version marker.
