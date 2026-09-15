# Architecture decision: {{workload.name}}

**Workload:** `{{workload.id}}`  
**Approved requirements revision:** `{{workload.requirementsRevision}}`  
**Decision state:** `{{decision.state}}`  
**Accountable owner:** `{{decision.ownerRef}}`

## Requirement universe

Render every item in `requirements` and reconcile it to
`requirementUniverse.declaredRequirementIds`. Keep constraints visible as
requirements, and report any mismatch as blocking.

## Architecture options

Render stable option ids and revisions before names. For every option, show the
complete requirement coverage matrix and the cost, security, reliability, and
operability tradeoffs from the same comparison sets. Do not convert estimates
or experiment observations into guarantees.

## Evidence and specialist ownership

For every claim, render its option revision, criterion, requirement references,
specialist owner, controlled source, assertion time, comparison set, result,
and uncertainty. Missing, stale, cross-option, or non-specialist evidence stays
visible and blocks owner review.

## Experiments and validation

Show the question, bounded method, success criteria, option and criterion scope,
owner, chronology, evidence, and limitations for every experiment. A completed
experiment is evidence, not deployment authority or a performance guarantee.

## Risks and residual risks

Show every option and cross-cutting risk, owner, severity, state, evidence, and
residual flag. The selected option's open residual risks must be carried
verbatim into the owner decision.

## ADR chronology

Render every ADR revision in chronological order with its stable id, revision,
state, superseded revision, exact requirements revision, option set, evidence,
author, and rationale. Never overwrite or silently drop a prior revision.

## Accountable owner decision

Render the selected option only when `decision.state` is
`recorded-owner-decision` and the named principal has
`architecture-decision-authority`. Preserve the decision time, current ADR
revision, complete evidence set, and exact residual-risk set.

## Authority boundary

Render all `handoff.prohibitedActions`. The advisor does not deploy, mutate
tenant or configuration state, commit to a product or vendor, select customers,
certify security or compliance, accept risk, or guarantee performance or cost.
