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
    "../claws/api-integration-engineer/fixtures/integration-readiness.example.json",
    import.meta.url,
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/api-integration-engineer/schemas/integration-readiness.schema.json",
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
  validateArtifactSemantics("api-integration-engineer", value);
const isValid = (value) => validateSchema(value) && findings(value).length === 0;
const legacy = {
  contractVersion: "inventory-api@1.0.0",
  operations: [
    {
      operationId: "listItems",
      state: "tested-synthetic",
      evidence: [
        "Synthetic 200 response contract",
        "Synthetic 429 throttling contract",
        "No production request performed",
      ],
    },
  ],
};

test("API integration fixture is a valid exact-scope enriched readiness record", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
});

test("API integration validator is total over malformed arrays and records", () => {
  for (const field of [
    "principals",
    "endpoints",
    "operations",
    "contractTests",
    "executionResults",
    "evidence",
    "incompatibilities",
  ]) {
    const malformed = clone();
    malformed[field].push(null);
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

test("API integration enriched marker is exact and partial hybrids fail closed", () => {
  const wrong = clone();
  wrong.schemaVersion = "awesomeClaws.integrationReadiness.v2";
  assert.equal(validateSchema(wrong), false);
  assert.ok(findings(wrong).some((item) => item.code === "invalid_schema_version"));

  const hybrid = { ...clone(), ...legacy };
  delete hybrid.principals;
  assert.equal(validateSchema(hybrid), false);
  assert.ok(
    findings(hybrid).some(
      (item) => item.code === "invalid_array_list" && item.path === "principals",
    ),
  );

  const partial = clone();
  partial.contractVersion = legacy.contractVersion;
  assert.equal(isValid(partial), false);
  assert.ok(
    findings(partial).some(
      (item) =>
        item.code === "legacy_field_in_enriched_record" &&
        item.path === "contractVersion",
    ),
  );
  assert.equal(validateSchema({ ...clone(), credentials: "secret" }), false);
});

test("API integration validator rejects unstable, dangling, and orphan rows", () => {
  const invalid = clone();
  delete invalid.operations[0].id;
  invalid.contractTests[0].operationRef = "operation-missing";
  assert.ok(
    findings(invalid).some(
      (item) => item.code === "invalid_array_record" && item.path === "operations[0].id",
    ),
  );
  assert.ok(findings(invalid).some((item) => item.code === "orphan_contract_test"));

  const orphan = clone();
  orphan.evidence.push({
    ...orphan.evidence[0],
    id: "evidence-orphan",
    operationRef: "operation-missing",
    testRef: "test-missing",
    resultRef: "result-missing",
  });
  assert.equal(isValid(orphan), false);
  assert.ok(findings(orphan).some((item) => item.code === "cross_scope_evidence"));
});

test("API integration evidence binds exact operation, test, target, environment, and snapshot", () => {
  for (const mutate of [
    (value) => {
      value.evidence[0].operationRef = "operation-missing";
    },
    (value) => {
      value.evidence[0].targetCommit = "1111111";
    },
    (value) => {
      value.executionResults[0].environment = "staging";
    },
    (value) => {
      value.contractTests[0].snapshotRef = "snapshot-old";
    },
  ]) {
    const crossScope = clone();
    mutate(crossScope);
    assert.equal(isValid(crossScope), false);
    assert.ok(
      findings(crossScope).some((item) =>
        [
          "cross_scope_evidence",
          "unsupported_execution_result",
          "cross_scope_contract_test",
        ].includes(item.code),
      ),
    );
  }
});

test("API integration requires all contract, negative, idempotency, and error tests to pass", () => {
  const failed = clone();
  failed.executionResults.find(
    (item) => item.id === "result-list-items-idempotency",
  ).outcome = "failed";
  assert.equal(isValid(failed), false);
  assert.ok(findings(failed).some((item) => item.code === "failed_contract_test"));
  assert.ok(
    findings(failed).some(
      (item) => item.code === "incomplete_contract_test_coverage",
    ),
  );

  const missingKind = clone();
  missingKind.operations[0].requiredTestKinds = ["contract", "negative-auth"];
  assert.ok(
    findings(missingKind).some(
      (item) => item.code === "incomplete_required_test_matrix",
    ),
  );
});

test("API integration evidence is controlled and secret-free", () => {
  const secret = clone();
  secret.evidence[0].containsSecrets = true;
  assert.ok(findings(secret).some((item) => item.code === "secret_in_evidence"));
  const uncontrolled = clone();
  uncontrolled.evidence[0].sourceRef = "https://example.com/result";
  assert.ok(
    findings(uncontrolled).some((item) => item.code === "untrusted_evidence_source"),
  );
  const embedded = clone();
  embedded.evidence[0].apiKey = "sk_live_not-a-real-key";
  assert.ok(findings(embedded).some((item) => item.code === "secret_in_evidence"));
  const nested = clone();
  nested.evidence[0].details = {
    audit: [{ token: "[REDACTED_SECRET]" }],
  };
  assert.ok(findings(nested).some((item) => item.code === "secret_in_evidence"));
  const outsideEvidence = clone();
  outsideEvidence.integration.apiKey = "sk_live_not-a-real-key";
  assert.ok(
    findings(outsideEvidence).some((item) => item.code === "secret_in_evidence"),
  );
});

test("API integration material incompatibilities and incomplete rollback block readiness", () => {
  const incompatible = clone();
  incompatible.incompatibilities[0].severity = "critical";
  incompatible.incompatibilities[0].state = "open";
  assert.ok(
    findings(incompatible).some(
      (item) => item.code === "unresolved_material_incompatibility",
    ),
  );
  assert.ok(
    findings(incompatible).some(
      (item) => item.code === "premature_integration_readiness",
    ),
  );

  const noRollback = clone();
  noRollback.readiness.rollback.evidenceRef = "evidence-missing";
  assert.ok(
    findings(noRollback).some(
      (item) => item.code === "incomplete_rollout_rollback_readiness",
    ),
  );
});

test("API integration review is independent, accountable, and after all evidence", () => {
  const self = clone();
  self.recommendation.reviewerId = self.ownerId;
  assert.ok(
    findings(self).some((item) => item.code === "premature_integration_readiness"),
  );
  const early = clone();
  early.recommendation.reviewedAt = "2026-09-05T09:30:00Z";
  assert.ok(
    findings(early).some((item) => item.code === "premature_integration_readiness"),
  );
});

test("API integration rejects the bare role identity but accepts a named human with the title", () => {
  const bare = clone();
  bare.owner = " API Integration Engineer ";
  bare.handoff.owner = " API Integration Engineer ";
  bare.principals.find((item) => item.id === bare.ownerId).name =
    " API Integration Engineer ";
  assert.ok(findings(bare).some((item) => item.code === "agent_owned_authority"));

  const titledHuman = clone();
  titledHuman.owner = "Alex Rivera, API Integration Engineer";
  titledHuman.handoff.owner = "Alex Rivera, API Integration Engineer";
  titledHuman.principals.find((item) => item.id === titledHuman.ownerId).name =
    "Alex Rivera, API Integration Engineer";
  assert.equal(isValid(titledHuman), true);
});

test("API integration rejects direct prohibited-action claims and missing gates", () => {
  for (const claim of [
    "We created the API credential.",
    "We mutated production.",
    "We deployed the integration.",
    "We approved the integration.",
    "We sent the communication.",
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
      (item) => item !== "create-credentials",
    );
  assert.ok(
    findings(missingGate).some((item) => item.code === "missing_authority_gate"),
  );
});

test("API integration schema preserves the exact strict legacy contract", () => {
  assert.equal(validateSchema(legacy), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(legacy), []);
  assert.equal(validateSchema({ ...legacy, operations: [] }), false);
  assert.equal(
    validateSchema({
      ...legacy,
      operations: [{ ...legacy.operations[0], state: "probably-tested" }],
    }),
    false,
  );
  assert.equal(validateSchema({ ...legacy, unexpected: true }), false);
});

test("API integration CLI accepts enriched and legacy artifacts", async () => {
  const scratchDir = resolve(root, ".tmp");
  const legacyPath = resolve(scratchDir, `integration-legacy-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(legacyPath, `${JSON.stringify(legacy)}\n`);
  try {
    for (const path of [fixturePath, legacyPath]) {
      const result = spawnSync(
        process.execPath,
        [
          resolve(root, "scripts", "validate-artifact.mjs"),
          "api-integration-engineer",
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
