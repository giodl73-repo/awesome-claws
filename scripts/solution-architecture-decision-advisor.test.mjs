import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";
import {
  computeArchitectureAdrDigest,
  computeArchitectureDecisionDigest,
} from "./solution-architecture-decision-advisor.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = resolve(
  root,
  "claws",
  "solution-architecture-decision-advisor",
  "fixtures",
  "architecture-decision.example.json",
);
const schema = JSON.parse(
  await readFile(
    resolve(
      root,
      "claws",
      "solution-architecture-decision-advisor",
      "schemas",
      "architecture-decision.schema.json",
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function clone() {
  return structuredClone(fixture);
}

function findings(candidate) {
  return validateArtifactSemantics("solution-architecture-decision-advisor", candidate);
}

function hasCode(candidate, code) {
  return findings(candidate).some((item) => item.code === code);
}

function refreshDecisionDigest(candidate) {
  candidate.decision.contentDigest = computeArchitectureDecisionDigest(candidate.decision);
  candidate.handoff.decisionDigest = candidate.decision.contentDigest;
}

function preDecisionFixture(state) {
  const candidate = clone();
  candidate.decision.state = state;
  candidate.decision.selectedOptionRef = null;
  candidate.decision.selectedOptionRevision = null;
  candidate.decision.selectedOptionDigest = null;
  candidate.decision.decidedAt = null;
  candidate.decision.adrRevisionRef = null;
  candidate.decision.adrDigest = null;
  candidate.decision.residualRiskRefs = [];
  candidate.decision.summary =
    state === "planned"
      ? "Architecture comparison is planned. No owner selection is claimed. No decision is recorded. No risk is accepted."
      : state === "blocked"
        ? "Architecture comparison is blocked pending evidence. No owner selection is claimed. No decision is recorded. No risk is accepted."
        : "The complete comparison is ready for accountable owner review. No owner selection is claimed. No decision is recorded. No risk is accepted.";
  candidate.handoff.state = state;
  candidate.handoff.summary =
    "This non-terminal handoff preserves the current evidence state. No owner selection is claimed. No decision is recorded. No risk is accepted.";
  if (state === "ready-for-owner-review") {
    candidate.adrRevisions = [candidate.adrRevisions[0]];
    candidate.adrRevisions[0].state = "current";
    candidate.adrRevisions[0].rationale =
      "Prepared the complete comparison for owner review. No owner selection is claimed. No decision is recorded. No ADR is superseded because of a decision.";
    candidate.adrRevisions[0].contentDigest = computeArchitectureAdrDigest(
      candidate.adrRevisions[0],
    );
  } else {
    candidate.evidence = [];
    candidate.coverage = [];
    candidate.tradeoffs = [];
    candidate.risks = [];
    candidate.adrRevisions = [];
    candidate.decision.evidenceRefs = [];
    for (const experiment of candidate.experiments) {
      experiment.state = state === "blocked" ? "blocked" : "planned";
      experiment.completedAt = null;
      experiment.evidenceRefs = [];
    }
  }
  refreshDecisionDigest(candidate);
  return candidate;
}

test("architecture fixture preserves complete comparable evidence and owner decision chronology", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
});

test("accepts honest planned, blocked, and ready-for-owner-review states without terminal authority", () => {
  for (const state of ["planned", "blocked", "ready-for-owner-review"]) {
    const candidate = preDecisionFixture(state);
    assert.equal(validateSchema(candidate), true, `${state}: ${JSON.stringify(validateSchema.errors)}`);
    assert.deepEqual(findings(candidate), [], state);
  }
});

test("rejects drift in the approved requirement-universe and option content digests", () => {
  const requirementDrift = clone();
  requirementDrift.requirements[0].statement = "Changed after approval";
  assert.equal(hasCode(requirementDrift, "invalid_requirement_universe"), true);

  const optionDrift = clone();
  optionDrift.options[0].description = "Changed without a revision or digest update";
  assert.equal(hasCode(optionDrift, "invalid_option_digest"), true);
});

test("rejects stale digest bindings across every downstream decision surface", () => {
  const cases = [
    ["evidence", (value) => (value.evidence[0].optionDigest = `sha256:${"0".repeat(64)}`), "cross_scope_evidence"],
    ["coverage", (value) => (value.coverage[0].requirementUniverseDigest = `sha256:${"0".repeat(64)}`), "cross_scope_requirement_coverage"],
    ["tradeoff", (value) => (value.tradeoffs[0].optionDigest = `sha256:${"0".repeat(64)}`), "cross_scope_tradeoff_evidence"],
    ["experiment", (value) => (value.experiments[0].optionBindings[0].optionDigest = `sha256:${"0".repeat(64)}`), "invalid_option_digest_binding"],
    ["risk", (value) => (value.risks[0].optionDigest = `sha256:${"0".repeat(64)}`), "invalid_residual_risk"],
    ["ADR", (value) => (value.adrRevisions[0].requirementUniverseDigest = `sha256:${"0".repeat(64)}`), "invalid_adr_chronology"],
    ["decision", (value) => (value.decision.requirementUniverseDigest = `sha256:${"0".repeat(64)}`), "invalid_decision_binding"],
    ["handoff", (value) => (value.handoff.decisionDigest = `sha256:${"0".repeat(64)}`), "premature_handoff"],
  ];
  for (const [label, mutate, code] of cases) {
    const candidate = clone();
    mutate(candidate);
    assert.equal(hasCode(candidate, code), true, label);
  }
});

test("semantic validator remains total over malformed nested ledgers", () => {
  for (const field of [
    "principals",
    "requirements",
    "options",
    "criteria",
    "evidence",
    "coverage",
    "tradeoffs",
    "risks",
    "experiments",
    "adrRevisions",
  ]) {
    const candidate = clone();
    candidate[field].push(null);
    assert.doesNotThrow(() => findings(candidate), field);
    assert.equal(hasCode(candidate, "invalid_array_record"), true, field);
  }
  const candidate = clone();
  candidate.coverage = {};
  assert.doesNotThrow(() => findings(candidate));
  assert.equal(hasCode(candidate, "invalid_array_list"), true);
});

test("rejects an omitted requirement or coverage cell from the approved universe", () => {
  const missingRequirement = clone();
  missingRequirement.requirements.pop();
  assert.equal(hasCode(missingRequirement, "invalid_requirement_universe"), true);

  const missingCoverage = clone();
  missingCoverage.coverage.pop();
  assert.equal(hasCode(missingCoverage, "incomplete_requirement_coverage"), true);
  assert.equal(hasCode(missingCoverage, "premature_owner_decision"), true);
});

test("rejects option identity drift across evidence and coverage", () => {
  const candidate = clone();
  candidate.evidence[0].optionRevision = 99;
  assert.equal(hasCode(candidate, "cross_scope_evidence"), true);
  assert.equal(hasCode(candidate, "cross_scope_requirement_coverage"), true);
});

test("rejects cross-option tradeoff evidence", () => {
  const candidate = clone();
  candidate.tradeoffs[0].evidenceRefs = ["evidence-serverless-fit"];
  assert.equal(hasCode(candidate, "cross_scope_tradeoff_evidence"), true);
});

test("rejects incomparable option evidence sets", () => {
  const candidate = clone();
  candidate.evidence.find((item) => item.id === "evidence-serverless-cost").comparableSetId =
    "comparison-other-cost-model";
  assert.equal(hasCode(candidate, "incomparable_evidence"), true);
});

test("rejects a specialist claim owned without the criterion scope", () => {
  const candidate = clone();
  candidate.evidence.find((item) => item.id === "evidence-containers-security").ownerRef =
    "principal-finops";
  assert.equal(hasCode(candidate, "specialist_claim_without_authority"), true);
});

test("does not let an artifact redefine the fixed specialist authority mapping", () => {
  const candidate = clone();
  const criterion = candidate.criteria.find((item) => item.dimension === "security");
  criterion.requiredSpecialistScope = "cost-assessment";
  candidate.evidence.find((item) => item.id === "evidence-containers-security").ownerRef =
    "principal-finops";
  assert.equal(hasCode(candidate, "invalid_specialist_scope_mapping"), true);
  assert.equal(hasCode(candidate, "specialist_claim_without_authority"), true);
});

test("rejects incomplete or cross-scoped experiment result evidence", () => {
  const candidate = clone();
  candidate.experiments[0].evidenceRefs = ["evidence-containers-reliability"];
  assert.equal(hasCode(candidate, "invalid_experiment_evidence"), true);
});

test("requires completed experiment evidence for every option and criterion pair", () => {
  const candidate = clone();
  candidate.experiments[0].criterionRefs.push("criterion-operability");
  assert.equal(hasCode(candidate, "invalid_experiment_evidence"), true);
});

test("accepts an explicitly cross-cutting risk only when evidence covers every active option", () => {
  const candidate = clone();
  candidate.risks.push({
    id: "risk-shared-provider-control",
    scope: "cross-cutting",
    optionRef: null,
    optionRevision: null,
    optionDigest: null,
    requirementUniverseDigest: candidate.requirementUniverse.contentDigest,
    statement: "Both options depend on the same owner-managed provider control.",
    severity: "medium",
    state: "open",
    residual: true,
    ownerRef: "principal-security",
    evidenceRefs: ["evidence-containers-security", "evidence-serverless-security"],
  });
  candidate.decision.residualRiskRefs.push("risk-shared-provider-control");
  refreshDecisionDigest(candidate);
  assert.deepEqual(findings(candidate), []);

  candidate.risks.at(-1).evidenceRefs = ["evidence-containers-security"];
  assert.equal(hasCode(candidate, "invalid_residual_risk"), true);
});

test("rejects decision chronology before evidence", () => {
  const candidate = clone();
  candidate.decision.decidedAt = "2026-09-14T15:30:00Z";
  assert.equal(hasCode(candidate, "premature_owner_decision"), true);
});

test("enforces approval, attestation, experiment, ADR, decision, and handoff chronology", () => {
  const cases = [
    [
      "attestation before approval",
      (value) => (value.requirementUniverse.completenessAttestedAt = "2026-09-09T16:00:00Z"),
      "invalid_architecture_chronology",
    ],
    [
      "evidence before attestation",
      (value) => (value.evidence[0].assertedAt = "2026-09-09T16:00:00Z"),
      "cross_scope_evidence",
    ],
    [
      "experiment before attestation",
      (value) => (value.experiments[0].startedAt = "2026-09-09T16:00:00Z"),
      "invalid_experiment_evidence",
    ],
    [
      "ADR before referenced evidence",
      (value) => (value.adrRevisions[0].createdAt = "2026-09-14T11:00:00Z"),
      "invalid_adr_chronology",
    ],
    [
      "handoff before decision ADR",
      (value) => (value.handoff.generatedAt = "2026-09-14T18:20:00Z"),
      "premature_handoff",
    ],
  ];
  for (const [label, mutate, code] of cases) {
    const candidate = clone();
    mutate(candidate);
    assert.equal(hasCode(candidate, code), true, label);
  }
});

test("rejects broken ADR chronology and supersession", () => {
  const badChronology = clone();
  badChronology.adrRevisions[1].createdAt = "2026-09-14T17:30:00Z";
  assert.equal(hasCode(badChronology, "invalid_adr_chronology"), true);

  const badSupersession = clone();
  badSupersession.adrRevisions[1].supersedesRef = null;
  assert.equal(hasCode(badSupersession, "invalid_adr_supersession"), true);
});

test("requires exactly one current post-decision ADR to reference a recorded decision", () => {
  const duplicateReference = clone();
  duplicateReference.adrRevisions[0].recordedDecisionRef =
    duplicateReference.decision.id;
  duplicateReference.adrRevisions[0].contentDigest = computeArchitectureAdrDigest(
    duplicateReference.adrRevisions[0],
  );
  assert.equal(hasCode(duplicateReference, "invalid_decision_adr_binding"), true);

  const supersededOnly = clone();
  supersededOnly.adrRevisions[0].recordedDecisionRef = supersededOnly.decision.id;
  supersededOnly.adrRevisions[0].contentDigest = computeArchitectureAdrDigest(
    supersededOnly.adrRevisions[0],
  );
  supersededOnly.adrRevisions[1].recordedDecisionRef = null;
  supersededOnly.adrRevisions[1].contentDigest = computeArchitectureAdrDigest(
    supersededOnly.adrRevisions[1],
  );
  supersededOnly.decision.adrDigest = supersededOnly.adrRevisions[1].contentDigest;
  refreshDecisionDigest(supersededOnly);
  assert.equal(hasCode(supersededOnly, "invalid_decision_adr_binding"), true);

  const earlyDecisionAdr = clone();
  earlyDecisionAdr.adrRevisions[1].createdAt = "2026-09-14T18:20:00Z";
  earlyDecisionAdr.adrRevisions[1].contentDigest = computeArchitectureAdrDigest(
    earlyDecisionAdr.adrRevisions[1],
  );
  earlyDecisionAdr.decision.adrDigest = earlyDecisionAdr.adrRevisions[1].contentDigest;
  refreshDecisionDigest(earlyDecisionAdr);
  assert.equal(hasCode(earlyDecisionAdr, "invalid_decision_adr_binding"), true);
});

test("rejects terminal decision claims from every pre-decision narrative surface", () => {
  const cases = [
    ["decision summary", (value) => (value.decision.summary = "The owner selected managed containers.")],
    ["handoff summary", (value) => (value.handoff.summary = "The owner decision was recorded.")],
    [
      "current ADR rationale",
      (value) => {
        value.adrRevisions[0].rationale =
          "ADR-001 was superseded because of the owner selection.";
        value.adrRevisions[0].contentDigest = computeArchitectureAdrDigest(
          value.adrRevisions[0],
        );
      },
    ],
    ["other visible narrative", (value) => (value.tradeoffs[0].summary = "Risk acceptance was approved.")],
  ];
  for (const [label, mutate] of cases) {
    const candidate = preDecisionFixture("ready-for-owner-review");
    mutate(candidate);
    refreshDecisionDigest(candidate);
    assert.equal(hasCode(candidate, "premature_decision_narrative"), true, label);
  }
});

test("rejects exact choose, residual-risk acceptance, and choice-caused supersession claims in every pre-decision state", () => {
  const claims = [
    "Morgan Lee chose managed containers.",
    "Morgan Lee accepted the residual risks.",
    "ADR-001 was superseded by ADR-002 following Morgan Lee's choice.",
    "Morgan Lee chooses managed containers.",
    "Managed containers were chosen by Morgan Lee.",
    "Morgan Lee's choice was managed containers.",
  ];
  for (const state of ["planned", "blocked", "ready-for-owner-review"]) {
    for (const claim of claims) {
      const candidate = preDecisionFixture(state);
      candidate.decision.summary = claim;
      refreshDecisionDigest(candidate);
      assert.equal(
        hasCode(candidate, "premature_decision_narrative"),
        true,
        `${state}: ${claim}`,
      );
    }
  }
});

test("allows clearly negated and non-terminal pre-decision language", () => {
  const narratives = [
    "Morgan Lee did not choose managed containers. Owner selection remains pending.",
    "Morgan Lee did not accept either residual risk. Risk acceptance remains pending.",
    "ADR-001 was not superseded by ADR-002 following Morgan Lee's choice because no choice has been made.",
    "The owner will review the options; no decision is recorded.",
  ];
  for (const state of ["planned", "blocked", "ready-for-owner-review"]) {
    for (const narrative of narratives) {
      const candidate = preDecisionFixture(state);
      candidate.decision.summary = narrative;
      refreshDecisionDigest(candidate);
      assert.equal(
        hasCode(candidate, "premature_decision_narrative"),
        false,
        `${state}: ${narrative}`,
      );
      assert.deepEqual(findings(candidate), [], `${state}: ${narrative}`);
    }
  }
});

test("rejects an owner selection that does not satisfy every required item", () => {
  const candidate = clone();
  candidate.coverage.find(
    (item) =>
      item.optionRef === "opt-managed-containers" &&
      item.requirementRef === "constraint-operations-team",
  ).state = "partial";
  assert.equal(hasCode(candidate, "premature_owner_decision"), true);
});

test("rejects dropped selected-option residual risks", () => {
  const candidate = clone();
  candidate.decision.residualRiskRefs = ["risk-platform-team-ramp"];
  assert.equal(hasCode(candidate, "residual_risk_omitted"), true);
});

test("rejects a residual risk bound to the wrong option revision or option evidence", () => {
  const wrongRevision = clone();
  wrongRevision.risks[0].optionRevision = 1;
  assert.equal(hasCode(wrongRevision, "invalid_residual_risk"), true);

  const wrongEvidence = clone();
  wrongEvidence.risks[0].evidenceRefs = ["evidence-serverless-operability"];
  assert.equal(hasCode(wrongEvidence, "invalid_residual_risk"), true);
});

test("rejects agent-owned decision authority and specialist claims", () => {
  const candidate = clone();
  candidate.principals.find((item) => item.id === "principal-decision-owner").name =
    "Solution architecture decision advisor";
  assert.equal(hasCode(candidate, "invalid_principal_authority"), true);
});

test("rejects removal of any prohibited authority boundary", () => {
  const candidate = clone();
  candidate.handoff.prohibitedActions.pop();
  assert.equal(hasCode(candidate, "invalid_authority_boundary"), true);
});

test("rejects affirmative claims of deployment or risk acceptance by the advisor", () => {
  const candidate = clone();
  candidate.handoff.summary = "The advisor deployed the option and accepted the risk.";
  assert.equal(hasCode(candidate, "prohibited_architecture_authority_claim"), true);
});

test("validate-artifact CLI accepts the packaged architecture fixture", () => {
  const result = spawnSync(
    process.execPath,
    [
      resolve(root, "scripts", "validate-artifact.mjs"),
      "solution-architecture-decision-advisor",
      fixturePath,
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.valid, true);
  assert.deepEqual(output.schemaErrors, []);
  assert.deepEqual(output.semanticFindings, []);
});
