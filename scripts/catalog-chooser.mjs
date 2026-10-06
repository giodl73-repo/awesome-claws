import { capabilityClassesForEntry } from "./capability-classes.mjs";

const setupOrder = ["low", "medium", "high"];
const boundaryOrder = ["standard", "guarded", "heightened"];
const maintenanceOrder = ["active", "needs-help", "retiring"];

function compareText(left, right) {
  return left.localeCompare(right, "en");
}

function sorted(values) {
  return [...values].sort(compareText);
}

function externalDependencies(entry) {
  const dependencies = [
    ...(entry.packages ?? []).map((dependency) => ({
      kind: dependency.kind,
      id: dependency.ref,
      version: dependency.version,
    })),
    ...(entry.openclawProfile?.extensions ?? []).map((dependency) => ({
      kind: `extension:${dependency.kind}`,
      id: dependency.ref,
      version: dependency.version,
    })),
    ...Object.entries(entry.mcpServers ?? {}).map(([id, server]) => ({
      kind: "mcp",
      id,
      url: server.url,
      auth: server.auth ?? "none",
    })),
  ];
  return dependencies.sort((left, right) =>
    compareText(`${left.kind}:${left.id}`, `${right.kind}:${right.id}`),
  );
}

export function classifySetup(entry) {
  const packageCount = entry.packages?.length ?? 0;
  const extensionCount = entry.openclawProfile?.extensions?.length ?? 0;
  const mcpCount = Object.keys(entry.mcpServers ?? {}).length;
  const scheduleCount = entry.cronJobs?.length ?? 0;
  const signals = [
    ...(entry.bootstrap ? ["guided bootstrap"] : []),
    ...(packageCount ? [`${packageCount} pinned package${packageCount === 1 ? "" : "s"}`] : []),
    ...(extensionCount
      ? [`${extensionCount} native extension${extensionCount === 1 ? "" : "s"}`]
      : []),
    ...(mcpCount
      ? [`${mcpCount} MCP connection${mcpCount === 1 ? "" : "s"}`]
      : []),
    ...(scheduleCount
      ? [`${scheduleCount} scheduled job${scheduleCount === 1 ? "" : "s"}`]
      : []),
  ];
  const hasConnection = extensionCount > 0 || mcpCount > 0;
  const signalCount =
    (entry.bootstrap ? 1 : 0) + packageCount + extensionCount + mcpCount + scheduleCount;
  return {
    level: hasConnection || signalCount >= 3 ? "high" : signalCount > 0 ? "medium" : "low",
    reasons: signals.length > 0 ? signals : ["no bootstrap, external dependency, or schedule"],
  };
}

export function classifyBoundary(entry) {
  const packages = entry.packages ?? [];
  const tools = entry.openclawProfile?.agent?.tools;
  const heightened = [
    ...(packages.some((dependency) => dependency.kind === "plugin") ? ["plugin runtime"] : []),
    ...(entry.openclawProfile?.extensions?.length ? ["native extension"] : []),
    ...(Object.keys(entry.mcpServers ?? {}).length ? ["network MCP connection"] : []),
    ...(entry.cronJobs?.length ? ["scheduled execution"] : []),
    ...(tools?.profile === "full" ? ["full tool profile"] : []),
  ];
  if (heightened.length > 0) {
    return { level: "heightened", reasons: heightened };
  }
  const guarded = [
    ...(packages.some((dependency) => dependency.kind === "skill") ? ["pinned skill"] : []),
    ...(entry.bootstrap ? ["guided local setup"] : []),
    ...(tools ? ["explicit tool policy"] : []),
    ...(tools?.allow?.includes("dashboard") || tools?.alsoAllow?.includes("dashboard")
      ? ["persistent dashboard"]
      : []),
  ];
  return guarded.length > 0
    ? { level: "guarded", reasons: guarded }
    : { level: "standard", reasons: ["portable workspace artifacts only"] };
}

export function proofLanesFor(entry, experience) {
  return [
    "static",
    "regression",
    "installed",
    ...(experience.target >= 4 ? ["visual"] : []),
    ...(externalDependencies(entry).length > 0 ? ["dependency-live"] : []),
  ];
}

function starterSetIndex(starterSets) {
  if (!starterSets) {
    return { generatedFrom: [], sets: [], byClaw: new Map() };
  }
  const byClaw = new Map();
  const setIds = new Set();
  for (const set of starterSets.sets ?? []) {
    if (setIds.has(set.id)) {
      throw new Error(`Duplicate starter set id: ${set.id}`);
    }
    setIds.add(set.id);
    for (const clawId of set.claws ?? []) {
      const memberships = byClaw.get(clawId) ?? [];
      memberships.push(set.id);
      byClaw.set(clawId, memberships);
    }
  }
  return {
    generatedFrom: ["catalog-starter-sets.json"],
    sets: (starterSets.sets ?? []).map((set) => ({
      id: set.id,
      name: set.name,
      description: set.description,
      claws: [...set.claws],
    })),
    byClaw,
  };
}

export function buildChooser(catalog, experienceCases, starterSets) {
  const experienceById = new Map(experienceCases.map((item) => [item.id, item]));
  const starterSetData = starterSetIndex(starterSets);
  const catalogIds = new Set(catalog.entries.map((entry) => entry.id));
  for (const set of starterSetData.sets) {
    const missing = set.claws.filter((id) => !catalogIds.has(id));
    if (missing.length > 0) {
      throw new Error(`${set.name} references unknown Claws: ${missing.join(", ")}`);
    }
  }
  const entries = catalog.entries
    .map((entry) => {
      const experience = experienceById.get(entry.id);
      return {
        id: entry.id,
        name: entry.name,
        description: entry.description,
        audience: entry.audience,
        category: entry.category,
        maintenance: entry.maintenance,
        setup: classifySetup(entry),
        externalDependencies: externalDependencies(entry),
        proofTier: experience ? `X${experience.target}` : undefined,
        proofLanes: experience ? proofLanesFor(entry, experience) : [],
        capabilityClasses: capabilityClassesForEntry(entry, experience),
        boundaryAttention: classifyBoundary(entry),
        starterSets: starterSetData.byClaw.get(entry.id) ?? [],
      };
    })
    .sort((left, right) => compareText(left.name, right.name));
  if (entries.some((entry) => entry.proofTier === undefined)) {
    throw new Error("Every chooser entry must have an Experience proof tier.");
  }
  return {
    schemaVersion: 1,
    generatedFrom: ["catalog.json", "experience-cases.json", ...starterSetData.generatedFrom],
    starterSets: starterSetData.sets,
    rules: {
      setupBurden: {
        low: "No bootstrap, external dependency, or schedule.",
        medium: "One or two setup signals, without an MCP connection or native extension.",
        high: "An MCP connection, native extension, or at least three setup signals.",
      },
      boundaryAttention: {
        standard: "Portable workspace artifacts without an additional declared capability.",
        guarded: "Pinned skills, guided local setup, or an explicit bounded tool policy.",
        heightened: "Plugin runtime, native extension, network MCP, scheduled execution, or full tool profile.",
      },
      proofTier: "Derived from the authoritative Experience case target.",
      proofLanes:
        "Static, regression, and installed proof apply to every Claw. Visual and dependency-live lanes are derived from Experience and dependency metadata.",
      maintenanceStatus: {
        active: "Maintained and accepting ordinary improvements.",
        "needs-help": "Still supported, but an additional maintainer is needed.",
        retiring: "Maintained only through a documented retirement transition.",
      },
      starterSets:
        "Editorial 30-Claw bundles for quick adoption. A Claw can belong to more than one set.",
    },
    entries,
  };
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function entryLink(entry) {
  return `[${entry.name}](claws/${entry.id})`;
}

function table(entries, detail) {
  const lines = ["| Claw | Detail |", "| --- | --- |"];
  for (const entry of entries) {
    lines.push(`| ${entryLink(entry)} | ${escapeCell(detail(entry))} |`);
  }
  return lines.join("\n");
}

function groupedSection(title, intro, groups, entries, detail) {
  const lines = [`## ${title}`, "", intro];
  for (const group of groups) {
    const matching = entries.filter((entry) => group.matches(entry));
    lines.push("", `### ${group.label} (${matching.length})`, "", table(matching, detail));
  }
  return lines.join("\n");
}

export function renderChooserMarkdown(chooser) {
  const { entries, starterSets = [] } = chooser;
  const setupGroups = setupOrder.map((level) => ({
    label: `${level[0].toUpperCase()}${level.slice(1)} setup`,
    matches: (entry) => entry.setup.level === level,
  }));
  const boundaryGroups = boundaryOrder.map((level) => ({
    label: `${level[0].toUpperCase()}${level.slice(1)} attention`,
    matches: (entry) => entry.boundaryAttention.level === level,
  }));
  const proofGroups = sorted(new Set(entries.map((entry) => entry.proofTier))).map((tier) => ({
    label: tier,
    matches: (entry) => entry.proofTier === tier,
  }));
  const categoryGroups = sorted(new Set(entries.map((entry) => entry.category))).map((category) => ({
    label: `${category[0].toUpperCase()}${category.slice(1)}`,
    matches: (entry) => entry.category === category,
  }));
  const dependencyGroups = [
    {
      label: "No external dependencies",
      matches: (entry) => entry.externalDependencies.length === 0,
    },
    {
      label: "External dependencies declared",
      matches: (entry) => entry.externalDependencies.length > 0,
    },
  ];
  const maintenanceGroups = maintenanceOrder.map((status) => ({
    label: status
      .split("-")
      .map((word) => `${word[0].toUpperCase()}${word.slice(1)}`)
      .join(" "),
    matches: (entry) => entry.maintenance.status === status,
  }));
  const starterSetGroups = starterSets.map((set) => ({
    label: set.name,
    matches: (entry) => entry.starterSets.includes(set.id),
    intro: set.description,
  }));
  return `# Catalog chooser

This file is generated from \`catalog.json\`, \`experience-cases.json\`, and
\`catalog-starter-sets.json\`.
Edit those authoritative files and run \`npm run build\`; do not edit this file
directly. Levels are comparison aids, not security ratings or guarantees.

${groupedSection(
  "By maintenance status",
  "Maintenance state, accountable GitHub maintainers, and the last reviewed proof date come from catalog metadata. Scheduled compatibility evidence is reported separately and never rewrites this reviewed state.",
  maintenanceGroups,
  entries,
  (entry) =>
    `${entry.maintenance.maintainers.join(", ")}; last verified ${entry.maintenance.lastVerified}`,
)}

${groupedSection(
  "By starter set",
  "Starter sets are editorial 30-Claw bundles for quick adoption. A Claw can appear in more than one set.",
  starterSetGroups,
  entries,
  (entry) => `${entry.proofTier}; ${entry.category}; ${entry.description}`,
)}

${groupedSection(
  "By setup burden",
  "Setup burden counts guided bootstrap, pinned packages, native extensions, MCP connections, and schedules.",
  setupGroups,
  entries,
  (entry) => entry.setup.reasons.join("; "),
)}

${groupedSection(
  "By external dependencies",
  "External dependencies include pinned skills and plugins, native extensions, and MCP connections. Schedules and local profiles are shown under setup and boundary attention instead.",
  dependencyGroups,
  entries,
  (entry) =>
    entry.externalDependencies.length > 0
      ? entry.externalDependencies.map((item) => `${item.kind}: ${item.id}${item.version ? `@${item.version}` : ""}`).join("; ")
      : "None",
)}

${groupedSection(
  "By Experience proof tier",
  "Proof tiers come directly from the authoritative Experience conformance registry.",
  proofGroups,
  entries,
  (entry) => entry.description,
)}

${groupedSection(
  "By category",
  "Categories come directly from the catalog entry.",
  categoryGroups,
  entries,
  (entry) => `${entry.proofTier}; ${entry.description}`,
)}

${groupedSection(
  "By boundary attention",
  "Boundary attention highlights declared capabilities that deserve progressively closer consent and authority review. It is not a claim that lower-attention work is risk-free.",
  boundaryGroups,
  entries,
  (entry) => entry.boundaryAttention.reasons.join("; "),
)}
`;
}
