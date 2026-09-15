import { createHash } from "node:crypto";

const SCHEMA_VERSION = "awesomeClaws.solutionArchitectureDecision.v1";
const SPECIALIST_SCOPE_BY_DIMENSION = Object.freeze({
  "requirement-fit": "architecture-analysis",
  cost: "cost-assessment",
  security: "security-assessment",
  reliability: "reliability-assessment",
  operability: "operability-assessment",
});
const DIMENSIONS = Object.keys(SPECIALIST_SCOPE_BY_DIMENSION);
const PROHIBITED_ACTIONS = [
  "deploy",
  "mutate-tenant-or-configuration",
  "commit-product-or-vendor",
  "select-customer",
  "certify-security-or-compliance",
  "accept-risk",
  "guarantee-performance-or-cost",
];
const PACKAGE_IDENTITY =
  /\b(?:solution architecture decision advisor|claw|agent|assistant|bot|system)\b/iu;

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

function withoutContentDigest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { contentDigest: _contentDigest, ...content } = value;
  return content;
}

export function computeRequirementUniverseDigest({
  workload,
  requirementUniverse,
  requirements,
}) {
  return digest({
    workload,
    requirementUniverse: withoutContentDigest(requirementUniverse),
    requirements,
  });
}

export function computeArchitectureOptionDigest(option) {
  return digest(withoutContentDigest(option));
}

export function computeArchitectureAdrDigest(adr) {
  return digest(withoutContentDigest(adr));
}

export function computeArchitectureDecisionDigest(decision) {
  return digest(withoutContentDigest(decision));
}

function finding(code, path, message) {
  return { code, path, message };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function records(value, path, label, findings) {
  if (!Array.isArray(value)) {
    findings.push(finding("invalid_array_list", path, `${label} must be an array.`));
    return [];
  }
  return value.flatMap((item, index) => {
    if (isRecord(item)) return [[index, item]];
    findings.push(
      finding("invalid_array_record", `${path}[${index}]`, `${label} entries must be objects.`),
    );
    return [];
  });
}

function ids(record, path, label, findings) {
  const seen = new Set();
  const result = new Set();
  for (const [index, item] of record) {
    if (typeof item.id !== "string" || item.id.trim() === "") {
      findings.push(
        finding(
          "invalid_array_record",
          `${path}[${index}].id`,
          `${label} requires a stable non-empty id.`,
        ),
      );
      continue;
    }
    if (seen.has(item.id)) {
      findings.push(
        finding("duplicate_reference", `${path}[${index}].id`, `${label} id is duplicated.`),
      );
    }
    seen.add(item.id);
    result.add(item.id);
  }
  return result;
}

function stringList(value, path, findings) {
  if (!Array.isArray(value)) {
    findings.push(finding("invalid_reference_list", path, "References must be an array."));
    return [];
  }
  const seen = new Set();
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || item.trim() === "") {
      findings.push(
        finding("invalid_reference_list", `${path}[${index}]`, "References must be strings."),
      );
    } else if (seen.has(item)) {
      findings.push(
        finding("duplicate_reference", `${path}[${index}]`, "Reference is duplicated."),
      );
    }
    seen.add(item);
  }
  return value.filter((item) => typeof item === "string" && item.trim() !== "");
}

function referenceList(value, allowed, path, findings) {
  const values = stringList(value, path, findings);
  for (const item of values) {
    if (!allowed.has(item)) {
      findings.push(
        finding("dangling_reference", path, `Reference ${JSON.stringify(item)} does not resolve.`),
      );
    }
  }
  return values;
}

function sameSet(left, right) {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((item) => right.includes(item))
  );
}

function time(value) {
  const result = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(result) ? result : null;
}

function controlledReference(value) {
  if (typeof value !== "string" || !value.startsWith("controlled://")) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "controlled:" &&
      Boolean(url.hostname) &&
      url.pathname.replace(/^\/+/u, "").length > 0 &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function hasUnnegatedNarrativeMatch(text, pattern) {
  const adjacentNegation =
    /\b(?:do not|does not|did not|is not|are not|was not|were not|not|no|never|without|cannot|must not|will not)\s*$/iu;
  return String(text)
    .replaceAll("’", "'")
    .replace(/\s+/gu, " ")
    .split(/[.!?]\s*|\s*[;:]\s*/u)
    .some((clause) =>
      [...clause.matchAll(pattern)].some((match) => {
        const prefix = clause.slice(0, match.index);
        const matchedText = match[0];
        return (
          !adjacentNegation.test(prefix) &&
          !/\b(?:do not|does not|did not|is not|are not|was not|were not|not|no|never|without|cannot|must not|will not)\b/iu.test(
            matchedText,
          )
        );
      }),
    );
}

function userVisibleNarratives(document) {
  const narratives = [];
  const add = (path, value) => {
    if (typeof value === "string" && value.trim()) narratives.push([path, value]);
  };
  add("workload.scope", document.workload?.scope);
  (document.requirements ?? []).forEach((item, index) =>
    add(`requirements[${index}].statement`, item?.statement),
  );
  (document.options ?? []).forEach((item, index) => {
    add(`options[${index}].name`, item?.name);
    add(`options[${index}].description`, item?.description);
  });
  (document.criteria ?? []).forEach((item, index) => {
    add(`criteria[${index}].statement`, item?.statement);
    add(`criteria[${index}].comparisonMethod`, item?.comparisonMethod);
  });
  (document.evidence ?? []).forEach((item, index) => {
    add(`evidence[${index}].claim`, item?.claim);
    add(`evidence[${index}].result`, item?.result);
    add(`evidence[${index}].uncertainty`, item?.uncertainty);
  });
  (document.coverage ?? []).forEach((item, index) =>
    add(`coverage[${index}].rationale`, item?.rationale),
  );
  (document.tradeoffs ?? []).forEach((item, index) =>
    add(`tradeoffs[${index}].summary`, item?.summary),
  );
  (document.risks ?? []).forEach((item, index) =>
    add(`risks[${index}].statement`, item?.statement),
  );
  (document.experiments ?? []).forEach((item, index) => {
    add(`experiments[${index}].question`, item?.question);
    add(`experiments[${index}].method`, item?.method);
    add(`experiments[${index}].successCriteria`, item?.successCriteria);
    (item?.limitations ?? []).forEach((limitation, limitationIndex) =>
      add(`experiments[${index}].limitations[${limitationIndex}]`, limitation),
    );
  });
  (document.adrRevisions ?? []).forEach((item, index) =>
    add(`adrRevisions[${index}].rationale`, item?.rationale),
  );
  add("decision.summary", document.decision?.summary);
  add("handoff.summary", document.handoff?.summary);
  return narratives;
}

function principalHasScope(principalsById, principalRef, scope) {
  return principalsById.get(principalRef)?.scopes?.includes(scope) === true;
}

function humanPrincipalFindings(principalRecord, findings) {
  for (const [index, principal] of principalRecord) {
    if (
      typeof principal.name !== "string" ||
      principal.name.trim() === "" ||
      typeof principal.role !== "string" ||
      principal.role.trim() === "" ||
      PACKAGE_IDENTITY.test(principal.name) ||
      PACKAGE_IDENTITY.test(principal.role)
    ) {
      findings.push(
        finding(
          "invalid_principal_authority",
          `principals[${index}]`,
          "Architecture authority and specialist claims require a named human principal, not the package or an agent identity.",
        ),
      );
    }
    if (!Array.isArray(principal.scopes) || principal.scopes.length === 0) {
      findings.push(
        finding(
          "invalid_principal_authority",
          `principals[${index}].scopes`,
          "Every principal requires explicit non-empty scopes.",
        ),
      );
    }
  }
}

function validateOptionBindings({
  bindings,
  expectedOptionIds,
  optionsById,
  path,
  findings,
}) {
  const record = records(bindings, path, "Option binding ledger", findings);
  const keys = [];
  for (const [index, binding] of record) {
    const option = optionsById.get(binding.optionRef);
    keys.push(binding.optionRef);
    if (
      !option ||
      binding.optionRevision !== option.revision ||
      binding.optionDigest !== option.contentDigest
    ) {
      findings.push(
        finding(
          "invalid_option_digest_binding",
          `${path}[${index}]`,
          "An option binding must carry the exact current option revision and canonical digest.",
        ),
      );
    }
  }
  if (!sameSet(keys, expectedOptionIds)) {
    findings.push(
      finding(
        "invalid_option_digest_binding",
        path,
        "Option bindings must cover the declared option set exactly once.",
      ),
    );
  }
}

export function solutionArchitectureDecisionFindings(value) {
  const findings = [];
  const document = isRecord(value) ? value : {};
  if (document.schemaVersion !== SCHEMA_VERSION) {
    findings.push(
      finding(
        "invalid_schema_version",
        "schemaVersion",
        `The architecture decision must use ${SCHEMA_VERSION}.`,
      ),
    );
  }

  const principalRecord = records(document.principals, "principals", "Principal ledger", findings);
  const requirementRecord = records(
    document.requirements,
    "requirements",
    "Requirement ledger",
    findings,
  );
  const optionRecord = records(document.options, "options", "Option ledger", findings);
  const criterionRecord = records(document.criteria, "criteria", "Criterion ledger", findings);
  const evidenceRecord = records(document.evidence, "evidence", "Evidence ledger", findings);
  const coverageRecord = records(document.coverage, "coverage", "Coverage ledger", findings);
  const tradeoffRecord = records(document.tradeoffs, "tradeoffs", "Tradeoff ledger", findings);
  const riskRecord = records(document.risks, "risks", "Risk ledger", findings);
  const experimentRecord = records(
    document.experiments,
    "experiments",
    "Experiment ledger",
    findings,
  );
  const adrRecord = records(
    document.adrRevisions,
    "adrRevisions",
    "ADR revision ledger",
    findings,
  );

  const principalIds = ids(principalRecord, "principals", "Principal", findings);
  const requirementIds = ids(requirementRecord, "requirements", "Requirement", findings);
  const optionIds = ids(optionRecord, "options", "Option", findings);
  const criterionIds = ids(criterionRecord, "criteria", "Criterion", findings);
  const evidenceIds = ids(evidenceRecord, "evidence", "Evidence", findings);
  const riskIds = ids(riskRecord, "risks", "Risk", findings);
  const adrIds = ids(adrRecord, "adrRevisions", "ADR revision", findings);
  humanPrincipalFindings(principalRecord, findings);

  const principalsById = new Map(principalRecord.map(([, item]) => [item.id, item]));
  const requirementsById = new Map(requirementRecord.map(([, item]) => [item.id, item]));
  const optionsById = new Map(optionRecord.map(([, item]) => [item.id, item]));
  const criteriaById = new Map(criterionRecord.map(([, item]) => [item.id, item]));
  const evidenceById = new Map(evidenceRecord.map(([, item]) => [item.id, item]));
  const risksById = new Map(riskRecord.map(([, item]) => [item.id, item]));
  const adrsById = new Map(adrRecord.map(([, item]) => [item.id, item]));

  const workload = isRecord(document.workload) ? document.workload : {};
  const universe = isRecord(document.requirementUniverse) ? document.requirementUniverse : {};
  const evaluationWindow = isRecord(document.evaluationWindow)
    ? document.evaluationWindow
    : {};
  const approvalAt = time(workload.approvedAt);
  const attestedAt = time(universe.completenessAttestedAt);
  const windowStart = time(evaluationWindow.startsAt);
  const windowEnd = time(evaluationWindow.endsAt);
  if (
    approvalAt === null ||
    attestedAt === null ||
    approvalAt > attestedAt ||
    windowStart === null ||
    windowEnd === null ||
    attestedAt > windowStart ||
    windowStart >= windowEnd
  ) {
    findings.push(
      finding(
        "invalid_architecture_chronology",
        "evaluationWindow",
        "Chronology must order workload approval, completeness attestation, and the evaluation window.",
      ),
    );
  }

  const declaredRequirements = referenceList(
    universe.declaredRequirementIds,
    requirementIds,
    "requirementUniverse.declaredRequirementIds",
    findings,
  );
  const declaredConstraints = referenceList(
    universe.declaredConstraintIds,
    requirementIds,
    "requirementUniverse.declaredConstraintIds",
    findings,
  );
  const actualConstraints = requirementRecord
    .filter(([, item]) => item.type === "constraint")
    .map(([, item]) => item.id);
  const expectedUniverseDigest = computeRequirementUniverseDigest({
    workload,
    requirementUniverse: universe,
    requirements: requirementRecord.map(([, item]) => item),
  });
  if (
    universe.revision !== workload.requirementsRevision ||
    !sameSet(declaredRequirements, [...requirementIds]) ||
    !sameSet(declaredConstraints, actualConstraints) ||
    universe.attestedByPrincipalRef !== workload.approvedByPrincipalRef ||
    !principalHasScope(
      principalsById,
      workload.approvedByPrincipalRef,
      "requirements-approval",
    ) ||
    !controlledReference(universe.sourceRef) ||
    universe.contentDigest !== expectedUniverseDigest
  ) {
    findings.push(
      finding(
        "invalid_requirement_universe",
        "requirementUniverse",
        "The approved requirement universe must be complete, owner-attested, and content-bound by its canonical digest.",
      ),
    );
  }

  for (const [index, requirement] of requirementRecord) {
    if (
      !principalIds.has(requirement.ownerRef) ||
      !principalHasScope(principalsById, requirement.ownerRef, "requirement-ownership") ||
      !controlledReference(requirement.sourceRef)
    ) {
      findings.push(
        finding(
          "invalid_requirement_universe",
          `requirements[${index}]`,
          "Every requirement requires a controlled source and authorized requirement owner.",
        ),
      );
    }
  }

  const activeOptions = optionRecord.filter(([, item]) => item.state !== "withdrawn");
  const activeOptionIds = activeOptions.map(([, item]) => item.id);
  if (activeOptions.length < 2) {
    findings.push(
      finding(
        "invalid_option_identity",
        "options",
        "At least two stable active architecture options are required.",
      ),
    );
  }
  for (const [index, option] of optionRecord) {
    if (
      !Number.isInteger(option.revision) ||
      option.revision < 1 ||
      option.contentDigest !== computeArchitectureOptionDigest(option)
    ) {
      findings.push(
        finding(
          "invalid_option_digest",
          `options[${index}]`,
          "Each option revision must carry its exact canonical content digest.",
        ),
      );
    }
  }

  const dimensions = criterionRecord.map(([, item]) => item.dimension);
  if (!sameSet(dimensions, DIMENSIONS) || new Set(dimensions).size !== DIMENSIONS.length) {
    findings.push(
      finding(
        "incomplete_tradeoff_dimensions",
        "criteria",
        "The comparison requires exactly one criterion for every fixed architecture dimension.",
      ),
    );
  }
  for (const [index, criterion] of criterionRecord) {
    const fixedScope = SPECIALIST_SCOPE_BY_DIMENSION[criterion.dimension];
    if (!fixedScope || criterion.requiredSpecialistScope !== fixedScope) {
      findings.push(
        finding(
          "invalid_specialist_scope_mapping",
          `criteria[${index}].requiredSpecialistScope`,
          "Criterion authority is fixed by dimension and cannot be redefined by the artifact.",
        ),
      );
    }
  }

  for (const [index, evidence] of evidenceRecord) {
    const option = optionsById.get(evidence.optionRef);
    const criterion = criteriaById.get(evidence.criterionRef);
    const requiredScope = SPECIALIST_SCOPE_BY_DIMENSION[criterion?.dimension];
    const requirementRefs = referenceList(
      evidence.requirementRefs,
      requirementIds,
      `evidence[${index}].requirementRefs`,
      findings,
    );
    const assertedAt = time(evidence.assertedAt);
    if (
      evidence.requirementsRevision !== workload.requirementsRevision ||
      evidence.requirementUniverseDigest !== universe.contentDigest ||
      !option ||
      evidence.optionRevision !== option.revision ||
      evidence.optionDigest !== option.contentDigest ||
      !criterion ||
      requirementRefs.length === 0 ||
      !controlledReference(evidence.sourceRef) ||
      assertedAt === null ||
      attestedAt === null ||
      assertedAt < attestedAt ||
      windowStart === null ||
      windowEnd === null ||
      assertedAt < windowStart ||
      assertedAt > windowEnd
    ) {
      findings.push(
        finding(
          "cross_scope_evidence",
          `evidence[${index}]`,
          "Evidence must bind the exact requirement-universe digest, option digest, criterion, requirements, controlled source, and chronology.",
        ),
      );
    }
    if (
      !requiredScope ||
      !principalHasScope(principalsById, evidence.ownerRef, requiredScope)
    ) {
      findings.push(
        finding(
          "specialist_claim_without_authority",
          `evidence[${index}].ownerRef`,
          "Evidence ownership must satisfy the validator's fixed dimension-to-specialist-scope mapping.",
        ),
      );
    }
  }

  const coverageKeys = new Map();
  for (const [index, coverage] of coverageRecord) {
    const key = `${coverage.optionRef}\0${coverage.requirementRef}`;
    coverageKeys.set(key, (coverageKeys.get(key) ?? 0) + 1);
    const option = optionsById.get(coverage.optionRef);
    const refs = referenceList(
      coverage.evidenceRefs,
      evidenceIds,
      `coverage[${index}].evidenceRefs`,
      findings,
    );
    const grounding = refs.map((ref) => evidenceById.get(ref)).filter(Boolean);
    if (
      !option ||
      coverage.optionRevision !== option.revision ||
      coverage.optionDigest !== option.contentDigest ||
      coverage.requirementUniverseDigest !== universe.contentDigest ||
      !requirementsById.has(coverage.requirementRef) ||
      grounding.length === 0 ||
      grounding.some(
        (evidence) =>
          evidence.optionRef !== coverage.optionRef ||
          evidence.optionRevision !== coverage.optionRevision ||
          evidence.optionDigest !== coverage.optionDigest ||
          evidence.requirementUniverseDigest !== coverage.requirementUniverseDigest ||
          !Array.isArray(evidence.requirementRefs) ||
          !evidence.requirementRefs.includes(coverage.requirementRef),
      )
    ) {
      findings.push(
        finding(
          "cross_scope_requirement_coverage",
          `coverage[${index}]`,
          "Coverage must bind the exact option and requirement-universe digests and matching evidence.",
        ),
      );
    }
  }
  const expectedCoverageKeys = activeOptions.flatMap(([, option]) =>
    requirementRecord.map(([, requirement]) => `${option.id}\0${requirement.id}`),
  );
  const completeCoverage =
    coverageRecord.length === expectedCoverageKeys.length &&
    expectedCoverageKeys.every((key) => coverageKeys.get(key) === 1) &&
    [...coverageKeys].every(
      ([key, count]) => expectedCoverageKeys.includes(key) && count === 1,
    );

  const tradeoffKeys = new Map();
  for (const [index, tradeoff] of tradeoffRecord) {
    const key = `${tradeoff.optionRef}\0${tradeoff.criterionRef}`;
    tradeoffKeys.set(key, (tradeoffKeys.get(key) ?? 0) + 1);
    const option = optionsById.get(tradeoff.optionRef);
    const refs = referenceList(
      tradeoff.evidenceRefs,
      evidenceIds,
      `tradeoffs[${index}].evidenceRefs`,
      findings,
    );
    const grounding = refs.map((ref) => evidenceById.get(ref)).filter(Boolean);
    if (
      !option ||
      tradeoff.optionRevision !== option.revision ||
      tradeoff.optionDigest !== option.contentDigest ||
      tradeoff.requirementUniverseDigest !== universe.contentDigest ||
      !criteriaById.has(tradeoff.criterionRef) ||
      grounding.length === 0 ||
      grounding.some(
        (evidence) =>
          evidence.optionRef !== tradeoff.optionRef ||
          evidence.optionDigest !== tradeoff.optionDigest ||
          evidence.criterionRef !== tradeoff.criterionRef ||
          evidence.requirementUniverseDigest !== tradeoff.requirementUniverseDigest,
      )
    ) {
      findings.push(
        finding(
          "cross_scope_tradeoff_evidence",
          `tradeoffs[${index}]`,
          "Tradeoffs must bind exact option and universe digests plus same-criterion evidence.",
        ),
      );
    }
  }
  const expectedTradeoffKeys = activeOptions.flatMap(([, option]) =>
    criterionRecord.map(([, criterion]) => `${option.id}\0${criterion.id}`),
  );
  const completeTradeoffs =
    tradeoffRecord.length === expectedTradeoffKeys.length &&
    expectedTradeoffKeys.every((key) => tradeoffKeys.get(key) === 1) &&
    [...tradeoffKeys].every(
      ([key, count]) => expectedTradeoffKeys.includes(key) && count === 1,
    );
  let comparableEvidence = true;
  for (const [, criterion] of criterionRecord) {
    const cells = tradeoffRecord.filter(([, item]) => item.criterionRef === criterion.id);
    const setIds = new Set(
      cells.flatMap(([, cell]) =>
        (Array.isArray(cell.evidenceRefs) ? cell.evidenceRefs : [])
          .map((ref) => evidenceById.get(ref)?.comparableSetId)
          .filter(Boolean),
      ),
    );
    if (
      cells.length !== activeOptions.length ||
      setIds.size !== 1 ||
      cells.some(([, cell]) => cell.rating === "unknown")
    ) {
      comparableEvidence = false;
    }
  }

  let allExperimentsCompleted = true;
  for (const [index, experiment] of experimentRecord) {
    const optionRefs = referenceList(
      experiment.optionRefs,
      optionIds,
      `experiments[${index}].optionRefs`,
      findings,
    );
    const criterionRefs = referenceList(
      experiment.criterionRefs,
      criterionIds,
      `experiments[${index}].criterionRefs`,
      findings,
    );
    const evidenceRefs = referenceList(
      experiment.evidenceRefs,
      evidenceIds,
      `experiments[${index}].evidenceRefs`,
      findings,
    );
    validateOptionBindings({
      bindings: experiment.optionBindings,
      expectedOptionIds: optionRefs,
      optionsById,
      path: `experiments[${index}].optionBindings`,
      findings,
    });
    const startedAt = time(experiment.startedAt);
    const completedAt = time(experiment.completedAt);
    const grounding = evidenceRefs.map((ref) => evidenceById.get(ref)).filter(Boolean);
    const expectedPairs = optionRefs.flatMap((optionRef) =>
      criterionRefs.map((criterionRef) => `${optionRef}\0${criterionRef}`),
    );
    const groundedPairs = grounding.map(
      (evidence) => `${evidence.optionRef}\0${evidence.criterionRef}`,
    );
    if (
      experiment.requirementUniverseDigest !== universe.contentDigest ||
      !principalHasScope(principalsById, experiment.ownerRef, "experiment-ownership") ||
      startedAt === null ||
      attestedAt === null ||
      startedAt < attestedAt
    ) {
      findings.push(
        finding(
          "invalid_experiment_evidence",
          `experiments[${index}]`,
          "Experiments require exact universe and option digest bindings, authorized ownership, and post-attestation chronology.",
        ),
      );
    }
    if (experiment.state === "completed") {
      if (
        completedAt === null ||
        startedAt >= completedAt ||
        grounding.length !== evidenceRefs.length ||
        grounding.some(
          (evidence) =>
            evidence.kind !== "experiment-result" ||
            evidence.requirementUniverseDigest !== universe.contentDigest ||
            time(evidence.assertedAt) < completedAt,
        ) ||
        !sameSet(groundedPairs, expectedPairs)
      ) {
        findings.push(
          finding(
            "invalid_experiment_evidence",
            `experiments[${index}]`,
            "A completed experiment requires one matching result-evidence record for every declared option and criterion pair.",
          ),
        );
      }
    } else {
      allExperimentsCompleted = false;
      if (completedAt !== null || evidenceRefs.length !== 0) {
        findings.push(
          finding(
            "invalid_experiment_state",
            `experiments[${index}]`,
            "Planned and blocked experiments cannot claim completion time or result evidence.",
          ),
        );
      }
    }
  }

  for (const [index, risk] of riskRecord) {
    const evidenceRefs = referenceList(
      risk.evidenceRefs,
      evidenceIds,
      `risks[${index}].evidenceRefs`,
      findings,
    );
    const grounding = evidenceRefs.map((ref) => evidenceById.get(ref)).filter(Boolean);
    let scopeValid = false;
    if (risk.scope === "option") {
      const option = optionsById.get(risk.optionRef);
      scopeValid =
        Boolean(option) &&
        risk.optionRevision === option.revision &&
        risk.optionDigest === option.contentDigest &&
        grounding.length === evidenceRefs.length &&
        grounding.every(
          (evidence) =>
            evidence.optionRef === risk.optionRef &&
            evidence.optionRevision === risk.optionRevision &&
            evidence.optionDigest === risk.optionDigest,
        );
    } else if (risk.scope === "cross-cutting") {
      const groundedOptions = grounding.map((evidence) => evidence.optionRef);
      scopeValid =
        risk.optionRef === null &&
        risk.optionRevision === null &&
        risk.optionDigest === null &&
        grounding.length === evidenceRefs.length &&
        sameSet(groundedOptions, activeOptionIds);
    }
    if (
      !scopeValid ||
      risk.requirementUniverseDigest !== universe.contentDigest ||
      grounding.some(
        (evidence) => evidence.requirementUniverseDigest !== universe.contentDigest,
      ) ||
      !principalHasScope(principalsById, risk.ownerRef, "risk-ownership") ||
      evidenceRefs.length === 0 ||
      (risk.state === "mitigated" && risk.residual !== false) ||
      (risk.state === "open" && risk.residual !== true)
    ) {
      findings.push(
        finding(
          "invalid_residual_risk",
          `risks[${index}]`,
          "Risks must bind the exact universe and option revision; cross-cutting risks must use null option identity and evidence covering every active option.",
        ),
      );
    }
  }

  const sortedAdrs = [...adrRecord].sort((left, right) => left[1].revision - right[1].revision);
  const currentAdrs = adrRecord.filter(([, adr]) => adr.state === "current");
  for (const [position, [index, adr]] of sortedAdrs.entries()) {
    const prior = sortedAdrs[position - 1]?.[1];
    const optionRefs = referenceList(
      adr.optionRefs,
      optionIds,
      `adrRevisions[${index}].optionRefs`,
      findings,
    );
    const evidenceRefs = referenceList(
      adr.evidenceRefs,
      evidenceIds,
      `adrRevisions[${index}].evidenceRefs`,
      findings,
    );
    validateOptionBindings({
      bindings: adr.optionBindings,
      expectedOptionIds: optionRefs,
      optionsById,
      path: `adrRevisions[${index}].optionBindings`,
      findings,
    });
    const createdAt = time(adr.createdAt);
    const latestReferencedEvidence = Math.max(
      ...evidenceRefs
        .map((ref) => time(evidenceById.get(ref)?.assertedAt))
        .filter(Number.isFinite),
      Number.NEGATIVE_INFINITY,
    );
    if (
      adr.revision !== position + 1 ||
      adr.requirementsRevision !== workload.requirementsRevision ||
      adr.requirementUniverseDigest !== universe.contentDigest ||
      !sameSet(optionRefs, activeOptionIds) ||
      !principalHasScope(principalsById, adr.authorRef, "adr-authoring") ||
      createdAt === null ||
      createdAt < latestReferencedEvidence ||
      (prior && createdAt <= time(prior.createdAt)) ||
      adr.contentDigest !== computeArchitectureAdrDigest(adr)
    ) {
      findings.push(
        finding(
          "invalid_adr_chronology",
          `adrRevisions[${index}]`,
          "Every ADR must content-bind the exact universe/options and follow all evidence it references and every prior revision.",
        ),
      );
    }
    if (
      (position === 0 && adr.supersedesRef !== null) ||
      (position > 0 &&
        (adr.supersedesRef !== prior.id || prior.state !== "superseded")) ||
      (position === sortedAdrs.length - 1 && adr.state !== "current")
    ) {
      findings.push(
        finding(
          "invalid_adr_supersession",
          `adrRevisions[${index}]`,
          "Each ADR must supersede its immediate predecessor and only the final revision may be current.",
        ),
      );
    }
  }
  if (adrRecord.length > 0 && currentAdrs.length !== 1) {
    findings.push(
      finding(
        "invalid_adr_supersession",
        "adrRevisions",
        "An ADR ledger must have exactly one current revision.",
      ),
    );
  }

  const decision = isRecord(document.decision) ? document.decision : {};
  const decisionEvidence = referenceList(
    decision.evidenceRefs,
    evidenceIds,
    "decision.evidenceRefs",
    findings,
  );
  const residualRiskRefs = referenceList(
    decision.residualRiskRefs,
    riskIds,
    "decision.residualRiskRefs",
    findings,
  );
  const isReviewState = ["ready-for-owner-review", "recorded-owner-decision"].includes(
    decision.state,
  );
  const isRecorded = decision.state === "recorded-owner-decision";
  if (
    decision.requirementUniverseDigest !== universe.contentDigest ||
    decision.contentDigest !== computeArchitectureDecisionDigest(decision) ||
    !principalHasScope(
      principalsById,
      decision.ownerRef,
      "architecture-decision-authority",
    ) ||
    evidenceRecord.some(([, evidence]) => evidence.ownerRef === decision.ownerRef)
  ) {
    findings.push(
      finding(
        "invalid_decision_binding",
        "decision",
        "Every decision state requires exact universe/content digests and an independent accountable owner.",
      ),
    );
  }

  if (isReviewState) {
    if (!completeCoverage) {
      findings.push(
        finding(
          "incomplete_requirement_coverage",
          "coverage",
          "Owner review requires every active option to cover every declared requirement exactly once.",
        ),
      );
    }
    if (!completeTradeoffs) {
      findings.push(
        finding(
          "incomplete_tradeoff_comparison",
          "tradeoffs",
          "Owner review requires every active option to have one row for every shared criterion.",
        ),
      );
    }
    if (!comparableEvidence) {
      findings.push(
        finding(
          "incomparable_evidence",
          "tradeoffs",
          "Owner review requires each criterion to use one common evidence set with no unknown rating.",
        ),
      );
    }
    if (
      !sameSet(decisionEvidence, [...evidenceIds]) ||
      !allExperimentsCompleted ||
      currentAdrs.length !== 1
    ) {
      findings.push(
        finding(
          "premature_ready_state",
          "decision.state",
          "Owner review requires complete comparable evidence, completed experiments, and one current pre-decision or decision ADR.",
        ),
      );
    }
  }

  const currentAdr = currentAdrs[0]?.[1];
  const decisionReferencingAdrs = adrRecord.filter(
    ([, adr]) => adr.recordedDecisionRef !== null,
  );
  if (isRecorded) {
    const selectedOption = optionsById.get(decision.selectedOptionRef);
    const selectedRequiredIds = requirementRecord
      .filter(([, requirement]) => requirement.priority === "required")
      .map(([, requirement]) => requirement.id);
    const selectedCoverage = coverageRecord.filter(
      ([, coverage]) => coverage.optionRef === decision.selectedOptionRef,
    );
    const requiredCoverageSatisfied = selectedRequiredIds.every((requirementRef) =>
      selectedCoverage.some(
        ([, coverage]) =>
          coverage.requirementRef === requirementRef && coverage.state === "satisfies",
      ),
    );
    const expectedResidualRiskRefs = riskRecord
      .filter(
        ([, risk]) =>
          risk.state === "open" &&
          risk.residual === true &&
          (risk.scope === "cross-cutting" || risk.optionRef === decision.selectedOptionRef),
      )
      .map(([, risk]) => risk.id);
    const latestEvidence = Math.max(
      ...evidenceRecord
        .map(([, evidence]) => time(evidence.assertedAt))
        .filter(Number.isFinite),
      Number.NEGATIVE_INFINITY,
    );
    const latestExperimentCompletion = Math.max(
      ...experimentRecord
        .map(([, experiment]) => time(experiment.completedAt))
        .filter(Number.isFinite),
      Number.NEGATIVE_INFINITY,
    );
    const decidedAt = time(decision.decidedAt);
    if (
      !selectedOption ||
      decision.selectedOptionRevision !== selectedOption.revision ||
      decision.selectedOptionDigest !== selectedOption.contentDigest ||
      !requiredCoverageSatisfied ||
      !currentAdr ||
      decision.adrRevisionRef !== currentAdr.id ||
      decision.adrDigest !== currentAdr.contentDigest ||
      currentAdr.recordedDecisionRef !== decision.id ||
      decisionReferencingAdrs.length !== 1 ||
      decisionReferencingAdrs[0]?.[1] !== currentAdr ||
      decidedAt === null ||
      decidedAt < latestEvidence ||
      decidedAt < latestExperimentCompletion ||
      time(currentAdr.createdAt) < decidedAt
    ) {
      findings.push(
        finding(
          "premature_owner_decision",
          "decision",
          "A recorded owner decision requires exact selected-option and decision-ADR digests after all evidence and experiments.",
        ),
      );
    }
    if (
      decisionReferencingAdrs.length !== 1 ||
      decisionReferencingAdrs[0]?.[1] !== currentAdr ||
      currentAdr?.recordedDecisionRef !== decision.id ||
      time(currentAdr?.createdAt) < decidedAt
    ) {
      findings.push(
        finding(
          "invalid_decision_adr_binding",
          "adrRevisions",
          "Exactly one ADR may reference the recorded decision; it must be the current ADR and must be created no earlier than the owner decision.",
        ),
      );
    }
    if (!sameSet(residualRiskRefs, expectedResidualRiskRefs)) {
      findings.push(
        finding(
          "residual_risk_omitted",
          "decision.residualRiskRefs",
          "A recorded decision must carry every open selected-option and cross-cutting residual risk.",
        ),
      );
    }
  } else if (
    decision.selectedOptionRef !== null ||
    decision.selectedOptionRevision !== null ||
    decision.selectedOptionDigest !== null ||
    decision.decidedAt !== null ||
    decision.adrRevisionRef !== null ||
    decision.adrDigest !== null ||
    residualRiskRefs.length !== 0 ||
    adrRecord.some(([, adr]) => adr.recordedDecisionRef !== null)
  ) {
    findings.push(
      finding(
        "premature_owner_decision",
        "decision",
        "Planned, blocked, and ready-for-owner-review states cannot claim terminal selection, decision time, decision ADR, or accepted residual risks.",
      ),
    );
  }

  if (!isRecorded) {
    const preDecisionClaimPattern =
      /\b(?:the\s+)?owner\s+(?:selects?|selected|chooses?|chose|approved)\b|\b(?:chooses?|chose)\s+(?:the\s+)?(?:option|architecture|design|managed containers|serverless events)\b|\b(?:selected|chosen)\s+(?:option|architecture|design|managed containers|serverless events)\b|\b(?:option|architecture|design|managed containers|serverless events)\s+(?:was|were|is|are|has been|have been)\s+(?:selected|chosen)\b|\bowner\s+selection\s+(?:was|is|has been)\s+(?:made|recorded|approved|finalized)\b|\bchoice\s+(?:was|is|has been)\s+(?:made|recorded|confirmed|finalized)\b|\b(?:owner|[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s+(?:made|recorded|confirmed|finalized)\s+(?:an?\s+|the\s+)?(?:architecture\s+)?choice\b|\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}'s\s+(?:architecture\s+)?choice\s+(?:was|is|has been)\s+(?:the\s+)?(?:option|architecture|design|managed containers|serverless events)\b|\b(?:owner\s+)?decision\s+(?:was|is|has been)\s+(?:recorded|made|finalized|approved)\b|\brecorded\s+(?:owner\s+)?decision\b|\b(?:risk\s+acceptance|(?:residual\s+)?risks?)\s+(?:was|were|is|are|has been|have been)\s+(?:accepted|approved|recorded)\b|\b(?:accepted|accepts|accepting)\s+(?:the\s+)?(?:residual\s+)?risks?\b|\b(?:adr|architecture decision record)\b[^.!?]{0,80}\bsupersed(?:e|ed|es|ing)\b[^.!?]{0,80}\b(?:because of|after|following|due to)\b[^.!?]{0,40}\b(?:decision|selection|choice)\b|\b(?:decision|selection|choice)\b[^.!?]{0,40}\b(?:caused|triggered|resulted in)\b[^.!?]{0,60}\bsupersed(?:e|ed|es|ing)\b|\bdecision-caused\s+supersession\b/giu;
    for (const [path, narrative] of userVisibleNarratives(document)) {
      if (hasUnnegatedNarrativeMatch(narrative, preDecisionClaimPattern)) {
        findings.push(
          finding(
            "premature_decision_narrative",
            path,
            "Planned, blocked, and ready-for-owner-review narratives cannot claim owner selection, a recorded decision, risk acceptance, or decision-caused ADR supersession.",
          ),
        );
      }
    }
  }

  const handoff = isRecord(document.handoff) ? document.handoff : {};
  const prohibitedActions = stringList(
    handoff.prohibitedActions,
    "handoff.prohibitedActions",
    findings,
  );
  const handoffAt = time(handoff.generatedAt);
  const latestAdrAt = Math.max(
    ...adrRecord.map(([, adr]) => time(adr.createdAt)).filter(Number.isFinite),
    Number.NEGATIVE_INFINITY,
  );
  if (!sameSet(prohibitedActions, PROHIBITED_ACTIONS)) {
    findings.push(
      finding(
        "invalid_authority_boundary",
        "handoff.prohibitedActions",
        "The handoff must preserve every deployment, mutation, commitment, customer, certification, risk, and guarantee prohibition.",
      ),
    );
  }
  if (
    handoff.state !== decision.state ||
    handoff.ownerRef !== decision.ownerRef ||
    handoff.requirementUniverseDigest !== universe.contentDigest ||
    handoff.decisionDigest !== decision.contentDigest ||
    handoffAt === null ||
    handoffAt < attestedAt ||
    handoffAt < latestAdrAt
  ) {
    findings.push(
      finding(
        "premature_handoff",
        "handoff",
        "The handoff must content-bind and follow the exact decision state, requirement universe, and latest ADR.",
      ),
    );
  }

  if (
    /\b(?:the\s+)?(?:advisor|claw|agent|assistant|we|i)\s+(?:deployed|mutated|configured|selected customers?|committed to (?:a )?(?:product|vendor)|certified|accepted (?:the )?risk|guaranteed)\b/iu.test(
      JSON.stringify(document),
    )
  ) {
    findings.push(
      finding(
        "prohibited_architecture_authority_claim",
        "handoff.summary",
        "Narrative cannot claim deployment, mutation, customer selection, vendor commitment, certification, risk acceptance, or guarantees by the advisor.",
      ),
    );
  }

  if (isRecorded && findings.length > 0) {
    if (!findings.some((item) => item.code === "premature_owner_decision")) {
      findings.push(
        finding(
          "premature_owner_decision",
          "decision.state",
          "Any identity, digest, coverage, evidence, authority, chronology, experiment, ADR, or residual-risk finding blocks a recorded owner decision.",
        ),
      );
    }
  } else if (decision.state === "ready-for-owner-review" && findings.length > 0) {
    if (!findings.some((item) => item.code === "premature_ready_state")) {
      findings.push(
        finding(
          "premature_ready_state",
          "decision.state",
          "Any identity, digest, coverage, evidence, authority, chronology, experiment, or ADR finding blocks owner-review readiness.",
        ),
      );
    }
  }
  return findings;
}
