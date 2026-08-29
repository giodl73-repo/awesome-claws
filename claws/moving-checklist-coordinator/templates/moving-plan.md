# Moving checklist coordinator handoff

Plan: {{plan.id}}
Named owner: {{plan.ownerRef}}
As of: {{plan.asOf}} {{plan.timezone}}
Move date: {{plan.moveDate}} ({{plan.moveDateState}})

## Privacy-safe household and locations

Use aliases or privacy-safe labels in this shared handoff. Keep exact origin and
destination addresses, access instructions, resident details, account data, and
school or care details in private source records. Show whether each address or
resident detail is supplied, withheld, missing, or conflicting without copying
the private value.

## Sources and freshness

List every owner record, lease or sale record, access rule, inventory, quote,
service record, document, budget, travel plan, consent, assignment, and owner
action record with provenance, privacy, observed date, validity window, and
freshness. A source observed after the plan date, an expired current source, or
a stale, missing, or conflicting source cannot support a ready or completed
claim.

## Origin-to-destination workstreams

Show origin and destination property handoffs, inventory and packing, moving
service, utilities, documents and address, insurance, school or care,
registration, mail, travel, accounts, and move-day work. Every workstream must
name its location, accountable member, eligible assignees, evidence, state,
milestones, readiness items, and dependencies.

## Milestones and dependencies

Preserve known, missing, and conflicting dates. Never fill a missing or
conflicting date with an estimate. Pre-move milestones must not fall after a
known move date, move-day milestones must match it, and post-move milestones
must not precede it. Show dependency direction and reject self-dependencies,
duplicate edges, dangling references, or cycles.

## Readiness, assignments, and consent

Give every workstream at least one readiness item. Ready or complete states
require current evidence. Assign work only to eligible members with confirmed
or not-required consent. A declined or pending member remains unassigned and
blocked. Keep dependent and resident private details behind private references.

## Owner action gates

Include explicit gates for contracts, bookings, payments, messages, address
changes, utilities, insurance, school, registration, mail, travel, and account
changes. The named plan owner retains authority. `completed-by-owner` requires
a current owner-supplied action record matching the exact owner, workstream, and
action; general consent, a plan note, or evidence for another action is not a
receipt.

## Gaps, questions, and handoff

List missing or conflicting dates and evidence, stale records, missing consent,
unassigned work, and privacy review needs without fabrication. A ready handoff
must have complete workstream readiness, no unresolved dependency or evidence
gaps, and no blocked or pending required action gate. Otherwise keep the
handoff blocked and name the exact owner questions and blocking references.
