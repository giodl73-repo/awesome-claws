import { pathToFileURL } from "node:url";
import { readCatalog } from "./catalog-source.mjs";
import { readExperienceCases } from "./experience-cases.mjs";

const definitions = [
  {
    id: "clawhub-skill",
    description: "Installs an exact-pinned ClawHub skill package.",
    matches: (entry) => entry.packages?.some((item) => item.kind === "skill") === true,
  },
  {
    id: "clawhub-plugin",
    description: "Installs an exact-pinned ClawHub plugin package.",
    matches: (entry) => entry.packages?.some((item) => item.kind === "plugin") === true,
  },
  {
    id: "profile-extension",
    description: "Installs a profile-declared OpenClaw extension.",
    matches: (entry) => (entry.openclawProfile?.extensions?.length ?? 0) > 0,
  },
  {
    id: "oauth-mcp",
    description: "Configures a filtered MCP server that requires OAuth readiness.",
    matches: (entry) =>
      Object.values(entry.mcpServers ?? {}).some((server) => server.auth === "oauth"),
  },
  {
    id: "cron",
    description: "Schedules an agent-owned cron job.",
    matches: (entry) => (entry.cronJobs?.length ?? 0) > 0,
  },
  {
    id: "bootstrap",
    description: "Seeds native first-run bootstrap instructions.",
    matches: (entry) => typeof entry.bootstrap === "string" && entry.bootstrap.length > 0,
  },
  {
    id: "visual",
    description: "Produces an installed visual artifact and invokes show_widget.",
    matches: (_entry, experience) => (experience?.target ?? 0) >= 4,
    proofMode: "visual-runtime",
  },
  {
    id: "workspace-execution",
    description: "Installs bounded workspace patch and command-execution authority.",
    matches: (entry) => {
      const tools = entry.openclawProfile?.agent?.tools;
      const grants = [...(tools?.allow ?? []), ...(tools?.alsoAllow ?? [])];
      return grants.includes("apply_patch") && grants.includes("exec");
    },
  },
  {
    id: "delegated-sessions",
    description: "Installs bounded worker-session spawning, waiting, and provenance access.",
    matches: (entry) => {
      const tools = entry.openclawProfile?.agent?.tools;
      const grants = [...(tools?.allow ?? []), ...(tools?.alsoAllow ?? [])];
      return grants.includes("sessions_spawn") && grants.includes("agents_wait");
    },
  },
];

export const capabilityRepresentatives = Object.freeze({
  "clawhub-skill": "customer-support",
  "clawhub-plugin": "workflow-operator",
  "profile-extension": "software-maintainer",
  "oauth-mcp": "software-maintainer",
  cron: "incident-response",
  bootstrap: "executive-assistant",
  visual: "data-analyst",
  "workspace-execution": "change-control-operator",
  "delegated-sessions": "delegation-coordinator",
});

export function buildCapabilityMatrix(
  catalog,
  experienceCases,
  representatives = capabilityRepresentatives,
) {
  const experienceById = new Map(experienceCases.map((item) => [item.id, item]));
  const entriesById = new Map(catalog.entries.map((entry) => [entry.id, entry]));
  const classes = definitions.map((definition) => {
    const members = catalog.entries
      .filter((entry) => definition.matches(entry, experienceById.get(entry.id)))
      .map((entry) => entry.id);
    if (members.length === 0) {
      throw new Error(`Capability class ${definition.id} has no catalog members.`);
    }
    const representative = representatives[definition.id];
    if (!entriesById.has(representative) || !members.includes(representative)) {
      throw new Error(
        `Capability class ${definition.id} lacks a valid representative: ${representative ?? "none"}.`,
      );
    }
    return {
      id: definition.id,
      description: definition.description,
      memberCount: members.length,
      members,
      representative,
      proofMode: definition.proofMode ?? "installed-lifecycle",
    };
  });
  const unknownClasses = Object.keys(representatives).filter(
    (id) => !definitions.some((definition) => definition.id === id),
  );
  if (unknownClasses.length > 0) {
    throw new Error(`Unknown capability proof classes: ${unknownClasses.join(", ")}.`);
  }

  const representativeMap = new Map();
  for (const item of classes) {
    const record = representativeMap.get(item.representative) ?? {
      id: item.representative,
      classes: [],
      proofMode: "installed-lifecycle",
    };
    record.classes.push(item.id);
    if (item.proofMode === "visual-runtime") {
      record.proofMode = "visual-runtime";
    }
    representativeMap.set(item.representative, record);
  }

  return {
    schemaVersion: "awesomeClaws.capabilityMatrix.v1",
    classCount: classes.length,
    representativeCount: representativeMap.size,
    classes,
    representatives: [...representativeMap.values()],
  };
}

export async function readCapabilityMatrix() {
  const catalog = await readCatalog();
  const experienceCases = await readExperienceCases(catalog);
  return buildCapabilityMatrix(catalog, experienceCases);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await readCapabilityMatrix(), null, 2));
}
