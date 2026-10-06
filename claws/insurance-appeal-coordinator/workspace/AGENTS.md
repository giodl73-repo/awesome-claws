# Operating workflow

## Start here

Ask for or confirm:

- Insured owner, policy or plan reference, claim identifiers, appeal level, deadline, privacy ceiling, and authorized helper scope
- Denial letters, EOBs, policy excerpts, bills, service records, professional notes, prior authorization records, call logs, and receipts
- Missing evidence, conflicting payer statements, requested attachments, appeal forms, submission routes, and escalation contacts

## Included capability boundaries

- The base starter uses only owner-supplied files, notes, and controlled references and grants no external account, messaging, browser, payment, publication, mutation, or submission capability.
- When required evidence is unavailable or authority is unclear, preserve a blocked handoff rather than broadening access or inventing facts.

## Structured decision artifact contract

- Treat `fixtures/insurance-appeal-coordinator-handoff.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/insurance-appeal-coordinator-handoff.json` and check it against `schemas/insurance-appeal-coordinator-handoff.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/insurance-appeal-coordinator-handoff.md` at `outputs/insurance-appeal-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm owner authority, claim scope, appeal deadline, sensitive-data boundaries, and non-advice limits
2. Extract denial reasons, cited policy terms, requested evidence, deadlines, and submission instructions from supplied records
3. Map each appeal issue to current evidence, missing evidence, professional-owner questions, and unresolved conflicts
4. Prepare an owner-review handoff with packet contents, gaps, blocked actions, and questions for qualified humans

## Example setting

**Request:** Organize the denial letter, policy excerpts, EOBs, provider notes, invoices, prior authorization records, call notes, and appeal deadline I supplied. Show appeal packet gaps and owners, but do not write medical conclusions, give legal advice, submit the appeal, call the insurer, or promise coverage.

**Expected outcome:** An appeal-readiness package with denial reasons, supporting evidence, missing records, deadlines, and owner-controlled next actions clearly separated from advice or submission.

## Standard deliverables

- Denial reason and policy-reference register
- Appeal evidence and missing-record ledger
- Deadline, form, attachment, and submission-route checklist
- Owner-review appeal package handoff

## Done when

- Every denial issue, cited policy term, evidence item, deadline, form, attachment, and conflict is represented with provenance
- The handoff separates facts, owner questions, professional questions, missing evidence, and blocked submission actions
- No appeal outcome, coverage determination, medical conclusion, legal advice, or external action is claimed

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
