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
[draft RFC 0016](https://github.com/openclaw/rfcs/pull/48): portable skills, direct MCP
requests, schedules, and ordinary workspace assets stay in `CLAW.md`; optional
seed-once onboarding lives in package-root `BOOTSTRAP.md`; native plugin bundles
and harness tuning live at conventional paths such as `profiles/openclaw.yml`.
Answers, credentials, and user-edited preferences remain local.

## Choose a starter

There are two useful reference points in the collection:

- **Golden application example:** [Travel concierge](claws/travel-concierge)
  shows the broad application shape: guided setup, user-owned preferences, a
  managed comparison template and schema, a least-privilege OpenClaw profile,
  a filtered Mapbox OAuth MCP connection, scheduled readiness refresh, and a
  real Expedia extension with explicit authentication and transaction
  boundaries.
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

The 86-Claw catalog now also has a practical personal-agent lane. Vehicle, home,
garden, pet, pond, appliance, care-circle, sports-team, stock-portfolio,
movie-and-streaming, subscription, music, gift-and-relationship,
personal-archive, restaurant-and-venue, local-events, school, games-backlog,
home-inventory, meal-and-grocery, insurance-policy, tax-document,
purchase-research, household-budget, life-timeline, child-activity, neighborhood-operations, wardrobe, and document-renewal starters cover everyday bounded
workflows with explicit owner authority. Household Steward, Work Chief of
Staff, and Care Circle Coordinator show the manager-Claw pattern: they
coordinate specialist-Claw artifacts, conflicts, and accountable decisions
without taking over the people or functions that own the work.

Use the generated [catalog chooser](CHOOSER.md) to compare every starter by
maintenance state, accountable maintainer, setup burden, external dependencies,
Experience proof tier, category, and boundary-attention level. The same derived data is available as
[`catalog-chooser.json`](catalog-chooser.json) for tools and other catalogs.
For interactive search and shareable filters across proof lanes, capabilities,
authority attention, ownership, and review freshness, open the generated
[catalog explorer](https://giodl73-repo.github.io/awesome-claws/). Its
self-contained source is committed as
[`catalog-explorer.html`](catalog-explorer.html) and published from `main`.

All current Claws are actively maintained by
[@giodl73-repo](https://github.com/giodl73-repo). Catalog maintenance metadata
supports additional maintainers and eventual ownership transfer without changing
the portable package contract.

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

Every starter also has one deterministic contract in
[`regression-cases.json`](regression-cases.json). The shared reference evaluator
executes accepted, missing-evidence, and unapproved-authority vectors against
each Claw's exact request, intake, and boundary contract. The registry also pins
its complete Experience surface and a digest of all declared capability-bearing
configuration. Run `npm run test:regression` for this fast catalog-wide check.
It validates deterministic package contracts and materialized instructions; it
does not execute or grade an LLM, replace installed lifecycle proof, or claim
live-provider behavior.

The table below highlights the main reviewed application shapes. Use the
chooser or explorer for the complete 86-Claw catalog.

| Claw | Category | Capabilities | Focus |
| --- | --- | --- | --- |
| [Incident response](claws/incident-response) | Engineering | Daily isolated cron, incident schema, bounded profile, inline visual | Evidence-led incident coordination |
| [Software maintainer](claws/software-maintainer) | Engineering | Bounded repository tools, Diffs extension, two-tool GitHub MCP, application resources | Repository change delivery |
| [Security analyst](claws/security-analyst) | Engineering | Threat schema, bounded profile, inline visual | Bounded security assessment |
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
| [Compliance reviewer](claws/compliance-reviewer) | Governance | Control schema, evidence matrix, bounded profile, inline visual | Traceable control review |
| [Data governance steward](claws/data-governance-steward) | Governance | Governance schema, bounded profile, inline visual | Evidence-backed data-product stewardship |
| [Knowledge curator](claws/knowledge-curator) | Productivity | Base | Durable knowledge organization |
| [Executive briefing](claws/executive-briefing) | Productivity | Gog + Weather skills, weekday cron | Private daily operating brief |
| [Meeting intelligence](claws/meeting-intelligence) | Productivity | Whisper + DOCX skills | Consented meeting records |
| [Spreadsheet analyst](claws/spreadsheet-analyst) | Analysis | XLSX skill | Auditable workbook transformation |
| [Knowledge gardener](claws/knowledge-gardener) | Productivity | Notion skill | Scoped knowledge-space maintenance |
| [Research monitor](claws/research-monitor) | Analysis | Parallel plugin, weekday cron | Source-linked evidence watch |
| [Presentation producer](claws/presentation-producer) | Productivity | PowerPoint skill | Reviewable presentation delivery |
| [Document intake analyst](claws/document-intake-analyst) | Analysis | Markdown Converter skill | Traceable document normalization |
| [Media evidence reviewer](claws/media-evidence-reviewer) | Analysis | Video Frames + Whisper skills | Timestamped audiovisual review |
| [Release coordinator](claws/release-coordinator) | Engineering | GitHub + Slack skills, readiness schema, inline visual | Approval-bound release coordination |
| [Feed intelligence monitor](claws/feed-intelligence-monitor) | Analysis | Blogwatcher skill, weekday cron | Curated source-feed deltas |
| [Travel planner](claws/travel-planner) | Productivity | Open-Meteo + Travel Checklist skills | Public-source trip planning |
| [Travel concierge](claws/travel-concierge) (Golden example) | Productivity | Guided setup, Expedia extension, filtered Mapbox OAuth MCP, daily readiness cron, schema, visual asset, dashboard profile | Live travel search and traveler-controlled booking handoff |
| [Web evidence researcher](claws/web-evidence-researcher) | Analysis | Tavily plugin, minimal tool profile | Bounded search and source extraction |
| [Website evidence collector](claws/website-evidence-collector) | Analysis | Firecrawl plugin, minimal tool profile | Allowlisted public website collection |
| [Video concept producer](claws/video-concept-producer) | Productivity | PixVerse provider, minimal tool profile | Private review-first video generation |
| [Workflow operator](claws/workflow-operator) | Operations | Lobster plugin, minimal tool profile | Typed approval-aware workflow execution |
| [Public company watcher](claws/public-company-watcher) | Analysis | Blogwatcher skill, weekday cron | SEC-grounded company changes |
| [Research scout](claws/research-scout) | Analysis | Blogwatcher skill, weekday cron | Public research evidence deltas |
| [Public safety monitor](claws/public-safety-monitor) | Operations | Open-Meteo + Blogwatcher skills, recurring cron | Official alert synthesis |
| [Civic data analyst](claws/civic-data-analyst) | Analysis | Public transit skill | Reproducible civic evidence |
| [Event operations director](claws/event-operations-director) | Operations | Guided setup, visual assets, dashboard profile | Run-of-show and event readiness |
| [API integration engineer](claws/api-integration-engineer) | Engineering | Bounded repository and presentation tools, contract fixtures, visual asset | Contract-led API integration |
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
| [Change control operator](claws/change-control-operator) | Engineering | Bounded workspace patch and execution tools, digest-bound schema | Approval-bound local change execution |
| [Case continuity coordinator](claws/case-continuity-coordinator) | Operations | Workspace-only checkpoint ledger | Resumable evidence-fresh case handoff |
| [Delegation coordinator](claws/delegation-coordinator) | Productivity | Bounded worker-session tools, provenance schema | Accountable multi-agent coordination |

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

The generated packages are derived from catalog metadata in
[`catalog.json`](catalog.json) and readable per-Claw resource bodies under
[`sources/`](sources/), with reviewed Control UI captures stored under
[`screenshots/`](screenshots/). Edit those sources and run `npm run build`; do
not hand-edit files under `claws/`.

## Validate the catalog

Node.js 22.22.3 or later is required.

```bash
npm run build
npm run check
```

For one Claw or a name/id filter, use the contributor workflow:

```bash
npm run prepare:claw -- data-analyst
npm run test:claw -- analyst
npm run test:claw -- data-analyst --visual
npm run test:claw -- software-maintainer --installed --live
```

`prepare:claw` regenerates the catalog, runs the complete repository check, and
prints the selected Claw's proof plan. `test:claw` always checks materialization
and deterministic regression, then runs only explicitly requested expensive
lanes. `--installed` requires compatible `CLAWS_CLI_ENTRY` and
`OPENCLAW_CLI_ENTRY` builds. `--visual` renders applicable X4/X5 assets.
`--live` anonymously checks declared dependency registries and MCP endpoints; it
is not provider-live model evidence. Each run retains aggregate and per-Claw
summaries and logs under `.tmp/claw-runs/`.

### Optional semantic evaluation pilot

The Customer Support Claw has one deliberately bounded model-judged pilot with
three synthetic variants: missing context, unsafe credential handling, and
pressure to make an unauthorized commitment. It is not part of `npm run check`,
does not grade the complete catalog, and never replaces deterministic regression
or maintainer review.

Run it only against an explicitly selected OpenAI-compatible endpoint, with
different subject and judge model ids:

```bash
export CLAW_EVAL_BASE_URL=https://provider.example/v1
export CLAW_EVAL_API_KEY=...
export CLAW_EVAL_SUBJECT_MODEL=subject-model
export CLAW_EVAL_JUDGE_MODEL=independent-judge-model
npm run eval:pilot
```

The command sends only checked-in synthetic prompts and public Claw
instructions. It requires HTTPS outside localhost, never writes the API key, and
retains per-case responses, structured scores, exact model ids, the endpoint
origin/path, and a digest of the deterministic source contract under
`.tmp/semantic-eval/`. A passing score is opt-in model evidence, not a
provider-live capability or safety guarantee. One run makes exactly six
completion requests, capped at 1,200 output tokens for each subject response and
700 for each judge response; actual cost still depends on the selected provider
and models. Subject/judge independence is enforced at the model-id level. For
stronger separation, select a provider whose ids represent distinct model
families or inference stacks.

`npm run check` verifies generated output, package consistency, Experience and
regression coverage, content quality, and basic secret hygiene. Maintainers can set
`CLAWS_CLI_ENTRY` and run
`npm run inspect` to inspect every package with a standalone Claws reference
CLI. With `CLAWS_CLI_ENTRY` and `OPENCLAW_CLI_ENTRY` set to compatible built
checkouts, `npm run proof:openclaw` dry-runs all 86 packages through the
OpenClaw adapter in disposable state.

### Catalog invariants

- `catalog.json` owns catalog metadata and resource declarations.
  `sources/<claw-id>/` owns the declared resource bodies in their native file
  formats. `npm run build` materializes both, and `npm run check` requires
  byte-for-byte agreement with all 86 generated packages and rejects missing
  or undeclared source files.
- Harness profiles use the conventional `profiles/openclaw.yml` path, strict
  schema version 1, exact pinned extension releases, and unique extension ids
  and package refs.
- Tool policy follows OpenClaw consent semantics. `alsoAllow` is optional and
  additive only when a bounded profile is selected. `allow` and `alsoAllow`
  cannot be combined. `full` requires a bounded `allow`; profiles containing
  Bundle MCP authority, currently `coding` and `messaging`, also require an
  explicit allowlist of core tools and exact `server__tool` MCP names.
- Ordinary manifest metadata is string-to-string data. The retired
  `metadata.openclaw.config` pointer is not accepted; profiles are discovered
  conventionally. Retired heartbeat keys such as `skipWhenBusy` are rejected.
- Workspace sources, package paths, package versions, MCP declarations, cron
  jobs, bootstrap instructions, and generated output remain bounded and
  portable across case-insensitive filesystems.

### What each proof establishes

- `npm run check` is static and generated-output proof. It does not apply a
  Claw or contact a provider.
- `npm run proof:openclaw` is standalone inspection plus OpenClaw dry-run proof.
  It does not mutate state or prove provider behavior.
- `npm run proof:portfolio` first checks deterministic materialization, then
  exercises inspect, consent-bound add, status, export inspection, and removal
  for all 86 packages in isolated local state. Executive Assistant additionally
  proves a real managed-resource update from a checked-in previous-version fixture,
  stale-consent rejection, reverse rollback, and repeat upgrade while preserving user-owned state. Its
  agent turn uses the checked-in OpenAI-compatible fixture, so it proves runtime
  wiring rather than a live provider.
- `npm run proof:capabilities` derives the catalog's skill, plugin package,
  profile extension, OAuth MCP, cron, bootstrap, visual, workspace-execution,
  and delegated-session classes, then runs
  one installed representative for every class. It requires clean, exact Awesome
  Claws, standalone CLI, and OpenClaw revisions and writes an aggregate record
  under `.tmp/capability-proof/`. The required Control UI workflow runs this
  matrix on every pull request.
- `npm run proof:dependencies` anonymously verifies every unique exact-pinned
  ClawHub skill, plugin package, and profile extension, plus each declared OAuth
  MCP endpoint. Skills must retain their publisher, version, verification
  fingerprints, exact skill card, security decision, and downloadable archive.
  Plugins must retain their family, version, runtime identity where declared,
  clean verification metadata, and byte-for-byte npm artifact digests. OAuth
  MCP endpoints must reject anonymous initialization with a Bearer challenge
  whose protected-resource metadata names the exact declared endpoint. The
  scheduled and manually dispatchable Dependency Health workflow writes
  machine-readable evidence under `.tmp/dependency-health/`; live registry and
  third-party checks intentionally do not run in pull-request CI.
- `npm run proof:compatibility` runs every Claw's complete deterministic
  lifecycle against the selected OpenClaw checkout, preserves per-Claw results
  and logs under `.tmp/compatibility-canary/`, and fails closed on missing
  coverage. The scheduled Compatibility Canary tracks moving `openclaw/main`;
  required pull-request proof remains pinned. Two consecutive scheduled failures
  open or update one drift issue instead of silently changing catalog packages.
- With `PORTFOLIO_ONLY=data-analyst` and `PORTFOLIO_VISUAL_RUNTIME=1`,
  portfolio proof runs the representative visual contract through an
  inline-widget-capable Gateway client and a scripted OpenAI-compatible fixture
  that requires workspace JSON/HTML/Markdown writes followed by an executed
  `show_widget` call.
- `npm run proof:golden` additionally proves exact Golden artifact bytes through
  a disposable local registry. It is not public publication or provider-live
  evidence.
- `npm run proof:experience` and `npm run screenshots` prove rendering and host
  presentation paths, not provider correctness or model quality.
- `npm run validate:artifact -- <claw-id> <artifact.json>` runs JSON Schema
  validation and the registered semantic reference checks for structured
  artifact Claws.

No command in this repository is provider-live evidence by itself. A live claim
requires an explicit credentialed provider lane, exact revisions, retained
results, and a statement of the provider behavior actually exercised.

`npm run proof:portfolio` runs each package in a separate OpenClaw home through
standalone and OpenClaw inspection, consent-bound add, a deterministic local
agent turn through the OpenAI-compatible fixture, status, update preview and
apply, doctor, standalone and OpenClaw export inspection, selective removal,
and final cleanup. Executive Assistant starts from the checked-in representative
`0.0.1` fixture and proves the exact add/change/remove delta to catalog version
`0.1.0`, failed plan integrity before mutation, reverse rollback, and a repeat
upgrade. The fixture is purpose-built proof input, not a reconstructed published
release.
Other packages retain the no-op update contract. For bootstrap-bearing examples
the proof also creates synthetic user-owned preferences and proves update,
rollback, repeat update, and removal preserve them; bootstrap interview quality
remains a separate model-behavior lane. The turn uses OpenClaw's OpenAI-compatible E2E
fixture and asserts that the package's domain request, identity, instructions,
tool surface, and expected handoff cross the actual agent runtime. This proves
runtime wiring, not subjective model quality; external, credentialed, billable,
and live-model behavior require explicit provider lanes. The command retains a
machine-readable record under `.tmp/proof/` and exits nonzero if any phase fails.
Set `PORTFOLIO_ONLY` to a comma-separated list of package ids for a focused
reproduction without changing the all-package default.

`npm run proof:golden` proves the Golden Travel Concierge across repository
boundaries. Point `OPENCLAW_CLI_ENTRY` and `CLAWHUB_CLI_ENTRY` at the exact
implementation checkouts under review. The command validates and previews the
checked-out Golden source, builds it twice with OpenClaw, requires byte-identical
artifacts, and publishes and downloads those exact bytes through an
authenticated disposable local registry using the real ClawHub client. It then
uses structured tar parsing, verifies every packaged byte against this checkout,
and runs the verified package through the complete portfolio lifecycle. It
requires the same `CLAWS_CLI_ENTRY` setting as `proof:portfolio`; it never
publishes to the public registry or exercises live provider credentials.

`npm run proof:experience` uses the repository's pinned Playwright and Sharp
dependencies to render every X4/X5 asset at desktop and mobile sizes. It
retains screenshots and fails on blank output, horizontal overflow, unnamed
controls, console errors, or insufficient visual signal. The same proof is a
required Linux CI job. Inline-widget and pinned-dashboard tool behavior remain
separate native Control UI contract proofs because presentation assets must not
substitute for the host's security and persistence semantics.

`npm run screenshots` starts OpenClaw's real Control UI, opens a deterministic
injected session for each Claw, and captures the same Chat, Canvas, and composer
surfaces an OpenClaw user sees. The command writes source images under
`screenshots/` and copies them into the generated packages. Set
`SCREENSHOT_ONLY` to a comma-separated list of package ids while iterating.
These captures prove the presentation path, not agent invocation. The scheduled
and manually dispatchable `Control UI Proof` workflow pairs a representative
capture with the installed visual-runtime lane and retains the exact OpenClaw
revision it exercised.

When proof runs from a worktree whose Git metadata is not visible inside the
execution environment, set `AWESOME_CLAWS_REVISION`, `CLAWS_CLI_REVISION`, and
`OPENCLAW_REVISION` so result records retain exact commits.

See [CONTRIBUTING.md](CONTRIBUTING.md) to propose or improve a starter and
[SECURITY.md](SECURITY.md) to report a vulnerability.

New starters are admitted by operating-contract distinction, not sequence
number or profession count. The
[contribution admission rubric](docs/contribution-admission.md), proposal
scaffolder, similarity report, and required post-policy contribution record
make that decision reviewable.
