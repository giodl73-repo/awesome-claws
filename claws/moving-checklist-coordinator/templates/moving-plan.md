# Moving checklist coordinator handoff

Plan: {{plan.id}}
Named owner: {{plan.ownerRef}}
As of: {{plan.asOf}} {{plan.timezone}}
Resolved move date: {{plan.moveDate}} ({{plan.moveDateState}})
Source-bound candidate dates: {{plan.dateCandidates}}

## Privacy-safe household and locations

Use only the required role-prefixed location aliases in this shared handoff.
Never place an exact address in an alias, source label, source URL, workstream
title, milestone title, gap, question, or handoff text. Exact origin and
destination locations must stay outside the shared artifact behind an owner-only
source reference, or be represented by the fixed redacted marker. Keep access
instructions, resident details, account data, and school or care details in
private source records. Show whether each detail is supplied, withheld, missing,
or conflicting without copying the private value.

## Sources and freshness

List every owner record, lease or sale record, access rule, inventory, quote,
service record, document, budget, travel plan, consent, assignment, owner
action, and milestone completion record with provenance, privacy, observed date,
validity window, and freshness. For every date, milestone completion, readiness
state, or gate-applicability claim, add an
evidence record that repeats the exact source kind, subject, workstream,
readiness kind when relevant, and asserted date or value. General consent or an
unrelated current source never proves a date, readiness state, or applicability
decision. A source observed after the plan date, an expired current source, or a
stale, missing, or conflicting source cannot support a ready or completed claim.

## Origin-to-destination workstreams

Show origin and destination property handoffs, inventory and packing, moving
service, utilities, documents and address, insurance, school or care,
registration, mail, travel, accounts, and move-day work. Every workstream must
name its location, accountable member, eligible assignees, evidence, state,
milestones, readiness items, and dependencies.

## Milestones and dependencies

Preserve known, missing, and conflicting dates. Keep every supplied date as a
source-bound candidate. Leave the resolved date null until the owner resolves
conflicting candidates; never replace a conflict with one selected or estimated
date. Pre-move milestones must not fall after a known move date, move-day
milestones must match it, and post-move milestones must not precede it. Show
the accountable owner on every milestone. Completed milestones require a
current, private, owner-supplied completion record and an exact evidence record
bound to that milestone, workstream, and accountable owner; a date record or
general plan note is not completion proof. Show dependency direction and reject
self-dependencies, duplicate edges, dangling references, or cycles.

## Readiness, assignments, and consent

Give every workstream at least one readiness item. Ready readiness items require
an exact current evidence record. A complete workstream requires all of its
declared milestones to have known dates and completed status. Assign work only
to eligible members with confirmed or not-required consent. A declined or
pending member remains unassigned and blocked. Keep dependent and resident
private details behind private references.

## Owner action gates

Include explicit gates for contracts, bookings, payments, messages, address
changes, utilities, insurance, school, registration, mail, travel, and account
changes. The named plan owner retains authority. `completed-by-owner` requires
a current owner-supplied action record matching the exact owner, workstream, and
action; general consent, a plan note, or evidence for another action is not a
receipt. Each gate must also declare whether its action applies, provide a
specific rationale, and cite an exact structured applicability record.
`not-applicable` is invalid for an action declared applicable by the workstream
or intrinsic to that workstream's kind; mandatory gates must remain present.

## Gaps, questions, and handoff

List missing or conflicting dates and evidence, stale records, missing consent,
unassigned work, and privacy review needs without fabrication. A ready handoff
must have every workstream complete, every milestone resolved and completed
(including move-day), complete workstream readiness, no unresolved dependency,
question, or evidence gap, and no blocked or pending required action gate.
Otherwise keep the handoff blocked and name the exact owner questions and
blocking references.
