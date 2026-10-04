# Estate administration review

Estate: `{{estate.stableEstateRef}}`  
Jurisdiction: {{estate.generalizedJurisdiction}}  
As of: {{review.asOf}}  
State: **{{review.state}}**  
Personal representative: `{{estate.personalRepresentativeAuthorityRef}}`  
Private destination: `{{estate.approvedDestinationRef}}`

This is an evidence ledger, not legal, tax, title, valuation, claim, entitlement, priority, solvency, reserve, distribution, or closure advice. Every external action remains with the documented personal representative and qualified authorities.

## Authority and sources

| Authority | Kind | Scope | Authorization source |
| --- | --- | --- | --- |
| `{{authorities[].id}}` | {{authorities[].kind}} | {{authorities[].scope}} | `{{authorities[].authorizationSourceRef}}` |

| Source | Kind | Subject | Issuer | Revision | Asserted / retrieved | Freshness |
| --- | --- | --- | --- | --- | --- | --- |
| `{{sources[].id}}` | {{sources[].kind}} | `{{sources[].subjectRef}}` | `{{sources[].issuerAuthorityRef}}` | {{sources[].revision}} | {{sources[].assertedAt}} / {{sources[].retrievedAt}} | {{sources[].freshness}} |

## Assets

| Asset | Kind | Ownership evidence | Value evidence | Custodian | Actions / distributions | Gaps |
| --- | --- | --- | --- | --- | --- | --- |
| `{{assets[].id}}` | {{assets[].kind}} | {{assets[].ownershipEvidenceState}} / {{assets[].ownershipSourceRefs}} | {{assets[].valueState}} / {{assets[].valueMinorUnits}} {{assets[].currency}} / {{assets[].valuationSourceRefs}} | `{{assets[].institutionOrCustodianAuthorityRef}}` | {{assets[].actionRefs}} / {{assets[].distributionRefs}} | {{assets[].gapRefs}} |

## Liabilities and claims

| Liability | Kind | Amount evidence | Claim | Sources | Actions | Gaps |
| --- | --- | --- | --- | --- | --- | --- |
| `{{liabilities[].id}}` | {{liabilities[].kind}} | {{liabilities[].amountState}} / {{liabilities[].amountMinorUnits}} {{liabilities[].currency}} | `{{liabilities[].claimRef}}` | {{liabilities[].sourceRefs}} | {{liabilities[].actionRefs}} | {{liabilities[].gapRefs}} |

| Claim | Kind | Claimant | State | Asserted amount | Decision evidence | Actions | Gaps |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `{{claims[].id}}` | {{claims[].kind}} | `{{claims[].claimantAuthorityRef}}` | {{claims[].state}} | {{claims[].assertedAmountMinorUnits}} {{claims[].currency}} | `{{claims[].decisionSourceRef}}` | {{claims[].actionRefs}} | {{claims[].gapRefs}} |

## Notices and deadlines

| Notice | Kind | Subjects | Owner | State | Time | Receipt |
| --- | --- | --- | --- | --- | --- | --- |
| `{{notices[].id}}` | {{notices[].kind}} | {{notices[].subjectRefs}} | `{{notices[].ownerAuthorityRef}}` | {{notices[].state}} | {{notices[].noticeAt}} | `{{notices[].receiptSourceRef}}` |

| Deadline | Kind | Subjects | Candidate | State | Authority / confirmation |
| --- | --- | --- | --- | --- | --- |
| `{{deadlines[].id}}` | {{deadlines[].kind}} | {{deadlines[].subjectRefs}} | {{deadlines[].candidateAt}} {{deadlines[].timezone}} | {{deadlines[].state}} | `{{deadlines[].confirmedByAuthorityRef}}` / `{{deadlines[].confirmationSourceRef}}` |

## Owner actions and distributions

| Action | Kind | Subjects | Owner | State | Attempted | Independent receipt |
| --- | --- | --- | --- | --- | --- | --- |
| `{{actions[].id}}` | {{actions[].kind}} | {{actions[].subjectRefs}} | `{{actions[].ownerAuthorityRef}}` | {{actions[].state}} | {{actions[].attemptedAt}} | `{{actions[].receiptSourceRef}}` |

| Distribution | Beneficiary | Assets | State | Amount | Proposal / approval | Action / receipt |
| --- | --- | --- | --- | --- | --- | --- |
| `{{distributions[].id}}` | `{{distributions[].beneficiaryAuthorityRef}}` | {{distributions[].assetRefs}} | {{distributions[].state}} | {{distributions[].amountMinorUnits}} {{distributions[].currency}} | `{{distributions[].proposalSourceRef}}` / `{{distributions[].approvalSourceRef}}` | `{{distributions[].actionRef}}` / `{{distributions[].receiptSourceRef}}` |

## Qualified-human questions and gaps

| Question | Kind | Subjects | Asked of | State | Answer evidence |
| --- | --- | --- | --- | --- | --- |
| `{{questions[].id}}` | {{questions[].kind}} | {{questions[].subjectRefs}} | `{{questions[].askedOfAuthorityRef}}` | {{questions[].state}} | `{{questions[].answerSourceRef}}` |

| Gap | Kind | Subjects | Next owner | State | Resolution evidence |
| --- | --- | --- | --- | --- | --- |
| `{{gaps[].id}}` | {{gaps[].kind}} | {{gaps[].subjectRefs}} | `{{gaps[].nextOwnerAuthorityRef}}` | {{gaps[].state}} | `{{gaps[].resolutionSourceRef}}` |

## Exact review indexes

- Open questions: {{review.openQuestionRefs}}
- Open gaps: {{review.openGapRefs}}
- Disputed claims: {{review.disputedClaimRefs}}
- Unknown ownership: {{review.unknownOwnershipAssetRefs}}
- Value gaps: {{review.valueGapAssetRefs}}
- Unresolved liabilities: {{review.unresolvedLiabilityRefs}}
- Missing action receipts: {{review.missingReceiptActionRefs}}
- Proposed distributions: {{review.proposedDistributionRefs}}
- Deadlines: {{review.deadlineRefs}}
- Next owner: `{{review.nextOwnerAuthorityRef}}`

## Prohibited authority

All `prohibitedActions` values and all professional or closure conclusion fields must remain `false`. A ready-for-personal-representative-review handoff is not approval, advice, authority, settlement, solvency, distribution authorization, or estate closure.
