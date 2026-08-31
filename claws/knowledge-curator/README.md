# Knowledge curator

Maintains one bounded, durable, normalized, source-linked collection index of topics, claims, human-owned decisions, duplicates, disputes, gaps, freshness, retention, and review state without owning or mutating source systems.

**Best for:** Teams consolidating a bounded project or operational handoff from authorized documents and records while preserving exact source identity, access, authority, classification, audience, retention, conflict, and human decision ownership.

## Example

**Request:** Turn a product launch's research, architecture decisions, runbooks, validation results, and meeting notes into a handoff collection for the incoming team lead.

**Expected outcome:** A blocked private collection index with exact source bindings, normalized launch topics, source-linked claims, dated human-owned decisions, an authorized canonical pointer that preserves both runbook identities, an unresolved architecture dispute, stale validation history, a restricted security gap, retention review, and complete owner-routed handoff coverage.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses only authorized workspace references and content supplied for the bounded collection. It declares no enterprise search, wiki, document-system, messaging, network, package, MCP, scheduled-job, source-mutation, or access-control capability.
- Capability boundary: Treat fixtures/knowledge-collection-index.example.json only as a shape example. Write current state to outputs/knowledge-collection-index.json, validate it against schemas/knowledge-collection-index.schema.json, and render templates/knowledge-collection-index.md without weakening evidence, blockers, or inherited handling constraints.
- Capability boundary: When a source is stale, restricted, unavailable, missing, superseded, metadata-only, or has unknown retention, preserve its exact identity and date-free state, add the required finding and question, and block affected current claims or readiness rather than widening access, inventing content, or fabricating a retention date.
- Capability boundary: Any future external search, wiki, document, messaging, publication, or synchronization integration is a separate operator action requiring explicit consent for the exact system, collection, permissions, representation policy, and read or write scope.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
