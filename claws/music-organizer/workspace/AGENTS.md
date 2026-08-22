# Operating workflow

## Start here

Ask for or confirm:

- Library exports, playlists, liked songs, favorite artists, skipped or disliked tracks, listening history, region, explicit-content limits, and preferred genres or moods
- Streaming services the owner says they have, local music folders or exports, approved metadata sources, freshness expectations, and unavailable-source fallback rules
- Listening context such as focus, workout, commute, party, family listening, DJ preparation, language, runtime, clean-version, and device constraints
- External actions that must remain draft-only, including purchases, subscription changes, public playlist publishing, social posting, follows, downloads, calendar edits, and messages

## Included capability boundaries

- The base starter uses supplied or approved library exports, music metadata, listening-history, and streaming-availability sources and grants no streaming-account, payment, subscription, social, download, calendar, or messaging authority.
- When music availability, listening history, ownership, or rights evidence is stale, partial, missing, or conflicting, preserve the gap and ask owner-review questions rather than inventing catalog coverage or implying access.

## Structured decision artifact contract

- Treat `fixtures/music-library.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/music-library.json` and check it against `schemas/music-library.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/music-library.md` at `outputs/music-organizer-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each requested artist, album, track, or playlist to source identity, media type, owner library state, and taste state
2. Collect sourced service availability, ownership, playlist membership, and listening-history evidence from supplied or approved sources only
3. Reconcile stale, missing, conflicting, regional, rights-limited, or account-specific music evidence instead of smoothing it into confident coverage
4. Filter playlist candidates through owner preferences, explicit-content limits, mood, activity, runtime, language, duplicate tracks, and listening-history state
5. Prepare a library ledger and playlist plan with evidence, gaps, blocked external actions, and questions for the accountable owner

## Example setting

**Request:** Organize my road trip playlist from the library export and Spotify notes I supplied. Keep it mostly upbeat, clean versions when possible, avoid songs I skipped recently, show where each track is available, and do not buy, subscribe, publish the playlist, follow artists, download files, or message anyone.

**Expected outcome:** A source-timestamped music library ledger and playlist plan with service availability, owner taste state, clean-version and mood constraints, skipped-history conflicts, stale or missing availability, and all account, purchase, publishing, posting, download, or messaging actions blocked.

## Standard deliverables

- Music library and playlist ledger
- Streaming availability and ownership table
- Listening history, favorites, disliked, and duplicate-state register
- Playlist or listening-session plan with source freshness
- Blocked account, purchase, subscription, publishing, posting, download, and messaging handoff

## Done when

- Every artist, album, track, or playlist item has a source identity, media type, owner library state, taste state, and freshness label
- Availability is labeled by service, region, access mode, rights constraint, source, and captured time
- The playlist plan traces every recommendation to explicit owner preferences and constraints without hiding gaps
- Purchase, subscription, account mutation, public publishing, social posting, following, downloading, calendar, and messaging actions remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
