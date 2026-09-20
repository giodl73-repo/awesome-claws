import { realpath, readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { TextDecoder } from "node:util";

const MAX_INPUT_BYTES = 2 * 1024 * 1024;
const fatalUtf8Decoder = new TextDecoder("utf-8", { fatal: true });

export function parseValidatorArguments(argv, requiredFlags) {
  const [artifactPath, ...args] = argv;
  const allowed = new Set(requiredFlags);
  const values = new Map();
  if (!artifactPath || args.length % 2 !== 0) {
    throw new Error("Invalid validator arguments.");
  }
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!allowed.has(flag) || !value || values.has(flag)) {
      throw new Error("Invalid validator arguments.");
    }
    values.set(flag, value);
  }
  if (requiredFlags.some((flag) => !values.has(flag))) {
    throw new Error("Invalid validator arguments.");
  }
  return { artifactPath, values };
}

export async function readWorkspaceJson(workspaceRoot, inputPath) {
  const root = await realpath(resolve(workspaceRoot));
  const candidate = await realpath(resolve(root, inputPath));
  const relativePath = relative(root, candidate);
  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error("Validator input escapes the workspace root.");
  }
  const metadata = await stat(candidate);
  if (!metadata.isFile() || metadata.size > MAX_INPUT_BYTES) {
    throw new Error("Validator input is not a bounded regular file.");
  }
  return JSON.parse(fatalUtf8Decoder.decode(await readFile(candidate)));
}

export function writeValidationResult(findings) {
  const result = { valid: findings.length === 0, findings };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

export function writeInputFailure() {
  writeValidationResult([
    {
      code: "invalid_input",
      path: "$",
      message: "Validator input could not be read safely.",
    },
  ]);
}
