# Home purchase transaction review

Transaction: `{{transaction.stableTransactionRef}}`

Property: {{transaction.generalizedPropertyRef}}

As of: {{review.asOf}}

State: **{{review.state}}**

Buyer owner: `{{transaction.buyerAuthorityRef}}`
Private destination: `{{transaction.approvedDestinationRef}}`

This is an evidence ledger, not legal, financial, real-estate, inspection, appraisal, financing, title, insurance, tax, settlement, wire, closing, or ownership advice. Every external action and proceed-or-close decision remains with the buyer and qualified authorities.

## Authority and source revisions

| Authority | Kind | Status | Scope | Authorization source |
| --- | --- | --- | --- | --- |
| `{{authorities[].id}}` | {{authorities[].kind}} | {{authorities[].status}} | {{authorities[].scope}} | `{{authorities[].authorizationSourceRef}}` |

| Source | Stable source | Kind | Subject | Issuer | Revision / supersedes | Asserted / retrieved | Freshness | Amount |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `{{sources[].id}}` | `{{sources[].stableSourceRef}}` | {{sources[].kind}} | `{{sources[].subjectRef}}` | `{{sources[].issuerAuthorityRef}}` | {{sources[].revision}} / `{{sources[].supersedesSourceRef}}` | {{sources[].assertedAt}} / {{sources[].retrievedAt}} | {{sources[].freshness}} | {{sources[].amountMinorUnits}} {{sources[].currency}} |

## Milestones and conditions

| Milestone | Kind | State | Amount | Sources | Conditions / deadlines | Workstreams / actions | Gaps |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `{{milestones[].id}}` | {{milestones[].kind}} | {{milestones[].state}} | {{milestones[].amountMinorUnits}} {{milestones[].currency}} | {{milestones[].sourceRefs}} | {{milestones[].conditionRefs}} / {{milestones[].deadlineRefs}} | {{milestones[].workstreamRefs}} / {{milestones[].actionRefs}} | {{milestones[].gapRefs}} |

| Condition | Kind | Subjects | State | Decision authority / source | Actions | Gaps |
| --- | --- | --- | --- | --- | --- | --- |
| `{{conditions[].id}}` | {{conditions[].kind}} | {{conditions[].subjectRefs}} | {{conditions[].state}} | `{{conditions[].decidedByAuthorityRef}}` / `{{conditions[].decisionSourceRef}}` | {{conditions[].actionRefs}} | {{conditions[].gapRefs}} |

## Deadlines

| Deadline | Kind | Subjects | Candidate | State | Authority / confirmation | Gaps |
| --- | --- | --- | --- | --- | --- | --- |
| `{{deadlines[].id}}` | {{deadlines[].kind}} | {{deadlines[].subjectRefs}} | {{deadlines[].candidateAt}} {{deadlines[].timezone}} | {{deadlines[].state}} | `{{deadlines[].confirmedByAuthorityRef}}` / `{{deadlines[].confirmationSourceRef}}` | {{deadlines[].gapRefs}} |

## Professional workstreams

| Workstream | Owner | State | Milestones | Conditions / deadlines | Actions | Gaps |
| --- | --- | --- | --- | --- | --- | --- |
| `{{workstreams[].id}}` | `{{workstreams[].ownerAuthorityRef}}` | {{workstreams[].state}} | {{workstreams[].milestoneRefs}} | {{workstreams[].conditionRefs}} / {{workstreams[].deadlineRefs}} | {{workstreams[].actionRefs}} | {{workstreams[].gapRefs}} |

## Buyer-controlled actions

| Action | Kind | Subjects | Owner | State | Attempted | Independent receipt |
| --- | --- | --- | --- | --- | --- | --- |
| `{{actions[].id}}` | {{actions[].kind}} | {{actions[].subjectRefs}} | `{{actions[].ownerAuthorityRef}}` | {{actions[].state}} | {{actions[].attemptedAt}} | `{{actions[].receiptSourceRef}}` |

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
- Unresolved milestones: {{review.unresolvedMilestoneRefs}}
- Unresolved conditions: {{review.unresolvedConditionRefs}}
- Unresolved deadlines: {{review.unresolvedDeadlineRefs}}
- Blocked workstreams: {{review.blockedWorkstreamRefs}}
- Missing action receipts: {{review.missingReceiptActionRefs}}
- Wire-safety questions: {{review.wireSafetyQuestionRefs}}
- Next owner: `{{review.nextOwnerAuthorityRef}}`

## Prohibited authority

All `prohibitedActions` values and all professional, clear-to-close, ownership, interpretation, and wire-validation conclusion fields must remain `false`. A ready-for-buyer-review handoff is not advice, approval, waiver, verified wire instruction, authorization to transfer funds, clearance to close, closing, or ownership.
