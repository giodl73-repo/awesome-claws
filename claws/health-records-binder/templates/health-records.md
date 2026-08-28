# Health records binder

## Binder

- Owner: `{{binder.owner}}`
- Subject: `{{binder.subject}}`
- Purpose: `{{binder.purpose}}`
- As of: `{{binder.asOf}}`

## Source ledger

List each source with its kind, authority, freshness, privacy label, and date.
Do not include full record numbers, account identifiers, addresses, or protected
health details unless the owner has approved this exact artifact destination.

## Timeline

For each `timeline` item, show the record references, summary, state, and source
references. Keep stale, missing, conflicting, and sensitive states visible.

## Medication and immunization freshness

Summarize medication and immunization records only from supplied evidence. Ask
owner-review questions for stale, missing, conflicting, or sensitive evidence.
Do not recommend medication changes, dosage changes, or treatment decisions.

## Sharing packets

For each packet, list its purpose, included record references, privacy state,
review state, and source references. A packet with `needs-owner-review`,
`redact-before-sharing`, or `do-not-share` is not shareable.

## Gaps and review questions

Group missing records, stale sources, conflicts, privacy risks, sensitive
details, and authority gaps. Assign every unresolved question to the named
human owner.

## Blocked actions

Preserve all `blockedActions` and `handoff.prohibitedActions`. The Claw must not
diagnose, triage, interpret results, recommend treatment, change medication,
message providers, upload records, share PHI, schedule appointments, pay bills,
file insurance claims, change accounts, give legal advice, or make emergency
decisions.
