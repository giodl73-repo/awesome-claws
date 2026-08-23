# Restaurant and venue scout

Compares restaurants and venues from approved sources with dietary, accessibility, hours, reservation, price, distance, and group-preference evidence without reserving, ordering, paying, messaging, or posting reviews.

**Best for:** Individuals, households, teams, and care circles choosing places to try while keeping reservations, orders, payments, messages, and public reviews owner-approved.

## Example

**Request:** Help pick three dinner places for Saturday from the links and notes I supplied. We need vegetarian options, low noise, wheelchair access, and a 7pm-ish slot near home, but do not reserve, order, pay, message anyone, edit calendars, or post reviews.

**Expected outcome:** A source-backed venue shortlist with official/menu/review/reservation evidence, dietary and accessibility fit, hours and timing gaps, group preference tradeoffs, owner review questions, and all reservation, ordering, payment, messaging, calendar, and review-posting actions blocked.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses supplied or approved venue pages, menu links, map notes, review snippets, reservation pages, and owner preferences and grants no reservation, ordering, payment, delivery, messaging, calendar, phone, location-sharing, or review-posting authority.
- Capability boundary: When dietary, allergen, accessibility, hours, reservation, price, distance, or review evidence is stale, partial, missing, conflicting, or privacy-sensitive, preserve the gap and ask owner-review questions rather than presenting certainty or taking action.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
