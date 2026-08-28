# Operating workflow

## Start here

Ask for or confirm:

- Owner-supplied contact notes, business cards, event attendee notes, meeting summaries, email snippets, LinkedIn export notes, introduction requests, referral notes, follow-up drafts, calendar notes, and owner constraints
- Contact labels, organization, relationship context, last touch date, follow-up reason, consent scope, privacy labels, reminder timing, duplicate signals, and owner-review goals
- Review goals such as source ledger, contact queue, follow-up draft review, introduction readiness, stale-context cleanup, and reminder questions
- External actions that must remain blocked or draft-only, including sending messages, introducing people, scheduling, updating accounts, scraping contacts, referral commitments, sales outreach, recruiting actions, and professional advice

## Included capability boundaries

- The base starter uses owner-supplied notes, exports, snippets, drafts, cards, event notes, calendar notes, and relationship context and grants no email, messaging, calendar, CRM, browser, social-network, scraping, recruiting, sales, or account authority.
- When contact context, consent, relationship scope, referral readiness, recruiting intent, buying intent, employer details, or account evidence is stale, partial, missing, conflicting, duplicate, or sensitive, preserve the gap and ask owner-review questions rather than messaging, introducing, scheduling, scraping, committing, or advising.

## Structured decision artifact contract

- Treat `fixtures/networking-followup.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/networking-followup.json` and check it against `schemas/networking-followup.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/networking-followup.md` at `outputs/professional-networking-followup-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each contact, source, interaction, follow-up draft, introduction request, reminder, gap, and review question to supplied or approved evidence
2. Group contacts by relationship context, owner priority, last touch, consent scope, follow-up type, privacy label, stale evidence, and blocked external action
3. Reconcile stale, missing, conflicting, duplicate, sensitive, recruiting-adjacent, sales-adjacent, or referral-adjacent evidence without inventing personal details or intent
4. Prepare an owner-reviewed networking packet with source ledger, contact queue, follow-up drafts, introduction questions, reminders, and unresolved gaps
5. Return a blocked-action handoff without messaging, introducing, scheduling, scraping, changing accounts, committing referrals, doing sales/recruiting outreach, or giving professional advice

## Example setting

**Request:** Organize my conference contacts, coffee-chat notes, intro asks, referral notes, and follow-up drafts. Build a follow-up queue and reminder questions, but do not send messages, make introductions, schedule meetings, scrape contacts, change accounts, commit referrals, do sales or recruiting outreach, or give career, legal, financial, employment, immigration, privacy, recruiting, sales, compensation, or relationship advice.

**Expected outcome:** A source-backed networking packet with contact ledger, follow-up queue, draft review, introduction-readiness questions, stale or sensitive context gaps, and all outbound messaging, introductions, scheduling, scraping, account, referral, recruiting, sales, and professional-advice actions blocked.

## Standard deliverables

- Professional contact source ledger
- Networking follow-up queue
- Introduction and referral-readiness checklist
- Follow-up draft review packet
- Relationship reminder and stale-context questions
- Blocked messaging, introduction, scheduling, account, scraping, referral, recruiting, sales, and advice handoff

## Done when

- Every contact, source, interaction, follow-up draft, introduction request, reminder, gap, and review question has source identity, freshness, privacy scope, and owner-review state
- Every relationship, follow-up, introduction, reminder, referral, recruiting-adjacent, or sales-adjacent claim traces to supplied or approved evidence without hiding stale, missing, conflicting, duplicate, partial, or sensitive context
- Personal contact details, employer context, private notes, referral details, meeting summaries, and account identifiers are minimized or blocked from inappropriate outputs
- Messages, introductions, scheduling, scraping, account changes, referral commitments, recruiting actions, sales outreach, and career/legal/financial/recruiting/sales/employment/compensation/immigration/privacy/relationship advice remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
