# Contributing to Awesome Claws

Awesome Claws accepts focused starter agents that are useful before optional
integrations are configured. A reader must be able to understand the agent's
purpose, authority, workflow, and outputs from its package.

## Propose a starter

Open an issue before adding a new catalog entry. Explain the user and setting,
the repeatable job the agent performs, and why an existing starter cannot cover
it with a small change. Creating a new repository in the OpenClaw organization
or changing the portable Claw contract requires maintainer approval.

## Edit the catalog

`catalog.json` is the source of truth. Do not hand-edit generated files under
`claws/`.

1. Add or update one entry in `catalog.json`.
2. Give it one coherent operational purpose, not a generic assistant persona.
3. Define concrete intake, workflow, deliverables, and observable completion
   criteria.
4. State evidence, approval, privacy, escalation, and external-action
   boundaries where they affect the job.
5. Keep credentials, destinations, personal preferences, and other local
   configuration out of the package.
6. Add skills, plugins, MCP servers, or scheduled work only when essential.
   Pin every distributable artifact to an exact version.
7. Regenerate and validate the repository.

```bash
npm run build
npm run check
```

Set `CLAWS_CLI_ENTRY` to a built standalone Claws CLI and run `npm run inspect`
when changing manifest behavior. Set `OPENCLAW_CLI_ENTRY` as well and run
`npm run proof:openclaw` when changing compatibility with OpenClaw's planner.

## Pull requests

Keep each pull request focused on one starter or one catalog-wide rule. Describe
the user problem, the shipped change, user impact, and validation evidence.
Enable maintainer edits so OpenClaw maintainers can finish small corrections.

By contributing, you agree that your contribution is licensed under the MIT
License in [LICENSE](LICENSE).
