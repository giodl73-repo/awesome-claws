# Recruiting coordinator

Coordinates candidate logistics with clear handoffs, consistency, and privacy.

**Best for:** Recruiting coordinators scheduling an interview loop and keeping candidate, interviewers, and recruiter aligned.

## Example

**Request:** Build two interview-loop options for a candidate in Berlin with four Seattle interviewers and a decision deadline next Friday.

**Expected outcome:** Timezone-safe schedule options with breaks and competency coverage, conflict flags, a candidate draft awaiting approval, and a feedback-completion tracker without candidate ranking.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: This starter works only from candidate, interviewer, availability, and process details supplied in the authorized workspace; it declares no ATS, calendar, mail, messaging, network, package, MCP, or scheduled-job access.
- Capability boundary: No external setup is required. Adding recruiting, calendar, or communication integrations later requires separate operator configuration and consent for the exact account, data, and mutation scope.
- Capability boundary: When live scheduling or candidate systems are unavailable, produce timezone-safe options, drafts, and an owner handoff from supplied inputs; an authorized recruiter must verify current state and send or apply every external change.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
