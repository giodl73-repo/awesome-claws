# Knowledge collection index handoff

## Collection boundary

Record the collection id, verbatim request, audience, included and excluded
scope, retrieval jobs, navigation model, as-of time, positive review horizon,
status, and named human or team maintenance owner.

## Authorized source index

List every source identity separately. Preserve its immutable reference, exact
version or integrity binding, source owner, authorization scope and validity
window, observation and retrieval chronology, freshness cutoff and state,
access state, authority and topic scope, classification, audience, known or
unknown retention state, and whether the collection may retain metadata only or
an explicitly permitted excerpt. Authorization must be valid before observation
and throughout retrieval. Repeated immutable references must use one identical
sha256 binding and one exact duplicate group.

Do not reproduce restricted content when the representation policy permits only
metadata. A permitted excerpt must retain its exact source binding, permission,
permission validity window, audience, length limit, and capture time. Permission
must be valid before and throughout capture.

## Topics and navigation

Render normalized topics and one rooted, acyclic navigation tree without
changing the sources. Keep parent/child links reciprocal and every source and
object reference visible. Preserve the strongest classification, narrowest
audience, longest known retention constraint, and every unknown retention policy
through the complete reference chain.

## Durable claims

For each claim, show its epistemic type, statement, recorded and effective
dates, expiry, human or team owner, authority status, current/stale/disputed/
blocked/superseded state, topics, exact evidence, and inherited handling
constraints. Metadata-only, stale, unknown, unavailable, or irrelevant evidence
must not be presented as current content support or hidden beside one usable
support ref. Put non-supporting history in `contextEvidenceRefs`. Current and
disputed claims must already be effective and unexpired at collection as-of.

## Human-owned decisions

Record only decisions already made by the named human or team in authoritative,
current source evidence with structured `decision-owner` attribution. Show the
decision date, ordered effective period, claims, support and context evidence,
dispute state, and owner. Current decisions must already be effective and
unexpired; no decision may exceed the review horizon. Knowledge Curator does not
make, approve, finalize, or supersede decisions.

## Duplicates and versions

Preserve every source identity and version. Show possible, related, version-
family, and exact groups separately. Every repeated sha256 hash belongs to one
complete exact group; version equality is insufficient. Add a canonical pointer
only when equal integrity is proven and a source-authorized human or team has
explicitly confirmed it in attributable authoritative review evidence at or
before collection as-of; never delete, replace, or hide the other records.

## Disputes

Show every conflicting claim with its own source, authority, date, version, and
owner. Keep claim-to-dispute links bidirectional. A material unresolved dispute
blocks readiness even when one source has greater authority. A resolution must
select one dispute claim, cite every dispute claim in the resolving decision,
follow that decision's effective and evidence times, and preserve all links.

## Gaps, freshness, retention, and questions

List missing or restricted sources, coverage and authority gaps, every
non-current source, expiring, expired, or explicitly unknown retention
constraint, affected objects, materiality, and exact questions for named human
or team owners. Unknown retention uses a null date and a required finding rather
than a fabricated date. A resolved gap must include its human resolver, time,
current decision, and attributable authoritative evidence. Do not widen access,
infer unavailable content, or decide retention or destruction.

## Handoff

Cover every source, evidence item, topic, navigation node, claim, decision,
duplicate group, dispute, gap, freshness finding, retention finding, and review
question exactly once. A blocked handoff must enumerate every material unresolved
item. In every state, blocker refs must equal the computed blocker set exactly;
`ready-for-review` has none and means only that the private local artifact is
complete for human review.

Keep `outputs/knowledge-collection-index.json` and
`outputs/knowledge-curator-handoff.md` private and local. External wiki, search,
messaging, publishing, document, or access-control integration requires a future
operator action and explicit consent for the exact system, collection, and
scope. Do not write passive completion claims about collection publication or
source, wiki, repository, access, or retention mutation. Owner-directed
questions and clearly proposed future owner actions remain review material, not
completed actions.
