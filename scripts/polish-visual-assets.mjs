import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readExperienceCases } from "./experience-cases.mjs";
import { readCatalog, root } from "./openclaw-proof-lib.mjs";

const copy = {
  "travel-concierge": ["Shortlist ready for traveler review", "OPTIONS", "PRICE CHECKS", "TRAVELER DECISIONS"],
  "event-operations-director": ["Run of show ready for owner review", "WORKSTREAMS", "READINESS CHECKS", "OWNER DECISIONS"],
  "api-integration-engineer": ["Integration plan ready for engineering review", "ENDPOINTS", "VERIFICATION CHECKS", "DEPLOY DECISIONS"],
  "procurement-evaluator": ["Comparison ready for sourcing review", "VENDORS", "EVALUATION SIGNALS", "BUYER DECISIONS"],
  "grant-portfolio-manager": ["Portfolio ready for program review", "GRANTS", "COMPLIANCE CHECKS", "PROGRAM DECISIONS"],
  "privacy-request-coordinator": ["Case plan ready for privacy review", "REQUESTS", "IDENTITY CHECKS", "PRIVACY DECISIONS"],
  "manufacturing-operations-planner": ["Shift plan ready for operations review", "WORK ORDERS", "CAPACITY CHECKS", "OPERATOR DECISIONS"],
  "facilities-operations-coordinator": ["Queue ready for facilities review", "REQUESTS", "SITE SIGNALS", "OWNER DECISIONS"],
  "ux-research-synthesizer": ["Themes ready for research review", "THEMES", "EVIDENCE NOTES", "RESEARCH DECISIONS"],
  "experimentation-lead": ["Readout ready for product review", "COHORTS", "QUALITY CHECKS", "PRODUCT DECISIONS"],
  "data-migration-planner": ["Migration plan ready for owner review", "WORKLOADS", "READINESS CHECKS", "CUTOVER DECISIONS"],
  "localization-program-manager": ["Locale plan ready for market review", "LOCALES", "QUALITY CHECKS", "MARKET DECISIONS"],
  "accessibility-review-coordinator": ["Review ready for remediation planning", "FINDINGS", "EVIDENCE CHECKS", "OWNER DECISIONS"],
  "quality-assurance-lead": ["Quality view ready for release review", "TEST AREAS", "QUALITY SIGNALS", "RELEASE DECISIONS"],
  "cloud-cost-analyst": ["Cost view ready for owner review", "COST AREAS", "BILLING SIGNALS", "OWNER DECISIONS"],
  "release-coordinator": ["Readiness view ready for maintainer review", "REQUIRED CHECKS", "ARTIFACTS", "OWNER DECISIONS"],
  "data-governance-steward": ["Governance view ready for domain-owner review", "DATA PRODUCTS", "EVIDENCE SIGNALS", "OWNER DECISIONS"],
  "compliance-reviewer": ["Assessment ready for accountable review", "REQUIREMENTS", "EVIDENCE STATES", "OWNER DECISIONS"],
  "security-analyst": ["Threat assessment ready for risk-owner review", "THREAT SCENARIOS", "EVIDENCE STATES", "OWNER DECISIONS"],
  "incident-response": ["Recovery view ready for incident-command review", "TIMELINE EVENTS", "RECOVERY SIGNALS", "COMMAND DECISIONS"],
  "data-analyst": ["Analysis ready for decision-owner review","COHORTS","QUALITY SIGNALS","OWNER DECISIONS"],
  "project-manager": ["Project view ready for sponsor review","MILESTONES","DELIVERY SIGNALS","SPONSOR DECISIONS"],
  "product-manager": ["Product decision ready for owner review","OPTIONS","EVIDENCE SIGNALS","PRODUCT DECISIONS"],
  "customer-support": ["Support case ready for case-owner review","DIAGNOSTICS","CASE SIGNALS","OWNER DECISIONS"],
};

const catalog = await readCatalog();
const entries = new Map(catalog.entries.map((entry) => [entry.id, entry]));
const visualCases = (await readExperienceCases(catalog)).filter((item) => item.target >= 4);

for (const experience of visualCases) {
  const entry = entries.get(experience.id);
  const labels = copy[experience.id];
  if (!entry || !labels) {
    throw new Error(`Missing visual copy for ${experience.id}.`);
  }
  const resource = (entry.resources ?? []).find((item) => item.source === experience.asset);
  if (!resource) {
    throw new Error(`${experience.id} does not declare ${experience.asset}.`);
  }
  let source = resource.content;
  source = source.replace(
    /<div class="oc-state">.*?<\/div>/u,
    `<div class="oc-state">${labels[0]}</div>`,
  );
  const cards = [...source.matchAll(/<article class="oc-card">.*?<\/article>/gu)];
  if (cards.length < 4) {
    throw new Error(`${experience.id} does not expose four summary cards.`);
  }
  const values = cards.slice(0, 4).map((match) => match[0].match(/<strong>(.*?)<\/strong>/u)?.[1]);
  const details = [
    experience.target >= 5 ? "live dashboard" : "inline result",
    "in the current review set",
    "linked to the result",
    "kept with the user",
  ];
  const labelsForCards = ["STATUS", labels[1], labels[2], labels[3]];
  const firstCardStart = cards[0].index;
  const lastCard = cards[3];
  const lastCardEnd = lastCard.index + lastCard[0].length;
  const replacementCards = labelsForCards
    .map(
      (label, index) =>
        `<article class="oc-card"><span>${label}</span><strong>${values[index]}</strong><p>${details[index]}</p></article>`,
    )
    .join("");
  source = `${source.slice(0, firstCardStart)}${replacementCards}${source.slice(lastCardEnd)}`;
  source = source.replace(
    /<section class="oc-panel"><h2>Application<\/h2><dl>.*?<\/dl><\/section>/u,
    `<section class="oc-panel"><h2>Current focus</h2><p>${entry.description}</p><div class="oc-chips"><span>reviewable</span><span>workspace-backed</span><span>user-controlled</span></div></section>`,
  );
  source = source
    .replaceAll("<h2>Named widgets</h2>", "<h2>Live views</h2>")
    .replaceAll("<h2>Text fallback</h2>", "<h2>Saved report</h2>")
    .replaceAll("packaged fixture data", "current workspace data")
    .replaceAll("loaded from fixture", "in the current review set")
    .replaceAll("reviewable records", "linked signals")
    .replaceAll("human-owned actions", "user decisions");
  resource.content = source;
  process.stdout.write(`Polished ${experience.id}.\n`);
}

await writeFile(join(root, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);
