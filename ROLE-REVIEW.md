# Starter Claw Role Review

Baseline target: signed catalog commit `6e206f321658`. The remediated target is
the commit containing this review, covering all 15 private starter Claws before
public incubation.

## Lenses

The review applies six `.craft/roles/claws` perspectives from distinct tension
clusters:

- **Founder:** a Claw should remain understandable as ordinary Markdown and
  should feel useful without ecosystem lock-in.
- **New hire:** the first useful interaction should be obvious without reading
  separate documentation.
- **Power user:** the starter should replace setup work with a repeatable
  operating workflow and concrete outputs.
- **Skill author:** generated packages should be readable, editable, and free
  of invented integration dependencies.
- **CISO/compliance:** sensitive domains need explicit authority, privacy,
  evidence, and escalation boundaries.
- **Lorant reviewer/repo steward:** the catalog needs one source of truth,
  exact generated output, and validation that catches partial or stale entries.

## Rubric

Each starter is assessed on a five-point scale:

| Dimension | Review question |
| --- | --- |
| Clarity | Can a reader explain the agent's purpose and boundary in one sentence? |
| Usefulness | Does it define a repeatable job with concrete outputs? |
| Specificity | Is it meaningfully different from a generic assistant prompt? |
| Safety | Are authority, privacy, escalation, and irreversible actions bounded? |
| First use | Does it show what to provide and a realistic example setting? |

## Baseline Assessment

| Starter | Clarity | Usefulness | Specificity | Safety | First use | Main gap |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Incident response | 5 | 4 | 4 | 5 | 1 | No concrete incident intake or completion gate |
| Software maintainer | 5 | 4 | 4 | 4 | 1 | No example change request or definition of done |
| Security analyst | 5 | 4 | 4 | 5 | 1 | No authorization or evidence-handling intake |
| Data analyst | 4 | 3 | 3 | 4 | 1 | Could describe almost any analysis assistant |
| Research briefing | 5 | 4 | 4 | 4 | 1 | No example decision or source threshold |
| Financial analyst | 4 | 3 | 3 | 4 | 1 | Missing audience, inputs, and decision boundary |
| Customer support | 5 | 4 | 4 | 5 | 1 | No realistic case setup or closure criteria |
| Sales operations | 4 | 3 | 3 | 4 | 1 | Generic without pipeline definitions and example |
| Recruiting coordinator | 4 | 3 | 3 | 5 | 1 | Missing concrete scheduling scenario and authority |
| Content operations | 4 | 3 | 3 | 5 | 1 | Missing campaign example and publication gate |
| Executive assistant | 5 | 4 | 4 | 5 | 1 | Missing onboarding context and sample executive job |
| Project manager | 4 | 3 | 3 | 4 | 1 | Too close to a generic project checklist |
| Product manager | 4 | 3 | 3 | 4 | 1 | Missing concrete product decision example |
| Compliance reviewer | 5 | 4 | 4 | 5 | 1 | Missing framework/evidence intake and review limit |
| Knowledge curator | 4 | 3 | 3 | 4 | 1 | Missing collection example and durable quality bar |

## Cross-Catalog Findings

1. **First-use experience is the blocking quality gap.** Every starter begins
   with principles and workflow, but none tells the user what information to
   provide first or shows a representative request.
2. **Completion is underspecified.** Deliverable names are useful, but the
   agent has no domain-specific test for when the work is ready to hand off.
3. **Safety is too template-shaped.** Shared boundaries are sound, but finance,
   security, recruiting, compliance, publication, and executive work need
   tailored authority and data-handling limits.
4. **Several middle entries are insufficiently differentiated.** Data, sales,
   project, product, and knowledge roles need more concrete operating context
   to avoid reading as generic professional personas.
5. **The package shape is strong.** Plain `SOUL.md` and `AGENTS.md`, no invented
   dependencies, exact generation, reference inspection, and removable local
   files satisfy the founder, skill-author, and repository-boundary lenses.

## Acceptance Bar

Before presenting these as launch-quality starters, every entry must include:

- a named target user or setting;
- three domain-specific intake questions;
- a realistic example request and expected outcome;
- at least two domain-specific boundaries;
- three observable completion conditions;
- the existing principles, workflow, and deliverables;
- clean generated-tree and standalone reference validation.

## Remediation Applied

The catalog now encodes the full acceptance bar for every starter. Generated
`SOUL.md` files name the target setting and domain-specific boundaries;
`AGENTS.md` files provide focused intake, a four-step process, a realistic
request and expected outcome, deliverables, and completion criteria. First-turn
guidance uses context already supplied and asks only for information that blocks
safe or useful progress.

This raises the collection from role descriptions to runnable starter operating
contracts while preserving the strongest baseline properties: plain Markdown,
no fabricated dependencies, no hidden actions, and exact generated output.

## Independent Re-Review

An independent read-only pass applied the founder, new-hire, power-user,
skill-author, CISO, compliance, repository-steward, and maintainer-reviewer
lenses to all 30 generated instruction files.

The first pass found six issues, all addressed:

- sensitive-data persistence now requires necessity, verified authority,
  approved destination, minimization, and controlled references;
- incident actions require recorded approval of the exact action, target,
  timing, verification, and rollback plan;
- compliance evidence carries origin, collection time, custodian, and material
  version or integrity identifiers;
- seven ecosystem-specific examples were replaced with broadly recognizable
  settings;
- data, finance, and content starters now require their missing reproducibility
  artifacts;
- recruiting accommodations explicitly exclude diagnosis and remain separate
  from interviewer feedback.

The second pass found no product-quality blocker. Validation now enforces the
exact 15 reviewed identities plus the documented intake, boundary, workflow,
deliverable, and completion-criteria minimums.
