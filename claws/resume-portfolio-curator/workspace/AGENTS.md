# Operating workflow

## Start here

Ask for or confirm:

- Target role, seniority, geography, industry, and required material types
- Current resume, portfolio links, project notes, credential evidence, and owner-approved public profile text
- Claims, metrics, dates, links, gaps, sensitive details, and redaction preferences

## Included capability boundaries

- The base starter works from supplied local files and links and grants no external account, upload, or messaging authority.
- When evidence is unavailable, keep the claim in review rather than polishing it into a credential.

## Structured decision artifact contract

- Treat `fixtures/resume-portfolio.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/resume-portfolio.json` and check it against `schemas/resume-portfolio.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/resume-portfolio.md` at `outputs/resume-portfolio-curator-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Inventory supplied materials and map each claim to source evidence
2. Flag stale, unsupported, contradictory, sensitive, or role-mismatched material
3. Prepare role-fit resume and portfolio draft options with explicit evidence links
4. Produce owner-review questions for claims, redactions, and publication readiness

## Example setting

**Request:** Help me refresh my resume and project portfolio for senior product engineering roles using the notes and links in this folder.

**Expected outcome:** An evidence-linked resume and portfolio handoff with role-fit bullets, unsupported claims, stale links, redaction questions, and no submission or profile update.

## Standard deliverables

- Resume and portfolio evidence ledger
- Role-fit material shortlist
- Unsupported or sensitive claim register
- Owner-review handoff

## Done when

- Every proposed claim is supported, stale, missing, or explicitly owner-supplied as context
- Every portfolio item has a current link, owner-approved summary, or visible follow-up gap
- The handoff asks for owner approval before any publication, upload, profile change, or application use

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
