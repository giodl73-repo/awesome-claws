# Security Alert Review Reconciler admission slice

## Verdict

**The candidate survives the bounded slice; keep it candidate-only.**
Confidence: **0.91**.

The existing vulnerability, security assessment, incident, repository
compliance, and control assessment contracts cannot preserve this owner alert
snapshot without dropping native alert rows, inventing asset/control semantics,
starting an incident, or entering an issue-mutation workflow. None can enforce
one fresh authorized human disposition or one exact non-decision for every
`(source, nativeAlertId, revision)` key.

This is evidence for a distinct operating contract, not approval for a public
Claw. This directory changes no catalog, contribution, generated package,
chooser, regression registry, or public validator registry.

## Frame

### Smallest falsifiable thesis

```text
working owner alert sources and detector policy
+ missing revision-exact human review reconciliation
-> complete review evidence without taking source, incident, ticket, or risk authority
```

Security alert providers already own detection, native identity, source state,
and source severity. The security owner already owns detector policy and the
human authority roster. Incident Response already owns incident declaration and
response. Repository Compliance Program Manager already owns approved issue
mutation and remediation tracking.

The missing capability is a private, source-neutral reconciliation record that:

- preserves every owner-supplied alert, including non-vulnerability alerts;
- authenticates the complete normalized alert universe against owner-signed
  source identity, source version, byte digests, and snapshot root;
- keys review strictly by `(source, nativeAlertId, revision)`;
- requires exactly one current human disposition or one exact non-decision for
  every key;
- binds every human action to a named person in an owner-controlled roster
  pinned by a caller trust root, typed grant, the policy revision effective when
  the action occurred, snapshot completeness root, time window, and
  caller-pinned controlled-evidence root;
- carries independently supplied, safe-domain public detector-contract inputs
  as context with no authority effect;
  and
- invalidates rather than replays a prior decision when an alert revision
  changes.

### Measurable current cost

Against the eight-row proof snapshot:

- Vulnerability Disposition Coordinator has no native representation for the
  seven code-analysis or secret-exposure rows and derives an
  instance/component/advisory universe instead.
- Repository Compliance Program Manager would require control, asset,
  obligation, and issue identities for all eight rows, cannot retain the
  unknown-asset row as a reviewable alert, and canonicalizes source signals
  before its obligation universe.
- Security Analyst, Compliance Reviewer, and Incident Response provide no
  native-alert-key coverage ledger.

The current workaround is therefore an extra private spreadsheet or review deck
that keeps native rows while selected outcomes are copied into specialist
systems. The measurable duplication is one parallel row ledger plus at least one
specialist output; the proof target is one complete candidate record with eight
keys and no copied source mutation.

### Owner-retained authority

Alert sources retain alert content, native ids, revisions, state, and severity.
The detector-policy owner retains categories and allowed review outcomes. Named
humans retain false-positive, duplicate, and incident-review request decisions.
Incident owners retain declaration and response. Repository owners retain issue
and remediation workflows. Risk owners retain risk acceptance. The candidate
only validates and renders supplied evidence.

### V1 boundaries

V1 has no SIEM query, correlation or severity inference, source suppression or
closure, containment, incident declaration, ticket mutation, risk acceptance,
or security claim. It does not discover alerts, assets, duplicates, grants,
detector policy, or public trust material. It does not fetch source or public
URLs. Source-muted and source-suppressed states are input facts, never
approvals.

### Falsifiers

Reject this candidate if any inspected contract can consume the proof snapshot
without translation and preserve all eight native keys, exact revision
invalidation, typed human grants, public trust context, and the full no-authority
boundary. Also reject it if owners cannot supply complete snapshots, stable
native revisions, immutable detector-policy history, owner-signed source
manifests and exact bytes, or evidence-backed typed grants.

## Audit

| Existing owner | Source-backed behavior | Result |
| --- | --- | --- |
| Vulnerability Disposition Coordinator | Its schema derives coverage from instance/component/advisory-revision triples and its dispositions are vulnerability-only (`sources/vulnerability-disposition-coordinator/schemas/vulnerability-disposition.schema.json:82-118`, `398-450`, `489-579`). Tests correctly keep muted/suppressed scanner state from becoming approval and reopen prior revision triples (`scripts/vulnerability-disposition-coordinator.test.mjs:1434-1457`, `1487-1529`, `1586-1607`). | **Adapt** revision invalidation, complete coverage, and suppression-as-data. **Reject as carrier** because non-vulnerability native alerts and unknown assets do not fit its triple universe. |
| Security Analyst | Its enriched validator covers assets, scenarios, observations, evidence, controls, remediation, and verification, including severity/likelihood assessment and risk-owner review (`scripts/threat-assessment-schema.test.mjs:109-196`). | **Reuse** named-human and evidence chronology checks. **Reject as carrier** because it evaluates threat scenarios and severity rather than reconciling owner alert rows. |
| Incident Response | Its contract separates Technical DRI and Incident Manager loops, exact decisions, service recovery, incident recovery recommendation, closure, and compliance handoff. Tests preserve a proposed compliance handoff and reject agent-owned incident authority and direct incident declaration (`scripts/incident-state-schema.test.mjs:844-940`). | **Reuse** an incident-owner handoff with no declaration effect. **Reject as carrier** because an alert review must not fabricate an incident record. |
| Repository Compliance Program Manager | It accepts supplied signal status and finding revision, then canonicalizes signals into findings, obligations, and exactly one issue (`sources/repository-compliance-program-manager/schemas/repository-compliance-program.schema.json:238-360`; `scripts/repository-compliance-program-manager.mjs:528-625`, `628-671`). It supports caller-controlled time, complete snapshot indices, and revision reopen, but also has an approved create/update issue capability (`scripts/repository-compliance-program-manager.mjs:444-480`, `691-810`, `884-899`). | **Adapt** complete source indices, deterministic findings, revision reopening, and caller time. **Reject as carrier** because review totality precedes canonicalization, unknown assets must remain visible, and ticket mutation is forbidden. |
| Compliance Reviewer | Its validator maps requirements to evidence, findings, compensating controls, remediation, independent verification, and review readiness (`scripts/control-assessment-schema.test.mjs:99-186`). | **Reuse** explicit non-claims and named independent humans. **Reject as carrier** because an alert row is not a framework requirement or control-effectiveness conclusion. |

The audit result is a contract gap, not a quality defect in any owner. Each
existing Claw remains authoritative for its existing job.

## Compare

### Internal analogues

| Analogue | Classification | Candidate use |
| --- | --- | --- |
| Vulnerability revision triples | Adapt | Exact revision-bound coverage and invalidation, generalized only to owner-native alert keys. |
| Repository compliance snapshots | Adapt | Complete source index, content root, caller `asOf`, typed findings, and fail-closed identity checks. |
| Benefits signed-source authority | Reuse | External owner trust, exact source bytes, a signed manifest, and the rule that fixture resealing cannot rewrite authority. |
| Security Analyst authority checks | Reuse | Named humans and evidence chronology; no threat or severity assessment. |
| Incident Response handoff | Reuse | `requested-owner-review` escalation with `incidentRef: null` and declaration effect `none`. |
| Compliance Reviewer non-claims | Reuse | Explicitly impossible compliance, assurance, waiver, and risk implications. |
| Signal canonicalization and issue mutation | Avoid | Owner-declared duplicate membership is preserved, but every native alert still receives its own review record and no issue is touched. |

### External comparators

| Primary source | Useful precedent | Deliberate difference |
| --- | --- | --- |
| [GitHub code scanning REST API](https://docs.github.com/en/rest/code-scanning/code-scanning) | Native alert number, current state, update time, source severity, and named dismissal metadata remain source-owned. | The candidate never calls the API or updates dismissal state; it records an independent revision-keyed review result. |
| [GitHub secret scanning REST API](https://docs.github.com/en/rest/secret-scanning/secret-scanning) | Native alert number, state, resolution, resolver, validity, and public-leak metadata demonstrate that non-vulnerability alerts carry distinct source semantics. | Source resolution is preserved as input and cannot stand in for a candidate disposition. |
| [OASIS SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/sarif-v2.1.0-os.html) | A cross-tool interchange format can preserve diverse static-analysis results, stable fingerprints, and an end-user false-positive decision. | The candidate does not reinterpret SARIF fingerprints as owner revisions and does not infer cross-source correlation. |
| [NIST SP 800-61 Rev. 3](https://csrc.nist.gov/pubs/sp/800/61/r3/final) | Incident response is a separate cybersecurity risk-management discipline. | An alert can request incident-owner review, but this artifact cannot declare an incident or perform response. |

## Evaluate

Findings were applied from four repository roles in distinct tension clusters:

| Lens | Blocking finding | Slice response |
| --- | --- | --- |
| CISO (`.craft/roles/claws/ciso.md`, cluster A) | Muted, suppressed, or owner-self-suppressed alerts must not silently disappear or become machine approval. | Both source states remain in the complete snapshot and end in typed non-decisions; a self-suppression attempt is separately evidenced and cannot authorize a disposition. |
| Compliance (`.craft/roles/claws/compliance.md`, cluster C) | Evidence must say what was reviewed, when, under which policy revision, and with complete coverage; public material must not masquerade as authority. | Snapshot and policy digests, an out-of-band principal-roster digest, exact coverage, controlled evidence, caller time, and public trust records with `authorityEffect: context-only` are mandatory. No compliance claim exists. |
| Claws repo steward (`.craft/roles/claws/claws-repo-steward.md`, cluster H) | An unaccepted candidate must not leak into public or generated registry surfaces. | Every file is isolated below `docs/admission-slices/`; a test asserts that the candidate id is absent from `catalog.json`. |
| Lorant reviewer (`.craft/roles/claws/lorant-reviewer.md`, cluster L) | Security-sensitive keys, time, grants, and failure branches need exact negative proof rather than convention. | The validator recomputes canonical tuple keys and all record digests, requires caller-supplied time, sorts findings deterministically, and tests missing/duplicate coverage, stale replay, grant misuse, self-suppression, source suppression, trust loss, incident declaration, and authority overclaim. |
| Independent implementation review | Source authenticity, immutable historical policy, URL safety, total parsing, and resource bounds were incomplete. | The candidate now verifies owner-signed source manifests and bytes, keeps prior decisions on historical policy digests, requires independently supplied approved-domain public trust, short-circuits schema-invalid/deep input, and caps bytes, strings, collections, and source work. |

These reviews removed free-form decision rationale, automatic duplicate
correlation, default time, and any incident/ticket side effect from V1.

## Slice

The accepted fixture contains one complete eight-alert owner export, one current
detector-policy revision, and one immutable historical policy revision:

| Evidence state | Count |
| --- | ---: |
| Human dispositions | 3 |
| Exact non-decisions | 5 |
| Owner-declared duplicate groups | 1 |
| Muted/suppressed source alerts | 2 |
| Unknown asset identities | 1 |
| Self-suppression attempts | 1 |
| Invalidated prior decisions | 1 |
| Incident-owner review requests | 1 |

The human dispositions are a named-human false positive, an owner-declared
duplicate, and an incident-owner review request. The five non-decisions preserve
muted, suppressed, unknown-asset, self-suppression, and revised-alert states.
Every alert remains present in coverage.

Files:

- `security-alert-review.schema.json`: strict candidate schema and explicit
  authority non-claims.
- `validate.mjs`: total semantic validator, caller-pinned principal roster,
  controlled-evidence root, signed-source verification, bounded parsing, digest
  helpers, deterministic findings, non-authoritative resealing helper, and
  standalone proof CLI.
- `accepted.json`: the complete owner snapshot, current and historical detector
  policies, signed source manifest, typed grants, decisions, non-decisions, and
  handoff.
- `owner-trust.json`: independently supplied owner signing-key trust.
- `source-bytes.json`: bounded bytes for each exact source identity and version.
- `public-trust.json`: independently supplied public detector-contract records.
- `adversarial-cases.json`: exact expected findings for the bounded failure
  matrix.
- `validate.test.mjs`: schema, semantics, authority, totality, determinism, CLI,
  and no-registry proof.
- `../../../scripts/security-alert-review-reconciler.test.mjs`: discovery bridge
  that runs the candidate suite from the repository's required `scripts/*.test.mjs`
  lane.

### Observable proof

```powershell
node --test `
  scripts\security-alert-review-reconciler.test.mjs `
  scripts\benefits-realization-manager.test.mjs `
  scripts\vulnerability-disposition-coordinator.test.mjs `
  scripts\threat-assessment-schema.test.mjs `
  scripts\incident-state-schema.test.mjs `
  scripts\repository-compliance-program-manager.test.mjs `
  scripts\control-assessment-schema.test.mjs
npm run check
node docs\admission-slices\security-alert-review-reconciler\validate.mjs `
  docs\admission-slices\security-alert-review-reconciler\accepted.json `
  --as-of 2026-09-16T23:30:00Z `
  --principal-roster-digest sha256:5fb91701b972bf4d591c567f6f1f44ec8ac4565e83f8bffd74982e5a5069f8c5 `
  --evidence-root sha256:aae87ad73783965f1b07a7b80e557f48727d73cfd69aefb8dd9ac7a0b99d6b38 `
  --owner-trust docs\admission-slices\security-alert-review-reconciler\owner-trust.json `
  --source-bundle docs\admission-slices\security-alert-review-reconciler\source-bytes.json `
  --public-trust docs\admission-slices\security-alert-review-reconciler\public-trust.json
```

The focused candidate-and-analogue command passes **184 of 184 tests** across
the candidate, the five nearest contract analogues, and the Benefits
signed-source precedent. The discovered candidate suite contributes 24
top-level tests, including exact table-driven findings for all twenty-one
structured failure cases and direct probes for the five independent-review
blockers. `npm run check` executes that suite through the bridge without
publishing the candidate. The standalone validator returns exactly:

```json
{
  "valid": true,
  "findings": []
}
```

The durable decision remains **survive the bounded slice, candidate-only** at
**0.91 confidence**.

## Deletion target

Delete the parallel private alert-review spreadsheet or review deck that copies
native alert ids, detector state, duplicate annotations, reviewers, and stale
decisions. The deletion gate is an owner exporter that can supply the complete
snapshot, detector-policy revision, public trust inputs, and typed grant
evidence accepted by this validator, with owner-signed source bytes, immutable
policy history, independently supplied public trust, and both the
principal-roster digest and controlled-evidence root supplied from outside the
artifact. Keep detector systems, SIEM workflows, incident records, repository
issues, remediation records, and risk decisions; they are owner systems, not
workaround code.
