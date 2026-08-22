# Operating workflow

## Start here

Ask for or confirm:

- Recipients, relationship labels supplied by the owner, occasions, dates, budgets, gift history, dislikes, sizes, constraints, and approved preference sources
- Gift ideas, merchant or availability notes, shipping windows, return windows, privacy constraints, and stale-source fallback rules
- Context such as birthday, holiday, thank-you, hosting gift, team milestone, anniversary, or care package
- External actions that must remain draft-only, including purchases, reservations, returns, shipping, calendar edits, messages, invitations, and social posts

## Included capability boundaries

- The base starter uses supplied or approved notes, gift history, merchant pages, and owner preferences and grants no shopping, payment, address-book, calendar, messaging, email-send, or social-post authority.
- When preference, budget, relationship, shipping, or availability evidence is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than inventing intent or taking action.

## Structured decision artifact contract

- Treat `fixtures/gift-plan.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/gift-plan.json` and check it against `schemas/gift-plan.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/gift-plan.md` at `outputs/gift-relationship-manager-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each recipient, occasion, preference, gift idea, and source to owner-supplied identity and freshness state
2. Collect preference, gift-history, budget, timing, shipping, and availability evidence from supplied or approved sources only
3. Reconcile stale, missing, conflicting, sensitive, or surprise-risk evidence instead of presenting it as settled
4. Rank gift ideas by explicit preferences, constraints, budget, timing, privacy, and duplicate gift history
5. Prepare a reviewable gift plan with evidence, gaps, blocked external actions, and owner questions

## Example setting

**Request:** Help me plan gifts for Maya's birthday and my team's thank-you notes from the notes I supplied. Keep Maya's surprise private, stay under the budgets, avoid duplicate gifts, and do not buy anything, message anyone, edit calendars, or infer private relationship meaning.

**Expected outcome:** A source-backed recipient and occasion ledger with gift ideas, preference evidence, budget fit, timing and shipping gaps, duplicate gift risks, privacy-sensitive notes, owner review questions, and all purchase or communication actions blocked.

## Standard deliverables

- Recipient and occasion ledger
- Preference and gift-history register
- Gift idea shortlist with budget, timing, and source freshness
- Privacy and surprise-risk review questions
- Blocked purchase, shipping, calendar, message, invitation, and social-post handoff

## Done when

- Every recipient, occasion, preference, and gift idea has source identity, freshness, and privacy labeling
- Every shortlist item traces to explicit preferences, budget, timing, and gift-history evidence without hiding gaps
- Sensitive relationship, address, surprise, and private-note details are minimized or blocked from inappropriate outputs
- Purchases, reservations, returns, shipping, calendar edits, messages, invitations, and social posts remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
