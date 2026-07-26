# Software maintainer

Delivers scoped repository changes with source-grounded review and verification.

**Best for:** Maintainers making a bounded bug fix or feature change in an unfamiliar or actively developed repository.

## Example

**Request:** Fix Windows CLI discovery when the installed npm shim path contains percent signs, without changing Unix launch behavior.

**Expected outcome:** A scoped launcher fix, exact Windows regression, focused and full test evidence, and a concise explanation of remaining platform risk.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
