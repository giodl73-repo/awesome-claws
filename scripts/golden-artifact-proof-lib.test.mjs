import assert from "node:assert/strict";
import { test } from "node:test";
import {
  artifactIdentity,
  assertSafeTarEntries,
  assertSafeTarEntryTypes,
  createArtifactResponse,
} from "./golden-artifact-proof-lib.mjs";

test("artifact identity includes ClawHub and npm digests", () => {
  assert.deepEqual(artifactIdentity(Buffer.from("claw")), {
    sha256: "06deac5b8d4a128e257bee1443a9ce063604e9ae63620479e7161fb01a668ac1",
    npmIntegrity:
      "sha512-OyiTH/ZsoPh141f4t/JrL4ZBbFfqH+wWyX2fCDkTSmwBlt9IySJzd+ntfAjEhTYYYwlXoC4lkWEL5o/lWPZlMQ==",
    npmShasum: "0383b9a5c02b8bc248c0ea9023a23f44780f838f",
  });
});

test("safe extraction accepts only package-root entries", () => {
  assert.doesNotThrow(() =>
    assertSafeTarEntries(["package/", "package/CLAW.md", "package/profiles/openclaw.yml"]),
  );
  assert.throws(() => assertSafeTarEntries(["package/../../outside"]), /Unsafe path/);
  assert.throws(() => assertSafeTarEntries(["other/CLAW.md"]), /Unsafe path/);
  assert.throws(() => assertSafeTarEntries(["package.json"]), /Unsafe path/);
  assert.throws(() => assertSafeTarEntries([]), /empty/);
});

test("safe extraction rejects links and special archive entries", () => {
  assert.doesNotThrow(() =>
    assertSafeTarEntryTypes([
      "drwxr-xr-x user/group 0 date package/",
      "-rw-r--r-- user/group 1 date package/CLAW.md",
    ]),
  );
  assert.throws(
    () => assertSafeTarEntryTypes(["lrwxrwxrwx user/group 0 date package/link -> ../../outside"]),
    /Unsafe entry type/,
  );
});

test("registry response binds the exact artifact identity", () => {
  const identity = artifactIdentity(Buffer.from("claw"));
  const response = createArtifactResponse({
    baseUrl: "http://127.0.0.1:1234",
    identity,
    packageName: "@awesome-claws/travel-concierge",
    size: 4,
    version: "0.1.0",
  });
  assert.equal(response.artifact.sha256, identity.sha256);
  assert.equal(response.artifact.npmIntegrity, identity.npmIntegrity);
  assert.equal(response.artifact.downloadUrl, "http://127.0.0.1:1234/artifact.tgz");
});
