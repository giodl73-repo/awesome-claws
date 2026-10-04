# Project Manager onboarding evaluation

Bounded evaluation of the existing Project Manager, not a new Claw or shipped
runtime. Route approved in [#222](https://github.com/giodl73-repo/awesome-claws/issues/222#issuecomment-5985585278).
Baseline: main `2092592`. No catalog, shared validator or generated changes.

All people, references and dates below are synthetic supplied facts. Research
context: `new-hire-*` in the SMB research worktree; employer postings establish
a job, not source authenticity, SMB size or technical privacy guarantees.

## Artifacts

- `supplied-evidence.json`: accepted-offer/start-plan revisions, evidence,
  owner-supplied impact rules and an explicitly missing rule.
- `private-project.json`: existing Project Manager schema artifact. Entire file
  is owner-only, including its evidence references; never send it to the worker.
- `private-handoff.md`: concrete questions and retained historical evidence.
- `worker-draft.json` and `worker-draft.md`: separately authored, minimized
  itinerary using only the supplied worker-permitted facts, not a redacted copy
  of the private artifact. Publication is pending owner review.
- `evaluation.test.mjs`: actual Project Manager schema/semantic checks and
  exact-fixture assertions. Tests do not create or send any artifacts.

Run after installing the repository's locked dependencies:

```sh
node --test candidates/project-onboarding/evaluation.test.mjs
```

## Result and limits

The existing project contract represents owners, dependencies, evidence
references and a blocked handoff without a new identity. Equipment is requested,
not delivered; IT confirmation is historical after a supplied date-change rule;
the workspace confirmation has unresolved applicability because its impact rule
is absent. A current orientation arrangement is neither attendance nor clearance.

Evidence scope and rule application here are manually assessed fixture facts.
The tests pin those assessments; there is no general revision engine. A negative
control documents that the existing validator can accept stale evidence marked
accepted. That is a scope limit, not a claimed Project Manager regression.

Worker tests check exact selected fields and retained draft status for this
synthetic example. They do not prove arbitrary-prose redaction, access controls,
secure storage, automatic audience routing, live-agent behavior or receipt truth.
The labels "private" and "worker" do not enforce filesystem permissions. An
operator must control storage/access and independently review the worker draft.
Re-author and re-review both artifacts when source facts or scope change; no
automatic invalidation is installed. Missing rules remain owner questions.

No start clearance, eligibility judgment, screening interpretation, provisioning,
equipment issuance, HRIS/payroll update, booking, scheduling or messaging occurs.
No sensitive HR details are needed: only a controlled pending-status reference.
No package qualification, screenshot, quality score or full-check claim is made.
Candidate tests are explicit opt-in, not added to the repository check command.
