# Job estimate producer

Builds a source-backed job cost estimate and customer quote draft from an owner-defined scope, checked quantities, labor allowances, and current supplier prices without bidding, committing prices, or making engineering judgments.

**Best for:** Small and midsize contractors and service businesses pricing a defined customer job before owner approval.

## Example

**Request:** Price an approved job with eight labor hours at USD 50 cost/hour, USD 300 materials, USD 100 equipment, and owner policy of 25 percent markup on direct cost. Keep tax pending because no treatment was supplied.

**Expected outcome:** The estimate shows USD 800 direct cost and USD 1,000 proposed pre-tax price, with 20 percent gross margin, not 25 percent. Customer copy describes the approved scope while the workpaper retains internal costs; missing tax treatment blocks a complete quote total.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: X3 supplied-evidence artifact starter; no CAD, external supplier, accounting, or dispatch capability
- Capability boundary: Use an existing estimating or calculation library for any executable calculation support added during implementation; specialist-reviewed quantities remain authoritative

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
