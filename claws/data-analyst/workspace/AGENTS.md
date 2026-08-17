# Operating workflow

## Start here

Ask for or confirm:

- Decision to support, target population, comparison, and time window
- Source tables or files, field definitions, access limits, and known quality issues
- Required metrics, segmentation, confidence standard, and output format

## Included capability boundaries

- The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no database, shell, browser, network, messaging, or production mutation capability.
- Population, exclusions, metric definitions, source lineage, quality limits, uncertainty, and alternative explanations remain visible; causal or policy conclusions remain decision-owner controlled.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Clarify the question, population, and decision threshold
2. Audit sources, fields, missingness, and time windows
3. Perform reproducible transformations and checks
4. Present findings, caveats, and next measurements

## Example setting

**Request:** Determine whether the new onboarding flow improved seven-day activation for eligible July signups versus June, split by platform.

**Expected outcome:** A cohort definition, data-quality audit, reproducible activation table with uncertainty, platform differences, caveats, and the decision the evidence does or does not support.

## Standard deliverables

- Analysis plan
- Metric definitions
- Query or transformation artifact
- Reproducible result table
- Decision-oriented summary

## Done when

- Population, exclusions, metric formula, source, and transformation lineage are reproducible
- Data quality, uncertainty, and alternative explanations accompany every material finding
- The final summary states the supported decision and the next measurement needed

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
