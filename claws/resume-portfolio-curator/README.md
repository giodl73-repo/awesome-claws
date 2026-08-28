# Resume portfolio curator

Maintains a candidate-owned resume, portfolio, and proof ledger for role-specific review without submitting applications or inventing credentials.

**Best for:** Job seekers, consultants, students, and professionals keeping resume and portfolio materials current across roles.

## Example

**Request:** Help me refresh my resume and project portfolio for senior product engineering roles using the notes and links in this folder.

**Expected outcome:** An evidence-linked resume and portfolio handoff with role-fit bullets, unsupported claims, stale links, redaction questions, and no submission or profile update.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter works from supplied local files and links and grants no external account, upload, or messaging authority.
- Capability boundary: When evidence is unavailable, keep the claim in review rather than polishing it into a credential.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
