# Solid-band review

This review covers the 2 Claws remaining in the Solid band after Document
Intake Analyst moved from 69 to 94, Fundraising Campaign Manager moved from 79
to 95, Travel Concierge moved from 78 to 100, and Media Evidence Reviewer moved
from 73 to 95, Spreadsheet Analyst moved from 73 to 95 on 2026-08-29, and Travel
Planner completed its public-source itinerary and readiness artifact uplift, and
Public Company Watcher completed its filed-disclosure delta-ledger uplift on
2026-08-30, and Research Scout completed its scholarly evidence-delta ledger
uplift on 2026-08-29, and Research Monitor completed its approved-source
topic-watch delta ledger uplift on 2026-08-30, and Feed Intelligence Monitor
completed its feed-item delta and triage ledger uplift on 2026-08-30, and
Website Evidence Collector completed its capture and change-evidence ledger
uplift on 2026-08-30, and Meeting Intelligence moved from 73 to 100 with its
consent-bound meeting decision and action record on 2026-08-30, and Software
Maintainer moved from 78 to 100 with its bounded change-delivery record on
2026-08-30, Content Operations completed its publication-readiness uplift on
2026-08-31, Executive Assistant completed its commitment-ledger uplift on
2026-08-31, and Executive Briefing completed its per-run snapshot uplift on
2026-08-31, Knowledge Curator completed its bounded durable collection-index
uplift on 2026-08-31, and Knowledge Gardener moved from 73 to 100 with its
exact-version Notion change-plan uplift on 2026-08-31, and Presentation Producer
moved from 73 to 95 with its exact-version deck evidence and review sidecar on
2026-09-01. Both remaining entries pass the
non-negotiable package, regression, resource, and Experience gates. Their lower scores describe
reviewability and artifact-depth gaps, not observed live-model failures.

## Shared pattern

- Both remaining entries are grandfathered without retrospective contribution records.
  That is a five-point documentation gap, not a failed admission.
- Both remaining entries lack registered semantic validators.
- Both remaining entries lack a local structured-artifact schema.
- Both have complete operating contracts, screenshots, regression cases, and
  active maintenance.

## Current entries

| Claw | Score | Evidence / verification gap | Review |
| --- | ---: | --- | --- |
| `workflow-operator` | 79 | No local schema or semantic validator | Lobster owns typed workflow state; avoid duplicating its contract without a concrete handoff need |
| `video-concept-producer` | 79 | No local schema or semantic validator | A concept/shot/evidence manifest may help, but only if it governs the generated asset |

## Uplift batches

### 1. Finish existing structured contracts

Travel Concierge completed this path on 2026-08-29. Its existing shortlist
schema now has a realistic fixture, matching Markdown template, semantic
invariants, public validation, and a retrospective admission record.
Spreadsheet Analyst also completed a source-preserving transformation, lineage,
check, exception, authority, and owner-handoff manifest on 2026-08-29.

### 2. Add evidence ledgers where the job naturally owns state

Public Company Watcher completed this path on 2026-08-30 with an issuer,
source, amendment, filed-fact, comparability, owner-materiality, interpretation,
and private-handoff ledger. Research Scout completed this path on 2026-08-29
with a protocol-bound scholarly evidence ledger covering persistent identifiers,
screening, lifecycle and correction/retraction lineage, quality, contradictions,
replication, and private owner handoff. Research Monitor completed this path on
2026-08-30 with a private approved-source topic-watch ledger covering bounded
questions, source provenance, freshness, correction, withdrawal, supersession,
contradiction, priority, and owner review without duplicating Research Scout's
scholarly study-quality and publication-lifecycle controls. Feed Intelligence
Monitor completed the distinct feed-item path on 2026-08-30: its private ledger
owns approved subscription and cursor state, GUID/URL/digest deduplication,
item correction/withdrawal/supersession/duplicate lineage, typed signals, full
checkpoint disposition coverage, and idempotent owner queues without absorbing
Research Monitor's broad query authority or Website Evidence Collector's capture
ledger. Web Evidence Researcher completed the complementary one-shot
claim-evidence investigation path on 2026-08-30: its private ledger binds
approved public authorities, reproducible queries including zero-result support,
canonical source and reverse-query provenance, evidence stances and independent
corroboration, explicit conflicts and gaps, and human owner review without
becoming a recurring watch, feed triage, scholarly lifecycle, or raw
website-capture artifact. Website Evidence Collector completed the capture path
on 2026-08-30: its private ledger binds owner-approved domains and path
allowlists, bounded discovery searches, per-target retrieval attempts with
redirect lineage and robots or access outcomes, minimized snapshots with
retention limits, complete target accounting including failures, blocked pages,
and unattempted targets, baseline-bound added, removed, modified, unchanged, and
unavailable comparisons, and owner-routed materiality without deciding it. The
last candidate in this batch, `meeting-intelligence`, completed the consented
speech path on 2026-08-30: its private record binds recording authority,
per-participant consent scopes and withdrawal, exact transcript offsets with
attribution state and confidence, correction and supersession lineage,
deliberation separated from decisions with an explicit authority and agreement
basis, actions distinguished by acknowledgement rather than assignment, and a
DOCX review draft that preserves the original template and recording. That
closes the batch of entries whose state was already evidence-shaped. The
remaining entries are not ruled out: the table above still names candidate
ledgers for `content-operations`, `executive-briefing`, and others. Each one
needs a stable state object the Claw itself owns before a schema is worth
adding, which batch 3 reviews rather than assumes.

### 3. Review narrative and integration-owned contracts before adding schemas

This batch asked whether the Claw owns durable state or merely passes through
someone else's. `software-maintainer` was the first entry reviewed under that
question and the first to answer yes: the repository owns the code, but nobody
owns the delivery record, so the record became the artifact rather than a schema
for source code or prose. It binds the verbatim request and acceptance criteria,
repository identity with base and head revisions and the starting dirty state,
authorized versus protected paths, evidence provenance, changed files tied to
criteria, verification and review results bound to the exact head, finding
dispositions, residual risk, and a delivery authority that stops at what the
named owner granted. Diffs and test output stay where they belong and are
referenced, not duplicated.

`executive-assistant` answered the same question next. The calendar, the mailbox,
and the correspondence belong to other systems, but nobody owns the reviewable
state between an executive's supplied inputs and a human-controlled action. That
became the artifact: one bounded planning horizon binding the verbatim request,
the named executive and accountable support owner, a source inventory with
freshness, confidentiality, and audience scope, ranked priorities with protected
constraints, meetings whose calendar state is observed or proposed but never
mutated, decisions separated into executive-only and scoped, still-valid
delegated authority, commitments bound to an originating decision and to
acknowledgement evidence rather than assignment, unsent communication drafts
bound to the exact decision or commitment they carry, and an honest blocked,
executive-review, or execution-handoff state. Execution handoff means a human
can act; the Claw still does not.

`content-operations` then established publication readiness as the stable
Claw-owned state between an editorial brief and a human-controlled publication
action, without treating draft prose, the CMS, or analytics results as owned
state.

`executive-briefing` now owns one recurring read-only run snapshot rather than
calendar, mailbox, document, forecast, or narrative-brief state. The snapshot
binds explicit authorization and type-specific freshness to source-timestamped
agenda and meeting observations, open human-owned decision asks, proposed or
blocked preparation, bidirectional conflicts, time-bounded weather
implications, exact questions and blockers, classification and audience
inheritance, and a complete private handoff whose cron delivery remains `none`.
It deliberately omits Executive Assistant's durable horizon, delegation, and
commitment-acknowledgement lifecycle.

`knowledge-curator` now owns one bounded durable normalized collection index
rather than source documents, external wiki or search state, or the prose
handoff. The index preserves immutable source bindings, explicit metadata or
excerpt permissions, topic and navigation structure, source-linked claims,
dated human-owned decisions, exact duplicate identities and authorized
canonical pointers, unresolved dispute sides, gaps, freshness and retention
findings, transitive classification/audience/retention, and complete private
handoff coverage. Material disputes and unavailable restricted sources block
readiness. The Claw retains no source mutation, publication, communication,
access-control, retention/destruction, decision, or integration authority.

`knowledge-gardener` now owns one private deterministic change plan from one
operator-supplied, versioned, digest-bound, secret-free local Notion observation
export and authorization/scope receipt rather than page, database,
access-control, integration, or normalized collection-index state. The plan
preserves globally unique stable and canonical object identity, exact
last-edited versions and ancestry, exact exclusions, typed duplicate, stale,
conflict, link, property, and orphan evidence, issue and operation evidence
closure, proposal and approval chronology, reversible before/after/rollback
proposals, acyclic dependencies, conflict-side preservation, exact-version
operation-only human approvals, transitive controls, exact blockers and
questions, and complete private nondelivery. Application remains external; the
Claw has only workspace read, write, and edit, with no package, network, exec,
Notion API, Notion skill, source mutation, executed/applied state, or autonomous
conflict resolution.

`presentation-producer` now owns `awesomeClaws.presentationEvidenceManifest.v1`,
a durable sidecar for one exact review-copy deck path, digest, and version. The
PPTX remains primary. The manifest binds immutable authorized inputs, exact
source and template preservation, a 12-slide inventory, material claims and
audience-safe citations, two full render-review cycles with an honest fix,
content extraction, exact-version human review, transitive controls, and a
private not-delivered handoff without duplicating slide bodies or PowerPoint
runtime state.

`video-concept-producer` now owns
`awesomeClaws.videoConceptGenerationManifest.v1`, a durable contract that keeps
two desired concept plans separate from observed execution. The contract is
pinned to `@openclaw/pixverse-provider@2026.7.1` and OpenClaw `v2026.7.1`;
provider receipts contain only fields that implementation and the shared tool
expose: tool or task identity, `videoId`, terminal status, hosted URL, MIME,
optional dimensions, normalization, ignored overrides, and available
chronology. Account billing and local materialization are separate optional
provenance-backed receipts. Production readiness additionally requires
inspected source geometry, immutable human generation/cost/rights/safety
approval, exact failed-parent retry lineage, one concept and review board per
successful output, complete shot and six-discipline review coverage, and exact
principal/policy/handoff coverage. The shipped fixture is intentionally
illustrative, execution-free, and blocked; no live PixVerse or human-review
proof is claimed.

For `workflow-operator`, first identify a stable state object that the Claw
itself owns. External plugin types, source documents, code diffs, and prose
deliverables should not be duplicated merely to raise a score.

## Recommended order

Backfill contribution records alongside substantive work. For entries already
at 78-79, a retrospective record alone may move the score into Strong, but it
should capture a real distinctness decision rather than serve as score padding.
