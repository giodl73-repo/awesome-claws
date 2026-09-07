import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { root } from "./catalog-source.mjs";
import { digest } from "./runtime-evidence-lib.mjs";
import { runMockPlus } from "./mock-plus-lib.mjs";

export const MOCK_PLUS_PROFILE_PATH = join(
  root,
  "generated",
  "mock-plus-profile.json",
);
export const MOCK_PLUS_PROFILE_NAMES = Object.freeze([
  "vertical",
  "schema-portfolio",
  "semantic-portfolio",
  "lifecycle-portfolio",
]);

const MAX_COMMITTED_PROFILE_BYTES = 2 * 1_048_576;

function profileSummary(run) {
  return {
    name: run.manifest.profile,
    canonicalDigest: run.canonicalDigest,
    clawCount: run.coverage.clawCount,
    caseCount: run.coverage.caseCount,
    controlsPassed: run.coverage.counts["control-passed"],
    controlsFailed: run.coverage.counts["control-failed"],
    mutantsKilled: run.coverage.counts.killed,
    mutantsSurvived: run.coverage.counts.survived,
    unsupportedOracles: run.coverage.counts["unsupported-oracle"],
    invalidRecipes: run.coverage.counts["invalid-recipe"],
    oracleErrors: run.coverage.counts["oracle-error"],
    safetyBlockers: run.coverage.safety.blockingCount,
  };
}

export function buildMockPlusProfile(runs) {
  if (
    runs.length !== MOCK_PLUS_PROFILE_NAMES.length ||
    runs.some(
      (run, index) =>
        run.manifest.profile !== MOCK_PLUS_PROFILE_NAMES[index] ||
        run.coverage.status !== "passed",
    )
  ) {
    throw new Error(
      "Canonical Mock+ profile requires every qualifying profile in canonical order.",
    );
  }
  const profiles = runs.map(profileSummary);
  const body = {
    schemaVersion: "awesomeClaws.mockPlusProfile.v1",
    evidenceClass: "mock-deterministic",
    mode: "mock",
    disclaimer:
      "Deterministic mock evidence only; no live model, provider, production outcome, or quality-score claim.",
    crossPlatformCheck: ["linux", "win32"],
    maxCommittedBytes: MAX_COMMITTED_PROFILE_BYTES,
    profiles,
    totals: {
      profileCount: profiles.length,
      caseCount: profiles.reduce((sum, profile) => sum + profile.caseCount, 0),
      controlsPassed: profiles.reduce(
        (sum, profile) => sum + profile.controlsPassed,
        0,
      ),
      mutantsKilled: profiles.reduce(
        (sum, profile) => sum + profile.mutantsKilled,
        0,
      ),
      mutantsSurvived: profiles.reduce(
        (sum, profile) => sum + profile.mutantsSurvived,
        0,
      ),
      safetyBlockers: profiles.reduce(
        (sum, profile) => sum + profile.safetyBlockers,
        0,
      ),
    },
  };
  return { ...body, profileDigest: digest(body) };
}

export async function runMockPlusProfile() {
  const runs = [];
  for (const profile of MOCK_PLUS_PROFILE_NAMES) {
    runs.push(await runMockPlus({ profile, writeOutput: false }));
  }
  return buildMockPlusProfile(runs);
}

function profileText(profile) {
  const text = `${JSON.stringify(profile, null, 2)}\n`;
  if (Buffer.byteLength(text) > MAX_COMMITTED_PROFILE_BYTES) {
    throw new Error("Canonical Mock+ profile exceeds the 2 MiB committed limit.");
  }
  return text;
}

export async function updateMockPlusProfile() {
  const text = profileText(await runMockPlusProfile());
  await mkdir(dirname(MOCK_PLUS_PROFILE_PATH), { recursive: true });
  await writeFile(MOCK_PLUS_PROFILE_PATH, text, "utf8");
  return JSON.parse(text);
}

export async function checkMockPlusProfile() {
  const expected = profileText(await runMockPlusProfile());
  let actual;
  try {
    actual = await readFile(MOCK_PLUS_PROFILE_PATH, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        "Canonical Mock+ profile is missing. Run npm run mock-plus -- --update.",
      );
    }
    throw error;
  }
  if (actual !== expected) {
    throw new Error(
      "Canonical Mock+ profile has drifted. Run npm run mock-plus -- --update.",
    );
  }
  return JSON.parse(actual);
}

export async function main(args = process.argv.slice(2)) {
  if (args.length !== 1 || !["--check", "--update"].includes(args[0])) {
    throw new Error("Mock+ profile requires exactly one of --check or --update.");
  }
  const profile =
    args[0] === "--check"
      ? await checkMockPlusProfile()
      : await updateMockPlusProfile();
  console.log(
    `Mock+ canonical profile ${args[0] === "--check" ? "checked" : "updated"}: ${profile.totals.profileCount} profiles, ${profile.totals.caseCount} cases, ${profile.totals.mutantsKilled} mutants killed.`,
  );
  console.log(`Profile digest: ${profile.profileDigest}`);
  return profile;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
