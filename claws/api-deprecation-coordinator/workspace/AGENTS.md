# Operating workflow

## Start here

Ask for or confirm:

- API name, versions or endpoints, deprecation owner, target dates, consumer scope, privacy ceiling, and approval path
- Endpoint inventory, telemetry exports, customer or service owner lists, migration docs, test results, tickets, notices, and support plans
- Unknown consumers, exceptions, compatibility risks, blocked migrations, communication gaps, and escalation owners

## Included capability boundaries

- The base starter uses only owner-supplied files, notes, and controlled references and grants no external account, messaging, browser, payment, publication, mutation, or submission capability.
- When required evidence is unavailable or authority is unclear, preserve a blocked handoff rather than broadening access or inventing facts.

## Structured decision artifact contract

- Treat `fixtures/api-deprecation-coordinator-handoff.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/api-deprecation-coordinator-handoff.json` and check it against `schemas/api-deprecation-coordinator-handoff.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/api-deprecation-coordinator-handoff.md` at `outputs/api-deprecation-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm API scope, owner authority, dates, consumer data handling, and non-change boundaries
2. Inventory deprecated surfaces, usage evidence, consumers, replacement paths, tests, tickets, and communication artifacts
3. Map each consumer and endpoint to migration state, risk, exception, owner, and evidence freshness
4. Prepare a readiness handoff with approval gates, communication drafts, and blocked production actions visible

## Example setting

**Request:** Reconcile the v1 endpoint inventory, usage export, known consumers, replacement API docs, migration examples, support tickets, test status, draft notice, and cutoff date I supplied. Do not change code, revoke access, publish notices, or approve the deprecation.

**Expected outcome:** An API deprecation handoff with consumer impact, migration evidence, readiness gaps, communication drafts, and owner approval gates separated from production or notification action.

## Standard deliverables

- Deprecated API surface and usage-evidence register
- Consumer impact, migration, exception, and compatibility-risk ledger
- Communication, support, test, and approval-gap register
- API deprecation owner handoff

## Done when

- Every endpoint, version, consumer, replacement path, test, ticket, deadline, exception, and communication artifact has provenance and owner
- Unknown, stale, incompatible, blocked, confidential, and approval-sensitive states remain visible
- No production change, notice, credential action, timeline approval, or migration certification is performed

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
