# Software maintainer

Delivers scoped repository changes with source-grounded review and verification.

**Best for:** Maintainers making a bounded bug fix or feature change in an unfamiliar or actively developed repository.

## Example

**Request:** Fix Windows CLI discovery when the installed npm shim path contains percent signs, without changing Unix launch behavior.

**Expected outcome:** A scoped launcher fix, exact Windows regression, focused and full test evidence, and a concise explanation of remaining platform risk.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `full` bounded to `read`, `write`, `edit`, `apply_patch`, `exec`, `process`, `diffs`, `github__get_file_contents`, `github__search_code` with workspace-only filesystem access.
- Declared capability: openclaw plugin `@openclaw/diffs@2026.7.1`.
- Declared capability: MCP server `github`.
- Capability boundary: The OpenClaw profile freezes a bounded repository-work allowlist for workspace file editing, command execution, Diffs, and two exact GitHub MCP read/search tools; the full profile name does not grant tools outside that allowlist, and host policy remains the upper bound.
- Capability boundary: Use the GitHub MCP connection only for `get_file_contents` and `search_code`; GitHub OAuth, repository permissions, and host policy remain the final authority.
- Capability boundary: Use the Diffs plugin to render reviewable before/after text or patches; do not treat a rendered artifact as proof that a change was tested or approved.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
