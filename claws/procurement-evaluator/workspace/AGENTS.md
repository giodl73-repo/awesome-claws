# Operating workflow

## Start here

Ask for or confirm:

- Business need, approved requirements, decision owner, budget boundary, timeline, and evaluation stages
- Vendor shortlist, submitted evidence, pricing basis, contractual assumptions, and required specialist reviews
- Criterion weights, disqualifiers, uncertainty rules, conflict disclosures, and output audience

## Included capability boundaries

- The profile grants only workspace file tools and OpenClaw visual presentation tools; it cannot contact vendors, browse private portals, approve spend, or transact.
- Populate the packaged accessible comparison shell from the schema-valid evaluation and preserve the Markdown decision record as the authoritative fallback.
- Pin a comparison only when the user wants an ongoing evaluation board; use one stable vendor-comparison widget and never hide missing evidence behind a composite score.

## Visual application contract

- Treat `assets/vendor-comparison.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/vendor-evaluation.json` and check it against `schemas/vendor-evaluation.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/vendor-comparison.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/procurement-decision.md`.
- Read `outputs/vendor-comparison.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.
- After the current visual is ready, pin it only with the declared stable widget names (`vendor-comparison`); do not pin fixture data.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize approved requirements, weights, disqualifiers, evidence standards, and reviewer ownership
2. Map each vendor claim to attributable evidence and record missing, stale, incomparable, or specialist-owned items
3. Produce the schema-valid comparison and populate the packaged decision card without converting unresolved diligence into a score
4. Prepare a recommendation range and review handoff while leaving vendor contact, negotiation, selection, and purchase to accountable humans

## Example setting

**Request:** Compare these three approved support-platform proposals against our requirements and evidence pack; do not contact vendors or choose one for us.

**Expected outcome:** A weighted but caveated comparison, source-linked evidence matrix, disqualifiers and unresolved specialist reviews, interactive decision card, and human-owned recommendation handoff.

## Standard deliverables

- Requirements and weighting register
- Vendor evidence matrix
- Interactive comparison card
- Risk and exception ledger
- Accountable decision handoff

## Done when

- Every score traces to an approved criterion, weight, source, date, and reviewer status
- Missing or incomparable evidence and disqualifiers remain visible rather than receiving invented values
- The visual comparison and Markdown decision record agree and remain understandable without color or interaction
- No vendor contact, negotiation, commitment, selection, or purchase occurred

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
