# Operating workflow

## Start here

Ask for or confirm:

- The request in the requester's own words, audience, channels, intended action, deadline, timezone, and success measure
- Source material, material claims, voice guidance, required versioned assets, acceptance criteria, and restricted topics
- Accountable owner, channel owner, factual, brand, legal, and executive review requirements, and publication authority
- Measurement definitions and accountable measurement owners without observed-result claims

## Included capability boundaries

- This starter uses only briefs, source material, approval evidence, and measurement context supplied in the authorized workspace; it declares no CMS, asset library, analytics, publishing, messaging, network, package, MCP, or scheduled-job access.
- No external setup is required. Adding content, publishing, or analytics integrations later is a separate operator action that must disclose and obtain consent for the exact sources and mutation authority.
- When source, approval, publishing, or measurement systems are unavailable, identify the missing evidence and prepare drafts plus a publication handoff; never infer approval, publish, schedule, distribute, or claim measured results.
- Treat fixtures/publication-readiness-record.example.json only as a shape example. Validate outputs/publication-readiness-record.json against schemas/publication-readiness-record.schema.json, then render templates/publication-readiness-record.md without weakening source freshness, claim support, exact asset versions, approval scope, blockers, or prohibited actions.

## Structured decision artifact contract

- Treat `fixtures/publication-readiness-record.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/publication-readiness-record.json` and check it against `schemas/publication-readiness-record.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/publication-readiness-record.md` at `outputs/content-operations-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Record the brief, supplied source inventory, acceptance criteria, named owners, and authority boundaries
2. Build source-backed claims and versioned draft assets with bidirectional claim and criterion coverage
3. Record factual, brand, legal, executive, and channel-owner decisions against exact asset versions and evidence
4. Validate outputs/publication-readiness-record.json, enumerate every blocker or open question, and prepare the private publication and measurement handoff

## Example setting

**Request:** Prepare the launch package for a beta analytics dashboard aimed at operations managers and current design partners.

**Expected outcome:** A private publication-readiness record with the request intact, current source-backed claims, versioned web, email, and documentation assets, exact review scope, a defined measurement handoff, and the missing customer-quote and channel-owner approvals preserved as blockers.

## Standard deliverables

- Content brief and source inventory
- Claim ledger and versioned content assets
- Acceptance-criterion and exact-version approval record
- Measurement definition handoff
- Private publication-readiness record

## Done when

- Every material claim has current appropriate evidence, channel restrictions, and an explicit support state
- Every versioned asset and acceptance criterion has bidirectional coverage and every required review has an exact-version decision
- Every metric is defined from supplied measurement guidance and owned by a named human or team without claiming results
- The record validates against schemas/publication-readiness-record.schema.json and the private handoff includes every source, claim, asset, approval, metric, criterion, question, and blocker
- Publication, scheduling, distribution, CMS mutation, messaging, approval, and measured-result claims remain with the named owners

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
