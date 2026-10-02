const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/u;
const EXACT_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const CONTROLLED_REF_PATTERN = /^controlled:\/\/[a-z0-9][a-z0-9._/-]*$/u;
const SENSITIVE_TEXT_PATTERN = /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b\d{3}-\d{2}-\d{4}\b|\b(?:account|routing|student[-_ ]?id|government[-_ ]?id|password|secret|token|api[-_ ]?key)\s*[:=]\s*\S+|\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)\b)/iu;

const sourceIssuerKinds = new Map([
  ["applicant-authorization", new Set(["applicant"])],
  ["program-requirement", new Set(["institution", "admissions-office"])],
  ["deadline-notice", new Set(["institution", "admissions-office", "financial-aid-office"])],
  ["applicant-material", new Set(["applicant"])],
  ["school-record", new Set(["school-official"])],
  ["test-record", new Set(["testing-service"])],
  ["recommendation-record", new Set(["recommender"])],
  ["interview-notice", new Set(["institution", "admissions-office"])],
  ["fee-record", new Set(["institution", "admissions-office"])],
  ["financial-aid-record", new Set(["financial-aid-office"])],
  ["submission-receipt", new Set(["institution", "admissions-office", "financial-aid-office", "school-official", "testing-service"])],
  ["portal-observation", new Set(["institution", "admissions-office", "financial-aid-office"])],
  ["official-decision", new Set(["institution", "admissions-office", "financial-aid-office"])],
  ["enrollment-notice", new Set(["institution", "admissions-office"])],
  ["owner-action-note", new Set(["applicant"])],
  ["gap-resolution", new Set(["applicant", "guardian-or-adviser", "school-official", "testing-service", "recommender", "institution", "admissions-office", "financial-aid-office"])],
]);

const recordIssuerKinds = new Map([
  ["transcript", new Set(["school-official"])],
  ["school-report", new Set(["school-official"])],
  ["test-score", new Set(["testing-service"])],
  ["recommendation", new Set(["recommender"])],
  ["interview", new Set(["institution", "admissions-office"])],
  ["fee-waiver", new Set(["institution", "admissions-office"])],
  ["financial-aid", new Set(["financial-aid-office"])],
  ["other", new Set(["school-official", "testing-service", "recommender", "institution", "admissions-office", "financial-aid-office"])],
]);

const recordSourceKinds = new Map([
  ["transcript", "school-record"], ["school-report", "school-record"], ["test-score", "test-record"],
  ["recommendation", "recommendation-record"], ["interview", "interview-notice"], ["fee-waiver", "fee-record"],
  ["financial-aid", "financial-aid-record"],
]);

const requirementRecordKinds = new Map([
  ["transcript", new Set(["transcript"])], ["test-score", new Set(["test-score"])],
  ["recommendation", new Set(["recommendation"])], ["school-report", new Set(["school-report"])],
  ["interview", new Set(["interview"])], ["fee-waiver", new Set(["fee-waiver"])],
  ["financial-aid", new Set(["financial-aid"])],
]);

const requirementMaterialKinds = new Map([
  ["essay", new Set(["essay"])],
  ["statement", new Set(["personal-statement", "short-answer"])],
  ["portfolio", new Set(["portfolio", "writing-sample"])],
]);

const decisionOutcomes = new Map([
  ["admission", new Set(["admitted", "denied", "waitlisted", "deferred", "withdrawn", "pending"])],
  ["financial-aid", new Set(["offer", "no-offer", "pending"])],
  ["transfer-credit", new Set(["offer", "no-offer", "pending"])],
  ["waitlist", new Set(["admitted", "denied", "waitlisted", "withdrawn", "pending"])],
  ["enrollment", new Set(["offer", "no-offer", "withdrawn", "pending"])],
]);

const thirdPartySubmissionKinds = new Set(["transcript", "test-score", "recommendation", "school-report"]);

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

function requireBacklink(row, field, ref, path, findings) {
  if (row && !rows(row[field]).includes(ref)) {
    findings.push(finding("incomplete_reciprocal_reference", path, `Referenced record ${String(row.id)} must link back to ${String(ref)} through ${field}.`));
  }
}

function requireRelevantSources(sources, refs, allowedSubjects, path, findings) {
  for (const ref of rows(refs)) {
    const source = sources.get(ref);
    if (!source) continue;
    if (source.freshness !== "current" || !allowedSubjects.has(source.subjectRef)) {
      findings.push(finding("irrelevant_source_reference", path, `Source ${String(ref)} must be current and bind this exact application record or one of its related subjects.`));
    }
  }
}

function hasOpenGap(gaps, refs, subjectRef) {
  return rows(refs).some((ref) => {
    const gap = gaps.get(ref);
    return gap?.state === "open" && rows(gap.subjectRefs).includes(subjectRef);
  });
}

function subjectBelongsToApplication(ref, applicationId, maps) {
  if (ref === applicationId) return true;
  for (const map of maps) {
    const target = map.get(ref);
    if (target && (target.applicationRef === applicationId || rows(target.applicationRefs).includes(applicationId))) return true;
  }
  return false;
}

function submissionSubjectCompatible(kind, type, target) {
  if (kind === "application") return ["requirement", "material", "record"].includes(type);
  if (kind === "supplement") return ["requirement", "material"].includes(type);
  if (kind === "material") return type === "material" || (type === "requirement" && requirementMaterialKinds.has(target?.kind));
  if (["transcript", "test-score", "recommendation", "school-report"].includes(kind)) return (type === "record" && target?.kind === kind) || (type === "requirement" && target?.kind === kind);
  if (kind === "fee") return type === "requirement" && target?.kind === "fee";
  if (kind === "fee-waiver") return (type === "record" || type === "requirement") && target?.kind === "fee-waiver";
  if (kind === "financial-aid") return (type === "record" || type === "requirement") && target?.kind === "financial-aid";
  if (kind === "interview-response") return (type === "record" || type === "requirement") && target?.kind === "interview";
  if (kind === "enrollment-response") return type === "application" || (type === "decision" && ["admission", "waitlist", "enrollment"].includes(target?.kind));
  return false;
}

export function collegeApplicationFindings(input) {
  const findings = [];
  const value = record(input);
  if (Object.keys(value).length === 0) {
    return [finding("invalid_artifact", "", "College application portfolio must be an object with the complete contract.")];
  }

  const portfolio = record(value.portfolio);
  const review = record(value.review);
  const prohibitedActions = record(value.prohibitedActions);
  const authorities = rowMap(value.authorities);
  const sources = rowMap(value.sources);
  const applications = rowMap(value.applications);
  const materials = rowMap(value.materials);
  const records = rowMap(value.records);
  const requirements = rowMap(value.requirements);
  const submissions = rowMap(value.submissions);
  const decisions = rowMap(value.decisions);
  const actions = rowMap(value.actions);
  const gaps = rowMap(value.gaps);

  const collections = [value.authorities, value.sources, value.applications, value.materials, value.records, value.requirements, value.submissions, value.decisions, value.actions, value.gaps];
  const seenIds = new Set();
  if (typeof portfolio.id === "string") seenIds.add(portfolio.id);
  for (const collection of collections) {
    for (const row of rows(collection)) {
      const id = record(row).id;
      if (typeof id !== "string" || !IDENTIFIER_PATTERN.test(id) || seenIds.has(id)) findings.push(finding("duplicate_identity", "id", `Every record requires one globally unique stable id; found ${String(id)}.`));
      else seenIds.add(id);
    }
  }

  const portfolioId = portfolio.id;
  const asOf = exactInstant(portfolio.asOf);
  if (asOf === null || exactInstant(review.asOf) !== asOf) findings.push(finding("invalid_portfolio_chronology", "review/asOf", "Portfolio and review require the same exact zone-bearing as-of instant."));
  if (typeof portfolio.approvedDestinationRef !== "string" || !CONTROLLED_REF_PATTERN.test(portfolio.approvedDestinationRef)) findings.push(finding("invalid_private_destination", "portfolio/approvedDestinationRef", "The portfolio destination must be a controlled private reference."));

  const exactIndexes = [
    [portfolio.authorityRefs, authorities.keys(), "authorityRefs"], [portfolio.sourceRefs, sources.keys(), "sourceRefs"],
    [portfolio.applicationRefs, applications.keys(), "applicationRefs"], [portfolio.materialRefs, materials.keys(), "materialRefs"],
    [portfolio.recordRefs, records.keys(), "recordRefs"], [portfolio.requirementRefs, requirements.keys(), "requirementRefs"],
    [portfolio.submissionRefs, submissions.keys(), "submissionRefs"], [portfolio.decisionRefs, decisions.keys(), "decisionRefs"],
    [portfolio.actionRefs, actions.keys(), "actionRefs"], [portfolio.gapRefs, gaps.keys(), "gapRefs"],
  ];
  for (const [actual, expected, key] of exactIndexes) if (!sameRefs(actual, expected)) findings.push(finding("incomplete_portfolio_index", `portfolio/${key}`, `Portfolio ${key} must exactly cover the corresponding collection.`));

  const applicant = requireRef(authorities, portfolio.applicantAuthorityRef, "portfolio/applicantAuthorityRef", "invalid_applicant_authority", findings);
  if (!applicant || applicant.kind !== "applicant" || applicant.status !== "current" || !hasScope(applicant, "applicant-owner") || !hasScope(applicant, "review") || !hasScope(applicant, "material-author")) {
    findings.push(finding("invalid_applicant_authority", "portfolio/applicantAuthorityRef", "Portfolio ownership requires one current applicant with applicant-owner, review, and material-author scopes."));
  }
  if (review.nextOwnerAuthorityRef !== portfolio.applicantAuthorityRef) findings.push(finding("invalid_applicant_authority", "review/nextOwnerAuthorityRef", "The applicant remains the final portfolio review owner."));
  if ([...authorities.values()].filter((authority) => authority?.kind === "applicant").length !== 1) findings.push(finding("invalid_applicant_authority", "authorities", "A portfolio has exactly one applicant identity and owner."));

  for (const authority of authorities.values()) {
    if (authority?.portfolioRef !== portfolioId) findings.push(finding("cross_portfolio_record", `authorities/${authority?.id}/portfolioRef`, "Every authority must belong to the exact portfolio."));
    if (authority?.kind !== "applicant" && (hasScope(authority, "applicant-owner") || hasScope(authority, "review") || hasScope(authority, "material-author"))) findings.push(finding("invalid_authority_scope", `authorities/${authority?.id}/scope`, "Only the applicant may own, review, or author applicant material."));
  }

  const knownSubjects = new Set([portfolioId, ...applications.keys(), ...materials.keys(), ...records.keys(), ...requirements.keys(), ...submissions.keys(), ...decisions.keys(), ...actions.keys(), ...gaps.keys()]);
  const currentByStableSource = new Map();
  const successorsBySource = new Map();
  for (const source of sources.values()) {
    const path = `sources/${source?.id}`;
    if (source?.portfolioRef !== portfolioId) findings.push(finding("cross_portfolio_record", `${path}/portfolioRef`, "Every source must belong to the exact portfolio."));
    const issuer = requireRef(authorities, source?.issuerAuthorityRef, `${path}/issuerAuthorityRef`, "invalid_source_authority", findings);
    const allowedKinds = sourceIssuerKinds.get(source?.kind);
    if (!issuer || issuer.status !== "current" || !allowedKinds?.has(issuer.kind) || !hasScope(issuer, "source-issuer")) findings.push(finding("invalid_source_authority", `${path}/issuerAuthorityRef`, "Source kind, current issuer kind, and source-issuer scope must agree."));
    if (source?.kind === "submission-receipt" && !hasScope(issuer, "submission-receipt-issuer")) findings.push(finding("invalid_source_authority", `${path}/issuerAuthorityRef`, "Submission receipts require an independent receipt-scoped issuer."));
    if (source?.kind === "official-decision" && !hasScope(issuer, "decision-issuer")) findings.push(finding("invalid_source_authority", `${path}/issuerAuthorityRef`, "Official decisions require a decision-scoped issuer."));
    if (!knownSubjects.has(source?.subjectRef)) findings.push(finding("invalid_source_subject", `${path}/subjectRef`, "Every source must bind to one exact in-portfolio subject."));
    const assertedAt = exactInstant(source?.assertedAt);
    const retrievedAt = exactInstant(source?.retrievedAt);
    if (assertedAt === null || retrievedAt === null || assertedAt > retrievedAt || (asOf !== null && retrievedAt > asOf)) findings.push(finding("invalid_source_chronology", path, "Source chronology requires asserted <= retrieved <= portfolio as-of."));
    if (typeof source?.controlledRef !== "string" || !CONTROLLED_REF_PATTERN.test(source.controlledRef) || SENSITIVE_TEXT_PATTERN.test(source.controlledRef) || source?.containsSecrets !== false || source?.minimized !== true) findings.push(finding("secret_bearing_source", path, "Every source requires a minimized controlled reference without credentials or direct sensitive identifiers."));
    if (source?.freshness === "current") {
      if (currentByStableSource.has(source?.stableSourceRef)) findings.push(finding("ambiguous_source_revision", path, `Stable source ${String(source?.stableSourceRef)} has more than one current revision.`));
      currentByStableSource.set(source?.stableSourceRef, source);
    }
    if (source?.supersedesSourceRef !== null) {
      const prior = requireRef(sources, source?.supersedesSourceRef, `${path}/supersedesSourceRef`, "invalid_source_lineage", findings);
      if (!prior || prior.id === source.id || prior.stableSourceRef !== source.stableSourceRef || prior.kind !== source.kind || prior.freshness !== "superseded" || exactInstant(prior.assertedAt) >= assertedAt) findings.push(finding("invalid_source_lineage", `${path}/supersedesSourceRef`, "A revision must supersede one earlier same-kind, same-stable-source row marked superseded."));
      if (prior) successorsBySource.set(prior.id, [...(successorsBySource.get(prior.id) ?? []), source.id]);
    }
  }
  for (const source of sources.values()) {
    const successors = successorsBySource.get(source?.id) ?? [];
    if (source?.freshness === "superseded" && successors.length !== 1) findings.push(finding("invalid_source_lineage", `sources/${source?.id}/freshness`, "Every superseded revision requires exactly one successor."));
    if (source?.freshness === "current" && successors.length > 0) findings.push(finding("invalid_source_lineage", `sources/${source?.id}/freshness`, "A current revision cannot already have a successor."));
  }

  const authorization = [...sources.values()].find((source) => source.kind === "applicant-authorization" && source.subjectRef === portfolioId && source.issuerAuthorityRef === applicant?.id && source.freshness === "current");
  if (!authorization) findings.push(finding("invalid_applicant_authority", "portfolio/applicantAuthorityRef", "Applicant review authority requires a current exact-portfolio applicant authorization issued by the applicant."));

  const applicationPairs = new Set();
  const programIssuersByApplication = new Map();
  const conflictingDecisionApplications = new Set();
  for (const application of applications.values()) {
    const path = `applications/${application?.id}`;
    if (application?.portfolioRef !== portfolioId) findings.push(finding("cross_portfolio_record", `${path}/portfolioRef`, "Every application must belong to the exact portfolio."));
    if (application?.cycle !== portfolio.cycle) findings.push(finding("cross_cycle_application", `${path}/cycle`, "Every application must match the exact portfolio cycle."));
    const pair = `${String(application?.institutionRef)}\0${String(application?.programRef)}\0${String(application?.cycle)}\0${String(application?.round)}`;
    if (applicationPairs.has(pair)) findings.push(finding("duplicate_application_scope", path, "Institution, program, cycle, and round must identify one application."));
    applicationPairs.add(pair);
    const refs = [[materials, application.materialRefs, "materialRefs"], [records, application.recordRefs, "recordRefs"], [requirements, application.requirementRefs, "requirementRefs"], [submissions, application.submissionRefs, "submissionRefs"], [decisions, application.decisionRefs, "decisionRefs"], [actions, application.actionRefs, "actionRefs"], [gaps, application.gapRefs, "gapRefs"]];
    for (const [map, values, field] of refs) {
      requireRefs(map, values, `${path}/${field}`, `invalid_application_${field}`, findings);
      for (const ref of rows(values)) {
        const target = map.get(ref);
        if (target && !(rows(target.applicationRefs).includes(application.id) || target.applicationRef === application.id)) findings.push(finding("cross_application_reference", `${path}/${field}`, `${String(ref)} does not belong to ${String(application.id)}.`));
      }
    }
    requireRefs(sources, application.sourceRefs, `${path}/sourceRefs`, "invalid_application_source", findings);
    requireRelevantSources(sources, application.sourceRefs, new Set([application.id, ...rows(application.materialRefs), ...rows(application.recordRefs), ...rows(application.requirementRefs), ...rows(application.submissionRefs), ...rows(application.decisionRefs)]), `${path}/sourceRefs`, findings);
    const programIssuers = new Set([...sources.values()].filter((source) => source.kind === "program-requirement" && source.subjectRef === application.id && source.freshness === "current").map((source) => source.issuerAuthorityRef));
    programIssuersByApplication.set(application.id, programIssuers);
    if (programIssuers.size === 0) findings.push(finding("missing_current_program_requirements", path, "Every application requires current institution-issued exact-application program requirements."));
    const terminalDecisions = rows(application.decisionRefs).map((ref) => decisions.get(ref)).filter((decision) => decision && ["admission", "waitlist"].includes(decision.kind) && decision.outcome !== "pending");
    const conflictingDecisions = terminalDecisions.filter((decision) => terminalDecisions.some((other) => other.kind === decision.kind && other.outcome !== decision.outcome));
    if (conflictingDecisions.length > 0) {
      conflictingDecisionApplications.add(application.id);
      const ownedConflict = rows(application.gapRefs).map((ref) => gaps.get(ref)).some((gap) => gap?.state === "open" && gap.kind === "official-decision" && gap.applicationRef === application.id && conflictingDecisions.every((decision) => rows(gap.subjectRefs).includes(decision.id)));
      if (application.state !== "conflicting" || !ownedConflict) findings.push(finding("unsupported_application_state", `${path}/state`, "Contradictory current admission or waitlist decisions require conflicting application state and an open institution-owned gap covering every conflicting decision."));
    }
    if (application?.state === "decided" && terminalDecisions.length === 0) findings.push(finding("unsupported_application_state", `${path}/state`, "A decided application requires an exact non-pending official decision."));
    if (terminalDecisions.length > 0 && !["decided", "conflicting"].includes(application?.state)) findings.push(finding("unsupported_application_state", `${path}/state`, "A non-pending official decision must remain visible in decided or conflicting application state."));
    if (["conflicting", "unknown"].includes(application?.state) && !hasOpenGap(gaps, application?.gapRefs, application?.id)) findings.push(finding("unowned_application_blocker", `${path}/gapRefs`, "Conflicting or unknown applications require an open owned gap bound to the exact application."));
    if (application?.state === "submitted-receipted" && !rows(application.submissionRefs).some((ref) => {
      const submission = submissions.get(ref);
      return submission?.kind === "application" && submission.state === "submitted-receipted";
    })) findings.push(finding("unsupported_application_state", `${path}/state`, "Submitted-receipted application state requires an exact independently receipted application submission."));
    if (application?.state === "withdrawn" && ![...sources.values()].some((source) => source.subjectRef === application.id && source.freshness === "current" && source.kind === "owner-action-note" && source.issuerAuthorityRef === applicant?.id)) findings.push(finding("unsupported_application_state", `${path}/state`, "A withdrawn application requires current exact-application owner evidence."));
    if (application?.admissionPredictionByClaw !== false || application?.fitRecommendationByClaw !== false) findings.push(finding("prohibited_admission_conclusion", path, "The Claw cannot predict admission or recommend institutional fit."));
  }

  const materialSuccessors = new Map();
  for (const material of materials.values()) {
    const path = `materials/${material?.id}`;
    if (material?.portfolioRef !== portfolioId) findings.push(finding("cross_portfolio_record", `${path}/portfolioRef`, "Every material must belong to the exact portfolio."));
    const author = requireRef(authorities, material?.authorAuthorityRef, `${path}/authorAuthorityRef`, "invalid_material_author", findings);
    if (!author || author.id !== applicant?.id || author.kind !== "applicant" || !hasScope(author, "material-author")) findings.push(finding("invalid_material_author", `${path}/authorAuthorityRef`, "Applicant material must remain authored by the portfolio applicant."));
    for (const ref of rows(material?.applicationRefs)) {
      const application = requireRef(applications, ref, `${path}/applicationRefs`, "invalid_material_application", findings);
      requireBacklink(application, "materialRefs", material.id, `${path}/applicationRefs`, findings);
    }
    const source = requireRef(sources, material?.sourceRef, `${path}/sourceRef`, "invalid_material_source", findings);
    if (!source || source.kind !== "applicant-material" || source.subjectRef !== material.id || source.issuerAuthorityRef !== applicant?.id || (material.state === "withdrawn" ? source.freshness !== "superseded" : source.freshness !== "current")) findings.push(finding("invalid_material_source", `${path}/sourceRef`, "Material state requires an exact applicant-issued material source with matching revision freshness."));
    if (material?.supersedesMaterialRef !== null) {
      const prior = requireRef(materials, material.supersedesMaterialRef, `${path}/supersedesMaterialRef`, "invalid_material_lineage", findings);
      if (!prior || prior.id === material.id || prior.kind !== material.kind || prior.authorAuthorityRef !== material.authorAuthorityRef || prior.state !== "withdrawn" || !sameRefs(prior.applicationRefs, material.applicationRefs) || source?.supersedesSourceRef !== prior.sourceRef) findings.push(finding("invalid_material_lineage", `${path}/supersedesMaterialRef`, "A material revision must supersede the prior withdrawn same-author, same-kind, same-application material and its source."));
      if (prior) materialSuccessors.set(prior.id, [...(materialSuccessors.get(prior.id) ?? []), material.id]);
    }
    if (material?.authoredByClaw !== false || material?.materialRewriteByClaw !== false) findings.push(finding("prohibited_authorship_substitution", path, "The Claw cannot author or materially rewrite applicant content."));
  }
  for (const material of materials.values()) {
    const successors = materialSuccessors.get(material.id) ?? [];
    if (material.state === "withdrawn" && successors.length !== 1) findings.push(finding("invalid_material_lineage", `materials/${material.id}/state`, "Every withdrawn material revision requires exactly one successor."));
    if (material.state !== "withdrawn" && successors.length > 0) findings.push(finding("invalid_material_lineage", `materials/${material.id}/state`, "Only withdrawn material may have a successor."));
  }

  for (const item of records.values()) {
    const path = `records/${item?.id}`;
    if (item?.portfolioRef !== portfolioId) findings.push(finding("cross_portfolio_record", `${path}/portfolioRef`, "Every third-party record must belong to the exact portfolio."));
    const issuer = requireRef(authorities, item?.issuerAuthorityRef, `${path}/issuerAuthorityRef`, "invalid_record_issuer", findings);
    const requiresRecordScope = ["transcript", "school-report", "test-score", "recommendation", "other"].includes(item?.kind);
    if (!issuer || issuer.status !== "current" || !recordIssuerKinds.get(item?.kind)?.has(issuer.kind) || (requiresRecordScope && !hasScope(issuer, "third-party-record-issuer"))) findings.push(finding("invalid_record_issuer", `${path}/issuerAuthorityRef`, "Record kind requires an independent current qualified issuer."));
    for (const ref of rows(item?.applicationRefs)) {
      const application = requireRef(applications, ref, `${path}/applicationRefs`, "invalid_record_application", findings);
      requireBacklink(application, "recordRefs", item.id, `${path}/applicationRefs`, findings);
    }
    requireRefs(gaps, item?.gapRefs, `${path}/gapRefs`, "invalid_record_gap", findings);
    if (item?.state === "received-current") {
      const source = requireRef(sources, item?.sourceRef, `${path}/sourceRef`, "invalid_record_source", findings);
      const expectedKind = recordSourceKinds.get(item.kind);
      if (!source || (expectedKind && source.kind !== expectedKind) || source.subjectRef !== item.id || source.issuerAuthorityRef !== issuer?.id || source.freshness !== "current") findings.push(finding("invalid_record_source", `${path}/sourceRef`, "Received-current records require current exact-record evidence from the independent named issuer."));
    } else if (item?.state === "received-stale") {
      const source = requireRef(sources, item?.sourceRef, `${path}/sourceRef`, "invalid_record_source", findings);
      const expectedKind = recordSourceKinds.get(item.kind);
      if (!source || (expectedKind && source.kind !== expectedKind) || source.subjectRef !== item.id || source.issuerAuthorityRef !== issuer?.id || !["stale", "superseded"].includes(source.freshness)) findings.push(finding("invalid_record_source", `${path}/sourceRef`, "Received-stale records require exact-record stale evidence from the independent named issuer."));
      if (!hasOpenGap(gaps, item?.gapRefs, item?.id)) findings.push(finding("unowned_record_blocker", `${path}/gapRefs`, "A stale record requires an open owned gap bound to the exact record."));
    } else if (["missing", "conflicting"].includes(item?.state)) {
      if (item?.sourceRef !== null && item?.state === "missing") findings.push(finding("invalid_record_source", `${path}/sourceRef`, "Missing records cannot claim a source."));
      if (item?.state === "conflicting" && item?.sourceRef !== null) {
        const source = requireRef(sources, item.sourceRef, `${path}/sourceRef`, "invalid_record_source", findings);
        const expectedKind = recordSourceKinds.get(item.kind);
        if (!source || (expectedKind && source.kind !== expectedKind) || source.subjectRef !== item.id || source.issuerAuthorityRef !== issuer?.id) findings.push(finding("invalid_record_source", `${path}/sourceRef`, "Conflicting records may cite only exact-record evidence from the independent named issuer."));
      }
      if (!hasOpenGap(gaps, item?.gapRefs, item?.id)) findings.push(finding("unowned_record_blocker", `${path}/gapRefs`, "Missing or conflicting records require an open owned gap bound to the exact record."));
    } else if (item?.state === "waived-by-institution") {
      const source = requireRef(sources, item?.sourceRef, `${path}/sourceRef`, "invalid_record_waiver", findings);
      const exactProgramIssuers = rows(item.applicationRefs).map((ref) => programIssuersByApplication.get(ref) ?? new Set());
      if (!source || source.subjectRef !== item.id || source.freshness !== "current" || !["program-requirement", "fee-record"].includes(source.kind) || exactProgramIssuers.length === 0 || !exactProgramIssuers.every((issuerIds) => issuerIds.has(source.issuerAuthorityRef))) findings.push(finding("invalid_record_waiver", path, "Institution-waived records require current exact-record waiver evidence from every bound application's authoritative institution."));
    }
  }

  for (const requirement of requirements.values()) {
    const path = `requirements/${requirement?.id}`;
    if (requirement?.portfolioRef !== portfolioId) findings.push(finding("cross_portfolio_record", `${path}/portfolioRef`, "Every requirement must belong to the exact portfolio."));
    const application = requireRef(applications, requirement?.applicationRef, `${path}/applicationRef`, "invalid_requirement_application", findings);
    requireBacklink(application, "requirementRefs", requirement.id, `${path}/applicationRef`, findings);
    for (const [map, refs, field] of [[materials, requirement.materialRefs, "materialRefs"], [records, requirement.recordRefs, "recordRefs"], [submissions, requirement.submissionRefs, "submissionRefs"], [gaps, requirement.gapRefs, "gapRefs"]]) {
      requireRefs(map, refs, `${path}/${field}`, `invalid_requirement_${field}`, findings);
      for (const ref of rows(refs)) {
        const target = map.get(ref);
        if (target && !(rows(target.applicationRefs).includes(requirement.applicationRef) || target.applicationRef === requirement.applicationRef)) findings.push(finding("cross_application_reference", `${path}/${field}`, `${String(ref)} belongs to a different application.`));
        if (map === submissions) requireBacklink(target, "subjectRefs", requirement.id, `${path}/${field}`, findings);
      }
    }
    requireRefs(sources, requirement?.sourceRefs, `${path}/sourceRefs`, "invalid_requirement_source", findings);
    requireRelevantSources(sources, requirement?.sourceRefs, new Set([requirement.id, requirement.applicationRef, ...rows(requirement.materialRefs), ...rows(requirement.recordRefs), ...rows(requirement.submissionRefs)]), `${path}/sourceRefs`, findings);
    const blockedRecord = rows(requirement.recordRefs).some((ref) => records.get(ref)?.state !== "received-current" && records.get(ref)?.state !== "waived-by-institution");
    const badMaterial = rows(requirement.materialRefs).some((ref) => materials.get(ref)?.state !== "applicant-approved");
    const expectedRecordKinds = requirementRecordKinds.get(requirement?.kind);
    if (expectedRecordKinds && !rows(requirement.recordRefs).some((ref) => expectedRecordKinds.has(records.get(ref)?.kind))) findings.push(finding("unsupported_requirement_state", `${path}/recordRefs`, "This requirement kind needs an exact same-application record of the corresponding kind."));
    const expectedMaterialKinds = requirementMaterialKinds.get(requirement?.kind);
    if (expectedMaterialKinds && !rows(requirement.materialRefs).some((ref) => expectedMaterialKinds.has(materials.get(ref)?.kind))) findings.push(finding("unsupported_requirement_state", `${path}/materialRefs`, "This requirement kind needs an exact same-application applicant material of the corresponding kind."));
    if (["ready", "submitted", "received"].includes(requirement?.state) && (blockedRecord || badMaterial)) findings.push(finding("unsupported_requirement_state", path, "Ready, submitted, or received requirements require applicant-approved material and cannot rely on missing, stale, or conflicting records."));
    if (["missing", "conflicting", "unknown"].includes(requirement?.state) && !hasOpenGap(gaps, requirement?.gapRefs, requirement?.id)) findings.push(finding("unowned_requirement_blocker", `${path}/gapRefs`, "Missing, conflicting, or unknown requirements require an open owned gap bound to the exact requirement."));
    if (requirement?.state === "submitted" && !rows(requirement?.submissionRefs).some((ref) => ["attempted", "submitted-receipted"].includes(submissions.get(ref)?.state))) findings.push(finding("unsupported_requirement_state", `${path}/submissionRefs`, "Submitted requirements require an attempted or independently receipted exact same-application submission."));
    if (requirement?.state === "received" && rows(requirement?.submissionRefs).length > 0 && !rows(requirement?.submissionRefs).some((ref) => submissions.get(ref)?.state === "submitted-receipted")) findings.push(finding("unsupported_requirement_state", `${path}/submissionRefs`, "Received requirements with submission links require an independently receipted exact same-application submission."));
    if (requirement?.state === "received" && ["application-form", "essay", "statement", "portfolio"].includes(requirement?.kind) && !rows(requirement?.submissionRefs).some((ref) => submissions.get(ref)?.state === "submitted-receipted")) findings.push(finding("unsupported_requirement_state", `${path}/submissionRefs`, "Received applicant-controlled forms and materials require an independently receipted exact same-application submission."));
    if (["waived-by-institution", "not-applicable-by-institution"].includes(requirement?.state)) {
      const programIssuers = programIssuersByApplication.get(requirement.applicationRef) ?? new Set();
      const waiverEvidence = rows(requirement.sourceRefs).map((ref) => sources.get(ref)).some((source) => source && source.freshness === "current" && [requirement.id, requirement.applicationRef].includes(source.subjectRef) && ["program-requirement", "fee-record"].includes(source.kind) && programIssuers.has(source.issuerAuthorityRef));
      if (!waiverEvidence) findings.push(finding("invalid_requirement_waiver", path, "Institution waiver or non-applicability requires current exact-application evidence from the authoritative program issuer."));
    }
    if (requirement?.applicabilityDeterminationByClaw !== false) findings.push(finding("prohibited_eligibility_conclusion", `${path}/applicabilityDeterminationByClaw`, "The Claw cannot determine institutional applicability."));
  }

  for (const submission of submissions.values()) {
    const path = `submissions/${submission?.id}`;
    if (submission?.portfolioRef !== portfolioId) findings.push(finding("cross_portfolio_record", `${path}/portfolioRef`, "Every submission must belong to the exact portfolio."));
    const application = requireRef(applications, submission?.applicationRef, `${path}/applicationRef`, "invalid_submission_application", findings);
    requireBacklink(application, "submissionRefs", submission.id, `${path}/applicationRef`, findings);
    const submitter = requireRef(authorities, submission?.submittedByAuthorityRef, `${path}/submittedByAuthorityRef`, "invalid_submission_owner", findings);
    const expectedExecution = thirdPartySubmissionKinds.has(submission?.kind) ? "third-party-only" : "applicant-only";
    if (submission?.externalExecution !== expectedExecution) findings.push(finding("invalid_submission_kind", `${path}/externalExecution`, `Submission kind ${String(submission?.kind)} requires ${expectedExecution} execution.`));
    if (submission?.externalExecution === "applicant-only" && submitter?.id !== applicant?.id) findings.push(finding("invalid_submission_owner", `${path}/submittedByAuthorityRef`, "Applicant-only submissions must remain controlled by the applicant."));
    if (submission?.externalExecution === "third-party-only" && (!submitter || submitter.id === applicant?.id || !hasScope(submitter, "third-party-record-issuer"))) findings.push(finding("invalid_submission_owner", `${path}/submittedByAuthorityRef`, "Third-party submissions require the exact independent record issuer."));
    let hasCompatibleSubject = false;
    for (const ref of rows(submission?.subjectRefs)) {
      const type = requirements.has(ref) ? "requirement" : materials.has(ref) ? "material" : records.has(ref) ? "record" : decisions.has(ref) ? "decision" : ref === submission.applicationRef ? "application" : null;
      const target = requirements.get(ref) ?? materials.get(ref) ?? records.get(ref) ?? decisions.get(ref) ?? (type === "application" ? application : null);
      if (!target) findings.push(finding("invalid_submission_subject", `${path}/subjectRefs`, `Unknown submission subject ${String(ref)}.`));
      else if (!(target.applicationRef === submission.applicationRef || rows(target.applicationRefs).includes(submission.applicationRef))) findings.push(finding("cross_application_reference", `${path}/subjectRefs`, `${String(ref)} belongs to a different application.`));
      else if (!submissionSubjectCompatible(submission.kind, type, target)) findings.push(finding("invalid_submission_kind", `${path}/subjectRefs`, `${String(ref)} is incompatible with submission kind ${String(submission.kind)}.`));
      else hasCompatibleSubject = true;
      if (requirements.has(ref)) requireBacklink(requirements.get(ref), "submissionRefs", submission.id, `${path}/subjectRefs`, findings);
    }
    if (!hasCompatibleSubject) findings.push(finding("invalid_submission_kind", `${path}/subjectRefs`, "Every submission requires at least one exact same-application subject compatible with its kind."));
    if (submission?.externalExecution === "third-party-only" && !rows(submission.subjectRefs).map((ref) => records.get(ref)).some((item) => item?.kind === submission.kind && item.issuerAuthorityRef === submitter?.id)) findings.push(finding("invalid_submission_owner", `${path}/submittedByAuthorityRef`, "A third-party submission must be controlled by the exact issuer of its same-kind record."));
    requireRefs(sources, submission?.sourceRefs, `${path}/sourceRefs`, "invalid_submission_source", findings);
    requireRelevantSources(sources, submission?.sourceRefs, new Set([submission.id, ...rows(submission.subjectRefs)]), `${path}/sourceRefs`, findings);
    const attemptedAt = exactInstant(submission?.attemptedAt);
    if (["attempted", "submitted-receipted", "failed"].includes(submission?.state)) {
      if (attemptedAt === null || (asOf !== null && attemptedAt > asOf)) findings.push(finding("invalid_submission_chronology", `${path}/attemptedAt`, "Attempted states require an exact time no later than portfolio as-of."));
    } else if (submission?.attemptedAt !== null) findings.push(finding("invalid_submission_chronology", `${path}/attemptedAt`, "Unattempted submission states cannot carry an attempt time."));
    if (["attempted", "submitted-receipted", "failed"].includes(submission?.state) && submission?.externalExecution === "applicant-only" && !rows(submission.sourceRefs).map((ref) => sources.get(ref)).some((source) => source?.kind === "owner-action-note" && source.subjectRef === submission.id && source.issuerAuthorityRef === submitter?.id && source.freshness === "current")) findings.push(finding("invalid_submission_source", `${path}/sourceRefs`, "An attempted applicant-controlled submission requires current exact-submission owner evidence."));
    if (["attempted", "submitted-receipted", "failed"].includes(submission?.state) && submission?.externalExecution === "third-party-only" && !rows(submission.sourceRefs).map((ref) => sources.get(ref)).some((source) => source?.issuerAuthorityRef === submitter?.id && source.freshness === "current" && rows(submission.subjectRefs).includes(source.subjectRef))) findings.push(finding("invalid_submission_source", `${path}/sourceRefs`, "An attempted third-party submission requires current evidence from its exact record issuer bound to a submitted subject."));
    if (submission?.state === "attempted" && ![...gaps.values()].some((gap) => gap.state === "open" && gap.kind === "submission-receipt" && gap.applicationRef === submission.applicationRef && rows(gap.subjectRefs).includes(submission.id))) findings.push(finding("missing_submission_receipt_gap", path, "An attempted unreceipted submission requires an exact open receipt gap."));
    if (submission?.state === "submitted-receipted") {
      const receipt = requireRef(sources, submission?.receiptSourceRef, `${path}/receiptSourceRef`, "invalid_submission_receipt", findings);
      const receiptTime = exactInstant(receipt?.assertedAt);
      const receiptIssuer = authorities.get(receipt?.issuerAuthorityRef);
      const programIssuers = programIssuersByApplication.get(submission.applicationRef) ?? new Set();
      if (!receipt || receipt.kind !== "submission-receipt" || receipt.subjectRef !== submission.id || receipt.freshness !== "current" || receipt.issuerAuthorityRef === submitter?.id || !hasScope(receiptIssuer, "submission-receipt-issuer") || !programIssuers.has(receipt.issuerAuthorityRef) || attemptedAt === null || receiptTime === null || receiptTime < attemptedAt) findings.push(finding("invalid_submission_receipt", path, "Submitted-receipted state requires current independent same-submission evidence from the exact application's authoritative institution, issued after the attempt."));
    } else if (submission?.receiptSourceRef !== null) findings.push(finding("invalid_submission_receipt", `${path}/receiptSourceRef`, "Only submitted-receipted submissions may carry a receipt."));
    if (submission?.agentExecuted !== false) findings.push(finding("prohibited_submission_execution", `${path}/agentExecuted`, "The Claw cannot execute submissions."));
  }

  for (const decision of decisions.values()) {
    const path = `decisions/${decision?.id}`;
    if (decision?.portfolioRef !== portfolioId) findings.push(finding("cross_portfolio_record", `${path}/portfolioRef`, "Every decision must belong to the exact portfolio."));
    const application = requireRef(applications, decision?.applicationRef, `${path}/applicationRef`, "invalid_decision_application", findings);
    requireBacklink(application, "decisionRefs", decision.id, `${path}/applicationRef`, findings);
    const issuer = requireRef(authorities, decision?.issuerAuthorityRef, `${path}/issuerAuthorityRef`, "invalid_decision_issuer", findings);
    const allowed = decision?.kind === "financial-aid" ? new Set(["financial-aid-office"]) : new Set(["institution", "admissions-office"]);
    const source = requireRef(sources, decision?.sourceRef, `${path}/sourceRef`, "invalid_decision_source", findings);
    const decidedAt = exactInstant(decision?.decidedAt);
    const exactIssuerIds = decision?.kind === "financial-aid"
      ? new Set(rows(application?.recordRefs).map((ref) => records.get(ref)).filter((item) => item?.kind === "financial-aid").map((item) => item.issuerAuthorityRef))
      : (programIssuersByApplication.get(decision?.applicationRef) ?? new Set());
    if (!issuer || !allowed.has(issuer.kind) || !hasScope(issuer, "decision-issuer") || issuer.status !== "current" || !exactIssuerIds.has(issuer.id)) findings.push(finding("invalid_decision_issuer", `${path}/issuerAuthorityRef`, "Decision kind requires the current exact application's institution or aid decision authority."));
    if (!decisionOutcomes.get(decision?.kind)?.has(decision?.outcome)) findings.push(finding("invalid_decision_outcome", `${path}/outcome`, "Decision outcome must be compatible with its exact decision kind."));
    if (!source || source.kind !== "official-decision" || source.subjectRef !== decision.id || source.issuerAuthorityRef !== issuer?.id || source.freshness !== "current") findings.push(finding("invalid_decision_source", `${path}/sourceRef`, "Decisions require current exact-decision official evidence from the named issuer."));
    if (decidedAt === null || (asOf !== null && decidedAt > asOf) || exactInstant(source?.assertedAt) !== decidedAt) findings.push(finding("invalid_decision_chronology", `${path}/decidedAt`, "Decision time must exactly match official evidence and not exceed portfolio as-of."));
    if (decision?.interpretationByClaw !== false) findings.push(finding("prohibited_admission_conclusion", `${path}/interpretationByClaw`, "The Claw cannot interpret admissions, aid, transfer-credit, waitlist, or enrollment decisions."));
  }

  for (const action of actions.values()) {
    const path = `actions/${action?.id}`;
    if (action?.portfolioRef !== portfolioId) findings.push(finding("cross_portfolio_record", `${path}/portfolioRef`, "Every action must belong to the exact portfolio."));
    const application = requireRef(applications, action?.applicationRef, `${path}/applicationRef`, "invalid_action_application", findings);
    requireBacklink(application, "actionRefs", action.id, `${path}/applicationRef`, findings);
    const owner = requireRef(authorities, action?.ownerAuthorityRef, `${path}/ownerAuthorityRef`, "invalid_action_owner", findings);
    if (!owner || owner.id !== applicant?.id || owner.status !== "current") findings.push(finding("invalid_action_owner", `${path}/ownerAuthorityRef`, "Every external action remains owned by the current applicant."));
    for (const ref of rows(action?.subjectRefs)) {
      if (!knownSubjects.has(ref)) findings.push(finding("invalid_action_subject", `${path}/subjectRefs`, `Unknown action subject ${String(ref)}.`));
      else if (!subjectBelongsToApplication(ref, action.applicationRef, [materials, records, requirements, submissions, decisions, actions, gaps])) findings.push(finding("cross_application_reference", `${path}/subjectRefs`, `${String(ref)} belongs to a different application.`));
    }
    requireRefs(sources, action?.sourceRefs, `${path}/sourceRefs`, "invalid_action_source", findings);
    requireRelevantSources(sources, action?.sourceRefs, new Set([action.id, action.applicationRef, ...rows(action.subjectRefs)]), `${path}/sourceRefs`, findings);
    const attemptedAt = exactInstant(action?.attemptedAt);
    if (["attempted", "owner-completed-receipted", "failed"].includes(action?.state)) {
      if (attemptedAt === null || (asOf !== null && attemptedAt > asOf)) findings.push(finding("invalid_action_chronology", `${path}/attemptedAt`, "Attempted action states require an exact time no later than portfolio as-of."));
    } else if (action?.attemptedAt !== null) findings.push(finding("invalid_action_chronology", `${path}/attemptedAt`, "Proposed, blocked, or withdrawn actions cannot carry an attempt time."));
    if (["attempted", "owner-completed-receipted", "failed"].includes(action?.state) && !rows(action.sourceRefs).map((ref) => sources.get(ref)).some((source) => source?.kind === "owner-action-note" && source.subjectRef === action.id && source.issuerAuthorityRef === owner?.id && source.freshness === "current")) findings.push(finding("invalid_action_source", `${path}/sourceRefs`, "An attempted applicant action requires current exact-action owner evidence."));
    if (action?.state === "owner-completed-receipted") {
      const receipt = requireRef(sources, action?.receiptSourceRef, `${path}/receiptSourceRef`, "invalid_action_receipt", findings);
      const receiptTime = exactInstant(receipt?.assertedAt);
      const programIssuers = programIssuersByApplication.get(action.applicationRef) ?? new Set();
      if (!receipt || receipt.kind !== "submission-receipt" || receipt.subjectRef !== action.id || receipt.freshness !== "current" || receipt.issuerAuthorityRef === owner?.id || !hasScope(authorities.get(receipt.issuerAuthorityRef), "submission-receipt-issuer") || !programIssuers.has(receipt.issuerAuthorityRef) || attemptedAt === null || receiptTime === null || receiptTime < attemptedAt) findings.push(finding("invalid_action_receipt", path, "Completed actions require current independent same-action receipt evidence from the exact application's institution, issued after the attempt."));
    } else if (action?.receiptSourceRef !== null) findings.push(finding("invalid_action_receipt", `${path}/receiptSourceRef`, "Only owner-completed-receipted actions may carry a receipt."));
    if (action?.externalExecution !== "applicant-only" || action?.agentExecuted !== false) findings.push(finding("prohibited_action_execution", path, "Every external action remains applicant-only and unexecuted by the Claw."));
  }

  for (const gap of gaps.values()) {
    const path = `gaps/${gap?.id}`;
    if (gap?.portfolioRef !== portfolioId) findings.push(finding("cross_portfolio_record", `${path}/portfolioRef`, "Every gap must belong to the exact portfolio."));
    const application = requireRef(applications, gap?.applicationRef, `${path}/applicationRef`, "invalid_gap_application", findings);
    requireBacklink(application, "gapRefs", gap.id, `${path}/applicationRef`, findings);
    for (const ref of rows(gap?.subjectRefs)) {
      if (!knownSubjects.has(ref)) findings.push(finding("invalid_gap_subject", `${path}/subjectRefs`, `Unknown gap subject ${String(ref)}.`));
      else if (!subjectBelongsToApplication(ref, gap.applicationRef, [materials, records, requirements, submissions, decisions, actions, gaps])) findings.push(finding("cross_application_reference", `${path}/subjectRefs`, `${String(ref)} belongs to a different application.`));
      requireBacklink(records.get(ref), "gapRefs", gap.id, `${path}/subjectRefs`, findings);
      requireBacklink(requirements.get(ref), "gapRefs", gap.id, `${path}/subjectRefs`, findings);
    }
    requireRefs(sources, gap?.sourceRefs, `${path}/sourceRefs`, "invalid_gap_source", findings);
    requireRelevantSources(sources, gap?.sourceRefs, new Set([gap.id, gap.applicationRef, ...rows(gap.subjectRefs)]), `${path}/sourceRefs`, findings);
    const owner = requireRef(authorities, gap?.nextOwnerAuthorityRef, `${path}/nextOwnerAuthorityRef`, "invalid_gap_owner", findings);
    if (!owner || owner.status !== "current") findings.push(finding("invalid_gap_owner", `${path}/nextOwnerAuthorityRef`, "Every gap requires a current named human or institution owner."));
    const subjectRecords = rows(gap.subjectRefs).map((ref) => records.get(ref)).filter(Boolean);
    const exactGapOwnerIds = gap?.kind === "third-party-record"
      ? new Set(subjectRecords.map((item) => item.issuerAuthorityRef))
      : gap?.kind === "financial-aid"
        ? new Set(subjectRecords.filter((item) => item.kind === "financial-aid").map((item) => item.issuerAuthorityRef))
        : ["submission-receipt", "portal-state", "official-decision", "conflicting-requirement", "deadline"].includes(gap?.kind)
          ? (programIssuersByApplication.get(gap.applicationRef) ?? new Set())
          : ["applicant-authorship", "privacy"].includes(gap?.kind)
            ? new Set([applicant?.id])
            : null;
    const mixedThirdPartyOwners = gap?.kind === "third-party-record" && [...(exactGapOwnerIds ?? [])].some((id) => id !== gap?.nextOwnerAuthorityRef);
    if (exactGapOwnerIds && (exactGapOwnerIds.size === 0 || !exactGapOwnerIds.has(gap?.nextOwnerAuthorityRef) || mixedThirdPartyOwners)) findings.push(finding("invalid_gap_owner", `${path}/nextOwnerAuthorityRef`, "Gap kind and all exact subjects require the same matching applicant, third-party record issuer, aid office, or application institution owner."));
    if (gap?.kind === "submission-receipt" && gap?.state === "open" && !rows(gap.subjectRefs).some((ref) => submissions.get(ref)?.state === "attempted")) findings.push(finding("invalid_gap_subject", `${path}/subjectRefs`, "An open submission-receipt gap requires an exact attempted, unreceipted submission subject."));
    if (gap?.state === "resolved") {
      const resolution = requireRef(sources, gap?.resolutionSourceRef, `${path}/resolutionSourceRef`, "invalid_gap_resolution", findings);
      if (!resolution || resolution.kind !== "gap-resolution" || resolution.subjectRef !== gap.id || resolution.issuerAuthorityRef !== owner?.id || resolution.freshness !== "current") findings.push(finding("invalid_gap_resolution", path, "Resolved gaps require current exact-gap evidence from the named owner."));
    } else if (gap?.resolutionSourceRef !== null) findings.push(finding("invalid_gap_resolution", `${path}/resolutionSourceRef`, "Open gaps cannot carry resolution evidence."));
  }

  const expectedReviewIndexes = [
    [review.openGapRefs, [...gaps.values()].filter((row) => row?.state === "open").map((row) => row.id), "openGapRefs"],
    [review.incompleteApplicationRefs, [...applications.values()].filter((row) => !["submitted-receipted", "decided", "withdrawn"].includes(row?.state)).map((row) => row.id), "incompleteApplicationRefs"],
    [review.missingRequirementRefs, [...requirements.values()].filter((row) => ["missing", "conflicting", "unknown"].includes(row?.state)).map((row) => row.id), "missingRequirementRefs"],
    [review.unreceiptedSubmissionRefs, [...submissions.values()].filter((row) => row?.state === "attempted").map((row) => row.id), "unreceiptedSubmissionRefs"],
    [review.unresolvedDecisionApplicationRefs, [...applications.values()].filter((row) => conflictingDecisionApplications.has(row?.id) || (row?.state !== "withdrawn" && !rows(row?.decisionRefs).map((ref) => decisions.get(ref)).some((decision) => decision && ["admission", "waitlist"].includes(decision.kind) && decision.outcome !== "pending"))).map((row) => row.id), "unresolvedDecisionApplicationRefs"],
    [review.blockedActionRefs, [...actions.values()].filter((row) => row?.state === "blocked").map((row) => row.id), "blockedActionRefs"],
  ];
  for (const [actual, expected, key] of expectedReviewIndexes) if (!sameRefs(actual, expected)) findings.push(finding("incomplete_review_index", `review/${key}`, `Review ${key} must exactly mirror current unresolved state.`));

  for (const key of ["authorshipClaim", "admissionPrediction", "eligibilityConclusion", "financialAidConclusion", "transferCreditConclusion", "fitRecommendation", "submissionClaim", "enrollmentCommitment"]) if (review[key] !== false) findings.push(finding("prohibited_admission_conclusion", `review/${key}`, "The handoff cannot claim authorship, submission, enrollment commitment, advice, prediction, eligibility, admission, aid, transfer credit, or fit conclusions."));
  for (const [key, allowed] of Object.entries(prohibitedActions)) if (allowed !== false) findings.push(finding("prohibited_authority_claim", `prohibitedActions/${key}`, "Every prohibited application action must remain false."));

  for (const text of collectStrings(value)) {
    if (SENSITIVE_TEXT_PATTERN.test(text)) {
      findings.push(finding("secret_bearing_text", "", "The artifact must not contain credentials, direct applicant identifiers, precise street addresses, email addresses, or secret-bearing text."));
      break;
    }
  }
  const blockerCount = expectedReviewIndexes.reduce((total, [, expected]) => total + expected.length, 0);
  if (review.state !== (blockerCount > 0 || findings.length > 0 ? "blocked" : "applicant-review-ready")) findings.push(finding("premature_review_readiness", "review/state", "Any invalid evidence or unresolved application, requirement, submission, decision, action, gap, or privacy state requires a blocked handoff."));
  return findings;
}
