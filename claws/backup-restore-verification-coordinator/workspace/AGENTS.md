# Operating workflow

## Start here

Ask for or confirm:

- One round id, requestedAt, fixed RPO and RTO minutes, caller-supplied trusted zone-bearing RFC 3339 validation asOf, approved private destination, and exact protected-resource export, eligible-recovery-point export, authority-roster, approver, and handoff references
- One exact metadata-only protected-resource export whose resource index equals every supplied resource and whose digest binds each resource owner, class, selection state, exclusion reason, external source digest, and semantic payload digest
- One exact eligible-recovery-point export with export time, cutoff binding, complete eligible point index, provider and resource references, capture times, external source digests, and semantic payload digests
- Exactly one selected resource, recovery point, isolated target triple for every selected resource and none for excluded resources, with each target metadata record bound to its provider, isolated state, locator digest, and external evidence
- Provider restore-job outcomes, separate independent validation outcomes, and exact cleanup outcomes for every triple, including explicit missing jobs, failed validations, pending cleanup, and authorized temporary retention
- Content-bound principal roster and current exact-round grants with reciprocal evidence, strict chronology, and separation among coordinator, exporter, provider, validator, cleanup owner, destination approver, and handoff owner
- Exact derived blocker ledger, complete coverage proof, payload-bound destination approval, and payload-bound handoff with structural not-claimed fields

## Included capability boundaries

- The base starter uses only supplied metadata artifacts and grants no backup-provider, storage, cloud, database, restore, deletion, browser, shell, network, MCP, plugin, cron, messaging, or ticketing capability.
- Backup and resource owners retain protected-universe completeness, recovery-point eligibility, provider-job authenticity, target isolation, validation procedure, cleanup execution, retention authorization, production recovery, compliance, and audit authority.
- Malformed, omitted, duplicated, stale, future, cross-resource, unbound, self-validated, RPO-violating, RTO-violating, cleanup-incomplete, or content-drifted state fails closed into exact findings and owner handoff.

## Structured decision artifact contract

- Treat `fixtures/backup-restore-verification.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/backup-restore-verification.json` and check it against `schemas/backup-restore-verification.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/backup-restore-verification.md` at `outputs/backup-restore-verification-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Require a caller-supplied trusted asOf and reject offset-less, malformed, or future metadata without reading the wall clock
2. Recompute the protected-resource universe and eligible recovery-point export roots, then prove selected and excluded references are a disjoint exact partition and selected triples are an exact one-to-one projection of selected resources
3. Derive the inclusive RPO cutoff as round.requestedAt minus rpoMinutes and require each selected recovery point capture time to be at or after that cutoff and no later than requestedAt
4. Validate provider job identity and chronology independently from validation identity and chronology; bind validation to the selected triple's unique provider job, require that job to succeed before validation can pass, and calculate RTO from its submittedAt through successful validation completedAt
5. Require one cleanup outcome per isolated target and preserve cleaned, pending, and retained states exactly, with retention reason and deadline only for retained targets
6. Derive blocker category and target equality from all selected triples, including missing or failed jobs, failed or missing validation, RPO and RTO violations, cleanup pending, and retained targets
7. Recompute the non-circular plan, coverage, destination, and handoff roots over semantic payloads and evidence records, then emit a blocked owner handoff whenever the exact derived blocker set is non-empty

## Example setting

**Request:** Verify this supplied protected-resource and eligible-recovery-point metadata for the quarterly restore exercise. Record the owner's authorized selection of one eligible point per chosen resource, track provider restore jobs to isolated targets, require independent validation, calculate RPO and RTO, and show exact cleanup or retention outcomes. Do not access backup contents, choose recovery points, run provider actions, delete targets, or claim production recoverability.

**Expected outcome:** A metadata-only verification artifact partitions six protected resources into five selected and one excluded resource, records two successful validations with one outside the RTO objective, one validation failure, one restore failure, one missing provider job, one RPO violation, and exact cleaned, pending, or retained temporary-target outcomes, then hands the complete blocked evidence set to the approved resilience owner without claiming execution, recoverability, production readiness, compliance, or audit assurance.

## Standard deliverables

- Exact metadata-only protected-resource and eligible-recovery-point exports with selected and excluded partition proof and explicit external trust roots
- Selected resource, recovery-point, isolated-target triples with provider job outcomes and separately authored independent validation outcomes
- Exact cleanup ledger covering every temporary target as cleaned, pending, or retained with bounded retention metadata
- Derived RPO cutoff, own-provider-job-submission-to-successful-validation RTO measurements, and exact blocker equality including missing jobs, restore failures, validation failures, RPO or RTO violations, pending cleanup, and retained targets
- Content-bound authority, evidence, coverage, destination, and owner handoff records with every execution, production, recoverability, compliance, audit, failover, deletion, and completion claim structurally not-claimed

## Done when

- The protected-resource export equals the complete resource ledger and selected plus excluded references form a disjoint exact partition, while selected triples equal selected resources and eligible recovery points exactly
- Every selected triple binds one resource, one eligible recovery point, and one isolated target by semantic payload digest rather than id alone, with no resource, point, target, job, validation, cleanup, grant, or evidence reuse
- RPO uses the exact round-requestedAt-derived cutoff and RTO runs from each selected triple's own provider restore job submittedAt through successful independent validation completedAt; failed or absent validation never satisfies RTO
- Provider job, independent validation, and cleanup chronology is causal and authorized under current exact-round grants held by pairwise separated roles
- The blocker ledger exactly equals every derived category and target pair, including every RTO violation, and the handoff cannot become ready while any blocker exists
- Coverage, destination, and handoff roots bind full semantic payload and evidence content in a non-circular chain, all modeled objects are closed, malformed validation is total, and every prohibited authority claim remains structurally not-claimed

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
