# Operating workflow

## Start here

Ask for or confirm:

- Owner-supplied bills, receipts, statements, subscription ledgers, utility notices, rent or mortgage notes, payroll notes, household notes, category targets, and prior budget snapshots
- Household members, expense owners, budget categories, periods, amounts, currencies, due dates, cadence, target ranges, split rules, privacy labels, and source freshness rules
- Review goals such as upcoming bills, category totals, target variance, missing evidence, shared expense questions, bill timing, and owner-review handoff
- External actions that must remain draft-only, including banking, payment, bill pay, account changes, vendor contact, cancellation, negotiation, credit, tax, legal, investment, calendar, and messaging actions

## Included capability boundaries

- The base starter uses supplied or approved household bills, receipts, statements, subscription ledgers, payroll notes, utility notices, rent or mortgage notes, owner notes, category targets, and prior budget snapshots and grants no banking, payment, credit, tax, legal, vendor-contact, account, calendar, or messaging authority.
- When income, bill, expense, amount, due-date, category, target, variance, shared-expense, or source evidence is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than making financial recommendations or taking action.

## Structured decision artifact contract

- Treat `fixtures/household-budget.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/household-budget.json` and check it against `schemas/household-budget.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/household-budget.md` at `outputs/household-budget-steward-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each supplied bill, expense, income note, target, category, owner label, due date, amount, currency, source, and privacy label to explicit evidence and freshness state
2. Calculate category totals and variances only from supplied or approved evidence, preserving missing, stale, conflicting, or partial amounts
3. Reconcile upcoming bills, recurring expenses, target variance, shared expense ambiguity, unsupported income or amount claims, and account-adjacent privacy risks
4. Group categories, bills, variances, and evidence gaps into owner-review questions without telling the owner what decision to make
5. Prepare a household budget handoff with source-backed totals, variance notes, missing evidence, blocked actions, and owner-controlled next steps

## Example setting

**Request:** Make a household budget review from the bills, receipts, payroll note, subscription ledger, and category targets I supplied. Show upcoming bills, category totals, target variance, stale or missing evidence, and owner questions, but do not connect accounts, pay anything, contact vendors, cancel services, apply for credit, edit calendars, or tell me what financial decision to make.

**Expected outcome:** A source-backed household budget snapshot with supplied income and expense evidence, bill due dates, category totals, target variance, missing or stale evidence, privacy notes, owner questions, and all banking, payment, vendor, account, cancellation, credit, tax, legal, financial-advice, calendar, and messaging actions blocked.

## Standard deliverables

- Supplied household budget snapshot
- Bill, recurring expense, and due-date ledger
- Category total and target-variance review
- Source freshness, privacy, and missing-evidence register
- Blocked banking, payment, account, vendor-contact, cancellation, credit, tax, legal, financial-advice, calendar, and messaging handoff

## Done when

- Every supplied income note, bill, expense, category target, amount, due date, cadence, owner label, source, and privacy label has source identity and freshness state
- Every category total, bill timing, target variance, and shared-expense note traces to supplied or approved evidence without inferring private account data
- Stale bills, missing amounts, unsupported targets, conflicting category assignments, shared-expense uncertainty, and privacy-sensitive account details are explicit
- Banking, payments, money movement, account changes, vendor contact, cancellations, negotiation, credit applications, tax/legal/financial/investment advice, budget commitments, calendar edits, and messages remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
