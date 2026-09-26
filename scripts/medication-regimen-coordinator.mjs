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

function dateValue(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
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
    /\b\d{1,6}\s+(?:[A-Za-z]+\s){0,4}(?:street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr|court|ct)\b/iu.test(value) ||
    /(?:password|passcode|door[-_ ]?code|gate[-_ ]?code|security[-_ ]?answer|recovery[-_ ]?code|bearer|api[-_ ]?key|client[-_ ]?secret|private[-_ ]?key)[=:]/iu.test(value)
  );
}

function scanSecretBearingStrings(value, path, findings) {
  if (typeof value === "string") {
    if (secretLike(value)) findings.push(finding("secret_bearing_text", path, "Medication records cannot retain credentials, contact identifiers, precise addresses, or long account-like numbers."));
    return;
  }
  if (Array.isArray(value)) {
    for (const [position, item] of value.entries()) scanSecretBearingStrings(item, `${path}/${position}`, findings);
    return;
  }
  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) scanSecretBearingStrings(item, path ? `${path}/${key}` : key, findings);
  }
}

const clinicalSourceKinds = new Set(["medication-order", "order-change", "order-hold", "order-discontinuation", "clinician-instruction"]);
const dispenserSourceKinds = new Set(["pharmacy-label", "package-record", "dispensing-receipt", "delivery-receipt", "pickup-receipt"]);
const observationSourceKinds = new Set(["owner-observation", "caregiver-observation"]);
const receiptSourceKinds = new Set(["dispensing-receipt", "delivery-receipt", "pickup-receipt"]);
const warningInstructionKinds = new Set(["clinician-instruction", "pharmacist-instruction", "emergency-guidance"]);

const questionAuthorityKinds = new Map([
  ["conflicting-direction", new Set(["prescriber", "pharmacist"])],
  ["medication-identity", new Set(["prescriber", "pharmacist", "dispenser"])],
  ["direction", new Set(["prescriber", "pharmacist"])],
  ["missed-dose", new Set(["prescriber", "pharmacist", "emergency-professional"])],
  ["reaction", new Set(["prescriber", "pharmacist", "emergency-professional"])],
  ["overdose-poison", new Set(["emergency-professional"])],
  ["interaction", new Set(["prescriber", "pharmacist"])],
  ["expiry-storage", new Set(["prescriber", "pharmacist", "dispenser"])],
  ["refill-supply", new Set(["prescriber", "pharmacist", "dispenser"])],
  ["other-qualified-human", new Set(["prescriber", "pharmacist", "dispenser", "emergency-professional"])],
]);

const answerKindsByAuthority = new Map([
  ["prescriber", new Set(["clinician-instruction", "medication-order", "order-change", "order-hold", "order-discontinuation"])],
  ["pharmacist", new Set(["pharmacist-instruction"])],
  ["dispenser", new Set(["pharmacy-label", "package-record", ...receiptSourceKinds])],
  ["emergency-professional", new Set(["emergency-guidance"])],
]);

const gapOwnerKinds = new Map([
  ["identity", new Set(["patient", "guardian", "pharmacist", "dispenser"])],
  ["order-revision", new Set(["prescriber", "pharmacist"])],
  ["conflicting-direction", new Set(["prescriber", "pharmacist"])],
  ["observation", new Set(["patient", "guardian", "caregiver"])],
  ["supply", new Set(["patient", "guardian", "pharmacist", "dispenser"])],
  ["expiry", new Set(["patient", "guardian", "pharmacist", "dispenser"])],
  ["refill-receipt", new Set(["patient", "guardian", "pharmacist", "dispenser"])],
  ["privacy-authority", new Set(["patient", "guardian"])],
  ["urgent-human-review", new Set(["prescriber", "pharmacist", "emergency-professional"])],
]);

export function medicationRegimenFindings(value) {
  const findings = [];
  if (!isRecord(value)) return [finding("invalid_artifact", "", "Medication regimen artifact must be an object.")];

  const review = isRecord(value.review) ? value.review : {};
  const prohibited = isRecord(value.prohibitedActions) ? value.prohibitedActions : {};
  const authorities = indexById(value.authorities);
  const sources = indexById(value.sources);
  const medications = indexById(value.medications);
  const orders = indexById(value.orders);
  const occurrences = indexById(value.occurrences);
  const observations = indexById(value.observations);
  const supplies = indexById(value.supplies);
  const actions = indexById(value.actions);
  const questions = indexById(value.questions);
  const gaps = indexById(value.gaps);

  checkUniqueIds({
    review: [review],
    authorities: value.authorities,
    sources: value.sources,
    medications: value.medications,
    orders: value.orders,
    occurrences: value.occurrences,
    observations: value.observations,
    supplies: value.supplies,
    actions: value.actions,
    questions: value.questions,
    gaps: value.gaps,
  }, findings);
  scanSecretBearingStrings(value, "", findings);

  const periodStart = exactInstant(review.periodStart);
  const periodEnd = exactInstant(review.periodEnd);
  const asOf = exactInstant(review.asOf);
  if (periodStart === null || periodEnd === null || asOf === null || periodStart >= periodEnd || asOf < periodStart || asOf >= periodEnd) {
    findings.push(finding("invalid_review_boundary", "review", "Review requires exact ordered periodStart, asOf, and periodEnd instants with asOf inside the period."));
  }

  const patient = requireRef(authorities, review.patientAuthorityRef, "review/patientAuthorityRef", "invalid_patient_authority", findings);
  const patientSource = patient ? sources.get(patient.authorizationSourceRef) : null;
  if (
    !patient ||
    !["patient", "guardian"].includes(patient.kind) ||
    !rows(patient.scope).includes("patient-owner") ||
    !patientSource ||
    patientSource.kind !== "patient-authorization" ||
    patientSource.subjectRef !== patient.id ||
    patientSource.issuerAuthorityRef !== patient.id ||
    patientSource.freshness !== "current"
  ) {
    findings.push(finding("invalid_patient_authority", "review/patientAuthorityRef", "Review owner must be a patient or guardian with patient-owner scope."));
  }

  const caregiverIds = rows(review.authorizedCaregiverRefs);
  for (const ref of caregiverIds) {
    const caregiver = requireRef(authorities, ref, "review/authorizedCaregiverRefs", "invalid_caregiver_authorization", findings);
    const source = caregiver ? sources.get(caregiver.authorizationSourceRef) : null;
    if (!caregiver || caregiver.kind !== "caregiver" || !rows(caregiver.scope).includes("caregiver-observe") || !source || source.kind !== "caregiver-authorization" || source.subjectRef !== ref || source.issuerAuthorityRef !== review.patientAuthorityRef || source.freshness !== "current") {
      findings.push(finding("invalid_caregiver_authorization", `authorities/${ref}`, "Caregivers require patient-issued, same-caregiver authorization and observe scope."));
    }
  }
  const declaredCaregivers = [...authorities.values()].filter((row) => row.kind === "caregiver").map((row) => row.id);
  if (!sameSet(caregiverIds, declaredCaregivers)) findings.push(finding("incomplete_caregiver_index", "review/authorizedCaregiverRefs", "Review must exactly index every caregiver authority."));

  const allSubjectIds = new Set([
    review.id,
    ...authorities.keys(),
    ...medications.keys(),
    ...orders.keys(),
    ...occurrences.keys(),
    ...observations.keys(),
    ...supplies.keys(),
    ...actions.keys(),
    ...questions.keys(),
    ...gaps.keys(),
  ]);
  for (const [id, source] of sources) {
    const issuer = requireRef(authorities, source.issuerAuthorityRef, `sources/${id}/issuerAuthorityRef`, "invalid_source_authority", findings);
    if (!allSubjectIds.has(source.subjectRef)) findings.push(finding("invalid_source_subject", `sources/${id}/subjectRef`, "Source subject must resolve to one exact medication-regimen record."));
    const asserted = exactInstant(source.assertedAt);
    const retrieved = exactInstant(source.retrievedAt);
    if (asserted === null || retrieved === null || asserted > retrieved || asOf === null || retrieved > asOf) findings.push(finding("invalid_source_chronology", `sources/${id}`, "Source assertion must not follow retrieval and retrieval must not follow the review as-of."));
    if (source.minimized !== true || source.containsSecrets !== false || secretLike(source.controlledRef)) findings.push(finding("secret_bearing_source", `sources/${id}`, "Sources must be minimized, secret-free controlled references."));
    if (clinicalSourceKinds.has(source.kind) && (!issuer || issuer.kind !== "prescriber" || !rows(issuer.scope).includes("clinical-order"))) findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Clinical order evidence requires a scoped prescriber."));
    if (source.kind === "pharmacist-instruction" && (!issuer || issuer.kind !== "pharmacist")) findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Pharmacist instructions require a pharmacist issuer."));
    if (source.kind === "emergency-guidance" && (!issuer || issuer.kind !== "emergency-professional" || !rows(issuer.scope).includes("emergency-guidance"))) findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Emergency guidance requires a scoped emergency professional."));
    if (dispenserSourceKinds.has(source.kind) && (!issuer || issuer.kind !== "dispenser" || !rows(issuer.scope).includes("dispensing-record"))) findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Label, package, and dispensing receipts require a scoped dispenser."));
    if (observationSourceKinds.has(source.kind) && (!issuer || ![review.patientAuthorityRef, ...caregiverIds].includes(issuer.id))) findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Observation evidence requires the patient owner or an authorized caregiver."));
    if (["supply-count", "refill-attempt", "owner-action-note"].includes(source.kind) && (!issuer || ![review.patientAuthorityRef, ...caregiverIds].includes(issuer.id))) findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Owner-side medication evidence requires the patient owner or authorized caregiver."));
  }

  const expectedReviewIndexes = new Map([
    ["medicationRefs", [...medications.keys()]],
    ["orderRefs", [...orders.keys()]],
    ["occurrenceRefs", [...occurrences.keys()]],
    ["observationRefs", [...observations.keys()]],
    ["supplyRefs", [...supplies.keys()]],
    ["actionRefs", [...actions.keys()]],
    ["questionRefs", [...questions.keys()]],
    ["openGapRefs", [...gaps.values()].filter((row) => row.state === "open").map((row) => row.id)],
    ["unknownOccurrenceRefs", [...occurrences.values()].filter((row) => row.state === "unknown").map((row) => row.id)],
    ["blockedActionRefs", [...actions.values()].filter((row) => ["failed", "blocked", "partial", "rejected"].includes(row.state)).map((row) => row.id)],
    ["urgentQuestionRefs", [...questions.values()].filter((row) => row.ownerMarkedUrgent === true && row.state === "open").map((row) => row.id)],
  ]);
  for (const [field, expected] of expectedReviewIndexes) if (!sameSet(review[field], expected)) findings.push(finding("incomplete_review_index", `review/${field}`, `${field} must exactly index its derived collection state.`));

  for (const [id, medication] of medications) {
    if (medication.patientAuthorityRef !== review.patientAuthorityRef) findings.push(finding("invalid_medication_patient", `medications/${id}/patientAuthorityRef`, "Every medication must use the review patient authority."));
    refs(sources, medication.identitySourceRefs, `medications/${id}/identitySourceRefs`, "unknown_source", findings);
    refs(orders, medication.orderRefs, `medications/${id}/orderRefs`, "unknown_order", findings);
    refs(supplies, medication.supplyRefs, `medications/${id}/supplyRefs`, "unknown_supply", findings);
    refs(gaps, medication.gapRefs, `medications/${id}/gapRefs`, "unknown_gap", findings);
    const actualOrders = [...orders.values()].filter((row) => row.medicationRef === id).map((row) => row.id);
    const actualSupplies = [...supplies.values()].filter((row) => row.medicationRef === id).map((row) => row.id);
    const relatedIds = [
      id,
      ...actualOrders,
      ...actualSupplies,
      ...[...occurrences.values()].filter((row) => row.medicationRef === id).map((row) => row.id),
      ...[...observations.values()].filter((row) => row.medicationRef === id).map((row) => row.id),
      ...[...actions.values()].filter((row) => row.medicationRef === id).map((row) => row.id),
      ...[...questions.values()].filter((row) => row.medicationRef === id).map((row) => row.id),
    ];
    const actualGaps = [...gaps.values()].filter((row) => rows(row.subjectRefs).some((ref) => relatedIds.includes(ref))).map((row) => row.id);
    if (!sameSet(medication.orderRefs, actualOrders) || !sameSet(medication.supplyRefs, actualSupplies) || !sameSet(medication.gapRefs, actualGaps)) findings.push(finding("incomplete_medication_index", `medications/${id}`, "Medication indexes must exactly cover its orders, supplies, and direct gaps."));
    const identityValid = rows(medication.identitySourceRefs).length > 0 && rows(medication.identitySourceRefs).every((ref) => {
      const source = sources.get(ref);
      return source?.subjectRef === id && ["pharmacy-label", "package-record"].includes(source.kind) && source.freshness === "current";
    });
    if (!identityValid) findings.push(finding("invalid_medication_identity", `medications/${id}/identitySourceRefs`, "Medication identity requires same-medication label or package evidence."));
    if (medication.diagnosisDetermination !== false || medication.safetyDetermination !== false || medication.effectivenessDetermination !== false) findings.push(finding("prohibited_clinical_conclusion", `medications/${id}`, "Medication records cannot determine diagnosis, safety, or effectiveness."));
  }

  for (const [id, order] of orders) {
    requireRef(medications, order.medicationRef, `orders/${id}/medicationRef`, "unknown_medication", findings);
    const clinician = requireRef(authorities, order.orderedByAuthorityRef, `orders/${id}/orderedByAuthorityRef`, "invalid_order_authority", findings);
    const source = requireRef(sources, order.sourceRef, `orders/${id}/sourceRef`, "unknown_source", findings);
    if (!clinician || clinician.kind !== "prescriber" || !rows(clinician.scope).includes("clinical-order")) findings.push(finding("invalid_order_authority", `orders/${id}/orderedByAuthorityRef`, "Orders require a scoped prescriber."));
    if (!source || !clinicalSourceKinds.has(source.kind) || source.subjectRef !== id || source.issuerAuthorityRef !== order.orderedByAuthorityRef) findings.push(finding("invalid_order_source", `orders/${id}/sourceRef`, "Order source must be same-order clinical evidence from its prescriber."));
    const validStateSource =
      (order.state === "current" && ["medication-order", "order-change"].includes(source?.kind)) ||
      (order.state === "held" && source?.kind === "order-hold") ||
      (order.state === "discontinued" && source?.kind === "order-discontinuation") ||
      (["superseded", "conflicted"].includes(order.state) && clinicalSourceKinds.has(source?.kind));
    if (!validStateSource) findings.push(finding("invalid_order_source", `orders/${id}/sourceRef`, "Order state must be backed by the matching clinical evidence kind."));
    if (["current", "held", "conflicted"].includes(order.state) && source?.freshness !== "current") findings.push(finding("stale_current_order", `orders/${id}/sourceRef`, "Current, held, or conflicted order state requires current source evidence."));
    refs(sources, order.warningSourceRefs, `orders/${id}/warningSourceRefs`, "unknown_source", findings);
    for (const ref of rows(order.warningSourceRefs)) {
      const warning = sources.get(ref);
      const instructionWarning = warningInstructionKinds.has(warning?.kind) && warning?.subjectRef === id;
      const packageWarning = ["pharmacy-label", "package-record"].includes(warning?.kind) && warning?.subjectRef === order.medicationRef;
      if (!warning || warning.freshness !== "current" || (!instructionWarning && !packageWarning)) findings.push(finding("invalid_order_source", `orders/${id}/warningSourceRefs`, "Warnings require current same-order instructions or same-medication label or package evidence."));
    }
    const effective = exactInstant(order.effectiveAt);
    const ended = order.endedAt === null ? null : exactInstant(order.endedAt);
    if (effective === null || (ended !== null && ended <= effective) || (order.endedAt !== null && ended === null) || asOf === null || effective > asOf) findings.push(finding("invalid_order_chronology", `orders/${id}`, "Order chronology must be exact, ordered, and no later than review."));
    if (["current", "held", "conflicted"].includes(order.state) && order.endedAt !== null) findings.push(finding("invalid_order_chronology", `orders/${id}/endedAt`, "Live order states cannot carry an end instant."));
    if (order.state === "discontinued" && (ended === null || asOf === null || ended > asOf || order.successorRef !== null)) findings.push(finding("invalid_order_chronology", `orders/${id}`, "Discontinued orders require a completed end instant, no successor, and no future state."));
    const predecessor = order.predecessorRef === null ? null : requireRef(orders, order.predecessorRef, `orders/${id}/predecessorRef`, "invalid_order_lineage", findings);
    const successor = order.successorRef === null ? null : requireRef(orders, order.successorRef, `orders/${id}/successorRef`, "invalid_order_lineage", findings);
    if (predecessor && (predecessor.medicationRef !== order.medicationRef || predecessor.successorRef !== id || predecessor.revision >= order.revision || exactInstant(predecessor.effectiveAt) >= effective)) findings.push(finding("invalid_order_lineage", `orders/${id}/predecessorRef`, "Predecessor must be reciprocal, earlier, lower-revision, and same-medication."));
    if (successor && (successor.medicationRef !== order.medicationRef || successor.predecessorRef !== id || successor.revision <= order.revision || exactInstant(successor.effectiveAt) <= effective)) findings.push(finding("invalid_order_lineage", `orders/${id}/successorRef`, "Successor must be reciprocal, later, higher-revision, and same-medication."));
    if (order.state === "superseded" && (!successor || ended === null || ended !== exactInstant(successor.effectiveAt))) findings.push(finding("invalid_order_lineage", `orders/${id}`, "Superseded orders require an exact successor boundary."));
    if (order.state !== "superseded" && order.successorRef !== null) findings.push(finding("invalid_order_lineage", `orders/${id}/successorRef`, "Only superseded orders may name a successor."));
    if (order.doseCalculatedByClaw !== false || order.interactionDetermination !== false || order.clinicalSelection !== false) findings.push(finding("prohibited_clinical_conclusion", `orders/${id}`, "Orders cannot carry dose calculation, interaction determination, or Claw clinical selection."));
  }
  for (const [medicationId] of medications) {
    const medicationOrders = [...orders.values()].filter((row) => row.medicationRef === medicationId);
    const live = medicationOrders.filter((row) => ["current", "held", "conflicted"].includes(row.state));
    const latest = medicationOrders.toSorted((left, right) => right.revision - left.revision)[0];
    const validDiscontinuedTerminal = live.length === 0 && latest?.state === "discontinued" && latest.successorRef === null;
    if (live.length !== 1 && !validDiscontinuedTerminal) findings.push(finding("invalid_live_order_coverage", `medications/${medicationId}/orderRefs`, "Each medication requires one live revision or one latest discontinued terminal revision."));
  }

  for (const [id, occurrence] of occurrences) {
    const medication = requireRef(medications, occurrence.medicationRef, `occurrences/${id}/medicationRef`, "unknown_medication", findings);
    const order = requireRef(orders, occurrence.orderRef, `occurrences/${id}/orderRef`, "unknown_order", findings);
    const planned = exactInstant(occurrence.plannedAt);
    if (!medication || !order || order.medicationRef !== occurrence.medicationRef) findings.push(finding("cross_medication_occurrence", `occurrences/${id}`, "Occurrence must use one medication and one of its order revisions."));
    if (planned === null || periodStart === null || periodEnd === null || planned < periodStart || planned >= periodEnd || planned < (exactInstant(order?.effectiveAt) ?? Infinity) || (order?.endedAt !== null && planned >= (exactInstant(order?.endedAt) ?? -Infinity))) findings.push(finding("invalid_occurrence_chronology", `occurrences/${id}/plannedAt`, "Occurrence must fall inside both review and order effective periods."));
    const observation = occurrence.observationRef === null ? null : requireRef(observations, occurrence.observationRef, `occurrences/${id}/observationRef`, "unknown_observation", findings);
    if (occurrence.state === "observed" && (!observation || observation.occurrenceRef !== id)) findings.push(finding("invalid_occurrence_observation", `occurrences/${id}/observationRef`, "Observed occurrences require one reciprocal observation."));
    if (occurrence.state !== "observed" && occurrence.observationRef !== null) findings.push(finding("inferred_administration", `occurrences/${id}/observationRef`, "Only observed occurrences may carry an observation; unobserved state cannot be inferred."));
    if (["held", "discontinued"].includes(order?.state) && !["unknown", "not-applicable"].includes(occurrence.state)) findings.push(finding("invalid_held_occurrence", `occurrences/${id}/state`, "Held or discontinued orders cannot produce an observed or scheduled occurrence."));
    if (order?.state === "conflicted" && occurrence.state !== "unknown") findings.push(finding("invalid_held_occurrence", `occurrences/${id}/state`, "Conflicted orders keep occurrences unknown until qualified humans resolve the instruction."));
    if (occurrence.state === "not-applicable" && !["held", "discontinued"].includes(order?.state)) findings.push(finding("invalid_held_occurrence", `occurrences/${id}/state`, "Not-applicable occurrences require a held or discontinued order."));
    if (planned !== null && asOf !== null && planned <= asOf && occurrence.state === "scheduled") findings.push(finding("invalid_occurrence_observation", `occurrences/${id}/state`, "Elapsed unobserved occurrences must remain unknown rather than scheduled."));
  }

  for (const [id, observation] of observations) {
    const occurrence = requireRef(occurrences, observation.occurrenceRef, `observations/${id}/occurrenceRef`, "unknown_occurrence", findings);
    const source = requireRef(sources, observation.sourceRef, `observations/${id}/sourceRef`, "unknown_source", findings);
    const observer = requireRef(authorities, observation.observerAuthorityRef, `observations/${id}/observerAuthorityRef`, "invalid_observer_authority", findings);
    if (!occurrence || occurrence.medicationRef !== observation.medicationRef || occurrence.orderRef !== observation.orderRef || occurrence.observationRef !== id) findings.push(finding("cross_medication_observation", `observations/${id}`, "Observation must reciprocally bind the exact occurrence, medication, and order revision."));
    if (!observer || ![review.patientAuthorityRef, ...caregiverIds].includes(observer.id)) findings.push(finding("invalid_observer_authority", `observations/${id}/observerAuthorityRef`, "Observation requires the patient owner or authorized caregiver."));
    if (!source || !observationSourceKinds.has(source.kind) || source.subjectRef !== id || source.issuerAuthorityRef !== observation.observerAuthorityRef) findings.push(finding("invalid_observation_source", `observations/${id}/sourceRef`, "Observation source must be same-observation evidence from its observer."));
    const observed = exactInstant(observation.observedAt);
    const planned = exactInstant(occurrence?.plannedAt);
    if (observed === null || planned === null || observed < planned || asOf === null || observed > asOf) findings.push(finding("invalid_observation_chronology", `observations/${id}/observedAt`, "Observation must be exact, no earlier than the occurrence, and no later than review."));
    if (observed === null || exactInstant(source?.assertedAt) === null || exactInstant(source?.assertedAt) < observed) findings.push(finding("invalid_observation_chronology", `observations/${id}/sourceRef`, "Observation evidence cannot be asserted before the observation it records."));
    if (observation.adherenceConclusion !== false || observation.clinicalInterpretation !== false) findings.push(finding("prohibited_clinical_conclusion", `observations/${id}`, "Observations cannot become adherence or clinical conclusions."));
  }

  for (const [id, supply] of supplies) {
    requireRef(medications, supply.medicationRef, `supplies/${id}/medicationRef`, "unknown_medication", findings);
    const source = requireRef(sources, supply.sourceRef, `supplies/${id}/sourceRef`, "unknown_source", findings);
    if (!source || !["supply-count", "package-record"].includes(source.kind) || source.subjectRef !== id) findings.push(finding("invalid_supply_source", `supplies/${id}/sourceRef`, "Supply requires same-supply count or package evidence."));
    const counted = exactInstant(supply.countedAt);
    if (counted === null || asOf === null || counted > asOf || counted !== exactInstant(source?.assertedAt)) findings.push(finding("invalid_supply_chronology", `supplies/${id}/countedAt`, "Supply count must equal its evidence assertion and not follow review."));
    if (supply.countedUnits === 0 && !["depleted", "unknown"].includes(supply.state)) findings.push(finding("invalid_supply_state", `supplies/${id}/state`, "Zero owner-counted units must remain depleted or unknown."));
    if (supply.countedUnits > 0 && supply.state === "depleted") findings.push(finding("invalid_supply_state", `supplies/${id}/state`, "Positive owner-counted units cannot be labeled depleted."));
    if (supply.expiryDate !== null && dateValue(supply.expiryDate) === null) findings.push(finding("invalid_supply_expiry", `supplies/${id}/expiryDate`, "Expiry must be a valid date when supplied."));
    const asOfDate = typeof review.asOf === "string" ? review.asOf.slice(0, 10) : null;
    const isExpired = typeof supply.expiryDate === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(asOfDate ?? "") && supply.expiryDate < asOfDate;
    if ((isExpired && supply.state !== "expired") || (!isExpired && supply.state === "expired")) findings.push(finding("invalid_supply_expiry", `supplies/${id}/state`, "Expired state must exactly follow a supplied expiry date earlier than the review date."));
    if (supply.availabilityDetermination !== false) findings.push(finding("prohibited_clinical_conclusion", `supplies/${id}/availabilityDetermination`, "Owner counts cannot determine medication availability or continuity."));
  }

  const permittedOwners = new Set([review.patientAuthorityRef, ...caregiverIds]);
  for (const [id, action] of actions) {
    requireRef(medications, action.medicationRef, `actions/${id}/medicationRef`, "unknown_medication", findings);
    refs(sources, action.sourceRefs, `actions/${id}/sourceRefs`, "unknown_source", findings);
    if (!permittedOwners.has(action.ownerAuthorityRef)) findings.push(finding("invalid_action_owner", `actions/${id}/ownerAuthorityRef`, "Medication actions require patient or authorized caregiver ownership."));
    if (caregiverIds.includes(action.ownerAuthorityRef) && action.kind !== "record-review") findings.push(finding("caregiver_action_scope_exceeded", `actions/${id}`, "Caregivers may review records only; medication and pharmacy actions remain patient or guardian controlled."));
    const attempted = action.attemptedAt === null ? null : exactInstant(action.attemptedAt);
    if (action.state === "planned" && action.attemptedAt !== null) findings.push(finding("invalid_action_chronology", `actions/${id}/attemptedAt`, "Planned actions cannot carry an attempt time."));
    if (action.state !== "planned" && (attempted === null || periodStart === null || attempted < periodStart || asOf === null || attempted > asOf)) findings.push(finding("invalid_action_chronology", `actions/${id}/attemptedAt`, "Non-planned actions require an exact in-period attempt time no later than review."));
    const actionSources = rows(action.sourceRefs).map((ref) => sources.get(ref)).filter(Boolean);
    if (action.state !== "planned") {
      const ownerEvidence = actionSources.some((source) => source.subjectRef === id && source.issuerAuthorityRef === action.ownerAuthorityRef && ["refill-attempt", "owner-action-note"].includes(source.kind) && attempted !== null && exactInstant(source.assertedAt) >= attempted);
      if (!ownerEvidence || actionSources.length !== rows(action.sourceRefs).length || actionSources.some((source) => source.subjectRef !== id)) findings.push(finding("invalid_action_receipt", `actions/${id}/sourceRefs`, "Non-planned actions require same-action owner evidence at or after the attempt."));
    }
    const receipt = action.receiptSourceRef === null ? null : requireRef(sources, action.receiptSourceRef, `actions/${id}/receiptSourceRef`, "unknown_source", findings);
    if (action.state === "owner-completed-receipted") {
      const ownerNote = rows(action.sourceRefs).some((ref) => {
        const source = sources.get(ref);
        return source?.kind === "owner-action-note" && source.subjectRef === id && source.issuerAuthorityRef === action.ownerAuthorityRef;
      });
      if (!ownerNote || !receipt || !receiptSourceKinds.has(receipt.kind) || receipt.subjectRef !== id || permittedOwners.has(receipt.issuerAuthorityRef) || !rows(action.sourceRefs).includes(receipt.id) || attempted === null || exactInstant(receipt.assertedAt) < attempted) findings.push(finding("invalid_action_receipt", `actions/${id}/receiptSourceRef`, "Completed medication actions require an owner note and later independent same-action receipt."));
    } else if (action.receiptSourceRef !== null) findings.push(finding("premature_action_receipt", `actions/${id}/receiptSourceRef`, "Only owner-completed-receipted actions may carry a receipt."));
    if (action.agentExecuted !== false || action.externalExecution !== "owner-only") findings.push(finding("external_authority_claim", `actions/${id}`, "Medication and pharmacy actions must remain owner-only and not agent-executed."));
    if (action.entitlementDetermination !== false || action.availabilityDetermination !== false || action.substitutionDetermination !== false) findings.push(finding("prohibited_clinical_conclusion", `actions/${id}`, "Actions cannot determine entitlement, availability, or substitution."));
  }

  for (const [id, question] of questions) {
    if (question.medicationRef !== null) requireRef(medications, question.medicationRef, `questions/${id}/medicationRef`, "unknown_medication", findings);
    const order = question.orderRef === null ? null : requireRef(orders, question.orderRef, `questions/${id}/orderRef`, "unknown_order", findings);
    if (order && question.medicationRef !== null && order.medicationRef !== question.medicationRef) findings.push(finding("cross_medication_question", `questions/${id}`, "Question order and medication must match."));
    refs(sources, question.sourceRefs, `questions/${id}/sourceRefs`, "unknown_source", findings);
    const permittedQuestionSubjects = new Set([id, question.medicationRef, question.orderRef].filter((ref) => ref !== null));
    for (const ref of rows(question.sourceRefs)) {
      const source = sources.get(ref);
      if (source && !permittedQuestionSubjects.has(source.subjectRef)) findings.push(finding("invalid_question_answer", `questions/${id}/sourceRefs`, "Question evidence must bind the question, its medication, or its exact order."));
    }
    const askedOf = requireRef(authorities, question.askedOfAuthorityRef, `questions/${id}/askedOfAuthorityRef`, "invalid_question_authority", findings);
    if (!askedOf || !questionAuthorityKinds.get(question.kind)?.has(askedOf.kind) || !rows(askedOf.scope).includes("medication-question")) findings.push(finding("invalid_question_authority", `questions/${id}/askedOfAuthorityRef`, "Question kind requires its matching qualified, scoped human route."));
    const answer = question.answerSourceRef === null ? null : requireRef(sources, question.answerSourceRef, `questions/${id}/answerSourceRef`, "unknown_source", findings);
    if (question.state === "answered" && (!answer || answer.subjectRef !== id || answer.issuerAuthorityRef !== question.askedOfAuthorityRef || !answerKindsByAuthority.get(askedOf?.kind)?.has(answer.kind) || answer.freshness !== "current")) findings.push(finding("invalid_question_answer", `questions/${id}/answerSourceRef`, "Answered questions require current same-question evidence of the matching kind from the named qualified authority."));
    if (question.state === "open" && question.answerSourceRef !== null) findings.push(finding("premature_question_answer", `questions/${id}/answerSourceRef`, "Open questions cannot carry answer evidence."));
    if (question.interpretationByClaw !== false) findings.push(finding("prohibited_clinical_conclusion", `questions/${id}/interpretationByClaw`, "The Claw cannot interpret a medication question."));
  }

  for (const [id, gap] of gaps) {
    refs(sources, gap.sourceRefs, `gaps/${id}/sourceRefs`, "unknown_source", findings);
    const nextOwner = requireRef(authorities, gap.nextOwnerAuthorityRef, `gaps/${id}/nextOwnerAuthorityRef`, "invalid_next_owner", findings);
    const permittedGapOwners = gapOwnerKinds.get(gap.kind);
    if (permittedGapOwners && !permittedGapOwners.has(nextOwner?.kind)) findings.push(finding("invalid_next_owner", `gaps/${id}/nextOwnerAuthorityRef`, "Gap kind requires an appropriately qualified next owner."));
    for (const ref of rows(gap.subjectRefs)) {
      if (!allSubjectIds.has(ref)) findings.push(finding("unknown_gap_subject", `gaps/${id}/subjectRefs`, `Unknown gap subject ${ref}.`));
      if (ref === id) findings.push(finding("self_referential_gap", `gaps/${id}/subjectRefs`, "Gaps cannot reference themselves."));
    }
    for (const ref of rows(gap.sourceRefs)) {
      const source = sources.get(ref);
      if (source && source.subjectRef !== id && !rows(gap.subjectRefs).includes(source.subjectRef)) findings.push(finding("unknown_gap_subject", `gaps/${id}/sourceRefs`, "Gap evidence must bind the gap or one of its exact subjects."));
    }
    const resolution = gap.resolutionSourceRef === null ? null : requireRef(sources, gap.resolutionSourceRef, `gaps/${id}/resolutionSourceRef`, "unknown_source", findings);
    if (gap.state === "open" && gap.resolutionSourceRef !== null) findings.push(finding("invalid_gap_resolution", `gaps/${id}/resolutionSourceRef`, "Open gaps cannot carry resolution evidence."));
    if (gap.state === "resolved" && (!resolution || resolution.kind !== "gap-resolution" || resolution.subjectRef !== id || resolution.issuerAuthorityRef !== gap.nextOwnerAuthorityRef || resolution.freshness !== "current")) findings.push(finding("invalid_gap_resolution", `gaps/${id}/resolutionSourceRef`, "Resolved gaps require current same-gap evidence from the named next owner."));
  }

  if (review.state !== "blocked" || [
    review.diagnosisConclusion,
    review.safetyConclusion,
    review.effectivenessConclusion,
    review.interactionConclusion,
    review.adherenceConclusion,
    review.continuityConclusion,
    review.closureClaim,
  ].some((item) => item !== false)) findings.push(finding("premature_review_conclusion", "review", "Medication review must remain blocked and make no clinical, adherence, continuity, or closure conclusion."));
  if (Object.values(prohibited).some((item) => item !== false)) findings.push(finding("prohibited_authority_claim", "prohibitedActions", "Every prohibited clinical and external action must remain false."));

  return findings;
}
