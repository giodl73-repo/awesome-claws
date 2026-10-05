# Merchant Dispute Composition Evaluation

Evaluation-only route approved by Gio for [#227](https://github.com/giodl73-repo/awesome-claws/issues/227).
Baseline main: `a297724bb6f6d609e157af33cf9a8fedf0b9c434` (145 Claws).
No new Claw ID, package, shared validator, runtime or generated catalog changes.

## Contents

- `supplied-evidence.json`: invented notice revisions, records, proposed attachment
  names and missing permissions. These are not processor rules or real records.
- `private-project.json`: manually authored existing Project Manager artifact for
  the remaining human review tasks, checked against its actual schema/validator.
- `private-handoff.md`: private case review preserving conflicting delivery
  evidence, requested versus executed refunds, missing bytes and historical review.
- `evaluation.test.mjs`: opt-in project and RFP checks plus exact-fixture assertions.

Run `node --test candidates/merchant-dispute/evaluation.test.mjs` after `npm ci`.
As with the onboarding evaluation, tests are not added to the default suite.

## Evaluation Boundary

This is a manually composed worked example, not a run of multiple agents or a
processor-ready packet. Project Manager owns task structure; case/payment
mapping, source authenticity, notice applicability and readiness remain human
decisions. RFP probes exercise its existing fixture, not a merchant artifact.
Other Claws' proposed roles are a composition plan, not validated outputs:
Document Intake for permitted bytes; Invoice Follow-up for receivables context;
Seller Returns for authorization/receipt distinctions. No artificial invoice,
incoming receipt, buyer/product or legal matter is invented to satisfy a schema.

Tests pin only this synthetic example. Negative controls demonstrate that
Project Manager accepts an unknown evidence reference and RFP does not interpret
case/payment identity in prose. These are scope limits, not regressions. Neither
test passing nor a generic artifact validator establishes evidence sufficiency.
There is no new merchant-domain validator, source-discovery guarantee, automatic
revision invalidation, secure-storage mechanism or deadline scheduler.

The handoff remains blocked: actual attachments, disclosure approval and current
owner review are absent. Private labels do not enforce filesystem permissions.
No agent/provider evaluation, publication, refund, messaging or submission occurs.
No quality score or screenshot qualification is claimed for this candidate.

Job-description research and reuse rationale remain linked in #227. No new job
scan is claimed, and employer size/current vacancy limitations still apply.
The result supports a bounded owner-review composition, not new-Claw admission.
