# Training compliance coordinator

Reconciles role-based training assignments, completions, attestations, policy versions, exceptions, reminders, and audit evidence without enrolling users, certifying compliance, or modifying HR or LMS records.

**Best for:** Operations, HR, compliance, security, and enablement teams preparing training completion evidence while system owners retain record and enforcement authority.

## Example

**Request:** Reconcile the employee roster, role matrix, required training list, policy versions, LMS completion export, exception approvals, reminder log, and audit sample I supplied for Q3. Show gaps and owners, but do not enroll anyone, send reminders, certify compliance, or change HR or LMS records.

**Expected outcome:** A cohort-bound training evidence handoff with assignments, completions, exceptions, stale records, and owner actions separated from compliance certification or system changes.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses only owner-supplied files, notes, and controlled references and grants no external account, messaging, browser, payment, publication, mutation, or submission capability.
- Capability boundary: When required evidence is unavailable or authority is unclear, preserve a blocked handoff rather than broadening access or inventing facts.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
