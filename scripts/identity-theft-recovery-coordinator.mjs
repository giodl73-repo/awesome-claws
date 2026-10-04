function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rows(value) {
  return Array.isArray(value) ? value : [];
}

function finding(code, path, message) {
  return { code, path, message };
}

function indexById(value) {
  return new Map(
    rows(value)
      .filter((row) => isRecord(row) && typeof row.id === "string")
      .map((row) => [row.id, row]),
  );
}

function sameSet(left, right) {
  const a = rows(left);
  const b = rows(right);
  return (
    a.length === b.length &&
    new Set(a).size === a.length &&
    a.every((id) => b.includes(id))
  );
}

function exactInstant(value) {
  if (typeof value !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/u.test(value)) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function requireRef(index, ref, path, code, findings) {
  const target = index.get(ref);
  if (!target) findings.push(finding(code, path, `Unknown reference ${String(ref)}.`));
  return target;
}

function refs(index, values, path, code, findings) {
  for (const ref of rows(values)) requireRef(index, ref, path, code, findings);
}

function checkUniqueIds(collections, findings) {
  const seen = new Set();
  for (const [name, collection] of Object.entries(collections)) {
    for (const [position, row] of rows(collection).entries()) {
      if (!isRecord(row) || typeof row.id !== "string") continue;
      if (seen.has(row.id)) {
        findings.push(finding("duplicate_identity", `${name}/${position}/id`, `Duplicate id ${row.id}.`));
      }
      seen.add(row.id);
    }
  }
}

function secretLike(value) {
  if (typeof value !== "string") return false;
  return (
    /\b\d{3}-\d{2}-\d{4}\b/u.test(value) ||
    /\b(?:\d[ -]*?){12,19}\b/u.test(value) ||
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu.test(value) ||
    /(?:password|passcode|security-answer|recovery-code|bearer|api[-_]?key|secret)[=:]/iu.test(value)
  );
}

export function identityTheftRecoveryFindings(value) {
  const findings = [];
  if (!isRecord(value)) {
    return [finding("invalid_recovery_ledger", "", "Identity recovery ledger must be an object.")];
  }

  const caseRecord = isRecord(value.case) ? value.case : {};
  const review = isRecord(value.review) ? value.review : {};
  const prohibited = isRecord(value.prohibitedActions) ? value.prohibitedActions : {};
  const authorities = indexById(value.authorities);
  const sources = indexById(value.sources);
  const events = indexById(value.events);
  const surfaces = indexById(value.surfaces);
  const routes = indexById(value.routes);
  const actions = indexById(value.actions);
  const reports = indexById(value.reports);
  const disputes = indexById(value.disputes);
  const decisions = indexById(value.decisions);
  const gaps = indexById(value.gaps);
  const allIds = new Set([
    caseRecord.id,
    ...authorities.keys(),
    ...sources.keys(),
    ...events.keys(),
    ...surfaces.keys(),
    ...routes.keys(),
    ...actions.keys(),
    ...reports.keys(),
    ...disputes.keys(),
    ...decisions.keys(),
    ...gaps.keys(),
  ]);

  if (value.schemaVersion !== "awesomeClaws.identityTheftRecovery.v1") {
    findings.push(finding("invalid_schema_version", "schemaVersion", "Unexpected identity recovery schema version."));
  }

  checkUniqueIds(
    {
      cases: [caseRecord],
      authorities: value.authorities,
      sources: value.sources,
      events: value.events,
      surfaces: value.surfaces,
      routes: value.routes,
      actions: value.actions,
      reports: value.reports,
      disputes: value.disputes,
      decisions: value.decisions,
      gaps: value.gaps,
    },
    findings,
  );

  const exactCaseIndexes = [
    ["eventRefs", events],
    ["surfaceRefs", surfaces],
    ["routeRefs", routes],
    ["actionRefs", actions],
    ["reportRefs", reports],
    ["disputeRefs", disputes],
    ["decisionRefs", decisions],
    ["gapRefs", gaps],
  ];
  for (const [field, index] of exactCaseIndexes) {
    if (!sameSet(caseRecord[field], [...index.keys()])) {
      findings.push(finding("incomplete_case_index", `case/${field}`, `${field} must exactly index its case collection.`));
    }
  }

  const owner = authorities.get(caseRecord.ownerAuthorityRef);
  if (!owner || owner.kind !== "case-owner") {
    findings.push(finding("invalid_case_owner", "case/ownerAuthorityRef", "The case owner must reference a case-owner authority."));
  }
  for (const ref of rows(caseRecord.authorizedHelperRefs)) {
    const helper = requireRef(authorities, ref, "case/authorizedHelperRefs", "unknown_authority", findings);
    if (helper?.kind !== "authorized-helper") {
      findings.push(finding("invalid_helper_authority", "case/authorizedHelperRefs", "Every case helper must be an authorized-helper authority."));
    }
  }
  const declaredHelpers = [...authorities.values()]
    .filter((authority) => authority.kind === "authorized-helper")
    .map((authority) => authority.id);
  if (!sameSet(caseRecord.authorizedHelperRefs, declaredHelpers)) {
    findings.push(finding("incomplete_helper_index", "case/authorizedHelperRefs", "The case helper index must exactly cover every authorized-helper authority."));
  }

  const asOf = exactInstant(caseRecord.asOf);
  if (asOf === null || review.asOf !== caseRecord.asOf) {
    findings.push(finding("invalid_review_boundary", "review/asOf", "Review time must equal the exact zone-bearing case as-of time."));
  }
  if (review.nextRevision !== caseRecord.revision + 1) {
    findings.push(finding("invalid_revision_lineage", "review/nextRevision", "The next revision must increment the case revision by one."));
  }
  if (caseRecord.revision === 1 ? caseRecord.previousRevisionRef !== null : caseRecord.previousRevisionRef === null) {
    findings.push(finding("invalid_revision_lineage", "case/previousRevisionRef", "Only revision one may omit its predecessor reference."));
  }
  if (review.nextOwnerAuthorityRef !== caseRecord.ownerAuthorityRef) {
    findings.push(finding("invalid_next_owner", "review/nextOwnerAuthorityRef", "The recovery handoff must return to the accountable case owner."));
  }

  const ownerSourceKinds = new Set(["owner-observation", "owner-action-note"]);
  const institutionSourceKinds = new Set(["institution-notice", "official-recovery-guidance", "independent-receipt", "institution-decision"]);
  const permittedSourceSubjects = new Map([
    ["owner-observation", new Set([...events.keys(), ...surfaces.keys()])],
    ["owner-action-note", new Set(actions.keys())],
    ["helper-authorization", new Set(declaredHelpers)],
    ["institution-notice", new Set([...events.keys(), ...surfaces.keys()])],
    ["official-recovery-guidance", new Set(routes.keys())],
    ["independent-receipt", new Set([...actions.keys(), ...reports.keys(), ...disputes.keys()])],
    ["institution-decision", new Set(decisions.keys())],
    ["qualified-guidance", new Set([...routes.keys(), ...gaps.keys()])],
  ]);
  for (const [id, source] of sources) {
    const publishedAt = exactInstant(source.publishedAt);
    const retrievedAt = exactInstant(source.retrievedAt);
    if (publishedAt === null || retrievedAt === null || publishedAt > retrievedAt || asOf === null || retrievedAt > asOf) {
      findings.push(finding("invalid_source_chronology", `sources/${id}`, "Source publication and retrieval must be exact, ordered, and no later than the case as-of time."));
    }
    const issuer = requireRef(authorities, source.issuerAuthorityRef, `sources/${id}/issuerAuthorityRef`, "unknown_authority", findings);
    if (ownerSourceKinds.has(source.kind) && ![caseRecord.ownerAuthorityRef, ...rows(caseRecord.authorizedHelperRefs)].includes(source.issuerAuthorityRef)) {
      findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Owner observations and action notes must be issued by the case owner or an explicitly authorized helper."));
    } else if (source.kind === "helper-authorization" && source.issuerAuthorityRef !== caseRecord.ownerAuthorityRef) {
      findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Helper authorization must be issued by the case owner."));
    } else if (institutionSourceKinds.has(source.kind) && issuer?.kind !== "institution") {
      findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Institution notices, official routes, receipts, and decisions require an institution issuer."));
    } else if (source.kind === "qualified-guidance" && issuer?.kind !== "qualified-professional") {
      findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Qualified guidance requires its qualified professional issuer."));
    }
    if (!rows(caseRecord.jurisdictions).includes(source.jurisdiction)) {
      findings.push(finding("invalid_source_jurisdiction", `sources/${id}/jurisdiction`, "Every source must remain bound to a declared case jurisdiction."));
    }
    if (!permittedSourceSubjects.get(source.kind)?.has(source.subjectRef)) {
      findings.push(finding("invalid_source_subject", `sources/${id}/subjectRef`, "The source subject must resolve to the modeled record type supported by its source kind."));
    }
    if (source.redaction !== "minimized-reference-only" || source.containsSecrets !== false || secretLike(source.controlledRef)) {
      findings.push(finding("secret_bearing_source", `sources/${id}`, "Sources must use minimized controlled references and contain no secret-bearing values."));
    }
  }

  const assertionKinds = new Map([
    ["owner-reported", new Set(["owner-observation", "owner-action-note"])],
    ["institution-confirmed-fact", new Set(["institution-notice", "institution-decision"])],
    ["official-instruction", new Set(["official-recovery-guidance", "qualified-guidance"])],
    ["independently-receipted-outcome", new Set(["independent-receipt"])],
  ]);
  for (const [id, event] of events) {
    const occurredAt = exactInstant(event.occurredAt);
    if (occurredAt === null || asOf === null || occurredAt > asOf) {
      findings.push(finding("invalid_event_chronology", `events/${id}/occurredAt`, "Events must occur no later than the case as-of time."));
    }
    refs(surfaces, event.surfaceRefs, `events/${id}/surfaceRefs`, "unknown_surface", findings);
    refs(sources, event.sourceRefs, `events/${id}/sourceRefs`, "unknown_source", findings);
    const permitted = assertionKinds.get(event.assertionState) ?? new Set();
    if (!rows(event.sourceRefs).some((ref) => permitted.has(sources.get(ref)?.kind))) {
      findings.push(finding("invalid_assertion_evidence", `events/${id}/sourceRefs`, "The event assertion state requires evidence of the matching authority class."));
    }
    if (event.fraudDetermination !== false) {
      findings.push(finding("fraud_determination_claim", `events/${id}/fraudDetermination`, "Events cannot determine fraud."));
    }
  }

  for (const [id, surface] of surfaces) {
    const institution = requireRef(authorities, surface.institutionAuthorityRef, `surfaces/${id}/institutionAuthorityRef`, "unknown_authority", findings);
    if (institution?.kind !== "institution") {
      findings.push(finding("invalid_surface_authority", `surfaces/${id}/institutionAuthorityRef`, "An identity surface must name its authoritative institution."));
    }
    if (secretLike(surface.redactedIdentifier) || /\d{6,}/u.test(String(surface.redactedIdentifier))) {
      findings.push(finding("secret_bearing_identifier", `surfaces/${id}/redactedIdentifier`, "Identity surfaces must retain only a safely redacted identifier."));
    }
    refs(sources, surface.sourceRefs, `surfaces/${id}/sourceRefs`, "unknown_source", findings);
    const reciprocal = [
      ["eventRefs", events, (row) => rows(row.surfaceRefs).includes(id)],
      ["routeRefs", routes, (row) => rows(row.surfaceRefs).includes(id)],
      ["actionRefs", actions, (row) => rows(row.surfaceRefs).includes(id)],
      ["reportRefs", reports, (row) => rows(row.surfaceRefs).includes(id)],
      ["disputeRefs", disputes, (row) => rows(row.surfaceRefs).includes(id)],
      ["decisionRefs", decisions, (row) => rows(row.surfaceRefs).includes(id)],
      ["gapRefs", gaps, (row) => rows(row.surfaceRefs).includes(id)],
    ];
    for (const [field, index, predicate] of reciprocal) {
      const expected = [...index.values()].filter(predicate).map((row) => row.id);
      if (!sameSet(surface[field], expected)) {
        findings.push(finding("incomplete_surface_index", `surfaces/${id}/${field}`, `${field} must be reciprocal and complete.`));
      }
    }
    if (surface.state === "institution-confirmed-impact" && !rows(surface.decisionRefs).some((ref) => decisions.get(ref)?.status === "institution-confirmed-impact")) {
      findings.push(finding("unsupported_surface_state", `surfaces/${id}/state`, "Institution-confirmed impact requires a matching institution decision."));
    }
  }

  for (const [id, route] of routes) {
    refs(surfaces, route.surfaceRefs, `routes/${id}/surfaceRefs`, "unknown_surface", findings);
    refs(actions, route.ownerActionRefs, `routes/${id}/ownerActionRefs`, "unknown_action", findings);
    const source = requireRef(sources, route.officialSourceRef, `routes/${id}/officialSourceRef`, "unknown_source", findings);
    if (!source || !["official-recovery-guidance", "qualified-guidance"].includes(source.kind) || source.subjectRef !== id) {
      findings.push(finding("invalid_route_authority", `routes/${id}/officialSourceRef`, "A route requires official or qualified guidance issued for that route."));
    }
    if (source && (source.jurisdiction !== route.jurisdiction || source.revision !== route.revision)) {
      findings.push(finding("invalid_route_binding", `routes/${id}`, "Route jurisdiction and revision must exactly match its authoritative source."));
    }
    if (route.status === "current" && source?.freshness !== "current") {
      findings.push(finding("stale_current_route", `routes/${id}/status`, "A current route requires current authoritative guidance."));
    }
    const boundActions = [...actions.values()].filter((row) => row.routeRef === id).map((row) => row.id);
    if (!sameSet(route.ownerActionRefs, boundActions)) {
      findings.push(finding("incomplete_route_index", `routes/${id}/ownerActionRefs`, "Route actions must be reciprocal and complete."));
    }
    if (route.deadlineAt !== null && exactInstant(route.deadlineAt) === null) {
      findings.push(finding("invalid_route_deadline", `routes/${id}/deadlineAt`, "Route deadlines must be exact zone-bearing instants."));
    }
    if (route.deadlineAt !== null && source && exactInstant(route.deadlineAt) < exactInstant(source.publishedAt)) {
      findings.push(finding("invalid_route_deadline", `routes/${id}/deadlineAt`, "A route deadline cannot predate the authoritative route publication."));
    }
    if (route.externalExecution !== "owner-only") {
      findings.push(finding("external_authority_claim", `routes/${id}/externalExecution`, "Recovery routes remain owner-executed."));
    }
  }

  const permittedOwners = new Set([caseRecord.ownerAuthorityRef, ...rows(caseRecord.authorizedHelperRefs)]);
  for (const [id, action] of actions) {
    const route = requireRef(routes, action.routeRef, `actions/${id}/routeRef`, "unknown_route", findings);
    refs(surfaces, action.surfaceRefs, `actions/${id}/surfaceRefs`, "unknown_surface", findings);
    refs(sources, action.sourceRefs, `actions/${id}/sourceRefs`, "unknown_source", findings);
    if (!route || !rows(route.ownerActionRefs).includes(id) || rows(action.surfaceRefs).some((ref) => !rows(route.surfaceRefs).includes(ref))) {
      findings.push(finding("invalid_action_route", `actions/${id}/routeRef`, "Actions must be reciprocally indexed by a route covering the same surfaces."));
    }
    if (!permittedOwners.has(action.ownerAuthorityRef)) {
      findings.push(finding("invalid_action_owner", `actions/${id}/ownerAuthorityRef`, "Actions remain with the case owner or an explicitly authorized helper."));
    }
    const attemptedAt = action.attemptedAt === null ? null : exactInstant(action.attemptedAt);
    if (["attempted", "failed", "owner-completed"].includes(action.state) && (attemptedAt === null || asOf === null || attemptedAt > asOf)) {
      findings.push(finding("invalid_action_chronology", `actions/${id}/attemptedAt`, "Attempted, failed, and completed actions require a past exact attempt time."));
    }
    if (["planned", "blocked"].includes(action.state) && action.attemptedAt !== null) {
      findings.push(finding("invalid_action_chronology", `actions/${id}/attemptedAt`, "Planned and blocked actions cannot claim an attempt time."));
    }
    const receipt = action.receiptSourceRef === null ? null : requireRef(sources, action.receiptSourceRef, `actions/${id}/receiptSourceRef`, "unknown_source", findings);
    if (rows(action.sourceRefs).some((ref) => sources.get(ref)?.subjectRef !== id)) {
      findings.push(finding("cross_subject_action_evidence", `actions/${id}/sourceRefs`, "Action evidence must be issued for that exact action."));
    }
    if (["attempted", "failed"].includes(action.state) && !rows(action.sourceRefs).some((ref) => sources.get(ref)?.kind === "owner-action-note")) {
      findings.push(finding("missing_action_evidence", `actions/${id}/sourceRefs`, "Attempted and failed actions require a same-subject owner action note."));
    }
    if (action.state === "owner-completed") {
      const receiptAt = exactInstant(receipt?.publishedAt);
      if (!receipt || receipt.kind !== "independent-receipt" || receipt.subjectRef !== id || permittedOwners.has(receipt.issuerAuthorityRef) || receiptAt === null || attemptedAt === null || receiptAt < attemptedAt || !rows(action.sourceRefs).includes(receipt.id)) {
        findings.push(finding("invalid_action_receipt", `actions/${id}/receiptSourceRef`, "Owner-completed external actions require an independent same-subject receipt issued after the attempt and indexed as action evidence."));
      }
    } else if (action.receiptSourceRef !== null) {
      findings.push(finding("invalid_action_receipt", `actions/${id}/receiptSourceRef`, "Only owner-completed actions may claim a completion receipt."));
    }
    if (action.agentExecuted !== false) {
      findings.push(finding("external_authority_claim", `actions/${id}/agentExecuted`, "The Claw cannot execute recovery actions."));
    }
  }

  for (const [collectionName, collection, requiredKind] of [
    ["reports", reports, "file-report"],
    ["disputes", disputes, "open-dispute"],
  ]) {
    for (const [id, row] of collection) {
      refs(surfaces, row.surfaceRefs, `${collectionName}/${id}/surfaceRefs`, "unknown_surface", findings);
      const action = requireRef(actions, row.actionRef, `${collectionName}/${id}/actionRef`, "unknown_action", findings);
      if (!action || action.kind !== requiredKind || action.ownerAuthorityRef !== row.ownerAuthorityRef || !sameSet(action.surfaceRefs, row.surfaceRefs)) {
        findings.push(finding("invalid_filing_action", `${collectionName}/${id}/actionRef`, "Reports and disputes require a matching same-owner, same-surface action."));
      }
      const receipt = row.receiptSourceRef === null ? null : requireRef(sources, row.receiptSourceRef, `${collectionName}/${id}/receiptSourceRef`, "unknown_source", findings);
      if (["owner-filed", "acknowledged", "rejected"].includes(row.state)) {
        if (!receipt || receipt.kind !== "independent-receipt" || receipt.subjectRef !== id || permittedOwners.has(receipt.issuerAuthorityRef) || action?.state !== "owner-completed") {
          findings.push(finding("invalid_filing_receipt", `${collectionName}/${id}/receiptSourceRef`, "Filed, acknowledged, or rejected records require an independent same-subject receipt and completed owner action."));
        }
      } else if (row.receiptSourceRef !== null) {
        findings.push(finding("invalid_filing_receipt", `${collectionName}/${id}/receiptSourceRef`, "Planned or withdrawn records cannot claim a filing receipt."));
      }
      if (row.agentFiled !== false) {
        findings.push(finding("external_authority_claim", `${collectionName}/${id}/agentFiled`, "The Claw cannot file reports or disputes."));
      }
    }
  }

  for (const [id, decision] of decisions) {
    refs(surfaces, decision.surfaceRefs, `decisions/${id}/surfaceRefs`, "unknown_surface", findings);
    const institution = requireRef(authorities, decision.institutionAuthorityRef, `decisions/${id}/institutionAuthorityRef`, "unknown_authority", findings);
    const source = requireRef(sources, decision.sourceRef, `decisions/${id}/sourceRef`, "unknown_source", findings);
    const occurredAt = exactInstant(decision.occurredAt);
    if (institution?.kind !== "institution" || !source || source.kind !== "institution-decision" || source.subjectRef !== id || source.issuerAuthorityRef !== decision.institutionAuthorityRef) {
      findings.push(finding("invalid_institution_decision", `decisions/${id}`, "Institution decisions require a same-subject decision source from the named institution."));
    }
    if (occurredAt === null || asOf === null || occurredAt > asOf || (exactInstant(source?.publishedAt) ?? Infinity) > occurredAt) {
      findings.push(finding("invalid_decision_chronology", `decisions/${id}/occurredAt`, "Institution decisions must be source-backed and occur no later than the case as-of time."));
    }
    if (decision.fraudDetermination !== false) {
      findings.push(finding("fraud_determination_claim", `decisions/${id}/fraudDetermination`, "Institution status evidence cannot become the Claw's fraud determination."));
    }
  }

  for (const [id, gap] of gaps) {
    refs(surfaces, gap.surfaceRefs, `gaps/${id}/surfaceRefs`, "unknown_surface", findings);
    if (!permittedOwners.has(gap.ownerAuthorityRef)) {
      findings.push(finding("invalid_gap_owner", `gaps/${id}/ownerAuthorityRef`, "Every gap must retain an authorized human owner."));
    }
    for (const ref of rows(gap.relatedRefs)) {
      if (!allIds.has(ref)) findings.push(finding("unknown_gap_reference", `gaps/${id}/relatedRefs`, `Unknown related reference ${ref}.`));
      if (ref === id) findings.push(finding("self_referential_gap", `gaps/${id}/relatedRefs`, "A gap cannot cite itself as supporting state."));
    }
    const resolution = gap.resolutionSourceRef === null ? null : requireRef(sources, gap.resolutionSourceRef, `gaps/${id}/resolutionSourceRef`, "unknown_source", findings);
    if (gap.state === "resolved" ? !resolution : gap.resolutionSourceRef !== null) {
      findings.push(finding("invalid_gap_resolution", `gaps/${id}/resolutionSourceRef`, "Only resolved gaps may carry resolution evidence, and resolved gaps require it."));
    }
    if (gap.kind === "missing-receipt" && !rows(gap.relatedRefs).some((ref) => actions.has(ref) && actions.get(ref).receiptSourceRef === null)) {
      findings.push(finding("invalid_missing_receipt_gap", `gaps/${id}/relatedRefs`, "A missing-receipt gap must name an action without a receipt."));
    }
  }

  const expectedReview = [
    ["openGapRefs", [...gaps.values()].filter((row) => row.state === "open").map((row) => row.id)],
    ["missingReceiptActionRefs", [...actions.values()].filter((row) => ["attempted", "failed"].includes(row.state) && row.receiptSourceRef === null).map((row) => row.id)],
    ["pendingReportRefs", [...reports.values()].filter((row) => ["planned", "owner-filed"].includes(row.state)).map((row) => row.id)],
    ["pendingDisputeRefs", [...disputes.values()].filter((row) => ["planned", "owner-filed"].includes(row.state)).map((row) => row.id)],
    ["pendingDecisionRefs", [...decisions.values()].filter((row) => row.status === "institution-pending").map((row) => row.id)],
    ["residualSurfaceRefs", [...surfaces.values()].filter((row) => row.state !== "not-affected").map((row) => row.id)],
  ];
  const missingReceiptActions = expectedReview.find(([field]) => field === "missingReceiptActionRefs")?.[1] ?? [];
  for (const actionId of missingReceiptActions) {
    const coveringGaps = [...gaps.values()].filter(
      (gap) => gap.kind === "missing-receipt" && gap.state === "open" && rows(gap.relatedRefs).includes(actionId),
    );
    if (coveringGaps.length !== 1) {
      findings.push(finding("incomplete_missing_receipt_coverage", `actions/${actionId}`, "Every receiptless attempted or failed action requires exactly one open missing-receipt gap."));
    }
  }
  for (const [field, expected] of expectedReview) {
    if (!sameSet(review[field], expected)) {
      findings.push(finding("incomplete_review_index", `review/${field}`, `${field} must exactly expose modeled unresolved state.`));
    }
  }
  const hasBlocker = expectedReview.some(([, expected]) => expected.length > 0);
  if (review.decision === "ready-for-owner-review" && hasBlocker) {
    findings.push(finding("premature_recovery_handoff", "review/decision", "An owner-ready handoff requires no modeled gap, missing receipt, pending filing or decision, or residual surface."));
  }
  if (review.closureClaim !== false) {
    findings.push(finding("premature_closure_claim", "review/closureClaim", "The recovery ledger cannot claim case closure."));
  }

  const usedSources = new Set();
  for (const authority of authorities.values()) if (typeof authority.authorizationSourceRef === "string") usedSources.add(authority.authorizationSourceRef);
  for (const event of events.values()) for (const ref of rows(event.sourceRefs)) usedSources.add(ref);
  for (const surface of surfaces.values()) for (const ref of rows(surface.sourceRefs)) usedSources.add(ref);
  for (const route of routes.values()) if (typeof route.officialSourceRef === "string") usedSources.add(route.officialSourceRef);
  for (const action of actions.values()) {
    for (const ref of rows(action.sourceRefs)) usedSources.add(ref);
    if (typeof action.receiptSourceRef === "string") usedSources.add(action.receiptSourceRef);
  }
  for (const row of [...reports.values(), ...disputes.values()]) if (typeof row.receiptSourceRef === "string") usedSources.add(row.receiptSourceRef);
  for (const decision of decisions.values()) if (typeof decision.sourceRef === "string") usedSources.add(decision.sourceRef);
  for (const gap of gaps.values()) if (typeof gap.resolutionSourceRef === "string") usedSources.add(gap.resolutionSourceRef);
  for (const id of sources.keys()) {
    if (!usedSources.has(id)) findings.push(finding("orphan_source", `sources/${id}`, "Every source must support at least one modeled record."));
  }

  for (const [key, claimed] of Object.entries(prohibited)) {
    if (claimed !== false) {
      findings.push(finding("prohibited_authority_claim", `prohibitedActions/${key}`, "Identity Theft Recovery Coordinator cannot claim fraud determination, advice, external action, account authority, payment, submission, recovery, or closure."));
    }
  }

  return findings;
}
