# Operating workflow

## Start here

Ask for or confirm:

- One opportunity alias, accountable bid owner, intended buyer audience, private output destination, supplied bid decision, and as-of time
- Buyer request and authoritative amendments with exact question identifiers, instructions, mandatory items, requested attachments, response formats, word limits, and submission deadline with timezone
- Current authorized product, service, security, implementation, pricing, and reference material with applicable versions, audience restrictions, source owners, and known gaps
- Reusable answer candidates, exact scope of any supplied specialist reviews, response owners, unresolved clarification questions, and approved commercial material when available

## Included capability boundaries

- Base only: use supplied minimized documents and workspace file access to produce an X3 Markdown draft and structured coverage data. No portal, CRM, browser, messaging, pricing engine, execution, schedule, or third-party integration is granted.
- Use Sales Operations for pipeline and forecast review, Commercial Deal Desk for quote and exception approval, and Procurement Evaluator for buyer-side vendor comparison. This starter produces the seller's requirement-complete written response.
- Keep internal source references and owner questions out of buyer copy. If the requested delivery format cannot be produced with the available capabilities, deliver an explicit review-format draft and flag the format conversion as incomplete.
- A structurally complete response can truthfully disclose a mandatory capability gap and still be unsuitable to submit. Artifact completeness never implies bid viability, customer acceptance, legal compliance, approval, or authority to submit.
- Follow references/response-contract.md and schemas/rfp-response.schema.json. Produce outputs/rfp-response.json, substantive buyer copy in outputs/rfp-response-draft.md, and the private coverage and owner handoff in outputs/rfp-response-producer-handoff.md. The synthetic fixtures demonstrate the output, not current product facts or approval. Schema and citation checks do not prove prose entailment; review the actual answers against permitted source passages.

## Structured decision artifact contract

- Treat `fixtures/rfp-response.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/rfp-response.json` and check it against `schemas/rfp-response.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/rfp-response.md` at `outputs/rfp-response-producer-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm the owner, audience, bid scope, source permissions, buyer baseline, and all amendments; preserve missing or conflicting instructions as review questions
2. Build the exact requirement register from the supplied buyer package, retaining original identifiers, compound subquestions, mandatory status, format constraints, attachment requirements, and amendment lineage
3. Map relevant seller evidence and reusable answers to each current requirement; check product and version scope, recency, support for each claim, and permission to disclose
4. Write the executive summary and substantive question-by-question response draft in buyer order, differentiating supported facts, partial support, unsupported capabilities, requested commercial commitments, and information still needed
5. Separate the buyer-facing working draft from internal citation notes and specialist questions; validate answer lengths, permitted response values, attachment identity, complete coverage, and agreement between the draft and coverage register
6. Reopen affected answers, attachments, and approvals after buyer amendments or changed seller evidence; prepare exact-version review requests for the responsible security, legal, product, delivery, pricing, and bid owners
7. Deliver the private response draft, coverage matrix, attachment manifest, and prioritized review requests without representing the package as submitted, certified, accepted, or commercially committed

## Example setting

**Request:** Draft our response to the eight-question workflow-platform RFP using the supplied product notes and answer library. Amendment 2 makes EU-only hosting mandatory. Our current region matrix supports US hosting only; an old reusable answer says EU hosting is available. We also lack an approved SLA and permission to name a reference customer. Answer what we can, preserve the buyer's word limits, and give me the exact gaps and review requests. Do not submit or promise anything.

**Expected outcome:** A complete eight-answer review draft supports SSO and export claims from current sources, explicitly states the EU-hosting gap instead of copying stale boilerplate, leaves SLA and reference commitments unresolved, and produces an amendment-aware coverage matrix and exact attachment and specialist-review questions.

## Standard deliverables

- Substantive executive summary and buyer-ordered RFP response draft
- Requirement-to-answer coverage matrix with amendment lineage and explicit gaps
- Claim-to-source notes and scoped reusable-answer provenance kept separate from buyer copy
- Required attachment manifest with version and disclosure checks
- Prioritized specialist review requests and final bid-owner handoff

## Done when

- The output contains substantive draft answers, not merely statuses, and every current buyer question and subquestion is answered or explicitly unresolved exactly once
- Every material factual claim has applicable permitted seller evidence; partial support, stale answers, unsupported capabilities, and conflicts remain visible
- Buyer question order, response formats, word limits, mandatory conditions, and required attachments are preserved without silently rewriting the request
- Amendment changes invalidate affected answers and reviews until current evidence and scoped human decisions support them again
- The internal review copy and buyer-facing draft remain separate, and all remaining commercial commitments, specialist judgments, and submission decisions stay with the bid owner

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
