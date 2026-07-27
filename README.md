# Awesome Claws

A curated collection of starter [OpenClaw](https://github.com/openclaw/openclaw)
Claws. Each Claw is a portable setup for one purpose-built agent, including its
identity, operating instructions, and any capabilities it needs.

Claws are experimental. Review a Claw's manifest and dry-run plan before you
apply it. Most starters create an agent and workspace files. Several also
demonstrate pinned skills, an official plugin, a filtered OAuth MCP
connection, or scheduled work; those capabilities remain visible in the
consent-bound preview.

## Choose a starter

| Claw | Category | Capabilities | Focus |
| --- | --- | --- | --- |
| [Incident response](claws/incident-response) | Engineering | Daily isolated cron | Evidence-led incident coordination |
| [Software maintainer](claws/software-maintainer) | Engineering | Coding profile, Diffs plugin, filtered GitHub MCP | Repository change delivery |
| [Security analyst](claws/security-analyst) | Engineering | Base | Bounded security assessment |
| [Data analyst](claws/data-analyst) | Analysis | Base | Reproducible data analysis |
| [Research briefing](claws/research-briefing) | Analysis | Base | Source-grounded decision briefs |
| [Financial analyst](claws/financial-analyst) | Analysis | Yahoo Finance skill | Assumption-explicit financial analysis |
| [Customer support](claws/customer-support) | Operations | Customer support skill | Accurate customer case resolution |
| [Sales operations](claws/sales-operations) | Operations | Base | Pipeline and process analysis |
| [Recruiting coordinator](claws/recruiting-coordinator) | Operations | Base | Candidate logistics and handoffs |
| [Content operations](claws/content-operations) | Operations | Base | Editorial production control |
| [Executive assistant](claws/executive-assistant) | Productivity | Base | Executive priorities and follow-through |
| [Project manager](claws/project-manager) | Productivity | Base | Milestones, dependencies, and decisions |
| [Product manager](claws/product-manager) | Product | Base | Evidence-backed product decisions |
| [Compliance reviewer](claws/compliance-reviewer) | Governance | Base | Traceable control review |
| [Knowledge curator](claws/knowledge-curator) | Productivity | Base | Durable knowledge organization |
| [Executive briefing](claws/executive-briefing) | Productivity | Gog + Weather skills, weekday cron | Private daily operating brief |
| [Meeting intelligence](claws/meeting-intelligence) | Productivity | Whisper + DOCX skills | Consented meeting records |
| [Spreadsheet analyst](claws/spreadsheet-analyst) | Analysis | XLSX skill | Auditable workbook transformation |
| [Knowledge gardener](claws/knowledge-gardener) | Productivity | Notion skill | Scoped knowledge-space maintenance |
| [Research monitor](claws/research-monitor) | Analysis | Parallel plugin, weekday cron | Source-linked evidence watch |
| [Presentation producer](claws/presentation-producer) | Productivity | PowerPoint skill | Reviewable presentation delivery |
| [Document intake analyst](claws/document-intake-analyst) | Analysis | Markdown Converter skill | Traceable document normalization |
| [Media evidence reviewer](claws/media-evidence-reviewer) | Analysis | Video Frames + Whisper skills | Timestamped audiovisual review |
| [Release coordinator](claws/release-coordinator) | Engineering | GitHub + Slack skills | Approval-bound release coordination |
| [Feed intelligence monitor](claws/feed-intelligence-monitor) | Analysis | Blogwatcher skill, weekday cron | Curated source-feed deltas |
| [Travel planner](claws/travel-planner) | Productivity | Open-Meteo + Travel Checklist skills | Public-source trip planning |

## Preview a Claw

Use an OpenClaw build that includes the experimental Claws surface:

```bash
export OPENCLAW_EXPERIMENTAL_CLAWS=1
openclaw claws inspect ./claws/incident-response
openclaw claws add ./claws/incident-response --dry-run --json
```

Inspect the reported files and capabilities. If the plan is correct, apply the
exact plan digest returned by the dry run:

```bash
openclaw claws add ./claws/incident-response \
  --yes \
  --plan-integrity <SHA256_FROM_DRY_RUN>
```

OpenClaw rebuilds the plan and rejects consent if the source, destination, or
local state changed after preview. See the
[OpenClaw Claws documentation](https://docs.openclaw.ai/cli/claws) for status,
update, removal, export, and ownership behavior.

## Understand a package

Every starter contains:

- `CLAW.md`: the versioned manifest. Its Markdown body becomes the new agent's
  managed `SOUL.md`.
- `workspace/AGENTS.md`: the agent's workflow, deliverables, and completion
  criteria.
- `package.json`: package identity and the `openclaw.claw` entry point.

These packages intentionally follow the experimental prompt-body contract in
[openclaw/openclaw#113454](https://github.com/openclaw/openclaw/pull/113454): a
non-empty `CLAW.md` body is the portable agent prompt, and the same package does
not declare a competing `SOUL.md` workspace sidecar.

The generated packages are derived from [`catalog.json`](catalog.json). Edit
that source and run `npm run build`; do not hand-edit files under `claws/`.

## Validate the catalog

Node.js 22.22.3 or later is required.

```bash
npm run build
npm run check
```

`npm run check` verifies generated output, package consistency, content quality,
and basic secret hygiene. Maintainers can set `CLAWS_CLI_ENTRY` and run
`npm run inspect` to inspect every package with a standalone Claws reference
CLI. `npm run proof:openclaw` additionally dry-runs representative packages
through a compatible OpenClaw checkout when `OPENCLAW_CLI_ENTRY` is set.

See [CONTRIBUTING.md](CONTRIBUTING.md) to propose or improve a starter and
[SECURITY.md](SECURITY.md) to report a vulnerability.
