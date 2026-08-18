import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { root } from "./catalog-source.mjs";
import {
  catalogIdentityDigest,
  contributionSimilarityReport,
  nearestMatchDiscussion,
  validateContributionProposal,
} from "./contribution-lib.mjs";
import { scaffoldClaw } from "./create-claw.mjs";
import { validateContributions } from "./validate-contributions.mjs";

const existing = [
  {
    id: "release-coordinator",
    name: "Release coordinator",
    category: "engineering",
    description: "Coordinates evidence and approvals for a software release.",
    audience: "Release managers",
    workflow: ["Collect checks", "Review evidence", "Request approval", "Prepare handoff"],
    deliverables: ["Readiness ledger", "Risk summary", "Approval state", "Handoff"],
    doneWhen: ["Checks recorded", "Risks owned", "Approval explicit"],
    intake: ["Target release", "Checks", "Owner"],
    boundaries: ["Do not publish without approval", "Do not hide failed checks"],
  },
  {
    id: "travel-planner",
    name: "Travel planner",
    category: "productivity",
    description: "Builds a sourced itinerary for traveler review.",
    audience: "Travelers",
    workflow: ["Gather preferences", "Compare routes", "Draft itinerary", "Hand off"],
    deliverables: ["Itinerary", "Source links", "Constraints", "Handoff"],
    doneWhen: ["Preferences reflected", "Sources linked", "No booking performed"],
    intake: ["Destination", "Dates", "Preferences"],
    boundaries: ["Do not book travel", "Keep traveler data private"],
  },
  {
    id: "incident-response",
    name: "Incident response",
    category: "engineering",
    description: "Coordinates evidence and mitigations during a live incident.",
    audience: "Incident commanders",
    workflow: ["Assess impact", "Gather evidence", "Assign mitigations", "Hand off"],
    deliverables: ["Timeline", "Impact", "Mitigation tracker", "Handoff"],
    doneWhen: ["Impact current", "Mitigations owned", "Handoff explicit"],
    intake: ["Impact", "Services", "Owners"],
    boundaries: ["Do not disrupt systems without approval", "Do not expose sensitive logs"],
  },
];

const proposal = {
  schemaVersion: 1,
  entry: {
    id: "deployment-readiness",
    name: "Deployment readiness",
    category: "engineering",
    description: "Coordinates checks and owner approval for a bounded deployment.",
    audience: "Service owners preparing a deployment.",
    principles: ["Use current evidence only", "Keep authority explicit", "Preserve failed checks"],
    boundaries: ["Do not deploy without owner approval", "Do not suppress failed checks"],
    intake: ["Target revision and environment", "Current checks and risks", "Accountable owner"],
    workflow: ["Collect checks", "Review evidence", "Record risks", "Prepare owner handoff"],
    deliverables: ["Readiness ledger", "Risk summary", "Approval state", "Owner handoff"],
    example: {
      request: "Assess whether revision abc is ready for staging deployment.",
      outcome: "A check-linked readiness handoff with explicit owner approval state.",
    },
    doneWhen: ["Checks are current", "Risks have owners", "Approval remains explicit"],
    capabilityGuidance: [
      "Use supplied evidence only and do not deploy.",
      "Return a blocked handoff when required evidence is unavailable.",
    ],
  },
  contribution: {
    problem: "Service owners lack a repeatable deployment readiness handoff.",
    repeatableJob: "Reconcile bounded deployment checks and prepare an owner decision.",
    proofPlan: "Exercise the artifact path and verify approval remains human-owned.",
    existingAlternatives: [
      {
        id: "release-coordinator",
        overlap: "Both reconcile checks and preserve approval state.",
        difference: "This proposal narrows the job to one deployment environment.",
      },
      {
        id: "travel-planner",
        overlap: "Both prepare a sourced handoff for review.",
        difference: "The users, evidence, workflow, and authority are unrelated.",
      },
      {
        id: "incident-response",
        overlap: "Both retain current evidence, risks, and accountable owners.",
        difference: "Incident response coordinates active recovery rather than planned deployment readiness.",
      },
    ],
  },
};

test("similarity review surfaces the nearest operational analogue", () => {
  const report = contributionSimilarityReport(proposal.entry, existing);
  assert.equal(report.matches[0].id, "release-coordinator");
  assert.ok(report.matches[0].score > report.matches[1].score);
  assert.ok(report.matches[0].dimensions.job.sharedTerms.includes("check"));
});

test("proposal validation rejects numbered ids and duplicate comparisons", () => {
  const numbered = structuredClone(proposal);
  numbered.entry.id = "claw-55";
  numbered.contribution.existingAlternatives[2].id = "release-coordinator";
  const errors = validateContributionProposal(numbered, existing);
  assert.ok(errors.includes("entry.id must not use a sequence number"));
  assert.ok(errors.includes("existingAlternatives ids must be unique"));

  for (const id of ["incident-response-2", "data-analyst2", "research-scout-v2"]) {
    const sequenced = structuredClone(proposal);
    sequenced.entry.id = id;
    assert.ok(
      validateContributionProposal(sequenced, existing).includes(
        "entry.id must not use a sequence number",
      ),
      `${id} should be rejected`,
    );
  }

  const selfComparison = structuredClone(proposal);
  selfComparison.contribution.existingAlternatives[0].id = selfComparison.entry.id;
  assert.ok(
    validateContributionProposal(selfComparison, [...existing, selfComparison.entry]).includes(
      "existingAlternatives[0].id must not name the proposed Claw",
    ),
  );
});

test("nearest-match discussion rejects proposals that omit current analogues", () => {
  const result = nearestMatchDiscussion(proposal.entry, existing, [
    { id: "not-in-the-catalog" },
  ]);
  assert.equal(result.valid, false);
  assert.equal(result.required, 2);
  assert.equal(result.discussedCount, 0);
});

test("draft similarity review does not require completed alternative comparisons", () => {
  const draft = structuredClone(proposal);
  draft.contribution.existingAlternatives = [];
  assert.deepEqual(
    validateContributionProposal(draft, existing, { validateAlternatives: false }),
    [],
  );
  assert.ok(
    validateContributionProposal(draft, existing).includes(
      "contribution.existingAlternatives requires at least three comparisons",
    ),
  );
});

test("scaffolder creates a neutral X3 source package and contribution record", async () => {
  const targetRoot = await mkdtemp(join(tmpdir(), "awesome-claws-scaffold-"));
  try {
    await mkdir(join(targetRoot, "screenshots"), { recursive: true });
    await writeFile(
      join(targetRoot, "catalog.json"),
      `${JSON.stringify({ schemaVersion: 1, entries: existing }, null, 2)}\n`,
    );
    await writeFile(
      join(targetRoot, "experience-cases.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          artifactCases: {
            target: 3,
            primary: "artifact",
            fallback: "text",
            outputPattern: "outputs/{id}-handoff.md",
            ids: existing.map((entry) => entry.id),
          },
          visualCases: [],
        },
        null,
        2,
      )}\n`,
    );
    await writeFile(
      join(targetRoot, "contribution-policy.json"),
      `${JSON.stringify(
        { schemaVersion: 1, grandfatheredIds: existing.map((entry) => entry.id) },
        null,
        2,
      )}\n`,
    );
    const expectedGrandfatheredDigest = catalogIdentityDigest(existing);
    const validateFixture = () =>
      validateContributions({ targetRoot, expectedGrandfatheredDigest });
    await mkdir(join(targetRoot, "contributions"), { recursive: true });
    await copyFile(
      join(root, "screenshots", "executive-assistant.png"),
      join(targetRoot, "screenshots", "executive-assistant.png"),
    );
    await Promise.all(
      existing.map((entry, index) =>
        writeFile(
          join(targetRoot, "screenshots", `${entry.id}.png`),
          entry.id === "release-coordinator" ? "temporary-image" : `unique-image-${index}`,
        ),
      ),
    );
    await writeFile(
      join(targetRoot, "screenshots", "executive-assistant.png"),
      "temporary-image",
    );

    const result = await scaffoldClaw({ proposal, targetRoot });
    assert.equal(result.id, proposal.entry.id);
    const catalog = JSON.parse(await readFile(join(targetRoot, "catalog.json"), "utf8"));
    assert.ok(catalog.entries.some((entry) => entry.id === proposal.entry.id));
    const handoff = await readFile(
      join(
        targetRoot,
        "sources",
        proposal.entry.id,
        "templates",
        "session-handoff.md",
      ),
      "utf8",
    );
    assert.match(handoff, /Deployment readiness handoff/u);
    assert.doesNotMatch(handoff, /executive/iu);
    assert.equal(
      JSON.parse(
        await readFile(
          join(targetRoot, "contributions", `${proposal.entry.id}.json`),
          "utf8",
        ),
      ).contribution.repeatableJob,
      proposal.contribution.repeatableJob,
    );
    assert.deepEqual(
     JSON.parse(
       await readFile(
         join(targetRoot, "contributions", `${proposal.entry.id}.json`),
         "utf8",
       ),
     ).entry.resources,
     catalog.entries.find((entry) => entry.id === proposal.entry.id).resources,
    );

    await assert.rejects(
     validateFixture(),
     /reuses release-coordinator's screenshot/u,
    );
    await writeFile(
     join(targetRoot, "screenshots", `${proposal.entry.id}.png`),
     "new-control-ui-proof",
    );
    await validateFixture();

    catalog.entries.find((entry) => entry.id === proposal.entry.id).mcpServers = {
     remote: { url: "https://example.invalid/mcp" },
    };
    await writeFile(
     join(targetRoot, "catalog.json"),
     `${JSON.stringify(catalog, null, 2)}\n`,
    );
    await assert.rejects(
     validateFixture(),
     /entry differs from catalog\.json/u,
    );
    delete catalog.entries.find((entry) => entry.id === proposal.entry.id).mcpServers;
    await writeFile(
     join(targetRoot, "catalog.json"),
     `${JSON.stringify(catalog, null, 2)}\n`,
    );

    await copyFile(
     join(targetRoot, "contributions", `${proposal.entry.id}.json`),
     join(targetRoot, "contributions", "duplicate.json"),
    );
    await assert.rejects(
     validateFixture(),
     /Duplicate contribution record/u,
    );
    await rm(join(targetRoot, "contributions", "duplicate.json"));

    await writeFile(
     join(targetRoot, "contribution-policy.json"),
     `${JSON.stringify(
       {
         schemaVersion: 1,
         grandfatheredIds: [...existing.map((entry) => entry.id), proposal.entry.id],
       },
       null,
       2,
     )}\n`,
    );
    await assert.rejects(validateFixture(), /grandfatheredIds changed/u);
    await writeFile(
     join(targetRoot, "contribution-policy.json"),
     `${JSON.stringify(
       { schemaVersion: 1, grandfatheredIds: existing.map((entry) => entry.id) },
       null,
       2,
     )}\n`,
    );

    await rm(join(targetRoot, "contributions", `${proposal.entry.id}.json`));
    await assert.rejects(
     validateFixture(),
     /New Claws require contribution records/u,
    );
  } finally {
    await rm(targetRoot, { recursive: true, force: true });
  }
});
