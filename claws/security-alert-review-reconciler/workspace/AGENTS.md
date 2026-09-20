# Operating workflow

## Start here

Ask for or confirm:

- Complete owner snapshot id, revision, capture time, native alert rows, source versions, normalized alert universe, and exact source bytes
- Owner-signed source manifest, independently supplied canonical Ed25519 SPKI trust, named-human principal roster, and caller-pinned roster and evidence roots
- Current and immutable historical detector-policy revisions, safe query-free public detector documentation records, and typed time-bounded grants
- Controlled evidence for snapshots, policy revisions, grants, duplicate declarations, human dispositions, prior decisions, suppression attempts, and incident-owner review requests

## Included capability boundaries

- The base X4 starter reads only supplied workspace artifacts, runs the packaged Node validator through workspace-local exec, and uses workspace writes plus show_widget for the owner-review output; it has no browser, network, scanner, SIEM, MCP, plugin, cron, messaging, ticketing, incident, containment, or source-mutation capability.
- Run node scripts/security-alert-review-validator.mjs against the supplied review JSON with explicit --workspace-root, --as-of, --principal-roster-digest, --evidence-root, --owner-trust, --source-bundle, and --public-trust arguments before rendering any result; every path must resolve inside the workspace.
- Future read integrations must preserve owner-signed snapshot totality, immutable policy history, typed human grants, caller-controlled time and trust, context-only public documentation, and all no-authority boundaries.

## Visual application contract

- Treat `assets/security-alert-review.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/security-alert-review.json` and check it against `schemas/security-alert-review.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/security-alert-review.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/security-alert-review.md`.
- Read `outputs/security-alert-review.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Bound input bytes, nesting, strings, collections, and source work; then schema-validate before semantic evaluation
2. Verify canonical Ed25519 owner trust, signed source identity and version manifests, exact source bytes, normalized alert rows, and snapshot completeness root
3. Validate independently supplied query-free public detector documentation against approved domains with context-only authority
4. Resolve the detector-policy revision effective for each grant or decision and preserve historical digests without rewriting them
5. Require exactly one current human disposition or exact non-decision for every source, native alert id, and revision key
6. Render an X4 owner-review ledger and equivalent Markdown handoff without taking source, incident, ticket, containment, or risk authority

## Example setting

**Request:** Reconcile the complete owner-authenticated alert export for 2026-09-16 across code scanning, secret scanning, and dependency alerts. Preserve muted, suppressed, unknown-asset, self-suppression, and revised-alert states; record only authorized human outcomes; and do not query the SIEM, infer correlation or severity, mutate alerts, declare an incident, create tickets, or accept risk.

**Expected outcome:** An X4 revision-exact review ledger covering all eight native alerts with three authorized human dispositions, five exact non-decisions, one owner-declared duplicate group, one revision-invalidated prior decision, and one incident-owner review request that declares no incident.

## Standard deliverables

- Owner-authenticated source, snapshot, public trust, policy-revision, principal, grant, and controlled-evidence ledgers
- Complete native-alert coverage index keyed by source, native alert id, and revision
- Authorized human disposition and exact non-decision ledger with historical revision invalidation
- Owner-declared duplicate and incident-owner review-request records with no correlation or declaration effect
- X4 security alert review visual with equivalent Markdown handoff and explicit authority non-claims

## Done when

- The owner signature, source identities and versions, exact byte digests, normalized alert universe, and snapshot completeness root all verify against independently supplied trust
- Every native alert key appears exactly once in coverage and has exactly one current human disposition or exact non-decision
- Every grant and decision binds the policy revision effective at its original time, while current reviews bind the current policy and historical digests remain immutable
- Public trust is independently supplied, query-free, approved-domain, and context-only; unsafe URLs, malformed trust, omissions, substitutions, stale replay, and authority overclaim fail closed
- The X4 and Markdown handoff make no SIEM, correlation, severity, suppression, containment, incident, ticket, risk, compliance, remediation, or security claim

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
