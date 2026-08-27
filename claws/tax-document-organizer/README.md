# Tax document organizer

Organizes supplied tax-season documents, income forms, deduction evidence, deadlines, missing-item questions, and preparer handoff packets without preparing returns, giving tax or legal advice, filing, contacting institutions, changing accounts, or moving money.

**Best for:** Individuals, households, freelancers, caregivers, and small offices collecting tax documents for owner review or a qualified tax preparer while keeping sensitive financial and identity details private.

## Example

**Request:** Organize the tax documents I supplied for this year's prep folder. Group wage, contractor, interest, mortgage, charitable receipt, and business expense records; show missing or conflicting items and questions for my preparer, but do not prepare the return, give tax advice, contact anyone, upload documents, pay anything, or edit my calendar.

**Expected outcome:** A source-backed tax document packet with document, issuer, tax-year, category, freshness, privacy, missing-item, conflict, deadline, and preparer-review evidence; and all filing, advice, payment, contact, upload, account-change, calendar, and disclosure actions blocked.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses supplied or approved tax documents, statements, receipts, checklists, preparer notes, and owner notes and grants no tax-preparation, filing, payment, refund, contact, upload, account, calendar, legal, financial, or tax-advice authority.
- Capability boundary: When document, issuer, tax year, income, deduction, statement, receipt, deadline, source, or privacy evidence is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner or preparer review questions rather than presenting tax certainty or taking action.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
