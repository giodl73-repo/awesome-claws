import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";
import { root } from "./catalog-source.mjs";

const [id, input] = process.argv.slice(2);
if (!id || !input) {
  throw new Error("Usage: npm run validate:artifact -- <claw-id> <artifact.json>");
}
const schemaNames = {
  "data-analyst": "analysis-state.schema.json",
  "project-manager": "project-state.schema.json",
  "product-manager": "product-decision.schema.json",
  "research-briefing": "research-brief.schema.json",
};
const schemaName = schemaNames[id];
if (!schemaName) {
  throw new Error(`No structured artifact validator is registered for ${id}.`);
}
const schema = JSON.parse(
  await readFile(join(root, "claws", id, "schemas", schemaName), "utf8"),
);
const value = JSON.parse(await readFile(resolve(input), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const schemaValid = validateSchema(value);
const semanticFindings = schemaValid ? validateArtifactSemantics(id, value) : [];
const result = {
  schemaVersion: "awesomeClaws.artifactValidation.v1",
  id,
  valid: schemaValid && semanticFindings.length === 0,
  schemaErrors: validateSchema.errors ?? [],
  semanticFindings,
};
console.log(JSON.stringify(result, null, 2));
if (!result.valid) {
  process.exitCode = 1;
}
