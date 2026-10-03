# Operating workflow

## Start here

Ask for or confirm:

- One project, bounded document package, accountable controller, intended review use, private output destination, and as-of time
- Owner-supplied document numbering, revision and status conventions, required-document register, review routes, and deadlines with timezone
- Authorized drawing and specification metadata, received revisions, submittals, RFIs, review decisions, and transmittal records
- Explicit supersession relationships, distribution permissions, recipient scopes, and known missing files or responses

## Included capability boundaries

- X3 base only: authorized workspace exports and private Markdown registers; no EDMS, CAD interpretation, messaging, browser, execution, or integration access
- Use Document Intake Analyst for conversion and Records Retention Disposition for retention decisions; this job controls active project revision and review relationships
- Missing files, unknown status meanings, unresolved supersession, or missing distribution permission block the affected draft handoff rather than being inferred

## Structured decision artifact contract

- Treat `fixtures/project-document-control.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/project-document-control.json` and check it against `schemas/project-document-control.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/project-document-control.md` at `outputs/project-document-controller-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Bind supplied records to exact project and document identities; retain ambiguous names or revision orders as owner questions
2. Reconcile required documents against received revisions and distinguish receipt, review, authorized use, supersession, and withdrawal
3. Link each submittal and RFI to exact document revisions and supplied reviewer responses; identify overdue items using supplied deadlines
4. Trace amendment and revision changes into affected open questions, prior decisions, and draft distribution lists without transferring approval
5. Prepare the current-revision register, missing-document requests, and draft transmittal manifest with purpose, recipients, and exact versions
6. Deliver the private package with prohibited, unknown, and pending-use states visible; no document issue or engineering authorization occurs

## Example setting

**Request:** Reconcile package PKG-4. Drawing D-101 revision C arrived after revision B was approved for construction, but C is only for review. A transmittal draft points to B, and an RFI still references A. Prepare the current register and exact questions without issuing documents.

**Expected outcome:** The register shows C as latest received and B as the last explicitly construction-approved revision, with supersession and continued-use uncertainty exposed. The package asks the engineer to resolve applicability, corrects no approval itself, and holds the transmittal for revision and recipient review.

## Standard deliverables

- Current-revision and authorized-use document register
- Submittal and RFI follow-up package with exact revision links
- Draft transmittal manifest with intended purpose and permitted recipients
- Supersession impact and missing-review handoff

## Done when

- Every required document has a supplied exact revision state or an explicit missing or ambiguous record
- Latest received and authorized-use states are independently supported and never conflated
- Submittals, RFIs, changes, and draft transmittals retain exact document and revision references
- Draft follow-ups are concrete while all engineering approval, issue, distribution, EDMS, and construction authority remains external

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
