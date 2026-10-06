import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { root } from "./catalog-source.mjs";

const id = { type: "string", pattern: "^[a-z][a-z0-9-]{0,63}$" };
const refs = { type: "array", uniqueItems: true, items: id };
const nullableRef = { anyOf: [id, { type: "null" }] };
const instant = { type: "string", format: "date-time", pattern: "(Z|[+-][0-9]{2}:[0-9]{2})$" };
const nullableInstant = { anyOf: [instant, { type: "null" }] };
const choice = (...values) => ({ enum: values });
const object = (properties) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const list = (items, minItems) => ({ type: "array", ...(minItems ? { minItems } : {}), items });
const integer = { type: "integer", minimum: 0, maximum: 10080 };
const schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  ...object({
    schemaVersion: { const: "awesomeClaws.flightDisruption.v1" },
    scope: object({ ownerRef: id, travelerRefs: refs, helperRefs: refs, asOf: instant,
      originalAllocationRefs: refs, connectionRefs: refs, sourceRefs: refs,
      destination: { const: "private-owner-workspace" } }),
    authorities: list(object({ id, kind: choice("traveler", "helper", "operating-carrier", "ticket-issuer", "airport"), airportCode: { anyOf: [{ type: "string", pattern: "^[A-Z]{3}$" }, { type: "null" }] } }), 1),
    sources: list(object({ id, kind: choice("ticket-original", "operating-notice", "carrier-offer", "traveler-decision", "ticket-reissue", "connection-dependency", "connection-constraint"),
      issuerRef: id, subjectRef: id, relatedRefs: refs, assertedAt: instant, observedAt: instant,
      expiresAt: nullableInstant, minimumMinutes: { anyOf: [integer, { type: "null" }] }, state: choice("current", "superseded", "conflicting"), supersedesRef: nullableRef,
      controlledRef: { type: "string", pattern: "^controlled://flight/source-[a-z0-9-]{1,48}$" } }), 1),
    legs: list(object({ id, operatingCarrierRef: id, flightNumber: { type: "string", pattern: "^[A-Z0-9]{2,8}$" },
      serviceDate: { type: "string", format: "date" }, origin: { type: "string", pattern: "^[A-Z]{3}$" },
      destination: { type: "string", pattern: "^[A-Z]{3}$" }, departureAt: instant, arrivalAt: instant,
      departureZone: { type: "string", minLength: 1, maxLength: 64 }, arrivalZone: { type: "string", minLength: 1, maxLength: 64 } }), 1),
    allocations: list(object({ id, travelerRef: id, legRef: id, ticketIssuerRef: id, ticketGroupRef: id,
      predecessorRef: nullableRef, sourceRef: id, offerRef: nullableRef, acceptanceRef: nullableRef }), 1),
    notices: list(object({ id, legRef: id, sourceRef: id, operatingCarrierRef: id,
      flightNumber: { type: "string", pattern: "^[A-Z0-9]{2,8}$" }, serviceDate: { type: "string", format: "date" },
      origin: { type: "string", pattern: "^[A-Z]{3}$" }, destination: { type: "string", pattern: "^[A-Z]{3}$" },
      event: choice("cancelled", "schedule-change") })),
    offers: list(object({ id, travelerRef: id, predecessorRef: id, replacementLegRef: id, sourceRef: id, expiresAt: instant })),
    decisions: list(object({ id, offerRef: id, travelerRef: id, sourceRef: id, decidedAt: instant, state: choice("accepted", "declined") })),
    connections: list(object({ id, originalFromRef: id, originalToRef: id, currentFromRef: id, currentToRef: id,
      dependencySourceRef: id, relationship: choice("same-ticket", "separate-ticket"), constraintSourceRef: nullableRef,
      minimumMinutes: { anyOf: [integer, { type: "null" }] },
      intervalMinutes: { type: "number", minimum: -10080, maximum: 10080 },
      state: choice("unknown-constraint", "airport-transfer-unresolved", "below-stated-minimum", "meets-stated-minimum") })),
    coverage: list(object({ originalRef: id, currentRef: id, state: choice("unchanged-record", "reissue-observed", "operating-change", "pending-reissue") }), 1),
    questions: list(object({ id, targetRef: id, reason: choice("evidence-not-current", "operating-change", "offer-expired", "offer-awaiting-owner", "missing-reissue", "conflicting-decisions", "connection-review", "separate-ticket-review"), ownerRef: id })),
    review: object({ state: choice("blocked", "evidence-reconciled"), reissuedOriginalRefs: refs, unresolvedOriginalRefs: refs,
      partialParty: { type: "boolean" }, externalActions: { const: "none" }, ticketValidity: { const: "not-determined" },
      connectionFeasibility: { const: "not-determined" }, passengerRights: { const: "not-determined" }, recoveryClaim: { const: false } }),
  }),
};

const fixture = {
  schemaVersion: "awesomeClaws.flightDisruption.v1",
  scope: { ownerRef: "traveler-a", travelerRefs: ["traveler-a", "traveler-b"], helperRefs: [],
    asOf: "2026-10-10T19:00:00Z", originalAllocationRefs: [], connectionRefs: [], sourceRefs: [], destination: "private-owner-workspace" },
  authorities: [{ id: "traveler-a", kind: "traveler" }, { id: "traveler-b", kind: "traveler" },
    { id: "carrier-north", kind: "operating-carrier" }, { id: "agency-one", kind: "ticket-issuer" },
    { id: "issuer-onward", kind: "ticket-issuer" }, { id: "airport-ord", kind: "airport" }],
  sources: [],
  legs: [
    { id: "leg-sea-ord", operatingCarrierRef: "carrier-north", flightNumber: "NX101", serviceDate: "2026-10-11", origin: "SEA", destination: "ORD", departureAt: "2026-10-11T06:00:00-07:00", arrivalAt: "2026-10-11T12:00:00-05:00", departureZone: "America/Los_Angeles", arrivalZone: "America/Chicago" },
    { id: "leg-ord-bos", operatingCarrierRef: "carrier-north", flightNumber: "NX202", serviceDate: "2026-10-11", origin: "ORD", destination: "BOS", departureAt: "2026-10-11T14:00:00-05:00", arrivalAt: "2026-10-11T17:00:00-04:00", departureZone: "America/Chicago", arrivalZone: "America/New_York" },
    { id: "leg-replacement", operatingCarrierRef: "carrier-north", flightNumber: "NX103", serviceDate: "2026-10-11", origin: "SEA", destination: "ORD", departureAt: "2026-10-11T09:00:00-07:00", arrivalAt: "2026-10-11T15:00:00-05:00", departureZone: "America/Los_Angeles", arrivalZone: "America/Chicago" },
  ], allocations: [], notices: [], offers: [], decisions: [], connections: [], coverage: [], questions: [],
  review: { state: "blocked", reissuedOriginalRefs: ["allocation-a-in"], unresolvedOriginalRefs: ["allocation-b-in"], partialParty: true,
    externalActions: "none", ticketValidity: "not-determined", connectionFeasibility: "not-determined", passengerRights: "not-determined", recoveryClaim: false },
};
for (const authority of fixture.authorities) authority.airportCode = authority.kind === "airport" ? "ORD" : null;
function source(id, kind, issuerRef, subjectRef, relatedRefs, assertedAt = "2026-10-10T10:00:00Z", expiresAt = null) {
  fixture.sources.push({ id, kind, issuerRef, subjectRef, relatedRefs, assertedAt, observedAt: assertedAt, expiresAt, minimumMinutes: null,
    state: "current", supersedesRef: null, controlledRef: `controlled://flight/${id}` });
  return id;
}
function question(targetRef, reason) {
  fixture.questions.push({ id: `question-${fixture.questions.length + 1}`, targetRef, reason, ownerRef: "traveler-a" });
}
for (const party of ["a", "b"]) {
  for (const [suffix, legRef, ticketIssuerRef, ticketGroupRef] of [["in", "leg-sea-ord", "agency-one", "ticket-outbound"], ["out", "leg-ord-bos", "issuer-onward", "ticket-separate"]]) {
    const id = `allocation-${party}-${suffix}`;
    fixture.allocations.push({ id, travelerRef: `traveler-${party}`, legRef, ticketIssuerRef, ticketGroupRef, predecessorRef: null,
      sourceRef: source(`source-${party}-${suffix}`, "ticket-original", ticketIssuerRef, id, [`traveler-${party}`, legRef]), offerRef: null, acceptanceRef: null });
    fixture.scope.originalAllocationRefs.push(id);
  }
  const offerId = `offer-${party}`;
  fixture.offers.push({ id: offerId, travelerRef: `traveler-${party}`, predecessorRef: `allocation-${party}-in`, replacementLegRef: "leg-replacement",
    sourceRef: source(`source-offer-${party}`, "carrier-offer", "carrier-north", offerId, [`traveler-${party}`, `allocation-${party}-in`, "leg-replacement"], "2026-10-10T12:00:00Z", "2026-10-10T20:00:00Z"), expiresAt: "2026-10-10T20:00:00Z" });
  const decisionId = `decision-${party}`;
  fixture.decisions.push({ id: decisionId, offerRef: offerId, travelerRef: `traveler-${party}`, state: "accepted", decidedAt: "2026-10-10T13:00:00Z",
    sourceRef: source(`source-decision-${party}`, "traveler-decision", `traveler-${party}`, decisionId, [offerId], "2026-10-10T13:00:00Z") });
}
fixture.allocations.push({ id: "allocation-a-new", travelerRef: "traveler-a", legRef: "leg-replacement", ticketIssuerRef: "agency-one", ticketGroupRef: "ticket-outbound",
  predecessorRef: "allocation-a-in", offerRef: "offer-a", acceptanceRef: "decision-a",
  sourceRef: source("source-reissue-a", "ticket-reissue", "agency-one", "allocation-a-new", ["traveler-a", "leg-replacement", "allocation-a-in", "offer-a", "decision-a"], "2026-10-10T14:00:00Z") });
fixture.notices.push({ id: "notice-cancelled", legRef: "leg-sea-ord", operatingCarrierRef: "carrier-north", flightNumber: "NX101", serviceDate: "2026-10-11", origin: "SEA", destination: "ORD", event: "cancelled",
  sourceRef: source("source-cancellation", "operating-notice", "carrier-north", "notice-cancelled", ["leg-sea-ord"], "2026-10-10T11:00:00Z") });
question("allocation-b-in", "operating-change");
question("offer-b", "missing-reissue");
for (const party of ["a", "b"]) {
  const id = `connection-${party}`;
  const currentFromRef = party === "a" ? "allocation-a-new" : "allocation-b-in";
  fixture.connections.push({ id, originalFromRef: `allocation-${party}-in`, originalToRef: `allocation-${party}-out`, currentFromRef, currentToRef: `allocation-${party}-out`,
    dependencySourceRef: source(`source-connection-${party}`, "connection-dependency", `traveler-${party}`, id, [`allocation-${party}-in`, `allocation-${party}-out`]),
    relationship: "separate-ticket", constraintSourceRef: null, minimumMinutes: null, intervalMinutes: party === "a" ? -60 : 120, state: "unknown-constraint" });
  fixture.scope.connectionRefs.push(id);
  question(id, "connection-review"); question(id, "separate-ticket-review");
  fixture.coverage.push({ originalRef: `allocation-${party}-in`, currentRef: currentFromRef, state: party === "a" ? "reissue-observed" : "operating-change" },
    { originalRef: `allocation-${party}-out`, currentRef: `allocation-${party}-out`, state: "unchanged-record" });
}
fixture.scope.sourceRefs = fixture.sources.map((row) => row.id);
const base = join(root, "sources", "flight-disruption-coordinator");
await mkdir(join(base, "schemas"), { recursive: true });
await writeFile(join(base, "schemas", "flight-disruption.schema.json"), `${JSON.stringify(schema, null, 2)}\n`);
await writeFile(join(base, "fixtures", "flight-disruption.example.json"), `${JSON.stringify(fixture, null, 2)}\n`);
