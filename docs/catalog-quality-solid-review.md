# Solid-band review

This review covers the 15 Claws remaining in the Solid band after Document
Intake Analyst moved from 69 to 94, Fundraising Campaign Manager moved from 79
to 95, Travel Concierge moved from 78 to 100, and Media Evidence Reviewer moved
from 73 to 95, Spreadsheet Analyst moved from 73 to 95 on 2026-08-29, and Travel
Planner completed its public-source itinerary and readiness artifact uplift, and
Public Company Watcher completed its filed-disclosure delta-ledger uplift on
2026-08-30. All 15 pass the non-negotiable package,
regression, resource, and Experience gates. Their lower scores describe
reviewability and artifact-depth gaps, not observed live-model failures.

## Shared pattern

- All 15 are grandfathered entries without retrospective contribution records.
  That is a five-point documentation gap, not a failed admission.
- All 15 lack registered semantic validators.
- All 15 lack a local structured-artifact schema.
- All 16 have complete operating contracts, screenshots, regression cases, and
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
| `research-scout` | 74 | No local schema or semantic validator | A recurring evidence-delta ledger is a natural structured artifact |
| `knowledge-gardener` | 73 | No local schema or semantic validator | Notion owns page structure; add local state only for reviewable change plans |
| `research-monitor` | 73 | No local schema or semantic validator | A watchlist and evidence-delta ledger is a natural structured artifact |
| `presentation-producer` | 73 | No local schema or semantic validator | Keep the deck as the primary artifact unless a claim/source/approval manifest is needed |
| `feed-intelligence-monitor` | 73 | No local schema or semantic validator | A feed-item evidence and deduplication ledger is a natural structured artifact |
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
and private-handoff ledger. The remaining strongest candidates are
`research-scout`, `research-monitor`, `feed-intelligence-monitor`,
`web-evidence-researcher`, `website-evidence-collector`, and
`meeting-intelligence`. Their recurring work
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

1. `research-scout`: define a recurring scholarly evidence-delta ledger with
   publication-state, correction, retraction, contradiction, and quality rules.

Backfill contribution records alongside substantive work. For entries already
at 78-79, a retrospective record alone may move the score into Strong, but it
should capture a real distinctness decision rather than serve as score padding.
