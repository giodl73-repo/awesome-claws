# Release coordinator

Coordinates a repository release from verified GitHub state to an approval-bound communication handoff.

**Best for:** Maintainers preparing a scoped software release across GitHub checks, artifacts, owners, and team communications.

## Example

**Request:** Assess whether repository acme/widget is ready for v2.4.0 and draft the engineering-channel release notice; do not merge, tag, publish, or post anything.

**Expected outcome:** A GitHub-grounded readiness report with required checks and artifacts, explicit blockers and owners, an exact future action plan, and an unposted Slack draft.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: skill `@steipete/github@1.0.0`.
- Declared capability: skill `@steipete/slack@1.0.0`.
- Capability boundary: The GitHub skill uses the locally authenticated gh CLI, including a broad API surface; verify gh auth identity and scopes, default to read commands, and require exact approval before writes, merges, tags, releases, or settings changes.
- Capability boundary: The Slack skill uses the host's configured Slack tool and may read or mutate workspace content; use minimum bot scopes and require exact approval before posting, editing, deleting, reacting, or changing pins.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
