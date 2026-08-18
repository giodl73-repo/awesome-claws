import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import { root } from "./catalog-source.mjs";
import {
  catalogIdentityDigest,
  nearestMatchDiscussion,
  validateContributionProposal,
} from "./contribution-lib.mjs";

const FROZEN_GRANDFATHERED_DIGEST =
  "11d5a16b85ac0d5ee7c461910365efbde311b77f2126a2f140edd09dbdef20da";

export async function validateContributions({
  targetRoot = root,
  expectedGrandfatheredDigest = FROZEN_GRANDFATHERED_DIGEST,
} = {}) {
  const catalog = JSON.parse(await readFile(join(targetRoot, "catalog.json"), "utf8"));
  const policy = JSON.parse(
    await readFile(join(targetRoot, "contribution-policy.json"), "utf8"),
  );
  if (policy.schemaVersion !== 1 || !Array.isArray(policy.grandfatheredIds)) {
    throw new Error("contribution-policy.json must declare schemaVersion 1 grandfatheredIds.");
  }

  const ids = new Set(catalog.entries.map((entry) => entry.id));
  const grandfathered = new Set(policy.grandfatheredIds);
  if (grandfathered.size !== policy.grandfatheredIds.length) {
    throw new Error("contribution-policy.json grandfatheredIds must be unique.");
  }
  const grandfatheredDigest = catalogIdentityDigest(
    policy.grandfatheredIds.map((id) => ({ id })),
  );
  if (grandfatheredDigest !== expectedGrandfatheredDigest) {
    throw new Error(
      "contribution-policy.json grandfatheredIds changed; future Claws require contribution records.",
    );
  }
  for (const id of grandfathered) {
    if (!ids.has(id)) throw new Error(`Unknown grandfathered Claw: ${id}`);
  }

  const contributionRoot = join(targetRoot, "contributions");
  const contributionFiles = (await readdir(contributionRoot))
    .filter((name) => name.endsWith(".json"))
    .toSorted();
  const records = new Map();
  for (const name of contributionFiles) {
    const proposal = JSON.parse(await readFile(join(contributionRoot, name), "utf8"));
    const errors = validateContributionProposal(proposal, catalog.entries);
    if (errors.length > 0) {
      throw new Error(`${name} is invalid:\n- ${errors.join("\n- ")}`);
    }
    if (records.has(proposal.entry.id)) {
      throw new Error(`Duplicate contribution record: ${proposal.entry.id}`);
    }
    const catalogEntry = catalog.entries.find((entry) => entry.id === proposal.entry.id);
    if (!catalogEntry) throw new Error(`${name} refers to an absent catalog Claw.`);
    if (!isDeepStrictEqual(catalogEntry, proposal.entry)) {
      throw new Error(`${name} entry differs from catalog.json.`);
    }

    const discussion = nearestMatchDiscussion(
      proposal.entry,
      catalog.entries,
      proposal.contribution.existingAlternatives,
    );
    if (!discussion.valid) {
      throw new Error(
        `${name} must discuss at least ${discussion.required} of its five nearest catalog matches: ${discussion.nearest.join(", ")}`,
      );
    }
    records.set(proposal.entry.id, proposal);
  }

  const uncovered = [...ids].filter((id) => !grandfathered.has(id) && !records.has(id));
  if (uncovered.length > 0) {
    throw new Error(`New Claws require contribution records: ${uncovered.join(", ")}`);
  }

  const screenshotHashes = new Map();
  for (const entry of catalog.entries) {
    const bytes = await readFile(join(targetRoot, "screenshots", `${entry.id}.png`));
    const digest = createHash("sha256").update(bytes).digest("hex");
    const duplicate = screenshotHashes.get(digest);
    if (duplicate) {
      throw new Error(
        `${entry.id} reuses ${duplicate}'s screenshot; capture current Control UI proof.`,
      );
    }
    screenshotHashes.set(digest, entry.id);
  }

  return {
    catalogCount: catalog.entries.length,
    contributionCount: records.size,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validateContributions();
  console.log(
    `Validated contribution policy for ${result.catalogCount} Claws (${result.contributionCount} post-policy records).`,
  );
}
