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
    "../claws/grant-portfolio-manager/fixtures/grant-opportunity.example.json",
    import.meta.url,
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/grant-portfolio-manager/schemas/grant-opportunity.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function clone(value = fixture) {
  return structuredClone(value);
}

function isValid(value) {
  return (
    validateSchema(value) &&
    validateArtifactSemantics("grant-portfolio-manager", value).length === 0
  );
}

test("grant opportunity fixture keeps portfolio, evidence, and handoff data consistent", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("grant-portfolio-manager", fixture), []);
});

test("grant portfolio validator is total over schema-valid malformed nested records", () => {
  const malformedOpportunity = clone();
  malformedOpportunity.opportunities.push({});
  assert.equal(validateSchema(malformedOpportunity), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("grant-portfolio-manager", malformedOpportunity));
  assert.equal(isValid(malformedOpportunity), false);

  const malformedEvidence = clone();
  malformedEvidence.evidence.push({});
  assert.equal(validateSchema(malformedEvidence), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("grant-portfolio-manager", malformedEvidence));
  assert.equal(isValid(malformedEvidence), false);

  const malformedApproval = clone();
  malformedApproval.approvals.push({});
  assert.equal(validateSchema(malformedApproval), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("grant-portfolio-manager", malformedApproval));
  assert.equal(isValid(malformedApproval), false);
});

test("grant portfolio validator rejects non-array required ledgers", () => {
  for (const field of ["opportunities", "evidence", "approvals", "principals"]) {
    const malformed = { ...clone(), ...legacyGrantOpportunity, [field]: {} };
    assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
    assert.doesNotThrow(() => validateArtifactSemantics("grant-portfolio-manager", malformed));
    assert.ok(
      validateArtifactSemantics("grant-portfolio-manager", malformed).some(
        (item) => item.code === "invalid_array_list" && item.path === field,
      ),
      `expected invalid_array_list for ${field}`,
    );
  }
});

test("grant portfolio validator handles a non-array prohibitedActions without throwing", () => {
  const malformed = clone();
  malformed.handoff.prohibitedActions = {};
  assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("grant-portfolio-manager", malformed));
  const findings = validateArtifactSemantics("grant-portfolio-manager", malformed);
  assert.ok(findings.some((item) => item.code === "invalid_string_list"));
});

test("grant portfolio validator handles a non-array reference list without throwing", () => {
  const malformed = clone();
  malformed.handoff.opportunityRefs = {};
  assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("grant-portfolio-manager", malformed));
  const findings = validateArtifactSemantics("grant-portfolio-manager", malformed);
  assert.ok(findings.some((item) => item.code === "invalid_reference_list"));
});

test("grant portfolio validator fails closed on a matching-length object masquerading as a reference list", () => {
  const fakeArray = clone();
  fakeArray.handoff.opportunityRefs = { length: 2 };
  assert.equal(validateSchema(fakeArray), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("grant-portfolio-manager", fakeArray));
  assert.equal(isValid(fakeArray), false);
});

test("grant portfolio validator rejects a self-attested approver identity", () => {
  const selfAttested = clone();
  const approverPrincipal = selfAttested.principals.find((item) => item.id === "principal-marcus-alvarez");
  approverPrincipal.name = "Grant Portfolio Manager";
  assert.equal(isValid(selfAttested), false);
  const findings = validateArtifactSemantics("grant-portfolio-manager", selfAttested);
  assert.ok(findings.some((item) => item.code === "self_attested_approval"));
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("grant portfolio validator rejects an arbitrary, unregistered approverId", () => {
  const arbitraryApprover = clone();
  arbitraryApprover.approvals[0].approverId = "principal-ghost";
  assert.equal(isValid(arbitraryApprover), false);
  const findings = validateArtifactSemantics("grant-portfolio-manager", arbitraryApprover);
  assert.ok(findings.some((item) => item.code === "dangling_reference"));
  assert.ok(findings.some((item) => item.code === "self_attested_approval"));
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("grant portfolio validator rejects the portfolio owner self-approving their own opportunity", () => {
  const ownerSelfApproval = clone();
  ownerSelfApproval.approvals[0].approverId = ownerSelfApproval.portfolio.ownerId;
  assert.equal(isValid(ownerSelfApproval), false);
  const findings = validateArtifactSemantics("grant-portfolio-manager", ownerSelfApproval);
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("grant portfolio validator rejects an approver principal lacking submission-readiness-approval scope", () => {
  const missingScope = clone();
  missingScope.principals.find((item) => item.id === "principal-marcus-alvarez").scopes = ["board-member"];
  assert.equal(isValid(missingScope), false);
  const findings = validateArtifactSemantics("grant-portfolio-manager", missingScope);
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("grant portfolio validator rejects an agent-identity eligibility assessor bound by id", () => {
  const agentAssessed = clone();
  agentAssessed.principals.push({
    id: "principal-agent-assessor",
    name: "assistant",
    roles: ["automation"],
    scopes: ["eligibility-assessment"],
  });
  agentAssessed.opportunities[0].eligibility.assessedById = "principal-agent-assessor";
  assert.equal(isValid(agentAssessed), false);
  const findings = validateArtifactSemantics("grant-portfolio-manager", agentAssessed);
  assert.ok(findings.some((item) => item.code === "invalid_principal_identity"));
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("grant portfolio validator rejects an arbitrary, unregistered eligibility assessedById", () => {
  const arbitraryAssessor = clone();
  arbitraryAssessor.opportunities[0].eligibility.assessedById = "principal-ghost-assessor";
  assert.equal(isValid(arbitraryAssessor), false);
  const findings = validateArtifactSemantics("grant-portfolio-manager", arbitraryAssessor);
  assert.ok(findings.some((item) => item.code === "dangling_reference"));
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("grant portfolio validator rejects evidence asserted after the portfolio's asOfDate", () => {
  const futureEvidence = clone();
  futureEvidence.evidence.find((item) => item.id === "evidence-budget-youth-workforce").assertedAt =
    "2026-09-10T00:00:00Z";
  assert.equal(isValid(futureEvidence), false);
  const findings = validateArtifactSemantics("grant-portfolio-manager", futureEvidence);
  assert.ok(findings.some((item) => item.code === "future_evidence_timestamp"));
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("grant portfolio validator rejects an approval approved after the portfolio's asOfDate", () => {
  const futureApproval = clone();
  futureApproval.approvals[0].approvedAt = "2026-09-10T00:00:00Z";
  assert.equal(isValid(futureApproval), false);
  const findings = validateArtifactSemantics("grant-portfolio-manager", futureApproval);
  assert.ok(findings.some((item) => item.code === "future_approval_timestamp"));
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("grant portfolio validator rejects eligibility evidence asserted after the assessment it grounds", () => {
  const outOfOrder = clone();
  outOfOrder.opportunities[0].eligibility.assessedAt = "2026-08-30T00:00:00Z";
  assert.equal(isValid(outOfOrder), false);
  const findings = validateArtifactSemantics("grant-portfolio-manager", outOfOrder);
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("grant portfolio validator rejects approval before partner or source evidence", () => {
  for (const evidenceId of [
    "evidence-partner-workforce-board",
    "evidence-source-youth-workforce",
  ]) {
    const outOfOrder = clone();
    outOfOrder.evidence.find((item) => item.id === evidenceId).assertedAt =
      "2026-09-03T12:00:00Z";
    assert.equal(isValid(outOfOrder), false, evidenceId);
    const findings = validateArtifactSemantics("grant-portfolio-manager", outOfOrder);
    assert.ok(
      findings.some((item) => item.code === "premature_ready_state"),
      `expected approval chronology finding for ${evidenceId}`,
    );
  }
});

test("grant portfolio validator treats a date-only deadline as the end of that day", () => {
  const deadlineDay = clone();
  deadlineDay.opportunities[0].deadline = deadlineDay.portfolio.asOfDate;
  assert.equal(validateSchema(deadlineDay), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("grant-portfolio-manager", deadlineDay), []);
});

test("grant portfolio validator does not downgrade malformed enriched fields to legacy semantics", () => {
  const malformed = { ...clone(), ...legacyGrantOpportunity };
  malformed.handoff = 42;
  assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("grant-portfolio-manager", malformed));
  assert.equal(isValid(malformed), false);
  assert.ok(
    validateArtifactSemantics("grant-portfolio-manager", malformed).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );
});

test("grant portfolio validator does not downgrade incomplete hybrid records to legacy semantics", () => {
  const incomplete = { ...clone(), ...legacyGrantOpportunity };
  delete incomplete.handoff;
  assert.equal(validateSchema(incomplete), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("grant-portfolio-manager", incomplete));
  assert.equal(isValid(incomplete), false);
  assert.ok(validateArtifactSemantics("grant-portfolio-manager", incomplete).length > 0);
});

test("grant portfolio validator rejects a malformed/empty controlled evidence sourceRef", () => {
  const emptyControlled = clone();
  emptyControlled.evidence.find((item) => item.id === "evidence-budget-youth-workforce").sourceRef = "controlled://";
  assert.equal(isValid(emptyControlled), false);
  const findings = validateArtifactSemantics("grant-portfolio-manager", emptyControlled);
  assert.ok(findings.some((item) => item.code === "untrusted_evidence_source"));
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("grant portfolio validator rejects stale source-listing evidence outside the freshness window", () => {
  const stale = clone();
  stale.evidence.find((item) => item.id === "evidence-source-youth-workforce").assertedAt =
    "2026-06-01T00:00:00Z";
  assert.equal(isValid(stale), false);
  const findings = validateArtifactSemantics("grant-portfolio-manager", stale);
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("grant portfolio validator rejects a requirement with a null evidence reference bypassing readiness", () => {
  const missingRequirementEvidence = clone();
  missingRequirementEvidence.opportunities[0].requirements[0].evidenceRef = null;
  assert.equal(isValid(missingRequirementEvidence), false);
  const findings = validateArtifactSemantics("grant-portfolio-manager", missingRequirementEvidence);
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("grant portfolio validator rejects a budget claiming a match without a securing evidence reference", () => {
  const unmetMatch = clone();
  unmetMatch.opportunities[0].budget.matchSecuredAmount = 0;
  assert.equal(isValid(unmetMatch), false);
  const findings = validateArtifactSemantics("grant-portfolio-manager", unmetMatch);
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("grant portfolio validator rejects a blank portfolio owner and blank handoff owner", () => {
  const blankOwner = clone();
  blankOwner.portfolio.ownerId = "   ";
  blankOwner.handoff.owner = "   ";
  assert.equal(isValid(blankOwner), false);
  const findings = validateArtifactSemantics("grant-portfolio-manager", blankOwner);
  assert.ok(findings.some((item) => item.code === "dangling_reference"));
  assert.ok(findings.some((item) => item.code === "agent_owned_authority"));
});

test("grant portfolio validator rejects the exact package self-attestation identity 'grant portfolio manager' as owner", () => {
  const packageOwner = clone();
  packageOwner.handoff.owner = "Grant Portfolio Manager";
  assert.equal(isValid(packageOwner), false);
  const findings = validateArtifactSemantics("grant-portfolio-manager", packageOwner);
  assert.ok(findings.some((item) => item.code === "agent_owned_authority"));
});

test("grant portfolio validator requires the handoff to stay blocked while any opportunity is neither ready nor terminal", () => {
  const prematureReady = clone();
  prematureReady.handoff.state = "ready";
  assert.equal(isValid(prematureReady), false);
  const findings = validateArtifactSemantics("grant-portfolio-manager", prematureReady);
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("grant portfolio validator rejects an empty portfolio claiming readiness", () => {
  const empty = clone();
  empty.opportunities = [];
  empty.evidence = [];
  empty.approvals = [];
  empty.handoff.opportunityRefs = [];
  empty.handoff.readyOpportunityRefs = [];
  empty.handoff.state = "ready";
  assert.equal(validateSchema(empty), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(empty), false);
  assert.ok(
    validateArtifactSemantics("grant-portfolio-manager", empty).some(
      (item) => item.code === "premature_ready_state",
    ),
  );
});

test("grant portfolio validator accepts a blocked handoff once the blocking opportunity is withdrawn (terminal)", () => {
  const withdrawn = clone();
  withdrawn.opportunities[1].readiness = "withdrawn";
  withdrawn.handoff.state = "ready";
  assert.deepEqual(validateArtifactSemantics("grant-portfolio-manager", withdrawn), []);
});

test("grant portfolio validator rejects an unauthorized narrative claim of funder contact", () => {
  const narrative = clone();
  narrative.handoff.summary = "We contacted the funder to confirm the deadline extension.";
  assert.equal(isValid(narrative), false);
  const findings = validateArtifactSemantics("grant-portfolio-manager", narrative);
  assert.ok(findings.some((item) => item.code === "unauthorized_narrative_action"));
});

// A HEAD-authored artifact predating the portfolio contract: the exact
// pre-checkpoint-3 single-opportunity shape (id/source/deadline/eligibility/
// readiness, all bare strings, no portfolio/opportunities/evidence/etc.).
const legacyGrantOpportunity = {
  id: "opp-legacy-001",
  source: "https://example-state-portal.gov/grants/legacy-001",
  deadline: "2026-10-01",
  eligibility: "Eligible nonprofit serving the declared program area.",
  readiness: "in-review",
};

test("grant opportunity schema preserves the original HEAD legacy single-opportunity shape as a distinct anyOf branch", () => {
  assert.equal(validateSchema(legacyGrantOpportunity), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("grant-portfolio-manager", legacyGrantOpportunity), []);

  // The anyOf legacy branch is schemaVersion-agnostic (exactly like the
  // original HEAD schema), so a legacy-shaped document combined with an
  // arbitrary "schemaVersion" marker remains schema-valid -- HEAD would
  // have accepted it, and this schema must too. Semantic dispatch must
  // still treat it as legacy (bounded semantics, no portfolio-only fields
  // required) because it lacks the complete enriched required shape.
  const bothShapesAtOnce = { ...legacyGrantOpportunity, schemaVersion: "awesomeClaws.grantOpportunity.v1" };
  assert.equal(validateSchema(bothShapesAtOnce), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("grant-portfolio-manager", bothShapesAtOnce), []);

  for (const field of Object.keys(legacyGrantOpportunity)) {
    const incomplete = { ...legacyGrantOpportunity };
    delete incomplete[field];
    assert.equal(
      validateSchema(incomplete),
      false,
      `expected legacy shape missing "${field}" to fail schema validation`,
    );
  }
});

test("grant portfolio validator dispatches an overlapping legacy+enriched artifact to the full enriched contract", () => {
  // A document that carries both the legacy fields AND the complete
  // enriched required shape validates against both anyOf branches at once,
  // but semantic dispatch must be unambiguous: since the full enriched
  // shape is present, it gets the full portfolio contract, not bounded
  // legacy semantics.
  const overlap = { ...clone(), ...legacyGrantOpportunity };
  assert.equal(validateSchema(overlap), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("grant-portfolio-manager", overlap), []);
});

test("grant portfolio validator applies bounded legacy semantics without requiring portfolio-only fields", () => {
  const blankField = { ...legacyGrantOpportunity, eligibility: "   " };
  assert.equal(validateSchema(blankField), true, JSON.stringify(validateSchema.errors));
  assert.ok(
    validateArtifactSemantics("grant-portfolio-manager", blankField).some(
      (item) => item.code === "invalid_legacy_field",
    ),
  );

  const unparseableDeadline = { ...legacyGrantOpportunity, deadline: "not-a-real-timestamp" };
  assert.equal(validateSchema(unparseableDeadline), true, JSON.stringify(validateSchema.errors));
  assert.ok(
    validateArtifactSemantics("grant-portfolio-manager", unparseableDeadline).some(
      (item) => item.code === "invalid_timestamp",
    ),
  );

  const unknownReadiness = { ...legacyGrantOpportunity, readiness: "archived" };
  assert.equal(validateSchema(unknownReadiness), true, JSON.stringify(validateSchema.errors));
  assert.ok(
    validateArtifactSemantics("grant-portfolio-manager", unknownReadiness).some(
      (item) => item.code === "invalid_legacy_readiness",
    ),
  );
});

test("validate-artifact CLI accepts the packaged grant-portfolio-manager fixture", () => {
  const result = spawnSync(
    process.execPath,
    [resolve(root, "scripts", "validate-artifact.mjs"), "grant-portfolio-manager", fixturePath],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.valid, true);
  assert.deepEqual(output.semanticFindings, []);
});

test("validate-artifact CLI accepts an exact HEAD legacy grant opportunity artifact", async () => {
  const scratchDir = resolve(root, ".tmp");
  const scratchPath = resolve(scratchDir, `grant-portfolio-legacy-cli-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(scratchPath, `${JSON.stringify(legacyGrantOpportunity, null, 2)}\n`);
  try {
    const result = spawnSync(
      process.execPath,
      [resolve(root, "scripts", "validate-artifact.mjs"), "grant-portfolio-manager", scratchPath],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.valid, true);
    assert.deepEqual(output.schemaErrors, []);
    assert.deepEqual(output.semanticFindings, []);
  } finally {
    await rm(scratchPath, { force: true });
  }
});

test("validate-artifact CLI reports semantic findings for a premature-ready grant portfolio artifact", async () => {
  const prematureReady = clone();
  prematureReady.handoff.state = "ready";
  assert.equal(validateSchema(prematureReady), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(prematureReady), false);
  const scratchDir = resolve(root, ".tmp");
  const scratchPath = resolve(scratchDir, `grant-portfolio-manager-cli-negative-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(scratchPath, `${JSON.stringify(prematureReady, null, 2)}\n`);
  try {
    const { NODE_TEST_CONTEXT: _nodeTestContext, ...childEnv } = process.env;
    const result = spawnSync(
      process.execPath,
      [resolve(root, "scripts", "validate-artifact.mjs"), "grant-portfolio-manager", scratchPath],
      { cwd: root, encoding: "utf8", env: childEnv },
    );
    assert.equal(result.status, 1, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.schemaErrors.length, 0);
    assert.equal(output.valid, false);
    assert.equal(
      output.semanticFindings.some((finding) => finding.code === "premature_ready_state"),
      true,
    );
  } finally {
    await rm(scratchPath, { force: true });
  }
});
