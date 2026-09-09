import { resolve } from "node:path";
import {
  ARTIFACT_SCHEMA_NAMES,
  validateArtifact,
} from "./artifact-validator-registry.mjs";

const [id, input, ...options] = process.argv.slice(2);
if (
  !id ||
  !input ||
  ![0, 2].includes(options.length) ||
  (options.length === 2 && options[0] !== "--as-of")
) {
  throw new Error(
    "Usage: npm run validate:artifact -- <claw-id> <artifact.json> [--as-of <RFC3339>]",
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
  semanticOptions: options.length === 2 ? { asOf: options[1] } : {},
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
