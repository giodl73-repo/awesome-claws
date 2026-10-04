# Operating workflow

## Start here

Ask for or confirm:

- One job and scope revision, customer-facing scope description, owner-reviewed quantities or takeoff, units, inclusions, exclusions, and accountable estimator
- Dated supplier and subcontractor quotes, labor hours and cost rates, equipment and expense allowances, currencies, quote validity, and evidence references
- Owner-defined pricing method, markup versus target-margin basis, overhead and contingency treatment, tax instructions, rounding, alternatives, and review limits
- Intended customer audience, private destination, target date, assumptions, dependencies, and unresolved scope questions

## Included capability boundaries

- X3 supplied-evidence artifact starter; no CAD, external supplier, accounting, or dispatch capability
- Use an existing estimating or calculation library for any executable calculation support added during implementation; specialist-reviewed quantities remain authoritative

## Structured decision artifact contract

- Treat `fixtures/job-estimate.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/job-estimate.json` and check it against `schemas/job-estimate.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/job-estimate.md` at `outputs/job-estimate-producer-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm the exact job scope, unit basis, approved quantities, currency, source dates, and pricing policy
2. Build a complete scope-to-cost-line map; distinguish priced work, explicit allowances, exclusions, and missing costs without treating an unknown as zero
3. Calculate material, labor, subcontractor, equipment, overhead, and contingency costs and apply the supplied markup or margin method without confusing them
4. Compare owner-requested alternatives on equivalent scope and expose changed quantities, supplier validity, assumptions, and sensitivities
5. Write an itemized customer quote draft with scope, exclusions, validity and supplied terms; retain the detailed cost build-up and commercial risks in a private workpaper
6. Reconcile both artifacts, reopen affected lines after scope or price changes, and hand the exact revision to the owner without submitting or committing

## Example setting

**Request:** Price an approved job with eight labor hours at USD 50 cost/hour, USD 300 materials, USD 100 equipment, and owner policy of 25 percent markup on direct cost. Keep tax pending because no treatment was supplied.

**Expected outcome:** The estimate shows USD 800 direct cost and USD 1,000 proposed pre-tax price, with 20 percent gross margin, not 25 percent. Customer copy describes the approved scope while the workpaper retains internal costs; missing tax treatment blocks a complete quote total.

## Standard deliverables

- Scope-linked job cost estimate
- Customer quote draft
- Allowance, exclusion, and missing-price register
- Pricing-method and sensitivity workpaper with owner review questions

## Done when

- Every scope item is priced, explicitly allowed, excluded, or blocked
- Cost and sell-price calculations recompute under the stated policy and currency
- Quote and internal estimate agree without disclosing restricted costs
- Unknown scope, missing prices, and expired evidence remain visible and no binding price or submitted bid is claimed

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
