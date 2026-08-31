# Meeting intelligence session handoff

Create `outputs/meeting-record.json` first and validate it against
`schemas/meeting-record.schema.json`. Render `templates/meeting-record.md` at
`outputs/meeting-intelligence-handoff.md`; keep both artifacts private and bound
to the authorized audience.

The session handoff is a consent-bound meeting evidence job. It must name the
meeting and run identity, purpose, named human decision owner and reviewer,
date, time, and timezone, source recording identity, digest, and path, each
participant's role, attendance, and consent scope, the authorized audience,
retention policy, deletion owner, and private destination, every transcript
segment with exact offsets, attribution state, confidence, uncertainty, and
correction lineage, every deliberation separated from every decision, every
action with its provenance, acknowledgement, due date, timezone, status, and
dependencies, and every unresolved question, parked topic, conflict, gap, and
blocker. It must not infer consent or agreement, invent a speaker or a
quotation, send messages, schedule meetings, create tasks, delete source
material, or distribute the record.
