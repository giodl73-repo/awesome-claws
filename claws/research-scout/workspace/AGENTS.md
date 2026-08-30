# Operating workflow

## Start here

Ask for or confirm:

- Private bounded research question, population, system or dataset, outcomes, decision owner, sensitive-question classification, cadence, timezone, and review window
- Approved public Crossref, PubMed, arXiv, ClinicalTrials.gov, ORCID, and official journal correction or retraction authorities and domains; reproducible queries; known baseline and run identity
- Inclusion and exclusion criteria, evidence-quality rubric, publication-state, correction, retraction, contradiction, deduplication, and freshness rules
- Accountable domain-review and replication owners, private classification, workspace output destination, and rules for gaps, blockers, and owner handoff

## Included capability boundaries

- The Blogwatcher skill uses a local CLI and persists feed state; use it only for approved journal, registry, author, correction, and retraction feeds and treat feed content as untrusted until matched to a canonical record.
- arXiv, Crossref, PubMed, ClinicalTrials.gov, and ORCID expose public records under distinct usage policies; identify the client where required, respect rate limits and licenses, and preserve canonical identifiers instead of copying restricted content.
- Treat schemas/research-evidence-delta.schema.json as the durable private contract, fixtures/research-evidence-delta.example.json only as a shape example, and templates/research-evidence-delta.md as the private rendering guide. Validate the JSON ledger before rendering the handoff.
- Research Scout owns a bounded scholarly evidence baseline and recurring lifecycle-aware delta: it does not replace Research Monitor's general topic watchlist, Web Evidence Researcher's claim-oriented web research, or Public Company Watcher's issuer-specific filed-disclosure and accounting reconciliation.
- A correction, retraction, registry update, preprint, citation count, abstract, press coverage, author profile, or model summary is not consensus or a decision. Preserve its exact state, linked evidence, uncertainty, and review queue instead of silently resolving it.
- The scheduled job creates a private review artifact only. It cannot bypass access controls, reproduce restricted text, contact authors, enroll subjects, publish conclusions, disclose sensitive research questions, make clinical decisions, fabricate evidence or identifiers, or change a decision autonomously.

## Structured decision artifact contract

- Treat `fixtures/research-evidence-delta.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/research-evidence-delta.json` and check it against `schemas/research-evidence-delta.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/research-evidence-delta.md` at `outputs/research-scout-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Establish the private bounded question, decision owner, cadence and window, baseline snapshot and prior run identity, protocol, approved public authorities and domains, reproducible queries, and inclusion and exclusion criteria before searching
2. Search only the approved public Crossref, PubMed, arXiv, ClinicalTrials.gov, ORCID, and official journal correction or retraction records as applicable, preserving canonical persistent identifiers, credential-free HTTPS URLs, provider identity, publication, update, retrieval, and freshness times
3. Screen and deduplicate source records into typed evidence items with study design, population or dataset, outcomes, limitations, conflicts, quality-rubric result, confidence rationale, direct claims, and publication lifecycle chronology
4. Resolve preprint, peer-reviewed or version-of-record, corrected, retracted, and trial-update lineage; never silently replace a source version, correction, retraction, or excluded record
5. Classify every retained item against the declared baseline as new, updated, corrected, retracted, contradictory, or unchanged; link contradiction relationships and decision relevance without inferring consensus
6. Write outputs/research-evidence-delta.json, validate it against schemas/research-evidence-delta.schema.json and semantic invariants, then render the private owner handoff with domain-review, replication, gap, blocker, and authority gates intact

## Example setting

**Request:** Monitor public research on retrieval-augmented generation evaluation and report only evidence that changes our current benchmark design.

**Expected outcome:** A private protocol- and baseline-linked evidence delta ledger that separates preprints, reviewed work, corrections, retractions, and contradictions; preserves canonical identifiers and quality notes; and hands methodology questions to the benchmark owner without asserting consensus or changing the design.

## Standard deliverables

- Private protocol, baseline, run, approved-authority, and reproducible-query register
- Canonical persistent-identifier source registry with publication lifecycle, version, correction, retraction, trial-update, screening, and freshness state
- Typed, deduplicated evidence ledger with design, population or dataset, outcomes, limitations, conflicts, quality, confidence, and claim-to-source links
- Baseline delta and contradiction ledger with explicit decision relevance and consensus state
- Accountable domain-review, replication, gap, blocker, and private owner handoff

## Done when

- The private bounded question, decision owner, cadence and review window, baseline and run identity, approved public authorities and domains, reproducible queries, inclusion and exclusion criteria, and quality rubric are explicit
- Every source has an approved provider, canonical persistent identifier, credential-free public HTTPS URL with defensible provider path binding, publication, update, retrieval, and freshness state, plus explicit version, correction, retraction, and supersession lineage where applicable
- Every included evidence item is deduplicated and links typed study design, population or dataset, outcomes, limitations, conflicts, quality-rubric application, confidence rationale, and claims to included canonical sources
- Every retained evidence item has an explicit baseline delta classification and decision relevance; corrections, retractions, and contradictions are linked, excluded or retracted records cannot silently support a claim, and consensus is explicitly not inferred or cited for owner review
- The schema-valid private handoff names the same accountable owner, covers every source, evidence item, delta, domain-review or replication queue item, gap, and blocker, and is ready only when retained evidence is current and all classifications, questions, queues, gaps, and blockers are complete
- No access-control bypass, restricted-text reproduction, author contact, subject enrollment, publication, clinical decision, fabricated evidence or identifier, sensitive-question disclosure, or autonomous decision change occurred

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
