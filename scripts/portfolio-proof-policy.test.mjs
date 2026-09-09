import assert from "node:assert/strict";
import test from "node:test";
import { requiresPortfolioGateway } from "./portfolio-proof-policy.mjs";

test("requires a Gateway for every lifecycle surface with a live Gateway owner", () => {
  assert.equal(requiresPortfolioGateway({}), false);
  assert.equal(requiresPortfolioGateway({ cronJobs: [{ id: "daily" }] }), true);
  assert.equal(requiresPortfolioGateway({ packages: [{ kind: "plugin" }] }), true);
  assert.equal(
    requiresPortfolioGateway({}, { visualRuntimeProof: true }),
    true,
  );
});

test("does not start a Gateway for non-plugin packages alone", () => {
  assert.equal(requiresPortfolioGateway({ packages: [{ kind: "skill" }] }), false);
});
