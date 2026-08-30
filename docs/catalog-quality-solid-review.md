# Solid-band review

This review covers the 12 Claws remaining in the Solid band after Document
Intake Analyst moved from 69 to 94, Fundraising Campaign Manager moved from 79
to 95, Travel Concierge moved from 78 to 100, and Media Evidence Reviewer moved
from 73 to 95, Spreadsheet Analyst moved from 73 to 95 on 2026-08-29, and Travel
Planner completed its public-source itinerary and readiness artifact uplift, and
Public Company Watcher completed its filed-disclosure delta-ledger uplift on
2026-08-30, and Research Scout completed its scholarly evidence-delta ledger
uplift on 2026-08-29, and Research Monitor completed its approved-source
topic-watch delta ledger uplift on 2026-08-30, and Feed Intelligence Monitor
completed its feed-item delta and triage ledger uplift on 2026-08-30. All 12
remaining entries pass the
non-negotiable package, regression, resource, and Experience gates. Their lower scores describe
reviewability and artifact-depth gaps, not observed live-model failures.

## Shared pattern

- All 12 remaining entries are grandfathered without retrospective contribution records.
  That is a five-point documentation gap, not a failed admission.
- All 12 remaining entries lack registered semantic validators.
- All 12 remaining entries lack a local structured-artifact schema.
- All 12 have complete operating contracts, screenshots, regression cases, and
  active maintenance.

## Current entries

| Claw | Score | Evidence / verification gap | Review |
| --- | ---: | --- | --- |
| `workflow-operator` | 79 | No local schema or semantic validator | Lobster owns typed workflow state; avoid duplicating its contract without a concrete handoff need |
| `video-concept-producer` | 79 | No local schema or semantic validator | A concept/shot/evidence manifest may help, but only if it governs the generated asset |
| `website-evidence-collector` | 79 | No local schema or semantic validator | A collection ledger can add source, freshness, extraction, and failure invariants beyond plugin types |
| `web-evidence-researcher` | 79 | No local schema or semantic validator | A research-evidence ledger can add claim/source and freshness guarantees beyond plugin types |
| `software-maintainer` | 78 | No local schema or semantic validator | Prefer code/test/diff evidence unless a stable change-plan artifact proves useful |
| `knowledge-curator` | 78 | No local schema or semantic validator | Keep narrative knowledge structure unless a durable index contract emerges |
| `content-operations` | 78 | No local schema or semantic validator | A claim/approval ledger could help; avoid schema for prose itself |
| `knowledge-gardener` | 73 | No local schema or semantic validator | Notion owns page structure; add local state only for reviewable change plans |
| `presentation-producer` | 73 | No local schema or semantic validator | Keep the deck as the primary artifact unless a claim/source/approval manifest is needed |
| `meeting-intelligence` | 73 | No local schema or semantic validator | A consented transcript/action/decision ledger can add durable invariants |
| `executive-briefing` | 73 | No local schema or semantic validator | A source/freshness/priority ledger may help, but the briefing remains narrative |
| `executive-assistant` | 73 | No local schema or semantic validator | Prefer a narrow commitment/approval ledger over schematizing correspondence |

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
ledger. The remaining strongest candidates are `web-evidence-researcher`,
`website-evidence-collector`, and `meeting-intelligence`. Their recurring work
already depends on source identity, freshness, lineage, chronology, confidence,
or consent that JSON Schema plus semantic checks can enforce.

### 3. Review narrative and integration-owned contracts before adding schemas

For `software-maintainer`, `content-operations`, `executive-assistant`,
`executive-briefing`, `knowledge-curator`, `knowledge-gardener`,
`presentation-producer`, `video-concept-producer`, and `workflow-operator`,
first identify a stable state object that the Claw itself owns. External plugin
types, source documents, code diffs, and prose deliverables should not be
duplicated merely to raise a score.

## Recommended order

1. `web-evidence-researcher`: identify a durable claim and source reconciliation
   object that remains distinct from recurring feeds, scholarly evidence, and
   website capture.

Backfill contribution records alongside substantive work. For entries already
at 78-79, a retrospective record alone may move the score into Strong, but it
should capture a real distinctness decision rather than serve as score padding.
