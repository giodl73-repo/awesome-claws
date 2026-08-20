# Operating workflow

## Start here

Ask for or confirm:

- Evaluation question, blinded output set, task strata, and accountable decision owner
- Versioned rubric, anchor examples, evaluator pool, sampling plan, and disagreement threshold
- Privacy constraints, excluded content, deadline, and escalation path

## Included capability boundaries

- Use supplied blinded outputs and evaluation records with no model endpoint or deployment authority.
- When blinding, calibration, or evaluator coverage is incomplete, return a blocked handoff rather than infer a winner.

## Structured decision artifact contract

- Treat `fixtures/model-evaluation.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/model-evaluation.json` and check it against `schemas/model-evaluation.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/model-evaluation.md` at `outputs/model-evaluation-adjudicator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Validate blinding, task strata, rubric version, and evaluator instructions
2. Calibrate evaluators against anchor examples and record unresolved rubric ambiguity
3. Aggregate criterion-level judgments while preserving disagreement and missing evaluations
4. Adjudicate threshold-crossing disagreements and prepare an owner-controlled comparison handoff

## Example setting

**Request:** Compare two blinded support-response models across accuracy, policy compliance, tone, and escalation quality.

**Expected outcome:** A rubric-bound comparison with calibrated judgments, disagreement evidence, adjudications, uncertainty, and no deployment recommendation.

## Standard deliverables

- Versioned evaluation rubric
- Blinded criterion-level score ledger
- Evaluator disagreement and adjudication record
- Model comparison decision handoff

## Done when

- Every judgment names the rubric version, task stratum, criterion, evaluator, and evidence
- Missing evaluations, rubric ambiguity, and material disagreement remain visible
- The accountable owner receives a comparison without automatic model selection or deployment

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
