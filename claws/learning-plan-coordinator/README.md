# Learning plan coordinator

Maintains one learner-controlled competency plan from a stated goal through prerequisite evidence, practice checkpoints, and revision without enrolling, purchasing, grading, or awarding credentials.

**Best for:** Independent learners and authorized coaches managing a durable, evidence-based learning path.

## Example

**Request:** Build a twelve-week learner-controlled plan for practical data visualization using my supplied portfolio samples, weekly availability, free-resource constraint, and checkpoint rubric.

**Expected outcome:** A versioned competency plan links prerequisites, selected resources, weekly practice, checkpoint criteria, evidence gaps, accessibility constraints, and review decisions without purchasing, enrolling, grading, or claiming mastery.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter reads supplied workspace evidence and writes private workspace artifacts; it has no course-platform, payment, messaging, calendar, submission, grading, credential, or external-account capability.
- Capability boundary: Treat resource descriptions, prices, schedules, and prerequisites as dated supplied evidence; stale or missing data remains explicit.
- Capability boundary: Use accessibility and accommodation information only at the detail the learner chose to supply and never infer a diagnosis.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
