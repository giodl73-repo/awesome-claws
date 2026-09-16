# Enterprise license entitlement reconciliation

Render only a schema-valid, semantically clean
`license-entitlement-reconciliation.schema.json` artifact. Copy exact values;
do not interpret agreement text, invent SKU mappings, infer effective access or
usage, recommend action, declare compliance, or report a prohibited action as
performed.

## Scope and caller-controlled time

| Field | Value |
| --- | --- |
| Artifact / round | `{{artifactId}}` / `{{round.id}}` |
| Predecessor | `{{round.predecessorRoundRef}}` |
| Organization | `{{round.organizationRef}}` |
| Agreement / program | `{{round.agreementRef}}` / `{{round.licenseProgramRef}}` |
| Fixed period | `{{round.periodStartsAt}}` through `{{round.periodEndsAt}}` |
| Cutoff / review window | `{{round.cutoffAt}}` / `{{round.opensAt}}` through `{{round.closesAt}}` |
| Destination | `{{round.destination}}` |
| Round digest | `{{round.roundDigest}}` |

Validation also requires caller-supplied `asOf` and
`licenseTrustRoot`. Never derive either from wall-clock time or the artifact.

## Canonical rights and SKU trust roots

| Root | Version | Digest | Named human owner | Evidence |
| --- | --- | --- | --- | --- |
| `{{rightsManifest.id}}` | `{{rightsManifest.version}}` | `{{rightsManifest.contentDigest}}` | `{{rightsManifest.confirmedByRef}}` | `{{rightsManifest.evidenceRef}}` |
| `{{skuMappingRegister.id}}` | `{{skuMappingRegister.version}}` | `{{skuMappingRegister.contentDigest}}` | `{{skuMappingRegister.confirmedByRef}}` | `{{skuMappingRegister.evidenceRef}}` |

These owner-supplied versions are the semantic trust root. Digest agreement
proves internal identity only, not authenticity or correct license
interpretation.

## Purchased rights and pools

| Right | Metric | Purchased units | Effective interval | Pools | Evidence |
| --- | --- | ---: | --- | --- | --- |
| `{{rights[].id}}` | `{{rights[].metric}}` | `{{rights[].purchasedUnits}}` | `{{rights[].effectiveFrom}}` through `{{rights[].effectiveUntil}}` | `{{rights[].poolRefs}}` | `{{rights[].evidenceRef}}` |

| Pool | Right | Entitled units | Evidence |
| --- | --- | ---: | --- |
| `{{pools[].id}}` | `{{pools[].rightRef}}` | `{{pools[].entitledUnits}}` | `{{pools[].evidenceRef}}` |

## Canonical SKU mappings

| Mapping | Source SKU | Right / pools | Metric | Exact conversion | Evidence |
| --- | --- | --- | --- | --- | --- |
| `{{skuMappings[].id}}` | `{{skuMappings[].sourceSku}}` | `{{skuMappings[].rightRef}}` / `{{skuMappings[].poolRefs}}` | `{{skuMappings[].metric}}` | `{{skuMappings[].conversionNumerator}}` / `{{skuMappings[].conversionDenominator}}` to `{{skuMappings[].normalizedUnit}}` | `{{skuMappings[].evidenceRef}}` |

## Complete source exports

| Export | Kind / version | Period / cutoff | Named human owner | Rows | Digest / evidence |
| --- | --- | --- | --- | --- | --- |
| `{{sourceExports[].id}}` | `{{sourceExports[].kind}}` / `{{sourceExports[].version}}` | `{{sourceExports[].periodStartsAt}}` through `{{sourceExports[].periodEndsAt}}` / `{{sourceExports[].cutoffAt}}` | `{{sourceExports[].suppliedByRef}}` | `{{sourceExports[].rowRefs}}` | `{{sourceExports[].contentDigest}}` / `{{sourceExports[].evidenceRef}}` |

## Assignments and measured consumption

| Assignment | SKU / mapping state / mapping | Period state | Right / pool | Source / normalized units | Observed | Row digest / evidence |
| --- | --- | --- | --- | ---: | --- | --- |
| `{{assignments[].id}}` | `{{assignments[].sourceSku}}` / `{{assignments[].mappingState}}` / `{{assignments[].mappingRef}}` | `{{assignments[].periodState}}` | `{{assignments[].rightRef}}` / `{{assignments[].poolRef}}` | `{{assignments[].sourceUnits}}` / `{{assignments[].normalizedUnits}}` | `{{assignments[].observedAt}}` | `{{assignments[].rowDigest}}` / `{{assignments[].evidenceRef}}` |

| Consumption | SKU / mapping state / mapping | Period state | Right / pool | Source / normalized units | Period | Row digest / evidence |
| --- | --- | --- | --- | ---: | --- | --- |
| `{{consumption[].id}}` | `{{consumption[].sourceSku}}` / `{{consumption[].mappingState}}` / `{{consumption[].mappingRef}}` | `{{consumption[].periodState}}` | `{{consumption[].rightRef}}` / `{{consumption[].poolRef}}` | `{{consumption[].sourceUnits}}` / `{{consumption[].normalizedUnits}}` | `{{consumption[].periodStartsAt}}` through `{{consumption[].periodEndsAt}}` | `{{consumption[].rowDigest}}` / `{{consumption[].evidenceRef}}` |

## Reconciled positions

| Pool | Entitled | Assigned | Consumed | Assignment delta | Consumption delta | State | Reconciled by / at | Exceptions |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| `{{positions[].poolRef}}` | `{{positions[].entitledUnits}}` | `{{positions[].assignedUnits}}` | `{{positions[].consumedUnits}}` | `{{positions[].assignmentDeltaUnits}}` | `{{positions[].consumptionDeltaUnits}}` | `{{positions[].state}}` | `{{positions[].reconciledByRef}}` / `{{positions[].reconciledAt}}` | `{{positions[].exceptionRefs}}` |

## Exceptions and fresh human decisions

| Exception | Position / pool | Code | Deltas | Named owner | Resolution / decision |
| --- | --- | --- | --- | --- | --- |
| `{{exceptions[].id}}` | `{{exceptions[].positionRef}}` / `{{exceptions[].poolRef}}` | `{{exceptions[].code}}` | `{{exceptions[].assignmentDeltaUnits}}` / `{{exceptions[].consumptionDeltaUnits}}` | `{{exceptions[].ownerRef}}` | `{{exceptions[].resolutionState}}` / `{{exceptions[].decisionRef}}` |

| Decision | Exception | Disposition | Named reviewer / time | Exact grant | Predecessor decision |
| --- | --- | --- | --- | --- | --- |
| `{{decisions[].id}}` | `{{decisions[].exceptionRef}}` | `{{decisions[].disposition}}` | `{{decisions[].reviewedByRef}}` / `{{decisions[].reviewedAt}}` | `{{decisions[].authorityGrantRef}}` | `{{decisions[].predecessorDecisionRef}}` |

`predecessorDecisionRef` must remain `null`: predecessor rounds provide lineage,
never reusable decisions.

An exception with `pending-human-decision` must carry a `null` decision
reference and keeps the handoff blocked. A reviewed exception must carry exactly
one fresh reciprocal decision.

## Human authority and reciprocal evidence

Render `principals`, `authorityRoster`, and `authorityGrants` with every exact
scope, target, interval, digest, and evidence reference. Render every `evidence`
row with `subjectRefs`, `sourceRecordDigest`, `payloadDigest`, `recordDigest`,
and `controlledRef`. All authority principals are named humans.

## Coverage, destination, and handoff

Render every `coverage` index and `coverage.contentDigest`, then render
`destinationApproval` and `handoff`. Show all of:

- `{{handoff.purchasePerformed}}`
- `{{handoff.assignmentPerformed}}`
- `{{handoff.revocationPerformed}}`
- `{{handoff.renewalPerformed}}`
- `{{handoff.accountMutationPerformed}}`
- `{{handoff.trueUpSubmitted}}`
- `{{handoff.complianceDeclared}}`
- `{{handoff.effectiveAccessInferred}}`
- `{{handoff.effectiveUsageInferred}}`

`ready-for-owner-review` is not a purchase recommendation, true-up position,
license-compliance conclusion, or evidence that any license or account action
occurred.
