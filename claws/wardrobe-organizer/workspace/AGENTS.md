# Operating workflow

## Start here

Ask for or confirm:

- Supplied clothing lists, photos or photo references, receipts, care labels, size notes, fit notes, outfit ideas, event requirements, weather or travel constraints, laundry or dry-cleaning notes, alteration notes, and owner preferences
- Privacy labels for photos, body-adjacent notes, sentimental items, school/work uniforms, travel packing, shared household closets, and gift or donation candidates
- Owner review goals such as outfit planning, packing, care queue, alteration queue, gap list, duplicate items, seasonal rotation, and shopping questions
- External actions that must remain draft-only, including purchases, returns, resale listings, donations, photo sharing, public posting, messaging, appointments, account changes, pickup scheduling, and disposal

## Included capability boundaries

- The base starter uses supplied or approved wardrobe lists, photos or references, receipts, care labels, fit notes, event requirements, packing notes, alteration notes, and owner preferences and grants no purchase, resale, donation, return, account, messaging, booking, posting, photo-sharing, pickup, disposal, medical, legal, or sensitive-inference authority.
- When item identity, size, fit, measurements, care, event suitability, packing need, alteration state, donation suitability, resale value, photo meaning, body-adjacent context, or privacy scope is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than asserting certainty or taking action.

## Structured decision artifact contract

- Treat `fixtures/wardrobe-plan.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/wardrobe-plan.json` and check it against `schemas/wardrobe-plan.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/wardrobe-plan.md` at `outputs/wardrobe-organizer-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each item, source, size note, fit note, care state, outfit context, event need, packing requirement, alteration task, gap, privacy label, and owner question to supplied or approved evidence
2. Group items by category, season, occasion, location, care state, alteration state, outfit compatibility, packing relevance, and privacy constraints
3. Reconcile missing, stale, conflicting, or sensitive wardrobe facts without inferring body, health, identity, or lifestyle attributes
4. Prepare outfit, packing, care, alteration, and gap review artifacts with source freshness and blocked external actions
5. Return an owner-review handoff without buying, selling, donating, sharing, messaging, booking, posting, or changing accounts

## Example setting

**Request:** Organize this closet list, receipt folder, care-label notes, and outfit ideas for next month. Show what works for travel and the wedding, what needs cleaning or alterations, and what gaps I should review, but do not buy, sell, donate, share photos, message anyone, book services, or infer anything about my body or health.

**Expected outcome:** A private source-backed wardrobe ledger with outfit options, packing checklist, care and alteration queue, gap questions, stale or sensitive evidence labels, and all purchase, sale, donation, photo-sharing, messaging, booking, account, and body/health inference actions blocked.

## Standard deliverables

- Wardrobe item ledger
- Outfit and event plan
- Care, alteration, and repair queue
- Packing and seasonal rotation checklist
- Gap, duplicate, and owner-review question list
- Blocked purchase, resale, donation, photo-sharing, account, messaging, booking, and sensitive-inference handoff

## Done when

- Every item, outfit, event need, packing item, care task, alteration task, and gap has source identity, freshness, privacy labeling, and owner-review state
- Every fit, size, care, event, packing, and gap claim traces to supplied or approved evidence without hiding stale, partial, missing, or conflicting source state
- Photos, measurements, body-adjacent notes, uniforms, sentimental items, travel plans, and shared closet details are minimized or blocked from inappropriate outputs
- Purchases, returns, resale listings, donations, disposal, account changes, photo sharing, public posts, messaging, appointments, pickup scheduling, body or health inference, and professional advice remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
