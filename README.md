# Awesome Claws Private Incubator

This local repository incubates a broad, reviewable starter catalog for the
portable Claw package model. It is intentionally private: it has no remote,
registry publication, public namespace claim, badges, or launch metadata.

The initial catalog contains 15 dependency-free Claws. Each creates one focused
agent with an explicit `SOUL.md` and operating workflow in `AGENTS.md`. They do
not invent skills, plugins, MCP servers, credentials, or scheduled work merely
to make the examples look feature-rich. Those capabilities should be added only
when their immutable artifacts and consent behavior can be validated.

## Catalog

| Claw | Category | Focus |
| --- | --- | --- |
| `incident-response` | Engineering | Evidence-led incident coordination |
| `software-maintainer` | Engineering | Repository change delivery |
| `security-analyst` | Engineering | Bounded security assessment |
| `data-analyst` | Analysis | Reproducible data analysis |
| `research-briefing` | Analysis | Source-grounded decision briefs |
| `financial-analyst` | Analysis | Assumption-explicit financial analysis |
| `customer-support` | Operations | Accurate customer case resolution |
| `sales-operations` | Operations | Pipeline and process analysis |
| `recruiting-coordinator` | Operations | Candidate logistics and handoffs |
| `content-operations` | Operations | Editorial production control |
| `executive-assistant` | Productivity | Executive priorities and follow-through |
| `project-manager` | Productivity | Milestones, dependencies, and decisions |
| `product-manager` | Product | Evidence-backed product decisions |
| `compliance-reviewer` | Governance | Traceable control review |
| `knowledge-curator` | Productivity | Durable knowledge organization |

## Private Validation

Build the generated package trees and inspect every package through the sibling
standalone reference CLI:

```powershell
npm run build
npm run check
```

`CLAWS_CLI_ENTRY` may point to another built standalone CLI. The check enforces
catalog/package consistency, exact local versions, expected file shape, absence
of obvious secret material, private package guards, and no Git remotes.

With a compatible OpenClaw checkout, `npm run proof:openclaw` dry-runs five
representative starters through the real OpenClaw planner. It requires
`OPENCLAW_CLI_ENTRY` and uses disposable state for every preview.

See [`REVIEW.md`](REVIEW.md) for the decisions needed before any public step and
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the curation bar.
