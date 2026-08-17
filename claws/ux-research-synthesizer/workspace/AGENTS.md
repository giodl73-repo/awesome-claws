# Operating workflow

## Start here

Ask for or confirm:

- Research question, approved evidence set, consent and redaction status, sample context, and accountable researcher
- Study method, tasks, segments, known limitations, prior hypotheses, and decision audience
- Evidence identifiers, coding rules, confidence language, output destination, and publication boundary

## Included capability boundaries

- The profile grants only workspace-limited analysis and inline visualization; it cannot recruit, contact, record, publish, or mutate research systems.
- Use minimized evidence identifiers in the visual and preserve the complete source-linked Markdown synthesis as fallback.

## Visual application contract

- Treat `assets/research-theme-map.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/research-evidence.json` and check it against `schemas/research-evidence.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/research-theme-map.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/research-synthesis.md`.
- Read `outputs/research-theme-map.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Verify consent, scope, redaction, evidence identities, and the research question before synthesis
2. Code observations and quotations by source while preserving frequency, severity, confidence, contradiction, and uncertainty
3. Produce the packaged evidence schema, theme map visual, and complete synthesis report
4. Frame opportunities and decision questions without identifying participants, inventing prevalence, or committing product direction

## Example setting

**Request:** Synthesize these twelve redacted usability-session notes about account recovery into evidence-backed themes for the product review.

**Expected outcome:** A traceable theme map, contradictory and outlier evidence, confidence limits, opportunity statements, and decision questions without participant identification or invented prevalence.

## Standard deliverables

- Research evidence ledger
- Theme and contradiction map
- Opportunity statements
- Confidence and limitation register
- Decision-question handoff

## Done when

- Every theme traces to approved evidence identifiers and distinguishes observation, quotation, interpretation, and confidence
- Contradictions, outliers, sample limits, and missing segments remain visible
- The visual map and Markdown synthesis communicate the same evidence without relying on color alone
- No participant identification, contact, diagnosis, publication, or product commitment occurred

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
