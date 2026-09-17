# IT Problem Evidence and Known-Error Coordinator admission slice

## Verdict

**New Claw candidate; do not publish yet.** Confidence: **0.92**.

Proof status: **15 candidate assertions**, **103 focused and analogue tests**,
**2 strict owner-schema checks**, and the required repository check with
**2,118 passed, 1 expected skip, and 0 failed**. Final Autoreview: **no
actionable correctness defects**.

Incident Response already works for one live incident: it owns Technical DRI
and Incident Manager loops, exact incident evidence, owner-executed actions,
recovery, closure separation, and durable follow-ups. Case Continuity
Coordinator already preserves a generic append-only checkpoint. The missing
shared capability is an owner-declared, cross-incident problem revision that
keeps competing hypothesis revisions, attributable support/refutation tests,
an expiring owner-approved workaround, an owner-declared known-error revision,
an owner-executed change receipt, and recurrence after that change in one exact
closed evidence universe.

The candidate coordinates those immutable owner outputs. Incident correlation,
root-cause declaration, workaround approval/publication/execution, production
change, incident or problem closure, ticket mutation, and risk acceptance stay
with their existing owners.

## Frame

**Affected users:** problem owners, reliability investigators, service owners,
QA owners, change owners, and known-error authorities handling recurring
service incidents.

**Current workaround and cost:** teams manually copy incident follow-ups,
hypotheses, test results, workaround approvals, change receipts, and recurrence
notes into a problem spreadsheet or review deck. Revision drift is easy to
miss, so an expired workaround or stale known error can appear current.

**Falsifiable thesis:** a distinct Claw is warranted only if the current Case
Continuity plus Incident Response contracts cannot preserve the complete typed
problem lifecycle without schema changes. If those contracts gain exact
cross-incident membership, hypothesis-revision/test, workaround/known-error
revision, change/recurrence, authority, cutoff, public-trust, and closed-coverage
semantics, reject and delete this candidate.

**V1 boundary:** one owner-declared open problem revision, exactly three
incident memberships, two competing hypothesis revisions, one supporting and
one refuting test, one active expiring workaround, one known-error revision,
one owner-executed change receipt, and one observed recurrence after change.
No discovery, automation, publication, mutation, execution, closure, or risk
decision is in scope.

## Audit

| Owner Claw | Source-backed behavior | Classification |
| --- | --- | --- |
| Incident Response | One incident owns hypotheses without content revisions, and each durable follow-up carries exactly one `incidentRef`; follow-ups do not model problem, workaround, known-error, change-receipt, or recurrence lineage. | Adapt incident/follow-up identities; do not overload. |
| Case Continuity Coordinator | Preserves generic evidence, checkpoint summaries, actions, and an owner-controlled terminal decision. Its strict schema has no typed problem lifecycle or exact cross-ledger coverage. | Reuse append-only/freshness posture; reject as equivalent composition. |
| Quality Assurance Lead | Requires attributable build/environment-scoped test evidence and preserves pass/fail/blocked distinctions. | Reuse exact execution evidence; adapt outcomes to support/refute a hypothesis revision. |
| Change Control Operator | Binds external owner approval and execution to one exact plan digest and rejects drift. | Reuse receipt identity; retain all execution authority externally. |
| Repository Compliance Program Manager | Uses caller-controlled time, expiring scoped authority, revision-driven reopen, exact coverage, and structural authority non-claims. | Reuse lifecycle invariants; avoid issue mutation and compliance semantics. |

The executable gap check in `validate.test.mjs` loads the actual Case Continuity
and Incident Response schemas and fixtures. Both fixtures remain valid, but
neither strict owner schema directly carries the candidate fixture's
memberships, hypothesis/test matrix, workaround, known error, change,
recurrence, coverage, or authority. This is evidence of an absent native typed
contract, not proof that every external composition is impossible. If a future
explicit adapter can round-trip the accepted payload through both owner
contracts with the same revision, chronology, trust, coverage, and
non-authority findings, this admission verdict must flip to
**improve/compose**.

## Compare

### Internal analogues

The candidate uses native repository patterns: strict JSON Schema, a total
findings validator, caller-owned trust and time inputs, immutable revision
digests, typed named-human authority, structured failure codes, and exact
closed coverage. It intentionally does not register a public artifact
validator or add catalog, Experience, regression, chooser, screenshot, or
generated package entries.

### External comparators

- Atlassian describes a problem as a cause or potential cause of one or more
  incidents, a known error as a problem with a documented root cause and
  workaround, and a workaround as temporary. This supports the multi-incident
  and known-error lifecycle, but the candidate is stricter: the Claw cannot
  infer correlation or root cause, and owner evidence must bind every revision.
  Source: <https://www.atlassian.com/itsm/problem-management>
- Google SRE treats a postmortem as a record of the incident, root causes, and
  follow-up actions intended to reduce recurrence, with formal review for
  completeness. This supports preserving recurrence and corrective-action
  evidence, but postmortem publication remains out of scope.
  Source: <https://sre.google/sre-book/postmortem-culture/>
- PagerDuty assigns a named postmortem owner, preserves evidence-backed
  timelines, and separates postmortem completion from follow-up-ticket
  resolution. This reinforces typed owners and the rule that closing a review
  does not close its work. The candidate does not create tickets or communicate.
  Source: <https://response.pagerduty.com/after/post_mortem_process/>

## Evaluate

| Lens | Finding incorporated |
| --- | --- |
| `aether-runtime-eng` (A, runtime owner) | Missing or malformed caller cutoff/public trust fails closed; the Claw principal has only `evidence-coordinator`. |
| `power-user` (B, affected operator) | One exact artifact replaces the manual cross-incident spreadsheet; no new execution or publication ceremony is introduced. |
| `compliance` (C, evidence reviewer) | Content-bound revisions, typed producers, chronology, public-source byte identity, and exact closed coverage make omissions observable. |
| `lorant-reviewer` (L, skeptical simplicity) | The actual owner schemas are pressure-tested for direct typed coverage, an explicit adapter round trip remains the composition deletion gate, and no public registry surface is touched. |

## Slice

`accepted.json` proves the exact bounded scenario. `public-trust-input.json` is
caller-owned and commits to every external principal, authority scope, and
evidence record, including the one public incident record. The validator
requires a caller-controlled cutoff, exact owner-declared memberships,
content-bound problem/hypothesis proposal and disposition revisions,
support/refutation evidence no earlier than hypothesis proposal, revision-bound
workaround and known-error records with exact authority-evidence lineage, an
externally executed change plus a strictly later owner-authored problem-link
receipt, recurrence chronology, typed authority, escalation-only handoff, and
complete coverage.

`revision-drift.json` proves that changing the problem revision without renewed
bindings invalidates both the workaround and known error.
`missing-coverage.json` proves that omitting one incident from the declared
universe is a structured failure.

## Deletion target

Delete the manual problem spreadsheet or review deck that copies incident ids,
hypotheses, tests, workaround expiry, known-error text, change status, and
recurrence notes. Keep incident, QA, change, status-page, and owner-decision
records authoritative. If the existing Case Continuity plus Incident Response
contracts become sufficient, delete this entire candidate slice instead.

## Observable proof

Run:

```text
node --test docs/admission-slices/problem-known-error/validate.test.mjs
```

See `PROOF.md` for the focused analogue and candidate proof record.
