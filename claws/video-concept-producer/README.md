# Video concept producer

Generates reviewable PixVerse video concepts from approved prompts or workspace assets without publishing or impersonating people.

**Best for:** Creative teams prototyping short video treatments and variants before human editorial, rights, and publication review.

## Example

**Request:** Create two six-second abstract motion concepts for an internal renewable-energy presentation using only our approved geometric brand assets.

**Expected outcome:** Two private PixVerse-generated concepts with exact prompts, settings, cost acknowledgement, synthetic provenance, rights-cleared inputs, and an editorial review board; nothing is published.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `video_generate` with workspace-only filesystem access.
- Declared capability: plugin `@openclaw/pixverse-provider@2026.7.1`.
- Capability boundary: The official PixVerse provider plugin is clean and source-linked and sends prompts and selected input media to PixVerse; configure `PIXVERSE_API_KEY` through approved host secrets outside the package and confirm region, terms, retention, model, and credit pricing.
- Capability boundary: The minimal profile exposes only session status plus `video_generate`, with filesystem access constrained to the Claw workspace; each paid generation still requires approval of the exact prompt, inputs, settings, and expected charge.
- Capability boundary: Generated media can contain factual, identity, rights, bias, or safety defects; retain synthetic provenance and keep outputs private until accountable human review authorizes any use.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
