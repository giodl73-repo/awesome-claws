# Claw contribution admission

Awesome Claws is a curated application catalog, not a directory of prompts.
Admission asks whether a proposal adds a reusable operating contract that is
meaningfully absent from the catalog.

## Maintainer decision

| Decision | Use when |
| --- | --- |
| **New Claw** | The proposal has a distinct repeatable job and materially different workflow, output contract, evidence model, or authority boundary. |
| **Improve an existing Claw** | The same job would become better through another template, schema, example, integration, or boundary clarification. |
| **Variant, not catalog material** | The difference is primarily industry vocabulary, audience naming, personality, branding, or presentation. |
| **Needs product decision** | The distinction depends on catalog direction, a new capability class, or a new OpenClaw contract. |

Similarity is evidence, not the verdict. Maintainers should be able to complete
this sentence:

> Unlike `<nearest existing Claw>`, this Claw repeatedly **does `<job>`** for
> `<user>` by **using `<workflow/evidence>`** to produce **`<outputs>`**, while
> retaining **`<authority boundary>`**.

If the sentence differs only in nouns or setting, improve the existing Claw.

## Required contribution record

Every post-policy Claw keeps `contributions/<claw-id>.json`. It records:

- the user problem and repeatable job;
- at least three existing alternatives with honest overlap and difference;
- the intended proof;
- accountable GitHub maintainers and current maintenance state;
- the complete proposed catalog entry.

`npm run review:contribution -- --proposal <file>` produces the nearest current
matches. `npm run check` requires the record to discuss at least two of the five
nearest matches. This catches obvious omissions without pretending a lexical
score can make the product decision.

## Contribution tiers

| Tier | Shape | Minimum proof |
| --- | --- | --- |
| **X3 artifact** | Durable Markdown handoff; no external dependency required | Generated package, session fixture, current Control UI screenshot, `npm run check` |
| **X4 visual** | X3 plus a current inline visual and Markdown fallback | X3 proof plus `npm run proof:experience` |
| **X5 dashboard** | X4 plus accepted persistent widgets | X4 proof plus stable widget names and dashboard behavior |
| **Capability-bearing** | Skill, plugin, extension, MCP, cron, bootstrap, workspace execution, or delegated sessions | Matching tier proof plus exact dependency/provenance data and the applicable installed capability proof |

Start with X3 unless the job genuinely requires richer presentation. A higher
tier does not make a weak or duplicate job distinct.

Every tier also requires one entry in `regression-cases.json`. The deterministic
reference evaluator executes accepted, missing-evidence, and unapproved-authority
vectors against the exact request, intake, and boundary contract for every Claw.
It also pins the complete Experience surface and a digest of capability-bearing
configuration. This is package-contract regression proof, not an LLM evaluation
or a replacement for Experience, installed lifecycle, visual, or live-provider
proof.

## Stable identity

Claw ids are lowercase descriptive slugs such as `change-control-operator`.
They are never sequence numbers. Catalog order, total count, and Experience
tier are derived metadata and may change without changing identity.

## ClawSweeper role

ClawSweeper may:

- surface related issues and pull requests;
- run the repository similarity report;
- summarize the nearest catalog alternatives;
- identify missing contribution records, generated drift, proof, or boundaries;
- recommend **new Claw**, **improve existing**, **variant**, or **needs product
  decision**.

ClawSweeper must not auto-close, auto-fix, or auto-merge a new-Claw proposal
from similarity alone. Patrick and Gio retain the catalog admission decision.
