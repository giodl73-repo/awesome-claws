# Operating workflow

## Start here

Ask for or confirm:

- Approved recipes, meal preferences, dietary restrictions, allergy notes, pantry inventory, fridge/freezer notes, grocery receipts, store pages, circulars, prices, coupons, and owner budget targets
- Meal windows, serving counts, prep-time limits, equipment constraints, leftovers goals, avoid lists, favorite meals, recurring staples, privacy labels, and stale-source fallback rules
- Household or care-circle constraints, private preference labels, per-person dietary sensitivity, accessibility or transportation limits, and owner-approved disclosure scope
- External actions that must remain draft-only, including grocery orders, cart checkout, delivery scheduling, subscription changes, calendar edits, household messages, and medical diet decisions

## Included capability boundaries

- The base starter uses supplied or approved recipe pages, pantry notes, receipts, store pages, circulars, coupon notes, and owner preferences and grants no grocery ordering, cart, checkout, delivery, subscription, calendar, messaging, medical, or location-sharing authority.
- When pantry, ingredient, dietary, allergen, nutrition, price, stock, expiration, prep-time, or budget evidence is stale, partial, missing, conflicting, or privacy-sensitive, preserve the gap and ask owner-review questions rather than presenting certainty or taking action.

## Structured decision artifact contract

- Treat `fixtures/meal-grocery.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/meal-grocery.json` and check it against `schemas/meal-grocery.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/meal-grocery.md` at `outputs/meal-grocery-planner-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each meal, recipe, pantry item, grocery item, source, dietary constraint, budget signal, and store-availability note to supplied evidence and freshness state
2. Collect recipe, pantry, receipt, store, coupon, owner-note, and household-preference evidence from supplied or approved sources only
3. Reconcile stale counts, expired items, missing quantities, price mismatch, stock uncertainty, dietary conflicts, prep-time limits, leftovers goals, and budget tradeoffs
4. Prepare meal options and grocery groups by explicit preferences, pantry use, dietary fit, budget fit, prep constraints, source freshness, and blocked external-action requirements
5. Produce a reviewable meal plan and grocery handoff with evidence, substitutions, privacy notes, gaps, blocked actions, and owner questions

## Example setting

**Request:** Plan weeknight dinners from my pantry notes and recipe links. Keep it vegetarian, avoid peanuts, use up spinach and rice, stay near $90, and produce a grocery list, but do not order groceries, edit my calendar, message anyone, or give medical diet advice.

**Expected outcome:** A source-backed meal plan and grocery handoff with recipe/pantry/store evidence, dietary and budget gaps, use-first ingredients, substitutions, owner review questions, and all ordering, delivery, cart, subscription, calendar, messaging, and medical-advice actions blocked.

## Standard deliverables

- Meal plan with source freshness
- Pantry, fridge, and freezer use register
- Grocery list grouped by source and store evidence
- Dietary, allergy, budget, prep-time, and leftovers review questions
- Blocked grocery order, delivery, cart, subscription, calendar, message, and medical-advice handoff

## Done when

- Every meal, recipe, pantry item, grocery item, dietary claim, budget claim, and store signal has source identity, freshness, and privacy labeling
- Every meal and grocery-list item traces to explicit preferences, serving count, pantry use, dietary fit, budget fit, prep constraints, and source-freshness evidence without hiding gaps
- Private addresses, medical conditions, allergies, household member preferences, care-circle details, and budget constraints are minimized or blocked from inappropriate outputs
- Grocery orders, checkout, delivery, cart changes, subscription changes, calendar edits, household messages, public sharing, and medical nutrition advice remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
