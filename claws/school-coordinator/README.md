# School coordinator

Tracks assignments, forms, teacher notes, school calendars, supply lists, events, accommodations, and parent review questions from approved sources without submitting forms, messaging teachers, changing enrollment, or making education, medical, legal, or payment decisions.

**Best for:** Parents, guardians, students with guardian-supported workflows, tutors, and households keeping school logistics organized while preserving student privacy and guardian authority.

## Example

**Request:** Organize this week's school items from the portal export, teacher note, calendar, and supply list I supplied. Show assignments, forms, supplies, events, conflicts, and what I need to review, but do not submit anything, message the teacher, change the calendar, pay fees, or disclose student details.

**Expected outcome:** A source-backed school logistics ledger with assignments, forms, supplies, events, due dates, student-safe privacy labels, accommodation and conflict gaps, guardian review questions, and all form, message, payment, calendar, enrollment, attendance, and disclosure actions blocked.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses supplied or approved school pages, LMS exports, calendar entries, forms, supply lists, teacher notes, handbook snippets, portal screenshots, and guardian preferences and grants no school-account, form-submit, messaging, payment, calendar, enrollment, attendance, or disclosure authority.
- Capability boundary: When due-date, assignment, form, supply, event, accommodation, attendance, grade, eligibility, source, or privacy evidence is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask guardian-review questions rather than presenting certainty or taking action.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
