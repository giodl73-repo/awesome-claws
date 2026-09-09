# Financial account reconciliation

Use this template only to render a validated
`financial-account-reconciliation.schema.json` artifact. Copy values from the
machine record; do not add prose, actions, assurances, inferred matches,
tolerances, foreign-exchange conversions, accounting treatment, or close
claims to that record. Render only schema-valid principal names; the schema
excludes Markdown table and code-span delimiters plus line breaks.

## Round and source binding

| Field | Value |
| --- | --- |
| Schema version | `{{schemaVersion}}` |
| Round | `{{round.id}}` |
| Prior round | `{{round.priorRoundRef}}` |
| Account | `{{round.accountId}}` |
| Currency | `{{round.currency}}` |
| Period | `{{round.period.startsOn}}` through `{{round.period.endsOn}}` |
| Cutoff | `{{round.cutoffAt}}` |
| Review window | `{{round.reviewWindow.opensAt}}` through `{{round.reviewWindow.closesAt}}` |
| Balance convention | `{{round.balanceConvention}}` |
| Authority roster | `{{round.authorityRosterRef}}` |
| Ledger export | `{{ledgerExport.id}}` / `{{ledgerExport.rowManifestDigest}}` / `{{ledgerExport.sourceEvidenceRootDigest}}` |
| Statement export | `{{statementExport.id}}` / `{{statementExport.rowManifestDigest}}` / `{{statementExport.sourceEvidenceRootDigest}}` |
| Round root | `{{round.roundRootDigest}}` |

Render the destination approval in full.

| Destination approval | Round | Account / currency | Destination / visibility | Approver / time | Roster digest | Grant / payload digest | Grant evidence ref / digest / controlled ref | Round root | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `{{round.destination.id}}` | `{{round.destination.roundRef}}` | `{{round.destination.accountId}}` / `{{round.destination.currency}}` | `{{round.destination.controlledRef}}` / `{{round.destination.visibility}}` | `{{round.destination.approvedByRef}}` / `{{round.destination.approvedAt}}` | `{{round.destination.authorityRosterDigest}}` | `{{round.destination.authorityGrantRef}}` / `{{round.destination.authorityGrantPayloadDigest}}` | `{{round.destination.authorityGrantEvidenceRef}}` / `{{round.destination.authorityGrantEvidenceDigest}}` / `{{round.destination.authorityGrantEvidenceControlledRef}}` | `{{round.destination.roundRootDigest}}` | `{{round.destination.evidenceRef}}` |

Render both source exports in full.

| Export | Round | Side | Source system | Account / currency | Period / cutoff | Exported at | Rows | Manifest digest | Source-evidence root | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `{{ledgerExport.id}}` | `{{ledgerExport.roundRef}}` | `{{ledgerExport.side}}` | `{{ledgerExport.sourceSystemRef}}` | `{{ledgerExport.accountId}}` / `{{ledgerExport.currency}}` | `{{ledgerExport.period.startsOn}}` through `{{ledgerExport.period.endsOn}}` / `{{ledgerExport.cutoffAt}}` | `{{ledgerExport.exportedAt}}` | `{{ledgerExport.rowRefs}}` | `{{ledgerExport.rowManifestDigest}}` | `{{ledgerExport.sourceEvidenceRootDigest}}` | `{{ledgerExport.evidenceRef}}` |
| `{{statementExport.id}}` | `{{statementExport.roundRef}}` | `{{statementExport.side}}` | `{{statementExport.sourceSystemRef}}` | `{{statementExport.accountId}}` / `{{statementExport.currency}}` | `{{statementExport.period.startsOn}}` through `{{statementExport.period.endsOn}}` / `{{statementExport.cutoffAt}}` | `{{statementExport.exportedAt}}` | `{{statementExport.rowRefs}}` | `{{statementExport.rowManifestDigest}}` | `{{statementExport.sourceEvidenceRootDigest}}` | `{{statementExport.evidenceRef}}` |

## Principals and authority

| Roster | Round | Account / currency | Custodian | Principals | Issued at | Roster digest | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `{{authorityRoster.id}}` | `{{authorityRoster.roundRef}}` | `{{authorityRoster.accountId}}` / `{{authorityRoster.currency}}` | `{{authorityRoster.custodianRef}}` | `{{authorityRoster.principalRefs}}` | `{{authorityRoster.issuedAt}}` | `{{authorityRoster.rosterDigest}}` | `{{authorityRoster.evidenceRef}}` / `{{authorityRoster.controlledRef}}` |

Render one row per `principals` record.

| Principal | Name | Kind | Scopes |
| --- | --- | --- | --- |
| `{{principals[].id}}` | `{{principals[].name}}` | `{{principals[].kind}}` | `{{principals[].scopes}}` |

Render one row per `authorityGrants` record.

| Grant | Round | Account / currency | Grantee / digest | Issuer / digest | Scopes | Issued / active window | Roster binding | Roster evidence binding | Grant evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `{{authorityGrants[].id}}` | `{{authorityGrants[].roundRef}}` | `{{authorityGrants[].accountId}}` / `{{authorityGrants[].currency}}` | `{{authorityGrants[].granteeRef}}` / `{{authorityGrants[].granteePrincipalDigest}}` | `{{authorityGrants[].issuedByRef}}` / `{{authorityGrants[].issuerPrincipalDigest}}` | `{{authorityGrants[].scopes}}` | `{{authorityGrants[].issuedAt}}` / `{{authorityGrants[].activeFrom}}` through `{{authorityGrants[].activeUntil}}` | `{{authorityGrants[].authorityRosterRef}}` / `{{authorityGrants[].authorityRosterDigest}}` | `{{authorityGrants[].authorityRosterEvidenceRef}}` / `{{authorityGrants[].authorityRosterEvidenceDigest}}` / `{{authorityGrants[].authorityRosterEvidenceControlledRef}}` | `{{authorityGrants[].evidenceRef}}` |

## Evidence ledger

Render one row per `evidence` record. Preserve the controlled reference and both
digests so a reviewer can trace every authority, source, decision, residual,
destination, and handoff binding.

| Evidence | Kind | Source / purpose | Controlled reference | Payload / record digest | Observed at | Supplier | Subjects |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `{{evidence[].id}}` | `{{evidence[].kind}}` | `{{evidence[].controlledSource}}` / `{{evidence[].controlledPurpose}}` | `{{evidence[].controlledRef}}` | `{{evidence[].payloadDigest}}` / `{{evidence[].recordDigest}}` | `{{evidence[].observedAt}}` | `{{evidence[].suppliedByRef}}` | `{{evidence[].subjectRefs}}` |

## Source-row ledgers

Render every `ledgerRows` and `statementRows` record. Signed minor-unit amounts
must remain decimal integer strings under
`owner-normalized-account-balance-effect`.

| Ledger row | Round / export | Account / currency | Source-native id | Effective date | Signed minor units | Convention | Row digest | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `{{ledgerRows[].id}}` | `{{ledgerRows[].roundRef}}` / `{{ledgerRows[].exportRef}}` | `{{ledgerRows[].accountId}}` / `{{ledgerRows[].currency}}` | `{{ledgerRows[].sourceNativeId}}` | `{{ledgerRows[].effectiveDate}}` | `{{ledgerRows[].minorUnits}}` | `{{ledgerRows[].balanceConvention}}` | `{{ledgerRows[].rowDigest}}` | `{{ledgerRows[].evidenceRef}}` |

| Statement row | Round / export | Account / currency | Source-native id | Effective date | Signed minor units | Convention | Row digest | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `{{statementRows[].id}}` | `{{statementRows[].roundRef}}` / `{{statementRows[].exportRef}}` | `{{statementRows[].accountId}}` / `{{statementRows[].currency}}` | `{{statementRows[].sourceNativeId}}` | `{{statementRows[].effectiveDate}}` | `{{statementRows[].minorUnits}}` | `{{statementRows[].balanceConvention}}` | `{{statementRows[].rowDigest}}` | `{{statementRows[].evidenceRef}}` |

## Two-sided coverage

Render every value from these exact indexes and verify that each source row
appears once in either one match group or one residual.

| Side | All source rows | Matched rows | Residual rows |
| --- | --- | --- | --- |
| Ledger | `{{coverage.ledgerRowRefs}}` | `{{coverage.matchedLedgerRowRefs}}` | `{{coverage.residualLedgerRowRefs}}` |
| Statement | `{{coverage.statementRowRefs}}` | `{{coverage.matchedStatementRowRefs}}` | `{{coverage.residualStatementRowRefs}}` |

Coverage groups: `{{coverage.groupRefs}}`

Coverage residuals: `{{coverage.residualRefs}}`

Coverage record: `{{coverage.id}}` / `{{coverage.roundRef}}`

## Match groups

Render one row per `matchGroups` record.

| Group | Round / account / currency | Cardinality | Ledger rows | Statement rows | Reconciler / grant | Decision time | Decision evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `{{matchGroups[].id}}` | `{{matchGroups[].roundRef}}` / `{{matchGroups[].accountId}}` / `{{matchGroups[].currency}}` | `{{matchGroups[].cardinality}}` | `{{matchGroups[].ledgerRowRefs}}` | `{{matchGroups[].statementRowRefs}}` | `{{matchGroups[].decision.decidedByRef}}` / `{{matchGroups[].decision.authorityGrantRef}}` | `{{matchGroups[].decision.decidedAt}}` | `{{matchGroups[].decision.evidenceRef}}` |

Only `1:1`, `1:n`, and `n:1` groups are representable. Display signed
minor-unit values in the source-row ledgers. For every group reference, resolve
exactly one source-row ledger entry by exact `id`, preserve group reference
order, and recompute each side with exact integer arithmetic. Do not display a
group as accepted unless both totals are equal; fail rendering on a missing or
duplicate lookup.

Render one row per match decision so every transitive authority and source
binding remains reviewable.

| Decision | Round | Decider / time | Roster digest | Grant / payload digest | Grant evidence ref / digest / controlled ref | Ledger / statement manifests | Round root | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `{{matchGroups[].decision.id}}` | `{{matchGroups[].decision.roundRef}}` | `{{matchGroups[].decision.decidedByRef}}` / `{{matchGroups[].decision.decidedAt}}` | `{{matchGroups[].decision.authorityRosterDigest}}` | `{{matchGroups[].decision.authorityGrantRef}}` / `{{matchGroups[].decision.authorityGrantPayloadDigest}}` | `{{matchGroups[].decision.authorityGrantEvidenceRef}}` / `{{matchGroups[].decision.authorityGrantEvidenceDigest}}` / `{{matchGroups[].decision.authorityGrantEvidenceControlledRef}}` | `{{matchGroups[].decision.ledgerManifestDigest}}` / `{{matchGroups[].decision.statementManifestDigest}}` | `{{matchGroups[].decision.roundRootDigest}}` | `{{matchGroups[].decision.evidenceRef}}` |

## Residuals

Render one row per `residuals` record. Residual presence is compatible with
`ready-for-owner-review`; it is not evidence of resolution or immateriality.

| Residual | Round | Side | Source row | Reason | Recorder | Recorded at | Next owner | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `{{residuals[].id}}` | `{{residuals[].roundRef}}` | `{{residuals[].side}}` | `{{residuals[].rowRef}}` | `{{residuals[].reason}}` | `{{residuals[].recordedByRef}}` | `{{residuals[].recordedAt}}` | `{{residuals[].nextOwnerRef}}` | `{{residuals[].evidenceRef}}` |

| Residual | Account / currency | Ledger / statement manifests | Round root |
| --- | --- | --- | --- |
| `{{residuals[].id}}` | `{{residuals[].accountId}}` / `{{residuals[].currency}}` | `{{residuals[].ledgerManifestDigest}}` / `{{residuals[].statementManifestDigest}}` | `{{residuals[].roundRootDigest}}` |

## Blockers

Render one row per `blockers` record. The list must equal the validator-derived
category and target-id sets exactly; do not add, omit, merge, or reinterpret a
blocker.

| Blocker | Round | Category | Exact targets | Owner | Raised at | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `{{blockers[].id}}` | `{{blockers[].roundRef}}` | `{{blockers[].code}}` | `{{blockers[].targetRefs}}` | `{{blockers[].ownerRef}}` | `{{blockers[].raisedAt}}` | `{{blockers[].evidenceRefs}}` |

## Owner handoff

| Field | Value |
| --- | --- |
| Handoff / round | `{{handoff.id}}` / `{{handoff.roundRef}}` |
| State | `{{handoff.state}}` |
| Destination | `{{handoff.destinationRef}}` / `{{handoff.destinationVisibility}}` |
| Destination approval | `{{handoff.destinationApprovalRef}}` / `{{handoff.destinationApprovalEvidenceRef}}` / `{{handoff.destinationApprovalEvidenceDigest}}` / `{{handoff.destinationApprovalEvidenceControlledRef}}` |
| Next owner | `{{handoff.nextOwnerRef}}` |
| Handoff authority | `{{handoff.authorityGrantRef}}` / `{{handoff.authorityGrantPayloadDigest}}` |
| Handoff authority evidence | `{{handoff.authorityGrantEvidenceRef}}` / `{{handoff.authorityGrantEvidenceDigest}}` / `{{handoff.authorityGrantEvidenceControlledRef}}` |
| Ledger / statement manifests | `{{handoff.ledgerManifestDigest}}` / `{{handoff.statementManifestDigest}}` |
| Round root | `{{handoff.roundRootDigest}}` |
| Ledger / statement rows | `{{handoff.counts.ledgerRows}}` / `{{handoff.counts.statementRows}}` |
| Matched ledger / statement rows | `{{handoff.counts.matchedLedgerRows}}` / `{{handoff.counts.matchedStatementRows}}` |
| Match groups | `{{handoff.counts.groups}}` |
| Ledger / statement residuals | `{{handoff.counts.ledgerResiduals}}` / `{{handoff.counts.statementResiduals}}` |
| Blockers | `{{handoff.counts.blockers}}` |
| Ledger / statement row index | `{{handoff.indexes.ledgerRowRefs}}` / `{{handoff.indexes.statementRowRefs}}` |
| Group / residual / blocker index | `{{handoff.indexes.groupRefs}}` / `{{handoff.indexes.residualRefs}}` / `{{handoff.indexes.blockerRefs}}` |
| Partition evidence root | `{{handoff.partitionEvidenceRootDigest}}` |
| Handed off at | `{{handoff.handedOffAt}}` |
| Handoff evidence | `{{handoff.evidenceRef}}` |

`ready-for-owner-review` means only that the bounded machine record has a valid
complete partition and no semantic blocker. It does not mean a payment moved,
an entry posted or reversed, a residual was resolved or written off, an account
or period closed, balances were certified, a control operated effectively, an
audit completed, or compliance was achieved.
