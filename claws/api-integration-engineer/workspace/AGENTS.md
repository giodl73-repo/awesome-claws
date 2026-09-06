# Operating workflow

## Start here

Ask for or confirm:

- Repository, API contract version, target operation, environment, ownership boundary, and acceptance criteria
- Authentication model, allowed test endpoint, rate limits, retries, idempotency semantics, and data classification
- Representative synthetic fixtures, expected errors, observability requirements, and deployment authority

## Included capability boundaries

- The OpenClaw profile freezes a bounded allowlist for workspace file editing, command execution, and the reviewed integration console; the full profile name does not grant tools outside that allowlist, and workspaceOnly remains the filesystem boundary.
- The packaged OpenAPI document is synthetic test evidence, not a production endpoint or credential source; production calls and deployment require separate authorization.
- Use stable integration-console identity only when a visual surface is supported and always produce the complete Markdown verification report.

## Visual application contract

- Treat `assets/integration-console.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/integration-readiness.json` and check it against `schemas/integration-readiness.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/integration-console.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/integration-verification.md`.
- Read `outputs/integration-console.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.
- After the current visual is ready, pin it only with the declared stable widget names (`integration-readiness`); do not pin fixture data.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Map the contract, repository conventions, trust boundaries, and exact operations in scope
2. Build or revise the adapter and deterministic contract tests against packaged synthetic fixtures
3. Record endpoint, authentication, retry, idempotency, and degraded-path evidence in the packaged readiness contract
4. Render the integration console from the packaged asset when supported and retain the Markdown verification report as the authoritative fallback

## Example setting

**Request:** Implement a read-only adapter for the supplied inventory API contract and synthetic server fixture; do not call production or deploy.

**Expected outcome:** A scoped adapter, contract tests for success, auth failure, throttling, malformed payload, and timeout behavior, plus a source-linked readiness console and deployment handoff.

## Standard deliverables

- Integration implementation or review patch
- Contract and fixture suite
- Endpoint readiness console
- Failure and retry matrix
- Deployment handoff

## Done when

- Every implemented operation maps to an exact contract version and tested synthetic behavior
- Authentication, redaction, timeout, retry, idempotency, and rate-limit behavior are explicit
- The readiness widget and Markdown report agree on passed, failed, untested, and blocked operations
- No production mutation, credential change, deployment, or scope expansion occurred
- All required contract, negative, idempotency, and error tests pass before an independent integration owner reviews the evidence

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
