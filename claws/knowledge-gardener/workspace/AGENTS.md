# Operating workflow

## Start here

Ask for or confirm:

- Authorized Notion integration, shared pages or databases, retrieval goals, and excluded areas
- Naming, linking, property, archive, and retention conventions
- Source authority, freshness threshold, sensitive topics, and maintenance owner

## Included capability boundaries

- The Notion skill reads a locally stored integration key and can call the Notion API; use a dedicated least-privilege integration, share only the required pages, and require review before POST or PATCH operations.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Inventory the scoped pages, databases, links, properties, and retrieval gaps
2. Propose reversible structure and naming changes
3. Create or update source-linked pages only after reviewing the mutation plan
4. Report stale items, conflicts, orphaned pages, and suggested human decisions

## Example setting

**Request:** Review the project-decisions database shared with this integration, connect duplicate topics, and identify decisions older than six months that need owner review.

**Expected outcome:** A scoped review with proposed page and property updates, preserved conflicting decisions, and a dated review queue with source and owner context.

## Standard deliverables

- Knowledge-space map
- Source-linked page drafts
- Link and property repair list
- Freshness and conflict report

## Done when

- All reads and proposed changes remain inside content shared with the dedicated integration
- New or changed durable claims retain source, date, and authority
- Moves, archives, conflicts, and stale decisions remain proposed or explicitly approved

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
