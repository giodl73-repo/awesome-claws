# Operating workflow

## Start here

Ask for or confirm:

- One approved current review cycle and one independently signed predecessor cycle with caller-controlled asOf
- Owner-approved requirement catalog, exact vendor-service applicability cells, and content-bound revision digests
- Vendor-service and shared-subprocessor manifests signed by their typed owners
- Evidence-kind freshness rules plus signed source receipts binding exact source bytes, references, versions, and digests
- Current and predecessor typed-human decisions with exact cell, revision, evidence, remediation, and exception bindings
- Typed principals, one open remediation, one external exception, and any preserved unauthorized risk-acceptance attempt

## Included capability boundaries

- The base package uses only supplied workspace artifacts and grants no browser, network, shell, MCP, plugin, cron, messaging, ticketing, or source-system capability.
- Requirement owners, vendor-service owners, evidence custodians, reviewers, remediation owners, exception authorities, risk owners, and supplier systems retain their existing authority.
- Missing, stale, conflicting, unsigned, unauthenticated, duplicated, or out-of-scope evidence produces an exact blocker rather than a score, recommendation, or external action.

## Visual application contract

- Treat `assets/third-party-review-status.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/recurring-third-party-review-evidence-reconciler.json` and check it against `schemas/recurring-third-party-review-evidence-reconciler.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/third-party-review-status.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/third-party-review-handoff.md`.
- Read `outputs/third-party-review-status.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Validate the complete bounded artifact and caller context before reading any review state
2. Verify the current envelope, predecessor artifact, catalog manifest, service manifests, and source receipt signatures against disjoint trusted public keys
3. Recompute catalog, applicability-cell, freshness-rule, predecessor-artifact, exception-scope, and immutable-cell digests
4. Derive every evidence expiry at caller asOf and reopen exactly those predecessor cells whose relied evidence expired without replacement
5. Require one typed current human decision per declared cell and preserve exact remediation, exception, and unauthorized-attempt blockers
6. Render the exact evidence state, reopened cells, blockers, authority non-claims, and next human owner in Markdown and an accessible inline review

## Example setting

**Request:** Reconcile our approved Q3 review for Alpine Support and BrightPay Payroll against the six owner-declared requirement cells and signed source receipts as of 2026-09-16T20:00:00Z. Reopen any predecessor decision whose evidence expired, preserve the approved exception and unauthorized risk-acceptance attempt, and do not interpret contracts, contact suppliers, accept risk, execute remediation, renew, or purchase.

**Expected outcome:** A signed six-cell recurring-review artifact and accessible status view showing one expired assurance report, the exact reopened predecessor cell, its owned remediation, the external exception, the unauthorized risk-attempt blocker, complete evidence lineage, and a blocked owner handoff with every consequential authority claim false.

## Standard deliverables

- Signed review-cycle, owner-manifest, source-receipt, principal, evidence, and decision ledgers
- Exact six-cell vendor-service requirement coverage index with immutable cell and revision bindings
- Caller-time evidence-freshness ledger with effective expiry and predecessor reopening
- Typed remediation, external exception, and unauthorized risk-attempt blocker register
- Accessible recurring-review status view with a complete Markdown fallback and blocked or owner-review handoff

## Done when

- Every catalog, cell-index, freshness-rule, predecessor, owner-manifest, source-receipt, and cell digest or signature validates exactly
- Every declared cell appears exactly once in both predecessor and current decision coverage with one typed named-human reviewer
- Every evidence record has one exact authenticated source receipt and a deterministic current or expired state at caller asOf
- Every expired predecessor decision without replacement is reopened with the exact expired evidence and one owned remediation
- The handoff exposes every blocker and keeps contract interpretation, source production, certification, risk acceptance, remediation execution, supplier contact, renewal, and purchase authority false

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
