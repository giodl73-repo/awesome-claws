import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCapabilityMatrix,
  capabilityRepresentatives,
  readCapabilityMatrix,
} from "./capability-classes.mjs";
import { readCatalog } from "./catalog-source.mjs";
import { readExperienceCases } from "./experience-cases.mjs";

test("every declared capability class has a valid installed-proof representative", async () => {
  const matrix = await readCapabilityMatrix();
  assert.equal(matrix.classCount, 9);
  assert.equal(matrix.representativeCount, 8);
  assert.deepEqual(
    matrix.classes.map((item) => item.id),
    [
      "clawhub-skill",
      "clawhub-plugin",
      "profile-extension",
      "oauth-mcp",
      "cron",
      "bootstrap",
      "visual",
      "workspace-execution",
      "delegated-sessions",
    ],
  );
  assert.deepEqual(
    Object.fromEntries(matrix.classes.map((item) => [item.id, item.representative])),
    capabilityRepresentatives,
  );
  assert.equal(matrix.classes.find((item) => item.id === "visual")?.memberCount, 25);
  assert.deepEqual(
    matrix.representatives.find((item) => item.id === "software-maintainer")?.classes,
    ["profile-extension", "oauth-mcp"],
  );
});

test("capability coverage rejects a missing or ineligible representative", async () => {
  const catalog = await readCatalog();
  const experienceCases = await readExperienceCases(catalog);
  assert.throws(
    () =>
      buildCapabilityMatrix(catalog, experienceCases, {
        ...capabilityRepresentatives,
        cron: "data-analyst",
      }),
    /Capability class cron lacks a valid representative: data-analyst/,
  );
  assert.throws(
    () =>
      buildCapabilityMatrix(catalog, experienceCases, {
        ...capabilityRepresentatives,
        "future-authority": "data-analyst",
      }),
    /Unknown capability proof classes: future-authority/,
  );
});
