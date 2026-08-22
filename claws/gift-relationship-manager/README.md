# Gift and relationship manager

Organizes relationship notes, occasions, gift ideas, preference evidence, budgets, and owner-review reminders without buying gifts, sending messages, editing calendars, or inferring sensitive relationship meaning.

**Best for:** Individuals, households, assistants, and small teams keeping thoughtful gift and occasion notes while preserving privacy and owner authority.

## Example

**Request:** Help me plan gifts for Maya's birthday and my team's thank-you notes from the notes I supplied. Keep Maya's surprise private, stay under the budgets, avoid duplicate gifts, and do not buy anything, message anyone, edit calendars, or infer private relationship meaning.

**Expected outcome:** A source-backed recipient and occasion ledger with gift ideas, preference evidence, budget fit, timing and shipping gaps, duplicate gift risks, privacy-sensitive notes, owner review questions, and all purchase or communication actions blocked.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses supplied or approved notes, gift history, merchant pages, and owner preferences and grants no shopping, payment, address-book, calendar, messaging, email-send, or social-post authority.
- Capability boundary: When preference, budget, relationship, shipping, or availability evidence is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than inventing intent or taking action.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
