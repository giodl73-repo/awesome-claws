# Operating workflow

## Start here

Ask for or confirm:

- Recording path and integrity, recording authority, per-participant consent scopes, retention rule, deletion owner, and authorized audience
- Meeting purpose, date, timezone, participant names, roles, attendance, expected language, and terminology
- Required document template, named decision owner and reviewer, and the private output destination

## Included capability boundaries

- The Whisper skill invokes a local speech-to-text CLI; verify the host dependency, keep recordings and transcripts within the approved local boundary, and expose low-confidence or unattributed speech rather than silently resolving it.
- The DOCX skill may create or edit files; write to a new review destination, preserve the original template and the source recording, and leave distribution to the named owner.
- The bounded OpenClaw profile keeps the minimal tool set plus workspace-only read, write, edit, and local command execution; it exists to run the local transcription CLI and write the review draft, not to reach the network, a calendar, or a task system.
- Treat fixtures/meeting-record.example.json only as a shape example. Validate outputs/meeting-record.json against schemas/meeting-record.schema.json, then render templates/meeting-record.md while preserving consent scopes, transcript offsets and confidence, correction lineage, decision authority, action acknowledgement, conflicts, gaps, and the owner-controlled handoff.

## Structured decision artifact contract

- Treat `fixtures/meeting-record.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/meeting-record.json` and check it against `schemas/meeting-record.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/meeting-record.md` at `outputs/meeting-intelligence-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Verify recording authority, per-participant consent scopes, source integrity, language, audience, and retention constraints
2. Transcribe locally with exact offsets, mark uncertain or unattributed speech, and withhold speech that consent does not cover
3. Build and validate outputs/meeting-record.json as a consent-bound ledger that separates deliberation from decisions, binds every action to transcript provenance, and preserves corrections, conflicts, and gaps
4. Render the meeting-record handoff, keep the document a review draft that preserves the original template and recording, and route every unresolved question and blocker to the named owner

## Example setting

**Request:** Process this consented architecture-review recording into minutes using our decision-record template, and flag every uncertain speaker attribution.

**Expected outcome:** A validated private meeting record with consent scopes per participant, offset-linked transcript segments and confidence markers, decisions separated from proposals, acknowledged actions, corrections and gaps, and a DOCX review draft awaiting the named owner.

## Standard deliverables

- Meeting authority, consent, audience, and retention record
- Timestamped transcript with attribution confidence and withheld passages
- Decision, dissent, and action register bound to transcript offsets
- Correction, conflict, question, and gap ledger
- Reviewable DOCX meeting record awaiting owner review

## Done when

- Recording authority, per-participant consent scope, audience, retention, deletion owner, and output destination are explicit
- Transcript uncertainty, unattributed speech, withheld passages, and correction lineage remain visible
- Every decision and action names a human, cites transcript offsets, and stays draft until the named reviewer confirms it
- The machine-readable record validates against schemas/meeting-record.schema.json before the handoff is presented

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
