# Partner joint-business-plan revision review

Render `outputs/partner-business-plan-review.md` only after the companion JSON
passes both the strict schema and semantic validator.

## Exact identity and review period

- Partner: `{{identity.partnerId}}` — {{identity.partnerName}}
- Plan / revision: `{{identity.planId}}` r{{identity.planRevision}}
- Predecessor: r{{identity.predecessorRevision}}
- As of: {{identity.asOf}}
- Coverage: {{identity.period.start}} through {{identity.period.end}}
- Period segments: {{identity.period.segments[].id}}

Reject mixed partner, plan, revision, predecessor, or period evidence rather
than merging it.

Show the controlled `{{predecessorManifest}}` source and its complete immutable
record universe. Revision deltas must match this independent predecessor
manifest exactly; resealing current records must never rewrite it.

## Principals and decision rights

List `{{principals[].id}}`, organization, accountable name, and exact
`{{principals[].decisionRights}}`. A recorded decision or action never widens
the principal's declared right. Verify every right against the exact
`{{authorityRosterEvidence.principalAuthorities[]}}` entry from its controlled
source, immutable `{{authorityRosterEvidence.contentDigest}}`, and independently
verified `{{authorityRosterEvidence.signature}}`; identify the roster issuer
holding `authority-governance` before using it. Require the signed roster's
`freshnessRuleDigests` to bind every freshness rule exactly once.

## Attributable evidence ledger

For every `{{evidence[].id}}`, show scope, exact partner/plan/revision,
subject type and ref, controlled source, immutable source version, observation
time, exact period segment refs, issuing principal, freshness rule,
confidentiality scope, and conflict refs. Show reciprocal
`dispositionConflictRefs` for conflict-disposition
evidence. Show each subject's immutable `contentDigest`; every current evidence
row must preserve its source-supplied subject digest, resolve to exactly one
record, and be reciprocally listed. Resealing derived records must never rewrite
source evidence bindings. Separate
current-revision evidence from predecessor evidence bound to exactly one delta
fingerprint. Verify the predecessor manifest's independent
`{{predecessorManifest.signature}}` and exact evidence-row fingerprints before
using any historical fingerprint.
Supply the partner-ID-and-name-bound governance public key and validation time
through trusted runtime configuration (`validate:artifact --trust-keys
<keys.json> --as-of <RFC3339>`); never accept a key or validation time declared
only by the plan itself. Commitment approval evidence must explicitly assert
`approval-granted`, and recorded QBR decision evidence must assert
`decision-recorded`.

## Evidence governance

Show `{{evidenceGovernance.freshnessRules[]}}`,
`{{evidenceGovernance.confidentialityScopes[]}}`,
`{{evidenceGovernance.conflicts[]}}`, exact conflict domain and scope,
disposition state and reciprocal evidence, and
`{{evidenceGovernance.escalationPaths[]}}` with resolution state, time, and
reciprocal owner-issued resolution evidence. Show the authority roster's
maximum age and reject stale authority assignments. Every owner must resolve
to the exact decision right for the governed domain.

## Plan-domain reconciliation

Render the evidence-bound records for:

- capabilities and designations;
- solution plays and reference-only co-sell opportunities;
- partner, vendor, and joint commitments with party-matched owner rights and
  reciprocal approval evidence; joint commitments require both organizations;
- benefit and incentive eligibility evidence, never official eligibility;
- dependencies and unaccepted risks;
- chronological owner actions and QBR decisions; and
- predecessor-to-current revision deltas with exact
  `{{revisionDelta[].currentRecordRefs}}`,
  `{{revisionDelta[].predecessorRecordRefs}}`, current and predecessor
  `contentDigest` fingerprints, current evidence, and predecessor evidence.
  Derive added, removed, changed, or unchanged from record identities and digest
  comparison rather than source-reference strings. Changed and unchanged deltas
  preserve identical record identities; additions and removals use separate
  deltas.

## Exact period and domain coverage

Show all `{{coverage[].domain}}` rows, every
`{{coverage[].segmentRefs}}`, covered/gap/not-applicable state, record refs,
and owner. Every required domain must cover every declared segment exactly
once. A `not-applicable-by-owner` row is valid only for an empty universe with
exact `{{coverage[].applicabilityEvidenceRefs}}` issued by that domain's
authorized owner. Show `{{gaps[]}}` and its escalation path beside the affected
coverage row.

`ready-for-owner-review` is derived only when coverage is complete and no gap,
unresolved conflict, escalation, or risk, blocked dependency or action, at-risk
commitment, stale evidence state, or eligibility-evidence gap remains.

## Owner handoff and reserved authority

List each `{{handoff.blockedAuthorityActions[].category}}`, owner, and reason.
Keep `{{authorityClaims}}` structurally false. Do not enroll a partner, award a
capability, award a designation, determine benefit eligibility, approve or pay
incentives, commit revenue, mutate an opportunity, contact a customer, modify an
agreement, make a QBR decision, or accept risk. Keep
`{{handoff.published}}` false.
