import { createHash } from "node:crypto";

export const BUSINESS_CONTINUITY_SCHEMA_VERSION =
  "awesomeClaws.businessContinuityProgram.v1";

const ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const VERSION_PATTERN = /^v([1-9][0-9]*)$/u;
const TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const NOT_CLAIMED_FIELDS = [
  "disasterDeclarationClaim",
  "planInvocationClaim",
  "productionFailoverClaim",
  "trafficShiftClaim",
  "vendorContactClaim",
  "riskAcceptanceClaim",
  "exceptionApprovalClaim",
  "readinessCertificationClaim",
  "complianceCertificationClaim",
  "continuityCertificationClaim",
];
const FIELDS = Object.freeze({
  top: [
    "schemaVersion",
    "artifactId",
    "program",
    "principals",
    "evidence",
    "registers",
    "processes",
    "businessImpactAnalyses",
    "dependencies",
    "planPredecessors",
    "plans",
    "exercises",
    "findings",
    "correctiveActions",
    "exceptions",
    "recertifications",
    "blockers",
    "coverage",
    "handoff",
  ],
  program: [
    "id",
    "cycleId",
    "requestedAt",
    "programManagerRef",
    "currentRegisterRef",
    "currentRegisterRevision",
    "predecessorRegisterRef",
    "predecessorRegisterRevision",
    "handoffOwnerRef",
    "destination",
    "programDigest",
  ],
  principal: ["id", "name", "role", "scopes"],
  evidence: [
    "id",
    "kind",
    "observedAt",
    "suppliedByRef",
    "subjectRefs",
    "sourceDigest",
    "payloadDigest",
  ],
  register: [
    "id",
    "issuedAt",
    "suppliedByRef",
    "predecessorRef",
    "predecessorRevision",
    "processRefs",
    "processRevisions",
    "processStableKeys",
    "processVersions",
    "processOwnerRefs",
    "retiredProcessRefs",
    "retiredProcessRevisions",
    "evidenceRef",
    "evidenceSourceDigest",
    "evidencePayloadDigest",
    "revision",
  ],
  process: [
    "id",
    "stableKey",
    "version",
    "name",
    "changeKind",
    "predecessorProcessRef",
    "predecessorProcessRevision",
    "registerRef",
    "ownerRef",
    "criticality",
    "sourceRevision",
    "dependencyRefs",
    "evidenceRef",
    "evidenceSourceDigest",
    "evidencePayloadDigest",
    "revision",
  ],
  businessImpactAnalysis: [
    "id",
    "processRef",
    "processRevision",
    "impactTier",
    "rtoMinutes",
    "rpoMinutes",
    "approvedByRef",
    "approvedAt",
    "evidenceRef",
    "evidenceSourceDigest",
    "evidencePayloadDigest",
    "revision",
  ],
  dependency: [
    "id",
    "processRef",
    "processRevision",
    "kind",
    "name",
    "ownerRef",
    "sourceRevision",
    "attestedAt",
    "evidenceRef",
    "evidenceSourceDigest",
    "evidencePayloadDigest",
    "revision",
  ],
  planPredecessor: [
    "id",
    "version",
    "processRefs",
    "processRevisions",
    "processStableKeys",
    "processVersions",
    "biaRevisions",
    "dependencyRevisions",
    "strategyCodes",
    "approvedByRef",
    "approvedAt",
    "evidenceRef",
    "evidenceSourceDigest",
    "evidencePayloadDigest",
    "revision",
  ],
  plan: [
    "id",
    "version",
    "predecessorRef",
    "predecessorRevision",
    "processRefs",
    "processRevisions",
    "processStableKeys",
    "processVersions",
    "biaRefs",
    "biaRevisions",
    "dependencyRefs",
    "dependencyRevisions",
    "strategyCodes",
    "approvedByRef",
    "approvedAt",
    "invocationAuthorityRef",
    "evidenceRef",
    "evidenceSourceDigest",
    "evidencePayloadDigest",
    "revision",
  ],
  exercise: [
    "id",
    "performedAt",
    "scopeApprovedByRef",
    "scopeProcessRefs",
    "scopeProcessRevisions",
    "planRefs",
    "planRevisions",
    "findingRefs",
    "injects",
    "result",
    "evaluatorRef",
    "evidenceRefs",
    "evidenceSourceDigests",
    "evidencePayloadDigests",
    "revision",
  ],
  inject: ["id", "sequence", "kind", "descriptionDigest"],
  finding: [
    "id",
    "stableKey",
    "exerciseRef",
    "processRef",
    "category",
    "severity",
    "identifiedAt",
    "ownerRef",
    "state",
    "evidenceRef",
    "evidenceSourceDigest",
    "evidencePayloadDigest",
    "revision",
  ],
  correctiveAction: [
    "id",
    "findingRef",
    "findingRevision",
    "ownerRef",
    "dueAt",
    "status",
    "receiptRef",
    "receiptRevision",
    "verifiedByRef",
    "verifiedAt",
    "evidenceRef",
    "evidenceSourceDigest",
    "evidencePayloadDigest",
    "revision",
  ],
  exception: [
    "id",
    "findingRef",
    "processRef",
    "scopeDigest",
    "approvedByRef",
    "approvedAt",
    "expiresAt",
    "status",
    "evidenceRef",
    "evidenceSourceDigest",
    "evidencePayloadDigest",
    "revokedByRef",
    "revokedAt",
    "revocationEvidenceRef",
    "revocationEvidenceSourceDigest",
    "revocationEvidencePayloadDigest",
    "revision",
  ],
  recertification: [
    "id",
    "processRef",
    "processRevision",
    "biaRevision",
    "dependencyRevisions",
    "planRevision",
    "exerciseRevisions",
    "findingRevisions",
    "actionRevisions",
    "exceptionRevisions",
    "recertifiedByRef",
    "recertifiedAt",
    "decision",
    "evidenceRef",
    "evidenceSourceDigest",
    "evidencePayloadDigest",
    "revision",
  ],
  blocker: [
    "id",
    "category",
    "targetRefs",
    "ownerRef",
    "evidenceRef",
    "evidenceSourceDigest",
    "evidencePayloadDigest",
    "revision",
  ],
  coverage: [
    "registerRef",
    "registerRevision",
    "processRefs",
    "biaRefs",
    "dependencyRefs",
    "planPredecessorRefs",
    "planRefs",
    "exerciseRefs",
    "findingRefs",
    "correctiveActionRefs",
    "exceptionRefs",
    "recertificationRefs",
    "blockerRefs",
    "blockerRevisions",
    "contentDigest",
  ],
  handoff: [
    "destination",
    "ownerRef",
    "coverageDigest",
    "blockerRefs",
    "state",
    "summary",
    ...NOT_CLAIMED_FIELDS,
    "payloadDigest",
  ],
});

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return `sha256:${createHash("sha256").update(stable(value)).digest("hex")}`;
}

function without(value, ...keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}

function recordRevision(kind, value) {
  return digest({ kind, value: without(value, "revision") });
}

export function computeProgramDigest(program) {
  return digest({ kind: "business-continuity-program", value: without(program, "programDigest") });
}

export function computeRegisterRevision(value) {
  return recordRevision("critical-process-register", value);
}

export function computeProcessRevision(value) {
  return recordRevision("critical-process", value);
}

export function computeBiaRevision(value) {
  return recordRevision("business-impact-analysis", value);
}

export function computeDependencyRevision(value) {
  return recordRevision("continuity-dependency", value);
}

export function computePlanRevision(value) {
  return recordRevision("continuity-plan", value);
}

export function computePlanPredecessorRevision(value) {
  return recordRevision("continuity-plan-predecessor", value);
}

export function computeExerciseRevision(value) {
  return recordRevision("continuity-exercise", value);
}

export function computeFindingStableKey(value) {
  return digest({
    kind: "continuity-finding-identity",
    exerciseRef: value?.exerciseRef,
    processRef: value?.processRef,
    category: value?.category,
  });
}

export function computeFindingRevision(value) {
  return recordRevision("continuity-finding", value);
}

export function computeActionRevision(value) {
  return recordRevision("continuity-corrective-action", value);
}

export function computeExceptionRevision(value) {
  return recordRevision("continuity-exception", value);
}

export function computeExceptionScopeDigest(value, processRevision, findingRevision) {
  return digest({
    kind: "continuity-exception-scope",
    processRef: value?.processRef,
    processRevision,
    findingRef: value?.findingRef,
    findingRevision,
    approvedAt: value?.approvedAt,
    expiresAt: value?.expiresAt,
    evidenceSourceDigest: value?.evidenceSourceDigest,
    evidencePayloadDigest: value?.evidencePayloadDigest,
  });
}

export function computeRecertificationRevision(value) {
  return recordRevision("continuity-recertification", value);
}

export function computeBlockerRevision(value) {
  return recordRevision("continuity-blocker", value);
}

export function computeEvidencePayloadDigest(value) {
  return digest({
    kind: "continuity-evidence-payload",
    value: without(value, "payloadDigest"),
  });
}

export function computeCoverageDigest(value) {
  return digest({ kind: "continuity-coverage", value: without(value, "contentDigest") });
}

export function computeHandoffDigest(value) {
  return digest({ kind: "continuity-handoff", value: without(value, "payloadDigest") });
}

function entries(value, key) {
  return Array.isArray(value?.[key]) ? value[key] : [];
}

function byId(rows) {
  return new Map(rows.filter((row) => row && typeof row === "object").map((row) => [row.id, row]));
}

function validTimestamp(value) {
  if (typeof value !== "string") return false;
  const match = TIMESTAMP_PATTERN.exec(value);
  if (!match) return false;
  const [, y, m, d, hh, mm, ss] = match;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const probe = new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss));
  return (
    probe.getUTCFullYear() === +y &&
    probe.getUTCMonth() === +m - 1 &&
    probe.getUTCDate() === +d &&
    +hh <= 23 &&
    +mm <= 59 &&
    +ss <= 59
  );
}

function time(value) {
  return validTimestamp(value) ? Date.parse(value) : Number.NaN;
}

function versionNumber(value) {
  const match = typeof value === "string" ? VERSION_PATTERN.exec(value) : null;
  return match ? Number(match[1]) : Number.NaN;
}

function sameSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  return left.length === right.length && new Set(left).size === left.length &&
    left.every((item) => right.includes(item));
}

function exactFields(value, expected) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    sameSet(Object.keys(value), expected);
}

function uniqueIds(rows) {
  const ids = rows.map((row) => row?.id);
  return ids.every((id) => typeof id === "string" && ID_PATTERN.test(id)) &&
    new Set(ids).size === ids.length;
}

function finding(code, path, message) {
  return { code, path, message };
}

function expectedBlockers(value, asOfMs) {
  const result = [];
  const processes = entries(value, "processes");
  const bias = entries(value, "businessImpactAnalyses");
  const dependencies = entries(value, "dependencies");
  const plans = entries(value, "plans");
  const exercises = entries(value, "exercises");
  const findings = entries(value, "findings");
  const actions = entries(value, "correctiveActions");
  const exceptions = entries(value, "exceptions");
  const recertifications = entries(value, "recertifications");
  const evidence = byId(entries(value, "evidence"));
  const principals = byId(entries(value, "principals"));

  for (const process of processes) {
    if (!bias.some((row) => row.processRef === process.id)) {
      result.push(["missing-bia", process.id]);
    }
    if (!sameSet(
      process.dependencyRefs,
      dependencies.filter((row) => row.processRef === process.id).map((row) => row.id),
    )) {
      result.push(["dependency-gap", process.id]);
    }
    const plan = plans.find((row) => row.processRefs?.includes(process.id));
    if (!plan) {
      result.push(["missing-plan", process.id]);
    }
    const exerciseCandidates = exercises.filter((row) =>
      row.scopeProcessRefs?.includes(process.id) || row.planRefs?.includes(plan?.id));
    const qualifyingExercise = exerciseCandidates.some((row) => {
      const exerciseFindings = findings
        .filter((candidate) => candidate.exerciseRef === row.id)
        .map((candidate) => candidate.id);
      return (
        ["completed-no-findings", "completed-with-findings"].includes(row.result) &&
        row.scopeProcessRefs?.includes(process.id) &&
        row.scopeProcessRevisions?.includes(process.revision) &&
        row.planRefs?.includes(plan?.id) &&
        row.planRevisions?.includes(plan?.revision) &&
        sameSet(row.findingRefs, exerciseFindings) &&
        (row.result !== "completed-no-findings" || exerciseFindings.length === 0) &&
        (row.result !== "completed-with-findings" || exerciseFindings.length > 0)
      );
    });
    if (!qualifyingExercise) {
      result.push([
        exerciseCandidates.length > 0 ? "exercise-incomplete" : "exercise-missing",
        process.id,
      ]);
    }
    if (!recertifications.some((row) => row.processRef === process.id)) {
      result.push(["recertification-missing", process.id]);
    }
  }

  for (const row of findings) {
    const actionRows = actions.filter((candidate) => candidate.findingRef === row.id);
    const action = actionRows[0];
    const receiptEvidence = evidence.get(action?.evidenceRef);
    const derivedClosed =
      actionRows.length === 1 &&
      action?.status === "verified" &&
      action?.receiptRef &&
      action?.receiptRevision === receiptEvidence?.payloadDigest &&
      receiptEvidence?.kind === "remediation-receipt" &&
      receiptEvidence?.subjectRefs?.includes(action.id) &&
      receiptEvidence?.subjectRefs?.includes(action.receiptRef) &&
      time(action.verifiedAt) >= time(row.identifiedAt) &&
      time(receiptEvidence?.observedAt) >= time(action.verifiedAt) &&
      action.verifiedByRef !== action.ownerRef;
    if (!derivedClosed) {
      result.push(["exercise-finding-open", row.id]);
      if (actionRows.length === 0) result.push(["corrective-action-missing", row.id]);
      else if (action.status !== "verified" && time(action.dueAt) < asOfMs) {
        result.push(["corrective-action-overdue", action.id]);
      }
    }
  }

  for (const row of exceptions) {
    if (row.status === "active" && time(row.expiresAt) >= asOfMs) {
      result.push(["exception-active", row.id]);
    }
    if (row.status === "expired" || time(row.expiresAt) < asOfMs) {
      result.push(["exception-expired", row.id]);
    }
    if (row.status === "revoked") {
      const revocationEvidence = evidence.get(row.revocationEvidenceRef);
      const revoker = principals.get(row.revokedByRef);
      const validRevocation =
        row.revokedByRef &&
        row.revokedByRef !== row.approvedByRef &&
        revoker?.role === "exception-revoker" &&
        revoker.scopes?.includes(row.id) &&
        validTimestamp(row.revokedAt) &&
        time(row.revokedAt) > time(row.approvedAt) &&
        revocationEvidence?.kind === "exception-revocation" &&
        revocationEvidence?.suppliedByRef === row.revokedByRef &&
        revocationEvidence?.subjectRefs?.includes(row.id) &&
        time(revocationEvidence?.observedAt) >= time(row.revokedAt) &&
        row.revocationEvidenceSourceDigest === revocationEvidence?.sourceDigest &&
        row.revocationEvidencePayloadDigest === revocationEvidence?.payloadDigest;
      if (!validRevocation) result.push(["exception-revocation-invalid", row.id]);
    }
  }
  return result.sort(([a, b], [c, d]) => `${a}\0${b}`.localeCompare(`${c}\0${d}`));
}

export function resealBusinessContinuityArtifact(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const result = structuredClone(value);
  for (const row of entries(result, "evidence")) {
    row.payloadDigest = computeEvidencePayloadDigest(row);
  }
  const evidenceMap = byId(entries(result, "evidence"));
  const bindEvidence = (
    row,
    ref = row.evidenceRef,
    sourceField = "evidenceSourceDigest",
    payloadField = "evidencePayloadDigest",
  ) => {
    const item = evidenceMap.get(ref);
    row[sourceField] = item?.sourceDigest ?? row[sourceField];
    row[payloadField] = item?.payloadDigest ?? row[payloadField];
  };
  const registerMap = byId(entries(result, "registers"));
  const predecessorRegister = registerMap.get(result.program?.predecessorRegisterRef);
  if (predecessorRegister) {
    bindEvidence(predecessorRegister);
    predecessorRegister.revision = computeRegisterRevision(predecessorRegister);
  }
  const predecessorProcessRevisionByRef = new Map(
    (predecessorRegister?.processRefs ?? []).map((ref, index) => [
      ref,
      predecessorRegister.processRevisions?.[index],
    ]),
  );
  for (const row of entries(result, "processes")) {
    row.predecessorProcessRevision = row.predecessorProcessRef
      ? predecessorProcessRevisionByRef.get(row.predecessorProcessRef) ??
        row.predecessorProcessRevision
      : null;
    bindEvidence(row);
    row.revision = computeProcessRevision(row);
  }
  const processMap = byId(entries(result, "processes"));
  const currentRegister = registerMap.get(result.program?.currentRegisterRef);
  if (currentRegister) {
    currentRegister.processRevisions = currentRegister.processRefs.map(
      (ref) => processMap.get(ref)?.revision ?? "",
    );
    currentRegister.processStableKeys = currentRegister.processRefs.map(
      (ref) => processMap.get(ref)?.stableKey ?? "",
    );
    currentRegister.processVersions = currentRegister.processRefs.map(
      (ref) => processMap.get(ref)?.version ?? "",
    );
    currentRegister.processOwnerRefs = currentRegister.processRefs.map(
      (ref) => processMap.get(ref)?.ownerRef ?? "",
    );
    currentRegister.retiredProcessRevisions = currentRegister.retiredProcessRefs.map(
      (ref) => predecessorProcessRevisionByRef.get(ref) ?? "",
    );
    currentRegister.predecessorRevision =
      predecessorRegister?.revision ?? currentRegister.predecessorRevision;
    bindEvidence(currentRegister);
    currentRegister.revision = computeRegisterRevision(currentRegister);
    result.program.currentRegisterRevision = currentRegister.revision;
  }
  if (predecessorRegister) result.program.predecessorRegisterRevision = predecessorRegister.revision;
  for (const row of entries(result, "businessImpactAnalyses")) {
    row.processRevision = processMap.get(row.processRef)?.revision ?? row.processRevision;
    bindEvidence(row);
    row.revision = computeBiaRevision(row);
  }
  for (const row of entries(result, "dependencies")) {
    row.processRevision = processMap.get(row.processRef)?.revision ?? row.processRevision;
    bindEvidence(row);
    row.revision = computeDependencyRevision(row);
  }
  const biaMap = byId(entries(result, "businessImpactAnalyses"));
  const dependencyMap = byId(entries(result, "dependencies"));
  for (const row of entries(result, "planPredecessors")) {
    bindEvidence(row);
    row.revision = computePlanPredecessorRevision(row);
  }
  const predecessorPlanMap = byId(entries(result, "planPredecessors"));
  const planMap = byId(entries(result, "plans"));
  for (const row of entries(result, "plans")) {
    row.processRevisions = row.processRefs.map((ref) => processMap.get(ref)?.revision ?? "");
    row.processStableKeys = row.processRefs.map((ref) => processMap.get(ref)?.stableKey ?? "");
    row.processVersions = row.processRefs.map((ref) => processMap.get(ref)?.version ?? "");
    row.biaRevisions = row.biaRefs.map((ref) => biaMap.get(ref)?.revision ?? "");
    row.dependencyRevisions = row.dependencyRefs.map(
      (ref) => dependencyMap.get(ref)?.revision ?? "",
    );
    if (row.predecessorRef) {
      row.predecessorRevision =
        predecessorPlanMap.get(row.predecessorRef)?.revision ?? row.predecessorRevision;
    }
    bindEvidence(row);
    row.revision = computePlanRevision(row);
  }
  for (const row of entries(result, "exercises")) {
    row.scopeProcessRevisions = row.scopeProcessRefs.map(
      (ref) => processMap.get(ref)?.revision ?? "",
    );
    row.planRevisions = row.planRefs.map((ref) => planMap.get(ref)?.revision ?? "");
    row.findingRefs = entries(result, "findings")
      .filter((candidate) => candidate.exerciseRef === row.id)
      .map((candidate) => candidate.id);
    row.evidenceSourceDigests = row.evidenceRefs.map(
      (ref) => evidenceMap.get(ref)?.sourceDigest ?? "",
    );
    row.evidencePayloadDigests = row.evidenceRefs.map(
      (ref) => evidenceMap.get(ref)?.payloadDigest ?? "",
    );
    row.revision = computeExerciseRevision(row);
  }
  for (const row of entries(result, "findings")) {
    bindEvidence(row);
    row.stableKey = computeFindingStableKey(row);
    row.revision = computeFindingRevision(row);
  }
  const findingMap = byId(entries(result, "findings"));
  for (const row of entries(result, "correctiveActions")) {
    row.findingRevision = findingMap.get(row.findingRef)?.revision ?? row.findingRevision;
    bindEvidence(row);
    if (row.status === "verified") {
      row.receiptRevision = evidenceMap.get(row.evidenceRef)?.payloadDigest ?? row.receiptRevision;
    }
    row.revision = computeActionRevision(row);
  }
  for (const row of entries(result, "exceptions")) {
    bindEvidence(row);
    row.scopeDigest = computeExceptionScopeDigest(
      row,
      processMap.get(row.processRef)?.revision,
      findingMap.get(row.findingRef)?.revision,
    );
    if (row.status === "revoked") {
      bindEvidence(
        row,
        row.revocationEvidenceRef,
        "revocationEvidenceSourceDigest",
        "revocationEvidencePayloadDigest",
      );
    }
    row.revision = computeExceptionRevision(row);
  }
  const actionMap = byId(entries(result, "correctiveActions"));
  const exceptionMap = byId(entries(result, "exceptions"));
  for (const row of entries(result, "recertifications")) {
    const process = processMap.get(row.processRef);
    const bia = entries(result, "businessImpactAnalyses").find(
      (candidate) => candidate.processRef === row.processRef,
    );
    row.processRevision = process?.revision ?? "";
    row.biaRevision = bia?.revision ?? "";
    row.dependencyRevisions = (process?.dependencyRefs ?? []).map(
      (ref) => dependencyMap.get(ref)?.revision ?? "",
    );
    const plan = entries(result, "plans").find((candidate) =>
      candidate.processRefs?.includes(row.processRef));
    row.planRevision = plan?.revision ?? "";
    row.exerciseRevisions = entries(result, "exercises")
      .filter((candidate) => candidate.scopeProcessRefs?.includes(row.processRef))
      .map((candidate) => candidate.revision);
    row.findingRevisions = entries(result, "findings")
      .filter((candidate) => candidate.processRef === row.processRef)
      .map((candidate) => candidate.revision);
    row.actionRevisions = entries(result, "correctiveActions")
      .filter((candidate) => findingMap.get(candidate.findingRef)?.processRef === row.processRef)
      .map((candidate) => actionMap.get(candidate.id)?.revision ?? "");
    row.exceptionRevisions = entries(result, "exceptions")
      .filter((candidate) => candidate.processRef === row.processRef)
      .map((candidate) => exceptionMap.get(candidate.id)?.revision ?? "");
    bindEvidence(row);
    row.revision = computeRecertificationRevision(row);
  }
  for (const row of entries(result, "blockers")) {
    bindEvidence(row);
    row.revision = computeBlockerRevision(row);
  }
  result.program.programDigest = computeProgramDigest(result.program);
  result.coverage.registerRevision = currentRegister?.revision ?? result.coverage.registerRevision;
  result.coverage.planPredecessorRefs = entries(result, "planPredecessors").map((row) => row.id);
  result.coverage.blockerRevisions = entries(result, "blockers").map((row) => row.revision);
  result.coverage.contentDigest = computeCoverageDigest(result.coverage);
  result.handoff.coverageDigest = result.coverage.contentDigest;
  result.handoff.payloadDigest = computeHandoffDigest(result.handoff);
  return result;
}

export function businessContinuityProgramFindings(input, context = {}) {
  const findings = [];
  const add = (code, path, message) => findings.push(finding(code, path, message));
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return [finding("invalid_contract", "", "The artifact must be an object.")];
  }
  const asOfMs = time(context.asOf);
  if (!Number.isFinite(asOfMs)) {
    add(
      "invalid_validation_context",
      "$context.asOf",
      "A caller-supplied zone-bearing RFC 3339 asOf is required.",
    );
  }
  if (input.schemaVersion !== BUSINESS_CONTINUITY_SCHEMA_VERSION) {
    add("invalid_contract", "schemaVersion", "Unexpected business continuity schema version.");
  }
  if (!exactFields(input, FIELDS.top)) {
    add("prohibited_contract_field", "", "The top-level contract must be exact and closed.");
  }

  for (const [key, fieldName] of [
    ["principals", "principal"],
    ["evidence", "evidence"],
    ["registers", "register"],
    ["processes", "process"],
    ["businessImpactAnalyses", "businessImpactAnalysis"],
    ["dependencies", "dependency"],
    ["planPredecessors", "planPredecessor"],
    ["plans", "plan"],
    ["exercises", "exercise"],
    ["findings", "finding"],
    ["correctiveActions", "correctiveAction"],
    ["exceptions", "exception"],
    ["recertifications", "recertification"],
    ["blockers", "blocker"],
  ]) {
    for (const [index, row] of entries(input, key).entries()) {
      if (!exactFields(row, FIELDS[fieldName])) {
        add("prohibited_contract_field", `${key}[${index}]`, `${key} records must be exact.`);
      }
      if (key === "exercises") {
        for (const [injectIndex, inject] of (Array.isArray(row?.injects) ? row.injects : []).entries()) {
          if (!exactFields(inject, FIELDS.inject)) {
            add(
              "prohibited_contract_field",
              `${key}[${index}].injects[${injectIndex}]`,
              "Exercise inject records must be exact.",
            );
          }
        }
      }
    }
  }
  for (const [key, fieldName] of [
    ["program", "program"],
    ["coverage", "coverage"],
    ["handoff", "handoff"],
  ]) {
    if (!exactFields(input[key], FIELDS[fieldName])) {
      add("prohibited_contract_field", key, `${key} must be exact.`);
    }
  }

  const allRows = [
    ...entries(input, "principals"),
    ...entries(input, "evidence"),
    ...entries(input, "registers"),
    ...entries(input, "processes"),
    ...entries(input, "businessImpactAnalyses"),
    ...entries(input, "dependencies"),
    ...entries(input, "planPredecessors"),
    ...entries(input, "plans"),
    ...entries(input, "exercises"),
    ...entries(input, "findings"),
    ...entries(input, "correctiveActions"),
    ...entries(input, "exceptions"),
    ...entries(input, "recertifications"),
    ...entries(input, "blockers"),
  ];
  if (!uniqueIds(allRows)) {
    add("duplicate_identity", "", "All modeled records need globally unique stable ids.");
  }

  const principals = byId(entries(input, "principals"));
  const evidence = byId(entries(input, "evidence"));
  const registers = byId(entries(input, "registers"));
  const processes = byId(entries(input, "processes"));
  const bias = byId(entries(input, "businessImpactAnalyses"));
  const dependencies = byId(entries(input, "dependencies"));
  const predecessorPlans = byId(entries(input, "planPredecessors"));
  const plans = byId(entries(input, "plans"));
  const exercises = byId(entries(input, "exercises"));
  const findingMap = byId(entries(input, "findings"));
  const actions = byId(entries(input, "correctiveActions"));
  const exceptions = byId(entries(input, "exceptions"));
  const recertifications = byId(entries(input, "recertifications"));
  const program = input.program ?? {};
  const principalHas = (ref, role, scope) => {
    const principal = principals.get(ref);
    return principal?.role === role && principal.scopes?.includes(scope);
  };
  const supports = (ref, kind, subjectRef, suppliedByRef) => {
    const item = evidence.get(ref);
    return (
      item?.kind === kind &&
      item.subjectRefs?.includes(subjectRef) &&
      item.suppliedByRef === suppliedByRef
    );
  };
  const evidenceBinds = (
    row,
    kind,
    subjectRef,
    suppliedByRef,
    ref = row?.evidenceRef,
    sourceField = "evidenceSourceDigest",
    payloadField = "evidencePayloadDigest",
  ) => {
    const item = evidence.get(ref);
    return (
      supports(ref, kind, subjectRef, suppliedByRef) &&
      row?.[sourceField] === item?.sourceDigest &&
      row?.[payloadField] === item?.payloadDigest
    );
  };
  const currentRegister = registers.get(program.currentRegisterRef);
  const predecessorRegister = registers.get(program.predecessorRegisterRef);

  if (
    !principalHas(program.programManagerRef, "program-manager", program.cycleId) ||
    !principalHas(program.handoffOwnerRef, "handoff-owner", program.destination) ||
    program.programManagerRef === program.handoffOwnerRef
  ) {
    add(
      "invalid_authority_binding",
      "program",
      "Program manager and handoff owner must be distinct principals with exact roles and cycle or destination scope.",
    );
  }

  const authorityGroups = [
    ["program-manager", [program.programManagerRef]],
    ["process-owner", entries(input, "processes").map((row) => row.ownerRef)],
    ["invocation-authority", entries(input, "plans").map((row) => row.invocationAuthorityRef)],
    ["exercise-approver", entries(input, "exercises").map((row) => row.scopeApprovedByRef)],
    ["exercise-evaluator", entries(input, "exercises").map((row) => row.evaluatorRef)],
    ["remediation-owner", entries(input, "correctiveActions").map((row) => row.ownerRef)],
    ["remediation-verifier", entries(input, "correctiveActions").map((row) => row.verifiedByRef).filter(Boolean)],
    ["exception-approver", entries(input, "exceptions").map((row) => row.approvedByRef)],
    ["exception-revoker", entries(input, "exceptions").map((row) => row.revokedByRef).filter(Boolean)],
    ["recertifier", entries(input, "recertifications").map((row) => row.recertifiedByRef)],
    ["handoff-owner", [program.handoffOwnerRef]],
  ].map(([name, refs]) => [name, new Set(refs.filter(Boolean))]);
  for (let left = 0; left < authorityGroups.length; left += 1) {
    for (let right = left + 1; right < authorityGroups.length; right += 1) {
      if ([...authorityGroups[left][1]].some((ref) => authorityGroups[right][1].has(ref))) {
        add(
          "invalid_authority_separation",
          "principals",
          `${authorityGroups[left][0]} and ${authorityGroups[right][0]} authority must remain separated.`,
        );
      }
    }
  }

  if (
    !currentRegister ||
    !predecessorRegister ||
    currentRegister.predecessorRef !== predecessorRegister.id ||
    !principalHas(currentRegister.suppliedByRef, "register-owner", currentRegister.id) ||
    !principalHas(predecessorRegister.suppliedByRef, "register-owner", predecessorRegister.id) ||
    !evidenceBinds(
      currentRegister,
      "register",
      currentRegister.id,
      currentRegister.suppliedByRef,
    ) ||
    !evidenceBinds(
      predecessorRegister,
      "register",
      predecessorRegister.id,
      predecessorRegister.suppliedByRef,
    ) ||
    time(predecessorRegister.issuedAt) >= time(currentRegister.issuedAt) ||
    time(currentRegister.issuedAt) > time(program.requestedAt) ||
    time(program.requestedAt) > asOfMs ||
    time(evidence.get(predecessorRegister.evidenceRef)?.observedAt) <
      time(predecessorRegister.issuedAt) ||
    time(evidence.get(currentRegister.evidenceRef)?.observedAt) <
      time(currentRegister.issuedAt) ||
    time(evidence.get(currentRegister.evidenceRef)?.observedAt) >
      time(program.requestedAt) ||
    time(evidence.get(predecessorRegister.evidenceRef)?.observedAt) >=
      time(evidence.get(currentRegister.evidenceRef)?.observedAt) ||
    currentRegister.predecessorRevision !== predecessorRegister.revision ||
    program.currentRegisterRevision !== currentRegister.revision ||
    program.predecessorRegisterRevision !== predecessorRegister.revision ||
    currentRegister.revision !== computeRegisterRevision(currentRegister) ||
    predecessorRegister.revision !== computeRegisterRevision(predecessorRegister) ||
    program.programDigest !== computeProgramDigest(program)
  ) {
    add(
      "invalid_register_binding",
      "program",
      "The program must bind exact current and predecessor register revisions.",
    );
  }
  const processRows = entries(input, "processes");
  if (
    !currentRegister ||
    !sameSet(currentRegister.processRefs, processRows.map((row) => row.id)) ||
    currentRegister.processRefs?.length !== currentRegister.processRevisions?.length ||
    currentRegister.processRefs?.length !== currentRegister.processStableKeys?.length ||
    currentRegister.processRefs?.length !== currentRegister.processVersions?.length ||
    currentRegister.processRefs?.length !== currentRegister.processOwnerRefs?.length ||
    currentRegister.processRefs?.some(
      (ref, index) =>
        processes.get(ref)?.revision !== currentRegister.processRevisions[index] ||
        processes.get(ref)?.stableKey !== currentRegister.processStableKeys[index] ||
        processes.get(ref)?.version !== currentRegister.processVersions[index] ||
        processes.get(ref)?.ownerRef !== currentRegister.processOwnerRefs[index],
    ) ||
    predecessorRegister?.processRefs?.length !== predecessorRegister?.processRevisions?.length ||
    predecessorRegister?.processRefs?.length !== predecessorRegister?.processStableKeys?.length ||
    predecessorRegister?.processRefs?.length !== predecessorRegister?.processVersions?.length ||
    predecessorRegister?.processRefs?.length !== predecessorRegister?.processOwnerRefs?.length ||
    currentRegister.retiredProcessRefs?.length !== currentRegister.retiredProcessRevisions?.length
  ) {
    add(
      "invalid_process_universe",
      "registers",
      "The current register must equal the complete critical-process universe.",
    );
  }

  const predecessorPairs = (predecessorRegister?.processRefs ?? []).map((ref, index) =>
    `${ref}\0${predecessorRegister.processRevisions?.[index]}`);
  const predecessorProcesses = new Map(
    (predecessorRegister?.processRefs ?? []).map((ref, index) => [
      ref,
      {
        revision: predecessorRegister.processRevisions?.[index],
        stableKey: predecessorRegister.processStableKeys?.[index],
        version: predecessorRegister.processVersions?.[index],
        ownerRef: predecessorRegister.processOwnerRefs?.[index],
      },
    ]),
  );
  const transitionPairs = processRows
    .filter((row) => row.changeKind !== "added")
    .map((row) => `${row.predecessorProcessRef}\0${row.predecessorProcessRevision}`);
  const retiredPairs = (currentRegister?.retiredProcessRefs ?? []).map((ref, index) =>
    `${ref}\0${currentRegister.retiredProcessRevisions?.[index]}`);
  if (
    new Set([...transitionPairs, ...retiredPairs]).size !==
      transitionPairs.length + retiredPairs.length ||
    !sameSet(predecessorPairs, [...transitionPairs, ...retiredPairs])
  ) {
    add(
      "invalid_register_transition",
      "registers",
      "Current transitions and retired process revision pairs must form an exact disjoint partition of the predecessor register.",
    );
  }

  for (const row of processRows) {
    const predecessor = predecessorProcesses.get(row.predecessorProcessRef);
    const owner = principals.get(row.ownerRef);
    if (
      row.registerRef !== currentRegister?.id ||
      !Number.isInteger(versionNumber(row.version)) ||
      !principalHas(row.ownerRef, "process-owner", row.id) ||
      !owner?.scopes?.includes(row.stableKey) ||
      (row.changeKind !== "added" && !owner?.scopes?.includes(row.predecessorProcessRef)) ||
      !evidenceBinds(row, "process", row.id, currentRegister?.suppliedByRef) ||
      time(evidence.get(row.evidenceRef)?.observedAt) < time(currentRegister?.issuedAt) ||
      row.revision !== computeProcessRevision(row) ||
      (row.changeKind === "added" &&
        (row.predecessorProcessRef !== null ||
          row.predecessorProcessRevision !== null ||
          versionNumber(row.version) !== 1)) ||
      (row.changeKind !== "added" &&
        (!predecessorPairs.includes(
          `${row.predecessorProcessRef}\0${row.predecessorProcessRevision}`,
        ) ||
          row.stableKey !== predecessor?.stableKey ||
          versionNumber(row.version) <= versionNumber(predecessor?.version) ||
          row.ownerRef !== predecessor?.ownerRef)) ||
      (row.changeKind === "retained" && row.id !== row.predecessorProcessRef) ||
      (row.changeKind === "revised" && row.id === row.predecessorProcessRef)
    ) {
      add(
        "invalid_process_binding",
        `processes.${row.id}`,
        "Each process must bind stable identity, increasing version, compatible owner scope, predecessor transition, evidence, and content revision.",
      );
    }
  }

  for (const process of processRows) {
    const rows = entries(input, "businessImpactAnalyses").filter(
      (row) => row.processRef === process.id,
    );
    if (rows.length !== 1) {
      add(
        "invalid_bia_totality",
        `processes.${process.id}`,
        "Every current process needs exactly one current business-impact analysis.",
      );
      continue;
    }
    const row = rows[0];
    if (
      row.processRevision !== process.revision ||
      row.approvedByRef !== process.ownerRef ||
      !principalHas(row.approvedByRef, "process-owner", row.id) ||
      !evidenceBinds(row, "bia-approval", row.id, row.approvedByRef) ||
      !Number.isInteger(row.rtoMinutes) ||
      !Number.isInteger(row.rpoMinutes) ||
      row.rtoMinutes <= 0 ||
      row.rpoMinutes < 0 ||
      time(row.approvedAt) < time(evidence.get(process.evidenceRef)?.observedAt) ||
      time(evidence.get(row.evidenceRef)?.observedAt) < time(row.approvedAt) ||
      time(row.approvedAt) > asOfMs ||
      row.revision !== computeBiaRevision(row)
    ) {
      add(
        "invalid_bia_binding",
        `businessImpactAnalyses.${row.id}`,
        "RTO and RPO must be bound to the exact process revision and named process-owner approval.",
      );
    }
  }

  for (const process of processRows) {
    const actual = entries(input, "dependencies").filter(
      (row) => row.processRef === process.id,
    );
    if (!sameSet(process.dependencyRefs, actual.map((row) => row.id))) {
      add(
        "invalid_dependency_totality",
        `processes.${process.id}.dependencyRefs`,
        "The process dependency index must exactly equal its supplied dependency records.",
      );
    }
    for (const row of actual) {
      if (
        row.processRevision !== process.revision ||
        !principalHas(row.ownerRef, "dependency-owner", row.id) ||
        row.ownerRef === program.programManagerRef ||
        !evidenceBinds(row, "dependency-attestation", row.id, row.ownerRef) ||
        time(row.attestedAt) < time(evidence.get(process.evidenceRef)?.observedAt) ||
        time(evidence.get(row.evidenceRef)?.observedAt) < time(row.attestedAt) ||
        time(row.attestedAt) > asOfMs ||
        row.revision !== computeDependencyRevision(row)
      ) {
        add(
          "invalid_dependency_binding",
          `dependencies.${row.id}`,
          "Dependencies must bind the exact process and source revision to an accountable external owner attestation.",
        );
      }
    }
  }

  for (const process of processRows) {
    const rows = entries(input, "plans").filter((row) => row.processRefs?.includes(process.id));
    if (rows.length !== 1) {
      add(
        "invalid_plan_totality",
        `processes.${process.id}`,
        "Every current process needs exactly one current plan version.",
      );
    }
  }
  for (const row of entries(input, "planPredecessors")) {
    const predecessorProcessRows = row.processRefs
      ?.map((ref) => predecessorProcesses.get(ref))
      .filter(Boolean) ?? [];
    if (
      !Number.isInteger(versionNumber(row.version)) ||
      !principalHas(row.approvedByRef, "process-owner", row.id) ||
      row.processRefs?.length !== row.processRevisions?.length ||
      row.processRefs?.length !== row.processStableKeys?.length ||
      row.processRefs?.length !== row.processVersions?.length ||
      predecessorProcessRows.length !== row.processRefs?.length ||
      row.processRefs?.some(
        (ref, index) =>
          row.processRevisions?.[index] !== predecessorProcesses.get(ref)?.revision ||
          row.processStableKeys?.[index] !== predecessorProcesses.get(ref)?.stableKey ||
          row.processVersions?.[index] !== predecessorProcesses.get(ref)?.version,
      ) ||
      predecessorProcessRows.some((process) => process.ownerRef !== row.approvedByRef) ||
      !evidenceBinds(row, "plan-predecessor", row.id, row.approvedByRef) ||
      time(evidence.get(row.evidenceRef)?.observedAt) < time(row.approvedAt) ||
      time(evidence.get(row.evidenceRef)?.observedAt) > asOfMs ||
      row.revision !== computePlanPredecessorRevision(row)
    ) {
      add(
        "invalid_plan_predecessor",
        `planPredecessors.${row.id}`,
        "Every plan predecessor must be an immutable, owner-scoped, evidence-bound supplied revision.",
      );
    }
  }
  for (const row of entries(input, "plans")) {
    const planProcesses = row.processRefs?.map((ref) => processes.get(ref)).filter(Boolean) ?? [];
    const expectedBiaRefs = planProcesses
      .map((process) =>
        entries(input, "businessImpactAnalyses").find(
          (candidate) => candidate.processRef === process.id,
        )?.id)
      .filter(Boolean);
    const expectedDependencyRefs = planProcesses.flatMap(
      (process) => process.dependencyRefs ?? [],
    );
    const approvers = new Set(planProcesses.map((process) => process.ownerRef));
    const predecessorPlan = predecessorPlans.get(row.predecessorRef);
    const predecessorLineages = new Map(
      (predecessorPlan?.processStableKeys ?? []).map((stableKey, index) => [
        stableKey,
        predecessorPlan.processVersions?.[index],
      ]),
    );
    const latestRequirementEvidenceAt = Math.max(
      ...row.biaRefs.map((ref) => time(evidence.get(bias.get(ref)?.evidenceRef)?.observedAt)),
      ...row.dependencyRefs.map((ref) =>
        time(evidence.get(dependencies.get(ref)?.evidenceRef)?.observedAt)),
    );
    if (
      planProcesses.length !== row.processRefs?.length ||
      !Number.isInteger(versionNumber(row.version)) ||
      row.processRefs?.length !== row.processRevisions?.length ||
      row.processRefs?.length !== row.processStableKeys?.length ||
      row.processRefs?.length !== row.processVersions?.length ||
      row.processRefs?.some(
        (ref, index) =>
          row.processRevisions?.[index] !== processes.get(ref)?.revision ||
          row.processStableKeys?.[index] !== processes.get(ref)?.stableKey ||
          row.processVersions?.[index] !== processes.get(ref)?.version,
      ) ||
      !sameSet(row.biaRefs, expectedBiaRefs) ||
      !sameSet(row.biaRevisions, row.biaRefs.map((ref) => bias.get(ref)?.revision)) ||
      !sameSet(row.dependencyRefs, expectedDependencyRefs) ||
      !sameSet(
        row.dependencyRevisions,
        row.dependencyRefs.map((ref) => dependencies.get(ref)?.revision),
      ) ||
      !approvers.has(row.approvedByRef) ||
      !principalHas(row.approvedByRef, "process-owner", row.id) ||
      !predecessorPlan ||
      row.predecessorRevision !== predecessorPlan?.revision ||
      row.approvedByRef !== predecessorPlan?.approvedByRef ||
      !sameSet(row.processStableKeys, predecessorPlan?.processStableKeys) ||
      row.processStableKeys?.some(
        (stableKey, index) =>
          versionNumber(predecessorLineages.get(stableKey)) >=
          versionNumber(row.processVersions?.[index]),
      ) ||
      versionNumber(predecessorPlan?.version) >= versionNumber(row.version) ||
      predecessorPlan?.revision !== computePlanPredecessorRevision(predecessorPlan) ||
      time(predecessorPlan?.approvedAt) >= time(row.approvedAt) ||
      time(evidence.get(predecessorPlan?.evidenceRef)?.observedAt) >= time(row.approvedAt) ||
      row.invocationAuthorityRef === program.programManagerRef ||
      !principalHas(row.invocationAuthorityRef, "plan-invocation-authority", row.id) ||
      !evidenceBinds(row, "plan-approval", row.id, row.approvedByRef) ||
      time(row.approvedAt) < latestRequirementEvidenceAt ||
      time(evidence.get(row.evidenceRef)?.observedAt) < time(row.approvedAt) ||
      time(row.approvedAt) > asOfMs ||
      row.revision !== computePlanRevision(row)
    ) {
      add(
        "invalid_plan_binding",
        `plans.${row.id}`,
        "Plan versions must bind exact process lineage, a strictly earlier predecessor, BIA, dependency, approval, invocation-authority, evidence, and revision content.",
      );
    }
  }

  for (const row of entries(input, "exercises")) {
    const scopedProcesses = row.scopeProcessRefs?.map((ref) => processes.get(ref)).filter(Boolean) ?? [];
    const scopedPlans = row.planRefs?.map((ref) => plans.get(ref)).filter(Boolean) ?? [];
    const plannedProcessRefs = [...new Set(scopedPlans.flatMap((plan) => plan.processRefs ?? []))];
    const injectIds = Array.isArray(row.injects) ? row.injects.map((inject) => inject.id) : [];
    const sequences = Array.isArray(row.injects) ? row.injects.map((inject) => inject.sequence) : [];
    const exerciseFindingRefs = entries(input, "findings")
      .filter((candidate) => candidate.exerciseRef === row.id)
      .map((candidate) => candidate.id);
    const charterEvidence = row.evidenceRefs
      ?.map((ref) => evidence.get(ref))
      .find((item) => item?.kind === "exercise-charter");
    const resultEvidence = row.evidenceRefs
      ?.map((ref) => evidence.get(ref))
      .find((item) => item?.kind === "exercise-result");
    const latestPlanEvidenceAt = Math.max(
      ...scopedPlans.map((plan) => time(evidence.get(plan.evidenceRef)?.observedAt)),
    );
    if (
      scopedProcesses.length !== row.scopeProcessRefs?.length ||
      scopedPlans.length !== row.planRefs?.length ||
      !sameSet(row.scopeProcessRefs, plannedProcessRefs) ||
      !sameSet(row.scopeProcessRevisions, scopedProcesses.map((process) => process.revision)) ||
      !sameSet(row.planRevisions, scopedPlans.map((plan) => plan.revision)) ||
      !sameSet(row.findingRefs, exerciseFindingRefs) ||
      (row.result === "completed-no-findings" && row.findingRefs?.length !== 0) ||
      (row.result === "completed-with-findings" && row.findingRefs?.length === 0) ||
      new Set(injectIds).size !== injectIds.length ||
      sequences.some((sequence, index) => sequence !== index + 1) ||
      row.evaluatorRef === program.programManagerRef ||
      row.evaluatorRef === row.scopeApprovedByRef ||
      !principalHas(row.scopeApprovedByRef, "exercise-scope-approver", row.id) ||
      !principalHas(row.evaluatorRef, "exercise-evaluator", row.id) ||
      !charterEvidence ||
      charterEvidence.suppliedByRef !== row.scopeApprovedByRef ||
      !sameSet(charterEvidence.subjectRefs, [row.id]) ||
      !resultEvidence ||
      resultEvidence.suppliedByRef !== row.evaluatorRef ||
      !sameSet(resultEvidence.subjectRefs, [row.id, ...row.findingRefs]) ||
      !sameSet(
        row.evidenceSourceDigests,
        row.evidenceRefs.map((ref) => evidence.get(ref)?.sourceDigest),
      ) ||
      !sameSet(
        row.evidencePayloadDigests,
        row.evidenceRefs.map((ref) => evidence.get(ref)?.payloadDigest),
      ) ||
      time(charterEvidence?.observedAt) < latestPlanEvidenceAt ||
      time(charterEvidence?.observedAt) > time(row.performedAt) ||
      time(resultEvidence?.observedAt) < time(row.performedAt) ||
      time(resultEvidence?.observedAt) > asOfMs ||
      time(row.performedAt) > asOfMs ||
      row.revision !== computeExerciseRevision(row)
    ) {
      add(
        "invalid_exercise_binding",
        `exercises.${row.id}`,
        "Exercises must bind approved exact scope, plan/process revisions, ordered injects, independent evaluation, evidence, and results.",
      );
    }
  }

  for (const process of processRows) {
    const plan = entries(input, "plans").find((candidate) =>
      candidate.processRefs?.includes(process.id));
    const qualifying = entries(input, "exercises").some((row) =>
      ["completed-no-findings", "completed-with-findings"].includes(row.result) &&
      row.scopeProcessRefs?.includes(process.id) &&
      row.scopeProcessRevisions?.includes(process.revision) &&
      row.planRefs?.includes(plan?.id) &&
      row.planRevisions?.includes(plan?.revision) &&
      sameSet(
        row.findingRefs,
        entries(input, "findings")
          .filter((candidate) => candidate.exerciseRef === row.id)
          .map((candidate) => candidate.id),
      ));
    if (!qualifying) {
      add(
        "invalid_exercise_coverage",
        `processes.${process.id}`,
        "Every current process and exact plan revision requires a qualifying completed exercise with complete results and findings.",
      );
    }
  }

  const stableKeys = entries(input, "findings").map((row) => row.stableKey);
  if (new Set(stableKeys).size !== stableKeys.length) {
    add(
      "duplicate_finding_stable_key",
      "findings",
      "Finding stable keys must be globally unique within the program artifact.",
    );
  }
  for (const row of entries(input, "findings")) {
    const exercise = exercises.get(row.exerciseRef);
    const resultEvidence = exercise?.evidenceRefs
      ?.map((ref) => evidence.get(ref))
      .find((item) => item?.kind === "exercise-result");
    if (
      !exercise?.scopeProcessRefs?.includes(row.processRef) ||
      row.stableKey !== computeFindingStableKey(row) ||
      !principalHas(row.ownerRef, "remediation-owner", row.id) ||
      !evidenceBinds(row, "finding", row.id, exercise?.evaluatorRef) ||
      time(row.identifiedAt) < time(resultEvidence?.observedAt) ||
      time(evidence.get(row.evidenceRef)?.observedAt) < time(row.identifiedAt) ||
      time(row.identifiedAt) > asOfMs ||
      row.revision !== computeFindingRevision(row)
    ) {
      add(
        "invalid_finding_identity",
        `findings.${row.id}`,
        "Finding identity must remain stable across exact exercise, process, and category content.",
      );
    }
  }

  for (const row of entries(input, "correctiveActions")) {
    const relatedFinding = findingMap.get(row.findingRef);
    const verified = row.status === "verified";
    const actionEvidence = evidence.get(row.evidenceRef);
    if (
      !relatedFinding ||
      row.findingRevision !== relatedFinding.revision ||
      !principalHas(row.ownerRef, "remediation-owner", row.id) ||
      !evidenceBinds(
        row,
        verified ? "remediation-receipt" : "corrective-action",
        row.id,
        verified ? row.verifiedByRef : row.ownerRef,
      ) ||
      (verified &&
        (!row.receiptRef ||
        row.receiptRevision !== actionEvidence?.payloadDigest ||
          !row.verifiedByRef ||
          row.verifiedByRef === row.ownerRef ||
        !principalHas(row.verifiedByRef, "remediation-verifier", row.id) ||
          !evidence.get(row.evidenceRef)?.subjectRefs?.includes(row.receiptRef) ||
        !validTimestamp(row.verifiedAt) ||
        time(row.verifiedAt) < time(relatedFinding.identifiedAt) ||
        time(actionEvidence?.observedAt) < time(row.verifiedAt))) ||
      (!verified &&
        [row.receiptRef, row.receiptRevision, row.verifiedByRef, row.verifiedAt].some(
        (value) => value !== null,
        )) ||
      time(actionEvidence?.observedAt) < time(relatedFinding?.identifiedAt) ||
      time(row.verifiedAt) > asOfMs ||
      row.revision !== computeActionRevision(row)
    ) {
      add(
        "invalid_corrective_action",
        `correctiveActions.${row.id}`,
        "Corrective actions need exact finding binding and independently verified external receipts before verified state.",
      );
    }
  }

  for (const row of entries(input, "findings")) {
    const actionRows = entries(input, "correctiveActions").filter(
      (candidate) => candidate.findingRef === row.id,
    );
    const action = actionRows[0];
    const receiptEvidence = evidence.get(action?.evidenceRef);
    const derivedClosed =
      actionRows.length === 1 &&
      action?.status === "verified" &&
      action.receiptRevision === receiptEvidence?.payloadDigest &&
      receiptEvidence?.kind === "remediation-receipt" &&
      receiptEvidence?.subjectRefs?.includes(action.id) &&
      receiptEvidence?.subjectRefs?.includes(action.receiptRef) &&
      principalHas(action.verifiedByRef, "remediation-verifier", action.id) &&
      action.verifiedByRef !== action.ownerRef &&
      time(action.verifiedAt) >= time(row.identifiedAt) &&
      time(receiptEvidence?.observedAt) >= time(action.verifiedAt);
    const expectedState = derivedClosed
      ? "verified-closed"
      : actionRows.length > 0
        ? "in-remediation"
        : "open";
    if (row.state !== expectedState || actionRows.length > 1) {
      add(
        "invalid_finding_closure",
        `findings.${row.id}.state`,
        "Finding state must be derived from exactly one bound corrective action and independent post-finding verification receipt evidence.",
      );
    }
  }

  for (const row of entries(input, "exceptions")) {
    const relatedFinding = findingMap.get(row.findingRef);
    const revoked = row.status === "revoked";
    const revocationEvidence = evidence.get(row.revocationEvidenceRef);
    if (
      !relatedFinding ||
      relatedFinding.processRef !== row.processRef ||
      row.approvedByRef === program.programManagerRef ||
      row.approvedByRef === relatedFinding.ownerRef ||
      !principalHas(row.approvedByRef, "exception-approver", row.id) ||
      !evidenceBinds(row, "exception-approval", row.id, row.approvedByRef) ||
      row.scopeDigest !==
        computeExceptionScopeDigest(
          row,
          processes.get(row.processRef)?.revision,
          relatedFinding.revision,
        ) ||
      time(row.approvedAt) < time(relatedFinding.identifiedAt) ||
      time(evidence.get(row.evidenceRef)?.observedAt) < time(row.approvedAt) ||
      time(row.approvedAt) >= time(row.expiresAt) ||
      time(row.approvedAt) > asOfMs ||
      (row.status === "active" && time(row.expiresAt) < asOfMs) ||
      (row.status === "expired" && time(row.expiresAt) >= asOfMs) ||
      (revoked &&
        (!principalHas(row.revokedByRef, "exception-revoker", row.id) ||
          row.revokedByRef === row.approvedByRef ||
          row.revokedByRef === relatedFinding.ownerRef ||
          row.revokedByRef === program.programManagerRef ||
          !evidenceBinds(
            row,
            "exception-revocation",
            row.id,
            row.revokedByRef,
            row.revocationEvidenceRef,
            "revocationEvidenceSourceDigest",
            "revocationEvidencePayloadDigest",
          ) ||
          time(row.revokedAt) <= time(row.approvedAt) ||
          time(row.revokedAt) > asOfMs ||
          time(revocationEvidence?.observedAt) < time(row.revokedAt))) ||
      (!revoked &&
        [
          row.revokedByRef,
          row.revokedAt,
          row.revocationEvidenceRef,
          row.revocationEvidenceSourceDigest,
          row.revocationEvidencePayloadDigest,
        ].some((value) => value !== null)) ||
      row.revision !== computeExceptionRevision(row)
    ) {
      add(
        "invalid_exception",
        `exceptions.${row.id}`,
        "Exceptions require exact finding scope, independent approval, bounded expiry, and content-bound evidence.",
      );
    }
  }

  for (const process of processRows) {
    const rows = entries(input, "recertifications").filter(
      (row) => row.processRef === process.id,
    );
    if (rows.length !== 1) {
      add(
        "invalid_recertification_totality",
        `processes.${process.id}`,
        "Every current process needs exactly one current independent recertification.",
      );
      continue;
    }
    const row = rows[0];
    const bia = entries(input, "businessImpactAnalyses").find(
      (candidate) => candidate.processRef === process.id,
    );
    const plan = entries(input, "plans").find((candidate) =>
      candidate.processRefs?.includes(process.id));
    const exerciseRows = entries(input, "exercises").filter((candidate) =>
      candidate.scopeProcessRefs?.includes(process.id));
    const findingRows = entries(input, "findings").filter(
      (candidate) => candidate.processRef === process.id,
    );
    const actionRows = entries(input, "correctiveActions").filter(
      (candidate) => findingMap.get(candidate.findingRef)?.processRef === process.id,
    );
    const exceptionRows = entries(input, "exceptions").filter(
      (candidate) => candidate.processRef === process.id,
    );
    const qualifyingExercises = exerciseRows.filter((candidate) =>
      ["completed-no-findings", "completed-with-findings"].includes(candidate.result) &&
      candidate.planRefs?.includes(plan?.id) &&
      candidate.planRevisions?.includes(plan?.revision) &&
      sameSet(
        candidate.findingRefs,
        entries(input, "findings")
          .filter((findingRow) => findingRow.exerciseRef === candidate.id)
          .map((findingRow) => findingRow.id),
      ));
    const findingsClosed = findingRows.every((findingRow) => {
      const relatedActions = actionRows.filter(
        (candidate) => candidate.findingRef === findingRow.id,
      );
      const action = relatedActions[0];
      const receiptEvidence = evidence.get(action?.evidenceRef);
      return (
        relatedActions.length === 1 &&
        action?.status === "verified" &&
        action.receiptRevision === receiptEvidence?.payloadDigest &&
        receiptEvidence?.kind === "remediation-receipt" &&
        time(action.verifiedAt) >= time(findingRow.identifiedAt) &&
        time(receiptEvidence?.observedAt) >= time(action.verifiedAt) &&
        action.verifiedByRef !== action.ownerRef
      );
    });
    const exceptionsClear = exceptionRows.every((exceptionRow) =>
      exceptionRow.status === "revoked");
    const materialTimes = [
      time(program.requestedAt),
      time(evidence.get(currentRegister?.evidenceRef)?.observedAt),
      time(evidence.get(process.evidenceRef)?.observedAt),
      time(evidence.get(bia?.evidenceRef)?.observedAt),
      ...process.dependencyRefs.map((ref) =>
        time(evidence.get(dependencies.get(ref)?.evidenceRef)?.observedAt)),
      time(evidence.get(plan?.evidenceRef)?.observedAt),
      ...exerciseRows.flatMap((candidate) =>
        candidate.evidenceRefs.map((ref) => time(evidence.get(ref)?.observedAt))),
      ...findingRows.map((candidate) =>
        time(evidence.get(candidate.evidenceRef)?.observedAt)),
      ...actionRows.map((candidate) => time(evidence.get(candidate.evidenceRef)?.observedAt)),
      ...exceptionRows.flatMap((candidate) => [
        time(evidence.get(candidate.evidenceRef)?.observedAt),
        time(evidence.get(candidate.revocationEvidenceRef)?.observedAt),
      ]),
    ].filter(Number.isFinite);
    const latestMaterialAt = Math.max(...materialTimes);
    const expectedDecision =
      qualifyingExercises.length > 0 && findingsClosed && exceptionsClear
        ? "evidence-current"
        : "recertification-blocked";
    if (
      row.processRevision !== process.revision ||
      row.biaRevision !== bia?.revision ||
      !sameSet(
        row.dependencyRevisions,
        process.dependencyRefs.map((ref) => dependencies.get(ref)?.revision),
      ) ||
      row.planRevision !== plan?.revision ||
      !sameSet(row.exerciseRevisions, exerciseRows.map((candidate) => candidate.revision)) ||
      !sameSet(row.findingRevisions, findingRows.map((candidate) => candidate.revision)) ||
      !sameSet(row.actionRevisions, actionRows.map((candidate) => candidate.revision)) ||
      !sameSet(row.exceptionRevisions, exceptionRows.map((candidate) => candidate.revision)) ||
      !principalHas(row.recertifiedByRef, "independent-recertifier", process.id) ||
      row.recertifiedByRef === process.ownerRef ||
      row.recertifiedByRef === program.programManagerRef ||
      time(row.recertifiedAt) < latestMaterialAt ||
      time(row.recertifiedAt) > asOfMs ||
      row.decision !== expectedDecision ||
      !evidenceBinds(row, "recertification", row.id, row.recertifiedByRef) ||
      time(evidence.get(row.evidenceRef)?.observedAt) < time(row.recertifiedAt) ||
      row.revision !== computeRecertificationRevision(row)
    ) {
      add(
        "invalid_recertification",
        `recertifications.${row.id}`,
        "Independent recertification must bind every latest process artifact after the latest material evidence.",
      );
    }
  }

  for (const row of entries(input, "evidence")) {
    if (
      !principals.has(row.suppliedByRef) ||
      row.subjectRefs?.length === 0 ||
      time(row.observedAt) > asOfMs ||
      row.payloadDigest !== computeEvidencePayloadDigest(row)
    ) {
      add(
        "invalid_evidence_binding",
        `evidence.${row.id}`,
        "Evidence must have a source principal, exact subjects, causal time, and content digest.",
      );
    }
  }

  const coverage = input.coverage ?? {};
  const coveragePairs = [
    ["processRefs", processRows],
    ["biaRefs", entries(input, "businessImpactAnalyses")],
    ["dependencyRefs", entries(input, "dependencies")],
    ["planPredecessorRefs", entries(input, "planPredecessors")],
    ["planRefs", entries(input, "plans")],
    ["exerciseRefs", entries(input, "exercises")],
    ["findingRefs", entries(input, "findings")],
    ["correctiveActionRefs", entries(input, "correctiveActions")],
    ["exceptionRefs", entries(input, "exceptions")],
    ["recertificationRefs", entries(input, "recertifications")],
    ["blockerRefs", entries(input, "blockers")],
  ];
  if (
    coverage.registerRef !== currentRegister?.id ||
    coverage.registerRevision !== currentRegister?.revision ||
    coveragePairs.some(([key, rows]) => !sameSet(coverage[key], rows.map((row) => row.id))) ||
    !sameSet(
      coverage.blockerRevisions,
      entries(input, "blockers").map((row) => row.revision),
    ) ||
    coverage.contentDigest !== computeCoverageDigest(coverage)
  ) {
    add(
      "invalid_coverage",
      "coverage",
      "Coverage must exactly index every current program ledger and bind the current register revision.",
    );
  }

  const expected = expectedBlockers(input, asOfMs);
  const actual = entries(input, "blockers")
    .flatMap((row) => row.targetRefs?.map((target) => [row.category, target]) ?? [])
    .sort(([a, b], [c, d]) => `${a}\0${b}`.localeCompare(`${c}\0${d}`));
  if (
    stable(expected) !== stable(actual) ||
    entries(input, "blockers").some(
      (row) =>
        !principals.has(row.ownerRef) ||
        !evidenceBinds(row, "blocker", row.id, program.programManagerRef) ||
        row.revision !== computeBlockerRevision(row),
    )
  ) {
    add(
      "invalid_blocker_equality",
      "blockers",
      "The blocker ledger must exactly equal all missing, open, overdue, active-exception, expired-exception, and recertification conditions.",
    );
  }

  const handoff = input.handoff ?? {};
  const shouldBlock = expected.length > 0 || findings.length > 0;
  if (
    handoff.destination !== program.destination ||
    handoff.ownerRef !== program.handoffOwnerRef ||
    handoff.coverageDigest !== coverage.contentDigest ||
    !sameSet(handoff.blockerRefs, entries(input, "blockers").map((row) => row.id)) ||
    handoff.state !== (shouldBlock ? "blocked" : "owner-review") ||
    NOT_CLAIMED_FIELDS.some((field) => handoff[field] !== "not-claimed") ||
    handoff.payloadDigest !== computeHandoffDigest(handoff)
  ) {
    add(
      "invalid_handoff",
      "handoff",
      "The handoff must bind exact coverage and blockers and preserve every prohibited authority claim as not-claimed.",
    );
  }
  if (
    typeof handoff.summary !== "string" ||
    /\b(?:we|i|the claw|the agent)\s+(?:declared|invoked|failed over|shifted|contacted|accepted|approved|certified)\b|\b(?:ready|compliant|certified|recoverable)\b/iu.test(
      handoff.summary,
    )
  ) {
    add(
      "prohibited_authority_narrative",
      "handoff.summary",
      "The summary cannot claim declaration, invocation, failover, traffic shift, vendor contact, risk acceptance, approval, recoverability, readiness, or certification.",
    );
  }
  return findings;
}
