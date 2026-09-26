const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/u;
const EXACT_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const CONTROLLED_REF_PATTERN = /^controlled:\/\/[a-z0-9][a-z0-9._/-]*$/u;
const SENSITIVE_TEXT_PATTERN = /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b\d{3}-\d{2}-\d{4}\b|\b(?:account|routing|loan|taxpayer|ssn|password|secret|token|api[-_ ]?key|wire)\s*[:=]\s*\S+|\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)\b)/iu;

const sourceAuthorityKinds = new Map([
  ["buyer-authorization", new Set(["buyer"])],
  ["contract-revision", new Set(["buyer", "real-estate-professional", "seller-or-counterparty", "legal-counsel"])],
  ["disclosure", new Set(["seller-or-counterparty", "real-estate-professional"])],
  ["inspection-report", new Set(["inspector"])],
  ["counterparty-position", new Set(["seller-or-counterparty", "real-estate-professional"])],
  ["appraisal-report", new Set(["appraiser", "lender"])],
  ["lender-condition", new Set(["lender"])],
  ["title-record", new Set(["title-or-escrow", "legal-counsel", "closing-professional"])],
  ["insurance-record", new Set(["insurer"])],
  ["tax-record", new Set(["tax-professional", "title-or-escrow", "closing-professional"])],
  ["settlement-record", new Set(["title-or-escrow", "closing-professional"])],
  ["closing-instruction", new Set(["title-or-escrow", "closing-professional"])],
  ["owner-action-note", new Set(["buyer"])],
  ["independent-receipt", new Set(["real-estate-professional", "seller-or-counterparty", "inspector", "lender", "title-or-escrow", "insurer", "closing-professional"])],
  ["professional-answer", new Set(["real-estate-professional", "inspector", "appraiser", "lender", "title-or-escrow", "insurer", "tax-professional", "legal-counsel", "closing-professional"])],
  ["gap-resolution", new Set(["buyer", "real-estate-professional", "seller-or-counterparty", "inspector", "appraiser", "lender", "title-or-escrow", "insurer", "tax-professional", "legal-counsel", "closing-professional"])],
]);

const questionScopes = new Map([
  ["contract", "contract-question"],
  ["legal", "contract-question"],
  ["inspection", "inspection-question"],
  ["appraisal", "appraisal-question"],
  ["financing", "financing-question"],
  ["title", "title-question"],
  ["insurance", "insurance-question"],
  ["tax", "tax-question"],
  ["settlement", "settlement-question"],
  ["wire-safety", "wire-safety-question"],
  ["closing", "settlement-question"],
]);

const workstreamOwnerKinds = new Map([
  ["contract", new Set(["buyer", "real-estate-professional", "legal-counsel"])],
  ["inspection", new Set(["buyer", "inspector", "real-estate-professional"])],
  ["appraisal", new Set(["appraiser", "lender"])],
  ["financing", new Set(["buyer", "lender"])],
  ["title", new Set(["title-or-escrow", "legal-counsel", "closing-professional"])],
  ["insurance", new Set(["buyer", "insurer"])],
  ["tax", new Set(["buyer", "tax-professional", "title-or-escrow", "closing-professional"])],
  ["funds", new Set(["buyer", "title-or-escrow", "closing-professional"])],
  ["settlement", new Set(["title-or-escrow", "closing-professional"])],
  ["closing", new Set(["buyer", "title-or-escrow", "closing-professional"])],
  ["possession", new Set(["buyer", "real-estate-professional", "title-or-escrow", "closing-professional"])],
]);

function rows(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function exactInstant(value) {
  if (typeof value !== "string" || !EXACT_INSTANT_PATTERN.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function finding(code, path, message) {
  return { code, path, message };
}

function rowMap(value) {
  const result = new Map();
  for (const row of rows(value)) {
    const id = record(row).id;
    if (id !== undefined && !result.has(id)) result.set(id, row);
  }
  return result;
}

function sameRefs(actual, expected) {
  const left = rows(actual).filter((ref) => typeof ref === "string").toSorted();
  const right = [...expected].filter((ref) => typeof ref === "string").toSorted();
  return left.length === right.length && left.every((ref, index) => ref === right[index]);
}

function hasScope(authority, scope) {
  return rows(authority?.scope).includes(scope);
}

function requireRef(map, ref, path, code, findings) {
  if (typeof ref !== "string" || !map.has(ref)) {
    findings.push(finding(code, path, `Unknown reference ${String(ref)}.`));
    return null;
  }
  return map.get(ref);
}

function requireRefs(map, values, path, code, findings) {
  for (const ref of rows(values)) requireRef(map, ref, path, code, findings);
}

function collectStrings(value, output = []) {
  if (typeof value === "string") output.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, output);
  else if (value && typeof value === "object") for (const item of Object.values(value)) collectStrings(item, output);
  return output;
}

function amountPair(row) {
  return (row?.amountMinorUnits === null && row?.currency === null)
    || (Number.isInteger(row?.amountMinorUnits) && row.amountMinorUnits >= 0 && typeof row?.currency === "string");
}

function hasOpenGap(gaps, refs) {
  return rows(refs).some((ref) => gaps.get(ref)?.state === "open");
}

function requireRelevantSources(sources, refs, allowedSubjects, path, findings) {
  for (const ref of rows(refs)) {
    const source = sources.get(ref);
    if (!source) continue;
    if (source.freshness !== "current" || !allowedSubjects.has(source.subjectRef)) {
      findings.push(finding("irrelevant_source_reference", path, `Source ${String(ref)} must be current and bind the record, transaction, or one of its exact related subjects.`));
    }
  }
}

function requireBacklink(row, field, ref, path, findings) {
  if (row && !rows(row[field]).includes(ref)) {
    findings.push(finding("incomplete_reciprocal_reference", path, `Referenced record ${String(row.id)} must link back to ${String(ref)} through ${field}.`));
  }
}

export function homePurchaseTransactionFindings(input) {
  const findings = [];
  const value = record(input);
  if (Object.keys(value).length === 0) {
    return [finding("invalid_artifact", "", "Home purchase transaction artifact must be an object with the complete contract.")];
  }

  const transaction = record(value.transaction);
  const review = record(value.review);
  const prohibitedActions = record(value.prohibitedActions);
  const authorities = rowMap(value.authorities);
  const sources = rowMap(value.sources);
  const milestones = rowMap(value.milestones);
  const conditions = rowMap(value.conditions);
  const deadlines = rowMap(value.deadlines);
  const workstreams = rowMap(value.workstreams);
  const actions = rowMap(value.actions);
  const questions = rowMap(value.questions);
  const gaps = rowMap(value.gaps);

  const collections = [
    value.authorities, value.sources, value.milestones, value.conditions, value.deadlines,
    value.workstreams, value.actions, value.questions, value.gaps,
  ];
  const seenIds = new Set();
  if (typeof transaction.id === "string") seenIds.add(transaction.id);
  for (const collection of collections) {
    for (const row of rows(collection)) {
      const id = record(row).id;
      if (typeof id !== "string" || !IDENTIFIER_PATTERN.test(id) || seenIds.has(id)) {
        findings.push(finding("duplicate_identity", "id", `Every record requires one globally unique stable id; found ${String(id)}.`));
      } else {
        seenIds.add(id);
      }
    }
  }

  const transactionId = transaction.id;
  const asOf = exactInstant(transaction.asOf);
  if (asOf === null || exactInstant(review.asOf) !== asOf) {
    findings.push(finding("invalid_transaction_chronology", "review/asOf", "Transaction and review require the same exact zone-bearing as-of instant."));
  }

  const exactIndexes = [
    [transaction.sourceRefs, sources.keys(), "sourceRefs"],
    [transaction.milestoneRefs, milestones.keys(), "milestoneRefs"],
    [transaction.conditionRefs, conditions.keys(), "conditionRefs"],
    [transaction.deadlineRefs, deadlines.keys(), "deadlineRefs"],
    [transaction.workstreamRefs, workstreams.keys(), "workstreamRefs"],
    [transaction.actionRefs, actions.keys(), "actionRefs"],
    [transaction.questionRefs, questions.keys(), "questionRefs"],
    [transaction.gapRefs, gaps.keys(), "gapRefs"],
  ];
  for (const [actual, expected, key] of exactIndexes) {
    if (!sameRefs(actual, expected)) findings.push(finding("incomplete_transaction_index", `transaction/${key}`, `Transaction ${key} must exactly cover the corresponding collection.`));
  }

  const buyer = requireRef(authorities, transaction.buyerAuthorityRef, "transaction/buyerAuthorityRef", "invalid_buyer_authority", findings);
  if (!buyer || buyer.kind !== "buyer" || buyer.status !== "current" || !hasScope(buyer, "transaction-owner") || !hasScope(buyer, "review")) {
    findings.push(finding("invalid_buyer_authority", "transaction/buyerAuthorityRef", "Transaction ownership requires one current buyer with transaction-owner and review scopes."));
  }
  if (review.nextOwnerAuthorityRef !== transaction.buyerAuthorityRef) {
    findings.push(finding("invalid_buyer_authority", "review/nextOwnerAuthorityRef", "The exact buyer remains the transaction review owner."));
  }
  if (typeof transaction.approvedDestinationRef !== "string" || !CONTROLLED_REF_PATTERN.test(transaction.approvedDestinationRef)) {
    findings.push(finding("invalid_private_destination", "transaction/approvedDestinationRef", "The review destination must be a controlled private reference."));
  }

  for (const authority of authorities.values()) {
    if (authority?.transactionRef !== transactionId) findings.push(finding("cross_transaction_record", `authorities/${authority?.id}/transactionRef`, "Every authority must belong to the exact transaction."));
    if (authority?.kind !== "buyer" && (hasScope(authority, "transaction-owner") || hasScope(authority, "review"))) {
      findings.push(finding("invalid_authority_scope", `authorities/${authority?.id}/scope`, "Only the buyer may own transaction and review authority."));
    }
    if (authority?.authorizationSourceRef !== null) requireRef(sources, authority?.authorizationSourceRef, `authorities/${authority?.id}/authorizationSourceRef`, "invalid_authority_evidence", findings);
  }

  const knownSubjects = new Set([transactionId, ...milestones.keys(), ...conditions.keys(), ...deadlines.keys(), ...workstreams.keys(), ...actions.keys(), ...questions.keys(), ...gaps.keys()]);
  const currentByStableSource = new Map();
  const successorsBySource = new Map();
  for (const source of sources.values()) {
    const sourcePath = `sources/${source?.id}`;
    if (source?.transactionRef !== transactionId) findings.push(finding("cross_transaction_record", `${sourcePath}/transactionRef`, "Every source must belong to the exact transaction."));
    const issuer = requireRef(authorities, source?.issuerAuthorityRef, `${sourcePath}/issuerAuthorityRef`, "invalid_source_authority", findings);
    const allowedKinds = sourceAuthorityKinds.get(source?.kind);
    if (!issuer || !allowedKinds?.has(issuer.kind) || !hasScope(issuer, "source-issuer")) {
      findings.push(finding("invalid_source_authority", `${sourcePath}/issuerAuthorityRef`, "Source kind, issuer kind, and source-issuer scope must agree."));
    }
    if (!knownSubjects.has(source?.subjectRef)) findings.push(finding("invalid_source_subject", `${sourcePath}/subjectRef`, "Every source must bind to one exact in-transaction subject."));
    const assertedAt = exactInstant(source?.assertedAt);
    const retrievedAt = exactInstant(source?.retrievedAt);
    if (assertedAt === null || retrievedAt === null || assertedAt > retrievedAt || (asOf !== null && retrievedAt > asOf)) {
      findings.push(finding("invalid_source_chronology", sourcePath, "Source chronology requires asserted <= retrieved <= transaction as-of."));
    }
    if (typeof source?.controlledRef !== "string" || !CONTROLLED_REF_PATTERN.test(source.controlledRef) || SENSITIVE_TEXT_PATTERN.test(source.controlledRef)) {
      findings.push(finding("secret_bearing_source", `${sourcePath}/controlledRef`, "Sources require minimized controlled references without credentials, wire data, accounts, or precise addresses."));
    }
    if (source?.containsSecrets !== false || source?.minimized !== true) findings.push(finding("secret_bearing_source", sourcePath, "Every source must be minimized and explicitly secret-free."));
    if (!amountPair(source)) findings.push(finding("invalid_amount_currency", sourcePath, "Source amount and currency must both be present or both be null."));
    if (source?.freshness === "current") {
      const current = currentByStableSource.get(source?.stableSourceRef);
      if (current) findings.push(finding("ambiguous_source_revision", sourcePath, `Stable source ${String(source?.stableSourceRef)} has more than one current revision.`));
      currentByStableSource.set(source?.stableSourceRef, source);
    }
    if (source?.supersedesSourceRef !== null) {
      const prior = requireRef(sources, source?.supersedesSourceRef, `${sourcePath}/supersedesSourceRef`, "invalid_source_lineage", findings);
      if (!prior || prior.id === source.id || prior.stableSourceRef !== source.stableSourceRef || prior.kind !== source.kind || prior.freshness !== "superseded" || exactInstant(prior.assertedAt) >= assertedAt) {
        findings.push(finding("invalid_source_lineage", `${sourcePath}/supersedesSourceRef`, "A revision must supersede an earlier same-kind, same-stable-source row marked superseded."));
      }
      if (prior) successorsBySource.set(prior.id, [...(successorsBySource.get(prior.id) ?? []), source.id]);
    }
  }
  for (const source of sources.values()) {
    const successors = successorsBySource.get(source?.id) ?? [];
    if (source?.freshness === "superseded" && successors.length !== 1) findings.push(finding("invalid_source_lineage", `sources/${source?.id}/freshness`, "Every superseded revision requires exactly one same-lineage successor."));
    if (source?.freshness === "current" && successors.length > 0) findings.push(finding("invalid_source_lineage", `sources/${source?.id}/freshness`, "A current revision cannot already have a successor."));
  }

  const buyerAuthorization = buyer?.authorizationSourceRef === null ? null : sources.get(buyer?.authorizationSourceRef);
  if (!buyerAuthorization || buyerAuthorization.kind !== "buyer-authorization" || buyerAuthorization.subjectRef !== transactionId || buyerAuthorization.issuerAuthorityRef !== buyer?.id || buyerAuthorization.freshness !== "current") {
    findings.push(finding("invalid_authority_evidence", "transaction/buyerAuthorityRef", "Buyer review authority requires a current same-transaction buyer-authorization source issued by that buyer."));
  }
  if (![...sources.values()].some((source) => source.kind === "contract-revision" && source.subjectRef === transactionId && source.freshness === "current")) {
    findings.push(finding("missing_current_contract", "sources", "The transaction requires one current contract revision bound to the transaction."));
  }

  for (const milestone of milestones.values()) {
    const path = `milestones/${milestone?.id}`;
    if (milestone?.transactionRef !== transactionId) findings.push(finding("cross_transaction_record", `${path}/transactionRef`, "Every milestone must belong to the exact transaction."));
    requireRefs(sources, milestone?.sourceRefs, `${path}/sourceRefs`, "invalid_milestone_source", findings);
    requireRefs(conditions, milestone?.conditionRefs, `${path}/conditionRefs`, "invalid_milestone_reference", findings);
    requireRefs(deadlines, milestone?.deadlineRefs, `${path}/deadlineRefs`, "invalid_milestone_reference", findings);
    requireRefs(workstreams, milestone?.workstreamRefs, `${path}/workstreamRefs`, "invalid_milestone_reference", findings);
    requireRefs(actions, milestone?.actionRefs, `${path}/actionRefs`, "invalid_milestone_reference", findings);
    requireRefs(gaps, milestone?.gapRefs, `${path}/gapRefs`, "invalid_milestone_reference", findings);
    requireRelevantSources(sources, milestone?.sourceRefs, new Set([transactionId, milestone?.id, ...rows(milestone?.conditionRefs), ...rows(milestone?.deadlineRefs), ...rows(milestone?.workstreamRefs), ...rows(milestone?.actionRefs)]), `${path}/sourceRefs`, findings);
    for (const ref of rows(milestone?.conditionRefs)) requireBacklink(conditions.get(ref), "subjectRefs", milestone?.id, `${path}/conditionRefs`, findings);
    for (const ref of rows(milestone?.deadlineRefs)) requireBacklink(deadlines.get(ref), "subjectRefs", milestone?.id, `${path}/deadlineRefs`, findings);
    for (const ref of rows(milestone?.workstreamRefs)) requireBacklink(workstreams.get(ref), "milestoneRefs", milestone?.id, `${path}/workstreamRefs`, findings);
    for (const ref of rows(milestone?.actionRefs)) requireBacklink(actions.get(ref), "subjectRefs", milestone?.id, `${path}/actionRefs`, findings);
    for (const ref of rows(milestone?.gapRefs)) requireBacklink(gaps.get(ref), "subjectRefs", milestone?.id, `${path}/gapRefs`, findings);
    if (!amountPair(milestone)) findings.push(finding("invalid_amount_currency", path, "Milestone amount and currency must both be present or both be null."));
    if (milestone?.amountMinorUnits !== null && !rows(milestone?.sourceRefs).some((ref) => {
      const source = sources.get(ref);
      return source?.amountMinorUnits === milestone.amountMinorUnits && source?.currency === milestone.currency && source?.freshness === "current";
    })) findings.push(finding("unsupported_milestone_amount", `${path}/amountMinorUnits`, "Every milestone amount must exactly match a current cited source amount and currency."));
    if (["pending", "blocked", "failed", "conflicting", "unknown"].includes(milestone?.state) && !hasOpenGap(gaps, milestone?.gapRefs)) {
      findings.push(finding("unowned_milestone_blocker", `${path}/gapRefs`, "Every unresolved milestone requires an open owned gap."));
    }
    if (milestone?.readinessDeterminationByClaw !== false) findings.push(finding("prohibited_professional_conclusion", `${path}/readinessDeterminationByClaw`, "The Claw cannot determine milestone or closing readiness."));
  }

  for (const condition of conditions.values()) {
    const path = `conditions/${condition?.id}`;
    if (condition?.transactionRef !== transactionId) findings.push(finding("cross_transaction_record", `${path}/transactionRef`, "Every condition must belong to the exact transaction."));
    for (const ref of rows(condition?.subjectRefs)) if (!milestones.has(ref) && !workstreams.has(ref)) findings.push(finding("invalid_condition_subject", `${path}/subjectRefs`, `Unknown milestone or workstream ${String(ref)}.`));
    requireRefs(sources, condition?.sourceRefs, `${path}/sourceRefs`, "invalid_condition_source", findings);
    requireRefs(actions, condition?.actionRefs, `${path}/actionRefs`, "invalid_condition_reference", findings);
    requireRefs(gaps, condition?.gapRefs, `${path}/gapRefs`, "invalid_condition_reference", findings);
    requireRelevantSources(sources, condition?.sourceRefs, new Set([transactionId, condition?.id, ...rows(condition?.subjectRefs), ...rows(condition?.actionRefs)]), `${path}/sourceRefs`, findings);
    for (const ref of rows(condition?.subjectRefs)) {
      if (milestones.has(ref)) requireBacklink(milestones.get(ref), "conditionRefs", condition?.id, `${path}/subjectRefs`, findings);
      if (workstreams.has(ref)) requireBacklink(workstreams.get(ref), "conditionRefs", condition?.id, `${path}/subjectRefs`, findings);
    }
    for (const ref of rows(condition?.actionRefs)) requireBacklink(actions.get(ref), "subjectRefs", condition?.id, `${path}/actionRefs`, findings);
    for (const ref of rows(condition?.gapRefs)) requireBacklink(gaps.get(ref), "subjectRefs", condition?.id, `${path}/gapRefs`, findings);
    const terminalDecision = ["satisfied-by-authority", "waived-by-owner"].includes(condition?.state);
    if (terminalDecision) {
      const decider = requireRef(authorities, condition?.decidedByAuthorityRef, `${path}/decidedByAuthorityRef`, "invalid_condition_decision", findings);
      const decision = requireRef(sources, condition?.decisionSourceRef, `${path}/decisionSourceRef`, "invalid_condition_decision", findings);
      if (!decision || decision.subjectRef !== condition.id || decision.issuerAuthorityRef !== decider?.id || decision.freshness !== "current") findings.push(finding("invalid_condition_decision", path, "Satisfied or waived conditions require current exact-subject evidence from the named decider."));
      if (condition.state === "waived-by-owner" && (decider?.kind !== "buyer" || !hasScope(decider, "transaction-owner") || decision?.kind !== "owner-action-note" || !rows(condition?.actionRefs).some((ref) => actions.get(ref)?.kind === "waive"))) {
        findings.push(finding("unauthorized_condition_waiver", path, "A waiver requires the transaction-owning buyer, an owner-action note, and an explicit owner-only waiver action."));
      }
    } else if (condition?.decidedByAuthorityRef !== null || condition?.decisionSourceRef !== null) {
      findings.push(finding("invalid_condition_decision", path, "Nonterminal conditions cannot carry decision authority or decision evidence."));
    }
    if (["pending", "failed", "conflicting", "unknown"].includes(condition?.state) && !hasOpenGap(gaps, condition?.gapRefs)) findings.push(finding("unowned_condition_blocker", `${path}/gapRefs`, "Every unresolved condition requires an open owned gap."));
    if (condition?.satisfactionDeterminationByClaw !== false || condition?.waiverDeterminationByClaw !== false) findings.push(finding("prohibited_professional_conclusion", path, "The Claw cannot determine condition satisfaction or waiver."));
  }

  for (const deadline of deadlines.values()) {
    const path = `deadlines/${deadline?.id}`;
    if (deadline?.transactionRef !== transactionId) findings.push(finding("cross_transaction_record", `${path}/transactionRef`, "Every deadline must belong to the exact transaction."));
    for (const ref of rows(deadline?.subjectRefs)) if (!milestones.has(ref) && !conditions.has(ref) && !workstreams.has(ref)) findings.push(finding("invalid_deadline_subject", `${path}/subjectRefs`, `Unknown milestone, condition, or workstream ${String(ref)}.`));
    requireRefs(sources, deadline?.sourceRefs, `${path}/sourceRefs`, "invalid_deadline_source", findings);
    requireRefs(gaps, deadline?.gapRefs, `${path}/gapRefs`, "invalid_deadline_reference", findings);
    requireRelevantSources(sources, deadline?.sourceRefs, new Set([transactionId, deadline?.id, ...rows(deadline?.subjectRefs)]), `${path}/sourceRefs`, findings);
    for (const ref of rows(deadline?.subjectRefs)) {
      if (milestones.has(ref)) requireBacklink(milestones.get(ref), "deadlineRefs", deadline?.id, `${path}/subjectRefs`, findings);
      if (workstreams.has(ref)) requireBacklink(workstreams.get(ref), "deadlineRefs", deadline?.id, `${path}/subjectRefs`, findings);
    }
    for (const ref of rows(deadline?.gapRefs)) requireBacklink(gaps.get(ref), "subjectRefs", deadline?.id, `${path}/gapRefs`, findings);
    if (deadline?.candidateAt !== null && exactInstant(deadline?.candidateAt) === null) findings.push(finding("invalid_deadline_chronology", `${path}/candidateAt`, "Deadline candidates require exact zone-bearing instants."));
    if (["professional-confirmed", "owner-confirmed"].includes(deadline?.state)) {
      const confirmer = requireRef(authorities, deadline?.confirmedByAuthorityRef, `${path}/confirmedByAuthorityRef`, "invalid_deadline_confirmation", findings);
      const confirmation = requireRef(sources, deadline?.confirmationSourceRef, `${path}/confirmationSourceRef`, "invalid_deadline_confirmation", findings);
      const expectedKind = deadline.state === "owner-confirmed" ? "owner-action-note" : "professional-answer";
      if (!confirmer || !confirmation || confirmation.kind !== expectedKind || confirmation.subjectRef !== deadline.id || confirmation.issuerAuthorityRef !== confirmer.id || confirmation.freshness !== "current") findings.push(finding("invalid_deadline_confirmation", path, "Confirmed deadlines require current exact-deadline evidence from the named owner or professional."));
    } else if (deadline?.confirmedByAuthorityRef !== null || deadline?.confirmationSourceRef !== null) {
      findings.push(finding("invalid_deadline_confirmation", path, "Unconfirmed, conflicting, or unknown deadlines cannot carry confirmation evidence."));
    }
    if (["conflicting", "unknown"].includes(deadline?.state) && !hasOpenGap(gaps, deadline?.gapRefs)) findings.push(finding("unowned_deadline_blocker", `${path}/gapRefs`, "Every conflicting or unknown deadline requires an open owned gap."));
    if (deadline?.applicabilityDeterminationByClaw !== false) findings.push(finding("prohibited_professional_conclusion", `${path}/applicabilityDeterminationByClaw`, "The Claw cannot determine deadline applicability."));
  }

  for (const workstream of workstreams.values()) {
    const path = `workstreams/${workstream?.id}`;
    if (workstream?.transactionRef !== transactionId) findings.push(finding("cross_transaction_record", `${path}/transactionRef`, "Every workstream must belong to the exact transaction."));
    const owner = requireRef(authorities, workstream?.ownerAuthorityRef, `${path}/ownerAuthorityRef`, "invalid_workstream_owner", findings);
    if (!owner || !workstreamOwnerKinds.get(workstream?.kind)?.has(owner.kind) || owner.status !== "current") findings.push(finding("invalid_workstream_owner", `${path}/ownerAuthorityRef`, "Workstream kind requires a current appropriate buyer or qualified professional owner."));
    requireRefs(sources, workstream?.sourceRefs, `${path}/sourceRefs`, "invalid_workstream_source", findings);
    requireRefs(milestones, workstream?.milestoneRefs, `${path}/milestoneRefs`, "invalid_workstream_reference", findings);
    requireRefs(conditions, workstream?.conditionRefs, `${path}/conditionRefs`, "invalid_workstream_reference", findings);
    requireRefs(deadlines, workstream?.deadlineRefs, `${path}/deadlineRefs`, "invalid_workstream_reference", findings);
    requireRefs(actions, workstream?.actionRefs, `${path}/actionRefs`, "invalid_workstream_reference", findings);
    requireRefs(gaps, workstream?.gapRefs, `${path}/gapRefs`, "invalid_workstream_reference", findings);
    requireRelevantSources(sources, workstream?.sourceRefs, new Set([transactionId, workstream?.id, ...rows(workstream?.milestoneRefs), ...rows(workstream?.conditionRefs), ...rows(workstream?.deadlineRefs), ...rows(workstream?.actionRefs)]), `${path}/sourceRefs`, findings);
    for (const ref of rows(workstream?.milestoneRefs)) requireBacklink(milestones.get(ref), "workstreamRefs", workstream?.id, `${path}/milestoneRefs`, findings);
    for (const ref of rows(workstream?.conditionRefs)) requireBacklink(conditions.get(ref), "subjectRefs", workstream?.id, `${path}/conditionRefs`, findings);
    for (const ref of rows(workstream?.deadlineRefs)) requireBacklink(deadlines.get(ref), "subjectRefs", workstream?.id, `${path}/deadlineRefs`, findings);
    for (const ref of rows(workstream?.actionRefs)) requireBacklink(actions.get(ref), "subjectRefs", workstream?.id, `${path}/actionRefs`, findings);
    for (const ref of rows(workstream?.gapRefs)) requireBacklink(gaps.get(ref), "subjectRefs", workstream?.id, `${path}/gapRefs`, findings);
    if (workstream?.state === "professional-complete" && !rows(workstream?.sourceRefs).some((ref) => sources.get(ref)?.issuerAuthorityRef === owner?.id && sources.get(ref)?.freshness === "current")) findings.push(finding("unsupported_workstream_completion", path, "Professional-complete state requires current evidence issued by the named workstream owner."));
    if (["blocked", "unknown"].includes(workstream?.state) && !hasOpenGap(gaps, workstream?.gapRefs)) findings.push(finding("unowned_workstream_blocker", `${path}/gapRefs`, "Every blocked or unknown workstream requires an open owned gap."));
    if (workstream?.professionalConclusionByClaw !== false) findings.push(finding("prohibited_professional_conclusion", `${path}/professionalConclusionByClaw`, "The Claw cannot make professional workstream conclusions."));
  }

  for (const action of actions.values()) {
    const path = `actions/${action?.id}`;
    if (action?.transactionRef !== transactionId) findings.push(finding("cross_transaction_record", `${path}/transactionRef`, "Every action must belong to the exact transaction."));
    for (const ref of rows(action?.subjectRefs)) if (!milestones.has(ref) && !conditions.has(ref) && !workstreams.has(ref) && !deadlines.has(ref) && !questions.has(ref)) findings.push(finding("invalid_action_subject", `${path}/subjectRefs`, `Unknown action subject ${String(ref)}.`));
    const owner = requireRef(authorities, action?.ownerAuthorityRef, `${path}/ownerAuthorityRef`, "invalid_action_owner", findings);
    if (!owner || owner.kind !== "buyer" || owner.id !== transaction.buyerAuthorityRef || !hasScope(owner, "transaction-owner")) findings.push(finding("invalid_action_owner", `${path}/ownerAuthorityRef`, "Every transaction action remains with the exact buyer owner."));
    requireRefs(sources, action?.sourceRefs, `${path}/sourceRefs`, "invalid_action_source", findings);
    requireRelevantSources(sources, action?.sourceRefs, new Set([transactionId, action?.id, ...rows(action?.subjectRefs)]), `${path}/sourceRefs`, findings);
    for (const ref of rows(action?.subjectRefs)) {
      if (milestones.has(ref)) requireBacklink(milestones.get(ref), "actionRefs", action?.id, `${path}/subjectRefs`, findings);
      if (conditions.has(ref)) requireBacklink(conditions.get(ref), "actionRefs", action?.id, `${path}/subjectRefs`, findings);
      if (workstreams.has(ref)) requireBacklink(workstreams.get(ref), "actionRefs", action?.id, `${path}/subjectRefs`, findings);
    }
    if (["attempted", "failed", "owner-completed-receipted"].includes(action?.state)) {
      const attemptedAt = exactInstant(action?.attemptedAt);
      if (attemptedAt === null || (asOf !== null && attemptedAt > asOf)) findings.push(finding("invalid_action_chronology", `${path}/attemptedAt`, "Attempted or completed action states require an exact time no later than the review cutoff."));
    } else if (action?.attemptedAt !== null) {
      findings.push(finding("invalid_action_chronology", `${path}/attemptedAt`, "Proposed, blocked, or withdrawn actions cannot claim an attempt time."));
    }
    if (action?.state === "owner-completed-receipted") {
      const receipt = requireRef(sources, action?.receiptSourceRef, `${path}/receiptSourceRef`, "invalid_action_receipt", findings);
      const citedAmounts = rows(action?.sourceRefs).map((ref) => sources.get(ref)).filter((source) => source?.amountMinorUnits !== null);
      if (!receipt || receipt.kind !== "independent-receipt" || receipt.subjectRef !== action.id || receipt.freshness !== "current" || receipt.issuerAuthorityRef === owner?.id || !hasScope(authorities.get(receipt.issuerAuthorityRef), "receipt-issuer")) findings.push(finding("invalid_action_receipt", path, "Completed action state requires a current independent same-action receipt from a receipt-scoped authority."));
      if (citedAmounts.length > 0 && !citedAmounts.some((source) => source.amountMinorUnits === receipt?.amountMinorUnits && source.currency === receipt?.currency)) findings.push(finding("invalid_action_amount", path, "A receipted action amount must exactly match at least one cited owner source amount and currency."));
    } else if (action?.receiptSourceRef !== null) {
      findings.push(finding("invalid_action_receipt", `${path}/receiptSourceRef`, "Only owner-completed-receipted actions may carry a receipt."));
    }
    if (action?.externalExecution !== "owner-only" || action?.agentExecuted !== false) findings.push(finding("prohibited_action_execution", path, "Every external transaction action must remain owner-only and unexecuted by the Claw."));
  }

  for (const question of questions.values()) {
    const path = `questions/${question?.id}`;
    if (question?.transactionRef !== transactionId) findings.push(finding("cross_transaction_record", `${path}/transactionRef`, "Every question must belong to the exact transaction."));
    for (const ref of rows(question?.subjectRefs)) if (!milestones.has(ref) && !conditions.has(ref) && !workstreams.has(ref) && !deadlines.has(ref) && !actions.has(ref)) findings.push(finding("invalid_question_subject", `${path}/subjectRefs`, `Unknown question subject ${String(ref)}.`));
    const respondent = requireRef(authorities, question?.askedOfAuthorityRef, `${path}/askedOfAuthorityRef`, "invalid_question_authority", findings);
    const scope = questionScopes.get(question?.kind);
    if (!respondent || !scope || !hasScope(respondent, scope) || respondent.status !== "current") findings.push(finding("invalid_question_authority", `${path}/askedOfAuthorityRef`, "Question kind requires a current qualified authority with the matching scope."));
    requireRefs(sources, question?.sourceRefs, `${path}/sourceRefs`, "invalid_question_source", findings);
    requireRelevantSources(sources, question?.sourceRefs, new Set([transactionId, question?.id, ...rows(question?.subjectRefs)]), `${path}/sourceRefs`, findings);
    if (question?.state === "answered") {
      const answer = requireRef(sources, question?.answerSourceRef, `${path}/answerSourceRef`, "invalid_question_answer", findings);
      if (!answer || answer.kind !== "professional-answer" || answer.subjectRef !== question.id || answer.issuerAuthorityRef !== respondent?.id || answer.freshness !== "current") findings.push(finding("invalid_question_answer", path, "Answered questions require a current exact-question professional answer from the named authority."));
    } else if (question?.answerSourceRef !== null) {
      findings.push(finding("invalid_question_answer", `${path}/answerSourceRef`, "Open questions cannot carry answer evidence."));
    }
    if (question?.interpretationByClaw !== false) findings.push(finding("prohibited_professional_conclusion", `${path}/interpretationByClaw`, "The Claw cannot answer or interpret professional questions."));
  }

  for (const gap of gaps.values()) {
    const path = `gaps/${gap?.id}`;
    if (gap?.transactionRef !== transactionId) findings.push(finding("cross_transaction_record", `${path}/transactionRef`, "Every gap must belong to the exact transaction."));
    for (const ref of rows(gap?.subjectRefs)) if (!milestones.has(ref) && !conditions.has(ref) && !deadlines.has(ref) && !workstreams.has(ref) && !actions.has(ref) && !questions.has(ref)) findings.push(finding("invalid_gap_subject", `${path}/subjectRefs`, `Unknown gap subject ${String(ref)}.`));
    requireRefs(sources, gap?.sourceRefs, `${path}/sourceRefs`, "invalid_gap_source", findings);
    requireRelevantSources(sources, gap?.sourceRefs, new Set([transactionId, gap?.id, ...rows(gap?.subjectRefs)]), `${path}/sourceRefs`, findings);
    for (const ref of rows(gap?.subjectRefs)) {
      if (milestones.has(ref)) requireBacklink(milestones.get(ref), "gapRefs", gap?.id, `${path}/subjectRefs`, findings);
      if (conditions.has(ref)) requireBacklink(conditions.get(ref), "gapRefs", gap?.id, `${path}/subjectRefs`, findings);
      if (deadlines.has(ref)) requireBacklink(deadlines.get(ref), "gapRefs", gap?.id, `${path}/subjectRefs`, findings);
      if (workstreams.has(ref)) requireBacklink(workstreams.get(ref), "gapRefs", gap?.id, `${path}/subjectRefs`, findings);
    }
    const owner = requireRef(authorities, gap?.nextOwnerAuthorityRef, `${path}/nextOwnerAuthorityRef`, "invalid_gap_owner", findings);
    if (!owner || owner.status !== "current") findings.push(finding("invalid_gap_owner", `${path}/nextOwnerAuthorityRef`, "Every gap requires a current named human or professional owner."));
    if (gap?.state === "resolved") {
      const resolution = requireRef(sources, gap?.resolutionSourceRef, `${path}/resolutionSourceRef`, "invalid_gap_resolution", findings);
      if (!resolution || resolution.kind !== "gap-resolution" || resolution.subjectRef !== gap.id || resolution.issuerAuthorityRef !== owner?.id || resolution.freshness !== "current") findings.push(finding("invalid_gap_resolution", path, "Resolved gaps require a current exact-gap resolution from the named owner."));
    } else if (gap?.resolutionSourceRef !== null) {
      findings.push(finding("invalid_gap_resolution", `${path}/resolutionSourceRef`, "Open gaps cannot carry resolution evidence."));
    }
  }

  const expectedReviewIndexes = [
    [review.openQuestionRefs, [...questions.values()].filter((row) => row?.state === "open").map((row) => row.id), "openQuestionRefs"],
    [review.openGapRefs, [...gaps.values()].filter((row) => row?.state === "open").map((row) => row.id), "openGapRefs"],
    [review.unresolvedMilestoneRefs, [...milestones.values()].filter((row) => !["satisfied-by-authority", "withdrawn"].includes(row?.state)).map((row) => row.id), "unresolvedMilestoneRefs"],
    [review.unresolvedConditionRefs, [...conditions.values()].filter((row) => ["pending", "failed", "conflicting", "unknown"].includes(row?.state)).map((row) => row.id), "unresolvedConditionRefs"],
    [review.unresolvedDeadlineRefs, [...deadlines.values()].filter((row) => ["conflicting", "unknown"].includes(row?.state)).map((row) => row.id), "unresolvedDeadlineRefs"],
    [review.blockedWorkstreamRefs, [...workstreams.values()].filter((row) => row?.state === "blocked").map((row) => row.id), "blockedWorkstreamRefs"],
    [review.missingReceiptActionRefs, [...actions.values()].filter((row) => row?.state === "attempted").map((row) => row.id), "missingReceiptActionRefs"],
    [review.wireSafetyQuestionRefs, [...questions.values()].filter((row) => row?.kind === "wire-safety" && row?.state === "open").map((row) => row.id), "wireSafetyQuestionRefs"],
  ];
  for (const [actual, expected, key] of expectedReviewIndexes) if (!sameRefs(actual, expected)) findings.push(finding("incomplete_review_index", `review/${key}`, `Review ${key} must exactly mirror current unresolved state.`));

  const conclusionFields = [
    "clearToCloseClaim", "ownershipClaim", "legalConclusion", "contractInterpretation", "inspectionConclusion",
    "appraisalConclusion", "financingConclusion", "titleConclusion", "insuranceConclusion", "taxConclusion",
    "settlementConclusion", "wireInstructionValidation",
  ];
  for (const key of conclusionFields) if (review[key] !== false) findings.push(finding("prohibited_professional_conclusion", `review/${key}`, "The handoff cannot claim advice, interpretation, professional conclusions, verified wire instructions, clearance to close, or ownership."));
  for (const [key, allowed] of Object.entries(prohibitedActions)) if (allowed !== false) findings.push(finding("prohibited_authority_claim", `prohibitedActions/${key}`, "Every prohibited transaction action must remain false."));

  const blockerCount = expectedReviewIndexes.reduce((total, [, expected]) => total + expected.length, 0);
  if (review.state !== (blockerCount > 0 || findings.length > 0 ? "blocked" : "ready-for-buyer-review")) findings.push(finding("premature_review_readiness", "review/state", "Any invalid evidence or open question, gap, unresolved milestone, condition, deadline, blocked workstream, missing receipt, or wire-safety question requires a blocked handoff."));

  for (const text of collectStrings(value)) {
    if (SENSITIVE_TEXT_PATTERN.test(text)) {
      findings.push(finding("secret_bearing_text", "", "The artifact must not contain credentials, account or routing data, precise street addresses, email addresses, or secret-bearing text."));
      break;
    }
  }

  return findings;
}
