import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  artifactSemanticValidationOptions,
  hasArtifactSemanticValidator,
  validateArtifactSemantics,
} from "./artifact-semantics.mjs";

import {
  alertKey,
  approvedPublicTrustReference,
  canonicalJson,
  computeEvidenceRoot,
  computeNormalizedAlertUniverseDigest,
  computePolicyDigest,
  computePriorDecisionDigest,
  computePublicTrustDigest,
  normalizedAlert,
  parseSourceJson,
  parseBoundedJsonText,
  resealSecurityAlertReview,
  SECURITY_ALERT_REVIEW_LIMITS,
  securityAlertReviewFindings,
} from "./security-alert-review-reconciler.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const AS_OF = "2026-09-16T23:30:00Z";
const fixturePath = resolve(
  here,
  "..",
  "sources",
  "security-alert-review-reconciler",
  "fixtures",
  "security-alert-review.example.json",
);
const validatorPath = resolve(here, "security-alert-review-reconciler.mjs");
const ownerTrustPath = resolve(
  here,
  "..",
  "sources",
  "security-alert-review-reconciler",
  "fixtures",
  "owner-trust.example.json",
);
const sourceBundlePath = resolve(
  here,
  "..",
  "sources",
  "security-alert-review-reconciler",
  "references",
  "source-bytes.example.json",
);
const publicTrustPath = resolve(
  here,
  "..",
  "sources",
  "security-alert-review-reconciler",
  "references",
  "public-trust.example.json",
);

async function json(relative) {
  return JSON.parse(await readFile(new URL(relative, import.meta.url), "utf8"));
}

const [
  accepted,
  schema,
  adversarialCases,
  catalog,
  ownerTrust,
  sourceBundle,
  publicTrustBundle,
] = await Promise.all([
  json("../sources/security-alert-review-reconciler/fixtures/security-alert-review.example.json"),
  json("../sources/security-alert-review-reconciler/schemas/security-alert-review.schema.json"),
  json("../sources/security-alert-review-reconciler/fixtures/security-alert-review-adversarial-cases.json"),
  json("../catalog.json"),
  json("../sources/security-alert-review-reconciler/fixtures/owner-trust.example.json"),
  json("../sources/security-alert-review-reconciler/references/source-bytes.example.json"),
  json("../sources/security-alert-review-reconciler/references/public-trust.example.json"),
]);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const validateAlertKey = ajv.compile(schema.$defs.alertKey);

function clone() {
  return structuredClone(accepted);
}

function resealWithTrustedEvidence(value) {
  const resealed = resealSecurityAlertReview(value);
  resealed.evidenceRoot = computeEvidenceRoot(resealed.evidence);
  return resealed;
}

function rebuildUnsignedSource(value) {
  let resealed = resealSecurityAlertReview(value);
  const snapshotEvidence = resealed.evidence.find(
    (row) => row.id === resealed.snapshot.evidenceRef,
  );
  snapshotEvidence.subjectRefs = [
    resealed.snapshot.id,
    ...resealed.snapshot.alerts.map((alert) => alert.id),
  ];
  resealed = resealSecurityAlertReview(resealed);
  const sources = [];
  const records = [];
  for (const source of [
    ...new Set(resealed.snapshot.alerts.map((alert) => alert.source)),
  ].sort()) {
    const alerts = resealed.snapshot.alerts
      .filter((alert) => alert.source === source)
      .map(normalizedAlert)
      .sort((left, right) => alertKey(left).localeCompare(alertKey(right)));
    const sourceVersion = resealed.snapshot.revision;
    const sourceBytes = Buffer.from(
      canonicalJson({
        schemaVersion: "awesomeClaws.securityAlertSource.v1",
        source,
        sourceVersion,
        alerts,
      }),
    );
    sources.push({
      source,
      sourceVersion,
      bytesBase64: sourceBytes.toString("base64"),
    });
    records.push({
      source,
      sourceVersion,
      sourceContentDigest: `sha256:${createHash("sha256")
        .update(sourceBytes)
        .digest("hex")}`,
      normalizedAlertKeys: alerts.map(alertKey),
      normalizedAlertDigest: computeNormalizedAlertUniverseDigest(alerts),
    });
  }
  resealed.sourceAuthority.snapshotRef = resealed.snapshot.id;
  resealed.sourceAuthority.snapshotRevision = resealed.snapshot.revision;
  resealed.sourceAuthority.snapshotCompletenessRoot =
    resealed.snapshot.completenessRoot;
  resealed.sourceAuthority.normalizedAlertKeys = resealed.snapshot.alerts
    .map(alertKey)
    .sort();
  resealed.sourceAuthority.normalizedAlertUniverseDigest =
    computeNormalizedAlertUniverseDigest(resealed.snapshot.alerts);
  resealed.sourceAuthority.records = records;
  resealed.evidenceRoot = computeEvidenceRoot(resealed.evidence);
  return { value: resealed, sourceBundle: { sources } };
}

function findings(
  value,
  asOf = AS_OF,
  principalRosterDigest = accepted.principalRoster.digest,
  evidenceRoot = value?.evidenceRoot,
  overrides = {},
) {
  return securityAlertReviewFindings(value, {
    asOf,
    principalRosterDigest,
    evidenceRoot,
    ownerTrust,
    sourceBundle,
    publicTrustBundle,
    ...overrides,
  });
}

function cliArguments(inputPath) {
  return [
    validatorPath,
    inputPath,
    "--as-of",
    AS_OF,
    "--principal-roster-digest",
    accepted.principalRoster.digest,
    "--evidence-root",
    accepted.evidenceRoot,
    "--owner-trust",
    ownerTrustPath,
    "--source-bundle",
    sourceBundlePath,
    "--public-trust",
    publicTrustPath,
  ];
}

function mutate(name) {
  const value = clone();
  switch (name) {
    case "missing-review-record":
      value.reviewRecords = value.reviewRecords.filter(
        (record) => record.id !== "review-code-104",
      );
      break;
    case "duplicate-review-record": {
      const duplicate = structuredClone(
        value.reviewRecords.find((record) => record.id === "review-code-104"),
      );
      duplicate.id = "review-code-104-copy";
      value.reviewRecords.push(duplicate);
      break;
    }
    case "stale-replayed-decision": {
      const record = value.reviewRecords.find((item) => item.id === "review-code-106");
      record.kind = "human-disposition";
      record.disposition = "false-positive";
      record.nonDecision = null;
      record.decidedByRef = "principal-security-analyst-riley";
      record.recordedAt = "2026-09-15T18:00:00Z";
      record.grantRef = "grant-riley-false-positive";
      record.evidenceRef = "evidence-disposition-code-101";
      break;
    }
    case "self-suppression-as-decision": {
      const record = value.reviewRecords.find((item) => item.id === "review-code-105");
      record.kind = "human-disposition";
      record.disposition = "false-positive";
      record.nonDecision = null;
      record.decidedByRef = "principal-alert-owner-morgan";
      record.grantRef = "grant-riley-false-positive";
      record.evidenceRef = "evidence-disposition-code-101";
      break;
    }
    case "muted-source-as-decision": {
      const record = value.reviewRecords.find((item) => item.id === "review-secret-77");
      record.kind = "human-disposition";
      record.disposition = "false-positive";
      record.nonDecision = null;
      record.decidedByRef = "principal-security-analyst-riley";
      record.grantRef = "grant-riley-false-positive";
      record.evidenceRef = "evidence-disposition-code-101";
      break;
    }
    case "missing-public-trust":
      value.publicTrustInputs = value.publicTrustInputs.filter(
        (record) => record.source !== "github/dependabot",
      );
      break;
    case "incident-declaration":
      value.incidentEscalations[0].incidentRef = "incident-claimed";
      break;
    case "severity-inference":
      value.authority.severityInference = "performed";
      break;
    case "orphan-incident-escalation": {
      const escalation = structuredClone(value.incidentEscalations[0]);
      escalation.id = "incident-escalation-code-107-copy";
      escalation.evidenceRef = "evidence-escalation-code-107-copy";
      const evidence = structuredClone(
        value.evidence.find((row) => row.id === "evidence-escalation-code-107"),
      );
      evidence.id = "evidence-escalation-code-107-copy";
      evidence.subjectRefs = [escalation.id];
      value.incidentEscalations.push(escalation);
      value.evidence.push(evidence);
      break;
    }
    case "unscoped-incident-owner":
      value.incidentEscalations[0].incidentOwnerRef =
        "principal-security-analyst-riley";
      break;
    case "unscoped-handoff-owner":
      value.handoff.nextOwnerRef = "principal-security-analyst-riley";
      break;
    case "unscoped-policy-owner":
      value.detectorPolicy.suppliedByRef = "principal-security-analyst-riley";
      value.evidence.find(
        (row) => row.id === "evidence-detector-policy",
      ).authorRef = "principal-security-analyst-riley";
      break;
    case "future-duplicate-declaration":
      value.duplicateGroups[0].declaredAt = "2026-09-16T23:00:00Z";
      value.evidence.find(
        (row) => row.id === "evidence-duplicate-group",
      ).observedAt = "2026-09-16T23:00:00Z";
      break;
    case "future-self-suppression":
      value.suppressionAttempts[0].requestedAt = "2026-09-16T23:00:00Z";
      value.evidence.find(
        (row) => row.id === "evidence-self-suppression-attempt",
      ).observedAt = "2026-09-16T23:00:00Z";
      break;
    case "ungranted-prior-decision":
      value.priorDecisions[0].decidedByRef = "principal-incident-owner-alex";
      value.evidence.find(
        (row) => row.id === "evidence-prior-decision-code-106",
      ).authorRef = "principal-incident-owner-alex";
      break;
    case "duplicate-prior-decision-with-fresh-review": {
      const duplicate = structuredClone(value.priorDecisions[0]);
      duplicate.id = "prior-decision-code-106-copy";
      duplicate.evidenceRef = "evidence-prior-decision-code-106-copy";
      const priorEvidence = structuredClone(
        value.evidence.find(
          (row) => row.id === "evidence-prior-decision-code-106",
        ),
      );
      priorEvidence.id = duplicate.evidenceRef;
      priorEvidence.controlledUri =
        "controlled://security-alert-review/history/code-106-analysis-1-copy.json";
      priorEvidence.subjectRefs = [duplicate.id];
      value.priorDecisions.push(duplicate);
      value.evidence.push(priorEvidence);

      const record = value.reviewRecords.find((item) => item.id === "review-code-106");
      record.kind = "human-disposition";
      record.disposition = "false-positive";
      record.nonDecision = null;
      record.decidedByRef = "principal-security-analyst-riley";
      record.grantRef = "grant-riley-false-positive";
      record.evidenceRef = "evidence-disposition-code-106";
      const reviewEvidence = structuredClone(
        value.evidence.find((row) => row.id === "evidence-disposition-code-101"),
      );
      reviewEvidence.id = record.evidenceRef;
      reviewEvidence.observedAt = record.recordedAt;
      reviewEvidence.controlledUri =
        "controlled://security-alert-review/dispositions/code-106.json";
      reviewEvidence.subjectRefs = [record.id];
      value.evidence.push(reviewEvidence);
      break;
    }
    case "substituted-controlled-evidence":
      break;
    case "cross-collection-identity-collision": {
      const grant = value.grants.find(
        (row) => row.id === "grant-riley-false-positive",
      );
      grant.id = "review-code-101";
      value.evidence.find(
        (row) => row.id === "evidence-grant-riley-false-positive",
      ).subjectRefs = [grant.id];
      value.reviewRecords.find(
        (row) => row.id === "review-code-101",
      ).grantRef = grant.id;
      break;
    }
    case "late-public-trust":
      value.publicTrustInputs[0].retrievedAt = "2026-09-16T22:00:00Z";
      break;
    case "extra-evidence-subject":
      value.evidence.find(
        (row) => row.id === "evidence-disposition-code-101",
      ).subjectRefs.push("review-unrelated");
      break;
    case "orphan-evidence": {
      const evidence = structuredClone(
        value.evidence.find((row) => row.id === "evidence-disposition-code-101"),
      );
      evidence.id = "evidence-orphan";
      evidence.subjectRefs = ["review-unrelated"];
      value.evidence.push(evidence);
      break;
    }
    default:
      throw new Error(`Unknown adversarial case: ${name}`);
  }
  const resealed = resealWithTrustedEvidence(value);
  if (name === "substituted-controlled-evidence") {
    resealed.evidence.find(
      (row) => row.id === "evidence-disposition-code-101",
    ).contentDigest = `sha256:${"0".repeat(64)}`;
  } else {
    resealed.evidenceRoot = computeEvidenceRoot(resealed.evidence);
  }
  if (name === "cross-collection-identity-collision") {
    const grant = resealed.grants.find((row) => row.id === "review-code-101");
    resealed.evidence.find(
      (row) => row.id === "evidence-grant-riley-false-positive",
    ).subjectDigest = grant.grantDigest;
    resealed.evidenceRoot = computeEvidenceRoot(resealed.evidence);
  }
  return resealed;
}

test("accepted slice is strict-schema valid and semantically clean", () => {
  assert.equal(validateSchema(accepted), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(accepted), []);
});

test("one complete snapshot covers every exact source native id revision key once", () => {
  const alerts = accepted.snapshot.alerts;
  const keys = alerts.map(alertKey);
  assert.equal(accepted.snapshot.complete, true);
  assert.equal(alerts.length, 8);
  assert.equal(new Set(keys).size, alerts.length);
  assert.deepEqual(new Set(accepted.coverage.alertKeys), new Set(keys));
  assert.equal(accepted.reviewRecords.length, alerts.length);
  for (const key of keys) {
    assert.equal(
      accepted.reviewRecords.filter((record) => record.alertKey === key).length,
      1,
      key,
    );
  }
});

test("owner trust and signed source bytes reject authority substitution", () => {
  assert.equal(
    parseSourceJson(
      Buffer.from([
        0x7b, 0x22, 0x76, 0x61, 0x6c, 0x75, 0x65, 0x22, 0x3a, 0x22, 0xc3,
        0x28, 0x22, 0x7d,
      ]),
    ),
    null,
  );
  assert.equal(
    accepted.sourceAuthority.snapshotCompletenessRoot,
    accepted.snapshot.completenessRoot,
  );
  assert.deepEqual(
    new Set(accepted.sourceAuthority.normalizedAlertKeys),
    new Set(accepted.snapshot.alerts.map(alertKey)),
  );
  assert.equal(
    accepted.sourceAuthority.normalizedAlertUniverseDigest,
    computeNormalizedAlertUniverseDigest(accepted.snapshot.alerts),
  );
  assert.deepEqual(
    new Set(
      accepted.sourceAuthority.records.map(
        (record) => `${record.source}\0${record.sourceVersion}`,
      ),
    ),
    new Set(
      sourceBundle.sources.map(
        (record) => `${record.source}\0${record.sourceVersion}`,
      ),
    ),
  );

  const omitted = clone();
  omitted.snapshot.alerts = omitted.snapshot.alerts.filter(
    (alert) => alert.id !== "alert-code-104-r1",
  );
  omitted.reviewRecords = omitted.reviewRecords.filter(
    (record) => record.id !== "review-code-104",
  );
  const omittedSource = rebuildUnsignedSource(omitted);
  assert.equal(
    omittedSource.value.sourceAuthority.signature,
    accepted.sourceAuthority.signature,
  );
  assert.deepEqual(
    findings(
      omittedSource.value,
      AS_OF,
      omittedSource.value.principalRoster.digest,
      omittedSource.value.evidenceRoot,
      { sourceBundle: omittedSource.sourceBundle },
    ).map((row) => row.code),
    ["invalid_source_authority"],
  );

  const substituted = clone();
  substituted.snapshot.alerts.find(
    (alert) => alert.id === "alert-code-101-r3",
  ).sourceSeverity = "changed-owner-value";
  const substitutedSource = rebuildUnsignedSource(substituted);
  assert.equal(
    substitutedSource.value.sourceAuthority.signature,
    accepted.sourceAuthority.signature,
  );
  assert.deepEqual(
    findings(
      substitutedSource.value,
      AS_OF,
      substitutedSource.value.principalRoster.digest,
      substitutedSource.value.evidenceRoot,
      { sourceBundle: substitutedSource.sourceBundle },
    ).map((row) => row.code),
    ["invalid_source_authority"],
  );

  const changedBytes = structuredClone(sourceBundle);
  changedBytes.sources[0].bytesBase64 = Buffer.from(
    "arbitrary replacement bytes",
  ).toString("base64");
  assert.deepEqual(
    findings(accepted, AS_OF, accepted.principalRoster.digest, accepted.evidenceRoot, {
      sourceBundle: changedBytes,
    }).map((row) => row.code),
    ["source_content_digest_mismatch"],
  );

  const malformedBundle = structuredClone(sourceBundle);
  malformedBundle.sources.push(null);
  assert.deepEqual(
    findings(accepted, AS_OF, accepted.principalRoster.digest, accepted.evidenceRoot, {
      sourceBundle: malformedBundle,
    }).map((row) => row.code),
    ["invalid_source_record"],
  );

  const privateField = structuredClone(ownerTrust);
  privateField.authorities["principal-alert-owner-morgan"][
    "security-alert-owner-key-1"
  ].privateKeyDerBase64 = "not-permitted";
  assert.deepEqual(
    findings(
      accepted,
      AS_OF,
      accepted.principalRoster.digest,
      accepted.evidenceRoot,
      { ownerTrust: privateField },
    ).map((row) => row.code),
    ["owner_trust_schema_additional_properties"],
  );

  const topLevelSecret = {
    ...structuredClone(ownerTrust),
    secret: "not-permitted",
  };
  assert.deepEqual(
    findings(
      accepted,
      AS_OF,
      accepted.principalRoster.digest,
      accepted.evidenceRoot,
      { ownerTrust: topLevelSecret },
    ).map((row) => row.code),
    ["owner_trust_schema_additional_properties"],
  );

  const nonCanonical = structuredClone(ownerTrust);
  nonCanonical.authorities["principal-alert-owner-morgan"][
    "security-alert-owner-key-1"
  ].publicKeyDerBase64 += "=";
  assert.deepEqual(
    findings(
      accepted,
      AS_OF,
      accepted.principalRoster.digest,
      accepted.evidenceRoot,
      { ownerTrust: nonCanonical },
    ).map((row) => row.code),
    ["owner_trust_schema_pattern"],
  );

  const { privateKey } = generateKeyPairSync("ed25519");
  const privateEncoding = structuredClone(ownerTrust);
  privateEncoding.authorities["principal-alert-owner-morgan"][
    "security-alert-owner-key-1"
  ].publicKeyDerBase64 = privateKey
    .export({ type: "pkcs8", format: "der" })
    .toString("base64");
  assert.deepEqual(
    findings(
      accepted,
      AS_OF,
      accepted.principalRoster.digest,
      accepted.evidenceRoot,
      { ownerTrust: privateEncoding },
    ).map((row) => row.code),
    ["invalid_owner_trust_key"],
  );

  const trailingBytes = structuredClone(ownerTrust);
  const publicKeyBytes = Buffer.from(
    trailingBytes.authorities["principal-alert-owner-morgan"][
      "security-alert-owner-key-1"
    ].publicKeyDerBase64,
    "base64",
  );
  trailingBytes.authorities["principal-alert-owner-morgan"][
    "security-alert-owner-key-1"
  ].publicKeyDerBase64 = Buffer.concat([
    publicKeyBytes,
    Buffer.from("trailing-private-material"),
  ]).toString("base64");
  assert.deepEqual(
    findings(
      accepted,
      AS_OF,
      accepted.principalRoster.digest,
      accepted.evidenceRoot,
      { ownerTrust: trailingBytes },
    ).map((row) => row.code),
    ["invalid_owner_trust_key"],
  );

  const { publicKey: rsaPublicKey } = generateKeyPairSync("rsa", {
    modulusLength: 1024,
  });
  const wrongAlgorithm = structuredClone(ownerTrust);
  wrongAlgorithm.authorities["principal-alert-owner-morgan"][
    "security-alert-owner-key-1"
  ].publicKeyDerBase64 = rsaPublicKey
    .export({ type: "spki", format: "der" })
    .toString("base64");
  assert.deepEqual(
    findings(
      accepted,
      AS_OF,
      accepted.principalRoster.digest,
      accepted.evidenceRoot,
      { ownerTrust: wrongAlgorithm },
    ).map((row) => row.code),
    ["invalid_owner_trust_key"],
  );
});

test("fixture preserves heterogeneous and adverse owner states without converting them to approval", () => {
  const categories = accepted.detectorPolicy.detectorRules.map((rule) => rule.category);
  assert.ok(categories.includes("vulnerability"));
  assert.ok(categories.includes("code-analysis"));
  assert.ok(categories.includes("secret-exposure"));
  assert.deepEqual(
    accepted.snapshot.alerts
      .filter((alert) => ["muted", "suppressed"].includes(alert.sourceState))
      .map((alert) => alert.sourceState)
      .sort(),
    ["muted", "suppressed"],
  );
  assert.ok(
    accepted.snapshot.alerts.some(
      (alert) => alert.assetIdentityState === "unknown" && alert.assetRef === null,
    ),
  );
  assert.equal(accepted.suppressionAttempts.length, 1);
  assert.equal(accepted.duplicateGroups.length, 1);
  assert.ok(
    accepted.reviewRecords.some(
      (record) =>
        record.kind === "human-disposition" &&
        record.disposition === "false-positive" &&
        record.decidedByRef === "principal-security-analyst-riley",
    ),
  );
});

test("alert revision invalidates history and incident escalation remains only an owner-review request", () => {
  const prior = accepted.priorDecisions[0];
  const current = accepted.snapshot.alerts.find(
    (alert) =>
      alert.source === prior.source &&
      alert.nativeAlertId === prior.nativeAlertId &&
      alert.revision !== prior.revision,
  );
  assert.equal(current.supersedesRevision, prior.revision);
  assert.equal(prior.invalidatedByAlertKey, alertKey(current));
  assert.equal(
    accepted.reviewRecords.find((record) => record.alertKey === alertKey(current))
      .nonDecision,
    "revision-invalidated-prior-decision",
  );

  const escalation = accepted.incidentEscalations[0];
  assert.equal(escalation.state, "requested-owner-review");
  assert.equal(escalation.incidentRef, null);
  assert.equal(escalation.declarationEffect, "none");
  assert.equal(accepted.authority.incidentDeclaration, "not-performed");
});

test("public trust is context-only, grants are typed, and time must come from the caller", () => {
  assert.ok(
    accepted.publicTrustInputs.every(
      (record) =>
        record.kind === "public-detector-contract" &&
        record.uri.startsWith("https://") &&
        record.authorityEffect === "context-only",
    ),
  );
  assert.deepEqual(
    new Set(accepted.grants.map((grant) => grant.type)),
    new Set([
      "record-false-positive",
      "record-duplicate",
      "declare-duplicate-group",
      "request-incident-review",
    ]),
  );
  assert.deepEqual(
    securityAlertReviewFindings(accepted).map((row) => row.code),
    ["invalid_as_of"],
  );
  assert.deepEqual(
    securityAlertReviewFindings(accepted, {
      asOf: "2026-09-16T23:31:00Z",
      principalRosterDigest: accepted.principalRoster.digest,
    }).map((row) => row.code),
    ["invalid_as_of"],
  );
  assert.deepEqual(
    securityAlertReviewFindings(accepted, {
      asOf: "2026-09-16T23:30:00",
      principalRosterDigest: accepted.principalRoster.digest,
    }).map((row) => row.code),
    ["invalid_as_of"],
  );

  const normalizedCalendarDate = clone();
  normalizedCalendarDate.asOf = "2026-10-01T00:00:00Z";
  const resealedCalendarDate = resealWithTrustedEvidence(normalizedCalendarDate);
  assert.deepEqual(
    securityAlertReviewFindings(resealedCalendarDate, {
      asOf: "2026-09-31T00:00:00Z",
      principalRosterDigest: resealedCalendarDate.principalRoster.digest,
      evidenceRoot: resealedCalendarDate.evidenceRoot,
    }).map((row) => row.code),
    ["invalid_as_of"],
  );
});

test("public trust is independently supplied and restricted to safe approved URLs", () => {
  assert.equal(
    approvedPublicTrustReference(
      {
        source: "vendor/custom-detector",
        uri: "https://security.vendor.example/contracts/alerts",
      },
      new Map([
        ["vendor/custom-detector", ["security.vendor.example"]],
      ]),
    ),
    true,
  );
  const changedBundle = structuredClone(publicTrustBundle);
  changedBundle.records[0].uri =
    "https://docs.github.com/en/rest/code-scanning/changed";
  assert.deepEqual(
    findings(accepted, AS_OF, accepted.principalRoster.digest, accepted.evidenceRoot, {
      publicTrustBundle: changedBundle,
    }).map((row) => row.code),
    ["invalid_public_trust_bundle"],
  );
  const duplicateBundle = structuredClone(publicTrustBundle);
  duplicateBundle.records.push(structuredClone(duplicateBundle.records[0]));
  assert.deepEqual(
    findings(accepted, AS_OF, accepted.principalRoster.digest, accepted.evidenceRoot, {
      publicTrustBundle: duplicateBundle,
    }).map((row) => row.code),
    ["invalid_public_trust_bundle"],
  );

  for (const uri of [
    "https://user:password@docs.github.com/en/rest/code-scanning",
    "https://docs.github.com/en/rest/code-scanning#credential",
    "https://docs.github.com/en/rest/code-scanning?access_token=secret",
    "https://docs.github.com/en/rest/code-scanning?client_secret=value",
    "https://docs.github.com/en/rest/code-scanning?private_key=value",
    "https://docs.github.com/en/rest/code-scanning?signature=value",
    "https://docs.github.com/en/rest/code-scanning?jwt=value",
    "https://docs.github.com/en/rest/code-scanning?page=1",
    "https://127.0.0.1/code-scanning",
    "https://10.0.0.1/code-scanning",
    "https://169.254.169.254/code-scanning",
    "https://unapproved.example/code-scanning",
  ]) {
    const unsafe = clone();
    unsafe.publicTrustInputs[0].uri = uri;
    assert.deepEqual(
      findings(unsafe).map((row) => row.code),
      ["invalid_public_trust_bundle", "invalid_public_trust_input"],
      uri,
    );
  }
});

test("public trust refreshes are scoped to the policy revision that references them", () => {
  const refreshed = clone();
  const priorPolicyDigest =
    refreshed.historicalDetectorPolicies[0].revisionDigest;
  const previous = refreshed.publicTrustInputs.find(
    (record) => record.id === "trust-github-code-scanning",
  );
  const current = {
    ...structuredClone(previous),
    id: "trust-github-code-scanning-2026-09-16",
    retrievedAt: "2026-09-16T16:00:00Z",
    contentDigest: `sha256:${"4b".repeat(32)}`,
  };
  current.recordDigest = computePublicTrustDigest(current);
  refreshed.publicTrustInputs.push(current);
  refreshed.detectorPolicy.trustInputRefs =
    refreshed.detectorPolicy.trustInputRefs.map((ref) =>
      ref === previous.id ? current.id : ref,
    );
  refreshed.detectorPolicy.trustInputDigests =
    refreshed.detectorPolicy.trustInputRefs.map(
      (ref) =>
        refreshed.publicTrustInputs.find((record) => record.id === ref)
          .recordDigest,
    );
  refreshed.detectorPolicy.revisionDigest = computePolicyDigest(
    refreshed.detectorPolicy,
  );
  for (const grant of refreshed.grants) {
    if (grant.id !== "grant-riley-prior-false-positive") {
      grant.policyRevisionDigest = refreshed.detectorPolicy.revisionDigest;
    }
  }
  for (const record of refreshed.reviewRecords) {
    record.policyRevisionDigest = refreshed.detectorPolicy.revisionDigest;
  }
  const resealed = resealWithTrustedEvidence(refreshed);
  assert.equal(
    resealed.historicalDetectorPolicies[0].revisionDigest,
    priorPolicyDigest,
  );
  assert.deepEqual(
    findings(
      resealed,
      AS_OF,
      resealed.principalRoster.digest,
      resealed.evidenceRoot,
      {
        publicTrustBundle: {
          approvedDomains: publicTrustBundle.approvedDomains,
          records: resealed.publicTrustInputs,
        },
      },
    ),
    [],
  );
});

test("principal authority is pinned out of band and cannot be relabeled as a team", () => {
  const fabricated = clone();
  fabricated.principals.find(
    (principal) => principal.id === "principal-security-analyst-riley",
  ).name = "Riley Changed";
  const resealedFabrication = resealWithTrustedEvidence(fabricated);
  assert.ok(
    findings(resealedFabrication).some(
      (row) => row.code === "invalid_principal_roster_trust",
    ),
  );

  const team = clone();
  team.principals.find(
    (principal) => principal.id === "principal-security-analyst-riley",
  ).name = "Security Operations Team";
  const resealedTeam = resealWithTrustedEvidence(team);
  assert.ok(
    findings(resealedTeam).some((row) => row.code === "bare_role_principal"),
  );
});

test("trusted roster scopes still constrain snapshot supply and alert ownership", () => {
  const unscopedSupplier = clone();
  unscopedSupplier.principals.find(
    (principal) => principal.id === unscopedSupplier.snapshot.suppliedByRef,
  ).scopes = ["export-only"];
  const resealedSupplier = resealWithTrustedEvidence(unscopedSupplier);
  assert.deepEqual(
    findings(
      resealedSupplier,
      AS_OF,
      resealedSupplier.principalRoster.digest,
    ).map((row) => row.code),
    ["invalid_snapshot"],
  );

  const unscopedOwner = clone();
  unscopedOwner.snapshot.alerts.find(
    (alert) => alert.id === "alert-code-104-r1",
  ).ownerRef = "principal-security-analyst-riley";
  const resealedOwner = resealWithTrustedEvidence(unscopedOwner);
  assert.deepEqual(
    findings(resealedOwner, AS_OF, resealedOwner.principalRoster.digest).map(
      (row) => row.code,
    ),
    [
      "invalid_alert",
      "invalid_source_authority",
      "invalid_source_content",
      "invalid_source_manifest_record",
    ],
  );
});

test("trusted roster chronology and reviewer scopes cannot authorize retroactively", () => {
  const futureRoster = clone();
  futureRoster.principalRoster.capturedAt = "2026-09-16T23:00:00Z";
  futureRoster.evidence.find(
    (row) => row.id === "evidence-principal-roster",
  ).observedAt = "2026-09-16T23:00:00Z";
  const resealedFutureRoster = resealWithTrustedEvidence(futureRoster);
  assert.deepEqual(
    findings(
      resealedFutureRoster,
      AS_OF,
      resealedFutureRoster.principalRoster.digest,
    ).map((row) => row.code),
    ["invalid_principal_roster_trust"],
  );

  const unscopedReviewer = clone();
  unscopedReviewer.principals.find(
    (principal) => principal.id === "principal-security-analyst-riley",
  ).scopes = [];
  const resealedReviewer = resealWithTrustedEvidence(unscopedReviewer);
  const codes = findings(
    resealedReviewer,
    AS_OF,
    resealedReviewer.principalRoster.digest,
  ).map((row) => row.code);
  assert.ok(codes.includes("invalid_grant"));
  assert.ok(codes.includes("invalid_prior_decision"));
  assert.ok(codes.includes("unauthorized_human_disposition"));

  const postSnapshotRoster = clone();
  postSnapshotRoster.snapshot.capturedAt = "2026-09-16T18:20:00Z";
  postSnapshotRoster.evidence.find(
    (row) => row.id === "evidence-alert-snapshot",
  ).observedAt = postSnapshotRoster.snapshot.capturedAt;
  postSnapshotRoster.principalRoster.capturedAt = "2026-09-16T18:30:00Z";
  postSnapshotRoster.evidence.find(
    (row) => row.id === "evidence-principal-roster",
  ).observedAt = postSnapshotRoster.principalRoster.capturedAt;
  const resealedPostSnapshot = resealWithTrustedEvidence(postSnapshotRoster);
  assert.deepEqual(
    findings(
      resealedPostSnapshot,
      AS_OF,
      resealedPostSnapshot.principalRoster.digest,
    ).map((row) => row.code),
    ["invalid_principal_roster_trust", "invalid_source_authority"],
  );
});

test("historical dispositions preserve current owner separation", () => {
  const selfOwned = clone();
  const owner = selfOwned.principals.find(
    (principal) => principal.id === "principal-alert-owner-morgan",
  );
  owner.scopes.push("review-alert");
  const priorGrant = selfOwned.grants.find(
    (grant) => grant.id === "grant-riley-prior-false-positive",
  );
  priorGrant.granteeRef = owner.id;
  selfOwned.priorDecisions[0].decidedByRef = owner.id;
  selfOwned.evidence.find(
    (row) => row.id === "evidence-prior-decision-code-106",
  ).authorRef = owner.id;
  const resealed = resealWithTrustedEvidence(selfOwned);
  assert.deepEqual(
    findings(resealed, AS_OF, resealed.principalRoster.digest).map(
      (row) => row.code,
    ),
    ["invalid_prior_decision"],
  );

  const wrongPolicy = clone();
  wrongPolicy.priorDecisions[0].policyRevisionDigest =
    `sha256:${"0".repeat(64)}`;
  wrongPolicy.priorDecisions[0].decisionDigest = computePriorDecisionDigest(
    wrongPolicy.priorDecisions[0],
  );
  wrongPolicy.evidence.find(
    (row) => row.id === "evidence-prior-decision-code-106",
  ).subjectDigest = wrongPolicy.priorDecisions[0].decisionDigest;
  wrongPolicy.evidenceRoot = computeEvidenceRoot(wrongPolicy.evidence);
  assert.deepEqual(
    findings(wrongPolicy).map((row) => row.code),
    ["invalid_prior_decision"],
  );
});

test("prior grants and decisions bind immutable historical policy revisions", () => {
  const historicalPolicy = accepted.historicalDetectorPolicies[0];
  const priorGrant = accepted.grants.find(
    (grant) => grant.id === "grant-riley-prior-false-positive",
  );
  const priorDecision = accepted.priorDecisions[0];
  assert.notEqual(
    historicalPolicy.revisionDigest,
    accepted.detectorPolicy.revisionDigest,
  );
  assert.equal(priorGrant.policyRevisionDigest, historicalPolicy.revisionDigest);
  assert.equal(
    priorDecision.policyRevisionDigest,
    historicalPolicy.revisionDigest,
  );
  assert.ok(
    accepted.reviewRecords.every(
      (record) =>
        record.policyRevisionDigest === accepted.detectorPolicy.revisionDigest,
    ),
  );

  const rewrittenHistory = clone();
  const originalHistoricalDigest =
    rewrittenHistory.historicalDetectorPolicies[0].revisionDigest;
  const originalGrantPolicyDigest = rewrittenHistory.grants.find(
    (grant) => grant.id === "grant-riley-prior-false-positive",
  ).policyRevisionDigest;
  const originalDecisionPolicyDigest =
    rewrittenHistory.priorDecisions[0].policyRevisionDigest;
  rewrittenHistory.historicalDetectorPolicies[0].detectorRules[0]
    .allowedDispositionKinds = ["incident-review-escalation"];
  const internallyResealed = resealSecurityAlertReview(rewrittenHistory);
  assert.equal(
    internallyResealed.historicalDetectorPolicies[0].revisionDigest,
    originalHistoricalDigest,
  );
  assert.equal(
    internallyResealed.grants.find(
      (grant) => grant.id === "grant-riley-prior-false-positive",
    ).policyRevisionDigest,
    originalGrantPolicyDigest,
  );
  assert.equal(
    internallyResealed.priorDecisions[0].policyRevisionDigest,
    originalDecisionPolicyDigest,
  );
  assert.ok(
    findings(internallyResealed).some(
      (row) => row.code === "invalid_historical_detector_policy",
    ),
  );

  const reboundToCurrent = clone();
  reboundToCurrent.grants.find(
    (grant) => grant.id === "grant-riley-prior-false-positive",
  ).policyRevisionDigest = reboundToCurrent.detectorPolicy.revisionDigest;
  reboundToCurrent.priorDecisions[0].policyRevisionDigest =
    reboundToCurrent.detectorPolicy.revisionDigest;
  const resealedCurrent = resealWithTrustedEvidence(reboundToCurrent);
  assert.deepEqual(
    findings(resealedCurrent).map((row) => row.code),
    ["invalid_grant", "invalid_prior_decision"],
  );

  const retroactiveRoster = clone();
  retroactiveRoster.principalRoster.capturedAt = "2026-09-15T16:10:00Z";
  retroactiveRoster.evidence.find(
    (row) => row.id === "evidence-principal-roster",
  ).observedAt = retroactiveRoster.principalRoster.capturedAt;
  const resealedRoster = resealWithTrustedEvidence(retroactiveRoster);
  assert.deepEqual(
    findings(
      resealedRoster,
      AS_OF,
      resealedRoster.principalRoster.digest,
    ).map((row) => row.code),
    ["invalid_principal_roster_trust"],
  );

  const simultaneous = clone();
  const simultaneousPolicy = structuredClone(simultaneous.detectorPolicy);
  simultaneousPolicy.id = "detector-policy-security-alerts-simultaneous";
  simultaneousPolicy.revision = "policy-simultaneous";
  simultaneousPolicy.evidenceRef = "evidence-detector-policy-simultaneous";
  simultaneousPolicy.revisionDigest = computePolicyDigest(simultaneousPolicy);
  const simultaneousEvidence = structuredClone(
    simultaneous.evidence.find(
      (row) => row.id === simultaneous.detectorPolicy.evidenceRef,
    ),
  );
  simultaneousEvidence.id = simultaneousPolicy.evidenceRef;
  simultaneousEvidence.controlledUri =
    "controlled://security-alert-review/policy/policy-simultaneous.json";
  simultaneousEvidence.subjectRefs = [simultaneousPolicy.id];
  simultaneousEvidence.subjectDigest = simultaneousPolicy.revisionDigest;
  simultaneous.historicalDetectorPolicies.push(simultaneousPolicy);
  simultaneous.evidence.push(simultaneousEvidence);
  const resealedSimultaneous = resealWithTrustedEvidence(simultaneous);
  assert.deepEqual(
    findings(resealedSimultaneous).map((row) => row.code),
    [
      "invalid_grant",
      "invalid_grant",
      "invalid_grant",
      "invalid_grant",
      "invalid_policy_history",
    ],
  );
});

test("stable human identities cannot alias around separation", () => {
  const alias = clone();
  alias.principals.find(
    (principal) => principal.id === "principal-security-analyst-riley",
  ).directoryObjectRef = "directory://people/morgan-patel";
  const resealed = resealWithTrustedEvidence(alias);
  const codes = findings(
    resealed,
    AS_OF,
    resealed.principalRoster.digest,
  ).map((row) => row.code);
  assert.ok(codes.includes("duplicate_human_identity"));
  assert.ok(codes.includes("invalid_prior_decision"));
  assert.ok(codes.includes("unauthorized_human_disposition"));
});

test("an alert revision cannot supersede itself", () => {
  const cyclic = clone();
  cyclic.snapshot.alerts.find(
    (alert) => alert.id === "alert-code-106-r2",
  ).supersedesRevision = "analysis-2";
  const resealed = resealWithTrustedEvidence(cyclic);
  assert.ok(findings(resealed).some((row) => row.code === "invalid_alert"));
});

test("repeated self-suppression attempts remain one exact non-decision", () => {
  const repeated = clone();
  const attempt = structuredClone(repeated.suppressionAttempts[0]);
  attempt.id = "suppression-attempt-code-105-copy";
  attempt.requestedAt = "2026-09-16T19:32:00Z";
  attempt.evidenceRef = "evidence-self-suppression-attempt-copy";
  const evidence = structuredClone(
    repeated.evidence.find(
      (row) => row.id === "evidence-self-suppression-attempt",
    ),
  );
  evidence.id = "evidence-self-suppression-attempt-copy";
  evidence.observedAt = attempt.requestedAt;
  evidence.subjectRefs = [attempt.id];
  repeated.suppressionAttempts.push(attempt);
  repeated.evidence.push(evidence);
  const resealed = resealWithTrustedEvidence(repeated);
  assert.deepEqual(findings(resealed), []);
  assert.equal(
    resealed.reviewRecords.filter(
      (record) =>
        record.alertKey === attempt.alertKey &&
        record.nonDecision === "self-suppression-attempt",
    ).length,
    1,
  );
});

test("adversarial fixtures produce exact deterministic findings", () => {
  for (const scenario of adversarialCases) {
    const candidate = mutate(scenario.name);
    const first = findings(candidate);
    const second = findings(structuredClone(candidate));
    assert.deepEqual(second, first, `${scenario.name} must be deterministic`);
    assert.deepEqual(
      first.map((row) => row.code),
      scenario.expectedCodes,
      scenario.name,
    );
    assert.deepEqual(first, [...first].sort((left, right) => {
      const code = left.code.localeCompare(right.code, "en", {
        sensitivity: "variant",
        numeric: false,
      });
      return code || left.path.localeCompare(right.path, "en", {
        sensitivity: "variant",
        numeric: false,
      });
    }));
  }
});

test("semantic validator is total over malformed direct inputs", () => {
  for (const malformed of [null, undefined, 7, "artifact", [], {}]) {
    assert.doesNotThrow(() =>
      securityAlertReviewFindings(malformed, {
        asOf: AS_OF,
        principalRosterDigest: accepted.principalRoster.digest,
      }),
    );
    assert.ok(
      securityAlertReviewFindings(malformed, {
        asOf: AS_OF,
        principalRosterDigest: accepted.principalRoster.digest,
      }).length > 0,
    );
  }
  for (const field of [
    "publicTrustInputs",
    "principals",
    "grants",
    "evidence",
    "duplicateGroups",
    "suppressionAttempts",
    "priorDecisions",
    "reviewRecords",
    "incidentEscalations",
  ]) {
    const malformed = clone();
    malformed[field] = {};
    assert.doesNotThrow(() => findings(malformed), field);
    assert.deepEqual(
      findings(malformed).map((row) => row.code),
      ["schema_type"],
      field,
    );
  }
});

test("schema-invalid and deeply nested inputs short-circuit semantic work", () => {
  const schemaInvalid = clone();
  delete schemaInvalid.sourceAuthority;
  assert.deepEqual(
    findings(schemaInvalid).map((row) => row.code),
    ["schema_required"],
  );

  const deep = {};
  let cursor = deep;
  for (
    let depth = 0;
    depth <= SECURITY_ALERT_REVIEW_LIMITS.maxDepth;
    depth += 1
  ) {
    cursor.child = {};
    cursor = cursor.child;
  }
  assert.deepEqual(
    securityAlertReviewFindings(deep).map((row) => row.code),
    ["input_too_deep"],
  );

  const cyclic = {};
  cyclic.self = cyclic;
  assert.deepEqual(
    securityAlertReviewFindings(cyclic).map((row) => row.code),
    ["input_not_json_compatible"],
  );
});

test("schema cardinality string and byte limits bound validation work", () => {
  const maximumComponentKey = alertKey({
    source: "s".repeat(512),
    nativeAlertId: "n".repeat(512),
    revision: "r".repeat(512),
  });
  assert.ok(maximumComponentKey.length > 512);
  assert.equal(validateAlertKey(maximumComponentKey), true);

  const tooManyTrustInputs = clone();
  tooManyTrustInputs.publicTrustInputs = Array.from(
    { length: 17 },
    (_, index) => ({
      ...structuredClone(accepted.publicTrustInputs[0]),
      id: `trust-bounded-${index}`,
    }),
  );
  assert.deepEqual(
    findings(tooManyTrustInputs).map((row) => row.code),
    ["schema_max_items"],
  );

  const overlongId = clone();
  overlongId.artifactId = "a".repeat(129);
  assert.deepEqual(
    findings(overlongId).map((row) => row.code),
    ["schema_max_length"],
  );

  assert.deepEqual(
    findings(
      accepted,
      AS_OF,
      accepted.principalRoster.digest,
      accepted.evidenceRoot,
      { inputByteLength: SECURITY_ALERT_REVIEW_LIMITS.maxInputBytes + 1 },
    ).map((row) => row.code),
    ["input_too_large"],
  );
  assert.deepEqual(
    parseBoundedJsonText('{"larger":true}', "input", 8).finding,
    {
      code: "input_too_large",
      path: "input",
      refs: [],
    },
  );
});

test("schema rejects unknown fields and every prohibited authority claim", () => {
  assert.equal(validateSchema({ ...accepted, unknown: true }), false);
  for (const field of Object.keys(accepted.authority)) {
    const invalid = clone();
    invalid.authority[field] = "performed";
    assert.equal(validateSchema(invalid), false, field);
    assert.deepEqual(
      findings(invalid).map((row) => row.code),
      ["schema_const"],
      field,
    );
  }
});

test("CLI returns structured parse and pre-read size failures", async () => {
  const malformedPath = resolve(
    root,
    ".tmp",
    `security-alert-review-malformed-${process.pid}.json`,
  );
  const oversizedPath = resolve(
    root,
    ".tmp",
    `security-alert-review-oversized-${process.pid}.json`,
  );
  const schemaInvalidPath = resolve(
    root,
    ".tmp",
    `security-alert-review-schema-invalid-${process.pid}.json`,
  );
  try {
    await writeFile(malformedPath, "{\"broken\":");
    const malformed = spawnSync(
      process.execPath,
      cliArguments(malformedPath),
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(malformed.status, 1, malformed.stderr || malformed.stdout);
    assert.deepEqual(JSON.parse(malformed.stdout), {
      valid: false,
      findings: [
        {
          code: "invalid_input_json",
          path: "input",
          refs: [],
        },
      ],
    });

    await writeFile(
      oversizedPath,
      "x".repeat(SECURITY_ALERT_REVIEW_LIMITS.maxInputBytes + 1),
    );
    const oversized = spawnSync(
      process.execPath,
      cliArguments(oversizedPath),
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(oversized.status, 1, oversized.stderr || oversized.stdout);
    assert.deepEqual(JSON.parse(oversized.stdout), {
      valid: false,
      findings: [
        {
          code: "input_too_large",
          path: "input",
          refs: [],
        },
      ],
    });

    const schemaInvalid = clone();
    delete schemaInvalid.sourceAuthority;
    await writeFile(schemaInvalidPath, JSON.stringify(schemaInvalid));
    const invalidSchema = spawnSync(
      process.execPath,
      cliArguments(schemaInvalidPath),
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(
      invalidSchema.status,
      1,
      invalidSchema.stderr || invalidSchema.stdout,
    );
    assert.deepEqual(
      JSON.parse(invalidSchema.stdout).findings.map((row) => row.code),
      ["schema_required"],
    );
  } finally {
    await Promise.all([
      rm(malformedPath, { force: true }),
      rm(oversizedPath, { force: true }),
      rm(schemaInvalidPath, { force: true }),
    ]);
  }
});

test("public contribution is registered in the catalog", () => {
  const entry = catalog.entries.find(
    (item) => item.id === "security-alert-review-reconciler",
  );
  assert.ok(entry);
  assert.ok(entry.openclawProfile.agent.tools.alsoAllow.includes("exec"));
  assert.ok(
    entry.resources.some(
      (resource) =>
        resource.path === "scripts/security-alert-review-validator.mjs",
    ),
  );
});

test("public semantic registry validates the accepted artifact", () => {
  assert.equal(hasArtifactSemanticValidator("security-alert-review-reconciler"), true);
  assert.deepEqual(
    validateArtifactSemantics(
      "security-alert-review-reconciler",
      accepted,
      artifactSemanticValidationOptions("security-alert-review-reconciler"),
    ),
    [],
  );
});

test("public CLI validates only with explicit caller-controlled trust and time", () => {
  const acceptedResult = spawnSync(
    process.execPath,
    [validatorPath, fixturePath, "--as-of", AS_OF],
    {
      cwd: root,
      encoding: "utf8",
    },
  );
  const acceptedWithTrust = spawnSync(
    process.execPath,
    cliArguments(fixturePath),
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(acceptedResult.status, 2, acceptedResult.stderr || acceptedResult.stdout);
  assert.equal(
    acceptedWithTrust.status,
    0,
    acceptedWithTrust.stderr || acceptedWithTrust.stdout,
  );
  assert.deepEqual(JSON.parse(acceptedWithTrust.stdout), {
    valid: true,
    findings: [],
  });

  const missingTime = spawnSync(process.execPath, [validatorPath, fixturePath], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(missingTime.status, 2);
  assert.match(missingTime.stderr, /--as-of/u);

  const missingEvidenceRoot = spawnSync(
    process.execPath,
    [
      validatorPath,
      fixturePath,
      "--as-of",
      AS_OF,
      "--principal-roster-digest",
      accepted.principalRoster.digest,
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(missingEvidenceRoot.status, 2);
  assert.match(missingEvidenceRoot.stderr, /--evidence-root/u);

  const packageRoot = resolve(
    root,
    "claws",
    "security-alert-review-reconciler",
  );
  const packaged = spawnSync(
    process.execPath,
    [
      resolve(packageRoot, "scripts", "security-alert-review-validator.mjs"),
      resolve(packageRoot, "fixtures", "security-alert-review.example.json"),
      "--as-of",
      AS_OF,
      "--principal-roster-digest",
      accepted.principalRoster.digest,
      "--evidence-root",
      accepted.evidenceRoot,
      "--owner-trust",
      resolve(packageRoot, "fixtures", "owner-trust.example.json"),
      "--source-bundle",
      resolve(packageRoot, "references", "source-bytes.example.json"),
      "--public-trust",
      resolve(packageRoot, "references", "public-trust.example.json"),
    ],
    { cwd: packageRoot, encoding: "utf8" },
  );
  assert.equal(packaged.status, 0, packaged.stderr || packaged.stdout);
  assert.deepEqual(JSON.parse(packaged.stdout), {
    valid: true,
    findings: [],
  });
});
