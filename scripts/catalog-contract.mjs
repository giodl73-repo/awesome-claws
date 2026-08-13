const exactVersionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const packageNamePattern =
  /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const agentIdPattern = /^[a-z][a-z0-9_-]{0,63}$/;
const concreteMcpToolPattern = /^[A-Za-z][A-Za-z0-9_-]*__[A-Za-z][A-Za-z0-9_-]*$/;
const boundedGrantPattern = /[*?[\]{}]/u;
const toolAliases = new Map([
  ["apply-patch", "apply_patch"],
  ["bash", "exec"],
  ["cron", "automations"],
]);
const profileTools = new Map([
  ["minimal", new Set(["session_status"])],
  [
    "coding",
    new Set([
      "read",
      "write",
      "edit",
      "apply_patch",
      "exec",
      "process",
      "code_execution",
      "web_search",
      "web_fetch",
      "x_search",
      "memory_search",
      "memory_get",
      "sessions",
      "sessions_list",
      "sessions_history",
      "sessions_search",
      "conversations_list",
      "conversations_send",
      "conversations_turn",
      "sessions_send",
      "sessions_spawn",
      "agents_wait",
      "sessions_yield",
      "subagents",
      "session_status",
      "suggest_task",
      "dismiss_task",
      "screen",
      "dashboard",
      "terminal",
      "automations",
      "get_goal",
      "create_goal",
      "update_goal",
      "update_plan",
      "ask_user",
      "skill_workshop",
      "image",
      "image_generate",
      "music_generate",
      "video_generate",
    ]),
  ],
  [
    "messaging",
    new Set([
      "sessions",
      "sessions_list",
      "sessions_history",
      "sessions_search",
      "conversations_list",
      "conversations_send",
      "conversations_turn",
      "sessions_send",
      "sessions_spawn",
      "sessions_yield",
      "subagents",
      "session_status",
      "ask_user",
      "message",
    ]),
  ],
  ["full", null],
]);
const profilesWithBundleMcp = new Set(["coding", "messaging"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, allowed) {
  return isRecord(value) && Object.keys(value).every((key) => allowed.includes(key));
}

function normalizeToolName(value) {
  const normalized = value.trim().toLowerCase();
  return toolAliases.get(normalized) ?? normalized;
}

function validateToolList(value, path) {
  if (value === undefined) {
    return;
  }
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some(
      (grant) =>
        typeof grant !== "string" ||
        grant !== grant.trim() ||
        grant.length === 0 ||
        boundedGrantPattern.test(grant) ||
        normalizeToolName(grant) === "bundle-mcp" ||
        normalizeToolName(grant) === "group:plugins" ||
        (normalizeToolName(grant).startsWith("group:") &&
          !["group:fs", "group:runtime", "group:web", "group:memory", "group:sessions"].includes(
            normalizeToolName(grant),
          )),
    ) ||
    new Set(value.map(normalizeToolName)).size !== value.length
  ) {
    throw new Error(`${path} must contain unique bounded OpenClaw tool grants.`);
  }
}

function isProfileToolGrant(profile, grant) {
  const normalized = normalizeToolName(grant);
  if (profilesWithBundleMcp.has(profile) && concreteMcpToolPattern.test(grant)) {
    return true;
  }
  return profileTools.get(profile)?.has(normalized) === true;
}

export function validateOpenClawProfile(profile, label = "OpenClaw profile") {
  if (
    !hasOnlyKeys(profile, ["schemaVersion", "agent", "extensions"]) ||
    profile.schemaVersion !== 1 ||
    !hasOnlyKeys(profile.agent, [
      "groupChat",
      "sandbox",
      "tools",
      "memory",
      "heartbeat",
      "humanDelay",
    ])
  ) {
    throw new Error(`${label} must use the strict OpenClaw profile schema v1 shape.`);
  }

  const tools = profile.agent.tools;
  if (tools !== undefined) {
    if (
      !hasOnlyKeys(tools, ["profile", "allow", "alsoAllow", "deny", "fs"]) ||
      (tools.profile !== undefined &&
        (typeof tools.profile !== "string" || !profileTools.has(tools.profile))) ||
      (tools.fs !== undefined &&
        (!hasOnlyKeys(tools.fs, ["workspaceOnly"]) || tools.fs.workspaceOnly !== true))
    ) {
      throw new Error(`${label}.agent.tools contains an invalid OpenClaw policy.`);
    }
    validateToolList(tools.allow, `${label}.agent.tools.allow`);
    validateToolList(tools.alsoAllow, `${label}.agent.tools.alsoAllow`);
    if (
      tools.deny !== undefined &&
      (!Array.isArray(tools.deny) ||
        tools.deny.length === 0 ||
        tools.deny.some(
          (grant) => typeof grant !== "string" || grant !== grant.trim() || grant.length === 0,
        ))
    ) {
      throw new Error(`${label}.agent.tools.deny must contain nonempty tool names.`);
    }
    if (tools.alsoAllow && !tools.profile) {
      throw new Error(`${label}.agent.tools.alsoAllow requires a selected profile.`);
    }
    if (tools.allow && tools.alsoAllow) {
      throw new Error(`${label}.agent.tools cannot combine allow and alsoAllow.`);
    }
    if (tools.profile === "full" && !tools.allow) {
      throw new Error(`${label}.agent.tools.full requires a bounded allowlist.`);
    }
    if (profilesWithBundleMcp.has(tools.profile) && !tools.allow) {
      throw new Error(
        `${label}.agent.tools.${tools.profile} requires a bounded allowlist of concrete tools.`,
      );
    }
    if (
      tools.profile &&
      tools.profile !== "full" &&
      tools.allow?.some((grant) => !isProfileToolGrant(tools.profile, grant))
    ) {
      throw new Error(`${label}.agent.tools.allow must overlap the selected profile.`);
    }
  }

  const heartbeat = profile.agent.heartbeat;
  if (
    heartbeat !== undefined &&
    !hasOnlyKeys(heartbeat, [
      "every",
      "activeHours",
      "lightContext",
      "isolatedSession",
      "timeoutSeconds",
    ])
  ) {
    throw new Error(`${label}.agent.heartbeat contains retired or unknown fields.`);
  }

  const extensionIds = new Set();
  const extensionRefs = new Set();
  const extensions = profile.extensions ?? [];
  if (!Array.isArray(extensions)) {
    throw new Error(`${label}.extensions must be an array.`);
  }
  for (const extension of extensions) {
    const normalizedRef = extension?.ref?.toLowerCase();
    if (
      !hasOnlyKeys(extension, ["id", "kind", "format", "source", "ref", "version"]) ||
      !agentIdPattern.test(extension.id) ||
      extension.kind !== "plugin" ||
      !["openclaw", "claude", "codex", "cursor"].includes(extension.format) ||
      extension.source !== "clawhub" ||
      !packageNamePattern.test(extension.ref) ||
      !exactVersionPattern.test(extension.version) ||
      extensionIds.has(extension.id) ||
      extensionRefs.has(normalizedRef)
    ) {
      throw new Error(`${label} contains an invalid or duplicate harness extension.`);
    }
    extensionIds.add(extension.id);
    extensionRefs.add(normalizedRef);
  }
}

export function validateManifestMetadata(manifest, label = "Claw manifest") {
  if (manifest.metadata !== undefined) {
    if (
      !isRecord(manifest.metadata) ||
      Object.entries(manifest.metadata).some(
        ([key, value]) =>
          typeof value !== "string" || key !== key.trim() || key.length === 0,
      )
    ) {
      throw new Error(`${label}.metadata must map nonempty keys to strings.`);
    }
    if (Object.hasOwn(manifest.metadata, "openclaw.config")) {
      throw new Error(
        `${label}.metadata.openclaw.config is retired; use profiles/openclaw.yml.`,
      );
    }
  }
}

