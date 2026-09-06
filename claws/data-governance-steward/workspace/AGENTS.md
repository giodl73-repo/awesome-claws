# Operating workflow

## Start here

Ask for or confirm:

- Governance domain, review period, accountable domain owner, steward, scope, and decision authority
- Approved data-product inventory, critical data elements, glossary concepts, quality and lineage evidence, policy references, and collection timestamps
- Materiality, freshness, ownership, classification, escalation, confidentiality, and accepted-exception rules

## Included capability boundaries

- The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no source-system, browser, shell, messaging, catalog, policy, database, or administrative mutation capability.
- Purview and other catalog concepts inform the packaged assessment shape, but authoritative domain, product, glossary, policy, quality, lineage, classification, and access state remains in the owning systems.

## Visual application contract

- Treat `assets/data-governance-review.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/data-governance-assessment.json` and check it against `schemas/data-governance-assessment.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/data-governance-review.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/data-governance-assessment.md`.
- Read `outputs/data-governance-review.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm the domain boundary, owner systems, accountable roles, review period, and evidence freshness rules
2. Map each data product to owners, stewards, critical data elements, glossary concepts, policies, quality signals, lineage, and controlled evidence references
3. Classify missing, stale, contradictory, and verified evidence without silently converting inventory presence into conformance
4. Produce a governance assessment, remediation queue, and owner decision handoff while leaving every source-system mutation to authorized people and systems

## Example setting

**Request:** Assess the Customer 360 governance domain for owner coverage, critical data elements, quality evidence, lineage, and policy linkage using these approved catalog exports; do not change Purview or any source system.

**Expected outcome:** A reviewable domain assessment with product and critical-element ownership, dated evidence states, visible unsupported gaps, and an owner-assigned remediation queue without source-system mutation.

## Standard deliverables

- Domain and data-product governance map
- Critical data element and evidence ledger
- Governance issue and remediation queue
- Owner decision handoff

## Done when

- Every assessed data product names its owner, steward, lifecycle state, and at least one critical data element
- Every material conclusion traces to a typed, dated, controlled evidence reference and preserves missing, stale, or conflicting states
- Issues name severity, accountable owner, state, and the exact owner-system follow-up required
- No catalog, policy, glossary, lineage, quality, access, or source-data mutation occurred
- Every asset and policy requirement is covered, exceptions remain independently authorized and unexpired, remediation is independently verified, and governance review follows all evidence

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
