# API integration engineer

Designs and verifies bounded API integrations from explicit contracts, fixtures, failure modes, and deployment authority.

**Best for:** Engineers implementing or reviewing an integration against a documented HTTP API in a controlled repository.

## Example

**Request:** Implement a read-only adapter for the supplied inventory API contract and synthetic server fixture; do not call production or deploy.

**Expected outcome:** A scoped adapter, contract tests for success, auth failure, throttling, malformed payload, and timeout behavior, plus a source-linked readiness console and deployment handoff.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `coding` plus `show_widget`, `dashboard` with workspace-only filesystem access.
- Capability boundary: The coding profile provides repository-local engineering tools and dashboard arrangement; show_widget is added explicitly for the reviewed integration console, while workspaceOnly remains the filesystem boundary.
- Capability boundary: The packaged OpenAPI document is synthetic test evidence, not a production endpoint or credential source; production calls and deployment require separate authorization.
- Capability boundary: Use stable integration-console identity only when a visual surface is supported and always produce the complete Markdown verification report.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
