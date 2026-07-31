# Awesome Claws

A curated collection of starter [OpenClaw](https://github.com/openclaw/openclaw)
Claws. Each Claw is a portable, finished agent application for one purpose,
including identity, operating instructions, setup, reusable resources, and the
capabilities it needs.

Claws are experimental. Review a Claw's manifest and dry-run plan before you
apply it. Most starters create an agent and workspace files. Several also
demonstrate pinned skills, a harness-native extension, a filtered OAuth MCP
connection, or scheduled work; those capabilities remain visible in the
consent-bound preview.

All examples use portable Claw schema v1 and the application layering proposed in
[RFC 0025](https://github.com/openclaw/rfcs/pull/52): portable skills, direct MCP
requests, schedules, and ordinary workspace assets stay in `CLAW.md`; optional
seed-once onboarding lives in package-root `BOOTSTRAP.md`; native plugin bundles
and harness tuning live at conventional paths such as `profiles/openclaw.yml`.
Answers, credentials, and user-edited preferences remain local.

## Choose a starter

There are two useful reference points in the collection:

- **Golden application example:** [Travel concierge](claws/travel-concierge)
  shows the broad application shape: guided setup, user-owned preferences, a
  managed comparison template, a least-privilege OpenClaw profile, and a real
  Expedia extension with explicit authentication and transaction boundaries.
  Start here to understand how the pieces form one finished agent application.
- **Copyable reference:** [Executive assistant](claws/executive-assistant) is
  intentionally smaller and dependency-free. Copy it when authoring a new
  Claw to start from a portable prompt, operating workflow, managed template,
  contextual setup, and seed-once `USER.md` preferences without first adopting
  a plugin, MCP server, credential, or schedule.

The Golden example is optimized for breadth and end-to-end understanding. The
copyable reference is optimized for a small package that is easy to rename and
adapt. The other starters demonstrate different application shapes between
those two points; they are not expected to contain the same components.

Every starter also gives its generated `SOUL.md` a role-specific identity. The
collection intentionally ranges from light theming, such as the copyable
Executive Assistant, to a more distinctive professional voice, such as the
Travel Concierge. Theme means domain judgment, vocabulary, priorities, and
tone; it does not mean theatrical role-play, duplicated workflow instructions,
or weaker safety boundaries.

Every starter declares an Experience conformance case in
[`experience-cases.json`](experience-cases.json). Artifact-first starters
produce a durable handoff with a complete chat fallback. Visual starters add a
packaged, inert HTML asset and `show_widget`; dashboard applications additionally
use stable widget names and pin only after the user accepts the persistent view.
Unsupported clients lose presentation, not meaning or control.

| Claw | Category | Capabilities | Focus |
| --- | --- | --- | --- |
| [Incident response](claws/incident-response) | Engineering | Daily isolated cron | Evidence-led incident coordination |
| [Software maintainer](claws/software-maintainer) | Engineering | Coding profile, Diffs extension, filtered GitHub MCP, application resources | Repository change delivery |
| [Security analyst](claws/security-analyst) | Engineering | Base | Bounded security assessment |
| [Data analyst](claws/data-analyst) | Analysis | Base | Reproducible data analysis |
| [Research briefing](claws/research-briefing) | Analysis | Base | Source-grounded decision briefs |
| [Financial analyst](claws/financial-analyst) | Analysis | Setup, Yahoo Finance skill, report template | Assumption-explicit financial analysis |
| [Customer support](claws/customer-support) | Operations | Customer support skill | Accurate customer case resolution |
| [Sales operations](claws/sales-operations) | Operations | Base | Pipeline and process analysis |
| [Recruiting coordinator](claws/recruiting-coordinator) | Operations | Base | Candidate logistics and handoffs |
| [Content operations](claws/content-operations) | Operations | Base | Editorial production control |
| [Executive assistant](claws/executive-assistant) (copyable reference) | Productivity | Guided setup, local preferences, brief template | Executive priorities and follow-through |
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
| [Travel concierge](claws/travel-concierge) (Golden example) | Productivity | Guided setup, Expedia extension, visual asset, dashboard profile | Live Expedia search and traveler-controlled booking handoff |
| [Web evidence researcher](claws/web-evidence-researcher) | Analysis | Tavily plugin, minimal tool profile | Bounded search and source extraction |
| [Website evidence collector](claws/website-evidence-collector) | Analysis | Firecrawl plugin, minimal tool profile | Allowlisted public website collection |
| [Video concept producer](claws/video-concept-producer) | Productivity | PixVerse provider, minimal tool profile | Private review-first video generation |
| [Workflow operator](claws/workflow-operator) | Operations | Lobster plugin, minimal tool profile | Typed approval-aware workflow execution |
| [Public company watcher](claws/public-company-watcher) | Analysis | Blogwatcher skill, weekday cron | SEC-grounded company changes |
| [Research scout](claws/research-scout) | Analysis | Blogwatcher skill, weekday cron | Public research evidence deltas |
| [Public safety monitor](claws/public-safety-monitor) | Operations | Open-Meteo + Blogwatcher skills, recurring cron | Official alert synthesis |
| [Civic data analyst](claws/civic-data-analyst) | Analysis | Public transit skill | Reproducible civic evidence |
| [Event operations director](claws/event-operations-director) | Operations | Guided setup, visual assets, dashboard profile | Run-of-show and event readiness |
| [API integration engineer](claws/api-integration-engineer) | Engineering | Coding profile, contract fixtures, visual asset | Contract-led API integration |
| [Procurement evaluator](claws/procurement-evaluator) | Operations | Guided setup, schema, visual asset | Traceable vendor evaluation |
| [Grant portfolio manager](claws/grant-portfolio-manager) | Operations | Guided setup, schema, dashboard profile | Opportunity and submission readiness |
| [Privacy request coordinator](claws/privacy-request-coordinator) | Governance | Minimized schema, visual assets, dashboard profile | Privacy request coordination |
| [Manufacturing operations planner](claws/manufacturing-operations-planner) | Operations | Guided setup, constraint schema, dashboard profile | Production scenario planning |
| [Facilities operations coordinator](claws/facilities-operations-coordinator) | Operations | Guided setup, issue schema, visual asset | Private maintenance coordination |
| [UX research synthesizer](claws/ux-research-synthesizer) | Product | Evidence schema, theme-map asset | Consented research synthesis |
| [Experimentation lead](claws/experimentation-lead) | Product | Experiment schema, readout asset | Guardrailed experiment decisions |
| [Data migration planner](claws/data-migration-planner) | Engineering | Mapping schema, readiness asset | Controlled migration planning |
| [Localization program manager](claws/localization-program-manager) | Productivity | Locale schema, readiness asset | Multilingual release coordination |
| [Accessibility review coordinator](claws/accessibility-review-coordinator) | Governance | Finding schema, accessible review asset | Evidence-led accessibility review |
| [Quality assurance lead](claws/quality-assurance-lead) | Engineering | Test-evidence schema, coverage asset | Risk-based release quality |
| [Cloud cost analyst](claws/cloud-cost-analyst) | Analysis | Cost schema, operating-view asset | Reconciled FinOps evidence |
| [Fundraising campaign manager](claws/fundraising-campaign-manager) | Operations | Guided setup, claims schema, artifact templates | Approval-bound campaign preparation |

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

Application examples may also contain package-root `BOOTSTRAP.md`, references,
schemas, templates, examples, fixtures, or assets declared as ordinary
`workspace.files`, and harness profiles such as `profiles/openclaw.yml`.
`BOOTSTRAP.md` guides the new agent through first-run questions and asks it to
create local preference files only when absent. Package updates reconcile
managed application content without owning or overwriting those local edits.

These packages intentionally follow the experimental prompt-body contract in
[openclaw/openclaw#113454](https://github.com/openclaw/openclaw/pull/113454): a
non-empty `CLAW.md` body is the portable agent prompt, and the same package does
not declare a competing `SOUL.md` workspace sidecar.

The generated packages are derived from [`catalog.json`](catalog.json), with
their reviewed Control UI captures stored under [`screenshots/`](screenshots/).
Edit those sources and run `npm run build`; do not hand-edit files under
`claws/`.

## Validate the catalog

Node.js 22.22.3 or later is required.

```bash
npm run build
npm run check
```

`npm run check` verifies generated output, package consistency, Experience-case
coverage, content quality, and basic secret hygiene. Maintainers can set
`CLAWS_CLI_ENTRY` and run
`npm run inspect` to inspect every package with a standalone Claws reference
CLI. With `CLAWS_CLI_ENTRY` and `OPENCLAW_CLI_ENTRY` set to compatible built
checkouts, `npm run proof:openclaw` dry-runs all 50 packages through the
OpenClaw adapter in disposable state.

`npm run proof:portfolio` runs each package in a separate OpenClaw home through
standalone and OpenClaw inspection, consent-bound add, a deterministic real
agent turn, status, update preview, doctor, export inspection, selective
removal, and final cleanup. The turn uses OpenClaw's OpenAI-compatible E2E
fixture and asserts that the package's domain request, identity, instructions,
tool surface, and expected handoff cross the actual agent runtime. This proves
runtime wiring, not subjective model quality; external, credentialed, billable,
and live-model behavior require explicit provider lanes. The command retains a
machine-readable record under `.tmp/proof/` and exits nonzero if any phase fails.
Set `PORTFOLIO_ONLY` to a comma-separated list of package ids for a focused
reproduction without changing the all-package default.

With `OPENCLAW_ROOT` pointing to a built OpenClaw checkout,
`npm run proof:experience` renders every X4/X5 asset through Playwright at
desktop and mobile sizes. It retains screenshots and fails on blank output,
horizontal overflow, unnamed controls, console errors, or insufficient visual
signal. Inline-widget and pinned-dashboard tool behavior remain separate native
Control UI contract proofs because presentation assets must not substitute for
the host's security and persistence semantics.

`npm run screenshots` starts OpenClaw's real Control UI, opens a deterministic
session for each Claw, and captures the same Chat, Canvas, and composer surfaces
an OpenClaw user sees. The command writes source images under `screenshots/`
and copies them into the generated packages. Set `SCREENSHOT_ONLY` to a
comma-separated list of package ids while iterating. These captures prove the
presentation path; `npm run proof:portfolio` remains the lifecycle and runtime
wiring proof.

When proof runs from a worktree whose Git metadata is not visible inside the
execution environment, set `AWESOME_CLAWS_REVISION`, `CLAWS_CLI_REVISION`, and
`OPENCLAW_REVISION` so result records retain exact commits.

See [CONTRIBUTING.md](CONTRIBUTING.md) to propose or improve a starter and
[SECURITY.md](SECURITY.md) to report a vulnerability.
