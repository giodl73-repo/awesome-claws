# Problem and known-error coordinator handoff

Use `outputs/problem-known-error.json` as the source of truth. This handoff and
the inline visual are projections only; neither may add authority or repair a
stale binding.

## Exact problem revision

- Problem, predecessor artifact/revision, services, state, owner, declaration,
  cutoff, and content digest:

## Owner-signed incident universe

| Membership / revision | Incident artifact / schema | Follow-up / identity key | Source bytes | Owner receipt | Time |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

## Hypothesis and QA matrix

| Proposal / revision | QA artifact / run / build / environment | Result evidence | Disposition / revision | Owner receipt |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Workaround and known error

- Workaround revision, exact instructions, approval owner/evidence/time,
  expiration, publication state, and execution state:
- Known-error revision, cause disposition, workaround revision, declaring
  authority/evidence/time, and publication state:

## Change and recurrence

- Change Control artifact/schema/plan digests, execution owner/evidence/time,
  verification, problem linkage, targets, and finalization:
- Later recurrence membership/change revisions, incident source, observer,
  evidence, and strict chronology:

## Coverage, findings, and trust

- Exact principal/evidence/lifecycle coverage:
- Caller keyring, verified-human credentials, grants, evidence/source
  attestations, and independently signed owner receipts:
- Blocking findings:

## Authority boundary and next owner

Do not infer incident correlation or root cause. Do not approve, publish, or
execute a workaround or known error. Do not authorize or execute production
change, mutate incident/problem/ticket state, close an incident or problem, or
accept risk.

Name the next existing owner process and decision. The Claw makes no governed
decision and performs no external action.
