import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";
import { root } from "./catalog-source.mjs";

const simpleX3Ids = [
  "api-deprecation-coordinator",
  "board-meeting-governance-coordinator",
  "clinical-trial-participation-coordinator",
  "community-moderation-coordinator",
  "creator-content-calendar-coordinator",
  "donation-receipt-coordinator",
  "event-sponsorship-coordinator",
  "hardware-asset-lifecycle-coordinator",
  "home-energy-upgrade-coordinator",
  "insurance-appeal-coordinator",
  "permit-application-coordinator",
  "scholarship-award-coordinator",
  "training-compliance-coordinator",
  "vendor-offboarding-coordinator",
];

async function fixtureFor(id) {
  return JSON.parse(
    await readFile(
      join(root, "claws", id, "fixtures", `${id}-handoff.example.json`),
      "utf8",
    ),
  );
}

test("simple X3 coordinator handoff fixtures are semantically clean", async () => {
  for (const id of simpleX3Ids) {
    assert.deepEqual(validateArtifactSemantics(id, await fixtureFor(id)), [], id);
  }
});

test("simple X3 coordinator handoffs reject identity drift", async () => {
  const value = await fixtureFor("api-deprecation-coordinator");
  value.claw = "mock-plus-missing";
  assert.ok(
    validateArtifactSemantics("api-deprecation-coordinator", value).some(
      (finding) => finding.code === "invalid_x3_handoff_identity",
    ),
  );
});

test("simple X3 coordinator handoffs reject hidden unresolved ready state", async () => {
  const value = await fixtureFor("vendor-offboarding-coordinator");
  value.readyState = "review-ready";
  assert.ok(
    validateArtifactSemantics("vendor-offboarding-coordinator", value).some(
      (finding) => finding.code === "invalid_x3_handoff_readiness",
    ),
  );
});

test("simple X3 coordinator handoffs reject duplicate durable ids", async () => {
  const value = await fixtureFor("training-compliance-coordinator");
  value.ownerActions[0].id = value.evidence[0].id;
  assert.ok(
    validateArtifactSemantics("training-compliance-coordinator", value).some(
      (finding) => finding.code === "duplicate_x3_handoff_id",
    ),
  );
});

test("simple X3 coordinator handoffs reject agent-owned accountability", async () => {
  const value = await fixtureFor("community-moderation-coordinator");
  value.nextOwner = "agent-owned";
  assert.ok(
    validateArtifactSemantics("community-moderation-coordinator", value).some(
      (finding) => finding.code === "invalid_x3_handoff_owner",
    ),
  );
});

test("simple X3 coordinator handoffs reject action-completion narratives", async () => {
  const value = await fixtureFor("creator-content-calendar-coordinator");
  value.ownerActions[0].action = "The agent completed and submitted this action.";
  assert.ok(
    validateArtifactSemantics("creator-content-calendar-coordinator", value).some(
      (finding) => finding.code === "prohibited_x3_handoff_authority_narrative",
    ),
  );
});
