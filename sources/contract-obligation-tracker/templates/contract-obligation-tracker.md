# Contract obligation review

Use this template only to render a validated
`contract-obligation-tracker.schema.json` artifact. Copy exact machine-record
values. Do not add interpretation, advice, recommendation, action, assurance,
acceptance, or legal conclusions.

## Round and trust roots

| Field | Value |
| --- | --- |
| Schema version / artifact | `{{schemaVersion}}` / `{{artifactId}}` |
| Round | `{{round.id}}` |
| Register | `{{round.registerRef}}` / `{{round.registerVersion}}` / `{{round.registerDigest}}` |
| Agreement versions | `{{round.agreementVersionRefs}}` |
| Authority roster | `{{round.authorityRosterRef}}` / `{{round.authorityRosterDigest}}` |
| Window | `{{round.opensAt}}` through `{{round.closesAt}}` |
| Destination | `{{round.destination}}` |
| Destination approver / handoff owner | `{{round.destinationApproverRef}}` / `{{round.handoffOwnerRef}}` |
| Round digest | `{{round.roundDigest}}` |

The digest graph proves internal consistency only. Reviewers must independently
verify these external trust roots: `sourceRecordDigest authenticity`; owner
confirmation of register completeness and reseal authorization; authority-roster
authenticity; the caller-supplied `asOf`; executed-agreement completeness; and
owner-supplied clause and obligation semantics.

## Executed agreements

Render one row per `agreements` record.

| Version record | Logical agreement / version | Executed at | Repository | Agreement content digest | Source evidence |
| --- | --- | --- | --- | --- | --- |
| `{{agreements[].id}}` | `{{agreements[].agreementId}}` / `{{agreements[].version}}` | `{{agreements[].executedAt}}` | `{{agreements[].repositoryRef}}` | `{{agreements[].contentDigest}}` | `{{agreements[].sourceEvidenceRef}}` |

## Owner-confirmed obligation register

| Field | Value |
| --- | --- |
| Register / version | `{{register.id}}` / `{{register.version}}` |
| Confirmed at / by | `{{register.confirmedAt}}` / `{{register.confirmedByRef}}` |
| Source system | `{{register.sourceSystemRef}}` |
| Agreement-version index | `{{register.agreementVersionRefs}}` |
| Obligation index | `{{register.obligationRefs}}` |
| Content digest | `{{register.contentDigest}}` |
| Evidence | `{{register.evidenceRef}}` |

## Obligation ledger

Render one row per `obligations` record. Clause and obligation digests are
owner-supplied semantic identities, not interpretations made by this Claw.

| Obligation | Agreement version | Clause locator / digest | Obligation digest | Responsible owner | Due at | Performance supplier | Required evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `{{obligations[].id}}` | `{{obligations[].agreementVersionRef}}` | `{{obligations[].clauseLocator}}` / `{{obligations[].clauseDigest}}` | `{{obligations[].obligationDigest}}` | `{{obligations[].responsibleOwnerRef}}` | `{{obligations[].dueAt}}` | `{{obligations[].performanceEvidenceSupplierRef}}` | `{{obligations[].requiredEvidenceRefs}}` |

## Principals, roster, and grants

Render one row per `principals` record.

| Principal | Name | Kind | Scopes |
| --- | --- | --- | --- |
| `{{principals[].id}}` | `{{principals[].name}}` | `{{principals[].kind}}` | `{{principals[].scopes}}` |

| Roster / version | Issued at | Custodian | Principal index | Content digest | Evidence |
| --- | --- | --- | --- | --- | --- |
| `{{authorityRoster.id}}` / `{{authorityRoster.version}}` | `{{authorityRoster.issuedAt}}` | `{{authorityRoster.custodianRef}}` | `{{authorityRoster.principalRefs}}` | `{{authorityRoster.contentDigest}}` | `{{authorityRoster.evidenceRef}}` |

Render one row per `authorityGrants` record.

| Grant | Exact obligation | Grantee / issuer | Scope | Active interval | Roster binding | Evidence | Payload digest |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `{{authorityGrants[].id}}` | `{{authorityGrants[].obligationRef}}` | `{{authorityGrants[].granteeRef}}` / `{{authorityGrants[].issuedByRef}}` | `{{authorityGrants[].scope}}` | `{{authorityGrants[].activeFrom}}` through `{{authorityGrants[].activeUntil}}` | `{{authorityGrants[].rosterRef}}` / `{{authorityGrants[].rosterDigest}}` | `{{authorityGrants[].evidenceRef}}` | `{{authorityGrants[].payloadDigest}}` |

## Evidence ledger

Render one row per `evidence` record. Preserve all three digests so external
source authenticity remains distinguishable from internal payload and record
closure.

| Evidence | Kind | Round binding | Observed at | Supplier | Subjects | External source digest | Payload digest | Record digest |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `{{evidence[].id}}` | `{{evidence[].kind}}` | `{{evidence[].roundRef}}` / `{{evidence[].roundDigest}}` | `{{evidence[].observedAt}}` | `{{evidence[].suppliedByRef}}` | `{{evidence[].subjectRefs}}` | `{{evidence[].sourceRecordDigest}}` | `{{evidence[].payloadDigest}}` | `{{evidence[].recordDigest}}` |

## Current observations

Render one row per `observations` record. Due state is sealed to
`round.closesAt`, not the later validation time.

| Observation | Obligation | Agreement / clause / obligation binding | Owner | State / due state | Observed at | Relied evidence | Observation evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `{{observations[].id}}` | `{{observations[].obligationRef}}` | `{{observations[].agreementVersionRef}}` / `{{observations[].clauseDigest}}` / `{{observations[].obligationDigest}}` | `{{observations[].ownerRef}}` | `{{observations[].state}}` / `{{observations[].dueState}}` | `{{observations[].observedAt}}` | `{{observations[].reliedEvidenceRefs}}` | `{{observations[].observationEvidenceRef}}` |

Render completion as `null` where absent. Where present, render every field.

| Observation completion | Confirmed by / at | Exact grant | Confirmation evidence |
| --- | --- | --- | --- |
| `{{observations[].id}}` / `{{observations[].completion}}` | `{{observations[].completion.confirmedByRef}}` / `{{observations[].completion.confirmedAt}}` | `{{observations[].completion.authorityGrantRef}}` | `{{observations[].completion.confirmationEvidenceRef}}` |

## Exact blockers

Render one row per `blockers` record. The missing-evidence index must equal the
validator-derived missing set exactly.

| Blocker | Obligation | Category | Detected at | Owner | Exact missing evidence | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `{{blockers[].id}}` | `{{blockers[].obligationRef}}` | `{{blockers[].category}}` | `{{blockers[].detectedAt}}` | `{{blockers[].ownerRef}}` | `{{blockers[].exactMissingEvidenceRefs}}` | `{{blockers[].evidenceRef}}` |

## Exact coverage

| Register / version / digest | Coverage digest |
| --- | --- |
| `{{coverage.registerRef}}` / `{{coverage.registerVersion}}` / `{{coverage.registerDigest}}` | `{{coverage.contentDigest}}` |

Render one row per `coverage.entries` record.

| Obligation | Resolution kind | Resolution reference |
| --- | --- | --- |
| `{{coverage.entries[].obligationRef}}` | `{{coverage.entries[].resolutionKind}}` | `{{coverage.entries[].resolutionRef}}` |

## Approved destination

| Approval | Round / digest | Register / digest | Coverage digest | Destination | Approver / time | Evidence | Payload digest |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `{{destinationApproval.id}}` | `{{destinationApproval.roundRef}}` / `{{destinationApproval.roundDigest}}` | `{{destinationApproval.registerRef}}` / `{{destinationApproval.registerDigest}}` | `{{destinationApproval.coverageDigest}}` | `{{destinationApproval.destination}}` | `{{destinationApproval.approvedByRef}}` / `{{destinationApproval.approvedAt}}` | `{{destinationApproval.evidenceRef}}` | `{{destinationApproval.payloadDigest}}` |

## Owner handoff and structural not-claims

| Field | Value |
| --- | --- |
| Handoff | `{{handoff.id}}` |
| Round / digest | `{{handoff.roundRef}}` / `{{handoff.roundDigest}}` |
| Register / digest | `{{handoff.registerRef}}` / `{{handoff.registerDigest}}` |
| Coverage digest | `{{handoff.coverageDigest}}` |
| Destination approval | `{{handoff.destinationApprovalRef}}` / `{{handoff.destinationApprovalDigest}}` |
| State / next owner / time | `{{handoff.state}}` / `{{handoff.nextOwnerRef}}` / `{{handoff.handedOffAt}}` |
| Observation index | `{{handoff.observationRefs}}` |
| Blocker index | `{{handoff.blockerRefs}}` |
| Legal conclusion | `{{handoff.legalConclusionClaim}}` |
| Performance acceptance | `{{handoff.performanceAcceptanceClaim}}` |
| Compliance | `{{handoff.complianceClaim}}` |
| Audit | `{{handoff.auditClaim}}` |
| Notice sent | `{{handoff.noticeSentClaim}}` |
| Payment made | `{{handoff.paymentMadeClaim}}` |
| Amendment | `{{handoff.amendmentClaim}}` |
| Renewal | `{{handoff.renewalClaim}}` |
| Termination | `{{handoff.terminationClaim}}` |
| System mutation | `{{handoff.systemMutationClaim}}` |
| Evidence / payload digest | `{{handoff.evidenceRef}}` / `{{handoff.payloadDigest}}` |

`ready-for-owner-review` means only that this bounded record has exact coverage,
valid evidence bindings, and no blocker. It does not mean a contractual
interpretation was made, performance was accepted, a notice was sent, a payment
was made, an agreement changed, or any owner system was mutated.
