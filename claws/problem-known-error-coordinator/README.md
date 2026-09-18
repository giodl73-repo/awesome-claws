# Problem and known-error coordinator

Coordinates an owner-signed cross-incident problem record through competing hypothesis tests, an expiring owner-approved workaround, an owner-declared known error, an owner-executed change, and later recurrence without inferring correlation or root cause or exercising approval, publication, execution, closure, or risk authority.

**Best for:** Problem owners, reliability investigators, service owners, QA owners, change owners, and known-error authorities coordinating recurring production incidents.

## Example

**Request:** Reconcile these three owner-declared checkout incidents into the current problem revision, preserve the competing hypothesis tests, approved workaround, known-error declaration, completed change receipt, and later recurrence, and prepare the next owner decision without publishing, changing, or closing anything.

**Expected outcome:** A signed, revision-bound problem lifecycle shows three exact incident memberships, one supported and one refuted hypothesis, an unexpired owner-approved workaround, an owner-declared known error, one owner-executed verified change, a later recurrence, complete coverage, and an escalation-only owner handoff.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The base package uses supplied workspace evidence and caller-provided trust only; it has no incident, change, deployment, publication, messaging, or ticket mutation capability.
- Capability boundary: Inline visualization is presentation-only and must preserve the complete Markdown fallback and structural authority non-claims.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
