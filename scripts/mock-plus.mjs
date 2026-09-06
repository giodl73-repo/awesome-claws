import { pathToFileURL } from "node:url";
import {
  loadMockPlusContext,
  runMockPlus,
} from "./mock-plus-lib.mjs";

export function parseMockPlusArgs(args) {
  const options = {
    onlyIds: null,
    caseId: null,
    explain: false,
    inventory: false,
    check: false,
    profile: "vertical",
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--only") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--only requires a comma-separated Claw id list.");
      }
      options.onlyIds = value.split(",").filter(Boolean);
      index += 1;
    } else if (argument === "--case") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--case requires a recipe id.");
      }
      options.caseId = value;
      index += 1;
    } else if (argument === "--explain") {
      options.explain = true;
    } else if (argument === "--inventory") {
      options.inventory = true;
    } else if (argument === "--check") {
      options.check = true;
    } else if (
      argument === "--portfolio" ||
      argument === "--semantics" ||
      argument === "--lifecycle"
    ) {
      if (options.profile !== "vertical") {
        throw new Error("Mock+ profile flags are mutually exclusive.");
      }
      options.profile = "schema-portfolio";
      if (argument === "--semantics") {
        options.profile = "semantic-portfolio";
      } else if (argument === "--lifecycle") {
        options.profile = "lifecycle-portfolio";
      }
    } else if (argument === "--update") {
      throw new Error(
        "--update is reserved for the canonical-profile slice and is not available yet.",
      );
    } else {
      throw new Error(`Unknown Mock+ option: ${argument}.`);
    }
  }
  if (options.explain && !options.caseId) {
    throw new Error("--explain requires --case.");
  }
  return options;
}

export async function main(args = process.argv.slice(2)) {
  const options = parseMockPlusArgs(args);
  if (options.inventory) {
    const { inventory } = await loadMockPlusContext();
    console.log(JSON.stringify(inventory, null, 2));
    return inventory;
  }

  const run = await runMockPlus({
    onlyIds: options.onlyIds,
    caseId: options.caseId,
    profile: options.profile,
  });
  if (options.explain) {
    const results = run.results.claws.flatMap((claw) => claw.cases);
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(
      [
        `Mock+ ${run.coverage.status}: ${run.coverage.clawCount} Claws,`,
        `${run.coverage.caseCount} cases,`,
        `${run.coverage.counts.killed} mutants killed,`,
        `${run.coverage.counts.survived} survived,`,
        `${run.coverage.safety.blockingCount} safety blockers.`,
      ].join(" "),
    );
    console.log(`Evidence: ${run.outputRoot}`);
    console.log(`Canonical digest: ${run.canonicalDigest}`);
  }
  if (options.check && run.coverage.status !== "passed") {
    process.exitCode = 1;
  }
  return run;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
