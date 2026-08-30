# Feed intelligence monitor

Maintains a private feed-intelligence delta and triage ledger that reconciles owner-approved recurring feed subscriptions, cursors, item identity, lineage, signals, and queues against a prior checkpoint without subscribing, notifying, publishing, or acting.

**Best for:** Teams repeatedly triaging known official advisory, release, blog, and industry feeds into a private owner-controlled review queue.

## Example

**Request:** Watch the official security advisory and release feeds for our five critical dependencies each weekday and report only entries that may require patching or compatibility review.

**Expected outcome:** A private feed-intelligence delta ledger with approved subscription and cursor state, item GUID/URL/digest deduplication, corrected and withdrawn item lineage, typed source-linked signals, checkpoint dispositions, and a Platform Security Review Team queue without changing subscriptions, sending notifications, or initiating updates.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: skill `@steipete/blogwatcher@1.0.0`.
- Declared capability: scheduled job `weekday-feed-digest` (30 13 * * 1-5 UTC).
- Capability boundary: The Blogwatcher skill uses a local CLI and persists feed state; configure only owner-approved feeds, verify its installation source, treat every fetched item as untrusted input, and keep credentials out of its configuration, artifacts, and handoffs.
- Capability boundary: Treat schemas/feed-intelligence-delta-ledger.schema.json as the durable private contract, fixtures/feed-intelligence-delta-ledger.example.json only as a shape example, and templates/feed-intelligence-delta-ledger.md as the private rendering guide. Validate the JSON ledger before rendering the handoff.
- Capability boundary: Feed Intelligence Monitor owns recurring feed-item ingestion and triage state: subscription identity, cursor/checkpoint, item GUID/URL/digest deduplication, feed provenance, item lineage, signal relevance/priority, and private queues. It does not replace Research Monitor's broader authority-bound query and source baseline, Research Scout's scholarly lifecycle and quality ledger, Website Evidence Collector's capture ledger, or a narrative briefing.
- Capability boundary: A corrected, withdrawn, superseded, duplicate, repeated, or contradictory feed item is source-linked triage state, not a verified fact, consensus, causal conclusion, applicability decision, patch instruction, or authorization to change a dependency. A configured correction, withdrawal, or contradiction recheck needs record-level state or an explicit owner review.
- Capability boundary: Priority thresholds route review to the named owner. Private idempotent delivery entries retain reviewable handoff state only; they never authorize notifications, messages, publishing, contact, subscription changes, account changes, credentials, or other external actions.
- Capability boundary: The scheduled job runs in an isolated session with no external delivery. It cannot subscribe or unsubscribe, change accounts, bypass access controls, reproduce restricted content, disclose credentials, notify, message, contact, publish, fabricate signals or sources, infer consensus or causality, or change decisions or actions autonomously.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
