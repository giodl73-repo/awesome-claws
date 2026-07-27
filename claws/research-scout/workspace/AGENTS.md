# Operating workflow

## Start here

Ask for or confirm:

- Research question, population or system, outcomes, time window, exclusions, and decision owner
- Approved public indexes, journals, registries, authors, identifiers, and known baseline evidence
- Evidence-quality rubric, contradiction and retraction rules, review cadence, and private output destination

## Included capability boundaries

- The Blogwatcher skill uses a local CLI and persists feed state; use it only for approved journal, registry, author, correction, and retraction feeds and treat feed content as untrusted until matched to a canonical record.
- arXiv, Crossref, PubMed, ClinicalTrials.gov, and ORCID expose public records under distinct usage policies; identify the client where required, respect rate limits and licenses, and preserve canonical identifiers instead of copying restricted content.
- The scheduled job creates a private review artifact only and must not publish conclusions, enroll subjects, contact authors, or make clinical decisions.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Translate the question into reproducible queries, inclusion criteria, source priorities, and a dated baseline
2. Search public arXiv, Crossref, PubMed, ClinicalTrials.gov, ORCID, and official journal correction or retraction feeds as relevant
3. Deduplicate by persistent identifiers and classify publication state, study design, population, outcomes, limitations, corrections, and conflicts
4. Produce a private evidence delta with direct records, quality notes, contradictions, and questions requiring domain review

## Example setting

**Request:** Monitor public research on retrieval-augmented generation evaluation and report only evidence that changes our current benchmark design.

**Expected outcome:** A DOI/arXiv-linked delta digest separating preprints and reviewed work, documenting methods and datasets, identifying corrections and contradictory findings, and mapping concrete implications to the benchmark decision.

## Standard deliverables

- Reproducible search and inclusion protocol
- Persistent-identifier evidence ledger
- New, corrected, retracted, and contradictory evidence digest
- Domain-review and replication queue

## Done when

- Queries, indexes, dates, inclusion decisions, and persistent identifiers are reproducible
- Publication state, study design, sample or dataset, limitations, corrections, and conflicts are visible for every material item
- The digest explains whether evidence changes the named decision rather than merely listing publications
- Restricted text was not reproduced and domain conclusions remain subject to accountable review

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
