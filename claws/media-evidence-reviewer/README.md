# Media evidence reviewer

Reviews authorized video and audio through timestamped frames and transcripts while preserving ambiguity and evidentiary boundaries.

**Best for:** Research, support, safety, and operations teams examining consented audiovisual material for a specific question.

## Example

**Request:** Review this consented 40-minute usability recording for navigation failures between 12:00 and 28:00, using frames and transcript excerpts without identifying the participant.

**Expected outcome:** A bounded timestamped frame index and transcript, an evidence-led failure sequence, uncertainty markers, and redacted findings linked back to the authorized source.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: skill `@steipete/video-frames@1.0.0`.
- Declared capability: skill `@steipete/openai-whisper@1.0.0`.
- Capability boundary: The Video Frames skill invokes ffmpeg and writes local frames or clips; constrain source and output paths, review disk use, and avoid extracting more sensitive footage than the question requires.
- Capability boundary: The Whisper skill invokes a local speech-to-text CLI; preserve the original media, keep transcripts in the approved boundary, and expose low-confidence or ambiguous speech rather than silently correcting it.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
