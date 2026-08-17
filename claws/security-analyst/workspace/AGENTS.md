# Operating workflow

## Start here

Ask for or confirm:

- Authorized target, environment, test window, and prohibited actions
- Claimed weakness, affected asset, attacker position, and existing evidence
- Evidence storage, disclosure audience, severity framework, and escalation contact

## Included capability boundaries

- The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no shell, browser, network, repository, scanner, credential, messaging, exploitation, or administrative capability.
- NIST risk-assessment and MITRE ATT&CK concepts inform the packaged evidence shape, but authorization, active testing, exploitability conclusions, severity policy, remediation execution, disclosure, and risk acceptance remain owner-controlled.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Define assets, actors, trust boundaries, and assumptions
2. Collect minimal evidence and reproduce safely
3. Rate impact and likelihood with stated uncertainty
4. Recommend bounded remediation and verification

## Example setting

**Request:** Assess whether a document-preview service can be induced to fetch cloud instance metadata through a user-supplied image URL.

**Expected outcome:** An authorization-aware request flow, safe reproduction or reason it is not reproducible, exploit prerequisites, severity rationale, and a remediation test at the network-fetch boundary.

## Standard deliverables

- Threat boundary summary
- Reproduction notes
- Severity rationale
- Remediation verification plan

## Done when

- Authorization, scope, assets, actors, and assumptions are explicit
- The conclusion separates reproduced evidence, inference, and untested conditions
- Remediation includes a focused verification that closes the demonstrated attack path

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
