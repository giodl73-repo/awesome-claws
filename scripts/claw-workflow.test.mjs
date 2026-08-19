import assert from "node:assert/strict";
import { test } from "node:test";
import {
  inapplicableRequestedLanes,
  parseClawCommandArgs,
  proofPlanFor,
  selectClaws,
} from "./claw-workflow.mjs";

const entries = [
  { id: "data-analyst", name: "Data analyst", packages: [] },
  {
    id: "financial-analyst",
    name: "Financial analyst",
    packages: [{ kind: "skill" }],
  },
  { id: "software-maintainer", name: "Software maintainer", mcpServers: { github: {} } },
];

test("selects exact ids, filters, comma lists, and all Claws in catalog order", () => {
  assert.deepEqual(selectClaws(entries, ["data-analyst"]).map((entry) => entry.id), [
    "data-analyst",
  ]);
  assert.deepEqual(selectClaws(entries, ["analyst"]).map((entry) => entry.id), [
    "data-analyst",
    "financial-analyst",
  ]);
  assert.deepEqual(
    selectClaws(entries, ["software,data"]).map((entry) => entry.id),
    ["data-analyst", "software-maintainer"],
  );
  assert.deepEqual(selectClaws(entries, ["*"]), entries);
  assert.throws(() => selectClaws(entries, ["missing"]), /No Claw matches/u);
});

test("parses explicit expensive proof flags", () => {
  assert.deepEqual(parseClawCommandArgs(["analyst", "--installed", "--visual", "--live"]), {
    selectors: ["analyst"],
    installed: true,
    live: true,
    visual: true,
  });
  assert.deepEqual(parseClawCommandArgs(["--all"]), {
    selectors: ["*"],
    installed: false,
    live: false,
    visual: false,
  });
  assert.throws(() => parseClawCommandArgs(["data-analyst", "--provider"]), /Unknown option/u);
});

test("derives proof lanes without claiming provider-live evidence", () => {
  const base = proofPlanFor(entries[0], { target: 4 });
  assert.equal(base.lanes.visual.applicable, true);
  assert.equal(base.lanes.dependencyLive.applicable, false);
  assert.equal(base.lanes.providerLive.applicable, false);
  const connected = proofPlanFor(entries[2], { target: 3 });
  assert.equal(connected.lanes.visual.applicable, false);
  assert.equal(connected.lanes.dependencyLive.applicable, true);
});

test("fails closed when an explicitly requested lane is inapplicable", () => {
  const planned = [{ id: "one", plan: proofPlanFor(entries[0], { target: 3 }) }];
  assert.deepEqual(
    inapplicableRequestedLanes(planned, { visual: true, live: true }),
    [
      {
        name: "visual",
        message: "--visual was requested, but no selected Claw has an applicable visual lane.",
      },
      {
        name: "dependency-live",
        message:
          "--live was requested, but no selected Claw declares a dependency-live lane.",
      },
    ],
  );
});
