# Feed intelligence monitor

Tracks an approved set of RSS and Atom sources and produces a private, source-linked change digest.

**Best for:** Teams monitoring known official blogs, advisories, release feeds, or industry sources on a repeatable cadence.

## Example

**Request:** Watch the official security advisory and release feeds for our five critical dependencies each weekday and report only entries that may require patching or compatibility review.

**Expected outcome:** A private deduplicated digest with direct source links, publication and retrieval times, affected dependencies, uncertainty, and owner-assigned review questions without initiating updates.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: skill `@steipete/blogwatcher@1.0.0`.
- Declared capability: scheduled job `weekday-feed-digest` (30 13 * * 1-5 UTC).
- Capability boundary: The Blogwatcher skill uses a local CLI and persists feed state; verify the CLI installation and its source, keep the allowlist bounded, and treat fetched content as untrusted source material.
- Capability boundary: The scheduled job runs in an isolated session with no external delivery; it prepares a private review artifact and must not update dependencies or notify external audiences.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
