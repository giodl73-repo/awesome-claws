import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  buildStrongestCompositionProbe,
  canonicalJson,
  deriveIncidentArtifact,
  digest,
  OWNER_CONTRACTS,
  requireLosslessProposalComposition,
  roundTripOwnerProjection,
} from "./composition-adapter.mjs";
import {
  artifactSemanticValidationOptions,
  validateArtifactSemantics,
} from "../../../scripts/artifact-semantics.mjs";

async function json(relative) {
  return JSON.parse(await readFile(new URL(relative, import.meta.url), "utf8"));
}

const definitions = {
  "incident-response": {
    artifact: "../../../sources/incident-response/fixtures/incident-state.example.json",
    schema: "../../../sources/incident-response/schemas/incident-state.schema.json",
  },
  "quality-assurance-lead": {
    artifact:
      "../../../sources/quality-assurance-lead/fixtures/test-evidence.example.json",
    schema:
      "../../../sources/quality-assurance-lead/schemas/test-evidence.schema.json",
  },
  "change-control-operator": {
    artifact:
      "../../../sources/change-control-operator/fixtures/change-plan.example.json",
    schema:
      "../../../sources/change-control-operator/schemas/change-plan.schema.json",
  },
  "repository-compliance-program-manager": {
    artifact:
      "../../../sources/repository-compliance-program-manager/fixtures/repository-compliance-program.example.json",
    schema:
      "../../../sources/repository-compliance-program-manager/schemas/repository-compliance-program.schema.json",
  },
  "case-continuity-coordinator": {
    artifact:
      "../../../sources/case-continuity-coordinator/fixtures/case-checkpoint.example.json",
    schema:
      "../../../sources/case-continuity-coordinator/schemas/case-checkpoint.schema.json",
  },
};

const proposal = await json("./accepted.json");
const sources = Object.fromEntries(
  await Promise.all(
    Object.entries(definitions).map(async ([id, paths]) => [
      id,
      {
        artifact: await json(paths.artifact),
        schema: await json(paths.schema),
      },
    ]),
  ),
);

function clone(value) {
  return structuredClone(value);
}

test("all five owner artifacts are schema and semantic valid at their pinned digests", () => {
  for (const [id, source] of Object.entries(sources)) {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const validateSchema = ajv.compile(source.schema);
    assert.equal(
      validateSchema(source.artifact),
      true,
      `${id}: ${ajv.errorsText(validateSchema.errors)}`,
    );
    assert.deepEqual(
      validateArtifactSemantics(
        id,
        source.artifact,
        artifactSemanticValidationOptions(id),
      ),
      [],
      id,
    );
    assert.equal(digest(source.artifact), OWNER_CONTRACTS[id].artifactDigest);
    assert.equal(digest(source.schema), OWNER_CONTRACTS[id].schemaDigest);
  }

  const incidentSchema = sources["incident-response"].schema;
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validateIncident = ajv.compile(incidentSchema);
  const variants = proposal.incidentMemberships.map((membership) =>
    deriveIncidentArtifact(
      sources["incident-response"].artifact,
      membership,
    ),
  );
  assert.equal(new Set(variants.map((row) => row.incident.id)).size, 3);
  for (const [index, variant] of variants.entries()) {
    assert.equal(
      validateIncident(variant),
      true,
      ajv.errorsText(validateIncident.errors),
    );
    assert.deepEqual(
      validateArtifactSemantics("incident-response", variant),
      [],
    );
    assert.equal(
      variant.incident.id,
      proposal.incidentMemberships[index].incidentRef,
    );
    assert.equal(
      variant.followUps[0].id,
      proposal.incidentMemberships[index].followUpRef,
    );
    assert.equal(
      variant.followUps[0].identityKey,
      proposal.incidentMemberships[index].followUpIdentityKey,
    );
  }
});

test("source-derived projection round-trips exact owner contract surfaces", () => {
  const probe = buildStrongestCompositionProbe(proposal, sources);
  const roundTripped = roundTripOwnerProjection(probe, sources);
  assert.equal(
    canonicalJson(roundTripped),
    canonicalJson(probe.sourceProjection),
  );
  assert.deepEqual(
    roundTripped["incident-response"].identity.followUp,
    {
      id: sources["incident-response"].artifact.followUps[0].id,
      identityKey:
        sources["incident-response"].artifact.followUps[0].identityKey,
      incidentRef:
        sources["incident-response"].artifact.followUps[0].incidentRef,
    },
  );
});

test("strongest composition reports concrete typed lineage losses", () => {
  const probe = buildStrongestCompositionProbe(proposal, sources);
  assert.deepEqual(
    probe.lostTypedInvariants.map((row) => row.id),
    [
      "owner-signed-cross-incident-manifest",
      "hypothesis-proposal-disposition-lineage",
      "known-error-workaround-lineage",
      "post-change-recurrence-lineage",
      "closed-problem-lifecycle-coverage",
    ],
  );
  assert.throws(
    () => requireLosslessProposalComposition(probe),
    /Composition loses typed invariants/u,
  );

  const unrelatedProposal = clone(proposal);
  unrelatedProposal.incidentMemberships[0].incidentRef =
    "incident-not-in-owner-artifact";
  const unrelatedProbe = buildStrongestCompositionProbe(
    unrelatedProposal,
    sources,
  );
  assert.notEqual(unrelatedProbe.proposalDigest, probe.proposalDigest);
  assert.notDeepEqual(
    unrelatedProbe.sourceBindings["incident-response"].derivedArtifacts,
    probe.sourceBindings["incident-response"].derivedArtifacts,
  );
  assert.throws(
    () => requireLosslessProposalComposition(unrelatedProbe),
    /owner-signed-cross-incident-manifest/u,
  );
});

test("composition resolves QA and recurrence references in their own namespaces", () => {
  const compatible = clone(proposal);
  const qaRun = sources["quality-assurance-lead"].artifact.testRuns[0];
  Object.assign(compatible.tests[0], {
    testRunRef: qaRun.id,
    buildId: qaRun.buildId,
    environment: qaRun.environment,
    executedAt: qaRun.executedAt,
    executedByRef: qaRun.executedById,
    outcome: qaRun.result === "passed" ? "supports" : "refutes",
  });
  const incidentFollowUp =
    sources["incident-response"].artifact.followUps[0];
  const recurrenceMembership = compatible.incidentMemberships.find(
    (row) => row.id === compatible.recurrences[0].incidentMembershipRef,
  );
  recurrenceMembership.followUpRef = incidentFollowUp.id;
  recurrenceMembership.followUpIdentityKey = incidentFollowUp.identityKey;

  const probe = buildStrongestCompositionProbe(compatible, sources);
  const hypothesisComparison = probe.operationalComparisons.find(
    (row) => row.id === "hypothesis-proposal-disposition-lineage",
  );
  assert.ok(hypothesisComparison.proposalEvidence.matchedTestRefs.includes(
    compatible.tests[0].id,
  ));
  const recurrenceComparison = probe.operationalComparisons.find(
    (row) => row.id === "post-change-recurrence-lineage",
  );
  assert.equal(
    recurrenceComparison.proposalEvidence.resolvedMembershipFollowUpRef,
    incidentFollowUp.id,
  );
  assert.equal(
    recurrenceComparison.proposalEvidence
      .resolvedMembershipFollowUpIdentityKey,
    incidentFollowUp.identityKey,
  );

  const ownerHypothesis =
    sources["incident-response"].artifact.hypotheses[0];
  compatible.hypotheses = [
    {
      ...compatible.hypotheses[0],
      id: ownerHypothesis.id,
      state: ownerHypothesis.state,
      ownerRef: ownerHypothesis.ownerId,
    },
  ];
  compatible.tests = [compatible.tests[0]];
  assert.doesNotThrow(() =>
    buildStrongestCompositionProbe(compatible, sources),
  );
});

test("composition fails closed on owner artifact and follow-up drift", () => {
  const probe = buildStrongestCompositionProbe(proposal, sources);
  const changedFollowUp = clone(sources);
  changedFollowUp["incident-response"].artifact.followUps[0].identityKey =
    "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
  assert.throws(
    () => roundTripOwnerProjection(probe, changedFollowUp),
    /complete pinned contract/u,
  );
});
