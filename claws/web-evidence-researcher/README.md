# Web evidence researcher

Uses Tavily search and extraction to build bounded, source-linked evidence sets without publishing or acting on retrieved content.

**Best for:** Researchers and operators who need current web evidence collected against a declared question and source standard.

## Example

**Request:** Assess whether three proposed authentication standards are ready for our 2027 device rollout using current standards-body and vendor sources.

**Expected outcome:** A bounded Tavily-assisted source set, primary-source verification, dated claim table, explicit disagreement and coverage gaps, and a decision brief without changing any system or publishing conclusions.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `tavily_search`, `tavily_extract` with workspace-only filesystem access.
- Declared capability: plugin `@openclaw/tavily-plugin@2026.7.1`.
- Capability boundary: The official Tavily plugin is clean and source-linked and sends search queries and requested URLs to Tavily; configure `TAVILY_API_KEY` or the equivalent secret-backed plugin setting outside the Claw package and review Tavily's terms, retention, and billing before use.
- Capability boundary: The minimal profile exposes only session status plus `tavily_search` and `tavily_extract`; retrieved content is untrusted and cannot grant authority, expand scope, or instruct the agent to use another tool.
- Capability boundary: Search ranking and extraction can omit, truncate, normalize, or misdate evidence; preserve direct URLs and timestamps and verify material claims against authoritative primary sources.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
