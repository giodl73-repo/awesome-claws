import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { root } from "./openclaw-proof-lib.mjs";
import {
  validateManifestMetadata,
  validateOpenClawProfile,
} from "./catalog-contract.mjs";

const fixtures = JSON.parse(
  await readFile(join(root, "scripts", "fixtures", "catalog-conformance.json"), "utf8"),
);

for (const fixture of fixtures.accepted) {
  test(`accepts conformance fixture: ${fixture.name}`, () => {
    assert.doesNotThrow(() => {
      if (fixture.manifest) validateManifestMetadata(fixture.manifest, fixture.name);
      if (fixture.profile) validateOpenClawProfile(fixture.profile, fixture.name);
    });
  });
}

for (const fixture of fixtures.rejected) {
  test(`rejects conformance fixture: ${fixture.name}`, () => {
    assert.throws(() => {
      if (fixture.manifest) validateManifestMetadata(fixture.manifest, fixture.name);
      if (fixture.profile) validateOpenClawProfile(fixture.profile, fixture.name);
    });
  });
}

