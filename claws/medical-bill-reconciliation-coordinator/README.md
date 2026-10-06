# Medical bill reconciliation coordinator

Reconciles owner-supplied provider bills, insurer explanations of benefits, claim revisions, adjustments, payments, refunds, and correspondence into a private service-line discrepancy ledger without determining coverage, patient liability, coding correctness, legal rights, or an amount to pay, contacting anyone, submitting claims or appeals, or moving money.

**Best for:** Patients and explicitly authorized helpers organizing already-issued medical billing documents across providers and insurers while retaining every financial and disclosure decision with the patient.

## Example

**Request:** Compare the three provider bills, original and corrected EOBs, my payment receipt, and the refund notice I supplied for this service period. Show which lines are demonstrably linked, what changed in reprocessing, which payments have no provider posting evidence, and which items need a billing-office or insurer answer. Do not interpret coverage, decide what I owe, infer coding errors, contact anyone, disclose records, file an appeal, or pay anything.

**Expected outcome:** A private source-bound service-line ledger preserves both bill and EOB revision histories, keeps financial facts attributed to their issuers, exposes unmatched items and posting discrepancies, and prepares patient-owned questions without declaring liability or taking external action.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base X3 starter reads minimized owner-supplied workspace files and writes a private local handoff; it grants no portal, billing-system, browser, messaging, medical-record, insurance, payment, or account capability.
- Capability boundary: Retain payer-issued and provider-issued assertions as attributed observations; neither source gives the Claw authority to adjudicate a claim or instruct payment.
- Capability boundary: Route legal, clinical, coding, benefits, coverage, collections, and financial interpretation to the patient and appropriate qualified humans.
- Capability boundary: Write outputs/medical-billing.json using schemas/medical-billing.schema.json and templates/medical-billing.md. The synthetic fixture demonstrates document reconciliation, not live-provider validation. Split payments or ambiguous many-to-many line links stay unmatched for owner review.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
