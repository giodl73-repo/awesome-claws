# Knowledge collection index contract

Knowledge Curator owns one durable, normalized, source-linked collection index
for a bounded curation scope. Source documents, external wiki or search state,
access controls, and the narrative handoff remain outside the owned state. The
index is useful because it records what can be found, which exact evidence
supports it, what cannot be represented, what conflicts, and what a human must
review without mutating any source.

The artifact uses `awesomeClaws.knowledgeCollectionIndex.v1`. One collection
records the request, audience, included and excluded scope, retrieval jobs,
navigation model, as-of time, a positive review horizon, status, and a named
human or team maintenance owner. The JSON index is the durable state; the
Markdown handoff is a complete review view, not an independent authority.

## Source and evidence truth

Every authorized source retains a distinct identity, immutable reference, exact
version or integrity binding, source owner, authorization scope and owner,
authorization validity window, observation and retrieval chronology, freshness
cutoff and state, access state, authority and topic scope, classification,
audience, and human-controlled retention state. Authorization must be valid
before and throughout observation and retrieval. One immutable reference may be
reused only for records with one identical sha256 binding represented together
in an exact duplicate group. Unavailable and restricted sources remain in the
index. The collection never claims that it accessed content it could not
retrieve.

Evidence repeats the exact source binding and topic relevance. Metadata-only
records contain no excerpt. Excerpts are allowed only when the source policy
explicitly permits one, the permission is valid before and throughout capture,
the evidence audience is within the permitted audience, and the excerpt stays
within the recorded length. Every support reference on a current claim or
decision must independently be current, content-bearing, usable, and relevant;
stale or metadata-only context belongs in `contextEvidenceRefs`. Structured
owner attribution, never prose inference, binds authoritative evidence to a
decision owner, duplicate confirmer, or gap resolver.

## Normalized knowledge graph

Topics and navigation nodes normalize discovery without becoming source
documents. Durable claims record epistemic type, dates, owner, authority, and
current, stale, disputed, blocked, or superseded status. Decisions are historical
records of a dated human or team decision supported by current authoritative
evidence. The Claw cannot make, approve, finalize, or supersede a decision.
Current claims and decisions must already be effective and unexpired at
collection as-of. Every effective and expiry range is ordered; decision
effective dates cannot exceed the review horizon.

All ids are globally unique and every reference resolves. Parent, child, claim,
decision, dispute, finding, and handoff links form one graph. The validator
requires exactly one navigation root, reciprocal parent/child links, complete
root reachability, and no navigation cycles. It walks the wider reference graph
with an explicit visited set and calculates the source closure without hanging
or accepting a one-way edge that weakens constraints. Every object must inherit
at least the strongest
classification, no broader than the intersection of every referenced audience,
and every transitive source retention policy through the maximum retain-until
date. Unknown source retention uses an explicit `unknown` state and a null date;
derived objects preserve the policy in `unknownPolicyRefs` instead of
fabricating a date. A reference chain cannot launder confidentiality, audience,
or retention.

## Duplicates, disputes, and readiness

Duplicate groups preserve every source identity and version. A canonical pointer
is valid only for exact duplicates with equal sha256 integrity bindings and
current source-authorized human or team confirmation backed by attributable,
authoritative review-record evidence. Confirmation cannot predate the evidence
observation, capture, or effective time and cannot postdate collection as-of.
Every repeated integrity hash is represented by exactly one complete exact
group. Version equality alone is never exact duplicate proof. Possible
duplicates and version families never receive a canonical pointer.

Disputes retain every side as a separately sourced claim, including source
authority, dates, and immutable binding. Claim and dispute links are
bidirectional. Greater authority is visible but does not silently erase a
conflict. A material unresolved dispute blocks readiness. Resolution requires a
dated human-owned decision that cites the selected claim and every dispute
claim, carries current authoritative evidence, follows the decision effective
and evidence times, and keeps all original claims and bidirectional links in the
index.

Every non-current source has a matching freshness finding. Restricted or
unavailable material sources have explicit gaps. Expiring, expired, or unknown
retention constraints remain human-review findings. Open material gaps,
freshness findings, disputes, blocking questions, blocked claims, and affected
decisions appear in the handoff blocker set. A handoff covers every collection
object exactly once. A closed gap requires structured provenance to a current
human-owned decision and attributable authoritative resolution evidence after
their effective/capture times. Material unresolved gaps always block readiness.
In both blocked and ready states, `blockerRefs` equals the computed blocker set
exactly; a ready handoff has none.

## Authority and output boundary

The artifact and handoff remain private local workspace outputs. The required
authority gates prohibit broadening access, copying unpermitted content,
deleting or mutating sources, publication, external communication, access-
control changes, autonomous retention or destruction, claims of completion or
access, decision approval, and external-system integration. Any future wiki,
search, messaging, publication, or document-system integration is a separate
operator action requiring explicit consent for the exact system, collection,
and scope.

Narrative fields are scanned for unnegated first-person, Claw, or passive claims
that those actions happened or will happen, including collection, source
system, wiki, repository, access, and retention deletion or mutation language.
Questions that route a choice to a named human or team and clearly labeled
future owner proposals remain allowed.
