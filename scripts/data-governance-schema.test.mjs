import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = fileURLToPath(
  new URL(
    "../claws/data-governance-steward/fixtures/data-governance-assessment.example.json",
    import.meta.url,
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/data-governance-steward/schemas/data-governance-assessment.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = (value) =>
  validateArtifactSemantics("data-governance-steward", value);
const isValid = (value) => validateSchema(value) && findings(value).length === 0;
const legacy = {
  governanceDomain: "Customer 360",
  reviewPeriod: "2026-Q3",
  domainOwner: "VP Data Platforms",
  dataProducts: [
    {
      name: "Customer profile",
      owner: "Customer Data Product",
      steward: "CRM Data Steward",
      lifecycleState: "active",
      criticalDataElements: ["Customer ID", "Consent status"],
    },
  ],
  evidence: [
    {
      subject: "Customer profile",
      kind: "ownership",
      state: "verified",
      reference: "purview-export/products/customer-profile",
      observedAt: "2026-08-15T18:00:00Z",
    },
  ],
  issues: [],
  decisionState: "ready-for-owner-review",
};

test("data governance fixture is a valid complete enriched assessment", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
});

test("data governance validator is total over malformed arrays and records", () => {
  for (const field of [
    "principals",
    "assets",
    "fields",
    "requirements",
    "evidence",
    "findings",
    "exceptions",
    "remediations",
    "verifications",
  ]) {
    const malformed = clone();
    malformed[field].push(false);
    assert.equal(validateSchema(malformed), true);
    assert.doesNotThrow(() => findings(malformed));
    assert.ok(findings(malformed).some((item) => item.code === "invalid_array_record"));
    malformed[field] = {};
    assert.doesNotThrow(() => findings(malformed));
    assert.ok(
      findings(malformed).some(
        (item) => item.code === "invalid_array_list" && item.path === field,
      ),
    );
  }
});

test("data governance exact marker and every legacy-only hybrid field fail closed", () => {
  const wrong = clone();
  wrong.schemaVersion = "awesomeClaws.dataGovernanceAssessment.v2";
  assert.equal(validateSchema(wrong), false);
  assert.ok(findings(wrong).some((item) => item.code === "invalid_schema_version"));

  for (const field of [
    "governanceDomain",
    "reviewPeriod",
    "domainOwner",
    "dataProducts",
    "issues",
    "decisionState",
  ]) {
    const partial = clone();
    partial[field] = legacy[field];
    assert.equal(isValid(partial), false, field);
    assert.ok(
      findings(partial).some(
        (item) =>
          item.code === "legacy_field_in_enriched_record" && item.path === field,
      ),
    );
  }
  const hybrid = { ...clone(), ...legacy };
  delete hybrid.principals;
  assert.equal(validateSchema(hybrid), false);
  assert.ok(
    findings(hybrid).some(
      (item) => item.code === "invalid_array_list" && item.path === "principals",
    ),
  );
  assert.equal(validateSchema({ ...clone(), customerRecords: ["sensitive"] }), false);
});

test("data governance rejects unstable, dangling, and orphan rows", () => {
  const invalid = clone();
  delete invalid.assets[0].id;
  invalid.fields[0].assetRef = "asset-missing";
  assert.ok(
    findings(invalid).some(
      (item) => item.code === "invalid_array_record" && item.path === "assets[0].id",
    ),
  );
  assert.ok(
    findings(invalid).some((item) => item.code === "incomplete_field_coverage"),
  );

  const orphan = clone();
  orphan.verifications.push({
    ...orphan.verifications[0],
    id: "verification-orphan",
    remediationRef: "remediation-missing",
  });
  assert.equal(isValid(orphan), false);
  assert.ok(
    findings(orphan).some(
      (item) => item.code === "orphan_remediation_verification",
    ),
  );
});

test("data governance evidence binds exact product, domain, policy, asset, and snapshot", () => {
  for (const mutate of [
    (value) => {
      value.evidence[0].catalogSnapshotRef = "snapshot-old";
    },
    (value) => {
      value.evidence[0].domain = "Other domain";
    },
    (value) => {
      value.evidence[0].assetRef = "asset-missing";
    },
    (value) => {
      value.evidence[0].requirementRef = "requirement-missing";
    },
  ]) {
    const crossScope = clone();
    mutate(crossScope);
    assert.equal(isValid(crossScope), false);
    assert.ok(
      findings(crossScope).some((item) => item.code === "cross_scope_evidence"),
    );
  }
});

test("data governance requires complete asset, field, and requirement coverage", () => {
  const missingFieldEvidence = clone();
  missingFieldEvidence.fields[0].evidenceRefs = [];
  assert.ok(
    findings(missingFieldEvidence).some(
      (item) => item.code === "incomplete_field_coverage",
    ),
  );
  const missingRequirementEvidence = clone();
  missingRequirementEvidence.requirements[0].evidenceRefs = [];
  assert.ok(
    findings(missingRequirementEvidence).some(
      (item) => item.code === "incomplete_governance_coverage",
    ),
  );
});

test("data governance exceptions require independent authority, exact evidence, and expiry", () => {
  const self = clone();
  self.exceptions[0].approvedById = self.exceptions[0].ownerId;
  assert.ok(
    findings(self).some((item) => item.code === "invalid_governance_exception"),
  );
  const expired = clone();
  expired.exceptions[0].expiresAt = "2026-09-05T10:01:00Z";
  assert.ok(
    findings(expired).some(
      (item) => item.code === "invalid_governance_exception",
    ),
  );
  const crossScope = clone();
  crossScope.evidence.find(
    (item) => item.id === "evidence-exception-approval",
  ).assetRef = "asset-missing";
  assert.ok(
    findings(crossScope).some(
      (item) => item.code === "invalid_governance_exception",
    ),
  );
});

test("data governance remediation verification is independent and exact-scope", () => {
  const self = clone();
  self.verifications[0].verifiedById = self.remediations[0].ownerId;
  assert.ok(
    findings(self).some((item) => item.code === "self_verified_remediation"),
  );
  const crossScope = clone();
  crossScope.verifications[0].assetRef = "asset-missing";
  assert.ok(
    findings(crossScope).some(
      (item) => item.code === "unsupported_remediation_verification",
    ),
  );
});

test("data governance unresolved material findings and stale evidence block readiness", () => {
  const unresolved = clone();
  unresolved.findings.find((item) => item.id === "finding-quality").state = "open";
  assert.ok(
    findings(unresolved).some(
      (item) => item.code === "unresolved_material_finding",
    ),
  );
  assert.ok(
    findings(unresolved).some(
      (item) => item.code === "premature_governance_readiness",
    ),
  );
  const unverified = clone();
  unverified.findings.find((item) => item.id === "finding-quality").remediationRef =
    "remediation-missing";
  assert.ok(
    findings(unverified).some(
      (item) => item.code === "unresolved_material_finding",
    ),
  );
  const stale = clone();
  stale.evidence[0].assertedAt = "2026-08-01T00:00:00Z";
  assert.ok(findings(stale).some((item) => item.code === "stale_evidence"));
});

test("data governance review is independent and follows all evidence", () => {
  const self = clone();
  self.recommendation.reviewerId = self.ownerId;
  assert.ok(
    findings(self).some(
      (item) => item.code === "premature_governance_readiness",
    ),
  );
  const early = clone();
  early.recommendation.reviewedAt = "2026-09-05T09:00:00Z";
  assert.ok(
    findings(early).some(
      (item) => item.code === "premature_governance_readiness",
    ),
  );
});

test("data governance rejects the bare role identity but accepts a named human with the title", () => {
  const bare = clone();
  bare.owner = " Data Governance Steward ";
  bare.handoff.owner = " Data Governance Steward ";
  bare.principals.find((item) => item.id === bare.ownerId).name =
    " Data Governance Steward ";
  assert.ok(findings(bare).some((item) => item.code === "agent_owned_authority"));

  const titledHuman = clone();
  titledHuman.owner = "Riley Chen, Data Governance Steward";
  titledHuman.handoff.owner = "Riley Chen, Data Governance Steward";
  titledHuman.principals.find((item) => item.id === titledHuman.ownerId).name =
    "Riley Chen, Data Governance Steward";
  assert.equal(isValid(titledHuman), true);
});

test("data governance rejects direct authority claims and missing gates", () => {
  for (const claim of [
    "We granted access.",
    "We revoked the access.",
    "We deleted the data.",
    "We overrode the classification.",
    "We issued a legal conclusion.",
    "We accepted the risk.",
    "We certified the data product.",
  ]) {
    const invalid = clone();
    invalid.handoff.summary = claim;
    assert.ok(
      findings(invalid).some((item) => item.code === "unauthorized_narrative_action"),
      claim,
    );
  }
  const missingGate = clone();
  missingGate.handoff.prohibitedActions =
    missingGate.handoff.prohibitedActions.filter(
      (item) => item !== "override-classification",
    );
  assert.ok(
    findings(missingGate).some((item) => item.code === "missing_authority_gate"),
  );
});

test("data governance schema preserves the exact strict legacy contract", () => {
  assert.equal(validateSchema(legacy), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(legacy), []);
  assert.equal(validateSchema({ ...legacy, dataProducts: [] }), false);
  assert.equal(
    validateSchema({
      ...legacy,
      evidence: [{ ...legacy.evidence[0], state: "probably-current" }],
    }),
    false,
  );
  assert.equal(validateSchema({ ...legacy, unexpected: true }), false);
});

test("data governance CLI accepts enriched and legacy artifacts", async () => {
  const scratchDir = resolve(root, ".tmp");
  const legacyPath = resolve(scratchDir, `governance-legacy-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(legacyPath, `${JSON.stringify(legacy)}\n`);
  try {
    for (const path of [fixturePath, legacyPath]) {
      const result = spawnSync(
        process.execPath,
        [
          resolve(root, "scripts", "validate-artifact.mjs"),
          "data-governance-steward",
          path,
        ],
        { cwd: root, encoding: "utf8" },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).valid, true);
    }
  } finally {
    await rm(legacyPath, { force: true });
  }
});
