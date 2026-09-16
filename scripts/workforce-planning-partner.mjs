import { createHash } from "node:crypto";
import { hasUnnegatedNarrativeMatch } from "./narrative-authority.mjs";

export const WORKFORCE_PROHIBITED_ACTIONS = Object.freeze([
  "hire",
  "terminate",
  "evaluate-candidate",
  "infer-individual-performance",
  "promote",
  "set-compensation",
  "reorganize",
  "infer-sensitive-trait",
  "mutate-hr-system",
  "communicate-with-employee",
  "approve-headcount",
  "represent-scenario-as-approved",
]);

const PRIVACY_RANK = new Map([
  ["aggregate", 0],
  ["approved-role-level", 1],
]);

const WORKFORCE_AUTHORITY_NARRATIVE =
  /\b(?:hired|onboarded|extended\s+(?:an?\s+)?offer|terminated|fired|laid\s+off|dismissed|evaluated|screened|ranked|scored)\s+(?:(?:an?|the)\s+)?(?:candidate|applicant|employee|worker|person)?|\b(?:rated|calibrated)\s+(?:(?:an?|the)\s+)?(?:employee|worker|individual|person)|\bpromot(?:ed|ing)|\b(?:set|changed|adjusted|approved|authorized|increased|decreased|raised|lowered|reduced|cut)\s+(?:(?:the|an?)\s+)?(?:employee\s+)?(?:salary|salaries|pay|compensation|bonus|bonuses|equity)|\b(?:reorganized|restructured|realigned)\s+(?:(?:the|an?)\s+)?(?:organization|org|team|workforce)|\b(?:inferred|derived|predicted)\s+(?:(?:a|the)\s+)?(?:sensitive|protected)\s+(?:trait|attribute)|\b(?:updated|changed|mutated|wrote\s+to)\s+(?:(?:the|an?)\s+)?(?:hris|hr\s+system|human\s+resources\s+system|employee\s+record)|\b(?:emailed|messaged|notified|informed|contacted|announced\s+to|communicated\s+with)\s+(?:(?:the|an?)\s+)?(?:employee|employees|staff|workforce|worker|workers)|\b(?:employee|employees|staff|workforce|worker|workers)\s+(?:(?:was|were|have\s+been|has\s+been)\s+)?(?:emailed|messaged|notified|informed|contacted)|\b(?:approve(?:d)?|authorize(?:d)?|signed\s+off\s+on|greenlit)\s+(?:(?:the|an?)\s+)?(?:headcount|position|positions|workforce\s+plan|staffing\s+plan)|\b(?:scenario|projection|forecast)\s+(?:is|was|became|has\s+been)\s+(?:approved|authorized|final)\b/giu;

const ENGLISH_NUMBER_WORD =
  "(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion|quadrillion|quintillion|sextillion|septillion|octillion|nonillion|decillion|and|point)";
const QUANTIFIED_POSITION_AUTHORIZATION_NARRATIVE = new RegExp(
  String.raw`\b(?:approve(?:d)?|authorize(?:d)?|signed\s+off\s+on|greenlit)\s+(?:(?:the|an?)\s+)?(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|${ENGLISH_NUMBER_WORD}(?:[-\s]+${ENGLISH_NUMBER_WORD})*)\s+positions?\b`,
  "giu",
);

function finding(code, path, message) {
  return { code, path, message };
}

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

function rows(value, field, findings = []) {
  if (!Array.isArray(value?.[field])) {
    findings.push(finding("invalid_record_list", field, `${field} must be an array.`));
    return [];
  }
  return value[field].filter((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      findings.push(
        finding("invalid_record", `${field}[${index}]`, `${field} entries must be records.`),
      );
      return false;
    }
    return true;
  });
}

function idIndex(records, field, findings = []) {
  const index = new Map();
  records.forEach((record, position) => {
    if (typeof record.id !== "string" || record.id.length === 0) {
      findings.push(finding("missing_id", `${field}[${position}].id`, "A stable id is required."));
    } else if (index.has(record.id)) {
      findings.push(
        finding("duplicate_id", `${field}[${position}].id`, `Duplicate id ${record.id}.`),
      );
    } else {
      index.set(record.id, record);
    }
  });
  return index;
}

function sameSet(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((item) => new Set(right).has(item))
  );
}

function numbersEqual(left, right) {
  return (
    typeof left === "number" &&
    typeof right === "number" &&
    Number.isFinite(left) &&
    Number.isFinite(right) &&
    Math.abs(left - right) <= 1e-8 * Math.max(1, Math.abs(left), Math.abs(right))
  );
}

function rounded(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function planBound(record, plan) {
  return (
    record?.planId === plan?.id &&
    record?.planRevision === plan?.revision &&
    record?.organizationRef === plan?.organizationRef
  );
}

function refsFor(record) {
  return Array.isArray(record?.evidenceRefs) ? record.evidenceRefs : [];
}

function increment(counts, refs) {
  if (!Array.isArray(refs)) return;
  for (const ref of refs) counts.set(ref, (counts.get(ref) ?? 0) + 1);
}

function requireKnownRefs(refs, known, path, findings) {
  if (!Array.isArray(refs)) {
    findings.push(finding("invalid_reference_list", path, `${path} must be an array.`));
    return;
  }
  if (new Set(refs).size !== refs.length) {
    findings.push(finding("duplicate_reference", path, `${path} must not repeat references.`));
  }
  refs.forEach((ref, index) => {
    if (!known.has(ref)) {
      findings.push(
        finding("dangling_reference", `${path}[${index}]`, `Reference ${ref} does not resolve.`),
      );
    }
  });
}

function periodBounds(period) {
  const match = /^(\d{4})-Q([1-4])$/u.exec(period ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const quarter = Number(match[2]);
  const firstMonth = (quarter - 1) * 3;
  return {
    start: Date.UTC(year, firstMonth, 1),
    end: Date.UTC(year, firstMonth + 3, 0, 23, 59, 59, 999),
  };
}

function recordLedgerEntries(value, { includeEvidence = true } = {}) {
  const collections = [
    ["principals", value.principals],
    ["organizations", value.organizations],
    ["roles", value.roles],
    ["locations", value.locations],
    ["roleDemand", value.roleDemand],
    ["funding", value.funding],
    ["fundedPositions", value.fundedPositions],
    ["reconciliations", value.reconciliations],
    ["scenarios", value.scenarios],
    ["capabilityGaps", value.capabilityGaps],
    ["successionCoverage", value.successionCoverage],
    ["locationConstraints", value.locationConstraints],
    ["ownerActions", value.ownerActions],
    ["decisionCheckpoints", value.decisionCheckpoints],
    ["authorityAttestations", value.authorityAttestations],
    ...(includeEvidence ? [["evidence", value.evidence]] : []),
  ];
  const entries = [];
  if (value.plan?.id) entries.push({ path: "plan", row: value.plan });
  if (value.authorityRoster?.id) {
    entries.push({ path: "authorityRoster", row: value.authorityRoster });
  }
  for (const [field, collection] of collections) {
    if (!Array.isArray(collection)) continue;
    collection.forEach((row, index) => {
      if (row?.id) entries.push({ path: `${field}[${index}]`, row });
    });
  }
  for (const [scenarioIndex, scenario] of (value.scenarios ?? []).entries()) {
    for (const field of ["assumptions", "projections"]) {
      for (const [index, row] of (scenario?.[field] ?? []).entries()) {
        if (row?.id) {
          entries.push({
            path: `scenarios[${scenarioIndex}].${field}[${index}]`,
            row,
          });
        }
      }
    }
  }
  return entries;
}

function recordInventory(value) {
  const records = new Map();
  for (const { row } of recordLedgerEntries(value, { includeEvidence: false })) {
    records.set(row.id, row);
  }
  return records;
}

export function computeWorkforceAuthorityRosterDigest(value) {
  const roster = value.authorityRoster ?? {};
  const principalById = new Map((value.principals ?? []).map((row) => [row.id, row]));
  const principals = (roster.principalRefs ?? [])
    .map((ref) => principalById.get(ref))
    .filter(Boolean)
    .toSorted((left, right) => left.id.localeCompare(right.id));
  return digest({
    id: roster.id,
    planId: roster.planId,
    planRevision: roster.planRevision,
    organizationRef: roster.organizationRef,
    custodianRef: roster.custodianRef,
    evidenceRef: roster.evidenceRef,
    principals,
  });
}

export function computeWorkforceEvidencePayloadDigest(value, evidence) {
  const inventory = recordInventory(value);
  if (!Array.isArray(evidence?.subjectRefs) || evidence.subjectRefs.length === 0) return null;
  const subjects = evidence.subjectRefs.map((ref) => inventory.get(ref));
  if (subjects.some((subject) => subject === undefined)) return null;
  return digest({
    planId: evidence.planId,
    planRevision: evidence.planRevision,
    organizationRef: evidence.organizationRef,
    kind: evidence.kind,
    subjects: subjects.toSorted((left, right) => left.id.localeCompare(right.id)),
  });
}

export function computeWorkforceEvidenceRecordDigest(evidence) {
  const sourceBase =
    typeof evidence?.sourceRef === "string" ? evidence.sourceRef.replace(/@sha256-[a-f0-9]{64}$/u, "") : null;
  return digest({
    id: evidence?.id,
    planId: evidence?.planId,
    planRevision: evidence?.planRevision,
    organizationRef: evidence?.organizationRef,
    kind: evidence?.kind,
    sourceBase,
    effectiveAt: evidence?.effectiveAt,
    privacyClassification: evidence?.privacyClassification,
    approvedByRef: evidence?.approvedByRef,
    subjectRefs: evidence?.subjectRefs,
    payloadDigest: evidence?.payloadDigest,
  });
}

export function contentAddressedWorkforceEvidenceRef(evidence) {
  const sourceBase =
    typeof evidence?.sourceRef === "string" ? evidence.sourceRef.replace(/@sha256-[a-f0-9]{64}$/u, "") : "";
  const recordDigest = computeWorkforceEvidenceRecordDigest(evidence);
  return `${sourceBase}@sha256-${recordDigest.slice("sha256:".length)}`;
}

export function sealWorkforceEvidence(value) {
  value.authorityRoster.rosterDigest = computeWorkforceAuthorityRosterDigest(value);
  for (const evidence of value.evidence) {
    evidence.payloadDigest = computeWorkforceEvidencePayloadDigest(value, evidence);
    evidence.recordDigest = computeWorkforceEvidenceRecordDigest(evidence);
    evidence.sourceRef = contentAddressedWorkforceEvidenceRef(evidence);
  }
  return value;
}

function humanWithScope(principalById, rosterRefs, ref, scope) {
  const principal = principalById.get(ref);
  return (
    rosterRefs.has(ref) &&
    principal?.kind === "human" &&
    Array.isArray(principal.scopes) &&
    principal.scopes.includes(scope)
  );
}

export function workforcePlanningFindings(value) {
  const findings = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [finding("invalid_artifact", "$", "Workforce reconciliation must be an object.")];
  }

  const collectionNames = [
    "principals",
    "organizations",
    "roles",
    "locations",
    "roleDemand",
    "funding",
    "fundedPositions",
    "reconciliations",
    "scenarios",
    "capabilityGaps",
    "successionCoverage",
    "locationConstraints",
    "ownerActions",
    "decisionCheckpoints",
    "authorityAttestations",
    "evidence",
  ];
  const collections = Object.fromEntries(
    collectionNames.map((field) => [field, rows(value, field, findings)]),
  );
  const indexes = Object.fromEntries(
    collectionNames.map((field) => [
      field,
      idIndex(collections[field], field, findings),
    ]),
  );
  const globalIdPaths = new Map();
  for (const { path, row } of recordLedgerEntries(value)) {
    const firstPath = globalIdPaths.get(row.id);
    if (firstPath) {
      findings.push(
        finding(
          "global_id_collision",
          `${path}.id`,
          `Record id ${row.id} collides with ${firstPath}; ids must be globally unique across all top-level and nested ledgers.`,
        ),
      );
    } else {
      globalIdPaths.set(row.id, path);
    }
  }
  const plan = value.plan ?? {};
  const roster = value.authorityRoster ?? {};
  const principalById = indexes.principals;
  const rosterRefs = new Set(Array.isArray(roster.principalRefs) ? roster.principalRefs : []);

  if (!indexes.organizations.has(plan.organizationRef)) {
    findings.push(
      finding(
        "dangling_reference",
        "plan.organizationRef",
        "The plan organization must resolve in organizations.",
      ),
    );
  }
  const horizonStart = Date.parse(`${plan.horizonStart}T00:00:00Z`);
  const horizonEnd = Date.parse(`${plan.horizonEnd}T23:59:59.999Z`);
  if (!Number.isFinite(horizonStart) || !Number.isFinite(horizonEnd) || horizonStart > horizonEnd) {
    findings.push(
      finding(
        "invalid_plan_horizon",
        "plan",
        "The plan horizon must contain parseable dates with horizonStart no later than horizonEnd.",
      ),
    );
  }

  const planScoped = [
    ["principals", collections.principals],
    ["organizations", collections.organizations],
    ["roles", collections.roles],
    ["locations", collections.locations],
    ["roleDemand", collections.roleDemand],
    ["funding", collections.funding],
    ["fundedPositions", collections.fundedPositions],
    ["reconciliations", collections.reconciliations],
    ["scenarios", collections.scenarios],
    ["capabilityGaps", collections.capabilityGaps],
    ["successionCoverage", collections.successionCoverage],
    ["locationConstraints", collections.locationConstraints],
    ["ownerActions", collections.ownerActions],
    ["decisionCheckpoints", collections.decisionCheckpoints],
    ["authorityAttestations", collections.authorityAttestations],
    ["evidence", collections.evidence],
    ["handoff", [value.handoff ?? {}]],
    ["authorityRoster", [roster]],
  ];
  for (const [field, records] of planScoped) {
    records.forEach((record, index) => {
      if (!planBound(record, plan)) {
        findings.push(
          finding(
            "plan_scope_mismatch",
            field === "handoff" || field === "authorityRoster" ? field : `${field}[${index}]`,
            "Every plan-scoped row must bind the exact plan organization, id, and revision.",
          ),
        );
      }
    });
  }

  const periodScoped = [
    ["roleDemand", collections.roleDemand],
    ["funding", collections.funding],
    ["fundedPositions", collections.fundedPositions],
    ["reconciliations", collections.reconciliations],
    ["scenarios", collections.scenarios],
    ["capabilityGaps", collections.capabilityGaps],
    ["successionCoverage", collections.successionCoverage],
    ["locationConstraints", collections.locationConstraints],
    ["ownerActions", collections.ownerActions],
    ["decisionCheckpoints", collections.decisionCheckpoints],
  ];
  for (const scenario of collections.scenarios) {
    periodScoped.push(
      [`scenarios.${scenario.id}.assumptions`, scenario.assumptions ?? []],
      [`scenarios.${scenario.id}.projections`, scenario.projections ?? []],
    );
  }
  for (const [field, records] of periodScoped) {
    records.forEach((record, index) => {
      if (!planBound(record, plan)) {
        findings.push(
          finding(
            "plan_scope_mismatch",
            `${field}[${index}]`,
            "Nested plan rows must bind the exact plan organization, id, and revision.",
          ),
        );
      }
      const bounds = periodBounds(record.period);
      if (
        !bounds ||
        !Number.isFinite(horizonStart) ||
        !Number.isFinite(horizonEnd) ||
        bounds.start < horizonStart ||
        bounds.end > horizonEnd
      ) {
        findings.push(
          finding(
            "period_outside_plan_horizon",
            `${field}[${index}].period`,
            "Every record period must fit wholly inside the approved plan horizon.",
          ),
        );
      }
    });
  }

  requireKnownRefs(roster.principalRefs, principalById, "authorityRoster.principalRefs", findings);
  if (plan.authorityRosterRef !== roster.id) {
    findings.push(
      finding(
        "authority_roster_mismatch",
        "plan.authorityRosterRef",
        "The plan must bind the exact supplied authority roster.",
      ),
    );
  }
  if (roster.rosterDigest !== computeWorkforceAuthorityRosterDigest(value)) {
    findings.push(
      finding(
        "authority_roster_digest_mismatch",
        "authorityRoster.rosterDigest",
        "The authority roster digest must bind every typed principal and scope.",
      ),
    );
  }
  if (!humanWithScope(principalById, rosterRefs, roster.custodianRef, "authority-roster-custodian")) {
    findings.push(
      finding(
        "invalid_authority_principal",
        "authorityRoster.custodianRef",
        "The roster custodian must be a rostered human with authority-roster-custodian scope.",
      ),
    );
  }
  if (!humanWithScope(principalById, rosterRefs, plan.ownerRef, "plan-owner")) {
    findings.push(
      finding(
        "invalid_authority_principal",
        "plan.ownerRef",
        "The plan owner must be a rostered human with plan-owner scope.",
      ),
    );
  }
  if (!humanWithScope(principalById, rosterRefs, plan.approvedByRef, "plan-approver")) {
    findings.push(
      finding(
        "invalid_authority_principal",
        "plan.approvedByRef",
        "The plan approver must be a rostered human with plan-approver scope.",
      ),
    );
  }

  const inventory = recordInventory(value);
  const asOf = Date.parse(value.asOf);
  for (const [index, evidence] of collections.evidence.entries()) {
    const path = `evidence[${index}]`;
    if (
      !humanWithScope(principalById, rosterRefs, evidence.approvedByRef, "evidence-approver")
    ) {
      findings.push(
        finding(
          "invalid_authority_principal",
          `${path}.approvedByRef`,
          "Evidence approvers must be rostered humans with evidence-approver scope.",
        ),
      );
    }
    const effectiveAt = Date.parse(evidence.effectiveAt);
    if (!Number.isFinite(effectiveAt) || !Number.isFinite(asOf) || effectiveAt > asOf) {
      findings.push(
        finding(
          "invalid_evidence_chronology",
          `${path}.effectiveAt`,
          "Evidence must be effective no later than the reconciliation cutoff.",
        ),
      );
    }
    if (
      !PRIVACY_RANK.has(evidence.privacyClassification) ||
      !PRIVACY_RANK.has(value.privacyClassification) ||
      PRIVACY_RANK.get(evidence.privacyClassification) >
        PRIVACY_RANK.get(value.privacyClassification)
    ) {
      findings.push(
        finding(
          "privacy_scope_exceeded",
          `${path}.privacyClassification`,
          "Evidence cannot exceed the approved artifact privacy classification.",
        ),
      );
    }
    requireKnownRefs(evidence.subjectRefs, inventory, `${path}.subjectRefs`, findings);
    const payloadDigest = computeWorkforceEvidencePayloadDigest(value, evidence);
    if (!payloadDigest || evidence.payloadDigest !== payloadDigest) {
      findings.push(
        finding(
          "evidence_payload_digest_mismatch",
          `${path}.payloadDigest`,
          "Evidence payload digest must bind the exact plan, revision, organization, kind, and subject payload.",
        ),
      );
    }
    const recordDigest = computeWorkforceEvidenceRecordDigest(evidence);
    if (evidence.recordDigest !== recordDigest) {
      findings.push(
        finding(
          "evidence_record_digest_mismatch",
          `${path}.recordDigest`,
          "Evidence record digest must bind the exact immutable evidence envelope.",
        ),
      );
    }
    if (evidence.sourceRef !== contentAddressedWorkforceEvidenceRef(evidence)) {
      findings.push(
        finding(
          "mutable_evidence_reference",
          `${path}.sourceRef`,
          "Evidence source references must be content-addressed by the exact record digest.",
        ),
      );
    }
  }

  const approvalEvidence = indexes.evidence.get(plan.approvalEvidenceRef);
  const rosterEvidence = indexes.evidence.get(roster.evidenceRef);
  if (
    rosterEvidence?.kind !== "authority-roster" ||
    rosterEvidence.approvedByRef !== roster.custodianRef ||
    !sameSet(rosterEvidence.subjectRefs, [roster.id, ...roster.principalRefs])
  ) {
    findings.push(
      finding(
        "unbound_authority_roster",
        "authorityRoster.evidenceRef",
        "The authority roster must bind every listed principal through exact custodian-approved evidence.",
      ),
    );
  }
  if (
    approvalEvidence?.kind !== "organization-plan-approval" ||
    approvalEvidence.approvedByRef !== plan.approvedByRef ||
    !sameSet(approvalEvidence.subjectRefs, [plan.id, roster.id])
  ) {
    findings.push(
      finding(
        "unbound_plan_approval",
        "plan.approvalEvidenceRef",
        "Plan approval evidence must bind the exact plan and authority roster and use the exact plan approver.",
      ),
    );
  }

  function validateEvidenceBindings(records, field, expectedKinds) {
    records.forEach((record, index) => {
      if (refsFor(record).length === 0) {
        findings.push(
          finding(
            "missing_evidence",
            `${field}[${index}].evidenceRefs`,
            "At least one exact controlled evidence reference is required.",
          ),
        );
      }
      for (const ref of refsFor(record)) {
        const evidence = indexes.evidence.get(ref);
        if (
          !evidence ||
          !expectedKinds.includes(evidence.kind) ||
          !evidence.subjectRefs?.includes(record.id)
        ) {
          findings.push(
            finding(
              "unbound_evidence",
              `${field}[${index}].evidenceRefs`,
              `Evidence must bind the exact row with one of: ${expectedKinds.join(", ")}.`,
            ),
          );
        }
      }
    });
  }
  validateEvidenceBindings(collections.roleDemand, "roleDemand", ["role-demand"]);
  validateEvidenceBindings(collections.funding, "funding", ["funding-approval"]);
  validateEvidenceBindings(collections.fundedPositions, "fundedPositions", ["position-snapshot"]);
  validateEvidenceBindings(collections.capabilityGaps, "capabilityGaps", ["capability-aggregate"]);
  validateEvidenceBindings(collections.successionCoverage, "successionCoverage", [
    "succession-aggregate",
  ]);
  validateEvidenceBindings(collections.locationConstraints, "locationConstraints", [
    "location-policy",
  ]);
  validateEvidenceBindings(collections.authorityAttestations, "authorityAttestations", [
    "authority-attestation",
  ]);

  for (const [index, demand] of collections.roleDemand.entries()) {
    if (!indexes.roles.has(demand.roleRef)) {
      findings.push(
        finding("dangling_reference", `roleDemand[${index}].roleRef`, "Demand role must resolve."),
      );
    }
    requireKnownRefs(
      demand.locationRefs,
      indexes.locations,
      `roleDemand[${index}].locationRefs`,
      findings,
    );
  }

  const positionTotalsByFunding = new Map();
  for (const [index, position] of collections.fundedPositions.entries()) {
    const funding = indexes.funding.get(position.fundingRef);
    if (!indexes.roles.has(position.roleRef) || !indexes.locations.has(position.locationRef) || !funding) {
      findings.push(
        finding(
          "dangling_reference",
          `fundedPositions[${index}]`,
          "Position role, location, and funding references must resolve.",
        ),
      );
      continue;
    }
    if (
      funding.roleRef !== position.roleRef ||
      funding.period !== position.period ||
      !planBound(funding, plan)
    ) {
      findings.push(
        finding(
          "funding_scope_mismatch",
          `fundedPositions[${index}].fundingRef`,
          "Position funding must match the exact plan, organization, revision, role, and period.",
        ),
      );
    }
    positionTotalsByFunding.set(
      position.fundingRef,
      (positionTotalsByFunding.get(position.fundingRef) ?? 0) + position.fundedFte,
    );
  }
  collections.funding.forEach((funding, index) => {
    if (!numbersEqual(positionTotalsByFunding.get(funding.id) ?? 0, funding.fundedFte)) {
      findings.push(
        finding(
          "funded_headcount_mismatch",
          `funding[${index}].fundedFte`,
          "Funding FTE must equal the exact funded position pools that consume it.",
        ),
      );
    }
  });

  const demandUse = new Map();
  const fundingUse = new Map();
  const positionUse = new Map();
  for (const [index, reconciliation] of collections.reconciliations.entries()) {
    const demand = indexes.roleDemand.get(reconciliation.demandRef);
    increment(demandUse, [reconciliation.demandRef]);
    increment(fundingUse, reconciliation.fundingRefs);
    increment(positionUse, reconciliation.positionRefs);
    requireKnownRefs(
      reconciliation.fundingRefs,
      indexes.funding,
      `reconciliations[${index}].fundingRefs`,
      findings,
    );
    requireKnownRefs(
      reconciliation.positionRefs,
      indexes.fundedPositions,
      `reconciliations[${index}].positionRefs`,
      findings,
    );
    const fundingRows = (reconciliation.fundingRefs ?? [])
      .map((ref) => indexes.funding.get(ref))
      .filter(Boolean);
    const positionRows = (reconciliation.positionRefs ?? [])
      .map((ref) => indexes.fundedPositions.get(ref))
      .filter(Boolean);
    const exactScope = [...fundingRows, ...positionRows].every(
      (row) =>
        demand &&
        row.roleRef === demand.roleRef &&
        row.period === demand.period &&
        planBound(row, plan),
    );
    const everyPositionFundingConsumed = positionRows.every((position) =>
      reconciliation.fundingRefs?.includes(position.fundingRef),
    );
    const everyPositionLocationAllowed = positionRows.every((position) =>
      demand?.locationRefs?.includes(position.locationRef),
    );
    const fundedFte = fundingRows.reduce((total, row) => total + row.fundedFte, 0);
    const positionedFte = positionRows.reduce((total, row) => total + row.fundedFte, 0);
    if (
      !demand ||
      reconciliation.roleRef !== undefined ||
      reconciliation.period !== demand.period ||
      !exactScope ||
      !everyPositionFundingConsumed ||
      !everyPositionLocationAllowed ||
      !numbersEqual(reconciliation.approvedDemandFte, demand.requiredFte) ||
      !numbersEqual(reconciliation.fundedFte, fundedFte) ||
      !numbersEqual(reconciliation.fundedFte, positionedFte) ||
      !numbersEqual(reconciliation.baselineGapFte, rounded(demand.requiredFte - fundedFte))
    ) {
      findings.push(
        finding(
          "invalid_workforce_reconciliation",
          `reconciliations[${index}]`,
          "Demand, funding, positions, allowed locations, and gaps must reconcile exactly.",
        ),
      );
    }
  }
  for (const [field, records, use] of [
    ["roleDemand", collections.roleDemand, demandUse],
    ["funding", collections.funding, fundingUse],
    ["fundedPositions", collections.fundedPositions, positionUse],
  ]) {
    records.forEach((record) => {
      if (use.get(record.id) !== 1) {
        findings.push(
          finding(
            "incomplete_workforce_reconciliation",
            field,
            `Every ${field} row must be consumed by exactly one reconciliation.`,
          ),
        );
      }
    });
  }

  for (const [scenarioIndex, scenario] of collections.scenarios.entries()) {
    const assumptions = Array.isArray(scenario.assumptions) ? scenario.assumptions : [];
    const projections = Array.isArray(scenario.projections) ? scenario.projections : [];
    const assumptionById = idIndex(
      assumptions,
      `scenarios[${scenarioIndex}].assumptions`,
      findings,
    );
    const assumptionDemandRefs = [];
    assumptions.forEach((assumption, assumptionIndex) => {
      assumptionDemandRefs.push(assumption.demandRef);
      const demand = indexes.roleDemand.get(assumption.demandRef);
      if (
        !demand ||
        assumption.period !== demand.period ||
        !planBound(assumption, plan)
      ) {
        findings.push(
          finding(
            "invalid_scenario_binding",
            `scenarios[${scenarioIndex}].assumptions[${assumptionIndex}]`,
            "Scenario assumptions must bind exact approved demand and plan scope.",
          ),
        );
      }
      for (const ref of refsFor(assumption)) {
        const evidence = indexes.evidence.get(ref);
        if (
          evidence?.kind !== "scenario-assumption" ||
          !evidence.subjectRefs?.includes(assumption.id)
        ) {
          findings.push(
            finding(
              "unbound_scenario_assumption",
              `scenarios[${scenarioIndex}].assumptions[${assumptionIndex}].evidenceRefs`,
              "Scenario assumptions require exact content-addressed assumption evidence.",
            ),
          );
        }
      }
    });
    if (!sameSet(assumptionDemandRefs, [...indexes.roleDemand.keys()])) {
      findings.push(
        finding(
          "incomplete_scenario",
          `scenarios[${scenarioIndex}].assumptions`,
          "Every scenario must cover every approved demand line exactly once.",
        ),
      );
    }
    const projectionAssumptionRefs = [];
    projections.forEach((projection, projectionIndex) => {
      projectionAssumptionRefs.push(projection.assumptionRef);
      const assumption = assumptionById.get(projection.assumptionRef);
      const demand = indexes.roleDemand.get(projection.demandRef);
      const expectedEnding = rounded(
        assumption?.startingFte * (1 - assumption?.aggregateAttritionRate) +
          assumption?.aggregateHiringFte,
      );
      const expectedGap = rounded(demand?.requiredFte - expectedEnding);
      if (
        !assumption ||
        !demand ||
        assumption.demandRef !== projection.demandRef ||
        projection.period !== demand.period ||
        !planBound(projection, plan) ||
        !numbersEqual(projection.projectedEndingFte, expectedEnding) ||
        !numbersEqual(projection.gapFte, expectedGap)
      ) {
        findings.push(
          finding(
            "scenario_projection_mismatch",
            `scenarios[${scenarioIndex}].projections[${projectionIndex}]`,
            "Scenario projections must bind and recalculate from the exact aggregate assumption and demand.",
          ),
        );
      }
    });
    if (!sameSet(projectionAssumptionRefs, [...assumptionById.keys()])) {
      findings.push(
        finding(
          "incomplete_scenario",
          `scenarios[${scenarioIndex}].projections`,
          "Every scenario assumption must have exactly one projection.",
        ),
      );
    }
  }

  function validateDemandCoverage(records, field, evidenceKind, gapFor) {
    records.forEach((record, index) => {
      const demand = indexes.roleDemand.get(record.demandRef);
      if (
        !demand ||
        record.roleRef !== demand.roleRef ||
        record.period !== demand.period ||
        !planBound(record, plan) ||
        !numbersEqual(record.gapFte ?? record.gapCount, gapFor(record))
      ) {
        findings.push(
          finding(
            "invalid_gap_reconciliation",
            `${field}[${index}]`,
            `${field} must bind exact demand and reconcile its gap.`,
          ),
        );
      }
      for (const ref of refsFor(record)) {
        const evidence = indexes.evidence.get(ref);
        if (evidence?.kind !== evidenceKind || !evidence.subjectRefs?.includes(record.id)) {
          findings.push(
            finding(
              "unbound_evidence",
              `${field}[${index}].evidenceRefs`,
              `${field} requires exact ${evidenceKind} evidence.`,
            ),
          );
        }
      }
      return demand;
    });
  }
  validateDemandCoverage(
    collections.capabilityGaps,
    "capabilityGaps",
    "capability-aggregate",
    (record) => rounded(record.requiredFte - record.availableFte),
  );
  collections.capabilityGaps.forEach((record, index) => {
    const role = indexes.roles.get(record.roleRef);
    if (!role?.capabilityRefs?.includes(record.capabilityRef)) {
      findings.push(
        finding(
          "capability_taxonomy_mismatch",
          `capabilityGaps[${index}].capabilityRef`,
          "Capability gaps must use a capability declared by the exact bound role.",
        ),
      );
    }
  });
  validateDemandCoverage(
    collections.successionCoverage,
    "successionCoverage",
    "succession-aggregate",
    (record) => record.criticalRoleCount - record.coveredRoleCount,
  );
  collections.successionCoverage.forEach((record, index) => {
    requireKnownRefs(
      record.criticalRoleEvidenceRefs,
      indexes.evidence,
      `successionCoverage[${index}].criticalRoleEvidenceRefs`,
      findings,
    );
    const valid = record.criticalRoleEvidenceRefs?.every((ref) => {
      const evidence = indexes.evidence.get(ref);
      return (
        evidence?.kind === "critical-role-approval" &&
        evidence.subjectRefs?.includes(record.id) &&
        humanWithScope(
          principalById,
          rosterRefs,
          evidence.approvedByRef,
          "critical-role-approver",
        )
      );
    });
    if (!valid) {
      findings.push(
        finding(
          "unapproved_critical_role_evidence",
          `successionCoverage[${index}].criticalRoleEvidenceRefs`,
          "Succession critical-role counts require exact approved critical-role evidence.",
        ),
      );
    }
  });
  validateDemandCoverage(
    collections.locationConstraints,
    "locationConstraints",
    "location-policy",
    (record) => rounded(record.demandFte - record.fundedFte),
  );
  const locationsByDemand = new Map();
  collections.locationConstraints.forEach((record, index) => {
    const demand = indexes.roleDemand.get(record.demandRef);
    if (
      !indexes.locations.has(record.locationRef) ||
      !demand?.locationRefs?.includes(record.locationRef)
    ) {
      findings.push(
        finding(
          "disallowed_demand_location",
          `locationConstraints[${index}].locationRef`,
          "Location allocation must use a location allowed by the exact bound demand.",
        ),
      );
    }
    const matchingFundedFte = collections.fundedPositions
      .filter(
        (position) =>
          position.roleRef === record.roleRef &&
          position.locationRef === record.locationRef &&
          position.period === record.period &&
          planBound(position, plan),
      )
      .reduce((total, position) => total + position.fundedFte, 0);
    if (!numbersEqual(record.fundedFte, matchingFundedFte)) {
      findings.push(
        finding(
          "location_funding_mismatch",
          `locationConstraints[${index}].fundedFte`,
          "Location funded FTE must equal exact funded position pools.",
        ),
      );
    }
    const expectedState = record.gapFte > 0 ? "constrained" : "within-constraint";
    if (record.state !== expectedState) {
      findings.push(
        finding(
          "invalid_location_state",
          `locationConstraints[${index}].state`,
          "Location state must reflect the exact location gap.",
        ),
      );
    }
    const entries = locationsByDemand.get(record.demandRef) ?? [];
    entries.push(record);
    locationsByDemand.set(record.demandRef, entries);
  });
  for (const demand of collections.roleDemand) {
    const allocations = locationsByDemand.get(demand.id) ?? [];
    const allocatedLocations = allocations.map((row) => row.locationRef);
    const allocatedDemand = allocations.reduce((total, row) => total + row.demandFte, 0);
    if (
      !sameSet(allocatedLocations, demand.locationRefs) ||
      !numbersEqual(allocatedDemand, demand.requiredFte)
    ) {
      findings.push(
        finding(
          "invalid_location_allocation",
          demand.id,
          "Each allowed location must appear exactly once and total location demand must equal approved demand.",
        ),
      );
    }
  }

  const targetById = new Map([
    ...indexes.reconciliations,
    ...indexes.scenarios,
    ...indexes.capabilityGaps,
    ...indexes.successionCoverage,
    ...indexes.locationConstraints,
  ]);
  for (const [field, records, scope] of [
    ["ownerActions", collections.ownerActions, "action-owner"],
    ["decisionCheckpoints", collections.decisionCheckpoints, "decision-owner"],
  ]) {
    records.forEach((record, index) => {
      if (!humanWithScope(principalById, rosterRefs, record.ownerRef, scope)) {
        findings.push(
          finding(
            "invalid_authority_principal",
            `${field}[${index}].ownerRef`,
            `${field} owners must be rostered humans with ${scope} scope.`,
          ),
        );
      }
      requireKnownRefs(record.targetRefs, targetById, `${field}[${index}].targetRefs`, findings);
    });
  }
  for (const scenarioId of indexes.scenarios.keys()) {
    if (!collections.decisionCheckpoints.some((row) => row.targetRefs?.includes(scenarioId))) {
      findings.push(
        finding(
          "unbound_scenario_decision",
          "decisionCheckpoints",
          `Scenario ${scenarioId} must remain bound to a named human decision checkpoint.`,
        ),
      );
    }
  }

  const attestationActions = collections.authorityAttestations.map((row) => row.action);
  for (const [index, attestation] of collections.authorityAttestations.entries()) {
    if (
      attestation.state !== "not-performed" ||
      !humanWithScope(
        principalById,
        rosterRefs,
        attestation.attestedByRef,
        "authority-attestor",
      ) ||
      Date.parse(attestation.attestedAt) > asOf
    ) {
      findings.push(
        finding(
          "invalid_authority_attestation",
          `authorityAttestations[${index}]`,
          "Each prohibited action requires a timely not-performed attestation from a rostered human authority attestor.",
        ),
      );
    }
  }
  if (!sameSet(attestationActions, WORKFORCE_PROHIBITED_ACTIONS)) {
    findings.push(
      finding(
        "incomplete_authority_attestations",
        "authorityAttestations",
        "Every prohibited workforce action must have exactly one structured attestation.",
      ),
    );
  }

  const materialBlockers = [
    ...collections.reconciliations
      .filter((record) => record.baselineGapFte > 0)
      .map((record) => record.id),
    ...collections.capabilityGaps.filter((record) => record.gapFte > 0).map((record) => record.id),
    ...collections.successionCoverage.filter((record) => record.gapCount > 0).map((record) => record.id),
    ...collections.locationConstraints.filter((record) => record.gapFte > 0).map((record) => record.id),
  ];
  for (const blockerRef of materialBlockers) {
    if (
      !collections.ownerActions.some((row) => row.targetRefs?.includes(blockerRef)) &&
      !collections.decisionCheckpoints.some((row) => row.targetRefs?.includes(blockerRef))
    ) {
      findings.push(
        finding(
          "unowned_material_gap",
          blockerRef,
          "Every material workforce gap requires an owner action or decision checkpoint.",
        ),
      );
    }
  }

  const handoff = value.handoff ?? {};
  if (
    handoff.privacyClassification !== value.privacyClassification ||
    !humanWithScope(principalById, rosterRefs, handoff.ownerRef, "handoff-owner")
  ) {
    findings.push(
      finding(
        "invalid_handoff_authority",
        "handoff",
        "The handoff must preserve privacy and use a rostered human handoff owner.",
      ),
    );
  }
  if (!sameSet(handoff.blockerRefs, materialBlockers)) {
    findings.push(
      finding(
        "incomplete_handoff",
        "handoff.blockerRefs",
        "The handoff must list every material gap exactly once.",
      ),
    );
  }
  if (!sameSet(handoff.actionRefs, [...indexes.ownerActions.keys()])) {
    findings.push(
      finding(
        "incomplete_handoff",
        "handoff.actionRefs",
        "The handoff must list every owner action exactly once.",
      ),
    );
  }
  if (!sameSet(handoff.decisionRefs, [...indexes.decisionCheckpoints.keys()])) {
    findings.push(
      finding(
        "incomplete_handoff",
        "handoff.decisionRefs",
        "The handoff must list every decision checkpoint exactly once.",
      ),
    );
  }
  if (!sameSet(handoff.authorityAttestationRefs, [...indexes.authorityAttestations.keys()])) {
    findings.push(
      finding(
        "incomplete_handoff",
        "handoff.authorityAttestationRefs",
        "The handoff must list every structured authority attestation exactly once.",
      ),
    );
  }
  const expectedState = materialBlockers.length > 0 ? "blocked" : "ready-for-manager-review";
  if (handoff.state !== expectedState) {
    findings.push(
      finding(
        "premature_ready_state",
        "handoff.state",
        "A handoff cannot be ready while a material workforce gap remains.",
      ),
    );
  }
  if (!sameSet(handoff.prohibitedActions, WORKFORCE_PROHIBITED_ACTIONS)) {
    findings.push(
      finding(
        "missing_authority_gate",
        "handoff.prohibitedActions",
        "The handoff must preserve the complete prohibited workforce action set.",
      ),
    );
  }

  const narrativeFields = [
    ...collections.principals.map((row) => row.name),
    ...collections.organizations.map((row) => row.name),
    ...collections.roles.map((row) => row.name),
    ...collections.locations.map((row) => row.name),
    ...collections.scenarios.map((row) => row.name),
    ...collections.decisionCheckpoints.map((row) => row.question),
    handoff.summary,
  ];
  if (
    hasUnnegatedNarrativeMatch(narrativeFields, WORKFORCE_AUTHORITY_NARRATIVE) ||
    hasUnnegatedNarrativeMatch(
      narrativeFields,
      QUANTIFIED_POSITION_AUTHORIZATION_NARRATIVE,
    )
  ) {
    findings.push(
      finding(
        "unauthorized_narrative_action",
        "$",
        "No user-visible narrative may claim personnel, compensation, reorganization, communication, HR mutation, headcount approval, or scenario approval.",
      ),
    );
  }

  return findings;
}
