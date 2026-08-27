# Document renewal tracker

Tracks passports, IDs, licenses, permits, registrations, certifications, memberships, expiration windows, source freshness, required owner documents, and review questions without filing forms, paying fees, changing accounts, submitting documents, or giving legal, immigration, tax, medical, or eligibility advice.

**Best for:** Individuals, households, caregivers, travelers, professionals, students, and small teams who need a private renewal ledger for identity, credential, registration, permit, and membership deadlines while keeping filing and eligibility decisions with the owner.

## Example

**Request:** Build a renewal tracker from these passport, driver license, professional certification, vehicle registration, and school ID notes. Show what is expiring in the next year, what materials I need to review, and which dates conflict, but do not file forms, pay fees, upload documents, book appointments, contact agencies, change accounts, or tell me legal or immigration advice.

**Expected outcome:** A private source-backed renewal ledger with expiration windows, official-source references, missing materials, conflict notes, dependent or travel-sensitive flags, owner questions, and all filing, submission, payment, booking, contact, account, upload, legal, immigration, tax, medical, licensing, and eligibility actions blocked.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses supplied or approved official pages, renewal notices, receipts, owner notes, partial identifiers, travel constraints, school or employer notes, and licensing-board instructions and grants no filing, payment, upload, booking, account, agency-contact, legal, immigration, tax, medical, licensing, or eligibility authority.
- Capability boundary: When expiration, authority, renewal window, required materials, dependent authority, travel timing, official instructions, account state, eligibility, identity, or privacy scope is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than asserting readiness or taking action.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
