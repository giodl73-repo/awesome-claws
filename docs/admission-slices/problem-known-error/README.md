# IT Problem Evidence and Known-Error Coordinator admission slice

## Verdict

**New Claw candidate; do not publish yet.** Confidence: **0.90**.

The independent review's **IMPROVE/COMPOSE** hypothesis was tested first with a
source-derived adapter over real Incident Response, Quality Assurance Lead,
Change Control Operator, Repository Compliance Program Manager, and Case
Continuity Coordinator artifacts. Their exact owner surfaces round-trip, but
five problem-specific typed invariants are absent. The adapter cannot fill
those gaps without becoming the new contract it is trying to avoid.

No public catalog, contribution, Experience, chooser, screenshot, generated
package, or artifact-validator registry entry is changed by this slice.

## Frame

**Affected users:** problem owners, reliability investigators, service owners,
QA owners, change owners, and known-error authorities handling recurring
service incidents.

**Working owner systems:** Incident Response owns each incident and its durable
follow-up identity; Quality Assurance Lead owns attributable test execution;
Change Control Operator owns plans and execution; Repository Compliance Program
Manager owns exact snapshot/coverage patterns; Case Continuity Coordinator owns
resumable checkpoints.

**Missing shared capability:** none of those contracts owns an independently
signed cross-incident problem manifest or the revision graph that joins
hypothesis proposal/disposition, QA results, workaround approval, known-error
declaration, owner-executed change, and later recurrence.

**V1 boundary:** one open problem revision, exactly three owner-declared
incident memberships, two competing owner hypotheses, one supporting and one
refuting test, one active expiring owner-approved workaround, one owner-declared
known error, one later owner-executed change receipt, and one still-later
recurrence.

The Claw coordinates immutable evidence only. It cannot infer incident
correlation or root cause; approve, publish, or execute a workaround; authorize
or execute production change; mutate tickets; close an incident or problem; or
accept risk.

## Strongest composition result

`composition-adapter.mjs` pins the complete artifact and schema digests for all
five owner Claws, derives identity/revision/chronology/coverage/authority
projections only from those artifacts, and explicitly anchors Incident
`followUps[].id`, `identityKey`, and `incidentRef`. It never copies proposal
records into nominal owner slices.

The verdict calculation uses normalized, content-addressed typed nodes and
edges with graph reachability and authority assurance. A closed optional
typed-control input can add future owner capabilities. Five independent
synthetic controls each clear exactly one current loss while retaining exact
identity, revision, authority, endpoint, and closure checks.
Every preserved result must be satisfied by one coherent anchor subgraph;
disconnected manifests, lineage fragments, or authority nodes cannot be
combined into a false positive.

For the three proposed memberships, the probe coherently substitutes each
incident and follow-up identity into the real Incident Response fixture,
recomputes every affected action, cadence, recovery, closure, communication,
decision, and follow-up digest, and requires all three resulting artifacts to
remain schema- and semantic-valid. The cross-incident manifest is still absent.

The executable probe reports these concrete typed losses:

| Lost invariant | Why the composition cannot preserve it |
| --- | --- |
| Owner-signed cross-incident manifest | Incident Response owns one incident artifact and follow-up identity, but no owner schema signs the complete multi-incident membership revision set. |
| Hypothesis proposal/disposition lineage | Incident hypotheses and QA runs do not bind tests to immutable problem-level proposal revisions and then to disposition revisions. |
| Known-error/workaround lineage | No owner schema jointly binds an owner-declared cause disposition to an expiring workaround revision. |
| Post-change recurrence lineage | No owner schema joins a later incident membership revision to the exact executed change-receipt revision. |
| Closed problem-lifecycle coverage | Repository Compliance has exact domain coverage, but cannot enumerate this problem-specific revision universe. |

The source-derived owner projection round-trips exactly. The proposal does not:
`requireLosslessProposalComposition` fails with the five losses above, including
for an unrelated substituted incident id. This is the falsifiable reason the
NEW verdict survives.

If existing owner schemas later add these exact cross-artifact relationships,
rerun the probe. A lossless result must flip the verdict to
**IMPROVE/COMPOSE** and delete the candidate.

## Candidate proof

The candidate adds only the missing cross-owner contract:

- an owner-signed incident manifest over the exact membership revisions;
- immutable content digests whose timestamps and predecessor references remain
  stale unless their owners issue fresh downstream receipts;
- tests bound to hypothesis proposal revisions and dispositions bound to exact
  test revisions;
- workaround and known-error revisions bound to their owner evidence;
- change execution after the current known-error revision and recurrence after
  both the change and later incident membership;
- caller-injected source-byte attestations and unique issuer-scoped,
  time-bounded authority grants;
- a caller-supplied issuer allowlist and keyring kept outside the accepted
  trust payload;
- issuer signatures over credentials, grants, evidence claims, source
  attestations, and the receipt set, plus a distinct principal-key signature on
  every owner receipt;
- rejection of reused public-key fingerprints across issuer and principal
  roles;
- caller-verified human credentials rather than name-based identity heuristics;
- exact closed coverage across the complete supplied universe;
- schema-first, total, resource-bounded validation;
- negation-aware rejection of prohibited authority claims across every
  narrative surface.

`resealProblemKnownErrorArtifact` recomputes digest fields only. It never
rewrites evidence, authority, coverage, or downstream revision bindings, so a
legitimate content revision exposes stale receipts instead of silently
repairing them.

The issuer can attest which principal keys are trusted, but cannot author an
owner receipt: each receipt must name the expected lifecycle owner and verify
under the exact `subjectKeyId` in that owner's verified-human credential.
External-system receipts bind the unique principal key selected by the caller
keyring. Replacing the issuer key in the public trust payload, even with fully
recomputed collection signatures, does not alter the caller's allowlist or
keyring.

## Internal analogue classification

| Owner Claw | Classification |
| --- | --- |
| Incident Response | **Reuse** exact incident evidence, owner execution, and follow-up identity; **avoid** treating one incident as a problem manifest. |
| Quality Assurance Lead | **Reuse** attributable build/environment test evidence; **adapt** pass/fail to support/refute without transferring QA authority. |
| Change Control Operator | **Reuse** plan digest and owner execution receipt; **avoid** treating plan approval as problem or known-error authority. |
| Repository Compliance Program Manager | **Reuse** source roots, predecessor, exact coverage, grant, and non-authority patterns; **avoid** reusing compliance semantics. |
| Case Continuity Coordinator | **Reuse** checkpoint/resume posture; **avoid** encoding typed lineage in free-text summaries. |

## Deletion target

Delete the manual problem spreadsheet or review deck that copies incident ids,
hypotheses, tests, workaround expiry, known-error state, change receipts, and
recurrence notes. Keep incident, QA, change, compliance, status-page, and
owner-decision records authoritative.

See `PROOF.md` for the exact commands, counts, and review result.
