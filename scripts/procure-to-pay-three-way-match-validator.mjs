import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateThreeWayMatch } from "./procure-to-pay-three-way-match-exception-reconciler.mjs";
import {
  parseValidatorArguments,
  readWorkspaceJson,
  writeInputFailure,
  writeValidationResult,
} from "./packaged-validator-cli.mjs";

const REQUIRED_FLAGS = [
  "--workspace-root",
  "--as-of",
  "--cutoff",
  "--owner-trust-policy",
];

export async function main(argv = process.argv.slice(2)) {
  try {
    const { artifactPath, values } = parseValidatorArguments(
      argv,
      REQUIRED_FLAGS,
    );
    const workspaceRoot = values.get("--workspace-root");
    const [artifact, ownerTrustPolicy] = await Promise.all([
      readWorkspaceJson(workspaceRoot, artifactPath),
      readWorkspaceJson(workspaceRoot, values.get("--owner-trust-policy")),
    ]);
    writeValidationResult(
      validateThreeWayMatch(artifact, {
        asOf: values.get("--as-of"),
        cutoffAt: values.get("--cutoff"),
        ownerTrustPolicy,
      }),
    );
  } catch {
    writeInputFailure();
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  await main();
}
