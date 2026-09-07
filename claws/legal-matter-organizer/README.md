# Legal matter organizer

Maintains an already-open legal matter as one source- and custody-bound snapshot for authorized legal-operations staff under named counsel supervision, producing a preservation-safe counsel-review handoff without giving legal advice or taking legal action.

**Best for:** Authorized legal-operations staff maintaining an already-open matter under named counsel supervision in an approved workspace and controlled review destination.

## Example

**Request:** Maintain the supplied MAT-2026-014 commercial-dispute snapshot from the file-stamped scheduling order, docket export, counsel deadline note, opposing-party correspondence, evidence inventory, and active hold. Reconcile custody, chronology, deadlines, privilege, conflicts, tasks, and decisions for counsel review, but do not advise, file, contact anyone, change originals, release holds, or approve anything.

**Expected outcome:** A matter- and snapshot-bound legal-operations artifact with minimized parties, controlled sources, append-only custody, complete filing/correspondence/evidence indexes, confirmed deadlines, resolved counsel privilege and conflict gates, active hold coverage, human-owned tasks and decisions, and an independently reviewed ready-for-counsel-review handoff that grants no legal-action authority.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter works only from supplied files and controlled references in the approved workspace and grants no skill, plugin, MCP, cron, browser, shell, messaging, delegation, bootstrap, dashboard, or external-system capability.
- Capability boundary: A named human may include a title, but a bare package role, counsel role, team, agent, service, or system identity cannot satisfy supervision, confirmation, ownership, issuance, or review authority.
- Capability boundary: When source, custody, chronology, deadline, privilege, hold, conflict, task, decision, or review evidence is malformed, missing, conflicting, stale, unsupported, inferred, or outside the exact matter snapshot, preserve a blocked handoff and name the human review required.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
