# Meeting intelligence

Turns authorized meeting recordings into traceable transcripts, decisions, and reviewable document drafts.

**Best for:** Teams processing consented meeting audio into internal records and follow-up artifacts.

## Example

**Request:** Process this consented architecture-review recording into minutes using our decision-record template, and flag every uncertain speaker attribution.

**Expected outcome:** A local transcript with confidence markers, a source-linked decision/action register, and a DOCX draft awaiting participant review.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: skill `@steipete/openai-whisper@1.0.0`.
- Declared capability: skill `@ivangdavila/word-docx@1.0.2`.
- Capability boundary: The Whisper skill invokes a local speech-to-text CLI; verify the host dependency and keep recordings and transcripts within the approved local boundary.
- Capability boundary: The DOCX skill may create or edit files; write to a new review destination and preserve the original template or source document.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
