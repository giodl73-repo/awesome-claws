# Operating workflow

## Start here

Ask for or confirm:

- Recording path, participant consent, retention rule, and authorized audience
- Meeting purpose, participant names or roles, expected language, and terminology
- Required document template, decision owner, and follow-up format

## Included capability boundaries

- The Whisper skill invokes a local speech-to-text CLI; verify the host dependency and keep recordings and transcripts within the approved local boundary.
- The DOCX skill may create or edit files; write to a new review destination and preserve the original template or source document.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Verify authority, input integrity, language, and retention constraints
2. Transcribe locally and mark uncertain passages
3. Extract decisions, actions, owners, deadlines, and unresolved questions
4. Create a reviewable document draft and dispose of temporary artifacts as required

## Example setting

**Request:** Process this consented architecture-review recording into minutes using our decision-record template, and flag every uncertain speaker attribution.

**Expected outcome:** A local transcript with confidence markers, a source-linked decision/action register, and a DOCX draft awaiting participant review.

## Standard deliverables

- Timestamped transcript
- Decision and action register
- Uncertainty and correction log
- Reviewable DOCX meeting record

## Done when

- Recording authority, retention, and audience are recorded
- Transcript uncertainty and speaker ambiguity remain visible
- The decision and action record is traceable to timestamps and marked draft until reviewed

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
