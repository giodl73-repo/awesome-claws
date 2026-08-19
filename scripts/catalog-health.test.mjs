import assert from "node:assert/strict";
import { test } from "node:test";
import { maintenanceErrors } from "./catalog-health.mjs";

const valid = {
  status: "active",
  maintainers: ["@giodl73-repo"],
  lastVerified: "2026-08-19",
};

test("accepts accountable maintenance metadata", () => {
  assert.deepEqual(maintenanceErrors(valid, { today: "2026-08-19" }), []);
});

test("rejects missing, malformed, duplicate, and future maintenance claims", () => {
  assert.ok(maintenanceErrors(undefined).includes("maintenance must be an object"));
  assert.ok(
    maintenanceErrors(
      {
        status: "unknown",
        maintainers: ["@replace-me", "@Owner", "@owner"],
        lastVerified: "2026-08-20",
        note: "unreviewed",
      },
      { today: "2026-08-19" },
    ).length >= 4,
  );
});
