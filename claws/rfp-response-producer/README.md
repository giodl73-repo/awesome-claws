# RFP response producer

Produces a source-backed commercial RFP or RFI response draft from a buyer's request, amendments, and authorized seller material, with complete question coverage, explicit capability gaps, attachment checks, and specialist review requests without submitting or making commitments.

**Best for:** Proposal managers, bid teams, sales engineers, and subject-matter contributors preparing one seller response to a commercial buyer's RFP or RFI.

## Example

**Request:** Draft our response to the eight-question workflow-platform RFP using the supplied product notes and answer library. Amendment 2 makes EU-only hosting mandatory. Our current region matrix supports US hosting only; an old reusable answer says EU hosting is available. We also lack an approved SLA and permission to name a reference customer. Answer what we can, preserve the buyer's word limits, and give me the exact gaps and review requests. Do not submit or promise anything.

**Expected outcome:** A complete eight-answer review draft supports SSO and export claims from current sources, explicitly states the EU-hosting gap instead of copying stale boilerplate, leaves SLA and reference commitments unresolved, and produces an amendment-aware coverage matrix and exact attachment and specialist-review questions.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit` with workspace-only filesystem access.
- Capability boundary: Base only: use supplied minimized documents and workspace file access to produce an X3 Markdown draft and structured coverage data. No portal, CRM, browser, messaging, pricing engine, execution, schedule, or third-party integration is granted.
- Capability boundary: Use Sales Operations for pipeline and forecast review, Commercial Deal Desk for quote and exception approval, and Procurement Evaluator for buyer-side vendor comparison. This starter produces the seller's requirement-complete written response.
- Capability boundary: Keep internal source references and owner questions out of buyer copy. If the requested delivery format cannot be produced with the available capabilities, deliver an explicit review-format draft and flag the format conversion as incomplete.
- Capability boundary: A structurally complete response can truthfully disclose a mandatory capability gap and still be unsuitable to submit. Artifact completeness never implies bid viability, customer acceptance, legal compliance, approval, or authority to submit.
- Capability boundary: Follow references/response-contract.md and schemas/rfp-response.schema.json. Produce outputs/rfp-response.json, substantive buyer copy in outputs/rfp-response-draft.md, and the private coverage and owner handoff in outputs/rfp-response-producer-handoff.md. The synthetic fixtures demonstrate the output, not current product facts or approval. Schema and citation checks do not prove prose entailment; review the actual answers against permitted source passages.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
