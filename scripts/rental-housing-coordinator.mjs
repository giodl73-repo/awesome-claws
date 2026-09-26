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
    /\b\d{12,19}\b/u.test(value) ||
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu.test(value) ||
    /\b\d{1,6}\s+(?:[A-Za-z]+\s){0,4}(?:street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr|court|ct)\b/iu.test(value) ||
    /(?:password|passcode|door[-_ ]?code|gate[-_ ]?code|security[-_ ]?answer|recovery[-_ ]?code|bearer|api[-_ ]?key|client[-_ ]?secret|private[-_ ]?key)[=:]/iu.test(value)
  );
}

function scanSecretBearingStrings(value, path, findings) {
  if (typeof value === "string") {
    if (secretLike(value)) {
      findings.push(finding("secret_bearing_text", path, "Rental housing records cannot retain credentials, contact identifiers, precise addresses, or long account-like numbers."));
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) scanSecretBearingStrings(item, `${path}/${index}`, findings);
    return;
  }
  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) scanSecretBearingStrings(item, path ? `${path}/${key}` : key, findings);
  }
}

const compatibleActionKinds = new Map([
  ["rent-or-payment", new Set(["make-payment", "review-record"])],
  ["notice", new Set(["send-notice", "review-record"])],
  ["access", new Set(["schedule", "grant-access", "review-record"])],
  ["maintenance", new Set(["submit-maintenance-request", "schedule", "grant-access", "authorize-repair", "review-record"])],
  ["condition", new Set(["review-record"])],
  ["move", new Set(["send-notice", "schedule", "return-property", "review-record"])],
  ["deposit-or-charge", new Set(["make-payment", "respond-to-charge", "review-record"])],
  ["other-supplied-obligation", new Set(["send-notice", "schedule", "review-record", "other-owner-action"])],
]);

const helperActionKinds = new Set(["submit-maintenance-request", "review-record"]);

export function rentalHousingFindings(value) {
  const findings = [];
  if (!isRecord(value)) {
    return [finding("invalid_rental_housing_ledger", "", "Rental housing ledger must be an object.")];
  }

  const tenancy = isRecord(value.tenancy) ? value.tenancy : {};
  const review = isRecord(value.review) ? value.review : {};
  const prohibited = isRecord(value.prohibitedActions) ? value.prohibitedActions : {};
  const authorities = indexById(value.authorities);
  const sources = indexById(value.sources);
  const leaseRevisions = indexById(value.leaseRevisions);
  const obligations = indexById(value.obligations);
  const conditionItems = indexById(value.conditionItems);
  const maintenanceEpisodes = indexById(value.maintenanceEpisodes);
  const notices = indexById(value.notices);
  const payments = indexById(value.payments);
  const accessEvents = indexById(value.accessEvents);
  const actions = indexById(value.actions);
  const moveStates = indexById(value.moveStates);
  const returnedProperties = indexById(value.returnedProperties);
  const charges = indexById(value.charges);
  const gaps = indexById(value.gaps);

  if (value.schemaVersion !== "awesomeClaws.rentalHousingLedger.v1") {
    findings.push(finding("invalid_schema_version", "schemaVersion", "Unexpected rental housing schema version."));
  }
  scanSecretBearingStrings(value, "", findings);

  checkUniqueIds(
    {
      tenancies: [tenancy],
      authorities: value.authorities,
      sources: value.sources,
      leaseRevisions: value.leaseRevisions,
      obligations: value.obligations,
      conditionItems: value.conditionItems,
      maintenanceEpisodes: value.maintenanceEpisodes,
      notices: value.notices,
      payments: value.payments,
      accessEvents: value.accessEvents,
      actions: value.actions,
      moveStates: value.moveStates,
      returnedProperties: value.returnedProperties,
      charges: value.charges,
      gaps: value.gaps,
    },
    findings,
  );

  for (const [field, index] of [
    ["leaseRevisionRefs", leaseRevisions],
    ["obligationRefs", obligations],
    ["conditionItemRefs", conditionItems],
    ["maintenanceEpisodeRefs", maintenanceEpisodes],
    ["noticeRefs", notices],
    ["paymentRefs", payments],
    ["accessEventRefs", accessEvents],
    ["actionRefs", actions],
    ["moveStateRefs", moveStates],
    ["returnedPropertyRefs", returnedProperties],
    ["chargeRefs", charges],
    ["gapRefs", gaps],
  ]) {
    if (!sameSet(tenancy[field], [...index.keys()])) {
      findings.push(finding("incomplete_tenancy_index", `tenancy/${field}`, `${field} must exactly index its tenancy collection.`));
    }
  }

  const renter = authorities.get(tenancy.renterAuthorityRef);
  const landlord = authorities.get(tenancy.landlordAuthorityRef);
  if (!renter || renter.kind !== "renter-owner") {
    findings.push(finding("invalid_renter_authority", "tenancy/renterAuthorityRef", "The tenancy owner must reference a renter-owner authority."));
  }
  if (!landlord || landlord.kind !== "landlord-or-manager" || tenancy.landlordAuthorityRef === tenancy.renterAuthorityRef) {
    findings.push(finding("invalid_landlord_authority", "tenancy/landlordAuthorityRef", "The tenancy landlord must reference a distinct landlord-or-manager authority."));
  }
  const declaredHelpers = [...authorities.values()].filter((row) => row.kind === "authorized-helper").map((row) => row.id);
  if (!sameSet(tenancy.authorizedHelperRefs, declaredHelpers)) {
    findings.push(finding("incomplete_helper_index", "tenancy/authorizedHelperRefs", "The helper index must exactly cover authorized-helper authorities."));
  }
  const permittedOwners = new Set([tenancy.renterAuthorityRef, ...rows(tenancy.authorizedHelperRefs)]);

  const asOf = exactInstant(tenancy.asOf);
  if (asOf === null || review.asOf !== tenancy.asOf) {
    findings.push(finding("invalid_review_boundary", "review/asOf", "Tenancy and review must share one exact as-of boundary."));
  }
  if (review.nextRevision !== tenancy.revision + 1) {
    findings.push(finding("invalid_revision_lineage", "review/nextRevision", "The next revision must increment the tenancy revision by one."));
  }
  if (tenancy.revision === 1 ? tenancy.previousRevisionRef !== null : tenancy.previousRevisionRef === null) {
    findings.push(finding("invalid_revision_lineage", "tenancy/previousRevisionRef", "Only revision one may omit its predecessor reference."));
  }
  if (review.nextOwnerAuthorityRef !== tenancy.renterAuthorityRef) {
    findings.push(finding("invalid_next_owner", "review/nextOwnerAuthorityRef", "The handoff must return to the renter owner."));
  }
  if (secretLike(tenancy.generalizedPremisesRef) || rows(tenancy.jurisdictions).some(secretLike)) {
    findings.push(finding("secret_bearing_identifier", "tenancy", "Premises and jurisdiction labels must remain generalized and non-secret."));
  }

  for (const [id, authority] of authorities) {
    if (secretLike(authority.label)) {
      findings.push(finding("secret_bearing_identifier", `authorities/${id}/label`, "Authority labels cannot carry personal identifiers, precise addresses, or secrets."));
    }
    if (authority.kind === "authorized-helper") {
      const source = requireRef(sources, authority.authorizationSourceRef, `authorities/${id}/authorizationSourceRef`, "unknown_source", findings);
      if (!source || source.kind !== "helper-authorization" || source.subjectRef !== id || source.issuerAuthorityRef !== tenancy.renterAuthorityRef) {
        findings.push(finding("invalid_helper_authorization", `authorities/${id}/authorizationSourceRef`, "Helpers require a same-subject authorization from the renter owner."));
      }
    } else if (authority.authorizationSourceRef !== null) {
      findings.push(finding("invalid_authority_source", `authorities/${id}/authorizationSourceRef`, "Only explicitly authorized helpers may carry an authorization source."));
    }
  }

  const subjectSets = new Map([
    ["helper-authorization", new Set(declaredHelpers)],
    ["lease-document", new Set(leaseRevisions.keys())],
    ["lease-amendment", new Set(leaseRevisions.keys())],
    ["official-procedure", new Set([...obligations.keys(), ...notices.keys()])],
    ["landlord-notice", new Set(notices.keys())],
    ["renter-observation", new Set([...conditionItems.keys(), ...accessEvents.keys(), ...moveStates.keys()])],
    ["qualified-finding", new Set([...conditionItems.keys(), ...maintenanceEpisodes.keys(), ...gaps.keys()])],
    ["renter-action-note", new Set(actions.keys())],
    ["independent-receipt", new Set(actions.keys())],
    ["payment-statement", new Set(payments.keys())],
    ["payment-receipt", new Set(payments.keys())],
    ["maintenance-response", new Set(maintenanceEpisodes.keys())],
    ["access-notice", new Set([...notices.keys(), ...accessEvents.keys()])],
    ["move-condition-record", new Set([...moveStates.keys(), ...conditionItems.keys()])],
    ["deposit-or-charge-statement", new Set([...charges.keys(), ...moveStates.keys()])],
    ["returned-property-receipt", new Set(returnedProperties.keys())],
    ["owner-decision", new Set([...actions.keys(), ...accessEvents.keys(), ...charges.keys()])],
  ]);
  const landlordKinds = new Set(["lease-document", "lease-amendment", "landlord-notice", "payment-statement", "maintenance-response", "access-notice", "deposit-or-charge-statement"]);
  for (const [id, source] of sources) {
    const issuedAt = exactInstant(source.issuedAt);
    const retrievedAt = exactInstant(source.retrievedAt);
    if (issuedAt === null || retrievedAt === null || issuedAt > retrievedAt || asOf === null || retrievedAt > asOf) {
      findings.push(finding("invalid_source_chronology", `sources/${id}`, "Source issue and retrieval times must be exact, ordered, and no later than review."));
    }
    const issuer = requireRef(authorities, source.issuerAuthorityRef, `sources/${id}/issuerAuthorityRef`, "unknown_authority", findings);
    if (["renter-observation", "renter-action-note", "owner-decision"].includes(source.kind) && !permittedOwners.has(source.issuerAuthorityRef)) {
      findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Renter evidence must come from the renter or an explicitly authorized helper."));
    } else if (source.kind === "helper-authorization" && source.issuerAuthorityRef !== tenancy.renterAuthorityRef) {
      findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Helper authorization must come from the renter owner."));
    } else if (landlordKinds.has(source.kind) && source.issuerAuthorityRef !== tenancy.landlordAuthorityRef) {
      findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Landlord or manager evidence must come from the declared landlord authority."));
    } else if (source.kind === "official-procedure" && !["landlord-or-manager", "housing-authority"].includes(issuer?.kind)) {
      findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Official procedures require a landlord, manager, or housing-authority issuer."));
    } else if (source.kind === "qualified-finding" && issuer?.kind !== "qualified-specialist") {
      findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Qualified findings require a qualified-specialist issuer."));
    } else if (["independent-receipt", "payment-receipt", "returned-property-receipt"].includes(source.kind) && permittedOwners.has(source.issuerAuthorityRef)) {
      findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Independent receipts cannot be self-issued by the renter or helper."));
    } else if (source.kind === "move-condition-record" && !permittedOwners.has(source.issuerAuthorityRef) && source.issuerAuthorityRef !== tenancy.landlordAuthorityRef) {
      findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Move condition records require a renter, helper, or landlord issuer."));
    }
    if (!rows(tenancy.jurisdictions).includes(source.jurisdiction)) {
      findings.push(finding("invalid_source_jurisdiction", `sources/${id}/jurisdiction`, "Every source must use a declared tenancy jurisdiction."));
    }
    if (!subjectSets.get(source.kind)?.has(source.subjectRef)) {
      findings.push(finding("invalid_source_subject", `sources/${id}/subjectRef`, "Source kind and subject record type must agree."));
    }
    if (source.redaction !== "minimized-reference-only" || source.containsSecrets !== false || secretLike(source.controlledRef)) {
      findings.push(finding("secret_bearing_source", `sources/${id}`, "Sources must use minimized controlled references and contain no secret-bearing values."));
    }
  }

  const controlling = [...leaseRevisions.values()].filter((row) => row.state === "controlling");
  if (controlling.length !== 1) {
    findings.push(finding("invalid_controlling_lease", "leaseRevisions", "Exactly one lease revision must be controlling."));
  }
  const controllingLease = controlling[0];
  for (const [id, lease] of leaseRevisions) {
    const source = requireRef(sources, lease.sourceRef, `leaseRevisions/${id}/sourceRef`, "unknown_source", findings);
    const effectiveAt = exactInstant(lease.effectiveAt);
    const endedAt = lease.endedAt === null ? null : exactInstant(lease.endedAt);
    if (!source || !["lease-document", "lease-amendment"].includes(source.kind) || source.subjectRef !== id || source.issuerAuthorityRef !== tenancy.landlordAuthorityRef || source.revision !== lease.revision) {
      findings.push(finding("invalid_lease_source", `leaseRevisions/${id}/sourceRef`, "Lease revisions require a same-subject landlord-issued lease source with the same revision."));
    }
    if (effectiveAt === null || (endedAt !== null && endedAt <= effectiveAt) || (asOf !== null && effectiveAt > asOf && lease.state !== "future")) {
      findings.push(finding("invalid_lease_chronology", `leaseRevisions/${id}`, "Lease effective and end times must be exact, ordered, and consistent with state."));
    }
    if (lease.state === "controlling" && (lease.endedAt !== null || source?.freshness !== "current")) {
      findings.push(finding("stale_controlling_lease", `leaseRevisions/${id}`, "The controlling lease must be current and open-ended."));
    }
    if (lease.state === "superseded" && (lease.successorRef === null || lease.endedAt === null)) {
      findings.push(finding("invalid_lease_lineage", `leaseRevisions/${id}`, "A superseded lease needs an end time and successor."));
    }
    if (lease.predecessorRef !== null) {
      const predecessor = requireRef(leaseRevisions, lease.predecessorRef, `leaseRevisions/${id}/predecessorRef`, "unknown_lease_revision", findings);
      if (predecessor?.successorRef !== id) findings.push(finding("invalid_lease_lineage", `leaseRevisions/${id}/predecessorRef`, "Lease predecessor and successor links must be reciprocal."));
    }
    if (lease.successorRef !== null) {
      const successor = requireRef(leaseRevisions, lease.successorRef, `leaseRevisions/${id}/successorRef`, "unknown_lease_revision", findings);
      if (successor?.predecessorRef !== id) findings.push(finding("invalid_lease_lineage", `leaseRevisions/${id}/successorRef`, "Lease predecessor and successor links must be reciprocal."));
    }
    if (lease.interpretedByClaw !== false) findings.push(finding("legal_interpretation_claim", `leaseRevisions/${id}/interpretedByClaw`, "The Claw cannot interpret a lease."));
  }

  for (const [id, obligation] of obligations) {
    const lease = requireRef(leaseRevisions, obligation.leaseRevisionRef, `obligations/${id}/leaseRevisionRef`, "unknown_lease_revision", findings);
    refs(sources, obligation.sourceRefs, `obligations/${id}/sourceRefs`, "unknown_source", findings);
    refs(actions, obligation.actionRefs, `obligations/${id}/actionRefs`, "unknown_action", findings);
    if (obligation.state !== "superseded" && lease?.id !== controllingLease?.id) {
      findings.push(finding("stale_obligation_lease", `obligations/${id}/leaseRevisionRef`, "Current obligations must bind the controlling lease revision."));
    }
    const dueAt = obligation.dueAt === null ? null : exactInstant(obligation.dueAt);
    if (obligation.dueAt !== null && dueAt === null) findings.push(finding("invalid_obligation_deadline", `obligations/${id}/dueAt`, "Obligation deadlines must be exact timestamps."));
    for (const actionRef of rows(obligation.actionRefs)) {
      const action = actions.get(actionRef);
      if (action && !compatibleActionKinds.get(obligation.kind)?.has(action.kind)) {
        findings.push(finding("incompatible_obligation_action", `obligations/${id}/actionRefs`, `Action ${actionRef} is not compatible with the ${String(obligation.kind)} obligation.`));
      }
    }
    if (obligation.externalExecution !== "owner-only" || obligation.legalConclusion !== false) {
      findings.push(finding("external_authority_claim", `obligations/${id}`, "Obligations remain owner-executed and non-interpretive."));
    }
  }
  for (const id of actions.keys()) {
    if (![...obligations.values()].some((obligation) => rows(obligation.actionRefs).includes(id))) {
      findings.push(finding("uncovered_action", `actions/${id}`, "Every action must be covered by at least one supplied obligation."));
    }
  }

  for (const [id, condition] of conditionItems) {
    refs(sources, condition.sourceRefs, `conditionItems/${id}/sourceRefs`, "unknown_source", findings);
    refs(maintenanceEpisodes, condition.maintenanceEpisodeRefs, `conditionItems/${id}/maintenanceEpisodeRefs`, "unknown_maintenance_episode", findings);
    refs(charges, condition.chargeRefs, `conditionItems/${id}/chargeRefs`, "unknown_charge", findings);
    refs(gaps, condition.gapRefs, `conditionItems/${id}/gapRefs`, "unknown_gap", findings);
    const expectedMaintenance = [...maintenanceEpisodes.values()].filter((row) => rows(row.conditionItemRefs).includes(id)).map((row) => row.id);
    const expectedCharges = [...charges.values()].filter((row) => rows(row.conditionItemRefs).includes(id)).map((row) => row.id);
    const expectedGaps = [...gaps.values()].filter((row) => rows(row.subjectRefs).includes(id)).map((row) => row.id);
    if (!sameSet(condition.maintenanceEpisodeRefs, expectedMaintenance) || !sameSet(condition.chargeRefs, expectedCharges) || !sameSet(condition.gapRefs, expectedGaps)) {
      findings.push(finding("incomplete_condition_index", `conditionItems/${id}`, "Condition maintenance, charge, and gap indexes must be reciprocal and complete."));
    }
    const sourceRows = rows(condition.sourceRefs).map((ref) => sources.get(ref)).filter(Boolean);
    const validAssertion =
      (condition.assertionState === "renter-observed" && sourceRows.some((row) => ["renter-observation", "move-condition-record"].includes(row.kind))) ||
      (condition.assertionState === "qualified-observed" && sourceRows.some((row) => row.kind === "qualified-finding")) ||
      (condition.assertionState === "landlord-positioned" && sourceRows.some((row) => ["landlord-notice", "maintenance-response", "deposit-or-charge-statement"].includes(row.kind))) ||
      (condition.assertionState === "conflicting" && new Set(sourceRows.map((row) => row.issuerAuthorityRef)).size >= 2);
    if (!validAssertion) findings.push(finding("invalid_condition_assertion", `conditionItems/${id}/assertionState`, "Condition assertion state requires matching attributed evidence."));
    if (secretLike(condition.generalizedAreaRef) || secretLike(condition.redactedItemRef)) {
      findings.push(finding("secret_bearing_identifier", `conditionItems/${id}`, "Condition identifiers must remain generalized and redacted."));
    }
    if (condition.habitabilityDetermination !== false || condition.faultDetermination !== false || condition.safetyDetermination !== false) {
      findings.push(finding("prohibited_condition_determination", `conditionItems/${id}`, "Condition records cannot become habitability, fault, or safety determinations."));
    }
  }

  for (const [id, episode] of maintenanceEpisodes) {
    refs(conditionItems, episode.conditionItemRefs, `maintenanceEpisodes/${id}/conditionItemRefs`, "unknown_condition_item", findings);
    refs(sources, episode.sourceRefs, `maintenanceEpisodes/${id}/sourceRefs`, "unknown_source", findings);
    refs(actions, episode.actionRefs, `maintenanceEpisodes/${id}/actionRefs`, "unknown_action", findings);
    refs(accessEvents, episode.accessEventRefs, `maintenanceEpisodes/${id}/accessEventRefs`, "unknown_access_event", findings);
    refs(gaps, episode.gapRefs, `maintenanceEpisodes/${id}/gapRefs`, "unknown_gap", findings);
    const expectedActions = [...actions.values()].filter((row) => row.subjectRef === id).map((row) => row.id);
    const expectedAccess = [...accessEvents.values()].filter((row) => row.maintenanceEpisodeRef === id).map((row) => row.id);
    const expectedGaps = [...gaps.values()].filter((row) => rows(row.subjectRefs).includes(id)).map((row) => row.id);
    if (!sameSet(episode.actionRefs, expectedActions) || !sameSet(episode.accessEventRefs, expectedAccess) || !sameSet(episode.gapRefs, expectedGaps)) {
      findings.push(finding("incomplete_maintenance_index", `maintenanceEpisodes/${id}`, "Maintenance action, access, and gap indexes must be reciprocal and complete."));
    }
    if (exactInstant(episode.openedAt) === null || (asOf !== null && exactInstant(episode.openedAt) > asOf)) {
      findings.push(finding("invalid_maintenance_chronology", `maintenanceEpisodes/${id}/openedAt`, "Maintenance opening time must be exact and no later than review."));
    }
    if (episode.state === "provider-attended" && (!rows(episode.sourceRefs).some((ref) => sources.get(ref)?.kind === "qualified-finding") || !rows(episode.accessEventRefs).some((ref) => accessEvents.get(ref)?.state === "owner-observed-occurred"))) {
      findings.push(finding("unsupported_maintenance_state", `maintenanceEpisodes/${id}/state`, "Provider-attended state needs qualified evidence and an observed access event."));
    }
    if (episode.state === "landlord-positioned-resolved" && !rows(episode.sourceRefs).some((ref) => sources.get(ref)?.kind === "maintenance-response")) {
      findings.push(finding("unsupported_maintenance_state", `maintenanceEpisodes/${id}/state`, "Landlord-positioned resolution requires a landlord maintenance response."));
    }
    if (episode.repairSufficiencyDetermination !== false || episode.habitabilityDetermination !== false) {
      findings.push(finding("prohibited_maintenance_conclusion", `maintenanceEpisodes/${id}`, "Maintenance records cannot claim repair sufficiency or habitability."));
    }
  }

  for (const [id, notice] of notices) {
    const lease = requireRef(leaseRevisions, notice.leaseRevisionRef, `notices/${id}/leaseRevisionRef`, "unknown_lease_revision", findings);
    const source = requireRef(sources, notice.sourceRef, `notices/${id}/sourceRef`, "unknown_source", findings);
    refs(actions, notice.actionRefs, `notices/${id}/actionRefs`, "unknown_action", findings);
    const expectedActions = [...actions.values()].filter((row) => row.subjectRef === id).map((row) => row.id);
    if (!sameSet(notice.actionRefs, expectedActions)) findings.push(finding("incomplete_notice_index", `notices/${id}/actionRefs`, "Notice actions must be reciprocal and complete."));
    if (!source || !["landlord-notice", "access-notice", "official-procedure"].includes(source.kind) || source.subjectRef !== id || exactInstant(source.issuedAt) !== exactInstant(notice.issuedAt)) {
      findings.push(finding("invalid_notice_source", `notices/${id}/sourceRef`, "Notices require a same-subject authoritative source with the same issue time."));
    }
    if (notice.state !== "superseded" && (lease?.id !== controllingLease?.id || source?.freshness !== "current")) {
      findings.push(finding("stale_current_notice", `notices/${id}`, "Current notices require the controlling lease and current source evidence."));
    }
    const issuedAt = exactInstant(notice.issuedAt);
    for (const [field, raw] of [["effectiveAt", notice.effectiveAt], ["deadlineAt", notice.deadlineAt]]) {
      const instant = raw === null ? null : exactInstant(raw);
      if (raw !== null && (instant === null || issuedAt === null || instant < issuedAt)) findings.push(finding("invalid_notice_chronology", `notices/${id}/${field}`, "Notice dates must be exact and cannot predate issue."));
    }
    if (notice.legalValidityDetermination !== false) findings.push(finding("legal_interpretation_claim", `notices/${id}/legalValidityDetermination`, "The Claw cannot determine notice validity."));
  }

  const receiptKinds = new Set(["independent-receipt", "payment-receipt", "returned-property-receipt"]);
  for (const [id, action] of actions) {
    const owner = requireRef(authorities, action.ownerAuthorityRef, `actions/${id}/ownerAuthorityRef`, "unknown_authority", findings);
    refs(sources, action.sourceRefs, `actions/${id}/sourceRefs`, "unknown_source", findings);
    const allSubjects = new Set([...maintenanceEpisodes.keys(), ...notices.keys(), ...payments.keys(), ...returnedProperties.keys(), ...charges.keys(), ...obligations.keys(), ...accessEvents.keys()]);
    if (!allSubjects.has(action.subjectRef)) findings.push(finding("invalid_action_subject", `actions/${id}/subjectRef`, "Action subject must reference an in-scope tenancy record."));
    if (!owner || !permittedOwners.has(action.ownerAuthorityRef)) findings.push(finding("invalid_action_owner", `actions/${id}/ownerAuthorityRef`, "Actions require the renter or an explicitly authorized helper."));
    if (owner?.kind === "authorized-helper" && !helperActionKinds.has(action.kind)) {
      findings.push(finding("helper_action_scope_exceeded", `actions/${id}/ownerAuthorityRef`, "Authorized helpers may only submit maintenance requests or review records; all other actions remain with the renter owner."));
    }
    const attemptedAt = action.attemptedAt === null ? null : exactInstant(action.attemptedAt);
    if (["attempted", "failed", "owner-completed-receipted"].includes(action.state) && (attemptedAt === null || (asOf !== null && attemptedAt > asOf))) {
      findings.push(finding("invalid_action_chronology", `actions/${id}/attemptedAt`, "Attempted or completed actions need an exact time no later than review."));
    }
    if (action.state === "owner-completed-receipted") {
      const receipt = requireRef(sources, action.receiptSourceRef, `actions/${id}/receiptSourceRef`, "unknown_source", findings);
      if (!receipt || !receiptKinds.has(receipt.kind) || ![id, action.subjectRef].includes(receipt.subjectRef) || permittedOwners.has(receipt.issuerAuthorityRef) || !rows(action.sourceRefs).includes(action.receiptSourceRef)) {
        findings.push(finding("invalid_action_receipt", `actions/${id}/receiptSourceRef`, "Completed owner actions require an independent receipt for the action or exact subject."));
      }
      if (!rows(action.sourceRefs).some((ref) => sources.get(ref)?.kind === "renter-action-note" && sources.get(ref)?.subjectRef === id)) {
        findings.push(finding("missing_action_evidence", `actions/${id}/sourceRefs`, "Completed actions need a same-action renter record plus an independent receipt."));
      }
    } else if (action.receiptSourceRef !== null) {
      findings.push(finding("premature_action_receipt", `actions/${id}/receiptSourceRef`, "Only completed-receipted actions may claim a receipt."));
    }
    for (const sourceRef of rows(action.sourceRefs)) {
      const source = sources.get(sourceRef);
      if (source && source.subjectRef !== id && source.subjectRef !== action.subjectRef) {
        findings.push(finding("cross_subject_action_evidence", `actions/${id}/sourceRefs`, "Action evidence must bind the action or its exact subject."));
      }
    }
    if (action.externalExecution !== "owner-only" || action.agentExecuted !== false) {
      findings.push(finding("external_authority_claim", `actions/${id}`, "Every external tenancy action remains owner-executed."));
    }
  }

  for (const [id, payment] of payments) {
    const obligation = requireRef(obligations, payment.obligationRef, `payments/${id}/obligationRef`, "unknown_obligation", findings);
    const statement = requireRef(sources, payment.statementSourceRef, `payments/${id}/statementSourceRef`, "unknown_source", findings);
    const action = payment.actionRef === null ? null : requireRef(actions, payment.actionRef, `payments/${id}/actionRef`, "unknown_action", findings);
    if (!obligation || obligation.kind !== "rent-or-payment" || !statement || statement.kind !== "payment-statement" || statement.subjectRef !== id) {
      findings.push(finding("invalid_payment_binding", `payments/${id}`, "Payments require a rent/payment obligation and same-subject landlord statement."));
    }
    if (action && (action.kind !== "make-payment" || action.subjectRef !== id)) findings.push(finding("invalid_payment_action", `payments/${id}/actionRef`, "Payment actions must be same-subject make-payment actions."));
    const receipt = payment.receiptSourceRef === null ? null : requireRef(sources, payment.receiptSourceRef, `payments/${id}/receiptSourceRef`, "unknown_source", findings);
    if (payment.state === "independently-receipted" && (!receipt || receipt.kind !== "payment-receipt" || receipt.subjectRef !== id || permittedOwners.has(receipt.issuerAuthorityRef))) {
      findings.push(finding("invalid_payment_receipt", `payments/${id}/receiptSourceRef`, "Independently receipted payments require a same-payment external receipt."));
    }
    if (payment.state !== "independently-receipted" && payment.receiptSourceRef !== null) findings.push(finding("premature_payment_receipt", `payments/${id}/receiptSourceRef`, "Only independently receipted payments may carry a receipt."));
    if (payment.paymentValidityDetermination !== false) findings.push(finding("payment_validity_claim", `payments/${id}/paymentValidityDetermination`, "The Claw cannot determine payment validity."));
  }

  for (const [id, access] of accessEvents) {
    if (access.noticeRef !== null) requireRef(notices, access.noticeRef, `accessEvents/${id}/noticeRef`, "unknown_notice", findings);
    if (access.maintenanceEpisodeRef !== null) requireRef(maintenanceEpisodes, access.maintenanceEpisodeRef, `accessEvents/${id}/maintenanceEpisodeRef`, "unknown_maintenance_episode", findings);
    refs(sources, access.sourceRefs, `accessEvents/${id}/sourceRefs`, "unknown_source", findings);
    const scheduledAt = exactInstant(access.scheduledAt);
    const occurredAt = access.occurredAt === null ? null : exactInstant(access.occurredAt);
    if (scheduledAt === null || (occurredAt !== null && (occurredAt < scheduledAt || (asOf !== null && occurredAt > asOf)))) findings.push(finding("invalid_access_chronology", `accessEvents/${id}`, "Access schedule and occurrence must be exact and ordered."));
    if (access.state === "owner-observed-occurred" && (occurredAt === null || !rows(access.sourceRefs).some((ref) => sources.get(ref)?.kind === "renter-observation" && sources.get(ref)?.subjectRef === id))) {
      findings.push(finding("unsupported_access_state", `accessEvents/${id}/state`, "Observed access requires a same-event renter observation."));
    }
    if (access.ownerConsentClaim !== false || access.legalAccessDetermination !== false) findings.push(finding("prohibited_access_conclusion", `accessEvents/${id}`, "Access records cannot infer consent or lawful access."));
  }

  for (const [id, returned] of returnedProperties) {
    const action = requireRef(actions, returned.actionRef, `returnedProperties/${id}/actionRef`, "unknown_action", findings);
    if (!action || action.kind !== "return-property" || action.subjectRef !== id) findings.push(finding("invalid_return_action", `returnedProperties/${id}/actionRef`, "Returned property needs a same-subject return action."));
    const receipt = returned.receiptSourceRef === null ? null : requireRef(sources, returned.receiptSourceRef, `returnedProperties/${id}/receiptSourceRef`, "unknown_source", findings);
    if (returned.state === "independently-receipted-returned" && (!receipt || receipt.kind !== "returned-property-receipt" || receipt.subjectRef !== id || permittedOwners.has(receipt.issuerAuthorityRef))) {
      findings.push(finding("invalid_return_receipt", `returnedProperties/${id}/receiptSourceRef`, "Receipted return needs an independent same-property receipt."));
    }
    if (returned.state === "independently-receipted-returned" && (action?.state !== "owner-completed-receipted" || action?.receiptSourceRef !== returned.receiptSourceRef)) {
      findings.push(finding("inconsistent_return_receipt", `returnedProperties/${id}`, "An independently receipted return requires a completed same-property action carrying the exact same receipt."));
    }
    if (returned.state !== "independently-receipted-returned" && returned.receiptSourceRef !== null) findings.push(finding("premature_return_receipt", `returnedProperties/${id}/receiptSourceRef`, "Only independently receipted returns may carry a receipt."));
    if (secretLike(returned.redactedLabel)) findings.push(finding("secret_bearing_identifier", `returnedProperties/${id}/redactedLabel`, "Returned-property labels must remain redacted."));
  }

  for (const [id, charge] of charges) {
    const source = requireRef(sources, charge.statementSourceRef, `charges/${id}/statementSourceRef`, "unknown_source", findings);
    refs(conditionItems, charge.conditionItemRefs, `charges/${id}/conditionItemRefs`, "unknown_condition_item", findings);
    const payment = charge.paymentRef === null ? null : requireRef(payments, charge.paymentRef, `charges/${id}/paymentRef`, "unknown_payment", findings);
    if (!source || source.kind !== "deposit-or-charge-statement" || source.subjectRef !== id || source.issuerAuthorityRef !== tenancy.landlordAuthorityRef) {
      findings.push(finding("invalid_charge_statement", `charges/${id}/statementSourceRef`, "Charges require a same-charge landlord statement."));
    }
    const appropriatePayment =
      (charge.state === "paid" && ["owner-reported-paid", "independently-receipted"].includes(payment?.state)) ||
      (charge.state === "credited" && payment?.state === "credited");
    if (["paid", "credited"].includes(charge.state) && !appropriatePayment) {
      findings.push(finding("invalid_charge_payment", `charges/${id}/paymentRef`, "Paid and credited charges require a payment record in the corresponding paid or credited state."));
    }
    if (charge.entitlementDetermination !== false) findings.push(finding("entitlement_claim", `charges/${id}/entitlementDetermination`, "The Claw cannot determine charge or deposit entitlement."));
  }

  const allSubjectIds = new Set([tenancy.id, ...authorities.keys(), ...leaseRevisions.keys(), ...obligations.keys(), ...conditionItems.keys(), ...maintenanceEpisodes.keys(), ...notices.keys(), ...payments.keys(), ...accessEvents.keys(), ...actions.keys(), ...moveStates.keys(), ...returnedProperties.keys(), ...charges.keys(), ...gaps.keys()]);
  for (const [id, move] of moveStates) {
    refs(conditionItems, move.conditionItemRefs, `moveStates/${id}/conditionItemRefs`, "unknown_condition_item", findings);
    refs(returnedProperties, move.returnedPropertyRefs, `moveStates/${id}/returnedPropertyRefs`, "unknown_returned_property", findings);
    refs(charges, move.chargeRefs, `moveStates/${id}/chargeRefs`, "unknown_charge", findings);
    refs(sources, move.sourceRefs, `moveStates/${id}/sourceRefs`, "unknown_source", findings);
    refs(gaps, move.gapRefs, `moveStates/${id}/gapRefs`, "unknown_gap", findings);
    if (move.phase === "move-out") {
      const expectedProperties = [...returnedProperties.keys()];
      const expectedCharges = [...charges.keys()];
      if (!sameSet(move.returnedPropertyRefs, expectedProperties) || !sameSet(move.chargeRefs, expectedCharges)) findings.push(finding("incomplete_move_out_index", `moveStates/${id}`, "Move-out must exactly index returned property and charges."));
    }
    if (move.closureDetermination !== false) findings.push(finding("premature_closure_claim", `moveStates/${id}/closureDetermination`, "Move state cannot determine tenancy closure."));
  }

  for (const [id, gap] of gaps) {
    refs(sources, gap.sourceRefs, `gaps/${id}/sourceRefs`, "unknown_source", findings);
    requireRef(authorities, gap.nextOwnerAuthorityRef, `gaps/${id}/nextOwnerAuthorityRef`, "unknown_authority", findings);
    for (const ref of rows(gap.subjectRefs)) {
      if (!allSubjectIds.has(ref)) findings.push(finding("unknown_gap_subject", `gaps/${id}/subjectRefs`, `Unknown gap subject ${ref}.`));
      if (ref === id) findings.push(finding("self_referential_gap", `gaps/${id}/subjectRefs`, "Gaps cannot reference themselves."));
    }
    if (gap.state === "open" && gap.resolutionSourceRef !== null) findings.push(finding("invalid_gap_resolution", `gaps/${id}/resolutionSourceRef`, "Open gaps cannot carry resolution evidence."));
    if (gap.state === "resolved") {
      const source = requireRef(sources, gap.resolutionSourceRef, `gaps/${id}/resolutionSourceRef`, "unknown_source", findings);
      if (!source) findings.push(finding("invalid_gap_resolution", `gaps/${id}/resolutionSourceRef`, "Resolved gaps require a valid resolution source."));
    }
  }

  const openGapRefs = [...gaps.values()].filter((row) => row.state === "open").map((row) => row.id);
  const missingReceiptActionRefs = [...actions.values()].filter((row) => ["attempted", "failed"].includes(row.state) && row.receiptSourceRef === null).map((row) => row.id);
  const disputedChargeRefs = [...charges.values()].filter((row) => row.state === "disputed").map((row) => row.id);
  const safetyGapRefs = [...gaps.values()].filter((row) => row.state === "open" && row.kind === "safety-question").map((row) => row.id);
  const deadlineRefs = [
    ...[...obligations.values()].filter((row) => row.dueAt !== null).map((row) => row.id),
    ...[...notices.values()].filter((row) => row.deadlineAt !== null).map((row) => row.id),
  ];
  if (!sameSet(review.openGapRefs, openGapRefs)) findings.push(finding("incomplete_review_index", "review/openGapRefs", "Review must exactly index open gaps."));
  if (!sameSet(review.missingReceiptActionRefs, missingReceiptActionRefs)) findings.push(finding("incomplete_missing_receipt_index", "review/missingReceiptActionRefs", "Review must exactly index attempted or failed actions missing receipts."));
  if (!sameSet(review.disputedChargeRefs, disputedChargeRefs)) findings.push(finding("incomplete_disputed_charge_index", "review/disputedChargeRefs", "Review must exactly index disputed charges."));
  if (!sameSet(review.safetyGapRefs, safetyGapRefs)) findings.push(finding("incomplete_safety_gap_index", "review/safetyGapRefs", "Review must exactly index open safety questions."));
  if (!sameSet(review.deadlineRefs, deadlineRefs)) findings.push(finding("incomplete_deadline_index", "review/deadlineRefs", "Review must exactly index every obligation and notice carrying a deadline."));
  for (const ref of rows(review.deadlineRefs)) {
    if (!notices.has(ref) && !obligations.has(ref)) findings.push(finding("invalid_deadline_ref", "review/deadlineRefs", `Unknown deadline-bearing record ${ref}.`));
  }
  if (review.tenancyClosureClaim !== false || review.legalRightsConclusion !== false || review.habitabilityConclusion !== false || review.entitlementConclusion !== false) {
    findings.push(finding("premature_review_conclusion", "review", "Review cannot claim closure, legal rights, habitability, or entitlement."));
  }

  if (Object.values(prohibited).some((value) => value !== false)) {
    findings.push(finding("prohibited_authority_claim", "prohibitedActions", "All prohibited external actions and conclusions must remain false."));
  }

  return findings;
}
