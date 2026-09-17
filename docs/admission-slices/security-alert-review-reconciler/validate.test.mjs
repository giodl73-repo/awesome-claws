import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  alertKey,
  computeEvidenceRoot,
  computePriorDecisionDigest,
  resealSecurityAlertReview,
  securityAlertReviewFindings,
} from "./validate.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..", "..");
const AS_OF = "2026-09-16T23:30:00Z";

async function json(relative) {
  return JSON.parse(await readFile(new URL(relative, import.meta.url), "utf8"));
}

const [accepted, schema, adversarialCases, catalog] = await Promise.all([
  json("./accepted.json"),
  json("./security-alert-review.schema.json"),
  json("./adversarial-cases.json"),
  json("../../../catalog.json"),
]);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function clone() {
  return structuredClone(accepted);
}

function findings(
  value,
  asOf = AS_OF,
  principalRosterDigest = accepted.principalRoster.digest,
  evidenceRoot = value?.evidenceRoot,
) {
  return securityAlertReviewFindings(value, {
    asOf,
    principalRosterDigest,
    evidenceRoot,
  });
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
  const resealed = resealSecurityAlertReview(value);
  if (name === "substituted-controlled-evidence") {
    resealed.evidence.find(
      (row) => row.id === "evidence-disposition-code-101",
    ).contentDigest = `sha256:${"0".repeat(64)}`;
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
  const resealedCalendarDate = resealSecurityAlertReview(normalizedCalendarDate);
  assert.deepEqual(
    securityAlertReviewFindings(resealedCalendarDate, {
      asOf: "2026-09-31T00:00:00Z",
      principalRosterDigest: resealedCalendarDate.principalRoster.digest,
      evidenceRoot: resealedCalendarDate.evidenceRoot,
    }).map((row) => row.code),
    ["invalid_as_of"],
  );
});

test("principal authority is pinned out of band and cannot be relabeled as a team", () => {
  const fabricated = clone();
  fabricated.principals.find(
    (principal) => principal.id === "principal-security-analyst-riley",
  ).name = "Riley Changed";
  const resealedFabrication = resealSecurityAlertReview(fabricated);
  assert.ok(
    findings(resealedFabrication).some(
      (row) => row.code === "invalid_principal_roster_trust",
    ),
  );

  const team = clone();
  team.principals.find(
    (principal) => principal.id === "principal-security-analyst-riley",
  ).name = "Security Operations Team";
  const resealedTeam = resealSecurityAlertReview(team);
  assert.ok(
    findings(resealedTeam).some((row) => row.code === "bare_role_principal"),
  );
});

test("trusted roster scopes still constrain snapshot supply and alert ownership", () => {
  const unscopedSupplier = clone();
  unscopedSupplier.principals.find(
    (principal) => principal.id === unscopedSupplier.snapshot.suppliedByRef,
  ).scopes = ["export-only"];
  const resealedSupplier = resealSecurityAlertReview(unscopedSupplier);
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
  const resealedOwner = resealSecurityAlertReview(unscopedOwner);
  assert.deepEqual(
    findings(resealedOwner, AS_OF, resealedOwner.principalRoster.digest).map(
      (row) => row.code,
    ),
    ["invalid_alert"],
  );
});

test("trusted roster chronology and reviewer scopes cannot authorize retroactively", () => {
  const futureRoster = clone();
  futureRoster.principalRoster.capturedAt = "2026-09-16T23:00:00Z";
  futureRoster.evidence.find(
    (row) => row.id === "evidence-principal-roster",
  ).observedAt = "2026-09-16T23:00:00Z";
  const resealedFutureRoster = resealSecurityAlertReview(futureRoster);
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
  const resealedReviewer = resealSecurityAlertReview(unscopedReviewer);
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
  const resealedPostSnapshot = resealSecurityAlertReview(postSnapshotRoster);
  assert.deepEqual(
    findings(
      resealedPostSnapshot,
      AS_OF,
      resealedPostSnapshot.principalRoster.digest,
    ).map((row) => row.code),
    ["invalid_principal_roster_trust"],
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
  const resealed = resealSecurityAlertReview(selfOwned);
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

test("stable human identities cannot alias around separation", () => {
  const alias = clone();
  alias.principals.find(
    (principal) => principal.id === "principal-security-analyst-riley",
  ).directoryObjectRef = "directory://people/morgan-patel";
  const resealed = resealSecurityAlertReview(alias);
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
  const resealed = resealSecurityAlertReview(cyclic);
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
  const resealed = resealSecurityAlertReview(repeated);
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
    assert.ok(findings(malformed).some((row) => row.code === "invalid_identity_set"));
  }
});

test("schema rejects unknown fields and every prohibited authority claim", () => {
  assert.equal(validateSchema({ ...accepted, unknown: true }), false);
  for (const field of Object.keys(accepted.authority)) {
    const invalid = clone();
    invalid.authority[field] = "performed";
    assert.equal(validateSchema(invalid), false, field);
    assert.ok(
      findings(invalid).some((row) => row.code === "invalid_authority_claim"),
      field,
    );
  }
});

test("candidate remains outside every public registry surface", () => {
  assert.equal(
    catalog.entries.some((entry) => entry.id === "security-alert-review-reconciler"),
    false,
  );
});

test("candidate CLI validates only with explicit caller-controlled time", () => {
  const fixturePath = resolve(here, "accepted.json");
  const validatorPath = resolve(here, "validate.mjs");
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
    [
      validatorPath,
      fixturePath,
      "--as-of",
      AS_OF,
      "--principal-roster-digest",
      accepted.principalRoster.digest,
      "--evidence-root",
      accepted.evidenceRoot,
    ],
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
});
