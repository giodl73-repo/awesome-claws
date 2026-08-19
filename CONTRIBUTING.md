# Contributing to Awesome Claws

Awesome Claws accepts focused starter agents that are useful before optional
integrations are configured. A reader must be able to understand the agent's
purpose, authority, workflow, and outputs from its package.

## Propose a starter

Before opening the issue, copy `contributor/new-claw.example.json` outside the
repository and replace the proposed entry, problem, repeatable job, and proof
plan. You may leave `existingAlternatives` empty for this discovery pass:

```bash
npm run review:contribution -- --proposal ../my-claw.json
```

Use the reported nearest matches to complete the proposal template, then open
the issue before adding a catalog entry. Explain the user and setting, the
repeatable job the agent performs, and why an existing starter cannot cover it
with a small change. Creating a new repository in the OpenClaw organization or
changing the portable Claw contract requires maintainer approval.

Read the [admission rubric](docs/contribution-admission.md) first. New Claws
need a distinct operating contract, not only a new audience, profession,
industry vocabulary, persona, or visual theme. Claw ids are stable descriptive
slugs and are never sequence numbers.

Use the proposal template to compare at least three existing Claws. Maintainers
will choose one of four outcomes: add a new Claw, improve an existing Claw,
treat the proposal as a variant outside this curated catalog, or request a
product decision.

## Scaffold a new Claw

After maintainers accept the proposal, update `existingAlternatives` in your
proposal JSON to discuss the reported nearest matches. At least two comparisons
must be among the current five nearest matches. Then scaffold and build:

```bash
npm run create:claw -- --proposal ../my-claw.json
npm run build
```

The scaffolder creates an X3 artifact starter, its source resources, Experience
entry, deterministic regression contract, and durable contribution record. It
temporarily copies the Executive Assistant screenshot so the package can
materialize. That duplicate intentionally fails `npm run check` until replaced
by current Control UI proof:

```bash
git clone https://github.com/openclaw/openclaw.git /path/to/openclaw
OPENCLAW_ROOT=/path/to/openclaw \
SCREENSHOT_ONLY=my-claw \
npm run screenshots
npm run check
```

The reference evaluator exercises the accepted catalog example, one
missing-evidence case, and one unapproved-authority case. The contract also pins
the complete Experience surface and all capability-bearing configuration.

Do not add a new id to `contribution-policy.json`. That list freezes the
pre-policy catalog; all later Claws require a reviewable contribution record.

## Edit the catalog

`catalog.json` is the metadata source of truth, while declared resource bodies
live under `sources/<claw-id>/` in their native formats. Do not hand-edit
generated files under `claws/`.

1. Update the entry and source files created by `npm run create:claw`. For
   changes to an existing Claw, update its entry in `catalog.json` and declared
   files under `sources/<claw-id>/`.
2. Give it one coherent operational purpose, not a generic assistant persona.
3. Define concrete intake, workflow, deliverables, and observable completion
   criteria.
4. State evidence, approval, privacy, escalation, and external-action
   boundaries where they affect the job.
5. For reusable onboarding, add plain package-root `BOOTSTRAP.md` instructions
   through the catalog `bootstrap` field. Ask only for missing context, create
   local preference files only when absent, and never package answers or secrets.
6. Keep portable Agent Skills and direct MCP requests in `CLAW.md`. Put native
   plugin bundles in the matching harness profile, with exact versions.
7. Add schemas, references, templates, examples, fixtures, or assets as
   ordinary declared workspace files, with their bodies under the matching
   per-Claw source directory. Keep executable behavior in reviewed skills or
   harness extensions.
8. Regenerate and validate the repository.

Keep `regression-cases.json` aligned when an existing Claw changes its intake,
boundaries, Experience surface, or capabilities. After reviewing the behavior
change, regenerate the exact snapshot with:

```bash
npm run test:regression -- --update
```

Review the resulting diff; do not update a contract merely to hide drift.

Start at X3 unless the repeatable job needs a visual or persistent dashboard.
See the admission guide for X3/X4/X5 and capability-specific proof.

OpenClaw profile declarations must preserve consent-bounded authority:

- use `alsoAllow` only to add bounded tools to a selected profile;
- use `allow` to freeze the exact surface, never together with `alsoAllow`;
- give `full`, `coding`, and `messaging` Claw profiles the explicit bounded
  allowlist required by OpenClaw, using exact `server__tool` names for MCP;
- keep native extensions unique and exactly versioned; and
- use conventional `profiles/openclaw.yml`, not retired
  `metadata.openclaw.config` or retired heartbeat keys.

```bash
npm run build
npm run check
```

Set `CLAWS_CLI_ENTRY` to a built standalone Claws CLI and run `npm run inspect`
when changing manifest behavior. Set `OPENCLAW_CLI_ENTRY` as well and run
`npm run proof:openclaw` when changing compatibility with OpenClaw's planner.
Static checks, dry runs, local registries, and deterministic provider fixtures
must be described as such; they are not live-provider evidence.

## Pull requests

Keep each pull request focused on one starter or one catalog-wide rule. Describe
the user problem, the shipped change, user impact, and validation evidence.
Enable maintainer edits so OpenClaw maintainers can finish small corrections.
For a new Claw, link the accepted proposal, include
`contributions/<claw-id>.json`, paste the current similarity report, and explain
the distinction from its nearest matches in operational—not branding—terms.

ClawSweeper can provide related-item discovery and an advisory exact-head
review when configured. Its similarity result does not replace Patrick and
Gio's catalog admission decision; see
[ClawSweeper contribution review](docs/clawsweeper-contributions.md).

By contributing, you agree that your contribution is licensed under the MIT
License in [LICENSE](LICENSE).
