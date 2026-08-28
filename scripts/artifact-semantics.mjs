import { createHash } from "node:crypto";

function finding(code, path, message) {
  return { code, path, message };
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeChangePlanDigest(plan) {
  const { digest: _digest, ...digestInput } = plan;
  return createHash("sha256").update(canonicalJson(digestInput)).digest("hex");
}

function duplicates(values) {
  const seen = new Set();
  return [...new Set(values.filter((value) => seen.size === seen.add(value).size))];
}

function uniqueFindings(values, path, label) {
  return duplicates(values).map((value) =>
    finding("duplicate_reference", path, `${label} ${JSON.stringify(value)} is duplicated.`),
  );
}

function referenceFindings(values, allowed, path, label) {
  return values
    .filter((value) => !allowed.has(value))
    .map((value) =>
      finding("dangling_reference", path, `${label} ${JSON.stringify(value)} does not resolve.`),
    );
}

function numbersEqual(left, right) {
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= Number.EPSILON * scale * 8;
}

function dataAnalysisFindings(value) {
  const sourceRefs = value.sources.map((source) => source.reference);
  const outputFields = value.transformations.map((transformation) => transformation.outputField);
  const metricNames = value.metrics.map((metric) => metric.name);
  const lineage = new Set([...sourceRefs, ...outputFields]);
  const findings = [
    ...uniqueFindings(sourceRefs, "sources", "Source reference"),
    ...uniqueFindings(outputFields, "transformations", "Transformation output"),
    ...uniqueFindings(metricNames, "metrics", "Metric name"),
  ];
  for (const [index, transformation] of value.transformations.entries()) {
    findings.push(
      ...referenceFindings(
        [transformation.inputRef],
        lineage,
        `transformations.${index}.inputRef`,
        "Transformation input",
      ),
    );
  }
  for (const [index, metric] of value.metrics.entries()) {
    findings.push(
      ...uniqueFindings(metric.lineageRefs, `metrics.${index}.lineageRefs`, "Lineage reference"),
      ...referenceFindings(
        metric.lineageRefs,
        lineage,
        `metrics.${index}.lineageRefs`,
        "Lineage reference",
      ),
    );
  }
  const metrics = new Set(metricNames);
  for (const [index, item] of value.findings.entries()) {
    findings.push(
      ...uniqueFindings(item.metricRefs, `findings.${index}.metricRefs`, "Metric reference"),
      ...referenceFindings(
        item.metricRefs,
        metrics,
        `findings.${index}.metricRefs`,
        "Metric reference",
      ),
    );
  }
  return findings;
}

function projectFindings(value) {
  const milestoneIds = value.milestones.map((milestone) => milestone.id);
  const known = new Set(milestoneIds);
  const findings = uniqueFindings(milestoneIds, "milestones", "Milestone id");
  const graph = new Map();
  for (const [index, milestone] of value.milestones.entries()) {
    findings.push(
      ...uniqueFindings(
        milestone.dependencies,
        `milestones.${index}.dependencies`,
        "Milestone dependency",
      ),
      ...referenceFindings(
        milestone.dependencies,
        known,
        `milestones.${index}.dependencies`,
        "Milestone dependency",
      ),
    );
    if (milestone.dependencies.includes(milestone.id)) {
      findings.push(
        finding(
          "dependency_cycle",
          `milestones.${index}.dependencies`,
          `Milestone ${JSON.stringify(milestone.id)} cannot depend on itself.`,
        ),
      );
    }
    graph.set(milestone.id, milestone.dependencies.filter((dependency) => known.has(dependency)));
  }
  const visited = new Set();
  const active = new Set();
  function visit(id) {
    if (active.has(id)) {
      findings.push(
        finding("dependency_cycle", "milestones", `Milestone dependency cycle reaches ${id}.`),
      );
      return;
    }
    if (visited.has(id)) {
      return;
    }
    active.add(id);
    for (const dependency of graph.get(id) ?? []) {
      visit(dependency);
    }
    active.delete(id);
    visited.add(id);
  }
  for (const id of milestoneIds) {
    visit(id);
  }
  return findings;
}

function productFindings(value) {
  const evidenceRefs = value.evidence.map((evidence) => evidence.reference);
  const known = new Set(evidenceRefs);
  const findings = uniqueFindings(evidenceRefs, "evidence", "Evidence reference");
  const evidenceByRef = new Map(
    value.evidence.map((evidence) => [evidence.reference, evidence]),
  );
  for (const [index, option] of value.options.entries()) {
    findings.push(
      ...uniqueFindings(option.evidenceRefs, `options.${index}.evidenceRefs`, "Evidence reference"),
      ...referenceFindings(
        option.evidenceRefs,
        known,
        `options.${index}.evidenceRefs`,
        "Evidence reference",
      ),
    );
    if (
      option.state === "recommended" &&
      !option.evidenceRefs.some((reference) => evidenceByRef.get(reference)?.state === "supported")
    ) {
      findings.push(
        finding(
          "unsupported_terminal_state",
          `options.${index}.state`,
          "A recommended option requires at least one supported evidence reference.",
        ),
      );
    }
  }
  return findings;
}

function researchFindings(value) {
  const claimRefs = value.claims.map((claim) => claim.claim);
  const known = new Set(claimRefs);
  const findings = uniqueFindings(claimRefs, "claims", "Claim");
  for (const [index, option] of value.options.entries()) {
    findings.push(
      ...uniqueFindings(option.claimRefs, `options.${index}.claimRefs`, "Claim reference"),
      ...referenceFindings(
        option.claimRefs,
        known,
        `options.${index}.claimRefs`,
        "Claim reference",
      ),
    );
  }
  return findings;
}

function financialAnalysisFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const assumptionIds = value.assumptions.map((item) => item.id);
  const scenarioIds = value.scenarios.map((item) => item.id);
  const sources = new Set(sourceIds);
  const assumptions = new Set(assumptionIds);
  const scenarios = new Set(scenarioIds);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(assumptionIds, "assumptions", "Assumption id"),
    ...uniqueFindings(scenarioIds, "scenarios", "Scenario id"),
    ...uniqueFindings(value.risks.map((item) => item.id), "risks", "Risk id"),
  ];
  for (const [index, assumption] of value.assumptions.entries()) {
    findings.push(
      ...uniqueFindings(assumption.sourceRefs, `assumptions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(
        assumption.sourceRefs,
        sources,
        `assumptions.${index}.sourceRefs`,
        "Source reference",
      ),
    );
  }
  for (const [index, scenario] of value.scenarios.entries()) {
    findings.push(
      ...uniqueFindings(
        scenario.assumptionRefs,
        `scenarios.${index}.assumptionRefs`,
        "Assumption reference",
      ),
      ...referenceFindings(
        scenario.assumptionRefs,
        assumptions,
        `scenarios.${index}.assumptionRefs`,
        "Assumption reference",
      ),
    );
  }
  for (const [index, risk] of value.risks.entries()) {
    findings.push(
      ...uniqueFindings(risk.sourceRefs, `risks.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(risk.sourceRefs, sources, `risks.${index}.sourceRefs`, "Source reference"),
      ...uniqueFindings(
        risk.scenarioRefs,
        `risks.${index}.scenarioRefs`,
        "Scenario reference",
      ),
      ...referenceFindings(
        risk.scenarioRefs,
        scenarios,
        `risks.${index}.scenarioRefs`,
        "Scenario reference",
      ),
    );
  }
  return findings;
}

function personalArchiveFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const itemIds = value.items.map((item) => item.id);
  const collectionIds = value.collections.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const itemSet = new Set(itemIds);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(itemIds, "items", "Archive item id"),
    ...uniqueFindings(collectionIds, "collections", "Collection id"),
    ...uniqueFindings(value.duplicates.map((item) => item.id), "duplicates", "Duplicate id"),
    ...uniqueFindings(value.retrievalCues.map((item) => item.id), "retrievalCues", "Retrieval cue id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, item] of value.items.entries()) {
    findings.push(
      ...uniqueFindings(item.sourceRefs, `items.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `items.${index}.sourceRefs`, "Source reference"),
    );
    if (
      ["sensitive", "location-sensitive", "account-sensitive", "face-sensitive", "valuable-sensitive"].includes(item.privacy) &&
      item.pathDisclosure === "owner-visible-path"
    ) {
      findings.push(finding("private_path_disclosure", `items.${index}.pathDisclosure`, "Sensitive archive items cannot expose owner-visible paths in general handoffs."));
    }
    if (["photo", "memory"].includes(item.kind) && item.retentionState !== "do-not-delete") {
      findings.push(finding("unsafe_retention_state", `items.${index}.retentionState`, "Photo and memory archive items require do-not-delete retention until the owner reviews them."));
    }
  }
  for (const [index, collection] of value.collections.entries()) {
    findings.push(
      ...uniqueFindings(collection.itemRefs, `collections.${index}.itemRefs`, "Archive item reference"),
      ...referenceFindings(collection.itemRefs, itemSet, `collections.${index}.itemRefs`, "Archive item reference"),
    );
  }
  for (const [index, duplicate] of value.duplicates.entries()) {
    findings.push(
      ...uniqueFindings(duplicate.itemRefs, `duplicates.${index}.itemRefs`, "Archive item reference"),
      ...referenceFindings(duplicate.itemRefs, itemSet, `duplicates.${index}.itemRefs`, "Archive item reference"),
    );
    if (duplicate.action !== "owner-review") {
      findings.push(finding("unsupported_duplicate_action", `duplicates.${index}.action`, "Duplicate findings must remain owner-review only and cannot authorize cleanup."));
    }
  }
  for (const [index, cue] of value.retrievalCues.entries()) {
    findings.push(
      ...uniqueFindings(cue.itemRefs, `retrievalCues.${index}.itemRefs`, "Archive item reference"),
      ...referenceFindings(cue.itemRefs, itemSet, `retrievalCues.${index}.itemRefs`, "Archive item reference"),
      ...uniqueFindings(cue.sourceRefs, `retrievalCues.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(cue.sourceRefs, sourceSet, `retrievalCues.${index}.sourceRefs`, "Source reference"),
    );
    const hasSupportedNeedSource = cue.sourceRefs.some((ref) => {
      const source = value.sources.find((item) => item.id === ref);
      return source && (
        (cue.need === "receipt" && source.kind === "receipt-list") ||
        (cue.need === "warranty" && ["warranty-record", "receipt-list"].includes(source.kind)) ||
        (cue.need === "photo" && source.kind === "photo-description") ||
        (cue.need === "memory" && source.kind === "owner-memory-note") ||
        !["receipt", "warranty", "photo", "memory"].includes(cue.need)
      );
    });
    if (!hasSupportedNeedSource) {
      findings.push(finding("unsupported_retrieval_source", `retrievalCues.${index}.sourceRefs`, "Retrieval cues require source evidence matching the retrieval need."));
    }
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.itemRefs, `reviewQuestions.${index}.itemRefs`, "Archive item reference"),
      ...referenceFindings(question.itemRefs, itemSet, `reviewQuestions.${index}.itemRefs`, "Archive item reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready archive indexes cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    collections: value.collections.map(({ proposedFolder, rationale }) => ({ proposedFolder, rationale })),
    duplicates: value.duplicates.map(({ reason, action }) => ({ reason, action })),
    retrievalCues: value.retrievalCues.map(({ cue }) => cue),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(delete|rename|upload|publish|change permissions|train memory|face recognition|identify faces|infer|private path|exact path|full path|move file|move files|share file|share files)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Archive artifacts must not instruct file mutation, sharing, upload, memory training, face recognition, private path exposure, or sensitive inference."));
  }
  if (value.handoff.owner === "personal-archive-curator") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Archive deletion, movement, sharing, upload, permission, memory, biometric, and sensitive-inference decisions must remain with the named owner."));
  }
  return findings;
}

function restaurantVenueFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const venueIds = value.venues.map((item) => item.id);
  const constraintIds = value.constraints.map((item) => item.id);
  const availabilityIds = value.availability.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const venueSet = new Set(venueIds);
  const constraintSet = new Set(constraintIds);
  const availabilitySet = new Set(availabilityIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const availabilityById = new Map(value.availability.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(venueIds, "venues", "Venue id"),
    ...uniqueFindings(constraintIds, "constraints", "Constraint id"),
    ...uniqueFindings(availabilityIds, "availability", "Availability id"),
    ...uniqueFindings(value.shortlist.map((item) => item.id), "shortlist", "Shortlist id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, venue] of value.venues.entries()) {
    findings.push(
      ...uniqueFindings(venue.sourceRefs, `venues.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(venue.sourceRefs, sourceSet, `venues.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, constraint] of value.constraints.entries()) {
    findings.push(
      ...uniqueFindings(constraint.sourceRefs, `constraints.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(constraint.sourceRefs, sourceSet, `constraints.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, row] of value.availability.entries()) {
    findings.push(
      ...referenceFindings([row.venueRef], venueSet, `availability.${index}.venueRef`, "Venue reference"),
      ...uniqueFindings(row.sourceRefs, `availability.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(row.sourceRefs, sourceSet, `availability.${index}.sourceRefs`, "Source reference"),
    );
    const hasSupportedSource = row.sourceRefs.some((ref) =>
      ["official-page", "menu", "reservation-page", "accessibility-note", "dietary-note"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasSupportedSource) {
      findings.push(finding("unsupported_availability_source", `availability.${index}.sourceRefs`, "Venue availability requires official, menu, reservation, dietary, or accessibility evidence."));
    }
  }
  for (const [index, pick] of value.shortlist.entries()) {
    findings.push(
      ...referenceFindings([pick.venueRef], venueSet, `shortlist.${index}.venueRef`, "Venue reference"),
      ...referenceFindings([pick.availabilityRef], availabilitySet, `shortlist.${index}.availabilityRef`, "Availability reference"),
      ...uniqueFindings(pick.constraintRefs, `shortlist.${index}.constraintRefs`, "Constraint reference"),
      ...referenceFindings(pick.constraintRefs, constraintSet, `shortlist.${index}.constraintRefs`, "Constraint reference"),
    );
    const availability = availabilityById.get(pick.availabilityRef);
    if (availability && availability.venueRef !== pick.venueRef) {
      findings.push(finding("availability_venue_mismatch", `shortlist.${index}.availabilityRef`, "Shortlist availability must belong to the same venue."));
    }
    const requiredConstraints = value.constraints.filter((constraint) => constraint.required);
    const missingRequired = requiredConstraints.some((constraint) => !pick.constraintRefs.includes(constraint.id));
    if (
      pick.state === "recommended" &&
      (!availability ||
        missingRequired ||
        availability.hoursState !== "open-in-window" ||
        !["slot-visible", "walk-in-only"].includes(availability.reservationState) ||
        availability.dietaryState !== "supported" ||
        availability.accessibilityState !== "supported")
    ) {
      findings.push(finding("unsupported_recommendation", `shortlist.${index}`, "Recommended venues require current open-window, dietary, accessibility, and required-constraint support."));
    }
    if (
      (pick.state === "blocked" && !pick.blockedReason) ||
      (pick.state !== "blocked" && pick.blockedReason !== null)
    ) {
      findings.push(finding("incoherent_blocked_state", `shortlist.${index}.blockedReason`, "Only blocked venue shortlist items may carry a blocked reason."));
    }
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.venueRefs, `reviewQuestions.${index}.venueRefs`, "Venue reference"),
      ...referenceFindings(question.venueRefs, venueSet, `reviewQuestions.${index}.venueRefs`, "Venue reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready venue shortlists cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    shortlist: value.shortlist.map(({ fitReason, blockedReason }) => ({ fitReason, blockedReason })),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(reserve|make a reservation|book|join waitlist|order|pay|tip|message|call|calendar|post review|leave review|share location|allergen safe|allergy safe|guaranteed accessible)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Venue artifacts must not instruct reservations, orders, payments, messages, calls, calendar edits, review posting, location sharing, or unsupported dietary/accessibility certainty."));
  }
  if (value.handoff.owner === "restaurant-venue-scout") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Reservation, ordering, payment, messaging, calendar, location-sharing, and review-posting decisions must remain with the named owner."));
  }
  return findings;
}

function localEventsFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const venueIds = value.venues.map((item) => item.id);
  const constraintIds = value.constraints.map((item) => item.id);
  const eventIds = value.events.map((item) => item.id);
  const ticketingIds = value.ticketing.map((item) => item.id);
  const conflictIds = value.conflicts.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const venueSet = new Set(venueIds);
  const constraintSet = new Set(constraintIds);
  const eventSet = new Set(eventIds);
  const ticketingSet = new Set(ticketingIds);
  const conflictSet = new Set(conflictIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const eventById = new Map(value.events.map((item) => [item.id, item]));
  const ticketingById = new Map(value.ticketing.map((item) => [item.id, item]));
  const conflictById = new Map(value.conflicts.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(venueIds, "venues", "Venue id"),
    ...uniqueFindings(constraintIds, "constraints", "Constraint id"),
    ...uniqueFindings(eventIds, "events", "Event id"),
    ...uniqueFindings(ticketingIds, "ticketing", "Ticketing id"),
    ...uniqueFindings(conflictIds, "conflicts", "Conflict id"),
    ...uniqueFindings(value.watchlist.map((item) => item.id), "watchlist", "Watchlist id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, venue] of value.venues.entries()) {
    findings.push(
      ...uniqueFindings(venue.sourceRefs, `venues.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(venue.sourceRefs, sourceSet, `venues.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, constraint] of value.constraints.entries()) {
    findings.push(
      ...uniqueFindings(constraint.sourceRefs, `constraints.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(constraint.sourceRefs, sourceSet, `constraints.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, event] of value.events.entries()) {
    findings.push(
      ...referenceFindings([event.venueRef], venueSet, `events.${index}.venueRef`, "Venue reference"),
      ...uniqueFindings(event.sourceRefs, `events.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(event.sourceRefs, sourceSet, `events.${index}.sourceRefs`, "Source reference"),
    );
    const hasSupportedSource = event.sourceRefs.some((ref) =>
      ["official-event-page", "venue-page", "calendar-listing", "community-feed", "school-notice", "accessibility-note"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasSupportedSource) {
      findings.push(finding("unsupported_event_source", `events.${index}.sourceRefs`, "Event facts require official, venue, calendar, community, school, or accessibility evidence."));
    }
  }
  for (const [index, row] of value.ticketing.entries()) {
    findings.push(
      ...referenceFindings([row.eventRef], eventSet, `ticketing.${index}.eventRef`, "Event reference"),
      ...uniqueFindings(row.sourceRefs, `ticketing.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(row.sourceRefs, sourceSet, `ticketing.${index}.sourceRefs`, "Source reference"),
    );
    const hasTicketingSource = row.sourceRefs.some((ref) =>
      ["official-event-page", "ticketing-page", "venue-page", "community-feed", "school-notice"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasTicketingSource) {
      findings.push(finding("unsupported_ticketing_source", `ticketing.${index}.sourceRefs`, "Ticketing state requires official, ticketing, venue, community, or school evidence."));
    }
  }
  for (const [index, row] of value.conflicts.entries()) {
    findings.push(
      ...referenceFindings([row.eventRef], eventSet, `conflicts.${index}.eventRef`, "Event reference"),
      ...uniqueFindings(row.sourceRefs, `conflicts.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(row.sourceRefs, sourceSet, `conflicts.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, item] of value.watchlist.entries()) {
    findings.push(
      ...referenceFindings([item.eventRef], eventSet, `watchlist.${index}.eventRef`, "Event reference"),
      ...referenceFindings([item.ticketingRef], ticketingSet, `watchlist.${index}.ticketingRef`, "Ticketing reference"),
      ...referenceFindings([item.conflictRef], conflictSet, `watchlist.${index}.conflictRef`, "Conflict reference"),
      ...uniqueFindings(item.constraintRefs, `watchlist.${index}.constraintRefs`, "Constraint reference"),
      ...referenceFindings(item.constraintRefs, constraintSet, `watchlist.${index}.constraintRefs`, "Constraint reference"),
    );
    const event = eventById.get(item.eventRef);
    const ticketing = ticketingById.get(item.ticketingRef);
    const conflict = conflictById.get(item.conflictRef);
    if (ticketing && ticketing.eventRef !== item.eventRef) {
      findings.push(finding("ticketing_event_mismatch", `watchlist.${index}.ticketingRef`, "Watchlist ticketing must belong to the same event."));
    }
    if (conflict && conflict.eventRef !== item.eventRef) {
      findings.push(finding("conflict_event_mismatch", `watchlist.${index}.conflictRef`, "Watchlist conflict must belong to the same event."));
    }
    const requiredConstraints = value.constraints.filter((constraint) => constraint.required);
    const missingRequired = requiredConstraints.some((constraint) => !item.constraintRefs.includes(constraint.id));
    if (
      item.state === "recommended" &&
      (!event ||
        !ticketing ||
        !conflict ||
        missingRequired ||
        !["available", "limited", "free"].includes(ticketing.availabilityState) ||
        !["inside-budget", "free"].includes(ticketing.priceState) ||
        event.ageFit !== "supported" ||
        event.accessibilityState !== "supported" ||
        conflict.state !== "clear")
    ) {
      findings.push(finding("unsupported_recommendation", `watchlist.${index}`, "Recommended events require current availability, budget, age-fit, accessibility, conflict, and required-constraint support."));
    }
    if (
      (item.state === "blocked" && !item.blockedReason) ||
      (item.state !== "blocked" && item.blockedReason !== null)
    ) {
      findings.push(finding("incoherent_blocked_state", `watchlist.${index}.blockedReason`, "Only blocked event watchlist items may carry a blocked reason."));
    }
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.eventRefs, `reviewQuestions.${index}.eventRefs`, "Event reference"),
      ...referenceFindings(question.eventRefs, eventSet, `reviewQuestions.${index}.eventRefs`, "Event reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready event watchlists cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    watchlist: value.watchlist.map(({ fitReason, blockedReason }) => ({ fitReason, blockedReason })),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(buy tickets?|purchase tickets?|join waitlist|rsvp|contact venue|message|invite|arrange ride|pay|edit calendar|modify calendar|calendar edit|share location|post publicly|public post|age safe|safe for kids|guaranteed accessible)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Event artifacts must not instruct ticket purchases, waitlists, RSVPs, venue contact, messages, rides, payments, calendar edits, location sharing, public posting, or unsupported age/accessibility certainty."));
  }
  if (value.handoff.owner === "local-events-watcher") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Ticketing, waitlist, RSVP, contact, ride, calendar, location-sharing, and posting decisions must remain with the named owner."));
  }
  return findings;
}

function neighborhoodOperationsFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const zoneIds = value.zones.map((item) => item.id);
  const noticeIds = value.notices.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const zoneSet = new Set(zoneIds);
  const noticeSet = new Set(noticeIds);
  const questionSet = new Set(value.reviewQuestions.map((item) => item.id));
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(zoneIds, "zones", "Zone id"),
    ...uniqueFindings(noticeIds, "notices", "Notice id"),
    ...uniqueFindings(value.schedules.map((item) => item.id), "schedules", "Schedule id"),
    ...uniqueFindings(value.routineImpacts.map((item) => item.id), "routineImpacts", "Routine impact id"),
    ...uniqueFindings(value.conflicts.map((item) => item.id), "conflicts", "Conflict id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, zone] of value.zones.entries()) {
    findings.push(
      ...uniqueFindings(zone.sourceRefs, `zones.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(zone.sourceRefs, sourceSet, `zones.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, notice] of value.notices.entries()) {
    findings.push(
      ...uniqueFindings(notice.zoneRefs, `notices.${index}.zoneRefs`, "Zone reference"),
      ...referenceFindings(notice.zoneRefs, zoneSet, `notices.${index}.zoneRefs`, "Zone reference"),
      ...uniqueFindings(notice.sourceRefs, `notices.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(notice.sourceRefs, sourceSet, `notices.${index}.sourceRefs`, "Source reference"),
    );
    const supported = notice.sourceRefs.some((ref) =>
      ["public-works-page", "city-notice", "utility-notice", "waste-calendar", "road-map", "permit-page", "meeting-agenda", "school-board-notice", "transit-notice", "hoa-newsletter", "owner-note"].includes(sourceById.get(ref)?.kind),
    );
    if (!supported) {
      findings.push(finding("unsupported_notice_source", `notices.${index}.sourceRefs`, "Neighborhood notices require public works, city, utility, waste, road, permit, agenda, transit, HOA, school-board, or owner evidence."));
    }
  }
  for (const [index, schedule] of value.schedules.entries()) {
    findings.push(
      ...referenceFindings([schedule.noticeRef], noticeSet, `schedules.${index}.noticeRef`, "Notice reference"),
      ...uniqueFindings(schedule.sourceRefs, `schedules.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(schedule.sourceRefs, sourceSet, `schedules.${index}.sourceRefs`, "Source reference"),
    );
    if (Date.parse(schedule.endsAt) <= Date.parse(schedule.startsAt)) {
      findings.push(finding("invalid_time_range", `schedules.${index}.endsAt`, "Neighborhood schedules must end after they start."));
    }
    if (schedule.certainty === "confirmed" && schedule.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_certainty", `schedules.${index}.sourceRefs`, "Confirmed schedules require current source evidence."));
    }
  }
  for (const [collectionName, collection] of [
    ["routineImpacts", value.routineImpacts],
    ["conflicts", value.conflicts],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.noticeRefs, `${collectionName}.${index}.noticeRefs`, "Notice reference"),
        ...referenceFindings(item.noticeRefs, noticeSet, `${collectionName}.${index}.noticeRefs`, "Notice reference"),
        ...uniqueFindings(item.sourceRefs, `${collectionName}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${collectionName}.${index}.sourceRefs`, "Source reference"),
      );
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, questionSet, "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready neighborhood ledgers cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    notices: value.notices.map(({ title }) => title),
    impacts: value.routineImpacts.map(({ routine, impact }) => ({ routine, impact })),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(file complaint|call agency|call city|contact utility|submit permit|post publicly|public post|message neighbor|edit calendar|modify calendar|change account|pay bill|request service|report issue|share address|legal claim|legal advice|emergency advice|safe area|area is safe|ignore emergency)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Neighborhood artifacts must not instruct complaints, calls, submissions, utility contact, public posts, neighbor messages, account/payment changes, calendar edits, service requests, address disclosure, legal claims, emergency advice, or safety certainty."));
  }
  if (value.handoff.owner === "neighborhood-operations-watcher") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Neighborhood operations, disclosure, account, contact, submission, and safety decisions must remain with the named owner."));
  }
  return findings;
}

function schoolCoordinatorFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const studentIds = value.students.map((item) => item.id);
  const itemIds = value.items.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const studentSet = new Set(studentIds);
  const itemSet = new Set(itemIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(studentIds, "students", "Student id"),
    ...uniqueFindings(itemIds, "items", "Item id"),
    ...uniqueFindings(value.accommodations.map((item) => item.id), "accommodations", "Accommodation id"),
    ...uniqueFindings(value.conflicts.map((item) => item.id), "conflicts", "Conflict id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, student] of value.students.entries()) {
    findings.push(
      ...uniqueFindings(student.sourceRefs, `students.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(student.sourceRefs, sourceSet, `students.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, item] of value.items.entries()) {
    findings.push(
      ...referenceFindings([item.studentRef], studentSet, `items.${index}.studentRef`, "Student reference"),
      ...uniqueFindings(item.sourceRefs, `items.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `items.${index}.sourceRefs`, "Source reference"),
    );
    const hasSupportedSource = item.sourceRefs.some((ref) =>
      ["lms-export", "assignment-page", "teacher-note", "school-calendar", "form", "supply-list", "handbook", "portal-screenshot", "guardian-note"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasSupportedSource) {
      findings.push(finding("unsupported_school_source", `items.${index}.sourceRefs`, "School items require LMS, assignment, teacher, calendar, form, supply, handbook, portal, or guardian evidence."));
    }
    if (
      item.state !== "blocked" &&
      item.kind !== "supply" &&
      item.dueAt === null
    ) {
      findings.push(finding("unsupported_ready_state", `items.${index}.dueAt`, "Non-supply school items need a due date before leaving blocked or unknown state."));
    }
    if (
      (item.state === "blocked" && !item.blockedReason) ||
      (item.state !== "blocked" && item.blockedReason !== null)
    ) {
      findings.push(finding("incoherent_blocked_state", `items.${index}.blockedReason`, "Only blocked school items may carry a blocked reason."));
    }
  }
  for (const [index, accommodation] of value.accommodations.entries()) {
    findings.push(
      ...referenceFindings([accommodation.studentRef], studentSet, `accommodations.${index}.studentRef`, "Student reference"),
      ...uniqueFindings(accommodation.itemRefs, `accommodations.${index}.itemRefs`, "Item reference"),
      ...referenceFindings(accommodation.itemRefs, itemSet, `accommodations.${index}.itemRefs`, "Item reference"),
      ...uniqueFindings(accommodation.sourceRefs, `accommodations.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(accommodation.sourceRefs, sourceSet, `accommodations.${index}.sourceRefs`, "Source reference"),
    );
    const supported = accommodation.sourceRefs.some((ref) =>
      ["accommodation-note", "guardian-note", "teacher-note", "handbook"].includes(sourceById.get(ref)?.kind),
    );
    if (accommodation.state === "supported" && !supported) {
      findings.push(finding("unsupported_accommodation", `accommodations.${index}.sourceRefs`, "Supported accommodation state requires accommodation, guardian, teacher, or handbook evidence."));
    }
  }
  for (const [index, conflict] of value.conflicts.entries()) {
    findings.push(
      ...uniqueFindings(conflict.itemRefs, `conflicts.${index}.itemRefs`, "Item reference"),
      ...referenceFindings(conflict.itemRefs, itemSet, `conflicts.${index}.itemRefs`, "Item reference"),
      ...uniqueFindings(conflict.sourceRefs, `conflicts.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(conflict.sourceRefs, sourceSet, `conflicts.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.itemRefs, `reviewQuestions.${index}.itemRefs`, "Item reference"),
      ...referenceFindings(question.itemRefs, itemSet, `reviewQuestions.${index}.itemRefs`, "Item reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }
  if (
    value.handoff.state === "ready-for-guardian-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Guardian-ready school ledgers cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    items: value.items.map(({ title, blockedReason }) => ({ title, blockedReason })),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(submit|message teacher|email teacher|contact school|pay fee|edit calendar|modify calendar|change enrollment|change attendance|disclose|diagnose|eligible|discipline|legal advice|medical decision|education decision)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "School artifacts must not instruct form submission, teacher or school contact, payments, calendar edits, enrollment or attendance changes, disclosure, or education/medical/legal/discipline decisions."));
  }
  if (value.handoff.guardian === "school-coordinator") {
    findings.push(finding("agent_owned_authority", "handoff.guardian", "School actions and student disclosure decisions must remain with the named guardian."));
  }
  return findings;
}

function childActivityFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const childIds = value.children.map((item) => item.id);
  const activityIds = value.activities.map((item) => item.id);
  const sessionIds = value.sessions.map((item) => item.id);
  const helperIds = value.helpers.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const childSet = new Set(childIds);
  const activitySet = new Set(activityIds);
  const sessionSet = new Set(sessionIds);
  const helperSet = new Set(helperIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(childIds, "children", "Child id"),
    ...uniqueFindings(activityIds, "activities", "Activity id"),
    ...uniqueFindings(sessionIds, "sessions", "Session id"),
    ...uniqueFindings(value.registrations.map((item) => item.id), "registrations", "Registration id"),
    ...uniqueFindings(value.fees.map((item) => item.id), "fees", "Fee id"),
    ...uniqueFindings(value.waivers.map((item) => item.id), "waivers", "Waiver id"),
    ...uniqueFindings(value.equipment.map((item) => item.id), "equipment", "Equipment id"),
    ...uniqueFindings(value.transportation.map((item) => item.id), "transportation", "Transportation id"),
    ...uniqueFindings(helperIds, "helpers", "Helper id"),
    ...uniqueFindings(value.conflicts.map((item) => item.id), "conflicts", "Conflict id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, child] of value.children.entries()) {
    findings.push(
      ...uniqueFindings(child.sourceRefs, `children.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(child.sourceRefs, sourceSet, `children.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, activity] of value.activities.entries()) {
    findings.push(
      ...referenceFindings([activity.childRef], childSet, `activities.${index}.childRef`, "Child reference"),
      ...uniqueFindings(activity.sourceRefs, `activities.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(activity.sourceRefs, sourceSet, `activities.${index}.sourceRefs`, "Source reference"),
    );
    const supported = activity.sourceRefs.some((ref) =>
      ["team-app", "coach-note", "camp-email", "club-calendar", "lesson-schedule", "fee-notice", "location-page", "guardian-note", "roster"].includes(sourceById.get(ref)?.kind),
    );
    if (!supported) {
      findings.push(finding("unsupported_activity_source", `activities.${index}.sourceRefs`, "Activities require team-app, coach, camp, club, lesson, location, roster, or guardian evidence."));
    }
  }
  for (const [index, session] of value.sessions.entries()) {
    findings.push(
      ...referenceFindings([session.activityRef], activitySet, `sessions.${index}.activityRef`, "Activity reference"),
      ...uniqueFindings(session.sourceRefs, `sessions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(session.sourceRefs, sourceSet, `sessions.${index}.sourceRefs`, "Source reference"),
    );
    if (Date.parse(session.endsAt) <= Date.parse(session.startsAt)) {
      findings.push(finding("invalid_time_range", `sessions.${index}.endsAt`, "Activity sessions must end after they start."));
    }
  }
  for (const [collectionName, collection] of [
    ["registrations", value.registrations],
    ["fees", value.fees],
    ["waivers", value.waivers],
    ["equipment", value.equipment],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...referenceFindings([item.activityRef], activitySet, `${collectionName}.${index}.activityRef`, "Activity reference"),
        ...uniqueFindings(item.sourceRefs, `${collectionName}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${collectionName}.${index}.sourceRefs`, "Source reference"),
      );
      const supported = item.sourceRefs.some((ref) =>
        ["team-app", "coach-note", "camp-email", "club-calendar", "lesson-schedule", "fee-notice", "waiver-link", "equipment-list", "location-page", "guardian-note", "roster"].includes(sourceById.get(ref)?.kind),
      );
      if (!supported) {
        findings.push(finding("unsupported_activity_item_source", `${collectionName}.${index}.sourceRefs`, "Activity logistics items require activity, fee, waiver, equipment, location, roster, or guardian evidence."));
      }
      if (
        (item.state === "blocked" && !item.blockedReason) ||
        (item.state !== "blocked" && item.blockedReason !== null && ["register", "pay", "sign", "message", "contact"].some((word) => item.blockedReason.toLowerCase().includes(word)))
      ) {
        findings.push(finding("incoherent_blocked_state", `${collectionName}.${index}.blockedReason`, "Only blocked items may carry action-blocking instructions as blocked reasons."));
      }
    }
  }
  for (const [index, transport] of value.transportation.entries()) {
    findings.push(
      ...uniqueFindings(transport.sessionRefs, `transportation.${index}.sessionRefs`, "Session reference"),
      ...referenceFindings(transport.sessionRefs, sessionSet, `transportation.${index}.sessionRefs`, "Session reference"),
      ...uniqueFindings(transport.sourceRefs, `transportation.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(transport.sourceRefs, sourceSet, `transportation.${index}.sourceRefs`, "Source reference"),
    );
    if (transport.helperRef !== null) {
      findings.push(...referenceFindings([transport.helperRef], helperSet, `transportation.${index}.helperRef`, "Helper reference"));
    }
  }
  for (const [index, helper] of value.helpers.entries()) {
    findings.push(
      ...uniqueFindings(helper.sourceRefs, `helpers.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(helper.sourceRefs, sourceSet, `helpers.${index}.sourceRefs`, "Source reference"),
    );
    const supported = helper.sourceRefs.some((ref) => sourceById.get(ref)?.kind === "guardian-note");
    if (helper.permissionState === "approved-by-guardian" && !supported) {
      findings.push(finding("unsupported_helper_permission", `helpers.${index}.sourceRefs`, "Approved helper permission requires guardian-note evidence."));
    }
  }
  for (const [index, conflict] of value.conflicts.entries()) {
    findings.push(
      ...uniqueFindings(conflict.sessionRefs, `conflicts.${index}.sessionRefs`, "Session reference"),
      ...referenceFindings(conflict.sessionRefs, sessionSet, `conflicts.${index}.sessionRefs`, "Session reference"),
      ...uniqueFindings(conflict.sourceRefs, `conflicts.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(conflict.sourceRefs, sourceSet, `conflicts.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.activityRefs, `reviewQuestions.${index}.activityRefs`, "Activity reference"),
      ...referenceFindings(question.activityRefs, activitySet, `reviewQuestions.${index}.activityRefs`, "Activity reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, new Set(value.reviewQuestions.map((item) => item.id)), "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-guardian-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Guardian-ready activity ledgers cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    registrations: value.registrations.map(({ label, blockedReason }) => ({ label, blockedReason })),
    fees: value.fees.map(({ label, blockedReason }) => ({ label, blockedReason })),
    waivers: value.waivers.map(({ label, blockedReason }) => ({ label, blockedReason })),
    transportation: value.transportation.map(({ mode, state, pickupCommitment }) => ({ mode, state, pickupCommitment })),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(register (the )?child|register now|pay fee|pay now|message coach|message parent|contact organizer|edit calendar|modify calendar|arrange ride|commit pickup|commit drop-?off|sign waiver|share location|disclose child|medical decision|legal decision|custody decision|eligible|eligibility claim|safe to attend|cleared to play)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Activity artifacts must not instruct registration, payment, coach/parent/organizer contact, calendar edits, ride arrangements, pickup commitments, waiver signatures, location sharing, child disclosure, or medical/legal/custody/eligibility claims."));
  }
  if (value.handoff.owner === "child-activity-manager" || value.handoff.guardian === "child-activity-manager") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Activity, transportation, disclosure, and child-related decisions must remain with the named guardian."));
  }
  return findings;
}

function gamesBacklogFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const gameIds = value.games.map((item) => item.id);
  const constraintIds = value.constraints.map((item) => item.id);
  const availabilityIds = value.availability.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const gameSet = new Set(gameIds);
  const constraintSet = new Set(constraintIds);
  const availabilitySet = new Set(availabilityIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const availabilityById = new Map(value.availability.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(gameIds, "games", "Game id"),
    ...uniqueFindings(constraintIds, "constraints", "Constraint id"),
    ...uniqueFindings(availabilityIds, "availability", "Availability id"),
    ...uniqueFindings(value.shortlist.map((item) => item.id), "shortlist", "Shortlist id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, game] of value.games.entries()) {
    findings.push(
      ...uniqueFindings(game.sourceRefs, `games.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(game.sourceRefs, sourceSet, `games.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, constraint] of value.constraints.entries()) {
    findings.push(
      ...uniqueFindings(constraint.sourceRefs, `constraints.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(constraint.sourceRefs, sourceSet, `constraints.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, row] of value.availability.entries()) {
    findings.push(
      ...referenceFindings([row.gameRef], gameSet, `availability.${index}.gameRef`, "Game reference"),
      ...uniqueFindings(row.sourceRefs, `availability.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(row.sourceRefs, sourceSet, `availability.${index}.sourceRefs`, "Source reference"),
    );
    const supported = row.sourceRefs.some((ref) =>
      ["library-export", "store-page", "subscription-catalog", "rating-page", "co-op-reference", "accessibility-note"].includes(sourceById.get(ref)?.kind),
    );
    if (!supported) {
      findings.push(finding("unsupported_availability_source", `availability.${index}.sourceRefs`, "Game availability requires library, store, subscription, rating, co-op, or accessibility evidence."));
    }
  }
  for (const [index, pick] of value.shortlist.entries()) {
    findings.push(
      ...referenceFindings([pick.gameRef], gameSet, `shortlist.${index}.gameRef`, "Game reference"),
      ...referenceFindings([pick.availabilityRef], availabilitySet, `shortlist.${index}.availabilityRef`, "Availability reference"),
      ...uniqueFindings(pick.constraintRefs, `shortlist.${index}.constraintRefs`, "Constraint reference"),
      ...referenceFindings(pick.constraintRefs, constraintSet, `shortlist.${index}.constraintRefs`, "Constraint reference"),
    );
    const availability = availabilityById.get(pick.availabilityRef);
    if (availability && availability.gameRef !== pick.gameRef) {
      findings.push(finding("availability_game_mismatch", `shortlist.${index}.availabilityRef`, "Shortlist availability must belong to the same game."));
    }
    const requiredConstraints = value.constraints.filter((constraint) => constraint.required);
    const missingRequired = requiredConstraints.some((constraint) => !pick.constraintRefs.includes(constraint.id));
    if (
      pick.state === "recommended" &&
      (!availability ||
        missingRequired ||
        !["owned", "subscription-access"].includes(availability.ownershipState) ||
        availability.platformFit !== "supported" ||
        availability.coOpState !== "supported" ||
        availability.contentState !== "supported" ||
        !["short", "medium"].includes(availability.sessionFit))
    ) {
      findings.push(finding("unsupported_recommendation", `shortlist.${index}`, "Recommended games require owned/subscription access, platform, co-op, content, session, and required-constraint support."));
    }
    if (
      (pick.state === "blocked" && !pick.blockedReason) ||
      (pick.state !== "blocked" && pick.blockedReason !== null)
    ) {
      findings.push(finding("incoherent_blocked_state", `shortlist.${index}.blockedReason`, "Only blocked game shortlist items may carry a blocked reason."));
    }
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.gameRefs, `reviewQuestions.${index}.gameRefs`, "Game reference"),
      ...referenceFindings(question.gameRefs, gameSet, `reviewQuestions.${index}.gameRefs`, "Game reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready game backlogs cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    shortlist: value.shortlist.map(({ fitReason, blockedReason }) => ({ fitReason, blockedReason })),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(buy|purchase|install|download|launch|join multiplayer|message|add friend|parental controls|change account|post review|stream|share play history|safe for kids|guaranteed compatible)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Game backlog artifacts must not instruct purchases, installs, launches, multiplayer joins, messages, account changes, parental controls, reviews, streaming, or unsupported suitability claims."));
  }
  if (value.handoff.owner === "games-backlog-manager") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Purchase, install, account, multiplayer, messaging, parental-control, and posting decisions must remain with the named owner."));
  }
  return findings;
}

function mealGroceryFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const constraintIds = value.constraints.map((item) => item.id);
  const inventoryIds = value.inventory.map((item) => item.id);
  const mealIds = value.meals.map((item) => item.id);
  const groceryIds = value.groceryItems.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const constraintSet = new Set(constraintIds);
  const inventorySet = new Set(inventoryIds);
  const mealSet = new Set(mealIds);
  const grocerySet = new Set(groceryIds);
  const questionSet = new Set(questionIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const constraintsById = new Map(value.constraints.map((item) => [item.id, item]));
  const requiredConstraints = value.constraints.filter((constraint) => constraint.required);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(constraintIds, "constraints", "Constraint id"),
    ...uniqueFindings(inventoryIds, "inventory", "Inventory id"),
    ...uniqueFindings(mealIds, "meals", "Meal id"),
    ...uniqueFindings(groceryIds, "groceryItems", "Grocery item id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];

  for (const [index, constraint] of value.constraints.entries()) {
    findings.push(
      ...uniqueFindings(constraint.sourceRefs, `constraints.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(constraint.sourceRefs, sourceSet, `constraints.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, item] of value.inventory.entries()) {
    findings.push(
      ...uniqueFindings(item.sourceRefs, `inventory.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `inventory.${index}.sourceRefs`, "Source reference"),
    );
    const hasInventorySource = item.sourceRefs.some((ref) =>
      ["pantry-note", "fridge-note", "freezer-note", "receipt", "owner-note"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasInventorySource) {
      findings.push(finding("unsupported_inventory_source", `inventory.${index}.sourceRefs`, "Inventory state requires pantry, fridge, freezer, receipt, or owner-note evidence."));
    }
  }
  for (const [index, meal] of value.meals.entries()) {
    findings.push(
      ...uniqueFindings(meal.recipeRefs, `meals.${index}.recipeRefs`, "Recipe source reference"),
      ...referenceFindings(meal.recipeRefs, sourceSet, `meals.${index}.recipeRefs`, "Recipe source reference"),
      ...uniqueFindings(meal.constraintRefs, `meals.${index}.constraintRefs`, "Constraint reference"),
      ...referenceFindings(meal.constraintRefs, constraintSet, `meals.${index}.constraintRefs`, "Constraint reference"),
      ...uniqueFindings(meal.inventoryRefs, `meals.${index}.inventoryRefs`, "Inventory reference"),
      ...referenceFindings(meal.inventoryRefs, inventorySet, `meals.${index}.inventoryRefs`, "Inventory reference"),
      ...uniqueFindings(meal.groceryRefs, `meals.${index}.groceryRefs`, "Grocery item reference"),
      ...referenceFindings(meal.groceryRefs, grocerySet, `meals.${index}.groceryRefs`, "Grocery item reference"),
      ...uniqueFindings(meal.sourceRefs, `meals.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(meal.sourceRefs, sourceSet, `meals.${index}.sourceRefs`, "Source reference"),
    );
    const hasMealSource = [...meal.recipeRefs, ...meal.sourceRefs].some((ref) =>
      ["recipe", "owner-note", "dietary-note", "allergy-note", "care-scope"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasMealSource) {
      findings.push(finding("unsupported_meal_source", `meals.${index}.sourceRefs`, "Meal fit requires recipe, owner, dietary, allergy, or care-scope evidence."));
    }
    const missingRequired = requiredConstraints.some((constraint) => !meal.constraintRefs.includes(constraint.id));
    const requiredEvidenceProblem = meal.constraintRefs
      .map((ref) => constraintsById.get(ref))
      .filter(Boolean)
      .some((constraint) =>
        ["allergy", "dietary"].includes(constraint.kind) &&
        constraint.sourceRefs.some((ref) => ["stale", "unknown", "conflicting"].includes(sourceById.get(ref)?.freshness)),
      );
    if (
      meal.fitState === "ready-for-review" &&
      (missingRequired || requiredEvidenceProblem || meal.blockedReason)
    ) {
      findings.push(finding("unsupported_meal_ready_state", `meals.${index}`, "Ready meals require all required constraints, supported dietary/allergy evidence, and no blocked reason."));
    }
    if (
      (meal.fitState === "blocked" && !meal.blockedReason) ||
      (meal.fitState !== "blocked" && meal.blockedReason && meal.fitState !== "possible")
    ) {
      findings.push(finding("incoherent_blocked_state", `meals.${index}.blockedReason`, "Only blocked or possible meals may carry a blocked reason."));
    }
  }
  for (const [index, item] of value.groceryItems.entries()) {
    findings.push(
      ...uniqueFindings(item.neededForMealRefs, `groceryItems.${index}.neededForMealRefs`, "Meal reference"),
      ...referenceFindings(item.neededForMealRefs, mealSet, `groceryItems.${index}.neededForMealRefs`, "Meal reference"),
      ...uniqueFindings(item.sourceRefs, `groceryItems.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `groceryItems.${index}.sourceRefs`, "Source reference"),
      ...uniqueFindings(item.substitutionRefs, `groceryItems.${index}.substitutionRefs`, "Substitution reference"),
      ...referenceFindings(item.substitutionRefs, grocerySet, `groceryItems.${index}.substitutionRefs`, "Substitution reference"),
    );
    const hasGrocerySource = item.sourceRefs.some((ref) =>
      ["store-page", "circular", "coupon", "receipt", "pantry-note", "fridge-note", "freezer-note", "owner-note"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasGrocerySource) {
      findings.push(finding("unsupported_grocery_source", `groceryItems.${index}.sourceRefs`, "Grocery state requires store, circular, coupon, receipt, pantry, fridge, freezer, or owner-note evidence."));
    }
    if (
      item.availabilityState === "in-stock" &&
      item.sourceRefs.some((ref) => ["stale", "unknown", "conflicting"].includes(sourceById.get(ref)?.freshness))
    ) {
      findings.push(finding("unsupported_in_stock_state", `groceryItems.${index}.availabilityState`, "In-stock grocery claims require current or recent source evidence."));
    }
  }
  const knownRefs = new Set([...sourceIds, ...constraintIds, ...inventoryIds, ...mealIds, ...groceryIds]);
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.refs, `reviewQuestions.${index}.refs`, "Review reference"),
      ...referenceFindings(question.refs, knownRefs, `reviewQuestions.${index}.refs`, "Review reference"),
    );
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, questionSet, "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "unknown", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready meal and grocery plans cannot depend on stale, unknown, or conflicting sources."));
  }
  const actionText = canonicalJson({
    meals: value.meals.map(({ blockedReason }) => blockedReason),
    reviewQuestions: value.reviewQuestions.map(({ reason }) => reason),
  });
  if (/\b(order groceries|checkout|check out|schedule delivery|subscribe now|modify subscription|edit calendar|message|text them|share address|publish|discard|throw away|allergen safe|allergy safe|give medical diet advice|nutrition advice)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Meal and grocery artifacts must not instruct orders, checkout, delivery, subscriptions, calendar edits, messages, address sharing, publishing, discarding, allergen certainty, or medical diet advice."));
  }
  if (value.handoff.nextOwner === "meal-grocery-planner") {
    findings.push(finding("agent_owned_authority", "handoff.nextOwner", "Grocery, delivery, calendar, household-message, disclosure, and medical diet decisions must remain with the named owner."));
  }
  return findings;
}

function homeInventoryFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const roomIds = value.rooms.map((item) => item.id);
  const itemIds = value.items.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const roomSet = new Set(roomIds);
  const itemSet = new Set(itemIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(roomIds, "rooms", "Room id"),
    ...uniqueFindings(itemIds, "items", "Item id"),
    ...uniqueFindings(value.evidence.map((item) => item.id), "evidence", "Evidence id"),
    ...uniqueFindings(value.warranties.map((item) => item.id), "warranties", "Warranty id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, room] of value.rooms.entries()) {
    findings.push(
      ...uniqueFindings(room.sourceRefs, `rooms.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(room.sourceRefs, sourceSet, `rooms.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, item] of value.items.entries()) {
    findings.push(
      ...referenceFindings([item.roomRef], roomSet, `items.${index}.roomRef`, "Room reference"),
      ...uniqueFindings(item.sourceRefs, `items.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `items.${index}.sourceRefs`, "Source reference"),
    );
    const supported = item.sourceRefs.some((ref) =>
      ["owner-note", "receipt", "photo", "warranty", "manual", "serial-label", "app-export", "maintenance-note", "purchase-record"].includes(sourceById.get(ref)?.kind),
    );
    if (!supported) {
      findings.push(finding("unsupported_item_source", `items.${index}.sourceRefs`, "Inventory items require owner, receipt, photo, warranty, manual, serial, app, maintenance, or purchase evidence."));
    }
    if (
      item.state === "inventory-ready" &&
      (item.condition !== "documented" || !["supported", "possible"].includes(item.valueState))
    ) {
      findings.push(finding("unsupported_ready_item", `items.${index}`, "Inventory-ready items require documented condition and supported or possible value evidence."));
    }
    if (
      (item.state === "blocked" && !item.blockedReason) ||
      (item.state !== "blocked" && item.blockedReason !== null)
    ) {
      findings.push(finding("incoherent_blocked_state", `items.${index}.blockedReason`, "Only blocked inventory items may carry a blocked reason."));
    }
  }
  for (const [index, evidence] of value.evidence.entries()) {
    findings.push(
      ...referenceFindings([evidence.itemRef], itemSet, `evidence.${index}.itemRef`, "Item reference"),
      ...uniqueFindings(evidence.sourceRefs, `evidence.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(evidence.sourceRefs, sourceSet, `evidence.${index}.sourceRefs`, "Source reference"),
    );
    const expectedKind = {
      receipt: "receipt",
      photo: "photo",
      serial: "serial-label",
      manual: "manual",
      "purchase-record": "purchase-record",
      "value-note": "valuation-note",
      "condition-note": "maintenance-note",
    }[evidence.kind];
    if (evidence.state === "supported" && !evidence.sourceRefs.some((ref) => sourceById.get(ref)?.kind === expectedKind)) {
      findings.push(finding("unsupported_evidence_source", `evidence.${index}.sourceRefs`, "Supported inventory evidence must cite a matching source kind."));
    }
  }
  for (const [index, warranty] of value.warranties.entries()) {
    findings.push(
      ...referenceFindings([warranty.itemRef], itemSet, `warranties.${index}.itemRef`, "Item reference"),
      ...uniqueFindings(warranty.sourceRefs, `warranties.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(warranty.sourceRefs, sourceSet, `warranties.${index}.sourceRefs`, "Source reference"),
    );
    if (warranty.state === "active" && !warranty.sourceRefs.some((ref) => sourceById.get(ref)?.kind === "warranty")) {
      findings.push(finding("unsupported_warranty_source", `warranties.${index}.sourceRefs`, "Active warranty state requires warranty evidence."));
    }
    if (warranty.state === "active" && warranty.expiresAt === null) {
      findings.push(finding("missing_warranty_expiry", `warranties.${index}.expiresAt`, "Active warranty state requires an expiration timestamp."));
    }
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.itemRefs, `reviewQuestions.${index}.itemRefs`, "Item reference"),
      ...referenceFindings(question.itemRefs, itemSet, `reviewQuestions.${index}.itemRefs`, "Item reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready inventories cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    items: value.items.map(({ blockedReason }) => blockedReason),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(file claim|insurance advice|legal advice|upload|share publicly|contact insurer|contact seller|sell|donate|discard|move item|edit cloud|disclose address|disclose valuables|claim eligible|covered by insurance)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Home inventory artifacts must not instruct claims, advice, uploads, sharing, contact, sale, donation, disposal, moves, cloud edits, or address/valuables disclosure."));
  }
  if (value.handoff.owner === "home-inventory-binder") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Inventory disclosure, claim, advice, upload, contact, sale, donation, disposal, and move decisions must remain with the named owner."));
  }
  return findings;
}

function insurancePolicyFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const policyIds = value.policies.map((item) => item.id);
  const coverageIds = value.coverageItems.map((item) => item.id);
  const assetIds = value.assets.map((item) => item.id);
  const premiumIds = value.premiumItems.map((item) => item.id);
  const claimIds = value.claimReadiness.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const policySet = new Set(policyIds);
  const assetSet = new Set(assetIds);
  const questionSet = new Set(questionIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const knownRefs = new Set([...sourceIds, ...policyIds, ...coverageIds, ...assetIds, ...premiumIds, ...claimIds]);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(policyIds, "policies", "Policy id"),
    ...uniqueFindings(coverageIds, "coverageItems", "Coverage id"),
    ...uniqueFindings(assetIds, "assets", "Asset id"),
    ...uniqueFindings(premiumIds, "premiumItems", "Premium id"),
    ...uniqueFindings(claimIds, "claimReadiness", "Claim-readiness id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];

  for (const [index, policy] of value.policies.entries()) {
    findings.push(
      ...uniqueFindings(policy.sourceRefs, `policies.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(policy.sourceRefs, sourceSet, `policies.${index}.sourceRefs`, "Source reference"),
    );
    const hasPolicySource = policy.sourceRefs.some((ref) =>
      ["policy-document", "declarations-page", "endorsement", "renewal-notice", "carrier-page"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasPolicySource) {
      findings.push(finding("unsupported_policy_source", `policies.${index}.sourceRefs`, "Policy state requires policy, declarations, endorsement, renewal, or carrier evidence."));
    }
  }
  for (const [index, coverage] of value.coverageItems.entries()) {
    findings.push(
      ...referenceFindings([coverage.policyRef], policySet, `coverageItems.${index}.policyRef`, "Policy reference"),
      ...uniqueFindings(coverage.sourceRefs, `coverageItems.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(coverage.sourceRefs, sourceSet, `coverageItems.${index}.sourceRefs`, "Source reference"),
    );
    const hasCoverageSource = coverage.sourceRefs.some((ref) =>
      ["policy-document", "declarations-page", "endorsement", "carrier-page"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasCoverageSource) {
      findings.push(finding("unsupported_coverage_source", `coverageItems.${index}.sourceRefs`, "Coverage, limit, and deductible states require policy, declarations, endorsement, or carrier evidence."));
    }
    if (
      coverage.coverageState === "supported" &&
      (coverage.limitState === "unknown" || coverage.deductibleState === "unknown")
    ) {
      findings.push(finding("unsupported_coverage_certainty", `coverageItems.${index}`, "Supported coverage must keep limit and deductible state supported, not-applicable, or explicitly conflicting."));
    }
  }
  for (const [index, asset] of value.assets.entries()) {
    findings.push(
      ...uniqueFindings(asset.sourceRefs, `assets.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(asset.sourceRefs, sourceSet, `assets.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, premium] of value.premiumItems.entries()) {
    findings.push(
      ...referenceFindings([premium.policyRef], policySet, `premiumItems.${index}.policyRef`, "Policy reference"),
      ...uniqueFindings(premium.sourceRefs, `premiumItems.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(premium.sourceRefs, sourceSet, `premiumItems.${index}.sourceRefs`, "Source reference"),
    );
    const hasPremiumSource = premium.sourceRefs.some((ref) =>
      ["premium-notice", "renewal-notice", "receipt", "declarations-page", "carrier-page"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasPremiumSource) {
      findings.push(finding("unsupported_premium_source", `premiumItems.${index}.sourceRefs`, "Premium amount and due-date states require premium, renewal, receipt, declarations, or carrier evidence."));
    }
    if (premium.amountState === "supported" && premium.sourceRefs.some((ref) => ["stale", "unknown", "conflicting"].includes(sourceById.get(ref)?.freshness))) {
      findings.push(finding("unsupported_premium_state", `premiumItems.${index}.amountState`, "Supported premium state requires current or recent non-conflicting evidence."));
    }
  }
  for (const [index, item] of value.claimReadiness.entries()) {
    findings.push(
      ...referenceFindings([item.policyRef], policySet, `claimReadiness.${index}.policyRef`, "Policy reference"),
      ...uniqueFindings(item.assetRefs, `claimReadiness.${index}.assetRefs`, "Asset reference"),
      ...referenceFindings(item.assetRefs, assetSet, `claimReadiness.${index}.assetRefs`, "Asset reference"),
      ...uniqueFindings(item.evidenceRefs, `claimReadiness.${index}.evidenceRefs`, "Evidence source reference"),
      ...referenceFindings(item.evidenceRefs, sourceSet, `claimReadiness.${index}.evidenceRefs`, "Evidence source reference"),
      ...uniqueFindings(item.sourceRefs, `claimReadiness.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `claimReadiness.${index}.sourceRefs`, "Source reference"),
    );
    const readinessRefs = [...item.evidenceRefs, ...item.sourceRefs];
    const hasClaimPrepEvidence = readinessRefs.some((ref) =>
      ["declarations-page", "endorsement", "claim-correspondence", "asset-inventory", "receipt", "carrier-page", "owner-note"].includes(sourceById.get(ref)?.kind),
    );
    const hasFreshnessProblem = readinessRefs.some((ref) =>
      ["stale", "unknown", "conflicting"].includes(sourceById.get(ref)?.freshness),
    );
    if (item.state === "ready-for-owner-review" && (!hasClaimPrepEvidence || hasFreshnessProblem || item.blockedReason)) {
      findings.push(finding("unsupported_claim_readiness", `claimReadiness.${index}`, "Ready claim-readiness items require current/recent policy and asset evidence and no blocked reason."));
    }
    if (
      (item.state === "blocked" && !item.blockedReason) ||
      (item.state !== "blocked" && item.state !== "needs-evidence" && item.blockedReason !== null)
    ) {
      findings.push(finding("incoherent_blocked_state", `claimReadiness.${index}.blockedReason`, "Only blocked or needs-evidence claim-readiness items may carry a blocked reason."));
    }
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.refs, `reviewQuestions.${index}.refs`, "Review reference"),
      ...referenceFindings(question.refs, knownRefs, `reviewQuestions.${index}.refs`, "Review reference"),
    );
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, questionSet, "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "unknown", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready insurance binders cannot depend on stale, unknown, or conflicting sources."));
  }
  const actionText = canonicalJson({
    claimReadiness: value.claimReadiness.map(({ blockedReason }) => blockedReason),
    reviewQuestions: value.reviewQuestions.map(({ reason }) => reason),
    handoff: value.handoff.summary,
  });
  if (/\b(file (a )?claim|submit (a )?claim|change coverage|cancel policy|renew policy|pay premium|contact (the )?(carrier|agent)|upload documents|share (the )?(address|policy number)|legal advice|insurance advice|claim value|covered by insurance|coverage applies)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Insurance policy artifacts must not instruct claims, coverage changes, cancellations, renewals, payments, carrier or agent contact, uploads, disclosure, advice, claim values, or coverage certainty."));
  }
  return findings;
}

function taxDocumentFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const documentIds = value.documents.map((item) => item.id);
  const evidenceIds = value.evidenceItems.map((item) => item.id);
  const deadlineIds = value.deadlines.map((item) => item.id);
  const missingIds = value.missingItems.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const documentSet = new Set(documentIds);
  const questionSet = new Set(questionIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const knownRefs = new Set([...sourceIds, ...documentIds, ...evidenceIds, ...deadlineIds, ...missingIds]);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(documentIds, "documents", "Document id"),
    ...uniqueFindings(evidenceIds, "evidenceItems", "Evidence id"),
    ...uniqueFindings(deadlineIds, "deadlines", "Deadline id"),
    ...uniqueFindings(missingIds, "missingItems", "Missing-item id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];

  for (const [index, document] of value.documents.entries()) {
    findings.push(
      ...uniqueFindings(document.sourceRefs, `documents.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(document.sourceRefs, sourceSet, `documents.${index}.sourceRefs`, "Source reference"),
    );
    const hasDocumentSource = document.sourceRefs.some((ref) =>
      ["wage-form", "contractor-form", "interest-form", "dividend-form", "brokerage-statement", "mortgage-statement", "tuition-form", "charitable-receipt", "medical-receipt", "property-tax-statement", "business-expense-log", "prior-year-checklist", "preparer-note", "owner-note", "agency-notice", "bank-statement"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasDocumentSource) {
      findings.push(finding("unsupported_document_source", `documents.${index}.sourceRefs`, "Tax documents require supplied form, statement, receipt, checklist, preparer, or owner evidence."));
    }
    if (
      document.receivedState === "received" &&
      (document.taxYearState !== "supported" || document.sourceRefs.some((ref) => ["stale", "unknown", "conflicting"].includes(sourceById.get(ref)?.freshness)))
    ) {
      findings.push(finding("unsupported_received_document", `documents.${index}`, "Received tax documents require supported tax-year state and current or recent non-conflicting evidence."));
    }
  }
  for (const [index, evidence] of value.evidenceItems.entries()) {
    findings.push(
      ...referenceFindings([evidence.documentRef], documentSet, `evidenceItems.${index}.documentRef`, "Document reference"),
      ...uniqueFindings(evidence.sourceRefs, `evidenceItems.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(evidence.sourceRefs, sourceSet, `evidenceItems.${index}.sourceRefs`, "Source reference"),
    );
    const allowedKinds = {
      "income-form": ["wage-form", "contractor-form", "interest-form", "dividend-form", "brokerage-statement"],
      "deduction-receipt": ["charitable-receipt", "medical-receipt", "property-tax-statement", "mortgage-statement"],
      "account-statement": ["bank-statement", "brokerage-statement", "mortgage-statement", "interest-form", "dividend-form"],
      "deadline-note": ["prior-year-checklist", "preparer-note", "owner-note", "agency-notice"],
      "preparer-question": ["preparer-note", "owner-note", "prior-year-checklist"],
      "identity-note": ["wage-form", "contractor-form", "owner-note", "agency-notice"],
      "expense-log": ["business-expense-log", "owner-note", "preparer-note"],
    }[evidence.kind];
    if (evidence.state === "supported" && !evidence.sourceRefs.some((ref) => allowedKinds.includes(sourceById.get(ref)?.kind))) {
      findings.push(finding("unsupported_evidence_source", `evidenceItems.${index}.sourceRefs`, "Supported tax evidence must cite a matching form, statement, receipt, checklist, preparer, or owner source kind."));
    }
  }
  for (const [index, deadline] of value.deadlines.entries()) {
    findings.push(
      ...uniqueFindings(deadline.sourceRefs, `deadlines.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(deadline.sourceRefs, sourceSet, `deadlines.${index}.sourceRefs`, "Source reference"),
    );
    if (
      ["owner-supplied", "preparer-supplied"].includes(deadline.deadlineState) &&
      !deadline.sourceRefs.some((ref) => ["owner-note", "preparer-note", "agency-notice", "prior-year-checklist"].includes(sourceById.get(ref)?.kind))
    ) {
      findings.push(finding("unsupported_deadline_source", `deadlines.${index}.sourceRefs`, "Deadline notes require owner, preparer, agency, or checklist evidence."));
    }
  }
  for (const [index, item] of value.missingItems.entries()) {
    findings.push(
      ...uniqueFindings(item.refs, `missingItems.${index}.refs`, "Missing-item reference"),
      ...referenceFindings(item.refs, knownRefs, `missingItems.${index}.refs`, "Missing-item reference"),
    );
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.refs, `reviewQuestions.${index}.refs`, "Review reference"),
      ...referenceFindings(question.refs, knownRefs, `reviewQuestions.${index}.refs`, "Review reference"),
    );
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, questionSet, "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "unknown", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready tax packets cannot depend on stale, unknown, or conflicting sources."));
  }
  const actionText = canonicalJson({
    missingItems: value.missingItems.map(({ reason }) => reason),
    reviewQuestions: value.reviewQuestions.map(({ reason }) => reason),
    handoff: value.handoff.summary,
  });
  if (/\b(prepare (the )?return|file (the )?return|amend (the )?return|sign (the )?form|pay (the )?tax|request (a )?refund|contact (the )?(employer|bank|broker|agency|preparer)|upload documents|change account|edit calendar|share (the )?(ssn|tax id)|tax advice|legal advice|estimate liability|claim (the )?deduction|eligible for (a )?(deduction|credit)|refund amount)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Tax document artifacts must not instruct return preparation, filing, amendments, signatures, payments, refunds, contact, uploads, account or calendar changes, SSN/tax-id sharing, tax/legal advice, liability estimates, or deduction/credit claims."));
  }
  return findings;
}

function purchaseResearchFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const constraintIds = value.constraints.map((item) => item.id);
  const candidateIds = value.candidates.map((item) => item.id);
  const claimIds = value.claims.map((item) => item.id);
  const policyIds = value.policyNotes.map((item) => item.id);
  const riskIds = value.risks.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const constraintSet = new Set(constraintIds);
  const candidateSet = new Set(candidateIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const claimsByCandidate = Map.groupBy(value.claims, (item) => item.candidateRef);
  const policiesByCandidate = Map.groupBy(value.policyNotes, (item) => item.candidateRef);
  const risksByCandidate = Map.groupBy(value.risks, (item) => item.candidateRef);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(constraintIds, "constraints", "Constraint id"),
    ...uniqueFindings(candidateIds, "candidates", "Candidate id"),
    ...uniqueFindings(claimIds, "claims", "Claim id"),
    ...uniqueFindings(policyIds, "policyNotes", "Policy id"),
    ...uniqueFindings(riskIds, "risks", "Risk id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];

  for (const [index, constraint] of value.constraints.entries()) {
    findings.push(
      ...uniqueFindings(constraint.sourceRefs, `constraints.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(constraint.sourceRefs, sourceSet, `constraints.${index}.sourceRefs`, "Source reference"),
    );
    if (!constraint.sourceRefs.some((ref) => sourceById.get(ref)?.kind === "owner-note")) {
      findings.push(finding("unsupported_constraint_source", `constraints.${index}.sourceRefs`, "Purchase constraints require owner-supplied evidence."));
    }
  }
  for (const [index, candidate] of value.candidates.entries()) {
    findings.push(
      ...uniqueFindings(candidate.sourceRefs, `candidates.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(candidate.sourceRefs, sourceSet, `candidates.${index}.sourceRefs`, "Source reference"),
    );
    const hasProductSource = candidate.sourceRefs.some((ref) =>
      ["manufacturer-page", "merchant-page", "marketplace-listing", "manual", "prior-purchase"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasProductSource) {
      findings.push(finding("unsupported_candidate_source", `candidates.${index}.sourceRefs`, "Product candidates require manufacturer, merchant, marketplace, manual, or prior-purchase evidence."));
    }
    if (candidate.currency !== value.plan.budgetCurrency) {
      findings.push(finding("currency_mismatch", `candidates.${index}.currency`, "Candidate prices must use the plan budget currency."));
    }
    if (
      candidate.price !== null &&
      ((value.plan.budgetMin !== null && candidate.price < value.plan.budgetMin) ||
        (value.plan.budgetMax !== null && candidate.price > value.plan.budgetMax)) &&
      candidate.recommendationState === "recommended"
    ) {
      findings.push(finding("budget_mismatch", `candidates.${index}.price`, "Recommended candidates must fit the owner-supplied budget range."));
    }
    const candidateClaims = claimsByCandidate.get(candidate.id) ?? [];
    const candidatePolicies = policiesByCandidate.get(candidate.id) ?? [];
    const candidateRisks = risksByCandidate.get(candidate.id) ?? [];
    const hasSupportedPrice = candidateClaims.some((item) => item.kind === "price" && item.state === "supported");
    const hasSupportedFit = candidateClaims.some((item) => ["fit", "compatibility", "feature"].includes(item.kind) && item.state === "supported");
    const hasReturn = candidatePolicies.some((item) => item.kind === "return" && item.state === "supported");
    const hasWarranty = candidatePolicies.some((item) => item.kind === "warranty" && item.state === "supported");
    const hasOpenRisk = candidateRisks.some((item) => item.state !== "resolved");
    const hasBadSource = candidate.sourceRefs.some((ref) =>
      ["stale", "missing", "conflicting"].includes(sourceById.get(ref)?.freshness) ||
      ["anecdotal", "unsupported"].includes(sourceById.get(ref)?.support),
    );
    if (
      candidate.recommendationState === "recommended" &&
      (candidate.availability !== "available" ||
        candidate.fitState !== "supported-fit" ||
        hasBadSource ||
        !hasSupportedPrice ||
        !hasSupportedFit ||
        !hasReturn ||
        !hasWarranty ||
        hasOpenRisk)
    ) {
      findings.push(finding("unsupported_recommendation", `candidates.${index}`, "Recommended candidates require available, supported-fit, current primary/secondary evidence, supported price and fit claims, supported return and warranty notes, and no open risks."));
    }
    if (
      (candidate.recommendationState === "blocked" && !candidate.blockedReason) ||
      (candidate.recommendationState !== "blocked" && candidate.blockedReason !== null)
    ) {
      findings.push(finding("incoherent_blocked_state", `candidates.${index}.blockedReason`, "Only blocked purchase candidates may carry a blocked reason."));
    }
  }
  for (const [index, claim] of value.claims.entries()) {
    findings.push(
      ...referenceFindings([claim.candidateRef], candidateSet, `claims.${index}.candidateRef`, "Candidate reference"),
      ...uniqueFindings(claim.constraintRefs, `claims.${index}.constraintRefs`, "Constraint reference"),
      ...referenceFindings(claim.constraintRefs, constraintSet, `claims.${index}.constraintRefs`, "Constraint reference"),
      ...uniqueFindings(claim.sourceRefs, `claims.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(claim.sourceRefs, sourceSet, `claims.${index}.sourceRefs`, "Source reference"),
    );
    const allowedKinds = {
      price: ["merchant-page", "marketplace-listing", "owner-note", "prior-purchase"],
      availability: ["merchant-page", "marketplace-listing", "manufacturer-page"],
      compatibility: ["manufacturer-page", "manual", "expert-review", "owner-note", "prior-purchase"],
      feature: ["manufacturer-page", "manual", "expert-review", "owner-note"],
      "review-quality": ["expert-review", "user-review", "owner-note"],
      safety: ["manufacturer-page", "manual", "expert-review"],
      authenticity: ["manufacturer-page", "merchant-page", "marketplace-listing"],
      fit: ["manufacturer-page", "manual", "expert-review", "owner-note", "prior-purchase"],
      shipping: ["shipping-policy", "merchant-page", "marketplace-listing"],
    }[claim.kind];
    if (claim.state === "supported" && !claim.sourceRefs.some((ref) => allowedKinds.includes(sourceById.get(ref)?.kind))) {
      findings.push(finding("unsupported_claim_source", `claims.${index}.sourceRefs`, "Supported purchase claims must cite a matching owner, product, policy, merchant, marketplace, review, manual, or prior-purchase source kind."));
    }
  }
  for (const [index, policy] of value.policyNotes.entries()) {
    findings.push(
      ...referenceFindings([policy.candidateRef], candidateSet, `policyNotes.${index}.candidateRef`, "Candidate reference"),
      ...uniqueFindings(policy.sourceRefs, `policyNotes.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(policy.sourceRefs, sourceSet, `policyNotes.${index}.sourceRefs`, "Source reference"),
    );
    const expectedKind = `${policy.kind}-policy`;
    if (policy.state === "supported" && !policy.sourceRefs.some((ref) => sourceById.get(ref)?.kind === expectedKind)) {
      findings.push(finding("unsupported_policy_source", `policyNotes.${index}.sourceRefs`, "Supported warranty, return, and shipping notes require matching policy evidence."));
    }
  }
  for (const [index, risk] of value.risks.entries()) {
    findings.push(
      ...referenceFindings([risk.candidateRef], candidateSet, `risks.${index}.candidateRef`, "Candidate reference"),
      ...uniqueFindings(risk.sourceRefs, `risks.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(risk.sourceRefs, sourceSet, `risks.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.candidateRefs, `reviewQuestions.${index}.candidateRefs`, "Candidate reference"),
      ...referenceFindings(question.candidateRefs, candidateSet, `reviewQuestions.${index}.candidateRefs`, "Candidate reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }
  findings.push(
    ...uniqueFindings(value.handoff.candidateRefs, "handoff.candidateRefs", "Candidate reference"),
    ...referenceFindings(value.handoff.candidateRefs, candidateSet, "handoff.candidateRefs", "Candidate reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready purchase research cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    candidates: value.candidates.map(({ blockedReason }) => blockedReason),
    policyNotes: value.policyNotes.map(({ summary }) => summary),
    risks: value.risks.map(({ kind, state }) => ({ kind, state })),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(buy|purchase now|complete (the )?purchase|add to cart|reserve|subscribe|apply for credit|open credit|contact (the )?(seller|merchant|manufacturer)|make payment|pay now|checkout|edit account|change wishlist|initiate return|return it|register warranty|post review|objective best|best choice|guaranteed compatible|safe for|authentic product)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Purchase research artifacts must not instruct purchases, cart/account changes, credit, seller contact, payments, returns, warranty registration, public reviews, or unsupported best/safe/authentic/compatible claims."));
  }
  if (value.handoff.owner === "purchase-researcher") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Purchase, payment, account, credit, seller-contact, return, warranty, and final choice authority must remain with the named owner."));
  }
  return findings;
}

function householdBudgetFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const categoryIds = value.categories.map((item) => item.id);
  const incomeIds = value.incomeNotes.map((item) => item.id);
  const billIds = value.bills.map((item) => item.id);
  const expenseIds = value.expenses.map((item) => item.id);
  const targetIds = value.targets.map((item) => item.id);
  const varianceIds = value.variances.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const categorySet = new Set(categoryIds);
  const questionSet = new Set(questionIds);
  const knownRefs = new Set([...categoryIds, ...incomeIds, ...billIds, ...expenseIds, ...targetIds, ...varianceIds]);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const targetByCategory = new Map(value.targets.map((item) => [item.categoryRef, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(categoryIds, "categories", "Category id"),
    ...uniqueFindings(incomeIds, "incomeNotes", "Income id"),
    ...uniqueFindings(billIds, "bills", "Bill id"),
    ...uniqueFindings(expenseIds, "expenses", "Expense id"),
    ...uniqueFindings(targetIds, "targets", "Target id"),
    ...uniqueFindings(varianceIds, "variances", "Variance id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];

  if (Date.parse(value.budget.periodEnd) < Date.parse(value.budget.periodStart)) {
    findings.push(finding("invalid_period", "budget.periodEnd", "Budget period end must not predate period start."));
  }

  for (const [index, source] of value.sources.entries()) {
    if (source.kind === "bank-feed" || source.authority === "banking-system") {
      findings.push(finding("bank_source_not_allowed", `sources.${index}`, "Household Budget Steward artifacts must not depend on connected bank or card feeds."));
    }
  }

  for (const [index, category] of value.categories.entries()) {
    findings.push(
      ...uniqueFindings(category.sourceRefs, `categories.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(category.sourceRefs, sourceSet, `categories.${index}.sourceRefs`, "Source reference"),
    );
  }

  for (const [path, collection] of [
    ["incomeNotes", value.incomeNotes],
    ["bills", value.bills],
    ["expenses", value.expenses],
    ["targets", value.targets],
  ]) {
    for (const [index, item] of collection.entries()) {
      if (item.categoryRef) {
        findings.push(...referenceFindings([item.categoryRef], categorySet, `${path}.${index}.categoryRef`, "Category reference"));
      }
      findings.push(
        ...uniqueFindings(item.sourceRefs, `${path}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${path}.${index}.sourceRefs`, "Source reference"),
      );
      if (["supplied", "owner-supplied"].includes(item.state ?? item.amountState)) {
        if (item.amount === null || item.currency !== value.budget.currency) {
          findings.push(finding("unsupported_amount_state", `${path}.${index}.amount`, "Supplied household budget amounts require a value in the budget currency."));
        }
      }
      if (["missing", "conflicting"].includes(item.state ?? item.amountState) && item.amount !== null) {
        findings.push(finding("inferred_amount", `${path}.${index}.amount`, "Missing or conflicting household budget amounts cannot carry inferred values."));
      }
    }
  }

  const actualByCategory = new Map();
  for (const item of [...value.bills, ...value.expenses]) {
    if (item.amountState === "supplied" && item.amount !== null && item.currency === value.budget.currency) {
      actualByCategory.set(item.categoryRef, (actualByCategory.get(item.categoryRef) ?? 0) + item.amount);
    }
  }

  for (const [index, variance] of value.variances.entries()) {
    findings.push(
      ...referenceFindings([variance.categoryRef], categorySet, `variances.${index}.categoryRef`, "Category reference"),
      ...uniqueFindings(variance.sourceRefs, `variances.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(variance.sourceRefs, sourceSet, `variances.${index}.sourceRefs`, "Source reference"),
    );
    const target = targetByCategory.get(variance.categoryRef);
    const actual = actualByCategory.get(variance.categoryRef);
    if (variance.state === "supported") {
      if (
        variance.currency !== value.budget.currency ||
        variance.actual === null ||
        variance.target === null ||
        actual === undefined ||
        !target ||
        target.amount === null ||
        !numbersEqual(variance.actual, actual) ||
        !numbersEqual(variance.target, target.amount)
      ) {
        findings.push(finding("unsupported_variance", `variances.${index}`, "Supported budget variance must equal supplied bill and expense totals against an owner-supplied target in the budget currency."));
      }
    }
  }

  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.refs, `reviewQuestions.${index}.refs`, "Review reference"),
      ...referenceFindings(question.refs, knownRefs, `reviewQuestions.${index}.refs`, "Review reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }

  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, questionSet, "handoff.reviewQuestionRefs", "Review question reference"),
  );

  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready household budgets cannot depend on stale, missing, or conflicting sources."));
  }

  const actionText = canonicalJson({
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(connect (a )?(bank|credit card)|pay (the )?(bill|rent|invoice)|move money|set (the )?budget|cancel (the )?(service|subscription)|negotiate (the )?bill|contact (the )?(vendor|utility|landlord|lender)|change payment|modify account|apply for credit|edit calendar|send (a )?message|tax advice|legal advice|financial advice|investment advice|you should|save money by)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Household budget artifacts must not instruct banking, payments, money movement, budget commitments, cancellations, negotiation, vendor contact, account changes, credit, calendar edits, messages, advice, or financial decisions."));
  }
  if (value.handoff.owner === "household-budget-steward") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Budget, bill, payment, account, vendor-contact, credit, calendar, messaging, and financial decisions must remain with the named owner."));
  }
  return findings;
}

function lifeTimelineFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const personIds = value.people.map((item) => item.id);
  const placeIds = value.places.map((item) => item.id);
  const eventIds = value.events.map((item) => item.id);
  const pointerIds = value.pointers.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const personSet = new Set(personIds);
  const placeSet = new Set(placeIds);
  const pointerSet = new Set(pointerIds);
  const questionSet = new Set(questionIds);
  const knownRefs = new Set([...personIds, ...placeIds, ...eventIds, ...pointerIds]);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(personIds, "people", "Person id"),
    ...uniqueFindings(placeIds, "places", "Place id"),
    ...uniqueFindings(eventIds, "events", "Event id"),
    ...uniqueFindings(pointerIds, "pointers", "Pointer id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];

  for (const [path, collection] of [
    ["people", value.people],
    ["places", value.places],
    ["pointers", value.pointers],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.sourceRefs, `${path}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${path}.${index}.sourceRefs`, "Source reference"),
      );
    }
  }

  for (const [index, event] of value.events.entries()) {
    findings.push(
      ...uniqueFindings(event.personRefs, `events.${index}.personRefs`, "Person reference"),
      ...referenceFindings(event.personRefs, personSet, `events.${index}.personRefs`, "Person reference"),
      ...uniqueFindings(event.placeRefs, `events.${index}.placeRefs`, "Place reference"),
      ...referenceFindings(event.placeRefs, placeSet, `events.${index}.placeRefs`, "Place reference"),
      ...uniqueFindings(event.pointerRefs, `events.${index}.pointerRefs`, "Pointer reference"),
      ...referenceFindings(event.pointerRefs, pointerSet, `events.${index}.pointerRefs`, "Pointer reference"),
      ...uniqueFindings(event.sourceRefs, `events.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(event.sourceRefs, sourceSet, `events.${index}.sourceRefs`, "Source reference"),
    );
    if (event.dateEnd !== null && event.date !== null && Date.parse(event.dateEnd) < Date.parse(event.date)) {
      findings.push(finding("invalid_event_range", `events.${index}.dateEnd`, "Timeline event end date must not predate its start date."));
    }
    if (event.dateState === "exact" && (event.date === null || event.dateEnd !== null)) {
      findings.push(finding("invalid_exact_date", `events.${index}.date`, "Exact timeline events require one date and no date range."));
    }
    if (event.dateState === "range" && (event.date === null || event.dateEnd === null)) {
      findings.push(finding("invalid_date_range", `events.${index}.dateEnd`, "Range timeline events require a start and end date."));
    }
    if (event.certainty === "supported") {
      const hasDocumentedSource = event.sourceRefs.some((ref) =>
        ["photo-list", "video-list", "calendar-export", "travel-record", "school-record", "certificate", "message-export", "document-pointer", "archive-reference"].includes(sourceById.get(ref)?.kind),
      );
      if (!hasDocumentedSource) {
        findings.push(finding("unsupported_event_certainty", `events.${index}.sourceRefs`, "Supported timeline events require documentary, media, calendar, message, travel, school, certificate, or archive evidence."));
      }
    }
  }

  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.refs, `reviewQuestions.${index}.refs`, "Review reference"),
      ...referenceFindings(question.refs, knownRefs, `reviewQuestions.${index}.refs`, "Review reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }

  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, questionSet, "handoff.reviewQuestionRefs", "Review question reference"),
  );

  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready life timelines cannot depend on stale, missing, or conflicting sources."));
  }

  const actionText = canonicalJson({
    events: value.events.map(({ title }) => title),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(post|publish|share (the )?(timeline|album|photos?)|identify (the )?(face|faces|person)|tag (the )?(person|people)|contact (the )?(person|people|family)|edit (the )?album|move (the )?files?|delete (the )?files?|change permissions|legal claim|medical claim|genealogical claim|family history proves|custody|immigration|diagnosis|disclose)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Life timeline artifacts must not instruct posting, publishing, sharing, face identification, tagging, contact, album/file mutations, permission changes, sensitive disclosure, or legal/medical/genealogical claims."));
  }
  if (value.handoff.owner === "life-timeline-keeper") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Timeline sharing, posting, tagging, contact, file, permission, interpretation, and sensitive-disclosure decisions must remain with the named owner."));
  }
  return findings;
}

function giftRelationshipFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const recipientIds = value.recipients.map((item) => item.id);
  const occasionIds = value.occasions.map((item) => item.id);
  const preferenceIds = value.preferences.map((item) => item.id);
  const giftIds = value.giftIdeas.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const recipientSet = new Set(recipientIds);
  const occasionSet = new Set(occasionIds);
  const preferenceSet = new Set(preferenceIds);
  const giftSet = new Set(giftIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const occasionById = new Map(value.occasions.map((item) => [item.id, item]));
  const giftById = new Map(value.giftIdeas.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(recipientIds, "recipients", "Recipient id"),
    ...uniqueFindings(occasionIds, "occasions", "Occasion id"),
    ...uniqueFindings(preferenceIds, "preferences", "Preference id"),
    ...uniqueFindings(giftIds, "giftIdeas", "Gift id"),
    ...uniqueFindings(value.shortlist.map((item) => item.id), "shortlist", "Shortlist id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, recipient] of value.recipients.entries()) {
    findings.push(
      ...uniqueFindings(recipient.sourceRefs, `recipients.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(recipient.sourceRefs, sourceSet, `recipients.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, occasion] of value.occasions.entries()) {
    findings.push(
      ...referenceFindings([occasion.recipientRef], recipientSet, `occasions.${index}.recipientRef`, "Recipient reference"),
      ...uniqueFindings(occasion.sourceRefs, `occasions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(occasion.sourceRefs, sourceSet, `occasions.${index}.sourceRefs`, "Source reference"),
    );
    if (occasion.budget !== null && occasion.currency !== value.plan.currency) {
      findings.push(finding("budget_currency_mismatch", `occasions.${index}.currency`, "Occasion budgets must use the plan currency."));
    }
  }
  for (const [index, preference] of value.preferences.entries()) {
    findings.push(
      ...referenceFindings([preference.recipientRef], recipientSet, `preferences.${index}.recipientRef`, "Recipient reference"),
      ...uniqueFindings(preference.sourceRefs, `preferences.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(preference.sourceRefs, sourceSet, `preferences.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, gift] of value.giftIdeas.entries()) {
    findings.push(
      ...referenceFindings([gift.recipientRef], recipientSet, `giftIdeas.${index}.recipientRef`, "Recipient reference"),
      ...referenceFindings([gift.occasionRef], occasionSet, `giftIdeas.${index}.occasionRef`, "Occasion reference"),
      ...uniqueFindings(gift.sourceRefs, `giftIdeas.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(gift.sourceRefs, sourceSet, `giftIdeas.${index}.sourceRefs`, "Source reference"),
    );
    const occasion = occasionById.get(gift.occasionRef);
    if (occasion && occasion.recipientRef !== gift.recipientRef) {
      findings.push(finding("occasion_recipient_mismatch", `giftIdeas.${index}.occasionRef`, "Gift occasion must belong to the same recipient."));
    }
    if (gift.estimatedCost !== null) {
      if (gift.currency !== value.plan.currency) {
        findings.push(finding("gift_currency_mismatch", `giftIdeas.${index}.currency`, "Gift costs must use the plan currency."));
      }
      if (occasion?.budget !== null && gift.estimatedCost > occasion.budget) {
        findings.push(finding("budget_exceeded", `giftIdeas.${index}.estimatedCost`, "Gift ideas over the occasion budget cannot be recommended without owner review."));
      }
    }
    const hasMerchantOrHistory = gift.sourceRefs.some((ref) =>
      ["merchant-page", "gift-history", "recipient-preference", "owner-note", "relationship-note"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasMerchantOrHistory) {
      findings.push(finding("unsupported_gift_source", `giftIdeas.${index}.sourceRefs`, "Gift ideas require owner, recipient, merchant, or gift-history evidence."));
    }
  }
  for (const [index, pick] of value.shortlist.entries()) {
    findings.push(
      ...referenceFindings([pick.giftRef], giftSet, `shortlist.${index}.giftRef`, "Gift reference"),
      ...uniqueFindings(pick.preferenceRefs, `shortlist.${index}.preferenceRefs`, "Preference reference"),
      ...referenceFindings(pick.preferenceRefs, preferenceSet, `shortlist.${index}.preferenceRefs`, "Preference reference"),
    );
    const gift = giftById.get(pick.giftRef);
    const occasion = gift ? occasionById.get(gift.occasionRef) : null;
    if (
      pick.state === "recommended" &&
      (!gift ||
        !["available", "limited"].includes(gift.availability) ||
        !["arrives-before-occasion", "not-needed"].includes(gift.shippingState) ||
        (gift.estimatedCost !== null && occasion?.budget !== null && gift.estimatedCost > occasion.budget))
    ) {
      findings.push(finding("unsupported_recommendation", `shortlist.${index}`, "Recommended gifts require available evidence, acceptable timing, and budget fit."));
    }
    if (
      (pick.state === "blocked" && !pick.blockedReason) ||
      (pick.state !== "blocked" && pick.blockedReason !== null)
    ) {
      findings.push(finding("incoherent_blocked_state", `shortlist.${index}.blockedReason`, "Only blocked gift shortlist items may carry a blocked reason."));
    }
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.recipientRefs, `reviewQuestions.${index}.recipientRefs`, "Recipient reference"),
      ...referenceFindings(question.recipientRefs, recipientSet, `reviewQuestions.${index}.recipientRefs`, "Recipient reference"),
      ...uniqueFindings(question.giftRefs, `reviewQuestions.${index}.giftRefs`, "Gift reference"),
      ...referenceFindings(question.giftRefs, giftSet, `reviewQuestions.${index}.giftRefs`, "Gift reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready gift plans cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    shortlist: value.shortlist.map(({ fitReason, blockedReason }) => ({ fitReason, blockedReason })),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(buy|purchase|reserve|return|ship|send|message|invite|calendar|post|publish|share the surprise|store address|relationship status|infer)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "shortlist", "Gift artifacts must not instruct purchase, shipping, messaging, calendar, posting, surprise-sharing, address-storage, or sensitive inference actions."));
  }
  if (value.handoff.owner === "gift-relationship-manager") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Gift, message, calendar, address, privacy, and relationship-sensitive decisions must remain with the named owner."));
  }
  return findings;
}

function publicSafetyFindings(value) {
  const alertIds = value.alerts.map((item) => item.id);
  const alerts = new Set(alertIds);
  const findings = [
    ...uniqueFindings(alertIds, "alerts", "Alert id"),
    ...uniqueFindings(value.observations.map((item) => item.id), "observations", "Observation id"),
    ...uniqueFindings(value.actions.map((item) => item.id), "actions", "Action id"),
  ];
  for (const [index, alert] of value.alerts.entries()) {
    if (Date.parse(alert.expiresAt) <= Date.parse(alert.issuedAt)) {
      findings.push(
        finding(
          "invalid_time_range",
          `alerts.${index}.expiresAt`,
          "Alert expiry must be later than its issue time.",
        ),
      );
    }
  }
  for (const [index, observation] of value.observations.entries()) {
    findings.push(
      ...uniqueFindings(
        observation.alertRefs,
        `observations.${index}.alertRefs`,
        "Alert reference",
      ),
      ...referenceFindings(
        observation.alertRefs,
        alerts,
        `observations.${index}.alertRefs`,
        "Alert reference",
      ),
    );
  }
  for (const [index, action] of value.actions.entries()) {
    findings.push(
      ...uniqueFindings(action.alertRefs, `actions.${index}.alertRefs`, "Alert reference"),
      ...referenceFindings(
        action.alertRefs,
        alerts,
        `actions.${index}.alertRefs`,
        "Alert reference",
      ),
    );
  }
  return findings;
}

function recruitingFindings(value) {
  const interviewerIds = value.interviewers.map((item) => item.id);
  const competencyIds = value.competencies.map((item) => item.id);
  const constraintIds = value.constraints.map((item) => item.id);
  const sessionIds = value.sessions.map((item) => item.id);
  const interviewers = new Set(interviewerIds);
  const competencies = new Set(competencyIds);
  const constraints = new Set(constraintIds);
  const sessions = new Set(sessionIds);
  const findings = [
    ...uniqueFindings(interviewerIds, "interviewers", "Interviewer id"),
    ...uniqueFindings(competencyIds, "competencies", "Competency id"),
    ...uniqueFindings(constraintIds, "constraints", "Constraint id"),
    ...uniqueFindings(sessionIds, "sessions", "Session id"),
  ];
  for (const [index, session] of value.sessions.entries()) {
    findings.push(
      ...uniqueFindings(
        session.interviewerRefs,
        `sessions.${index}.interviewerRefs`,
        "Interviewer reference",
      ),
      ...referenceFindings(
        session.interviewerRefs,
        interviewers,
        `sessions.${index}.interviewerRefs`,
        "Interviewer reference",
      ),
      ...uniqueFindings(
        session.competencyRefs,
        `sessions.${index}.competencyRefs`,
        "Competency reference",
      ),
      ...referenceFindings(
        session.competencyRefs,
        competencies,
        `sessions.${index}.competencyRefs`,
        "Competency reference",
      ),
      ...uniqueFindings(
        session.constraintRefs,
        `sessions.${index}.constraintRefs`,
        "Constraint reference",
      ),
      ...referenceFindings(
        session.constraintRefs,
        constraints,
        `sessions.${index}.constraintRefs`,
        "Constraint reference",
      ),
    );
    if (Date.parse(session.end) <= Date.parse(session.start)) {
      findings.push(
        finding(
          "invalid_time_range",
          `sessions.${index}.end`,
          "Interview session end must be later than its start.",
        ),
      );
    }
  }
  for (const [index, communication] of value.communications.entries()) {
    findings.push(
      ...uniqueFindings(
        communication.sessionRefs,
        `communications.${index}.sessionRefs`,
        "Session reference",
      ),
      ...referenceFindings(
        communication.sessionRefs,
        sessions,
        `communications.${index}.sessionRefs`,
        "Session reference",
      ),
    );
  }
  return findings;
}

function salesOperationsFindings(value) {
  const dealIds = value.deals.map((item) => item.id);
  const deals = new Set(dealIds);
  const findings = [
    ...uniqueFindings(dealIds, "deals", "Deal id"),
    ...uniqueFindings(value.risks.map((item) => item.id), "risks", "Risk id"),
    ...uniqueFindings(value.actions.map((item) => item.id), "actions", "Action id"),
  ];
  for (const [index, change] of value.changes.entries()) {
    findings.push(
      ...referenceFindings([change.dealRef], deals, `changes.${index}.dealRef`, "Deal reference"),
    );
  }
  for (const [index, risk] of value.risks.entries()) {
    findings.push(
      ...uniqueFindings(risk.dealRefs, `risks.${index}.dealRefs`, "Deal reference"),
      ...referenceFindings(risk.dealRefs, deals, `risks.${index}.dealRefs`, "Deal reference"),
    );
  }
  for (const [index, action] of value.actions.entries()) {
    findings.push(
      ...uniqueFindings(action.dealRefs, `actions.${index}.dealRefs`, "Deal reference"),
      ...referenceFindings(
        action.dealRefs,
        deals,
        `actions.${index}.dealRefs`,
        "Deal reference",
      ),
    );
  }
  return findings;
}

function civicDataFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const measureIds = value.measures.map((item) => item.id);
  const sources = new Set(sourceIds);
  const measures = new Set(measureIds);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(measureIds, "measures", "Measure id"),
    ...uniqueFindings(value.comparisons.map((item) => item.id), "comparisons", "Comparison id"),
  ];
  for (const [index, measure] of value.measures.entries()) {
    findings.push(
      ...uniqueFindings(
        measure.sourceRefs,
        `measures.${index}.sourceRefs`,
        "Source reference",
      ),
      ...referenceFindings(
        measure.sourceRefs,
        sources,
        `measures.${index}.sourceRefs`,
        "Source reference",
      ),
    );
    if (measure.geographyRef !== value.geography.id) {
      findings.push(
        finding(
          "dangling_reference",
          `measures.${index}.geographyRef`,
          `Geography reference ${JSON.stringify(measure.geographyRef)} does not resolve.`,
        ),
      );
    }
  }
  for (const [index, comparison] of value.comparisons.entries()) {
    findings.push(
      ...uniqueFindings(
        comparison.measureRefs,
        `comparisons.${index}.measureRefs`,
        "Measure reference",
      ),
      ...referenceFindings(
        comparison.measureRefs,
        measures,
        `comparisons.${index}.measureRefs`,
        "Measure reference",
      ),
    );
  }
  return findings;
}

function changeControlFindings(value) {
  const stepIds = value.plan.steps.map((item) => item.id);
  const steps = new Set(stepIds);
  const findings = [
    ...uniqueFindings(stepIds, "plan.steps", "Step id"),
    ...uniqueFindings(value.execution.stepResults.map((item) => item.stepRef), "execution.stepResults", "Step result reference"),
  ];
  const expectedDigest = computeChangePlanDigest(value.plan);
  if (value.plan.digest !== expectedDigest) {
    findings.push(
      finding("invalid_plan_digest", "plan.digest", "Plan digest must be the SHA-256 of the canonical plan content."),
    );
  }
  if (value.decision.planDigest !== value.plan.digest) {
    findings.push(finding("digest_mismatch", "decision.planDigest", "Owner decision must bind the current plan digest."));
  }
  if (value.execution.planDigest !== value.plan.digest) {
    findings.push(finding("digest_mismatch", "execution.planDigest", "Execution must bind the current plan digest."));
  }
  for (const [index, result] of value.execution.stepResults.entries()) {
    findings.push(
      ...referenceFindings([result.stepRef], steps, `execution.stepResults.${index}.stepRef`, "Step reference"),
    );
  }
  if (
    value.execution.state === "verified" &&
    (value.decision.state !== "approved-by-owner" ||
      value.execution.stepResults.length !== value.plan.steps.length ||
      value.execution.stepResults.some((item) => item.state !== "passed") ||
      value.execution.verificationResults.length === 0)
  ) {
    findings.push(
      finding(
        "unsupported_terminal_state",
        "execution.state",
        "Verified execution requires owner approval, one passing result per plan step, and verification evidence.",
      ),
    );
  }
  if (Date.parse(value.decision.decidedAt) < Date.parse(value.plan.generatedAt)) {
    findings.push(
      finding("invalid_time_order", "decision.decidedAt", "Owner decision cannot predate plan generation."),
    );
  }
  return findings;
}

function caseContinuityFindings(value) {
  const evidenceIds = value.evidence.map((item) => item.id);
  const checkpointIds = value.checkpoints.map((item) => item.id);
  const evidence = new Set(evidenceIds);
  const checkpoints = new Set(checkpointIds);
  const findings = [
    ...uniqueFindings(evidenceIds, "evidence", "Evidence id"),
    ...uniqueFindings(checkpointIds, "checkpoints", "Checkpoint id"),
    ...uniqueFindings(value.actions.map((item) => item.id), "actions", "Action id"),
  ];
  const latestRecordedAt = Date.parse(value.checkpoints.at(-1).recordedAt);
  for (const [index, item] of value.evidence.entries()) {
    if (Date.parse(item.expiresAt) <= Date.parse(item.observedAt)) {
      findings.push(
        finding("invalid_time_range", `evidence.${index}.expiresAt`, "Evidence expiry must follow observation time."),
      );
    }
    if (item.state === "current" && Date.parse(item.expiresAt) <= latestRecordedAt) {
      findings.push(
        finding(
          "stale_evidence_state",
          `evidence.${index}.state`,
          "Evidence expired by the latest checkpoint cannot remain current.",
        ),
      );
    }
  }
  for (const [index, checkpoint] of value.checkpoints.entries()) {
    findings.push(
      ...uniqueFindings(checkpoint.evidenceRefs, `checkpoints.${index}.evidenceRefs`, "Evidence reference"),
      ...referenceFindings(
        checkpoint.evidenceRefs,
        evidence,
        `checkpoints.${index}.evidenceRefs`,
        "Evidence reference",
      ),
    );
    const expectedPrevious = index === 0 ? null : value.checkpoints[index - 1].id;
    if (checkpoint.previousRef !== expectedPrevious || checkpoint.version !== index + 1) {
      findings.push(
        finding(
          "invalid_checkpoint_chain",
          `checkpoints.${index}`,
          "Checkpoint versions must be ordered and link directly to their predecessor.",
        ),
      );
    }
    for (const reference of checkpoint.evidenceRefs) {
      const item = value.evidence.find((candidate) => candidate.id === reference);
      if (item && Date.parse(item.observedAt) > Date.parse(checkpoint.recordedAt)) {
        findings.push(
          finding(
            "future_evidence_reference",
            `checkpoints.${index}.evidenceRefs`,
            `Checkpoint cannot reference evidence ${JSON.stringify(reference)} observed later.`,
          ),
        );
      }
    }
  }
  for (const [index, action] of value.actions.entries()) {
    findings.push(
      ...uniqueFindings(action.evidenceRefs, `actions.${index}.evidenceRefs`, "Evidence reference"),
      ...referenceFindings(action.evidenceRefs, evidence, `actions.${index}.evidenceRefs`, "Evidence reference"),
    );
  }
  findings.push(
    ...referenceFindings([value.resume.checkpointRef], checkpoints, "resume.checkpointRef", "Checkpoint reference"),
  );
  if (value.resume.checkpointRef !== value.checkpoints.at(-1).id) {
    findings.push(
      finding("stale_resume_point", "resume.checkpointRef", "Resume instructions must reference the latest checkpoint."),
    );
  }
  return findings;
}

function delegationFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const assignmentIds = value.assignments.map((item) => item.id);
  const resultIds = value.results.map((item) => item.id);
  const sources = new Set(sourceIds);
  const assignments = new Map(value.assignments.map((item) => [item.id, item]));
  const results = new Set(resultIds);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(assignmentIds, "assignments", "Assignment id"),
    ...uniqueFindings(resultIds, "results", "Result id"),
    ...uniqueFindings(value.conflicts.map((item) => item.id), "conflicts", "Conflict id"),
  ];
  for (const [index, assignment] of value.assignments.entries()) {
    findings.push(
      ...uniqueFindings(assignment.sourceRefs, `assignments.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(
        assignment.sourceRefs,
        sources,
        `assignments.${index}.sourceRefs`,
        "Source reference",
      ),
    );
  }
  for (const [index, result] of value.results.entries()) {
    findings.push(
      ...referenceFindings(
        [result.assignmentRef],
        new Set(assignmentIds),
        `results.${index}.assignmentRef`,
        "Assignment reference",
      ),
      ...uniqueFindings(result.sourceRefs, `results.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(result.sourceRefs, sources, `results.${index}.sourceRefs`, "Source reference"),
    );
    const assignment = assignments.get(result.assignmentRef);
    if (assignment && assignment.workerSessionRef !== result.workerSessionRef) {
      findings.push(
        finding(
          "session_mismatch",
          `results.${index}.workerSessionRef`,
          "Worker result session must match its assignment.",
        ),
      );
    }
    if (
      assignment &&
      result.sourceRefs.some((reference) => !assignment.sourceRefs.includes(reference))
    ) {
      findings.push(
        finding(
          "scope_expansion",
          `results.${index}.sourceRefs`,
          "Worker result may cite only sources assigned to that worker.",
        ),
      );
    }
  }
  for (const [index, assignment] of value.assignments.entries()) {
    const matchingResults = value.results.filter((result) => result.assignmentRef === assignment.id);
    if (assignment.state === "completed" && matchingResults.length !== 1) {
      findings.push(
        finding(
          "missing_completed_result",
          `assignments.${index}.state`,
          "A completed assignment requires exactly one provenance-linked result.",
        ),
      );
    }
  }
  for (const [index, conflict] of value.conflicts.entries()) {
    findings.push(
      ...uniqueFindings(conflict.resultRefs, `conflicts.${index}.resultRefs`, "Result reference"),
      ...referenceFindings(
        conflict.resultRefs,
        results,
        `conflicts.${index}.resultRefs`,
        "Result reference",
      ),
    );
  }
  findings.push(
    ...uniqueFindings(value.synthesis.resultRefs, "synthesis.resultRefs", "Result reference"),
    ...referenceFindings(value.synthesis.resultRefs, results, "synthesis.resultRefs", "Result reference"),
  );
  if (value.synthesis.decisionOwner !== value.decisionOwner) {
    findings.push(
      finding(
        "owner_mismatch",
        "synthesis.decisionOwner",
        "Synthesis must preserve the parent accountable decision owner.",
      ),
    );
  }
  return findings;
}

function modelEvaluationFindings(value) {
  const criterionIds = value.criteria.map((item) => item.id);
  const anchorIds = value.anchors.map((item) => item.id);
  const outputIds = value.outputs.map((item) => item.id);
  const evaluatorIds = value.evaluators.map((item) => item.id);
  const judgmentIds = value.judgments.map((item) => item.id);
  const criteria = new Map(value.criteria.map((item) => [item.id, item]));
  const judgments = new Map(value.judgments.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(criterionIds, "criteria", "Criterion id"),
    ...uniqueFindings(anchorIds, "anchors", "Anchor id"),
    ...uniqueFindings(outputIds, "outputs", "Output id"),
    ...uniqueFindings(value.outputs.map((item) => item.blindLabel), "outputs", "Blind label"),
    ...uniqueFindings(value.outputs.map((item) => item.sourceRef), "outputs", "Blinded source"),
    ...uniqueFindings(evaluatorIds, "evaluators", "Evaluator id"),
    ...uniqueFindings(judgmentIds, "judgments", "Judgment id"),
    ...uniqueFindings(value.disagreements.map((item) => item.id), "disagreements", "Disagreement id"),
  ];
  const anchors = new Set(anchorIds);
  const requiredAnchors = new Set(anchorIds);
  const outputs = new Set(outputIds);
  const evaluators = new Set(evaluatorIds);
  const judgmentSet = new Set(judgmentIds);
  for (const [index, criterion] of value.criteria.entries()) {
    findings.push(
      ...uniqueFindings(criterion.anchorRefs, `criteria.${index}.anchorRefs`, "Anchor reference"),
      ...referenceFindings(
        criterion.anchorRefs,
        anchors,
        `criteria.${index}.anchorRefs`,
        "Anchor reference",
      ),
    );
    for (const anchorRef of criterion.anchorRefs) {
      const anchor = value.anchors.find((item) => item.id === anchorRef);
      if (anchor && anchor.criterionRef !== criterion.id) {
        findings.push(
          finding(
            "anchor_criterion_mismatch",
            `criteria.${index}.anchorRefs`,
            `Anchor ${JSON.stringify(anchorRef)} belongs to a different criterion.`,
          ),
        );
      }
    }
    if (criterion.scale.max <= criterion.scale.min) {
      findings.push(
        finding(
          "invalid_score_scale",
          `criteria.${index}.scale`,
          "Criterion score maximum must be greater than its minimum.",
        ),
      );
    }
  }
  for (const [index, anchor] of value.anchors.entries()) {
    findings.push(
      ...referenceFindings(
        [anchor.criterionRef],
        new Set(criterionIds),
        `anchors.${index}.criterionRef`,
        "Criterion reference",
      ),
    );
    const criterion = criteria.get(anchor.criterionRef);
    if (
      criterion &&
      (anchor.score < criterion.scale.min || anchor.score > criterion.scale.max)
    ) {
      findings.push(
        finding(
          "score_out_of_range",
          `anchors.${index}.score`,
          "Anchor score must fit the referenced criterion scale.",
        ),
      );
    }
  }
  for (const [index, output] of value.outputs.entries()) {
    const blindId = output.blindLabel.replace(/^System /, "").toLowerCase();
    if (
      output.id !== `output-${blindId}` ||
      output.sourceRef !== `blinded/system-${blindId}.json`
    ) {
      findings.push(
        finding(
          "exposed_output_identity",
          `outputs.${index}`,
          "Output ids and source paths must derive only from their opaque blind label.",
        ),
      );
    }
  }
  for (const [index, evaluator] of value.evaluators.entries()) {
    findings.push(
      ...uniqueFindings(evaluator.anchorRefs, `evaluators.${index}.anchorRefs`, "Anchor reference"),
      ...referenceFindings(
        evaluator.anchorRefs,
        anchors,
        `evaluators.${index}.anchorRefs`,
        "Anchor reference",
      ),
    );
    if (
      evaluator.calibrationState === "calibrated" &&
      (evaluator.anchorRefs.length !== requiredAnchors.size ||
        [...requiredAnchors].some((reference) => !evaluator.anchorRefs.includes(reference)))
    ) {
      findings.push(
        finding(
          "incomplete_calibration",
          `evaluators.${index}.anchorRefs`,
          "A calibrated evaluator must complete the full declared anchor set.",
        ),
      );
    }
  }
  const samplingKeys = value.samplingPlan.map(
    (item) => `${item.outputRef}\u0000${item.criterionRef}\u0000${item.evaluatorRef}`,
  );
  const samplingSet = new Set(samplingKeys);
  findings.push(...uniqueFindings(samplingKeys, "samplingPlan", "Sampling tuple"));
  for (const [index, item] of value.samplingPlan.entries()) {
    findings.push(
      ...referenceFindings(
        [item.outputRef],
        outputs,
        `samplingPlan.${index}.outputRef`,
        "Output reference",
      ),
      ...referenceFindings(
        [item.criterionRef],
        new Set(criterionIds),
        `samplingPlan.${index}.criterionRef`,
        "Criterion reference",
      ),
      ...referenceFindings(
        [item.evaluatorRef],
        evaluators,
        `samplingPlan.${index}.evaluatorRef`,
        "Evaluator reference",
      ),
    );
  }
  for (const [values, offset, label] of [
    [outputIds, 0, "output"],
    [criterionIds, 1, "criterion"],
    [evaluatorIds, 2, "evaluator"],
  ]) {
    for (const valueId of values) {
      if (![...samplingSet].some((key) => key.split("\u0000")[offset] === valueId)) {
        findings.push(
          finding(
            "incomplete_sampling_plan",
            "samplingPlan",
            `Sampling plan does not cover declared ${label} ${JSON.stringify(valueId)}.`,
          ),
        );
      }
    }
  }
  const judgmentKeys = new Set();
  for (const [index, judgment] of value.judgments.entries()) {
    findings.push(
      ...referenceFindings(
        [judgment.outputRef],
        outputs,
        `judgments.${index}.outputRef`,
        "Output reference",
      ),
      ...referenceFindings(
        [judgment.criterionRef],
        new Set(criterionIds),
        `judgments.${index}.criterionRef`,
        "Criterion reference",
      ),
      ...referenceFindings(
        [judgment.evaluatorRef],
        evaluators,
        `judgments.${index}.evaluatorRef`,
        "Evaluator reference",
      ),
    );
    const key = `${judgment.outputRef}\u0000${judgment.criterionRef}\u0000${judgment.evaluatorRef}`;
    if (judgmentKeys.has(key)) {
      findings.push(
        finding(
          "duplicate_judgment",
          `judgments.${index}`,
          "Each output, criterion, and evaluator combination may have only one judgment.",
        ),
      );
    }
    judgmentKeys.add(key);
    if (!samplingSet.has(key)) {
      findings.push(
        finding(
          "unplanned_judgment",
          `judgments.${index}`,
          "Every judgment must belong to the declared sampling plan.",
        ),
      );
    }
    const criterion = criteria.get(judgment.criterionRef);
    if (
      criterion &&
      (judgment.score < criterion.scale.min || judgment.score > criterion.scale.max)
    ) {
      findings.push(
        finding(
          "score_out_of_range",
          `judgments.${index}.score`,
          "Judgment score must fit the referenced criterion scale.",
        ),
      );
    }
  }
  const judgmentsByGroup = new Map();
  for (const judgment of value.judgments) {
    const key = `${judgment.outputRef}\u0000${judgment.criterionRef}`;
    const group = judgmentsByGroup.get(key) ?? [];
    group.push(judgment);
    judgmentsByGroup.set(key, group);
  }
  const disagreementGroups = new Map();
  for (const [index, disagreement] of value.disagreements.entries()) {
    findings.push(
      ...uniqueFindings(
        disagreement.judgmentRefs,
        `disagreements.${index}.judgmentRefs`,
        "Judgment reference",
      ),
      ...referenceFindings(
        disagreement.judgmentRefs,
        judgmentSet,
        `disagreements.${index}.judgmentRefs`,
        "Judgment reference",
      ),
    );
    const linked = disagreement.judgmentRefs
      .map((reference) => judgments.get(reference))
      .filter(Boolean);
    if (
      linked.length > 1 &&
      linked.some(
        (item) =>
          item.outputRef !== linked[0].outputRef || item.criterionRef !== linked[0].criterionRef,
      )
    ) {
      findings.push(
        finding(
          "incomparable_disagreement",
          `disagreements.${index}.judgmentRefs`,
          "A disagreement may compare judgments only for the same output and criterion.",
        ),
      );
    }
    if (linked.length > 1) {
      const groupKey = `${linked[0].outputRef}\u0000${linked[0].criterionRef}`;
      const completeGroup = judgmentsByGroup.get(groupKey) ?? [];
      if (disagreementGroups.has(groupKey)) {
        findings.push(
          finding(
            "duplicate_disagreement",
            `disagreements.${index}`,
            "Each output and criterion pair may have only one disagreement record.",
          ),
        );
      }
      disagreementGroups.set(groupKey, disagreement);
      if (
        disagreement.judgmentRefs.length !== completeGroup.length ||
        completeGroup.some((judgment) => !disagreement.judgmentRefs.includes(judgment.id))
      ) {
        findings.push(
          finding(
            "incomplete_disagreement",
            `disagreements.${index}.judgmentRefs`,
            "A disagreement must include every judgment for its output and criterion pair.",
          ),
        );
      }
      const scores = completeGroup.map((item) => item.score);
      const spread = Math.max(...scores) - Math.min(...scores);
      if (!numbersEqual(spread, disagreement.spread)) {
        findings.push(
          finding(
            "spread_mismatch",
            `disagreements.${index}.spread`,
            "Disagreement spread must equal the linked judgment score range.",
          ),
        );
      }
      if (
        disagreement.thresholdExceeded !==
        (spread >= value.study.disagreementThreshold)
      ) {
        findings.push(
          finding(
            "threshold_mismatch",
            `disagreements.${index}.thresholdExceeded`,
            "Threshold state must match the study disagreement threshold.",
          ),
        );
      }
    }
  }
  const materialDisagreementGroups = new Set();
  for (const [groupKey, group] of judgmentsByGroup.entries()) {
    if (group.length < 2) {
      continue;
    }
    const scores = group.map((item) => item.score);
    const spread = Math.max(...scores) - Math.min(...scores);
    if (spread < value.study.disagreementThreshold) {
      continue;
    }
    materialDisagreementGroups.add(groupKey);
    if (!disagreementGroups.has(groupKey)) {
      findings.push(
        finding(
          "missing_disagreement",
          "disagreements",
          "Every threshold-crossing output and criterion pair requires a disagreement record.",
        ),
      );
    }
  }
  const missingKeys = value.coverage.missing.map(
    (item) => `${item.outputRef}\u0000${item.criterionRef}\u0000${item.evaluatorRef}`,
  );
  findings.push(
    ...uniqueFindings(missingKeys, "coverage.missing", "Missing judgment key"),
  );
  for (const [index, item] of value.coverage.missing.entries()) {
    const key = `${item.outputRef}\u0000${item.criterionRef}\u0000${item.evaluatorRef}`;
    findings.push(
      ...referenceFindings(
        [item.outputRef],
        outputs,
        `coverage.missing.${index}.outputRef`,
        "Output reference",
      ),
      ...referenceFindings(
        [item.criterionRef],
        new Set(criterionIds),
        `coverage.missing.${index}.criterionRef`,
        "Criterion reference",
      ),
      ...referenceFindings(
        [item.evaluatorRef],
        evaluators,
        `coverage.missing.${index}.evaluatorRef`,
        "Evaluator reference",
      ),
    );
    if (!samplingSet.has(key)) {
      findings.push(
        finding(
          "unplanned_missing_judgment",
          `coverage.missing.${index}`,
          "Every missing judgment must belong to the declared sampling plan.",
        ),
      );
    }
  }
  for (const key of samplingSet) {
    const occurrences = Number(judgmentKeys.has(key)) + Number(missingKeys.includes(key));
    if (occurrences !== 1) {
      findings.push(
        finding(
          "sampling_coverage_mismatch",
          "samplingPlan",
          "Every planned judgment must appear exactly once as completed or explicitly missing.",
        ),
      );
    }
  }
  if (
    value.coverage.completedJudgments !== value.judgments.length ||
    value.coverage.expectedJudgments !== value.samplingPlan.length ||
    value.coverage.expectedJudgments !== value.coverage.completedJudgments + value.coverage.missing.length
  ) {
    findings.push(
      finding(
        "coverage_mismatch",
        "coverage",
        "Coverage totals must equal the judgment ledger plus explicit missing evaluations.",
      ),
    );
  }
  if (canonicalJson(value.handoff.decisionOwner) !== canonicalJson(value.study.decisionOwner)) {
    findings.push(
      finding(
        "owner_mismatch",
        "handoff.decisionOwner",
        "The comparison handoff must preserve the study decision owner.",
      ),
    );
  }
  if (
    value.study.decisionOwner.id === "model-evaluation-adjudicator" ||
    value.study.blinding.verifiedBy.id === "model-evaluation-adjudicator"
  ) {
    findings.push(
      finding(
        "agent_owned_authority",
        "study",
        "Decision ownership and blinding verification must remain human- or team-owned.",
      ),
    );
  }
  if (
    value.handoff.state === "ready-for-owner" &&
    (value.study.blinding.state !== "verified" ||
      value.evaluators.some((item) => item.calibrationState !== "calibrated") ||
      value.coverage.missing.length > 0 ||
      [...materialDisagreementGroups].some(
        (groupKey) => disagreementGroups.get(groupKey)?.state !== "adjudicated",
      ))
  ) {
    findings.push(
      finding(
        "unsupported_terminal_state",
        "handoff.state",
        "A ready handoff requires verified blinding, calibrated evaluators, complete coverage, and adjudicated threshold-crossing disagreements.",
      ),
    );
  }
  return findings;
}

function vehicleServiceFindings(value) {
  const evidenceIds = value.evidence.map((item) => item.id);
  const evidence = new Set(evidenceIds);
  const providerIds = value.providers.map((item) => item.id);
  const providers = new Set(providerIds);
  const findings = [
    ...uniqueFindings(evidenceIds, "evidence", "Evidence id"),
    ...uniqueFindings(value.observations.map((item) => item.id), "observations", "Observation id"),
    ...uniqueFindings(value.hypotheses.map((item) => item.id), "hypotheses", "Hypothesis id"),
    ...uniqueFindings(value.ownerChecks.map((item) => item.id), "ownerChecks", "Owner check id"),
    ...uniqueFindings(providerIds, "providers", "Provider id"),
  ];
  if (/\b[A-HJ-NPR-Z0-9]{17}\b/iu.test(canonicalJson(value))) {
    findings.push(
      finding(
        "exposed_vehicle_identifier",
        "vehicle",
        "Durable vehicle-service artifacts must not contain a VIN-like identifier.",
      ),
    );
  }
  const evidenceReferences = [
    ...value.observations.map((item) => [item.evidenceRefs, "observations"]),
    [value.assessment.evidenceRefs, "assessment.evidenceRefs"],
    ...value.hypotheses.map((item) => [item.evidenceRefs, "hypotheses"]),
    ...value.ownerChecks.map((item) => [item.evidenceRefs, "ownerChecks"]),
    ...value.providers.map((item) => [[item.sourceRef], "providers"]),
  ];
  for (const [references, path] of evidenceReferences) {
    findings.push(...uniqueFindings(references, path, "Evidence reference"));
    findings.push(...referenceFindings(references, evidence, path, "Evidence reference"));
  }
  for (const [index, hypothesis] of value.hypotheses.entries()) {
    if (
      hypothesis.status === "technician-confirmed" &&
      !hypothesis.evidenceRefs.some((reference) => {
        const item = value.evidence.find((candidate) => candidate.id === reference);
        return item?.authority === "qualified-technician";
      })
    ) {
      findings.push(
        finding(
          "unsupported_diagnosis",
          `hypotheses.${index}`,
          "Only qualified-technician evidence may confirm a vehicle diagnosis.",
        ),
      );
    }
  }
  for (const [index, check] of value.ownerChecks.entries()) {
    if (
      check.safetyClass === "manual-approved" &&
      !check.evidenceRefs.some((reference) => {
        const item = value.evidence.find((candidate) => candidate.id === reference);
        return item?.type === "manual" && item.authority === "manufacturer";
      })
    ) {
      findings.push(
        finding(
          "unsupported_owner_check",
          `ownerChecks.${index}.evidenceRefs`,
          "A manual-approved owner check must cite manufacturer manual evidence.",
        ),
      );
    }
  }
  if (
    value.assessment.safetyCritical &&
    !["stop-driving", "roadside-only", "uncertain"].includes(value.assessment.safeToDrive)
  ) {
    findings.push(
      finding(
        "unsafe_driving_state",
        "assessment.safeToDrive",
        "Safety-critical evidence cannot produce a routine or limited-use driving state.",
      ),
    );
  }
  if (
    ["stop-driving", "roadside-only", "uncertain"].includes(value.assessment.safeToDrive) &&
    !["emergency-services", "roadside-assistance", "qualified-specialist"].includes(
      value.assessment.escalation,
    )
  ) {
    findings.push(
      finding(
        "missing_safety_escalation",
        "assessment.escalation",
        "An unsafe or uncertain driving state requires a qualified escalation.",
      ),
    );
  }
  const appointment = value.appointment;
  const hasPlan = Boolean(appointment.plan);
  const hasApproval = Boolean(appointment.approval);
  const hasIntegration = Boolean(appointment.bookingIntegration);
  const hasReceipt = Boolean(appointment.receipt);
  if (
    (["options-ready", "awaiting-approval", "approved", "booked"].includes(
      appointment.state,
    ) &&
      !hasPlan) ||
    (["approved", "booked"].includes(appointment.state) && !hasApproval) ||
    (appointment.state === "booked" && (!hasIntegration || !hasReceipt)) ||
    (appointment.state !== "booked" && (hasIntegration || hasReceipt)) ||
    (!["approved", "booked"].includes(appointment.state) && hasApproval) ||
    (appointment.state === "not-requested" && hasPlan) ||
    (appointment.state === "blocked" && !appointment.blockedReason)
  ) {
    findings.push(
      finding(
        "incoherent_appointment_state",
        "appointment",
        "Appointment plan, approval, integration, receipt, and blocked reason must match the declared state.",
      ),
    );
  }
  if (appointment.plan) {
    findings.push(
      ...referenceFindings(
        [appointment.plan.providerRef],
        providers,
        "appointment.plan.providerRef",
        "Provider reference",
      ),
    );
    if (appointment.plan.maxDeposit > appointment.plan.maxCost) {
      findings.push(
        finding(
          "deposit_exceeds_cost",
          "appointment.plan.maxDeposit",
          "The approved deposit ceiling cannot exceed the total cost ceiling.",
        ),
      );
    }
  }
  const planDigest = appointment.plan
    ? `sha256:${createHash("sha256").update(canonicalJson(appointment.plan)).digest("hex")}`
    : undefined;
  if (["approved", "booked"].includes(appointment.state)) {
    if (!appointment.plan || !appointment.approval) {
      findings.push(
        finding(
          "missing_appointment_approval",
          "appointment",
          "Approved and booked appointments require an exact plan and owner approval.",
        ),
      );
    } else {
      if (appointment.approval.planDigest !== planDigest) {
        findings.push(
          finding(
            "appointment_digest_mismatch",
            "appointment.approval.planDigest",
            "Appointment approval must bind the exact plan.",
          ),
        );
      }
      if (canonicalJson(appointment.approval.owner) !== canonicalJson(value.owner)) {
        findings.push(
          finding(
            "appointment_owner_mismatch",
            "appointment.approval.owner",
            "Appointment approval must come from the accountable vehicle owner.",
          ),
        );
      }
    }
  }
  if (appointment.state === "booked") {
    if (!appointment.bookingIntegration || !appointment.receipt) {
      findings.push(
        finding(
          "unsupported_booking",
          "appointment",
          "A booked state requires an approved integration and verifiable receipt.",
        ),
      );
    } else {
      if (
        appointment.receipt.planDigest !== planDigest ||
        appointment.receipt.integrationId !== appointment.bookingIntegration.id ||
        appointment.receipt.providerRef !== appointment.plan.providerRef ||
        appointment.bookingIntegration.providerRef !== appointment.plan.providerRef ||
        !appointment.receipt.confirmationRef.startsWith(
          `provider://${appointment.plan.providerRef}/`,
        )
      ) {
        findings.push(
          finding(
            "booking_receipt_mismatch",
            "appointment.receipt",
            "The booking integration and receipt must bind the exact approved plan and provider.",
          ),
        );
      }
      if (
        canonicalJson(appointment.bookingIntegration.configuredBy) !==
        canonicalJson(value.owner)
      ) {
        findings.push(
          finding(
            "unapproved_booking_integration",
            "appointment.bookingIntegration.configuredBy",
            "The accountable owner must approve the configured booking integration.",
          ),
        );
      }
      if (
        appointment.approval &&
        Date.parse(appointment.receipt.bookedAt) < Date.parse(appointment.approval.approvedAt)
      ) {
        findings.push(
          finding(
            "booking_predates_approval",
            "appointment.receipt.bookedAt",
            "A booking receipt cannot predate the owner's exact plan approval.",
          ),
        );
      }
    }
  }
  if (
    canonicalJson(value.handoff.owner) !== canonicalJson(value.owner) ||
    value.owner.id === "vehicle-service-coordinator"
  ) {
    findings.push(
      finding(
        "agent_owned_authority",
        "handoff.owner",
        "Vehicle, repair, payment, and appointment authority must remain owner-controlled.",
      ),
    );
  }
  return findings;
}

function householdStewardFindings(value) {
  const evidenceIds = value.evidence.map((item) => item.id);
  const evidence = new Set(evidenceIds);
  const evidenceById = new Map(value.evidence.map((item) => [item.id, item]));
  const memberIds = value.members.map((item) => item.id);
  const members = new Set(memberIds);
  const memberById = new Map(value.members.map((item) => [item.id, item]));
  const artifactIds = value.sourceArtifacts.map((item) => item.id);
  const artifacts = new Set(artifactIds);
  const artifactById = new Map(value.sourceArtifacts.map((item) => [item.id, item]));
  const assignmentIds = value.assignments.map((item) => item.id);
  const assignments = new Set(assignmentIds);
  const assignmentById = new Map(value.assignments.map((item) => [item.id, item]));
  const resultIds = value.results.map((item) => item.id);
  const results = new Set(resultIds);
  const resultById = new Map(value.results.map((item) => [item.id, item]));
  const budgetIds = value.budgets.map((item) => item.id);
  const budgets = new Set(budgetIds);
  const budgetById = new Map(value.budgets.map((item) => [item.id, item]));
  const policyIds = value.approvalPolicies.map((item) => item.id);
  const policies = new Set(policyIds);
  const policyById = new Map(value.approvalPolicies.map((item) => [item.id, item]));
  const operationIds = value.operations.map((item) => item.id);
  const operations = new Set(operationIds);
  const operationById = new Map(value.operations.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(evidenceIds, "evidence", "Evidence id"),
    ...uniqueFindings(memberIds, "members", "Member id"),
    ...uniqueFindings(artifactIds, "sourceArtifacts", "Source artifact id"),
    ...uniqueFindings(assignmentIds, "assignments", "Assignment id"),
    ...uniqueFindings(resultIds, "results", "Result id"),
    ...uniqueFindings(budgetIds, "budgets", "Budget id"),
    ...uniqueFindings(value.availability.map((item) => item.id), "availability", "Availability id"),
    ...uniqueFindings(policyIds, "approvalPolicies", "Approval policy id"),
    ...uniqueFindings(operationIds, "operations", "Operation id"),
    ...uniqueFindings(value.conflicts.map((item) => item.id), "conflicts", "Conflict id"),
    ...uniqueFindings(value.views.map((item) => item.id), "views", "View id"),
  ];
  for (const [references, allowed, path, label] of [
    ...value.members.map((item, index) => [item.authorityEvidenceRefs, evidence, `members.${index}.authorityEvidenceRefs`, "Evidence reference"]),
    ...value.sourceArtifacts.map((item, index) => [item.permittedMemberRefs, members, `sourceArtifacts.${index}.permittedMemberRefs`, "Member reference"]),
    ...value.assignments.map((item, index) => [item.sourceArtifactRefs, artifacts, `assignments.${index}.sourceArtifactRefs`, "Artifact reference"]),
    ...value.assignments.map((item, index) => [item.permittedMemberRefs, members, `assignments.${index}.permittedMemberRefs`, "Member reference"]),
    ...value.results.map((item, index) => [item.sourceArtifactRefs, artifacts, `results.${index}.sourceArtifactRefs`, "Artifact reference"]),
    ...value.budgets.map((item, index) => [item.approverRefs, members, `budgets.${index}.approverRefs`, "Member reference"]),
    ...value.budgets.map((item, index) => [item.evidenceRefs, evidence, `budgets.${index}.evidenceRefs`, "Evidence reference"]),
    ...value.availability.map((item, index) => [[item.memberRef], members, `availability.${index}.memberRef`, "Member reference"]),
    ...value.availability.map((item, index) => [item.evidenceRefs, evidence, `availability.${index}.evidenceRefs`, "Evidence reference"]),
    ...value.approvalPolicies.map((item, index) => [item.requiredMemberRefs, members, `approvalPolicies.${index}.requiredMemberRefs`, "Member reference"]),
    ...value.operations.map((item, index) => [[item.sourceArtifactRef], artifacts, `operations.${index}.sourceArtifactRef`, "Artifact reference"]),
    ...value.operations.map((item, index) => [item.affectedMemberRefs, members, `operations.${index}.affectedMemberRefs`, "Member reference"]),
    ...value.operations.filter((item) => item.assigneeRef).map((item, index) => [[item.assigneeRef], members, `operations.${index}.assigneeRef`, "Member reference"]),
    ...value.operations.map((item, index) => [[item.budgetRef], budgets, `operations.${index}.budgetRef`, "Budget reference"]),
    ...value.operations.map((item, index) => [item.dependencyRefs, operations, `operations.${index}.dependencyRefs`, "Operation reference"]),
    ...value.operations.map((item, index) => [[item.approvalPolicyRef], policies, `operations.${index}.approvalPolicyRef`, "Policy reference"]),
    ...value.conflicts.map((item, index) => [item.operationRefs, operations, `conflicts.${index}.operationRefs`, "Operation reference"]),
    ...value.conflicts.map((item, index) => [item.memberRefs, members, `conflicts.${index}.memberRefs`, "Member reference"]),
    ...value.conflicts.map((item, index) => [item.requiredDecisionRefs, members, `conflicts.${index}.requiredDecisionRefs`, "Member reference"]),
    ...value.views.map((item, index) => [item.audienceMemberRefs, members, `views.${index}.audienceMemberRefs`, "Member reference"]),
    ...value.views.map((item, index) => [item.operationRefs, operations, `views.${index}.operationRefs`, "Operation reference"]),
    ...value.views.map((item, index) => [item.sourceArtifactRefs, artifacts, `views.${index}.sourceArtifactRefs`, "Artifact reference"]),
    [value.handoff.accountableMemberRefs, members, "handoff.accountableMemberRefs", "Member reference"],
  ]) {
    findings.push(...uniqueFindings(references, path, label));
    findings.push(...referenceFindings(references, allowed, path, label));
  }
  if (
    /\b\d{1,6}[A-Za-z]?(?:-\d{1,6}[A-Za-z]?)?\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:Alley|Aly|Avenue|Ave|Boulevard|Blvd|Circle|Cir|Court|Ct|Drive|Dr|Highway|Hwy|Lane|Ln|Parkway|Pkwy|Place|Pl|Road|Rd|Route|Rte|Street|St|Terrace|Ter|Trail|Trl|Way)\b/iu.test(
      canonicalJson(value),
    )
  ) {
    findings.push(
      finding(
        "exposed_household_address",
        "household",
        "Household artifacts must use privacy-safe labels, not a street address.",
      ),
    );
  }
  for (const [index, member] of value.members.entries()) {
    const authorityEvidence = member.authorityEvidenceRefs.map((reference) =>
      evidenceById.get(reference),
    );
    const decisionBearing = member.decisionScopes.some((scope) => scope !== "none");
    if (
      !authorityEvidence.some((item) =>
        ["member-declaration", "authority-record"].includes(item?.type),
      ) ||
      (["minor", "caregiver", "guest", "unknown"].includes(member.kind) &&
        decisionBearing) ||
      (member.decisionScopes.includes("none") && member.decisionScopes.length !== 1) ||
      member.id === "household-steward"
    ) {
      findings.push(
        finding(
          "unsupported_member_authority",
          `members.${index}`,
          "Member roles and decision scopes require direct declarations; limited or unknown roles cannot gain household decision authority.",
        ),
      );
    }
  }
  const clawDomains = {
    "home-repair-coordinator": "home-repair",
    "appliance-care-coordinator": "appliance-care",
    "green-thumb-coordinator": "green-thumb",
    "pet-care-coordinator": "pet-care",
    "vehicle-service-coordinator": "vehicle-service",
    "pond-water-feature-coordinator": "pond-water-feature",
  };
  const asOf = Date.parse(value.household.asOf);
  for (const [index, artifact] of value.sourceArtifacts.entries()) {
    const owner = memberById.get(artifact.decisionOwnerRef);
    if (
      !owner ||
      !owner.domainScopes.includes(clawDomains[artifact.clawId]) ||
      !artifact.permittedMemberRefs.includes(artifact.decisionOwnerRef) ||
      (artifact.state === "current" &&
        (Date.parse(artifact.capturedAt) > asOf || Date.parse(artifact.expiresAt) <= asOf)) ||
      (artifact.state === "stale" && Date.parse(artifact.expiresAt) > asOf) ||
      (artifact.visibility === "restricted" && artifact.permittedMemberRefs.length === memberIds.length)
    ) {
      findings.push(
        finding(
          "unsupported_source_artifact",
          `sourceArtifacts.${index}`,
          "Source artifacts must preserve a scoped human decision owner, truthful freshness, and meaningful restricted visibility.",
        ),
      );
    }
  }
  for (const [index, assignment] of value.assignments.entries()) {
    const assignedArtifacts = assignment.sourceArtifactRefs.map((reference) =>
      artifactById.get(reference),
    );
    const result = assignment.resultRef ? resultById.get(assignment.resultRef) : undefined;
    if (
      assignedArtifacts.some(
        (artifact) =>
          artifact?.clawId !== assignment.specialistClawId ||
          assignment.permittedMemberRefs.some(
            (memberRef) => !artifact.permittedMemberRefs.includes(memberRef),
          ),
      ) ||
      (assignment.state === "completed" &&
        (!result ||
          result.assignmentRef !== assignment.id ||
          result.workerSessionRef !== assignment.workerSessionRef)) ||
      (assignment.state !== "completed" && assignment.resultRef)
    ) {
      findings.push(
        finding(
          "unsafe_worker_assignment",
          `assignments.${index}`,
          "Worker scope, specialist Claw, permitted people, completion state, session, and result must remain exactly bounded.",
        ),
      );
    }
  }
  for (const [index, result] of value.results.entries()) {
    const assignment = assignmentById.get(result.assignmentRef);
    const sourceArtifacts = result.sourceArtifactRefs.map((reference) =>
      artifactById.get(reference),
    );
    if (
      !assignment ||
      assignment.workerSessionRef !== result.workerSessionRef ||
      canonicalJson([...result.sourceArtifactRefs].sort()) !==
        canonicalJson([...assignment.sourceArtifactRefs].sort()) ||
      sourceArtifacts.some(
        (artifact) =>
          artifact?.decisionOwnerRef !== result.decisionOwnerRef ||
          artifact.safetyState !== result.safetyState ||
          artifact.prohibitedActions.some(
            (action) => !result.prohibitedActions.includes(action),
          ),
      )
    ) {
      findings.push(
        finding(
          "worker_result_scope_drift",
          `results.${index}`,
          "Worker results must preserve assignment sources, session provenance, domain decision owner, safety state, and every prohibition.",
        ),
      );
    }
  }
  for (const [index, item] of value.availability.entries()) {
    if (Date.parse(item.startsAt) >= Date.parse(item.endsAt)) {
      findings.push(
        finding(
          "invalid_availability_window",
          `availability.${index}`,
          "Availability windows must be ordered.",
        ),
      );
    }
  }
  for (const [index, operation] of value.operations.entries()) {
    const artifact = artifactById.get(operation.sourceArtifactRef);
    const assignee = operation.assigneeRef
      ? memberById.get(operation.assigneeRef)
      : undefined;
    const budget = budgetById.get(operation.budgetRef);
    const policy = policyById.get(operation.approvalPolicyRef);
    const blocked = operation.state === "blocked";
    const assigneeUnavailable =
      assignee &&
      value.availability.some(
        (item) =>
          item.memberRef === assignee.id &&
          item.state === "unavailable" &&
          Date.parse(item.startsAt) < Date.parse(operation.dueEnd) &&
          Date.parse(item.endsAt) > Date.parse(operation.dueStart),
      );
    const unresolvedDependency = operation.dependencyRefs.some(
      (reference) => operationById.get(reference)?.state !== "completed",
    );
    if (
      Date.parse(operation.dueStart) >= Date.parse(operation.dueEnd) ||
      artifact?.clawId !==
        Object.keys(clawDomains).find((clawId) => clawDomains[clawId] === operation.domain) ||
      operation.affectedMemberRefs.some(
        (memberRef) => !artifact?.permittedMemberRefs.includes(memberRef),
      ) ||
      (assignee &&
        (!assignee.domainScopes.includes(operation.domain) ||
          !artifact?.permittedMemberRefs.includes(assignee.id))) ||
      !budget ||
      budget.currency !== operation.currency ||
      !policy ||
      (["ready", "completed"].includes(operation.state) &&
        (artifact?.state !== "current" ||
          ["emergency", "blocked", "unknown"].includes(artifact.safetyState) ||
          assigneeUnavailable ||
          unresolvedDependency)) ||
      (blocked && operation.blockedReasons.length === 0) ||
      (!blocked && operation.blockedReasons.length > 0)
    ) {
      findings.push(
        finding(
          "unsafe_household_operation",
          `operations.${index}`,
          "Household operations must preserve domain, visibility, member eligibility, time, budget, dependency, safety, and blocked-state boundaries.",
        ),
      );
    }
  }
  for (const budget of value.budgets) {
    const allocated = value.operations
      .filter((item) => item.budgetRef === budget.id && item.state !== "completed")
      .reduce((sum, item) => sum + item.cost, 0);
    const hasOpenBudgetConflict = value.conflicts.some(
      (item) =>
        item.kind === "budget" &&
        item.state === "open" &&
        item.operationRefs.some(
          (reference) => operationById.get(reference)?.budgetRef === budget.id,
        ),
    );
    if (allocated > budget.amount && !hasOpenBudgetConflict) {
      findings.push(
        finding(
          "hidden_budget_conflict",
          `budgets.${budget.id}`,
          "Overallocated household budgets require an explicit open conflict.",
        ),
      );
    }
  }
  for (const [index, conflict] of value.conflicts.entries()) {
    if (
      (conflict.state === "open" &&
        conflict.requiredDecisionRefs.length === 0) ||
      (conflict.state === "resolved-by-members" &&
        conflict.requiredDecisionRefs.length > 0)
    ) {
      findings.push(
        finding(
          "incoherent_household_conflict",
          `conflicts.${index}`,
          "Open conflicts retain every required human decision; resolved conflicts retain none.",
        ),
      );
    }
  }
  const requiredSharedExclusions = [
    "exact-address",
    "access-codes",
    "credentials",
    "private-messages",
    "health-details",
    "financial-details",
    "precise-presence",
    "restricted-artifacts",
  ];
  for (const [index, view] of value.views.entries()) {
    const visibleArtifacts = view.sourceArtifactRefs.map((reference) =>
      artifactById.get(reference),
    );
    if (
      visibleArtifacts.some((artifact) =>
        view.audienceMemberRefs.some(
          (memberRef) => !artifact?.permittedMemberRefs.includes(memberRef),
        ),
      ) ||
      (view.kind === "shared" &&
        (visibleArtifacts.some((artifact) => artifact?.visibility === "restricted") ||
          requiredSharedExclusions.some(
            (field) => !view.excludedFields.includes(field),
          ))) ||
      (view.kind === "member-private" && view.audienceMemberRefs.length !== 1)
    ) {
      findings.push(
        finding(
          "household_view_privacy_leak",
          `views.${index}`,
          "Shared and private views must respect every source-artifact audience and suppress sensitive household fields.",
        ),
      );
    }
  }
  for (const memberId of memberIds) {
    if (
      !value.views.some(
        (view) =>
          view.kind === "member-private" &&
          view.audienceMemberRefs.length === 1 &&
          view.audienceMemberRefs[0] === memberId,
      )
    ) {
      findings.push(
        finding(
          "missing_member_private_view",
          "views",
          `Member ${JSON.stringify(memberId)} requires a distinct private view.`,
        ),
      );
    }
  }
  const action = value.externalAction;
  const hasPlan = Boolean(action.plan);
  const approvals = action.approvals ?? [];
  const hasIntegration = Boolean(action.integration);
  const hasReceipt = Boolean(action.receipt);
  if (
    (["awaiting-approval", "approved", "completed"].includes(action.state) &&
      !hasPlan) ||
    (action.state === "completed" && (!hasIntegration || !hasReceipt)) ||
    (action.state !== "completed" && (hasIntegration || hasReceipt)) ||
    (action.state === "not-requested" && (hasPlan || approvals.length > 0)) ||
    (action.state === "blocked" && !action.blockedReason)
  ) {
    findings.push(
      finding(
        "incoherent_household_action",
        "externalAction",
        "External action plan, approvals, integration, receipt, and blocked reason must match the declared state.",
      ),
    );
  }
  const planDigest = action.plan
    ? `sha256:${createHash("sha256").update(canonicalJson(action.plan)).digest("hex")}`
    : undefined;
  if (action.plan) {
    findings.push(
      ...referenceFindings(
        [action.plan.operationRef],
        operations,
        "externalAction.plan.operationRef",
        "Operation reference",
      ),
      ...referenceFindings(
        action.plan.affectedMemberRefs,
        members,
        "externalAction.plan.affectedMemberRefs",
        "Member reference",
      ),
      ...referenceFindings(
        [action.plan.approvalPolicyRef],
        policies,
        "externalAction.plan.approvalPolicyRef",
        "Policy reference",
      ),
    );
    const operation = operationById.get(action.plan.operationRef);
    const policy = policyById.get(action.plan.approvalPolicyRef);
    const approvedMembers = approvals.map((approval) => approval.memberRef);
    const approvalComplete =
      policy &&
      policy.requiredMemberRefs.every((memberRef) => approvedMembers.includes(memberRef));
    if (
      !operation ||
      operation.approvalPolicyRef !== action.plan.approvalPolicyRef ||
      action.plan.maxDeposit > action.plan.maxCost ||
      approvals.some(
        (approval) =>
          approval.planDigest !== planDigest ||
          !policy?.requiredMemberRefs.includes(approval.memberRef),
      ) ||
      (["approved", "completed"].includes(action.state) && !approvalComplete) ||
      (action.state === "awaiting-approval" && approvalComplete)
    ) {
      findings.push(
        finding(
          "household_action_approval_mismatch",
          "externalAction",
          "Every policy-required member must separately approve the exact external action plan.",
        ),
      );
    }
  }
  if (
    action.state === "completed" &&
    action.plan &&
    action.integration &&
    action.receipt
  ) {
    const integrationEvidence = evidenceById.get(action.integration.approvalEvidenceRef);
    const receiptEvidence = evidenceById.get(action.receipt.evidenceRef);
    if (
      action.receipt.planDigest !== planDigest ||
      action.receipt.integrationId !== action.integration.id ||
      action.receipt.providerRef !== action.plan.providerRef ||
      action.integration.providerRef !== action.plan.providerRef ||
      !action.receipt.confirmationRef.startsWith(
        `provider://${action.plan.providerRef}/`,
      ) ||
      integrationEvidence?.type !== "integration-approval" ||
      integrationEvidence.authority !== "approved-integration" ||
      integrationEvidence.reference !== action.integration.approvalRef ||
      receiptEvidence?.type !== "provider-receipt" ||
      receiptEvidence.authority !== "provider" ||
      receiptEvidence.reference !== action.receipt.confirmationRef ||
      receiptEvidence.capturedAt !== action.receipt.completedAt ||
      Date.parse(action.receipt.completedAt) >= Date.parse(action.plan.startsAt)
    ) {
      findings.push(
        finding(
          "household_action_receipt_mismatch",
          "externalAction.receipt",
          "Approved integration and provider receipt evidence must bind the exact multi-member plan.",
        ),
      );
    }
  }
  const openConflicts = value.conflicts.some((item) => item.state === "open");
  if (
    (openConflicts && value.handoff.state !== "blocked") ||
    value.handoff.accountableMemberRefs.some((memberRef) => {
      const member = memberById.get(memberRef);
      return (
        !member ||
        member.kind !== "adult" ||
        !member.decisionScopes.includes("shared-maintenance")
      );
    })
  ) {
    findings.push(
      finding(
        "agent_owned_household_authority",
        "handoff",
        "Open conflicts block handoff, and household authority remains with explicitly scoped adult members.",
      ),
    );
  }
  return findings;
}

function workChiefOfStaffFindings(value) {
  const evidenceIds = value.evidence.map((item) => item.id);
  const evidence = new Set(evidenceIds);
  const evidenceById = new Map(value.evidence.map((item) => [item.id, item]));
  const principalIds = value.principals.map((item) => item.id);
  const principals = new Set(principalIds);
  const principalById = new Map(value.principals.map((item) => [item.id, item]));
  const artifactIds = value.sourceArtifacts.map((item) => item.id);
  const artifacts = new Set(artifactIds);
  const artifactById = new Map(value.sourceArtifacts.map((item) => [item.id, item]));
  const assignmentIds = value.assignments.map((item) => item.id);
  const assignments = new Set(assignmentIds);
  const assignmentById = new Map(value.assignments.map((item) => [item.id, item]));
  const resultIds = value.results.map((item) => item.id);
  const results = new Set(resultIds);
  const resultById = new Map(value.results.map((item) => [item.id, item]));
  const capacityIds = value.capacityEnvelopes.map((item) => item.id);
  const capacities = new Set(capacityIds);
  const capacityById = new Map(value.capacityEnvelopes.map((item) => [item.id, item]));
  const policyIds = value.approvalPolicies.map((item) => item.id);
  const policies = new Set(policyIds);
  const policyById = new Map(value.approvalPolicies.map((item) => [item.id, item]));
  const forumIds = value.decisionForums.map((item) => item.id);
  const forums = new Set(forumIds);
  const workstreamIds = value.workstreams.map((item) => item.id);
  const workstreams = new Set(workstreamIds);
  const workstreamById = new Map(value.workstreams.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(evidenceIds, "evidence", "Evidence id"),
    ...uniqueFindings(principalIds, "principals", "Principal id"),
    ...uniqueFindings(artifactIds, "sourceArtifacts", "Source artifact id"),
    ...uniqueFindings(assignmentIds, "assignments", "Assignment id"),
    ...uniqueFindings(resultIds, "results", "Result id"),
    ...uniqueFindings(capacityIds, "capacityEnvelopes", "Capacity envelope id"),
    ...uniqueFindings(policyIds, "approvalPolicies", "Approval policy id"),
    ...uniqueFindings(forumIds, "decisionForums", "Decision forum id"),
    ...uniqueFindings(workstreamIds, "workstreams", "Workstream id"),
    ...uniqueFindings(value.conflicts.map((item) => item.id), "conflicts", "Conflict id"),
    ...uniqueFindings(value.views.map((item) => item.id), "views", "View id"),
  ];
  if (
    Date.parse(value.portfolio.periodStart) > Date.parse(value.portfolio.periodEnd)
  ) {
    findings.push(
      finding(
        "invalid_portfolio_period",
        "portfolio",
        "The operating portfolio period must be ordered.",
      ),
    );
  }
  for (const [index, item] of value.evidence.entries()) {
    if (Date.parse(item.capturedAt) > Date.parse(value.portfolio.asOf)) {
      findings.push(
        finding(
          "future_work_evidence",
          `evidence.${index}.capturedAt`,
          "Portfolio evidence cannot establish authority or state before it was captured.",
        ),
      );
    }
  }
  for (const [references, allowed, path, label] of [
    ...value.evidence.filter((item) => item.subjectPrincipalRef).map((item, index) => [[item.subjectPrincipalRef], principals, `evidence.${index}.subjectPrincipalRef`, "Principal reference"]),
    ...value.evidence.filter((item) => item.authorizedPrincipalRefs).map((item, index) => [item.authorizedPrincipalRefs, principals, `evidence.${index}.authorizedPrincipalRefs`, "Principal reference"]),
    ...value.principals.map((item, index) => [item.authorityEvidenceRefs, evidence, `principals.${index}.authorityEvidenceRefs`, "Evidence reference"]),
    ...value.sourceArtifacts.map((item, index) => [item.permittedPrincipalRefs, principals, `sourceArtifacts.${index}.permittedPrincipalRefs`, "Principal reference"]),
    ...value.assignments.map((item, index) => [item.sourceArtifactRefs, artifacts, `assignments.${index}.sourceArtifactRefs`, "Artifact reference"]),
    ...value.assignments.map((item, index) => [item.permittedPrincipalRefs, principals, `assignments.${index}.permittedPrincipalRefs`, "Principal reference"]),
    ...value.results.map((item, index) => [item.sourceArtifactRefs, artifacts, `results.${index}.sourceArtifactRefs`, "Artifact reference"]),
    ...value.capacityEnvelopes.map((item, index) => [item.approverRefs, principals, `capacityEnvelopes.${index}.approverRefs`, "Principal reference"]),
    ...value.capacityEnvelopes.map((item, index) => [item.evidenceRefs, evidence, `capacityEnvelopes.${index}.evidenceRefs`, "Evidence reference"]),
    ...value.approvalPolicies.map((item, index) => [item.requiredPrincipalRefs, principals, `approvalPolicies.${index}.requiredPrincipalRefs`, "Principal reference"]),
    ...value.approvalPolicies.map((item, index) => [item.authorityEvidenceRefs, evidence, `approvalPolicies.${index}.authorityEvidenceRefs`, "Evidence reference"]),
    ...value.decisionForums.map((item, index) => [item.requiredPrincipalRefs, principals, `decisionForums.${index}.requiredPrincipalRefs`, "Principal reference"]),
    ...value.decisionForums.map((item, index) => [item.workstreamRefs, workstreams, `decisionForums.${index}.workstreamRefs`, "Workstream reference"]),
    ...value.workstreams.map((item, index) => [[item.sourceArtifactRef], artifacts, `workstreams.${index}.sourceArtifactRef`, "Artifact reference"]),
    ...value.workstreams.map((item, index) => [[item.accountableOwnerRef], principals, `workstreams.${index}.accountableOwnerRef`, "Principal reference"]),
    ...value.workstreams.map((item, index) => [[item.decisionOwnerRef], principals, `workstreams.${index}.decisionOwnerRef`, "Principal reference"]),
    ...value.workstreams.flatMap((item, index) => item.capacityDemands.map((demand) => [[demand.capacityRef], capacities, `workstreams.${index}.capacityDemands`, "Capacity reference"])),
    ...value.workstreams.map((item, index) => [item.dependencyRefs, workstreams, `workstreams.${index}.dependencyRefs`, "Workstream reference"]),
    ...value.workstreams.map((item, index) => [[item.forumRef], forums, `workstreams.${index}.forumRef`, "Forum reference"]),
    ...value.conflicts.map((item, index) => [item.workstreamRefs, workstreams, `conflicts.${index}.workstreamRefs`, "Workstream reference"]),
    ...value.conflicts.map((item, index) => [item.principalRefs, principals, `conflicts.${index}.principalRefs`, "Principal reference"]),
    ...value.conflicts.map((item, index) => [item.requiredDecisionRefs, principals, `conflicts.${index}.requiredDecisionRefs`, "Principal reference"]),
    ...value.views.map((item, index) => [item.audiencePrincipalRefs, principals, `views.${index}.audiencePrincipalRefs`, "Principal reference"]),
    ...value.views.map((item, index) => [item.workstreamRefs, workstreams, `views.${index}.workstreamRefs`, "Workstream reference"]),
    ...value.views.map((item, index) => [item.sourceArtifactRefs, artifacts, `views.${index}.sourceArtifactRefs`, "Artifact reference"]),
    [value.handoff.accountablePrincipalRefs, principals, "handoff.accountablePrincipalRefs", "Principal reference"],
  ]) {
    findings.push(...uniqueFindings(references, path, label));
    findings.push(...referenceFindings(references, allowed, path, label));
  }

  for (const [index, principal] of value.principals.entries()) {
    const authorityEvidence = principal.authorityEvidenceRefs.map((reference) =>
      evidenceById.get(reference),
    );
    if (
      !authorityEvidence.some(
        (item) =>
          (["principal-declaration", "decision-right-record"].includes(item?.type) &&
            item.subjectPrincipalRef === principal.id) ||
          (item?.type === "portfolio-charter" &&
            item.authorizedPrincipalRefs?.includes(principal.id)),
      ) ||
      principal.id === "work-chief-of-staff" ||
      (principal.delegationScopes.includes("none") &&
        principal.delegationScopes.length !== 1)
    ) {
      findings.push(
        finding(
          "unsupported_work_principal_authority",
          `principals.${index}`,
          "Leadership roles, decision rights, confidentiality, and delegation require direct authority evidence and can never belong to the agent.",
        ),
      );
    }
  }

  const clawDomains = {
    "executive-assistant": "leadership",
    "delegation-coordinator": "leadership",
    "meeting-intelligence": "leadership",
    "project-manager": "engineering",
    "product-manager": "product",
    "financial-analyst": "finance",
    "recruiting-coordinator": "recruiting",
    "sales-operations": "sales",
    "release-coordinator": "release",
    "change-control-operator": "change-control",
  };
  const domainDecisionScopes = {
    leadership: "portfolio",
    product: "product",
    engineering: "engineering",
    finance: "finance",
    recruiting: "staffing",
    sales: "sales",
    release: "release",
    "change-control": "change-control",
  };
  const asOf = Date.parse(value.portfolio.asOf);
  for (const [index, artifact] of value.sourceArtifacts.entries()) {
    const accountableOwner = principalById.get(artifact.accountableOwnerRef);
    const decisionOwner = principalById.get(artifact.decisionOwnerRef);
    const domain = clawDomains[artifact.clawId];
    if (
      !accountableOwner ||
      !decisionOwner ||
      !artifact.permittedPrincipalRefs.includes(artifact.accountableOwnerRef) ||
      !artifact.permittedPrincipalRefs.includes(artifact.decisionOwnerRef) ||
      !decisionOwner.decisionScopes.includes(domainDecisionScopes[domain]) ||
      Date.parse(artifact.capturedAt) > asOf ||
      Date.parse(artifact.capturedAt) >= Date.parse(artifact.expiresAt) ||
      artifact.permittedPrincipalRefs.some((principalRef) => {
        const principal = principalById.get(principalRef);
        return (
          artifact.confidentiality !== "portfolio-shared" &&
          !principal?.confidentialityScopes.includes(artifact.confidentiality)
        );
      }) ||
      (artifact.state === "current" && Date.parse(artifact.expiresAt) <= asOf) ||
      (artifact.state === "stale" && Date.parse(artifact.expiresAt) > asOf) ||
      (artifact.confidentiality !== "portfolio-shared" &&
        artifact.permittedPrincipalRefs.length === principalIds.length &&
        artifact.sharedSummary.length === 0)
    ) {
      findings.push(
        finding(
          "unsupported_work_source_artifact",
          `sourceArtifacts.${index}`,
          "Source artifacts must preserve truthful freshness, functional decision rights, accountable owners, audience, status meaning, and prohibitions.",
        ),
      );
    }
  }

  for (const [index, policy] of value.approvalPolicies.entries()) {
    const authorityEvidence = policy.authorityEvidenceRefs.map((reference) =>
      evidenceById.get(reference),
    );
    if (
      policy.requiredPrincipalRefs.some(
        (principalRef) =>
          !authorityEvidence.some(
            (item) =>
              (item?.type === "decision-right-record" &&
                item.subjectPrincipalRef === principalRef) ||
              (item?.type === "portfolio-charter" &&
                item.authorizedPrincipalRefs?.includes(principalRef)),
          ),
      )
    ) {
      findings.push(
        finding(
          "unsupported_work_approval_policy",
          `approvalPolicies.${index}`,
          "Commitment approval policies require direct decision-right or portfolio-charter evidence.",
        ),
      );
    }
  }
  for (const [index, capacity] of value.capacityEnvelopes.entries()) {
    const requiredScope = domainDecisionScopes[capacity.function];
    const capacityEvidence = capacity.evidenceRefs.map((reference) =>
      evidenceById.get(reference),
    );
    if (
      Date.parse(capacity.periodStart) > Date.parse(capacity.periodEnd) ||
      Date.parse(capacity.periodStart) < Date.parse(value.portfolio.periodStart) ||
      Date.parse(capacity.periodEnd) > Date.parse(value.portfolio.periodEnd) ||
      capacity.approverRefs.some((principalRef) => {
        const principal = principalById.get(principalRef);
        return (
          !principal?.decisionScopes.includes(requiredScope) &&
          !principal?.decisionScopes.includes("portfolio")
        );
      }) ||
      !capacityEvidence.some((item) => item?.type === "capacity-envelope")
    ) {
      findings.push(
        finding(
          "invalid_capacity_period",
          `capacityEnvelopes.${index}`,
          "Capacity envelopes require an in-horizon period, functionally authorized approvers, and direct capacity evidence.",
        ),
      );
    }
  }

  for (const [index, assignment] of value.assignments.entries()) {
    const assignedArtifacts = assignment.sourceArtifactRefs.map((reference) =>
      artifactById.get(reference),
    );
    const result = assignment.resultRef ? resultById.get(assignment.resultRef) : undefined;
    if (
      assignedArtifacts.some(
        (artifact) =>
          artifact?.clawId !== assignment.specialistClawId ||
          assignment.permittedPrincipalRefs.some(
            (principalRef) => !artifact.permittedPrincipalRefs.includes(principalRef),
          ),
      ) ||
      (assignment.state === "completed" &&
        (!result ||
          result.assignmentRef !== assignment.id ||
          result.workerSessionRef !== assignment.workerSessionRef)) ||
      (assignment.state !== "completed" && assignment.resultRef)
    ) {
      findings.push(
        finding(
          "unsafe_worker_assignment",
          `assignments.${index}`,
          "Worker scope, specialist Claw, sources, audience, completion state, session, and result must remain exactly bounded.",
        ),
      );
    }
  }

  for (const [index, result] of value.results.entries()) {
    const assignment = assignmentById.get(result.assignmentRef);
    const sourceArtifacts = result.sourceArtifactRefs.map((reference) =>
      artifactById.get(reference),
    );
    if (
      !assignment ||
      assignment.state !== "completed" ||
      assignment.resultRef !== result.id ||
      assignment.workerSessionRef !== result.workerSessionRef ||
      canonicalJson([...result.sourceArtifactRefs].sort()) !==
        canonicalJson([...assignment.sourceArtifactRefs].sort()) ||
      sourceArtifacts.some(
        (artifact) =>
          artifact?.decisionOwnerRef !== result.decisionOwnerRef ||
          artifact.statusSemantic !== result.statusSemantic ||
          artifact.prohibitedActions.some(
            (action) => !result.prohibitedActions.includes(action),
          ) ||
          Date.parse(result.producedAt) < Date.parse(artifact.capturedAt),
      ) ||
      Date.parse(result.producedAt) > asOf
    ) {
      findings.push(
        finding(
          "work_result_scope_drift",
          `results.${index}`,
          "Worker results must preserve assignment sources, session provenance, decision owner, source status meaning, and every prohibition.",
        ),
      );
    }
  }

  for (const [index, forum] of value.decisionForums.entries()) {
    const requiredParticipants = new Set(
      forum.workstreamRefs.map(
        (reference) => workstreamById.get(reference)?.decisionOwnerRef,
      ),
    );
    for (const conflict of value.conflicts) {
      if (
        conflict.state === "open" &&
        conflict.workstreamRefs.some((reference) =>
          forum.workstreamRefs.includes(reference),
        )
      ) {
        for (const principalRef of [
          ...conflict.principalRefs,
          ...conflict.requiredDecisionRefs,
        ]) {
          requiredParticipants.add(principalRef);
        }
      }
    }
    if (
      (forum.state === "completed"
        ? Date.parse(forum.startsAt) > asOf
        : Date.parse(forum.startsAt) <= asOf) ||
      forum.workstreamRefs.some(
        (reference) => workstreamById.get(reference)?.forumRef !== forum.id,
      ) ||
      [...requiredParticipants].some(
        (principalRef) =>
          principalRef && !forum.requiredPrincipalRefs.includes(principalRef),
      )
    ) {
      findings.push(
        finding(
          "incoherent_decision_forum",
          `decisionForums.${index}`,
          "Decision forums must be future-dated and contain only workstreams assigned to that exact forum.",
        ),
      );
    }
  }
  for (const [index, workstream] of value.workstreams.entries()) {
    const forumMemberships = value.decisionForums.filter((forum) =>
      forum.workstreamRefs.includes(workstream.id),
    );
    if (
      forumMemberships.length !== 1 ||
      forumMemberships[0].id !== workstream.forumRef
    ) {
      findings.push(
        finding(
          "incoherent_decision_forum",
          `workstreams.${index}.forumRef`,
          "Every workstream must appear exactly once in its declared decision forum.",
        ),
      );
    }
  }

  const overallocatedCapacities = new Set(
    value.capacityEnvelopes
      .filter((capacity) => {
        const allocated = value.workstreams
          .filter((item) => item.state !== "completed")
          .flatMap((item) => item.capacityDemands)
          .filter((item) => item.capacityRef === capacity.id)
          .reduce((sum, item) => sum + item.amount, 0);
        return allocated > capacity.amount;
      })
      .map((capacity) => capacity.id),
  );
  for (const [index, workstream] of value.workstreams.entries()) {
    const artifact = artifactById.get(workstream.sourceArtifactRef);
    const decisionOwner = principalById.get(workstream.decisionOwnerRef);
    const blocked = workstream.state === "blocked";
    const unresolvedDependency = workstream.dependencyRefs.some(
      (reference) => workstreamById.get(reference)?.state !== "completed",
    );
    const capacityMismatch = workstream.capacityDemands.some((demand) => {
      const capacity = capacityById.get(demand.capacityRef);
      return (
        capacity &&
        (Date.parse(capacity.periodStart) > Date.parse(capacity.periodEnd) ||
          Date.parse(workstream.periodStart) < Date.parse(capacity.periodStart) ||
          Date.parse(workstream.periodEnd) > Date.parse(capacity.periodEnd) ||
          (capacity.function !== workstream.domain &&
            capacity.function !== "finance" &&
            !(
              ["release", "change-control"].includes(workstream.domain) &&
              capacity.function === "engineering"
            )))
      );
    });
    const unresolvedCapacityConflict =
      workstream.capacityDemands.some((demand) =>
        overallocatedCapacities.has(demand.capacityRef),
      ) &&
      value.conflicts.some(
        (conflict) =>
          conflict.kind === "capacity" &&
          conflict.state === "open" &&
          conflict.workstreamRefs.includes(workstream.id),
      );
    const unresolvedConflict = value.conflicts.some(
      (conflict) =>
        conflict.state === "open" &&
        conflict.workstreamRefs.includes(workstream.id),
    );
    if (
      Date.parse(workstream.periodStart) > Date.parse(workstream.periodEnd) ||
      Date.parse(workstream.periodStart) < Date.parse(value.portfolio.periodStart) ||
      Date.parse(workstream.periodEnd) > Date.parse(value.portfolio.periodEnd) ||
      artifact?.clawId === undefined ||
      clawDomains[artifact.clawId] !== workstream.domain ||
      workstream.accountableOwnerRef !== artifact.accountableOwnerRef ||
      workstream.decisionOwnerRef !== artifact.decisionOwnerRef ||
      !decisionOwner?.decisionScopes.includes(domainDecisionScopes[workstream.domain]) ||
      capacityMismatch ||
      (["ready", "completed"].includes(workstream.state) &&
        (artifact.state !== "current" ||
          ["blocked", "unknown"].includes(artifact.statusSemantic) ||
          unresolvedDependency ||
          unresolvedCapacityConflict ||
          unresolvedConflict)) ||
      (workstream.state === "completed" &&
        (artifact.statusSemantic !== "completed" ||
          Date.parse(workstream.periodEnd) > asOf)) ||
      (blocked && workstream.blockedReasons.length === 0) ||
      (!blocked && workstream.blockedReasons.length > 0)
    ) {
      findings.push(
        finding(
          "unsafe_workstream",
          `workstreams.${index}`,
          "Workstreams must preserve source domain, owners, decision rights, dates, capacity, dependencies, status meaning, and blocked state.",
        ),
      );
    }
  }

  for (const capacity of value.capacityEnvelopes) {
    const allocated = value.workstreams
      .filter((item) => item.state !== "completed")
      .flatMap((item) => item.capacityDemands)
      .filter((item) => item.capacityRef === capacity.id)
      .reduce((sum, item) => sum + item.amount, 0);
    const hasOpenCapacityConflict = value.conflicts.some(
      (item) =>
        item.kind === "capacity" &&
        item.state === "open" &&
        item.workstreamRefs.some((reference) =>
          workstreamById
            .get(reference)
            ?.capacityDemands.some((demand) => demand.capacityRef === capacity.id),
        ),
    );
    if (allocated > capacity.amount && !hasOpenCapacityConflict) {
      findings.push(
        finding(
          "hidden_capacity_conflict",
          `capacityEnvelopes.${capacity.id}`,
          "Overallocated capacity requires an explicit open conflict and cannot be silently normalized.",
        ),
      );
    }
  }

  for (const [index, conflict] of value.conflicts.entries()) {
    if (
      (conflict.state === "open" && conflict.requiredDecisionRefs.length === 0) ||
      (conflict.state === "open" &&
        conflict.principalRefs.some(
          (principalRef) =>
            !conflict.requiredDecisionRefs.includes(principalRef),
        )) ||
      (conflict.state === "resolved-by-principals" &&
        conflict.requiredDecisionRefs.length > 0)
    ) {
      findings.push(
        finding(
          "incoherent_work_conflict",
          `conflicts.${index}`,
          "Open conflicts retain every required principal decision; resolved conflicts retain none.",
        ),
      );
    }
  }

  const requiredSharedExclusions = [
    "personnel-details",
    "compensation-details",
    "customer-details",
    "legal-details",
    "security-details",
    "financial-model-details",
    "roadmap-detail",
    "acquisition-detail",
    "credentials",
    "restricted-artifacts",
  ];
  for (const [index, view] of value.views.entries()) {
    const visibleArtifacts = view.sourceArtifactRefs.map((reference) =>
      artifactById.get(reference),
    );
    if (
      visibleArtifacts.some((artifact) =>
        view.audiencePrincipalRefs.some(
          (principalRef) => !artifact?.permittedPrincipalRefs.includes(principalRef),
        ),
      ) ||
      view.workstreamRefs.some((reference) => {
        const artifact = artifactById.get(
          workstreamById.get(reference)?.sourceArtifactRef,
        );
        return view.audiencePrincipalRefs.some(
          (principalRef) =>
            !artifact?.permittedPrincipalRefs.includes(principalRef) ||
            (artifact.confidentiality !== "portfolio-shared" &&
              !principalById
                .get(principalRef)
                ?.confidentialityScopes.includes(artifact.confidentiality)),
        );
      }) ||
      (view.kind === "leadership-shared" &&
        (visibleArtifacts.some(
          (artifact) => artifact?.confidentiality !== "portfolio-shared",
        ) ||
          requiredSharedExclusions.some(
            (field) => !view.excludedFields.includes(field),
          ))) ||
      (view.kind === "principal-private" &&
        view.audiencePrincipalRefs.length !== 1)
    ) {
      findings.push(
        finding(
          "work_portfolio_view_confidentiality_leak",
          `views.${index}`,
          "Leadership, forum, and private views must respect every source audience and suppress restricted organizational fields.",
        ),
      );
    }
  }
  for (const principalId of principalIds) {
    if (
      !value.views.some(
        (view) =>
          view.kind === "principal-private" &&
          view.audiencePrincipalRefs.length === 1 &&
          view.audiencePrincipalRefs[0] === principalId,
      )
    ) {
      findings.push(
        finding(
          "missing_principal_private_view",
          "views",
          `Principal ${JSON.stringify(principalId)} requires a distinct private view.`,
        ),
      );
    }
  }

  const commitment = value.commitment;
  const hasPlan = Boolean(commitment.plan);
  const approvals = commitment.approvals ?? [];
  const hasIntegration = Boolean(commitment.integration);
  const hasReceipt = Boolean(commitment.receipt);
  const actionDecisionScope = commitment.plan
    ? {
        "send-communication": "external-communication",
        "schedule-forum": "portfolio",
        "allocate-staff": "staffing",
        "approve-spend": "finance",
        "approve-hiring": "staffing",
        "change-forecast": "finance",
        "commit-roadmap": "product",
        "commit-customer": "sales",
        "publish-plan": "publication",
        merge: "release",
        release: "release",
        "execute-change": "change-control",
      }[commitment.plan.actionType]
    : undefined;
  if (
    (["awaiting-approval", "approved", "completed"].includes(commitment.state) &&
      !hasPlan) ||
    (commitment.state === "completed" && (!hasIntegration || !hasReceipt)) ||
    (commitment.state !== "completed" && (hasIntegration || hasReceipt)) ||
    (commitment.state === "not-requested" &&
      (hasPlan || approvals.length > 0)) ||
    (commitment.state === "blocked" && !commitment.blockedReason)
  ) {
    findings.push(
      finding(
        "incoherent_work_commitment",
        "commitment",
        "Commitment plan, approvals, integration, receipt, and blocked reason must match the declared state.",
      ),
    );
  }
  const planDigest = commitment.plan
    ? `sha256:${createHash("sha256").update(canonicalJson(commitment.plan)).digest("hex")}`
    : undefined;
  if (commitment.plan) {
    findings.push(
      ...referenceFindings(
        [commitment.plan.workstreamRef],
        workstreams,
        "commitment.plan.workstreamRef",
        "Workstream reference",
      ),
      ...referenceFindings(
        commitment.plan.affectedPrincipalRefs,
        principals,
        "commitment.plan.affectedPrincipalRefs",
        "Principal reference",
      ),
      ...referenceFindings(
        [commitment.plan.approvalPolicyRef],
        policies,
        "commitment.plan.approvalPolicyRef",
        "Policy reference",
      ),
    );
    const policy = policyById.get(commitment.plan.approvalPolicyRef);
    const workstream = workstreamById.get(commitment.plan.workstreamRef);
    const artifact = artifactById.get(workstream?.sourceArtifactRef);
    const requiredByAuthority = new Set([workstream?.decisionOwnerRef]);
    const actionAuthorizedPrincipals =
      commitment.plan.affectedPrincipalRefs.filter((principalRef) => {
        const principal = principalById.get(principalRef);
        return (
          principal?.decisionScopes.includes(actionDecisionScope) ||
          principal?.decisionScopes.includes("portfolio")
        );
      });
    for (const principalRef of commitment.plan.affectedPrincipalRefs) {
      const principal = principalById.get(principalRef);
      if (
        principal?.decisionScopes.includes(actionDecisionScope) ||
        principal?.decisionScopes.includes("portfolio")
      ) {
        requiredByAuthority.add(principalRef);
      }
    }
    const approvedPrincipals = approvals.map((approval) => approval.principalRef);
    const approvalComplete =
      policy &&
      policy.requiredPrincipalRefs.every((principalRef) =>
        approvedPrincipals.includes(principalRef),
      );
    if (
      !policy ||
      !policy.actionTypes.includes(commitment.plan.actionType) ||
      actionAuthorizedPrincipals.length === 0 ||
      [...requiredByAuthority].some(
        (principalRef) =>
          principalRef && !policy.requiredPrincipalRefs.includes(principalRef),
      ) ||
      approvals.some(
        (approval) =>
          approval.planDigest !== planDigest ||
          !policy.requiredPrincipalRefs.includes(approval.principalRef) ||
          Date.parse(approval.approvedAt) > asOf,
      ) ||
      (["approved", "completed"].includes(commitment.state) &&
        (!approvalComplete ||
          !workstream ||
          workstream.state === "blocked" ||
          artifact?.state !== "current" ||
          value.conflicts.some(
            (conflict) =>
              conflict.state === "open" &&
              conflict.workstreamRefs.includes(workstream.id),
          ))) ||
      (commitment.state === "awaiting-approval" && approvalComplete)
    ) {
      findings.push(
        finding(
          "work_commitment_approval_mismatch",
          "commitment",
          "Every policy-required principal must separately approve the exact commitment plan.",
        ),
      );
    }
  }
  if (
    commitment.state === "completed" &&
    commitment.plan &&
    commitment.integration &&
    commitment.receipt
  ) {
    const integrationEvidence = evidenceById.get(
      commitment.integration.approvalEvidenceRef,
    );
    const receiptEvidence = evidenceById.get(commitment.receipt.evidenceRef);
    const configuredBy = principalById.get(commitment.integration.configuredByRef);
    if (
      commitment.receipt.planDigest !== planDigest ||
      commitment.receipt.integrationId !== commitment.integration.id ||
      commitment.receipt.systemRef !== commitment.plan.systemRef ||
      commitment.integration.systemRef !== commitment.plan.systemRef ||
      !configuredBy ||
      commitment.integration.configuredByRef === "work-chief-of-staff" ||
      (!configuredBy.decisionScopes.includes(actionDecisionScope) &&
        !configuredBy.decisionScopes.includes("portfolio")) ||
      !commitment.receipt.confirmationRef.startsWith(
        `system://${commitment.plan.systemRef}/`,
      ) ||
      integrationEvidence?.type !== "integration-approval" ||
      integrationEvidence.authority !== "approved-integration" ||
      integrationEvidence.reference !== commitment.integration.approvalRef ||
      receiptEvidence?.type !== "system-receipt" ||
      receiptEvidence.authority !== "controlled-system" ||
      receiptEvidence.reference !== commitment.receipt.confirmationRef ||
      receiptEvidence.capturedAt !== commitment.receipt.completedAt ||
      Date.parse(commitment.receipt.completedAt) <
        Date.parse(commitment.plan.effectiveAt) ||
      Date.parse(integrationEvidence.capturedAt) >
        Date.parse(commitment.receipt.completedAt) ||
      approvals.some(
        (approval) =>
          Date.parse(approval.approvedAt) >
          Date.parse(commitment.receipt.completedAt),
      )
    ) {
      findings.push(
        finding(
          "work_commitment_receipt_mismatch",
          "commitment.receipt",
          "Approved integration and controlled-system receipt evidence must bind the exact multi-principal commitment.",
        ),
      );
    }
  }

  const openConflicts = value.conflicts.some((item) => item.state === "open");
  if (
    (openConflicts && value.handoff.state !== "blocked") ||
    !value.handoff.accountablePrincipalRefs.some(
      (principalRef) =>
        principalById.get(principalRef)?.decisionScopes.includes("portfolio"),
    )
  ) {
    findings.push(
      finding(
        "agent_owned_work_authority",
        "handoff",
        "Open conflicts block handoff, and portfolio authority remains with explicitly scoped human principals.",
      ),
    );
  }
  return findings;
}

function homeRepairFindings(value) {
  const evidenceIds = value.evidence.map((item) => item.id);
  const evidence = new Set(evidenceIds);
  const observationIds = value.observations.map((item) => item.id);
  const observations = new Set(observationIds);
  const hypothesisIds = value.repairPlan.hypotheses.map((item) => item.id);
  const hypotheses = new Set(hypothesisIds);
  const providerIds = value.providers.map((item) => item.id);
  const providers = new Set(providerIds);
  const findings = [
    ...uniqueFindings(evidenceIds, "evidence", "Evidence id"),
    ...uniqueFindings(observationIds, "observations", "Observation id"),
    ...uniqueFindings(
      hypothesisIds,
      "repairPlan.hypotheses",
      "Hypothesis id",
    ),
    ...uniqueFindings(
      value.repairPlan.steps.map((item) => item.id),
      "repairPlan.steps",
      "Repair step id",
    ),
    ...uniqueFindings(providerIds, "providers", "Provider id"),
  ];
  const evidenceReferences = [
    ...value.observations.map((item) => [item.evidenceRefs, "observations"]),
    [value.hazardAssessment.evidenceRefs, "hazardAssessment.evidenceRefs"],
    ...value.isolations.map((item) => [item.evidenceRefs, "isolations"]),
    ...value.repairPlan.hypotheses.map((item) => [
      item.evidenceRefs,
      "repairPlan.hypotheses",
    ]),
    ...value.repairPlan.steps.map((item) => [item.evidenceRefs, "repairPlan.steps"]),
    [value.verification.evidenceRefs, "verification.evidenceRefs"],
    ...value.providers.map((item) => [[item.sourceRef], "providers"]),
    ...(value.appointment.bookingIntegration
      ? [[[value.appointment.bookingIntegration.approvalEvidenceRef], "appointment.bookingIntegration"]]
      : []),
    ...(value.appointment.receipt
      ? [[[value.appointment.receipt.evidenceRef], "appointment.receipt"]]
      : []),
  ];
  for (const [references, path] of evidenceReferences) {
    findings.push(...uniqueFindings(references, path, "Evidence reference"));
    findings.push(...referenceFindings(references, evidence, path, "Evidence reference"));
  }
  if (/\b\d{1,6}[A-Za-z]?(?:-\d{1,6}[A-Za-z]?)?\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:Alley|Aly|Avenue|Ave|Boulevard|Blvd|Circle|Cir|Court|Ct|Crescent|Cres|Drive|Dr|Expressway|Expy|Freeway|Fwy|Highway|Hwy|Lane|Ln|Parkway|Pkwy|Place|Pl|Plaza|Plz|Road|Rd|Route|Rte|Square|Sq|Street|St|Terrace|Ter|Trail|Trl|Way)\b/iu.test(canonicalJson(value))) {
    findings.push(
      finding(
        "exposed_home_address",
        "home",
        "Durable home-repair artifacts must use room and system labels, not a street address.",
      ),
    );
  }
  const highHazards = new Set([
    "gas",
    "mains-electricity",
    "structural",
    "fire",
    "asbestos",
    "lead",
    "mold",
    "refrigerant",
    "roof",
    "height",
    "confined-space",
    "uncontrolled-water",
  ]);
  const hasHighHazard = value.hazardAssessment.hazards.some((item) =>
    highHazards.has(item),
  );
  if (
    (value.hazardAssessment.hazards.includes("none") &&
      value.hazardAssessment.hazards.length !== 1) ||
    (value.repairPlan.eligibility === "owner-repair" &&
      (value.hazardAssessment.level !== "low-risk" ||
        value.hazardAssessment.action !== "bounded-owner-check" ||
        canonicalJson(value.hazardAssessment.hazards) !== canonicalJson(["none"]))) ||
    (hasHighHazard &&
      (value.hazardAssessment.action === "bounded-owner-check" ||
        value.repairPlan.eligibility === "owner-repair" ||
        value.repairPlan.steps.length > 0))
  ) {
    findings.push(
      finding(
        "unsafe_repair_eligibility",
        "hazardAssessment",
        "High-hazard or contradictory hazard state cannot permit owner repair.",
      ),
    );
  }
  for (const [index, provider] of value.providers.entries()) {
    const providerEvidence = value.evidence.find(
      (item) => item.id === provider.sourceRef,
    );
    if (
      providerEvidence &&
      (providerEvidence.type !== "provider-info" ||
        !["service-provider", "qualified-specialist"].includes(
          providerEvidence.authority,
        ))
    ) {
      findings.push(
        finding(
          "unsupported_provider_evidence",
          `providers.${index}.sourceRef`,
          "Every provider must cite provider-information evidence from the provider or a qualified specialist.",
        ),
      );
    }
  }
  if (
    (value.repairPlan.eligibility === "owner-repair" &&
      (value.repairPlan.hypotheses.length === 0 || value.repairPlan.steps.length === 0)) ||
    (value.repairPlan.eligibility !== "owner-repair" && value.repairPlan.steps.length > 0)
  ) {
    findings.push(
      finding(
        "incoherent_owner_repair_plan",
        "repairPlan",
        "Owner repair requires an evidence-linked hypothesis and step; specialist-only or blocked plans cannot contain resident repair instructions.",
      ),
    );
  }
  if (
    value.repairPlan.eligibility === "owner-repair" &&
    !["verified-owner", "verified-tenant-permission"].includes(value.home.workAuthority)
  ) {
    findings.push(
      finding(
        "missing_work_authority",
        "home.workAuthority",
        "Owner repair requires verified authority for the bounded work.",
      ),
    );
  }
  if (
    value.repairPlan.eligibility === "owner-repair" &&
    value.isolations.some((item) => ["unknown", "specialist-only"].includes(item.state))
  ) {
    findings.push(
      finding(
        "unconfirmed_isolation",
        "isolations",
        "Owner repair requires every declared isolation to be confirmed or not required.",
      ),
    );
  }
  if (
    value.isolations.some(
      (item) => item.state === "confirmed" && item.evidenceRefs.length === 0,
    )
  ) {
    findings.push(
      finding(
        "unsupported_isolation",
        "isolations",
        "Every confirmed household isolation requires supporting evidence.",
      ),
    );
  }
  for (const [index, hypothesis] of value.repairPlan.hypotheses.entries()) {
    if (
      hypothesis.status === "specialist-confirmed" &&
      !hypothesis.evidenceRefs.some((reference) => {
        const item = value.evidence.find((candidate) => candidate.id === reference);
        return (
          item?.type === "specialist-finding" &&
          item.authority === "qualified-specialist"
        );
      })
    ) {
      findings.push(
        finding(
          "unsupported_diagnosis",
          `repairPlan.hypotheses.${index}`,
          "Only qualified-specialist evidence may confirm a household defect.",
        ),
      );
    }
  }
  for (const [index, step] of value.repairPlan.steps.entries()) {
    findings.push(
      ...referenceFindings(
        step.observationRefs,
        observations,
        `repairPlan.steps.${index}.observationRefs`,
        "Observation reference",
      ),
      ...referenceFindings(
        step.hypothesisRefs,
        hypotheses,
        `repairPlan.steps.${index}.hypothesisRefs`,
        "Hypothesis reference",
      ),
    );
    if (
      step.class === "manual-approved" &&
      !step.evidenceRefs.some((reference) => {
        const item = value.evidence.find((candidate) => candidate.id === reference);
        return item?.type === "manual" && item.authority === "manufacturer";
      })
    ) {
      findings.push(
        finding(
          "unsupported_repair_step",
          `repairPlan.steps.${index}.evidenceRefs`,
          "A manual-approved repair step must cite manufacturer manual evidence.",
        ),
      );
    }
  }
  if (
    value.verification.state === "passed" &&
    (value.verification.evidenceRefs.length === 0 ||
      value.verification.unresolvedConditions.length > 0 ||
      !value.verification.evidenceRefs.some((reference) => {
        const item = value.evidence.find((candidate) => candidate.id === reference);
        return ["photo", "recording", "measurement"].includes(item?.type);
      }))
  ) {
    findings.push(
      finding(
        "unsupported_verification",
        "verification",
        "Passed verification requires evidence and no unresolved conditions.",
      ),
    );
  }
  const appointment = value.appointment;
  const hasPlan = Boolean(appointment.plan);
  const hasApproval = Boolean(appointment.approval);
  const hasIntegration = Boolean(appointment.bookingIntegration);
  const hasReceipt = Boolean(appointment.receipt);
  if (
    (["options-ready", "awaiting-approval", "approved", "booked"].includes(
      appointment.state,
    ) &&
      !hasPlan) ||
    (["approved", "booked"].includes(appointment.state) && !hasApproval) ||
    (appointment.state === "booked" && (!hasIntegration || !hasReceipt)) ||
    (appointment.state !== "booked" && (hasIntegration || hasReceipt)) ||
    (!["approved", "booked"].includes(appointment.state) && hasApproval) ||
    (appointment.state === "not-requested" && hasPlan) ||
    (appointment.state === "blocked" && !appointment.blockedReason)
  ) {
    findings.push(
      finding(
        "incoherent_appointment_state",
        "appointment",
        "Appointment plan, approval, integration, receipt, and blocked reason must match the declared state.",
      ),
    );
  }
  if (appointment.plan) {
    findings.push(
      ...referenceFindings(
        [appointment.plan.providerRef],
        providers,
        "appointment.plan.providerRef",
        "Provider reference",
      ),
    );
    const provider = value.providers.find(
      (item) => item.id === appointment.plan.providerRef,
    );
    if (
      provider &&
      (provider.trade !== appointment.plan.trade ||
        provider.qualificationState !== "owner-verified")
    ) {
      findings.push(
        finding(
          "unsupported_provider",
          "appointment.plan",
          "The appointment trade must match an owner-verified provider.",
        ),
      );
    }
    if (appointment.plan.maxDeposit > appointment.plan.maxCost) {
      findings.push(
        finding(
          "deposit_exceeds_cost",
          "appointment.plan.maxDeposit",
          "The approved deposit ceiling cannot exceed the total cost ceiling.",
        ),
      );
    }
  }
  const planDigest = appointment.plan
    ? `sha256:${createHash("sha256").update(canonicalJson(appointment.plan)).digest("hex")}`
    : undefined;
  if (["approved", "booked"].includes(appointment.state) && appointment.approval) {
    if (
      appointment.approval.planDigest !== planDigest ||
      canonicalJson(appointment.approval.resident) !== canonicalJson(value.resident)
    ) {
      findings.push(
        finding(
          "appointment_approval_mismatch",
          "appointment.approval",
          "Appointment approval must bind the exact plan and accountable resident.",
        ),
      );
    }
  }
  if (
    appointment.state === "booked" &&
    appointment.plan &&
    appointment.approval &&
    appointment.bookingIntegration &&
    appointment.receipt
  ) {
    const integrationEvidence = value.evidence.find(
      (item) => item.id === appointment.bookingIntegration.approvalEvidenceRef,
    );
    const receiptEvidence = value.evidence.find(
      (item) => item.id === appointment.receipt.evidenceRef,
    );
    if (
      appointment.receipt.planDigest !== planDigest ||
      appointment.receipt.integrationId !== appointment.bookingIntegration.id ||
      appointment.receipt.providerRef !== appointment.plan.providerRef ||
      appointment.bookingIntegration.providerRef !== appointment.plan.providerRef ||
      !appointment.receipt.confirmationRef.startsWith(
        `provider://${appointment.plan.providerRef}/`,
      ) ||
      integrationEvidence?.type !== "integration-approval" ||
      integrationEvidence.authority !== "resident-supplied" ||
      integrationEvidence.reference !== appointment.bookingIntegration.approvalRef ||
      receiptEvidence?.type !== "provider-receipt" ||
      receiptEvidence.authority !== "service-provider" ||
      receiptEvidence.reference !== appointment.receipt.confirmationRef ||
      receiptEvidence.capturedAt !== appointment.receipt.bookedAt ||
      canonicalJson(appointment.bookingIntegration.configuredBy) !==
        canonicalJson(value.resident)
    ) {
      findings.push(
        finding(
          "booking_receipt_mismatch",
          "appointment.receipt",
          "The owner-approved integration and provider receipt must bind the exact appointment plan.",
        ),
      );
    }
    if (Date.parse(appointment.receipt.bookedAt) < Date.parse(appointment.approval.approvedAt)) {
      findings.push(
        finding(
          "booking_predates_approval",
          "appointment.receipt.bookedAt",
          "A specialist booking cannot predate the resident's exact plan approval.",
        ),
      );
    }
  }
  if (
    canonicalJson(value.handoff.resident) !== canonicalJson(value.resident) ||
    value.resident.id === "home-repair-coordinator"
  ) {
    findings.push(
      finding(
        "agent_owned_authority",
        "handoff.resident",
        "Repair, trade, payment, and appointment authority must remain resident-controlled.",
      ),
    );
  }
  return findings;
}

function applianceCareFindings(value) {
  const evidenceIds = value.evidence.map((item) => item.id);
  const evidence = new Set(evidenceIds);
  const applianceIds = value.appliances.map((item) => item.id);
  const appliances = new Set(applianceIds);
  const providerIds = value.providers.map((item) => item.id);
  const providers = new Set(providerIds);
  const findings = [
    ...uniqueFindings(evidenceIds, "evidence", "Evidence id"),
    ...uniqueFindings(applianceIds, "appliances", "Appliance id"),
    ...uniqueFindings(value.maintenance.map((item) => item.id), "maintenance", "Maintenance id"),
    ...uniqueFindings(providerIds, "providers", "Provider id"),
    ...uniqueFindings(value.coverage.map((item) => item.applianceRef), "coverage", "Coverage appliance"),
    ...uniqueFindings(value.recalls.map((item) => item.applianceRef), "recalls", "Recall appliance"),
    ...uniqueFindings(value.incidents.map((item) => item.applianceRef), "incidents", "Incident appliance"),
    ...uniqueFindings(
      value.lifecycleDecisions.map((item) => item.applianceRef),
      "lifecycleDecisions",
      "Lifecycle appliance",
    ),
  ];
  const evidenceReferences = [
    ...value.appliances.map((item) => [item.modelEvidenceRefs, "appliances.modelEvidenceRefs"]),
    ...value.appliances.map((item) => [item.serialEvidenceRefs, "appliances.serialEvidenceRefs"]),
    ...value.maintenance.map((item) => [item.sourceRefs, "maintenance.sourceRefs"]),
    ...value.maintenance.map((item) => [
      item.completionEvidenceRefs,
      "maintenance.completionEvidenceRefs",
    ]),
    ...value.coverage.map((item) => [item.evidenceRefs, "coverage.evidenceRefs"]),
    ...value.recalls.map((item) => [item.evidenceRefs, "recalls.evidenceRefs"]),
    ...value.incidents.map((item) => [item.evidenceRefs, "incidents.evidenceRefs"]),
    ...value.lifecycleDecisions.map((item) => [
      item.evidenceRefs,
      "lifecycleDecisions.evidenceRefs",
    ]),
    ...value.providers.map((item) => [[item.sourceRef], "providers.sourceRef"]),
    ...(value.action.integration
      ? [[[value.action.integration.approvalEvidenceRef], "action.integration"]]
      : []),
    ...(value.action.receipt
      ? [[[value.action.receipt.evidenceRef], "action.receipt"]]
      : []),
  ];
  for (const [references, path] of evidenceReferences) {
    findings.push(...uniqueFindings(references, path, "Evidence reference"));
    findings.push(...referenceFindings(references, evidence, path, "Evidence reference"));
  }
  for (const [path, references] of [
    ["maintenance", value.maintenance.map((item) => item.applianceRef)],
    ["coverage", value.coverage.map((item) => item.applianceRef)],
    ["recalls", value.recalls.map((item) => item.applianceRef)],
    ["incidents", value.incidents.map((item) => item.applianceRef)],
    ["lifecycleDecisions", value.lifecycleDecisions.map((item) => item.applianceRef)],
  ]) {
    findings.push(...referenceFindings(references, appliances, path, "Appliance reference"));
  }
  if (
    /\b\d{1,6}[A-Za-z]?(?:-\d{1,6}[A-Za-z]?)?\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:Alley|Aly|Avenue|Ave|Boulevard|Blvd|Circle|Cir|Court|Ct|Crescent|Cres|Drive|Dr|Highway|Hwy|Lane|Ln|Parkway|Pkwy|Place|Pl|Road|Rd|Route|Rte|Street|St|Terrace|Ter|Trail|Trl|Way)\b/iu.test(
      canonicalJson(value),
    )
  ) {
    findings.push(
      finding(
        "exposed_home_address",
        "portfolio",
        "Appliance-care artifacts must use privacy-safe appliance and room labels, not a street address.",
      ),
    );
  }
  const asOf = Date.parse(value.portfolio.asOf);
  const evidenceById = new Map(value.evidence.map((item) => [item.id, item]));
  for (const [index, appliance] of value.appliances.entries()) {
    const modelEvidence = appliance.modelEvidenceRefs
      .map((reference) => evidenceById.get(reference))
      .filter(Boolean);
    const serialEvidence = appliance.serialEvidenceRefs
      .map((reference) => evidenceById.get(reference))
      .filter(Boolean);
    if (
      !modelEvidence.some(
        (item) =>
          ["label-photo", "purchase-record", "manual"].includes(item.type) &&
          ["owner-supplied", "manufacturer"].includes(item.authority),
      ) ||
      (appliance.serialScope === "verified" &&
        !serialEvidence.some(
          (item) =>
            ["label-photo", "purchase-record"].includes(item.type) &&
            item.authority === "owner-supplied",
        )) ||
      (appliance.serialScope === "masked" && serialEvidence.length === 0) ||
      (appliance.serialScope === "unverified" && serialEvidence.length > 0)
    ) {
      findings.push(
        finding(
          "unsupported_appliance_identity",
          `appliances.${index}`,
          "Model and serial identity states must be backed by direct label, purchase, or manufacturer evidence.",
        ),
      );
    }
  }
  const unsafeCarePattern =
    /\b(?:diagnose|repair|disassemble|rewire|bypass|defeat|open\s+(?:the\s+)?panel|handle\s+refrigerant|disconnect\s+(?:the\s+)?gas\s+line)\b/iu;
  for (const [index, item] of value.maintenance.entries()) {
    const sources = item.sourceRefs
      .map((reference) => evidenceById.get(reference))
      .filter(Boolean);
    const completionEvidence = item.completionEvidenceRefs
      .map((reference) => evidenceById.get(reference))
      .filter(Boolean);
    const manufacturerSupported = sources.some(
      (source) =>
        (["manual", "manufacturer-maintenance"].includes(source.type) &&
          source.authority === "manufacturer") ||
        (source.type === "recall-result" &&
          ["manufacturer", "government"].includes(source.authority)),
    );
    const completed = item.state === "completed";
    if (
      !manufacturerSupported ||
      unsafeCarePattern.test(item.task) ||
      (completed &&
        (!item.completedAt ||
          completionEvidence.length === 0 ||
          completionEvidence.every(
            (source) =>
              !["owner-report", "label-photo", "service-record"].includes(source.type) ||
              Date.parse(source.capturedAt) < Date.parse(item.completedAt),
          ))) ||
      (!completed && (item.completedAt || item.completionEvidenceRefs.length > 0)) ||
      (item.state === "blocked" && !item.blockedReason) ||
      (item.state !== "blocked" && item.blockedReason) ||
      (item.state === "upcoming" && Date.parse(item.dueAt) <= asOf) ||
      (item.state === "overdue" && Date.parse(item.dueAt) >= asOf)
    ) {
      findings.push(
        finding(
          "unsupported_maintenance",
          `maintenance.${index}`,
          "Maintenance must be model-bound manufacturer care with coherent timing, completion evidence, and no repair instructions.",
        ),
      );
    }
  }
  const requiredApplianceSet = canonicalJson([...appliances].sort());
  for (const [path, values] of [
    ["coverage", value.coverage.map((item) => item.applianceRef)],
    ["recalls", value.recalls.map((item) => item.applianceRef)],
    ["incidents", value.incidents.map((item) => item.applianceRef)],
    ["lifecycleDecisions", value.lifecycleDecisions.map((item) => item.applianceRef)],
  ]) {
    if (canonicalJson([...new Set(values)].sort()) !== requiredApplianceSet) {
      findings.push(
        finding(
          "incomplete_appliance_portfolio",
          path,
          "Coverage, recall, incident, and lifecycle state must cover every appliance exactly once.",
        ),
      );
    }
  }
  for (const [index, item] of value.coverage.entries()) {
    const sources = item.evidenceRefs
      .map((reference) => evidenceById.get(reference))
      .filter(Boolean);
    const hasWarranty = sources.some(
      (source) =>
        source.type === "warranty-terms" && source.authority === "manufacturer",
    );
    const hasRegistration = sources.some(
      (source) =>
        source.type === "registration-receipt" && source.authority === "manufacturer",
    );
    const hasPurchase = sources.some(
      (source) =>
        source.type === "purchase-record" && source.authority === "owner-supplied",
    );
    if (
      (item.registrationState === "registered" && !hasRegistration) ||
      (["active", "expired"].includes(item.warrantyState) && !hasWarranty) ||
      (item.warrantyState === "active" && (!hasPurchase || !item.expiresAt)) ||
      (item.expiresAt && Date.parse(item.expiresAt) <= Date.parse(item.assessedAt) &&
        item.warrantyState === "active") ||
      Date.parse(item.assessedAt) > asOf
    ) {
      findings.push(
        finding(
          "unsupported_coverage_state",
          `coverage.${index}`,
          "Registration and warranty conclusions require authoritative receipt, terms, purchase, and coherent date evidence.",
        ),
      );
    }
  }
  for (const [index, item] of value.recalls.entries()) {
    const appliance = value.appliances.find(
      (candidate) => candidate.id === item.applianceRef,
    );
    const sources = item.evidenceRefs
      .map((reference) => evidenceById.get(reference))
      .filter(Boolean);
    const authoritativeResult = sources.some(
      (source) =>
        source.type === "recall-result" &&
        ["manufacturer", "government"].includes(source.authority) &&
        source.capturedAt === item.checkedAt,
    );
    const serialMatch = ["serial", "model-and-serial"].includes(item.matchScope);
    if (
      !authoritativeResult ||
      (serialMatch && appliance?.serialScope !== "verified") ||
      (item.state === "matched" &&
        (item.matchScope === "unverified" || item.remedyState === "not-applicable")) ||
      (item.state === "no-match" && item.remedyState !== "not-applicable") ||
      (item.state === "unknown" &&
        (item.matchScope !== "unverified" || item.remedyState !== "unknown")) ||
      Date.parse(item.checkedAt) > asOf
    ) {
      findings.push(
        finding(
          "unsupported_recall_state",
          `recalls.${index}`,
          "Recall state requires a current authoritative result and exact identity evidence for any serial match.",
        ),
      );
    }
  }
  const incidentHandoffs = {
    none: ["none"],
    "active-fault": ["home-repair"],
    "active-hazard": ["emergency-services"],
    "recall-stop-use": ["manufacturer-recall"],
    uncertain: ["blocked", "home-repair"],
  };
  for (const [index, item] of value.incidents.entries()) {
    if (!incidentHandoffs[item.state].includes(item.handoff)) {
      findings.push(
        finding(
          "unsafe_incident_handoff",
          `incidents.${index}`,
          "Active faults, hazards, and stop-use recalls must route to the correct owner system without repair instructions.",
        ),
      );
    }
  }
  for (const [index, item] of value.lifecycleDecisions.entries()) {
    const sources = item.evidenceRefs
      .map((reference) => evidenceById.get(reference))
      .filter(Boolean);
    const relevant = sources.some((source) =>
      [
        "purchase-record",
        "manufacturer-maintenance",
        "warranty-terms",
        "recall-result",
        "service-record",
        "energy-label",
      ].includes(source.type),
    );
    const replacementEvidence =
      item.state !== "replacement-research" ||
      (sources.some((source) => source.type === "energy-label") &&
        sources.some((source) =>
          ["service-record", "warranty-terms", "purchase-record"].includes(source.type),
        ));
    if (
      !relevant ||
      !replacementEvidence ||
      (item.state === "blocked" && item.uncertainties.length === 0)
    ) {
      findings.push(
        finding(
          "unsupported_lifecycle_decision",
          `lifecycleDecisions.${index}`,
          "Lifecycle decisions require relevant ownership evidence; replacement research also requires energy and history or coverage evidence.",
        ),
      );
    }
  }
  for (const [index, provider] of value.providers.entries()) {
    const source = evidenceById.get(provider.sourceRef);
    if (
      source?.type !== "provider-info" ||
      !["manufacturer", "service-provider"].includes(source.authority)
    ) {
      findings.push(
        finding(
          "unsupported_provider",
          `providers.${index}.sourceRef`,
          "Manufacturer and authorized-servicer options require provider-controlled evidence.",
        ),
      );
    }
  }
  const action = value.action;
  const hasPlan = Boolean(action.plan);
  const hasApproval = Boolean(action.approval);
  const hasIntegration = Boolean(action.integration);
  const hasReceipt = Boolean(action.receipt);
  if (
    (["options-ready", "awaiting-approval", "approved", "completed"].includes(
      action.state,
    ) &&
      !hasPlan) ||
    (["approved", "completed"].includes(action.state) && !hasApproval) ||
    (action.state === "completed" && (!hasIntegration || !hasReceipt)) ||
    (action.state !== "completed" && (hasIntegration || hasReceipt)) ||
    (!["approved", "completed"].includes(action.state) && hasApproval) ||
    (action.state === "not-requested" && hasPlan) ||
    (action.state === "blocked" && !action.blockedReason)
  ) {
    findings.push(
      finding(
        "incoherent_action_state",
        "action",
        "Action plan, approval, integration, receipt, and blocked reason must match the declared state.",
      ),
    );
  }
  if (action.plan) {
    findings.push(
      ...referenceFindings(
        [action.plan.applianceRef],
        appliances,
        "action.plan.applianceRef",
        "Appliance reference",
      ),
      ...referenceFindings(
        [action.plan.providerRef],
        providers,
        "action.plan.providerRef",
        "Provider reference",
      ),
    );
    const provider = value.providers.find(
      (item) => item.id === action.plan.providerRef,
    );
    const recall = value.recalls.find(
      (item) => item.applianceRef === action.plan.applianceRef,
    );
    const coverage = value.coverage.find(
      (item) => item.applianceRef === action.plan.applianceRef,
    );
    if (
      !provider ||
      provider.qualificationState === "unverified" ||
      action.plan.maxDeposit > action.plan.maxCost ||
      (action.plan.actionType === "recall-remedy" && recall?.state !== "matched") ||
      (action.plan.actionType === "warranty-claim" &&
        coverage?.warrantyState !== "active")
    ) {
      findings.push(
        finding(
          "unsupported_external_action",
          "action.plan",
          "External actions require an eligible appliance state, verified provider, and bounded cost.",
        ),
      );
    }
  }
  const planDigest = action.plan
    ? `sha256:${createHash("sha256").update(canonicalJson(action.plan)).digest("hex")}`
    : undefined;
  if (["approved", "completed"].includes(action.state) && action.approval) {
    if (
      action.approval.planDigest !== planDigest ||
      canonicalJson(action.approval.owner) !== canonicalJson(value.owner)
    ) {
      findings.push(
        finding(
          "action_approval_mismatch",
          "action.approval",
          "Owner approval must bind the exact external action plan.",
        ),
      );
    }
  }
  if (
    action.state === "completed" &&
    action.plan &&
    action.approval &&
    action.integration &&
    action.receipt
  ) {
    const integrationEvidence = evidenceById.get(
      action.integration.approvalEvidenceRef,
    );
    const receiptEvidence = evidenceById.get(action.receipt.evidenceRef);
    if (
      action.receipt.planDigest !== planDigest ||
      action.receipt.integrationId !== action.integration.id ||
      action.receipt.providerRef !== action.plan.providerRef ||
      action.integration.providerRef !== action.plan.providerRef ||
      !action.receipt.confirmationRef.startsWith(
        `provider://${action.plan.providerRef}/`,
      ) ||
      integrationEvidence?.type !== "integration-approval" ||
      integrationEvidence.authority !== "owner-supplied" ||
      integrationEvidence.reference !== action.integration.approvalRef ||
      receiptEvidence?.type !== "action-receipt" ||
      !["manufacturer", "service-provider"].includes(receiptEvidence.authority) ||
      receiptEvidence.reference !== action.receipt.confirmationRef ||
      receiptEvidence.capturedAt !== action.receipt.completedAt ||
      canonicalJson(action.integration.configuredBy) !== canonicalJson(value.owner)
    ) {
      findings.push(
        finding(
          "action_receipt_mismatch",
          "action.receipt",
          "The owner-approved integration and provider receipt must bind the exact action plan.",
        ),
      );
    }
    if (
      Date.parse(action.receipt.completedAt) <
      Date.parse(action.approval.approvedAt)
    ) {
      findings.push(
        finding(
          "action_predates_approval",
          "action.receipt.completedAt",
          "An external action cannot predate the owner's exact approval.",
        ),
      );
    }
  }
  if (
    canonicalJson(value.handoff.owner) !== canonicalJson(value.owner) ||
    value.owner.id === "appliance-care-coordinator"
  ) {
    findings.push(
      finding(
        "agent_owned_authority",
        "handoff.owner",
        "Registration, claim, service, terms, payment, and lifecycle authority must remain owner-controlled.",
      ),
    );
  }
  return findings;
}

function greenThumbFindings(value) {
  const evidenceIds = value.evidence.map((item) => item.id);
  const evidence = new Set(evidenceIds);
  const observationIds = value.observations.map((item) => item.id);
  const observations = new Set(observationIds);
  const hypothesisIds = value.hypotheses.map((item) => item.id);
  const hypotheses = new Set(hypothesisIds);
  const monitoringIds = value.monitoring.map((item) => item.id);
  const monitoring = new Set(monitoringIds);
  const providerIds = value.providers.map((item) => item.id);
  const providers = new Set(providerIds);
  const findings = [
    ...uniqueFindings(evidenceIds, "evidence", "Evidence id"),
    ...uniqueFindings(observationIds, "observations", "Observation id"),
    ...uniqueFindings(hypothesisIds, "hypotheses", "Hypothesis id"),
    ...uniqueFindings(value.calendar.map((item) => item.id), "calendar", "Calendar id"),
    ...uniqueFindings(value.carePlan.steps.map((item) => item.id), "carePlan.steps", "Care step id"),
    ...uniqueFindings(monitoringIds, "monitoring", "Monitoring id"),
    ...uniqueFindings(providerIds, "providers", "Provider id"),
  ];
  const evidenceReferences = [
    ...value.observations.map((item) => [item.evidenceRefs, "observations"]),
    [value.riskAssessment.evidenceRefs, "riskAssessment.evidenceRefs"],
    ...value.hypotheses.map((item) => [item.evidenceRefs, "hypotheses"]),
    ...value.calendar.map((item) => [item.siteEvidenceRefs, "calendar"]),
    ...value.carePlan.steps.map((item) => [item.evidenceRefs, "carePlan.steps"]),
    ...value.monitoring.map((item) => [item.evidenceRefs, "monitoring"]),
    ...value.providers.map((item) => [[item.sourceRef], "providers"]),
    ...(value.appointment.bookingIntegration
      ? [[[value.appointment.bookingIntegration.approvalEvidenceRef], "appointment.bookingIntegration"]]
      : []),
    ...(value.appointment.receipt
      ? [[[value.appointment.receipt.evidenceRef], "appointment.receipt"]]
      : []),
  ];
  for (const [references, path] of evidenceReferences) {
    findings.push(...uniqueFindings(references, path, "Evidence reference"));
    findings.push(...referenceFindings(references, evidence, path, "Evidence reference"));
  }
  if (/\b\d{1,6}[A-Za-z]?(?:-\d{1,6}[A-Za-z]?)?\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:Alley|Aly|Avenue|Ave|Boulevard|Blvd|Circle|Cir|Court|Ct|Crescent|Cres|Drive|Dr|Expressway|Expy|Freeway|Fwy|Highway|Hwy|Lane|Ln|Parkway|Pkwy|Place|Pl|Plaza|Plz|Road|Rd|Route|Rte|Square|Sq|Street|St|Terrace|Ter|Trail|Trl|Way)\b/iu.test(canonicalJson(value))) {
    findings.push(
      finding(
        "exposed_home_address",
        "site",
        "Durable garden artifacts must use garden labels, not a street address.",
      ),
    );
  }
  const highRisks = new Set([
    "poison-exposure",
    "toxic-species",
    "invasive-species",
    "regulated-pesticide",
    "off-label-treatment",
    "hazardous-tree",
    "excavation",
    "mains-electricity",
    "pressurized-irrigation",
    "protected-species",
  ]);
  const hasHighRisk = value.riskAssessment.risks.some((item) => highRisks.has(item));
  if (
    (value.riskAssessment.risks.includes("none") &&
      value.riskAssessment.risks.length !== 1) ||
    (value.riskAssessment.risks.includes("none") &&
      value.riskAssessment.level !== "low-risk") ||
    (value.riskAssessment.level === "low-risk" &&
      value.riskAssessment.action !== "bounded-resident-care") ||
    (value.riskAssessment.level === "emergency" &&
      !["poison-control", "emergency-services"].includes(value.riskAssessment.action)) ||
    (["high", "qualified-specialist", "uncertain"].includes(value.riskAssessment.level) &&
      value.riskAssessment.action !== "qualified-specialist") ||
    (value.riskAssessment.risks.includes("poison-exposure") &&
      !["poison-control", "emergency-services"].includes(value.riskAssessment.action)) ||
    (hasHighRisk &&
      !["high", "qualified-specialist", "emergency"].includes(
        value.riskAssessment.level,
      )) ||
    (value.carePlan.eligibility === "resident-care" &&
      (value.riskAssessment.level !== "low-risk" ||
        value.riskAssessment.action !== "bounded-resident-care" ||
        canonicalJson(value.riskAssessment.risks) !== canonicalJson(["none"]))) ||
    (hasHighRisk && value.carePlan.steps.length > 0)
  ) {
    findings.push(
      finding(
        "unsafe_care_eligibility",
        "riskAssessment",
        "High-risk, uncertain, or contradictory states cannot permit resident care.",
      ),
    );
  }
  if (
    (value.carePlan.eligibility === "resident-care" &&
      (value.hypotheses.length === 0 || value.carePlan.steps.length === 0)) ||
    (value.carePlan.eligibility !== "resident-care" && value.carePlan.steps.length > 0)
  ) {
    findings.push(
      finding(
        "incoherent_care_plan",
        "carePlan",
        "Resident care requires an evidence-linked hypothesis and step; specialist-only or blocked plans cannot contain resident instructions.",
      ),
    );
  }
  if (
    value.carePlan.eligibility === "resident-care" &&
    !["verified-owner", "verified-tenant-permission"].includes(value.site.workAuthority)
  ) {
    findings.push(
      finding(
        "missing_work_authority",
        "site.workAuthority",
        "Resident garden work requires verified authority.",
      ),
    );
  }
  for (const [index, hypothesis] of value.hypotheses.entries()) {
    findings.push(
      ...referenceFindings(
        hypothesis.observationRefs,
        observations,
        `hypotheses.${index}.observationRefs`,
        "Observation reference",
      ),
    );
    if (
      hypothesis.status === "specialist-confirmed" &&
      !hypothesis.evidenceRefs.some((reference) => {
        const item = value.evidence.find((candidate) => candidate.id === reference);
        return item?.type === "specialist-finding" && item.authority === "qualified-specialist";
      })
    ) {
      findings.push(
        finding(
          "unsupported_diagnosis",
          `hypotheses.${index}`,
          "Only a qualified specialist finding may confirm a plant-health condition.",
        ),
      );
    }
  }
  for (const [index, item] of value.calendar.entries()) {
    if (
      Date.parse(item.windowEnd) < Date.parse(item.windowStart) ||
      !item.siteEvidenceRefs.some((reference) => {
        const evidenceItem = value.evidence.find((candidate) => candidate.id === reference);
        return ["zone-record", "weather-record", "soil-test", "species-record", "water-rule"].includes(
          evidenceItem?.type,
        );
      })
    ) {
      findings.push(
        finding(
          "unsupported_calendar_window",
          `calendar.${index}`,
          "Calendar windows require ordered dates and site, climate, species, soil, or water evidence.",
        ),
      );
    }
    if (
      item.executor === "resident" &&
      (value.riskAssessment.level !== "low-risk" ||
        value.riskAssessment.action !== "bounded-resident-care" ||
        hasHighRisk ||
        !["verified-owner", "verified-tenant-permission"].includes(value.site.workAuthority))
    ) {
      findings.push(
        finding(
          "unsafe_calendar_activity",
          `calendar.${index}`,
          "Resident calendar activities require verified authority and no high-risk condition.",
        ),
      );
    }
  }
  for (const [index, step] of value.carePlan.steps.entries()) {
    findings.push(
      ...referenceFindings(
        step.observationRefs,
        observations,
        `carePlan.steps.${index}.observationRefs`,
        "Observation reference",
      ),
      ...referenceFindings(
        step.hypothesisRefs,
        hypotheses,
        `carePlan.steps.${index}.hypothesisRefs`,
        "Hypothesis reference",
      ),
      ...referenceFindings(
        [step.monitoringRef],
        monitoring,
        `carePlan.steps.${index}.monitoringRef`,
        "Monitoring reference",
      ),
    );
    const labelEvidence = step.productUse
      ? value.evidence.find((item) => item.id === step.productUse.labelRef)
      : undefined;
    const localRuleEvidence = step.productUse?.localRuleRefs.map((reference) =>
      value.evidence.find((item) => item.id === reference),
    );
    if (
      (step.class === "label-approved-product" &&
        (!step.productUse ||
          step.productUse.licenseRequired ||
          !step.evidenceRefs.includes(step.productUse.labelRef) ||
          labelEvidence?.type !== "product-label" ||
          labelEvidence.authority !== "manufacturer" ||
          localRuleEvidence?.some(
            (item) => item?.type !== "treatment-rule" || item.authority !== "government",
          ))) ||
      (step.class !== "label-approved-product" && step.productUse !== null)
    ) {
      findings.push(
        finding(
          "unsupported_product_step",
          `carePlan.steps.${index}.productUse`,
          "A resident product step must bind its exact manufacturer label, permitted target and limits, applicable government rule, and non-licensed use.",
        ),
      );
    }
  }
  for (const [index, item] of value.monitoring.entries()) {
    if (
      ["passed", "failed"].includes(item.state) &&
      (!item.observedAt ||
        Date.parse(item.observedAt) < Date.parse(item.dueAt) ||
        !item.evidenceRefs.some((reference) => {
        const evidenceItem = value.evidence.find((candidate) => candidate.id === reference);
        return (
          ["photo", "measurement"].includes(evidenceItem?.type) &&
          evidenceItem.capturedAt === item.observedAt
        );
      }))
    ) {
      findings.push(
        finding(
          "unsupported_monitoring_result",
          `monitoring.${index}`,
          "Passed or failed monitoring requires timed outcome photo or measurement evidence.",
        ),
      );
    }
  }
  for (const [index, provider] of value.providers.entries()) {
    const providerEvidence = value.evidence.find((item) => item.id === provider.sourceRef);
    if (
      providerEvidence &&
      (providerEvidence.type !== "provider-info" ||
        !["service-provider", "qualified-specialist"].includes(providerEvidence.authority))
    ) {
      findings.push(
        finding(
          "unsupported_provider_evidence",
          `providers.${index}.sourceRef`,
          "Every provider must cite provider-information evidence.",
        ),
      );
    }
  }
  const appointment = value.appointment;
  const hasPlan = Boolean(appointment.plan);
  const hasApproval = Boolean(appointment.approval);
  const hasIntegration = Boolean(appointment.bookingIntegration);
  const hasReceipt = Boolean(appointment.receipt);
  if (
    (["options-ready", "awaiting-approval", "approved", "booked"].includes(appointment.state) &&
      !hasPlan) ||
    (["approved", "booked"].includes(appointment.state) && !hasApproval) ||
    (appointment.state === "booked" && (!hasIntegration || !hasReceipt)) ||
    (appointment.state !== "booked" && (hasIntegration || hasReceipt)) ||
    (!["approved", "booked"].includes(appointment.state) && hasApproval) ||
    (appointment.state === "not-requested" && hasPlan) ||
    (appointment.state === "blocked" && !appointment.blockedReason)
  ) {
    findings.push(
      finding(
        "incoherent_appointment_state",
        "appointment",
        "Appointment plan, approval, integration, receipt, and blocked reason must match the state.",
      ),
    );
  }
  if (appointment.plan) {
    findings.push(
      ...referenceFindings(
        [appointment.plan.providerRef],
        providers,
        "appointment.plan.providerRef",
        "Provider reference",
      ),
    );
    const provider = value.providers.find((item) => item.id === appointment.plan.providerRef);
    if (
      provider &&
      (provider.specialty !== appointment.plan.specialty ||
        provider.qualificationState !== "resident-verified")
    ) {
      findings.push(
        finding(
          "unsupported_provider",
          "appointment.plan",
          "The appointment specialty must match a resident-verified provider.",
        ),
      );
    }
    if (appointment.plan.maxDeposit > appointment.plan.maxCost) {
      findings.push(
        finding(
          "deposit_exceeds_cost",
          "appointment.plan.maxDeposit",
          "The deposit ceiling cannot exceed the cost ceiling.",
        ),
      );
    }
  }
  const planDigest = appointment.plan
    ? `sha256:${createHash("sha256").update(canonicalJson(appointment.plan)).digest("hex")}`
    : undefined;
  if (["approved", "booked"].includes(appointment.state) && appointment.approval) {
    if (
      appointment.approval.planDigest !== planDigest ||
      canonicalJson(appointment.approval.resident) !== canonicalJson(value.resident)
    ) {
      findings.push(
        finding(
          "appointment_approval_mismatch",
          "appointment.approval",
          "Appointment approval must bind the exact plan and resident.",
        ),
      );
    }
  }
  if (
    appointment.state === "booked" &&
    appointment.plan &&
    appointment.approval &&
    appointment.bookingIntegration &&
    appointment.receipt
  ) {
    const integrationEvidence = value.evidence.find(
      (item) => item.id === appointment.bookingIntegration.approvalEvidenceRef,
    );
    const receiptEvidence = value.evidence.find(
      (item) => item.id === appointment.receipt.evidenceRef,
    );
    if (
      appointment.receipt.planDigest !== planDigest ||
      appointment.receipt.integrationId !== appointment.bookingIntegration.id ||
      appointment.receipt.providerRef !== appointment.plan.providerRef ||
      appointment.bookingIntegration.providerRef !== appointment.plan.providerRef ||
      !appointment.receipt.confirmationRef.startsWith(
        `provider://${appointment.plan.providerRef}/`,
      ) ||
      integrationEvidence?.type !== "integration-approval" ||
      integrationEvidence.authority !== "resident-supplied" ||
      integrationEvidence.reference !== appointment.bookingIntegration.approvalRef ||
      receiptEvidence?.type !== "provider-receipt" ||
      receiptEvidence.authority !== "service-provider" ||
      receiptEvidence.reference !== appointment.receipt.confirmationRef ||
      receiptEvidence.capturedAt !== appointment.receipt.bookedAt ||
      Date.parse(integrationEvidence.capturedAt) > Date.parse(appointment.receipt.bookedAt) ||
      Date.parse(appointment.receipt.bookedAt) >= Date.parse(appointment.plan.startsAt) ||
      canonicalJson(appointment.bookingIntegration.configuredBy) !==
        canonicalJson(value.resident)
    ) {
      findings.push(
        finding(
          "booking_receipt_mismatch",
          "appointment.receipt",
          "The approved integration and provider receipt must bind the exact plan.",
        ),
      );
    }
    if (Date.parse(appointment.receipt.bookedAt) < Date.parse(appointment.approval.approvedAt)) {
      findings.push(
        finding(
          "booking_predates_approval",
          "appointment.receipt.bookedAt",
          "A specialist booking cannot predate resident approval.",
        ),
      );
    }
  }
  if (
    canonicalJson(value.handoff.resident) !== canonicalJson(value.resident) ||
    value.resident.id === "green-thumb-coordinator"
  ) {
    findings.push(
      finding(
        "agent_owned_authority",
        "handoff.resident",
        "Garden work, treatment, payment, and appointment authority remain resident-controlled.",
      ),
    );
  }
  return findings;
}

function pondWaterFeatureFindings(value) {
  const evidenceIds = value.evidence.map((item) => item.id);
  const evidence = new Set(evidenceIds);
  const componentIds = value.components.map((item) => item.id);
  const components = new Set(componentIds);
  const providerIds = value.providers.map((item) => item.id);
  const providers = new Set(providerIds);
  const evidenceById = new Map(value.evidence.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(evidenceIds, "evidence", "Evidence id"),
    ...uniqueFindings(componentIds, "components", "Component id"),
    ...uniqueFindings(value.observations.map((item) => item.id), "observations", "Observation id"),
    ...uniqueFindings(value.installation.requirements.map((item) => item.id), "installation.requirements", "Requirement id"),
    ...uniqueFindings(value.installation.requirements.map((item) => item.category), "installation.requirements", "Requirement category"),
    ...uniqueFindings(value.operationsCalendar.map((item) => item.id), "operationsCalendar", "Calendar id"),
    ...uniqueFindings(value.waterQuality.map((item) => item.id), "waterQuality", "Water-quality id"),
    ...uniqueFindings(value.habitat.map((item) => item.id), "habitat", "Habitat id"),
    ...uniqueFindings(value.incidents.map((item) => item.id), "incidents", "Incident id"),
    ...uniqueFindings(providerIds, "providers", "Provider id"),
  ];
  for (const [references, path] of [
    ...value.components.map((item, index) => [item.evidenceRefs, `components.${index}.evidenceRefs`]),
    ...value.observations.map((item, index) => [item.evidenceRefs, `observations.${index}.evidenceRefs`]),
    [value.riskAssessment.evidenceRefs, "riskAssessment.evidenceRefs"],
    ...value.installation.requirements.map((item, index) => [item.evidenceRefs, `installation.requirements.${index}.evidenceRefs`]),
    ...value.operationsCalendar.map((item, index) => [item.sourceRefs, `operationsCalendar.${index}.sourceRefs`]),
    ...value.waterQuality.map((item, index) => [[item.evidenceRef, ...item.thresholdRefs], `waterQuality.${index}`]),
    ...value.habitat.map((item, index) => [item.evidenceRefs, `habitat.${index}.evidenceRefs`]),
    ...value.incidents.map((item, index) => [item.evidenceRefs, `incidents.${index}.evidenceRefs`]),
    ...value.providers.map((item, index) => [[item.sourceRef], `providers.${index}.sourceRef`]),
    ...(value.appointment.bookingIntegration
      ? [[[value.appointment.bookingIntegration.approvalEvidenceRef], "appointment.bookingIntegration"]]
      : []),
    ...(value.appointment.receipt
      ? [[[value.appointment.receipt.evidenceRef], "appointment.receipt"]]
      : []),
  ]) {
    findings.push(...uniqueFindings(references, path, "Evidence reference"));
    findings.push(...referenceFindings(references, evidence, path, "Evidence reference"));
  }
  for (const [references, path] of [
    ...value.operationsCalendar.map((item, index) => [item.componentRefs, `operationsCalendar.${index}.componentRefs`]),
    ...value.incidents.map((item, index) => [item.componentRefs, `incidents.${index}.componentRefs`]),
  ]) {
    findings.push(...uniqueFindings(references, path, "Component reference"));
    findings.push(...referenceFindings(references, components, path, "Component reference"));
  }
  if (
    /\b\d{1,6}[A-Za-z]?(?:-\d{1,6}[A-Za-z]?)?\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:Alley|Aly|Avenue|Ave|Boulevard|Blvd|Circle|Cir|Court|Ct|Drive|Dr|Highway|Hwy|Lane|Ln|Parkway|Pkwy|Place|Pl|Road|Rd|Route|Rte|Street|St|Terrace|Ter|Trail|Trl|Way)\b/iu.test(
      canonicalJson(value),
    )
  ) {
    findings.push(
      finding(
        "exposed_home_address",
        "site",
        "Pond artifacts must use privacy-safe site labels, not a street address.",
      ),
    );
  }
  const directComponentEvidence = new Set([
    "site-plan",
    "manufacturer-manual",
    "equipment-record",
    "installation-record",
    "service-record",
  ]);
  for (const [index, component] of value.components.entries()) {
    const sources = component.evidenceRefs.map((reference) => evidenceById.get(reference));
    if (
      component.state === "installed" &&
      !sources.some(
        (source) =>
          directComponentEvidence.has(source?.type) &&
          ["resident-supplied", "manufacturer", "service-provider", "qualified-contractor"].includes(
            source.authority,
          ),
      )
    ) {
      findings.push(
        finding(
          "unsupported_installed_component",
          `components.${index}`,
          "Installed pond components require direct plan, equipment, installation, manufacturer, or service evidence.",
        ),
      );
    }
  }
  const requiredCategories = [
    "utility",
    "permit",
    "electrical",
    "structural",
    "hydraulic",
    "drainage",
    "access",
    "environmental",
  ];
  const requirementCategories = new Set(
    value.installation.requirements.map((item) => item.category),
  );
  const hasRequirementGap = value.installation.requirements.some((item) =>
    ["missing", "unknown"].includes(item.state),
  );
  const installationClaimsReady = ["bid-ready", "contracted", "complete"].includes(
    value.installation.state,
  );
  if (
    requiredCategories.some((category) => !requirementCategories.has(category)) ||
    (installationClaimsReady && hasRequirementGap) ||
    (value.installation.state === "blocked" && !value.installation.blockedReason) ||
    (value.installation.state !== "blocked" && value.installation.blockedReason)
  ) {
    findings.push(
      finding(
        "incoherent_installation_state",
        "installation",
        "All installation constraints must be represented, and missing or unknown requirements block ready, contracted, or complete state.",
      ),
    );
  }
  const requiredEvidenceTypes = {
    utility: ["utility-location"],
    permit: ["permit-record", "regulation"],
    electrical: ["electrical-record"],
    structural: ["structural-record", "site-plan"],
    hydraulic: ["site-plan", "installation-record", "specialist-finding"],
    drainage: ["site-plan", "installation-record", "specialist-finding"],
    access: ["site-plan", "site-photo", "specialist-finding"],
    environmental: ["permit-record", "regulation", "specialist-finding"],
  };
  for (const [index, requirement] of value.installation.requirements.entries()) {
    const sources = requirement.evidenceRefs.map((reference) => evidenceById.get(reference));
    if (
      ["verified", "not-required"].includes(requirement.state) &&
      !sources.some((source) =>
        requiredEvidenceTypes[requirement.category].includes(source?.type),
      )
    ) {
      findings.push(
        finding(
          "unsupported_installation_requirement",
          `installation.requirements.${index}`,
          "Verified and not-required installation constraints need category-relevant evidence.",
        ),
      );
    }
  }
  const unsafeOperation =
    /\b(?:excavat(?:e|ion)|dig|rewire|wire|hardwire|repair|disassembl|bypass|structural\s+work|pressuri[sz]ed\s+plumb|dose|chemical\s+treat|algaecide|herbicide|pesticide|saniti[sz]er|medicat(?:e|ion)|stock(?:ing)?|release)\b/iu;
  const qualifiedCalendarAuthorities = new Set([
    "manufacturer",
    "government",
    "laboratory",
    "university-extension",
    "qualified-contractor",
    "aquatic-specialist",
    "veterinarian",
  ]);
  const highRisk = ["emergency", "high", "qualified-specialist"].includes(
    value.riskAssessment.level,
  );
  for (const [index, item] of value.operationsCalendar.entries()) {
    const sources = item.sourceRefs.map((reference) => evidenceById.get(reference));
    const installedComponents = item.componentRefs.every(
      (reference) =>
        value.components.find((component) => component.id === reference)?.state === "installed",
    );
    if (
      Date.parse(item.windowStart) > Date.parse(item.windowEnd) ||
      !installedComponents ||
      !sources.some((source) => qualifiedCalendarAuthorities.has(source?.authority)) ||
      unsafeOperation.test(item.activity) ||
      (highRisk && item.executor === "resident")
    ) {
      findings.push(
        finding(
          "unsafe_or_unsupported_operation",
          `operationsCalendar.${index}`,
          "Operations require installed components, qualified evidence, ordered windows, and no high-risk, repair, treatment, stocking, or release instructions.",
        ),
      );
    }
  }
  if (
    (value.riskAssessment.risks.includes("none") &&
      (value.riskAssessment.risks.length !== 1 ||
        value.riskAssessment.level !== "low-risk" ||
        value.riskAssessment.action !== "bounded-resident-operation")) ||
    (highRisk && value.riskAssessment.action === "bounded-resident-operation")
  ) {
    findings.push(
      finding(
        "unsafe_risk_assessment",
        "riskAssessment",
        "High-risk pond states must suppress resident operations, while a no-risk state must be explicitly low-risk and bounded.",
      ),
    );
  }
  for (const [index, item] of value.waterQuality.entries()) {
    const measurement = evidenceById.get(item.evidenceRef);
    const thresholds = item.thresholdRefs.map((reference) => evidenceById.get(reference));
    if (
      measurement?.type !== "water-measurement" &&
      measurement?.type !== "laboratory-result"
    ) {
      findings.push(
        finding(
          "unsupported_water_measurement",
          `waterQuality.${index}.evidenceRef`,
          "Water-quality values require direct measurement or laboratory evidence.",
        ),
      );
    }
    if (
      item.status !== "unknown" &&
      !thresholds.some((source) =>
        ["government", "laboratory", "university-extension", "aquatic-specialist", "veterinarian"].includes(
          source?.authority,
        ),
      )
    ) {
      findings.push(
        finding(
          "unsupported_water_conclusion",
          `waterQuality.${index}.status`,
          "Within-range and outside-range conclusions require a qualified threshold source.",
        ),
      );
    }
  }
  const habitatHandoffs = {
    "aquatic-plant": ["green-thumb", "aquatic-specialist", "regulator"],
    fish: ["pet-care", "aquatic-specialist", "veterinarian", "regulator"],
    amphibian: ["aquatic-specialist", "veterinarian", "regulator"],
    wildlife: ["aquatic-specialist", "veterinarian", "regulator"],
    other: ["aquatic-specialist", "veterinarian", "regulator"],
  };
  for (const [index, item] of value.habitat.entries()) {
    const sources = item.evidenceRefs.map((reference) => evidenceById.get(reference));
    const qualifiedIdentity = sources.some(
      (source) =>
        source?.type === "species-record" &&
        ["government", "university-extension", "aquatic-specialist", "veterinarian"].includes(
          source.authority,
        ),
    );
    if (
      (item.identityState === "qualified-confirmed" && !qualifiedIdentity) ||
      (["concern-observed", "escalated"].includes(item.observationState) &&
        !habitatHandoffs[item.kind].includes(item.handoff)) ||
      (item.observationState === "escalated" && item.handoff === "none")
    ) {
      findings.push(
        finding(
          "unsafe_habitat_handoff",
          `habitat.${index}`,
          "Species identity and plant, fish, wildlife, invasive, or protected-species concerns must remain qualified and route to the correct owner system.",
        ),
      );
    }
  }
  const incidentHandoffs = {
    "equipment-fault": ["home-repair"],
    leak: ["home-repair", "qualified-plumber"],
    "electrical-warning": ["qualified-electrician", "emergency-services"],
    "structural-concern": ["home-repair"],
    "water-quality-exceedance": ["aquatic-specialist", "veterinarian"],
    "fish-health": ["pet-care", "veterinarian"],
    "plant-concern": ["green-thumb", "aquatic-specialist"],
    "environmental-discharge": ["regulator", "emergency-services"],
    other: ["aquatic-specialist", "regulator"],
  };
  for (const [index, item] of value.incidents.entries()) {
    if (
      item.state !== "resolved" &&
      !incidentHandoffs[item.kind].includes(item.handoff)
    ) {
      findings.push(
        finding(
          "unsafe_incident_handoff",
          `incidents.${index}`,
          "Open pond incidents must route faults, plants, fish health, electrical hazards, water quality, and discharge to the correct owner system.",
        ),
      );
    }
  }
  for (const [index, provider] of value.providers.entries()) {
    const source = evidenceById.get(provider.sourceRef);
    if (
      source?.type !== "provider-info" ||
      source.authority !== "service-provider" ||
      provider.qualificationState === "unverified"
    ) {
      findings.push(
        finding(
          "unsupported_provider",
          `providers.${index}`,
          "Pond provider options require provider-controlled evidence and resident or source verification.",
        ),
      );
    }
  }
  const appointment = value.appointment;
  const hasPlan = Boolean(appointment.plan);
  const hasApproval = Boolean(appointment.approval);
  const hasIntegration = Boolean(appointment.bookingIntegration);
  const hasReceipt = Boolean(appointment.receipt);
  if (
    (["options-ready", "awaiting-approval", "approved", "booked"].includes(appointment.state) &&
      !hasPlan) ||
    (["approved", "booked"].includes(appointment.state) && !hasApproval) ||
    (appointment.state === "booked" && (!hasIntegration || !hasReceipt)) ||
    (appointment.state !== "booked" && (hasIntegration || hasReceipt)) ||
    (!["approved", "booked"].includes(appointment.state) && hasApproval) ||
    (appointment.state === "not-requested" && hasPlan) ||
    (appointment.state === "blocked" && !appointment.blockedReason)
  ) {
    findings.push(
      finding(
        "incoherent_appointment_state",
        "appointment",
        "Appointment plan, approval, integration, receipt, and blocked reason must match the declared state.",
      ),
    );
  }
  if (appointment.plan) {
    findings.push(
      ...referenceFindings(
        [appointment.plan.providerRef],
        providers,
        "appointment.plan.providerRef",
        "Provider reference",
      ),
    );
    const provider = value.providers.find(
      (item) => item.id === appointment.plan.providerRef,
    );
    if (
      !provider ||
      provider.qualificationState === "unverified" ||
      provider.specialty !== appointment.plan.specialty ||
      appointment.plan.maxDeposit > appointment.plan.maxCost
    ) {
      findings.push(
        finding(
          "unsupported_appointment",
          "appointment.plan",
          "Appointments require a verified matching specialist and a deposit within the approved cost ceiling.",
        ),
      );
    }
  }
  const planDigest = appointment.plan
    ? `sha256:${createHash("sha256").update(canonicalJson(appointment.plan)).digest("hex")}`
    : undefined;
  if (["approved", "booked"].includes(appointment.state) && appointment.approval) {
    if (
      appointment.approval.planDigest !== planDigest ||
      canonicalJson(appointment.approval.resident) !== canonicalJson(value.resident)
    ) {
      findings.push(
        finding(
          "appointment_approval_mismatch",
          "appointment.approval",
          "Resident approval must bind the exact appointment plan.",
        ),
      );
    }
  }
  if (
    appointment.state === "booked" &&
    appointment.plan &&
    appointment.approval &&
    appointment.bookingIntegration &&
    appointment.receipt
  ) {
    const integrationEvidence = evidenceById.get(
      appointment.bookingIntegration.approvalEvidenceRef,
    );
    const receiptEvidence = evidenceById.get(appointment.receipt.evidenceRef);
    if (
      appointment.receipt.planDigest !== planDigest ||
      appointment.receipt.integrationId !== appointment.bookingIntegration.id ||
      appointment.receipt.providerRef !== appointment.plan.providerRef ||
      appointment.bookingIntegration.providerRef !== appointment.plan.providerRef ||
      !appointment.receipt.confirmationRef.startsWith(
        `provider://${appointment.plan.providerRef}/`,
      ) ||
      integrationEvidence?.type !== "integration-approval" ||
      integrationEvidence.authority !== "resident-supplied" ||
      integrationEvidence.reference !== appointment.bookingIntegration.approvalRef ||
      receiptEvidence?.type !== "provider-receipt" ||
      receiptEvidence.authority !== "service-provider" ||
      receiptEvidence.reference !== appointment.receipt.confirmationRef ||
      receiptEvidence.capturedAt !== appointment.receipt.bookedAt ||
      Date.parse(integrationEvidence.capturedAt) > Date.parse(appointment.receipt.bookedAt) ||
      Date.parse(appointment.receipt.bookedAt) >= Date.parse(appointment.plan.startsAt) ||
      canonicalJson(appointment.bookingIntegration.configuredBy) !==
        canonicalJson(value.resident)
    ) {
      findings.push(
        finding(
          "booking_receipt_mismatch",
          "appointment.receipt",
          "The approved integration and provider receipt must bind the exact resident-approved plan.",
        ),
      );
    }
    if (Date.parse(appointment.receipt.bookedAt) < Date.parse(appointment.approval.approvedAt)) {
      findings.push(
        finding(
          "booking_predates_approval",
          "appointment.receipt.bookedAt",
          "A pond-service booking cannot predate resident approval.",
        ),
      );
    }
  }
  if (
    canonicalJson(value.handoff.resident) !== canonicalJson(value.resident) ||
    value.resident.id === "pond-water-feature-coordinator" ||
    (value.site.workAuthority === "unverified" &&
      (value.handoff.state !== "blocked" ||
        !["not-requested", "blocked"].includes(appointment.state)))
  ) {
    findings.push(
      finding(
        "agent_owned_authority",
        "handoff.resident",
        "Site work, treatment, disclosure, payment, and appointment authority must remain with a verified resident.",
      ),
    );
  }
  return findings;
}

function petCareFindings(value) {
  const evidenceIds = value.evidence.map((item) => item.id);
  const evidence = new Set(evidenceIds);
  const providerIds = value.providers.map((item) => item.id);
  const providers = new Set(providerIds);
  const findings = [
    ...uniqueFindings(evidenceIds, "evidence", "Evidence id"),
    ...uniqueFindings(value.observations.map((item) => item.id), "observations", "Observation id"),
    ...uniqueFindings(value.careCalendar.map((item) => item.id), "careCalendar", "Calendar id"),
    ...uniqueFindings(value.monitoring.map((item) => item.id), "monitoring", "Monitoring id"),
    ...uniqueFindings(providerIds, "providers", "Provider id"),
  ];
  for (const [references, path] of [
    ...value.observations.map((item, index) => [item.evidenceRefs, `observations.${index}.evidenceRefs`]),
    [value.assessment.evidenceRefs, "assessment.evidenceRefs"],
    ...value.careCalendar.map((item, index) => [item.evidenceRefs, `careCalendar.${index}.evidenceRefs`]),
    ...value.monitoring.map((item, index) => [item.evidenceRefs, `monitoring.${index}.evidenceRefs`]),
    ...value.providers.map((item, index) => [[item.sourceRef], `providers.${index}.sourceRef`]),
  ]) {
    findings.push(...uniqueFindings(references, path, "Evidence reference"));
    findings.push(...referenceFindings(references, evidence, path, "Evidence reference"));
  }
  if (/\b\d{1,6}[A-Za-z]?(?:-\d{1,6}[A-Za-z]?)?\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:Alley|Aly|Avenue|Ave|Boulevard|Blvd|Circle|Cir|Court|Ct|Crescent|Cres|Drive|Dr|Expressway|Expy|Freeway|Fwy|Highway|Hwy|Lane|Ln|Parkway|Pkwy|Place|Pl|Plaza|Plz|Road|Rd|Route|Rte|Square|Sq|Street|St|Terrace|Ter|Trail|Trl|Way)\b/iu.test(canonicalJson(value))) {
    findings.push(finding("exposed_home_address", "pet", "Durable pet-care artifacts must use privacy-safe labels, not a street address."));
  }
  const emergencyRisks = new Set([
    "breathing-distress", "collapse", "uncontrolled-bleeding", "seizure",
    "toxic-exposure", "medication-error", "severe-pain", "rapid-decline",
  ]);
  const urgentRisks = new Set(["foreign-body", "persistent-vomiting"]);
  const hasEmergencyRisk = value.assessment.risks.some((risk) => emergencyRisks.has(risk));
  const hasNonToxicEmergencyRisk = value.assessment.risks.some(
    (risk) => emergencyRisks.has(risk) && risk !== "toxic-exposure",
  );
  const hasUrgentRisk = value.assessment.risks.some((risk) => urgentRisks.has(risk));
  if (
    (value.assessment.risks.includes("none") && value.assessment.risks.length !== 1) ||
    (value.assessment.risks.includes("none") && !["routine", "preventive"].includes(value.assessment.level)) ||
    (hasEmergencyRisk && value.assessment.level !== "emergency") ||
    (hasUrgentRisk && !["urgent", "emergency"].includes(value.assessment.level)) ||
    (value.assessment.level === "emergency" &&
      ((hasNonToxicEmergencyRisk &&
        value.assessment.action !== "emergency-veterinary") ||
        (!hasNonToxicEmergencyRisk &&
          !["emergency-veterinary", "poison-control"].includes(
            value.assessment.action,
          )))) ||
    (value.assessment.level === "urgent" &&
      value.assessment.action !== "urgent-veterinary") ||
    (value.assessment.level === "routine" &&
      value.assessment.action !== "routine-veterinary") ||
    (value.assessment.level === "preventive" &&
      value.assessment.action !== "preventive-tracking") ||
    (value.assessment.level === "uncertain" && value.assessment.action === "preventive-tracking")
  ) {
    findings.push(finding("unsafe_pet_assessment", "assessment", "Emergency, toxic-exposure, medication-error, and uncertain states must fail closed to qualified care."));
  }
  if (value.assessment.level !== "emergency" && value.careCalendar.length === 0) {
    findings.push(
      finding(
        "missing_care_calendar",
        "careCalendar",
        "Non-emergency pet-care handoffs require an evidence-bound care calendar.",
      ),
    );
  }
  for (const [index, item] of value.careCalendar.entries()) {
    if (Date.parse(item.dueStart) > Date.parse(item.dueEnd)) {
      findings.push(finding("invalid_care_window", `careCalendar.${index}`, "Care due windows must be ordered."));
    }
    const qualified = item.evidenceRefs.some((reference) => {
      const evidenceItem = value.evidence.find((candidate) => candidate.id === reference);
      return ["veterinarian", "veterinary-laboratory", "manufacturer", "government"].includes(evidenceItem?.authority);
    });
    const linkedEvidence = item.evidenceRefs
      .map((reference) => value.evidence.find((candidate) => candidate.id === reference))
      .filter(Boolean);
    const supportedMedication =
      item.kind !== "veterinarian-directed-medication" ||
      linkedEvidence.some(
        (evidenceItem) =>
          evidenceItem.type === "prescription-label" &&
          evidenceItem.authority === "veterinarian",
      );
    const supportedPreventive =
      item.kind !== "preventive" ||
      linkedEvidence.some(
        (evidenceItem) =>
          (evidenceItem.type === "veterinary-record" &&
            evidenceItem.authority === "veterinarian") ||
          (evidenceItem.type === "laboratory-result" &&
            evidenceItem.authority === "veterinary-laboratory") ||
          (evidenceItem.type === "manufacturer-label" &&
            evidenceItem.authority === "manufacturer") ||
          (evidenceItem.type === "government-guidance" &&
            evidenceItem.authority === "government"),
      );
    if (
      !qualified ||
      !supportedMedication ||
      !supportedPreventive ||
      (value.assessment.level === "emergency" && item.executor === "guardian")
    ) {
      findings.push(finding("unsupported_pet_care", `careCalendar.${index}`, "Care items require qualified evidence and emergency states cannot produce guardian care instructions."));
    }
  }
  for (const [index, item] of value.monitoring.entries()) {
    const timedOutcomeEvidence = item.evidenceRefs
      .map((reference) => value.evidence.find((candidate) => candidate.id === reference))
      .filter(
        (evidenceItem) =>
          evidenceItem &&
          ["guardian-report", "photo", "video", "measurement", "veterinary-record", "laboratory-result"].includes(
            evidenceItem.type,
          ) &&
          item.observedAt &&
          Date.parse(evidenceItem.capturedAt) <= Date.parse(item.observedAt) &&
          Date.parse(evidenceItem.capturedAt) >= Date.parse(item.dueAt),
      );
    if (
      (["stable", "worsened"].includes(item.state) &&
        (!item.observedAt || timedOutcomeEvidence.length === 0)) ||
      (item.state === "planned" && item.observedAt)
    ) {
      findings.push(finding("unsupported_monitoring_result", `monitoring.${index}`, "Completed monitoring requires timed outcome evidence captured at or after the checkpoint."));
    }
  }
  for (const [index, provider] of value.providers.entries()) {
    const source = value.evidence.find((item) => item.id === provider.sourceRef);
    if (source?.type !== "provider-info" || source.authority !== "service-provider") {
      findings.push(finding("unsupported_provider", `providers.${index}.sourceRef`, "Veterinary provider options require provider-controlled evidence."));
    }
  }
  const appointment = value.appointment;
  const hasPlan = Boolean(appointment.plan);
  const hasApproval = Boolean(appointment.approval);
  const hasIntegration = Boolean(appointment.bookingIntegration);
  const hasReceipt = Boolean(appointment.receipt);
  if (
    value.assessment.level === "emergency" &&
    (appointment.state !== "blocked" ||
      hasPlan ||
      !appointment.blockedReason ||
      value.handoff.state !== "blocked")
  ) {
    findings.push(
      finding(
        "unsafe_emergency_handoff",
        "appointment",
        "Emergency pet-care states must block routine scheduling and produce an immediate-care handoff.",
      ),
    );
  }
  if (
    (["options-ready", "awaiting-approval", "approved", "booked"].includes(appointment.state) && !hasPlan) ||
    (["approved", "booked"].includes(appointment.state) && !hasApproval) ||
    (appointment.state === "booked" && (!hasIntegration || !hasReceipt)) ||
    (appointment.state !== "booked" && (hasIntegration || hasReceipt)) ||
    (!["approved", "booked"].includes(appointment.state) && hasApproval) ||
    (appointment.state === "not-requested" && hasPlan) ||
    (appointment.state === "blocked" && !appointment.blockedReason)
  ) {
    findings.push(finding("incoherent_appointment_state", "appointment", "Appointment plan, approval, integration, and receipt must match the declared state."));
  }
  if (appointment.plan) {
    findings.push(...referenceFindings([appointment.plan.providerRef], providers, "appointment.plan.providerRef", "Provider reference"));
    const provider = value.providers.find((item) => item.id === appointment.plan.providerRef);
    if (
      provider &&
      (provider.specialty !== appointment.plan.specialty ||
        provider.qualificationState !== "guardian-verified")
    ) {
      findings.push(finding("appointment_specialty_mismatch", "appointment.plan.specialty", "Appointment specialty must match the selected veterinary provider."));
    }
    if (appointment.plan.maxDeposit > appointment.plan.maxCost) {
      findings.push(finding("deposit_exceeds_cost", "appointment.plan.maxDeposit", "Deposit cannot exceed the approved cost ceiling."));
    }
  }
  const planDigest = appointment.plan
    ? `sha256:${createHash("sha256").update(canonicalJson(appointment.plan)).digest("hex")}`
    : undefined;
  if (["approved", "booked"].includes(appointment.state) && appointment.approval) {
    if (
      appointment.approval.planDigest !== planDigest ||
      canonicalJson(appointment.approval.guardian) !== canonicalJson(value.guardian)
    ) {
      findings.push(finding("appointment_approval_mismatch", "appointment.approval", "Appointment approval must bind the exact plan and guardian."));
    }
  }
  if (
    appointment.state === "booked" &&
    appointment.plan &&
    appointment.approval &&
    appointment.bookingIntegration &&
    appointment.receipt
  ) {
    const integrationEvidence = value.evidence.find(
      (item) => item.id === appointment.bookingIntegration.approvalEvidenceRef,
    );
    const receiptEvidence = value.evidence.find(
      (item) => item.id === appointment.receipt.evidenceRef,
    );
    if (
      appointment.receipt.planDigest !== planDigest ||
      appointment.receipt.integrationId !== appointment.bookingIntegration.id ||
      appointment.receipt.providerRef !== appointment.plan.providerRef ||
      appointment.bookingIntegration.providerRef !== appointment.plan.providerRef ||
      !appointment.receipt.confirmationRef.startsWith(
        `provider://${appointment.plan.providerRef}/`,
      ) ||
      integrationEvidence?.type !== "integration-approval" ||
      integrationEvidence.authority !== "guardian-supplied" ||
      integrationEvidence.reference !== appointment.bookingIntegration.approvalRef ||
      receiptEvidence?.type !== "provider-receipt" ||
      receiptEvidence.authority !== "service-provider" ||
      receiptEvidence.reference !== appointment.receipt.confirmationRef ||
      receiptEvidence.capturedAt !== appointment.receipt.bookedAt ||
      Date.parse(integrationEvidence.capturedAt) > Date.parse(appointment.receipt.bookedAt) ||
      Date.parse(appointment.receipt.bookedAt) >= Date.parse(appointment.plan.startsAt) ||
      canonicalJson(appointment.bookingIntegration.configuredBy) !==
        canonicalJson(value.guardian)
    ) {
      findings.push(finding("booking_receipt_mismatch", "appointment.receipt", "The approved integration and provider receipt must bind the exact guardian-approved plan."));
    }
    if (Date.parse(appointment.receipt.bookedAt) < Date.parse(appointment.approval.approvedAt)) {
      findings.push(finding("booking_predates_approval", "appointment.receipt.bookedAt", "A veterinary booking cannot predate guardian approval."));
    }
  }
  if (
    canonicalJson(value.handoff.guardian) !== canonicalJson(value.guardian) ||
    value.guardian.id === "pet-care-coordinator"
  ) {
    findings.push(finding("agent_owned_authority", "handoff.guardian", "Diagnosis, treatment, disclosure, payment, and appointment authority remain guardian-controlled."));
  }
  return findings;
}

function careCircleFindings(value) {
  const evidenceIds = value.evidence.map((item) => item.id);
  const helperIds = value.helpers.map((item) => item.id);
  const needIds = value.needs.map((item) => item.id);
  const scopeIds = value.consentScopes.map((item) => item.id);
  const taskIds = value.supportTasks.map((item) => item.id);
  const people = new Set([value.recipient.id, value.organizer.id, ...helperIds]);
  const evidence = new Set(evidenceIds);
  const helpers = new Set(helperIds);
  const needs = new Set(needIds);
  const scopes = new Set(scopeIds);
  const tasks = new Set(taskIds);
  const evidenceById = new Map(value.evidence.map((item) => [item.id, item]));
  const helperById = new Map(value.helpers.map((item) => [item.id, item]));
  const needById = new Map(value.needs.map((item) => [item.id, item]));
  const scopeById = new Map(value.consentScopes.map((item) => [item.id, item]));
  const commitmentByTask = new Map(value.commitments.map((item) => [item.taskRef, item]));
  const findings = [
    ...uniqueFindings(evidenceIds, "evidence", "Evidence id"),
    ...uniqueFindings(helperIds, "helpers", "Helper id"),
    ...uniqueFindings(needIds, "needs", "Need id"),
    ...uniqueFindings(scopeIds, "consentScopes", "Consent scope id"),
    ...uniqueFindings(taskIds, "supportTasks", "Support task id"),
    ...uniqueFindings(value.commitments.map((item) => item.id), "commitments", "Commitment id"),
    ...uniqueFindings(value.blockedItems.map((item) => item.id), "blockedItems", "Blocked item id"),
  ];
  for (const [references, allowed, path, label] of [
    ...value.helpers.map((item, index) => [
      item.availabilityEvidenceRefs,
      evidence,
      `helpers.${index}.availabilityEvidenceRefs`,
      "Evidence reference",
    ]),
    ...value.needs.map((item, index) => [
      item.evidenceRefs,
      evidence,
      `needs.${index}.evidenceRefs`,
      "Evidence reference",
    ]),
    ...value.consentScopes.map((item, index) => [
      item.evidenceRefs,
      evidence,
      `consentScopes.${index}.evidenceRefs`,
      "Evidence reference",
    ]),
    ...value.consentScopes.map((item, index) => [
      item.audienceRefs,
      people,
      `consentScopes.${index}.audienceRefs`,
      "Audience reference",
    ]),
    ...value.commitments.map((item, index) => [
      item.evidenceRefs,
      evidence,
      `commitments.${index}.evidenceRefs`,
      "Evidence reference",
    ]),
  ]) {
    findings.push(...uniqueFindings(references, path, label));
    findings.push(...referenceFindings(references, allowed, path, label));
  }
  for (const [index, need] of value.needs.entries()) {
    if (Date.parse(need.dueEnd) <= Date.parse(need.dueStart)) {
      findings.push(finding("invalid_time_range", `needs.${index}`, "Care need due windows must be ordered."));
    }
    if (
      ["urgent", "emergency"].includes(need.priority) &&
      need.professionalBoundary === "practical-support"
    ) {
      findings.push(
        finding(
          "unsafe_care_need",
          `needs.${index}`,
          "Urgent and emergency care questions must route to professional or emergency owners.",
        ),
      );
    }
  }
  for (const [index, scope] of value.consentScopes.entries()) {
    findings.push(
      ...referenceFindings([scope.recipientRef], new Set([value.recipient.id]), `consentScopes.${index}.recipientRef`, "Recipient reference"),
    );
    const consentEvidence = scope.evidenceRefs
      .map((reference) => evidenceById.get(reference))
      .filter(Boolean);
    if (
      consentEvidence.every(
        (item) => item.type !== "recipient-consent" || item.authority !== "recipient-supplied",
      ) ||
      Date.parse(scope.expiresAt) <= Math.max(...consentEvidence.map((item) => Date.parse(item.capturedAt)))
    ) {
      findings.push(
        finding(
          "unsupported_consent_scope",
          `consentScopes.${index}`,
          "Shared care-circle details require current recipient-supplied consent.",
        ),
      );
    }
  }
  for (const [index, task] of value.supportTasks.entries()) {
    findings.push(
      ...referenceFindings([task.needRef], needs, `supportTasks.${index}.needRef`, "Need reference"),
    );
    if (task.helperRef) {
      findings.push(
        ...referenceFindings([task.helperRef], helpers, `supportTasks.${index}.helperRef`, "Helper reference"),
      );
    }
    if (task.scopeRef) {
      findings.push(
        ...referenceFindings([task.scopeRef], scopes, `supportTasks.${index}.scopeRef`, "Consent scope reference"),
      );
    }
    if (Date.parse(task.endsAt) <= Date.parse(task.startsAt)) {
      findings.push(finding("invalid_time_range", `supportTasks.${index}`, "Support task windows must be ordered."));
    }
    const need = needById.get(task.needRef);
    const helper = task.helperRef ? helperById.get(task.helperRef) : undefined;
    const scope = task.scopeRef ? scopeById.get(task.scopeRef) : undefined;
    const commitment = commitmentByTask.get(task.id);
    if (
      need &&
      need.professionalBoundary !== "practical-support" &&
      !["blocked", "escalation-required"].includes(task.state)
    ) {
      findings.push(
        finding(
          "unsupported_professional_care",
          `supportTasks.${index}`,
          "Medical, legal, financial, and emergency needs cannot become ordinary helper support tasks.",
        ),
      );
    }
    if (
      task.state === "accepted" &&
      (!helper ||
        !scope ||
        !scope.audienceRefs.includes(helper.id) ||
        !scope.audienceRefs.includes(value.organizer.id) ||
        !helper.allowedTaskKinds.includes(need?.kind) ||
        !commitment ||
        commitment.state !== "accepted" ||
        commitment.helperRef !== helper.id ||
        commitment.acceptedAt === null)
    ) {
      findings.push(
        finding(
          "unsupported_helper_commitment",
          `supportTasks.${index}`,
          "Accepted care tasks require a permitted helper, consent scope, and exact accepted commitment.",
        ),
      );
    }
  }
  for (const [index, commitment] of value.commitments.entries()) {
    findings.push(
      ...referenceFindings([commitment.taskRef], tasks, `commitments.${index}.taskRef`, "Task reference"),
      ...referenceFindings([commitment.helperRef], helpers, `commitments.${index}.helperRef`, "Helper reference"),
    );
    if (
      (commitment.state === "accepted" && !commitment.acceptedAt) ||
      (commitment.state !== "accepted" && commitment.acceptedAt)
    ) {
      findings.push(
        finding(
          "incoherent_commitment_state",
          `commitments.${index}`,
          "Only accepted helper commitments may carry an acceptedAt timestamp.",
        ),
      );
    }
  }
  for (const [index, item] of value.blockedItems.entries()) {
    findings.push(
      ...referenceFindings([item.ownerRef], people, `blockedItems.${index}.ownerRef`, "Owner reference"),
    );
  }
  if (/\b\d{1,6}[A-Za-z]?(?:-\d{1,6}[A-Za-z]?)?\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:Alley|Aly|Avenue|Ave|Boulevard|Blvd|Circle|Cir|Court|Ct|Crescent|Cres|Drive|Dr|Expressway|Expy|Freeway|Fwy|Highway|Hwy|Lane|Ln|Parkway|Pkwy|Place|Pl|Plaza|Plz|Road|Rd|Route|Rte|Square|Sq|Street|St|Terrace|Ter|Trail|Trl|Way)\b/iu.test(canonicalJson(value))) {
    findings.push(
      finding(
        "exposed_private_location",
        "recipient",
        "Durable care-circle artifacts must use privacy-safe labels, not a street address.",
      ),
    );
  }
  if (
    value.handoff.recipientRef !== value.recipient.id ||
    value.handoff.organizerRef !== value.organizer.id ||
    value.recipient.id === "care-circle-coordinator" ||
    value.organizer.id === "care-circle-coordinator"
  ) {
    findings.push(
      finding(
        "agent_owned_authority",
        "handoff",
        "Care, privacy, helper commitments, and escalation authority must remain with named humans.",
      ),
    );
  }
  if (
    value.handoff.state === "ready-for-organizer" &&
    (value.supportTasks.some((item) => ["blocked", "escalation-required", "pending-recipient"].includes(item.state)) ||
      value.blockedItems.some((item) => item.state !== "resolved-by-human"))
  ) {
    findings.push(
      finding(
        "unsupported_terminal_state",
        "handoff.state",
        "Ready handoff requires all blocked, escalation, and recipient-pending items to be resolved by humans.",
      ),
    );
  }
  return findings;
}

function sportsTeamWatchFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const teamIds = value.teams.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const teamSet = new Set(teamIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(teamIds, "teams", "Team id"),
    ...uniqueFindings(value.games.map((item) => item.id), "games", "Game id"),
    ...uniqueFindings(value.rosterNotes.map((item) => item.id), "rosterNotes", "Roster note id"),
    ...uniqueFindings(value.watchItems.map((item) => item.id), "watchItems", "Watch item id"),
  ];
  for (const [index, team] of value.teams.entries()) {
    findings.push(
      ...uniqueFindings(team.sourceRefs, `teams.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(team.sourceRefs, sourceSet, `teams.${index}.sourceRefs`, "Source reference"),
    );
    const officialSources = team.sourceRefs
      .map((ref) => sourceById.get(ref))
      .filter((item) => item && ["official-league", "official-team"].includes(item.authority));
    if (officialSources.length === 0) {
      findings.push(finding("unofficial_team_facts", `teams.${index}.sourceRefs`, "Team facts require official league or team source evidence."));
    }
  }
  for (const [index, game] of value.games.entries()) {
    findings.push(
      ...referenceFindings([game.teamRef], teamSet, `games.${index}.teamRef`, "Team reference"),
      ...uniqueFindings(game.sourceRefs, `games.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(game.sourceRefs, sourceSet, `games.${index}.sourceRefs`, "Source reference"),
    );
    if ((game.status === "final" && !game.score) || (game.status !== "final" && game.score !== null)) {
      findings.push(finding("incoherent_game_score", `games.${index}.score`, "Only final games may carry a score, and final games require one."));
    }
  }
  for (const [collection, path] of [
    [value.standings, "standings"],
    [value.rosterNotes, "rosterNotes"],
    [value.watchItems, "watchItems"],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...referenceFindings([item.teamRef], teamSet, `${path}.${index}.teamRef`, "Team reference"),
        ...uniqueFindings(item.sourceRefs, `${path}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${path}.${index}.sourceRefs`, "Source reference"),
      );
    }
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready sports watches cannot depend on stale, missing, or conflicting sources."));
  }
  const fanText = canonicalJson({
    games: value.games.map(({ opponent, score }) => ({ opponent, score })),
    rosterNotes: value.rosterNotes.map(({ subject, note }) => ({ subject, note })),
    standings: value.standings.map(({ summary }) => summary),
    watchItems: value.watchItems.map(({ title, whyItMatters }) => ({ title, whyItMatters })),
  });
  if (/\b(odds|spread|parlay|moneyline|wager|bet|betting)\b/iu.test(fanText)) {
    findings.push(finding("betting_content", "watchItems", "Sports watch artifacts must exclude betting, odds, and wagering content."));
  }
  if (value.handoff.owner === "sports-team-watcher") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Review, betting, ticketing, calendar, and messaging authority must remain with the named owner."));
  }
  return findings;
}

function fantasySportsFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const ruleIds = value.rules.map((item) => item.id);
  const playerIds = value.players.map((item) => item.id);
  const lineupIds = value.lineup.map((item) => item.id);
  const waiverIds = value.waiverWatch.map((item) => item.id);
  const tradeIds = value.tradeIdeas.map((item) => item.id);
  const riskIds = value.matchupRisks.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const playerSet = new Set(playerIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const playerById = new Map(value.players.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(ruleIds, "rules", "Rule id"),
    ...uniqueFindings(playerIds, "players", "Player id"),
    ...uniqueFindings(lineupIds, "lineup", "Lineup id"),
    ...uniqueFindings(waiverIds, "waiverWatch", "Waiver id"),
    ...uniqueFindings(tradeIds, "tradeIdeas", "Trade id"),
    ...uniqueFindings(riskIds, "matchupRisks", "Risk id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, rule] of value.rules.entries()) {
    findings.push(
      ...uniqueFindings(rule.sourceRefs, `rules.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(rule.sourceRefs, sourceSet, `rules.${index}.sourceRefs`, "Source reference"),
    );
    if (rule.state === "current" && rule.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_rule_state", `rules.${index}.sourceRefs`, "Current fantasy rules require current source evidence."));
    }
  }
  for (const [index, player] of value.players.entries()) {
    findings.push(
      ...uniqueFindings(player.sourceRefs, `players.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(player.sourceRefs, sourceSet, `players.${index}.sourceRefs`, "Source reference"),
    );
    if (player.projection.sourceRef !== null) {
      findings.push(
        ...referenceFindings([player.projection.sourceRef], sourceSet, `players.${index}.projection.sourceRef`, "Projection source"),
      );
    }
    if (player.projection.state === "supported" && player.projection.sourceRef === null) {
      findings.push(finding("unsupported_projection_state", `players.${index}.projection.sourceRef`, "Supported projections require a source."));
    }
    if (player.availability === "available" && player.sourceRefs.some((ref) => sourceById.get(ref)?.freshness === "stale")) {
      findings.push(finding("unsupported_availability", `players.${index}.sourceRefs`, "Available players cannot depend on stale source evidence."));
    }
  }
  for (const [index, slot] of value.lineup.entries()) {
    findings.push(
      ...referenceFindings([slot.playerRef], playerSet, `lineup.${index}.playerRef`, "Player reference"),
      ...uniqueFindings(slot.sourceRefs, `lineup.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(slot.sourceRefs, sourceSet, `lineup.${index}.sourceRefs`, "Source reference"),
    );
    const player = playerById.get(slot.playerRef);
    if (slot.reviewState === "ready-for-owner-review" && (slot.lockState !== "open" || !player || !["available", "questionable"].includes(player.availability))) {
      findings.push(finding("unsupported_lineup_state", `lineup.${index}.reviewState`, "Ready lineup review requires an open slot and a player with supported availability."));
    }
    if (slot.reviewState === "ready-for-owner-review" && slot.sourceRefs.some((ref) => ["stale", "missing", "conflicting"].includes(sourceById.get(ref)?.freshness))) {
      findings.push(finding("unsupported_lineup_sources", `lineup.${index}.sourceRefs`, "Ready lineup review cannot depend on stale, missing, or conflicting sources."));
    }
  }
  for (const [collectionName, collection] of [
    ["waiverWatch", value.waiverWatch],
    ["matchupRisks", value.matchupRisks],
  ]) {
    for (const [index, item] of collection.entries()) {
      const refs = item.playerRefs ?? [item.playerRef];
      findings.push(
        ...uniqueFindings(refs, `${collectionName}.${index}.playerRefs`, "Player reference"),
        ...referenceFindings(refs, playerSet, `${collectionName}.${index}.playerRefs`, "Player reference"),
        ...uniqueFindings(item.sourceRefs, `${collectionName}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${collectionName}.${index}.sourceRefs`, "Source reference"),
      );
    }
  }
  for (const [index, idea] of value.tradeIdeas.entries()) {
    findings.push(
      ...uniqueFindings(idea.playerRefs, `tradeIdeas.${index}.playerRefs`, "Player reference"),
      ...referenceFindings(idea.playerRefs, playerSet, `tradeIdeas.${index}.playerRefs`, "Player reference"),
      ...uniqueFindings(idea.sourceRefs, `tradeIdeas.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(idea.sourceRefs, sourceSet, `tradeIdeas.${index}.sourceRefs`, "Source reference"),
    );
    if (idea.reviewState === "owner-review" && idea.deadlineState !== "open") {
      findings.push(finding("unsupported_trade_state", `tradeIdeas.${index}.deadlineState`, "Owner-review trade ideas require an open deadline state."));
    }
  }
  const knownRefs = new Set([...sourceIds, ...ruleIds, ...playerIds, ...lineupIds, ...waiverIds, ...tradeIds, ...riskIds]);
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.refs, `reviewQuestions.${index}.refs`, "Review reference"),
      ...referenceFindings(question.refs, knownRefs, `reviewQuestions.${index}.refs`, "Review reference"),
    );
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, new Set(questionIds), "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready fantasy roster packets cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    lineup: value.lineup.map(({ reason }) => reason),
    waiverWatch: value.waiverWatch.map(({ rosterImpact }) => rosterImpact),
    tradeIdeas: value.tradeIdeas.map(({ riskSummary }) => riskSummary),
    matchupRisks: value.matchupRisks.map(({ summary }) => summary),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(submit lineup|set lineup|claim waiver|drop player|add player|propose trade|accept trade|enter contest|place bet|betting advice|gambling advice|message league|pay fee|change settings|change account|guaranteed points|lock it in)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Fantasy roster artifacts must not instruct lineup, waiver, trade, contest, betting, payment, message, settings, or account actions."));
  }
  if (value.handoff.owner === "fantasy-sports-manager") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Fantasy lineup, waiver, trade, contest, betting, payment, messaging, settings, and account authority must remain with the named owner."));
  }
  return findings;
}

function movieStreamingFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const titleIds = value.titles.map((item) => item.id);
  const availabilityIds = value.availability.map((item) => item.id);
  const preferenceIds = value.preferences.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const titleSet = new Set(titleIds);
  const availabilitySet = new Set(availabilityIds);
  const preferenceSet = new Set(preferenceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const titleById = new Map(value.titles.map((item) => [item.id, item]));
  const availabilityById = new Map(value.availability.map((item) => [item.id, item]));
  const collectionServices = new Set(value.collection.services);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(titleIds, "titles", "Title id"),
    ...uniqueFindings(availabilityIds, "availability", "Availability id"),
    ...uniqueFindings(preferenceIds, "preferences", "Preference id"),
    ...uniqueFindings(value.shortlist.map((item) => item.id), "shortlist", "Shortlist id"),
  ];
  for (const [index, title] of value.titles.entries()) {
    findings.push(
      ...uniqueFindings(title.sourceRefs, `titles.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(title.sourceRefs, sourceSet, `titles.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, row] of value.availability.entries()) {
    findings.push(
      ...referenceFindings([row.titleRef], titleSet, `availability.${index}.titleRef`, "Title reference"),
      ...uniqueFindings(row.sourceRefs, `availability.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(row.sourceRefs, sourceSet, `availability.${index}.sourceRefs`, "Source reference"),
    );
    const supportedSource = row.sourceRefs.some((ref) =>
      ["streaming-availability", "title-metadata"].includes(sourceById.get(ref)?.kind),
    );
    if (!supportedSource) {
      findings.push(finding("unsupported_availability_source", `availability.${index}.sourceRefs`, "Availability rows require streaming availability or title metadata source evidence."));
    }
    if (!collectionServices.has(row.service)) {
      findings.push(finding("unsupported_service", `availability.${index}.service`, "Availability must be scoped to services the owner says they have."));
    }
    if (row.region !== value.collection.region) {
      findings.push(finding("region_mismatch", `availability.${index}.region`, "Availability region must match the watchlist region."));
    }
  }
  for (const [index, preference] of value.preferences.entries()) {
    findings.push(
      ...uniqueFindings(preference.sourceRefs, `preferences.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(preference.sourceRefs, sourceSet, `preferences.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, pick] of value.shortlist.entries()) {
    findings.push(
      ...referenceFindings([pick.titleRef], titleSet, `shortlist.${index}.titleRef`, "Title reference"),
      ...referenceFindings([pick.availabilityRef], availabilitySet, `shortlist.${index}.availabilityRef`, "Availability reference"),
      ...uniqueFindings(pick.preferenceRefs, `shortlist.${index}.preferenceRefs`, "Preference reference"),
      ...referenceFindings(pick.preferenceRefs, preferenceSet, `shortlist.${index}.preferenceRefs`, "Preference reference"),
    );
    const title = titleById.get(pick.titleRef);
    const availability = availabilityById.get(pick.availabilityRef);
    if (availability && availability.titleRef !== pick.titleRef) {
      findings.push(finding("availability_title_mismatch", `shortlist.${index}.availabilityRef`, "Shortlist availability must belong to the same title."));
    }
    if (
      pick.state === "recommended" &&
      (!availability ||
        availability.freshness !== "current" ||
        availability.accessMode !== "included" ||
        availability.accountConstraint !== "included-in-owner-plan")
    ) {
      findings.push(finding("unsupported_recommendation", `shortlist.${index}`, "Recommended titles require current included availability on the owner's declared services."));
    }
    if (pick.state === "recommended" && ["watched", "disliked", "blocked"].includes(title?.tasteState)) {
      findings.push(finding("taste_state_conflict", `shortlist.${index}.titleRef`, "Recommended titles cannot conflict with watched, disliked, or blocked taste state."));
    }
    if (
      (pick.state === "blocked" && !pick.blockedReason) ||
      (pick.state !== "blocked" && pick.blockedReason !== null)
    ) {
      findings.push(finding("incoherent_blocked_state", `shortlist.${index}.blockedReason`, "Only blocked shortlist items may carry a blocked reason."));
    }
  }
  const accountActionText = canonicalJson({
    shortlist: value.shortlist.map(({ fitReason, blockedReason }) => ({ fitReason, blockedReason })),
  });
  if (/\b(rent|buy|subscribe|cancel|publish|rate|message|modify account|bypass)\b/iu.test(accountActionText)) {
    findings.push(finding("account_action_content", "shortlist", "Watch artifacts must not instruct account, purchase, subscription, posting, messaging, or restriction-bypass actions."));
  }
  if (value.handoff.owner === "movie-streaming-organizer") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Streaming account, purchase, rating, messaging, and viewing decisions must remain with the named owner."));
  }
  return findings;
}

function musicOrganizerFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const itemIds = value.items.map((item) => item.id);
  const availabilityIds = value.availability.map((item) => item.id);
  const preferenceIds = value.preferences.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const itemSet = new Set(itemIds);
  const availabilitySet = new Set(availabilityIds);
  const preferenceSet = new Set(preferenceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const itemById = new Map(value.items.map((item) => [item.id, item]));
  const availabilityById = new Map(value.availability.map((item) => [item.id, item]));
  const libraryServices = new Set(value.library.services);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(itemIds, "items", "Music item id"),
    ...uniqueFindings(availabilityIds, "availability", "Availability id"),
    ...uniqueFindings(preferenceIds, "preferences", "Preference id"),
    ...uniqueFindings(value.playlistPlan.map((item) => item.id), "playlistPlan", "Playlist pick id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, item] of value.items.entries()) {
    findings.push(
      ...uniqueFindings(item.sourceRefs, `items.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `items.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, row] of value.availability.entries()) {
    findings.push(
      ...referenceFindings([row.itemRef], itemSet, `availability.${index}.itemRef`, "Music item reference"),
      ...uniqueFindings(row.sourceRefs, `availability.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(row.sourceRefs, sourceSet, `availability.${index}.sourceRefs`, "Source reference"),
    );
    const supportedSource = row.sourceRefs.some((ref) =>
      ["streaming-availability", "library-export", "rights-metadata"].includes(sourceById.get(ref)?.kind),
    );
    if (!supportedSource) {
      findings.push(finding("unsupported_availability_source", `availability.${index}.sourceRefs`, "Music availability requires streaming, library-export, or rights source evidence."));
    }
    if (!libraryServices.has(row.service)) {
      findings.push(finding("unsupported_service", `availability.${index}.service`, "Music availability must be scoped to services or libraries the owner declared."));
    }
    if (row.region !== value.library.region) {
      findings.push(finding("region_mismatch", `availability.${index}.region`, "Music availability region must match the library region."));
    }
  }
  for (const [index, preference] of value.preferences.entries()) {
    findings.push(
      ...uniqueFindings(preference.sourceRefs, `preferences.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(preference.sourceRefs, sourceSet, `preferences.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, pick] of value.playlistPlan.entries()) {
    findings.push(
      ...referenceFindings([pick.itemRef], itemSet, `playlistPlan.${index}.itemRef`, "Music item reference"),
      ...referenceFindings([pick.availabilityRef], availabilitySet, `playlistPlan.${index}.availabilityRef`, "Availability reference"),
      ...uniqueFindings(pick.preferenceRefs, `playlistPlan.${index}.preferenceRefs`, "Preference reference"),
      ...referenceFindings(pick.preferenceRefs, preferenceSet, `playlistPlan.${index}.preferenceRefs`, "Preference reference"),
    );
    const item = itemById.get(pick.itemRef);
    const availability = availabilityById.get(pick.availabilityRef);
    if (availability && availability.itemRef !== pick.itemRef) {
      findings.push(finding("availability_item_mismatch", `playlistPlan.${index}.availabilityRef`, "Playlist availability must belong to the same music item."));
    }
    if (
      pick.state === "recommended" &&
      (!availability ||
        availability.freshness !== "current" ||
        !["owned-local", "included"].includes(availability.accessMode) ||
        !["playable-in-owner-library", "streamable-in-owner-plan"].includes(availability.rightsConstraint))
    ) {
      findings.push(finding("unsupported_recommendation", `playlistPlan.${index}`, "Recommended music requires current owned or included availability under the owner's declared rights."));
    }
    if (pick.state === "recommended" && ["skipped", "disliked", "blocked"].includes(item?.tasteState)) {
      findings.push(finding("taste_state_conflict", `playlistPlan.${index}.itemRef`, "Recommended playlist items cannot conflict with skipped, disliked, or blocked taste state."));
    }
    if (pick.state === "recommended" && item?.explicitState === "explicit") {
      const cleanLimit = pick.preferenceRefs.some((ref) => value.preferences.find((pref) => pref.id === ref)?.kind === "explicit-limit");
      if (cleanLimit) {
        findings.push(finding("explicit_content_conflict", `playlistPlan.${index}.itemRef`, "Recommended items cannot be explicit when the linked owner preference asks for clean versions."));
      }
    }
    if (
      (pick.state === "blocked" && !pick.blockedReason) ||
      (pick.state !== "blocked" && pick.blockedReason !== null)
    ) {
      findings.push(finding("incoherent_blocked_state", `playlistPlan.${index}.blockedReason`, "Only blocked playlist items may carry a blocked reason."));
    }
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.itemRefs, `reviewQuestions.${index}.itemRefs`, "Music item reference"),
      ...referenceFindings(question.itemRefs, itemSet, `reviewQuestions.${index}.itemRefs`, "Music item reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready music library plans cannot depend on stale, missing, or conflicting sources."));
  }
  const accountActionText = canonicalJson({
    playlistPlan: value.playlistPlan.map(({ fitReason, blockedReason }) => ({ fitReason, blockedReason })),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(buy|purchase|subscribe|cancel|publish|post|follow artist|download|message|modify account|bypass|rip|pirate)\b/iu.test(accountActionText)) {
    findings.push(finding("account_action_content", "playlistPlan", "Music organizer artifacts must not instruct purchase, subscription, account, public sharing, download, messaging, or rights-bypass actions."));
  }
  if (value.handoff.owner === "music-organizer") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Music account, purchase, publishing, downloading, messaging, and rights decisions must remain with the named owner."));
  }
  return findings;
}

function stockPortfolioFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const positionIds = value.positions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const positionSet = new Set(positionIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const positionById = new Map(value.positions.map((item) => [item.id, item]));
  const quoteByPosition = new Map(value.quotes.map((item) => [item.positionRef, item]));
  const allocationByPosition = new Map(value.allocations.map((item) => [item.positionRef, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(positionIds, "positions", "Position id"),
    ...uniqueFindings(value.quotes.map((item) => item.positionRef), "quotes", "Quote position reference"),
    ...uniqueFindings(value.allocations.map((item) => item.positionRef), "allocations", "Allocation position reference"),
    ...uniqueFindings(value.issuerEvents.map((item) => item.id), "issuerEvents", "Issuer event id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, position] of value.positions.entries()) {
    findings.push(
      ...referenceFindings([position.positionSourceRef], sourceSet, `positions.${index}.positionSourceRef`, "Source reference"),
    );
    if (!quoteByPosition.has(position.id) || !allocationByPosition.has(position.id)) {
      findings.push(finding("missing_position_valuation", `positions.${index}`, "Every position requires exactly one quote and one allocation."));
    }
    if (position.costBasis.state === "supplied") {
      if (position.costBasis.amount === null || !position.costBasis.currency || !position.costBasis.sourceRef) {
        findings.push(finding("unsupported_cost_basis", `positions.${index}.costBasis`, "Supplied cost basis requires amount, currency, and source evidence."));
      } else {
        findings.push(
          ...referenceFindings([position.costBasis.sourceRef], sourceSet, `positions.${index}.costBasis.sourceRef`, "Source reference"),
        );
      }
    }
    if (
      position.costBasis.state === "not-supplied" &&
      (position.costBasis.amount !== null || position.costBasis.currency !== null || position.costBasis.sourceRef !== null)
    ) {
      findings.push(finding("unsupported_cost_basis", `positions.${index}.costBasis`, "Missing cost basis cannot carry inferred values."));
    }
  }
  for (const [index, quote] of value.quotes.entries()) {
    findings.push(
      ...referenceFindings([quote.positionRef], positionSet, `quotes.${index}.positionRef`, "Position reference"),
      ...referenceFindings([quote.sourceRef], sourceSet, `quotes.${index}.sourceRef`, "Source reference"),
    );
    const source = sourceById.get(quote.sourceRef);
    if (!source || source.kind !== "market-quote" || !["exchange", "market-data-provider"].includes(source.authority)) {
      findings.push(finding("unsupported_quote_source", `quotes.${index}.sourceRef`, "Quotes require market-quote evidence from an exchange or approved market-data provider."));
    }
    if (["stale", "missing", "conflicting"].includes(quote.freshness) || ["stale", "missing", "conflicting"].includes(source?.freshness)) {
      findings.push(finding("stale_market_quote", `quotes.${index}.freshness`, "Ready portfolio monitors require non-stale market quote evidence."));
    }
  }
  for (const [index, allocation] of value.allocations.entries()) {
    findings.push(...referenceFindings([allocation.positionRef], positionSet, `allocations.${index}.positionRef`, "Position reference"));
    const position = positionById.get(allocation.positionRef);
    const quote = quoteByPosition.get(allocation.positionRef);
    if (position && quote) {
      if (quote.currency !== allocation.currency || !numbersEqual(allocation.marketValue, position.quantity * quote.price)) {
        findings.push(finding("allocation_mismatch", `allocations.${index}.marketValue`, "Allocation market value must equal supplied quantity times sourced quote price."));
      }
    }
  }
  const allocationTotal = value.allocations.reduce((total, item) => total + item.allocationPct, 0);
  if (!numbersEqual(allocationTotal, 100)) {
    findings.push(finding("allocation_total_mismatch", "allocations", "Allocation percentages must sum to 100."));
  }
  for (const [index, event] of value.issuerEvents.entries()) {
    findings.push(
      ...referenceFindings([event.positionRef], positionSet, `issuerEvents.${index}.positionRef`, "Position reference"),
      ...uniqueFindings(event.sourceRefs, `issuerEvents.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(event.sourceRefs, sourceSet, `issuerEvents.${index}.sourceRefs`, "Source reference"),
    );
    const supported = event.sourceRefs.every((ref) =>
      ["issuer-filing", "issuer-news", "dividend-calendar"].includes(sourceById.get(ref)?.kind),
    );
    if (!supported) {
      findings.push(finding("unsupported_issuer_event_source", `issuerEvents.${index}.sourceRefs`, "Issuer events require filing, issuer-news, or dividend-calendar sources."));
    }
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }
  const adviceText = canonicalJson({
    issuerEvents: value.issuerEvents.map(({ summary }) => summary),
    reviewQuestions: value.reviewQuestions.map(({ question }) => question),
  });
  if (/\b(buy|sell|hold|trim|accumulate|overweight|underweight|add shares|increase position|reduce position)\b/iu.test(adviceText)) {
    findings.push(finding("portfolio_recommendation", "reviewQuestions", "Portfolio monitor artifacts must not recommend buy, sell, hold, tax, legal, or trading actions."));
  }
  if (value.handoff.owner === "stock-portfolio-monitor") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Trading, broker, tax, legal, and suitability authority must remain with the named owner."));
  }
  return findings;
}

function subscriptionManagerFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const subscriptionIds = value.subscriptions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const subscriptionSet = new Set(subscriptionIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(subscriptionIds, "subscriptions", "Subscription id"),
    ...uniqueFindings(value.renewals.map((item) => item.id), "renewals", "Renewal id"),
    ...uniqueFindings(value.usage.map((item) => item.subscriptionRef), "usage", "Usage subscription reference"),
    ...uniqueFindings(value.overlaps.map((item) => item.id), "overlaps", "Overlap id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, source] of value.sources.entries()) {
    if (source.kind === "bank-feed" || source.authority === "banking-system") {
      findings.push(finding("bank_source_not_allowed", `sources.${index}`, "Subscription Manager artifacts must not depend on connected bank or card feeds."));
    }
  }
  for (const [index, item] of value.subscriptions.entries()) {
    findings.push(
      ...uniqueFindings(item.sourceRefs, `subscriptions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `subscriptions.${index}.sourceRefs`, "Source reference"),
    );
    if (item.amountState === "supplied" && (item.amount === null || item.currency !== value.portfolio.currency)) {
      findings.push(finding("unsupported_amount_state", `subscriptions.${index}.amount`, "Supplied subscription amounts require a value in the portfolio currency."));
    }
    if (item.amountState !== "supplied" && (item.amount !== null || item.currency !== null)) {
      findings.push(finding("unsupported_amount_state", `subscriptions.${index}.amount`, "Missing or conflicting amounts cannot carry inferred values."));
    }
  }
  for (const [index, renewal] of value.renewals.entries()) {
    findings.push(
      ...referenceFindings([renewal.subscriptionRef], subscriptionSet, `renewals.${index}.subscriptionRef`, "Subscription reference"),
      ...uniqueFindings(renewal.sourceRefs, `renewals.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(renewal.sourceRefs, sourceSet, `renewals.${index}.sourceRefs`, "Source reference"),
    );
    if (
      renewal.windowState === "inside-review-window" &&
      renewal.renewsAt &&
      Date.parse(renewal.renewsAt) > Date.parse(value.portfolio.asOf) + value.portfolio.reviewWindowDays * 24 * 60 * 60 * 1000
    ) {
      findings.push(finding("renewal_window_mismatch", `renewals.${index}.renewsAt`, "Inside-window renewals must fall within the declared review window."));
    }
    if (["increase", "decrease"].includes(renewal.priceChange.state)) {
      if (
        renewal.priceChange.previousAmount === null ||
        renewal.priceChange.newAmount === null ||
        renewal.priceChange.currency !== value.portfolio.currency
      ) {
        findings.push(finding("unsupported_price_change", `renewals.${index}.priceChange`, "Price changes require previous and new amounts in the portfolio currency."));
      }
    }
  }
  for (const [collection, path] of [
    [value.usage, "usage"],
    [value.overlaps, "overlaps"],
    [value.reviewQuestions, "reviewQuestions"],
  ]) {
    for (const [index, item] of collection.entries()) {
      const refs = item.subscriptionRefs ?? [item.subscriptionRef];
      findings.push(
        ...uniqueFindings(refs, `${path}.${index}.subscriptionRefs`, "Subscription reference"),
        ...referenceFindings(refs, subscriptionSet, `${path}.${index}.subscriptionRefs`, "Subscription reference"),
        ...uniqueFindings(item.sourceRefs, `${path}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${path}.${index}.sourceRefs`, "Source reference"),
      );
    }
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready subscription ledgers cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    overlaps: value.overlaps.map(({ summary }) => summary),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(cancel|subscribe|downgrade|upgrade|negotiate|contact vendor|change payment|connect bank|financial advice|save money by)\b/iu.test(actionText)) {
    findings.push(finding("account_action_content", "reviewQuestions", "Subscription review artifacts must not recommend account, payment, vendor-contact, or financial-advice actions."));
  }
  if (value.handoff.owner === "subscription-manager") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Subscription, payment, vendor-contact, calendar, and financial decisions must remain with the named owner."));
  }
  return findings;
}

function wardrobeFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const itemIds = value.items.map((item) => item.id);
  const gapIds = value.gaps.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const itemSet = new Set(itemIds);
  const gapSet = new Set(gapIds);
  const questionSet = new Set(questionIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const itemById = new Map(value.items.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(itemIds, "items", "Item id"),
    ...uniqueFindings(value.outfits.map((item) => item.id), "outfits", "Outfit id"),
    ...uniqueFindings(value.careTasks.map((item) => item.id), "careTasks", "Care task id"),
    ...uniqueFindings(value.packingLists.map((item) => item.id), "packingLists", "Packing list id"),
    ...uniqueFindings(gapIds, "gaps", "Gap id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, item] of value.items.entries()) {
    findings.push(
      ...uniqueFindings(item.sourceRefs, `items.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `items.${index}.sourceRefs`, "Source reference"),
    );
    if (item.fitState === "fits" && item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_fit_state", `items.${index}.sourceRefs`, "Fit-ready wardrobe items require current supplied evidence."));
    }
  }
  for (const [index, outfit] of value.outfits.entries()) {
    findings.push(
      ...uniqueFindings(outfit.itemRefs, `outfits.${index}.itemRefs`, "Item reference"),
      ...referenceFindings(outfit.itemRefs, itemSet, `outfits.${index}.itemRefs`, "Item reference"),
      ...uniqueFindings(outfit.sourceRefs, `outfits.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(outfit.sourceRefs, sourceSet, `outfits.${index}.sourceRefs`, "Source reference"),
    );
    if (outfit.state === "ready-for-review") {
      const blockedItems = outfit.itemRefs.filter((ref) => itemById.get(ref)?.careState !== "ready");
      if (blockedItems.length > 0) {
        findings.push(finding("outfit_blocked_by_care", `outfits.${index}.itemRefs`, "Ready-for-review outfits cannot include items with unresolved care, repair, alteration, or unknown state."));
      }
      if (outfit.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
        findings.push(finding("unsupported_outfit_state", `outfits.${index}.sourceRefs`, "Ready-for-review outfits require current source evidence."));
      }
    }
  }
  for (const [collectionName, collection] of [
    ["careTasks", value.careTasks],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.itemRefs, `${collectionName}.${index}.itemRefs`, "Item reference"),
        ...referenceFindings(item.itemRefs, itemSet, `${collectionName}.${index}.itemRefs`, "Item reference"),
        ...uniqueFindings(item.sourceRefs, `${collectionName}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${collectionName}.${index}.sourceRefs`, "Source reference"),
      );
    }
  }
  for (const [index, list] of value.packingLists.entries()) {
    findings.push(
      ...uniqueFindings(list.itemRefs, `packingLists.${index}.itemRefs`, "Item reference"),
      ...referenceFindings(list.itemRefs, itemSet, `packingLists.${index}.itemRefs`, "Item reference"),
      ...uniqueFindings(list.gapRefs, `packingLists.${index}.gapRefs`, "Gap reference"),
      ...referenceFindings(list.gapRefs, gapSet, `packingLists.${index}.gapRefs`, "Gap reference"),
      ...uniqueFindings(list.sourceRefs, `packingLists.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(list.sourceRefs, sourceSet, `packingLists.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, gap] of value.gaps.entries()) {
    findings.push(
      ...uniqueFindings(gap.sourceRefs, `gaps.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(gap.sourceRefs, sourceSet, `gaps.${index}.sourceRefs`, "Source reference"),
    );
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, questionSet, "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready wardrobe plans cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    items: value.items.map(({ name, fitState, careState }) => ({ name, fitState, careState })),
    outfits: value.outfits.map(({ occasion, state }) => ({ occasion, state })),
    gaps: value.gaps.map(({ need, reason }) => ({ need, reason })),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(buy|purchase|sell|resell|donate|return item|list resale|share photo|post publicly|message tailor|message cleaner|book service|schedule pickup|change account|infer body|body shape|body size|weight|health condition|pregnancy|gender identity|medical advice|legal advice)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Wardrobe artifacts must not instruct purchases, sales, donations, returns, resale listings, photo sharing, public posts, messages, bookings, pickups, account changes, body or health inference, or professional advice."));
  }
  if (value.handoff.owner === "wardrobe-organizer") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Wardrobe purchase, resale, donation, photo, account, body-adjacent, care, alteration, and disclosure decisions must remain with the named owner."));
  }
  return findings;
}

function medicalAppointmentFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const appointmentIds = value.appointments.map((item) => item.id);
  const appointmentSet = new Set(appointmentIds);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const questionSet = new Set(questionIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(appointmentIds, "appointments", "Appointment id"),
    ...uniqueFindings(value.concerns.map((item) => item.id), "concerns", "Concern id"),
    ...uniqueFindings(value.medications.map((item) => item.id), "medications", "Medication id"),
    ...uniqueFindings(value.priorInstructions.map((item) => item.id), "priorInstructions", "Prior instruction id"),
    ...uniqueFindings(value.documents.map((item) => item.id), "documents", "Document id"),
    ...uniqueFindings(value.logistics.map((item) => item.id), "logistics", "Logistics id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, appointment] of value.appointments.entries()) {
    findings.push(
      ...uniqueFindings(appointment.sourceRefs, `appointments.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(appointment.sourceRefs, sourceSet, `appointments.${index}.sourceRefs`, "Source reference"),
    );
    if (appointment.preparationState === "ready-for-owner-review" && appointment.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_preparation_state", `appointments.${index}.sourceRefs`, "Ready appointment packets require current source evidence."));
    }
  }
  for (const [collectionName, collection] of [
    ["concerns", value.concerns],
    ["priorInstructions", value.priorInstructions],
    ["documents", value.documents],
    ["logistics", value.logistics],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.appointmentRefs, `${collectionName}.${index}.appointmentRefs`, "Appointment reference"),
        ...referenceFindings(item.appointmentRefs, appointmentSet, `${collectionName}.${index}.appointmentRefs`, "Appointment reference"),
        ...uniqueFindings(item.sourceRefs, `${collectionName}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${collectionName}.${index}.sourceRefs`, "Source reference"),
      );
    }
  }
  for (const [index, med] of value.medications.entries()) {
    findings.push(
      ...uniqueFindings(med.sourceRefs, `medications.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(med.sourceRefs, sourceSet, `medications.${index}.sourceRefs`, "Source reference"),
    );
    if (med.freshness === "current" && med.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_medication_freshness", `medications.${index}.sourceRefs`, "Current medication lists require current source evidence."));
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, questionSet, "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready appointment packets cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    concerns: value.concerns.map(({ label, ownerReported }) => ({ label, ownerReported })),
    priorInstructions: value.priorInstructions.map(({ label }) => label),
    documents: value.documents.map(({ label }) => label),
    logistics: value.logistics.map(({ note }) => note),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(diagnos(?:e|is)|triage|recommend treatment|treatment recommendation|change med(?:ication)?s?|change medication|advise dosage|dosage advice|interpret test results?|decide urgency|urgent decision|emergency determination|schedule appointments?|cancel appointments?|message providers?|contact providers?|submit portal forms?|portal submission|upload records?|pay bills?|file insurance claims?|contact insurers?|billing advice|insurance advice|medical advice|legal advice)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Medical appointment packets must not instruct diagnosis, triage, treatment, medication, scheduling, provider-contact, portal, upload, billing, insurance, legal, or emergency actions."));
  }
  if (value.handoff.owner === "medical-appointment-prep") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Clinical, scheduling, provider-contact, portal, billing, insurance, legal, and emergency authority must remain with the named owner or qualified humans."));
  }
  return findings;
}

function healthRecordsFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const recordIds = value.records.map((item) => item.id);
  const recordSet = new Set(recordIds);
  const timelineIds = value.timeline.map((item) => item.id);
  const medIds = value.medicationReview.map((item) => item.id);
  const packetIds = value.sharingPackets.map((item) => item.id);
  const gapIds = value.gaps.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const crossRefs = new Set([
    ...sourceIds,
    ...recordIds,
    ...timelineIds,
    ...medIds,
    ...packetIds,
    ...gapIds,
    ...questionIds,
  ]);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(recordIds, "records", "Record id"),
    ...uniqueFindings(timelineIds, "timeline", "Timeline id"),
    ...uniqueFindings(medIds, "medicationReview", "Medication review id"),
    ...uniqueFindings(packetIds, "sharingPackets", "Sharing packet id"),
    ...uniqueFindings(gapIds, "gaps", "Gap id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, record] of value.records.entries()) {
    findings.push(
      ...uniqueFindings(record.sourceRefs, `records.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(record.sourceRefs, sourceSet, `records.${index}.sourceRefs`, "Source reference"),
    );
    if (record.dateState === "known" && !record.date) {
      findings.push(finding("missing_record_date", `records.${index}.date`, "Known health record dates must include the supplied date."));
    }
    if (
      record.privacy === "shareable-after-review" &&
      record.sourceRefs.some((ref) => ["owner-only", "dependent-sensitive", "redact-before-sharing"].includes(sourceById.get(ref)?.privacy))
    ) {
      findings.push(finding("unsafe_record_privacy", `records.${index}.privacy`, "Records cannot be marked shareable when any supporting source still requires owner-only, dependent-sensitive, or redaction review."));
    }
  }
  for (const [index, item] of value.timeline.entries()) {
    findings.push(
      ...uniqueFindings(item.recordRefs, `timeline.${index}.recordRefs`, "Record reference"),
      ...referenceFindings(item.recordRefs, recordSet, `timeline.${index}.recordRefs`, "Record reference"),
      ...uniqueFindings(item.sourceRefs, `timeline.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `timeline.${index}.sourceRefs`, "Source reference"),
    );
    if (item.state === "current" && item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_timeline_state", `timeline.${index}.sourceRefs`, "Current timeline items require current source evidence."));
    }
  }
  for (const [index, item] of value.medicationReview.entries()) {
    findings.push(
      ...uniqueFindings(item.recordRefs, `medicationReview.${index}.recordRefs`, "Record reference"),
      ...referenceFindings(item.recordRefs, recordSet, `medicationReview.${index}.recordRefs`, "Record reference"),
      ...uniqueFindings(item.sourceRefs, `medicationReview.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `medicationReview.${index}.sourceRefs`, "Source reference"),
    );
    if (item.freshness === "current" && item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_medication_freshness", `medicationReview.${index}.sourceRefs`, "Current medication review entries require current source evidence."));
    }
  }
  for (const [index, item] of value.sharingPackets.entries()) {
    findings.push(
      ...uniqueFindings(item.recordRefs, `sharingPackets.${index}.recordRefs`, "Record reference"),
      ...referenceFindings(item.recordRefs, recordSet, `sharingPackets.${index}.recordRefs`, "Record reference"),
      ...uniqueFindings(item.sourceRefs, `sharingPackets.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `sharingPackets.${index}.sourceRefs`, "Source reference"),
    );
    if (item.reviewState === "ready-for-owner-review" && item.privacyState !== "owner-approved") {
      findings.push(finding("unapproved_sharing_packet", `sharingPackets.${index}.privacyState`, "Ready sharing packets require explicit owner-approved privacy state."));
    }
    if (
      item.privacyState === "owner-approved" &&
      item.sourceRefs.some((ref) => ["owner-only", "dependent-sensitive", "redact-before-sharing"].includes(sourceById.get(ref)?.privacy))
    ) {
      findings.push(finding("unsafe_sharing_privacy", `sharingPackets.${index}.sourceRefs`, "Sharing packets cannot be owner-approved while any supporting source still requires redaction, owner-only handling, or dependent-sensitive handling."));
    }
  }
  for (const [collectionName, collection] of [
    ["gaps", value.gaps],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.refs, `${collectionName}.${index}.refs`, "Reference"),
        ...referenceFindings(item.refs, crossRefs, `${collectionName}.${index}.refs`, "Reference"),
      );
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, new Set(questionIds), "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting", "sensitive"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready health records binders cannot depend on stale, missing, conflicting, or sensitive sources."));
  }
  const actionText = canonicalJson({
    timeline: value.timeline.map(({ summary }) => summary),
    medicationReview: value.medicationReview.map(({ label, ownerQuestion }) => ({ label, ownerQuestion })),
    sharingPackets: value.sharingPackets.map(({ purpose }) => purpose),
    gaps: value.gaps.map(({ reason }) => reason),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(diagnos(?:e|is)|triage|recommend treatment|treatment recommendation|interpret results?|interpret test results?|change med(?:ication)?s?|change medication|advise dosage|dosage advice|decide urgency|urgent decision|emergency advice|message providers?|contact providers?|submit portal forms?|portal submission|upload records?|share phi|share protected health|schedule appointments?|pay bills?|file insurance claims?|contact insurers?|change accounts?|billing advice|insurance advice|medical advice|legal advice)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Health records binders must not instruct diagnosis, triage, treatment, result interpretation, medication, portal, provider-contact, upload, PHI-sharing, scheduling, billing, insurance, account, legal, or emergency actions."));
  }
  if (value.handoff.owner === "health-records-binder") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Clinical, portal, provider-contact, upload, PHI-sharing, scheduling, billing, insurance, account, legal, and emergency authority must remain with the named owner or qualified humans."));
  }
  return findings;
}

function benefitsEnrollmentFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const windowIds = value.windows.map((item) => item.id);
  const optionIds = value.options.map((item) => item.id);
  const dependentIds = value.dependentRequirements.map((item) => item.id);
  const costIds = value.costNotes.map((item) => item.id);
  const costSet = new Set(costIds);
  const changeIds = value.coverageChanges.map((item) => item.id);
  const changeSet = new Set(changeIds);
  const gapIds = value.gaps.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const crossRefs = new Set([
    ...sourceIds,
    ...windowIds,
    ...optionIds,
    ...dependentIds,
    ...costIds,
    ...changeIds,
    ...gapIds,
    ...questionIds,
  ]);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(windowIds, "windows", "Window id"),
    ...uniqueFindings(optionIds, "options", "Option id"),
    ...uniqueFindings(dependentIds, "dependentRequirements", "Dependent requirement id"),
    ...uniqueFindings(costIds, "costNotes", "Cost note id"),
    ...uniqueFindings(changeIds, "coverageChanges", "Coverage change id"),
    ...uniqueFindings(gapIds, "gaps", "Gap id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, item] of value.windows.entries()) {
    findings.push(
      ...uniqueFindings(item.sourceRefs, `windows.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `windows.${index}.sourceRefs`, "Source reference"),
    );
    if (Date.parse(item.closesAt) <= Date.parse(item.opensAt)) {
      findings.push(finding("invalid_enrollment_window", `windows.${index}.closesAt`, "Enrollment windows must close after they open."));
    }
    if (["open", "closing-soon", "future"].includes(item.state) && item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_window_state", `windows.${index}.sourceRefs`, "Active or future enrollment windows require current source evidence."));
    }
  }
  for (const [index, item] of value.options.entries()) {
    findings.push(
      ...uniqueFindings(item.costRefs, `options.${index}.costRefs`, "Cost reference"),
      ...referenceFindings(item.costRefs, costSet, `options.${index}.costRefs`, "Cost reference"),
      ...uniqueFindings(item.coverageChangeRefs, `options.${index}.coverageChangeRefs`, "Coverage change reference"),
      ...referenceFindings(item.coverageChangeRefs, changeSet, `options.${index}.coverageChangeRefs`, "Coverage change reference"),
      ...uniqueFindings(item.sourceRefs, `options.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `options.${index}.sourceRefs`, "Source reference"),
    );
    if (item.status === "available" && item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_option_status", `options.${index}.sourceRefs`, "Available benefit options require current source evidence."));
    }
  }
  for (const [collectionName, collection] of [
    ["dependentRequirements", value.dependentRequirements],
    ["costNotes", value.costNotes],
    ["coverageChanges", value.coverageChanges],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.sourceRefs, `${collectionName}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${collectionName}.${index}.sourceRefs`, "Source reference"),
      );
      if (
        ["complete", "supplied", "confirmed"].includes(item.state ?? item.amountState) &&
        item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
      ) {
        findings.push(finding("unsupported_ready_item", `${collectionName}.${index}.sourceRefs`, "Complete, supplied, or confirmed benefits items require current source evidence."));
      }
    }
  }
  for (const [collectionName, collection] of [
    ["gaps", value.gaps],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.refs, `${collectionName}.${index}.refs`, "Reference"),
        ...referenceFindings(item.refs, crossRefs, `${collectionName}.${index}.refs`, "Reference"),
      );
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, new Set(questionIds), "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting", "sensitive"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready benefits packets cannot depend on stale, missing, conflicting, or sensitive sources."));
  }
  const actionText = canonicalJson({
    options: value.options.map(({ label, status }) => ({ label, status })),
    dependentRequirements: value.dependentRequirements.map(({ label, state }) => ({ label, state })),
    costNotes: value.costNotes.map(({ label, payrollImpact }) => ({ label, payrollImpact })),
    coverageChanges: value.coverageChanges.map(({ label, state }) => ({ label, state })),
    gaps: value.gaps.map(({ reason }) => reason),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(choose plans?|choose benefits?|recommend coverage|submit elections?|change payroll|enroll dependents?|certify eligibility|file claims?|contact employers?|contact carriers?|pay premiums?|change accounts?|medical advice|legal advice|tax advice|financial advice|insurance advice|employment advice|benefits advice|eligibility advice)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Benefits enrollment artifacts must not instruct plan choice, coverage recommendations, election submission, payroll changes, dependent enrollment, eligibility certification, claims, employer or carrier contact, premium payments, account changes, or professional advice."));
  }
  if (value.handoff.owner === "benefits-open-enrollment-planner") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Benefits election, payroll, dependent, eligibility, claim, contact, payment, account, and professional-advice authority must remain with the named owner."));
  }
  return findings;
}

function certificationRenewalFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const credentialIds = value.credentials.map((item) => item.id);
  const credentialSet = new Set(credentialIds);
  const requirementIds = value.requirements.map((item) => item.id);
  const requirementSet = new Set(requirementIds);
  const evidenceIds = value.evidenceItems.map((item) => item.id);
  const riskIds = value.deadlineRisks.map((item) => item.id);
  const gapIds = value.gaps.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const crossRefs = new Set([
    ...sourceIds,
    ...credentialIds,
    ...requirementIds,
    ...evidenceIds,
    ...riskIds,
    ...gapIds,
    ...questionIds,
  ]);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(credentialIds, "credentials", "Credential id"),
    ...uniqueFindings(requirementIds, "requirements", "Requirement id"),
    ...uniqueFindings(evidenceIds, "evidenceItems", "Evidence id"),
    ...uniqueFindings(riskIds, "deadlineRisks", "Deadline risk id"),
    ...uniqueFindings(gapIds, "gaps", "Gap id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, credential] of value.credentials.entries()) {
    findings.push(
      ...uniqueFindings(credential.sourceRefs, `credentials.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(credential.sourceRefs, sourceSet, `credentials.${index}.sourceRefs`, "Source reference"),
    );
    if (
      credential.status === "current" &&
      credential.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
    ) {
      findings.push(finding("unsupported_credential_state", `credentials.${index}.sourceRefs`, "Current credential status requires current issuer or owner-supplied evidence."));
    }
  }
  for (const [index, requirement] of value.requirements.entries()) {
    findings.push(
      ...referenceFindings([requirement.credentialRef], credentialSet, `requirements.${index}.credentialRef`, "Credential reference"),
      ...uniqueFindings(requirement.sourceRefs, `requirements.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(requirement.sourceRefs, sourceSet, `requirements.${index}.sourceRefs`, "Source reference"),
    );
    if (
      requirement.state === "satisfied" &&
      requirement.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
    ) {
      findings.push(finding("unsupported_requirement_state", `requirements.${index}.sourceRefs`, "Satisfied renewal requirements require current source evidence."));
    }
  }
  for (const [index, item] of value.evidenceItems.entries()) {
    findings.push(
      ...uniqueFindings(item.requirementRefs, `evidenceItems.${index}.requirementRefs`, "Requirement reference"),
      ...referenceFindings(item.requirementRefs, requirementSet, `evidenceItems.${index}.requirementRefs`, "Requirement reference"),
      ...uniqueFindings(item.sourceRefs, `evidenceItems.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `evidenceItems.${index}.sourceRefs`, "Source reference"),
    );
    if (
      item.state === "available" &&
      item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
    ) {
      findings.push(finding("unsupported_evidence_state", `evidenceItems.${index}.sourceRefs`, "Available renewal evidence requires current source evidence."));
    }
  }
  for (const [index, risk] of value.deadlineRisks.entries()) {
    findings.push(
      ...referenceFindings([risk.credentialRef], credentialSet, `deadlineRisks.${index}.credentialRef`, "Credential reference"),
      ...uniqueFindings(risk.sourceRefs, `deadlineRisks.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(risk.sourceRefs, sourceSet, `deadlineRisks.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [collectionName, collection] of [
    ["gaps", value.gaps],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.refs, `${collectionName}.${index}.refs`, "Reference"),
        ...referenceFindings(item.refs, crossRefs, `${collectionName}.${index}.refs`, "Reference"),
      );
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, new Set(questionIds), "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting", "sensitive"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready certification renewal packets cannot depend on stale, missing, conflicting, or sensitive sources."));
  }
  const actionText = canonicalJson({
    credentials: value.credentials.map(({ name, issuer, status }) => ({ name, issuer, status })),
    requirements: value.requirements.map(({ label, state }) => ({ label, state })),
    evidenceItems: value.evidenceItems.map(({ label, state }) => ({ label, state })),
    deadlineRisks: value.deadlineRisks.map(({ reason }) => reason),
    gaps: value.gaps.map(({ reason }) => reason),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(submit renewals?|pay fees?|contact issuers?|change accounts?|schedule exams?|enroll (?:in )?courses?|claim validity|claim compliance|issue certificates?|change employer records?|legal advice|compliance advice|education advice|employment advice|tax advice|immigration advice|financial advice|professional advice)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Certification renewal artifacts must not instruct filing, payment, issuer contact, account changes, exam scheduling, course enrollment, validity or compliance claims, certificate issuance, employer-record changes, or professional advice."));
  }
  if (value.handoff.owner === "certification-renewal-planner") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Renewal, payment, issuer-contact, account, exam, course, validity, compliance, certificate, employer-record, and professional-advice authority must remain with the named owner."));
  }
  return findings;
}

function warrantyReturnsFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const itemIds = value.items.map((item) => item.id);
  const itemSet = new Set(itemIds);
  const returnIds = value.returnWindows.map((item) => item.id);
  const termIds = value.warrantyTerms.map((item) => item.id);
  const issueIds = value.issuePackets.map((item) => item.id);
  const gapIds = value.gaps.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const crossRefs = new Set([
    ...sourceIds,
    ...itemIds,
    ...returnIds,
    ...termIds,
    ...issueIds,
    ...gapIds,
    ...questionIds,
  ]);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(itemIds, "items", "Item id"),
    ...uniqueFindings(returnIds, "returnWindows", "Return window id"),
    ...uniqueFindings(termIds, "warrantyTerms", "Warranty term id"),
    ...uniqueFindings(issueIds, "issuePackets", "Issue packet id"),
    ...uniqueFindings(gapIds, "gaps", "Gap id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, item] of value.items.entries()) {
    findings.push(
      ...uniqueFindings(item.sourceRefs, `items.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `items.${index}.sourceRefs`, "Source reference"),
    );
    if (item.purchaseState === "supported" && item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_purchase_state", `items.${index}.sourceRefs`, "Supported purchase states require current source evidence."));
    }
  }
  for (const [index, item] of value.returnWindows.entries()) {
    findings.push(
      ...referenceFindings([item.itemRef], itemSet, `returnWindows.${index}.itemRef`, "Item reference"),
      ...uniqueFindings(item.sourceRefs, `returnWindows.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `returnWindows.${index}.sourceRefs`, "Source reference"),
    );
    if (Date.parse(item.closesAt) <= Date.parse(item.opensAt)) {
      findings.push(finding("invalid_return_window", `returnWindows.${index}.closesAt`, "Return windows must close after they open."));
    }
    if (["open", "closing-soon"].includes(item.state) && item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_return_state", `returnWindows.${index}.sourceRefs`, "Open return windows require current source evidence."));
    }
  }
  for (const [collectionName, collection] of [
    ["warrantyTerms", value.warrantyTerms],
    ["issuePackets", value.issuePackets],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...referenceFindings([item.itemRef], itemSet, `${collectionName}.${index}.itemRef`, "Item reference"),
        ...uniqueFindings(item.sourceRefs, `${collectionName}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${collectionName}.${index}.sourceRefs`, "Source reference"),
      );
      if (
        ["supported", "ready-for-owner-review"].includes(item.state ?? item.readiness) &&
        item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
      ) {
        findings.push(finding("unsupported_ready_item", `${collectionName}.${index}.sourceRefs`, "Supported warranty terms and ready issue packets require current source evidence."));
      }
    }
  }
  for (const [collectionName, collection] of [
    ["gaps", value.gaps],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.refs, `${collectionName}.${index}.refs`, "Reference"),
        ...referenceFindings(item.refs, crossRefs, `${collectionName}.${index}.refs`, "Reference"),
      );
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, new Set(questionIds), "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting", "sensitive"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready warranty packets cannot depend on stale, missing, conflicting, or sensitive sources."));
  }
  const actionText = canonicalJson({
    items: value.items.map(({ label, purchaseState, serialState, conditionState }) => ({ label, purchaseState, serialState, conditionState })),
    returnWindows: value.returnWindows.map(({ label, state }) => ({ label, state })),
    warrantyTerms: value.warrantyTerms.map(({ label, state }) => ({ label, state })),
    issuePackets: value.issuePackets.map(({ label, readiness }) => ({ label, readiness })),
    gaps: value.gaps.map(({ reason }) => reason),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(initiate returns?|start returns?|file warranty claims?|submit claims?|contact sellers?|contact manufacturers?|contact carriers?|create shipping labels?|request refunds?|dispute charges?|change accounts?|order replacements?|schedule repairs?|sell item|donate item|discard item|dispose|legal advice|financial advice|tax advice|safety advice|repair advice|warranty advice|insurance advice|consumer-rights advice)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Warranty artifacts must not instruct returns, claims, contacts, labels, refunds, chargebacks, account changes, replacements, repairs, disposal, resale, donation, or professional advice."));
  }
  if (value.handoff.owner === "warranty-returns-manager") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Return, warranty, contact, shipping, refund, chargeback, account, replacement, repair, disposal, resale, donation, and professional-advice authority must remain with the named owner."));
  }
  return findings;
}

function documentRenewalFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const documentIds = value.documents.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const documentSet = new Set(documentIds);
  const questionSet = new Set(questionIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(documentIds, "documents", "Document id"),
    ...uniqueFindings(value.renewalWindows.map((item) => item.id), "renewalWindows", "Renewal window id"),
    ...uniqueFindings(value.materials.map((item) => item.id), "materials", "Material id"),
    ...uniqueFindings(value.conflicts.map((item) => item.id), "conflicts", "Conflict id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, doc] of value.documents.entries()) {
    findings.push(
      ...uniqueFindings(doc.sourceRefs, `documents.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(doc.sourceRefs, sourceSet, `documents.${index}.sourceRefs`, "Source reference"),
    );
    if (["current", "renew-soon"].includes(doc.expirationState) && doc.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_expiration_state", `documents.${index}.sourceRefs`, "Current or renew-soon document states require current source evidence."));
    }
  }
  for (const [index, window] of value.renewalWindows.entries()) {
    findings.push(
      ...referenceFindings([window.documentRef], documentSet, `renewalWindows.${index}.documentRef`, "Document reference"),
      ...uniqueFindings(window.sourceRefs, `renewalWindows.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(window.sourceRefs, sourceSet, `renewalWindows.${index}.sourceRefs`, "Source reference"),
    );
    if (Date.parse(window.dueAt) <= Date.parse(window.opensAt)) {
      findings.push(finding("invalid_renewal_window", `renewalWindows.${index}.dueAt`, "Renewal windows must be due after they open."));
    }
    if (["review-soon", "urgent"].includes(window.urgency) && window.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_urgency", `renewalWindows.${index}.sourceRefs`, "Urgent or review-soon renewal windows require current source evidence."));
    }
  }
  for (const [collectionName, collection] of [
    ["materials", value.materials],
    ["conflicts", value.conflicts],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      const refs = item.documentRefs ?? [item.documentRef];
      findings.push(
        ...uniqueFindings(refs, `${collectionName}.${index}.documentRefs`, "Document reference"),
        ...referenceFindings(refs, documentSet, `${collectionName}.${index}.documentRefs`, "Document reference"),
        ...uniqueFindings(item.sourceRefs, `${collectionName}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${collectionName}.${index}.sourceRefs`, "Source reference"),
      );
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, questionSet, "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready renewal ledgers cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    conflicts: value.conflicts.map(({ reason }) => reason),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(file forms?|submit documents?|pay fees?|book appointments?|contact agenc(?:y|ies)|change accounts?|upload documents?|certify eligibility|legal advice|immigration advice|tax advice|medical advice|licensing advice|identity decision)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Document renewal artifacts must not instruct filing, submission, payment, appointment booking, agency contact, uploads, account changes, eligibility certification, or professional advice."));
  }
  if (value.handoff.owner === "document-renewal-tracker") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Renewal, filing, payment, appointment, account, upload, eligibility, legal, immigration, tax, medical, licensing, and identity authority must remain with the named owner."));
  }
  return findings;
}

function jobApplicationFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const applicationIds = value.applications.map((item) => item.id);
  const applicationSet = new Set(applicationIds);
  const materialIds = value.materials.map((item) => item.id);
  const interviewIds = value.interviews.map((item) => item.id);
  const followupIds = value.followUps.map((item) => item.id);
  const offerIds = value.offerQuestions.map((item) => item.id);
  const gapIds = value.gaps.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const crossRefs = new Set([
    ...sourceIds,
    ...applicationIds,
    ...materialIds,
    ...interviewIds,
    ...followupIds,
    ...offerIds,
    ...gapIds,
    ...questionIds,
  ]);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(applicationIds, "applications", "Application id"),
    ...uniqueFindings(materialIds, "materials", "Material id"),
    ...uniqueFindings(interviewIds, "interviews", "Interview id"),
    ...uniqueFindings(followupIds, "followUps", "Follow-up id"),
    ...uniqueFindings(offerIds, "offerQuestions", "Offer question id"),
    ...uniqueFindings(gapIds, "gaps", "Gap id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, application] of value.applications.entries()) {
    findings.push(
      ...uniqueFindings(application.sourceRefs, `applications.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(application.sourceRefs, sourceSet, `applications.${index}.sourceRefs`, "Source reference"),
    );
    if (
      application.status === "ready-for-owner-review" &&
      application.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
    ) {
      findings.push(finding("unsupported_application_state", `applications.${index}.sourceRefs`, "Owner-ready applications require current source evidence."));
    }
  }
  for (const [collectionName, collection] of [
    ["materials", value.materials],
    ["interviews", value.interviews],
    ["followUps", value.followUps],
    ["offerQuestions", value.offerQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...referenceFindings([item.applicationRef], applicationSet, `${collectionName}.${index}.applicationRef`, "Application reference"),
        ...uniqueFindings(item.sourceRefs, `${collectionName}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${collectionName}.${index}.sourceRefs`, "Source reference"),
      );
      if (
        ["supplied", "scheduled-by-owner", "sent-by-owner", "answered-by-owner"].includes(item.state) &&
        item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
      ) {
        findings.push(finding("unsupported_ready_item", `${collectionName}.${index}.sourceRefs`, "Supplied, scheduled, sent, or answered job-search items require current source evidence."));
      }
    }
  }
  for (const [collectionName, collection] of [
    ["gaps", value.gaps],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.refs, `${collectionName}.${index}.refs`, "Reference"),
        ...referenceFindings(item.refs, crossRefs, `${collectionName}.${index}.refs`, "Reference"),
      );
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, new Set(questionIds), "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting", "sensitive"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready job-search packets cannot depend on stale, missing, conflicting, or sensitive sources."));
  }
  const actionText = canonicalJson({
    applications: value.applications.map(({ role, company, status, priority }) => ({ role, company, status, priority })),
    materials: value.materials.map(({ label, state }) => ({ label, state })),
    interviews: value.interviews.map(({ label, state }) => ({ label, state })),
    followUps: value.followUps.map(({ label, state }) => ({ label, state })),
    offerQuestions: value.offerQuestions.map(({ question, state }) => ({ question, state })),
    gaps: value.gaps.map(({ reason }) => reason),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(submit applications?|upload resumes?|message recruiters?|contact employers?|schedule interviews?|cancel interviews?|change accounts?|fabricate|fake credential|accept offers?|reject offers?|negotiate terms?|legal advice|immigration advice|tax advice|financial advice|employment advice|career advice|salary advice|benefits advice|relocation advice)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Job application artifacts must not instruct submissions, uploads, recruiter or employer contact, scheduling, account changes, credential fabrication, offer decisions, negotiation, or professional advice."));
  }
  if (value.handoff.owner === "job-application-tracker") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Application, upload, contact, scheduling, account, credential, offer, negotiation, and professional-advice authority must remain with the named owner."));
  }
  return findings;
}

function resumePortfolioFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const claimIds = value.claims.map((item) => item.id);
  const claimSet = new Set(claimIds);
  const claimById = new Map(value.claims.map((item) => [item.id, item]));
  const materialIds = value.materials.map((item) => item.id);
  const materialSet = new Set(materialIds);
  const fitIds = value.roleFits.map((item) => item.id);
  const redactionIds = value.redactions.map((item) => item.id);
  const gapIds = value.gaps.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const crossRefs = new Set([
    ...sourceIds,
    ...claimIds,
    ...materialIds,
    ...fitIds,
    ...redactionIds,
    ...gapIds,
    ...questionIds,
  ]);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(claimIds, "claims", "Claim id"),
    ...uniqueFindings(materialIds, "materials", "Material id"),
    ...uniqueFindings(fitIds, "roleFits", "Role-fit id"),
    ...uniqueFindings(redactionIds, "redactions", "Redaction id"),
    ...uniqueFindings(gapIds, "gaps", "Gap id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, claim] of value.claims.entries()) {
    findings.push(
      ...uniqueFindings(claim.sourceRefs, `claims.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(claim.sourceRefs, sourceSet, `claims.${index}.sourceRefs`, "Source reference"),
    );
    if (
      claim.state === "supported" &&
      claim.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
    ) {
      findings.push(finding("unsupported_claim_state", `claims.${index}.sourceRefs`, "Supported resume and portfolio claims require current source evidence."));
    }
  }
  for (const [index, material] of value.materials.entries()) {
    findings.push(
      ...uniqueFindings(material.claimRefs, `materials.${index}.claimRefs`, "Claim reference"),
      ...referenceFindings(material.claimRefs, claimSet, `materials.${index}.claimRefs`, "Claim reference"),
      ...uniqueFindings(material.sourceRefs, `materials.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(material.sourceRefs, sourceSet, `materials.${index}.sourceRefs`, "Source reference"),
    );
    if (
      material.state === "ready-for-owner-review" &&
      (material.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current") ||
        material.claimRefs.some((ref) => !["supported", "needs-owner-review"].includes(claimById.get(ref)?.state)))
    ) {
      findings.push(finding("unsupported_material_state", `materials.${index}`, "Owner-ready career materials require current sources and supported or owner-review claims."));
    }
  }
  for (const [index, fit] of value.roleFits.entries()) {
    findings.push(
      ...uniqueFindings(fit.claimRefs, `roleFits.${index}.claimRefs`, "Claim reference"),
      ...referenceFindings(fit.claimRefs, claimSet, `roleFits.${index}.claimRefs`, "Claim reference"),
      ...uniqueFindings(fit.materialRefs, `roleFits.${index}.materialRefs`, "Material reference"),
      ...referenceFindings(fit.materialRefs, materialSet, `roleFits.${index}.materialRefs`, "Material reference"),
    );
    if (
      fit.state === "supported" &&
      fit.claimRefs.some((ref) => claimById.get(ref)?.state !== "supported")
    ) {
      findings.push(finding("unsupported_role_fit", `roleFits.${index}.claimRefs`, "Supported role-fit statements require supported claims."));
    }
  }
  for (const [collectionName, collection] of [
    ["redactions", value.redactions],
    ["gaps", value.gaps],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.refs, `${collectionName}.${index}.refs`, "Reference"),
        ...referenceFindings(item.refs, crossRefs, `${collectionName}.${index}.refs`, "Reference"),
      );
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, new Set(questionIds), "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting", "sensitive"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready resume portfolio packets cannot depend on stale, missing, conflicting, or sensitive sources."));
  }
  const actionText = canonicalJson({
    claims: value.claims.map(({ kind, claim, state }) => ({ kind, claim, state })),
    materials: value.materials.map(({ label, state }) => ({ label, state })),
    roleFits: value.roleFits.map(({ roleNeed, fit, state }) => ({ roleNeed, fit, state })),
    redactions: value.redactions.map(({ reason, state }) => ({ reason, state })),
    gaps: value.gaps.map(({ reason }) => reason),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(submit applications?|upload files?|publish profiles?|update portfolios?|message recruiters?|contact employers?|change accounts?|fabricate|invent metrics?|alter employment dates?|claim degrees?|claim awards?|claim publications?|legal advice|immigration advice|tax advice|compensation advice|career advice|employment advice)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Resume portfolio artifacts must not instruct submissions, uploads, publication, profile or portfolio updates, recruiter or employer contact, account changes, credential fabrication, invented metrics, altered dates, unsupported claims, or professional advice."));
  }
  if (value.handoff.owner === "resume-portfolio-curator") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Application, upload, publication, profile, portfolio, contact, account, credential, metrics, employment-date, and professional-advice authority must remain with the named owner."));
  }
  return findings;
}

function travelLoyaltyFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const programIds = value.programs.map((item) => item.id);
  const programSet = new Set(programIds);
  const balanceIds = value.balances.map((item) => item.id);
  const balanceSet = new Set(balanceIds);
  const certificateIds = value.certificates.map((item) => item.id);
  const benefitIds = value.benefits.map((item) => item.id);
  const tripIds = value.tripGoals.map((item) => item.id);
  const tripSet = new Set(tripIds);
  const candidateIds = value.redemptionCandidates.map((item) => item.id);
  const gapIds = value.gaps.map((item) => item.id);
  const gapSet = new Set(gapIds);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const crossRefs = new Set([
    ...sourceIds,
    ...programIds,
    ...balanceIds,
    ...certificateIds,
    ...benefitIds,
    ...tripIds,
    ...candidateIds,
    ...gapIds,
    ...questionIds,
  ]);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(programIds, "programs", "Program id"),
    ...uniqueFindings(balanceIds, "balances", "Balance id"),
    ...uniqueFindings(certificateIds, "certificates", "Certificate id"),
    ...uniqueFindings(benefitIds, "benefits", "Benefit id"),
    ...uniqueFindings(tripIds, "tripGoals", "Trip goal id"),
    ...uniqueFindings(candidateIds, "redemptionCandidates", "Redemption candidate id"),
    ...uniqueFindings(gapIds, "gaps", "Gap id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, program] of value.programs.entries()) {
    findings.push(
      ...uniqueFindings(program.sourceRefs, `programs.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(program.sourceRefs, sourceSet, `programs.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, balance] of value.balances.entries()) {
    findings.push(
      ...referenceFindings([balance.programRef], programSet, `balances.${index}.programRef`, "Program reference"),
      ...uniqueFindings(balance.sourceRefs, `balances.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(balance.sourceRefs, sourceSet, `balances.${index}.sourceRefs`, "Source reference"),
    );
    if (balance.state === "current" && balance.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_balance_state", `balances.${index}.sourceRefs`, "Current loyalty balances require current source evidence."));
    }
  }
  for (const [collectionName, collection] of [
    ["certificates", value.certificates],
    ["benefits", value.benefits],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...referenceFindings([item.programRef], programSet, `${collectionName}.${index}.programRef`, "Program reference"),
        ...uniqueFindings(item.sourceRefs, `${collectionName}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${collectionName}.${index}.sourceRefs`, "Source reference"),
      );
      if (
        ["usable-after-owner-review", "supported"].includes(item.state) &&
        item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
      ) {
        findings.push(finding("unsupported_ready_item", `${collectionName}.${index}.sourceRefs`, "Usable certificates and supported benefits require current source evidence."));
      }
    }
  }
  for (const [index, trip] of value.tripGoals.entries()) {
    findings.push(
      ...uniqueFindings(trip.sourceRefs, `tripGoals.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(trip.sourceRefs, sourceSet, `tripGoals.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, candidate] of value.redemptionCandidates.entries()) {
    findings.push(
      ...referenceFindings([candidate.tripRef], tripSet, `redemptionCandidates.${index}.tripRef`, "Trip reference"),
      ...referenceFindings([candidate.programRef], programSet, `redemptionCandidates.${index}.programRef`, "Program reference"),
      ...uniqueFindings(candidate.balanceRefs, `redemptionCandidates.${index}.balanceRefs`, "Balance reference"),
      ...referenceFindings(candidate.balanceRefs, balanceSet, `redemptionCandidates.${index}.balanceRefs`, "Balance reference"),
      ...uniqueFindings(candidate.riskRefs, `redemptionCandidates.${index}.riskRefs`, "Gap reference"),
      ...referenceFindings(candidate.riskRefs, gapSet, `redemptionCandidates.${index}.riskRefs`, "Gap reference"),
      ...uniqueFindings(candidate.sourceRefs, `redemptionCandidates.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(candidate.sourceRefs, sourceSet, `redemptionCandidates.${index}.sourceRefs`, "Source reference"),
    );
    if (
      candidate.state === "review-candidate" &&
      candidate.sourceRefs.some((ref) => !["current"].includes(sourceById.get(ref)?.freshness))
    ) {
      findings.push(finding("unsupported_redemption_candidate", `redemptionCandidates.${index}.sourceRefs`, "Reviewable redemption candidates require current source evidence."));
    }
  }
  for (const [collectionName, collection] of [
    ["gaps", value.gaps],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.refs, `${collectionName}.${index}.refs`, "Reference"),
        ...referenceFindings(item.refs, crossRefs, `${collectionName}.${index}.refs`, "Reference"),
      );
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, new Set(questionIds), "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting", "sensitive"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready loyalty packets cannot depend on stale, missing, conflicting, or sensitive sources."));
  }
  const actionText = canonicalJson({
    programs: value.programs.map(({ name, accountLabel }) => ({ name, accountLabel })),
    balances: value.balances.map(({ state }) => state),
    certificates: value.certificates.map(({ label, state }) => ({ label, state })),
    benefits: value.benefits.map(({ label, state }) => ({ label, state })),
    redemptionCandidates: value.redemptionCandidates.map(({ label, state }) => ({ label, state })),
    gaps: value.gaps.map(({ reason }) => reason),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(book travel|redeem awards?|transfer points?|buy points?|buy miles?|apply certificates?|change accounts?|pay fees?|contact providers?|alter itinerar(?:y|ies)|assign cash value|tax advice|legal advice|financial advice|credit-card advice|travel advice|immigration advice|insurance advice|loyalty-program advice)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Travel loyalty artifacts must not instruct booking, redemption, transfers, point purchases, certificate use, payments, provider contact, account changes, itinerary changes, cash valuation, or professional advice."));
  }
  if (value.handoff.owner === "travel-loyalty-points-organizer") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Booking, redemption, transfer, purchase, payment, provider-contact, account, itinerary, cash-value, and professional-advice authority must remain with the named owner."));
  }
  return findings;
}

function professionalNetworkingFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const contactIds = value.contacts.map((item) => item.id);
  const contactSet = new Set(contactIds);
  const interactionIds = value.interactions.map((item) => item.id);
  const followupIds = value.followUps.map((item) => item.id);
  const introIds = value.introductions.map((item) => item.id);
  const reminderIds = value.reminders.map((item) => item.id);
  const gapIds = value.gaps.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const crossRefs = new Set([
    ...sourceIds,
    ...contactIds,
    ...interactionIds,
    ...followupIds,
    ...introIds,
    ...reminderIds,
    ...gapIds,
    ...questionIds,
  ]);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(contactIds, "contacts", "Contact id"),
    ...uniqueFindings(interactionIds, "interactions", "Interaction id"),
    ...uniqueFindings(followupIds, "followUps", "Follow-up id"),
    ...uniqueFindings(introIds, "introductions", "Introduction id"),
    ...uniqueFindings(reminderIds, "reminders", "Reminder id"),
    ...uniqueFindings(gapIds, "gaps", "Gap id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, contact] of value.contacts.entries()) {
    findings.push(
      ...uniqueFindings(contact.sourceRefs, `contacts.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(contact.sourceRefs, sourceSet, `contacts.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, interaction] of value.interactions.entries()) {
    findings.push(
      ...uniqueFindings(interaction.contactRefs, `interactions.${index}.contactRefs`, "Contact reference"),
      ...referenceFindings(interaction.contactRefs, contactSet, `interactions.${index}.contactRefs`, "Contact reference"),
      ...uniqueFindings(interaction.sourceRefs, `interactions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(interaction.sourceRefs, sourceSet, `interactions.${index}.sourceRefs`, "Source reference"),
    );
    if (interaction.state === "current" && interaction.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_interaction_state", `interactions.${index}.sourceRefs`, "Current networking interactions require current source evidence."));
    }
  }
  for (const [collectionName, collection] of [
    ["followUps", value.followUps],
    ["reminders", value.reminders],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...referenceFindings([item.contactRef], contactSet, `${collectionName}.${index}.contactRef`, "Contact reference"),
        ...uniqueFindings(item.sourceRefs, `${collectionName}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${collectionName}.${index}.sourceRefs`, "Source reference"),
      );
      if (
        ["sent-by-owner", "completed-by-owner"].includes(item.state) &&
        item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
      ) {
        findings.push(finding("unsupported_completed_item", `${collectionName}.${index}.sourceRefs`, "Sent or completed networking items require current source evidence."));
      }
    }
  }
  for (const [index, intro] of value.introductions.entries()) {
    findings.push(
      ...uniqueFindings(intro.contactRefs, `introductions.${index}.contactRefs`, "Contact reference"),
      ...referenceFindings(intro.contactRefs, contactSet, `introductions.${index}.contactRefs`, "Contact reference"),
      ...uniqueFindings(intro.sourceRefs, `introductions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(intro.sourceRefs, sourceSet, `introductions.${index}.sourceRefs`, "Source reference"),
    );
    if (
      intro.state === "needs-owner-review" &&
      intro.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
    ) {
      findings.push(finding("unsupported_introduction_state", `introductions.${index}.sourceRefs`, "Owner-review introductions require current consent evidence."));
    }
  }
  for (const [collectionName, collection] of [
    ["gaps", value.gaps],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.refs, `${collectionName}.${index}.refs`, "Reference"),
        ...referenceFindings(item.refs, crossRefs, `${collectionName}.${index}.refs`, "Reference"),
      );
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, new Set(questionIds), "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting", "sensitive"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready networking packets cannot depend on stale, missing, conflicting, or sensitive sources."));
  }
  const actionText = canonicalJson({
    contacts: value.contacts.map(({ name, organization, relationship }) => ({ name, organization, relationship })),
    interactions: value.interactions.map(({ label, state }) => ({ label, state })),
    followUps: value.followUps.map(({ label, state }) => ({ label, state })),
    introductions: value.introductions.map(({ label, state }) => ({ label, state })),
    reminders: value.reminders.map(({ label, state }) => ({ label, state })),
    gaps: value.gaps.map(({ reason }) => reason),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(send messages?|make introductions?|schedule meetings?|cancel meetings?|commit referrals?|contact employers?|contact prospects?|change accounts?|scrape contacts?|update crm|recruiting actions?|sales outreach|career advice|legal advice|financial advice|employment advice|compensation advice|immigration advice|privacy advice|relationship advice)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Networking artifacts must not instruct outbound messages, introductions, scheduling, scraping, account changes, referral commitments, recruiting actions, sales outreach, or professional advice."));
  }
  if (value.handoff.owner === "professional-networking-followup") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Messaging, introduction, scheduling, scraping, CRM, account, referral, recruiting, sales, and professional-advice authority must remain with the named owner."));
  }
  return findings;
}

const validators = {
  "appliance-care-coordinator": applianceCareFindings,
  "benefits-open-enrollment-planner": benefitsEnrollmentFindings,
  "care-circle-coordinator": careCircleFindings,
  "case-continuity-coordinator": caseContinuityFindings,
  "certification-renewal-planner": certificationRenewalFindings,
  "change-control-operator": changeControlFindings,
  "child-activity-manager": childActivityFindings,
  "civic-data-analyst": civicDataFindings,
  "data-analyst": dataAnalysisFindings,
  "delegation-coordinator": delegationFindings,
  "document-renewal-tracker": documentRenewalFindings,
  "financial-analyst": financialAnalysisFindings,
  "fantasy-sports-manager": fantasySportsFindings,
  "games-backlog-manager": gamesBacklogFindings,
  "gift-relationship-manager": giftRelationshipFindings,
  "green-thumb-coordinator": greenThumbFindings,
  "health-records-binder": healthRecordsFindings,
  "home-repair-coordinator": homeRepairFindings,
  "household-budget-steward": householdBudgetFindings,
  "home-inventory-binder": homeInventoryFindings,
  "household-steward": householdStewardFindings,
  "insurance-policy-organizer": insurancePolicyFindings,
  "job-application-tracker": jobApplicationFindings,
  "life-timeline-keeper": lifeTimelineFindings,
  "local-events-watcher": localEventsFindings,
  "meal-grocery-planner": mealGroceryFindings,
  "medical-appointment-prep": medicalAppointmentFindings,
  "model-evaluation-adjudicator": modelEvaluationFindings,
  "movie-streaming-organizer": movieStreamingFindings,
  "music-organizer": musicOrganizerFindings,
  "neighborhood-operations-watcher": neighborhoodOperationsFindings,
  "personal-archive-curator": personalArchiveFindings,
  "pet-care-coordinator": petCareFindings,
  "pond-water-feature-coordinator": pondWaterFeatureFindings,
  "professional-networking-followup": professionalNetworkingFindings,
  "resume-portfolio-curator": resumePortfolioFindings,
  "project-manager": projectFindings,
  "product-manager": productFindings,
  "purchase-researcher": purchaseResearchFindings,
  "public-safety-monitor": publicSafetyFindings,
  "recruiting-coordinator": recruitingFindings,
  "restaurant-venue-scout": restaurantVenueFindings,
  "research-briefing": researchFindings,
  "sales-operations": salesOperationsFindings,
  "school-coordinator": schoolCoordinatorFindings,
  "sports-team-watcher": sportsTeamWatchFindings,
  "stock-portfolio-monitor": stockPortfolioFindings,
  "subscription-manager": subscriptionManagerFindings,
  "tax-document-organizer": taxDocumentFindings,
  "travel-loyalty-points-organizer": travelLoyaltyFindings,
  "vehicle-service-coordinator": vehicleServiceFindings,
  "wardrobe-organizer": wardrobeFindings,
  "warranty-returns-manager": warrantyReturnsFindings,
  "work-chief-of-staff": workChiefOfStaffFindings,
};

export function validateArtifactSemantics(id, value) {
  const validate = validators[id];
  if (!validate) {
    throw new Error(`No semantic artifact validator is registered for ${id}.`);
  }
  return validate(value);
}
