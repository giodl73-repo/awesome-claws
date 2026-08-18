import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readCatalog } from "./catalog-source.mjs";
import {
  contributionSimilarityReport,
  renderSimilarityMarkdown,
  validateContributionProposal,
} from "./contribution-lib.mjs";

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

const catalog = await readCatalog({ loadResources: false });
const id = valueAfter("--id");
const proposalPath = valueAfter("--proposal");
if ((id ? 1 : 0) + (proposalPath ? 1 : 0) !== 1) {
  throw new Error("Use exactly one of --id <claw-id> or --proposal <file>.");
}

let candidate;
if (proposalPath) {
  const proposal = JSON.parse(await readFile(resolve(proposalPath), "utf8"));
  const errors = validateContributionProposal(proposal, catalog.entries, {
    validateAlternatives: false,
  });
  if (errors.length > 0) {
    throw new Error(`Invalid contribution proposal:\n- ${errors.join("\n- ")}`);
  }
  candidate = proposal.entry;
} else {
  candidate = catalog.entries.find((entry) => entry.id === id);
  if (!candidate) throw new Error(`Unknown catalog Claw: ${id}`);
}

const report = contributionSimilarityReport(candidate, catalog.entries);
console.log(
  process.argv.includes("--json")
    ? JSON.stringify(report, null, 2)
    : renderSimilarityMarkdown(report),
);
