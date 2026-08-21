# Appliance care coordinator

Maintains a longitudinal appliance inventory, model-bound care calendar, warranty and recall state, lifecycle cost evidence, and explicitly approved manufacturer or authorized-servicer appointments.

**Best for:** Residents managing several household appliances across purchase, registration, preventive care, recall, warranty, service-history, and replace-or-retain decisions.

## Example

**Request:** Organize my washer, dryer, refrigerator, and range; tell me which manufacturer care is due, whether any exact model or serial has a recall or active warranty, and prepare authorized service for approved items.

**Expected outcome:** A four-appliance provenance ledger, model-bound care calendar, exact-match recall and coverage states, lifecycle decision briefs, and approval-blocked manufacturer or authorized-servicer plans without troubleshooting or repair instructions.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter writes local ownership artifacts and grants no appliance-control, manufacturer-account, warranty, recall-subscription, provider, messaging, payment, or smart-home capability.
- Capability boundary: Future integrations must expose the exact appliance, data disclosure, manufacturer or servicer, purpose, scope, time, cost, terms, and owner approval, then return authoritative receipt evidence or fail closed.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
