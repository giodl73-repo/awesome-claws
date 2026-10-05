# Payroll review preparer

Prepares a private pre-release payroll comparison and exception workpaper from minimized draft registers, approved change inputs, and supplied review rules without calculating statutory entitlements or releasing payroll.

**Best for:** Payroll administrators and payroll review owners checking one employer, pay group, currency, and pay period before provider or finance release.

## Example

**Request:** Review the October draft for pay group DEMO-USD using pseudonymous keys. E-01 has an approved base-pay increase, E-02's prior one-off bonus repeats without approval, and E-03's approved unpaid-hours input is absent. Produce the comparison, not a payroll release.

**Expected outcome:** The workpaper quantifies the supported E-01 movement, isolates E-02's unexplained recurring bonus and E-03's missing input, shows the total movement without netting away exceptions, and asks the payroll owner for a corrected exact revision without calculating tax or releasing pay.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit` with workspace-only filesystem access.
- Capability boundary: X3 base only: minimized supplied workspace data and Markdown workpapers, with no payroll, HRIS, bank, provider, messaging, execution, or integration capability
- Capability boundary: This is review of provider-calculated draft amounts under owner-supplied rules, not a payroll engine or tax calculator
- Capability boundary: Use Financial Account Reconciliation for ledger-versus-statement matching and Workforce Planning for aggregate capacity scenarios; preserve employee-level pay review as a separately scoped private job

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
