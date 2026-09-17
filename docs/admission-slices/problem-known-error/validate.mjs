import { createHash } from "node:crypto";

export const PROBLEM_KNOWN_ERROR_SCHEMA_VERSION =
  "awesomeClaws.problemKnownErrorCandidate.v1";
export const PUBLIC_TRUST_SCHEMA_VERSION =
  "awesomeClaws.problemKnownErrorPublicTrust.v1";

const EXPECTED_AUTHORITY = {
  incidentCorrelation: "owner-declared-only",
  rootCause: "owner-declared-only",
  workaroundApproval: "external-owner-evidence-only",
  workaroundPublication: "not-claimed",
  workaroundExecution: "not-claimed",
  productionChange: "not-claimed",
  incidentClosure: "not-claimed",
  problemClosure: "not-claimed",
  ticketMutation: "not-claimed",
  riskAcceptance: "not-claimed",
};
const SAFE_HANDOFF_SUMMARY =
  "Three owner-declared incidents share one current problem revision; one hypothesis is supported, one is refuted, an owner-executed change was followed by recurrence, and the current workaround and known error remain owner-controlled.";
const SAFE_NEXT_DECISION =
  "Escalate any known-error revision or publication, workaround renewal, production change, or problem closure to its existing owner-controlled process; the Claw makes none of those decisions.";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function object(value) {
  return isRecord(value) ? value : {};
}

function records(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function sorted(values) {
  return [...values].sort();
}

function time(value) {
  if (typeof value !== "string") {
    return null;
  }
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/u.exec(
      value,
    );
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone] =
    match;
  const [year, month, day, hour, minute, second] = [
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
  ].map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    0,
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  const zoneParts = zone === "Z" ? null : zone.slice(1).split(":").map(Number);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth[month] ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    (zoneParts && (zoneParts[0] > 23 || zoneParts[1] > 59))
  ) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapById(values) {
  return new Map(records(values).map((row) => [row.id, row]));
}

function hasScope(principal, scope) {
  return (
    principal?.kind === "named-human" &&
    Array.isArray(principal.scopes) &&
    principal.scopes.includes(scope)
  );
}

function hasTypedScope(principal, scope) {
  return Array.isArray(principal?.scopes) && principal.scopes.includes(scope);
}

function exactSet(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    sorted(actual).every((value, index) => value === sorted(expected)[index])
  );
}

function evidenceMatches(evidence, expected) {
  return (
    evidence?.kind === expected.kind &&
    evidence?.subjectRef === expected.subjectRef &&
    evidence?.subjectRevision === expected.subjectRevision &&
    evidence?.producedByRef === expected.producedByRef
  );
}

export function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (isRecord(value)) {
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

export function computeProblemRevision(problem) {
  const row = object(problem);
  return digest({
    id: row.id,
    title: row.title,
    serviceRefs: sorted(Array.isArray(row.serviceRefs) ? row.serviceRefs : []),
    declaredByRef: row.declaredByRef,
    declaredAt: row.declaredAt,
    state: row.state,
  });
}

export function computeHypothesisRevision(hypothesis) {
  const row = object(hypothesis);
  return digest({
    id: row.id,
    problemRevision: row.problemRevision,
    statement: row.statement,
    ownerRef: row.ownerRef,
    competesWithRef: row.competesWithRef,
    proposedAt: row.proposedAt,
  });
}

export function computeHypothesisDispositionRevision(hypothesis) {
  const row = object(hypothesis);
  return digest({
    id: row.id,
    revision: row.revision,
    state: row.state,
    testRefs: sorted(Array.isArray(row.testRefs) ? row.testRefs : []),
    testRevisionRefs: sorted(
      Array.isArray(row.testRevisionRefs) ? row.testRevisionRefs : [],
    ),
    observationEvidenceRefs: sorted(
      Array.isArray(row.observationEvidenceRefs)
        ? row.observationEvidenceRefs
        : [],
    ),
    revisedAt: row.revisedAt,
  });
}

export function computeIncidentMembershipRevision(membership) {
  const row = object(membership);
  return digest({
    id: row.id,
    problemRevision: row.problemRevision,
    incidentRef: row.incidentRef,
    incidentRevision: row.incidentRevision,
    followUpRef: row.followUpRef,
    followUpIdentityKey: row.followUpIdentityKey,
    declaredByRef: row.declaredByRef,
    declarationEvidenceRef: row.declarationEvidenceRef,
    incidentRecordEvidenceRef: row.incidentRecordEvidenceRef,
    declaredAt: row.declaredAt,
    state: row.state,
  });
}

export function computeTestRevision(test) {
  const row = object(test);
  return digest({
    id: row.id,
    problemRevision: row.problemRevision,
    hypothesisRef: row.hypothesisRef,
    hypothesisRevisionRef: row.hypothesisRevisionRef,
    qaArtifactRef: row.qaArtifactRef,
    testRunRef: row.testRunRef,
    buildId: row.buildId,
    environment: row.environment,
    outcome: row.outcome,
    executedByRef: row.executedByRef,
    evidenceRef: row.evidenceRef,
    executedAt: row.executedAt,
  });
}

export function computeWorkaroundRevision(workaround) {
  const row = object(workaround);
  return digest({
    id: row.id,
    problemRevision: row.problemRevision,
    hypothesisRef: row.hypothesisRef,
    hypothesisDispositionRevisionRef: row.hypothesisDispositionRevisionRef,
    instructions: row.instructions,
    state: row.state,
    approvedByRef: row.approvedByRef,
    approvalEvidenceRef: row.approvalEvidenceRef,
    approvedAt: row.approvedAt,
    expiresAt: row.expiresAt,
    publicationState: row.publicationState,
    executionState: row.executionState,
  });
}

export function computeKnownErrorRevision(knownError) {
  const row = object(knownError);
  return digest({
    id: row.id,
    problemRevision: row.problemRevision,
    causeHypothesisRef: row.causeHypothesisRef,
    causeHypothesisDispositionRevisionRef:
      row.causeHypothesisDispositionRevisionRef,
    workaroundRef: row.workaroundRef,
    workaroundRevisionRef: row.workaroundRevisionRef,
    causeState: row.causeState,
    declaredByRef: row.declaredByRef,
    declarationEvidenceRef: row.declarationEvidenceRef,
    declaredAt: row.declaredAt,
    publicationState: row.publicationState,
  });
}

export function computeChangeReceiptRevision(changeReceipt) {
  const row = object(changeReceipt);
  return digest({
    id: row.id,
    problemRevision: row.problemRevision,
    changePlanRef: row.changePlanRef,
    planDigest: row.planDigest,
    executionReceiptRef: row.executionReceiptRef,
    linkEvidenceRef: row.linkEvidenceRef,
    executedByRef: row.executedByRef,
    executedAt: row.executedAt,
    linkedAt: row.linkedAt,
    state: row.state,
    targetRefs: sorted(Array.isArray(row.targetRefs) ? row.targetRefs : []),
    verificationEvidenceRefs: sorted(
      Array.isArray(row.verificationEvidenceRefs)
        ? row.verificationEvidenceRefs
        : [],
    ),
  });
}

export function computeRecurrenceRevision(recurrence) {
  const row = object(recurrence);
  return digest({
    id: row.id,
    problemRevision: row.problemRevision,
    incidentMembershipRef: row.incidentMembershipRef,
    incidentMembershipRevisionRef: row.incidentMembershipRevisionRef,
    changeReceiptRef: row.changeReceiptRef,
    changeReceiptRevisionRef: row.changeReceiptRevisionRef,
    evidenceRef: row.evidenceRef,
    observedByRef: row.observedByRef,
    observedAt: row.observedAt,
    state: row.state,
  });
}

function updateEvidenceRevision(value, kind, subjectRef, subjectRevision) {
  for (const row of records(value.evidence)) {
    if (row.kind === kind && row.subjectRef === subjectRef) {
      row.subjectRevision = subjectRevision;
    }
  }
}

export function resealProblemKnownErrorArtifact(value) {
  const artifact = structuredClone(value);
  const problem = object(artifact.problem);
  problem.revision = computeProblemRevision(problem);

  for (const membership of records(artifact.incidentMemberships)) {
    membership.problemRevision = problem.revision;
    membership.revision = computeIncidentMembershipRevision(membership);
    updateEvidenceRevision(
      artifact,
      "incident-membership-declaration",
      membership.id,
      membership.revision,
    );
  }

  for (const hypothesis of records(artifact.hypotheses)) {
    hypothesis.problemRevision = problem.revision;
    hypothesis.revision = computeHypothesisRevision(hypothesis);
  }

  const hypothesisById = mapById(artifact.hypotheses);
  for (const test of records(artifact.tests)) {
    const hypothesis = hypothesisById.get(test.hypothesisRef);
    test.problemRevision = problem.revision;
    test.hypothesisRevisionRef = hypothesis?.revision;
    test.revision = computeTestRevision(test);
    updateEvidenceRevision(artifact, "test-result", test.id, test.revision);
  }
  const testById = mapById(artifact.tests);
  for (const hypothesis of records(artifact.hypotheses)) {
    hypothesis.testRevisionRefs = sorted(
      hypothesis.testRefs.map((ref) => testById.get(ref)?.revision),
    );
    hypothesis.dispositionRevision =
      computeHypothesisDispositionRevision(hypothesis);
    updateEvidenceRevision(
      artifact,
      "hypothesis-observation",
      hypothesis.id,
      hypothesis.dispositionRevision,
    );
  }

  const workaround = records(artifact.workarounds)[0];
  if (workaround) {
    const hypothesis = hypothesisById.get(workaround.hypothesisRef);
    workaround.problemRevision = problem.revision;
    workaround.hypothesisDispositionRevisionRef =
      hypothesis?.dispositionRevision;
    workaround.revision = computeWorkaroundRevision(workaround);
    updateEvidenceRevision(
      artifact,
      "workaround-approval",
      workaround.id,
      workaround.revision,
    );
  }

  const knownError = records(artifact.knownErrors)[0];
  if (knownError) {
    const hypothesis = hypothesisById.get(knownError.causeHypothesisRef);
    knownError.problemRevision = problem.revision;
    knownError.causeHypothesisDispositionRevisionRef =
      hypothesis?.dispositionRevision;
    knownError.workaroundRevisionRef = workaround?.revision;
    knownError.revision = computeKnownErrorRevision(knownError);
    updateEvidenceRevision(
      artifact,
      "known-error-declaration",
      knownError.id,
      knownError.revision,
    );
  }

  for (const change of records(artifact.changeReceipts)) {
    change.problemRevision = problem.revision;
    change.revision = computeChangeReceiptRevision(change);
    updateEvidenceRevision(
      artifact,
      "change-execution-receipt",
      change.id,
      change.planDigest,
    );
    updateEvidenceRevision(artifact, "change-verification", change.id, change.planDigest);
    updateEvidenceRevision(
      artifact,
      "problem-change-link",
      change.id,
      change.revision,
    );
  }
  const changeById = mapById(artifact.changeReceipts);
  const membershipById = mapById(artifact.incidentMemberships);
  for (const recurrence of records(artifact.recurrences)) {
    recurrence.problemRevision = problem.revision;
    recurrence.incidentMembershipRevisionRef = membershipById.get(
      recurrence.incidentMembershipRef,
    )?.revision;
    recurrence.changeReceiptRevisionRef = changeById.get(
      recurrence.changeReceiptRef,
    )?.revision;
    recurrence.revision = computeRecurrenceRevision(recurrence);
    const recurrenceEvidence = records(artifact.evidence).find(
      (row) => row.id === recurrence.evidenceRef,
    );
    if (recurrenceEvidence) {
      recurrenceEvidence.subjectRef = recurrence.id;
      recurrenceEvidence.subjectRevision = recurrence.revision;
    }
  }

  const coverage = object(artifact.coverage);
  coverage.principalRefs = sorted(records(artifact.principals).map((row) => row.id));
  coverage.evidenceRefs = sorted(records(artifact.evidence).map((row) => row.id));
  coverage.incidentMembershipRefs = sorted(
    records(artifact.incidentMemberships).map((row) => row.id),
  );
  coverage.hypothesisRevisionRefs = sorted(
    records(artifact.hypotheses).map((row) => row.revision),
  );
  coverage.hypothesisDispositionRevisionRefs = sorted(
    records(artifact.hypotheses).map((row) => row.dispositionRevision),
  );
  coverage.testRefs = sorted(records(artifact.tests).map((row) => row.id));
  coverage.workaroundRevisionRefs = sorted(
    records(artifact.workarounds).map((row) => row.revision),
  );
  coverage.knownErrorRevisionRefs = sorted(
    records(artifact.knownErrors).map((row) => row.revision),
  );
  coverage.changeReceiptRefs = sorted(
    records(artifact.changeReceipts).map((row) => row.id),
  );
  coverage.recurrenceRefs = sorted(records(artifact.recurrences).map((row) => row.id));
  coverage.publicTrustEvidenceRefs = sorted(
    records(artifact.evidence)
      .filter((row) => row.trust === "public")
      .map((row) => row.id),
  );
  return artifact;
}

export function problemKnownErrorFindings(value, options = {}) {
  if (!isRecord(value)) {
    return [
      {
        code: "invalid_structure",
        path: "",
        message: "The artifact must be an object.",
      },
    ];
  }

  const findings = [];
  const add = (code, path, message) => findings.push({ code, path, message });
  const cutoff = time(options.cutoff);
  const trust = object(options.publicTrustInput);
  const problem = object(value.problem);
  const principals = records(value.principals);
  const evidence = records(value.evidence);
  const memberships = records(value.incidentMemberships);
  const hypotheses = records(value.hypotheses);
  const tests = records(value.tests);
  const workarounds = records(value.workarounds);
  const knownErrors = records(value.knownErrors);
  const changes = records(value.changeReceipts);
  const recurrences = records(value.recurrences);
  const coverage = object(value.coverage);
  const authority = object(value.authority);
  const handoff = object(value.handoff);
  const principalById = mapById(principals);
  const evidenceById = mapById(evidence);
  const membershipById = mapById(memberships);
  const hypothesisById = mapById(hypotheses);
  const testById = mapById(tests);
  const changeById = mapById(changes);

  if (value.schemaVersion !== PROBLEM_KNOWN_ERROR_SCHEMA_VERSION) {
    add("invalid_schema_version", "schemaVersion", "The candidate schema version is not supported.");
  }
  for (const field of [
    "principals",
    "evidence",
    "incidentMemberships",
    "hypotheses",
    "tests",
    "workarounds",
    "knownErrors",
    "changeReceipts",
    "recurrences",
  ]) {
    if (!Array.isArray(value[field])) {
      add("invalid_structure", field, `${field} must be an array.`);
    }
  }
  if (
    cutoff === null ||
    trust.schemaVersion !== PUBLIC_TRUST_SCHEMA_VERSION ||
    typeof trust.id !== "string" ||
    typeof trust.publisher !== "string" ||
    !Array.isArray(trust.records) ||
    !Array.isArray(trust.authorityGrants) ||
    !Array.isArray(trust.evidenceRecords) ||
    ["records", "authorityGrants", "evidenceRecords"].some(
      (field) => records(trust[field]).length !== trust[field].length,
    )
  ) {
    add(
      "invalid_validation_context",
      "$context",
      "Caller-supplied cutoff and publicTrustInput are required; the artifact cannot supply current time or its own public trust.",
    );
  }

  for (const [name, rows] of [
    ["principals", principals],
    ["evidence", evidence],
    ["incidentMemberships", memberships],
    ["hypotheses", hypotheses],
    ["tests", tests],
    ["workarounds", workarounds],
    ["knownErrors", knownErrors],
    ["changeReceipts", changes],
    ["recurrences", recurrences],
  ]) {
    if (Array.isArray(value[name]) && rows.length !== value[name].length) {
      add(
        "invalid_structure",
        name,
        `${name} may contain only object records.`,
      );
    }
    const ids = rows.map((row) => row.id);
    if (new Set(ids).size !== ids.length || ids.some((id) => typeof id !== "string")) {
      add("duplicate_or_missing_identity", name, `${name} must use complete unique ids.`);
    }
  }

  for (const [index, principal] of principals.entries()) {
    if (
      !["named-human", "external-system", "claw"].includes(principal.kind) ||
      !Array.isArray(principal.scopes) ||
      principal.scopes.length === 0
    ) {
      add("invalid_typed_authority", `principals[${index}]`, "Every principal needs a typed kind and scope.");
    }

    if (
      principal.kind === "claw" &&
      !exactSet(principal.scopes, ["evidence-coordinator"])
    ) {
      add(
        "invalid_typed_authority",
        `principals[${index}].scopes`,
        "The candidate Claw may coordinate evidence only.",
      );
    }
  }
  if (
    Array.isArray(trust.authorityGrants) &&
    Array.isArray(trust.evidenceRecords)
  ) {
    const authorityPrincipals = principals.filter((row) => row.kind !== "claw");
    const authorityGrants = records(trust.authorityGrants);
    const trustedEvidence = records(trust.evidenceRecords);
    const authorityMatches =
      authorityPrincipals.length === authorityGrants.length &&
      authorityPrincipals.every((principal) => {
        const grant = authorityGrants.find(
          (row) => row.principalRef === principal.id,
        );
        return grant?.principalRecordDigest === digest(principal);
      });
    const evidenceMatchesTrust =
      evidence.length === trustedEvidence.length &&
      evidence.every((row) => {
        const trusted = trustedEvidence.find(
          (record) => record.evidenceRef === row.id,
        );
        return trusted?.evidenceRecordDigest === digest(row);
      });
    if (!authorityMatches || !evidenceMatchesTrust) {
      add(
        "invalid_caller_trust_input",
        "$context.publicTrustInput",
        "Caller trust must bind every external principal, scope, and evidence record exactly; the Claw cannot attest its own owners or records.",
      );
    }
  }

  const problemOwner = principalById.get(problem.declaredByRef);
  if (
    problem.revision !== computeProblemRevision(problem) ||
    !hasScope(problemOwner, "problem-owner") ||
    !hasScope(problemOwner, "incident-membership-declarer") ||
    problem.state !== "open" ||
    time(problem.declaredAt) === null ||
    (cutoff !== null && time(problem.declaredAt) > cutoff)
  ) {
    add(
      "invalid_problem_revision",
      "problem",
      "The problem must be an open, content-bound revision explicitly declared by its named owner before cutoff.",
    );
  }

  for (const [index, row] of evidence.entries()) {
    const observedAt = time(row.observedAt);
    const producer = principalById.get(row.producedByRef);
    if (
      !producer ||
      observedAt === null ||
      (cutoff !== null && observedAt > cutoff) ||
      (row.trust === "public" &&
        (row.kind !== "public-observation" ||
          !String(row.sourceRef).startsWith("https://") ||
          !hasTypedScope(producer, "public-source"))) ||
      (row.kind === "public-observation" && row.trust !== "public") ||
      (row.trust === "controlled-owner" &&
        !String(row.sourceRef).startsWith("controlled://"))
    ) {
      add(
        "invalid_evidence",
        `evidence[${index}]`,
        "Evidence needs a typed producer, valid source trust, and an observation no later than cutoff.",
      );
    }
  }

  if (cutoff !== null && Array.isArray(trust.records)) {
    const publicEvidence = evidence.filter((row) => row.trust === "public");
    const trustRecords = records(trust.records);
    const matches =
      publicEvidence.length === 1 &&
      trustRecords.length === publicEvidence.length &&
      publicEvidence.every((row) => {
        const trusted = trustRecords.find((record) => record.evidenceRef === row.id);
        return (
          trusted?.sourceRef === row.sourceRef &&
          trusted?.recordDigest === row.recordDigest &&
          trusted?.publishedAt === row.observedAt &&
          time(trusted.publishedAt) !== null &&
          time(trusted.publishedAt) <= cutoff
        );
      });
    if (!matches) {
      add(
        "invalid_public_trust_input",
        "$context.publicTrustInput",
        "Exactly one public evidence record must match the caller-owned trust input byte identity and publication time.",
      );
    }
  }

  if (
    memberships.length !== 3 ||
    new Set(memberships.map((row) => row.incidentRef)).size !== 3 ||
    new Set(memberships.map((row) => row.followUpRef)).size !== 3 ||
    new Set(memberships.map((row) => row.followUpIdentityKey)).size !== 3
  ) {
    add(
      "invalid_incident_membership_totality",
      "incidentMemberships",
      "The candidate slice requires exactly three distinct owner-declared incident memberships.",
    );
  }
  for (const [index, membership] of memberships.entries()) {
    const declaration = evidenceById.get(membership.declarationEvidenceRef);
    const incidentRecord = evidenceById.get(membership.incidentRecordEvidenceRef);
    if (
      membership.problemRevision !== problem.revision ||
      membership.revision !== computeIncidentMembershipRevision(membership) ||
      membership.state !== "declared-by-owner" ||
      membership.declaredByRef !== problem.declaredByRef ||
      !hasScope(principalById.get(membership.declaredByRef), "incident-membership-declarer") ||
      !evidenceMatches(declaration, {
        kind: "incident-membership-declaration",
        subjectRef: membership.id,
        subjectRevision: membership.revision,
        producedByRef: membership.declaredByRef,
      }) ||
      !["incident-record", "public-observation"].includes(incidentRecord?.kind) ||
      incidentRecord?.subjectRef !== membership.incidentRef ||
      incidentRecord?.subjectRevision !== membership.incidentRevision ||
      !hasTypedScope(
        principalById.get(incidentRecord?.producedByRef),
        "incident-record-authority",
      ) ||
      (incidentRecord?.trust === "public" &&
        !hasTypedScope(
          principalById.get(incidentRecord?.producedByRef),
          "public-source",
        )) ||
      time(membership.declaredAt) === null ||
      time(membership.declaredAt) < time(problem.declaredAt) ||
      (cutoff !== null && time(membership.declaredAt) > cutoff) ||
      time(incidentRecord?.observedAt) > time(membership.declaredAt) ||
      time(declaration?.observedAt) !== time(membership.declaredAt)
    ) {
      add(
        "invalid_incident_membership_authority",
        `incidentMemberships[${index}]`,
        "Incident correlation must be an exact owner declaration bound to an incident revision and source follow-up.",
      );
    }
  }

  const states = new Set(hypotheses.map((row) => row.state));
  if (
    hypotheses.length !== 2 ||
    !states.has("supported") ||
    !states.has("refuted") ||
    hypotheses.some(
      (row) =>
        row.competesWithRef === row.id ||
        hypothesisById.get(row.competesWithRef)?.competesWithRef !== row.id,
    )
  ) {
    add(
      "invalid_hypothesis_matrix",
      "hypotheses",
      "Exactly two reciprocal competing hypotheses must retain supported and refuted states.",
    );
  }
  for (const [index, hypothesis] of hypotheses.entries()) {
    const linkedTests = tests.filter((row) => row.hypothesisRef === hypothesis.id);
    const observationOk =
      Array.isArray(hypothesis.observationEvidenceRefs) &&
      hypothesis.observationEvidenceRefs.length > 0 &&
      hypothesis.observationEvidenceRefs.every((ref) =>
        evidenceMatches(evidenceById.get(ref), {
          kind: "hypothesis-observation",
          subjectRef: hypothesis.id,
          subjectRevision: hypothesis.dispositionRevision,
          producedByRef: hypothesis.ownerRef,
        }) &&
        time(evidenceById.get(ref)?.observedAt) === time(hypothesis.revisedAt),
      );
    const outcomes = new Set(linkedTests.map((row) => row.outcome));
    const latestTestEvidence = Math.max(
      ...linkedTests.map((row) =>
        Math.max(
          time(row.executedAt) ?? Number.POSITIVE_INFINITY,
          time(evidenceById.get(row.evidenceRef)?.observedAt) ??
            Number.POSITIVE_INFINITY,
        ),
      ),
    );
    if (
      hypothesis.problemRevision !== problem.revision ||
      hypothesis.revision !== computeHypothesisRevision(hypothesis) ||
      hypothesis.dispositionRevision !==
        computeHypothesisDispositionRevision(hypothesis) ||
      !hasScope(principalById.get(hypothesis.ownerRef), "hypothesis-owner") ||
      !exactSet(
        hypothesis.testRefs,
        linkedTests.map((row) => row.id),
      ) ||
      !exactSet(
        hypothesis.testRevisionRefs,
        linkedTests.map((row) => row.revision),
      ) ||
      !observationOk ||
      time(hypothesis.proposedAt) < time(problem.declaredAt) ||
      time(hypothesis.revisedAt) < latestTestEvidence ||
      (hypothesis.state === "supported" &&
        (!outcomes.has("supports") || outcomes.has("refutes"))) ||
      (hypothesis.state === "refuted" &&
        (!outcomes.has("refutes") || outcomes.has("supports")))
    ) {
      add(
        hypothesis.revision !== computeHypothesisRevision(hypothesis) ||
        hypothesis.dispositionRevision !==
          computeHypothesisDispositionRevision(hypothesis)
          ? "invalid_hypothesis_revision"
          : "invalid_hypothesis_matrix",
        `hypotheses[${index}]`,
        "Each hypothesis revision must be owner-bound and resolved only by its exact support or refutation test.",
      );
    }
  }

  if (
    tests.length !== 2 ||
    !exactSet(
      tests.map((row) => row.outcome),
      ["supports", "refutes"],
    )
  ) {
    add(
      "invalid_hypothesis_test_totality",
      "tests",
      "The matrix requires exactly one supporting and one refuting test.",
    );
  }
  for (const [index, row] of tests.entries()) {
    const hypothesis = hypothesisById.get(row.hypothesisRef);
    const result = evidenceById.get(row.evidenceRef);
    if (
      row.problemRevision !== problem.revision ||
      row.hypothesisRevisionRef !== hypothesis?.revision ||
      row.revision !== computeTestRevision(row) ||
      !hasScope(principalById.get(row.executedByRef), "test-executor") ||
      !evidenceMatches(result, {
        kind: "test-result",
        subjectRef: row.id,
        subjectRevision: row.revision,
        producedByRef: row.executedByRef,
      }) ||
      time(row.executedAt) === null ||
      time(row.executedAt) < time(hypothesis?.proposedAt) ||
      time(row.executedAt) > time(hypothesis?.revisedAt) ||
      time(result?.observedAt) < time(row.executedAt)
    ) {
      add(
        "invalid_hypothesis_test",
        `tests[${index}]`,
        "A support or refutation result must bind the exact hypothesis revision and attributable QA execution evidence.",
      );
    }
  }

  const workaround = workarounds[0];
  const workaroundHypothesis = hypothesisById.get(workaround?.hypothesisRef);
  const workaroundApproval = evidenceById.get(workaround?.approvalEvidenceRef);
  const workaroundTests = tests.filter(
    (row) => row.hypothesisRef === workaround?.hypothesisRef,
  );
  const latestWorkaroundInput = Math.max(
    time(workaroundHypothesis?.revisedAt) ?? Number.POSITIVE_INFINITY,
    ...workaroundTests.map((row) =>
      Math.max(
        time(row.executedAt) ?? Number.POSITIVE_INFINITY,
        time(evidenceById.get(row.evidenceRef)?.observedAt) ??
          Number.POSITIVE_INFINITY,
      ),
    ),
  );
  if (
    workarounds.length !== 1 ||
    workaround?.problemRevision !== problem.revision ||
    workaround?.hypothesisDispositionRevisionRef !==
      workaroundHypothesis?.dispositionRevision ||
    workaroundHypothesis?.state !== "supported" ||
    workaround?.revision !== computeWorkaroundRevision(workaround) ||
    !hasScope(principalById.get(workaround?.approvedByRef), "workaround-approver") ||
    !evidenceMatches(workaroundApproval, {
      kind: "workaround-approval",
      subjectRef: workaround?.id,
      subjectRevision: workaround?.revision,
      producedByRef: workaround?.approvedByRef,
    }) ||
    time(workaround?.approvedAt) === null ||
    time(workaroundApproval?.observedAt) !== time(workaround?.approvedAt) ||
    time(workaround?.approvedAt) < latestWorkaroundInput ||
    time(workaround?.expiresAt) === null ||
    (cutoff !== null &&
      (time(workaround.approvedAt) > cutoff || time(workaround.expiresAt) <= cutoff))
  ) {
    add(
      workaround?.problemRevision !== problem.revision ||
        workaround?.hypothesisDispositionRevisionRef !==
          workaroundHypothesis?.dispositionRevision
        ? "invalid_workaround_revision_binding"
        : "invalid_workaround_authority",
      "workarounds[0]",
      "The single active workaround must bind current revisions and unexpired external owner approval.",
    );
  }

  const knownError = knownErrors[0];
  const cause = hypothesisById.get(knownError?.causeHypothesisRef);
  const knownErrorDeclaration = evidenceById.get(knownError?.declarationEvidenceRef);
  if (
    knownErrors.length !== 1 ||
    knownError?.problemRevision !== problem.revision ||
    knownError?.causeHypothesisDispositionRevisionRef !==
      cause?.dispositionRevision ||
    knownError?.workaroundRef !== workaround?.id ||
    knownError?.workaroundRevisionRef !== workaround?.revision ||
    knownError?.revision !== computeKnownErrorRevision(knownError)
  ) {
    add(
      "invalid_known_error_revision_binding",
      "knownErrors[0]",
      "The known-error revision must bind the current owner-declared problem, cause hypothesis, and workaround revisions.",
    );
  }
  if (
    cause?.state !== "supported" ||
    knownError?.causeState !== "declared-by-owner" ||
    !hasScope(principalById.get(knownError?.declaredByRef), "known-error-authority") ||
    !hasScope(principalById.get(knownError?.declaredByRef), "root-cause-declarer") ||
    !evidenceMatches(knownErrorDeclaration, {
      kind: "known-error-declaration",
      subjectRef: knownError?.id,
      subjectRevision: knownError?.revision,
      producedByRef: knownError?.declaredByRef,
    }) ||
    time(knownError?.declaredAt) === null ||
    time(knownErrorDeclaration?.observedAt) !== time(knownError?.declaredAt) ||
    time(knownError?.declaredAt) <= time(workaround?.approvedAt)
  ) {
    add(
      "invalid_known_error_authority",
      "knownErrors[0]",
      "Root cause and known-error state require a typed named owner declaration after workaround approval.",
    );
  }

  const change = changes[0];
  const executionReceipt = evidenceById.get(change?.executionReceiptRef);
  const linkEvidence = evidenceById.get(change?.linkEvidenceRef);
  const verificationOk =
    Array.isArray(change?.verificationEvidenceRefs) &&
    change.verificationEvidenceRefs.length > 0 &&
    change.verificationEvidenceRefs.every((ref) => {
      const row = evidenceById.get(ref);
      return (
        evidenceMatches(row, {
          kind: "change-verification",
          subjectRef: change?.id,
          subjectRevision: change?.planDigest,
          producedByRef: row?.producedByRef,
        }) &&
        hasScope(principalById.get(row?.producedByRef), "test-executor") &&
        time(row?.observedAt) > time(change?.executedAt)
      );
    });
  const targetsStayWithinProblem =
    Array.isArray(change?.targetRefs) &&
    change.targetRefs.length > 0 &&
    Array.isArray(problem.serviceRefs) &&
    change.targetRefs.every((ref) => problem.serviceRefs.includes(ref));
  if (
    changes.length !== 1 ||
    change?.problemRevision !== problem.revision ||
    change?.revision !== computeChangeReceiptRevision(change) ||
    change?.state !== "owner-executed" ||
    !hasScope(principalById.get(change?.executedByRef), "change-executor") ||
    !evidenceMatches(executionReceipt, {
      kind: "change-execution-receipt",
      subjectRef: change?.id,
      subjectRevision: change?.planDigest,
      producedByRef: change?.executedByRef,
    }) ||
    !evidenceMatches(linkEvidence, {
      kind: "problem-change-link",
      subjectRef: change?.id,
      subjectRevision: change?.revision,
      producedByRef: problem.declaredByRef,
    }) ||
    time(change?.executedAt) === null ||
    time(executionReceipt?.observedAt) !== time(change?.executedAt) ||
    time(change?.linkedAt) === null ||
    time(linkEvidence?.observedAt) !== time(change?.linkedAt) ||
    time(change?.linkedAt) <= time(change?.executedAt) ||
    time(change?.linkedAt) < time(problem.declaredAt) ||
    (cutoff !== null && time(change?.linkedAt) > cutoff) ||
    !targetsStayWithinProblem ||
    !verificationOk
  ) {
    add(
      "invalid_change_receipt",
      "changeReceipts[0]",
      "The change must remain an external owner-executed, digest-bound receipt with later verification.",
    );
  }

  const recurrence = recurrences[0];
  const recurrenceChange = changeById.get(recurrence?.changeReceiptRef);
  const recurrenceMembership = membershipById.get(recurrence?.incidentMembershipRef);
  const recurrenceEvidence = evidenceById.get(recurrence?.evidenceRef);
  const recurrenceIncidentEvidence = evidenceById.get(
    recurrenceMembership?.incidentRecordEvidenceRef,
  );
  if (
    recurrences.length !== 1 ||
    recurrence?.problemRevision !== problem.revision ||
    recurrence?.revision !== computeRecurrenceRevision(recurrence) ||
    recurrence?.state !== "observed-after-change" ||
    !recurrenceChange ||
    recurrence?.changeReceiptRevisionRef !== recurrenceChange?.revision ||
    !recurrenceMembership ||
    recurrence?.incidentMembershipRevisionRef !== recurrenceMembership?.revision ||
    recurrence?.id !== recurrenceEvidence?.subjectRef ||
    recurrenceIncidentEvidence?.subjectRef !== recurrenceMembership?.incidentRef ||
    recurrenceIncidentEvidence?.subjectRevision !==
      recurrenceMembership?.incidentRevision ||
    !hasTypedScope(
      principalById.get(recurrence?.observedByRef),
      "incident-record-authority",
    ) ||
    !evidenceMatches(recurrenceEvidence, {
      kind: "recurrence-observation",
      subjectRef: recurrence?.id,
      subjectRevision: recurrence?.revision,
      producedByRef: recurrence?.observedByRef,
    }) ||
    time(recurrence?.observedAt) === null ||
    time(recurrenceEvidence?.observedAt) !== time(recurrence?.observedAt) ||
    time(recurrence?.observedAt) <= time(recurrenceChange?.executedAt) ||
    time(recurrenceIncidentEvidence?.observedAt) <=
      time(recurrenceChange?.executedAt) ||
    time(knownError?.declaredAt) <= time(recurrence?.observedAt)
  ) {
    add(
      "invalid_recurrence",
      "recurrences[0]",
      "The recurrence must be owner-observed in a declared incident after the external change and before the current known-error declaration.",
    );
  }

  const lifecycleEvidenceRefs = [
    ...memberships.flatMap((row) => [
      row.declarationEvidenceRef,
      row.incidentRecordEvidenceRef,
    ]),
    ...hypotheses.flatMap((row) =>
      Array.isArray(row.observationEvidenceRefs) ? row.observationEvidenceRefs : [],
    ),
    ...tests.map((row) => row.evidenceRef),
    ...workarounds.map((row) => row.approvalEvidenceRef),
    ...knownErrors.map((row) => row.declarationEvidenceRef),
    ...changes.flatMap((row) => [
      row.executionReceiptRef,
      row.linkEvidenceRef,
      ...(Array.isArray(row.verificationEvidenceRefs)
        ? row.verificationEvidenceRefs
        : []),
    ]),
    ...recurrences.map((row) => row.evidenceRef),
  ];
  const lifecyclePrincipalRefs = [
    problem.declaredByRef,
    handoff.coordinatorRef,
    ...evidence.map((row) => row.producedByRef),
    ...hypotheses.map((row) => row.ownerRef),
    ...tests.map((row) => row.executedByRef),
    ...workarounds.map((row) => row.approvedByRef),
    ...knownErrors.map((row) => row.declaredByRef),
    ...changes.map((row) => row.executedByRef),
    ...recurrences.map((row) => row.observedByRef),
  ];
  const coverageExpectations = {
    principalRefs: principals.map((row) => row.id),
    evidenceRefs: evidence.map((row) => row.id),
    incidentMembershipRefs: memberships.map((row) => row.id),
    hypothesisRevisionRefs: hypotheses.map((row) => row.revision),
    hypothesisDispositionRevisionRefs: hypotheses.map(
      (row) => row.dispositionRevision,
    ),
    testRefs: tests.map((row) => row.id),
    workaroundRevisionRefs: workarounds.map((row) => row.revision),
    knownErrorRevisionRefs: knownErrors.map((row) => row.revision),
    changeReceiptRefs: changes.map((row) => row.id),
    recurrenceRefs: recurrences.map((row) => row.id),
    publicTrustEvidenceRefs: evidence
      .filter((row) => row.trust === "public")
      .map((row) => row.id),
  };
  const lifecycleUniverseIsClosed =
    exactSet(
      principals.map((row) => row.id),
      [...new Set(lifecyclePrincipalRefs)],
    ) &&
    exactSet(
      evidence.map((row) => row.id),
      [...new Set(lifecycleEvidenceRefs)],
    );
  if (
    coverage.state !== "exact-closed" ||
    !lifecycleUniverseIsClosed ||
    Object.entries(coverageExpectations).some(
      ([field, expected]) => !exactSet(coverage[field], expected),
    )
  ) {
    add(
      "invalid_coverage",
      "coverage",
      "Exact closed coverage must equal every supplied principal, evidence, and lifecycle universe.",
    );
  }

  if (
    Object.entries(EXPECTED_AUTHORITY).some(
      ([field, expected]) => authority[field] !== expected,
    )
  ) {
    add(
      "prohibited_authority_claim",
      "authority",
      "The candidate may coordinate evidence but cannot infer, approve, publish, execute, mutate, close, or accept risk.",
    );
  }
  if (
    handoff.state !== "owner-review-ready" ||
    handoff.ownerRef !== problem.declaredByRef ||
    !hasScope(
      principalById.get(handoff.ownerRef),
      "problem-closure-authority",
    ) ||
    principalById.get(handoff.coordinatorRef)?.kind !== "claw" ||
    !hasTypedScope(
      principalById.get(handoff.coordinatorRef),
      "evidence-coordinator",
    ) ||
    handoff.private !== true ||
    handoff.summary !== SAFE_HANDOFF_SUMMARY ||
    handoff.nextDecision !== SAFE_NEXT_DECISION ||
    cutoff === null ||
    time(handoff.observedThrough) !== cutoff
  ) {
    add(
      "invalid_private_handoff",
      "handoff",
      "The private handoff must return the caller-bounded artifact to the named problem owner.",
    );
  }

  return findings.sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message),
  );
}
