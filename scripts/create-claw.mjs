import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { root } from "./catalog-source.mjs";
import {
  nearestMatchDiscussion,
  validateContributionProposal,
} from "./contribution-lib.mjs";
import { regressionCaseFor } from "./regression-cases.mjs";

function proposalPath() {
  const index = process.argv.indexOf("--proposal");
  if (index === -1 || !process.argv[index + 1]) {
    throw new Error("Use --proposal <file>.");
  }
  return resolve(process.argv[index + 1]);
}

export async function scaffoldClaw({ proposal, targetRoot = root }) {
const catalogPath = join(targetRoot, "catalog.json");
const experiencePath = join(targetRoot, "experience-cases.json");
const regressionPath = join(targetRoot, "regression-cases.json");
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const errors = validateContributionProposal(proposal, catalog.entries);
if (errors.length > 0) {
  throw new Error(`Invalid contribution proposal:\n- ${errors.join("\n- ")}`);
}
const { entry, contribution } = proposal;
if (catalog.entries.some((item) => item.id === entry.id)) {
  throw new Error(`Catalog already contains ${entry.id}.`);
}
const discussion = nearestMatchDiscussion(
  entry,
  catalog.entries,
  contribution.existingAlternatives,
);
if (!discussion.valid) {
  throw new Error(
    `Discuss at least ${discussion.required} of the five nearest matches before scaffolding: ${discussion.nearest.join(", ")}`,
  );
}

const resources = [
  {
    source: "fixtures/session-demo.json",
    path: "fixtures/session-demo.json",
    role: "fixture",
  },
  {
    source: "templates/session-report.template.json",
    path: "templates/session-report.template.json",
    role: "template",
  },
  {
    source: "templates/session-handoff.md",
    path: "templates/session-handoff.md",
    role: "template",
  },
];
const catalogEntry = { ...entry, resources };
const contributionRecord = { ...proposal, entry: catalogEntry };
catalog.entries.push(catalogEntry);

const experience = JSON.parse(await readFile(experiencePath, "utf8"));
experience.artifactCases.ids.push(entry.id);
const regression = JSON.parse(await readFile(regressionPath, "utf8"));
regression.cases.push(
  regressionCaseFor(catalogEntry, {
    id: entry.id,
    target: experience.artifactCases.target,
    primary: experience.artifactCases.primary,
    fallback: experience.artifactCases.fallback,
    output: experience.artifactCases.outputPattern.replace("{id}", entry.id),
  }),
);

const sourceRoot = join(targetRoot, "sources", entry.id);
await mkdir(join(sourceRoot, "fixtures"), { recursive: true });
await mkdir(join(sourceRoot, "templates"), { recursive: true });
const outputPath = `outputs/${entry.id}-handoff.md`;
const sessionDemo = {
  schemaVersion: "awesomeClaws.sessionDemo.v1",
  claw: entry.id,
  scenario: entry.example.request,
  messages: [
    { role: "user", text: entry.example.request },
    {
      role: "agent",
      text: "I identified the requested job, required evidence, and the authority boundary that remains human-owned.",
    },
    {
      role: "user",
      text: "Make the result useful in an ordinary chat client and leave a durable handoff.",
    },
    {
      role: "agent",
      text: `I produced ${outputPath} with evidence, gaps, blocked actions, and the next owner separated.`,
    },
  ],
  report: {
    title: `${entry.name} session handoff`,
    summary: entry.example.outcome,
    output: outputPath,
    items: entry.deliverables.map((title, index) => ({
      title,
      summary: entry.doneWhen[index % entry.doneWhen.length],
      tags: index === entry.deliverables.length - 1 ? ["handoff", "owner-visible"] : ["evidence", "reviewable"],
    })),
  },
};
const reportTemplate = {
  schemaVersion: "awesomeClaws.sessionReportTemplate.v1",
  title: `${entry.name} session report`,
  output: outputPath,
  sections: [
    "request",
    "known_facts",
    "assumptions",
    "evidence",
    "decisions_or_recommendations",
    "blocked_actions",
    "next_owner",
  ],
  itemShape: { title: "string", summary: "string", tags: ["string"] },
  fallback: "Render the same sections as Markdown when widgets or rich clients are unavailable.",
};
const handoff = `# ${entry.name} handoff

## Request

Summarize the user request and the decision or next action this Claw supports.

## Known facts

- Record only facts grounded in supplied context or approved tools.

## Assumptions and gaps

- Separate assumptions, stale evidence, conflicts, and missing information.

## Evidence ledger

- Link or name the source for every material claim.

## Result

- Render the declared deliverables without claiming unsupported authority.

## Blocked actions

- Keep external communication, irreversible changes, publication, and authority-sensitive actions blocked until explicitly approved.

## Next owner

Name the accountable human owner and where \`${outputPath}\` should be reviewed.
`;
await Promise.all([
  writeFile(
    join(sourceRoot, "fixtures", "session-demo.json"),
    `${JSON.stringify(sessionDemo, null, 2)}\n`,
    { flag: "wx" },
  ),
  writeFile(
    join(sourceRoot, "templates", "session-report.template.json"),
    `${JSON.stringify(reportTemplate, null, 2)}\n`,
    { flag: "wx" },
  ),
  writeFile(join(sourceRoot, "templates", "session-handoff.md"), handoff, { flag: "wx" }),
]);

await mkdir(join(targetRoot, "contributions"), { recursive: true });
await writeFile(
  join(targetRoot, "contributions", `${entry.id}.json`),
  `${JSON.stringify(contributionRecord, null, 2)}\n`,
  { flag: "wx" },
);
await copyFile(
  join(targetRoot, "screenshots", "executive-assistant.png"),
  join(targetRoot, "screenshots", `${entry.id}.png`),
);
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
await writeFile(experiencePath, `${JSON.stringify(experience, null, 2)}\n`);
await writeFile(regressionPath, `${JSON.stringify(regression, null, 2)}\n`);

return { id: entry.id, discussion };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = proposalPath();
  const proposal = JSON.parse(await readFile(path, "utf8"));
  const result = await scaffoldClaw({ proposal });
  console.log(`Scaffolded ${result.id} from ${path}.`);
  console.log("Next: npm run build");
  console.log(
    `Then capture a real screenshot: SCREENSHOT_ONLY=${result.id} npm run screenshots`,
  );
  console.log("Finally: npm run check");
  console.log("The copied scaffold screenshot intentionally fails contribution validation.");
}
