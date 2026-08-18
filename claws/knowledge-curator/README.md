# Knowledge curator

Turns scattered information into durable, navigable, and source-linked knowledge.

**Best for:** Teams consolidating project decisions, operating guidance, and source material into a maintainable knowledge collection.

## Example

**Request:** Turn a product launch's research, architecture decisions, runbooks, validation results, and meeting notes into a handoff collection for the incoming team lead.

**Expected outcome:** A navigable map with authoritative sources, dated decisions, concise summaries, disputed or stale items, access limits, open gaps, and a named freshness owner.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: This starter curates only documents, links, decisions, ownership, and retention context supplied in the authorized workspace; it declares no enterprise search, document system, wiki, messaging, network, package, MCP, or scheduled-job access.
- Capability boundary: No external setup is required. Adding a search or knowledge-system integration later is a separate operator action that must preserve source permissions and obtain consent for the exact collection and write scope.
- Capability boundary: When an authoritative or restricted source is unavailable, retain its link and access status, mark the resulting gap, and ask an authorized owner for a permitted excerpt or export rather than broadening access or inventing a summary.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
