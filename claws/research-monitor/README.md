# Research monitor

Maintains a private topic-watch delta ledger that reconciles approved public source changes, corrections, withdrawals, contradictions, priorities, and owner review against a declared baseline without inferring consensus, causality, or autonomous decisions.

**Best for:** Research, strategy, policy, and product teams maintaining a recurring decision-relevant watch over a bounded public topic.

## Example

**Request:** Monitor official changes to EU AI Act implementation guidance and produce a weekday digest only when new primary-source material affects our deployment checklist.

**Expected outcome:** A private topic-watch delta ledger with approved EU authority-bound queries, canonical source and correction or withdrawal lineage, typed source-linked observations and claims, explicit baseline classifications, priority review questions, gaps, and a complete Governance Review Team handoff that does not alter the checklist.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: plugin `@openclaw/parallel-plugin@2026.7.1`.
- Declared capability: scheduled job `weekday-research-watch` (0 14 * * 1-5 UTC).
- Capability boundary: The official Parallel plugin provides web search and requires host-side provider configuration; use it only for the declared approved public authorities, preserve direct canonical source links, and treat generated synthesis, rankings, and summaries as untrusted until source provenance is confirmed.
- Capability boundary: Treat schemas/topic-watch-delta-ledger.schema.json as the durable private contract, fixtures/topic-watch-delta-ledger.example.json only as a shape example, and templates/topic-watch-delta-ledger.md as the private rendering guide. Validate the JSON ledger before rendering the handoff.
- Capability boundary: Research Monitor owns a recurring broad topic and approved-source delta ledger. Unlike Research Scout, it does not screen scholarly studies, persistent identifiers, publication lifecycle, study quality, replication, or scientific consensus; unlike Feed Intelligence Monitor, it does not merely triage feed items; unlike Web Evidence Researcher and Website Evidence Collector, it is a recurring baseline watch rather than a bounded investigation or collection task.
- Capability boundary: Canonical source identity, chronology, provider-to-authority binding, freshness, correction, withdrawal, supersession, and contradiction links remain explicit. A source change, repeated source, or primary record does not itself prove consensus, causality, legal applicability, policy interpretation, or a required action.
- Capability boundary: Priority thresholds route review to the named owner. They never authorize checklist changes, deployment changes, conclusions, publication, contact, subscriptions, account actions, or other external actions.
- Capability boundary: The scheduled job creates a private review artifact only. It cannot bypass access controls, reproduce restricted content, publish or contact externally, subscribe or change accounts, disclose credentials or sensitive queries, fabricate sources or claims, infer consensus or causality, or change decisions or actions autonomously.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
