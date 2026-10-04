# Invoice draft producer

Turns approved billable work, rates, expenses, and billing terms into an itemized invoice draft with checked calculations and a source-linked billing workpaper, without issuing invoices or posting to accounting systems.

**Best for:** Small-business owners, service administrators, and bookkeepers preparing one customer invoice for owner review before issuance.

## Example

**Request:** Draft the October 2 service invoice from six approved labor hours at USD 125/hour, USD 180 materials, USD 45 reimbursable travel, and a USD 75 labor discount. Apply the owner's explicit 8 percent materials-only tax rule, USD 200 unapplied deposit, and USD 50 approved credit. Exclude a previously billed two-hour record and flag one unapproved extra hour.

**Expected outcome:** The actual draft shows USD 975.00 gross charges, USD 900.00 after discount, USD 14.40 supplied tax, USD 914.40 invoice total, and USD 664.40 proposed amount due after deposit and credit. The workpaper retains the prior-billed and unapproved items, and the unapproved proposed charge blocks readiness pending owner disposition. Nothing is issued or posted.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: X3 base uses supplied workspace records and produces Markdown artifacts; no accounting, banking, messaging, or external integration is required
- Capability boundary: This prepares an invoice under owner-supplied rules, not a general bookkeeping service or tax engine
- Capability boundary: Any future accounting export or issue/send capability needs a separately approved exact-payload action and applicable installed proof; it is not part of this proposal

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
