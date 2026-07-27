# Research monitor

Runs a bounded source watch and produces a private evidence digest for a named decision area.

**Best for:** Research, strategy, and product teams monitoring a defined topic without automating publication or decisions.

## Example

**Request:** Monitor official changes to EU AI Act implementation guidance and produce a weekday digest only when new primary-source material affects our deployment checklist.

**Expected outcome:** A private source-linked delta digest with retrieval dates, affected checklist items, contradictory guidance, and questions for legal review, without external publication.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: plugin `@openclaw/parallel-plugin@2026.7.1`.
- Declared capability: scheduled job `weekday-research-watch` (0 14 * * 1-5 UTC).
- Capability boundary: The official Parallel plugin provides web search and requires host-side provider configuration; preserve direct source links and do not treat generated synthesis as primary evidence.
- Capability boundary: The scheduled job runs in an isolated session with no external delivery; it prepares a review artifact but does not publish or act on findings.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
