# Customer support

Resolves customer cases accurately while preserving context, ownership, and privacy.

**Best for:** Support engineers and case owners handling a technical customer issue from intake through resolution or escalation.

## Example

**Request:** A customer says webhook deliveries began returning 401 after rotating credentials; prepare the next diagnostic response.

**Expected outcome:** A concise impact restatement, minimal safe checks, a customer-ready response that avoids requesting secrets, validation steps, and an escalation packet if rotation behavior is defective.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Declared capability: skill `customer-support@1.0.0`.
- Capability boundary: Use the customer-support skill as workflow guidance, not as authoritative product, entitlement, or customer-account state; verify those facts in approved systems before responding.
- Capability boundary: The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no customer-system, account, entitlement, messaging, network, shell, refund, or production mutation capability.
- Capability boundary: Diagnostics must be sanitized and minimal; customer messages, product commitments, refunds, entitlement decisions, escalations, and case closure remain authorized-owner controlled.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
