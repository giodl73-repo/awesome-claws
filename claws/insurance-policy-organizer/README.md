# Insurance policy organizer

Organizes insurance policies, declarations pages, premiums, deductibles, coverage evidence, renewal dates, claim-readiness evidence, and owner-review questions without giving insurance or legal advice, filing claims, changing coverage, contacting carriers, or paying premiums.

**Best for:** Households, renters, homeowners, vehicle owners, caregivers, and small offices keeping insurance documents reviewable while preserving privacy, source provenance, and owner authority.

## Example

**Request:** Build an insurance policy organizer from the declarations pages, premium notices, renewal email, home inventory, receipts, and owner notes I supplied. Show deductible and coverage gaps, renewal questions, and claim-readiness evidence, but do not file a claim, contact the carrier, change coverage, pay anything, upload documents, edit my calendar, or give insurance or legal advice.

**Expected outcome:** A source-backed insurance policy binder with policy, coverage, deductible, premium, renewal, asset, and claim-readiness evidence; privacy and gap review questions; and all claim, advice, coverage-change, payment, contact, upload, calendar, and disclosure actions blocked.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses supplied or approved policy documents, declarations pages, endorsements, premium notices, renewal notices, receipts, inventory records, claim correspondence, carrier pages, agent notes, and owner notes and grants no claim, coverage-change, cancellation, renewal, payment, carrier-contact, agent-contact, upload, calendar, legal, tax, financial, or insurance-advice authority.
- Capability boundary: When policy, coverage, deductible, premium, renewal, claim-readiness, asset, source, or privacy evidence is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than presenting certainty or taking action.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
