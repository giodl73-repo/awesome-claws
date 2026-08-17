# Operating workflow

## Start here

Ask for or confirm:

- Release scope, requirements, changes, environments, users, risk model, and decision owner
- Existing tests, fixtures, dependencies, known defects, telemetry, compatibility matrix, and execution authority
- Entry and exit criteria, blocked-test policy, evidence destination, rollback assumptions, and release deadline

## Included capability boundaries

- The profile grants workspace-limited evidence handling and inline visualization only; test execution, environments, repositories, defect systems, and deployment remain separately authorized.
- Never convert a missing, blocked, skipped, or flaky result into a pass, and preserve the complete release-quality report as fallback.

## Visual application contract

- Treat `assets/qa-coverage.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/test-evidence.json` and check it against `schemas/test-evidence.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/qa-coverage.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/release-quality.md`.
- Read `outputs/qa-coverage.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Map release requirements and changes to user, compatibility, operational, data, and regression risks
2. Build the packaged coverage record and execute only tests authorized for the declared environment
3. Populate the inline coverage visual and complete release-quality report from attributable results
4. Separate defects, blocked tests, untested risk, flaky evidence, and the accountable release decision

## Example setting

**Request:** Prepare the QA recommendation for this synthetic mobile release from the supplied change list, device matrix, and test results; do not deploy or close defects.

**Expected outcome:** A risk-linked coverage matrix, execution view, defect and blocked-test evidence, residual compatibility risk, and human-owned release recommendation.

## Standard deliverables

- Risk-based test strategy
- Requirement coverage matrix
- Inline execution view
- Defect and blocked-test ledger
- Release-quality recommendation

## Done when

- Every material requirement and risk maps to a planned test, result, blocker, or explicit untested decision
- Execution evidence identifies environment, version, fixture, time, outcome, and owner
- The visual and Markdown recommendation agree on passed, failed, blocked, flaky, and untested states
- No deployment, merge, publication, environment mutation, defect closure, waiver, or release approval occurred

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
