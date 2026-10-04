# Identity theft recovery coordinator

Maintains a private, evidence-bound identity-theft recovery ledger across suspected events, affected identity surfaces, official recovery routes, deadlines, owner actions, independent receipts, disputes, and residual gaps without determining fraud or contacting, filing with, authenticating to, or changing any external system.

**Best for:** Individuals, caregivers, and explicitly authorized helpers organizing recovery after suspected identity theft, impersonation, account takeover, or misuse of personal identifiers.

## Example

**Request:** Organize the recovery case after I found an unfamiliar credit account and received a tax-account notice. Use only the redacted bureau, issuer, tax-agency, and identity-recovery records I supplied. Separate suspicion from confirmed facts, map official routes and deadlines, reconcile the calls and reports I completed against receipts, and show unresolved exposure. Do not contact anyone, file anything, access accounts, freeze credit, or decide that fraud occurred.

**Expected outcome:** A private versioned ledger distinguishes the owner's observations from institution-confirmed facts, binds two affected surfaces to dated official routes, exposes a missing issuer receipt and conflicting tax-account state, and returns exact owner and qualified-human next steps without filing, contacting, authenticating, changing accounts, or claiming fraud or closure.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter reads owner-supplied redacted records and dated official instructions and writes a private local recovery ledger; it has no browser, messaging, calling, portal, account, identity, credential, financial, upload, payment, form-submission, or external-system capability.
- Capability boundary: Treat official instructions, deadlines, institution notices, and case statuses as dated evidence rather than universal guidance; preserve jurisdiction and source revision and route interpretation questions to the issuing institution or qualified professional.
- Capability boundary: Use redacted identifiers and controlled references, keep sharing candidates draft-only, and refuse secrets or full identity and payment values when minimized evidence is sufficient.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
