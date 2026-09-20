import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactSemanticsPath = resolve(root, "scripts", "artifact-semantics.mjs");
const check = process.argv.includes("--check");

function stripUnneededValidatorImports(source) {
  const output = [];
  const lines = source.split(/(?<=\n)/u);
  for (let index = 0; index < lines.length; ) {
    if (!lines[index].startsWith("import ")) {
      output.push(lines[index]);
      index += 1;
      continue;
    }
    let statement = "";
    do {
      statement += lines[index];
      index += 1;
    } while (!statement.includes(";") && index < lines.length);
    if (
      !statement.includes('from "./') ||
      statement.includes('from "./portable-paths.mjs"')
    ) {
      output.push(statement);
    }
  }
  const narrowed = output.join("");
  const registryStart = narrowed.indexOf("\nconst validators = {");
  if (registryStart < 0) {
    throw new Error("Artifact semantic validator registry marker is missing.");
  }
  return narrowed.slice(0, registryStart);
}

const narrowProblemSemantics = {
  name: "narrow-problem-owner-semantics",
  setup(context) {
    context.onLoad(
      { filter: /artifact-semantics\.mjs$/ },
      async (args) =>
        resolve(args.path) === artifactSemanticsPath
          ? {
              contents: stripUnneededValidatorImports(
                await readFile(args.path, "utf8"),
              ),
              loader: "js",
              resolveDir: dirname(args.path),
            }
          : undefined,
    );
  },
};

const bundles = [
  {
    name: "security alert review validator",
    entry: "scripts/security-alert-review-reconciler.mjs",
    output:
      "sources/security-alert-review-reconciler/scripts/security-alert-review-validator.mjs",
    minify: false,
  },
  {
    name: "problem known-error validator",
    entry: "scripts/problem-known-error-validator.mjs",
    output:
      "sources/problem-known-error-coordinator/scripts/problem-known-error-validator.mjs",
    minify: true,
    plugins: [narrowProblemSemantics],
  },
  {
    name: "procure-to-pay three-way-match validator",
    entry: "scripts/procure-to-pay-three-way-match-validator.mjs",
    output:
      "sources/procure-to-pay-three-way-match-exception-reconciler/scripts/procure-to-pay-three-way-match-validator.mjs",
    minify: true,
  },
];

const expectedFiles = new Map();
for (const bundle of bundles) {
  const result = await build({
    entryPoints: [resolve(root, bundle.entry)],
    bundle: true,
    format: "esm",
    legalComments: "eof",
    minify: bundle.minify,
    platform: "node",
    plugins: bundle.plugins ?? [],
    target: "node22",
    treeShaking: true,
    write: false,
  });
  expectedFiles.set(bundle.output, {
    content: result.outputFiles[0].text,
    name: bundle.name,
  });
}

for (const [source, output] of [
  [
    "sources/incident-response/schemas/incident-state.schema.json",
    "sources/problem-known-error-coordinator/schemas/incident-state.schema.json",
  ],
  [
    "sources/quality-assurance-lead/schemas/test-evidence.schema.json",
    "sources/problem-known-error-coordinator/schemas/test-evidence.schema.json",
  ],
  [
    "sources/change-control-operator/schemas/change-plan.schema.json",
    "sources/problem-known-error-coordinator/schemas/change-plan.schema.json",
  ],
]) {
  expectedFiles.set(output, {
    content: await readFile(resolve(root, source), "utf8"),
    name: output,
  });
}

for (const [relativePath, expected] of expectedFiles) {
  const outputPath = resolve(root, relativePath);
  if (check) {
    const actual = await readFile(outputPath, "utf8").catch(() => null);
    if (actual !== expected.content) {
      throw new Error(`Packaged ${expected.name} is stale.`);
    }
  } else {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, expected.content, "utf8");
  }
}

console.log(
  `${check ? "Checked" : "Built"} ${bundles.length} packaged public validators.`,
);
