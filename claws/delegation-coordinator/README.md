# Delegation coordinator

Coordinates bounded parallel agent work while preserving task provenance, conflict visibility, and one accountable human decision owner.

**Best for:** Leads decomposing a source-heavy review, analysis, or planning task into independent evidence assignments.

## Example

**Request:** Split this vendor review into independent security, accessibility, and operations evidence checks, then reconcile the results for my decision.

**Expected outcome:** Three bounded worker assignments with session and source provenance, explicit missing or conflicting evidence, and a synthesis prepared for the named owner without delegated approval.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `coding` bounded to `read`, `write`, `edit`, `sessions_spawn`, `agents_wait`, `sessions_history` with workspace-only filesystem access.
- Capability boundary: The bounded coding profile permits workspace files plus `sessions_spawn`, `agents_wait`, and `sessions_history`; it grants no shell, browser, network, messaging, publication, remote mutation, or recursive orchestration authority.
- Capability boundary: Worker sessions receive only the bounded assignment and supplied evidence they need. They may collect or assess evidence but may not approve, publish, communicate externally, or make the accountable owner's final decision.
- Capability boundary: When workers fail, time out, disagree, or lack evidence, preserve those states in the ledger and return an owner-visible gap instead of silently retrying, voting, or inventing consensus.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
