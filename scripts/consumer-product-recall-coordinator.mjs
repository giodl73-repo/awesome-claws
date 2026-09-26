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
    /\b\d{1,6}\s+(?:[A-Za-z]+\s){0,4}(?:street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr|court|ct)\b/iu.test(value) ||
    /(?:password|passcode|door[-_ ]?code|gate[-_ ]?code|security[-_ ]?answer|recovery[-_ ]?code|bearer|api[-_ ]?key|client[-_ ]?secret|private[-_ ]?key)[=:]/iu.test(value)
  );
}

function scanSecretBearingStrings(value, path, findings) {
  if (typeof value === "string") {
    if (secretLike(value)) findings.push(finding("secret_bearing_text", path, "Recall records cannot retain credentials, contact identifiers, precise addresses, or long account-like numbers."));
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

const campaignSourceKinds = new Set(["official-campaign-notice", "official-campaign-revision", "retailer-notice"]);
const authoritativeResultKinds = new Set(["manufacturer-lookup", "retailer-notice"]);
const receiptKinds = new Set(["independent-receipt", "correction-receipt"]);

export function consumerProductRecallFindings(value) {
  const findings = [];
  if (!isRecord(value)) return [finding("invalid_consumer_recall_ledger", "", "Consumer recall ledger must be an object.")];

  const portfolio = isRecord(value.portfolio) ? value.portfolio : {};
  const review = isRecord(value.review) ? value.review : {};
  const prohibited = isRecord(value.prohibitedActions) ? value.prohibitedActions : {};
  const authorities = indexById(value.authorities);
  const sources = indexById(value.sources);
  const products = indexById(value.products);
  const identityClaims = indexById(value.identityClaims);
  const campaigns = indexById(value.campaigns);
  const criteria = indexById(value.criteria);
  const checks = indexById(value.applicabilityChecks);
  const instructions = indexById(value.instructions);
  const remedies = indexById(value.remedies);
  const actions = indexById(value.actions);
  const outcomes = indexById(value.outcomes);
  const gaps = indexById(value.gaps);

  if (value.schemaVersion !== "awesomeClaws.consumerRecallLedger.v1") findings.push(finding("invalid_schema_version", "schemaVersion", "Unexpected consumer recall schema version."));
  scanSecretBearingStrings(value, "", findings);
  checkUniqueIds({
    portfolios: [portfolio], authorities: value.authorities, sources: value.sources, products: value.products,
    identityClaims: value.identityClaims, campaigns: value.campaigns, criteria: value.criteria,
    applicabilityChecks: value.applicabilityChecks, instructions: value.instructions, remedies: value.remedies,
    actions: value.actions, outcomes: value.outcomes, gaps: value.gaps,
  }, findings);

  for (const [field, index] of [
    ["sourceRefs", sources], ["productRefs", products], ["identityClaimRefs", identityClaims], ["campaignRefs", campaigns],
    ["criterionRefs", criteria], ["applicabilityCheckRefs", checks], ["instructionRefs", instructions], ["remedyRefs", remedies],
    ["actionRefs", actions], ["outcomeRefs", outcomes], ["gapRefs", gaps],
  ]) {
    if (!sameSet(portfolio[field], [...index.keys()])) findings.push(finding("incomplete_portfolio_index", `portfolio/${field}`, `${field} must exactly index its collection.`));
  }

  const owner = authorities.get(portfolio.ownerAuthorityRef);
  if (!owner || owner.kind !== "owner") findings.push(finding("invalid_owner_authority", "portfolio/ownerAuthorityRef", "Portfolio owner must reference an owner authority."));
  const helperRefs = [...authorities.values()].filter((row) => row.kind === "authorized-helper").map((row) => row.id);
  if (!sameSet(portfolio.authorizedHelperRefs, helperRefs)) findings.push(finding("incomplete_helper_index", "portfolio/authorizedHelperRefs", "Helper index must exactly cover authorized helpers."));
  const permittedOwners = new Set([portfolio.ownerAuthorityRef, ...rows(portfolio.authorizedHelperRefs)]);
  const asOf = exactInstant(portfolio.asOf);
  if (asOf === null || review.asOf !== portfolio.asOf) findings.push(finding("invalid_review_boundary", "review/asOf", "Portfolio and review must share one exact as-of boundary."));
  if (review.nextRevision !== portfolio.revision + 1) findings.push(finding("invalid_revision_lineage", "review/nextRevision", "Next revision must increment the portfolio revision by one."));
  if (portfolio.revision === 1 ? portfolio.previousRevisionRef !== null : portfolio.previousRevisionRef === null) findings.push(finding("invalid_revision_lineage", "portfolio/previousRevisionRef", "Only revision one may omit its predecessor reference."));
  if (review.nextOwnerAuthorityRef !== portfolio.ownerAuthorityRef) findings.push(finding("invalid_next_owner", "review/nextOwnerAuthorityRef", "Handoff must return to the portfolio owner."));

  for (const [id, authority] of authorities) {
    if (authority.kind === "authorized-helper") {
      const source = requireRef(sources, authority.authorizationSourceRef, `authorities/${id}/authorizationSourceRef`, "unknown_source", findings);
      if (!source || source.kind !== "helper-authorization" || source.subjectRef !== id || source.issuerAuthorityRef !== portfolio.ownerAuthorityRef) findings.push(finding("invalid_helper_authorization", `authorities/${id}/authorizationSourceRef`, "Helpers require same-subject authorization from the portfolio owner."));
    } else if (authority.authorizationSourceRef !== null) {
      findings.push(finding("invalid_authority_source", `authorities/${id}/authorizationSourceRef`, "Only authorized helpers may carry authorization evidence."));
    }
  }

  const sourceSubjects = new Map([
    ["helper-authorization", new Set(helperRefs)], ["owner-inventory", new Set(products.keys())],
    ["official-campaign-notice", new Set(campaigns.keys())], ["official-campaign-revision", new Set(campaigns.keys())],
    ["manufacturer-lookup", new Set(checks.keys())], ["retailer-notice", new Set([...campaigns.keys(), ...checks.keys()])],
    ["qualified-finding", new Set([...products.keys(), ...checks.keys(), ...gaps.keys()])], ["owner-action-note", new Set(actions.keys())],
    ["independent-receipt", new Set(actions.keys())], ["correction-receipt", new Set(actions.keys())],
    ["remedy-status", new Set([...actions.keys(), ...remedies.keys(), ...outcomes.keys()])],
    ["owner-decision", new Set([...actions.keys(), ...checks.keys()])],
  ]);
  for (const [id, source] of sources) {
    const issuedAt = exactInstant(source.issuedAt);
    const retrievedAt = exactInstant(source.retrievedAt);
    if (issuedAt === null || retrievedAt === null || issuedAt > retrievedAt || asOf === null || retrievedAt > asOf) findings.push(finding("invalid_source_chronology", `sources/${id}`, "Source issue and retrieval times must be exact, ordered, and no later than review."));
    const issuer = requireRef(authorities, source.issuerAuthorityRef, `sources/${id}/issuerAuthorityRef`, "unknown_authority", findings);
    if (["owner-inventory", "owner-action-note", "owner-decision"].includes(source.kind) && !permittedOwners.has(source.issuerAuthorityRef)) findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Owner evidence requires the owner or an authorized helper."));
    else if (source.kind === "helper-authorization" && source.issuerAuthorityRef !== portfolio.ownerAuthorityRef) findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Helper authorization must come from the owner."));
    else if (["official-campaign-notice", "official-campaign-revision"].includes(source.kind) && !["regulator", "manufacturer-or-issuer"].includes(issuer?.kind)) findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Official campaigns require a regulator or issuer authority."));
    else if (source.kind === "manufacturer-lookup" && issuer?.kind !== "manufacturer-or-issuer") findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Manufacturer lookups require an issuer authority."));
    else if (source.kind === "retailer-notice" && issuer?.kind !== "retailer-or-distributor") findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Retailer notices require a retailer or distributor."));
    else if (source.kind === "qualified-finding" && issuer?.kind !== "qualified-specialist") findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Qualified findings require a qualified specialist."));
    else if (["independent-receipt", "correction-receipt", "remedy-status"].includes(source.kind) && permittedOwners.has(source.issuerAuthorityRef)) findings.push(finding("invalid_source_authority", `sources/${id}/issuerAuthorityRef`, "Independent outcome evidence cannot be self-issued."));
    if (!rows(portfolio.jurisdictions).includes(source.jurisdiction)) findings.push(finding("invalid_source_jurisdiction", `sources/${id}/jurisdiction`, "Every source must use a declared jurisdiction."));
    if (!sourceSubjects.get(source.kind)?.has(source.subjectRef)) findings.push(finding("invalid_source_subject", `sources/${id}/subjectRef`, "Source kind and subject type must agree."));
    if (source.redaction !== "minimized-reference-only" || source.containsSecrets !== false || secretLike(source.controlledRef)) findings.push(finding("secret_bearing_source", `sources/${id}`, "Sources must use minimized, non-secret controlled references."));
  }

  for (const [id, product] of products) {
    const expectedClaims = [...identityClaims.values()].filter((row) => row.productRef === id).map((row) => row.id);
    const expectedChecks = [...checks.values()].filter((row) => row.productRef === id).map((row) => row.id);
    const expectedActions = [...actions.values()].filter((row) => row.productRef === id).map((row) => row.id);
    const expectedOutcomes = [...outcomes.values()].filter((row) => row.productRef === id).map((row) => row.id);
    const expectedGaps = [...gaps.values()].filter((row) => rows(row.subjectRefs).includes(id)).map((row) => row.id);
    for (const [field, expected] of [["identityClaimRefs", expectedClaims], ["applicabilityCheckRefs", expectedChecks], ["actionRefs", expectedActions], ["outcomeRefs", expectedOutcomes], ["gapRefs", expectedGaps]]) {
      if (!sameSet(product[field], expected)) findings.push(finding("incomplete_product_index", `products/${id}/${field}`, `${field} must exactly index records for this product.`));
    }
    if (product.safetyDetermination !== false || product.defectDetermination !== false) findings.push(finding("prohibited_product_determination", `products/${id}`, "Products cannot carry Claw safety or defect determinations."));
  }

  for (const [id, claim] of identityClaims) {
    requireRef(products, claim.productRef, `identityClaims/${id}/productRef`, "unknown_product", findings);
    refs(sources, claim.sourceRefs, `identityClaims/${id}/sourceRefs`, "unknown_source", findings);
    const validEvidence = rows(claim.sourceRefs).every((ref) => {
      const source = sources.get(ref);
      return source && ["owner-inventory", "qualified-finding"].includes(source.kind) && source.subjectRef === claim.productRef;
    });
    if (!validEvidence) findings.push(finding("invalid_identity_evidence", `identityClaims/${id}/sourceRefs`, "Identity claims require same-product inventory or qualified evidence."));
  }

  const campaignGroups = new Map();
  for (const campaign of campaigns.values()) {
    const group = campaignGroups.get(campaign.stableCampaignRef) ?? [];
    group.push(campaign);
    campaignGroups.set(campaign.stableCampaignRef, group);
  }
  for (const [stableRef, group] of campaignGroups) {
    if (group.filter((row) => row.state === "current").length !== 1) findings.push(finding("invalid_current_campaign", `campaigns/${stableRef}`, "Each stable campaign requires exactly one current revision."));
  }
  for (const [id, campaign] of campaigns) {
    const source = requireRef(sources, campaign.sourceRef, `campaigns/${id}/sourceRef`, "unknown_source", findings);
    if (!source || !campaignSourceKinds.has(source.kind) || source.subjectRef !== id || source.issuerAuthorityRef !== campaign.issuerAuthorityRef || source.issuedAt !== campaign.issuedAt) findings.push(finding("invalid_campaign_source", `campaigns/${id}/sourceRef`, "Campaign revision requires a same-revision official source and issuer."));
    if (campaign.state === "current" && source?.freshness !== "current") findings.push(finding("stale_current_campaign", `campaigns/${id}/sourceRef`, "Current campaign revision requires a current source."));
    if (campaign.state !== "current" && !["superseded", "stale"].includes(source?.freshness)) findings.push(finding("invalid_campaign_freshness", `campaigns/${id}/sourceRef`, "Non-current campaigns require superseded or stale evidence."));
    const expectedCriteria = [...criteria.values()].filter((row) => row.campaignRef === id).map((row) => row.id);
    const expectedInstructions = [...instructions.values()].filter((row) => row.campaignRef === id).map((row) => row.id);
    const expectedRemedies = [...remedies.values()].filter((row) => row.campaignRef === id).map((row) => row.id);
    for (const [field, expected] of [["criterionRefs", expectedCriteria], ["instructionRefs", expectedInstructions], ["remedyRefs", expectedRemedies]]) if (!sameSet(campaign[field], expected)) findings.push(finding("incomplete_campaign_index", `campaigns/${id}/${field}`, `${field} must exactly index this campaign revision.`));
    const predecessor = campaign.predecessorRef === null ? null : requireRef(campaigns, campaign.predecessorRef, `campaigns/${id}/predecessorRef`, "unknown_campaign", findings);
    const successor = campaign.successorRef === null ? null : requireRef(campaigns, campaign.successorRef, `campaigns/${id}/successorRef`, "unknown_campaign", findings);
    if (predecessor && (predecessor.successorRef !== id || predecessor.stableCampaignRef !== campaign.stableCampaignRef || exactInstant(predecessor.issuedAt) >= exactInstant(campaign.issuedAt))) findings.push(finding("invalid_campaign_lineage", `campaigns/${id}/predecessorRef`, "Campaign predecessor must be reciprocal, same-campaign, and earlier."));
    if (successor && (successor.predecessorRef !== id || successor.stableCampaignRef !== campaign.stableCampaignRef || exactInstant(successor.issuedAt) <= exactInstant(campaign.issuedAt))) findings.push(finding("invalid_campaign_lineage", `campaigns/${id}/successorRef`, "Campaign successor must be reciprocal, same-campaign, and later."));
    if (campaign.safetyDetermination !== false || campaign.eligibilityDetermination !== false) findings.push(finding("prohibited_campaign_determination", `campaigns/${id}`, "Campaigns cannot carry Claw safety or eligibility determinations."));
  }

  for (const [id, criterion] of criteria) {
    const campaign = requireRef(campaigns, criterion.campaignRef, `criteria/${id}/campaignRef`, "unknown_campaign", findings);
    const source = requireRef(sources, criterion.sourceRef, `criteria/${id}/sourceRef`, "unknown_source", findings);
    if (!campaign || !source || criterion.sourceRef !== campaign.sourceRef || !campaignSourceKinds.has(source.kind)) findings.push(finding("invalid_criterion_source", `criteria/${id}/sourceRef`, "Criteria require their campaign revision's official source."));
  }

  for (const [id, instruction] of instructions) {
    const campaign = requireRef(campaigns, instruction.campaignRef, `instructions/${id}/campaignRef`, "unknown_campaign", findings);
    refs(actions, instruction.actionRefs, `instructions/${id}/actionRefs`, "unknown_action", findings);
    if (!campaign || instruction.sourceRef !== campaign.sourceRef || (campaign.state === "current" ? instruction.state !== "current" : instruction.state !== "superseded")) findings.push(finding("invalid_instruction_attribution", `instructions/${id}`, "Instruction source and state must match its campaign revision."));
    for (const ref of rows(instruction.actionRefs)) if (actions.get(ref)?.campaignRef !== instruction.campaignRef) findings.push(finding("cross_campaign_instruction_action", `instructions/${id}/actionRefs`, "Instruction actions must use the same campaign revision."));
    if (instruction.adviceByClaw !== false) findings.push(finding("advice_claim", `instructions/${id}/adviceByClaw`, "Official instructions must remain attributed and not become Claw advice."));
  }

  for (const [id, remedy] of remedies) {
    const campaign = requireRef(campaigns, remedy.campaignRef, `remedies/${id}/campaignRef`, "unknown_campaign", findings);
    refs(criteria, remedy.prerequisiteCriterionRefs, `remedies/${id}/prerequisiteCriterionRefs`, "unknown_criterion", findings);
    refs(actions, remedy.actionRefs, `remedies/${id}/actionRefs`, "unknown_action", findings);
    if (!campaign || remedy.sourceRef !== campaign.sourceRef || (campaign.state === "current" ? remedy.state !== "published" : remedy.state === "published")) findings.push(finding("invalid_remedy_attribution", `remedies/${id}`, "Remedy source and state must match its campaign revision."));
    if (rows(remedy.prerequisiteCriterionRefs).some((ref) => criteria.get(ref)?.campaignRef !== remedy.campaignRef)) findings.push(finding("cross_campaign_remedy_criterion", `remedies/${id}/prerequisiteCriterionRefs`, "Remedy prerequisites must belong to the same campaign revision."));
    if (rows(remedy.actionRefs).some((ref) => actions.get(ref)?.remedyRef !== id)) findings.push(finding("incomplete_remedy_action_index", `remedies/${id}/actionRefs`, "Remedy actions must point back to this remedy."));
    if (remedy.entitlementDetermination !== false) findings.push(finding("entitlement_claim", `remedies/${id}/entitlementDetermination`, "The Claw cannot determine remedy entitlement."));
  }

  for (const [id, check] of checks) {
    const product = requireRef(products, check.productRef, `applicabilityChecks/${id}/productRef`, "unknown_product", findings);
    const campaign = requireRef(campaigns, check.campaignRef, `applicabilityChecks/${id}/campaignRef`, "unknown_campaign", findings);
    refs(criteria, check.criterionRefs, `applicabilityChecks/${id}/criterionRefs`, "unknown_criterion", findings);
    refs(sources, check.evidenceSourceRefs, `applicabilityChecks/${id}/evidenceSourceRefs`, "unknown_source", findings);
    if (campaign && !sameSet(check.criterionRefs, campaign.criterionRefs)) findings.push(finding("incomplete_applicability_criteria", `applicabilityChecks/${id}/criterionRefs`, "Applicability must evaluate every criterion in the exact campaign revision."));
    if (campaign && !rows(check.evidenceSourceRefs).includes(campaign.sourceRef)) findings.push(finding("missing_campaign_evidence", `applicabilityChecks/${id}/evidenceSourceRefs`, "Applicability requires its campaign source."));
    const productEvidence = [...identityClaims.values()].filter((row) => row.productRef === check.productRef).flatMap((row) => rows(row.sourceRefs));
    if (!rows(check.evidenceSourceRefs).some((ref) => productEvidence.includes(ref))) findings.push(finding("missing_product_identity_evidence", `applicabilityChecks/${id}/evidenceSourceRefs`, "Applicability requires same-product identity evidence."));
    const result = check.resultSourceRef === null ? null : requireRef(sources, check.resultSourceRef, `applicabilityChecks/${id}/resultSourceRef`, "unknown_source", findings);
    if (["authoritative-confirmed", "authoritative-excluded", "corrected-with-receipt"].includes(check.state) && (!result || !authoritativeResultKinds.has(result.kind) || result.subjectRef !== id || !rows(check.evidenceSourceRefs).includes(result.id))) findings.push(finding("invalid_authoritative_result", `applicabilityChecks/${id}/resultSourceRef`, "Confirmed, excluded, or corrected applicability requires same-check official lookup evidence."));
    if (["possible-match", "unresolved", "superseded"].includes(check.state) && (check.resultSourceRef !== null || check.outcomeRef !== null)) findings.push(finding("premature_applicability_result", `applicabilityChecks/${id}`, "Possible, unresolved, or superseded checks cannot claim an authoritative result or outcome."));
    if (["authoritative-confirmed", "corrected-with-receipt"].includes(check.state) && campaign) {
      const exactMatch = rows(campaign.criterionRefs).filter((ref) => criteria.get(ref)?.effect === "affected").every((ref) => {
        const criterion = criteria.get(ref);
        return [...identityClaims.values()].some((claim) => claim.productRef === check.productRef && claim.kind === criterion?.kind && claim.valueRef === criterion.valueRef && claim.state === "verified");
      });
      if (!exactMatch) findings.push(finding("non_exact_applicability_claim", `applicabilityChecks/${id}/state`, "Confirmed applicability requires verified exact identity for every affected criterion; similarity is insufficient."));
    }
    const outcome = check.outcomeRef === null ? null : requireRef(outcomes, check.outcomeRef, `applicabilityChecks/${id}/outcomeRef`, "unknown_outcome", findings);
    if (check.state === "corrected-with-receipt" && (!outcome || outcome.productRef !== check.productRef || outcome.campaignRef !== check.campaignRef || outcome.state !== "independently-receipted")) findings.push(finding("invalid_corrected_applicability", `applicabilityChecks/${id}/outcomeRef`, "Corrected applicability requires a same-product, same-campaign independently receipted outcome."));
    if (check.state !== "corrected-with-receipt" && check.outcomeRef !== null) findings.push(finding("premature_correction_outcome", `applicabilityChecks/${id}/outcomeRef`, "Only corrected applicability may carry a correction outcome."));
    if (check.safetyDetermination !== false || check.defectDetermination !== false || check.eligibilityDetermination !== false) findings.push(finding("prohibited_applicability_determination", `applicabilityChecks/${id}`, "Applicability cannot determine safety, defect, or eligibility."));
    if (!product || !campaign) continue;
  }

  for (const [id, action] of actions) {
    requireRef(products, action.productRef, `actions/${id}/productRef`, "unknown_product", findings);
    requireRef(campaigns, action.campaignRef, `actions/${id}/campaignRef`, "unknown_campaign", findings);
    const remedy = action.remedyRef === null ? null : requireRef(remedies, action.remedyRef, `actions/${id}/remedyRef`, "unknown_remedy", findings);
    refs(sources, action.sourceRefs, `actions/${id}/sourceRefs`, "unknown_source", findings);
    if (!permittedOwners.has(action.ownerAuthorityRef)) findings.push(finding("invalid_action_owner", `actions/${id}/ownerAuthorityRef`, "Actions require the owner or an explicitly authorized helper."));
    if (rows(portfolio.authorizedHelperRefs).includes(action.ownerAuthorityRef) && action.kind !== "review-record") findings.push(finding("helper_action_scope_exceeded", `actions/${id}`, "Authorized helpers may review records only."));
    if (remedy && (remedy.campaignRef !== action.campaignRef || !rows(remedy.actionRefs).includes(id))) findings.push(finding("invalid_action_remedy", `actions/${id}/remedyRef`, "Action and remedy must be reciprocal and use the same campaign."));
    const receipt = action.receiptSourceRef === null ? null : requireRef(sources, action.receiptSourceRef, `actions/${id}/receiptSourceRef`, "unknown_source", findings);
    if (action.state === "owner-completed-receipted") {
      if (exactInstant(action.attemptedAt) === null || !receipt || !receiptKinds.has(receipt.kind) || receipt.subjectRef !== id || permittedOwners.has(receipt.issuerAuthorityRef) || !rows(action.sourceRefs).includes(receipt.id)) findings.push(finding("invalid_action_receipt", `actions/${id}/receiptSourceRef`, "Completed actions require an independent same-action receipt included in action evidence."));
      const ownerNote = rows(action.sourceRefs).some((ref) => { const source = sources.get(ref); return source?.kind === "owner-action-note" && source.subjectRef === id && source.issuerAuthorityRef === action.ownerAuthorityRef; });
      if (!ownerNote) findings.push(finding("missing_action_evidence", `actions/${id}/sourceRefs`, "Completed actions require a same-action owner note from the action owner."));
    } else if (action.receiptSourceRef !== null) findings.push(finding("premature_action_receipt", `actions/${id}/receiptSourceRef`, "Only owner-completed-receipted actions may carry a receipt."));
    if (action.attemptedAt !== null && (exactInstant(action.attemptedAt) === null || asOf === null || exactInstant(action.attemptedAt) > asOf)) findings.push(finding("invalid_action_chronology", `actions/${id}/attemptedAt`, "Action time must be exact and no later than review."));
    if (action.agentExecuted !== false || action.externalExecution !== "owner-only") findings.push(finding("external_authority_claim", `actions/${id}`, "External actions must remain owner-only and not agent-executed."));
  }

  for (const [id, outcome] of outcomes) {
    const action = requireRef(actions, outcome.actionRef, `outcomes/${id}/actionRef`, "unknown_action", findings);
    const source = requireRef(sources, outcome.sourceRef, `outcomes/${id}/sourceRef`, "unknown_source", findings);
    if (!action || action.productRef !== outcome.productRef || action.campaignRef !== outcome.campaignRef) findings.push(finding("cross_subject_outcome", `outcomes/${id}`, "Outcome must use the exact action product and campaign."));
    if (outcome.state === "independently-receipted" && (!source || !receiptKinds.has(source.kind) || source.subjectRef !== outcome.actionRef || action?.state !== "owner-completed-receipted" || action.receiptSourceRef !== outcome.sourceRef)) findings.push(finding("invalid_outcome_receipt", `outcomes/${id}/sourceRef`, "Independent outcome must share the action's independent receipt."));
    if (outcome.correctionSufficiencyDetermination !== false || outcome.closureDetermination !== false) findings.push(finding("premature_outcome_conclusion", `outcomes/${id}`, "Outcomes cannot determine correction sufficiency or closure."));
  }

  const allSubjectIds = new Set([portfolio.id, ...authorities.keys(), ...products.keys(), ...identityClaims.keys(), ...campaigns.keys(), ...criteria.keys(), ...checks.keys(), ...instructions.keys(), ...remedies.keys(), ...actions.keys(), ...outcomes.keys(), ...gaps.keys()]);
  for (const [id, gap] of gaps) {
    refs(sources, gap.sourceRefs, `gaps/${id}/sourceRefs`, "unknown_source", findings);
    requireRef(authorities, gap.nextOwnerAuthorityRef, `gaps/${id}/nextOwnerAuthorityRef`, "unknown_authority", findings);
    for (const ref of rows(gap.subjectRefs)) {
      if (!allSubjectIds.has(ref)) findings.push(finding("unknown_gap_subject", `gaps/${id}/subjectRefs`, `Unknown gap subject ${ref}.`));
      if (ref === id) findings.push(finding("self_referential_gap", `gaps/${id}/subjectRefs`, "Gaps cannot reference themselves."));
    }
    if (gap.state === "open" && gap.resolutionSourceRef !== null) findings.push(finding("invalid_gap_resolution", `gaps/${id}/resolutionSourceRef`, "Open gaps cannot carry resolution evidence."));
    if (gap.state === "resolved" && !sources.has(gap.resolutionSourceRef)) findings.push(finding("invalid_gap_resolution", `gaps/${id}/resolutionSourceRef`, "Resolved gaps require valid resolution evidence."));
  }

  const expectedReview = new Map([
    ["possibleApplicabilityRefs", [...checks.values()].filter((row) => row.state === "possible-match").map((row) => row.id)],
    ["confirmedApplicabilityRefs", [...checks.values()].filter((row) => ["authoritative-confirmed", "authoritative-excluded"].includes(row.state)).map((row) => row.id)],
    ["unresolvedApplicabilityRefs", [...checks.values()].filter((row) => row.state === "unresolved").map((row) => row.id)],
    ["correctedApplicabilityRefs", [...checks.values()].filter((row) => row.state === "corrected-with-receipt").map((row) => row.id)],
    ["openGapRefs", [...gaps.values()].filter((row) => row.state === "open").map((row) => row.id)],
    ["missingReceiptActionRefs", [...actions.values()].filter((row) => ["attempted", "failed"].includes(row.state) && row.receiptSourceRef === null).map((row) => row.id)],
    ["urgentGapRefs", [...gaps.values()].filter((row) => row.state === "open" && row.kind === "urgent-safety-question").map((row) => row.id)],
    ["deadlineRefs", [
      ...[...campaigns.values()].filter((row) => row.state === "current" && row.deadlineAt !== null).map((row) => row.id),
      ...[...remedies.values()].filter((row) => row.state === "published" && row.deadlineAt !== null).map((row) => row.id),
    ]],
  ]);
  for (const [field, expected] of expectedReview) if (!sameSet(review[field], expected)) findings.push(finding("incomplete_review_index", `review/${field}`, `${field} must exactly index its current review state.`));
  if (review.portfolioClosureClaim !== false || review.safetyConclusion !== false || review.defectConclusion !== false || review.eligibilityConclusion !== false || review.correctionConclusion !== false) findings.push(finding("premature_review_conclusion", "review", "Review cannot claim closure, safety, defect, eligibility, or correction."));
  if (Object.values(prohibited).some((item) => item !== false)) findings.push(finding("prohibited_authority_claim", "prohibitedActions", "All prohibited actions and conclusions must remain false."));

  return findings;
}
