# Operating workflow

## Start here

Ask for or confirm:

- Selected supplier alias, legal entity references, engagement scope, requester, buying entity, owner, private recipient, and as-of time
- Owner-supplied onboarding checklist and explicit applicability or routing rules for this engagement and jurisdiction
- Authorized supplier intake, selection evidence, entity records, controlled evidence references, and existing-master match observations
- Supplied specialist decisions with exact supplier, service, revision, validity, and audience scope; known missing information

## Included capability boundaries

- X3 base only: supplied workspace evidence and private Markdown artifacts; no portal, CRM, bank, network, messaging, execution, or integration access
- Consume selected-supplier and diligence outputs without duplicating Procurement Evaluator's comparison or Recurring Third-Party Review's periodic evidence workflow
- Where confidential originals are required, record controlled references and missing owner verification; never request raw financial identifiers in chat
- Follow references/setup-contract.md. Produce outputs/supplier-onboarding.json against schemas/supplier-onboarding.schema.json, and render the actual setup fields, checklist, receipt scope and owner questions using templates/supplier-onboarding.md. The example source pack and fixtures are synthetic, not current supplier facts or owner approval. Repository validators are development tooling, not a granted execution capability.

## Structured decision artifact contract

- Treat `fixtures/supplier-onboarding.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/supplier-onboarding.json` and check it against `schemas/supplier-onboarding.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/supplier-onboarding.md` at `outputs/supplier-onboarding-preparer-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm selection is supplied rather than deciding it; bound one supplier entity and engagement against the current onboarding checklist
2. Normalize permitted setup fields into a draft packet and reconcile conflicting identity, service, and buying-entity details without silently merging entities
3. Map every applicable checklist item to permitted evidence, an explicit missing item, or a supplied owner-approved not-applicable decision
4. Apply only explicit routing rules to draft exact Procurement, Finance, Security, Privacy, Legal, and business-owner questions; do not perform their specialist decisions
5. Keep payment and tax verification as controlled owner evidence references; invalidate reviews affected by changed identity or service scope
6. Deliver the private setup packet, completeness matrix, specialist requests, and activation-owner handoff with unresolved items visible

## Example setting

**Request:** Prepare the setup packet for selected supplier SUP-17. The intake and contract name different legal entities, the service now handles personal data, and the payment-verification reference has not been supplied. Use the provided onboarding rules; do not contact or activate anyone.

**Expected outcome:** A usable draft packet preserves both entity references without merging them, routes the changed data scope to Privacy, reopens the prior no-personal-data review, and requests Finance's controlled verification evidence without copying bank details or claiming activation.

## Standard deliverables

- Minimized draft supplier setup packet
- Checklist-to-evidence completeness matrix with identity conflicts
- Exact specialist and missing-information request drafts
- Revision-aware owner handoff with unresolved activation prerequisites

## Done when

- Every applicable onboarding item has exactly one evidence mapping or explicit gap, with supplied applicability decisions retained
- The packet contains usable permitted setup fields and specific questions, not only a readiness label
- Entity conflicts and changed-scope reviews remain unresolved until exact owner evidence supports them
- No supplier activation, payment verification, tax judgment, risk acceptance, contact, or system mutation is claimed

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
