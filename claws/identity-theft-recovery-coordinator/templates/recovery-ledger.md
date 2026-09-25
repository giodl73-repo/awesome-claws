# Private identity-recovery ledger

> Owner-controlled working record. This ledger does not determine fraud, identify an actor, give professional advice, execute recovery steps, or establish that recovery is complete.

## Case boundary

- Case: `{{case.id}}`
- As of: `{{case.asOf}}`
- Revision: `{{case.revision}}`
- Accountable owner: `{{case.ownerAuthorityRef}}`
- Jurisdictions: `{{case.jurisdictions}}`
- Privacy ceiling: `{{case.privacyCeiling}}`

## Assertion-separated chronology

Render every event with its timestamp, surfaces, source references, and one of: owner-reported, institution-confirmed fact, official instruction, or independently receipted outcome. Never promote suspicion into a fraud determination.

## Affected identity surfaces

For each minimized surface, render its redacted identifier, institution, evidence-bound state, routes, actions, reports, disputes, institution decisions, and open gaps. Do not render full identifiers, credentials, secrets, or unredacted evidence.

## Official recovery routes and deadlines

Render each dated, revision-bound official route with jurisdiction, affected surfaces, owner-action candidates, disclosure class, and deadline. Mark all external execution as owner-only.

## Owner actions and independent receipts

Separate planned, attempted, failed, blocked, withdrawn, superseded, and owner-completed actions. An owner-completed external action must show an independent same-subject receipt; an owner note alone is not completion proof.

## Reports, disputes, and institution decisions

Render owner-filed or acknowledged reports and disputes only when their independent receipts support that state. Preserve institution decisions as institution-issued facts, never as the Claw's fraud conclusion.

## Residual gaps and contradictions

Render every open missing-evidence, missing-receipt, conflicting-state, route, jurisdiction, professional, institution, and residual-exposure gap with its affected surfaces, related records, and accountable owner.

## Owner handoff

- Decision: `{{review.decision}}`
- Next owner: `{{review.nextOwnerAuthorityRef}}`
- Missing-receipt actions: `{{review.missingReceiptActionRefs}}`
- Pending reports: `{{review.pendingReportRefs}}`
- Pending disputes: `{{review.pendingDisputeRefs}}`
- Pending institution decisions: `{{review.pendingDecisionRefs}}`
- Residual surfaces: `{{review.residualSurfaceRefs}}`
- Open gaps: `{{review.openGapRefs}}`

Keep all external contact, filing, account access, authentication, credential or account changes, alerts/freezes, payments, uploads, and submissions human-owned and outside this artifact.
