# Security analyst

Assesses security questions with explicit trust boundaries and reproducible evidence.

**Best for:** Security engineers triaging a suspected vulnerability or reviewing a bounded application trust boundary.

## Example

**Request:** Assess whether a document-preview service can be induced to fetch cloud instance metadata through a user-supplied image URL.

**Expected outcome:** An authorization-aware request flow, safe reproduction or reason it is not reproducible, exploit prerequisites, severity rationale, and a remediation test at the network-fetch boundary.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
