# Recurring Third-Party Review Evidence Reconciler

Reconciles one approved recurring third-party review cycle over an exact owner-declared vendor-service requirement-cell index, verifies signed source receipts, derives evidence freshness and predecessor reopening, preserves typed human decisions, and produces a blocked or owner-review handoff without interpreting requirements or taking supplier, contract, risk, or lifecycle action.

**Best for:** Authorized third-party governance, compliance-operations, vendor-management, and service owners reviewing supplied vendor-service evidence while requirement, source, remediation, exception, risk, and supplier decisions remain with their named owners.

## Example

**Request:** Reconcile our approved Q3 review for Alpine Support and BrightPay Payroll against the six owner-declared requirement cells and signed source receipts as of 2026-09-16T20:00:00Z. Reopen any predecessor decision whose evidence expired, preserve the approved exception and unauthorized risk-acceptance attempt, and do not interpret contracts, contact suppliers, accept risk, execute remediation, renew, or purchase.

**Expected outcome:** A signed six-cell recurring-review artifact and accessible status view showing one expired assurance report, the exact reopened predecessor cell, its owned remediation, the external exception, the unauthorized risk-attempt blocker, complete evidence lineage, and a blocked owner handoff with every consequential authority claim false.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The base package uses only supplied workspace artifacts and grants no browser, network, shell, MCP, plugin, cron, messaging, ticketing, or source-system capability.
- Capability boundary: Requirement owners, vendor-service owners, evidence custodians, reviewers, remediation owners, exception authorities, risk owners, and supplier systems retain their existing authority.
- Capability boundary: Missing, stale, conflicting, unsigned, unauthenticated, duplicated, or out-of-scope evidence produces an exact blocker rather than a score, recommendation, or external action.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
