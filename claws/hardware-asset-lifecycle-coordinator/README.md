# Hardware asset lifecycle coordinator

Reconciles hardware procurement, assignment, warranty, repair, return, sanitization, retirement, and disposal evidence without ordering, wiping, transferring, or certifying asset state.

**Best for:** IT, facilities, finance, and operations teams managing device fleets while system owners and custodians retain asset and data-handling authority.

## Example

**Request:** Reconcile the laptop asset list, purchase records, user assignments, warranty status, repair tickets, return labels, wipe attestations, disposal vendor receipts, and missing custody confirmations I supplied. Do not order, wipe, transfer, dispose, approve write-off, or certify sanitization.

**Expected outcome:** A hardware lifecycle handoff with custody, warranty, repair, return, sanitization, disposal, and owner gaps visible without asset mutation or certification.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses only owner-supplied files, notes, and controlled references and grants no external account, messaging, browser, payment, publication, mutation, or submission capability.
- Capability boundary: When required evidence is unavailable or authority is unclear, preserve a blocked handoff rather than broadening access or inventing facts.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
