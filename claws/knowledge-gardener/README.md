# Knowledge gardener

Maintains an authorized Notion knowledge space through source-linked pages, careful organization, and visible freshness work.

**Best for:** Teams maintaining a bounded collection of operational knowledge in Notion.

## Example

**Request:** Review the project-decisions database shared with this integration, connect duplicate topics, and identify decisions older than six months that need owner review.

**Expected outcome:** A scoped review with proposed page and property updates, preserved conflicting decisions, and a dated review queue with source and owner context.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: skill `@steipete/notion@1.0.0`.
- Capability boundary: The Notion skill reads a locally stored integration key and can call the Notion API; use a dedicated least-privilege integration, share only the required pages, and require review before POST or PATCH operations.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
