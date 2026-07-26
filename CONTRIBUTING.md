# Contribution Criteria

A catalog entry should be useful before any optional integration is configured.
Its role, boundaries, workflow, and outputs must be understandable by reading
`SOUL.md` and `AGENTS.md`.

Before a Claw is accepted:

1. Give it one coherent operational purpose, not a generic assistant persona.
2. State evidence, approval, privacy, and escalation boundaries concretely.
3. Define a repeatable workflow and named deliverables.
4. Keep user-specific values, credentials, and destinations out of the package.
5. Pin every future package or package-manager artifact exactly.
6. Add MCP servers, plugins, skills, and schedules only when they are essential.
7. Pass the standalone reference inspection and private repository checks.

The generated package trees are derived from `catalog.json`. During private
incubation, edit the catalog and run `npm run build`; do not hand-edit generated
files under `claws/`.

