import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { problemKnownErrorFindings } from "./problem-known-error-coordinator.mjs";
import {
  parseValidatorArguments,
  readWorkspaceJson,
  writeInputFailure,
  writeValidationResult,
} from "./packaged-validator-cli.mjs";

const REQUIRED_FLAGS = [
  "--workspace-root",
  "--cutoff",
  "--public-trust",
  "--trust-keyring",
  "--source-bundle",
];

export async function main(argv = process.argv.slice(2)) {
  try {
    const { artifactPath, values } = parseValidatorArguments(
      argv,
      REQUIRED_FLAGS,
    );
    const workspaceRoot = values.get("--workspace-root");
    const [artifact, publicTrustInput, trustKeyring, sourceBundle] =
      await Promise.all([
        readWorkspaceJson(workspaceRoot, artifactPath),
        readWorkspaceJson(workspaceRoot, values.get("--public-trust")),
        readWorkspaceJson(workspaceRoot, values.get("--trust-keyring")),
        readWorkspaceJson(workspaceRoot, values.get("--source-bundle")),
      ]);
    writeValidationResult(
      problemKnownErrorFindings(artifact, {
        cutoff: values.get("--cutoff"),
        publicTrustInput,
        sourceBundle,
        trustKeyring,
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
