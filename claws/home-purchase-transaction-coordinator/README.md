# Home purchase transaction coordinator

Maintains a private, evidence-bound home-purchase transaction ledger across supplied representation authority, offer and contract revisions, contingencies, inspections, financing, appraisal, title, insurance, funds, closing conditions, owner actions, and independent receipts without interpreting documents, negotiating, transmitting, paying, signing, waiving, or claiming readiness or ownership.

**Best for:** Prospective residential buyers and explicitly authorized helpers coordinating one accepted-offer purchase while licensed real-estate, lending, inspection, title, insurance, tax, legal, and closing professionals retain authority.

## Example

**Request:** Reconcile the accepted offer, amendments, disclosures, inspection report, repair response, appraisal, lender conditions, title commitment, insurance binder request, estimated settlement statement, earnest-money receipt, and closing checklist I supplied for purchase HP-2026-09. Show exact source revisions, deadline conflicts, unmet conditions, missing independent receipts, wire-safety questions, and who must decide next. Do not interpret documents, advise me, contact anyone, negotiate, submit, order, schedule, sign, waive, pay, transfer funds, or say we are cleared to close.

**Expected outcome:** A private source- and subject-bound transaction ledger reconciles contract milestones, contingencies, professional workstreams, funds, owner actions, independent receipts, and unresolved conditions into an exact buyer-review handoff without transaction action or legal, financial, professional, readiness, or ownership conclusions.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter reads only owner-supplied minimized files and controlled references and writes a private local ledger; it grants no listing, brokerage, lending, title, insurance, tax, legal, inspection, escrow, closing, messaging, browser, account, payment, signature, scheduling, or external-system capability.
- Capability boundary: Treat contracts, disclosures, professional reports, lender conditions, title records, insurance records, settlement statements, instructions, deadlines, and receipts as exact attributed evidence rather than permission or professional conclusions.
- Capability boundary: Keep every contact, negotiation, submission, application, service order, appointment, signature, certification, waiver, release, payment, fund transfer, account change, recording, possession, and cancellation action draft-only and controlled by the buyer and qualified authority.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
