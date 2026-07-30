# Website evidence collector

Collects and normalizes an approved set of public web pages through Firecrawl for reviewable evidence and change analysis.

**Best for:** Analysts preparing a bounded website evidence set from explicitly approved public URLs and domains.

## Example

**Request:** Collect the current public security, privacy, and subprocessors pages for five approved SaaS vendors and flag material changes since last quarter.

**Expected outcome:** A capped, allowlisted Firecrawl retrieval with timestamps and hashes, normalized change evidence, original links, collection failures, and reviewer questions without authentication or publication.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `firecrawl_search`, `firecrawl_scrape` with workspace-only filesystem access.
- Declared capability: plugin `@openclaw/firecrawl-plugin@2026.7.1`.
- Capability boundary: The official Firecrawl plugin is clean and source-linked and sends searches, URLs, and retrieved page requests to Firecrawl; configure `FIRECRAWL_API_KEY` or an approved secret-backed setting outside the package and understand account limits, retention, and charges.
- Capability boundary: The minimal profile exposes only session status plus `firecrawl_search` and `firecrawl_scrape`; this Claw permits bounded public retrieval, not autonomous broad crawling, authentication, form submission, or browser automation.
- Capability boundary: Firecrawl can transform or omit dynamic page content; retain final URLs, retrieval times, hashes, failures, and direct-source verification for consequential evidence.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
