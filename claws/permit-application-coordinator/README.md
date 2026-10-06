# Permit application coordinator

Reconciles permit application requirements, jurisdiction evidence, plan revisions, comments, inspections, fees, receipts, and owner actions without submitting, certifying, paying, scheduling, or interpreting code compliance.

**Best for:** Property owners, small contractors, facilities teams, and project coordinators preparing permit packages while licensed professionals and jurisdiction officials retain authority.

## Example

**Request:** Reconcile the building permit checklist, plan set revisions, engineer letter, zoning notes, fee schedule, correction comments, and inspection prerequisites I supplied for the garage conversion. Show what is ready, stale, missing, or blocked, but do not submit, certify, pay, schedule, or claim code approval.

**Expected outcome:** A jurisdiction- and project-bound permit handoff that separates current package evidence, corrections, fees, inspections, and human authority gates without external action or compliance certification.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses only owner-supplied files, notes, and controlled references and grants no external account, messaging, browser, payment, publication, mutation, or submission capability.
- Capability boundary: When required evidence is unavailable or authority is unclear, preserve a blocked handoff rather than broadening access or inventing facts.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
