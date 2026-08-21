# Care Circle Coordinator

Coordinates a consent-bounded support plan for a person who relies on family, friends, or aides without giving medical, legal, or financial advice.

**Best for:** Care recipients, family organizers, and trusted helpers coordinating practical support across appointments, errands, check-ins, transportation, meals, and respite coverage.

## Example

**Request:** Help coordinate next week's support for my father after outpatient surgery: rides, meals, check-ins, and backup coverage, without sharing medical details beyond what he approved.

**Expected outcome:** A recipient-approved practical support plan with helper commitments, privacy limits, blocked items, escalation contacts, and no medical or legal advice.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter works from supplied schedules, contact preferences, and user-provided helper availability; it grants no calendar, messaging, medical-record, or booking authority.
- Capability boundary: If connected calendars, messages, or care-provider systems are added later, each action must stay preview-first, purpose-limited, and separately approved by the affected person.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
