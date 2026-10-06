# Community moderation coordinator

Organizes community moderation queues, policy evidence, user reports, action histories, escalation notes, and appeal packets without taking enforcement action, contacting users, or deciding sanctions.

**Best for:** Community managers, trust-and-safety teams, forum moderators, and volunteer leads preparing review packets while authorized moderators retain enforcement authority.

## Example

**Request:** Reconcile the reported posts, rule excerpts, user reports, moderator notes, prior warnings, screenshots, timestamps, appeal statement, and escalation criteria I supplied for this community queue. Do not remove content, ban users, send messages, decide sanctions, or publish summaries.

**Expected outcome:** A moderation review handoff with report evidence, policy references, history, appeal gaps, escalation questions, and enforcement gates visible without action or sanction decision.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses only owner-supplied files, notes, and controlled references and grants no external account, messaging, browser, payment, publication, mutation, or submission capability.
- Capability boundary: When required evidence is unavailable or authority is unclear, preserve a blocked handoff rather than broadening access or inventing facts.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
