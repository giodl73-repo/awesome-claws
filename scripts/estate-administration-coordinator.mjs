const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/u;
const EXACT_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const SENSITIVE_TEXT_PATTERN = /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b\d{3}-\d{2}-\d{4}\b|\b(?:account|routing|taxpayer|ssn|password|secret|token|api[-_ ]?key)\s*[:=]\s*\S+|\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)\b)/iu;

const sourceAuthorityKinds = new Map([
  ["death-record", new Set(["court"])],
  ["appointment-instrument", new Set(["court"])],
  ["court-order", new Set(["court"])],
  ["will-or-trust-pointer", new Set(["personal-representative", "legal-counsel"])],
  ["professional-instruction", new Set(["legal-counsel", "tax-professional", "valuation-professional"])],
  ["owner-inventory", new Set(["personal-representative"])],
  ["asset-record", new Set(["personal-representative", "financial-institution", "property-custodian"])],
  ["liability-record", new Set(["personal-representative", "financial-institution", "creditor-or-claimant", "tax-professional"])],
  ["valuation-record", new Set(["valuation-professional"])],
  ["statement", new Set(["financial-institution", "property-custodian"])],
  ["notice-record", new Set(["personal-representative", "court", "legal-counsel"])],
  ["claim-record", new Set(["creditor-or-claimant", "tax-professional", "beneficiary-or-interested-party"])],
  ["claim-decision", new Set(["personal-representative", "court", "legal-counsel"])],
  ["owner-action-note", new Set(["personal-representative"])],
  ["independent-receipt", new Set(["court", "financial-institution", "creditor-or-claimant", "beneficiary-or-interested-party", "property-custodian"])],
  ["distribution-proposal", new Set(["personal-representative"])],
  ["distribution-approval", new Set(["personal-representative", "court", "legal-counsel"])],
  ["professional-answer", new Set(["court", "legal-counsel", "tax-professional", "valuation-professional", "financial-institution", "property-custodian"])],
  ["gap-resolution", new Set(["personal-representative", "court", "legal-counsel", "tax-professional", "valuation-professional", "financial-institution", "creditor-or-claimant", "beneficiary-or-interested-party", "property-custodian"])],
]);

const questionAuthorityKinds = new Map([
  ["legal", new Set(["legal-counsel", "court"])],
  ["tax", new Set(["tax-professional"])],
  ["valuation", new Set(["valuation-professional"])],
  ["ownership", new Set(["legal-counsel", "court"])],
  ["claim", new Set(["legal-counsel", "court"])],
  ["deadline", new Set(["legal-counsel", "court", "tax-professional"])],
  ["beneficiary", new Set(["legal-counsel", "court"])],
  ["institution", new Set(["financial-institution", "property-custodian"])],
  ["closure", new Set(["legal-counsel", "court"])],
]);

const questionScopes = new Map([
  ["legal", "legal-question"],
  ["tax", "tax-question"],
  ["valuation", "valuation-question"],
  ["ownership", "legal-question"],
  ["claim", "legal-question"],
  ["deadline", null],
  ["beneficiary", "legal-question"],
  ["institution", "institutional-record"],
  ["closure", "legal-question"],
]);

const gapOwnerKinds = new Map([
  ["missing-authority", new Set(["personal-representative", "court", "legal-counsel"])],
  ["missing-source", new Set(["personal-representative", "court", "legal-counsel", "tax-professional", "valuation-professional", "financial-institution", "property-custodian"])],
  ["ownership", new Set(["legal-counsel", "court"])],
  ["value", new Set(["valuation-professional", "financial-institution", "property-custodian"])],
  ["liability", new Set(["legal-counsel", "tax-professional", "financial-institution", "creditor-or-claimant"])],
  ["claim", new Set(["legal-counsel", "court"])],
  ["deadline", new Set(["legal-counsel", "court", "tax-professional"])],
  ["receipt", new Set(["personal-representative", "court", "financial-institution", "creditor-or-claimant", "beneficiary-or-interested-party", "property-custodian"])],
  ["distribution", new Set(["personal-representative", "legal-counsel", "court"])],
  ["privacy", new Set(["personal-representative", "legal-counsel"])],
  ["professional-question", new Set(["legal-counsel", "tax-professional", "valuation-professional"])],
  ["residual-estate-state", new Set(["personal-representative", "legal-counsel", "court"])],
]);

const authorityScopes = new Map([
  ["personal-representative", new Set(["estate-administration-owner", "source-issuer", "review"])],
  ["court", new Set(["source-issuer", "legal-question", "receipt-issuer", "review"])],
  ["legal-counsel", new Set(["source-issuer", "legal-question", "review"])],
  ["tax-professional", new Set(["source-issuer", "tax-question", "claim-position", "review"])],
  ["valuation-professional", new Set(["source-issuer", "valuation-question"])],
  ["financial-institution", new Set(["source-issuer", "institutional-record", "receipt-issuer"])],
  ["creditor-or-claimant", new Set(["source-issuer", "claim-position", "receipt-issuer"])],
  ["beneficiary-or-interested-party", new Set(["source-issuer", "beneficiary-question", "receipt-issuer"])],
  ["property-custodian", new Set(["source-issuer", "institutional-record", "receipt-issuer"])],
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
    if (record(row).id !== undefined && !result.has(row.id)) result.set(row.id, row);
  }
  return result;
}

function sameRefs(actual, expected) {
  const left = rows(actual).filter((ref) => typeof ref === "string").toSorted();
  const right = [...expected].filter((ref) => typeof ref === "string").toSorted();
  return left.length === right.length && left.every((ref, index) => ref === right[index]);
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

function hasScope(authority, scope) {
  return rows(authority?.scope).includes(scope);
}

export function estateAdministrationFindings(input) {
  const findings = [];
  const value = record(input);
  if (Object.keys(value).length === 0) return [finding("invalid_artifact", "", "Estate administration artifact must be an object with the complete contract.")];

  const estate = record(value.estate);
  const review = record(value.review);
  const prohibitedActions = record(value.prohibitedActions);
  const authorities = rowMap(value.authorities);
  const sources = rowMap(value.sources);
  const assets = rowMap(value.assets);
  const liabilities = rowMap(value.liabilities);
  const notices = rowMap(value.notices);
  const claims = rowMap(value.claims);
  const deadlines = rowMap(value.deadlines);
  const actions = rowMap(value.actions);
  const distributions = rowMap(value.distributions);
  const questions = rowMap(value.questions);
  const gaps = rowMap(value.gaps);

  const collections = [value.authorities, value.sources, value.assets, value.liabilities, value.notices, value.claims, value.deadlines, value.actions, value.distributions, value.questions, value.gaps];
  const seenIds = new Set();
  if (typeof estate.id === "string") seenIds.add(estate.id);
  for (const collection of collections) {
    for (const row of rows(collection)) {
      const id = record(row).id;
      if (typeof id !== "string" || !IDENTIFIER_PATTERN.test(id) || seenIds.has(id)) findings.push(finding("duplicate_identity", "id", `Every record requires one globally unique stable id; found ${String(id)}.`));
      else seenIds.add(id);
    }
  }

  const estateId = estate.id;
  const asOf = exactInstant(estate.asOf);
  if (asOf === null || exactInstant(review.asOf) !== asOf) findings.push(finding("invalid_estate_chronology", "review/asOf", "Estate and review require the same exact zone-bearing as-of instant."));
  const representative = requireRef(authorities, estate.personalRepresentativeAuthorityRef, "estate/personalRepresentativeAuthorityRef", "invalid_estate_authority", findings);
  if (!representative || representative.kind !== "personal-representative" || !hasScope(representative, "estate-administration-owner") || !hasScope(representative, "review")) findings.push(finding("invalid_estate_authority", "estate/personalRepresentativeAuthorityRef", "Estate ownership requires a scoped documented personal representative."));

  const exactIndexes = [
    [estate.sourceRefs, sources.keys(), "sourceRefs"],
    [estate.assetRefs, assets.keys(), "assetRefs"],
    [estate.liabilityRefs, liabilities.keys(), "liabilityRefs"],
    [estate.noticeRefs, notices.keys(), "noticeRefs"],
    [estate.claimRefs, claims.keys(), "claimRefs"],
    [estate.deadlineRefs, deadlines.keys(), "deadlineRefs"],
    [estate.actionRefs, actions.keys(), "actionRefs"],
    [estate.distributionRefs, distributions.keys(), "distributionRefs"],
    [estate.questionRefs, questions.keys(), "questionRefs"],
    [estate.gapRefs, gaps.keys(), "gapRefs"],
  ];
  for (const [actual, expected, key] of exactIndexes) if (!sameRefs(actual, expected)) findings.push(finding("incomplete_estate_index", `estate/${key}`, `Estate ${key} must exactly cover the corresponding collection.`));

  const appointment = representative?.authorizationSourceRef === null ? null : requireRef(sources, representative?.authorizationSourceRef, `authorities/${representative?.id}/authorizationSourceRef`, "invalid_authority_evidence", findings);
  const appointmentIssuer = appointment ? authorities.get(appointment.issuerAuthorityRef) : null;
  if (!appointment || appointment.kind !== "appointment-instrument" || appointment.subjectRef !== estateId || appointment.freshness !== "current" || appointmentIssuer?.kind !== "court") findings.push(finding("invalid_authority_evidence", `authorities/${representative?.id}/authorizationSourceRef`, "Personal-representative authority requires a current same-estate court appointment instrument."));

  for (const [id, authority] of authorities) {
    const allowedScopes = authorityScopes.get(authority.kind);
    if (!allowedScopes || rows(authority.scope).some((scope) => !allowedScopes.has(scope))) findings.push(finding("invalid_authority_evidence", `authorities/${id}/scope`, "Authority scopes must be appropriate for the declared human, court, professional, institution, claimant, beneficiary, or custodian role."));
    if (id !== representative?.id && authority.authorizationSourceRef !== null) {
      const authorization = requireRef(sources, authority.authorizationSourceRef, `authorities/${id}/authorizationSourceRef`, "invalid_authority_evidence", findings);
      if (authorization && (authorization.subjectRef !== estateId || authorization.freshness !== "current" || authorization.issuerAuthorityRef === id)) findings.push(finding("invalid_authority_evidence", `authorities/${id}/authorizationSourceRef`, "An authority reference must resolve to current same-estate evidence from a different issuer."));
    }
  }

  const subjectIds = new Set([estateId, ...assets.keys(), ...liabilities.keys(), ...notices.keys(), ...claims.keys(), ...deadlines.keys(), ...actions.keys(), ...distributions.keys(), ...questions.keys(), ...gaps.keys()]);
  for (const [id, source] of sources) {
    const issuer = requireRef(authorities, source.issuerAuthorityRef, `sources/${id}/issuerAuthorityRef`, "invalid_source_authority", findings);
    const expectedKinds = sourceAuthorityKinds.get(source.kind);
    const requiredScope = source.kind === "independent-receipt" ? "receipt-issuer" : "source-issuer";
    if (!issuer || !expectedKinds?.has(issuer.kind) || !hasScope(issuer, requiredScope)) findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Source kind requires a matching scoped human, court, professional, institution, claimant, beneficiary, or custodian authority."));
    if (!subjectIds.has(source.subjectRef)) findings.push(finding("invalid_source_subject", `sources/${id}/subjectRef`, "Every source must bind one exact estate record subject."));
    const assertedAt = exactInstant(source.assertedAt);
    const retrievedAt = exactInstant(source.retrievedAt);
    if (assertedAt === null || retrievedAt === null || assertedAt > retrievedAt || asOf === null || retrievedAt > asOf) findings.push(finding("invalid_source_chronology", `sources/${id}`, "Source assertion must not follow retrieval, and retrieval must not follow the estate review."));
    if (source.minimized !== true || source.containsSecrets !== false || typeof source.controlledRef !== "string" || SENSITIVE_TEXT_PATTERN.test(source.controlledRef)) findings.push(finding("secret_bearing_source", `sources/${id}`, "Estate sources must be minimized, secret-free controlled references."));
  }

  for (const text of collectStrings({ stableEstateRef: estate.stableEstateRef, generalizedJurisdiction: estate.generalizedJurisdiction, authorities: rows(value.authorities).map((row) => record(row).label), assets: rows(value.assets).map((row) => record(row).label), liabilities: rows(value.liabilities).map((row) => record(row).label) })) {
    if (SENSITIVE_TEXT_PATTERN.test(text)) findings.push(finding("secret_bearing_text", "", "Durable estate labels must not contain direct identifiers, credentials, account data, or precise addresses."));
  }

  const allBusinessMaps = [assets, liabilities, notices, claims, deadlines, actions, distributions, questions, gaps];
  for (const map of allBusinessMaps) for (const [id, row] of map) if (row.estateRef !== estateId) findings.push(finding("cross_estate_record", `${id}/estateRef`, "Every administration record must bind the exact estate."));

  for (const [id, asset] of assets) {
    if (asset.institutionOrCustodianAuthorityRef !== null) {
      const custodian = requireRef(authorities, asset.institutionOrCustodianAuthorityRef, `assets/${id}/institutionOrCustodianAuthorityRef`, "invalid_asset_source", findings);
      if (!custodian || !["financial-institution", "property-custodian"].includes(custodian.kind) || !hasScope(custodian, "institutional-record")) findings.push(finding("invalid_asset_source", `assets/${id}/institutionOrCustodianAuthorityRef`, "Asset custodians require a scoped institution or property custodian."));
    }
    requireRefs(sources, asset.ownershipSourceRefs, `assets/${id}/ownershipSourceRefs`, "invalid_asset_source", findings);
    requireRefs(sources, asset.valuationSourceRefs, `assets/${id}/valuationSourceRefs`, "invalid_asset_source", findings);
    const ownershipSources = rows(asset.ownershipSourceRefs).map((ref) => sources.get(ref)).filter(Boolean);
    if (ownershipSources.some((source) => ![id, estateId].includes(source.subjectRef)) || (asset.ownershipEvidenceState === "supported" && !ownershipSources.some((source) => source.subjectRef === id && source.freshness === "current" && ["asset-record", "statement", "court-order"].includes(source.kind)))) findings.push(finding("invalid_asset_source", `assets/${id}/ownershipSourceRefs`, "Asset ownership evidence must bind the asset or estate, and supported ownership needs current same-asset authoritative evidence."));
    const valuationSources = rows(asset.valuationSourceRefs).map((ref) => sources.get(ref)).filter(Boolean);
    if (valuationSources.some((source) => source.subjectRef !== id || !["valuation-record", "statement", "asset-record"].includes(source.kind))) findings.push(finding("invalid_asset_source", `assets/${id}/valuationSourceRefs`, "Asset valuation evidence must be kind-appropriate and bind the exact asset."));
    const statedValue = ["current", "estimated"].includes(asset.valueState);
    const valuePairIsValid = (asset.valueMinorUnits === null && asset.currency === null) || (Number.isSafeInteger(asset.valueMinorUnits) && typeof asset.currency === "string");
    if (!valuePairIsValid || (statedValue && (asset.valueMinorUnits === null || valuationSources.length === 0 || valuationSources.some((source) => source.freshness !== "current"))) || (asset.valueState === "unknown" && (asset.valueMinorUnits !== null || valuationSources.length > 0))) findings.push(finding("invalid_asset_value", `assets/${id}`, "Asset amounts and currencies must be paired; current or estimated values require current exact-asset evidence, while unknown values carry no amount or valuation evidence."));
    const expectedActions = [...actions].filter(([, row]) => rows(row.subjectRefs).includes(id)).map(([ref]) => ref);
    const expectedDistributions = [...distributions].filter(([, row]) => rows(row.assetRefs).includes(id)).map(([ref]) => ref);
    const expectedGaps = [...gaps].filter(([, row]) => rows(row.subjectRefs).includes(id)).map(([ref]) => ref);
    if (!sameRefs(asset.actionRefs, expectedActions) || !sameRefs(asset.distributionRefs, expectedDistributions) || !sameRefs(asset.gapRefs, expectedGaps)) findings.push(finding("incomplete_asset_index", `assets/${id}`, "Asset action, distribution, and gap backlinks must exactly match their ledgers."));
    if (asset.ownershipDeterminationByClaw !== false || asset.valuationByClaw !== false) findings.push(finding("prohibited_professional_conclusion", `assets/${id}`, "The Claw cannot determine estate ownership or value."));
  }

  for (const [id, liability] of liabilities) {
    requireRefs(sources, liability.sourceRefs, `liabilities/${id}/sourceRefs`, "invalid_liability_source", findings);
    const liabilitySources = rows(liability.sourceRefs).map((ref) => sources.get(ref)).filter(Boolean);
    const allowedSubjects = new Set([id, liability.claimRef].filter(Boolean));
    if (liabilitySources.some((source) => !allowedSubjects.has(source.subjectRef) || !["liability-record", "claim-record", "statement", "court-order", "professional-instruction"].includes(source.kind))) findings.push(finding("invalid_liability_source", `liabilities/${id}/sourceRefs`, "Liability evidence must bind the liability or its exact claim and be kind-appropriate."));
    const amountPairIsValid = (liability.amountMinorUnits === null && liability.currency === null) || (Number.isSafeInteger(liability.amountMinorUnits) && typeof liability.currency === "string");
    if (!amountPairIsValid || (liability.amountState === "documented" && (liability.amountMinorUnits === null || !liabilitySources.some((source) => source.freshness === "current"))) || (liability.amountState === "unknown" && liability.amountMinorUnits !== null)) findings.push(finding("invalid_liability_amount", `liabilities/${id}`, "Liability amounts and currencies must be paired; documented liabilities require current support, while unknown liabilities carry no amount."));
    const expectedActions = [...actions].filter(([, row]) => rows(row.subjectRefs).includes(id)).map(([ref]) => ref);
    const expectedGaps = [...gaps].filter(([, row]) => rows(row.subjectRefs).includes(id)).map(([ref]) => ref);
    if (!sameRefs(liability.actionRefs, expectedActions) || !sameRefs(liability.gapRefs, expectedGaps)) findings.push(finding("invalid_claim_binding", `liabilities/${id}`, "Liability action and gap backlinks must be exact."));
    if (liability.claimRef !== null) {
      const claim = requireRef(claims, liability.claimRef, `liabilities/${id}/claimRef`, "invalid_claim_binding", findings);
      if (!claim || claim.liabilityRef !== id) findings.push(finding("invalid_claim_binding", `liabilities/${id}/claimRef`, "Liability and claim references must be reciprocal."));
    }
    if (liability.validityDeterminationByClaw !== false || liability.priorityDeterminationByClaw !== false || liability.payableDeterminationByClaw !== false) findings.push(finding("prohibited_professional_conclusion", `liabilities/${id}`, "The Claw cannot determine liability validity, priority, or payability."));
  }

  for (const [id, claim] of claims) {
    const claimant = requireRef(authorities, claim.claimantAuthorityRef, `claims/${id}/claimantAuthorityRef`, "invalid_claim_binding", findings);
    if (!claimant || !["creditor-or-claimant", "tax-professional", "beneficiary-or-interested-party"].includes(claimant.kind) || !hasScope(claimant, "claim-position")) findings.push(finding("invalid_claim_binding", `claims/${id}/claimantAuthorityRef`, "Claims require a scoped claimant authority."));
    requireRefs(sources, claim.sourceRefs, `claims/${id}/sourceRefs`, "invalid_claim_binding", findings);
    const claimSources = rows(claim.sourceRefs).map((ref) => sources.get(ref)).filter(Boolean);
    if (!claimSources.some((source) => source.kind === "claim-record" && source.subjectRef === id && source.issuerAuthorityRef === claim.claimantAuthorityRef)) findings.push(finding("invalid_claim_binding", `claims/${id}/sourceRefs`, "Every claim needs same-claim evidence from its claimant."));
    const claimAmountPairIsValid = (claim.assertedAmountMinorUnits === null && claim.currency === null) || (Number.isSafeInteger(claim.assertedAmountMinorUnits) && typeof claim.currency === "string");
    if (!claimAmountPairIsValid) findings.push(finding("invalid_claim_binding", `claims/${id}`, "Claim amounts and currencies must be absent together or present together as safe minor units and a currency."));
    const expectedActions = [...actions].filter(([, row]) => rows(row.subjectRefs).includes(id)).map(([ref]) => ref);
    const expectedGaps = [...gaps].filter(([, row]) => rows(row.subjectRefs).includes(id)).map(([ref]) => ref);
    if (!sameRefs(claim.actionRefs, expectedActions) || !sameRefs(claim.gapRefs, expectedGaps)) findings.push(finding("invalid_claim_binding", `claims/${id}`, "Claim action and gap backlinks must exactly match their ledgers."));
    if (claim.liabilityRef !== null) {
      const liability = requireRef(liabilities, claim.liabilityRef, `claims/${id}/liabilityRef`, "invalid_claim_binding", findings);
      if (!liability || liability.claimRef !== id) findings.push(finding("invalid_claim_binding", `claims/${id}/liabilityRef`, "Claim and liability references must be reciprocal."));
    }
    const decision = claim.decisionSourceRef === null ? null : requireRef(sources, claim.decisionSourceRef, `claims/${id}/decisionSourceRef`, "invalid_claim_decision", findings);
    const decisionState = ["allowed-by-authority", "rejected-by-authority"].includes(claim.state);
    if (decisionState !== Boolean(decision) || (decision && (decision.kind !== "claim-decision" || decision.subjectRef !== id || decision.freshness !== "current"))) findings.push(finding("invalid_claim_decision", `claims/${id}/decisionSourceRef`, "Only an authority-backed same-claim decision source may support an allowed or rejected state."));
    if (claim.validityDeterminationByClaw !== false || claim.priorityDeterminationByClaw !== false || claim.entitlementDeterminationByClaw !== false) findings.push(finding("prohibited_professional_conclusion", `claims/${id}`, "The Claw cannot determine claim validity, priority, or entitlement."));
  }

  for (const [id, notice] of notices) {
    const owner = requireRef(authorities, notice.ownerAuthorityRef, `notices/${id}/ownerAuthorityRef`, "invalid_notice_receipt", findings);
    if (!owner || owner.id !== estate.personalRepresentativeAuthorityRef) findings.push(finding("invalid_notice_receipt", `notices/${id}/ownerAuthorityRef`, "Notice actions remain with the documented personal representative."));
    for (const ref of rows(notice.subjectRefs)) if (!subjectIds.has(ref) || ref === id) findings.push(finding("invalid_notice_receipt", `notices/${id}/subjectRefs`, "Notice subjects must be exact non-self estate records."));
    requireRefs(sources, notice.sourceRefs, `notices/${id}/sourceRefs`, "invalid_notice_receipt", findings);
    const noticeTime = notice.noticeAt === null ? null : exactInstant(notice.noticeAt);
    const receipt = notice.receiptSourceRef === null ? null : requireRef(sources, notice.receiptSourceRef, `notices/${id}/receiptSourceRef`, "invalid_notice_receipt", findings);
    if (notice.state === "planned" && (notice.noticeAt !== null || notice.receiptSourceRef !== null)) findings.push(finding("invalid_notice_receipt", `notices/${id}`, "Planned notices cannot claim execution time or receipt."));
    if (notice.state === "owner-completed-receipted") {
      const ownerNote = rows(notice.sourceRefs).some((ref) => { const source = sources.get(ref); return source?.kind === "notice-record" && source.subjectRef === id && source.issuerAuthorityRef === notice.ownerAuthorityRef; });
      if (!ownerNote || noticeTime === null || !receipt || receipt.kind !== "independent-receipt" || receipt.subjectRef !== id || receipt.issuerAuthorityRef === notice.ownerAuthorityRef || !rows(notice.sourceRefs).includes(receipt.id) || exactInstant(receipt.assertedAt) < noticeTime) findings.push(finding("invalid_notice_receipt", `notices/${id}`, "Completed notices require same-notice owner evidence and a later independent receipt."));
    } else if (notice.receiptSourceRef !== null) findings.push(finding("invalid_notice_receipt", `notices/${id}/receiptSourceRef`, "Only receipted completed notices may carry a receipt."));
    if (notice.applicabilityDeterminationByClaw !== false) findings.push(finding("prohibited_professional_conclusion", `notices/${id}/applicabilityDeterminationByClaw`, "The Claw cannot decide whether a notice is legally required or sufficient."));
  }

  for (const [id, deadline] of deadlines) {
    for (const ref of rows(deadline.subjectRefs)) if (!subjectIds.has(ref) || ref === id) findings.push(finding("invalid_deadline", `deadlines/${id}/subjectRefs`, "Deadline subjects must be exact non-self estate records."));
    requireRefs(sources, deadline.sourceRefs, `deadlines/${id}/sourceRefs`, "invalid_deadline", findings);
    const deadlineSources = rows(deadline.sourceRefs).map((ref) => sources.get(ref)).filter(Boolean);
    if (deadlineSources.some((source) => ![id, ...rows(deadline.subjectRefs)].includes(source.subjectRef))) findings.push(finding("invalid_deadline", `deadlines/${id}/sourceRefs`, "Deadline evidence must bind the deadline or one of its exact subjects."));
    if ((deadline.state === "unknown" && deadline.candidateAt !== null) || (deadline.state !== "unknown" && exactInstant(deadline.candidateAt) === null)) findings.push(finding("invalid_deadline", `deadlines/${id}/candidateAt`, "Known deadline states require an exact candidate; unknown states carry none."));
    const confirmer = deadline.confirmedByAuthorityRef === null ? null : requireRef(authorities, deadline.confirmedByAuthorityRef, `deadlines/${id}/confirmedByAuthorityRef`, "invalid_deadline_confirmation", findings);
    const confirmation = deadline.confirmationSourceRef === null ? null : requireRef(sources, deadline.confirmationSourceRef, `deadlines/${id}/confirmationSourceRef`, "invalid_deadline_confirmation", findings);
    if (deadline.state === "confirmed") {
      if (!confirmer || !["court", "legal-counsel", "tax-professional"].includes(confirmer.kind) || !confirmation || !["court-order", "professional-answer", "professional-instruction"].includes(confirmation.kind) || confirmation.subjectRef !== id || confirmation.issuerAuthorityRef !== confirmer.id || confirmation.freshness !== "current") findings.push(finding("invalid_deadline_confirmation", `deadlines/${id}`, "Confirmed deadlines require current same-deadline evidence from a qualified authority."));
    } else if (deadline.confirmedByAuthorityRef !== null || deadline.confirmationSourceRef !== null) findings.push(finding("invalid_deadline_confirmation", `deadlines/${id}`, "Only confirmed deadlines may carry confirmation authority and evidence."));
    if (deadline.applicabilityDeterminationByClaw !== false) findings.push(finding("prohibited_professional_conclusion", `deadlines/${id}/applicabilityDeterminationByClaw`, "The Claw cannot determine deadline applicability."));
  }

  for (const [id, action] of actions) {
    for (const ref of rows(action.subjectRefs)) if (!subjectIds.has(ref) || ref === id) findings.push(finding("invalid_action_receipt", `actions/${id}/subjectRefs`, "Action subjects must be exact non-self estate records."));
    const owner = requireRef(authorities, action.ownerAuthorityRef, `actions/${id}/ownerAuthorityRef`, "invalid_action_owner", findings);
    if (!owner || owner.id !== estate.personalRepresentativeAuthorityRef) findings.push(finding("invalid_action_owner", `actions/${id}/ownerAuthorityRef`, "Estate actions remain with the documented personal representative."));
    requireRefs(sources, action.sourceRefs, `actions/${id}/sourceRefs`, "invalid_action_receipt", findings);
    const attemptedAt = action.attemptedAt === null ? null : exactInstant(action.attemptedAt);
    const attemptedState = ["attempted", "failed", "owner-completed-receipted"].includes(action.state);
    if ((attemptedState && (attemptedAt === null || asOf === null || attemptedAt > asOf)) || (!attemptedState && action.attemptedAt !== null)) findings.push(finding("invalid_action_chronology", `actions/${id}/attemptedAt`, "Attempted, failed, or completed actions need an exact in-period attempt; other states carry none."));
    const actionSources = rows(action.sourceRefs).map((ref) => sources.get(ref)).filter(Boolean);
    if (attemptedState && !actionSources.some((source) => source.kind === "owner-action-note" && source.subjectRef === id && source.issuerAuthorityRef === action.ownerAuthorityRef && exactInstant(source.assertedAt) >= attemptedAt)) findings.push(finding("invalid_action_receipt", `actions/${id}/sourceRefs`, "Attempted actions require same-action owner evidence at or after the attempt."));
    const receipt = action.receiptSourceRef === null ? null : requireRef(sources, action.receiptSourceRef, `actions/${id}/receiptSourceRef`, "invalid_action_receipt", findings);
    if (action.state === "owner-completed-receipted") {
      if (!receipt || receipt.kind !== "independent-receipt" || receipt.subjectRef !== id || receipt.issuerAuthorityRef === action.ownerAuthorityRef || !rows(action.sourceRefs).includes(receipt.id) || exactInstant(receipt.assertedAt) < attemptedAt) findings.push(finding("invalid_action_receipt", `actions/${id}/receiptSourceRef`, "Completed actions require a later independent same-action receipt."));
    } else if (action.receiptSourceRef !== null) findings.push(finding("invalid_action_receipt", `actions/${id}/receiptSourceRef`, "Only receipted completed actions may carry a receipt."));
    if (action.externalExecution !== "owner-only" || action.agentExecuted !== false) findings.push(finding("external_authority_claim", `actions/${id}`, "Estate actions must remain owner-only and not agent-executed."));
  }

  for (const [id, distribution] of distributions) {
    const beneficiary = requireRef(authorities, distribution.beneficiaryAuthorityRef, `distributions/${id}/beneficiaryAuthorityRef`, "invalid_distribution", findings);
    if (!beneficiary || beneficiary.kind !== "beneficiary-or-interested-party" || !hasScope(beneficiary, "beneficiary-question")) findings.push(finding("invalid_distribution", `distributions/${id}/beneficiaryAuthorityRef`, "Distributions require a minimized beneficiary or interested-party authority."));
    requireRefs(assets, distribution.assetRefs, `distributions/${id}/assetRefs`, "invalid_distribution", findings);
    const distributionAmountPairIsValid = (distribution.amountMinorUnits === null && distribution.currency === null) || (Number.isSafeInteger(distribution.amountMinorUnits) && typeof distribution.currency === "string");
    if (!distributionAmountPairIsValid) findings.push(finding("invalid_distribution", `distributions/${id}`, "Distribution amounts and currencies must be absent together or present together as safe minor units and a currency."));
    const proposal = requireRef(sources, distribution.proposalSourceRef, `distributions/${id}/proposalSourceRef`, "invalid_distribution", findings);
    if (!proposal || proposal.kind !== "distribution-proposal" || proposal.subjectRef !== id || proposal.issuerAuthorityRef !== estate.personalRepresentativeAuthorityRef || proposal.freshness !== "current") findings.push(finding("invalid_distribution", `distributions/${id}/proposalSourceRef`, "Every distribution needs a current same-distribution proposal from the personal representative."));
    const approval = distribution.approvalSourceRef === null ? null : requireRef(sources, distribution.approvalSourceRef, `distributions/${id}/approvalSourceRef`, "invalid_distribution_approval", findings);
    const approvedState = ["approved-by-authority", "owner-executed-receipted"].includes(distribution.state);
    if (approvedState !== Boolean(approval) || (approval && (approval.kind !== "distribution-approval" || approval.subjectRef !== id || approval.freshness !== "current" || !["personal-representative", "court", "legal-counsel"].includes(authorities.get(approval.issuerAuthorityRef)?.kind)))) findings.push(finding("invalid_distribution_approval", `distributions/${id}/approvalSourceRef`, "Only current same-distribution approval from the representative, court, or counsel may support an approved state."));
    const action = distribution.actionRef === null ? null : requireRef(actions, distribution.actionRef, `distributions/${id}/actionRef`, "invalid_distribution_receipt", findings);
    const receipt = distribution.receiptSourceRef === null ? null : requireRef(sources, distribution.receiptSourceRef, `distributions/${id}/receiptSourceRef`, "invalid_distribution_receipt", findings);
    if (distribution.state === "owner-executed-receipted") {
      if (!action || action.kind !== "distribute" || action.state !== "owner-completed-receipted" || !rows(action.subjectRefs).includes(id) || !receipt || receipt.kind !== "independent-receipt" || receipt.subjectRef !== id || receipt.issuerAuthorityRef !== distribution.beneficiaryAuthorityRef) findings.push(finding("invalid_distribution_receipt", `distributions/${id}`, "Executed distributions require a receipted owner action and same-distribution beneficiary receipt."));
    } else if (distribution.actionRef !== null || distribution.receiptSourceRef !== null) findings.push(finding("invalid_distribution_receipt", `distributions/${id}`, "Only owner-executed distributions may carry action and receipt references."));
    if (distribution.entitlementDeterminationByClaw !== false || distribution.authorizationDeterminationByClaw !== false) findings.push(finding("prohibited_professional_conclusion", `distributions/${id}`, "The Claw cannot determine beneficiary entitlement or distribution authority."));
  }

  for (const [id, question] of questions) {
    const askedOf = requireRef(authorities, question.askedOfAuthorityRef, `questions/${id}/askedOfAuthorityRef`, "invalid_question_authority", findings);
    const allowedKinds = questionAuthorityKinds.get(question.kind);
    const requiredScope = questionScopes.get(question.kind);
    const deadlineScopeOk = question.kind !== "deadline" || ["legal-question", "tax-question"].some((scope) => hasScope(askedOf, scope));
    if (!askedOf || !allowedKinds?.has(askedOf.kind) || (requiredScope && !hasScope(askedOf, requiredScope)) || !deadlineScopeOk) findings.push(finding("invalid_question_authority", `questions/${id}/askedOfAuthorityRef`, "Question kind requires its matching scoped qualified authority."));
    for (const ref of rows(question.subjectRefs)) if (!subjectIds.has(ref) || ref === id) findings.push(finding("invalid_question_evidence", `questions/${id}/subjectRefs`, "Questions require exact non-self estate subjects."));
    requireRefs(sources, question.sourceRefs, `questions/${id}/sourceRefs`, "invalid_question_evidence", findings);
    const allowedSubjects = new Set([id, ...rows(question.subjectRefs)]);
    if (rows(question.sourceRefs).some((ref) => sources.has(ref) && !allowedSubjects.has(sources.get(ref).subjectRef))) findings.push(finding("invalid_question_evidence", `questions/${id}/sourceRefs`, "Question evidence must bind the question or one of its exact subjects."));
    const answer = question.answerSourceRef === null ? null : requireRef(sources, question.answerSourceRef, `questions/${id}/answerSourceRef`, "invalid_question_answer", findings);
    if (question.state === "answered") {
      if (!answer || answer.kind !== "professional-answer" || answer.subjectRef !== id || answer.issuerAuthorityRef !== question.askedOfAuthorityRef || answer.freshness !== "current") findings.push(finding("invalid_question_answer", `questions/${id}/answerSourceRef`, "Answered questions require current same-question evidence from the named qualified authority."));
    } else if (question.answerSourceRef !== null) findings.push(finding("invalid_question_answer", `questions/${id}/answerSourceRef`, "Open questions cannot carry answer evidence."));
    if (question.interpretationByClaw !== false) findings.push(finding("prohibited_professional_conclusion", `questions/${id}/interpretationByClaw`, "The Claw cannot interpret professional answers."));
  }

  for (const [id, gap] of gaps) {
    const nextOwner = requireRef(authorities, gap.nextOwnerAuthorityRef, `gaps/${id}/nextOwnerAuthorityRef`, "invalid_gap_owner", findings);
    if (!nextOwner || !gapOwnerKinds.get(gap.kind)?.has(nextOwner.kind)) findings.push(finding("invalid_gap_owner", `gaps/${id}/nextOwnerAuthorityRef`, "Gap kind requires an appropriately qualified next owner."));
    for (const ref of rows(gap.subjectRefs)) if (!subjectIds.has(ref) || ref === id) findings.push(finding("invalid_gap_evidence", `gaps/${id}/subjectRefs`, "Gaps require exact non-self estate subjects."));
    requireRefs(sources, gap.sourceRefs, `gaps/${id}/sourceRefs`, "invalid_gap_evidence", findings);
    const allowedSubjects = new Set([id, ...rows(gap.subjectRefs)]);
    if (rows(gap.sourceRefs).some((ref) => sources.has(ref) && !allowedSubjects.has(sources.get(ref).subjectRef))) findings.push(finding("invalid_gap_evidence", `gaps/${id}/sourceRefs`, "Gap evidence must bind the gap or one of its exact subjects."));
    const resolution = gap.resolutionSourceRef === null ? null : requireRef(sources, gap.resolutionSourceRef, `gaps/${id}/resolutionSourceRef`, "invalid_gap_resolution", findings);
    if (gap.state === "resolved") {
      if (!resolution || resolution.kind !== "gap-resolution" || resolution.subjectRef !== id || resolution.issuerAuthorityRef !== gap.nextOwnerAuthorityRef || resolution.freshness !== "current") findings.push(finding("invalid_gap_resolution", `gaps/${id}/resolutionSourceRef`, "Resolved gaps require current same-gap evidence from the named next owner."));
    } else if (gap.resolutionSourceRef !== null) findings.push(finding("invalid_gap_resolution", `gaps/${id}/resolutionSourceRef`, "Open gaps cannot carry resolution evidence."));
  }

  const derivedReview = [
    [review.openQuestionRefs, [...questions].filter(([, row]) => row.state === "open").map(([id]) => id), "openQuestionRefs"],
    [review.openGapRefs, [...gaps].filter(([, row]) => row.state === "open").map(([id]) => id), "openGapRefs"],
    [review.disputedClaimRefs, [...claims].filter(([, row]) => row.state === "disputed").map(([id]) => id), "disputedClaimRefs"],
    [review.unknownOwnershipAssetRefs, [...assets].filter(([, row]) => ["unknown", "conflicting", "professional-review-needed"].includes(row.ownershipEvidenceState)).map(([id]) => id), "unknownOwnershipAssetRefs"],
    [review.valueGapAssetRefs, [...assets].filter(([, row]) => ["stale", "unknown", "conflicting"].includes(row.valueState)).map(([id]) => id), "valueGapAssetRefs"],
    [review.unresolvedLiabilityRefs, [...liabilities].filter(([, row]) => row.amountState !== "documented").map(([id]) => id), "unresolvedLiabilityRefs"],
    [review.missingReceiptActionRefs, [...actions].filter(([, row]) => ["attempted", "failed"].includes(row.state) && row.receiptSourceRef === null).map(([id]) => id), "missingReceiptActionRefs"],
    [review.proposedDistributionRefs, [...distributions].filter(([, row]) => ["proposed", "blocked"].includes(row.state)).map(([id]) => id), "proposedDistributionRefs"],
    [review.deadlineRefs, deadlines.keys(), "deadlineRefs"],
  ];
  for (const [actual, expected, key] of derivedReview) if (!sameRefs(actual, expected)) findings.push(finding("incomplete_review_index", `review/${key}`, `Review ${key} must exactly match derived estate state.`));
  const nextOwner = requireRef(authorities, review.nextOwnerAuthorityRef, "review/nextOwnerAuthorityRef", "invalid_estate_authority", findings);
  if (!nextOwner || nextOwner.id !== estate.personalRepresentativeAuthorityRef) findings.push(finding("invalid_estate_authority", "review/nextOwnerAuthorityRef", "The documented personal representative owns the estate review handoff."));
  const hasUnresolvedDeadlines = [...deadlines].some(([, row]) => ["conflicting", "unknown"].includes(row.state));
  const hasBlockers = hasUnresolvedDeadlines || derivedReview.slice(0, 8).some(([, expected]) => [...expected].length > 0);
  if ((hasBlockers && review.state !== "blocked") || (!hasBlockers && review.state !== "ready-for-personal-representative-review")) findings.push(finding("premature_review_readiness", "review/state", "Review readiness must exactly follow the complete derived unresolved-state indexes."));

  const conclusionKeys = ["estateClosureClaim", "solvencyConclusion", "reserveSufficiencyConclusion", "entitlementConclusion", "priorityConclusion", "taxConclusion", "legalConclusion", "ownershipConclusion", "valuationConclusion"];
  if (conclusionKeys.some((key) => review[key] !== false)) findings.push(finding("prohibited_professional_conclusion", "review", "Estate review cannot claim closure, solvency, reserves, entitlement, priority, tax, legal, ownership, or valuation conclusions."));
  if (Object.values(prohibitedActions).some((state) => state !== false)) findings.push(finding("prohibited_authority_claim", "prohibitedActions", "Every prohibited estate action must remain false."));

  return findings;
}
