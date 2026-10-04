# Business continuity program cycle

## Exact critical-process universe

- Program / cycle: `{{program.id}}` / `{{program.cycleId}}`
- Current register: `{{program.currentRegisterRef}}` at `{{program.currentRegisterRevision}}`
- Predecessor register: `{{program.predecessorRegisterRef}}` at `{{program.predecessorRegisterRevision}}`
- Added, retained, revised, and retired process transitions:
  `{{processes[].changeKind}}` / `{{processes[].predecessorProcessRevision}}` /
  `{{registers[].retiredProcessRefs}}` / `{{registers[].retiredProcessRevisions}}`
- Stable process lineage: `{{processes[].stableKey}}`, `{{processes[].version}}`,
  predecessor identity/revision, and compatible owner scope
- Evidence bindings: `{{registers[].evidenceSourceDigest}}` /
  `{{registers[].evidencePayloadDigest}}`

## Business-impact analysis and owner-approved requirements

For every `{{businessImpactAnalyses[].processRef}}`, show the exact
`{{businessImpactAnalyses[].processRevision}}`, impact tier,
`{{businessImpactAnalyses[].rtoMinutes}}`, `{{businessImpactAnalyses[].rpoMinutes}}`,
named `{{businessImpactAnalyses[].approvedByRef}}`, approval time, evidence, and
content revision. These are owner approvals recorded by the Claw, never approvals
made by the Claw. Display the evidence source and payload digests carried into
each BIA revision.

## Service, vendor, site, facility, people, data, and process dependencies

Render `{{processes[].dependencyRefs}}` beside each process, then show every
dependency's kind, accountable owner, source revision, attestation time, evidence,
and `{{dependencies[].revision}}`. Missing or stale mappings remain blockers.

## Continuity-plan revision ledger

Show every supplied immutable predecessor from `{{planPredecessors}}`, then each
current plan's version and predecessor, exact process stable keys, versions,
BIA/dependency revisions, strategy codes, process-owner approval, separate
invocation authority, evidence, and `{{plans[].revision}}`. A recorded plan
version is not a plan invocation.

## Exercise scope, injects, evidence, and results

Show exact `{{exercises[].scopeProcessRevisions}}` and
`{{exercises[].planRevisions}}`, ordered `{{exercises[].injects}}`, complete
`{{exercises[].findingRefs}}`, approved scope, independent evaluator, evidence
source/payload digests, result, and exercise revision. Missing, cancelled, or
incomplete process/plan coverage remains blocked. An exercise result is not proof
of operational recoverability.

## Stable findings and corrective-action receipts

Show `{{findings[].stableKey}}`, exact finding revision, owner, and state. For each
corrective action show its bound finding revision, due date, state, externally
supplied `{{correctiveActions[].receiptRevision}}`, independent verifier, and
action revision. `verified-closed` is derived only from exactly one bound action
and its independent post-finding receipt evidence; never infer remediation from
a status label, plan edit, or self-authored evidence.

## Exceptions and independent recertification

Show exception scope, independent approver, approval time, expiry, evidence, and
`{{exceptions[].revision}}`. A revoked exception must also show its distinct
`{{exceptions[].revokedByRef}}`, revocation time, evidence source/payload digests,
and content-bound revision before its blocker can be removed. Active or expired
exceptions remain visible and do not certify the program. Show each
recertification's bound process, BIA, dependency, plan,
exercise, finding, action, and exception revisions plus independent recertifier,
time, decision, evidence, and `{{recertifications[].revision}}`.

## Exact blockers and coverage

- Coverage digest: `{{coverage.contentDigest}}`
- Blockers: `{{blockers[].category}}` / `{{blockers[].targetRefs}}`
- Handoff state: `{{handoff.state}}`
- Review owner: `{{handoff.ownerRef}}`

## Authority retained by owners

- Disaster declaration: `{{handoff.disasterDeclarationClaim}}`
- Plan invocation: `{{handoff.planInvocationClaim}}`
- Production failover: `{{handoff.productionFailoverClaim}}`
- Traffic shift: `{{handoff.trafficShiftClaim}}`
- Vendor contact: `{{handoff.vendorContactClaim}}`
- Risk acceptance: `{{handoff.riskAcceptanceClaim}}`
- Exception approval: `{{handoff.exceptionApprovalClaim}}`
- Readiness certification: `{{handoff.readinessCertificationClaim}}`
- Compliance certification: `{{handoff.complianceCertificationClaim}}`
- Continuity certification: `{{handoff.continuityCertificationClaim}}`

The X4 inline view is a visual projection of the same artifact. This Markdown
handoff is the durable X3 fallback and remains authoritative when rich rendering
is unavailable.
