# Operating workflow

## Start here

Ask for or confirm:

- Patient owner, authorized helper scope, bounded service period, privacy ceiling, currency, controlled destination, and unresolved professional questions
- Exact supplied provider statements and itemized bills, insurer explanations of benefits, claim corrections or reversals, correspondence, and redacted document identifiers
- Supplied service-line links, service dates, statement dates, separately attributed amount fields, provider posting records, independent payment receipts, and refunds
- Prior reconciliation, document supersession evidence, unmatched lines, disputed amounts, owner-recorded actions, and source-published deadlines with explicit uncertainty

## Included capability boundaries

- The base X3 starter reads minimized owner-supplied workspace files and writes a private local handoff; it grants no portal, billing-system, browser, messaging, medical-record, insurance, payment, or account capability.
- Retain payer-issued and provider-issued assertions as attributed observations; neither source gives the Claw authority to adjudicate a claim or instruct payment.
- Route legal, clinical, coding, benefits, coverage, collections, and financial interpretation to the patient and appropriate qualified humans.
- Write outputs/medical-billing.json using schemas/medical-billing.schema.json and templates/medical-billing.md. The synthetic fixture demonstrates document reconciliation, not live-provider validation. Split payments or ambiguous many-to-many line links stay unmatched for owner review.

## Structured decision artifact contract

- Treat `fixtures/medical-billing.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/medical-billing.json` and check it against `schemas/medical-billing.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/medical-billing.md` at `outputs/medical-bill-reconciliation-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm patient ownership, helper permissions, service period, currency, privacy minimization, and supplied-document scope without accessing portals
2. Inventory every bill, explanation of benefits, revision, correction, reversal, receipt, refund, and correspondence item with exact source lineage
3. Partition all supplied service lines into documented same-subject associations or explicit unmatched records; never fuzzy-match codes or infer missing relationships
4. Keep provider and insurer amount fields separate and compare only explicitly comparable same-currency minor-unit values, preserving every difference as a discrepancy rather than a liability conclusion
5. Track reprocessed or reversed claims without dropping prior versions or counting superseded EOB amounts as current; independently reconcile insurer and patient payment receipts with provider posting observations
6. Expose unmatched lines, duplicate-document observations, conflicting statements, unposted payments, missing refunds, revisions awaiting evidence, and source-bound deadline questions
7. Produce a private owner-review ledger with complete source and service-line coverage, a next-owner question queue, and blocked contact, disclosure, appeal, dispute, payment, and closure actions

## Example setting

**Request:** Compare the three provider bills, original and corrected EOBs, my payment receipt, and the refund notice I supplied for this service period. Show which lines are demonstrably linked, what changed in reprocessing, which payments have no provider posting evidence, and which items need a billing-office or insurer answer. Do not interpret coverage, decide what I owe, infer coding errors, contact anyone, disclose records, file an appeal, or pay anything.

**Expected outcome:** A private source-bound service-line ledger preserves both bill and EOB revision histories, keeps financial facts attributed to their issuers, exposes unmatched items and posting discrepancies, and prepares patient-owned questions without declaring liability or taking external action.

## Standard deliverables

- Private bill, explanation-of-benefits, claim-revision, and correspondence source register
- Complete provider and insurer service-line association and unmatched-item index
- Attributed charge, allowed-amount, adjustment, reported responsibility, payment, refund, and posting discrepancy ledger
- Revision, reversal, missing-receipt, deadline-question, and next-owner register
- Patient-controlled review handoff that does not claim an amount is owed, payable, covered, settled, or closed

## Done when

- Every supplied document revision and every in-scope service line is represented exactly once in a complete coverage index, including missing or unmatched counterparts
- Every association and amount comparison is supported by exact same-subject, service-period, currency, and current-revision evidence, with no invented counterpart or cross-currency netting
- Reprocessing and reversals cannot double-count prior insurer statements, and every payment or refund remains separate from an unsupported posting or settlement claim
- All discrepancies and unanswered deadline or professional questions retain named human owners, minimized disclosure scope, and blocked external actions

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
