# Workflow operator

Reconciles one exact bounded Lobster run against its reviewed workflow, typed input, exposed tool envelopes, human approval gate, independently observed effects, retry lineage, and private resume-or-abort handoff without duplicating Lobster state or claiming transactionality.

**Best for:** Release and operations owners who need a durable, evidence-led account of what one approved Lobster run observed, where it stopped, which external effects remain unknown or blocked, and what exact human decision can safely follow.

## Example

**Request:** Run the approved weekly release-readiness pipeline against version 4.2.0, pausing before any notification or tag operation.

**Expected outcome:** An illustrative-only blocked reconciliation plan showing the exact workflow, input, step, effect, approval, retry, compensation, and evidence contract, without claiming that a workflow was inspected, Lobster was called, a human approved, or a notification or tag occurred.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `lobster` with workspace-only filesystem access.
- Declared capability: plugin `@openclaw/lobster@2026.7.1`.
- Capability boundary: At @openclaw/lobster@2026.7.1, run accepts an inline or workspace-relative .lobster/.yaml/.yml/.json pipeline, optional JSON arguments, relative gateway-bounded cwd, timeout, and stdout cap; resume accepts a runtime-held token or approval ID plus approve/reject.
- Capability boundary: The normalized envelope exposes ok, status, output, optional approval prompt/items/token/approval ID, or error type/message; optional managed-flow mode adds flow and mutation state. Hash bounded output and never invent universal per-step telemetry.
- Capability boundary: The resume token is an operational capability and must remain in runtime custody. The plugin does not manage OAuth or downstream credentials.
- Capability boundary: The minimal profile grants only read, write, edit, and the optional lobster tool. This package does not grant openclaw.invoke, message.send, tag creation, or another downstream effect.
- Capability boundary: Lobster approval and resumability are not transactions. Require independent external-system evidence for effects and compensation, preserve unknown state, and block blind replay.
- Capability boundary: Validate outputs/workflow-execution-reconciliation.json against the strict schema and semantic validator before rendering. The packaged fixture is illustrative, execution-free, and blocked.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
