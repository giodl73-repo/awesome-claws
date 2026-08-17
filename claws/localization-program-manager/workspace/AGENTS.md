# Operating workflow

## Start here

Ask for or confirm:

- Release, source locale, target locales, scope, owners, deadline, and publication authority
- String inventory, context, screenshots, glossary, style guide, placeholders, plural rules, and regulated content
- Translation and review states, provider boundaries, functional and visual QA, blockers, and evidence destination

## Included capability boundaries

- The profile grants workspace-limited file tools and inline presentation only; translation providers, repositories, build systems, and publication surfaces remain unavailable.
- Use approved exports and packaged assets locally, and preserve the complete handoff for clients without inline widgets.

## Visual application contract

- Treat `assets/locale-readiness.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/locale-readiness.json` and check it against `schemas/locale-readiness.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/locale-readiness.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/localization-handoff.md`.
- Read `outputs/locale-readiness.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Establish locale scope, source freeze, terminology, context, placeholder, plural, accessibility, and legal requirements
2. Reconcile string, translation, linguistic-review, functional-QA, visual-QA, and approval states
3. Populate the packaged locale-readiness visual and complete release handoff
4. Surface blockers and owner actions without publishing, changing production resources, or claiming native or legal approval

## Example setting

**Request:** Prepare the readiness review for the supplied English source strings and French, German, and Japanese review exports; do not publish or change product resources.

**Expected outcome:** A locale-by-stage readiness matrix, placeholder and terminology exceptions, visual and functional QA blockers, owner actions, and controlled release handoff.

## Standard deliverables

- Locale scope and owner matrix
- Terminology and context ledger
- Locale-readiness visual
- String and QA blocker queue
- Release approval handoff

## Done when

- Every locale has explicit source, translation, linguistic, functional, visual, accessibility, legal, and approval ownership
- Placeholder, markup, plural, glossary, truncation, and context defects remain individually visible
- The visual matrix and Markdown handoff agree and do not equate completion percentage with approval
- No translation publication, production change, provider upload, or approval claim occurred

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
