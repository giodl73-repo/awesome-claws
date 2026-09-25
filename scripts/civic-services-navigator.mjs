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
  return new Map(rows(value).filter((row) => isRecord(row) && typeof row.id === "string").map((row) => [row.id, row]));
}

function sameSet(left, right) {
  const a = rows(left);
  const b = rows(right);
  return a.length === b.length && new Set(a).size === a.length && a.every((id) => b.includes(id));
}

function exactInstant(value) {
  if (typeof value !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/u.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function requireRef(index, ref, path, code, findings) {
  const target = index.get(ref);
  if (!target) findings.push(finding(code, path, `Unknown reference ${String(ref)}.`));
  return target;
}

function checkUniqueIds(collections, findings) {
  const seen = new Set();
  for (const [name, collection] of Object.entries(collections)) {
    for (const [index, row] of rows(collection).entries()) {
      if (!isRecord(row) || typeof row.id !== "string") continue;
      if (seen.has(row.id)) findings.push(finding("duplicate_identity", `${name}/${index}/id`, `Duplicate id ${row.id}.`));
      seen.add(row.id);
    }
  }
}

export function civicServiceAccessFindings(value) {
  const findings = [];
  if (!isRecord(value)) return [finding("invalid_service_access", "", "Service access packet must be an object.")];

  const serviceCase = isRecord(value.case) ? value.case : {};
  const review = isRecord(value.review) ? value.review : {};
  const prohibited = isRecord(value.prohibitedActions) ? value.prohibitedActions : {};
  const sources = indexById(value.sources);
  const jurisdictions = indexById(value.jurisdictions);
  const localityClaims = indexById(value.localityClaims);
  const agencies = indexById(value.agencies);
  const routes = indexById(value.routes);
  const criteria = indexById(value.criteria);
  const evidence = indexById(value.residentEvidence);
  const channels = indexById(value.channels);
  const steps = indexById(value.steps);
  const questions = indexById(value.questions);

  if (value.schemaVersion !== "awesomeClaws.civicServiceAccess.v1") {
    findings.push(finding("invalid_schema_version", "schemaVersion", "Unexpected civic-service access schema version."));
  }
  checkUniqueIds({ cases: [serviceCase], sources: value.sources, jurisdictions: value.jurisdictions, localityClaims: value.localityClaims, agencies: value.agencies, routes: value.routes, criteria: value.criteria, residentEvidence: value.residentEvidence, channels: value.channels, steps: value.steps, questions: value.questions }, findings);

  if (!sameSet(serviceCase.localityClaimRefs, [...localityClaims.keys()])) {
    findings.push(finding("incomplete_case_index", "case/localityClaimRefs", "Case locality references must exactly cover locality claims."));
  }
  if (!sameSet(serviceCase.routeRefs, [...routes.keys()])) {
    findings.push(finding("incomplete_case_index", "case/routeRefs", "Case route references must exactly cover routes."));
  }

  const asOf = exactInstant(serviceCase.asOf);
  if (asOf === null || review.asOf !== serviceCase.asOf) {
    findings.push(finding("invalid_review_boundary", "review/asOf", "Review time must equal the exact zone-bearing case as-of time."));
  }
  if (review.nextRevision !== serviceCase.revision + 1) {
    findings.push(finding("invalid_revision_lineage", "review/nextRevision", "The next revision must increment the case revision by one."));
  }
  for (const [id, source] of sources) {
    const instant = exactInstant(source.retrievedAt);
    if (instant === null || asOf === null || instant > asOf) {
      findings.push(finding("invalid_source_chronology", `sources/${id}/retrievedAt`, "Source retrieval must be exact and no later than the case as-of time."));
    }
    let validAuthority = false;
    if (source.kind === "resident-record") validAuthority = source.authorityRef === serviceCase.residentOwner;
    else if (source.kind === "action-confirmation") validAuthority = source.authorityRef === serviceCase.residentOwner || agencies.has(source.authorityRef);
    else if (["jurisdiction-locator", "agency-directory"].includes(source.kind)) validAuthority = jurisdictions.has(source.authorityRef);
    else validAuthority = agencies.has(source.authorityRef);
    if (!validAuthority) findings.push(finding("invalid_source_authority", `sources/${id}/authorityRef`, "Source authority must resolve to the resident, jurisdiction, or agency required by its source kind."));
  }

  for (const [id, jurisdiction] of jurisdictions) {
    for (const ref of rows(jurisdiction.sourceRefs)) {
      const source = requireRef(sources, ref, `jurisdictions/${id}/sourceRefs`, "unknown_source", findings);
      if (source && (source.kind !== "jurisdiction-locator" || source.authorityRef !== id)) findings.push(finding("invalid_jurisdiction_source", `jurisdictions/${id}/sourceRefs`, "Jurisdiction evidence must be an exact-authority jurisdiction locator."));
    }
    if ([...localityClaims.values()].filter((claim) => claim.jurisdictionRef === id).length !== 1) findings.push(finding("invalid_jurisdiction_coverage", `jurisdictions/${id}`, "Each jurisdiction must have exactly one locality claim."));
  }
  for (const [id, claim] of localityClaims) {
    requireRef(jurisdictions, claim.jurisdictionRef, `localityClaims/${id}/jurisdictionRef`, "unknown_jurisdiction", findings);
    for (const ref of rows(claim.sourceRefs)) requireRef(sources, ref, `localityClaims/${id}/sourceRefs`, "unknown_source", findings);
    if (!rows(claim.sourceRefs).some((ref) => sources.get(ref)?.kind === "jurisdiction-locator" && sources.get(ref)?.authorityRef === claim.jurisdictionRef)) {
      findings.push(finding("invalid_locality_source", `localityClaims/${id}/sourceRefs`, "A locality claim must bind a locator controlled by its claimed jurisdiction."));
    }
    if (rows(claim.sourceRefs).some((ref) => sources.get(ref)?.kind === "resident-record" && sources.get(ref)?.authorityRef !== serviceCase.residentOwner)) {
      findings.push(finding("invalid_locality_source", `localityClaims/${id}/sourceRefs`, "Resident locality evidence must remain controlled by the resident owner."));
    }
    if (claim.state === "confirmed" && claim.ownerConfirmed !== true) {
      findings.push(finding("unconfirmed_locality_claim", `localityClaims/${id}/ownerConfirmed`, "A confirmed locality claim requires resident confirmation."));
    }
  }
  for (const [id, agency] of agencies) {
    requireRef(jurisdictions, agency.jurisdictionRef, `agencies/${id}/jurisdictionRef`, "unknown_jurisdiction", findings);
    for (const ref of rows(agency.sourceRefs)) {
      const source = requireRef(sources, ref, `agencies/${id}/sourceRefs`, "unknown_source", findings);
      if (source && (source.kind !== "agency-directory" || source.authorityRef !== agency.jurisdictionRef)) findings.push(finding("invalid_agency_source", `agencies/${id}/sourceRefs`, "Agency evidence must be an agency directory controlled by its jurisdiction."));
    }
    if (![...routes.values()].some((route) => route.agencyRef === id)) findings.push(finding("orphan_agency", `agencies/${id}`, "Every agency must administer at least one candidate route."));
  }

  for (const [id, route] of routes) {
    const agency = requireRef(agencies, route.agencyRef, `routes/${id}/agencyRef`, "unknown_agency", findings);
    requireRef(jurisdictions, route.jurisdictionRef, `routes/${id}/jurisdictionRef`, "unknown_jurisdiction", findings);
    if (agency && agency.jurisdictionRef !== route.jurisdictionRef) {
      findings.push(finding("cross_jurisdiction_route", `routes/${id}/jurisdictionRef`, "Route jurisdiction must match its administering agency."));
    }
    for (const ref of rows(route.sourceRefs)) requireRef(sources, ref, `routes/${id}/sourceRefs`, "unknown_source", findings);
    const programSource = requireRef(sources, route.programSourceRef, `routes/${id}/programSourceRef`, "unknown_source", findings);
    if (programSource && (programSource.kind !== "program-page" || programSource.authorityRef !== route.agencyRef || programSource.revision !== route.programRevision || !rows(route.sourceRefs).includes(route.programSourceRef))) {
      findings.push(finding("invalid_program_revision", `routes/${id}/programRevision`, "Route program revision must bind its named program-page source."));
    }
    const feeSource = requireRef(sources, route.feeSourceRef, `routes/${id}/feeSourceRef`, "unknown_source", findings);
    if (feeSource && (!["fee-schedule", "program-page"].includes(feeSource.kind) || feeSource.authorityRef !== route.agencyRef || !rows(route.sourceRefs).includes(route.feeSourceRef))) {
      findings.push(finding("invalid_fee_source", `routes/${id}/feeSourceRef`, "Route fee must bind a named fee-schedule or program-page source on the route."));
    }
    for (const [field, index] of [["criterionRefs", criteria], ["channelRefs", channels], ["stepRefs", steps], ["questionRefs", questions]]) {
      const bound = [...index.values()].filter((row) => row.routeRef === id).map((row) => row.id);
      if (!sameSet(route[field], bound)) findings.push(finding("incomplete_route_index", `routes/${id}/${field}`, `${field} must exactly cover rows bound to the route.`));
    }
    for (const [position, material] of rows(route.requiredMaterials).entries()) {
      const source = requireRef(sources, material?.sourceRef, `routes/${id}/requiredMaterials/${position}/sourceRef`, "unknown_source", findings);
      if (source && (!rows(route.sourceRefs).includes(source.id) || source.authorityRef !== route.agencyRef || !["program-page", "criterion-text"].includes(source.kind))) {
        findings.push(finding("invalid_material_source", `routes/${id}/requiredMaterials/${position}/sourceRef`, "Required-material state must bind a route program or criterion source from the administering agency."));
      }
    }
    for (const [position, window] of rows(route.timingWindows).entries()) {
      const source = requireRef(sources, window?.sourceRef, `routes/${id}/timingWindows/${position}/sourceRef`, "unknown_source", findings);
      if (source && (!rows(route.sourceRefs).includes(source.id) || source.authorityRef !== route.agencyRef || source.kind !== "program-page")) {
        findings.push(finding("invalid_timing_source", `routes/${id}/timingWindows/${position}/sourceRef`, "Timing state must bind a route program source from the administering agency."));
      }
      const opensAt = window?.opensAt === null ? null : exactInstant(window?.opensAt);
      const closesAt = window?.closesAt === null ? null : exactInstant(window?.closesAt);
      if (window?.status === "confirmed" ? (opensAt === null && closesAt === null) : (window?.opensAt !== null || window?.closesAt !== null)) {
        findings.push(finding("invalid_timing_window", `routes/${id}/timingWindows/${position}`, "Confirmed timing needs an exact boundary; unknown or not-applicable timing cannot claim one."));
      } else if (opensAt !== null && closesAt !== null && opensAt >= closesAt) {
        findings.push(finding("invalid_timing_window", `routes/${id}/timingWindows/${position}`, "Timing-window close must be later than its open."));
      }
    }
    for (const [position, office] of rows(route.offices).entries()) {
      const source = requireRef(sources, office?.sourceRef, `routes/${id}/offices/${position}/sourceRef`, "unknown_source", findings);
      const channel = office?.channelRef === null ? null : requireRef(channels, office?.channelRef, `routes/${id}/offices/${position}/channelRef`, "unknown_channel", findings);
      if (source && (!rows(route.sourceRefs).includes(source.id) || source.authorityRef !== route.agencyRef || !["channel-description", "program-page"].includes(source.kind))) {
        findings.push(finding("invalid_office_source", `routes/${id}/offices/${position}/sourceRef`, "Office state must bind a route program or channel source from the administering agency."));
      }
      if (channel && channel.routeRef !== id) findings.push(finding("invalid_office_channel", `routes/${id}/offices/${position}/channelRef`, "Office channel must belong to the same route."));
      if (office?.status === "confirmed" ? (channel === null || office.address === null) : (office?.channelRef !== null || office?.address !== null)) {
        findings.push(finding("invalid_office_state", `routes/${id}/offices/${position}`, "Confirmed offices need a route channel and address; unknown or not-applicable offices cannot claim them."));
      }
    }
    const routeJurisdiction = jurisdictions.get(route.jurisdictionRef);
    const routeAgency = agencies.get(route.agencyRef);
    const routeClaims = [...localityClaims.values()].filter((claim) => claim.jurisdictionRef === route.jurisdictionRef);
    const routeCriteria = [...criteria.values()].filter((row) => row.routeRef === id);
    const dependentSourceRefs = [
      ...rows(routeJurisdiction?.sourceRefs),
      ...routeClaims.flatMap((row) => rows(row.sourceRefs)),
      ...rows(routeAgency?.sourceRefs),
      ...rows(route.sourceRefs),
      ...routeCriteria.flatMap((row) => rows(row.sourceRefs)),
      ...[...evidence.values()].filter((row) => routeCriteria.some((criterion) => criterion.id === row.criterionRef)).map((row) => row.sourceRef),
      ...[...channels.values()].filter((row) => row.routeRef === id).flatMap((row) => rows(row.sourceRefs)),
      ...[...steps.values()].filter((row) => row.routeRef === id).flatMap((row) => rows(row.sourceRefs)),
      ...[...questions.values()].filter((row) => row.routeRef === id && row.answerSourceRef !== null).map((row) => row.answerSourceRef),
    ];
    const confirmedTiming = rows(route.timingWindows).filter((window) => window?.status === "confirmed");
    const expiredTiming = confirmedTiming.length > 0 && confirmedTiming.every((window) => window.closesAt !== null && exactInstant(window.closesAt) < asOf);
    if (route.ownerSelected && (route.status !== "preferred" || expiredTiming || dependentSourceRefs.some((ref) => sources.get(ref)?.freshness !== "current"))) {
      findings.push(finding("invalid_selected_route", `routes/${id}`, "A selected route must be preferred, unexpired, and use only current route sources."));
    }
    const jurisdictionClaims = [...localityClaims.values()].filter((claim) => claim.jurisdictionRef === route.jurisdictionRef);
    if (route.ownerSelected && (jurisdictionClaims.length !== 1 || jurisdictionClaims[0]?.state !== "confirmed" || jurisdictionClaims[0]?.ownerConfirmed !== true)) {
      findings.push(finding("unresolved_selected_jurisdiction", `routes/${id}/jurisdictionRef`, "A selected route requires one resident-confirmed locality claim for its jurisdiction."));
    }
    if (!route.ownerSelected && route.status === "preferred") {
      findings.push(finding("invalid_selected_route", `routes/${id}/ownerSelected`, "A preferred route must be selected by the resident owner."));
    }
  }
  const selectedRoutes = [...routes.values()].filter((route) => route.ownerSelected);
  if (selectedRoutes.length > 1 || (serviceCase.nextRouteRef === null ? selectedRoutes.length !== 0 : selectedRoutes.length !== 1 || selectedRoutes[0]?.id !== serviceCase.nextRouteRef)) {
    findings.push(finding("invalid_next_route", "case/nextRouteRef", "The next route must identify the sole resident-selected route, or both must be absent."));
  }

  const evidenceKindByState = new Map([["self-attested", "self-attestation"], ["document-backed", "document-reference"], ["agency-confirmed", "agency-confirmation"]]);
  for (const [id, criterion] of criteria) {
    const route = requireRef(routes, criterion.routeRef, `criteria/${id}/routeRef`, "unknown_route", findings);
    for (const ref of rows(criterion.sourceRefs)) requireRef(sources, ref, `criteria/${id}/sourceRefs`, "unknown_source", findings);
    if (route && rows(criterion.sourceRefs).filter((ref) => sources.get(ref)?.kind === "criterion-text" && sources.get(ref)?.authorityRef === route.agencyRef && sources.get(ref)?.revision === route.programRevision).length !== 1) {
      findings.push(finding("invalid_criterion_revision", `criteria/${id}/sourceRefs`, "Criterion must bind exactly one criterion-text source for the route program revision."));
    }
    const boundEvidence = [...evidence.values()].filter((row) => row.criterionRef === id);
    const expectedKind = evidenceKindByState.get(criterion.evidenceState);
    if (expectedKind) {
      const linked = requireRef(evidence, criterion.evidenceRef, `criteria/${id}/evidenceRef`, "unknown_resident_evidence", findings);
      if (boundEvidence.length !== 1 || linked?.criterionRef !== id || linked?.kind !== expectedKind) {
        findings.push(finding("invalid_criterion_evidence", `criteria/${id}/evidenceRef`, "Criterion evidence must be reciprocal, unique, and match its declared evidence state."));
      }
    } else if (criterion.evidenceRef !== null || boundEvidence.length !== 0) {
      findings.push(finding("invalid_criterion_evidence", `criteria/${id}/evidenceRef`, "Withheld, unknown, and agency-review-needed criteria cannot claim resident evidence."));
    }
  }
  for (const [id, row] of evidence) {
    const criterion = requireRef(criteria, row.criterionRef, `residentEvidence/${id}/criterionRef`, "unknown_criterion", findings);
    const route = criterion ? routes.get(criterion.routeRef) : undefined;
    const source = requireRef(sources, row.sourceRef, `residentEvidence/${id}/sourceRef`, "unknown_source", findings);
    const instant = exactInstant(row.observedAt);
    if (instant === null || asOf === null || instant > asOf) findings.push(finding("invalid_evidence_chronology", `residentEvidence/${id}/observedAt`, "Resident evidence must be observed no later than the case as-of time."));
    if (criterion && criterion.evidenceRef !== id) findings.push(finding("orphan_resident_evidence", `residentEvidence/${id}`, "Resident evidence must be named by its criterion."));
    const expectedSourceKind = row.kind === "agency-confirmation" ? "agency-response" : "resident-record";
    const expectedAuthority = row.kind === "agency-confirmation" ? route?.agencyRef : serviceCase.residentOwner;
    if (source && (source.kind !== expectedSourceKind || source.authorityRef !== expectedAuthority)) findings.push(finding("invalid_evidence_source", `residentEvidence/${id}/sourceRef`, "Evidence kind and authority must match its resident owner or administering agency."));
  }

  for (const [id, channel] of channels) {
    const route = requireRef(routes, channel.routeRef, `channels/${id}/routeRef`, "unknown_route", findings);
    for (const ref of rows(channel.sourceRefs)) requireRef(sources, ref, `channels/${id}/sourceRefs`, "unknown_source", findings);
    if (route && !rows(channel.sourceRefs).some((ref) => sources.get(ref)?.kind === "channel-description" && sources.get(ref)?.authorityRef === route.agencyRef)) findings.push(finding("invalid_channel_source", `channels/${id}/sourceRefs`, "Channel must bind an administering-agency channel-description source."));
  }
  for (const [routeId, route] of routes) {
    const routeSteps = [...steps.values()].filter((step) => step.routeRef === routeId).sort((left, right) => left.sequence - right.sequence);
    for (const [index, step] of routeSteps.entries()) {
      if (step.sequence !== index + 1) findings.push(finding("invalid_step_sequence", `steps/${step.id}/sequence`, "Route steps must use contiguous sequence numbers."));
      const channel = requireRef(channels, step.channelRef, `steps/${step.id}/channelRef`, "unknown_channel", findings);
      if (channel && channel.routeRef !== routeId) findings.push(finding("cross_route_step_channel", `steps/${step.id}/channelRef`, "Step channel must belong to the same route."));
      for (const [position, ref] of rows(step.prerequisiteRefs).entries()) {
        const prerequisite = requireRef(steps, ref, `steps/${step.id}/prerequisiteRefs/${position}`, "unknown_step", findings);
        if (prerequisite && (prerequisite.routeRef !== routeId || prerequisite.sequence >= step.sequence)) findings.push(finding("invalid_step_prerequisite", `steps/${step.id}/prerequisiteRefs/${position}`, "A prerequisite must be an earlier step on the same route."));
        if (prerequisite && step.state === "owner-completed" && prerequisite.state !== "owner-completed") findings.push(finding("incomplete_step_prerequisite", `steps/${step.id}/prerequisiteRefs/${position}`, "A completed step requires every prerequisite to be completed."));
      }
      for (const ref of rows(step.sourceRefs)) {
        const source = requireRef(sources, ref, `steps/${step.id}/sourceRefs`, "unknown_source", findings);
        const validAuthority = source?.kind === "resident-record" || source?.kind === "action-confirmation"
          ? [serviceCase.residentOwner, route.agencyRef].includes(source.authorityRef)
          : ["jurisdiction-locator", "agency-directory"].includes(source?.kind)
            ? source.authorityRef === route.jurisdictionRef
            : source?.authorityRef === route.agencyRef;
        if (source && !validAuthority) findings.push(finding("invalid_step_source", `steps/${step.id}/sourceRefs`, "Step evidence must be controlled by the route jurisdiction, administering agency, or resident owner."));
      }
      const completionSource = step.completionSourceRef === null ? null : requireRef(sources, step.completionSourceRef, `steps/${step.id}/completionSourceRef`, "unknown_source", findings);
      if (step.state === "owner-completed" && (!completionSource || completionSource.kind !== "action-confirmation" || ![serviceCase.residentOwner, route.agencyRef].includes(completionSource.authorityRef) || !rows(step.sourceRefs).includes(step.completionSourceRef))) {
        findings.push(finding("unsupported_external_action_completion", `steps/${step.id}/state`, "Owner-reported external completion requires resident or agency evidence."));
      } else if (step.state !== "owner-completed" && step.completionSourceRef !== null) {
        findings.push(finding("unsupported_external_action_completion", `steps/${step.id}/completionSourceRef`, "Only an owner-completed step may bind completion evidence."));
      }
      if (step.owner !== serviceCase.residentOwner) findings.push(finding("invalid_owner_authority", `steps/${step.id}/owner`, "Access steps must remain owned by the resident owner."));
    }
  }

  for (const [id, question] of questions) {
    const route = requireRef(routes, question.routeRef, `questions/${id}/routeRef`, "unknown_route", findings);
    if (route && question.owner !== route.agencyRef) findings.push(finding("invalid_question_owner", `questions/${id}/owner`, "An agency question must remain owned by the administering agency."));
    let subject;
    if (question.kind === "criterion") subject = criteria.get(question.subjectRef);
    else if (question.kind === "channel" || question.kind === "accommodation") subject = channels.get(question.subjectRef);
    else if (question.kind === "jurisdiction") subject = localityClaims.get(question.subjectRef);
    else subject = routes.get(question.subjectRef);
    const subjectRouteRef = subject?.routeRef ?? (question.kind === "jurisdiction" && route && subject?.jurisdictionRef === route.jurisdictionRef ? route.id : undefined);
    if (!subject || subjectRouteRef !== question.routeRef) findings.push(finding("invalid_question_subject", `questions/${id}/subjectRef`, "Question subject must resolve to the same route and match the question kind."));
    if (question.status === "answered") {
      const answer = requireRef(sources, question.answerSourceRef, `questions/${id}/answerSourceRef`, "unknown_source", findings);
      if (answer && (answer.kind !== "agency-response" || answer.authorityRef !== route?.agencyRef)) findings.push(finding("invalid_question_answer", `questions/${id}/answerSourceRef`, "An answered agency question requires same-agency response evidence."));
    } else if (question.answerSourceRef !== null) {
      findings.push(finding("invalid_question_answer", `questions/${id}/answerSourceRef`, "Only an answered question may name answer evidence."));
    }
  }
  for (const [id, criterion] of criteria) {
    if (criterion.evidenceState === "agency-review-needed" && ![...questions.values()].some((question) => question.routeRef === criterion.routeRef && question.kind === "criterion" && question.subjectRef === id && question.status === "open")) {
      findings.push(finding("missing_criterion_question", `criteria/${id}`, "Agency-review-needed criteria require an open agency question naming the criterion."));
    }
  }
  for (const [id, channel] of channels) {
    if (channel.status === "unconfirmed" && ![...questions.values()].some((question) => question.routeRef === channel.routeRef && ["channel", "accommodation"].includes(question.kind) && question.subjectRef === id && question.status === "open")) {
      findings.push(finding("missing_channel_question", `channels/${id}`, "An unconfirmed channel requires an open agency question naming the channel."));
    }
  }

  const consumedSourceRefs = new Set([
    ...[...jurisdictions.values()].flatMap((row) => rows(row.sourceRefs)),
    ...[...localityClaims.values()].flatMap((row) => rows(row.sourceRefs)),
    ...[...agencies.values()].flatMap((row) => rows(row.sourceRefs)),
    ...[...routes.values()].flatMap((row) => rows(row.sourceRefs)),
    ...[...criteria.values()].flatMap((row) => rows(row.sourceRefs)),
    ...[...evidence.values()].map((row) => row.sourceRef),
    ...[...channels.values()].flatMap((row) => rows(row.sourceRefs)),
    ...[...steps.values()].flatMap((row) => rows(row.sourceRefs)),
    ...[...questions.values()].map((row) => row.answerSourceRef).filter(Boolean),
  ]);
  for (const id of sources.keys()) if (!consumedSourceRefs.has(id)) findings.push(finding("orphan_source", `sources/${id}`, "Every source must support at least one modeled record."));

  const conflictingClaims = [...localityClaims.values()].filter((claim) => claim.state === "conflicting").map((claim) => claim.id);
  const unresolvedQuestions = [...questions.values()].filter((question) => question.status === "open").map((question) => question.id);
  if (!sameSet(review.conflictingLocalityClaimRefs, conflictingClaims)) findings.push(finding("incomplete_locality_review", "review/conflictingLocalityClaimRefs", "Review must exactly list conflicting locality claims."));
  if (!sameSet(review.unresolvedQuestionRefs, unresolvedQuestions)) findings.push(finding("incomplete_question_review", "review/unresolvedQuestionRefs", "Review must exactly list open agency questions."));
  if (review.decision === "ready-for-resident-review" && (conflictingClaims.length > 0 || unresolvedQuestions.length > 0 || selectedRoutes.length !== 1)) {
    findings.push(finding("premature_resident_handoff", "review/decision", "Resident-ready handoff requires one selected route and no locality conflict or open agency question."));
  }
  if (review.decision === "ready-for-resident-review" && [...localityClaims.values()].some((claim) => claim.state === "candidate")) {
    findings.push(finding("premature_resident_handoff", "review/decision", "Resident-ready handoff cannot retain an unresolved candidate locality claim."));
  }

  for (const [key, action] of Object.entries(prohibited)) {
    if (action !== false) findings.push(finding("prohibited_authority_claim", `prohibitedActions/${key}`, "Civic Services Navigator cannot claim adjudication or external action."));
  }
  for (const [path, owner] of [["case/residentOwner", serviceCase.residentOwner], ["review/nextOwner", review.nextOwner]]) {
    if (typeof owner !== "string" || !/^(?:resident|delegate)-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(owner)) findings.push(finding("invalid_owner_authority", path, "Resident authority must use an explicit resident-* or delegate-* owner identity."));
  }
  if (review.nextOwner !== serviceCase.residentOwner) findings.push(finding("invalid_next_owner", "review/nextOwner", "The next owner must remain the resident owner."));

  return findings;
}
