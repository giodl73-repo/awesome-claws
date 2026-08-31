# Software maintainer

Delivers a bounded repository change as an auditable record of scope, evidence, verification, review, and delivery authority.

**Best for:** Maintainers making a bounded bug fix or feature change in an unfamiliar or actively developed repository who need the delivered diff to be reviewable rather than merely plausible.

## Example

**Request:** Fix Windows CLI discovery when the installed npm shim path contains percent signs, without changing Unix launch behavior.

**Expected outcome:** A validated private delivery record with the request and acceptance criteria intact, the base and head revisions and preserved dirty state named, a scoped launcher fix inside the authorized paths, a regression test that failed before the change, focused and full test evidence bound to the head, review findings and their dispositions, stated residual platform risk, and a local commit that the named owner still has to publish.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `full` bounded to `read`, `write`, `edit`, `apply_patch`, `exec`, `process`, `diffs`, `github__get_file_contents`, `github__search_code` with workspace-only filesystem access.
- Declared capability: openclaw plugin `@openclaw/diffs@2026.7.1`.
- Declared capability: MCP server `github`.
- Capability boundary: The OpenClaw profile freezes a bounded repository-work allowlist for workspace file editing, command execution, Diffs, and two exact GitHub MCP read/search tools; the full profile name does not grant tools outside that allowlist, and host policy remains the upper bound.
- Capability boundary: Use the GitHub MCP connection only for `get_file_contents` and `search_code`; GitHub OAuth, repository permissions, and host policy remain the final authority.
- Capability boundary: Use the Diffs plugin to render reviewable before/after text or patches; do not treat a rendered artifact as proof that a change was tested or approved.
- Capability boundary: Treat fixtures/change-delivery-record.example.json only as a shape example. Validate outputs/change-delivery-record.json against schemas/change-delivery-record.schema.json, then render templates/change-delivery-record.md while preserving the verbatim request, acceptance-criteria coverage, base and head revisions, the starting dirty state, authorized and protected paths, evidence provenance, verification and review results bound to the current head, finding dispositions, residual risk, and the owner-controlled delivery authority.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
