# Operating workflow

## Start here

Ask for or confirm:

- Case owner, explicitly authorized helpers, privacy and sharing ceiling, relevant jurisdictions, discovery time, review cadence, and emergency escalation path
- Owner-reported events, institution notices, account observations, credit-report entries, tax or benefits notices, device or credential signals, and controlled evidence references
- Potentially affected identity surfaces represented by redacted identifiers, authoritative institution, observed state, known dependencies, and owner priority
- Dated official recovery instructions, reporting channels, dispute or freeze procedures, deadlines, retention rules, receipt expectations, and professional or agency escalation points
- Owner-executed action history, independent confirmations, case or confirmation references, failed attempts, conflicts, costs, and unresolved questions

## Included capability boundaries

- The base starter reads owner-supplied redacted records and dated official instructions and writes a private local recovery ledger; it has no browser, messaging, calling, portal, account, identity, credential, financial, upload, payment, form-submission, or external-system capability.
- Treat official instructions, deadlines, institution notices, and case statuses as dated evidence rather than universal guidance; preserve jurisdiction and source revision and route interpretation questions to the issuing institution or qualified professional.
- Use redacted identifiers and controlled references, keep sharing candidates draft-only, and refuse secrets or full identity and payment values when minimized evidence is sufficient.

## Structured decision artifact contract

- Treat `fixtures/recovery-ledger.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/recovery-ledger.json` and check it against `schemas/recovery-ledger.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/recovery-ledger.md` at `outputs/identity-theft-recovery-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm authority, privacy, case scope, declared jurisdictions, evidence ceiling, official-source hierarchy, and urgent human escalation boundaries
2. Build a chronology that distinguishes owner reports, institution notices, observations, official instructions, and independently confirmed outcomes
3. Inventory affected identity surfaces and bind each suspected exposure, contradiction, and impact to minimized evidence without declaring fraud
4. Map official recovery routes into ordered owner-action candidates with prerequisites, deadlines, disclosure scope, expected receipts, and blocked external execution
5. Reconcile owner-executed attempts and authoritative receipts against every action, report, dispute, alert, freeze, account, credential, document, tax, benefits, insurance, and law-enforcement surface in scope
6. Version the recovery ledger after new evidence, source revisions, institution decisions, corrections, or owner choices while retaining failed, withdrawn, superseded, and unresolved state
7. Prepare a private owner handoff naming gaps, deadlines, contradictions, residual exposure, exact next owners, and prohibited actions without claiming closure

## Example setting

**Request:** Organize the recovery case after I found an unfamiliar credit account and received a tax-account notice. Use only the redacted bureau, issuer, tax-agency, and identity-recovery records I supplied. Separate suspicion from confirmed facts, map official routes and deadlines, reconcile the calls and reports I completed against receipts, and show unresolved exposure. Do not contact anyone, file anything, access accounts, freeze credit, or decide that fraud occurred.

**Expected outcome:** A private versioned ledger distinguishes the owner's observations from institution-confirmed facts, binds two affected surfaces to dated official routes, exposes a missing issuer receipt and conflicting tax-account state, and returns exact owner and qualified-human next steps without filing, contacting, authenticating, changing accounts, or claiming fraud or closure.

## Standard deliverables

- Private source and case-authority register
- Evidence-bound event chronology and affected-surface inventory
- Official recovery-route and deadline matrix
- Owner-action, attempt, receipt, report, dispute, and institution-decision ledger
- Sensitive-data minimization and controlled-sharing register
- Residual-gap, contradiction, escalation, and next-owner handoff

## Done when

- Every in-scope event, identity surface, institution, official instruction, owner attempt, and authoritative outcome is represented once with provenance, chronology, privacy, and authority state
- Every suspected exposure and affected surface maps to an official route, an owner decision, or an explicit evidence, jurisdiction, professional, or institution-owned gap
- Every owner-completed external action has an independent same-subject receipt, while planned, failed, blocked, withdrawn, and superseded actions remain distinguishable
- Every deadline, disclosure candidate, dispute, institution decision, contradiction, residual exposure, and next owner is indexed exactly in the private handoff
- The handoff makes no fraud, attribution, liability, reimbursement, credit, legal, financial, tax, insurance, law-enforcement, cybersecurity, filing, contact, account-access, authentication, credential-change, payment, or recovery-completion claim

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
