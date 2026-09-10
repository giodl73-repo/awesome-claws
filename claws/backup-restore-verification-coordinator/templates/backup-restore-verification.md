# Backup restore verification handoff

Render only a validated `backup-restore-verification.schema.json` artifact.
Copy exact metadata values. Never inspect or reproduce backup content, credentials,
provider locators, or restored data.

## Round and objective math

| Field | Value |
| --- | --- |
| Schema / artifact | `{{schemaVersion}}` / `{{artifactId}}` |
| Round / requested | `{{round.id}}` / `{{round.requestedAt}}` |
| RPO / RTO minutes | `{{round.rpoMinutes}}` / `{{round.rtoMinutes}}` |
| Derived RPO cutoff | `{{recoveryPointExport.cutoffAt}}` |
| Resource export | `{{round.protectedResourceExportRef}}` / `{{round.protectedResourceExportDigest}}` |
| Recovery-point export | `{{round.recoveryPointExportRef}}` / `{{round.recoveryPointExportDigest}}` |
| Authority roster | `{{round.authorityRosterRef}}` / `{{round.authorityRosterDigest}}` |
| Plan digest | `{{round.planDigest}}` |

The caller supplies trusted `asOf`; deterministic validation never reads the
wall clock. RPO is measured from `round.requestedAt` to recovery-point capture.
RTO starts at the selected triple's own provider restore job `submittedAt` and
ends at that triple's successful independent validation `completedAt`.

## Exact protected-resource universe

| Export | Exported at | Supplier | Exact resources | Evidence | Content digest |
| --- | --- | --- | --- | --- | --- |
| `{{protectedResourceExport.id}}` | `{{protectedResourceExport.exportedAt}}` | `{{protectedResourceExport.suppliedByRef}}` | `{{protectedResourceExport.resourceRefs}}` | `{{protectedResourceExport.evidenceRef}}` | `{{protectedResourceExport.contentDigest}}` |

Render one row per `resources` record.

| Resource | Owner system | Class | Selected or excluded | Exclusion reason | External source digest | Payload digest |
| --- | --- | --- | --- | --- | --- | --- |
| `{{resources[].id}}` | `{{resources[].ownerSystemRef}}` | `{{resources[].resourceClass}}` | `{{resources[].selectionState}}` | `{{resources[].exclusionReason}}` | `{{resources[].sourceRecordDigest}}` | `{{resources[].payloadDigest}}` |

## Eligible recovery-point export

| Export | Exported / cutoff | Supplier | Exact eligible points | Evidence | Content digest |
| --- | --- | --- | --- | --- | --- |
| `{{recoveryPointExport.id}}` | `{{recoveryPointExport.exportedAt}}` / `{{recoveryPointExport.cutoffAt}}` | `{{recoveryPointExport.suppliedByRef}}` | `{{recoveryPointExport.recoveryPointRefs}}` | `{{recoveryPointExport.evidenceRef}}` | `{{recoveryPointExport.contentDigest}}` |

| Recovery point | Resource | Provider | Captured | Eligibility | External source digest | Payload digest |
| --- | --- | --- | --- | --- | --- | --- |
| `{{recoveryPoints[].id}}` | `{{recoveryPoints[].resourceRef}}` | `{{recoveryPoints[].providerRef}}` | `{{recoveryPoints[].capturedAt}}` | `{{recoveryPoints[].eligibility}}` | `{{recoveryPoints[].sourceRecordDigest}}` | `{{recoveryPoints[].payloadDigest}}` |

## Selected resource / recovery-point / isolated-target triples

| Selection | Resource / digest | Recovery point / digest | Isolated target / digest | Selector / grant / time | Evidence | Payload digest |
| --- | --- | --- | --- | --- | --- | --- |
| `{{selections[].id}}` | `{{selections[].resourceRef}}` / `{{selections[].resourcePayloadDigest}}` | `{{selections[].recoveryPointRef}}` / `{{selections[].recoveryPointPayloadDigest}}` | `{{selections[].targetRef}}` / `{{selections[].targetPayloadDigest}}` | `{{selections[].selectedByRef}}` / `{{selections[].authorityGrantRef}}` / `{{selections[].selectedAt}}` | `{{selections[].evidenceRef}}` | `{{selections[].payloadDigest}}` |

| Target | Provider | Isolation | Locator digest | External source digest | Evidence | Payload digest |
| --- | --- | --- | --- | --- | --- | --- |
| `{{targets[].id}}` | `{{targets[].providerRef}}` | `{{targets[].isolation}}` | `{{targets[].locatorDigest}}` | `{{targets[].sourceRecordDigest}}` | `{{targets[].evidenceRef}}` | `{{targets[].payloadDigest}}` |

## Provider restore-job outcomes

Absence of a job row for a selected triple is a derived
`provider-job-missing` blocker, never a successful no-op.

| Job | Selection / digest | Provider / provider job | Submitted / completed | Outcome | Evidence | Payload digest |
| --- | --- | --- | --- | --- | --- | --- |
| `{{providerJobs[].id}}` | `{{providerJobs[].selectionRef}}` / `{{providerJobs[].selectionPayloadDigest}}` | `{{providerJobs[].providerRef}}` / `{{providerJobs[].providerJobRef}}` | `{{providerJobs[].submittedAt}}` / `{{providerJobs[].completedAt}}` | `{{providerJobs[].outcome}}` | `{{providerJobs[].evidenceRef}}` | `{{providerJobs[].payloadDigest}}` |

## Independent validation

| Validation | Selection / digest | Provider job / digest | Independent validator | Started / completed | Outcome / checks | Evidence | Payload digest |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `{{validations[].id}}` | `{{validations[].selectionRef}}` / `{{validations[].selectionPayloadDigest}}` | `{{validations[].providerJobRef}}` / `{{validations[].providerJobPayloadDigest}}` | `{{validations[].validatorRef}}` | `{{validations[].startedAt}}` / `{{validations[].completedAt}}` | `{{validations[].outcome}}` / `{{validations[].checkCodes}}` | `{{validations[].evidenceRef}}` | `{{validations[].payloadDigest}}` |

## Exact cleanup and temporary retention

| Cleanup | Selection / digest | Target / digest | Owner | Requested / completed | Outcome | Retention reason / until / approver | Evidence | Payload digest |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `{{cleanups[].id}}` | `{{cleanups[].selectionRef}}` / `{{cleanups[].selectionPayloadDigest}}` | `{{cleanups[].targetRef}}` / `{{cleanups[].targetPayloadDigest}}` | `{{cleanups[].ownerRef}}` | `{{cleanups[].requestedAt}}` / `{{cleanups[].completedAt}}` | `{{cleanups[].outcome}}` | `{{cleanups[].retentionReason}}` / `{{cleanups[].retentionUntil}}` / `{{cleanups[].retentionApprovedByRef}}` / `{{cleanups[].retentionApprovalEvidenceRef}}` | `{{cleanups[].evidenceRef}}` | `{{cleanups[].payloadDigest}}` |

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

External `sourceRecordDigest` authenticity, source-export completeness,
recovery-point eligibility, provider outcomes, validation procedure, target
isolation, cleanup execution, retention authorization, and caller `asOf` remain
owner-controlled trust roots. Internal digests prove consistency, not truth.

## Exact blockers

| Blocker | Selection | Category | Exact targets | Detected / owner | Evidence | Payload digest |
| --- | --- | --- | --- | --- | --- | --- |
| `{{blockers[].id}}` | `{{blockers[].selectionRef}}` | `{{blockers[].category}}` | `{{blockers[].targetRefs}}` | `{{blockers[].detectedAt}}` / `{{blockers[].ownerRef}}` | `{{blockers[].evidenceRef}}` | `{{blockers[].payloadDigest}}` |

## Content-bound coverage, destination, and handoff

| Coverage field | Exact value |
| --- | --- |
| Resources | `{{coverage.resourceRefs}}` |
| Selected / excluded | `{{coverage.selectedResourceRefs}}` / `{{coverage.excludedResourceRefs}}` |
| Recovery points / triples / targets | `{{coverage.recoveryPointRefs}}` / `{{coverage.selectionRefs}}` / `{{coverage.targetRefs}}` |
| Jobs / validations / cleanups | `{{coverage.providerJobRefs}}` / `{{coverage.validationRefs}}` / `{{coverage.cleanupRefs}}` |
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
| Triples / jobs / validations | `{{handoff.selectedTripleRefs}}` / `{{handoff.providerJobRefs}}` / `{{handoff.validationRefs}}` |
| Cleanups / blockers | `{{handoff.cleanupRefs}}` / `{{handoff.blockerRefs}}` |
| Restore / validation / cleanup execution | `{{handoff.restoreExecutionClaim}}` / `{{handoff.validationExecutionClaim}}` / `{{handoff.cleanupExecutionClaim}}` |
| Production / recoverability / verification completion | `{{handoff.productionReadinessClaim}}` / `{{handoff.recoverabilityClaim}}` / `{{handoff.verificationCompletionClaim}}` |
| Compliance / audit / failover / deletion | `{{handoff.complianceClaim}}` / `{{handoff.auditClaim}}` / `{{handoff.failoverClaim}}` / `{{handoff.deletionClaim}}` |
| Evidence / payload digest | `{{handoff.evidenceRef}}` / `{{handoff.payloadDigest}}` |

`ready-for-owner-review` means only that this metadata artifact is internally
complete and blocker-free. It does not claim that a restore, validation,
cleanup, failover, deletion, production recovery, audit, or compliance result
was performed or independently proven by this Claw.
