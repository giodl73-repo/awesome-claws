# Commercial deal desk review

Render only from a schema-valid `commercial-deal-desk.schema.json` artifact.
Copy exact values; do not infer approval, interpret legal terms, or describe any
reserved commercial action as completed.

## Exact opportunity and quote revision

| Field | Value |
| --- | --- |
| Schema / artifact | `{{schemaVersion}}` / `{{artifactId}}` |
| Review | `{{review.id}}` |
| Opportunity / digest | `{{review.opportunityId}}` / `{{review.opportunityDigest}}` |
| Quote / revision / digest | `{{review.quoteId}}` / `{{review.quoteRevision}}` / `{{review.quoteDigest}}` |
| Issued / valid until | `{{review.quoteIssuedAt}}` / `{{review.validUntil}}` |
| Currency | `{{review.currency}}` |
| Input snapshot digest | `{{review.inputSnapshotDigest}}` |
| Seller / quote owner | `{{review.sellerRef}}` / `{{review.quoteOwnerRef}}` |

Digests prove internal consistency only. Source-system authenticity, catalog and
policy semantics, approval authority, and legal or licensing interpretation
remain external owner-controlled trust roots.

## Immutable input ledger

Render one row per `inputs` record.

| Input | Kind / version | Exact opportunity and quote | Effective interval | Digest | Supersedes | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `{{inputs[].id}}` | `{{inputs[].kind}}` / `{{inputs[].version}}` | `{{inputs[].opportunityId}}` / `{{inputs[].quoteId}}` / `{{inputs[].quoteRevision}}` | `{{inputs[].effectiveFrom}}` through `{{inputs[].validUntil}}` | `{{inputs[].digest}}` | `{{inputs[].supersedesRef}}` | `{{inputs[].evidenceRef}}` |

## Authenticated approval and conflict history

| Field | Value |
| --- | --- |
| History input / immutable digest | `{{history.inputRef}}` / `{{history.contentDigest}}` |
| Approval index | `{{history.approvalRefs}}` |
| Conflict index | `{{history.conflictRefs}}` |
| Supersession edges | `{{history.supersessionEdges}}` |
| Conflict edges | `{{history.conflictEdges}}` |
| Authenticated evidence | `{{history.evidenceRef}}` |

## Principals and separation of duties

| Principal | Name / kind | Roles |
| --- | --- | --- |
| `{{principals[].id}}` | `{{principals[].name}}` / `{{principals[].kind}}` | `{{principals[].roles}}` |

Pricing, legal, and licensing approval must be supplied by three different
named humans. None may be the seller or quote owner.

## Approved products and quote lines

| Product / SKU | Approved inputs | List / cost | Discount / margin thresholds | Dependencies | Licensing rules | Payload / evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `{{products[].id}}` / `{{products[].sku}}` | `{{products[].catalogInputRef}}`, `{{products[].configurationInputRef}}`, `{{products[].priceBookInputRef}}` | `{{products[].listUnitAmount}}` / `{{products[].unitCostAmount}}` `{{products[].currency}}` | `{{products[].maxDiscountBps}}` / `{{products[].minMarginBps}}` bps | `{{products[].requiredDependencySkus}}` | `{{products[].licensingRuleRefs}}` | `{{products[].payloadDigest}}` / `{{products[].evidenceRef}}` |

| Line / SKU | Quantity / term | Unit list / net / cost | Extended list / net / cost | Discount / margin | Dependencies | Licensing / legal deviation | Payload digest |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `{{lines[].id}}` / `{{lines[].sku}}` | `{{lines[].quantity}}` / `{{lines[].termMonths}}` months | `{{lines[].listUnitAmount}}` / `{{lines[].netUnitAmount}}` / `{{lines[].unitCostAmount}}` | `{{lines[].extendedListAmount}}` / `{{lines[].extendedNetAmount}}` / `{{lines[].extendedCostAmount}}` | `{{lines[].discountBps}}` / `{{lines[].marginBps}}` bps | `{{lines[].dependencySkus}}` | `{{lines[].licensingDeviation}}` / `{{lines[].legalDeviation}}` | `{{lines[].payloadDigest}}` |

## Complete eight-domain finding matrix

Render exactly one row per line for each of configuration, pricing, discount,
margin, licensing, legal, dependency, and validity.

| Finding | Line / domain | Rule input | Status | Exact exception | Evidence |
| --- | --- | --- | --- | --- | --- |
| `{{findings[].id}}` | `{{findings[].lineRef}}` / `{{findings[].domain}}` | `{{findings[].ruleInputRef}}` | `{{findings[].status}}` | `{{findings[].exceptionRef}}` | `{{findings[].evidenceRefs}}` |

## Exact exception coverage

| Exception | Finding / line | Domain / approval lane | Raised | Current approval | Evidence |
| --- | --- | --- | --- | --- | --- |
| `{{exceptions[].id}}` | `{{exceptions[].findingRef}}` / `{{exceptions[].lineRef}}` | `{{exceptions[].domain}}` / `{{exceptions[].approvalDomain}}` | `{{exceptions[].raisedAt}}` | `{{exceptions[].currentApprovalRef}}` | `{{exceptions[].evidenceRef}}` |

## Independent approvals and chronology

| Approval | Domain / state / decision | Exact quote binding | Exact exceptions | Approver | Decision / validity | Supersedes | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `{{approvals[].id}}` | `{{approvals[].domain}}` / `{{approvals[].status}}` / `{{approvals[].decision}}` | `{{approvals[].opportunityId}}` / `{{approvals[].quoteId}}` / `{{approvals[].quoteRevision}}` / `{{approvals[].quoteDigest}}` | `{{approvals[].exceptionRefs}}` | `{{approvals[].approverRef}}` | `{{approvals[].decidedAt}}`; `{{approvals[].validFrom}}` through `{{approvals[].validUntil}}` | `{{approvals[].supersedesRef}}` | `{{approvals[].evidenceRef}}` |

| Conflict | Kind / subjects | Detected | Status | Resolving approval | Evidence |
| --- | --- | --- | --- | --- | --- |
| `{{conflicts[].id}}` | `{{conflicts[].kind}}` / `{{conflicts[].subjectRefs}}` | `{{conflicts[].detectedAt}}` | `{{conflicts[].status}}` | `{{conflicts[].resolvedByApprovalRef}}` | `{{conflicts[].evidenceRef}}` |

## Evidence ledger

| Evidence | Kind | Exact quote binding | Observed / supplier | Subjects | External source / payload digest |
| --- | --- | --- | --- | --- | --- |
| `{{evidence[].id}}` | `{{evidence[].kind}}` | `{{evidence[].opportunityId}}` / `{{evidence[].quoteId}}` / `{{evidence[].quoteRevision}}` | `{{evidence[].observedAt}}` / `{{evidence[].suppliedByRef}}` | `{{evidence[].subjectRefs}}` | `{{evidence[].sourceRecordDigest}}` / `{{evidence[].payloadDigest}}` |

## Exact coverage and blockers

| Coverage | Value |
| --- | --- |
| Review / input digest | `{{coverage.reviewRef}}` / `{{coverage.inputSnapshotDigest}}` |
| Authenticated history digest | `{{coverage.historyDigest}}` |
| History evidence / source digest | `{{coverage.historyEvidenceRef}}` / `{{coverage.historySourceRecordDigest}}` |
| Product payload map | `{{coverage.productPayloadDigests}}` |
| Quote-line payload map | `{{coverage.linePayloadDigests}}` |
| Payload root digest | `{{coverage.payloadRootDigest}}` |
| Inputs / lines / findings | `{{coverage.inputRefs}}` / `{{coverage.lineRefs}}` / `{{coverage.findingRefs}}` |
| Exceptions / current approvals | `{{coverage.exceptionRefs}}` / `{{coverage.currentApprovalRefs}}` |
| Conflicts / blockers | `{{coverage.conflictRefs}}` / `{{coverage.blockerRefs}}` |
| Coverage digest | `{{coverage.contentDigest}}` |

| Blocker | Code | Subjects | Owner / detected | Evidence |
| --- | --- | --- | --- | --- |
| `{{blockers[].id}}` | `{{blockers[].code}}` | `{{blockers[].subjectRefs}}` | `{{blockers[].ownerRef}}` / `{{blockers[].detectedAt}}` | `{{blockers[].evidenceRefs}}` |

## Order-readiness handoff and authority non-claims

| Field | Value |
| --- | --- |
| Handoff / state | `{{handoff.id}}` / `{{handoff.state}}` |
| Opportunity / quote / revision | `{{handoff.opportunityId}}` / `{{handoff.quoteId}}` / `{{handoff.quoteRevision}}` |
| Input / coverage digest | `{{handoff.inputSnapshotDigest}}` / `{{handoff.coverageDigest}}` |
| History / payload root | `{{handoff.historyDigest}}` / `{{handoff.payloadRootDigest}}` |
| History evidence / source digest | `{{handoff.historyEvidenceRef}}` / `{{handoff.historySourceRecordDigest}}` |
| Product / line payload maps | `{{handoff.productPayloadDigests}}` / `{{handoff.linePayloadDigests}}` |
| Destination / approver / next owner | `{{handoff.destination}}` / `{{handoff.approvedByRef}}` / `{{handoff.nextOwnerRef}}` |
| Handoff time / digest | `{{handoff.handedOffAt}}` / `{{handoff.contentDigest}}` |
| Negotiation | `{{handoff.negotiationClaim}}` |
| Customer communication | `{{handoff.customerCommunicationClaim}}` |
| Discount / term approval | `{{handoff.discountApprovalClaim}}` / `{{handoff.termApprovalClaim}}` |
| Legal conclusion / signature | `{{handoff.legalConclusionClaim}}` / `{{handoff.signatureClaim}}` |
| Booking / invoicing | `{{handoff.bookingClaim}}` / `{{handoff.invoicingClaim}}` |
| Contract modification / revenue | `{{handoff.contractModificationClaim}}` / `{{handoff.revenueClaim}}` |

`ready-for-order-review` means only that this exact internal quote-revision
record has complete current evidence and approval bindings. It is not a
negotiation, customer communication, approval, legal conclusion, signature,
booking, invoice, contract modification, or revenue claim.
