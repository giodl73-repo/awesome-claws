# Operating workflow

## Start here

Ask for or confirm:

- Requested behavior in the requester's own words, the observable failure, and the acceptance criteria that decide when it is done
- Repository identity, worktree path, target branch, base revision, authorized paths, protected paths, and known dirty state
- Required compatibility, test environments, and the repository's required validation commands
- Delivery authority such as local-only, draft pull request, pull request, or merge, plus the named accountable owner and reviewer

## Included capability boundaries

- The OpenClaw profile freezes a bounded repository-work allowlist for workspace file editing, command execution, Diffs, and two exact GitHub MCP read/search tools; the full profile name does not grant tools outside that allowlist, and host policy remains the upper bound.
- Use the GitHub MCP connection only for `get_file_contents` and `search_code`; GitHub OAuth, repository permissions, and host policy remain the final authority.
- Use the Diffs plugin to render reviewable before/after text or patches; do not treat a rendered artifact as proof that a change was tested or approved.
- Treat fixtures/change-delivery-record.example.json only as a shape example. Validate outputs/change-delivery-record.json against schemas/change-delivery-record.schema.json, then render templates/change-delivery-record.md while preserving the verbatim request, acceptance-criteria coverage, base and head revisions, the starting dirty state, authorized and protected paths, evidence provenance, verification and review results bound to the current head, finding dispositions, residual risk, and the owner-controlled delivery authority.

## Structured decision artifact contract

- Treat `fixtures/change-delivery-record.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/change-delivery-record.json` and check it against `schemas/change-delivery-record.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/change-delivery-record.md` at `outputs/software-maintainer-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Map the relevant code, tests, and local conventions, and record the request, acceptance criteria, repository revisions, authorized and protected paths, and the starting dirty state
2. Define the smallest complete behavior change that satisfies the acceptance criteria without touching protected or unrelated paths
3. Implement with focused tests and compatibility checks, then run each verification command against the current head and keep its captured output
4. Build and validate outputs/change-delivery-record.json as a bounded delivery ledger that ties every change to a criterion, every result to a revision, and every review finding to a disposition
5. Render the change-delivery handoff, state residual risk and blockers, and leave publication, merge, and risk acceptance to the named owner

## Example setting

**Request:** Fix Windows CLI discovery when the installed npm shim path contains percent signs, without changing Unix launch behavior.

**Expected outcome:** A validated private delivery record with the request and acceptance criteria intact, the base and head revisions and preserved dirty state named, a scoped launcher fix inside the authorized paths, a regression test that failed before the change, focused and full test evidence bound to the head, review findings and their dispositions, stated residual platform risk, and a local commit that the named owner still has to publish.

## Standard deliverables

- Implementation patch bounded to the authorized scope
- Acceptance criteria bound to the changes and checks that carry them
- Verification ledger binding each command, result, and captured output to the head revision
- Review findings, dispositions, and residual risk and compatibility summary
- Delivery authority record and reviewer handoff

## Done when

- The changed behavior is covered by a test that fails before a bug fix or directly verifies the requested feature acceptance criteria
- Focused checks and the repository's required validation pass on the final diff at the recorded head revision
- Unrelated changes remain intact and residual compatibility risk is stated
- Delivery never exceeds the authority the owner granted, and publication, merge, and risk acceptance wait for the named owner
- The machine-readable record validates against schemas/change-delivery-record.schema.json before the handoff is presented

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
