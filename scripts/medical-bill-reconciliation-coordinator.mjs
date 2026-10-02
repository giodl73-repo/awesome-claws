const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const arrays = ["documents", "lines", "associations", "comparisons", "transfers", "questions"];
const equalSet = (a, b) => Array.isArray(a) && new Set(a).size === a.length &&
  a.length === b.length && a.every((id) => b.includes(id));
const moneyKinds = ["payment-receipt", "provider-posting", "refund-notice", "refund-receipt"];

export function medicalBillingFindings(value) {
  const findings = [];
  const fail = (code, path, message) => findings.push({ code, path, message });
  if (!object(value) || !object(value.scope) || !object(value.review) ||
      arrays.some((key) => !Array.isArray(value[key]) || value[key].some((row) => !object(row)))) {
    fail("invalid_medical_billing_shape", "$", "A complete reconciliation record is required.");
    return findings;
  }
  const { scope, documents, lines, associations, comparisons, transfers, questions, review } = value;
  const docs = new Map(documents.map((row) => [row.id, row]));
  const lineMap = new Map(lines.map((row) => [row.id, row]));
  const associationMap = new Map(associations.map((row) => [row.id, row]));
  const ids = arrays.flatMap((key) => value[key].map((row) => row.id));
  if (ids.some((id) => typeof id !== "string") || new Set(ids).size !== ids.length) {
    fail("duplicate_identity", "$", "Every ledger row must have a unique identity.");
  }
  if (new Set(documents.map((doc) => doc.controlledRef)).size !== documents.length) {
    fail("duplicate_billing_source", "documents", "Repeated source documents require owner clarification, not separate financial observations.");
  }
  if (value.schemaVersion !== "awesomeClaws.medicalBilling.v1" || !documents.length || !lines.length ||
      !equalSet(scope.documentRefs, documents.map((row) => row.id)) ||
      !equalSet(scope.lineRefs, lines.map((row) => row.id))) {
    fail("incomplete_billing_index", "scope", "Inventory every supplied document and service line, including history.");
  }
  if (![scope.start, scope.end, scope.asOf].every((date) => typeof date === "string" && Number.isFinite(Date.parse(date))) ||
      scope.start > scope.end || scope.end > scope.asOf) {
    fail("invalid_billing_chronology", "scope", "Use an ordered service period and review date.");
  }
  if (scope.ownerRef !== scope.patientRef || review.ownerRef !== scope.ownerRef ||
      !Array.isArray(scope.helperRefs) || scope.helperRefs.includes(scope.ownerRef) ||
      scope.destination !== "private-owner-workspace" || review.state !== "owner-review-required" ||
      review.externalActions !== "none" || review.liabilityDetermination !== "not-made") {
    fail("invalid_patient_authority", "review", "The patient retains review, disclosure, and financial authority.");
  }

  const successors = new Map();
  const expectedQuestions = new Set();
  const requireQuestion = (target, reason) => expectedQuestions.add(`${target}:${reason}`);
  const sameContext = (a, b) => a && b && a.patientRef === b.patientRef &&
    a.providerRef === b.providerRef && a.currency === b.currency;
  for (const doc of documents) {
    const path = `documents.${doc.id}`;
    if (doc.patientRef !== scope.patientRef || doc.currency !== scope.currency) {
      fail("cross_billing_scope", path, "Patient and currency must agree with the bounded scope.");
    }
    if (!/^controlled:\/\/medical-billing\/source-[a-z0-9-]{1,48}$/.test(doc.controlledRef ?? "")) {
      fail("unsafe_billing_reference", path, "Use a minimized controlled source reference, never portal URLs or identifiers.");
    }
    const allowedIssuers = {
      bill: ["provider"], eob: ["insurer"], "link-record": ["provider", "insurer", "patient"],
      "payment-receipt": ["payment-processor", "insurer"], "provider-posting": ["provider"],
      "refund-notice": ["provider", "insurer"], "refund-receipt": ["payment-processor"],
      correspondence: ["provider", "insurer"],
    };
    if (!allowedIssuers[doc.kind]?.includes(doc.issuerKind) ||
        (doc.issuerKind === "provider" && doc.issuerRef !== doc.providerRef) ||
        (doc.issuerKind === "patient" && doc.issuerRef !== scope.patientRef)) {
      fail("invalid_billing_issuer", path, "Statements and independent receipts must retain the correct issuer.");
    }
    if (!Number.isFinite(Date.parse(doc.issuedOn)) || doc.issuedOn > scope.asOf) {
      fail("invalid_billing_chronology", path, "Document dates cannot follow the review date.");
    }
    if (!equalSet(doc.lineRefs, lines.filter((line) => line.documentRef === doc.id).map((line) => line.id)) ||
        (!["bill", "eob"].includes(doc.kind) && doc.lineRefs?.length)) {
      fail("incomplete_document_lines", path, "Only bills and EOBs own service lines; account for all of them.");
    }
    if (["bill", "eob"].includes(doc.kind) && !doc.lineRefs?.length) {
      fail("missing_service_itemization", path, "Missing bill or EOB itemization requires a blocked intake handoff.");
    }
    if (!Array.isArray(doc.relatedLineRefs) || doc.relatedLineRefs.some((id) => {
      const line = lineMap.get(id);
      return !line || !sameContext(doc, docs.get(line.documentRef));
    })) {
      fail("invalid_billing_subject", path, "Related service lines must exist and have the same patient, provider, and currency.");
    }
    if (moneyKinds.includes(doc.kind)) {
      if (!Number.isSafeInteger(doc.amountMinor) || doc.amountMinor < 0 || !doc.transactionRef || !doc.relatedLineRefs?.length) {
        fail("invalid_transfer_evidence", path, "Money observations need an exact transaction, amount, and service-line scope.");
      }
    } else if (doc.amountMinor !== null || doc.transactionRef !== null) {
      fail("invalid_transfer_evidence", path, "A bill, EOB, or correspondence item is not a payment or refund receipt.");
    }
    const prior = docs.get(doc.supersedesRef);
    if (doc.supersedesRef !== null) {
      if (!prior || !sameContext(prior, doc) || prior.kind !== doc.kind ||
          prior.issuerRef !== doc.issuerRef || prior.seriesRef !== doc.seriesRef ||
          prior.issuedOn > doc.issuedOn || !["bill", "eob"].includes(doc.kind) || doc.revision === "original") {
        fail("invalid_claim_lineage", path, "Corrections and reversals require the exact earlier issuer series.");
      }
      if (successors.has(doc.supersedesRef)) fail("invalid_claim_lineage", path, "A revision cannot have competing successors.");
      successors.set(doc.supersedesRef, doc.id);
    } else if (doc.revision !== "original") {
      fail("invalid_claim_lineage", path, "A correction or reversal must retain its predecessor.");
    }
    if (doc.revision === "reversal" && doc.kind !== "eob") fail("invalid_claim_lineage", path, "Only an EOB can carry this reversal observation.");
    if (doc.deadline !== null) requireQuestion(doc.id, "deadline-question");
    if (doc.kind === "correspondence") requireQuestion(doc.id, "correspondence-review");
  }
  const series = new Map();
  for (const doc of documents) {
    const group = series.get(doc.seriesRef) ?? [];
    group.push(doc);
    series.set(doc.seriesRef, group);
    const seen = new Set([doc.id]);
    let prior = docs.get(doc.supersedesRef);
    while (prior) {
      if (seen.has(prior.id)) { fail("invalid_claim_lineage", `documents.${doc.id}`, "Revision history must be acyclic."); break; }
      seen.add(prior.id);
      prior = docs.get(prior.supersedesRef);
    }
  }
  for (const group of series.values()) {
    if (group.filter((doc) => doc.supersedesRef === null).length !== 1 ||
        group.filter((doc) => !successors.has(doc.id)).length !== 1) {
      fail("invalid_claim_lineage", "documents", "Each series must form one complete revision chain.");
    }
  }
  const active = (doc) => doc && !successors.has(doc.id) && doc.revision !== "reversal";
  for (const line of lines) {
    const doc = docs.get(line.documentRef);
    if (!doc || !["bill", "eob"].includes(doc.kind)) fail("invalid_billing_subject", `lines.${line.id}`, "Service lines belong to a bill or EOB.");
    if (!Number.isFinite(Date.parse(line.serviceDate)) || line.serviceDate < scope.start ||
        line.serviceDate > scope.end || (doc && line.serviceDate > doc.issuedOn)) {
      fail("invalid_billing_chronology", `lines.${line.id}`, "Service dates must fit the bounded period and issued statement.");
    }
    if (doc?.kind === "bill" && (line.allowedMinor !== null || line.reportedResponsibilityMinor !== null)) {
      fail("conflated_billing_amount", `lines.${line.id}`, "Insurer allowed amounts and responsibility cannot be attributed to a provider bill.");
    }
  }

  const consumed = [];
  const expectedComparisons = new Map();
  for (const link of associations) {
    const refs = Array.isArray(link.lineRefs) ? link.lineRefs : [];
    consumed.push(...refs);
    const rows = refs.map((id) => lineMap.get(id));
    const path = `associations.${link.id}`;
    if (link.state === "unmatched") {
      if (refs.length !== 1 || !rows[0] || link.evidenceRef !== null) fail("invalid_service_association", path, "Unmatched lines must remain explicit singletons.");
      requireQuestion(link.id, "unmatched-line");
      continue;
    }
    const bill = rows.find((row) => docs.get(row?.documentRef)?.kind === "bill");
    const eob = rows.find((row) => docs.get(row?.documentRef)?.kind === "eob");
    const evidence = docs.get(link.evidenceRef);
    if (link.state !== "documented-link" || refs.length !== 2 || !bill || !eob ||
        bill.serviceDate !== eob.serviceDate || !sameContext(docs.get(bill.documentRef), docs.get(eob.documentRef)) ||
        !evidence || evidence.kind !== "link-record" || !active(evidence) ||
        !equalSet(evidence.relatedLineRefs, refs) || !sameContext(evidence, docs.get(bill.documentRef))) {
      fail("invalid_service_association", path, "Use explicit exact-line association evidence, never an inferred match.");
      continue;
    }
    if (!active(docs.get(bill.documentRef)) || !active(docs.get(eob.documentRef))) {
      requireQuestion(link.id, "historical-or-reversed-link");
    } else if (documents.some((candidate) => {
      if (candidate.kind !== "link-record" || !Array.isArray(candidate.relatedLineRefs)) return false;
      const currentRefs = candidate.relatedLineRefs.filter((id) => active(docs.get(lineMap.get(id)?.documentRef)));
      return currentRefs.some((id) => refs.includes(id)) && currentRefs.some((id) => !refs.includes(id));
    })) {
      fail("ambiguous_service_association", path, "Competing current line links must remain unmatched for patient review.");
    } else if (!Number.isSafeInteger(bill.chargedMinor) || !Number.isSafeInteger(eob.chargedMinor)) {
      requireQuestion(link.id, "missing-charge");
    } else {
      expectedComparisons.set(link.id, bill.chargedMinor - eob.chargedMinor);
    }
  }
  if (!equalSet(consumed, lines.map((row) => row.id))) fail("incomplete_service_partition", "associations", "Represent every current and historical line exactly once.");
  if (!equalSet(comparisons.map((row) => row.associationRef), [...expectedComparisons.keys()])) {
    fail("incomplete_charge_comparisons", "comparisons", "Compare every current documented charge pair, and no historical pairs.");
  }
  for (const comparison of comparisons) {
    if (!associationMap.has(comparison.associationRef) || comparison.field !== "provider-charge-minus-insurer-reported-charge" ||
        !expectedComparisons.has(comparison.associationRef) || comparison.differenceMinor !== expectedComparisons.get(comparison.associationRef)) {
      fail("unsupported_charge_comparison", `comparisons.${comparison.id}`, "Only subtract the two attributed charge fields; this is not patient liability.");
    }
    if (expectedComparisons.get(comparison.associationRef) !== 0) requireQuestion(comparison.id, "charge-difference");
  }

  const transferDocs = [];
  const transactionKinds = new Set();
  for (const doc of documents.filter((row) => moneyKinds.includes(row.kind))) {
    const key = [doc.kind, doc.providerRef, doc.transactionRef].join(":");
    if (transactionKinds.has(key)) fail("duplicate_transfer_observation", `documents.${doc.id}`, "Duplicate transaction observations require owner clarification, not double counting.");
    transactionKinds.add(key);
  }
  for (const transfer of transfers) {
    const first = docs.get(transfer.evidenceRef);
    const second = docs.get(transfer.counterpartRef);
    const contract = {
      payment: ["payment-receipt", "provider-posting", "receipt-and-posting-observed", "posting-missing"],
      refund: ["refund-notice", "refund-receipt", "notice-and-receipt-observed", "refund-receipt-missing"],
      "unmatched-posting": ["provider-posting", null, null, "unmatched"],
      "unmatched-refund-receipt": ["refund-receipt", null, null, "unmatched"],
    }[transfer.kind];
    transferDocs.push(transfer.evidenceRef);
    if (transfer.counterpartRef !== null) transferDocs.push(transfer.counterpartRef);
    const paired = transfer.counterpartRef !== null;
    if (!contract || !first || first.kind !== contract[0] ||
        (paired && (!second || !contract[1] || second.kind !== contract[1] ||
          !sameContext(first, second) || first.transactionRef !== second.transactionRef ||
          first.amountMinor !== second.amountMinor || !equalSet(first.relatedLineRefs, second.relatedLineRefs))) ||
        transfer.state !== contract[paired ? 2 : 3]) {
      fail("unsupported_transfer_match", `transfers.${transfer.id}`, "A receipt and counterpart must bind the same transaction, amount, and service lines.");
    }
    if (!paired) requireQuestion(transfer.id, "transfer-evidence-gap");
  }
  if (!equalSet(transferDocs, documents.filter((row) => moneyKinds.includes(row.kind)).map((row) => row.id))) {
    fail("incomplete_transfer_partition", "transfers", "Preserve each payment, posting, refund notice, and receipt exactly once.");
  }
  const actualQuestions = [];
  for (const question of questions) {
    const key = `${question.targetRef}:${question.reason}`;
    actualQuestions.push(key);
    const source = docs.get(question.sourceRef);
    if (question.ownerRef !== scope.ownerRef || !expectedQuestions.has(key) ||
        (question.reason === "deadline-question"
          ? (!source || source.id !== question.targetRef || source.deadline === null || question.deadline !== source.deadline)
          : (question.deadline !== null || question.sourceRef !== null))) {
      fail("unsupported_owner_question", `questions.${question.id}`, "Keep gaps patient-owned and deadlines exact and source-bound.");
    }
  }
  if (!equalSet(actualQuestions, [...expectedQuestions])) fail("hidden_billing_gap", "questions", "Every discrepancy and unresolved evidence gap requires an owner question.");
  return findings;
}
