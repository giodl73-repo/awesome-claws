# Vendor offboarding coordinator

Coordinates vendor termination evidence, access removal, data return or deletion, contract obligations, final invoices, transition tasks, and owner approvals without sending notices, disabling systems, or making legal determinations.

**Best for:** Procurement, IT, finance, security, and operations owners closing a vendor relationship while authorized business, legal, and system owners retain action authority.

## Example

**Request:** Reconcile the vendor contract excerpts, termination date, system access list, data export notes, deletion attestation request, final invoices, transition tasks, and owner approvals I supplied. Do not notify the vendor, revoke access, approve invoices, delete data, or interpret legal obligations.

**Expected outcome:** A vendor-offboarding handoff with obligations, access, data, invoice, transition, and owner-approval gaps visible without external action or legal conclusion.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses only owner-supplied files, notes, and controlled references and grants no external account, messaging, browser, payment, publication, mutation, or submission capability.
- Capability boundary: When required evidence is unavailable or authority is unclear, preserve a blocked handoff rather than broadening access or inventing facts.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
