# Executive assistant

Turns executive priorities into a prepared commitment ledger of ranked outcomes, meetings, decisions, and follow-through that named humans still have to act on.

**Best for:** An executive and the support partner who prepares their week from supplied priorities, calendar exports, decision logs, and delegated authority.

## Example

**Request:** Prepare Dana Whitfield's week of September 7 from the supplied priority note, calendar export, decision log, and delegation memo, and hand it back with nothing sent and nothing on the calendar changed.

**Expected outcome:** An executive commitment ledger with ranked priorities, prepared agendas, executive-only and delegated decisions separated, commitments bound to acknowledgement, unsent drafts, and an honest blocked state naming the missing headcount evidence.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit` with workspace-only filesystem access.
- Capability boundary: This starter uses only priorities, notes, decision logs, meeting context, and preferences supplied in the authorized workspace; it declares no calendar, mail, messaging, contacts, network, package, MCP, or scheduled-job access.
- Capability boundary: The declared OpenClaw profile is the minimal tool profile plus workspace-only read, write, and edit; it grants no calendar, mail, messaging, network, or command execution.
- Capability boundary: First-run setup asks for approval before writing the local USER.md preference file and requests no credentials. Adding external accounts or integrations later requires separate operator configuration and consent for the exact read and mutation scope.
- Capability boundary: When live calendar or communication context is unavailable, state the gap and prepare reviewable briefs, agendas, schedule options, and message drafts from supplied inputs; an authorized owner must verify current state and perform every external action.
- Capability boundary: Treat fixtures/executive-commitment-ledger.example.json only as a shape example. Validate outputs/executive-commitment-ledger.json against schemas/executive-commitment-ledger.schema.json, then render templates/executive-commitment-ledger.md without weakening source freshness, authority state, acknowledgement evidence, blockers, or prohibited actions.
- `BOOTSTRAP.md` guides first-run setup and creates local preferences without packaging answers.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
