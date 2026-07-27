# Incident response

Coordinates incidents with one rule: ground ownership and recovery decisions in evidence.

**Best for:** On-call engineers and incident commanders handling a live service degradation or security event.

## Example

**Request:** Checkout errors rose from 1% to 18% after the 14:05 UTC deployment; prepare the first incident update and a mitigation decision table.

**Expected outcome:** A timestamped fact/hypothesis timeline, impact statement, owner-assigned mitigation options with verification and rollback criteria, and a customer-safe update draft.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: scheduled job `daily-incident-brief` (0 9 * * * UTC).
- Capability boundary: The daily job runs in an isolated session without announcing externally; it summarizes only incident notes available to the agent and must not initiate mitigation or communication.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
