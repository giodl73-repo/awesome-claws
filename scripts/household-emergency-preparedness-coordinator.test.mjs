import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { householdEmergencyPreparednessFindings } from "./household-emergency-preparedness-coordinator.mjs";

const fixture = JSON.parse(
  await readFile(
    new URL(
      "../sources/household-emergency-preparedness-coordinator/fixtures/preparedness-plan.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL(
      "../sources/household-emergency-preparedness-coordinator/schemas/preparedness-plan.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function mutate(change) {
  const value = structuredClone(fixture);
  change(value);
  return value;
}

function assertFinding(value, code) {
  const findings = householdEmergencyPreparednessFindings(value);
  assert.ok(
    findings.some((row) => row.code === code),
    JSON.stringify(findings, null, 2),
  );
}

test("accepted household preparedness plan is strict-schema valid and semantically clean", () => {
  assert.equal(validateSchema(fixture), true, ajv.errorsText(validateSchema.errors));
  assert.deepEqual(householdEmergencyPreparednessFindings(fixture), []);
});

test("semantic validation is total over malformed direct inputs", () => {
  for (const value of [
    null,
    undefined,
    true,
    7,
    "plan",
    [],
    {},
    { plan: {}, options: [null], sources: [null] },
  ]) {
    assert.doesNotThrow(() => householdEmergencyPreparednessFindings(value));
    assert.ok(householdEmergencyPreparednessFindings(value).length > 0);
  }
});

test("plan and reciprocal location indexes remain complete", () => {
  assertFinding(
    mutate((value) => value.plan.hazardRefs.pop()),
    "incomplete_plan_index",
  );
  assertFinding(
    mutate((value) => value.locations[0].optionRefs.pop()),
    "incomplete_location_index",
  );
  assertFinding(
    mutate((value) =>
      value.sources.push({
        ...value.sources[0],
        id: "source-orphan",
        controlledRef: "official://orphan",
      }),
    ),
    "orphan_source",
  );
});

test("hazards retain official current evidence and no live triggers", () => {
  assertFinding(
    mutate((value) => {
      const source = value.sources.find(
        (row) => row.id === "source-county-earthquake",
      );
      source.authorityRef = "household-owner";
    }),
    "invalid_hazard_authority",
  );
  assertFinding(
    mutate((value) => {
      value.sources.find(
        (row) => row.id === "source-fire-wildfire",
      ).freshness = "stale";
    }),
    "invalid_hazard_freshness",
  );
  assertFinding(
    mutate((value) => {
      value.hazards[0].liveTriggerClaim = "agent-defined";
    }),
    "live_authority_claim",
  );
});

test("participant and need coverage is reciprocal and owner approved", () => {
  assertFinding(
    mutate((value) => value.participants[0].needRefs.pop()),
    "incomplete_participant_index",
  );
  assertFinding(
    mutate((value) => {
      value.needs.find(
        (row) => row.id === "need-adult-b-mobility",
      ).state = "covered";
    }),
    "invalid_need_coverage",
  );
  assertFinding(
    mutate((value) => {
      value.needs.find((row) => row.id === "need-child-supervision").optionRefs = [
        "option-animal-transport",
      ];
    }),
    "cross_participant_need",
  );
  assertFinding(
    mutate((value) => {
      for (const option of value.options) {
        option.participantRefs = option.participantRefs.filter(
          (ref) => ref !== "participant-dog",
        );
      }
      value.participants.find(
        (row) => row.id === "participant-dog",
      ).optionRefs = [];
    }),
    "uncovered_participant",
  );
});

test("dependencies and approved options cannot hide uncertainty", () => {
  assertFinding(
    mutate((value) => value.dependencies[0].optionRefs.pop()),
    "incomplete_dependency_index",
  );
  assertFinding(
    mutate((value) => {
      const option = value.options.find(
        (row) => row.id === "option-shelter-home",
      );
      option.dependencyRefs.push("dependency-helper");
      value.dependencies.find(
        (row) => row.id === "dependency-helper",
      ).optionRefs.push(option.id);
    }),
    "unconfirmed_approved_option",
  );
  assertFinding(
    mutate((value) => {
      value.options.find(
        (row) => row.id === "option-shelter-home",
      ).ownerApproved = false;
    }),
    "invalid_option_approval",
  );
});

test("option steps remain ordered, bounded, and receipt based", () => {
  assertFinding(
    mutate((value) => {
      value.steps.find((row) => row.id === "step-evac-owner-approve").sequence = 4;
    }),
    "invalid_step_sequence",
  );
  assertFinding(
    mutate((value) => {
      value.steps.find((row) => row.id === "step-shelter-review").dependencyRefs = [
        "dependency-school",
      ];
    }),
    "cross_option_step_dependency",
  );
  assertFinding(
    mutate((value) => {
      value.steps.find((row) => row.id === "step-alert-owner-action").state =
        "owner-completed";
    }),
    "external_action_claim",
  );
});

test("source chronology, expiry, and ownership are preserved", () => {
  assertFinding(
    mutate((value) => {
      value.sources.find(
        (row) => row.id === "source-household-record",
      ).authorityRef = "helper-neighbor";
    }),
    "invalid_source_authority",
  );
  assertFinding(
    mutate((value) => {
      value.sources[0].retrievedAt = "2026-09-25T18:00:01Z";
    }),
    "invalid_source_chronology",
  );
  assertFinding(
    mutate((value) => {
      value.sources.find((row) => row.id === "source-building-plan").expiresAt =
        "2026-09-01T00:00:00Z";
    }),
    "expired_current_source",
  );
});

test("supply state follows exact expiry evidence", () => {
  assertFinding(
    mutate((value) => {
      value.supplies.find((row) => row.id === "supply-power-bank").state =
        "current";
    }),
    "invalid_supply_state",
  );
  assertFinding(
    mutate((value) => {
      value.supplies.find((row) => row.id === "supply-dog-water").expiresAt =
        "2027-01-01T00:00:00Z";
    }),
    "invalid_supply_state",
  );
});

test("drills and findings preserve chronology and reciprocal lineage", () => {
  assertFinding(
    mutate((value) => {
      value.drills[0].occurredAt = "2026-09-25T18:00:01Z";
    }),
    "invalid_drill_chronology",
  );
  assertFinding(
    mutate((value) => value.drills[0].findingRefs.pop()),
    "incomplete_drill_index",
  );
  assertFinding(
    mutate((value) => {
      value.drills[0].sourceRefs = ["source-inventory"];
    }),
    "invalid_drill_evidence",
  );
});

test("findings cannot close before corrective actions", () => {
  assertFinding(
    mutate((value) => {
      value.findings[0].state = "resolved";
    }),
    "premature_finding_resolution",
  );
  assertFinding(
    mutate((value) => value.findings[0].correctiveActionRefs.pop()),
    "incomplete_finding_index",
  );
  assertFinding(
    mutate((value) => {
      value.correctiveActions[0].state = "owner-completed";
    }),
    "invalid_action_completion",
  );
});

test("a helper-owned correction accepts only that helper's completion receipt", () => {
  const completed = mutate((value) => {
    value.sources.push({
      id: "source-helper-action",
      kind: "action-confirmation",
      publisher: "Trusted helper",
      authorityRef: "helper-neighbor",
      controlledRef: "workspace://household/helper-action-2026-09",
      revision: "1",
      retrievedAt: "2026-09-24T18:00:00Z",
      expiresAt: null,
      freshness: "current",
      privacy: "trusted-helper-approved",
    });
    const action = value.correctiveActions.find(
      (row) => row.id === "action-refresh-helper",
    );
    action.owner = "helper-neighbor";
    action.state = "owner-completed";
    action.sourceRefs.push("source-helper-action");
    action.completionSourceRef = "source-helper-action";
    value.findings.find((row) => row.id === "finding-helper-stale").state =
      "resolved";
    value.review.openFindingRefs = ["finding-accessible-transport"];
    value.review.openCorrectiveActionRefs = ["action-confirm-transport"];
  });
  assert.deepEqual(householdEmergencyPreparednessFindings(completed), []);

  assertFinding(
    mutate((value) => {
      value.sources.find(
        (row) => row.id === "source-household-record",
      ).kind = "action-confirmation";
      value.sources.find(
        (row) => row.id === "source-household-record",
      ).authorityRef = "authority-agent";
    }),
    "invalid_source_authority",
  );
});

test("review exactly exposes every unresolved state", () => {
  assertFinding(
    mutate((value) => value.review.gapNeedRefs.pop()),
    "incomplete_review_index",
  );
  assertFinding(
    mutate((value) => {
      value.review.decision = "ready-for-owner-review";
    }),
    "premature_owner_handoff",
  );
  assertFinding(
    mutate((value) => {
      value.review.nextOwner = "helper-neighbor";
    }),
    "invalid_next_owner",
  );
});

test("strict schema forbids live authority and hidden sensitive fields", () => {
  const authority = mutate((value) => {
    value.prohibitedActions.alertIssued = true;
  });
  assert.equal(validateSchema(authority), false);
  assertFinding(authority, "prohibited_authority_claim");

  const hidden = mutate((value) => {
    value.locations[0].preciseAddress = "not allowed";
  });
  assert.equal(validateSchema(hidden), false);
});
