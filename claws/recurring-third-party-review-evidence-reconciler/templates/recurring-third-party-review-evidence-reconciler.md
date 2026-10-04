# Recurring third-party review evidence reconciliation

Render only a schema-valid, semantically clean
`recurring-third-party-review-evidence-reconciler.schema.json` artifact. Copy
exact owner-supplied values; do not interpret requirements or source contents,
produce evidence, contact suppliers, accept risk, approve exceptions, execute
remediation, renew, purchase, or mutate an owner system.

## Scope and caller-controlled time

| Field | Value |
| --- | --- |
| Artifact / cycle | `{{artifactId}}` / `{{cycle.id}}` |
| Predecessor | `{{predecessorCycle.id}}` |
| Catalog / revision | `{{requirementCatalog.id}}` / `{{requirementCatalog.revision}}` |
| Cell index | `{{cycle.cellIndexRevision}}` |
| Freshness rules | `{{cycle.freshnessRuleRevision}}` |
| Window | `{{cycle.opensAt}}` through `{{cycle.closesAt}}` |
| Source envelope issued | `{{sourceAuthority.issuedAt}}` |

Validation also requires caller-supplied `asOf`, `publicTrust`, and
`sourceReceipts`. Never derive time from the wall clock or trust a source digest
without its independently signed receipt bytes.

## Owner-declared vendor-service requirement cells

| Cell | Vendor service | Requirement | Owner | Declared | Evidence | Cell digest |
| --- | --- | --- | --- | --- | --- | --- |
| `{{requirementCatalog.cells[].id}}` | `{{requirementCatalog.cells[].vendorServiceRef}}` | `{{requirementCatalog.cells[].requirementRef}}` | `{{requirementCatalog.cells[].ownerRef}}` | `{{requirementCatalog.cells[].declaredAt}}` | `{{requirementCatalog.cells[].declarationEvidenceRef}}` | current and predecessor `cellDigest` |

The cell ledger is exact owner input, not a Cartesian product. Render omissions,
duplicates, service reassignment, digest drift, or unsigned manifests as
blockers.

## Evidence freshness

| Evidence | Kind | Source class | Observed | Valid until | Effective state | Cells |
| --- | --- | --- | --- | --- | --- | --- |
| `{{evidence[].id}}` | `{{evidence[].kind}}` | `{{evidence[].sourceClass}}` | `{{evidence[].observedAt}}` | `{{evidence[].validUntil}}` | derived at caller `asOf` | `{{evidence[].cellRefs}}` |

Show the exact freshness rule and effective expiry used for each state. Do not
assess evidence substance or replace expired evidence.

## Predecessor and current decisions

| Current decision | Cell | Type | Reviewer / time | Predecessor | Evidence | Remediation | Exception |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `{{decisions[].id}}` | `{{decisions[].cellRef}}` | `{{decisions[].decisionType}}` | `{{decisions[].decidedByRef}}` / `{{decisions[].decidedAt}}` | `{{decisions[].predecessorDecisionRef}}` | `{{decisions[].evidenceRefs}}` | `{{decisions[].remediationRef}}` | `{{decisions[].exceptionRef}}` |

Every decision must bind the exact catalog, cell-index, freshness-rule, and cell
digests. Reopen every predecessor cell whose relied evidence expired without a
current replacement, and no other cell.

## Remediation, exception, and preserved attempt

Render the typed `remediations`, `exceptions`, and `riskAcceptanceAttempts`
ledgers exactly. These records preserve owner state only:

- remediation remains owned and unexecuted;
- exception approval remains external;
- unauthorized risk acceptance remains a blocker and never changes a decision.

## Owner handoff

Render exact coverage, evidence states, reopened cells, blockers, and next owner.
Show every authority claim as false: scoring, selection, supplier contact,
contract interpretation, certification, risk acceptance, exception approval,
onboarding, renewal, termination, purchase, and source-system mutation.
