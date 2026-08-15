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
const staticToolGroups = new Map([
  [
    "group:openclaw",
    [
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
      "browser",
      "screen",
      "dashboard",
      "terminal",
      "show_widget",
      "message",
      "heartbeat_respond",
      "automations",
      "gateway",
      "nodes",
      "computer",
      "mobile_ui",
      "agents_list",
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
      "tts",
    ],
  ],
  ["group:fs", ["read", "write", "edit", "apply_patch"]],
  ["group:runtime", ["exec", "process", "code_execution"]],
  ["group:web", ["web_search", "web_fetch", "x_search"]],
  ["group:memory", ["memory_search", "memory_get"]],
  [
    "group:sessions",
    [
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
    ],
  ],
  ["group:ui", ["browser", "screen", "dashboard", "terminal", "canvas", "show_widget"]],
  ["group:messaging", ["message"]],
  ["group:automation", ["heartbeat_respond", "automations", "gateway"]],
  ["group:nodes", ["nodes", "computer", "mobile_ui"]],
  [
    "group:agents",
    [
      "agents_list",
      "get_goal",
      "create_goal",
      "update_goal",
      "update_plan",
      "ask_user",
      "skill_workshop",
    ],
  ],
  ["group:media", ["image", "image_generate", "music_generate", "video_generate", "tts"]],
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

function hasOnlyKeys(value, allowed) {
  return isRecord(value) && Object.keys(value).every((key) => allowed.includes(key));
}

function normalizeToolName(value) {
  const normalized = value.trim().toLowerCase();
  return toolAliases.get(normalized) ?? normalized;
}

function isConcreteMcpToolName(value) {
  return value.length <= 64 && concreteMcpToolPattern.test(value);
}

function isValidDuration(value) {
  if (!isNonEmptyString(value)) return false;
  const units = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  const normalized = value.toLowerCase();
  const single = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)?$/.exec(normalized);
  if (single) {
    return Number.isSafeInteger(Math.round(Number(single[1]) * units[single[2] ?? "m"]));
  }
  let totalMs = 0;
  let consumed = 0;
  for (const match of normalized.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h|d)/g)) {
    if (match.index !== consumed) return false;
    totalMs += Number(match[1]) * units[match[2]];
    consumed += match[0].length;
  }
  return (
    consumed === normalized.length && consumed > 0 && Number.isSafeInteger(Math.round(totalMs))
  );
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
          !staticToolGroups.has(normalizeToolName(grant))) ||
        (normalizeToolName(grant).includes("__") && !isConcreteMcpToolName(grant)),
    ) ||
    new Set(value.map(normalizeToolName)).size !== value.length
  ) {
    throw new Error(`${path} must contain unique bounded OpenClaw tool grants.`);
  }
}

function isProfileToolGrant(profile, grant) {
  const normalized = normalizeToolName(grant);
  if (profilesWithBundleMcp.has(profile) && isConcreteMcpToolName(grant)) {
    return true;
  }
  const group = staticToolGroups.get(normalized);
  return (
    profileTools.get(profile)?.has(normalized) === true ||
    group?.some((tool) => profileTools.get(profile)?.has(tool) === true) === true
  );
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

  const groupChat = profile.agent.groupChat;
  if (
    groupChat !== undefined &&
    (!hasOnlyKeys(groupChat, ["mentionPatterns"]) ||
      (groupChat.mentionPatterns !== undefined &&
        (!Array.isArray(groupChat.mentionPatterns) ||
          groupChat.mentionPatterns.length === 0 ||
          groupChat.mentionPatterns.some((entry) => !isNonEmptyString(entry)))))
  ) {
    throw new Error(`${label}.agent.groupChat contains invalid mention patterns.`);
  }

  const sandbox = profile.agent.sandbox;
  if (
    sandbox !== undefined &&
    (!hasOnlyKeys(sandbox, ["mode", "scope", "workspaceAccess"]) ||
      (sandbox.mode !== undefined && !["off", "non-main", "all"].includes(sandbox.mode)) ||
      (sandbox.scope !== undefined && !["session", "agent", "shared"].includes(sandbox.scope)) ||
      (sandbox.workspaceAccess !== undefined &&
        !["none", "ro", "rw"].includes(sandbox.workspaceAccess)))
  ) {
    throw new Error(`${label}.agent.sandbox contains invalid OpenClaw settings.`);
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

  const memory = profile.agent.memory;
  const search = memory?.search;
  if (
    memory !== undefined &&
    (!hasOnlyKeys(memory, ["search"]) ||
      (search !== undefined &&
        (!hasOnlyKeys(search, ["enabled", "rememberAcrossConversations", "sources"]) ||
          (search.enabled !== undefined && typeof search.enabled !== "boolean") ||
          (search.rememberAcrossConversations !== undefined &&
            typeof search.rememberAcrossConversations !== "boolean") ||
          (search.sources !== undefined &&
            (!Array.isArray(search.sources) ||
              search.sources.length === 0 ||
              search.sources.some((source) => !["memory", "sessions"].includes(source)))) ||
          (search.sources?.includes("sessions") &&
            search.rememberAcrossConversations !== true))))
  ) {
    throw new Error(`${label}.agent.memory contains invalid OpenClaw search settings.`);
  }

  const heartbeat = profile.agent.heartbeat;
  if (
    heartbeat !== undefined &&
    (!hasOnlyKeys(heartbeat, [
      "every",
      "activeHours",
      "lightContext",
      "isolatedSession",
      "timeoutSeconds",
    ]) ||
      (heartbeat.every !== undefined && !isValidDuration(heartbeat.every)) ||
      (heartbeat.lightContext !== undefined && typeof heartbeat.lightContext !== "boolean") ||
      (heartbeat.isolatedSession !== undefined &&
        typeof heartbeat.isolatedSession !== "boolean") ||
      (heartbeat.timeoutSeconds !== undefined &&
        (!Number.isInteger(heartbeat.timeoutSeconds) || heartbeat.timeoutSeconds <= 0)) ||
      (heartbeat.activeHours !== undefined &&
        (!hasOnlyKeys(heartbeat.activeHours, ["start", "end", "timezone"]) ||
          (heartbeat.activeHours.start !== undefined &&
            !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(heartbeat.activeHours.start)) ||
          (heartbeat.activeHours.end !== undefined &&
            !/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.test(heartbeat.activeHours.end)) ||
          (heartbeat.activeHours.timezone !== undefined &&
            (() => {
              try {
                new Intl.DateTimeFormat("en-US", {
                  timeZone: heartbeat.activeHours.timezone,
                }).format();
                return false;
              } catch {
                return true;
              }
            })()))))
  ) {
    throw new Error(`${label}.agent.heartbeat contains invalid OpenClaw settings.`);
  }

  const humanDelay = profile.agent.humanDelay;
  if (
    humanDelay !== undefined &&
    (!hasOnlyKeys(humanDelay, ["mode", "minMs", "maxMs"]) ||
      (humanDelay.mode !== undefined && !["off", "natural", "custom"].includes(humanDelay.mode)) ||
      ["minMs", "maxMs"].some(
        (field) =>
          humanDelay[field] !== undefined &&
          (!Number.isInteger(humanDelay[field]) || humanDelay[field] < 0),
      ))
  ) {
    throw new Error(`${label}.agent.humanDelay contains invalid OpenClaw settings.`);
  }

  const extensionIds = new Set();
  const extensionRefs = new Set();
  const extensions = profile.extensions === undefined ? [] : profile.extensions;
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
