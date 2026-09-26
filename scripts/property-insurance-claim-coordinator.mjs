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

function refs(index, values, path, code, findings) {
  for (const ref of rows(values)) requireRef(index, ref, path, code, findings);
}

function checkUniqueIds(collections, findings) {
  const seen = new Set();
  for (const [name, collection] of Object.entries(collections)) {
    for (const [position, row] of rows(collection).entries()) {
      if (!isRecord(row) || typeof row.id !== "string") continue;
      if (seen.has(row.id)) findings.push(finding("duplicate_identity", `${name}/${position}/id`, `Duplicate id ${row.id}.`));
      seen.add(row.id);
    }
  }
}

function secretLike(value) {
  if (typeof value !== "string") return false;
  return (
    /\b\d{3}-\d{2}-\d{4}\b/u.test(value) ||
    /\b\d{12,19}\b/u.test(value) ||
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu.test(value) ||
    /(?:password|passcode|security[-_ ]?answer|recovery[-_ ]?code|bearer|api[-_ ]?key|client[-_ ]?secret|private[-_ ]?key)[=:]/iu.test(value)
  );
}

function propertyRefsFor(target) {
  return rows(target?.propertyUnitRefs);
}

export function propertyInsuranceClaimFindings(value) {
  const findings = [];
  if (!isRecord(value)) {
    return [finding("invalid_property_claim_ledger", "", "Property claim ledger must be an object.")];
  }

  const claim = isRecord(value.claim) ? value.claim : {};
  const review = isRecord(value.review) ? value.review : {};
  const prohibited = isRecord(value.prohibitedActions) ? value.prohibitedActions : {};
  const authorities = indexById(value.authorities);
  const sources = indexById(value.sources);
  const events = indexById(value.events);
  const propertyUnits = indexById(value.propertyUnits);
  const requirements = indexById(value.requirements);
  const actions = indexById(value.actions);
  const estimates = indexById(value.estimates);
  const carrierPositions = indexById(value.carrierPositions);
  const payments = indexById(value.payments);
  const repairRecords = indexById(value.repairRecords);
  const ownerDecisions = indexById(value.ownerDecisions);
  const gaps = indexById(value.gaps);
  const allIds = new Set([
    claim.id,
    ...authorities.keys(),
    ...sources.keys(),
    ...events.keys(),
    ...propertyUnits.keys(),
    ...requirements.keys(),
    ...actions.keys(),
    ...estimates.keys(),
    ...carrierPositions.keys(),
    ...payments.keys(),
    ...repairRecords.keys(),
    ...ownerDecisions.keys(),
    ...gaps.keys(),
  ]);

  if (value.schemaVersion !== "awesomeClaws.propertyInsuranceClaim.v1") {
    findings.push(finding("invalid_schema_version", "schemaVersion", "Unexpected property claim schema version."));
  }

  checkUniqueIds(
    {
      claims: [claim],
      authorities: value.authorities,
      sources: value.sources,
      events: value.events,
      propertyUnits: value.propertyUnits,
      requirements: value.requirements,
      actions: value.actions,
      estimates: value.estimates,
      carrierPositions: value.carrierPositions,
      payments: value.payments,
      repairRecords: value.repairRecords,
      ownerDecisions: value.ownerDecisions,
      gaps: value.gaps,
    },
    findings,
  );

  for (const [field, index] of [
    ["eventRefs", events],
    ["propertyUnitRefs", propertyUnits],
    ["requirementRefs", requirements],
    ["actionRefs", actions],
    ["estimateRefs", estimates],
    ["carrierPositionRefs", carrierPositions],
    ["paymentRefs", payments],
    ["repairRecordRefs", repairRecords],
    ["ownerDecisionRefs", ownerDecisions],
    ["gapRefs", gaps],
  ]) {
    if (!sameSet(claim[field], [...index.keys()])) {
      findings.push(finding("incomplete_claim_index", `claim/${field}`, `${field} must exactly index its claim collection.`));
    }
  }

  const owner = authorities.get(claim.ownerAuthorityRef);
  const carrier = authorities.get(claim.carrierAuthorityRef);
  if (!owner || owner.kind !== "case-owner") {
    findings.push(finding("invalid_claim_owner", "claim/ownerAuthorityRef", "The claim owner must reference a case-owner authority."));
  }
  if (!carrier || carrier.kind !== "carrier" || claim.carrierAuthorityRef === claim.ownerAuthorityRef) {
    findings.push(finding("invalid_claim_carrier", "claim/carrierAuthorityRef", "The claim carrier must reference a distinct carrier authority."));
  }
  const declaredHelpers = [...authorities.values()].filter((row) => row.kind === "authorized-helper").map((row) => row.id);
  if (!sameSet(claim.authorizedHelperRefs, declaredHelpers)) {
    findings.push(finding("incomplete_helper_index", "claim/authorizedHelperRefs", "The helper index must exactly cover authorized-helper authorities."));
  }
  for (const helperId of rows(claim.authorizedHelperRefs)) {
    const helper = requireRef(authorities, helperId, "claim/authorizedHelperRefs", "unknown_authority", findings);
    if (helper?.kind !== "authorized-helper") {
      findings.push(finding("invalid_helper_authority", "claim/authorizedHelperRefs", "Every helper must be an authorized-helper authority."));
    }
  }

  const asOf = exactInstant(claim.asOf);
  const discoveredAt = exactInstant(claim.lossDiscoveredAt);
  if (asOf === null || discoveredAt === null || discoveredAt > asOf || review.asOf !== claim.asOf) {
    findings.push(finding("invalid_review_boundary", "review/asOf", "Loss discovery and review times must be exact, ordered, and share the claim as-of boundary."));
  }
  if (review.nextRevision !== claim.revision + 1) {
    findings.push(finding("invalid_revision_lineage", "review/nextRevision", "The next revision must increment the claim revision by one."));
  }
  if (claim.revision === 1 ? claim.previousRevisionRef !== null : claim.previousRevisionRef === null) {
    findings.push(finding("invalid_revision_lineage", "claim/previousRevisionRef", "Only revision one may omit its predecessor reference."));
  }
  if (review.nextOwnerAuthorityRef !== claim.ownerAuthorityRef) {
    findings.push(finding("invalid_next_owner", "review/nextOwnerAuthorityRef", "The handoff must return to the accountable claim owner."));
  }
  if (secretLike(claim.policyRefRedacted) || secretLike(claim.claimRefRedacted)) {
    findings.push(finding("secret_bearing_identifier", "claim", "Claim and policy references must remain safely redacted."));
  }
  if (rows(claim.jurisdictions).some(secretLike)) {
    findings.push(finding("secret_bearing_identifier", "claim/jurisdictions", "Jurisdiction labels cannot carry personal or secret-bearing values."));
  }

  const permittedOwners = new Set([claim.ownerAuthorityRef, ...rows(claim.authorizedHelperRefs)]);
  const carrierKinds = new Set(["policy-document", "official-claim-instruction", "carrier-request", "carrier-estimate", "carrier-position", "payment-statement"]);
  const permittedSourceSubjects = new Map([
    ["owner-observation", new Set([...events.keys(), ...propertyUnits.keys()])],
    ["owner-action-note", new Set(actions.keys())],
    ["owner-decision", new Set(ownerDecisions.keys())],
    ["helper-authorization", new Set(declaredHelpers)],
    ["policy-document", new Set([claim.id])],
    ["official-claim-instruction", new Set(requirements.keys())],
    ["carrier-request", new Set(requirements.keys())],
    ["independent-receipt", new Set(actions.keys())],
    ["adjuster-observation", new Set([...events.keys(), ...propertyUnits.keys()])],
    ["qualified-safety-assessment", new Set([...events.keys(), ...propertyUnits.keys(), ...gaps.keys()])],
    ["contractor-estimate", new Set(estimates.keys())],
    ["carrier-estimate", new Set(estimates.keys())],
    ["carrier-position", new Set(carrierPositions.keys())],
    ["payment-statement", new Set(payments.keys())],
    ["payment-receipt", new Set(payments.keys())],
    ["repair-invoice", new Set(repairRecords.keys())],
    ["repair-receipt", new Set(repairRecords.keys())],
  ]);
  for (const [id, source] of sources) {
    const issuedAt = exactInstant(source.issuedAt);
    const retrievedAt = exactInstant(source.retrievedAt);
    if (issuedAt === null || retrievedAt === null || issuedAt > retrievedAt || asOf === null || retrievedAt > asOf) {
      findings.push(finding("invalid_source_chronology", `sources/${id}`, "Source issue and retrieval times must be exact, ordered, and no later than claim review."));
    }
    const issuer = requireRef(authorities, source.issuerAuthorityRef, `sources/${id}/issuerAuthorityRef`, "unknown_authority", findings);
    if (["owner-observation", "owner-action-note", "owner-decision"].includes(source.kind) && !permittedOwners.has(source.issuerAuthorityRef)) {
      findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Owner evidence must come from the owner or an explicitly authorized helper."));
    } else if (source.kind === "helper-authorization" && source.issuerAuthorityRef !== claim.ownerAuthorityRef) {
      findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Helper authorization must come from the claim owner."));
    } else if (carrierKinds.has(source.kind) && source.issuerAuthorityRef !== claim.carrierAuthorityRef) {
      findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Carrier evidence must come from the claim carrier."));
    } else if (source.kind === "adjuster-observation" && issuer?.kind !== "adjuster") {
      findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Adjuster observations require an adjuster issuer."));
    } else if (source.kind === "qualified-safety-assessment" && issuer?.kind !== "qualified-safety-specialist") {
      findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Safety assessments require a qualified safety specialist issuer."));
    } else if (["contractor-estimate", "repair-invoice", "repair-receipt"].includes(source.kind) && issuer?.kind !== "repair-provider") {
      findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Provider estimates, invoices, and receipts require a repair-provider issuer."));
    } else if (["independent-receipt", "payment-receipt"].includes(source.kind) && permittedOwners.has(source.issuerAuthorityRef)) {
      findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Independent receipts cannot be self-issued by the claim owner or helper."));
    }
    if (!rows(claim.jurisdictions).includes(source.jurisdiction)) {
      findings.push(finding("invalid_source_jurisdiction", `sources/${id}/jurisdiction`, "Every source must use a declared claim jurisdiction."));
    }
    if (!permittedSourceSubjects.get(source.kind)?.has(source.subjectRef)) {
      findings.push(finding("invalid_source_subject", `sources/${id}/subjectRef`, "Source kind and subject record type must agree."));
    }
    if (source.redaction !== "minimized-reference-only" || source.containsSecrets !== false || secretLike(source.controlledRef)) {
      findings.push(finding("secret_bearing_source", `sources/${id}`, "Sources must use minimized controlled references and contain no secret-bearing values."));
    }
  }

  for (const [id, authority] of authorities) {
    if (secretLike(authority.name)) {
      findings.push(finding("secret_bearing_identifier", `authorities/${id}/name`, "Authority labels cannot carry personal identifiers, credentials, or secrets."));
    }
    if (authority.kind === "authorized-helper") {
      const source = requireRef(sources, authority.authorizationSourceRef, `authorities/${id}/authorizationSourceRef`, "unknown_source", findings);
      if (!source || source.kind !== "helper-authorization" || source.subjectRef !== id || source.issuerAuthorityRef !== claim.ownerAuthorityRef) {
        findings.push(finding("invalid_helper_authorization", `authorities/${id}/authorizationSourceRef`, "Helpers require a same-subject authorization from the claim owner."));
      }
    } else if (authority.authorizationSourceRef !== null) {
      findings.push(finding("invalid_authority_source", `authorities/${id}/authorizationSourceRef`, "Only explicitly authorized helpers may carry an authorization source."));
    }
  }

  const assertionKinds = new Map([
    ["owner-reported", new Set(["owner-observation", "owner-action-note"])],
    ["qualified-observation", new Set(["adjuster-observation", "qualified-safety-assessment", "contractor-estimate"])],
    ["carrier-issued-fact", new Set(["carrier-estimate", "carrier-position", "payment-statement", "carrier-request"])],
    ["official-instruction", new Set(["official-claim-instruction", "carrier-request"])],
    ["independently-receipted-outcome", new Set(["independent-receipt", "payment-receipt", "repair-invoice", "repair-receipt"])],
  ]);
  for (const [id, event] of events) {
    const occurredAt = exactInstant(event.occurredAt);
    if (occurredAt === null || discoveredAt === null || occurredAt < discoveredAt || asOf === null || occurredAt > asOf) {
      findings.push(finding("invalid_event_chronology", `events/${id}/occurredAt`, "Claim events must occur between loss discovery and review."));
    }
    refs(propertyUnits, event.propertyUnitRefs, `events/${id}/propertyUnitRefs`, "unknown_property_unit", findings);
    refs(sources, event.sourceRefs, `events/${id}/sourceRefs`, "unknown_source", findings);
    const permitted = assertionKinds.get(event.assertionState) ?? new Set();
    if (!rows(event.sourceRefs).some((ref) => permitted.has(sources.get(ref)?.kind))) {
      findings.push(finding("invalid_assertion_evidence", `events/${id}/sourceRefs`, "The assertion state requires evidence from its matching authority class."));
    }
    if (event.coverageDetermination !== false || event.causeDetermination !== false || event.safetyDetermination !== false) {
      findings.push(finding("prohibited_event_determination", `events/${id}`, "Events cannot become Claw coverage, cause, or safety determinations."));
    }
  }

  const reciprocalCollections = [
    ["eventRefs", events],
    ["requirementRefs", requirements],
    ["actionRefs", actions],
    ["estimateRefs", estimates],
    ["carrierPositionRefs", carrierPositions],
    ["paymentRefs", payments],
    ["repairRecordRefs", repairRecords],
    ["ownerDecisionRefs", ownerDecisions],
    ["gapRefs", gaps],
  ];
  for (const [id, property] of propertyUnits) {
    for (const [field, index] of reciprocalCollections) {
      const expected = [...index.values()].filter((row) => propertyRefsFor(row).includes(id)).map((row) => row.id);
      if (!sameSet(property[field], expected)) {
        findings.push(finding("incomplete_property_index", `propertyUnits/${id}/${field}`, `${field} must be reciprocal and complete.`));
      }
    }
    refs(sources, property.sourceRefs, `propertyUnits/${id}/sourceRefs`, "unknown_source", findings);
    if (secretLike(property.redactedIdentifier) || /\d{6,}/u.test(String(property.redactedIdentifier))) {
      findings.push(finding("secret_bearing_identifier", `propertyUnits/${id}/redactedIdentifier`, "Property identifiers must remain safely redacted."));
    }
    if (property.state === "carrier-positioned" && !rows(property.carrierPositionRefs).some((ref) => ["carrier-issued", "carrier-partial", "carrier-denied"].includes(carrierPositions.get(ref)?.state))) {
      findings.push(finding("unsupported_property_state", `propertyUnits/${id}/state`, "Carrier-positioned property requires a non-pending carrier position."));
    }
    if (["repaired", "replaced"].includes(property.state) && !rows(property.repairRecordRefs).some((ref) => {
      const repair = repairRecords.get(ref);
      return repair?.state === "owner-verified" && (property.state === "repaired" ? repair.kind === "repair" : repair.kind === "replacement");
    })) {
      findings.push(finding("unsupported_property_state", `propertyUnits/${id}/state`, "Repaired or replaced property requires a matching owner-verified record."));
    }
  }

  for (const [id, requirement] of requirements) {
    refs(propertyUnits, requirement.propertyUnitRefs, `requirements/${id}/propertyUnitRefs`, "unknown_property_unit", findings);
    refs(actions, requirement.actionRefs, `requirements/${id}/actionRefs`, "unknown_action", findings);
    const source = requireRef(sources, requirement.officialSourceRef, `requirements/${id}/officialSourceRef`, "unknown_source", findings);
    if (!source || !["official-claim-instruction", "carrier-request"].includes(source.kind) || source.subjectRef !== id || source.issuerAuthorityRef !== requirement.carrierAuthorityRef) {
      findings.push(finding("invalid_requirement_authority", `requirements/${id}/officialSourceRef`, "Requirements need a same-subject official source from their carrier authority."));
    }
    if (requirement.carrierAuthorityRef !== claim.carrierAuthorityRef || source?.jurisdiction !== requirement.jurisdiction || source?.revision !== requirement.revision) {
      findings.push(finding("invalid_requirement_binding", `requirements/${id}`, "Carrier, jurisdiction, and revision must exactly match the authoritative requirement source."));
    }
    if (requirement.state !== "superseded" && source?.freshness !== "current") {
      findings.push(finding("stale_current_requirement", `requirements/${id}/state`, "A current requirement needs current authoritative evidence."));
    }
    const boundActions = [...actions.values()].filter((row) => row.requirementRef === id).map((row) => row.id);
    if (!sameSet(requirement.actionRefs, boundActions)) {
      findings.push(finding("incomplete_requirement_index", `requirements/${id}/actionRefs`, "Requirement actions must be reciprocal and complete."));
    }
    const deadlineAt = requirement.deadlineAt === null ? null : exactInstant(requirement.deadlineAt);
    if (requirement.deadlineAt !== null && (deadlineAt === null || (exactInstant(source?.issuedAt) ?? Infinity) > deadlineAt)) {
      findings.push(finding("invalid_requirement_deadline", `requirements/${id}/deadlineAt`, "Requirement deadlines must be exact and cannot predate their source."));
    }
    if (requirement.externalExecution !== "owner-only") {
      findings.push(finding("external_authority_claim", `requirements/${id}/externalExecution`, "Claim requirements remain owner-executed."));
    }
  }

  for (const [id, action] of actions) {
    const requirement = requireRef(requirements, action.requirementRef, `actions/${id}/requirementRef`, "unknown_requirement", findings);
    refs(propertyUnits, action.propertyUnitRefs, `actions/${id}/propertyUnitRefs`, "unknown_property_unit", findings);
    refs(sources, action.sourceRefs, `actions/${id}/sourceRefs`, "unknown_source", findings);
    if (!requirement || !rows(requirement.actionRefs).includes(id) || rows(action.propertyUnitRefs).some((ref) => !rows(requirement.propertyUnitRefs).includes(ref))) {
      findings.push(finding("invalid_action_requirement", `actions/${id}/requirementRef`, "Actions must be indexed by a requirement covering the same property."));
    }
    if (!permittedOwners.has(action.ownerAuthorityRef)) {
      findings.push(finding("invalid_action_owner", `actions/${id}/ownerAuthorityRef`, "Actions remain with the owner or an explicitly authorized helper."));
    }
    const attemptedAt = action.attemptedAt === null ? null : exactInstant(action.attemptedAt);
    if (["attempted", "failed", "owner-completed"].includes(action.state) && (attemptedAt === null || asOf === null || attemptedAt > asOf)) {
      findings.push(finding("invalid_action_chronology", `actions/${id}/attemptedAt`, "Attempted, failed, and completed actions require a past exact attempt time."));
    }
    if (["planned", "blocked", "withdrawn", "superseded"].includes(action.state) && action.attemptedAt !== null) {
      findings.push(finding("invalid_action_chronology", `actions/${id}/attemptedAt`, "Unattempted action states cannot claim an attempt time."));
    }
    if (rows(action.sourceRefs).some((ref) => sources.get(ref)?.subjectRef !== id)) {
      findings.push(finding("cross_subject_action_evidence", `actions/${id}/sourceRefs`, "Action evidence must be issued for that exact action."));
    }
    if (["attempted", "failed"].includes(action.state) && !rows(action.sourceRefs).some((ref) => sources.get(ref)?.kind === "owner-action-note")) {
      findings.push(finding("missing_action_evidence", `actions/${id}/sourceRefs`, "Attempted and failed actions require a same-subject owner action note."));
    }
    const receipt = action.receiptSourceRef === null ? null : requireRef(sources, action.receiptSourceRef, `actions/${id}/receiptSourceRef`, "unknown_source", findings);
    if (action.state === "owner-completed") {
      const receiptAt = exactInstant(receipt?.issuedAt);
      if (!receipt || receipt.kind !== "independent-receipt" || receipt.subjectRef !== id || permittedOwners.has(receipt.issuerAuthorityRef) || receiptAt === null || attemptedAt === null || receiptAt < attemptedAt || !rows(action.sourceRefs).includes(receipt.id)) {
        findings.push(finding("invalid_action_receipt", `actions/${id}/receiptSourceRef`, "Owner-completed actions require an independent same-subject receipt issued after the attempt and indexed as action evidence."));
      }
    } else if (action.receiptSourceRef !== null) {
      findings.push(finding("invalid_action_receipt", `actions/${id}/receiptSourceRef`, "Only owner-completed actions may claim a completion receipt."));
    }
    if (action.kind !== "review-evidence" && action.externalAction !== true) {
      findings.push(finding("invalid_action_execution", `actions/${id}/externalAction`, "Claim actions other than local evidence review are external owner actions."));
    }
    if (action.agentExecuted !== false) {
      findings.push(finding("external_authority_claim", `actions/${id}/agentExecuted`, "The Claw cannot execute claim actions."));
    }
  }

  for (const [id, estimate] of estimates) {
    refs(propertyUnits, estimate.propertyUnitRefs, `estimates/${id}/propertyUnitRefs`, "unknown_property_unit", findings);
    const source = requireRef(sources, estimate.sourceRef, `estimates/${id}/sourceRef`, "unknown_source", findings);
    const issuer = requireRef(authorities, estimate.issuerAuthorityRef, `estimates/${id}/issuerAuthorityRef`, "unknown_authority", findings);
    const expectedSourceKind = estimate.kind;
    const expectedIssuerKind = estimate.kind === "carrier-estimate" ? "carrier" : "repair-provider";
    if (!source || source.kind !== expectedSourceKind || source.subjectRef !== id || source.issuerAuthorityRef !== estimate.issuerAuthorityRef || issuer?.kind !== expectedIssuerKind) {
      findings.push(finding("invalid_estimate_authority", `estimates/${id}`, "Estimate kind, source, subject, and issuer authority must agree."));
    }
    if (estimate.kind === "carrier-estimate" && estimate.issuerAuthorityRef !== claim.carrierAuthorityRef) {
      findings.push(finding("invalid_estimate_authority", `estimates/${id}/issuerAuthorityRef`, "Carrier estimates must come from the claim carrier."));
    }
    if (estimate.issuedAt !== source?.issuedAt || estimate.revision !== source?.revision || (estimate.status === "current" && source?.freshness !== "current")) {
      findings.push(finding("invalid_estimate_binding", `estimates/${id}`, "Estimate time, revision, and freshness must exactly match its source."));
    }
    if (estimate.clawRecommended !== false) {
      findings.push(finding("valuation_recommendation_claim", `estimates/${id}/clawRecommended`, "The Claw cannot recommend an estimate."));
    }
  }

  for (const [id, position] of carrierPositions) {
    refs(propertyUnits, position.propertyUnitRefs, `carrierPositions/${id}/propertyUnitRefs`, "unknown_property_unit", findings);
    const source = requireRef(sources, position.sourceRef, `carrierPositions/${id}/sourceRef`, "unknown_source", findings);
    if (position.carrierAuthorityRef !== claim.carrierAuthorityRef || !source || source.kind !== "carrier-position" || source.subjectRef !== id || source.issuerAuthorityRef !== position.carrierAuthorityRef || position.issuedAt !== source.issuedAt) {
      findings.push(finding("invalid_carrier_position", `carrierPositions/${id}`, "Carrier positions must be same-subject facts issued by the claim carrier."));
    }
    if (position.clawEndorsed !== false) {
      findings.push(finding("carrier_position_endorsement", `carrierPositions/${id}/clawEndorsed`, "The Claw cannot endorse a carrier position."));
    }
  }

  for (const [id, payment] of payments) {
    refs(propertyUnits, payment.propertyUnitRefs, `payments/${id}/propertyUnitRefs`, "unknown_property_unit", findings);
    const source = requireRef(sources, payment.statementSourceRef, `payments/${id}/statementSourceRef`, "unknown_source", findings);
    if (payment.carrierAuthorityRef !== claim.carrierAuthorityRef || !source || source.kind !== "payment-statement" || source.subjectRef !== id || source.issuerAuthorityRef !== payment.carrierAuthorityRef || payment.issuedAt !== source.issuedAt) {
      findings.push(finding("invalid_payment_statement", `payments/${id}`, "Payments require a same-subject statement from the claim carrier."));
    }
    const allocations = rows(payment.allocations);
    const allocationRefs = allocations.map((row) => row?.propertyUnitRef);
    const allocationTotal = allocations.reduce((sum, row) => sum + (Number.isSafeInteger(row?.amountMinorUnits) ? row.amountMinorUnits : 0), 0);
    if (!sameSet(payment.propertyUnitRefs, allocationRefs) || allocationTotal !== payment.amountMinorUnits) {
      findings.push(finding("invalid_payment_allocation", `payments/${id}/allocations`, "Payment allocations must uniquely and exactly reconcile the stated amount and property scope."));
    }
    const receipt = payment.receiptSourceRef === null ? null : requireRef(sources, payment.receiptSourceRef, `payments/${id}/receiptSourceRef`, "unknown_source", findings);
    if (payment.state === "carrier-announced") {
      if (payment.receiptSourceRef !== null) findings.push(finding("premature_payment_receipt", `payments/${id}/receiptSourceRef`, "An announced payment cannot claim receipt."));
    } else if (!receipt || receipt.kind !== "payment-receipt" || receipt.subjectRef !== id || permittedOwners.has(receipt.issuerAuthorityRef)) {
      findings.push(finding("invalid_payment_receipt", `payments/${id}/receiptSourceRef`, "A received, returned, or held payment requires independent same-subject receipt evidence."));
    }
    if (payment.ownerAcceptanceClaim !== false || payment.settlementClaim !== false) {
      findings.push(finding("premature_payment_conclusion", `payments/${id}`, "Payment evidence cannot become an owner-acceptance or settlement claim."));
    }
  }

  for (const [id, repair] of repairRecords) {
    refs(propertyUnits, repair.propertyUnitRefs, `repairRecords/${id}/propertyUnitRefs`, "unknown_property_unit", findings);
    refs(sources, repair.sourceRefs, `repairRecords/${id}/sourceRefs`, "unknown_source", findings);
    const provider = requireRef(authorities, repair.providerAuthorityRef, `repairRecords/${id}/providerAuthorityRef`, "unknown_authority", findings);
    if (provider?.kind !== "repair-provider") {
      findings.push(finding("invalid_repair_provider", `repairRecords/${id}/providerAuthorityRef`, "Repair records require a repair-provider authority."));
    }
    if (rows(repair.sourceRefs).some((ref) => sources.get(ref)?.subjectRef !== id || !["repair-invoice", "repair-receipt"].includes(sources.get(ref)?.kind))) {
      findings.push(finding("invalid_repair_evidence", `repairRecords/${id}/sourceRefs`, "Repair evidence must be a same-subject provider invoice or receipt."));
    }
    const action = repair.authorizedActionRef === null ? null : requireRef(actions, repair.authorizedActionRef, `repairRecords/${id}/authorizedActionRef`, "unknown_action", findings);
    if (repair.state !== "planned" && (!action || action.state !== "owner-completed" || !permittedOwners.has(action.ownerAuthorityRef) || !sameSet(action.propertyUnitRefs, repair.propertyUnitRefs) || !["perform-mitigation", "authorize-repair", "purchase-replacement"].includes(action.kind))) {
      findings.push(finding("invalid_repair_authorization", `repairRecords/${id}/authorizedActionRef`, "Non-planned work requires a matching completed owner action at exact property scope."));
    }
    if (repair.state === "planned" && repair.authorizedActionRef !== null) {
      findings.push(finding("invalid_repair_authorization", `repairRecords/${id}/authorizedActionRef`, "Planned work cannot claim completed authorization."));
    }
    const receipt = repair.completionReceiptSourceRef === null ? null : requireRef(sources, repair.completionReceiptSourceRef, `repairRecords/${id}/completionReceiptSourceRef`, "unknown_source", findings);
    if (["provider-reported-complete", "owner-verified"].includes(repair.state)) {
      if (!receipt || receipt.kind !== "repair-receipt" || receipt.subjectRef !== id || receipt.issuerAuthorityRef !== repair.providerAuthorityRef || !rows(repair.sourceRefs).includes(receipt.id)) {
        findings.push(finding("invalid_repair_completion", `repairRecords/${id}/completionReceiptSourceRef`, "Reported completion requires a same-subject provider receipt indexed as repair evidence."));
      }
    } else if (repair.completionReceiptSourceRef !== null) {
      findings.push(finding("invalid_repair_completion", `repairRecords/${id}/completionReceiptSourceRef`, "Only completed work may claim a completion receipt."));
    }
    if ((repair.amountMinorUnits === null) !== (repair.currency === null)) {
      findings.push(finding("invalid_repair_amount", `repairRecords/${id}`, "Repair amount and currency must be present or absent together."));
    }
    if (repair.agentAuthorized !== false || repair.repairSufficiencyClaim !== false) {
      findings.push(finding("prohibited_repair_claim", `repairRecords/${id}`, "The Claw cannot authorize work or determine repair sufficiency."));
    }
  }

  for (const [id, decision] of ownerDecisions) {
    refs(propertyUnits, decision.propertyUnitRefs, `ownerDecisions/${id}/propertyUnitRefs`, "unknown_property_unit", findings);
    const source = requireRef(sources, decision.sourceRef, `ownerDecisions/${id}/sourceRef`, "unknown_source", findings);
    if (!permittedOwners.has(decision.ownerAuthorityRef) || !source || source.kind !== "owner-decision" || source.subjectRef !== id || source.issuerAuthorityRef !== decision.ownerAuthorityRef) {
      findings.push(finding("invalid_owner_decision", `ownerDecisions/${id}`, "Owner decisions require same-subject evidence from an authorized owner."));
    }
    const decidedAt = exactInstant(decision.decidedAt);
    if (decidedAt === null || decidedAt < (exactInstant(source?.issuedAt) ?? Infinity) || asOf === null || decidedAt > asOf) {
      findings.push(finding("invalid_decision_chronology", `ownerDecisions/${id}/decidedAt`, "Owner decisions must be source-backed and no later than review."));
    }
    if (decision.agentDecision !== false) {
      findings.push(finding("external_authority_claim", `ownerDecisions/${id}/agentDecision`, "The Claw cannot make the owner's claim decision."));
    }
  }

  for (const [id, gap] of gaps) {
    refs(propertyUnits, gap.propertyUnitRefs, `gaps/${id}/propertyUnitRefs`, "unknown_property_unit", findings);
    if (!permittedOwners.has(gap.ownerAuthorityRef)) {
      findings.push(finding("invalid_gap_owner", `gaps/${id}/ownerAuthorityRef`, "Every gap must retain an authorized human owner."));
    }
    for (const ref of rows(gap.relatedRefs)) {
      if (!allIds.has(ref)) findings.push(finding("unknown_gap_reference", `gaps/${id}/relatedRefs`, `Unknown related reference ${ref}.`));
      if (ref === id) findings.push(finding("self_referential_gap", `gaps/${id}/relatedRefs`, "A gap cannot cite itself."));
    }
    const resolution = gap.resolutionSourceRef === null ? null : requireRef(sources, gap.resolutionSourceRef, `gaps/${id}/resolutionSourceRef`, "unknown_source", findings);
    if (gap.state === "resolved" ? !resolution : gap.resolutionSourceRef !== null) {
      findings.push(finding("invalid_gap_resolution", `gaps/${id}/resolutionSourceRef`, "Only resolved gaps may carry resolution evidence, and resolved gaps require it."));
    }
    if (gap.kind === "missing-receipt" && !rows(gap.relatedRefs).some((ref) => actions.has(ref) && actions.get(ref).receiptSourceRef === null && ["attempted", "failed"].includes(actions.get(ref).state))) {
      findings.push(finding("invalid_missing_receipt_gap", `gaps/${id}/relatedRefs`, "A missing-receipt gap must name an attempted or failed action without a receipt."));
    }
    if (gap.kind === "carrier-pending" && !rows(gap.relatedRefs).some((ref) => carrierPositions.get(ref)?.state === "carrier-pending")) {
      findings.push(finding("invalid_pending_carrier_gap", `gaps/${id}/relatedRefs`, "A carrier-pending gap must name a pending carrier position."));
    }
    if (gap.kind === "payment-question" && !rows(gap.relatedRefs).some((ref) => payments.has(ref))) {
      findings.push(finding("invalid_payment_gap", `gaps/${id}/relatedRefs`, "A payment question must name a payment record."));
    }
  }

  const expectedReview = [
    ["openGapRefs", [...gaps.values()].filter((row) => row.state === "open").map((row) => row.id)],
    ["missingReceiptActionRefs", [...actions.values()].filter((row) => ["attempted", "failed"].includes(row.state) && row.receiptSourceRef === null).map((row) => row.id)],
    ["openRequirementRefs", [...requirements.values()].filter((row) => ["open", "owner-completed-unacknowledged"].includes(row.state)).map((row) => row.id)],
    ["pendingCarrierPositionRefs", [...carrierPositions.values()].filter((row) => row.state === "carrier-pending").map((row) => row.id)],
    ["announcedPaymentRefs", [...payments.values()].filter((row) => row.state === "carrier-announced").map((row) => row.id)],
    ["unverifiedRepairRecordRefs", [...repairRecords.values()].filter((row) => row.state !== "owner-verified").map((row) => row.id)],
  ];
  const residualProperty = new Set();
  for (const gap of gaps.values()) if (gap.state === "open") for (const ref of rows(gap.propertyUnitRefs)) residualProperty.add(ref);
  for (const requirement of requirements.values()) if (["open", "owner-completed-unacknowledged"].includes(requirement.state)) for (const ref of rows(requirement.propertyUnitRefs)) residualProperty.add(ref);
  for (const position of carrierPositions.values()) if (position.state === "carrier-pending") for (const ref of rows(position.propertyUnitRefs)) residualProperty.add(ref);
  for (const payment of payments.values()) if (payment.state === "carrier-announced") for (const ref of rows(payment.propertyUnitRefs)) residualProperty.add(ref);
  for (const repair of repairRecords.values()) if (repair.state !== "owner-verified") for (const ref of rows(repair.propertyUnitRefs)) residualProperty.add(ref);
  expectedReview.push(["residualPropertyUnitRefs", [...residualProperty]]);

  const missingReceiptActions = expectedReview.find(([field]) => field === "missingReceiptActionRefs")?.[1] ?? [];
  for (const actionId of missingReceiptActions) {
    const covering = [...gaps.values()].filter((gap) => gap.kind === "missing-receipt" && gap.state === "open" && rows(gap.relatedRefs).includes(actionId));
    if (covering.length !== 1) {
      findings.push(finding("incomplete_missing_receipt_coverage", `actions/${actionId}`, "Every receiptless attempted or failed action requires exactly one open missing-receipt gap."));
    }
  }
  for (const [field, expected] of expectedReview) {
    if (!sameSet(review[field], expected)) {
      findings.push(finding("incomplete_review_index", `review/${field}`, `${field} must exactly expose modeled unresolved state.`));
    }
  }
  if (review.decision === "ready-for-owner-review" && expectedReview.some(([, expected]) => expected.length > 0)) {
    findings.push(finding("premature_claim_handoff", "review/decision", "An owner-ready handoff requires no modeled unresolved claim state."));
  }
  if (review.closureClaim !== false) {
    findings.push(finding("premature_closure_claim", "review/closureClaim", "The claim ledger cannot declare closure."));
  }

  const usedSources = new Set();
  for (const authority of authorities.values()) if (typeof authority.authorizationSourceRef === "string") usedSources.add(authority.authorizationSourceRef);
  for (const source of sources.values()) if (source.kind === "policy-document" && source.subjectRef === claim.id) usedSources.add(source.id);
  for (const event of events.values()) for (const ref of rows(event.sourceRefs)) usedSources.add(ref);
  for (const property of propertyUnits.values()) for (const ref of rows(property.sourceRefs)) usedSources.add(ref);
  for (const requirement of requirements.values()) usedSources.add(requirement.officialSourceRef);
  for (const action of actions.values()) {
    for (const ref of rows(action.sourceRefs)) usedSources.add(ref);
    if (typeof action.receiptSourceRef === "string") usedSources.add(action.receiptSourceRef);
  }
  for (const estimate of estimates.values()) usedSources.add(estimate.sourceRef);
  for (const position of carrierPositions.values()) usedSources.add(position.sourceRef);
  for (const payment of payments.values()) {
    usedSources.add(payment.statementSourceRef);
    if (typeof payment.receiptSourceRef === "string") usedSources.add(payment.receiptSourceRef);
  }
  for (const repair of repairRecords.values()) {
    for (const ref of rows(repair.sourceRefs)) usedSources.add(ref);
    if (typeof repair.completionReceiptSourceRef === "string") usedSources.add(repair.completionReceiptSourceRef);
  }
  for (const decision of ownerDecisions.values()) usedSources.add(decision.sourceRef);
  for (const gap of gaps.values()) if (typeof gap.resolutionSourceRef === "string") usedSources.add(gap.resolutionSourceRef);
  for (const id of sources.keys()) {
    if (!usedSources.has(id)) findings.push(finding("orphan_source", `sources/${id}`, "Every source must support at least one modeled claim record."));
  }

  for (const [key, claimed] of Object.entries(prohibited)) {
    if (claimed !== false) {
      findings.push(finding("prohibited_authority_claim", `prohibitedActions/${key}`, "Property Insurance Claim Coordinator cannot claim determinations, advice, external action, authorization, payment, recovery, or closure."));
    }
  }

  return findings;
}
