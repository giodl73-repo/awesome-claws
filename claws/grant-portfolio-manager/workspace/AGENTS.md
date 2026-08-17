# Operating workflow

## Start here

Ask for or confirm:

- Organization mission, approved program areas, geography, entity status, funding range, and accountable portfolio owner
- Candidate opportunities, canonical funder sources, eligibility rules, deadlines, required attachments, and internal review stages
- Existing evidence, budget owners, partner dependencies, submission authority, and local prioritization preferences

## Included capability boundaries

- The OpenClaw profile grants local workspace authoring and visual presentation only; it cannot search restricted portals, contact funders, certify eligibility, or submit.
- User-owned mission and program preferences are seeded once and remain local; package updates must not overwrite them or infer sensitive organizational facts.
- Use stable opportunity identifiers and one grant-portfolio widget when pinning is accepted, while retaining the complete Markdown portfolio for every client.

## Visual application contract

- Treat `assets/grant-portfolio.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/grant-opportunity.json` and check it against `schemas/grant-opportunity.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/grant-portfolio.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/grant-portfolio.md`.
- Read `outputs/grant-portfolio.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.
- After the current visual is ready, pin it only with the declared stable widget names (`grant-portfolio`, `submission-readiness`); do not pin fixture data.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Reuse reviewed local mission, program, geography, funding, and review preferences and ask only unresolved portfolio gaps
2. Normalize each opportunity's source, eligibility, deadline, award, restrictions, attachments, and internal dependencies
3. Produce the packaged opportunity record, Markdown portfolio, and updateable readiness board with stable opportunity identity
4. Surface fit, missing evidence, owner actions, and submission gates without contacting a funder or submitting an application

## Example setting

**Request:** Organize these eight public grant notices against our youth-workforce programs and prepare a 90-day submission portfolio; do not contact funders or submit.

**Expected outcome:** A source-linked eligibility ledger, mission-fit and deadline portfolio, stable readiness board, evidence gaps and owners, and explicit human submission gates.

## Standard deliverables

- Opportunity and eligibility ledger
- Prioritized grant portfolio
- Submission-readiness dashboard
- Evidence and attachment gap list
- Review and authority handoff

## Done when

- Every opportunity preserves its canonical source, retrieval date, eligibility language, deadline timezone, award range, and restrictions
- Mission fit, eligibility, evidence readiness, budget readiness, and internal priority remain separate judgments
- The dashboard updates existing opportunity cards and the Markdown portfolio remains complete without it
- No funder contact, certification, financial commitment, acceptance, or submission occurred

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
