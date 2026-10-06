import { Temporal } from "@js-temporal/polyfill";

const collections = ["authorities", "sources", "legs", "allocations", "notices", "offers", "decisions", "connections", "coverage", "questions"];
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const same = (a, b) => Array.isArray(a) && new Set(a).size === a.length && a.length === b.length && a.every((v) => b.includes(v));
const time = (v) => { try { return Temporal.Instant.from(v).epochMilliseconds; } catch { return NaN; } };

export function flightDisruptionFindings(value) {
  const findings = [];
  const fail = (code, path, message) => findings.push({ code, path, message });
  if (!object(value) || !object(value.scope) || !object(value.review) || collections.some((key) => !Array.isArray(value[key]) || value[key].some((row) => !object(row)))) {
    fail("invalid_flight_shape", "$", "A complete journey ledger is required.");
    return findings;
  }
  const { scope, review } = value;
  if (value.schemaVersion !== "awesomeClaws.flightDisruption.v1") fail("invalid_flight_shape", "schemaVersion", "Use the supported journey contract.");
  const maps = Object.fromEntries(collections.map((key) => [key, new Map(value[key].map((row) => [row.id, row]))]));
  const { authorities, sources, legs, allocations, offers, decisions } = maps;
  const ids = collections.filter((key) => key !== "coverage").flatMap((key) => value[key].map((row) => row.id));
  if (ids.some((id) => typeof id !== "string") || new Set(ids).size !== ids.length) fail("duplicate_flight_identity", "$", "Every record needs a globally unique alias.");
  const asOf = time(scope.asOf);
  if (!Number.isFinite(asOf)) fail("invalid_flight_chronology", "scope.asOf", "An exact offset-bearing review instant is required.");
  const travelers = value.authorities.filter((row) => row.kind === "traveler").map((row) => row.id);
  for (const authority of authorities.values()) {
    if (authority.kind === "airport" ? !/^[A-Z]{3}$/.test(authority.airportCode ?? "") : authority.airportCode !== null) fail("invalid_airport_authority", authority.id, "Only an airport authority carries its exact airport code.");
  }
  if (!travelers.length || !same(scope.travelerRefs, travelers) || !travelers.includes(scope.ownerRef) ||
      !same(scope.helperRefs, value.authorities.filter((row) => row.kind === "helper").map((row) => row.id)) || scope.destination !== "private-owner-workspace") {
    fail("invalid_traveler_authority", "scope", "Use exactly the covered travelers and helpers, with a traveler retaining review ownership.");
  }
  const roots = value.allocations.filter((row) => row.predecessorRef === null);
  for (const traveler of travelers) if (!roots.some((row) => row.travelerRef === traveler)) fail("incomplete_allocation_coverage", traveler, "Every covered traveler needs at least one inventoried original ticket allocation.");
  if (!roots.length || !same(scope.originalAllocationRefs, roots.map((row) => row.id)) ||
      !same(scope.connectionRefs, value.connections.map((row) => row.id)) || !same(scope.sourceRefs, [...sources.keys()])) {
    fail("incomplete_journey_index", "scope", "Preserve every original allocation, dependency, and source revision.");
  }
  const expectedQuestions = new Set();
  const question = (target, reason) => expectedQuestions.add(`${target}:${reason}`);
  const current = (source) => source && source.state === "current" && (source.expiresAt === null || time(source.expiresAt) > asOf);
  const known = new Set(ids);
  const successors = new Map();
  const usedSources = new Set();
  const evidence = (ref, kind, subject, issuer, related, mustBeCurrent = true) => {
    const source = sources.get(ref);
    usedSources.add(ref);
    if (!source || source.kind !== kind || source.subjectRef !== subject || source.issuerRef !== issuer || !same(source.relatedRefs, related) ||
        (mustBeCurrent && !current(source))) {
      fail("invalid_flight_evidence", `${subject}.sourceRef`, "Evidence must bind the exact subject, issuer, related records, kind, and required freshness.");
    }
    return source;
  };
  const sourceKinds = {
    "ticket-original": ["ticket-issuer"], "ticket-reissue": ["ticket-issuer"], "operating-notice": ["operating-carrier"],
    "carrier-offer": ["operating-carrier"], "traveler-decision": ["traveler"], "connection-dependency": ["traveler", "ticket-issuer"],
    "connection-constraint": ["airport", "operating-carrier", "ticket-issuer"],
  };
  const controlled = new Set();
  for (const source of sources.values()) {
    const path = `sources.${source.id}`;
    if (!sourceKinds[source.kind]?.includes(authorities.get(source.issuerRef)?.kind) || !known.has(source.subjectRef) ||
        !Array.isArray(source.relatedRefs) || source.relatedRefs.some((id) => !known.has(id))) fail("invalid_source_scope", path, "Sources require an appropriate issuer and exact in-journey references.");
    if (!/^controlled:\/\/flight\/source-[a-z0-9-]{1,48}$/.test(source.controlledRef ?? "") || controlled.has(source.controlledRef)) fail("unsafe_flight_source", path, "Use distinct minimized controlled references, without locators or ticket numbers.");
    controlled.add(source.controlledRef);
    const asserted = time(source.assertedAt), observed = time(source.observedAt), expires = time(source.expiresAt);
    if (source.kind === "connection-constraint" ? !Number.isInteger(source.minimumMinutes) || source.minimumMinutes < 0 : source.minimumMinutes !== null) fail("invalid_connection_constraint", path, "Only a connection-constraint source carries an explicit nonnegative minimum.");
    if (!Number.isFinite(asserted) || !Number.isFinite(observed) || asserted > observed || observed > asOf ||
        (source.expiresAt !== null && (!Number.isFinite(expires) || expires <= asserted))) fail("invalid_flight_chronology", path, "Require asserted <= observed <= as-of and expiry after assertion.");
    if (!current(source) && source.state !== "superseded") question(source.id, "evidence-not-current");
    if (source.supersedesRef !== null) {
      const prior = sources.get(source.supersedesRef);
      if (!prior || prior.state !== "superseded" || prior.kind !== source.kind || prior.issuerRef !== source.issuerRef ||
          prior.subjectRef !== source.subjectRef || !same(prior.relatedRefs, Array.isArray(source.relatedRefs) ? source.relatedRefs : []) || time(prior.assertedAt) >= asserted || successors.has(prior.id)) fail("invalid_source_lineage", path, "Retain an exact same-subject, same-issuer, same-related-records chronological source chain.");
      successors.set(source.supersedesRef, source.id);
    }
  }
  for (const source of sources.values()) if (source.state === "superseded" && !successors.has(source.id)) fail("invalid_source_lineage", source.id, "A superseded source needs its successor.");
  const flightKeys = new Set();
  for (const leg of legs.values()) {
    const key = [leg.operatingCarrierRef, leg.flightNumber, leg.serviceDate, leg.origin, leg.destination, leg.departureAt, leg.arrivalAt].join(":");
    if (flightKeys.has(key)) fail("duplicate_flight_service", leg.id, "Do not duplicate an identical dated operating schedule under another identity.");
    flightKeys.add(key);
    if (authorities.get(leg.operatingCarrierRef)?.kind !== "operating-carrier" || leg.origin === leg.destination) fail("invalid_operating_service", leg.id, "Keep operating carrier and distinct route endpoints explicit.");
    try {
      const departure = Temporal.ZonedDateTime.from(`${leg.departureAt}[${leg.departureZone}]`, { offset: "reject" });
      const arrival = Temporal.ZonedDateTime.from(`${leg.arrivalAt}[${leg.arrivalZone}]`, { offset: "reject" });
      if (departure.toPlainDate().toString() !== leg.serviceDate || arrival.epochMilliseconds <= departure.epochMilliseconds) throw new Error("Invalid flight dates");
    } catch { fail("invalid_flight_service_date", leg.id, "Service date is the departure airport's local date; offsets must match named zones and arrival follows departure."); }
  }
  const next = new Map();
  const originalKeys = new Set();
  for (const allocation of allocations.values()) {
    const { id, travelerRef, legRef, ticketIssuerRef, predecessorRef, offerRef, acceptanceRef } = allocation;
    if (!travelers.includes(travelerRef) || !legs.has(legRef) || authorities.get(ticketIssuerRef)?.kind !== "ticket-issuer") fail("invalid_ticket_scope", id, "Each allocation names a covered traveler, exact leg, and independent ticket issuer.");
    if (predecessorRef === null) {
      const key = `${travelerRef}:${legRef}`;
      if (originalKeys.has(key) || offerRef !== null || acceptanceRef !== null) fail("invalid_original_allocation", id, "Original allocations are unique traveler-leg pairs without recovery claims.");
      originalKeys.add(key);
      evidence(allocation.sourceRef, "ticket-original", id, ticketIssuerRef, [travelerRef, legRef], false);
    } else {
      const prior = allocations.get(predecessorRef), offer = offers.get(offerRef), acceptance = decisions.get(acceptanceRef);
      if (!prior || prior.travelerRef !== travelerRef || prior.ticketIssuerRef !== ticketIssuerRef || prior.ticketGroupRef !== allocation.ticketGroupRef ||
          prior.legRef === legRef || next.has(predecessorRef)) fail("invalid_ticket_lineage", id, "Each predecessor has at most one same-traveler, same-ticket successor.");
      next.set(predecessorRef, id);
      if (!offer || offer.predecessorRef !== predecessorRef || offer.travelerRef !== travelerRef || offer.replacementLegRef !== legRef ||
          !acceptance || acceptance.offerRef !== offerRef || acceptance.travelerRef !== travelerRef || acceptance.state !== "accepted") fail("unsupported_ticket_reissue", id, "An offer and the exact traveler's acceptance must precede an independent reissue.");
      const source = evidence(allocation.sourceRef, "ticket-reissue", id, ticketIssuerRef, [travelerRef, legRef, predecessorRef, offerRef, acceptanceRef]);
      if (source && (time(source.assertedAt) < time(acceptance?.decidedAt) || time(source.assertedAt) <= time(sources.get(prior?.sourceRef)?.assertedAt))) fail("invalid_ticket_lineage", id, "Reissues follow acceptance and the predecessor ticket evidence.");
    }
  }
  const leaf = (id) => {
    const seen = new Set();
    while (next.has(id)) {
      if (seen.has(id)) { fail("invalid_ticket_lineage", id, "Ticket replacement history must be acyclic."); return id; }
      seen.add(id); id = next.get(id);
    }
    return id;
  };
  const reachable = new Set();
  for (const root of roots) {
    let id = root.id;
    while (!reachable.has(id) && allocations.has(id)) { reachable.add(id); if (!next.has(id)) break; id = next.get(id); }
    leaf(root.id);
  }
  if (reachable.size !== allocations.size) fail("invalid_ticket_lineage", "allocations", "Every allocation must descend from an inventoried original.");
  const usedLegs = new Set([...value.allocations.map((row) => row.legRef), ...value.offers.map((row) => row.replacementLegRef)]);
  if (!same([...usedLegs], [...legs.keys()])) fail("incomplete_leg_coverage", "legs", "Every leg belongs to an original allocation or a supplied replacement offer.");
  const changedLegs = new Set();
  for (const notice of value.notices) {
    const leg = legs.get(notice.legRef);
    if (!leg || ["operatingCarrierRef", "flightNumber", "serviceDate", "origin", "destination"].some((key) => notice[key] !== leg[key])) fail("invalid_operating_notice", notice.id, "A notice applies only to the exact operating service, route, and local date.");
    evidence(notice.sourceRef, "operating-notice", notice.id, leg?.operatingCarrierRef, [notice.legRef], false);
    if (current(sources.get(notice.sourceRef))) changedLegs.add(notice.legRef);
  }
  const decisionsByOffer = new Map();
  for (const decision of decisions.values()) {
    const offer = offers.get(decision.offerRef);
    const source = evidence(decision.sourceRef, "traveler-decision", decision.id, decision.travelerRef, [decision.offerRef]);
    if (!offer || decision.travelerRef !== offer.travelerRef || time(decision.decidedAt) !== time(source?.assertedAt) ||
        time(decision.decidedAt) < time(sources.get(offer?.sourceRef)?.assertedAt) ||
        (decision.state === "accepted" && time(decision.decidedAt) >= time(offer?.expiresAt))) fail("invalid_traveler_decision", decision.id, "Only the exact traveler can accept the exact offer within its published window.");
    decisionsByOffer.set(decision.offerRef, [...(decisionsByOffer.get(decision.offerRef) ?? []), decision]);
  }
  const pending = new Set();
  const impacted = new Set();
  for (const offer of offers.values()) {
    const prior = allocations.get(offer.predecessorRef), replacement = legs.get(offer.replacementLegRef);
    const issuer = sources.get(offer.sourceRef)?.issuerRef;
    const originalLeg = legs.get(prior?.legRef);
    const source = evidence(offer.sourceRef, "carrier-offer", offer.id, issuer, [offer.travelerRef, offer.predecessorRef, offer.replacementLegRef], false);
    if (!prior || prior.travelerRef !== offer.travelerRef || !replacement || issuer !== originalLeg?.operatingCarrierRef ||
        replacement.origin !== originalLeg?.origin || replacement.destination !== originalLeg?.destination ||
        offer.expiresAt !== source?.expiresAt) fail("invalid_carrier_offer", offer.id, "A scoped offer preserves traveler and displaced route, with exact carrier-issued expiry.");
    const choices = decisionsByOffer.get(offer.id) ?? [];
    if (choices.length > 1) question(offer.id, "conflicting-decisions");
    const confirmed = value.allocations.some((row) => row.offerRef === offer.id);
    if (confirmed && choices.length !== 1) fail("unsupported_ticket_reissue", offer.id, "Conflicting decisions cannot support a reissue disposition.");
    if (!confirmed && choices.some((row) => row.state === "accepted")) { question(offer.id, "missing-reissue"); pending.add(offer.predecessorRef); }
    if (!choices.length) question(offer.id, time(offer.expiresAt) <= asOf ? "offer-expired" : "offer-awaiting-owner");
    if (source?.state !== "current" && confirmed) fail("unsupported_ticket_reissue", offer.id, "Conflicting or superseded offers cannot support a reissue.");
    impacted.add(offer.predecessorRef);
  }
  for (const allocation of allocations.values()) if (changedLegs.has(allocation.legRef)) impacted.add(allocation.id);
  const reissued = [], unresolved = [];
  if (!same(value.coverage.map((row) => row.originalRef), roots.map((row) => row.id))) fail("incomplete_allocation_coverage", "coverage", "Every original traveler allocation needs exactly one disposition.");
  for (const root of roots) {
    const currentRef = leaf(root.id), allocation = allocations.get(currentRef);
    const operatingChange = changedLegs.has(allocation?.legRef);
    if (operatingChange) question(currentRef, "operating-change");
    const state = operatingChange ? "operating-change" : pending.has(currentRef) ? "pending-reissue" : currentRef !== root.id ? "reissue-observed" : "unchanged-record";
    const record = value.coverage.find((row) => row.originalRef === root.id);
    if (!record || record.currentRef !== currentRef || record.state !== state) fail("unsupported_allocation_disposition", root.id, "Derive the exact current leaf; operating changes and pending reissues remain unresolved.");
    if (currentRef !== root.id) reissued.push(root.id);
    if (operatingChange || pending.has(currentRef) || !current(sources.get(allocation?.sourceRef))) unresolved.push(root.id);
  }
  const connectionPairs = new Set();
  for (const connection of value.connections) {
    const from = allocations.get(connection.originalFromRef), to = allocations.get(connection.originalToRef);
    const a = allocations.get(leaf(connection.originalFromRef)), b = allocations.get(leaf(connection.originalToRef));
    const arrival = legs.get(a?.legRef), departure = legs.get(b?.legRef);
    const pair = `${connection.originalFromRef}:${connection.originalToRef}`;
    if (!from || !to || from.id === to.id || from.predecessorRef !== null || to.predecessorRef !== null || from.travelerRef !== to.travelerRef ||
        connectionPairs.has(pair) || time(legs.get(from.legRef)?.departureAt) >= time(legs.get(to.legRef)?.departureAt)) fail("invalid_connection_dependency", connection.id, "Dependencies join distinct chronological original allocations for one traveler.");
    connectionPairs.add(pair);
    const dependency = sources.get(connection.dependencySourceRef);
    if (dependency?.issuerRef !== from?.travelerRef && dependency?.issuerRef !== from?.ticketIssuerRef) fail("invalid_connection_dependency", connection.id, "The traveler or exact ticket issuer supplies the original dependency.");
    evidence(connection.dependencySourceRef, "connection-dependency", connection.id, dependency?.issuerRef, [connection.originalFromRef, connection.originalToRef], false);
    const relationship = from?.ticketGroupRef === to?.ticketGroupRef && from?.ticketIssuerRef === to?.ticketIssuerRef ? "same-ticket" : "separate-ticket";
    if (connection.relationship !== relationship || connection.currentFromRef !== a?.id || connection.currentToRef !== b?.id) fail("stale_connection_endpoints", connection.id, "Recompute connection endpoints from both current ticket leaves and preserve separate-ticket relationships.");
    const interval = (time(departure?.departureAt) - time(arrival?.arrivalAt)) / 60000;
    if (!Number.isFinite(interval) || connection.intervalMinutes !== interval) fail("incorrect_connection_interval", connection.id, "Subtract exact instants, not local clock labels.");
    let state = arrival?.destination !== departure?.origin ? "airport-transfer-unresolved" : "unknown-constraint";
    if (connection.constraintSourceRef !== null) {
      const constraint = sources.get(connection.constraintSourceRef);
      evidence(connection.constraintSourceRef, "connection-constraint", connection.id, constraint?.issuerRef, [a?.legRef, b?.legRef]);
      const issuer = authorities.get(constraint?.issuerRef);
      const scopedIssuer = issuer?.kind === "airport" ? issuer.airportCode === arrival?.destination && issuer.airportCode === departure?.origin
        : [arrival?.operatingCarrierRef, departure?.operatingCarrierRef, a?.ticketIssuerRef, b?.ticketIssuerRef].includes(issuer?.id);
      if (!scopedIssuer || !Number.isInteger(connection.minimumMinutes) || connection.minimumMinutes < 0 || connection.minimumMinutes !== constraint?.minimumMinutes) fail("invalid_connection_constraint", connection.id, "Copy the exact minimum from this connection's airport, operating carrier, or ticket issuer.");
      if (state !== "airport-transfer-unresolved") state = interval < connection.minimumMinutes ? "below-stated-minimum" : "meets-stated-minimum";
    } else if (connection.minimumMinutes !== null) fail("invalid_connection_constraint", connection.id, "Do not invent a minimum without exact connection evidence.");
    if (connection.state !== state) fail("unsupported_connection_state", connection.id, "Only compare to a supplied minimum; this does not establish feasibility or protection.");
    if (state !== "meets-stated-minimum") question(connection.id, "connection-review");
    if (relationship === "separate-ticket") question(connection.id, "separate-ticket-review");
  }
  // Adjacent original legs create a required dependency even if the supplied index omits it.
  for (const traveler of travelers) {
    const journey = roots.filter((row) => row.travelerRef === traveler).sort((a, b) => time(legs.get(a.legRef)?.departureAt) - time(legs.get(b.legRef)?.departureAt));
    for (let i = 1; i < journey.length; i++) if (!connectionPairs.has(`${journey[i - 1].id}:${journey[i].id}`)) fail("incomplete_connection_coverage", traveler, "Inventory every adjacent original-leg dependency, including separately ticketed legs.");
  }
  for (const source of sources.values()) if (!usedSources.has(source.id) && source.state !== "superseded") fail("unconsumed_flight_evidence", source.id, "Every current or conflicting source must remain attached to its record.");
  const actualQuestions = value.questions.map((row) => `${row.targetRef}:${row.reason}`);
  if (!same(actualQuestions, [...expectedQuestions]) || value.questions.some((row) => row.ownerRef !== scope.ownerRef)) fail("hidden_flight_gap", "questions", "Every derived gap needs exactly one traveler-owned question.");
  const impactedRoots = roots.filter((root) => {
    let id = root.id; const seen = new Set();
    while (!seen.has(id)) { if (impacted.has(id)) return true; seen.add(id); if (!next.has(id)) break; id = next.get(id); }
    return false;
  });
  const impactedTravelers = [...new Set(impactedRoots.map((row) => row.travelerRef))];
  const travelerReissues = impactedTravelers.map((traveler) => impactedRoots
    .filter((row) => row.travelerRef === traveler).every((row) => reissued.includes(row.id)));
  const partial = travelerReissues.some(Boolean) && travelerReissues.some((complete) => !complete);
  if (!same(review.reissuedOriginalRefs, reissued) || !same(review.unresolvedOriginalRefs, unresolved) || review.partialParty !== partial) fail("incorrect_recovery_summary", "review", "Summarize exact original traveler allocations, including partial-party outcomes.");
  if (review.externalActions !== "none" || review.ticketValidity !== "not-determined" || review.connectionFeasibility !== "not-determined" ||
      review.passengerRights !== "not-determined" || review.recoveryClaim !== false) fail("prohibited_flight_authority", "review", "No execution, ticket validity, feasibility, passenger-rights, or recovered-journey claim is authorized.");
  if (review.state !== (expectedQuestions.size || findings.length ? "blocked" : "evidence-reconciled")) fail("premature_flight_readiness", "review.state", "Any unresolved evidence or invalid contract blocks the handoff.");
  return findings;
}
