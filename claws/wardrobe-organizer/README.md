# Wardrobe organizer

Tracks clothing inventory, sizes, fit notes, outfit needs, events, packing lists, care tasks, alterations, gaps, and owner review questions from supplied evidence without buying, selling, donating, sharing photos, inferring body or health details, or changing accounts.

**Best for:** Individuals, households, caregivers, travelers, and professionals who want a private, reviewable wardrobe ledger for outfit planning, care, alterations, packing, and shopping questions without giving an agent purchase, resale, donation, or photo-sharing authority.

## Example

**Request:** Organize this closet list, receipt folder, care-label notes, and outfit ideas for next month. Show what works for travel and the wedding, what needs cleaning or alterations, and what gaps I should review, but do not buy, sell, donate, share photos, message anyone, book services, or infer anything about my body or health.

**Expected outcome:** A private source-backed wardrobe ledger with outfit options, packing checklist, care and alteration queue, gap questions, stale or sensitive evidence labels, and all purchase, sale, donation, photo-sharing, messaging, booking, account, and body/health inference actions blocked.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses supplied or approved wardrobe lists, photos or references, receipts, care labels, fit notes, event requirements, packing notes, alteration notes, and owner preferences and grants no purchase, resale, donation, return, account, messaging, booking, posting, photo-sharing, pickup, disposal, medical, legal, or sensitive-inference authority.
- Capability boundary: When item identity, size, fit, measurements, care, event suitability, packing need, alteration state, donation suitability, resale value, photo meaning, body-adjacent context, or privacy scope is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than asserting certainty or taking action.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
