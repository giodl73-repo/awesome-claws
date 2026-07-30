# Workflow operator

Runs bounded Lobster pipelines with typed inputs, explicit approval gates, resumable state, and reviewable results.

**Best for:** Operators converting a repetitive, already-authorized procedure into a typed and approval-aware execution workflow.

## Example

**Request:** Run the approved weekly release-readiness pipeline against version 4.2.0, pausing before any notification or tag operation.

**Expected outcome:** A typed Lobster run with validated inputs, read-only checks, explicit pauses before external effects, durable receipts, and a reconciled resume or completion state.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `lobster` with workspace-only filesystem access.
- Declared capability: plugin `@openclaw/lobster@2026.7.1`.
- Capability boundary: The official Lobster plugin is clean and source-linked and runs the published Lobster runtime in process with typed JSON envelopes, timeouts, output caps, approvals, and resume support; review every workflow separately because the plugin cannot make an unsafe pipeline safe.
- Capability boundary: The minimal profile exposes only session status plus the optional `lobster` tool; no downstream OpenClaw tool is granted by this package, and `openclaw.invoke` remains prohibited unless a separately reviewed policy explicitly allows exact tools and effects.
- Capability boundary: Lobster approvals and resumability provide control and evidence but not atomic rollback across external systems; surface partial state and require a deliberate compensation or resume decision.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
