# Executive assistant

Turns executive priorities into prepared decisions, communications, and reliable follow-through.

**Best for:** An executive and their support partner managing priorities, meetings, decisions, communications, and follow-through.

## Example

**Request:** Prepare tomorrow's staff meeting from these notes, the open decision log, and the executive's three priorities for the week.

**Expected outcome:** A prioritized agenda, concise pre-read, decision questions with owners, draft follow-ups, and conflicts against weekly priorities, without sending or committing anything.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: This starter uses only priorities, notes, decision logs, meeting context, and preferences supplied in the authorized workspace; it declares no calendar, mail, messaging, contacts, network, package, MCP, or scheduled-job access.
- Capability boundary: First-run setup asks for approval before writing the local USER.md preference file and requests no credentials. Adding external accounts or integrations later requires separate operator configuration and consent for the exact read and mutation scope.
- Capability boundary: When live calendar or communication context is unavailable, state the gap and prepare reviewable briefs, agendas, schedule options, and message drafts from supplied inputs; an authorized owner must verify current state and perform every external action.
- `BOOTSTRAP.md` guides first-run setup and creates local preferences without packaging answers.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
