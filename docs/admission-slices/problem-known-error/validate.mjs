import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  deriveIncidentArtifact,
  digest as computeOwnerArtifactDigest,
  OWNER_CONTRACTS,
} from "./composition-adapter.mjs";
import { validateArtifactSemantics } from "../../../scripts/artifact-semantics.mjs";

export const PROBLEM_KNOWN_ERROR_SCHEMA_VERSION =
  "awesomeClaws.problemKnownErrorCandidate.v1";
export const PUBLIC_TRUST_SCHEMA_VERSION =
  "awesomeClaws.problemKnownErrorPublicTrust.v1";
export const TRUST_KEYRING_SCHEMA_VERSION =
  "awesomeClaws.problemKnownErrorTrustKeyring.v1";

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateCandidateSchema = ajv.compile(
  JSON.parse(
    readFileSync(
      new URL("./problem-known-error.schema.json", import.meta.url),
      "utf8",
    ),
  ),
);
const validatePublicTrustSchema = ajv.compile(
  JSON.parse(
    readFileSync(
      new URL("./problem-known-error-public-trust.schema.json", import.meta.url),
      "utf8",
    ),
  ),
);
const validateTrustKeyringSchema = ajv.compile(
  JSON.parse(
    readFileSync(
      new URL(
        "./problem-known-error-trust-keyring.schema.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);
const incidentOwnerArtifact = JSON.parse(
  readFileSync(
    new URL(
      "../../../sources/incident-response/fixtures/incident-state.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const incidentOwnerSchema = JSON.parse(
  readFileSync(
    new URL(
      "../../../sources/incident-response/schemas/incident-state.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const qaOwnerArtifact = JSON.parse(
  readFileSync(
    new URL(
      "../../../sources/quality-assurance-lead/fixtures/test-evidence.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const qaOwnerSchema = JSON.parse(
  readFileSync(
    new URL(
      "../../../sources/quality-assurance-lead/schemas/test-evidence.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const changeOwnerArtifact = JSON.parse(
  readFileSync(
    new URL(
      "../../../sources/change-control-operator/fixtures/change-plan.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const changeOwnerSchema = JSON.parse(
  readFileSync(
    new URL(
      "../../../sources/change-control-operator/schemas/change-plan.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const validateIncidentOwnerSchema = ajv.compile(incidentOwnerSchema);
const validateQaOwnerSchema = ajv.compile(qaOwnerSchema);
const validateChangeOwnerSchema = ajv.compile(changeOwnerSchema);
const QA_OWNER_ARTIFACT_REF =
  "sources/quality-assurance-lead/fixtures/test-evidence.example.json";
const incidentOwnerContractValid =
  computeOwnerArtifactDigest(incidentOwnerArtifact) ===
    OWNER_CONTRACTS["incident-response"].artifactDigest &&
  computeOwnerArtifactDigest(incidentOwnerSchema) ===
    OWNER_CONTRACTS["incident-response"].schemaDigest &&
  validateIncidentOwnerSchema(incidentOwnerArtifact) &&
  validateArtifactSemantics(
    "incident-response",
    incidentOwnerArtifact,
  ).length === 0;
const qaOwnerContractValid =
  computeOwnerArtifactDigest(qaOwnerArtifact) ===
    OWNER_CONTRACTS["quality-assurance-lead"].artifactDigest &&
  computeOwnerArtifactDigest(qaOwnerSchema) ===
    OWNER_CONTRACTS["quality-assurance-lead"].schemaDigest &&
  validateQaOwnerSchema(qaOwnerArtifact) &&
  validateArtifactSemantics(
    "quality-assurance-lead",
    qaOwnerArtifact,
  ).length === 0;
const changeOwnerContractValid =
  computeOwnerArtifactDigest(changeOwnerArtifact) ===
    OWNER_CONTRACTS["change-control-operator"].artifactDigest &&
  computeOwnerArtifactDigest(changeOwnerSchema) ===
    OWNER_CONTRACTS["change-control-operator"].schemaDigest &&
  validateChangeOwnerSchema(changeOwnerArtifact) &&
  validateArtifactSemantics(
    "change-control-operator",
    changeOwnerArtifact,
  ).length === 0;
const MAX_ARTIFACT_BYTES = 256 * 1024;
const MAX_DEPTH = 16;
const MAX_STRING_LENGTH = 4096;
const MAX_COLLECTION_LENGTH = 256;
const MAX_OBJECT_PROPERTIES = 64;
const MAX_NODE_COUNT = 4096;
const GOVERNED_ACTION =
  "(?:accept|acceptance|accepted|accepts|approve|approval|approved|approves|authorization|authorize|authorized|authorizes|closure|close|closed|closes|correlation|declaration|declare|declared|declares|deploy|deployed|deployment|deploys|execute|executed|executes|execution|green[ -]?(?:light|lights|lighting|lit)|inference|mutate|mutated|mutates|mutation|publication|publish|published|publishes|sign(?:s|ed|ing)?[ -]?off)";
const GOVERNED_OBJECT =
  "(?:workarounds?|known[ -]?errors?|production|changes?|incidents?|problems?|tickets?|risks?)";
const PROHIBITED_ACTION = new RegExp(
  `\\b(?:${GOVERNED_ACTION})\\b[^.!?;]*?\\b(?:${GOVERNED_OBJECT})\\b|\\b(?:${GOVERNED_OBJECT})\\b[^.!?;]*?\\b(?:${GOVERNED_ACTION})\\b|\\b(?:correlate|correlated|correlates)\\b[^.!?;]*?\\bincidents?\\b|\\b(?:infer|inferred|infers|declare|declared|declares)\\b[^.!?;]*?\\broot cause\\b`,
  "iu",
);
const NEGATED_PROHIBITED_ACTION = new RegExp(
  `\\b(?:(?:(?:did|does|do|can|could|must|will|would|should|has|have|had|was|were|is|are)\\s+(?:not|never)|cannot|can't|never)\\s+(?:(?:actually|directly|ever|immediately|intentionally)\\s+)?|no\\s+)(?:${GOVERNED_ACTION}|correlate|correlated|correlates|infer|inferred|infers|declare|declared|declares)(?:\\s+(?:and|or)\\s+(?:(?:actually|directly|ever|immediately|intentionally)\\s+)?(?:${GOVERNED_ACTION}|correlate|correlated|correlates|infer|inferred|infers|declare|declared|declares))*\\b`,
  "giu",
);
const CLAW_ACTOR =
  /\b(?:agent|assistant|automation|bot|chatbot|claw|coordinator|copilot|package|system|we|i)\b/iu;
const OWNER_ACTOR =
  /\b(?:problem|service|known-error|change|incident|risk|ticket)\s+owner\b/iu;
const NAMED_HUMAN_SUBJECT =
  /^(?!(?:A|An|He|I|It|She|That|The|They|This|We|You)\b)[A-Z][\p{L}'-]*(?:\s+[A-Z][\p{L}'-]*){0,3}\b/u;

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
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/u.exec(
      value,
    );
  if (!match) return null;
  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    ,
    zone,
  ] = match;
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

function indexedBy(rows, field) {
  const map = new Map();
  const duplicates = new Set();
  for (const row of records(rows)) {
    const key = row[field];
    if (map.has(key)) duplicates.add(key);
    map.set(key, row);
  }
  return { map, duplicates };
}

function boundedInputFindings(value, rootPath) {
  const findings = [];
  const stack = [{ value, depth: 0, path: rootPath, ancestors: new Set() }];
  let nodeCount = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    nodeCount += 1;
    if (nodeCount > MAX_NODE_COUNT) {
      findings.push({
        code: "invalid_cardinality",
        path: current.path,
        message: `Input exceeds ${MAX_NODE_COUNT} total values.`,
      });
      break;
    }
    if (current.depth > MAX_DEPTH) {
      findings.push({
        code: "invalid_depth",
        path: current.path,
        message: `Input exceeds maximum depth ${MAX_DEPTH}.`,
      });
      continue;
    }
    if (typeof current.value === "string") {
      if (current.value.length > MAX_STRING_LENGTH) {
        findings.push({
          code: "invalid_string_length",
          path: current.path,
          message: `String exceeds ${MAX_STRING_LENGTH} characters.`,
        });
      }
      continue;
    }
    if (current.value === null) continue;
    if (typeof current.value !== "object") {
      if (
        !["boolean", "number"].includes(typeof current.value) ||
        (typeof current.value === "number" &&
          !Number.isFinite(current.value))
      ) {
        findings.push({
          code: "invalid_structure",
          path: current.path,
          message: "Input may contain only JSON-compatible values.",
        });
      }
      continue;
    }
    if (current.ancestors.has(current.value)) {
      findings.push({
        code: "invalid_structure",
        path: current.path,
        message: "Input must not contain cyclic references.",
      });
      continue;
    }
    const childAncestors = new Set(current.ancestors);
    childAncestors.add(current.value);
    if (Array.isArray(current.value)) {
      if (current.value.length > MAX_COLLECTION_LENGTH) {
        findings.push({
          code: "invalid_collection_size",
          path: current.path,
          message: `Array exceeds ${MAX_COLLECTION_LENGTH} entries.`,
        });
        continue;
      }
      current.value.forEach((child, index) =>
        stack.push({
          value: child,
          depth: current.depth + 1,
          path: `${current.path}[${index}]`,
          ancestors: childAncestors,
        }),
      );
      continue;
    }
    const entries = Object.entries(current.value);
    if (entries.length > MAX_OBJECT_PROPERTIES) {
      findings.push({
        code: "invalid_cardinality",
        path: current.path,
        message: `Object exceeds ${MAX_OBJECT_PROPERTIES} properties.`,
      });
      continue;
    }
    for (const [key, child] of entries) {
      stack.push({
        value: child,
        depth: current.depth + 1,
        path: `${current.path}.${key}`,
        ancestors: childAncestors,
      });
    }
  }
  if (findings.length === 0) {
    const serialized = JSON.stringify(value);
    if (
      typeof serialized === "string" &&
      Buffer.byteLength(serialized, "utf8") > MAX_ARTIFACT_BYTES
    ) {
      findings.push({
        code: "invalid_byte_size",
        path: rootPath,
        message: `Input exceeds ${MAX_ARTIFACT_BYTES} UTF-8 bytes.`,
      });
    }
  }
  return findings;
}

export function isVerifiedHumanPrincipal(principal) {
  return (
    principal?.kind === "named-human" &&
    typeof principal.identityCredentialRef === "string" &&
    principal.identityCredentialRef.length > 0
  );
}

function hasScope(principal, scope, verifiedHumanRefs) {
  return (
    isVerifiedHumanPrincipal(principal) &&
    verifiedHumanRefs.has(principal.id) &&
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

function hasProhibitedNarrativeClaim(text) {
  if (typeof text !== "string") return false;
  let actorInContext = false;
  for (const sentence of text.split(/(?<=[.!?;])\s+/u)) {
    for (const clause of sentence.split(
      /\b(?:and|but|however)\b|,\s*(?:then\s+)?/iu,
    )) {
      if (CLAW_ACTOR.test(clause)) {
        actorInContext = true;
      } else if (
        OWNER_ACTOR.test(clause) ||
        NAMED_HUMAN_SUBJECT.test(clause.trim())
      ) {
        actorInContext = false;
      }
      const positiveText = clause.replace(NEGATED_PROHIBITED_ACTION, "");
      if (actorInContext && PROHIBITED_ACTION.test(positiveText)) {
        return true;
      }
    }
  }
  return false;
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

export function computeAuthorityGrantDigest(grant) {
  const row = object(grant);
  return digest({
    principalRef: row.principalRef,
    principalRecordDigest: row.principalRecordDigest,
    issuerRef: row.issuerRef,
    scopes: sorted(Array.isArray(row.scopes) ? row.scopes : []),
    validFrom: row.validFrom,
    expiresAt: row.expiresAt,
  });
}

export function computeIdentityCredentialDigest(credential) {
  const row = object(credential);
  return digest({
    id: row.id,
    principalRef: row.principalRef,
    principalRecordDigest: row.principalRecordDigest,
    assurance: row.assurance,
    subjectKeyId: row.subjectKeyId,
    issuerRef: row.issuerRef,
    validFrom: row.validFrom,
    expiresAt: row.expiresAt,
  });
}

export function computeEvidenceClaimDigest(record) {
  const row = object(record);
  return digest({
    evidenceRef: row.evidenceRef,
    evidenceRecordDigest: row.evidenceRecordDigest,
    issuerRef: row.issuerRef,
  });
}

export function computeSourceAttestationDigest(record) {
  const row = object(record);
  return digest({
    evidenceRef: row.evidenceRef,
    sourceRef: row.sourceRef,
    sourceBytesDigest: row.sourceBytesDigest,
    evidenceRecordDigest: row.evidenceRecordDigest,
    observedAt: row.observedAt,
    issuerRef: row.issuerRef,
  });
}

export function computeOwnerReceiptDigest(receipt) {
  const row = object(receipt);
  return digest({
    id: row.id,
    evidenceRef: row.evidenceRef,
    evidenceRecordDigest: row.evidenceRecordDigest,
    ownerRef: row.ownerRef,
    consumedRevisionRefs: sorted(
      Array.isArray(row.consumedRevisionRefs)
        ? row.consumedRevisionRefs
        : [],
    ),
    issuedAt: row.issuedAt,
    issuerRef: row.issuerRef,
    signerKeyId: row.signerKeyId,
  });
}

export function signedCollectionPayload(kind, recordsValue) {
  return Buffer.from(
    canonicalJson({
      kind,
      digest: digest(recordsValue),
    }),
    "utf8",
  );
}

function verifiesDigestSignature(key, kind, digestValue, signature) {
  if (
    key?.algorithm !== "ed25519" ||
    typeof key.publicKeyPem !== "string" ||
    typeof signature !== "string"
  ) {
    return false;
  }
  try {
    const parsedKey = createPublicKey(key.publicKeyPem);
    if (parsedKey.asymmetricKeyType !== "ed25519") {
      return false;
    }
    return verifySignature(
      null,
      Buffer.from(canonicalJson({ kind, digest: digestValue }), "utf8"),
      parsedKey,
      Buffer.from(signature, "base64"),
    );
  } catch {
    return false;
  }
}

function publicKeyFingerprint(key) {
  if (key?.algorithm !== "ed25519" || typeof key.publicKeyPem !== "string") {
    return null;
  }
  try {
    const parsedKey = createPublicKey(key.publicKeyPem);
    if (parsedKey.asymmetricKeyType !== "ed25519") {
      return null;
    }
    return `sha256:${createHash("sha256")
      .update(
        parsedKey.export({
          type: "spki",
          format: "der",
        }),
      )
      .digest("hex")}`;
  } catch {
    return null;
  }
}

function verifiesCollectionSignature(key, kind, rows, signature) {
  return verifiesDigestSignature(key, kind, digest(rows), signature);
}

export function computeProblemRevision(problem) {
  const row = object(problem);
  return digest({
    id: row.id,
    predecessorArtifactDigest: row.predecessorArtifactDigest,
    predecessorRevisionRef: row.predecessorRevisionRef,
    declarationEvidenceRef: row.declarationEvidenceRef,
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
    ownerArtifactDigest: row.ownerArtifactDigest,
    ownerSchemaDigest: row.ownerSchemaDigest,
    declaredByRef: row.declaredByRef,
    declarationEvidenceRef: row.declarationEvidenceRef,
    incidentRecordEvidenceRef: row.incidentRecordEvidenceRef,
    declaredAt: row.declaredAt,
    state: row.state,
  });
}

export function computeIncidentManifestRevision(manifest) {
  const row = object(manifest);
  return digest({
    id: row.id,
    problemRevision: row.problemRevision,
    membershipRevisionRefs: sorted(
      Array.isArray(row.membershipRevisionRefs)
        ? row.membershipRevisionRefs
        : [],
    ),
    signedByRef: row.signedByRef,
    signatureEvidenceRef: row.signatureEvidenceRef,
    signedAt: row.signedAt,
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
    ownerArtifactDigest: row.ownerArtifactDigest,
    ownerSchemaDigest: row.ownerSchemaDigest,
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
    ownerArtifactDigest: row.ownerArtifactDigest,
    ownerSchemaDigest: row.ownerSchemaDigest,
    ownerPlanDigest: row.ownerPlanDigest,
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

function proseSurface(value) {
  return {
    problemTitle: object(value.problem).title,
    hypothesisStatements: records(value.hypotheses).map((row) => ({
      id: row.id,
      statement: row.statement,
    })),
    workaroundInstructions: records(value.workarounds).map((row) => ({
      id: row.id,
      instructions: row.instructions,
    })),
    handoff: {
      summary: object(value.handoff).summary,
      nextDecision: object(value.handoff).nextDecision,
    },
  };
}

export function computeProseSurfaceDigest(value) {
  return digest(proseSurface(value));
}

export function computeProseAttestationRevision(attestation) {
  const row = object(attestation);
  return digest({
    id: row.id,
    ownerRef: row.ownerRef,
    surfaceDigest: row.surfaceDigest,
    receiptEvidenceRef: row.receiptEvidenceRef,
    signedAt: row.signedAt,
    policy: row.policy,
  });
}

export function resealProblemKnownErrorArtifact(value) {
  const artifact = structuredClone(value);
  const problem = object(artifact.problem);
  problem.revision = computeProblemRevision(problem);

  for (const membership of records(artifact.incidentMemberships)) {
    membership.revision = computeIncidentMembershipRevision(membership);
  }
  const incidentManifest = object(artifact.incidentManifest);
  if (Object.keys(incidentManifest).length > 0) {
    incidentManifest.revision =
      computeIncidentManifestRevision(incidentManifest);
  }

  for (const hypothesis of records(artifact.hypotheses)) {
    hypothesis.revision = computeHypothesisRevision(hypothesis);
    hypothesis.dispositionRevision =
      computeHypothesisDispositionRevision(hypothesis);
  }

  for (const test of records(artifact.tests)) {
    test.revision = computeTestRevision(test);
  }
  for (const workaround of records(artifact.workarounds)) {
    workaround.revision = computeWorkaroundRevision(workaround);
  }
  for (const knownError of records(artifact.knownErrors)) {
    knownError.revision = computeKnownErrorRevision(knownError);
  }
  for (const change of records(artifact.changeReceipts)) {
    change.revision = computeChangeReceiptRevision(change);
  }
  for (const recurrence of records(artifact.recurrences)) {
    recurrence.revision = computeRecurrenceRevision(recurrence);
  }
  const proseAttestation = object(artifact.proseAttestation);
  if (Object.keys(proseAttestation).length > 0) {
    proseAttestation.surfaceDigest =
      computeProseSurfaceDigest(artifact);
    proseAttestation.revision =
      computeProseAttestationRevision(proseAttestation);
  }
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

  const boundedFindings = [
    ...boundedInputFindings(value, "$"),
    ...(options.publicTrustInput === undefined
      ? []
      : boundedInputFindings(
          options.publicTrustInput,
          "$context.publicTrustInput",
        )),
    ...(options.trustKeyring === undefined
      ? []
      : boundedInputFindings(
          options.trustKeyring,
          "$context.trustKeyring",
        )),
  ];
  if (boundedFindings.length > 0) {
    return boundedFindings.sort(
      (left, right) =>
        left.path.localeCompare(right.path) ||
        left.code.localeCompare(right.code) ||
        left.message.localeCompare(right.message),
    );
  }

  const findings = [];
  const add = (code, path, message) => findings.push({ code, path, message });
  const cutoff = time(options.cutoff);
  const trust = object(options.publicTrustInput);
  const trustKeyring = object(options.trustKeyring);
  if (!validateCandidateSchema(value)) {
    add(
      "invalid_schema",
      "$",
      `Artifact schema validation failed: ${ajv.errorsText(validateCandidateSchema.errors)}`,
    );
  }
  if (!validatePublicTrustSchema(trust)) {
    add(
      "invalid_public_trust_schema",
      "$context.publicTrustInput",
      `Public trust schema validation failed: ${ajv.errorsText(validatePublicTrustSchema.errors)}`,
    );
  }
  if (!validateTrustKeyringSchema(trustKeyring)) {
    add(
      "invalid_trust_keyring",
      "$context.trustKeyring",
      `Trust keyring schema validation failed: ${ajv.errorsText(validateTrustKeyringSchema.errors)}`,
    );
  }
  const problem = object(value.problem);
  const principals = records(value.principals);
  const evidence = records(value.evidence);
  const memberships = records(value.incidentMemberships);
  const incidentManifest = object(value.incidentManifest);
  const hypotheses = records(value.hypotheses);
  const tests = records(value.tests);
  const workarounds = records(value.workarounds);
  const knownErrors = records(value.knownErrors);
  const changes = records(value.changeReceipts);
  const recurrences = records(value.recurrences);
  const proseAttestation = object(value.proseAttestation);
  const coverage = object(value.coverage);
  const authority = object(value.authority);
  const handoff = object(value.handoff);
  const principalById = mapById(principals);
  const evidenceById = mapById(evidence);
  const membershipById = mapById(memberships);
  const hypothesisById = mapById(hypotheses);
  const testById = mapById(tests);
  const changeById = mapById(changes);
  const verifiedHumanRefs = new Set();

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
    trustKeyring.schemaVersion !== TRUST_KEYRING_SCHEMA_VERSION ||
    !Array.isArray(trustKeyring.allowedIssuerRefs) ||
    !Array.isArray(trustKeyring.keys) ||
    trust.schemaVersion !== PUBLIC_TRUST_SCHEMA_VERSION ||
    typeof trust.id !== "string" ||
    typeof trust.publisher !== "string" ||
    !Array.isArray(trust.records) ||
    !Array.isArray(trust.identityCredentials) ||
    !Array.isArray(trust.authorityGrants) ||
    !Array.isArray(trust.evidenceRecords) ||
    !Array.isArray(trust.sourceRecords) ||
    !Array.isArray(trust.ownerReceipts) ||
    [
      "records",
      "identityCredentials",
      "authorityGrants",
      "evidenceRecords",
      "sourceRecords",
      "ownerReceipts",
    ].some(
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
      principal.scopes.length === 0 ||
      (principal.kind === "named-human" &&
        !isVerifiedHumanPrincipal(principal))
    ) {
      add(
        "invalid_typed_authority",
        `principals[${index}]`,
        "Every principal needs a typed kind and scope, and human authority cannot use an agent or package identity.",
      );
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
    Array.isArray(trust.identityCredentials) &&
    Array.isArray(trust.authorityGrants) &&
    Array.isArray(trust.evidenceRecords) &&
    Array.isArray(trust.sourceRecords) &&
    Array.isArray(trust.ownerReceipts) &&
    Array.isArray(trustKeyring.allowedIssuerRefs) &&
    Array.isArray(trustKeyring.keys)
  ) {
    const identityCredentials = records(trust.identityCredentials);
    const authorityPrincipals = principals.filter((row) => row.kind !== "claw");
    const authorityGrants = records(trust.authorityGrants);
    const trustedEvidence = records(trust.evidenceRecords);
    const sourceRecords = records(trust.sourceRecords);
    const ownerReceipts = records(trust.ownerReceipts);
    const credentialIdIndex = indexedBy(identityCredentials, "id");
    const credentialPrincipalIndex = indexedBy(
      identityCredentials,
      "principalRef",
    );
    const authorityIndex = indexedBy(authorityGrants, "principalRef");
    const trustedEvidenceIndex = indexedBy(trustedEvidence, "evidenceRef");
    const sourceIndex = indexedBy(sourceRecords, "evidenceRef");
    const ownerReceiptIdIndex = indexedBy(ownerReceipts, "id");
    const ownerReceiptEvidenceIndex = indexedBy(ownerReceipts, "evidenceRef");
    const trustIssuer = object(trust.issuer);
    const trustKeys = records(trustKeyring.keys);
    const trustKeyIndex = indexedBy(trustKeys, "id");
    const principalKeyIndex = indexedBy(
      trustKeys.filter((key) => key.kind === "principal"),
      "principalRef",
    );
    const keyFingerprints = trustKeys.map(publicKeyFingerprint);
    const issuerKey = trustKeyIndex.map.get(trustIssuer.keyId);
    const trustAnchorMatches =
      trustKeyIndex.duplicates.size === 0 &&
      principalKeyIndex.duplicates.size === 0 &&
      keyFingerprints.every((fingerprint) => fingerprint !== null) &&
      new Set(keyFingerprints).size === keyFingerprints.length &&
      trustKeyring.allowedIssuerRefs.includes(trustIssuer.id) &&
      issuerKey?.kind === "issuer" &&
      issuerKey?.principalRef === null &&
      issuerKey?.issuerRef === trustIssuer.id &&
      issuerKey?.keyRef === trustIssuer.keyRef &&
      issuerKey?.algorithm === trustIssuer.algorithm;
    const governedUses = [
      { principalRef: problem.declaredByRef, at: problem.declaredAt },
      ...memberships.map((row) => ({
        principalRef: row.declaredByRef,
        at: row.declaredAt,
      })),
      {
        principalRef: incidentManifest.signedByRef,
        at: incidentManifest.signedAt,
      },
      ...hypotheses.flatMap((row) => [
        { principalRef: row.ownerRef, at: row.proposedAt },
        { principalRef: row.ownerRef, at: row.revisedAt },
      ]),
      ...tests.map((row) => ({
        principalRef: row.executedByRef,
        at: row.executedAt,
      })),
      ...workarounds.map((row) => ({
        principalRef: row.approvedByRef,
        at: row.approvedAt,
      })),
      ...knownErrors.map((row) => ({
        principalRef: row.declaredByRef,
        at: row.declaredAt,
      })),
      ...changes.map((row) => ({
        principalRef: row.executedByRef,
        at: row.executedAt,
      })),
      ...recurrences.map((row) => ({
        principalRef: row.observedByRef,
        at: row.observedAt,
      })),
      ...evidence.map((row) => ({
        principalRef: row.producedByRef,
        at: row.observedAt,
      })),
    ];
    const signaturesValid = [
      ["identityCredentials", identityCredentials],
      ["authorityGrants", authorityGrants],
      ["evidenceRecords", trustedEvidence],
      ["sourceRecords", sourceRecords],
      ["ownerReceipts", ownerReceipts],
    ].every(([kind, rows]) =>
      verifiesCollectionSignature(
        issuerKey,
        kind,
        rows,
        object(trust.signatures)[kind],
      ),
    );
    const humanPrincipals = principals.filter(
      (principal) => principal.kind === "named-human",
    );
    const credentialsMatch =
      humanPrincipals.length === identityCredentials.length &&
      credentialIdIndex.duplicates.size === 0 &&
      credentialPrincipalIndex.duplicates.size === 0 &&
      humanPrincipals.every((principal) => {
        const credential = credentialPrincipalIndex.map.get(principal.id);
        const firstUse = Math.min(
          ...governedUses
            .filter((use) => use.principalRef === principal.id)
            .map((use) => time(use.at))
            .filter((value) => value !== null),
        );
        const subjectKey = trustKeyIndex.map.get(
          credential?.subjectKeyId,
        );
        const valid =
          credential?.id === principal.identityCredentialRef &&
          credential?.principalRecordDigest === digest(principal) &&
          credential?.assurance === "verified-human" &&
          subjectKey?.kind === "principal" &&
          subjectKey?.principalRef === principal.id &&
          subjectKey?.issuerRef === trustIssuer.id &&
          credential?.issuerRef === trustIssuer.id &&
          credential?.credentialDigest ===
            computeIdentityCredentialDigest(credential) &&
          time(credential?.validFrom) !== null &&
          time(credential?.validFrom) <= firstUse &&
          time(credential?.expiresAt) !== null &&
          cutoff !== null &&
          time(credential?.expiresAt) > cutoff;
        if (valid) verifiedHumanRefs.add(principal.id);
        return valid;
      });
    const authorityMatches =
      authorityPrincipals.length === authorityGrants.length &&
      authorityIndex.duplicates.size === 0 &&
      authorityPrincipals.every((principal) => {
        const grant = authorityIndex.map.get(principal.id);
        const firstUse = Math.min(
          ...governedUses
            .filter((use) => use.principalRef === principal.id)
            .map((use) => time(use.at))
            .filter((value) => value !== null),
        );
        return (
          grant?.principalRecordDigest === digest(principal) &&
          grant?.issuerRef === trustIssuer.id &&
          exactSet(grant?.scopes, principal.scopes) &&
          grant?.grantDigest === computeAuthorityGrantDigest(grant) &&
          time(grant?.validFrom) !== null &&
          time(grant?.validFrom) <= firstUse &&
          time(grant?.expiresAt) !== null &&
          cutoff !== null &&
          time(grant?.expiresAt) > cutoff
        );
      });
    const evidenceMatchesTrust =
      evidence.length === trustedEvidence.length &&
      trustedEvidenceIndex.duplicates.size === 0 &&
      evidence.every((row) => {
        const trusted = trustedEvidenceIndex.map.get(row.id);
        return (
          trusted?.evidenceRecordDigest === digest(row) &&
          trusted?.issuerRef === trustIssuer.id &&
          trusted?.claimDigest === computeEvidenceClaimDigest(trusted)
        );
      });
    const sourceBytesMatch =
      evidence.length === sourceRecords.length &&
      sourceIndex.duplicates.size === 0 &&
      evidence.every((row) => {
        const source = sourceIndex.map.get(row.id);
        return (
          source?.sourceRef === row.sourceRef &&
          source?.sourceBytesDigest === row.recordDigest &&
          source?.evidenceRecordDigest === digest(row) &&
          source?.observedAt === row.observedAt &&
          source?.issuerRef === trustIssuer.id &&
          source?.attestationDigest ===
            computeSourceAttestationDigest(source)
        );
      });
    const ownerReceiptExpectations = [
      {
        evidenceRef: problem.declarationEvidenceRef,
        ownerRef: problem.declaredByRef,
        consumedRevisionRefs: [
          problem.revision,
          problem.predecessorArtifactDigest,
          problem.predecessorRevisionRef,
        ],
        consumedAt: problem.declaredAt,
      },
      ...memberships.map((row) => ({
        evidenceRef: row.declarationEvidenceRef,
        ownerRef: row.declaredByRef,
        consumedRevisionRefs: [row.revision],
        consumedAt: row.declaredAt,
      })),
      {
        evidenceRef: incidentManifest.signatureEvidenceRef,
        ownerRef: incidentManifest.signedByRef,
        consumedRevisionRefs: [incidentManifest.revision],
        consumedAt: incidentManifest.signedAt,
      },
      ...hypotheses.flatMap((row) =>
        (Array.isArray(row.observationEvidenceRefs)
          ? row.observationEvidenceRefs
          : []
        ).map((evidenceRef) => ({
          evidenceRef,
          ownerRef: row.ownerRef,
          consumedRevisionRefs: [row.dispositionRevision],
          consumedAt: row.revisedAt,
        })),
      ),
      ...tests.map((row) => ({
        evidenceRef: row.evidenceRef,
        ownerRef: row.executedByRef,
        consumedRevisionRefs: [row.revision],
        consumedAt: row.executedAt,
      })),
      ...workarounds.map((row) => ({
        evidenceRef: row.approvalEvidenceRef,
        ownerRef: row.approvedByRef,
        consumedRevisionRefs: [row.revision],
        consumedAt: row.approvedAt,
      })),
      ...knownErrors.map((row) => ({
        evidenceRef: row.declarationEvidenceRef,
        ownerRef: row.declaredByRef,
        consumedRevisionRefs: [row.revision],
        consumedAt: row.declaredAt,
      })),
      ...changes.flatMap((row) => [
        {
          evidenceRef: row.executionReceiptRef,
          ownerRef: row.executedByRef,
          consumedRevisionRefs: [row.planDigest, row.ownerArtifactDigest],
          consumedAt: row.executedAt,
        },
        {
          evidenceRef: row.linkEvidenceRef,
          ownerRef: problem.declaredByRef,
          consumedRevisionRefs: [row.revision],
          consumedAt: row.linkedAt,
        },
        ...(Array.isArray(row.verificationEvidenceRefs)
          ? row.verificationEvidenceRefs.map((evidenceRef) => ({
              evidenceRef,
              ownerRef: evidenceById.get(evidenceRef)?.producedByRef,
              consumedRevisionRefs: [row.planDigest, row.ownerArtifactDigest],
              consumedAt: evidenceById.get(evidenceRef)?.observedAt,
            }))
          : []),
      ]),
      ...recurrences.map((row) => ({
        evidenceRef: row.evidenceRef,
        ownerRef: row.observedByRef,
        consumedRevisionRefs: [row.revision],
        consumedAt: row.observedAt,
      })),
      {
        evidenceRef: proseAttestation.receiptEvidenceRef,
        ownerRef: proseAttestation.ownerRef,
        consumedRevisionRefs: [proseAttestation.revision],
        consumedAt: proseAttestation.signedAt,
      },
    ];
    const ownerReceiptsMatch =
      ownerReceipts.length === ownerReceiptExpectations.length &&
      ownerReceiptIdIndex.duplicates.size === 0 &&
      ownerReceiptEvidenceIndex.duplicates.size === 0 &&
      ownerReceiptExpectations.every((expected) => {
        const receipt = ownerReceiptEvidenceIndex.map.get(
          expected.evidenceRef,
        );
        const evidenceRecord = evidenceById.get(expected.evidenceRef);
        const ownerPrincipal = principalById.get(receipt?.ownerRef);
        const expectedSignerKeyId =
          ownerPrincipal?.kind === "named-human"
            ? credentialPrincipalIndex.map.get(receipt?.ownerRef)
                ?.subjectKeyId
            : principalKeyIndex.map.get(receipt?.ownerRef)?.id;
        return (
          evidenceRecord !== undefined &&
          receipt?.ownerRef === expected.ownerRef &&
          receipt?.issuerRef === trustIssuer.id &&
          receipt?.evidenceRecordDigest === digest(evidenceRecord) &&
          receipt?.signerKeyId !== issuerKey?.id &&
          receipt?.signerKeyId === expectedSignerKeyId &&
          trustKeyIndex.map.get(receipt?.signerKeyId)?.kind ===
            "principal" &&
          trustKeyIndex.map.get(receipt?.signerKeyId)?.principalRef ===
            receipt?.ownerRef &&
          trustKeyIndex.map.get(receipt?.signerKeyId)?.issuerRef ===
            trustIssuer.id &&
          exactSet(
            receipt?.consumedRevisionRefs,
            expected.consumedRevisionRefs,
          ) &&
          receipt?.receiptDigest === computeOwnerReceiptDigest(receipt) &&
          verifiesDigestSignature(
            trustKeyIndex.map.get(receipt?.signerKeyId),
            "ownerReceipt",
            receipt?.receiptDigest,
            receipt?.signature,
          ) &&
          time(receipt?.issuedAt) !== null &&
          time(receipt?.issuedAt) > time(expected.consumedAt) &&
          time(receipt?.issuedAt) >= time(evidenceRecord?.observedAt) &&
          cutoff !== null &&
          time(receipt?.issuedAt) <= cutoff
        );
      });
    if (
      !signaturesValid ||
      !trustAnchorMatches ||
      !credentialsMatch ||
      !authorityMatches ||
      !evidenceMatchesTrust ||
      !sourceBytesMatch ||
      !ownerReceiptsMatch
    ) {
      add(
        "invalid_caller_trust_input",
        "$context.publicTrustInput",
        "Caller trust must verify human credentials, scoped grants, evidence claims, and source bytes with an allowlisted issuer key, plus each later owner receipt with its credential-bound principal key.",
      );
    }
  }

  const problemOwner = principalById.get(problem.declaredByRef);
  const problemDeclaration = evidenceById.get(problem.declarationEvidenceRef);
  if (
    problem.revision !== computeProblemRevision(problem) ||
    problem.predecessorArtifactDigest === problem.revision ||
    problem.predecessorRevisionRef === problem.revision ||
    !hasScope(problemOwner, "problem-owner", verifiedHumanRefs) ||
    !hasScope(
      problemOwner,
      "incident-membership-declarer",
      verifiedHumanRefs,
    ) ||
    problem.state !== "open" ||
    time(problem.declaredAt) === null ||
    !evidenceMatches(problemDeclaration, {
      kind: "problem-revision-declaration",
      subjectRef: problem.id,
      subjectRevision: problem.revision,
      producedByRef: problem.declaredByRef,
    }) ||
    time(problemDeclaration?.observedAt) <= time(problem.declaredAt) ||
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
    const trustRecordIndex = indexedBy(trustRecords, "evidenceRef");
    const matches =
      publicEvidence.length === 1 &&
      trustRecords.length === publicEvidence.length &&
      trustRecordIndex.duplicates.size === 0 &&
      publicEvidence.every((row) => {
        const trusted = trustRecordIndex.map.get(row.id);
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

  const incidentManifestEvidence = evidenceById.get(
    incidentManifest.signatureEvidenceRef,
  );
  const latestMembershipDeclaration = Math.max(
    ...memberships.map(
      (membership) =>
        time(membership.declaredAt) ?? Number.POSITIVE_INFINITY,
    ),
  );
  if (
    incidentManifest.problemRevision !== problem.revision ||
    incidentManifest.revision !==
      computeIncidentManifestRevision(incidentManifest) ||
    incidentManifest.state !== "owner-signed" ||
    incidentManifest.signedByRef !== problem.declaredByRef ||
    !hasScope(
      principalById.get(incidentManifest.signedByRef),
      "incident-membership-declarer",
      verifiedHumanRefs,
    ) ||
    !exactSet(
      incidentManifest.membershipRevisionRefs,
      memberships.map((row) => row.revision),
    ) ||
    !evidenceMatches(incidentManifestEvidence, {
      kind: "incident-membership-manifest-signature",
      subjectRef: incidentManifest.id,
      subjectRevision: incidentManifest.revision,
      producedByRef: incidentManifest.signedByRef,
    }) ||
    time(incidentManifest.signedAt) === null ||
    time(incidentManifestEvidence?.observedAt) <=
      time(incidentManifest.signedAt) ||
    time(incidentManifest.signedAt) <= latestMembershipDeclaration ||
    (cutoff !== null && time(incidentManifest.signedAt) > cutoff)
  ) {
    add(
      "invalid_incident_manifest",
      "incidentManifest",
      "The complete incident universe requires one later independently trusted owner signature over every membership revision.",
    );
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
    const membershipIdentityValid = [
      membership.incidentRef,
      membership.followUpRef,
      membership.followUpIdentityKey,
    ].every((value) => typeof value === "string");
    const ownerArtifact = membershipIdentityValid
      ? deriveIncidentArtifact(incidentOwnerArtifact, membership)
      : null;
    const ownerArtifactDigest = ownerArtifact
      ? computeOwnerArtifactDigest(ownerArtifact)
      : null;
    const ownerArtifactResolved =
      ownerArtifact !== null &&
      incidentOwnerContractValid &&
      validateIncidentOwnerSchema(ownerArtifact) &&
      validateArtifactSemantics("incident-response", ownerArtifact)
        .length === 0 &&
      ownerArtifact.incident.id === membership.incidentRef &&
      ownerArtifact.followUps[0].id === membership.followUpRef &&
      ownerArtifact.followUps[0].identityKey ===
        membership.followUpIdentityKey;
    if (
      membership.problemRevision !== problem.revision ||
      membership.revision !== computeIncidentMembershipRevision(membership) ||
      !ownerArtifactResolved ||
      membership.ownerArtifactDigest !== ownerArtifactDigest ||
      membership.ownerSchemaDigest !==
        OWNER_CONTRACTS["incident-response"].schemaDigest ||
      membership.incidentRevision !== ownerArtifactDigest ||
      membership.state !== "declared-by-owner" ||
      membership.declaredByRef !== problem.declaredByRef ||
      !hasScope(
        principalById.get(membership.declaredByRef),
        "incident-membership-declarer",
        verifiedHumanRefs,
      ) ||
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
      time(declaration?.observedAt) <= time(membership.declaredAt)
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
        time(evidenceById.get(ref)?.observedAt) > time(hypothesis.revisedAt),
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
      !hasScope(
        principalById.get(hypothesis.ownerRef),
        "hypothesis-owner",
        verifiedHumanRefs,
      ) ||
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
  const qaRunById = mapById(qaOwnerArtifact.testRuns);
  for (const [index, row] of tests.entries()) {
    const hypothesis = hypothesisById.get(row.hypothesisRef);
    const result = evidenceById.get(row.evidenceRef);
    const ownerRun = qaRunById.get(row.testRunRef);
    if (
      row.problemRevision !== problem.revision ||
      row.hypothesisRevisionRef !== hypothesis?.revision ||
      !qaOwnerContractValid ||
      row.ownerArtifactDigest !==
        OWNER_CONTRACTS["quality-assurance-lead"].artifactDigest ||
      row.ownerSchemaDigest !==
        OWNER_CONTRACTS["quality-assurance-lead"].schemaDigest ||
      row.qaArtifactRef !== QA_OWNER_ARTIFACT_REF ||
      !ownerRun ||
      row.buildId !== ownerRun?.buildId ||
      row.environment !== ownerRun?.environment ||
      row.executedAt !== ownerRun?.executedAt ||
      row.executedByRef !== ownerRun?.executedById ||
      row.outcome !==
        (ownerRun?.result === "passed" ? "supports" : "refutes") ||
      row.revision !== computeTestRevision(row) ||
      !hasScope(
        principalById.get(row.executedByRef),
        "test-executor",
        verifiedHumanRefs,
      ) ||
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
    !hasScope(
      principalById.get(workaround?.approvedByRef),
      "workaround-approver",
      verifiedHumanRefs,
    ) ||
    !evidenceMatches(workaroundApproval, {
      kind: "workaround-approval",
      subjectRef: workaround?.id,
      subjectRevision: workaround?.revision,
      producedByRef: workaround?.approvedByRef,
    }) ||
    time(workaround?.approvedAt) === null ||
    time(workaroundApproval?.observedAt) <= time(workaround?.approvedAt) ||
    time(workaround?.approvedAt) <= latestWorkaroundInput ||
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
    !hasScope(
      principalById.get(knownError?.declaredByRef),
      "known-error-authority",
      verifiedHumanRefs,
    ) ||
    !hasScope(
      principalById.get(knownError?.declaredByRef),
      "root-cause-declarer",
      verifiedHumanRefs,
    ) ||
    !evidenceMatches(knownErrorDeclaration, {
      kind: "known-error-declaration",
      subjectRef: knownError?.id,
      subjectRevision: knownError?.revision,
      producedByRef: knownError?.declaredByRef,
    }) ||
    time(knownError?.declaredAt) === null ||
    time(knownErrorDeclaration?.observedAt) <= time(knownError?.declaredAt) ||
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
        hasScope(
          principalById.get(row?.producedByRef),
          "test-executor",
          verifiedHumanRefs,
        ) &&
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
    !changeOwnerContractValid ||
    change?.ownerArtifactDigest !==
      OWNER_CONTRACTS["change-control-operator"].artifactDigest ||
    change?.ownerSchemaDigest !==
      OWNER_CONTRACTS["change-control-operator"].schemaDigest ||
    change?.changePlanRef !== changeOwnerArtifact.plan.id ||
    change?.ownerPlanDigest !== changeOwnerArtifact.plan.digest ||
    change?.planDigest !== `sha256:${changeOwnerArtifact.plan.digest}` ||
    change?.revision !== computeChangeReceiptRevision(change) ||
    change?.state !== "owner-executed" ||
    !hasScope(
      principalById.get(change?.executedByRef),
      "change-executor",
      verifiedHumanRefs,
    ) ||
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
    time(executionReceipt?.observedAt) <= time(change?.executedAt) ||
    time(change?.executedAt) <= time(knownError?.declaredAt) ||
    time(change?.linkedAt) === null ||
    time(linkEvidence?.observedAt) <= time(change?.linkedAt) ||
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
  const changeFinalizedAt = Math.max(
    time(recurrenceChange?.linkedAt) ?? Number.POSITIVE_INFINITY,
    ...(Array.isArray(recurrenceChange?.verificationEvidenceRefs)
      ? recurrenceChange.verificationEvidenceRefs.map(
          (ref) =>
            time(evidenceById.get(ref)?.observedAt) ??
            Number.POSITIVE_INFINITY,
        )
      : [Number.POSITIVE_INFINITY]),
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
    time(recurrenceEvidence?.observedAt) <= time(recurrence?.observedAt) ||
    time(recurrence?.observedAt) <= time(recurrenceChange?.executedAt) ||
    time(recurrence?.observedAt) <= changeFinalizedAt ||
    time(recurrenceIncidentEvidence?.observedAt) <=
      changeFinalizedAt ||
    time(recurrenceMembership?.declaredAt) <=
      changeFinalizedAt ||
    time(recurrence?.observedAt) <=
      time(recurrenceMembership?.declaredAt) ||
    time(recurrence?.observedAt) <= time(knownError?.declaredAt)
  ) {
    add(
      "invalid_recurrence",
      "recurrences[0]",
      "The recurrence must be owner-observed after the current known-error declaration, external change, and later incident membership declaration.",
    );
  }

  const lifecycleEvidenceRefs = [
    problem.declarationEvidenceRef,
    incidentManifest.signatureEvidenceRef,
    proseAttestation.receiptEvidenceRef,
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
    incidentManifest.signedByRef,
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
    incidentManifestRevisionRef: incidentManifest.revision,
    hypothesisRevisionRefs: hypotheses.map((row) => row.revision),
    hypothesisDispositionRevisionRefs: hypotheses.map(
      (row) => row.dispositionRevision,
    ),
    testRefs: tests.map((row) => row.id),
    workaroundRevisionRefs: workarounds.map((row) => row.revision),
    knownErrorRevisionRefs: knownErrors.map((row) => row.revision),
    changeReceiptRefs: changes.map((row) => row.id),
    recurrenceRefs: recurrences.map((row) => row.id),
    proseAttestationRevisionRef: proseAttestation.revision,
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
      ([field, expected]) =>
        Array.isArray(expected)
          ? !exactSet(coverage[field], expected)
          : coverage[field] !== expected,
    )
  ) {
    add(
      "invalid_coverage",
      "coverage",
      "Exact closed coverage must equal every supplied principal, evidence, and lifecycle universe.",
    );
  }

  const proseReceipt = evidenceById.get(
    proseAttestation.receiptEvidenceRef,
  );
  if (
    proseAttestation.surfaceDigest !== computeProseSurfaceDigest(value) ||
    proseAttestation.revision !==
      computeProseAttestationRevision(proseAttestation) ||
    proseAttestation.ownerRef !== problem.declaredByRef ||
    proseAttestation.policy !== "owner-authored-non-authoritative" ||
    !evidenceMatches(proseReceipt, {
      kind: "owner-prose-receipt",
      subjectRef: proseAttestation.id,
      subjectRevision: proseAttestation.revision,
      producedByRef: proseAttestation.ownerRef,
    }) ||
    time(proseAttestation.signedAt) === null ||
    time(proseReceipt?.observedAt) <= time(proseAttestation.signedAt) ||
    (cutoff !== null && time(proseReceipt?.observedAt) > cutoff) ||
    coverage.proseAttestationRevisionRef !== proseAttestation.revision
  ) {
    add(
      "invalid_prose_attestation",
      "proseAttestation",
      "Every narrative surface must be content-addressed and followed by a trusted owner receipt.",
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
  const narrativeSurfaces = [
    ["problem.title", problem.title],
    ...hypotheses.map((row, index) => [
      `hypotheses[${index}].statement`,
      row.statement,
    ]),
    ...workarounds.map((row, index) => [
      `workarounds[${index}].instructions`,
      row.instructions,
    ]),
    ["handoff.summary", handoff.summary],
    ["handoff.nextDecision", handoff.nextDecision],
  ];
  for (const [path, text] of narrativeSurfaces) {
    if (hasProhibitedNarrativeClaim(text)) {
      add(
        "prohibited_authority_claim",
        path,
        "Narrative text cannot claim correlation, root cause, approval, publication, execution, mutation, closure, or risk authority for the Claw.",
      );
    }
  }
  if (
    handoff.state !== "owner-review-ready" ||
    handoff.ownerRef !== problem.declaredByRef ||
    !hasScope(
      principalById.get(handoff.ownerRef),
      "problem-closure-authority",
      verifiedHumanRefs,
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
