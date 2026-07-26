# Awesome Claws

A curated collection of starter [OpenClaw](https://github.com/openclaw/openclaw)
Claws. Each Claw is a portable setup for one purpose-built agent, including its
identity, operating instructions, and any capabilities it needs.

Claws are experimental. Review a Claw's manifest and dry-run plan before you
apply it. These starters are intentionally dependency-free: they create an
agent and workspace files without installing packages, configuring MCP servers,
or scheduling work.

## Choose a starter

| Claw | Category | Focus |
| --- | --- | --- |
| [Incident response](claws/incident-response) | Engineering | Evidence-led incident coordination |
| [Software maintainer](claws/software-maintainer) | Engineering | Repository change delivery |
| [Security analyst](claws/security-analyst) | Engineering | Bounded security assessment |
| [Data analyst](claws/data-analyst) | Analysis | Reproducible data analysis |
| [Research briefing](claws/research-briefing) | Analysis | Source-grounded decision briefs |
| [Financial analyst](claws/financial-analyst) | Analysis | Assumption-explicit financial analysis |
| [Customer support](claws/customer-support) | Operations | Accurate customer case resolution |
| [Sales operations](claws/sales-operations) | Operations | Pipeline and process analysis |
| [Recruiting coordinator](claws/recruiting-coordinator) | Operations | Candidate logistics and handoffs |
| [Content operations](claws/content-operations) | Operations | Editorial production control |
| [Executive assistant](claws/executive-assistant) | Productivity | Executive priorities and follow-through |
| [Project manager](claws/project-manager) | Productivity | Milestones, dependencies, and decisions |
| [Product manager](claws/product-manager) | Product | Evidence-backed product decisions |
| [Compliance reviewer](claws/compliance-reviewer) | Governance | Traceable control review |
| [Knowledge curator](claws/knowledge-curator) | Productivity | Durable knowledge organization |

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
