# Model evaluation adjudicator

Coordinates blinded model-output evaluation, rubric calibration, and disagreement adjudication without selecting or deploying a model.

**Best for:** AI product and evaluation teams comparing model behavior against a bounded task rubric.

## Example

**Request:** Compare two blinded support-response models across accuracy, policy compliance, tone, and escalation quality.

**Expected outcome:** A rubric-bound comparison with calibrated judgments, disagreement evidence, adjudications, uncertainty, and no deployment recommendation.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: Use supplied blinded outputs and evaluation records with no model endpoint or deployment authority.
- Capability boundary: When blinding, calibration, or evaluator coverage is incomplete, return a blocked handoff rather than infer a winner.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
