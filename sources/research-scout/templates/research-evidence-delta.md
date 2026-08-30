# Research evidence delta handoff

Render this template only from an artifact that validates against
`schemas/research-evidence-delta.schema.json`. Keep the artifact and rendered
handoff private at the declared workspace destination.

## Watch control and protocol

- Watch and current run IDs:
- Private research question classification and approved query-disclosure rule:
- Accountable decision owner:
- Cadence, timezone, review window, and as-of time:
- Baseline ID, baseline run ID, as-of time, and digest:
- Current run start, completion, and as-of time:
- State: draft / blocked / ready:

Show the inclusion and exclusion criteria, named evidence-quality rubric and
dimensions, and every reproducible query with its approved public authority,
execution time, and result records. Do not broaden the question or send a
sensitive question outside the explicitly approved public authorities.

## Approved public authority and source registry

For every authority, list the provider, approved public domains, and purpose.
For every retrieved source, show its authority, provider, source type, canonical
persistent identifier, credential-free HTTPS canonical URL, title, publication,
update, and retrieval times, publication state, version, digest, freshness,
screening decision, and screening rationale.

Preserve DOI/Crossref, PMID/PubMed, arXiv, NCT/ClinicalTrials.gov, ORCID, and
official journal correction or retraction identities as applicable. A source
must not be treated as authority merely because a link resolves, and excluded
records must not support an evidence item.

## Lifecycle, version, correction, and retraction lineage

List every superseded record, correction target, and retraction target. For each
evidence item, render a chronological lifecycle showing preprint, peer-reviewed
or version-of-record, corrected, retracted, and trial-update state when present.
Never silently combine versions, hide a correction or retraction, or reuse a
withdrawn record as current support.

## Typed evidence ledger

For each evidence item, show:

- Deduplication key and all canonical persistent identifiers.
- Source records, study type and design, population or dataset, and reported outcomes.
- Limitations and declared, absent, or unknown conflicts.
- Evidence-quality rubric result and rationale.
- Confidence result and rationale.
- Every claim with its direct source links.

Keep preprints, registry updates, author records, and reviewed work visibly
distinct. Record evidence and uncertainty; do not infer consensus from counts,
citations, abstracts, press coverage, or a model summary.

## Baseline delta and contradictions

For every delta, show its classification (`new`, `updated`, `corrected`,
`retracted`, `contradictory`, or retained `unchanged`), current evidence items,
baseline evidence items, any contradicted deltas, summary, decision-relevance
state, and rationale.

A contradiction is a linked question for review, not a vote or a resolved
scientific conclusion. The consensus state must explicitly say either
`not-inferred` or `reviewed-with-cited-evidence`; the latter cites its evidence
items and remains subject to the named owner’s review.

## Domain-review, replication, gaps, and blockers

List every domain-review, replication, methodology, or decision queue item with
the accountable owner, linked evidence and deltas, status, and resolution. List
all gaps and blockers with their owner and linked source, evidence, and delta
records. A ready handoff has current sources, complete classification and
references, resolved queues and gaps, no open blocker, and no unresolved
decision relevance.

## Private owner handoff

Repeat the accountable decision owner, private classification, output
destination, all source, evidence, delta, queue, gap, and blocker references,
and every blocked authority. The handoff is ready for owner review, not a
decision change, publication, or clinical determination.

## Authority gates

Do not bypass access controls or reproduce restricted text; do not contact
authors; do not enroll subjects; do not publish conclusions; do not make
clinical decisions; do not fabricate evidence or identifiers; do not disclose a
sensitive research question; and do not change a decision autonomously. Those
actions remain with authorized people outside this artifact.
