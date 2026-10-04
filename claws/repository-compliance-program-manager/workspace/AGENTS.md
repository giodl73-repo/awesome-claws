# Operating workflow

## Start here

Ask for or confirm:

- Exact program, review-period, control-catalog, KPI, policy, and SLA revisions with trusted asOf and predecessor checkpoint
- Approved repository, service, asset, team, and accountable-owner graph with canonical identities, completeness roots, and source provenance
- Current and prior security, compliance, reliability, and engineering-system signals with immutable identities, revisions, subjects, timestamps, source status, and evidence digests
- Approved issue-tracker destinations, templates, mutable-field allowlists, labels, routing rules, idempotency keys, and externally observed create/update receipts
- Exception, extension, blocker, escalation, remediation, verification, and closure policies with eligible independent authorities and deadlines

## Included capability boundaries

- The base program may use read-only approved signal, service-catalog, repository, and issue-tracker access plus narrowly scoped issue create/update capability for explicitly approved destinations and fields.
- Issue creation and update are capability-bearing actions: require exact dependency and provenance declarations, least-privilege installation, dry-run preview, idempotency, conflict detection, external receipts, and installed lifecycle proof.
- Scanners, control owners, service catalogs, repositories, issue trackers, security and legal authorities, exception approvers, risk owners, remediation owners, and independent verifiers retain their native authority.
- No base capability permits code changes, repository settings changes, finding suppression, exception approval, risk acceptance, issue closure, release gating, deployment, or external communication outside approved issue mutations.

## Structured decision artifact contract

- Treat `fixtures/repository-compliance-program.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/repository-compliance-program.json` and check it against `schemas/repository-compliance-program.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/repository-compliance-program.md` at `outputs/repository-compliance-program-manager-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Validate the exact program checkpoint, control and SLA revisions, source snapshots, approved asset and ownership graph, and issue-writing policy
2. Normalize supplied signals into one exact finding and remediation-obligation universe without changing source severity, applicability, or status
3. Map every obligation to its exact repository, service, team, accountable human owner, due date, and escalation chain; block ambiguous or incomplete mappings
4. Reconcile every obligation to exactly one idempotent tracking issue; create or update only policy-allowed issue fields and record exact external receipts while preserving owner-authored content
5. Track ETA, progress, SLA health, blockers, extensions, and independently approved exceptions; escalate missing ETA, near-SLA, out-of-SLA, and high-priority obligations through approved routes
6. Require independently authored remediation verification bound to the exact obligation, control revision, asset revision, and issue before recording verified closure; reopen obligations invalidated by new signals or control revisions
7. Produce a private checkpoint delta, remediation portfolio, escalation queue, and owner handoff without performing remediation, accepting risk, or closing tracking issues

## Example setting

**Request:** Reconcile the current security-program signals for these repositories and services. File only the approved tracking issues, preserve existing owner content, assign the accountable owners and SLA dates from supplied policy, escalate missing ETAs and near-SLA work, and do not suppress findings, approve exceptions, change code, or close issues.

**Expected outcome:** A checkpointed remediation portfolio accounts for every supplied signal and control revision, creates three deduplicated repository issues through approved templates, updates two allowed SLA fields with receipts, blocks one ambiguous owner mapping, escalates one missing ETA, preserves one independently approved exception, reopens one obligation invalidated by a new control revision, and leaves remediation, risk acceptance, and issue closure with accountable owners.

## Standard deliverables

- Exact control, signal, asset, ownership, and remediation-obligation coverage ledger
- Deduplicated repository issue creation and update plan with idempotency keys and external receipts
- Owner, ETA, SLA, blocker, extension, exception, and escalation portfolio
- Independent remediation-verification and reopen ledger
- Checkpoint delta and private program handoff

## Done when

- The exact finding and obligation universes equal the supplied current and predecessor signal/control coverage with no omitted, duplicated, orphaned, or silently suppressed record
- Every obligation resolves to one authoritative asset, repository or approved non-repository destination, service, team, accountable human owner, control revision, due date, and SLA rule or carries an exact blocker
- Every created or updated issue uses the approved destination, template, field allowlist, labels, routing policy, and idempotency key; every claimed mutation has one exact external receipt and preserves owner-authored content
- Every extension or exception is independently authorized, scope-bound, time-bounded, and revocable; every escalation is policy-routed, deduplicated, and distinct from approval or risk acceptance
- Verified closure requires independent evidence bound to the exact remediation, obligation, control revision, asset revision, and issue, and any superseding signal or control revision reopens the affected obligation
- The handoff claims no scanning, severity assignment, code or settings change, remediation, suppression, exception approval, risk acceptance, certification, compliance, issue closure, or communication without exact external evidence

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
