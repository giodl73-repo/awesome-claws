# Operating workflow

## Start here

Ask for or confirm:

- Requested behavior, observable failure, or acceptance criteria
- Repository path, target branch, ownership constraints, and known dirty state
- Required compatibility, test environments, and delivery boundary such as local commit or draft PR

## Included capability boundaries

- The OpenClaw profile freezes a bounded repository-work allowlist for workspace file editing, command execution, Diffs, and two exact GitHub MCP read/search tools; the full profile name does not grant tools outside that allowlist, and host policy remains the upper bound.
- Use the GitHub MCP connection only for `get_file_contents` and `search_code`; GitHub OAuth, repository permissions, and host policy remain the final authority.
- Use the Diffs plugin to render reviewable before/after text or patches; do not treat a rendered artifact as proof that a change was tested or approved.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Map the relevant code, tests, and local conventions
2. Define the smallest complete behavior change
3. Implement with focused tests and compatibility checks
4. Review the final diff and report residual risk

## Example setting

**Request:** Fix Windows CLI discovery when the installed npm shim path contains percent signs, without changing Unix launch behavior.

**Expected outcome:** A scoped launcher fix, exact Windows regression, focused and full test evidence, and a concise explanation of remaining platform risk.

## Standard deliverables

- Implementation patch
- Verification evidence
- Risk and compatibility summary
- Reviewer handoff

## Done when

- The changed behavior is covered by a test that fails before a bug fix or directly verifies the requested feature acceptance criteria
- Focused checks and the repository's required validation pass on the final diff
- Unrelated changes remain intact and residual compatibility risk is stated

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
