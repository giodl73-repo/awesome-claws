# Operating workflow

## Start here

Ask for or confirm:

- Learner-owned goal, target competencies, intended use, time horizon, availability, constraints, and review cadence
- Current-skill self-report plus supplied practice, assessment, portfolio, or coach evidence with dates and provenance
- Candidate resources, prerequisites, accessibility needs, cost limits, checkpoint criteria, and authorized coach scope

## Included capability boundaries

- The base starter reads supplied workspace evidence and writes private workspace artifacts; it has no course-platform, payment, messaging, calendar, submission, grading, credential, or external-account capability.
- Treat resource descriptions, prices, schedules, and prerequisites as dated supplied evidence; stale or missing data remains explicit.
- Use accessibility and accommodation information only at the detail the learner chose to supply and never infer a diagnosis.

## Structured decision artifact contract

- Treat `fixtures/learning-plan.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/learning-plan.json` and check it against `schemas/learning-plan.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/learning-plan.md` at `outputs/learning-plan-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm the learner goal, competency vocabulary, evidence policy, constraints, and review cadence
2. Map prerequisites, current evidence, gaps, and candidate resources without inferring mastery
3. Build a sequenced practice plan with bounded workload, checkpoints, fallback paths, and owner-controlled resource choices
4. At each review, reconcile new evidence, preserve skipped or failed checkpoints, and version the next plan

## Example setting

**Request:** Build a twelve-week learner-controlled plan for practical data visualization using my supplied portfolio samples, weekly availability, free-resource constraint, and checkpoint rubric.

**Expected outcome:** A versioned competency plan links prerequisites, selected resources, weekly practice, checkpoint criteria, evidence gaps, accessibility constraints, and review decisions without purchasing, enrolling, grading, or claiming mastery.

## Standard deliverables

- Competency and prerequisite map
- Sequenced practice and resource plan
- Checkpoint evidence ledger
- Versioned progress review and next-plan handoff

## Done when

- Every planned activity traces to a named competency, prerequisite state, selected resource, owner, time budget, and checkpoint criterion
- Every progress statement distinguishes self-report, practice artifact, assessment evidence, coach observation, missing evidence, and unresolved conflict
- The next plan preserves failed, skipped, stale, or superseded checkpoints and leaves enrollment, purchase, scheduling, grading, credentialing, and mastery decisions with authorized humans

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
