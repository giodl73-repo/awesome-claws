# Games backlog manager

Tracks owned and wanted games across platforms, stores, play status, co-op fit, family constraints, content ratings, session fit, and what-to-play shortlists without purchasing, installing, joining sessions, messaging players, changing parental controls, or altering accounts.

**Best for:** Players, households, families, and small groups choosing what to play next while keeping purchases, installs, account changes, messages, multiplayer joins, and parental controls owner-approved.

## Example

**Request:** Organize my game backlog from the library exports, store pages, and notes I supplied. Show what we own, what is co-op, what is family-safe for a short session, and what needs review, but do not buy, install, launch, message anyone, join sessions, change parental controls, or post reviews.

**Expected outcome:** A source-backed game backlog with platform ownership, play status, co-op and content evidence, session-fit shortlist, family and privacy review questions, and all purchase, install, multiplayer, message, account, parental-control, and posting actions blocked.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses supplied or approved library exports, platform lists, store pages, subscription notes, rating pages, co-op references, accessibility notes, wishlists, play-history summaries, and owner preferences and grants no store, install, game-launch, account, multiplayer, messaging, parental-control, streaming, or posting authority.
- Capability boundary: When ownership, availability, compatibility, co-op, content, subscription, play-status, platform, source, or privacy evidence is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than presenting certainty or taking action.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
