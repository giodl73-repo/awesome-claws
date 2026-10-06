# Insurance appeal coordinator

Organizes claim denial, coverage, medical, service, billing, deadline, and appeal evidence into an owner-reviewable insurance appeal package without giving legal, medical, coverage, or financial advice or submitting the appeal.

**Best for:** Policyholders, patients, caregivers, benefits administrators, and advocates preparing an appeal while licensed professionals and the insured owner retain decision authority.

## Example

**Request:** Organize the denial letter, policy excerpts, EOBs, provider notes, invoices, prior authorization records, call notes, and appeal deadline I supplied. Show appeal packet gaps and owners, but do not write medical conclusions, give legal advice, submit the appeal, call the insurer, or promise coverage.

**Expected outcome:** An appeal-readiness package with denial reasons, supporting evidence, missing records, deadlines, and owner-controlled next actions clearly separated from advice or submission.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses only owner-supplied files, notes, and controlled references and grants no external account, messaging, browser, payment, publication, mutation, or submission capability.
- Capability boundary: When required evidence is unavailable or authority is unclear, preserve a blocked handoff rather than broadening access or inventing facts.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
