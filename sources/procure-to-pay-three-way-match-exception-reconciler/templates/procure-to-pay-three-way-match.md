# Procure-to-pay three-way match exception review

Render only from a schema-valid and semantically clean
`procure-to-pay-three-way-match.schema.json` artifact. Copy exact values. Do not
infer correspondence, tolerance, accounting or tax treatment, posting,
payment, receipt creation, supplier contact, or source mutation.

## Exact review scope

| Field | Value |
| --- | --- |
| Schema / Claw | `{{schemaVersion}}` / `{{clawId}}` |
| Review / PO | `{{review.id}}` / `{{review.purchaseOrderId}}` |
| Currency / cutoff | `{{review.currency}}` / `{{review.cutoffAt}}` |
| Current revision / amendment | `{{review.currentRevisionRef}}` / `{{review.amendmentRef}}` |
| Policy | `{{review.matchingPolicyRef}}` |
| Destination / next owner | `{{review.destination}}` / `{{review.nextOwnerRef}}` |

## Owner-approved policy and amendment

| Record | Version or transition | Approved payload | Human / grant / time |
| --- | --- | --- | --- |
| `{{matchingPolicy.id}}` | `{{matchingPolicy.version}}`; `{{matchingPolicy.groupShape}}` | `{{matchingPolicy.approvedPayloadDigest}}` | `{{matchingPolicy.approvedByRef}}` / `{{matchingPolicy.authorityGrantRef}}` / `{{matchingPolicy.approvedAt}}` |
| `{{amendment.id}}` | `{{amendment.fromRevisionRef}}` to `{{amendment.toRevisionRef}}` | `{{amendment.approvedPayloadDigest}}` | `{{amendment.approvedByRef}}` / `{{amendment.authorityGrantRef}}` / `{{amendment.approvedAt}}` |
| `{{purchaseOrderRevision.id}}` | revision `{{purchaseOrderRevision.revisionNumber}}` | `{{purchaseOrderRevision.approvedPayloadDigest}}` | `{{purchaseOrderRevision.approvedByRef}}` / `{{purchaseOrderRevision.authorityGrantRef}}` / `{{purchaseOrderRevision.approvedAt}}` |

Policy rules: `{{matchingPolicy.quantityRule}}`,
`{{matchingPolicy.amountRule}}`, `{{matchingPolicy.unitPriceRule}}`,
`{{matchingPolicy.correspondenceRule}}`; tax is
`{{matchingPolicy.taxRule}}`.

## Typed target-bound authority

| Grant | Scope | PO / currency / revision | Grantee / issuer | Active interval |
| --- | --- | --- | --- | --- |
| `{{authorityGrants[].id}}` | `{{authorityGrants[].scope}}` | `{{authorityGrants[].purchaseOrderId}}` / `{{authorityGrants[].currency}}` / `{{authorityGrants[].revisionRef}}` | `{{authorityGrants[].granteeRef}}` / `{{authorityGrants[].issuedByRef}}` | `{{authorityGrants[].activeFrom}}` through `{{authorityGrants[].activeUntil}}` |

## Exact source manifests

| Side / manifest | Owner source / export | Generated | Complete line index | Manifest digest |
| --- | --- | --- | --- | --- |
| `{{manifests[].side}}` / `{{manifests[].id}}` | `{{manifests[].sourceSystemRef}}` / `{{manifests[].exportRef}}` | `{{manifests[].generatedAt}}` | `{{manifests[].lineRefs}}` | `{{manifests[].lineManifestDigest}}` |

Every row below preserves its immutable owner source triple:
`sourceSystemRef`, `exportRef`, and `sourceNativeLineId`.

## Purchase-order lines

| Line / native identity | Revision / item | Quantity / unit | Unit / extended minor units | Currency |
| --- | --- | --- | --- | --- |
| `{{purchaseOrderLines[].id}}` / `{{purchaseOrderLines[].sourceSystemRef}}` / `{{purchaseOrderLines[].exportRef}}` / `{{purchaseOrderLines[].sourceNativeLineId}}` | `{{purchaseOrderLines[].revisionRef}}` / `{{purchaseOrderLines[].itemRef}}` | `{{purchaseOrderLines[].quantity}}` / `{{purchaseOrderLines[].unitOfMeasure}}` | `{{purchaseOrderLines[].unitMinorUnits}}` / `{{purchaseOrderLines[].extendedMinorUnits}}` | `{{purchaseOrderLines[].currency}}` |

## Receipt and return lines

| Line / native identity | PO line / revision | Kind / reverses | Quantity / unit | Time / currency |
| --- | --- | --- | --- | --- |
| `{{receiptLines[].id}}` / `{{receiptLines[].sourceSystemRef}}` / `{{receiptLines[].exportRef}}` / `{{receiptLines[].sourceNativeLineId}}` | `{{receiptLines[].poLineRef}}` / `{{receiptLines[].purchaseOrderRevisionRef}}` | `{{receiptLines[].kind}}` / `{{receiptLines[].reversesLineRef}}` | `{{receiptLines[].quantity}}` / `{{receiptLines[].unitOfMeasure}}` | `{{receiptLines[].recordedAt}}` / `{{receiptLines[].currency}}` |

## Invoice and credit lines

| Line / native identity | PO line / revision | Kind / reverses | Quantity / unit | Unit / line minor units | Time / currency |
| --- | --- | --- | --- | --- | --- |
| `{{invoiceLines[].id}}` / `{{invoiceLines[].sourceSystemRef}}` / `{{invoiceLines[].exportRef}}` / `{{invoiceLines[].sourceNativeLineId}}` | `{{invoiceLines[].poLineRef}}` / `{{invoiceLines[].purchaseOrderRevisionRef}}` | `{{invoiceLines[].kind}}` / `{{invoiceLines[].reversesLineRef}}` | `{{invoiceLines[].quantity}}` / `{{invoiceLines[].unitOfMeasure}}` | `{{invoiceLines[].unitMinorUnits}}` / `{{invoiceLines[].lineMinorUnits}}` | `{{invoiceLines[].recordedAt}}` / `{{invoiceLines[].currency}}` |

## Authorized exact three-sided groups

| Group | PO / receipt / invoice lines | Net quantities | PO / invoice minor units | Decision bindings |
| --- | --- | --- | --- | --- |
| `{{matchGroups[].id}}` | `{{matchGroups[].poLineRefs}}` / `{{matchGroups[].receiptLineRefs}}` / `{{matchGroups[].invoiceLineRefs}}` | `{{matchGroups[].totals.purchaseOrderQuantity}}` / `{{matchGroups[].totals.receiptQuantity}}` / `{{matchGroups[].totals.invoiceQuantity}}` | `{{matchGroups[].totals.purchaseOrderMinorUnits}}` / `{{matchGroups[].totals.invoiceMinorUnits}}` | `{{matchGroups[].decision.id}}`; policy `{{matchGroups[].decision.policyVersion}}` / `{{matchGroups[].decision.policyPayloadDigest}}`; group `{{matchGroups[].decision.groupPayloadDigest}}`; manifests `{{matchGroups[].decision.purchaseOrderManifestDigest}}`, `{{matchGroups[].decision.receiptManifestDigest}}`, `{{matchGroups[].decision.invoiceManifestDigest}}` |

## Side-specific residuals

| Residual | Side / line / PO line | Reason | Owner / time |
| --- | --- | --- | --- |
| `{{residuals[].id}}` | `{{residuals[].side}}` / `{{residuals[].lineRef}}` / `{{residuals[].poLineRef}}` | `{{residuals[].reasonCode}}` | `{{residuals[].ownerRef}}` / `{{residuals[].recordedAt}}` |

## Coverage and partition-root handoff

| Field | Value |
| --- | --- |
| PO / receipt / invoice coverage | `{{coverage.purchaseOrderLineRefs}}` / `{{coverage.receiptLineRefs}}` / `{{coverage.invoiceLineRefs}}` |
| Groups / residuals | `{{coverage.groupRefs}}` / `{{coverage.residualRefs}}` |
| Result / state | `{{result.id}}` / `{{result.state}}` |
| Structured finding codes | `{{result.findingCodes}}` |
| Prepared by / grant / next owner | `{{result.preparedByRef}}` / `{{result.authorityGrantRef}}` / `{{result.nextOwnerRef}}` |
| Generated | `{{result.generatedAt}}` |
| Complete partition root | `{{result.partitionRootDigest}}` |

`accepted-for-owner-review` means a clean exact partition with no residuals.
`pending-owner-review` means the partition is clean and complete but retains
typed residuals for the named owner. `blocked` means structural or semantic
findings remain and the exact finding codes must be preserved.

## Authority non-claims

| Reserved authority | Value |
| --- | --- |
| Posting / payment | `{{authorityClaims.posting}}` / `{{authorityClaims.payment}}` |
| Receipt creation | `{{authorityClaims.receiptCreation}}` |
| Supplier contact / source mutation | `{{authorityClaims.supplierContact}}` / `{{authorityClaims.sourceMutation}}` |
| Accounting / tax interpretation | `{{authorityClaims.accountingInterpretation}}` / `{{authorityClaims.taxInterpretation}}` |

Every value must remain `not-claimed`. A match is evidence for owner review,
never approval to create a receipt, post, or pay. Digests prove internal
consistency only; source authenticity, export completeness, policy meaning,
exception disposition, and every action remain owner-controlled.
