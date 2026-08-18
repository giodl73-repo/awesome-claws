import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertDownloadedPluginIdentity,
  buildDependencyInventory,
  downloadedIdentity,
  parsePinnedSkillRef,
  parseResourceMetadataUrl,
  validateMcpMetadata,
  validatePluginResponses,
  validateSkillVerification,
  verifySkillArchive,
} from "./dependency-health-lib.mjs";

test("dependency inventory deduplicates consumers and requires publisher-pinned skills", () => {
  const catalog = {
    entries: [
      {
        id: "one",
        packages: [
          { kind: "skill", source: "clawhub", ref: "@owner/weather", version: "1.0.0" },
          { kind: "plugin", source: "clawhub", ref: "@openclaw/diffs", version: "2.0.0" },
        ],
        mcpServers: {
          github: {
            url: "https://example.com/mcp",
            transport: "streamable-http",
            auth: "oauth",
          },
        },
      },
      {
        id: "two",
        packages: [
          { kind: "skill", source: "clawhub", ref: "@owner/weather", version: "1.0.0" },
        ],
        openclawProfile: {
          extensions: [
            {
              id: "diffs",
              kind: "plugin",
              format: "openclaw",
              source: "clawhub",
              ref: "@openclaw/diffs",
              version: "2.0.0",
            },
          ],
        },
      },
    ],
  };
  const inventory = buildDependencyInventory(catalog);
  assert.equal(inventory.length, 3);
  assert.deepEqual(
    inventory.find((item) => item.type === "clawhub-skill").consumers,
    [
      { claw: "one", surface: "package" },
      { claw: "two", surface: "package" },
    ],
  );
  assert.equal(inventory.find((item) => item.type === "clawhub-plugin").runtimeId, "diffs");
  assert.throws(
    () =>
      buildDependencyInventory({
        entries: [
          {
            id: "ambiguous",
            packages: [
              { kind: "skill", source: "clawhub", ref: "weather", version: "1.0.0" },
            ],
          },
        ],
      }),
    /pin its publisher/,
  );
  assert.deepEqual(parsePinnedSkillRef("@owner/weather"), {
    ownerHandle: "owner",
    slug: "weather",
  });
});

test("skill verification preserves publisher, version, artifact, card, and security identity", () => {
  const dependency = {
    ref: "@owner/weather",
    ownerHandle: "owner",
    slug: "weather",
    version: "1.0.0",
  };
  const response = {
    schema: "clawhub.skill.verify.v1",
    ok: true,
    decision: "pass",
    slug: "weather",
    publisherHandle: "owner",
    version: "1.0.0",
    artifact: {
      sourceFingerprint: "a".repeat(64),
      bundleFingerprints: ["b".repeat(64)],
      files: [{ path: "SKILL.md", size: 4, sha256: "c".repeat(64) }],
    },
    card: { available: true, url: "https://example.com/card", sha256: "d".repeat(64) },
    security: { passed: true, status: "clean" },
  };
  assert.equal(validateSkillVerification(dependency, response).fileCount, 1);
  assert.throws(
    () => validateSkillVerification(dependency, { ...response, publisherHandle: "other" }),
    /identity verification failed/,
  );
  assert.throws(
    () =>
      validateSkillVerification(dependency, {
        ...response,
        security: { passed: false, status: "malicious" },
      }),
    /no longer passes/,
  );
});

test("plugin metadata and downloaded bytes must agree exactly", () => {
  const bytes = Buffer.from("plugin");
  const identity = downloadedIdentity(bytes);
  const dependency = {
    ref: "@openclaw/diffs",
    version: "2.0.0",
    runtimeId: "diffs",
  };
  const artifact = {
    kind: "npm-pack",
    packageName: dependency.ref,
    version: dependency.version,
    downloadUrl: "https://example.com/diffs.tgz",
    ...identity,
  };
  const verified = validatePluginResponses(
    dependency,
    { package: { name: dependency.ref, family: "code-plugin", runtimeId: "diffs" } },
    {
      package: { name: dependency.ref, family: "code-plugin" },
      version: {
        version: dependency.version,
        verification: { scanStatus: "clean" },
      },
    },
    {
      package: { name: dependency.ref, family: "code-plugin" },
      version: dependency.version,
      artifact,
    },
  );
  assert.doesNotThrow(() => assertDownloadedPluginIdentity(verified.artifact, identity));
  assert.throws(
    () => assertDownloadedPluginIdentity(verified.artifact, { ...identity, size: 1 }),
    /size/,
  );
});

test("downloaded skill ZIP files must match verification metadata", async () => {
  const archive = Buffer.from(
    "UEsDBBQAAAAIAHebEV1G4GeeRgAAAEkAAAAKAAAAX21ldGEuanNvbqtWyi/PSy3yTFGygrB0M1OUdJSKc0rTlayUylMTSzJSi5R0lMpSi4oz8/OUrJQM9Qz0DJR0lApKk3IyizNSUxxLlKwMawFQSwMEFAAAAAgAd5sRXdOYFBYGAAAABAAAAA0AAABza2lsbC1jYXJkLm1kS04sSgEAUEsDBBQAAAAIAHebEV2YMBV3BgAAAAQAAAAIAAAAU0tJTEwubWRLzk9JBQBQSwECFAAUAAAACAB3mxFdRuBnnkYAAABJAAAACgAAAAAAAAAAAAAAAAAAAAAAX21ldGEuanNvblBLAQIUABQAAAAIAHebEV3TmBQWBgAAAAQAAAANAAAAAAAAAAAAAAAAAG4AAABza2lsbC1jYXJkLm1kUEsBAhQAFAAAAAgAd5sRXZgwFXcGAAAABAAAAAgAAAAAAAAAAAAAAAAAnwAAAFNLSUxMLm1kUEsFBgAAAAADAAMAqQAAAMsAAAAAAA==",
    "base64",
  );
  const generatedFiles = {
    card: {
      size: 4,
      sha256: "8367cd66fdd136bba8ba23f8805bb050dd6289401c8ec3b0be44a3c233eef90d",
    },
    slug: "weather",
    version: "1.0.0",
  };
  const verified = await verifySkillArchive(archive, [
    {
      path: "SKILL.md",
      size: 4,
      sha256: "5694d08a2e53ffcae0c3103e5ad6f6076abd960eb1f8a56577040bc1028f702b",
    },
  ], generatedFiles);
  assert.equal(verified.verifiedFiles.length, 1);
  assert.equal(verified.generatedFiles.metadata.slug, "weather");
  await assert.rejects(
    verifySkillArchive(archive, [
      { path: "SKILL.md", size: 4, sha256: "0".repeat(64) },
    ], generatedFiles),
    /does not match/,
  );
  const archiveWithExtraFile = Buffer.from(
    "UEsDBBQAAAAIAHebEV1G4GeeRgAAAEkAAAAKAAAAX21ldGEuanNvbqtWyi/PSy3yTFGygrB0M1OUdJSKc0rTlayUylMTSzJSi5R0lMpSi4oz8/OUrJQM9Qz0DJR0lApKk3IyizNSUxxLlKwMawFQSwMEFAAAAAgAd5sRXdOYFBYGAAAABAAAAA0AAABza2lsbC1jYXJkLm1kS04sSgEAUEsDBBQAAAAIAHebEV2YMBV3BgAAAAQAAAAIAAAAU0tJTEwubWRLzk9JBQBQSwMEFAAAAAgAd5sRXRA/0asGAAAABAAAAAsAAAB1bmtub3duLnR4dMvLL0gFAFBLAQIUABQAAAAIAHebEV1G4GeeRgAAAEkAAAAKAAAAAAAAAAAAAAAAAAAAAABfbWV0YS5qc29uUEsBAhQAFAAAAAgAd5sRXdOYFBYGAAAABAAAAA0AAAAAAAAAAAAAAAAAbgAAAHNraWxsLWNhcmQubWRQSwECFAAUAAAACAB3mxFdmDAVdwYAAAAEAAAACAAAAAAAAAAAAAAAAACfAAAAU0tJTEwubWRQSwECFAAUAAAACAB3mxFdED/RqwYAAAAEAAAACwAAAAAAAAAAAAAAAADLAAAAdW5rbm93bi50eHRQSwUGAAAAAAQABADiAAAA+gAAAAAA",
    "base64",
  );
  await assert.rejects(
    verifySkillArchive(
      archiveWithExtraFile,
      [
        {
          path: "SKILL.md",
          size: 4,
          sha256: "5694d08a2e53ffcae0c3103e5ad6f6076abd960eb1f8a56577040bc1028f702b",
        },
      ],
      generatedFiles,
    ),
    /Unexpected entry/,
  );
});

test("MCP challenge and protected-resource metadata preserve the exact HTTPS endpoint", () => {
  const metadataUrl = parseResourceMetadataUrl(
    'Bearer error="invalid_token", resource_metadata="https://example.com/.well-known/oauth-protected-resource/mcp"',
  );
  assert.equal(
    metadataUrl,
    "https://example.com/.well-known/oauth-protected-resource/mcp",
  );
  assert.deepEqual(
    validateMcpMetadata(
      { name: "example", url: "https://example.com/mcp" },
      {
        resource: "https://example.com/mcp",
        authorization_servers: ["https://example.com/oauth"],
        scopes_supported: ["read"],
      },
      metadataUrl,
    ),
    {
      resource: "https://example.com/mcp",
      resourceMetadata: metadataUrl,
      authorizationServers: ["https://example.com/oauth"],
      scopesSupported: ["read"],
    },
  );
  assert.throws(() => parseResourceMetadataUrl("Bearer"), /lacks resource_metadata/);
});
