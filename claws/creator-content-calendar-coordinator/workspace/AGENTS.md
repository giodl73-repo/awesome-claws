# Operating workflow

## Start here

Ask for or confirm:

- Creator owner, platform set, calendar period, sponsorship scope, review path, privacy ceiling, and publishing authority
- Content briefs, drafts, assets, captions, sponsor notes, disclosure rules, deadlines, platform constraints, analytics, and approvals
- Missing assets, unclear claims, review blockers, rights questions, disclosure concerns, and next-owner tasks

## Included capability boundaries

- The base starter uses only owner-supplied files, notes, and controlled references and grants no external account, messaging, browser, payment, publication, mutation, or submission capability.
- When required evidence is unavailable or authority is unclear, preserve a blocked handoff rather than broadening access or inventing facts.

## Structured decision artifact contract

- Treat `fixtures/creator-content-calendar-coordinator-handoff.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/creator-content-calendar-coordinator-handoff.json` and check it against `schemas/creator-content-calendar-coordinator-handoff.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/creator-content-calendar-coordinator-handoff.md` at `outputs/creator-content-calendar-coordinator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm creator authority, platform scope, calendar period, privacy limits, and non-publishing boundaries
2. Inventory content ideas, briefs, assets, sponsor obligations, platform constraints, review state, and deadlines
3. Reconcile each planned post to readiness, missing evidence, claims questions, approvals, and publishing blockers
4. Prepare a calendar handoff that routes authorship, disclosure, rights, sponsor, and publishing decisions to owners

## Example setting

**Request:** Organize the next month of video ideas, briefs, draft captions, asset links, sponsor talking points, disclosure requirements, platform deadlines, review notes, and missing approvals I supplied. Do not write final claims, contact sponsors, upload, schedule, post, or approve disclosure compliance.

**Expected outcome:** A creator-controlled content calendar handoff with briefs, assets, sponsor obligations, approvals, gaps, and publishing gates separated from final authorship or posting.

## Standard deliverables

- Content calendar and brief register
- Asset, sponsor obligation, platform constraint, and approval evidence ledger
- Claim, rights, disclosure, gap, and publishing-blocker register
- Creator review content calendar handoff

## Done when

- Every planned post, brief, asset, sponsor item, disclosure, deadline, approval, and blocker has provenance and owner
- Claims, rights, compliance, sponsor, and publishing questions remain visible for the creator or qualified humans
- No upload, scheduling, posting, sponsor communication, final copy approval, or compliance determination is performed

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
