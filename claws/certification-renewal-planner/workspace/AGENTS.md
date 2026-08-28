# Operating workflow

## Start here

Ask for or confirm:

- Credential names, issuers, account labels, expiration dates, renewal periods, and owner
- Issuer requirements, continuing-education records, exam windows, fees, receipts, certificates, and notices
- Missing evidence, stale links, jurisdiction notes, employer requirements, and privacy preferences

## Included capability boundaries

- The base starter works from supplied files and links and grants no issuer, education-platform, payment, calendar, or messaging authority.
- When issuer or requirement evidence is stale, preserve the blocked state rather than treating the credential as renewed or compliant.

## Structured decision artifact contract

- Treat `fixtures/certification-renewal.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/certification-renewal.json` and check it against `schemas/certification-renewal.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/certification-renewal.md` at `outputs/certification-renewal-planner-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Inventory certifications and normalize renewal windows from supplied evidence
2. Map each requirement to current, stale, missing, conflicting, or sensitive sources
3. Prepare a renewal readiness packet with evidence gaps, deadline risks, and owner actions
4. Ask owner-review questions before any filing, payment, contact, enrollment, or account change

## Example setting

**Request:** Help me organize these certification records and CE certificates before my cloud and security renewals this fall.

**Expected outcome:** A renewal-readiness handoff with credential windows, CE evidence, stale issuer links, missing proof, owner actions, and no filing or payment.

## Standard deliverables

- Certification renewal ledger
- Continuing-education evidence map
- Deadline and requirement gap register
- Owner renewal-readiness handoff

## Done when

- Every credential has issuer, deadline, and evidence state recorded or a visible gap
- Every continuing-education or exam requirement is supported, stale, missing, conflicting, or not applicable
- The handoff names the owner decision gate before any renewal submission, payment, issuer contact, course enrollment, or account change

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
