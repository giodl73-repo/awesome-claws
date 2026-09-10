# TLS certificate rotation verification handoff

Render only a validated `tls-certificate-rotation.schema.json` artifact.
Copy exact metadata values. Never read, request, or reproduce private keys,
certificate bodies, issuance secrets, or endpoint credentials.

## Round, campaign, and objective

| Field | Value |
| --- | --- |
| Schema / artifact | `{{schemaVersion}}` / `{{artifactId}}` |
| Round / requested | `{{round.id}}` / `{{round.requestedAt}}` |
| Approved campaign / version | `{{round.campaignRef}}` / `{{round.campaignVersion}}` |
| Campaign coordinator | `{{round.campaignCoordinatorRef}}` |
| Certificate export | `{{round.certificateExportRef}}` / `{{round.certificateExportDigest}}` |
| Binding export | `{{round.bindingExportRef}}` / `{{round.bindingExportDigest}}` |
| Authority roster | `{{round.authorityRosterRef}}` / `{{round.authorityRosterDigest}}` |
| Plan digest | `{{round.planDigest}}` |

The caller supplies trusted `asOf`; deterministic validation never reads the
wall clock. A retirement or revocation observation is admissible only after every
binding of that predecessor is deployed and independently validated. Otherwise
the predecessor stays in a current approver-authored time-bounded overlap and a
blocker is raised.

## Exact predecessor certificate inventory

| Export | Exported at | Supplier | Exact certificates | Evidence | Content digest |
| --- | --- | --- | --- | --- | --- |
| `{{certificateExport.id}}` | `{{certificateExport.exportedAt}}` | `{{certificateExport.suppliedByRef}}` | `{{certificateExport.certificateRefs}}` | `{{certificateExport.evidenceRef}}` | `{{certificateExport.contentDigest}}` |

Render one row per `certificates` record.

| Certificate | Owner system | Class | Rotate or exclude | Exclusion reason | External source digest | Payload digest |
| --- | --- | --- | --- | --- | --- | --- |
| `{{certificates[].id}}` | `{{certificates[].ownerSystemRef}}` | `{{certificates[].certificateClass}}` | `{{certificates[].rotationState}}` | `{{certificates[].exclusionReason}}` | `{{certificates[].sourceRecordDigest}}` | `{{certificates[].payloadDigest}}` |

## Exact service / listener / endpoint binding inventory

| Export | Exported at | Supplier | Exact bindings | Evidence | Content digest |
| --- | --- | --- | --- | --- | --- |
| `{{bindingExport.id}}` | `{{bindingExport.exportedAt}}` | `{{bindingExport.suppliedByRef}}` | `{{bindingExport.bindingRefs}}` | `{{bindingExport.evidenceRef}}` | `{{bindingExport.contentDigest}}` |

| Binding | Certificate | Service | Listener | Endpoint locator digest | External source digest | Payload digest |
| --- | --- | --- | --- | --- | --- | --- |
| `{{bindings[].id}}` | `{{bindings[].certificateRef}}` | `{{bindings[].serviceRef}}` | `{{bindings[].listenerRef}}` | `{{bindings[].endpointLocatorDigest}}` | `{{bindings[].sourceRecordDigest}}` | `{{bindings[].payloadDigest}}` |

## Owner-approved rotation requests

Exactly one request per rotate predecessor; none for excluded predecessors.

| Request | Certificate / digest | Campaign / version | Approver / grant / time | Evidence | Payload digest |
| --- | --- | --- | --- | --- | --- |
| `{{rotationRequests[].id}}` | `{{rotationRequests[].certificateRef}}` / `{{rotationRequests[].certificatePayloadDigest}}` | `{{rotationRequests[].campaignRef}}` / `{{rotationRequests[].approvedVersion}}` | `{{rotationRequests[].requestedByRef}}` / `{{rotationRequests[].authorityGrantRef}}` / `{{rotationRequests[].requestedAt}}` | `{{rotationRequests[].evidenceRef}}` | `{{rotationRequests[].payloadDigest}}` |

## CA / provider issuance outcomes

Provider issuance success is never deployment or endpoint success and is never
borrowable across requests. A pending, failed, or missing issuance is a derived
blocker, never a successful no-op.

| Issuance | Request / digest | Provider / operation id | Submitted / decided | Outcome | Successor logical / version | Evidence | Payload digest |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `{{issuances[].id}}` | `{{issuances[].rotationRequestRef}}` / `{{issuances[].rotationRequestPayloadDigest}}` | `{{issuances[].providerRef}}` / `{{issuances[].providerOperationId}}` | `{{issuances[].submittedAt}}` / `{{issuances[].decidedAt}}` | `{{issuances[].outcome}}` | `{{issuances[].successorLogicalId}}` / `{{issuances[].successorVersionId}}` | `{{issuances[].evidenceRef}}` | `{{issuances[].payloadDigest}}` |

## Successor deployment observations

| Deployment | Binding / digest | Request / issuance / digest | Successor version | Observer | Observed | Outcome | Evidence | Payload digest |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `{{deployments[].id}}` | `{{deployments[].bindingRef}}` / `{{deployments[].bindingPayloadDigest}}` | `{{deployments[].rotationRequestRef}}` / `{{deployments[].issuanceRef}}` / `{{deployments[].issuancePayloadDigest}}` | `{{deployments[].successorVersionId}}` | `{{deployments[].observerRef}}` | `{{deployments[].observedAt}}` | `{{deployments[].outcome}}` | `{{deployments[].evidenceRef}}` | `{{deployments[].payloadDigest}}` |

## Independent endpoint fingerprint and chain observations

The endpoint validator is separated from the deployment observer and from the
CA/provider. A `match` requires a `deployed` observation of the exact successor
version. A `fingerprint-mismatch`, `chain-failed`, or combined failure outcome derives
each applicable blocker independently.

| Observation | Deployment / digest | Binding | Independent validator | Expected successor | Observed | Outcome / checks | Evidence | Payload digest |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `{{endpointObservations[].id}}` | `{{endpointObservations[].deploymentRef}}` / `{{endpointObservations[].deploymentPayloadDigest}}` | `{{endpointObservations[].bindingRef}}` | `{{endpointObservations[].validatorRef}}` | `{{endpointObservations[].expectedSuccessorVersionId}}` | `{{endpointObservations[].observedAt}}` | `{{endpointObservations[].outcome}}` / `{{endpointObservations[].checkCodes}}` | `{{endpointObservations[].evidenceRef}}` | `{{endpointObservations[].payloadDigest}}` |

## Retirement, revocation, and approved temporary overlap

Retirement or revocation is admissible only after all bindings validate. A
predecessor left in a current approver-authored time-bounded overlap raises an
`overlap-retained` blocker until every binding validates.

| Retirement | Certificate / digest | Observer | Observed | Outcome | Evidence | Payload digest |
| --- | --- | --- | --- | --- | --- | --- |
| `{{retirements[].id}}` | `{{retirements[].certificateRef}}` / `{{retirements[].certificatePayloadDigest}}` | `{{retirements[].observerRef}}` | `{{retirements[].observedAt}}` | `{{retirements[].outcome}}` | `{{retirements[].evidenceRef}}` | `{{retirements[].payloadDigest}}` |

| Overlap | Certificate / digest | Approver / grant | Declared / until | State | Evidence | Payload digest |
| --- | --- | --- | --- | --- | --- | --- |
| `{{overlaps[].id}}` | `{{overlaps[].certificateRef}}` / `{{overlaps[].certificatePayloadDigest}}` | `{{overlaps[].approvedByRef}}` / `{{overlaps[].authorityGrantRef}}` | `{{overlaps[].declaredAt}}` / `{{overlaps[].overlapUntil}}` | `{{overlaps[].state}}` | `{{overlaps[].evidenceRef}}` | `{{overlaps[].payloadDigest}}` |

## Roles, grants, and evidence chronology

| Authority roster | Issued at | Custodian | Evidence | Content digest |
| --- | --- | --- | --- | --- |
| `{{authorityRoster.id}}` | `{{authorityRoster.issuedAt}}` | `{{authorityRoster.custodianRef}}` | `{{authorityRoster.evidenceRef}}` | `{{authorityRoster.contentDigest}}` |

| Principal | Name | Kind | Scopes |
| --- | --- | --- | --- |
| `{{principals[].id}}` | `{{principals[].name}}` | `{{principals[].kind}}` | `{{principals[].scopes}}` |

| Grant | Grantee | Issuer | Scope / round | Active interval | Roster binding | Evidence | Payload digest |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `{{authorityGrants[].id}}` | `{{authorityGrants[].granteeRef}}` | `{{authorityGrants[].issuedByRef}}` | `{{authorityGrants[].scope}}` / `{{authorityGrants[].roundRef}}` | `{{authorityGrants[].activeFrom}}` / `{{authorityGrants[].activeUntil}}` | `{{authorityGrants[].rosterRef}}` / `{{authorityGrants[].rosterDigest}}` | `{{authorityGrants[].evidenceRef}}` | `{{authorityGrants[].payloadDigest}}` |

| Evidence | Kind | Observed / supplier | Subjects | External source digest | Payload / record digest |
| --- | --- | --- | --- | --- | --- |
| `{{evidence[].id}}` | `{{evidence[].kind}}` | `{{evidence[].observedAt}}` / `{{evidence[].suppliedByRef}}` | `{{evidence[].subjectRefs}}` | `{{evidence[].sourceRecordDigest}}` | `{{evidence[].payloadDigest}}` / `{{evidence[].recordDigest}}` |

External `sourceRecordDigest` authenticity, certificate and binding inventory
completeness, provider issuance outcomes, deployment truth, endpoint procedure,
overlap authorization, and caller `asOf` remain owner-controlled trust roots.
Internal digests prove consistency, not truth.

## Exact blockers

| Blocker | Certificate | Category | Exact subjects | Detected / owner | Evidence | Payload digest |
| --- | --- | --- | --- | --- | --- | --- |
| `{{blockers[].id}}` | `{{blockers[].certificateRef}}` | `{{blockers[].category}}` | `{{blockers[].subjectRefs}}` | `{{blockers[].detectedAt}}` / `{{blockers[].ownerRef}}` | `{{blockers[].evidenceRef}}` | `{{blockers[].payloadDigest}}` |

## Content-bound coverage, destination, and handoff

| Coverage field | Exact value |
| --- | --- |
| Certificates | `{{coverage.certificateRefs}}` |
| Rotate / exclude | `{{coverage.rotateCertificateRefs}}` / `{{coverage.excludeCertificateRefs}}` |
| Bindings / requests | `{{coverage.bindingRefs}}` / `{{coverage.rotationRequestRefs}}` |
| Issuances / deployments | `{{coverage.issuanceRefs}}` / `{{coverage.deploymentRefs}}` |
| Endpoints / retirements / overlaps | `{{coverage.endpointObservationRefs}}` / `{{coverage.retirementRefs}}` / `{{coverage.overlapRefs}}` |
| Blockers | `{{coverage.blockerRefs}}` |
| Plan / coverage digest | `{{coverage.planDigest}}` / `{{coverage.contentDigest}}` |

| Destination approval | Coverage / destination | Approver / grant / time | Evidence / payload digest |
| --- | --- | --- | --- |
| `{{destinationApproval.id}}` | `{{destinationApproval.coverageDigest}}` / `{{destinationApproval.destination}}` | `{{destinationApproval.approvedByRef}}` / `{{destinationApproval.authorityGrantRef}}` / `{{destinationApproval.approvedAt}}` | `{{destinationApproval.evidenceRef}}` / `{{destinationApproval.payloadDigest}}` |

| Handoff field | Value |
| --- | --- |
| Handoff / state | `{{handoff.id}}` / `{{handoff.state}}` |
| Next owner / grant / time | `{{handoff.nextOwnerRef}}` / `{{handoff.authorityGrantRef}}` / `{{handoff.handedOffAt}}` |
| Plan / coverage / destination roots | `{{handoff.planDigest}}` / `{{handoff.coverageDigest}}` / `{{handoff.destinationApprovalDigest}}` |
| Destination approval evidence root | `{{handoff.destinationApprovalEvidenceDigest}}` |
| Requests / issuances / deployments | `{{handoff.rotationRequestRefs}}` / `{{handoff.issuanceRefs}}` / `{{handoff.deploymentRefs}}` |
| Endpoints / retirements / overlaps | `{{handoff.endpointObservationRefs}}` / `{{handoff.retirementRefs}}` / `{{handoff.overlapRefs}}` |
| Blockers | `{{handoff.blockerRefs}}` |
| Private key / certificate body access | `{{handoff.privateKeyAccessClaim}}` / `{{handoff.certificateBodyAccessClaim}}` |
| Issuance / deployment execution | `{{handoff.issuanceExecutionClaim}}` / `{{handoff.deploymentExecutionClaim}}` |
| Listener-route / restart / revocation | `{{handoff.listenerRouteChangeClaim}}` / `{{handoff.restartClaim}}` / `{{handoff.revocationClaim}}` |
| Disable / deletion / external communication | `{{handoff.disableClaim}}` / `{{handoff.deletionClaim}}` / `{{handoff.externalCommunicationClaim}}` |
| Readiness / identity / security | `{{handoff.readinessClaim}}` / `{{handoff.identityAssuranceClaim}}` / `{{handoff.securityAssuranceClaim}}` |
| Compliance / audit / rotation completion | `{{handoff.complianceClaim}}` / `{{handoff.auditClaim}}` / `{{handoff.rotationCompletionClaim}}` |
| Evidence / payload digest | `{{handoff.evidenceRef}}` / `{{handoff.payloadDigest}}` |

`ready-for-owner-review` means only that this metadata artifact is internally
complete and blocker-free. It does not claim that any issuance, deployment,
listener or route change, restart, revocation, disable, deletion, retirement,
readiness, identity, security, compliance, audit, or rotation completion result
was performed or independently proven by this Claw.
