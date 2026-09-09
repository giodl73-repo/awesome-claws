# Financial account reconciliation

Use this template only to render a validated
`financial-account-reconciliation.schema.json` artifact. Copy values from the
machine record; do not add prose, actions, assurances, inferred matches,
tolerances, foreign-exchange conversions, accounting treatment, or close
claims to that record.

## Round and source binding

| Field | Value |
| --- | --- |
| Round | `{{round.id}}` |
| Prior round | `{{round.priorRoundRef}}` |
| Account | `{{round.accountId}}` |
| Currency | `{{round.currency}}` |
| Period | `{{round.period.startsOn}}` through `{{round.period.endsOn}}` |
| Cutoff | `{{round.cutoffAt}}` |
| Ledger export | `{{ledgerExport.id}}` / `{{ledgerExport.rowManifestDigest}}` / `{{ledgerExport.sourceEvidenceRootDigest}}` |
| Statement export | `{{statementExport.id}}` / `{{statementExport.rowManifestDigest}}` / `{{statementExport.sourceEvidenceRootDigest}}` |
| Round root | `{{round.roundRootDigest}}` |

## Two-sided coverage

Render every value from these exact indexes and verify that each source row
appears once in either one match group or one residual.

| Side | All source rows | Matched rows | Residual rows |
| --- | --- | --- | --- |
| Ledger | `{{coverage.ledgerRowRefs}}` | `{{coverage.matchedLedgerRowRefs}}` | `{{coverage.residualLedgerRowRefs}}` |
| Statement | `{{coverage.statementRowRefs}}` | `{{coverage.matchedStatementRowRefs}}` | `{{coverage.residualStatementRowRefs}}` |

Coverage groups: `{{coverage.groupRefs}}`

Coverage residuals: `{{coverage.residualRefs}}`

## Match groups

Render one row per `matchGroups` record.

| Group | Cardinality | Ledger rows | Statement rows | Reconciler | Decision time | Decision evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `{{matchGroups[].id}}` | `{{matchGroups[].cardinality}}` | `{{matchGroups[].ledgerRowRefs}}` | `{{matchGroups[].statementRowRefs}}` | `{{matchGroups[].decision.decidedByRef}}` | `{{matchGroups[].decision.decidedAt}}` | `{{matchGroups[].decision.evidenceRef}}` |

Only `1:1`, `1:n`, and `n:1` groups are representable. Display signed
minor-unit values directly from the referenced source rows; do not display a
group as accepted unless both exact integer totals are equal.

## Residuals

Render one row per `residuals` record. Residual presence is compatible with
`ready-for-owner-review`; it is not evidence of resolution or immateriality.

| Residual | Side | Source row | Reason | Recorder | Recorded at | Next owner | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `{{residuals[].id}}` | `{{residuals[].side}}` | `{{residuals[].rowRef}}` | `{{residuals[].reason}}` | `{{residuals[].recordedByRef}}` | `{{residuals[].recordedAt}}` | `{{residuals[].nextOwnerRef}}` | `{{residuals[].evidenceRef}}` |

## Blockers

Render one row per `blockers` record. The list must equal the validator-derived
category and target-id sets exactly; do not add, omit, merge, or reinterpret a
blocker.

| Blocker | Category | Exact targets | Owner | Raised at | Evidence |
| --- | --- | --- | --- | --- | --- |
| `{{blockers[].id}}` | `{{blockers[].code}}` | `{{blockers[].targetRefs}}` | `{{blockers[].ownerRef}}` | `{{blockers[].raisedAt}}` | `{{blockers[].evidenceRefs}}` |

## Owner handoff

| Field | Value |
| --- | --- |
| State | `{{handoff.state}}` |
| Destination | `{{handoff.destinationRef}}` |
| Destination approval | `{{handoff.destinationApprovalRef}}` / `{{handoff.destinationApprovalEvidenceRef}}` |
| Next owner | `{{handoff.nextOwnerRef}}` |
| Handoff authority | `{{handoff.authorityGrantRef}}` / `{{handoff.authorityGrantEvidenceRef}}` |
| Ledger / statement rows | `{{handoff.counts.ledgerRows}}` / `{{handoff.counts.statementRows}}` |
| Matched ledger / statement rows | `{{handoff.counts.matchedLedgerRows}}` / `{{handoff.counts.matchedStatementRows}}` |
| Match groups | `{{handoff.counts.groups}}` |
| Ledger / statement residuals | `{{handoff.counts.ledgerResiduals}}` / `{{handoff.counts.statementResiduals}}` |
| Blockers | `{{handoff.counts.blockers}}` |
| Partition evidence root | `{{handoff.partitionEvidenceRootDigest}}` |
| Handed off at | `{{handoff.handedOffAt}}` |
| Handoff evidence | `{{handoff.evidenceRef}}` |

`ready-for-owner-review` means only that the bounded machine record has a valid
complete partition and no semantic blocker. It does not mean a payment moved,
an entry posted or reversed, a residual was resolved or written off, an account
or period closed, balances were certified, a control operated effectively, an
audit completed, or compliance was achieved.
