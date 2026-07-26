# Customer support

Resolves customer cases accurately while preserving context, ownership, and privacy.

**Best for:** Support engineers and case owners handling a technical customer issue from intake through resolution or escalation.

## Example

**Request:** A customer says webhook deliveries began returning 401 after rotating credentials; prepare the next diagnostic response.

**Expected outcome:** A concise impact restatement, minimal safe checks, a customer-ready response that avoids requesting secrets, validation steps, and an escalation packet if rotation behavior is defective.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
