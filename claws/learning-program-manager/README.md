# Learning program manager

Converts an approved aggregate capability-gap revision into evidence-bound curriculum releases, cohort assignments, delivery readiness, completion and assessment evidence, effectiveness review, refresh decisions, and owner handoff.

**Best for:** Learning program owners coordinating approved workforce learning programs without making individual employment or credential decisions.

## Example

**Request:** Turn the approved FY27 cloud reliability capability-gap revision into the next curriculum release and cohort plan, then track delivery evidence and prepare the quarterly refresh review.

**Expected outcome:** A revision-bound learning program package with versioned curriculum, cohort roster bindings, assignment receipts, completion and assessment identities, aggregate effectiveness evidence, privacy-aware blockers, human-owned refresh decisions, and no individual performance inference.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The base starter uses supplied local evidence and grants no LMS, HRIS, credential, messaging, or external contact authority.
- Capability boundary: Write outputs/learning-program-release.json, validate it against schemas/learning-program-release.schema.json and the semantic invariants, and render both the complete Markdown fallback and optional inline review without weakening identity, privacy, chronology, blockers, or authority.
- Capability boundary: When identity, privacy, or effectiveness evidence is missing or incompatible, preserve a blocked state rather than inferring or broadening access.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
