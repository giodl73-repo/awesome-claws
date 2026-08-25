# Operating workflow

## Start here

Ask for or confirm:

- Approved policy documents, declarations pages, endorsements, premium notices, renewal notices, receipts, asset inventories, claim correspondence, carrier pages, agent notes, and owner notes
- Policy types, carrier names, redacted policy number state, effective and renewal dates, coverage labels, limits, deductibles, premiums, assets, privacy labels, and source freshness
- Insurance-review goals, renewal-review windows, claim-prep goals, household or asset links, deductible questions, exclusion questions, and stale-source fallback rules
- External actions that must remain draft-only, including claims, coverage changes, cancellations, renewals, premium payments, carrier or agent contact, document uploads, calendar edits, and legal or insurance conclusions

## Included capability boundaries

- The base starter uses supplied or approved policy documents, declarations pages, endorsements, premium notices, renewal notices, receipts, inventory records, claim correspondence, carrier pages, agent notes, and owner notes and grants no claim, coverage-change, cancellation, renewal, payment, carrier-contact, agent-contact, upload, calendar, legal, tax, financial, or insurance-advice authority.
- When policy, coverage, deductible, premium, renewal, claim-readiness, asset, source, or privacy evidence is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than presenting certainty or taking action.

## Structured decision artifact contract

- Treat `fixtures/insurance-policy.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/insurance-policy.json` and check it against `schemas/insurance-policy.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/insurance-policy.md` at `outputs/insurance-policy-organizer-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each policy, carrier, source, coverage item, limit, deductible, premium, renewal, asset, claim-readiness item, and review question to supplied evidence and freshness state
2. Collect declarations, policy, endorsement, premium, renewal, receipt, inventory, claim-correspondence, carrier-page, agent-note, and owner-note evidence from supplied or approved sources only
3. Reconcile stale policies, missing endorsements, conflicting policy-number state, deductible uncertainty, unsupported premium amounts, exclusion gaps, renewal ambiguity, and privacy-sensitive asset or address exposure
4. Group policies by type, status, renewal date, premium evidence, coverage evidence, asset links, claim-readiness state, privacy sensitivity, and owner-review need
5. Prepare a reviewable insurance policy binder with evidence, gaps, privacy notes, blocked actions, and owner questions

## Example setting

**Request:** Build an insurance policy organizer from the declarations pages, premium notices, renewal email, home inventory, receipts, and owner notes I supplied. Show deductible and coverage gaps, renewal questions, and claim-readiness evidence, but do not file a claim, contact the carrier, change coverage, pay anything, upload documents, edit my calendar, or give insurance or legal advice.

**Expected outcome:** A source-backed insurance policy binder with policy, coverage, deductible, premium, renewal, asset, and claim-readiness evidence; privacy and gap review questions; and all claim, advice, coverage-change, payment, contact, upload, calendar, and disclosure actions blocked.

## Standard deliverables

- Policy, carrier, status, and renewal ledger
- Coverage, limit, deductible, and exclusion evidence register
- Premium and payment-source review view
- Asset and claim-readiness evidence checklist
- Blocked claim, advice, coverage-change, payment, contact, upload, calendar, and disclosure handoff

## Done when

- Every policy, carrier, coverage item, deductible, limit, premium, renewal, asset link, and claim-readiness note has source identity, freshness, and privacy labeling
- Every coverage, premium, deductible, renewal, and claim-readiness conclusion traces to explicit policy, declarations, endorsement, premium, receipt, inventory, carrier, agent, or owner evidence without hiding gaps
- Policy numbers, addresses, assets, medical details, financial amounts, claim correspondence, carrier accounts, and household details are minimized or blocked from inappropriate outputs
- Claims, coverage changes, cancellations, renewals, premium payments, carrier or agent contact, document uploads, calendar edits, and legal or insurance advice remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
