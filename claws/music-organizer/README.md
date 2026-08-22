# Music organizer

Organizes a personal or household music library, playlists, listening history, favorites, and source-backed streaming availability without account mutation, purchases, public sharing, playlist publishing, or rights bypassing.

**Best for:** Individuals, households, collectors, DJs, and small groups organizing music they own, follow, or can access through declared services.

## Example

**Request:** Organize my road trip playlist from the library export and Spotify notes I supplied. Keep it mostly upbeat, clean versions when possible, avoid songs I skipped recently, show where each track is available, and do not buy, subscribe, publish the playlist, follow artists, download files, or message anyone.

**Expected outcome:** A source-timestamped music library ledger and playlist plan with service availability, owner taste state, clean-version and mood constraints, skipped-history conflicts, stale or missing availability, and all account, purchase, publishing, posting, download, or messaging actions blocked.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses supplied or approved library exports, music metadata, listening-history, and streaming-availability sources and grants no streaming-account, payment, subscription, social, download, calendar, or messaging authority.
- Capability boundary: When music availability, listening history, ownership, or rights evidence is stale, partial, missing, or conflicting, preserve the gap and ask owner-review questions rather than inventing catalog coverage or implying access.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
