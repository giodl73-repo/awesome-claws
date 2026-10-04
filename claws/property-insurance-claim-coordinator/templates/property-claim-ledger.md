# Private property-insurance claim ledger

> Owner-controlled working record. This ledger does not determine coverage, cause, fault, liability, value, depreciation, deductible applicability, safety, entitlement, settlement, repair sufficiency, or claim closure, and it does not take external action.

## Claim boundary

- Claim: `{{claim.id}}`
- Policy reference: `{{claim.policyRefRedacted}}`
- Claim reference: `{{claim.claimRefRedacted}}`
- Loss discovered: `{{claim.lossDiscoveredAt}}`
- As of: `{{claim.asOf}}`
- Revision: `{{claim.revision}}`
- Accountable owner: `{{claim.ownerAuthorityRef}}`
- Carrier authority: `{{claim.carrierAuthorityRef}}`
- Jurisdictions: `{{claim.jurisdictions}}`
- Privacy ceiling: `{{claim.privacyCeiling}}`

## Assertion-separated chronology

Render every event with its exact timestamp, affected property, source references, and assertion state. Keep owner reports, qualified observations, official instructions, carrier-issued facts, and independently receipted outcomes separate. Never turn attributed evidence into a Claw coverage, cause, damage, or safety determination.

## Affected property

For each minimized property unit, render its redacted identifier, evidence-bound state, events, official requirements, owner actions, estimates, carrier positions, payments, repair or replacement records, owner decisions, and open gaps. Never render precise addresses, full serials, credentials, payment data, secrets, or unredacted evidence.

## Official requirements and deadlines

Render every dated, revision-bound official requirement with its carrier authority, jurisdiction, affected property, owner-action candidates, disclosure class, state, and deadline. Retain superseded instructions and mark every external step as owner-only.

## Owner actions and independent receipts

Separate planned, attempted, failed, blocked, withdrawn, superseded, and owner-completed actions. An owner-completed external action must show an independent same-subject receipt issued no earlier than the attempt; an owner note alone is not completion proof.

## Estimates, carrier positions, and payments

Render contractor and carrier estimates as attributed scopes, not valuations or recommendations. Render carrier positions only as carrier-issued facts. Show payment statements and exact property allocations without claiming receipt, acceptance, entitlement, settlement, or adequacy unless the corresponding evidence and owner decision exist—and never as a Claw conclusion.

## Mitigation, repair, replacement, and owner decisions

Render provider records, receipts, owner authorization evidence, and owner decisions at exact affected-property scope. Distinguish provider-reported completion from owner verification, and never infer safety, repair sufficiency, authorization, or closure.

## Residual gaps and contradictions

Render every open missing-evidence, missing-receipt, scope or estimate difference, pending carrier position, payment question, safety or professional question, repair question, deadline risk, and residual-exposure gap with affected property, related records, and accountable owner.

## Owner handoff

- Decision: `{{review.decision}}`
- Next owner: `{{review.nextOwnerAuthorityRef}}`
- Open requirements: `{{review.openRequirementRefs}}`
- Missing-receipt actions: `{{review.missingReceiptActionRefs}}`
- Pending carrier positions: `{{review.pendingCarrierPositionRefs}}`
- Announced payments: `{{review.announcedPaymentRefs}}`
- Unverified repair records: `{{review.unverifiedRepairRecordRefs}}`
- Residual property: `{{review.residualPropertyUnitRefs}}`
- Open gaps: `{{review.openGapRefs}}`

Keep carrier contact, claim filing or amendment, evidence submission, scheduling, settlement decisions, check endorsement, work authorization, payments, purchases, salvage disposal, and account or policy changes human-owned and outside this artifact.
