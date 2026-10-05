# CASE-17: Private Owner Review

Synthetic evaluation only. Blocked, private and unsubmitted. Owner: Alex,
merchant operations owner. These labels do not enforce access permissions.

## Notice and Identity

NOTICE-1-V2 names CASE-17 / PAY-17 / ORDER-17 and a USD 120.00 dispute.
The supplied current stage is revised-response. Its supplied deadline is
2026-10-13T17:00:00-04:00, America/New_York. Confirm applicability with the owner;
this is not an independently verified processor deadline or a network rule.
Project task dates are owner-supplied planning dates, not timestamp enforcement.
ORDER-17-V1 supplies the payment/order link; it does not authenticate identity.

NOTICE-1-V1 and REVIEW-V1 remain historical: first-response stage, deadline
2026-10-12T17:00:00-04:00. V2 adds executed-refund-evidence in place of generic
refund-status. No carry-forward rule is supplied. Re-review v2 and each intended
attachment revision; do not turn historical review into current readiness.

## Requirement Review

| Supplied requirement | Retained evidence | Owner question |
| --- | --- | --- |
| transaction-link | ORDER-17-V1 | Confirm exact case/payment/order mapping. |
| delivery | DELIVERY-17-V1, MESSAGE-17-V1, RETURN-17-V1 | Carrier reports delivery; customer reports nonreceipt. Retain both. Return authorization is not physical receipt. |
| correspondence | MESSAGE-17-V1 | Obtain disclosure/redaction review before sharing. |
| executed-refund-evidence | REFUND-REQUEST-17-V1, REFUND-17-V1 | Distinguish USD 120.00 requested from the supplied USD 40.00 executed-refund record. Reconcile with the still-USD 120.00 notice. |

Do not reduce the dispute automatically to USD 80.00. No reconciled dispute
amount is established. The supplied refund is not a new incoming receipt, a
liability decision, final settlement or case resolution. Do not suppress adverse
correspondence or refund evidence, choose which delivery statement is true, or
infer returned goods. No new refund is performed.

## Proposed Attachments

transaction.pdf, delivery.pdf, correspondence.pdf and refund.pdf are proposed
names only. No PDF bytes exist in this evaluation. The synthetic notice permits
at most four PDFs, 2 MiB each. Format, size, checksums, redaction and actual
attachment/source correspondence remain unverified. Disclosure is unapproved.
Do not invent hashes, claim files were normalized, or upload these names as proof.

## Existing-Claw Handoff

Project Manager records MAP, DELIVERY, REFUNDS, ATTACHMENTS, REVISION and HANDOFF
as blocked owner tasks in private-project.json. Its validator checks project
shape and dependencies, not the processor case/payment map or evidence truth.
Document Intake is the prospective owner of authorized normalization when bytes
are supplied; no normalization output is claimed here. Invoice Follow-up can
supply existing receivables context, not interpret an executed refund as receipt
allocation. Seller Returns separates authorization from receipt/disposition,
not refund execution. RFP provides tested attachment/baseline-review patterns,
but no RFP artifact is mislabelled as a processor response.

Alex must confirm mapping and notice applicability, reconcile refund evidence,
retain unresolved conflicts, obtain permitted bytes and review exact revisions.
Re-author this handoff and the task artifact when supplied evidence changes.
No automated revision engine, readiness decision, submission, customer message,
refund, accounting entry, legal conclusion or recovery prediction is installed.
