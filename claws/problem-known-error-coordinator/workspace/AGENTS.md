# Operating workflow

## Start here

Ask for or confirm:

- Exact open problem revision, predecessor artifact and revision, service scope, accountable problem owner, and caller-controlled cutoff
- Owner-signed incident-membership manifest with complete Incident Response artifact, schema, source-byte, follow-up, and identity digests
- Competing owner hypothesis proposal and disposition revisions with exact QA run, build, environment, evidence, and execution time
- Expiring workaround approval, known-error declaration, Change Control artifact and plan digests, external execution and verification receipts, and later recurrence
- Caller-supplied allowlisted keyring, verified-human credentials, scoped grants, evidence claims, source attestations, owner receipts, and exact closed coverage

## Included capability boundaries

- The base package uses supplied workspace evidence and caller-provided trust only; it has no incident, change, deployment, publication, messaging, or ticket mutation capability.
- Inline visualization is presentation-only and must preserve the complete Markdown fallback and structural authority non-claims.

## Visual application contract

- Treat `assets/problem-known-error-review.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/problem-known-error.json` and check it against `schemas/problem-known-error.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/problem-known-error-review.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/problem-known-error-coordinator-handoff.md`.
- Read `outputs/problem-known-error-review.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Validate schema, bounded structure, caller cutoff, keyring, credentials, grants, signatures, source bytes, predecessor, and exact closed coverage
2. Resolve every incident membership to a complete schema- and semantic-valid Incident Response artifact and exact follow-up identity
3. Reconcile competing hypothesis proposals to exact QA runs and require strictly later disposition evidence
4. Bind workaround approval and known-error declaration to fresh owner receipts and their consumed revisions
5. Bind the owner-executed change to the exact Change Control artifact and plan, then admit recurrence only after finalized change and later incident membership
6. Render a private owner-review artifact and inline visual while returning every governed decision to its existing owner

## Example setting

**Request:** Reconcile these three owner-declared checkout incidents into the current problem revision, preserve the competing hypothesis tests, approved workaround, known-error declaration, completed change receipt, and later recurrence, and prepare the next owner decision without publishing, changing, or closing anything.

**Expected outcome:** A signed, revision-bound problem lifecycle shows three exact incident memberships, one supported and one refuted hypothesis, an unexpired owner-approved workaround, an owner-declared known error, one owner-executed verified change, a later recurrence, complete coverage, and an escalation-only owner handoff.

## Standard deliverables

- Owner-signed incident-membership and source-provenance manifest
- Hypothesis proposal, QA test, and disposition matrix
- Workaround and known-error revision ledger
- Change-finalization and post-change recurrence ledger
- Exact coverage and authority findings
- Private Markdown handoff and inline problem lifecycle visual

## Done when

- Every supplied principal, evidence record, incident membership, hypothesis revision, test, workaround, known error, change receipt, and recurrence is covered exactly once
- Every consumed revision has a strictly later independently verifiable owner receipt and exact source-byte attestation
- Incident memberships, QA runs, and change plans resolve to the exact complete caller-supplied owner artifacts and canonical schemas
- The Markdown and inline visual agree on lifecycle state, blockers, chronology, evidence, and owner authority
- No output claims inferred correlation or root cause, workaround approval or execution, known-error publication, production change, closure, mutation, or risk acceptance

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
