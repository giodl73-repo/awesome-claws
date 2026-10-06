import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { flightDisruptionFindings } from "./flight-disruption-coordinator.mjs";
import { validateArtifact } from "./artifact-validator-registry.mjs";

const base = new URL("../sources/flight-disruption-coordinator/", import.meta.url);
const fixture = JSON.parse(await readFile(new URL("fixtures/flight-disruption.example.json", base), "utf8"));
const schema = JSON.parse(await readFile(new URL("schemas/flight-disruption.schema.json", base), "utf8"));
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const change = (fn) => { const v = structuredClone(fixture); fn(v); return v; };
const source = (v, id) => v.sources.find((row) => row.id === id);
function clean(v) {
  assert.equal(validate(v), true, ajv.errorsText(validate.errors));
  assert.deepEqual(flightDisruptionFindings(v), []);
}
function rejects(fn, code) {
  const v = change(fn);
  assert.equal(validate(v), true, ajv.errorsText(validate.errors));
  assert.ok(flightDisruptionFindings(v).some((row) => row.code === code), JSON.stringify(flightDisruptionFindings(v)));
}
function addQuestion(v, targetRef, reason) {
  v.questions.push({ id: `question-extra-${v.questions.length}`, targetRef, reason, ownerRef: v.scope.ownerRef });
}

test("two travelers retain a partial reissue and separate-ticket connection gaps", () => clean(fixture));

test("one traveler with two impacted legs and one reissue is not a partial party", () => {
  const v = change((v) => {
    const removed = new Set(["traveler-b", "allocation-b-in", "allocation-b-out", "offer-b", "decision-b", "connection-b"]);
    for (const key of ["authorities", "allocations", "offers", "decisions", "connections"]) v[key] = v[key].filter((row) => !removed.has(row.id));
    v.sources = v.sources.filter((row) => !removed.has(row.subjectRef));
    v.coverage = v.coverage.filter((row) => !removed.has(row.originalRef));
    v.questions = v.questions.filter((row) => !removed.has(row.targetRef));
    const leg = v.legs.find((row) => row.id === "leg-ord-bos");
    v.notices.push({ ...v.notices[0], id: "notice-onward", legRef: leg.id, sourceRef: "source-onward-notice",
      operatingCarrierRef: leg.operatingCarrierRef, flightNumber: leg.flightNumber, serviceDate: leg.serviceDate, origin: leg.origin, destination: leg.destination });
    v.sources.push({ ...source(v, "source-cancellation"), id: "source-onward-notice", subjectRef: "notice-onward", issuerRef: leg.operatingCarrierRef,
      relatedRefs: [leg.id], controlledRef: "controlled://flight/source-onward-notice" });
    v.scope.travelerRefs = ["traveler-a"];
    v.scope.originalAllocationRefs = v.coverage.map((row) => row.originalRef);
    v.scope.connectionRefs = v.connections.map((row) => row.id);
    v.scope.sourceRefs = v.sources.map((row) => row.id);
    v.coverage.find((row) => row.originalRef === "allocation-a-out").state = "operating-change";
    addQuestion(v, "allocation-a-out", "operating-change");
    Object.assign(v.review, { partialParty: false, unresolvedOriginalRefs: ["allocation-a-out"] });
  });
  clean(v);
  assert.deepEqual(v.review.reissuedOriginalRefs, ["allocation-a-in"]);
  assert.deepEqual(v.review.unresolvedOriginalRefs, ["allocation-a-out"]);
  v.review.partialParty = true;
  assert.ok(flightDisruptionFindings(v).some((row) => row.code === "incorrect_recovery_summary"));
  v.review.partialParty = false;
  v.review.unresolvedOriginalRefs = [];
  assert.ok(flightDisruptionFindings(v).some((row) => row.code === "incorrect_recovery_summary"));
});

test("registered artifact validator accepts the substantive source fixture", async () => {
  const result = await validateArtifact({ id: "flight-disruption-coordinator", artifactPath: new URL("fixtures/flight-disruption.example.json", base), scenarioType: "accepted-task", mode: "fixture" });
  assert.equal(result.valid, true, JSON.stringify(result));
  assert.equal(result.semantics.applicable, true);
});

test("no fully reissued impacted traveler means no partial-party completion", () => {
  const v = change((v) => {
    const leg = v.legs.find((row) => row.id === "leg-ord-bos");
    v.notices.push({ ...v.notices[0], id: "notice-onward", legRef: leg.id, sourceRef: "source-onward-notice",
      operatingCarrierRef: leg.operatingCarrierRef, flightNumber: leg.flightNumber, serviceDate: leg.serviceDate, origin: leg.origin, destination: leg.destination });
    v.sources.push({ ...source(v, "source-cancellation"), id: "source-onward-notice", subjectRef: "notice-onward", issuerRef: leg.operatingCarrierRef,
      relatedRefs: [leg.id], controlledRef: "controlled://flight/source-onward-notice" });
    v.scope.sourceRefs.push("source-onward-notice");
    for (const id of ["allocation-a-out", "allocation-b-out"]) {
      v.coverage.find((row) => row.originalRef === id).state = "operating-change";
      addQuestion(v, id, "operating-change");
      v.review.unresolvedOriginalRefs.push(id);
    }
    v.review.partialParty = false;
  });
  clean(v);
  v.review.partialParty = true;
  assert.ok(flightDisruptionFindings(v).some((row) => row.code === "incorrect_recovery_summary"));
});

test("malformed direct inputs return findings without throwing", () => {
  for (const v of [null, undefined, true, [], {}, { ...fixture, sources: [null] }, { ...fixture, scope: null }]) assert.ok(flightDisruptionFindings(v).length);
  for (const collection of ["sources", "legs", "allocations", "offers", "connections"]) {
    const v = change((v) => { v[collection] = [{}]; });
    assert.doesNotThrow(() => flightDisruptionFindings(v));
    assert.ok(flightDisruptionFindings(v).length);
  }
});

test("original coverage cannot omit a traveler or invent complete-party success", () => {
  rejects((v) => v.scope.originalAllocationRefs.pop(), "incomplete_journey_index");
  rejects((v) => v.coverage.pop(), "incomplete_allocation_coverage");
  rejects((v) => { v.review.partialParty = false; }, "incorrect_recovery_summary");
  rejects((v) => { v.review.unresolvedOriginalRefs = []; }, "incorrect_recovery_summary");
  rejects((v) => { v.scope.travelerRefs.pop(); }, "invalid_traveler_authority");
});

test("an operating notice binds the exact flight date, carrier, and route", () => {
  for (const [key, value] of [["serviceDate", "2026-10-12"], ["flightNumber", "NX102"], ["origin", "LAX"], ["operatingCarrierRef", "agency-one"]]) rejects((v) => { v.notices[0][key] = value; }, "invalid_operating_notice");
});

test("departure-local service dates and IANA offsets cannot drift", () => {
  rejects((v) => { v.legs[0].serviceDate = "2026-10-12"; }, "invalid_flight_service_date");
  rejects((v) => { v.legs[0].departureAt = "2026-10-11T06:00:00-08:00"; }, "invalid_flight_service_date");
  rejects((v) => { v.legs[0].arrivalAt = "2026-10-11T05:00:00-05:00"; }, "invalid_flight_service_date");
  rejects((v) => { v.legs[0].departureZone = "Invalid/Zone"; }, "invalid_flight_service_date");
});

test("a schedule revision of the same dated flight remains a distinct ticket successor", () => {
  clean(change((v) => { v.legs[2].flightNumber = "NX101"; }));
});

test("UTC date crossing does not change the departure-local service date", () => {
  const v = change((v) => {
    v.legs[2].departureAt = "2026-10-11T23:00:00-07:00";
    v.legs[2].arrivalAt = "2026-10-12T05:00:00-05:00";
    v.connections[0].intervalMinutes = -900;
  });
  clean(v);
});

test("offers and traveler notes cannot replace an independent ticket-issuer reissue", () => {
  rejects((v) => { v.allocations[4].sourceRef = "source-offer-a"; }, "invalid_flight_evidence");
  rejects((v) => { source(v, "source-reissue-a").issuerRef = "carrier-north"; }, "invalid_flight_evidence");
  rejects((v) => { v.allocations[4].sourceRef = "source-a-out"; }, "invalid_flight_evidence");
  rejects((v) => { v.allocations[4].acceptanceRef = "decision-b"; }, "unsupported_ticket_reissue");
  rejects((v) => { v.allocations[4].travelerRef = "traveler-b"; }, "invalid_ticket_lineage");
});

test("exact offer scope cannot borrow another traveler, route, or issuer", () => {
  rejects((v) => { v.offers[0].travelerRef = "traveler-b"; }, "invalid_carrier_offer");
  rejects((v) => { v.legs[2].destination = "JFK"; }, "invalid_carrier_offer");
  rejects((v) => { source(v, "source-offer-a").issuerRef = "agency-one"; }, "invalid_carrier_offer");
});

test("acceptance must be exact-traveler and strictly before offer expiry", () => {
  rejects((v) => { v.decisions[0].travelerRef = "traveler-b"; }, "invalid_traveler_decision");
  rejects((v) => { v.decisions[0].decidedAt = v.offers[0].expiresAt; }, "invalid_traveler_decision");
  rejects((v) => { v.decisions[0].decidedAt = "2026-10-10T09:00:00Z"; }, "invalid_traveler_decision");
  rejects((v) => { source(v, "source-reissue-a").assertedAt = "2026-10-10T12:30:00Z"; }, "invalid_ticket_lineage");
});

test("expired offers remain visible after earlier valid acceptance and reissue", () => {
  clean(change((v) => {
    v.scope.asOf = "2026-10-10T21:00:00Z";
    for (const id of ["source-offer-a", "source-offer-b"]) addQuestion(v, id, "evidence-not-current");
  }));
});

test("an unaccepted expired offer retains both expiry evidence and an owner question", () => {
  clean(change((v) => {
    v.scope.asOf = "2026-10-10T21:00:00Z";
    v.decisions = v.decisions.filter((row) => row.id !== "decision-b");
    v.sources = v.sources.filter((row) => row.id !== "source-decision-b");
    v.scope.sourceRefs = v.sources.map((row) => row.id);
    v.questions = v.questions.filter((row) => row.reason !== "missing-reissue");
    for (const id of ["source-offer-a", "source-offer-b"]) addQuestion(v, id, "evidence-not-current");
    addQuestion(v, "offer-b", "offer-expired");
  }));
});

test("conflicting evidence and decisions cannot be hidden or used to confirm a reissue", () => {
  rejects((v) => { source(v, "source-offer-a").state = "conflicting"; }, "unsupported_ticket_reissue");
  rejects((v) => { source(v, "source-cancellation").state = "conflicting"; }, "hidden_flight_gap");
  rejects((v) => { v.decisions.push({ ...v.decisions[0], id: "decision-other", state: "declined" }); }, "unsupported_ticket_reissue");
});

test("source lineage requires exact subject, issuer, chronology, and retained successor", () => {
  rejects((v) => { source(v, "source-offer-a").supersedesRef = "source-offer-b"; }, "invalid_source_lineage");
  rejects((v) => { source(v, "source-offer-a").state = "superseded"; }, "invalid_source_lineage");
  rejects((v) => { source(v, "source-offer-a").observedAt = "2026-10-10T09:00:00Z"; }, "invalid_flight_chronology");
  clean(change((v) => {
    const prior = { ...source(v, "source-cancellation"), id: "source-cancel-prior", controlledRef: "controlled://flight/source-cancel-prior", state: "superseded", assertedAt: "2026-10-10T10:00:00Z", observedAt: "2026-10-10T10:00:00Z" };
    source(v, "source-cancellation").supersedesRef = prior.id;
    v.sources.push(prior); v.scope.sourceRefs.push(prior.id);
  }));
});

test("replacement cycles and changed ticket issuers fail closed", () => {
  rejects((v) => { v.allocations[4].predecessorRef = "allocation-a-new"; }, "invalid_ticket_lineage");
  rejects((v) => { v.allocations[4].ticketIssuerRef = "issuer-onward"; }, "invalid_ticket_lineage");
  rejects((v) => { v.allocations[4].ticketGroupRef = "ticket-other"; }, "invalid_ticket_lineage");
});

test("connections use current leaves and exact UTC subtraction", () => {
  rejects((v) => { v.connections[0].currentFromRef = "allocation-a-in"; }, "stale_connection_endpoints");
  rejects((v) => { v.connections[0].intervalMinutes = 120; }, "incorrect_connection_interval");
  rejects((v) => { v.connections[0].relationship = "same-ticket"; }, "stale_connection_endpoints");
  rejects((v) => { v.connections[0].originalToRef = "allocation-b-out"; }, "invalid_connection_dependency");
});

test("removing a connection and its declared index still exposes missing adjacency", () => {
  rejects((v) => { v.connections.pop(); v.scope.connectionRefs.pop(); }, "incomplete_connection_coverage");
});

test("unknown minimums cannot become inferred feasibility or a fabricated constraint", () => {
  rejects((v) => { v.connections[0].minimumMinutes = 45; }, "invalid_connection_constraint");
  rejects((v) => { v.connections[0].state = "meets-stated-minimum"; }, "unsupported_connection_state");
});

test("an exact published minimum produces only a comparison and retains separate-ticket review", () => {
  clean(change((v) => {
    v.sources.push({ ...source(v, "source-connection-a"), id: "source-constraint-a", kind: "connection-constraint", issuerRef: "airport-ord", subjectRef: "connection-a", relatedRefs: ["leg-replacement", "leg-ord-bos"], minimumMinutes: 45, controlledRef: "controlled://flight/source-constraint-a" });
    v.scope.sourceRefs.push("source-constraint-a");
    Object.assign(v.connections[0], { constraintSourceRef: "source-constraint-a", minimumMinutes: 45, state: "below-stated-minimum" });
  }));
});

test("question ownership, exact gap coverage, and review readiness stay enforced", () => {
  rejects((v) => v.questions.pop(), "hidden_flight_gap");
  rejects((v) => { v.questions[0].ownerRef = "agency-one"; }, "hidden_flight_gap");
  rejects((v) => { v.review.state = "evidence-reconciled"; }, "premature_flight_readiness");
});

test("closed schema rejects secrets, hidden claims, and external actions", () => {
  for (const fn of [
    (v) => { v.review.recoveryClaim = true; }, (v) => { v.review.externalActions = "rebook"; },
    (v) => { v.review.ticketValidity = "valid"; }, (v) => { v.review.passengerRights = "refund-due"; },
    (v) => { v.allocations[0].ticketNumber = "1234567890123"; },
    (v) => { v.sources[0].controlledRef = "https://airline.example/booking?locator=secret"; },
  ]) assert.equal(validate(change(fn)), false);
});

test("collection ordering does not change evidence semantics", () => {
  clean(change((v) => { for (const key of ["allocations", "sources", "legs", "offers", "decisions", "coverage", "questions", "connections"]) v[key].reverse(); }));
});

test("an undisrupted single-leg record can reconcile without making a recovery claim", () => {
  clean(change((v) => {
    v.scope.travelerRefs = ["traveler-a"];
    v.scope.originalAllocationRefs = ["allocation-a-in"];
    v.scope.connectionRefs = [];
    v.scope.sourceRefs = ["source-a-in"];
    v.authorities = v.authorities.filter((row) => row.id !== "traveler-b");
    v.legs = [v.legs[0]]; v.allocations = [v.allocations[0]];
    v.sources = [source(v, "source-a-in")];
    for (const key of ["notices", "offers", "decisions", "connections", "questions"]) v[key] = [];
    v.coverage = [{ originalRef: "allocation-a-in", currentRef: "allocation-a-in", state: "unchanged-record" }];
    Object.assign(v.review, { state: "evidence-reconciled", partialParty: false, reissuedOriginalRefs: [], unresolvedOriginalRefs: [] });
  }));
});

test("both travelers may have independent reissues while downstream connections remain blocked", () => {
  clean(change((v) => {
    const allocation = { ...v.allocations[4], id: "allocation-b-new", travelerRef: "traveler-b", predecessorRef: "allocation-b-in", sourceRef: "source-reissue-b", offerRef: "offer-b", acceptanceRef: "decision-b" };
    v.allocations.push(allocation);
    v.sources.push({ ...source(v, "source-reissue-a"), id: "source-reissue-b", subjectRef: allocation.id, relatedRefs: ["traveler-b", "leg-replacement", "allocation-b-in", "offer-b", "decision-b"], controlledRef: "controlled://flight/source-reissue-b" });
    v.scope.sourceRefs.push("source-reissue-b");
    Object.assign(v.connections[1], { currentFromRef: allocation.id, intervalMinutes: -60 });
    Object.assign(v.coverage[2], { currentRef: allocation.id, state: "reissue-observed" });
    v.questions = v.questions.filter((row) => !["operating-change", "missing-reissue"].includes(row.reason));
    Object.assign(v.review, { reissuedOriginalRefs: ["allocation-a-in", "allocation-b-in"], unresolvedOriginalRefs: [], partialParty: false });
  }));
});

test("a connection minimum cannot be altered or attributed to another airport", () => {
  const v = change((v) => {
    v.sources.push({ ...source(v, "source-connection-a"), id: "source-constraint-a", kind: "connection-constraint", issuerRef: "airport-ord", subjectRef: "connection-a", relatedRefs: ["leg-replacement", "leg-ord-bos"], minimumMinutes: 45, controlledRef: "controlled://flight/source-constraint-a" });
    v.scope.sourceRefs.push("source-constraint-a");
    Object.assign(v.connections[0], { constraintSourceRef: "source-constraint-a", minimumMinutes: 45, state: "below-stated-minimum" });
  });
  clean(v);
  v.connections[0].minimumMinutes = 0;
  assert.ok(flightDisruptionFindings(v).some((row) => row.code === "invalid_connection_constraint"));
  v.connections[0].minimumMinutes = 45;
  v.authorities.find((row) => row.id === "airport-ord").airportCode = "LAX";
  assert.ok(flightDisruptionFindings(v).some((row) => row.code === "invalid_connection_constraint"));
});

test("a covered traveler cannot disappear from all original ticket allocations", () => {
  rejects((v) => {
    v.authorities.push({ id: "traveler-c", kind: "traveler", airportCode: null });
    v.scope.travelerRefs.push("traveler-c");
  }, "incomplete_allocation_coverage");
});

test("superseded evidence cannot silently change the linked journey records", () => {
  rejects((v) => {
    const prior = { ...source(v, "source-cancellation"), id: "source-cancel-prior", relatedRefs: ["leg-ord-bos"], controlledRef: "controlled://flight/source-cancel-prior", state: "superseded", assertedAt: "2026-10-10T10:00:00Z", observedAt: "2026-10-10T10:00:00Z" };
    source(v, "source-cancellation").supersedesRef = prior.id;
    v.sources.push(prior); v.scope.sourceRefs.push(prior.id);
  }, "invalid_source_lineage");
});
