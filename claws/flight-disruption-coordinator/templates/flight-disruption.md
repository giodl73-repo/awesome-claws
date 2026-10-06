# Flight disruption evidence review

Write `outputs/flight-disruption.json` against `schemas/flight-disruption.schema.json`
and the traveler-owned Markdown handoff at
`outputs/flight-disruption-coordinator-handoff.md`.

## Bounded intake

Use one supplied, already-ticketed journey and every covered traveler alias.
Confirm the owner's authority and helper permissions outside the artifact.
Never retain booking locators, ticket numbers, passport data, boarding-pass
barcodes, credentials, payment details, or precise live traveler locations.
Keep identity mappings and original documents in the owner's controlled store.
The validator checks consistency of supplied assertions, not authenticity,
consent, completeness of an external inbox, or ticket validity.

## Original journey and ticket history

Inventory each original traveler-leg allocation, including separately ticketed
onward legs. A ticket group is a private alias, never a ticket number. Keep the
operating carrier distinct from the issuing agency or airline ticket office.
Represent every replacement as a successor of exactly one traveler allocation;
preserve all predecessors and original coverage rows. A two-person offer is two
per-traveler offer rows, not proof that both tickets changed.

The initial contract supports one replacement leg per displaced leg, including
a changed schedule for the same dated flight. Multi-stop reroutes, split tickets,
changed ticket issuers, and ticket cancellations requiring a terminal disposition
stay in a blocked intake handoff. Do not flatten them into invented one-to-one
reissues or discard their original allocations.

## Operating service and notices

Bind notices to the exact operating carrier, flight number, route, and departure
airport's local service date. Store offset-bearing departure and arrival times
with named IANA zones; a repeated flight number on another date is another
service. A cancellation or schedule notice does not change a ticket allocation.
Retain conflicting and expired evidence. Source revisions preserve subject,
issuer, kind, and chronological predecessor; preserve prior source rows.

## Offers, traveler decisions, and independent reissues

Keep each carrier offer, its published expiry, the exact traveler's acceptance
or decline, and the ticket issuer's reissue as separate evidence. An acceptance
must occur inside the offer window. A reissue follows that acceptance and cites
the exact traveler, predecessor allocation, replacement leg, offer, and decision.
An operating carrier notice, traveler note, another person's confirmation, or an
unaffected-leg receipt cannot substitute for ticket-issuer evidence.

An expired offer remains visible even if accepted earlier. Conflicting decisions
or offer evidence cannot support a completed reissue disposition. Missing reissues
remain explicit questions. Never call an offer or an acceptance a booking.

## Connection dependencies

Inventory every adjacent original leg for each traveler. Retain original edges
and recompute both endpoints from current ticket leaves. Subtract exact instants
to show the interval, even when negative; never subtract local clock labels.
Only compare to a source-stated minimum tied to those exact current legs. Missing
constraints and airport changes remain unresolved. Separate-ticket relationships
always retain an owner-review question, even when an interval exceeds a supplied
minimum. This comparison proves neither feasibility nor protected connection status.

## Exact coverage and owner questions

Render original-to-current coverage, observed reissues, unresolved original
allocations, and partial-party outcomes separately. `partialParty` compares
distinct impacted travelers: it is true only when at least one has reissues for
all impacted original allocations and another does not. Mixed leg outcomes for
one traveler alone are not a partial party. Reissue coverage does not establish
ticket validity or resolve downstream gaps. Every expired/conflicting
source, active operating change, unaccepted offer, missing reissue, conflicting
decision, unresolved connection, and separate-ticket dependency needs its exact
traveler-owned question. Use `blocked` whenever any question or validation error
remains. `evidence-reconciled` means only consistency of supplied records.

## Authority

All external actions remain `none`. Do not accept offers, book, rebook, cancel,
exchange, check in, choose seats, contact providers, submit claims, pay, or change
accounts. Never claim ticket validity, connection feasibility, entry eligibility,
refund or compensation entitlement, insurance coverage, live status, safety,
or a guaranteed recovery. The traveler and responsible providers retain every
transaction and final verification.
