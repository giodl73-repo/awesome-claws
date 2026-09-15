import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ARTIFACT_SCHEMA_NAMES,
  validateArtifact,
} from "./artifact-validator-registry.mjs";

const [id, input, ...args] = process.argv.slice(2);
const semanticOptions = {};
for (let index = 0; index < args.length; index += 2) {
  const flag = args[index];
  const argument = args[index + 1];
  if (!argument || !["--as-of", "--trust-keys"].includes(flag)) {
    throw new Error(
      "Usage: npm run validate:artifact -- <claw-id> <artifact.json> [--as-of <RFC3339>] [--trust-keys <keys.json>]",
    );
  }
  if (flag === "--as-of") {
    semanticOptions.asOf = argument;
  } else {
    const trustConfiguration = JSON.parse(
      await readFile(resolve(argument), "utf8"),
    );
    if (!Array.isArray(trustConfiguration)) {
      throw new Error("--trust-keys must reference a JSON array.");
    }
    semanticOptions.trustedGovernanceKeys = trustConfiguration;
  }
}
if (!id || !input) {
  throw new Error(
    "Usage: npm run validate:artifact -- <claw-id> <artifact.json> [--as-of <RFC3339>] [--trust-keys <keys.json>]",
  );
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
