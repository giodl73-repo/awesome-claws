# Operating workflow

## Start here

Ask for or confirm:

- Owner-supplied document names, issuing authorities, expiration dates, renewal windows, partial identifiers, receipt or portal notes, official checklist links, appointment notes, dependent authority notes, and privacy labels
- Approved sources such as official agency pages, licensing-board pages, school or employer renewal notes, membership notices, registration notices, receipts, owner notes, and travel constraints
- Owner review goals such as upcoming expirations, renewal readiness, missing materials, conflicting dates, dependent-document handoff, and travel-risk timing
- External actions that must remain draft-only, including forms, submissions, payments, appointments, agency contact, account changes, document uploads, eligibility claims, and legal or immigration advice

## Included capability boundaries

- The base starter uses supplied or approved official pages, renewal notices, receipts, owner notes, partial identifiers, travel constraints, school or employer notes, and licensing-board instructions and grants no filing, payment, upload, booking, account, agency-contact, legal, immigration, tax, medical, licensing, or eligibility authority.
- When expiration, authority, renewal window, required materials, dependent authority, travel timing, official instructions, account state, eligibility, identity, or privacy scope is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than asserting readiness or taking action.

## Structured decision artifact contract

- Treat `fixtures/document-renewal.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/document-renewal.json` and check it against `schemas/document-renewal.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/document-renewal.md` at `outputs/document-renewal-tracker-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each document, source, issuing authority, expiration date, renewal window, dependency, required material, privacy label, and owner question to supplied or approved evidence
2. Group renewals by urgency, authority, owner, dependent-person scope, required materials, travel relevance, privacy risk, source freshness, and blocked external action
3. Reconcile stale, missing, conflicting, partial, or sensitive renewal evidence without inferring eligibility, identity facts, citizenship, residence, health, legal status, or official acceptance
4. Prepare a renewal ledger, required-materials checklist, dependency view, and owner-review questions with source freshness and privacy labels
5. Return a blocked-action handoff without filing, paying, submitting, booking, messaging, uploading, changing accounts, or giving legal, immigration, tax, medical, licensing, or eligibility advice

## Example setting

**Request:** Build a renewal tracker from these passport, driver license, professional certification, vehicle registration, and school ID notes. Show what is expiring in the next year, what materials I need to review, and which dates conflict, but do not file forms, pay fees, upload documents, book appointments, contact agencies, change accounts, or tell me legal or immigration advice.

**Expected outcome:** A private source-backed renewal ledger with expiration windows, official-source references, missing materials, conflict notes, dependent or travel-sensitive flags, owner questions, and all filing, submission, payment, booking, contact, account, upload, legal, immigration, tax, medical, licensing, and eligibility actions blocked.

## Standard deliverables

- Document and credential renewal ledger
- Expiration and renewal-window timeline
- Required materials and missing-evidence checklist
- Dependent-person, travel-sensitive, and privacy review notes
- Conflicting-source and stale-source question list
- Blocked filing, submission, payment, appointment, agency-contact, account-change, upload, and advice handoff

## Done when

- Every document, authority, expiration, renewal window, required material, dependency, conflict, and owner question has source identity, freshness, privacy labeling, and owner-review state
- Every renewal date, material requirement, and readiness claim traces to supplied or approved evidence without hiding stale, partial, missing, or conflicting source state
- Document numbers, addresses, birth dates, biometrics, dependent details, travel plans, eligibility facts, and account information are minimized or blocked from inappropriate outputs
- Forms, submissions, payments, appointments, agency contact, account changes, uploads, eligibility certification, and legal, immigration, tax, medical, licensing, or identity advice remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
