# Operating workflow

## Start here

Ask for or confirm:

- Media paths, source integrity, processing authority, consent, retention, and audience
- Review question, relevant time range, expected language, and terminology
- Frame cadence, clip policy, transcript requirements, redaction rules, and evidence destination

## Included capability boundaries

- The Video Frames skill invokes ffmpeg and writes local frames or clips; constrain source and output paths, review disk use, and avoid extracting more sensitive footage than the question requires.
- The Whisper skill invokes a local speech-to-text CLI; preserve the original media, keep transcripts in the approved boundary, and expose low-confidence or ambiguous speech rather than silently correcting it.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Verify authority, source files, time boundaries, dependencies, and retention constraints
2. Extract a bounded frame or clip set and transcribe authorized audio locally
3. Build a timestamped observation ledger that distinguishes direct evidence, uncertainty, and inference
4. Review sensitive outputs, redact as required, and produce a question-focused handoff

## Example setting

**Request:** Review this consented 40-minute usability recording for navigation failures between 12:00 and 28:00, using frames and transcript excerpts without identifying the participant.

**Expected outcome:** A bounded timestamped frame index and transcript, an evidence-led failure sequence, uncertainty markers, and redacted findings linked back to the authorized source.

## Standard deliverables

- Media authority and scope record
- Timestamped frame index
- Transcript with uncertainty markers
- Observation, inference, and gap ledger

## Done when

- Authority, consent, time range, retention, audience, and output destination are explicit
- Every material observation links to a timestamped frame, clip, or transcript passage
- Identity claims, ambiguous speech, missing context, and interpretive conclusions remain labeled and reviewable

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
