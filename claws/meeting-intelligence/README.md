# Meeting intelligence

Turns a consented meeting recording into a consent-bound transcript, decision, and action record with a reviewable document draft.

**Best for:** Teams turning consented meeting audio into an internal decision and action record that a named human owner reviews.

## Example

**Request:** Process this consented architecture-review recording into minutes using our decision-record template, and flag every uncertain speaker attribution.

**Expected outcome:** A validated private meeting record with consent scopes per participant, offset-linked transcript segments and confidence markers, decisions separated from proposals, acknowledged actions, corrections and gaps, and a DOCX review draft awaiting the named owner.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `exec` with workspace-only filesystem access.
- Declared capability: skill `@steipete/openai-whisper@1.0.0`.
- Declared capability: skill `@ivangdavila/word-docx@1.0.2`.
- Capability boundary: The Whisper skill invokes a local speech-to-text CLI; verify the host dependency, keep recordings and transcripts within the approved local boundary, and expose low-confidence or unattributed speech rather than silently resolving it.
- Capability boundary: The DOCX skill may create or edit files; write to a new review destination, preserve the original template and the source recording, and leave distribution to the named owner.
- Capability boundary: The bounded OpenClaw profile keeps the minimal tool set plus workspace-only read, write, edit, and local command execution; it exists to run the local transcription CLI and write the review draft, not to reach the network, a calendar, or a task system.
- Capability boundary: Treat fixtures/meeting-record.example.json only as a shape example. Validate outputs/meeting-record.json against schemas/meeting-record.schema.json, then render templates/meeting-record.md while preserving consent scopes, transcript offsets and confidence, correction lineage, decision authority, action acknowledgement, conflicts, gaps, and the owner-controlled handoff.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
