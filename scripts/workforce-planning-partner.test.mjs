import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";
import {
  computeWorkforceAuthorityRosterDigest,
  computeWorkforceEvidencePayloadDigest,
  computeWorkforceEvidenceRecordDigest,
  contentAddressedWorkforceEvidenceRef,
  sealWorkforceEvidence,
  workforcePlanningFindings,
} from "./workforce-planning-partner.mjs";

const fixture = JSON.parse(
  await readFile(
    new URL(
      "../claws/workforce-planning-partner/fixtures/workforce-plan-reconciliation.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/workforce-planning-partner/schemas/workforce-plan-reconciliation.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function mutate(change) {
  const candidate = structuredClone(fixture);
  change(candidate);
  return candidate;
}

function resealed(change) {
  return mutate((candidate) => {
    change(candidate);
    sealWorkforceEvidence(candidate);
  });
}

function codes(candidate) {
  return new Set(workforcePlanningFindings(candidate).map((item) => item.code));
}

test("workforce fixture is schema-valid and semantically reconciled", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(workforcePlanningFindings(fixture), []);
  assert.deepEqual(validateArtifactSemantics("workforce-planning-partner", fixture), []);
});

test("schema excludes individual workforce records and decision approvals", () => {
  const personalData = mutate((value) => {
    value.employees = [{ name: "Private Person", performanceRating: 5 }];
  });
  assert.equal(validateSchema(personalData), false);
  assert.ok(validateSchema.errors.some((error) => error.keyword === "additionalProperties"));

  const approvedDecision = mutate((value) => {
    value.decisionCheckpoints[0].state = "approved";
  });
  assert.equal(validateSchema(approvedDecision), false);
  assert.ok(validateSchema.errors.some((error) => error.instancePath.endsWith("/state")));
});

test("validator binds all workforce records to the exact approved plan revision", () => {
  const staleRevision = mutate((value) => {
    value.roleDemand[0].planRevision = 3;
  });
  assert.ok(codes(staleRevision).has("plan_scope_mismatch"));

  const wrongApproval = mutate((value) => {
    value.evidence[0].subjectRefs = ["plan-op-2027", "revision-3"];
  });
  assert.ok(codes(wrongApproval).has("unbound_plan_approval"));
});

test("validator binds every plan-scoped row to organization, id, revision, and horizon", () => {
  const wrongOrganization = mutate((value) => {
    value.roles[0].organizationRef = "org-other";
  });
  assert.ok(codes(wrongOrganization).has("plan_scope_mismatch"));

  const reversedHorizon = mutate((value) => {
    value.plan.horizonStart = "2027-04-01";
  });
  assert.ok(codes(reversedHorizon).has("invalid_plan_horizon"));

  const outOfHorizon = mutate((value) => {
    value.ownerActions[0].period = "2027-Q2";
  });
  assert.ok(codes(outOfHorizon).has("period_outside_plan_horizon"));
});

test("validator reconciles funded position pools, funding, and approved demand", () => {
  const overfundedPosition = mutate((value) => {
    value.fundedPositions[0].fundedFte = 9;
  });
  assert.ok(codes(overfundedPosition).has("funded_headcount_mismatch"));
  assert.ok(codes(overfundedPosition).has("invalid_workforce_reconciliation"));

  const inventedGap = mutate((value) => {
    value.reconciliations[0].baselineGapFte = 0;
  });
  assert.ok(codes(inventedGap).has("invalid_workforce_reconciliation"));

  const omittedDemand = mutate((value) => {
    value.reconciliations.pop();
  });
  assert.ok(codes(omittedDemand).has("incomplete_workforce_reconciliation"));
});

test("validator consumes every funding and position row exactly once with allowed demand locations", () => {
  const unconsumedFunding = mutate((value) => {
    value.reconciliations[0].fundingRefs = [];
  });
  assert.ok(codes(unconsumedFunding).has("incomplete_workforce_reconciliation"));
  assert.ok(codes(unconsumedFunding).has("invalid_workforce_reconciliation"));

  const duplicateConsumption = mutate((value) => {
    value.reconciliations[1].fundingRefs = ["funding-platform-engineer-q1"];
    value.reconciliations[1].positionRefs = ["position-pool-platform-us"];
  });
  assert.ok(codes(duplicateConsumption).has("incomplete_workforce_reconciliation"));

  const omittedFundingBinding = mutate((value) => {
    value.reconciliations[0].fundingRefs = ["funding-sre-q1"];
  });
  assert.ok(codes(omittedFundingBinding).has("invalid_workforce_reconciliation"));

  const disallowedPositionLocation = mutate((value) => {
    value.fundedPositions[2].locationRef = "location-canada";
  });
  assert.ok(codes(disallowedPositionLocation).has("invalid_workforce_reconciliation"));
});

test("fully unfunded demand reconciles through exact zero references and remains blocked", () => {
  const unfunded = resealed((value) => {
    value.funding = value.funding.filter(
      (row) => row.id !== "funding-platform-engineer-q1",
    );
    value.fundedPositions = value.fundedPositions.filter(
      (row) => row.roleRef !== "role-platform-engineer",
    );
    value.evidence.find(
      (row) => row.id === "evidence-funding-approval",
    ).subjectRefs = ["funding-sre-q1"];
    value.evidence.find(
      (row) => row.id === "evidence-position-snapshot",
    ).subjectRefs = ["position-pool-sre-us"];
    const reconciliation = value.reconciliations.find(
      (row) => row.id === "reconciliation-platform-engineer-q1",
    );
    reconciliation.fundingRefs = [];
    reconciliation.positionRefs = [];
    reconciliation.fundedFte = 0;
    reconciliation.baselineGapFte = 12;
    for (const location of value.locationConstraints.filter(
      (row) => row.demandRef === "demand-platform-engineer-q1",
    )) {
      location.fundedFte = 0;
      location.gapFte = location.demandFte;
      location.state = "constrained";
    }
    value.ownerActions.find(
      (row) => row.id === "action-location-constraint",
    ).targetRefs.push("location-gap-platform-us");
    value.handoff.blockerRefs.push("location-gap-platform-us");
  });

  assert.equal(validateSchema(unfunded), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(workforcePlanningFindings(unfunded), []);
  const reconciliation = unfunded.reconciliations.find(
    (row) => row.id === "reconciliation-platform-engineer-q1",
  );
  assert.deepEqual(reconciliation.fundingRefs, []);
  assert.deepEqual(reconciliation.positionRefs, []);
  assert.equal(reconciliation.fundedFte, 0);
  assert.equal(reconciliation.baselineGapFte, 12);
  assert.ok(unfunded.handoff.blockerRefs.includes(reconciliation.id));
});

test("an entirely unfunded plan reconciles every demand to zero and remains blocked", () => {
  const unfunded = resealed((value) => {
    value.funding = [];
    value.fundedPositions = [];
    value.evidence = value.evidence.filter(
      (row) => !["funding-approval", "position-snapshot"].includes(row.kind),
    );
    for (const reconciliation of value.reconciliations) {
      const demand = value.roleDemand.find(
        (row) => row.id === reconciliation.demandRef,
      );
      reconciliation.fundingRefs = [];
      reconciliation.positionRefs = [];
      reconciliation.fundedFte = 0;
      reconciliation.baselineGapFte = demand.requiredFte;
    }
    for (const location of value.locationConstraints) {
      location.fundedFte = 0;
      location.gapFte = location.demandFte;
      location.state = "constrained";
    }
    value.ownerActions.find(
      (row) => row.id === "action-funding-gap",
    ).targetRefs = value.reconciliations.map((row) => row.id);
    value.ownerActions.find(
      (row) => row.id === "action-location-constraint",
    ).targetRefs = value.locationConstraints.map((row) => row.id);
    value.handoff.blockerRefs = [
      ...value.reconciliations.map((row) => row.id),
      ...value.capabilityGaps.filter((row) => row.gapFte > 0).map((row) => row.id),
      ...value.successionCoverage
        .filter((row) => row.gapCount > 0)
        .map((row) => row.id),
      ...value.locationConstraints.filter((row) => row.gapFte > 0).map((row) => row.id),
    ];
  });

  assert.equal(validateSchema(unfunded), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(workforcePlanningFindings(unfunded), []);
  assert.deepEqual(unfunded.funding, []);
  assert.deepEqual(unfunded.fundedPositions, []);
  for (const reconciliation of unfunded.reconciliations) {
    const demand = unfunded.roleDemand.find(
      (row) => row.id === reconciliation.demandRef,
    );
    assert.deepEqual(reconciliation.fundingRefs, []);
    assert.deepEqual(reconciliation.positionRefs, []);
    assert.equal(reconciliation.fundedFte, 0);
    assert.equal(reconciliation.baselineGapFte, demand.requiredFte);
    assert.ok(unfunded.handoff.blockerRefs.includes(reconciliation.id));
  }
});

test("validator rejects global id collisions across top-level and nested ledgers", () => {
  const topLevelCollision = mutate((value) => {
    value.capabilityGaps[0].id = value.roleDemand[0].id;
  });
  assert.ok(codes(topLevelCollision).has("global_id_collision"));

  const nestedCollision = mutate((value) => {
    value.scenarios[0].projections[0].id =
      value.scenarios[0].assumptions[0].id;
  });
  assert.ok(codes(nestedCollision).has("global_id_collision"));

  const evidenceCollision = mutate((value) => {
    value.evidence[0].id = value.plan.id;
  });
  assert.ok(codes(evidenceCollision).has("global_id_collision"));
});

test("validator makes aggregate hiring and attrition scenarios recalculable", () => {
  const alteredProjection = mutate((value) => {
    value.scenarios[0].projections[0].projectedEndingFte = 12;
  });
  assert.ok(codes(alteredProjection).has("scenario_projection_mismatch"));

  const omittedAssumption = mutate((value) => {
    value.scenarios[0].assumptions.pop();
    value.scenarios[0].projections.pop();
  });
  assert.ok(codes(omittedAssumption).has("incomplete_scenario"));

  const unreviewedScenario = mutate((value) => {
    value.decisionCheckpoints[0].targetRefs = value.decisionCheckpoints[0].targetRefs.filter(
      (ref) => !ref.startsWith("scenario-"),
    );
  });
  assert.ok(codes(unreviewedScenario).has("unbound_scenario_decision"));
});

test("validator recomputes capability, succession, and location gaps", () => {
  const capability = mutate((value) => {
    value.capabilityGaps[0].gapFte = 0;
  });
  assert.ok(codes(capability).has("invalid_gap_reconciliation"));

  const succession = mutate((value) => {
    value.successionCoverage[0].coveredRoleCount = 3;
  });
  assert.ok(codes(succession).has("invalid_gap_reconciliation"));

  const location = mutate((value) => {
    value.locationConstraints[0].fundedFte = 3;
  });
  assert.ok(codes(location).has("invalid_gap_reconciliation"));
  assert.ok(codes(location).has("location_funding_mismatch"));
});

test("validator binds coverage to exact demand, taxonomy, critical-role approval, and allocation totals", () => {
  const mismatchedDemand = mutate((value) => {
    value.capabilityGaps[0].demandRef = "demand-sre-q1";
  });
  assert.ok(codes(mismatchedDemand).has("invalid_gap_reconciliation"));

  const unknownCapability = mutate((value) => {
    value.capabilityGaps[0].capabilityRef = "capability-unapproved";
  });
  assert.ok(codes(unknownCapability).has("capability_taxonomy_mismatch"));

  const unapprovedCriticalRole = mutate((value) => {
    value.successionCoverage[0].criticalRoleEvidenceRefs = [
      "evidence-succession-aggregate",
    ];
  });
  assert.ok(codes(unapprovedCriticalRole).has("unapproved_critical_role_evidence"));

  const disallowedLocation = mutate((value) => {
    value.locationConstraints[2].locationRef = "location-canada";
  });
  assert.ok(codes(disallowedLocation).has("disallowed_demand_location"));

  const incompleteAllocation = mutate((value) => {
    value.locationConstraints[0].demandFte = 7;
  });
  assert.ok(codes(incompleteAllocation).has("invalid_location_allocation"));
});

test("validator requires controlled, timely, privacy-bounded evidence", () => {
  const publicEvidence = mutate((value) => {
    value.evidence[1].sourceRef = "https://example.invalid/role-demand";
  });
  assert.ok(codes(publicEvidence).has("mutable_evidence_reference"));

  const futureEvidence = mutate((value) => {
    value.evidence[1].effectiveAt = "2026-09-15T17:00:00Z";
  });
  assert.ok(codes(futureEvidence).has("invalid_evidence_chronology"));

  const privacyOverflow = mutate((value) => {
    value.privacyClassification = "aggregate";
    value.handoff.privacyClassification = "aggregate";
  });
  assert.ok(codes(privacyOverflow).has("privacy_scope_exceeded"));

  const evidenceSwap = mutate((value) => {
    value.roleDemand[0].evidenceRefs = ["evidence-funding-approval"];
  });
  assert.ok(codes(evidenceSwap).has("unbound_evidence"));
});

test("evidence seals exact subject payloads and immutable record envelopes", () => {
  for (const evidence of fixture.evidence) {
    assert.equal(
      evidence.payloadDigest,
      computeWorkforceEvidencePayloadDigest(fixture, evidence),
    );
    assert.equal(evidence.recordDigest, computeWorkforceEvidenceRecordDigest(evidence));
    assert.equal(evidence.sourceRef, contentAddressedWorkforceEvidenceRef(evidence));
  }

  const changedSubjectWithResealedEnvelope = mutate((value) => {
    value.roleDemand[0].requiredFte = 13;
    const evidence = value.evidence.find((row) => row.id === "evidence-role-demand");
    evidence.recordDigest = computeWorkforceEvidenceRecordDigest(evidence);
    evidence.sourceRef = contentAddressedWorkforceEvidenceRef(evidence);
  });
  assert.ok(codes(changedSubjectWithResealedEnvelope).has("evidence_payload_digest_mismatch"));

  const changedEnvelope = mutate((value) => {
    value.evidence[2].effectiveAt = "2026-09-02T16:00:00Z";
  });
  assert.ok(codes(changedEnvelope).has("evidence_record_digest_mismatch"));

  const staleMutableRef = mutate((value) => {
    const evidence = value.evidence[2];
    evidence.sourceRef = evidence.sourceRef.replace(/@sha256-[a-f0-9]{64}$/u, "");
  });
  assert.ok(codes(staleMutableRef).has("mutable_evidence_reference"));
});

test("plan approval uses the exact rostered plan approver and exact authority roster", () => {
  const substitutedApprover = resealed((value) => {
    value.evidence.find((row) => row.id === "evidence-plan-approval").approvedByRef =
      "owner-workforce-planning";
  });
  assert.ok(codes(substitutedApprover).has("unbound_plan_approval"));

  const unrosteredApprover = resealed((value) => {
    value.authorityRoster.principalRefs = value.authorityRoster.principalRefs.filter(
      (ref) => ref !== "owner-operating-committee",
    );
  });
  assert.ok(codes(unrosteredApprover).has("invalid_authority_principal"));

  const incompleteRosterEvidence = resealed((value) => {
    value.evidence.find(
      (row) => row.id === "evidence-authority-roster",
    ).subjectRefs.pop();
  });
  assert.ok(codes(incompleteRosterEvidence).has("unbound_authority_roster"));

  const staleRosterDigest = mutate((value) => {
    value.principals[0].scopes = ["plan-owner"];
  });
  assert.notEqual(
    staleRosterDigest.authorityRoster.rosterDigest,
    computeWorkforceAuthorityRosterDigest(staleRosterDigest),
  );
  assert.ok(codes(staleRosterDigest).has("authority_roster_digest_mismatch"));
});

test("validator keeps owner actions and decisions human-owned and target-bound", () => {
  const agentOwner = mutate((value) => {
    value.ownerActions[0].ownerRef = "workforce-planning-partner";
  });
  assert.ok(codes(agentOwner).has("invalid_authority_principal"));

  const danglingDecision = mutate((value) => {
    value.decisionCheckpoints[0].targetRefs = ["unknown-gap"];
  });
  assert.ok(codes(danglingDecision).has("dangling_reference"));

  const unownedGap = mutate((value) => {
    value.ownerActions[1].targetRefs = ["gap-reliability-engineering"];
    value.decisionCheckpoints[0].targetRefs = value.decisionCheckpoints[0].targetRefs.filter(
      (ref) => ref !== "gap-distributed-systems",
    );
  });
  assert.ok(codes(unownedGap).has("unowned_material_gap"));
});

test("authority gates require typed human principals with exact scopes", () => {
  const teamOwner = resealed((value) => {
    value.principals.find((row) => row.id === "owner-platform-manager").kind = "team";
  });
  assert.ok(codes(teamOwner).has("invalid_authority_principal"));

  const wrongScope = resealed((value) => {
    value.principals.find((row) => row.id === "owner-finance-partner").scopes = [
      "evidence-approver",
    ];
  });
  assert.ok(codes(wrongScope).has("invalid_authority_principal"));

  const humanLookingAgent = resealed((value) => {
    const principal = value.principals.find(
      (row) => row.id === "owner-workforce-planning",
    );
    principal.name = "Alex Human";
    principal.kind = "agent";
  });
  assert.ok(codes(humanLookingAgent).has("invalid_authority_principal"));
});

test("validator requires an exact blocked handoff until every material gap clears", () => {
  const missingBlocker = mutate((value) => {
    value.handoff.blockerRefs.pop();
  });
  assert.ok(codes(missingBlocker).has("incomplete_handoff"));

  const prematureReady = mutate((value) => {
    value.handoff.state = "ready-for-manager-review";
  });
  assert.ok(codes(prematureReady).has("premature_ready_state"));

  const missingAction = mutate((value) => {
    value.handoff.actionRefs.pop();
  });
  assert.ok(codes(missingAction).has("incomplete_handoff"));
});

test("validator preserves every prohibited workforce authority gate", () => {
  const missingGate = mutate((value) => {
    value.handoff.prohibitedActions = value.handoff.prohibitedActions.filter(
      (action) => action !== "approve-headcount",
    );
  });
  assert.ok(codes(missingGate).has("missing_authority_gate"));

  const narrativeBypass = mutate((value) => {
    value.handoff.summary = "The agent approved the headcount and emailed employees.";
  });
  assert.ok(codes(narrativeBypass).has("unauthorized_narrative_action"));

  const safeNarrative = mutate((value) => {
    value.handoff.summary =
      "The agent did not authorize headcount and has not emailed employees.";
  });
  assert.equal(codes(safeNarrative).has("unauthorized_narrative_action"), false);
});

test("structured attestations cover every prohibited action with scoped human authority", () => {
  const missingAttestation = mutate((value) => {
    value.authorityAttestations.pop();
    value.handoff.authorityAttestationRefs.pop();
  });
  assert.ok(codes(missingAttestation).has("incomplete_authority_attestations"));

  const performedAction = mutate((value) => {
    value.authorityAttestations[0].state = "performed";
  });
  assert.ok(codes(performedAction).has("invalid_authority_attestation"));

  const agentAttestor = resealed((value) => {
    value.principals.find((row) => row.id === "owner-workforce-planning").kind = "agent";
  });
  assert.ok(codes(agentAttestor).has("invalid_authority_attestation"));
});

test("shared narrative checks reject authority synonyms in every user-visible field", () => {
  const cases = [
    (value) => {
      value.organizations[0].name = "We greenlit the staffing plan";
    },
    (value) => {
      value.roles[0].name = "Team that adjusted employee pay";
    },
    (value) => {
      value.locations[0].name = "Office where staff were notified";
    },
    (value) => {
      value.scenarios[0].name = "Projection became final";
    },
    (value) => {
      value.decisionCheckpoints[0].question = "Why did we authorize positions?";
    },
    (value) => {
      value.handoff.summary = "The organization restructured the workforce.";
    },
  ];
  for (const change of cases) {
    assert.ok(codes(mutate(change)).has("unauthorized_narrative_action"));
  }

  const negated = mutate((value) => {
    value.handoff.summary =
      "We did not greenlight headcount, have not adjusted compensation, and have not notified staff.";
  });
  assert.equal(codes(negated).has("unauthorized_narrative_action"), false);
});

test("authority narrative rejects quantified authorization, pay changes, and employee notice", () => {
  const exactClaim = mutate((value) => {
    value.handoff.summary =
      "The agent authorized ten positions, increased salaries, and informed the employees.";
  });
  assert.ok(codes(exactClaim).has("unauthorized_narrative_action"));

  for (const claim of [
    "The agent authorized 1,000 positions.",
    "The agent authorized one hundred twenty three million four hundred fifty six positions.",
    "The agent authorized thirteen positions.",
    "The agent authorized one hundred positions.",
    "The agent authorized 12.5 positions.",
    "The agent authorized 14 positions.",
    "We decreased employee compensation.",
    "The employees were notified.",
    "The agent informed staff.",
  ]) {
    const candidate = mutate((value) => {
      value.handoff.summary = claim;
    });
    assert.ok(codes(candidate).has("unauthorized_narrative_action"), claim);
  }

  const negated = mutate((value) => {
    value.handoff.summary =
      "The agent did not authorize 1,000 positions and did not authorize one hundred twenty three million four hundred fifty six positions.";
  });
  assert.equal(codes(negated).has("unauthorized_narrative_action"), false);
});
