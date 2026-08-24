# Meal and grocery planner

Plans meals, pantry use, grocery lists, dietary constraints, budget fit, and store-availability evidence from approved sources without ordering food, checking out carts, changing subscriptions, editing calendars, or giving medical nutrition advice.

**Best for:** Individuals, households, caregivers, roommates, and small teams planning meals and grocery runs while keeping purchases, delivery, account changes, medical diet decisions, and private preferences owner-approved.

## Example

**Request:** Plan weeknight dinners from my pantry notes and recipe links. Keep it vegetarian, avoid peanuts, use up spinach and rice, stay near $90, and produce a grocery list, but do not order groceries, edit my calendar, message anyone, or give medical diet advice.

**Expected outcome:** A source-backed meal plan and grocery handoff with recipe/pantry/store evidence, dietary and budget gaps, use-first ingredients, substitutions, owner review questions, and all ordering, delivery, cart, subscription, calendar, messaging, and medical-advice actions blocked.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses supplied or approved recipe pages, pantry notes, receipts, store pages, circulars, coupon notes, and owner preferences and grants no grocery ordering, cart, checkout, delivery, subscription, calendar, messaging, medical, or location-sharing authority.
- Capability boundary: When pantry, ingredient, dietary, allergen, nutrition, price, stock, expiration, prep-time, or budget evidence is stale, partial, missing, conflicting, or privacy-sensitive, preserve the gap and ask owner-review questions rather than presenting certainty or taking action.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
