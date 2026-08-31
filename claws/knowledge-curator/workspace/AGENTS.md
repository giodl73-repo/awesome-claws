# Operating workflow

## Start here

Ask for or confirm:

- One bounded collection id, verbatim request, audience and access scope, included and excluded scope, retrieval jobs, navigation model, as-of time, positive review horizon, and named human or team maintenance owner
- Every authorized source's immutable reference, exact version or integrity id, source owner, authorization scope, owner, and validity window, observed and retrieved times, freshness cutoff and state, access state, authority and topic scope, classification, audience, known or unknown retention state, and metadata-only or validity-bounded permitted-excerpt policy
- One rooted reciprocal navigation graph plus durable claims with epistemic type, ordered dates, owner, authority, classification, audience, retention, separate support and context evidence, and current, stale, disputed, blocked, or superseded state
- Dated human-owned decisions with structured owner provenance, complete integrity-based duplicate groups, conflicting claims, structured dispute and gap resolution provenance, unavailable or restricted sources, freshness and retention findings, and review questions
- Private local output destination, complete handoff coverage, explicit prohibited actions, and any separately granted operator consent for a future external-system integration

## Included capability boundaries

- The base starter uses only authorized workspace references and content supplied for the bounded collection. It declares no enterprise search, wiki, document-system, messaging, network, package, MCP, scheduled-job, source-mutation, or access-control capability.
- Treat fixtures/knowledge-collection-index.example.json only as a shape example. Write current state to outputs/knowledge-collection-index.json, validate it against schemas/knowledge-collection-index.schema.json, and render templates/knowledge-collection-index.md without weakening evidence, blockers, or inherited handling constraints.
- When a source is stale, restricted, unavailable, missing, superseded, metadata-only, or has unknown retention, preserve its exact identity and date-free state, add the required finding and question, and block affected current claims or readiness rather than widening access, inventing content, or fabricating a retention date.
- Any future external search, wiki, document, messaging, publication, or synchronization integration is a separate operator action requiring explicit consent for the exact system, collection, permissions, representation policy, and read or write scope.

## Structured decision artifact contract

- Treat `fixtures/knowledge-collection-index.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/knowledge-collection-index.json` and check it against `schemas/knowledge-collection-index.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/knowledge-collection-index.md` at `outputs/knowledge-curator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Bound one collection, its retrieval jobs, audience, navigation model, review horizon, maintenance owner, private local destination, and no-integration authority
2. Inventory only authorized sources while preserving immutable-reference binding consistency, exact bindings, source owners, authorization validity through observation and retrieval, timestamps, access, freshness, authority, classification, audience, known or unknown retention, and representation limits
3. Create source-bound evidence records that retain exact bindings, capture only metadata or excerpts under permission valid at capture, and carry structured owner attribution when proving decisions, duplicate confirmation, or gap resolution
4. Normalize topics and one rooted reciprocal navigation graph, then record durable claims with explicit epistemic type, ordered dates, owner, authority, separate support and context evidence, handling constraints, and honest status
5. Record only dated human-owned decisions supported exclusively by relevant usable current evidence with structured authoritative owner attribution; never make or approve a decision
6. Group every repeated integrity hash without erasing identities, designate a canonical pointer only for exact source-authorized human-confirmed matches, and preserve every dispute claim with bidirectional links and complete dated resolution proof
7. Record gaps, non-current sources, known or unknown retention findings, and human-owned questions; require structured proof for every closed gap and block readiness for every material unresolved condition
8. Validate reference integrity, immutable and exact bindings, authorization and permission chronology, evidence relevance and currentness, effective periods, owner provenance, navigation reciprocity, duplicate/dispute/gap proof, transitive classification, audience and retention inheritance, exact blocker and handoff coverage, and prohibited narrative claims before rendering

## Example setting

**Request:** Turn a product launch's research, architecture decisions, runbooks, validation results, and meeting notes into a handoff collection for the incoming team lead.

**Expected outcome:** A blocked private collection index with exact source bindings, normalized launch topics, source-linked claims, dated human-owned decisions, an authorized canonical pointer that preserves both runbook identities, an unresolved architecture dispute, stale validation history, a restricted security gap, retention review, and complete owner-routed handoff coverage.

## Standard deliverables

- Private durable knowledge collection index
- Authorized immutable source and evidence ledger
- Normalized topic and navigation map
- Source-linked claim, human-owned decision, duplicate, and dispute register
- Gap, freshness, retention, blocker, and review-question register
- Complete private local owner handoff

## Done when

- The collection has one bounded id, request, audience, scope, retrieval-job set, navigation model, as-of time, positive review horizon, and named human or team maintenance owner
- Every source preserves immutable identity, one consistent exact binding, authorization valid through observation and retrieval, owner, chronology, freshness, access, authority, classification, audience, known or unknown retention, and excerpt permission valid through capture
- Every current claim and decision uses only relevant exact usable current support evidence, keeps context separate, has coherent effective periods, and binds decision ownership through structured authoritative evidence
- Every equal integrity set has one complete exact group; canonical confirmation is source-authorized, attributable, and chronologically valid; every dispute preserves each side and any resolution cites the selected and all disputed claims
- Every non-current, restricted, unavailable, expiring, expired, unknown-retention, or missing condition has a truthful finding; every closed gap has structured resolution proof; and every material unresolved condition blocks readiness
- Every navigation edge is reciprocal under one valid root, and every derived object and handoff inherits the strongest classification, narrowest audience, longest known retention, and all unknown retention policies through its cycle-safe transitive source closure
- The private local handoff covers every object exactly once, lists every and only computed blockers in blocked or ready state, grants no external integration, and makes no unsupported active or passive claim of access, action, approval, completion, publication, or source mutation

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
