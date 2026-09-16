# Learning program release and evidence handoff

## Bound program revision

- Program: `{{program.id}}`
- As of: `{{program.asOf}}`
- Approved aggregate gap: `{{gapRevision.id}}` / `{{gapRevision.version}}`
- Skill taxonomy: `{{skillTaxonomy.id}}` / `{{skillTaxonomy.version}}`
- Privacy class: `{{program.privacyClass}}`
- Program owner: `{{program.ownerRef}}`

## Curriculum releases

For every `{{curriculumReleases[].id}}`, show the curriculum version, exact gap
revision and taxonomy version, covered skill refs, release state and time,
predecessor, retirement time when applicable, evidence, privacy class, and
owner. Evaluate exact approved-gap coverage over current releases only;
historical, retired, and planned versions remain visible without contributing
duplicate coverage. A release is never evidence that an individual learned or
performed a skill.

## Audiences, cohorts, and assignment receipts

For every `{{cohorts[].id}}`, show its audience, exact curriculum release, roster
revision id and version, member count, privacy class, and owner. List
`{{assignments[].id}}` only with its pseudonymous learner ref, voluntary state,
exact roster binding, and `{{assignmentReceipts[].id}}`. Never render names,
sensitive traits, rankings, or mandatory assignment language.

## Delivery readiness

List every `{{deliveryChecks[].id}}` with its release, cohort, requirement,
observed state, evidence, time, and accountable owner. Preserve blocked and
missing states.

## Completion and assessment identity

Bind each `{{completionRecords[].id}}` to its accepted assignment, pseudonymous
learner ref, and exact curriculum release. Bind each
`{{assessmentRecords[].id}}` to its completion record and exact instrument
version. Do not render individual scores, grades, rankings, aptitude, or
performance conclusions.

## Aggregate effectiveness review

For every `{{effectivenessMeasures[].id}}`, show the cohort, release, metric,
minimum group size, numerator, denominator, observed rate, target, privacy
class, evidence, and evidence-bounded conclusion. A suppressed or undersized
group is `no-conclusion`; it is never expanded into an individual claim.

## Refresh decisions and chronology

List every `{{refreshReviews[].id}}` with its revision and predecessor, exact
release, reciprocally assigned aggregate measure refs, reviewer, reviewed and
effective times, decision, rationale evidence, and next owner. Multiple reviews
may partition one release's measures, but every measure belongs to exactly one
review. Refresh decisions are human-owned and do not mutate an LMS, HRIS,
credential, employment, or compensation record.

## Exact blockers and owner handoff

- State: `{{handoff.state}}`
- Prepared after all included events: `{{handoff.preparedAt}}`
- Derived privacy class: `{{handoff.privacyClass}}`
- Blockers: `{{handoff.blockerRefs}}`
- Next owner: `{{handoff.ownerRef}}`
- Artifact digest: `{{handoff.artifactDigest}}`

The artifact records no individual-performance or sensitive-trait inference,
mandatory assignment, HR-record mutation, credential award or revocation,
promotion or compensation decision, external contact, or effectiveness claim
beyond the supplied aggregate evidence. The X4 view is a presentation of this
complete X3 fallback, never a separate source of truth.
