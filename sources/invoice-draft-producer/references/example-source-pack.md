# Synthetic billing source pack

All entities, addresses, records and rules here are fictional. This is supplied
evidence for the deterministic example, not a live invoice or model run.

Scope: Demo Field Services (DEMO-FIELD), Demo Studio (DEMO-STUDIO), USD with
two minor-unit digits. Service period October 1, 2026. Proposed invoice date
October 2. Draft DEMO-INV-01 revision 1. Reviewer: Demo billing owner in the
owner-only billing workspace. Addresses in the fixture are disclosure-approved
fictional billing identities. Customer PO DEMO-PO-17 is required and supplied.

AGREEMENT-3 approves six completed service hours at USD 125/hour, USD 180
materials, USD 45 travel and a USD 75 labor-only discount for this draft.
Descriptions in the three included records are approved for customer billing.

| Record | Supplied evidence |
| --- | --- |
| WORK-101-R2 | Six hours; current revision 2; completed and customer-accepted in ACCEPTANCE-101; billing authorized by AGREEMENT-3. |
| MATERIAL-4-R1 | One USD 180 delivered lot, DELIVERY-4; billing authorized by AGREEMENT-3. |
| EXPENSE-7-R1 | One USD 45 travel expense, RECEIPT-7; reimbursement authorized by AGREEMENT-3. |
| WORK-099-R1 | Two earlier completed hours, ACCEPTANCE-099, already billed on OWNER-ISSUED-09. |
| WORK-102-R1 | One proposed extra hour in TECH-NOTE-102. Completion note exists; no billing approval or approved customer description. Do not charge it. |

BILL-RULE-3 revision 3 is owner-confirmed: half-up rounding separately on each
line to cents; zero tax on labor/travel and labor discount; 8% on materials.
No jurisdiction rule is inferred. Net 14 means 14 calendar days after the
proposed invoice date, hence October 16. No holidays or business-day adjustment.

BILLING-HISTORY-5 revision 5 is declared complete by the owner for all five
work IDs and their supplied quantities. Only WORK-099 was billed: two hours
on OWNER-ISSUED-09, for the same customer/currency/unit. No other prior charges.

DEPOSIT-8-R1 has USD 200 remaining; CREDIT-2-R1 has USD 50 remaining. Both are
current, same customer/currency, and OWNER-APPLICATION-1 authorizes these exact
proposed applications to DEMO-INV-01 revision 1. Neither balance is consumed.

Expected supported charges: USD 975 gross, USD 75 discount, USD 900 net,
USD 14.40 tax, USD 914.40 invoice total, USD 250 proposed applications,
USD 664.40 proposed due. The draft remains blocked by WORK-102. Explicit owner
deferral can resolve that blocker; approval would instead change the charges
and require a new exact draft review. The records do not authorize issuance.

The JSON artifact encodes these supplied facts. Its calculated result and the
two Markdown fixtures are produced by the repository's reference renderer;
agreement among them does not prove external source authenticity, tax validity,
an LLM's behavior or any accounting-system action.
