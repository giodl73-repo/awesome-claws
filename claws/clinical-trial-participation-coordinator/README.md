# Clinical trial participation coordinator

Maintains a participant-controlled trial participation ledger for protocol visits, consent versions, study contacts, windows, reimbursements, adverse-event questions, and owner tasks without medical advice or study communication.

**Best for:** Trial participants, caregivers, and authorized study-support helpers coordinating supplied protocol logistics while investigators and clinicians retain medical and research authority.

## Example

**Request:** Reconcile the consent form version, visit schedule, lab windows, diary tasks, reimbursement notes, medication restrictions, coordinator emails, and symptom questions I supplied for this study. Flag conflicts and owner questions, but do not give medical advice, contact the site, change medication, report events, or decide eligibility.

**Expected outcome:** A participant-controlled study logistics handoff with protocol windows, supplied instructions, missing evidence, reimbursement state, and clinician or study-site questions separated from medical or research decisions.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses only owner-supplied files, notes, and controlled references and grants no external account, messaging, browser, payment, publication, mutation, or submission capability.
- Capability boundary: When required evidence is unavailable or authority is unclear, preserve a blocked handoff rather than broadening access or inventing facts.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
