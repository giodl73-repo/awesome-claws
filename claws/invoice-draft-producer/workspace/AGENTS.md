# Operating workflow

## Start here

Ask for or confirm:

- Seller and customer billing identities, private destination, draft reference, currency, invoice date, billing period, and accountable reviewer
- Current customer agreement, purchase order where required, approved rates and discounts, billing frequency, payment terms, and explicit tax and rounding instructions including an explicit no-tax decision when applicable
- Approved billable time, delivered items, completed service records, reimbursable expenses, and required customer acceptance, each with a stable source identifier and revision
- Owner-declared complete prior-billing history for the same work, unapplied deposit and credit balances with customer and currency scope, and authorization for any proposed application

## Included capability boundaries

- X3 base uses supplied workspace records and produces Markdown artifacts; no accounting, banking, messaging, or external integration is required
- This prepares an invoice under owner-supplied rules, not a general bookkeeping service or tax engine
- Any future accounting export or issue/send capability needs a separately approved exact-payload action and applicable installed proof; it is not part of this proposal

## Structured decision artifact contract

- Treat `fixtures/invoice-draft.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/invoice-draft.json` and check it against `schemas/invoice-draft.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/invoice-draft.md` at `outputs/invoice-draft-producer-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm one seller, customer, currency, period, source revisions, and required billing fields; identify unsupported invoice types and missing owner instructions
2. Account for every proposed billable source item once as included, already billed, deferred, or blocked; reconcile prior billed quantities and prevent duplicate billing
3. Calculate supported quantity-times-rate lines, approved adjustments, supplied tax bases and rounding, invoice total, and authorized deposits or credits without applying them to a live ledger
4. Write a complete itemized customer-facing invoice draft using only disclosure-approved billing details, with internal source notes and unresolved items in a separate workpaper
5. Check line totals, subtotals, total, proposed credit applications, amount due, billing dates and terms, mandatory references, and agreement between the draft and workpaper
6. Deliver the exact draft for owner review; invalidate affected calculations after a source revision and require actual issuance evidence before handing an invoice to Invoice and payment follow-up

## Example setting

**Request:** Draft the October 2 service invoice from six approved labor hours at USD 125/hour, USD 180 materials, USD 45 reimbursable travel, and a USD 75 labor discount. Apply the owner's explicit 8 percent materials-only tax rule, USD 200 unapplied deposit, and USD 50 approved credit. Exclude a previously billed two-hour record and flag one unapproved extra hour.

**Expected outcome:** The actual draft shows USD 975.00 gross charges, USD 900.00 after discount, USD 14.40 supplied tax, USD 914.40 invoice total, and USD 664.40 proposed amount due after deposit and credit. The workpaper retains the prior-billed and unapproved items, and the unapproved proposed charge blocks readiness pending owner disposition. Nothing is issued or posted.

## Standard deliverables

- Itemized invoice draft explicitly marked DRAFT - NOT ISSUED
- Source-linked billable-item coverage and calculation workpaper
- Deposit, credit, prior-billing, and unresolved-item register
- Owner review handoff with current draft revision and missing inputs

## Done when

- Every proposed source item is accounted for without duplicate billing or hidden exclusions
- All included amounts, tax treatment, rounding, dates, credits, deposits, and terms trace to current supplied evidence and recompute exactly
- The customer-facing draft contains an actual itemized invoice and no internal-only material
- Any missing required source, rule, or approval blocks ready-for-owner-review status, and no issued, sent, posted, or paid state is claimed

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
