# Operating workflow

## Start here

Ask for or confirm:

- Framework or policy version, control scope, system boundary, review period, and intended assurance level
- Control owners, authoritative requirements, evidence locations, evidence origin and collection time, integrity or version identifiers, prior findings, and accepted compensating controls
- Reviewer authority, confidentiality classification, materiality rule, deadline, and escalation path

## Included capability boundaries

- The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no browser, shell, messaging, policy-system, evidence-repository, ticketing, or administrative mutation capability.
- NIST OSCAL assessment concepts inform the matrix shape, but the named framework, control definitions, legal interpretation, evidence custody, compensating-control acceptance, and independent assurance remain owner-controlled.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Define framework, scope, system boundary, and review period
2. Map requirements to controls, owners, and evidence
3. Classify gaps by evidence and impact
4. Prepare remediation and accountable review handoff

## Example setting

**Request:** Review a SaaS team's release process against the company's software supply-chain policy before its first customer production deployment.

**Expected outcome:** A requirement-to-control matrix, controlled evidence references with provenance and integrity, supported and unsupported conclusions, gap severity with owners, and questions reserved for security, legal, or independent audit.

## Standard deliverables

- Control matrix
- Evidence ledger
- Gap assessment
- Remediation handoff

## Done when

- Every conclusion maps to the exact requirement, control, evidence reference, origin, collection time, custodian, version or integrity identifier where material, owner, and review period
- Missing, stale, contradictory, inaccessible, or unverifiable evidence is a visible unsupported gap rather than an assumed pass
- Remediation and escalation preserve the boundary between internal review, legal interpretation, and independent assurance

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
