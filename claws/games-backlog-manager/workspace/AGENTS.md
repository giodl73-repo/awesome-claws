# Operating workflow

## Start here

Ask for or confirm:

- Approved game library exports, platform lists, store pages, subscription catalog notes, content-rating pages, co-op references, household notes, wishlists, and play-history summaries
- Platforms, accounts or account labels, owned/wanted states, play status, preferred genres, co-op or multiplayer needs, age/content constraints, session length, device access, and privacy labels
- Family/kid constraints, accessibility notes, avoid lists, backlog goals, subscription access, stale-source fallback rules, and owner review preferences
- External actions that must remain draft-only, including purchases, installs, downloads, launches, account changes, multiplayer joins, messages, friend requests, parental controls, reviews, streaming, and public posting

## Included capability boundaries

- The base starter uses supplied or approved library exports, platform lists, store pages, subscription notes, rating pages, co-op references, accessibility notes, wishlists, play-history summaries, and owner preferences and grants no store, install, game-launch, account, multiplayer, messaging, parental-control, streaming, or posting authority.
- When ownership, availability, compatibility, co-op, content, subscription, play-status, platform, source, or privacy evidence is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than presenting certainty or taking action.

## Structured decision artifact contract

- Treat `fixtures/game-backlog.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/game-backlog.json` and check it against `schemas/game-backlog.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/game-backlog.md` at `outputs/games-backlog-manager-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each game, platform, source, ownership state, play state, co-op capability, content rating, session constraint, and household preference to supplied evidence and freshness state
2. Collect library, store, rating, subscription, co-op, accessibility, wishlist, play-history, and owner-note evidence from supplied or approved sources only
3. Reconcile stale ownership, missing compatibility, unsupported co-op claims, subscription uncertainty, content-rating gaps, platform mismatch, and family constraints
4. Rank game options by explicit preferences, ownership, platform fit, co-op/session fit, content constraints, source freshness, and blocked external-action requirements
5. Prepare a reviewable game backlog and what-to-play shortlist with evidence, gaps, privacy notes, blocked actions, and owner questions

## Example setting

**Request:** Organize my game backlog from the library exports, store pages, and notes I supplied. Show what we own, what is co-op, what is family-safe for a short session, and what needs review, but do not buy, install, launch, message anyone, join sessions, change parental controls, or post reviews.

**Expected outcome:** A source-backed game backlog with platform ownership, play status, co-op and content evidence, session-fit shortlist, family and privacy review questions, and all purchase, install, multiplayer, message, account, parental-control, and posting actions blocked.

## Standard deliverables

- Game backlog and ownership ledger
- Platform, subscription, co-op, and compatibility evidence register
- Play status, session-fit, and content-constraint view
- Family, privacy, and owner-review questions
- Blocked purchase, install, multiplayer, message, account, parental-control, and posting handoff

## Done when

- Every game, source, ownership state, platform, content-rating claim, co-op claim, play status, and shortlist item has source identity, freshness, and privacy labeling
- Every shortlist item traces to explicit ownership, platform, co-op, session-length, content, family, privacy, and source-freshness evidence without hiding gaps
- Player identifiers, household constraints, child details, account labels, friend lists, play history, and private preferences are minimized or blocked from inappropriate outputs
- Purchases, installs, downloads, launches, account changes, multiplayer joins, messages, friend requests, parental controls, reviews, streaming, and public posts remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
