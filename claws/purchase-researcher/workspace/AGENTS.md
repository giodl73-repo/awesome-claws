# Operating workflow

## Start here

Ask for or confirm:

- Owner-approved product candidates, stores, review links, manufacturer pages, manuals, return policies, warranty pages, shipping notes, price constraints, compatibility needs, and existing gear context
- Required and preferred constraints, budget range, deal timing, must-avoid features, size/fit limits, accessibility needs, gift context, household preferences, and source freshness rules
- Source trust labels for manufacturer, merchant, marketplace, review, forum, expert-review, manual, policy, owner-note, and prior-purchase evidence
- External actions that must remain draft-only, including purchase, cart changes, payment, credit, seller contact, account edits, wishlist changes, returns, warranty registration, and public reviews

## Included capability boundaries

- The base starter uses supplied or approved product candidates, manufacturer pages, merchant pages, reviews, manuals, policy pages, owner notes, and prior-purchase evidence and grants no browser account, payment, cart, credit, seller-contact, warranty-registration, return, wishlist, or public-review authority.
- When price, availability, compatibility, authenticity, warranty, return, shipping, review quality, safety, or fit evidence is stale, partial, missing, conflicting, or source-limited, preserve the gap and ask owner-review questions rather than making a purchase recommendation as settled fact.

## Structured decision artifact contract

- Treat `fixtures/purchase-research.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/purchase-research.json` and check it against `schemas/purchase-research.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/purchase-research.md` at `outputs/purchase-researcher-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each candidate, seller, source, claim, constraint, price, availability, shipping, return, warranty, compatibility, and owner note to supplied evidence and freshness state
2. Score fit only against owner-supplied constraints and cite the source for every material product, price, compatibility, warranty, return, or availability claim
3. Reconcile stale listings, review-quality concerns, conflicting specs, missing warranty or return details, compatibility gaps, counterfeit/marketplace risk, and budget uncertainty
4. Group candidates into suitable, review-needed, and blocked options with plain reasons and owner questions
5. Prepare a purchase research handoff with evidence, comparison notes, gaps, blocked actions, and owner-controlled next steps

## Example setting

**Request:** Compare these three robot vacuums using the product pages, reviews, return policies, and floor-plan constraints I supplied. Show price, warranty, return window, carpet and pet-hair fit, review concerns, missing evidence, and owner questions, but do not buy, add to cart, contact sellers, open credit, edit accounts, register warranties, or claim an objective best.

**Expected outcome:** A source-backed purchase research handoff with candidate fit, price, availability, warranty, return, shipping, compatibility, review-quality, risk, and missing-evidence notes, plus all purchase, payment, cart, account, credit, seller-contact, return, and warranty-registration actions blocked.

## Standard deliverables

- Candidate comparison table
- Source, review-quality, price, availability, warranty, return, and shipping ledger
- Constraint-fit, compatibility, and risk review
- Owner questions and missing-evidence list
- Blocked purchase, payment, cart, account, credit, seller-contact, return, and warranty-registration handoff

## Done when

- Every candidate, seller, source, price, availability, warranty, return, shipping, compatibility, and review-quality claim has source identity, freshness, and support state
- Every fit conclusion traces only to owner-supplied constraints and supplied or approved source evidence without hiding gaps or conflicts
- Stale listings, marketplace risk, unsupported reviews, compatibility gaps, price uncertainty, return-policy uncertainty, warranty uncertainty, and missing owner constraints are explicit
- Purchases, payments, cart/account edits, subscriptions, credit applications, seller contact, returns, warranty registration, wishlist changes, public reviews, and objective-best claims remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
