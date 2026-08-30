# Topic watch delta ledger handoff

Render this template only from an artifact that validates against
`schemas/topic-watch-delta-ledger.schema.json`. Keep the artifact and rendered
handoff private at the declared workspace destination.

## Watch control

- Watch, baseline, and current run IDs:
- Private topic classification and approved query-disclosure rule:
- Named decision owner:
- Cadence, timezone, review window, and as-of time:
- Private output classification and destination:
- State: draft / blocked / ready:

State the bounded topic and every watch question. Show the approved authorities,
domains, purposes, reproducible query definitions, execution times, and result
source records. An empty result list means an explicit zero-result query; it
does not authorize a broader search or a query sent to an unapproved service.

## Approved source registry and lineage

For every source, show its approved authority, provider, record type, canonical
identity, credential-free public HTTPS URL, title, publication, update, and
retrieval times, digest, freshness, and scope. Explain source supersession,
correction, and withdrawal lineage without silently replacing the earlier
record.

Use only the named approved public domains. A reachable link, search ranking,
or secondary summary does not make a source authoritative. Do not copy
restricted content, credentials, fragments, sensitive query text, or private
network references into the ledger.

## Typed observations and claims

For every observation, show its deduplication key, type, source records,
current, corrected, or withdrawn status, summary, confidence, uncertainty,
topic relevance, decision relevance, and owner priority threshold.

For every claim, show its type, exact supporting observation source records,
support status, confidence, and uncertainty. A correction or withdrawal
qualifies or removes support; it does not become a silent current conclusion.
Do not infer consensus or causality from a count, a source change, or matching
language.

## Baseline-to-run delta ledger

For each retained delta, show the classification (`new`, `changed`,
`corrected`, `withdrawn`, `contradictory`, or `unchanged`), current and
baseline observations, contradicted or superseded delta lineage, summary, and
decision-relevance rationale.

Every current and baseline observation must be covered. A contradiction is an
explicit owner question, not a vote, resolved policy, or autonomous action.

## Owner review, gaps, and blockers

Show the declared priority policy and thresholds. List every priority,
reconciliation, contradiction, or decision review question with its owner,
observation and delta links, status, and resolution. List each gap and blocker
with its linked records, owner, and state.

A ready handoff requires current retained sources, complete baseline and delta
coverage, resolved required owner reviews and gaps, and no open blocker. It is
ready for review only; it does not change a decision or action.

## Private owner handoff and authority gates

Repeat the named owner, private classification, destination, every source,
observation, delta, review, gap, blocker, and prohibited-action reference.

Do not bypass access controls, reproduce restricted content, publish or contact
externally, subscribe or change accounts, disclose credentials or sensitive
queries, fabricate sources or claims, or change decisions or actions
autonomously. Those actions remain with authorized people outside this
artifact.
