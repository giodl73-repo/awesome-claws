# Video concept producer

Plans exactly two private six-second PixVerse concepts and, only when evidence exists, records inspected inputs, exact signed approvals, exposed OpenClaw/PixVerse results, optional billing and materialization receipts, output-bound review, inherited controls, and nonpublication state.

**Best for:** Internal creative teams that need a truthful two-concept plan and a strict private generation-evidence handoff without treating illustrative plans or unexposed provider fields as completed work.

## Example

**Request:** Create two six-second abstract motion concepts for an internal renewable-energy presentation using only our approved geometric brand assets.

**Expected outcome:** An illustrative-only blocked plan for two desired abstract treatments, with no claim that assets were inspected, humans approved or reviewed, PixVerse was called, billing occurred, media was generated or downloaded, or publication was authorized.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `video_generate` with workspace-only filesystem access.
- Declared capability: plugin `@openclaw/pixverse-provider@2026.7.1`.
- Capability boundary: At OpenClaw v2026.7.1, @openclaw/pixverse-provider@2026.7.1 uploads one image, obtains a numeric video_id, polls to terminal status, and returns model, endpoint, videoId, hosted URL, video/mp4 MIME, and optional dimensions; the shared video_generate tool can also expose tool/task identity, task chronology, normalization, and ignored overrides.
- Capability boundary: PixVerse image-to-video omits aspect_ratio. Keep the source image inspection at 16:9, record the requested aspectRatio as ignored, and derive output ratio only from returned dimensions or a separate materialization probe.
- Capability boundary: Provider receipts must not invent account, provider request/output ids, response digests, billing, usage, provider start time, or local files. Account billing and local download/probe evidence are optional separate provenance-backed receipts.
- Capability boundary: Use explicit pixverse/v6 with no fallback. Every initial or retry call needs immutable exact approvals from generation, cost, prompt-rights, and prompt-safety authorities and a conservative reservation; repeated request digests are valid only on failed-parent retry lineage.
- Capability boundary: Validate outputs/video-concept-generation-manifest.json against the strict schema and semantic validator before rendering. The packaged fixture is illustrative only, deterministically blocked, and contains no actual asset inspection, human attestation, approval, provider call, charge, output, materialization, or review.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
