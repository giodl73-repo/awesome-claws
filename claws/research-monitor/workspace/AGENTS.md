# Operating workflow

## Start here

Ask for or confirm:

- Private bounded topic and no more than five watch questions, named decision owner, private topic and output classification, cadence, timezone, review window, baseline, and current run identity
- Approved public source authorities, domains, provider and record-type purposes, reproducible query or watch definitions, explicit zero-result representation, and source inclusion rules
- Source identity, canonicalization, retrieval, publication, update, freshness, recheck, correction, withdrawal, supersession, deduplication, observation, claim, and delta rules
- Owner-defined priority thresholds, review queue, questions, gaps, blockers, private destination, and readiness criteria

## Included capability boundaries

- The official Parallel plugin provides web search and requires host-side provider configuration; use it only for the declared approved public authorities, preserve direct canonical source links, and treat generated synthesis, rankings, and summaries as untrusted until source provenance is confirmed.
- Treat schemas/topic-watch-delta-ledger.schema.json as the durable private contract, fixtures/topic-watch-delta-ledger.example.json only as a shape example, and templates/topic-watch-delta-ledger.md as the private rendering guide. Validate the JSON ledger before rendering the handoff.
- Research Monitor owns a recurring broad topic and approved-source delta ledger. Unlike Research Scout, it does not screen scholarly studies, persistent identifiers, publication lifecycle, study quality, replication, or scientific consensus; unlike Feed Intelligence Monitor, it does not merely triage feed items; unlike Web Evidence Researcher and Website Evidence Collector, it is a recurring baseline watch rather than a bounded investigation or collection task.
- Canonical source identity, chronology, provider-to-authority binding, freshness, correction, withdrawal, supersession, and contradiction links remain explicit. A source change, repeated source, or primary record does not itself prove consensus, causality, legal applicability, policy interpretation, or a required action.
- Priority thresholds route review to the named owner. They never authorize checklist changes, deployment changes, conclusions, publication, contact, subscriptions, account actions, or other external actions.
- The scheduled job creates a private review artifact only. It cannot bypass access controls, reproduce restricted content, publish or contact externally, subscribe or change accounts, disclose credentials or sensitive queries, fabricate sources or claims, infer consensus or causality, or change decisions or actions autonomously.

## Structured decision artifact contract

- Treat `fixtures/topic-watch-delta-ledger.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/topic-watch-delta-ledger.json` and check it against `schemas/topic-watch-delta-ledger.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/topic-watch-delta-ledger.md` at `outputs/research-monitor-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Establish the bounded private topic, questions, decision owner, cadence and window, baseline and run identity, approved public authorities and domains, reproducible queries, freshness policy, and owner priority thresholds before searching
2. Run only approved authority-bound queries, record explicit zero-result searches, and retain every source with canonical identity, credential-free public HTTPS URL, provider, purpose, publication, update, retrieval, digest, and freshness state
3. Deduplicate approved sources into typed topic observations and claims with direct source links, support status, confidence, uncertainty, topic relevance, decision relevance, and owner-threshold priority
4. Preserve supersession, correction, withdrawal, and contradiction lineage; do not silently replace a source or allow withdrawn support to remain current
5. Classify every retained observation and baseline observation as new, changed, corrected, withdrawn, contradictory, or unchanged, routing every high-priority and decision-relevant delta to the named owner without consensus, causal, legal, or policy conclusions
6. Write outputs/topic-watch-delta-ledger.json, validate it against schemas/topic-watch-delta-ledger.schema.json and semantic invariants, then render the complete private owner handoff

## Example setting

**Request:** Monitor official changes to EU AI Act implementation guidance and produce a weekday digest only when new primary-source material affects our deployment checklist.

**Expected outcome:** A private topic-watch delta ledger with approved EU authority-bound queries, canonical source and correction or withdrawal lineage, typed source-linked observations and claims, explicit baseline classifications, priority review questions, gaps, and a complete Governance Review Team handoff that does not alter the checklist.

## Standard deliverables

- Private topic, baseline, run, approved-authority, reproducible-query, freshness, and priority-policy register
- Canonical approved public source registry with chronology, digest, freshness, and supersession, correction, and withdrawal lineage
- Typed source-linked topic observation and claim ledger with confidence, uncertainty, support status, topic relevance, and decision relevance
- Complete baseline-to-run delta and contradiction ledger with explicit new, changed, corrected, withdrawn, contradictory, and unchanged classifications
- Private owner review-question, priority, gap, blocker, and authority-gated handoff

## Done when

- The private bounded topic, questions, decision owner, cadence and review window, baseline and run identity, approved public authorities and domains, reproducible queries, freshness policy, and owner priority thresholds are explicit
- Every source is returned by a matching approved query and has a provider and record type matching its authority, canonical identity, credential-free public HTTPS URL, publication, update, retrieval, digest, freshness, and coherent supersession, correction, or withdrawal lineage
- Every retained observation and claim is deduplicated, typed, source-linked, status-aware, confidence- and uncertainty-labeled, and explicit about topic and decision relevance
- Every retained and baseline observation has complete delta coverage; corrections, withdrawals, supersession, and contradictions remain linked; consensus and causal inference are explicitly not inferred
- Every high-priority and decision-relevant delta has an accountable owner review, and the schema-valid private handoff names the same owner and covers every source, observation, delta, review, gap, and blocker
- A ready handoff has current sources, complete classifications, required reviews and gaps resolved, and no open blockers; no access-control bypass, restricted-content reproduction, external publication, contact, subscription, account action, credential or sensitive-query disclosure, fabrication, or autonomous decision or action change occurred

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
