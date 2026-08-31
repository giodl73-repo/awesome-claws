# Executive briefing

Reconciles one bounded scheduled run into a private source-timestamped executive briefing snapshot of agenda observations, decision asks, preparation needs, conflicts, weather implications, questions, and blockers.

**Best for:** Executives and support partners who need a recurring read-only morning snapshot from explicitly authorized Google Workspace and weather sources without delegating communication, calendar, document, commitment, or decision authority.

## Example

**Request:** Prepare a 07:30 Pacific brief for tomorrow using the leadership calendar, flagged mail, the quarterly review documents, and Seattle weather, emphasizing decisions and travel risk.

**Expected outcome:** A blocked private briefing snapshot with current read-only calendar, scoped mail, document, and forecast evidence; observed meetings, open decision asks, proposed preparation, a bidirectional schedule conflict, a missing travel prerequisite, bounded weather implications, and nothing delivered or changed.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: skill `@steipete/gog@1.0.0`.
- Declared capability: skill `@steipete/weather@1.0.0`.
- Declared capability: scheduled job `daily-executive-brief` (30 7 * * 1-5 America/Los_Angeles).
- Capability boundary: The gog skill can access broad Google Workspace data through locally configured OAuth; every calendar, mail, and document source must repeat the run-authorized account and exactly its one allowed read scope, and every document must retain a nonempty source version.
- Capability boundary: Mail evidence is read-only and label-scoped: a source observation never proves that a message was sent, replied to, forwarded, acknowledged, or acted on.
- Capability boundary: Calendar records are observations from current read evidence only; attendance and invitation response are not inferred, and no event is created, accepted, declined, moved, or cancelled.
- Capability boundary: Document observations stay bound to their named read-only source and version; the snapshot does not edit, comment on, replace, or otherwise mutate a document.
- Capability boundary: The weather skill supplies public forecasts without an API key; bind each source and forecast to one exact run-authorized normalized location, preserve issue and observation times and validity, require affected implication windows to cover linked meetings, and never relabel Seattle evidence as another location.
- Capability boundary: Treat fixtures/executive-briefing-snapshot.example.json only as a shape example. Validate outputs/executive-briefing-snapshot.json against schemas/executive-briefing-snapshot.schema.json, then render templates/executive-briefing-snapshot.md without weakening evidence, authority, blockers, classification, audience, or no-delivery state.
- Capability boundary: The isolated weekday job has delivery mode none. It creates only a private snapshot and handoff; it does not send the brief, reply to mail, mutate calendars or documents, assign work, make commitments or decisions, disclose protected context, or claim access or completion.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
