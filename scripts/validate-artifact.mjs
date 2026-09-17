import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ARTIFACT_SCHEMA_NAMES,
  validateArtifact,
} from "./artifact-validator-registry.mjs";

const [id, input, ...args] = process.argv.slice(2);
const semanticOptions = {};
const usage =
  "Usage: npm run validate:artifact -- <claw-id> <artifact.json> [--as-of <RFC3339>] [--p2p-cutoff-at <RFC3339>] [--p2p-owner-policy <owner-policy.json>] [--license-trust-root <trust-root.json>] [--trust-store <trust.json>] [--source-bundle <sources.json>] [--trust-keys <keys.json>] [--approved-plan-public-keys <keys.json>] [--approved-plan-metric-digests <digests.json>]";
for (let index = 0; index < args.length; index += 2) {
  const flag = args[index];
  const argument = args[index + 1];
  if (
    !argument ||
    ![
      "--as-of",
      "--p2p-cutoff-at",
      "--p2p-owner-policy",
      "--license-trust-root",
      "--trust-store",
      "--source-bundle",
      "--trust-keys",
      "--approved-plan-public-keys",
      "--approved-plan-metric-digests",
    ].includes(flag)
  ) {
    throw new Error(usage);
  }
  if (flag === "--as-of") {
    semanticOptions.asOf = argument;
  } else if (flag === "--p2p-cutoff-at") {
    semanticOptions.cutoffAt = argument;
  } else if (flag === "--trust-keys") {
    const content = await readFile(resolve(argument));
    const trustConfiguration = JSON.parse(content.toString("utf8"));
    if (!Array.isArray(trustConfiguration)) {
      throw new Error("--trust-keys must reference a JSON array.");
    }
    semanticOptions.trustedGovernanceKeys = trustConfiguration;
  } else {
    const content = await readFile(resolve(argument));
    const trustConfiguration = JSON.parse(content.toString("utf8"));
    if (
      !trustConfiguration ||
      typeof trustConfiguration !== "object" ||
      Array.isArray(trustConfiguration)
    ) {
      throw new Error(`${flag} must reference a JSON object.`);
    }
    if (flag === "--p2p-owner-policy") {
      semanticOptions.ownerTrustPolicy = trustConfiguration;
    } else if (flag === "--license-trust-root") {
      semanticOptions.licenseTrustRoot = trustConfiguration;
    } else if (flag === "--trust-store") {
      semanticOptions.trustStore = trustConfiguration;
    } else if (flag === "--source-bundle") {
      semanticOptions.sourceBundle = trustConfiguration;
      semanticOptions.sourceBundleByteLength = content.length;
    } else if (flag === "--approved-plan-public-keys") {
      semanticOptions.approvedPlanPublicKeys = trustConfiguration;
    } else {
      semanticOptions.approvedPlanMetricDigests = trustConfiguration;
    }
  }
}
if (!id || !input) {
  throw new Error(usage);
}
if (!ARTIFACT_SCHEMA_NAMES[id]) {
  throw new Error(`No structured artifact validator is registered for ${id}.`);
}
const validation = await validateArtifact({
  id,
  artifactPath: resolve(input),
  scenarioType: "accepted-task",
  mode: "live",
  diagnostics: "full",
  semanticOptions,
});
const result = {
  schemaVersion: "awesomeClaws.artifactValidation.v1",
  id,
  valid: validation.valid,
  schemaErrors: validation.schema.errors,
  semanticFindings: validation.semantics.findings,
};
console.log(JSON.stringify(result, null, 2));
if (!result.valid) {
  process.exitCode = 1;
}
