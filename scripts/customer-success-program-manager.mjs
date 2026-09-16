import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";

export const CUSTOMER_SUCCESS_REVIEW_SCHEMA_VERSION =
  "awesomeClaws.customerSuccessReview.v1";

const REQUIRED_PROHIBITED_ACTIONS = Object.freeze([
  "contact-customer",
  "send-message",
  "change-workload",
  "change-tenant",
  "mutate-account",
  "mutate-service",
  "mutate-support-case",
  "make-commercial-promise",
  "change-pricing",
  "change-contract",
  "commit-renewal",
  "accept-risk",
  "claim-customer-success",
]);

const APPROVED_PLAN_SIGNERS = new Map([
  [
    "customer-success-plan-authority-v1",
    createPublicKey({
      key: Buffer.from(
        "MCowBQYDK2VwAyEAufnAdLGBiiAW0h1n7kG01N08pLbQb+fT6scevS80rgA=",
        "base64",
      ),
      format: "der",
      type: "spki",
    }),
  ],
]);

const APPROVED_PLAN_METRIC_DIGESTS = new Map([
  [
    "plan-contoso-2026@7#metric-teams-active-user-rate",
    "sha256:3adc2bc9d90fc36272dcc8090d17c404239c5b9efe21ad7461a2e2686326b344",
  ],
]);
const TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function rows(value, path, findings) {
  if (!Array.isArray(value)) {
    findings.push(finding("invalid_collection", path, `${path} must be an array.`));
    return [];
  }
  return value.flatMap((item, index) => {
    if (!isRecord(item)) {
      findings.push(
        finding("invalid_array_record", `${path}[${index}]`, `${path} records must be objects.`),
      );
      return [];
    }
    return [item];
  });
}

function timestamp(value) {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function finding(code, path, message) {
  return { code, path, message };
}

function idMap(items, path, findings) {
  const result = new Map();
  for (const [index, item] of items.entries()) {
    if (typeof item.id !== "string" || item.id.length === 0 || result.has(item.id)) {
      findings.push(
        finding("duplicate_or_invalid_id", `${path}[${index}].id`, `${path} ids must be unique.`),
      );
      continue;
    }
    result.set(item.id, item);
  }
  return result;
}

function sameSet(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === new Set(left).size &&
    right.length === new Set(right).size &&
    left.length === right.length &&
    left.every((item) => right.includes(item))
  );
}

function expectedBinding(review) {
  return {
    customerRef: review?.customer?.id,
    tenantRef: review?.tenant?.id,
    accountRef: review?.account?.id,
    planRef: review?.plan?.id,
    planRevision: review?.plan?.revision,
  };
}

function bindingMatches(binding, expected) {
  return (
    isRecord(binding) &&
    Object.entries(expected).every(([key, value]) => binding[key] === value)
  );
}

function isHuman(principal) {
  return (
    principal?.kind === "human" &&
    typeof principal.role === "string" &&
    principal.role.trim().length > 0 &&
    !/\b(?:agent|assistant|bot|claw|customer success program manager)\b/iu.test(principal.role)
  );
}

function requireRef(ref, known, path, label, findings) {
  if (!known.has(ref)) {
    findings.push(finding("dangling_reference", path, `${label} ${JSON.stringify(ref)} does not resolve.`));
    return false;
  }
  return true;
}

function requireHumanRef(ref, principals, path, findings) {
  if (!requireRef(ref, principals, path, "Principal", findings)) return false;
  if (!isHuman(principals.get(ref))) {
    findings.push(
      finding(
        "invalid_authority_owner",
        path,
        "Authority must remain with a named accountable human, not a system or agent role.",
      ),
    );
    return false;
  }
  return true;
}

function requireBinding(item, expected, path, findings) {
  if (!bindingMatches(item?.binding, expected)) {
    findings.push(
      finding(
        "cross_scope_or_revision_binding",
        `${path}.binding`,
        "The record must bind to the exact customer, tenant, account, plan, and approved revision.",
      ),
    );
    return false;
  }
  return true;
}

function hasExactWorkloadServiceScope(item, workloads, services) {
  return (
    typeof item?.workloadRef === "string" &&
    typeof item?.serviceRef === "string" &&
    workloads.get(item.workloadRef)?.serviceRef === item.serviceRef &&
    services.has(item.serviceRef)
  );
}

function requireWorkloadServiceScope(item, workloads, services, path, findings) {
  if (!hasExactWorkloadServiceScope(item, workloads, services)) {
    findings.push(
      finding(
        "invalid_workload_service_scope",
        path,
        "The record must identify one exact, non-null workload and its matching service.",
      ),
    );
    return false;
  }
  return true;
}

function sourceMatchesScope(source, item) {
  return (
    source?.workloadRef === item?.workloadRef &&
    source?.serviceRef === item?.serviceRef &&
    typeof item?.workloadRef === "string" &&
    typeof item?.serviceRef === "string"
  );
}

function requireEvidenceRefs(refs, sources, path, findings, { allowEmpty = false } = {}) {
  if (!Array.isArray(refs) || (!allowEmpty && refs.length === 0) || new Set(refs).size !== refs.length) {
    findings.push(
      finding("invalid_evidence_refs", path, "Evidence references must be a unique non-empty list."),
    );
    return false;
  }
  let valid = true;
  for (const [index, ref] of refs.entries()) {
    valid = requireRef(ref, sources, `${path}[${index}]`, "Source", findings) && valid;
  }
  return valid;
}

function expectedMetricStatus(definition, value) {
  if (definition?.direction === "informational" || definition?.target === null) {
    return "informational";
  }
  if (definition?.direction === "at-least") {
    return value >= definition.target ? "on-target" : "below-target";
  }
  if (definition?.direction === "at-most") {
    return value <= definition.target ? "on-target" : "above-threshold";
  }
  return null;
}

export function customerSuccessMetricDefinitionDigest(definition, source) {
  const payload = {
    name: definition?.name,
    workloadRef: definition?.workloadRef,
    serviceRef: definition?.serviceRef,
    definition: definition?.definition,
    unit: definition?.unit,
    aggregation: definition?.aggregation,
    direction: definition?.direction,
    target: definition?.target,
    windowStart: definition?.windowStart,
    windowEnd: definition?.windowEnd,
    sourceRef: definition?.sourceRef,
    sourceIdentity: {
      sourceUri: source?.sourceUri,
      collectedAt: source?.collectedAt,
      suppliedByRef: source?.suppliedByRef,
      workloadRef: source?.workloadRef,
      serviceRef: source?.serviceRef,
      binding: source?.binding,
    },
  };
  return `sha256:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

export function customerSuccessApprovedPlanVerificationPayload(source, plan) {
  return JSON.stringify({
    sourceUri: source?.sourceUri,
    suppliedByRef: source?.suppliedByRef,
    binding: {
      customerRef: source?.binding?.customerRef,
      tenantRef: source?.binding?.tenantRef,
      accountRef: source?.binding?.accountRef,
      planRef: source?.binding?.planRef,
      planRevision: source?.binding?.planRevision,
    },
    verifiedContentDigests: Array.isArray(source?.verifiedContentDigests)
      ? [...source.verifiedContentDigests].sort()
      : source?.verifiedContentDigests,
    plan: {
      id: plan?.id,
      revision: plan?.revision,
      approvedAt: plan?.approvedAt,
      approvedByRef: plan?.approvedByRef,
      customerRef: plan?.customerRef,
      tenantRef: plan?.tenantRef,
      accountRef: plan?.accountRef,
    },
  });
}

function approvedPlanSignerKey(keyId, options) {
  const builtIn = APPROVED_PLAN_SIGNERS.get(keyId);
  if (builtIn) return builtIn;
  const configured = options?.approvedPlanPublicKeys?.[keyId];
  if (typeof configured !== "string") return undefined;
  try {
    return createPublicKey({
      key: Buffer.from(configured, "base64"),
      format: "der",
      type: "spki",
    });
  } catch {
    return undefined;
  }
}

function hasValidApprovedPlanSignature(source, plan, options) {
  const key = approvedPlanSignerKey(source?.verification?.keyId, options);
  return (
    key !== undefined &&
    typeof source?.verification?.signature === "string" &&
    verifySignature(
      null,
      Buffer.from(customerSuccessApprovedPlanVerificationPayload(source, plan)),
      key,
      Buffer.from(source.verification.signature, "base64"),
    )
  );
}

function trustedMetricDigest(plan, definition, options) {
  const key = `${plan?.id}@${plan?.revision}#${definition?.id}`;
  return options?.approvedPlanMetricDigests?.[key] ?? APPROVED_PLAN_METRIC_DIGESTS.get(key);
}

const NUMBER_WORDS = Object.freeze({
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
});

function parseCriterionQuantity(raw, percent, unit) {
  const numeric = Number(raw);
  let value = Number.isFinite(numeric)
    ? numeric
    : raw
        .toLowerCase()
        .split(/[\s-]+/u)
        .reduce((sum, word) => sum + (NUMBER_WORDS[word] ?? Number.NaN), 0);
  if (!Number.isFinite(value)) return null;
  if (percent && unit === "ratio") value /= 100;
  return value;
}

function targetClaimMatches(description) {
  if (typeof description !== "string") return [];
  const quantity =
    "(?<quantity>\\d+(?:\\.\\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)(?:[-\\s](?<ones>one|two|three|four|five|six|seven|eight|nine))?";
  const patterns = [
    new RegExp(
      `\\b(?<comparator>at least|at most|greater than|less than|no less than|no more than|exceeds?|minimum(?:\\s+of)?|maximum(?:\\s+of)?|minimum(?:\\s+approved)? target(?:\\s+is)?|maximum(?:\\s+approved)? target(?:\\s+is)?|ceiling(?:\\s+approved)? target(?:\\s+is)?|reaches?|should reach|must be|must (?:stay|remain) (?:above|below)|(?:stay|remain) (?:above|below)|lowered to|raised to|target(?:\\s+(?:of|is|equals))?|target\\s*=|threshold(?:\\s+(?:of|is|equals))?|goal(?:\\s+(?:of|is|equals))?|goal:)\\s+${quantity}(?<percent>\\s+percent|%)?(?=$|[\\s,;.!?)])`,
      "giu",
    ),
    new RegExp(
      `\\b(?<comparator>(?:target|threshold|goal|objective) for)\\s+[^,;.!?]{1,80}?\\s+is\\s+${quantity}(?<percent>\\s+percent|%)?(?=$|[\\s,;.!?)])`,
      "giu",
    ),
    new RegExp(
      `\\b(?<comparator>must equal|should remain no lower than|should remain no higher than)\\s+${quantity}(?<percent>\\s+percent|%)?(?=$|[\\s,;.!?)])`,
      "giu",
    ),
    new RegExp(`\\b${quantity}(?<percent>\\s+percent|%)?(?=\\s+(?:target|threshold|goal|objective)\\b)\\s+(?:target|threshold|goal|objective)\\b`, "giu"),
  ];
  return patterns.flatMap((pattern) => [...description.matchAll(pattern)]);
}

function targetClaimsConflict(description, definition) {
  const matches = targetClaimMatches(description);
  if (matches.length === 0) return false;
  if (!Number.isFinite(definition?.target)) return true;
  for (const match of matches) {
      const words = [match.groups?.quantity, match.groups?.ones].filter(Boolean).join(" ");
      const percent = Boolean(match.groups?.percent);
      const quantityValue = parseCriterionQuantity(words, percent, definition.unit);
      const comparator = match.groups?.comparator?.toLowerCase();
      const directionConflicts =
        (["at least", "no less than", "minimum", "minimum of", "minimum target", "minimum target is", "minimum approved target", "minimum approved target is"].includes(comparator) &&
          definition.direction !== "at-least") ||
        (["at most", "no more than", "maximum", "maximum of", "maximum target", "maximum target is", "maximum approved target", "maximum approved target is", "ceiling target", "ceiling target is", "ceiling approved target", "ceiling approved target is"].includes(comparator) &&
          definition.direction !== "at-most") ||
        [
          "greater than",
          "less than",
          "exceed",
          "exceeds",
          "must stay above",
          "must remain above",
          "stay above",
          "remain above",
          "must stay below",
          "must remain below",
          "stay below",
          "remain below",
        ].includes(comparator);
      const exactnessConflicts =
        (comparator === "should remain no lower than" && definition.direction !== "at-least") ||
        (comparator === "should remain no higher than" && definition.direction !== "at-most") ||
        comparator === "must equal";
      if (
        directionConflicts ||
        exactnessConflicts ||
        ["lowered to", "raised to"].includes(comparator) ||
        quantityValue !== definition.target
      ) {
        return true;
      }
  }
  return false;
}

function criterionTargetConflicts(description, definition, definitions) {
  if (
    typeof description !== "string" ||
    typeof definition?.name !== "string" ||
    !description.toLocaleLowerCase().includes(definition.name.toLocaleLowerCase())
  ) {
    return true;
  }
  const normalized = description.toLocaleLowerCase();
  const matchedNames = definitions
    .filter(
      (candidate) =>
        typeof candidate.name === "string" &&
        normalized.includes(candidate.name.toLocaleLowerCase()),
    )
    .map((candidate) => candidate.name.length);
  if (definition.name.length !== Math.max(...matchedNames)) {
    return true;
  }
  if (description.trim() === `${definition.name} reaches the approved target.`) return false;
  const targetClauses = description
    .split(/;|\.(?=\s|$)|\s+(?:and|before|after|while|whereas|although|but)\s+/iu)
    .filter((clause) => targetClaimMatches(clause).length > 0);
  if (targetClauses.length === 0) return true;
  return targetClauses.some((clause) => {
    const normalizedClause = clause.toLocaleLowerCase();
    return targetClaimMatches(clause).some((targetMatch) => {
      const targetIndex = targetMatch.index ?? 0;
      const nearest = definitions
        .flatMap((candidate) => {
          if (typeof candidate.name !== "string") return [];
          const name = candidate.name.toLocaleLowerCase();
          const index = normalizedClause.lastIndexOf(name, targetIndex + targetMatch[0].length);
          return index < 0 ? [] : [{ candidate, distance: targetIndex - (index + name.length) }];
        })
        .sort(
          (left, right) =>
            left.distance - right.distance ||
            right.candidate.name.length - left.candidate.name.length,
        )[0]?.candidate;
      return nearest?.id !== definition.id || targetClaimsConflict(targetMatch[0], definition);
    });
  });
}

const PROHIBITED_CLAIM_PREDICATES = Object.freeze([
  /\b(?<pending>(?:it\s+is\s+)?pending confirmation whether\s+)?(?<negated>no\s+)?(?:the\s+)?customer\s+(?<aux>(?:(?:has|have|had)\s+(?:(?:not|never)\s+)?been|(?:was|were|is|are)\s+(?:(?:not|never)\s+)?(?:being\s+)?))\s*(?:contacted|emailed|called)\b/giu,
  /\b(?:the\s+)?customer\s+(?<aux>(?:(?:has|have|had)\s+(?:(?:not|never)\s+)?|(?:was|were|is|are)\s+(?:(?:not|never)\s+)?))(?:(?:already|successfully|now|previously)\s+)+(?:been\s+|being\s+)?(?:contacted|emailed|called)\b/giu,
  /\b(?:the\s+)?customer\s+(?<aux>did\s+(?:not|never)\s+)?(?:receive|received)\s+(?:an?\s+|the\s+)?(?:email|message|call)\b/giu,
  /\b(?:we|i|the claw|the agent)\s+(?<aux>(?:(?:did|has|have|had|will)\s+(?:(?:not|never)\s+)?)?)(?:contact(?:ed)?|email(?:ed)?|call(?:ed)?)\s+(?:the\s+)?customer\b/giu,
  /\b(?:the\s+)?(?:account manager|implementation lead|support|success manager|customer success manager|renewal owner)\s+(?<aux>(?:(?:did|has|have|had|will)\s+(?:(?:not|never)\s+)?)?)(?:contact(?:ed)?|email(?:ed)?|call(?:ed)?)\s+(?:the\s+)?customer\b/giu,
  /\b\p{Lu}[\p{L}'-]*\s+(?<aux>(?:(?:did|has|have|had|will)\s+(?:(?:not|never)\s+)?)?)(?:contact(?:ed)?|email(?:ed)?|call(?:ed)?)\s+(?:the\s+)?customer\b/gu,
  /\b(?:a\s+|the\s+)?(?:message|email)\s+(?<aux>(?:(?:has|have|had)\s+(?:(?:not|never)\s+)?been|(?:was|were|is|are)\s+(?:(?:not|never)\s+)?(?:being\s+)?))\s*sent\b/giu,
  /\b(?:we|i|the claw|the agent)\s+(?<aux>(?:(?:did|has|have|had|will)\s+(?:(?:not|never)\s+)?)?)(?:send|sent)\s+(?:an?\s+|the\s+)?(?:message|email)(?:\s+to\s+(?:the\s+)?customer)?\b/giu,
  /\b(?:and|but)\s+(?<aux>did\s+(?:not|never)\s+)?(?:send|sent)\s+(?:an?\s+|the\s+)?(?:message|email)(?:\s+to\s+(?:the\s+)?customer)?\b/giu,
  /\b(?:and|but|or)\s+(?<aux>did\s+(?:not|never)\s+)?(?:send|sent)\s+(?:an?\s+|the\s+)?(?:message|email)(?:\s+to\s+(?:the\s+)?customer)?\b/giu,
  /\b(?:and|but|or)\s+(?<aux>(?:(?:did|has|have|had|will)\s+(?:(?:not|never)\s+)?)?)(?:contact(?:ed)?|email(?:ed)?|call(?:ed)?)\s+(?:the\s+)?customer\b/giu,
  /\b(?:the\s+)?customer\s+(?<aux>(?:may|might|could|can|must|should)\s+(?:(?:not|never)\s+)?(?:have\s+)?(?:been\s+)?)?(?:contacted|emailed|called)\b/giu,
  /\b(?:we|i|the claw|the agent)\s+(?<aux>(?:may|might|could|can|must|should)\s+(?:(?:not|never)\s+)?(?:have\s+)?)(?:contacted|emailed|called)\s+(?:the\s+)?customer\b/giu,
  /\b(?:\p{Lu}[\p{L}'-]*|(?:the\s+)?(?:account manager|implementation lead|support|success manager|customer success manager|renewal owner))\s+(?<aux>(?:(?:did|has|have|had|will)\s+(?:(?:not|never)\s+)?)?)(?:send|sent)\s+(?:an?\s+|the\s+)?(?:message|email)\b/gu,
  /\b(?:and|but)\s+(?<aux>(?:(?:has|have|had)\s+(?:(?:not|never)\s+)?been|(?:was|were|is|are)\s+(?:(?:not|never)\s+)?(?:being\s+)?))\s*(?:contacted|emailed|called)\b/giu,
  /\b(?:and|but)\s+(?<aux>did\s+(?:not|never)\s+)?(?:receive|received)\s+(?:an?\s+|the\s+)?(?:email|message|call)\b/giu,
  /\b(?:tenant|workload|account|service|support case)\s+(?<aux>(?:(?:has|have|had)\s+(?:(?:not|never)\s+)?been|(?:was|were|is|are)\s+(?:(?:not|never)\s+)?(?:being\s+)?))\s*(?:changed|updated|configured|closed|modified)\b/giu,
  /\b(?:tenant|workload|account|service|support case|pricing|contract)\s+(?<aux>(?:may|might|could|can|must|should)\s+(?:(?:not|never)\s+)?(?:have\s+)?(?:been\s+)?)(?:changed|updated|configured|closed|modified)\b/giu,
  /\b(?:tenant|workload|account|service|support case)\s+(?<aux>(?:(?:has|have|had)\s+(?:(?:not|never)\s+)?|(?:was|were|is|are)\s+(?:(?:not|never)\s+)?))(?:(?:already|successfully|recently|now|previously)\s+)+(?:been\s+|being\s+)?(?:changed|updated|configured|closed|modified)\b/giu,
  /\b(?:we|i|the claw|the agent)\s+(?<aux>(?:(?:did|has|have|had|will)\s+(?:(?:not|never)\s+)?)?)(?:change|changed|update|updated|configure|configured|close|closed|modify|modified)\s+(?:the\s+)?(?:tenant|workload|account|service|support case|pricing|contract)\b/giu,
  /\b(?:we|i|the claw|the agent)\s+(?<aux>(?:(?:did|has|have|had|will)\s+(?:(?:not|never)\s+)?)?)(?:(?:already|successfully|now|previously)\s+)+(?:change|changed|update|updated|configure|configured|close|closed|modify|modified)\s+(?:the\s+)?(?:tenant|workload|account|service|support case|pricing|contract)\b/giu,
  /\b(?:and|but|or)\s+(?<aux>(?:(?:did|has|have|had|will)\s+(?:(?:not|never)\s+)?)?)(?:change|changed|update|updated|configure|configured|close|closed|modify|modified)\s+(?:the\s+)?(?:tenant|workload|account|service|support case|pricing|contract)\b/giu,
  /\b(?:the\s+)?(?:account manager|implementation lead|support|success manager|customer success manager|renewal owner)\s+(?<aux>(?:(?:did|has|have|had|will)\s+(?:(?:not|never)\s+)?)?)(?:change|changed|update|updated|configure|configured|close|closed|modify|modified)\s+(?:the\s+)?(?:tenant|workload|account|service|support case|pricing|contract)\b/giu,
  /\b(?:\p{Lu}[\p{L}'-]*|(?:the\s+)?(?:account manager|support|success manager|customer success manager|renewal owner))\s+(?<aux>(?:(?:did|has|have|had|will)\s+(?:(?:not|never)\s+)?)?)(?:change|changed|update|updated|configure|configured|close|closed|modify|modified)\s+(?:the\s+)?(?:tenant|workload|account|service|support case|pricing|contract)\b/gu,
  /\b(?:we|i|the claw|the agent)\s+(?<aux>(?:(?:did|has|have|had|will)\s+(?:(?:not|never)\s+)?)?)(?:make|made)\s+(?:a\s+)?commercial promise\b/giu,
  /\b\p{Lu}[\p{L}'-]*\s+(?<aux>did\s+(?:not|never)\s+)?(?:make|made)\s+(?:a\s+)?commercial promise\b/gu,
  /\b(?:commercial promise|pricing|contract)\s+(?<aux>(?:(?:has|have|had)\s+(?:(?:not|never)\s+)?been|(?:was|were|is|are)\s+(?:(?:not|never)\s+)?(?:being\s+)?))\s*(?:made|changed)\b/giu,
  /\brenewal\s+(?<aux>(?:(?:has|have|had)\s+(?:(?:not|never)\s+)?been|(?:was|were|is|are)\s+(?:(?:not|never)\s+)?(?:being\s+)?))\s*(?:committed|approved|completed|signed)\b/giu,
  /\brenewal\s+(?<aux>(?:may|might|could|can|must|should)\s+(?:(?:not|never)\s+)?(?:have\s+)?(?:been\s+)?)(?:committed|approved|completed|signed)\b/giu,
  /\brenewal\s+(?<aux>(?:(?:has|have|had)\s+(?:(?:not|never)\s+)?|(?:was|were|is|are)\s+(?:(?:not|never)\s+)?))(?:(?:already|successfully|now|previously)\s+)+(?:been\s+|being\s+)?(?:committed|approved|completed|signed)\b/giu,
  /\b(?:we|i|the claw|the agent)\s+(?<aux>(?:(?:did|has|have|had|will)\s+(?:(?:not|never)\s+)?)?)(?:commit(?:ted)?\s+(?:the\s+)?renewal|renew(?:ed)?|sign(?:ed)?\s+(?:the\s+)?renewal)\b/giu,
  /\b(?:and|but)\s+(?<aux>(?:(?:did|has|have|had|will)\s+(?:(?:not|never)\s+)?)?)(?:commit(?:ted)?\s+(?:the\s+)?renewal|renew(?:ed)?|sign(?:ed)?\s+(?:the\s+)?renewal)\b/giu,
  /\b(?:and|but)\s+(?<aux>(?:(?:has|have|had)\s+(?:(?:not|never)\s+)?been|(?:was|were|is|are)\s+(?:(?:not|never)\s+)?))\s*(?:committed|approved|completed|signed)\b/giu,
  /\b(?:\p{Lu}[\p{L}'-]*|(?:the\s+)?(?:account manager|support|success manager|customer success manager|renewal owner))\s+(?<aux>(?:(?:did|has|have|had|will)\s+(?:(?:not|never)\s+)?)?)(?:commit(?:ted)?\s+(?:the\s+)?renewal|renew(?:ed)?|sign(?:ed)?\s+(?:the\s+)?renewal)\b/gu,
  /\brisk\s+(?<aux>(?:(?:has|have|had)\s+(?:(?:not|never)\s+)?been|(?:was|were|is|are)\s+(?:(?:not|never)\s+)?(?:being\s+)?))\s*accepted\b/giu,
  /\brisk\s+(?<aux>(?:may|might|could|can|must|should)\s+(?:(?:not|never)\s+)?(?:have\s+)?(?:been\s+)?)accepted\b/giu,
  /\b(?:we|i|the claw|the agent)\s+(?<aux>(?:(?:did|has|have|had|will)\s+(?:(?:not|never)\s+)?)?)accept(?:ed)?\s+risk\b/giu,
  /\b(?:and|but)\s+(?<aux>(?:(?:did|has|have|had|will)\s+(?:(?:not|never)\s+)?)?)accept(?:ed)?\s+risk\b/giu,
  /\b(?:\p{Lu}[\p{L}'-]*|(?:the\s+)?(?:account manager|support|success manager|customer success manager|renewal owner))\s+(?<aux>(?:(?:did|has|have|had|will)\s+(?:(?:not|never)\s+)?)?)accept(?:ed)?\s+risk\b/gu,
  /\bcustomer success\s+(?<aux>(?:(?:has|have|had)\s+(?:(?:not|never)\s+)?been|(?:was|were|is|are)\s+(?:(?:not|never)\s+)?(?:being\s+)?))\s*(?:achieved|confirmed|claimed)\b/giu,
  /\bcustomer success\s+(?<aux>(?:may|might|could|can|must|should)\s+(?:(?:not|never)\s+)?(?:have\s+)?(?:been\s+)?)(?:achieved|confirmed|claimed)\b/giu,
  /\bcustomer success\s+(?<aux>(?:(?:has|have|had)\s+(?:(?:not|never)\s+)?|(?:was|were|is|are)\s+(?:(?:not|never)\s+)?))(?:(?:already|successfully|now|previously)\s+)+(?:been\s+|being\s+)?(?:achieved|confirmed|claimed)\b/giu,
  /\b(?:we|i|the claw|the agent)\s+(?<aux>(?:(?:did|has|have|had|will)\s+(?:(?:not|never)\s+)?)?)(?:achieve|achieved|confirm|confirmed|claim|claimed)\s+customer success\b/giu,
  /\b(?:and|but)\s+(?<aux>(?:(?:did|has|have|had|will)\s+(?:(?:not|never)\s+)?)?)(?:achieve|achieved|confirm|confirmed|claim|claimed)\s+customer success\b/giu,
  /\b(?:\p{Lu}[\p{L}'-]*|(?:the\s+)?(?:account manager|support|success manager|customer success manager|renewal owner))\s+(?<aux>(?:(?:did|has|have|had|will)\s+(?:(?:not|never)\s+)?)?)(?:achieve|achieved|confirm|confirmed|claim|claimed)\s+customer success\b/gu,
  /\b(?:and|but)\s+(?<aux>(?:(?:has|have|had)\s+(?:(?:not|never)\s+)?been|(?:was|were|is|are)\s+(?:(?:not|never)\s+)?))\s*(?:achieved|confirmed|claimed)\b/giu,
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function predicateIsAffirmative(match, text) {
  if (
    match.groups?.negated ||
    match.groups?.pending ||
    /\b(?:not|never)\b/iu.test(match.groups?.aux ?? "")
  ) {
    return false;
  }
  const before = text.slice(Math.max(0, match.index - 64), match.index);
  if (
    /\bno\s+$/iu.test(before) ||
    /\bneither\b[^.!?;]{0,40}\bnor\s+$/iu.test(before) ||
    /\bit is not true that\s+(?:the\s+)?$/iu.test(before)
  ) {
    return false;
  }
  if (
    /\b(?:pending confirmation whether|remains? unconfirmed whether|is not confirmed that)\s+(?:the\s+)?$/iu.test(
      before,
    )
  ) {
    return false;
  }
  const after = text.slice(match.index + match[0].length, match.index + match[0].length + 32);
  return !/^\s+(?:is|remains)\s+(?:still\s+)?pending\b/iu.test(after);
}

function hasUnauthorizedClaim(text, review) {
  const customerIdentities = [review?.customer?.name, review?.customer?.id]
    .filter((identity) => typeof identity === "string" && identity.length > 0)
    .map(escapeRegExp);
  const customer = ["(?:the\\s+)?customer", ...customerIdentities].join("|");
  const predicates = [
    new RegExp(`\\b(?:contact(?:ed)?|email(?:ed)?|call(?:ed)?|phone(?:d)?|message(?:d)?|notify|notified|reach(?:ed)? out to)\\s+(?:not only\\s+)?(?:${customer})\\b`, "iu"),
    new RegExp(`\\b(?:contacting|emailing|calling|phoning|messaging|notifying)\\s+(?:${customer})\\b`, "iu"),
    new RegExp(`\\breaching out to\\s+(?:${customer})\\b`, "iu"),
    new RegExp(`\\breach(?:ed)?\\s+(?:${customer})\\b`, "iu"),
    new RegExp(`\\bcorrespond(?:ed)? with\\s+(?:${customer})\\b`, "iu"),
    new RegExp(`\\b(?:${customer})\\b[^.!?;]{0,36}\\b(?:contacted|emailed|called|phoned|messaged|notified)\\b`, "iu"),
    /^\s*(?:(?:did|was)\s+)?(?:send|sent|contacted|emailed|called|phoned|messaged|notified)\b/iu,
    /\b(?:sent|received)\s+(?:an?\s+|the\s+)?(?:email|message|call)\b/iu,
    new RegExp(`\\bsent\\s+(?:${customer})\\s+(?:an?\\s+|the\\s+)?(?:email|message)\\b`, "iu"),
    /\b(?:email|message|call)\b[^.!?;]{0,24}\b(?:sent|received)\b/iu,
    /\b(?:tenant|workload|account|service|support case|pricing|contract)\b[^.!?;]{0,36}\b(?:changed|updated|configured|closed|modified|provisioned|enabled|disabled|deactivated|resolved|amended|altered)\b/iu,
    /\b(?:change|changed|update|updated|configure|configured|close|closed|modify|modified|provision|provisioned|enable|enabled|disable|disabled|deactivate|deactivated|resolve|resolved|amend|amended|alter|altered)\s+(?:the\s+)?(?:tenant|workload|account|service|support case|pricing|contract)\b/iu,
    /\b(?:changing|updating|configuring|closing|modifying|provisioning|enabling|disabling|deactivating|resolving|amending|altering)\s+(?:the\s+)?(?:tenant|workload|account|service|support case|pricing|contract)\b/iu,
    /\b(?:tenant|workload|account|service|support case|pricing|contract)\b[^.!?;]{0,36}\b(?:reconfigured|reprovisioned)\b/iu,
    /\b(?:reconfigure|reconfigured|reprovision|reprovisioned)\s+(?:the\s+)?(?:tenant|workload|account|service|support case)\b/iu,
    /\breset\s+(?:the\s+)?(?:tenant|workload|account|service)(?:\s+configuration)?\b/iu,
    /\b(?:suspend|suspended)\s+(?:the\s+)?(?:tenant|workload|account|service)\b/iu,
    /\b(?:create|created|delete|deleted)\s+(?:the\s+|an?\s+)?(?:tenant|workload|account|service|support case)\b/iu,
    /\b(?:made|make)\s+(?:a\s+)?commercial promise\b/iu,
    /\b(?:a\s+|the\s+)?commercial promise\s+(?:was|is|has been)\s+made\b/iu,
    /\b(?:promise|promised|commit|committed|offer|offered|give|gave|guarantee|guaranteed)\b[^.!?;]{0,36}\b(?:customer\s+)?(?:discount|pricing|price|commercial terms?|contract)\b/iu,
    /\b(?:promising|committing|offering|giving|guaranteeing)\b[^.!?;]{0,36}\b(?:customer\s+)?(?:discount|pricing|price|commercial terms?|contract)\b/iu,
    /\b(?:discount|pricing|price|commercial terms?|contract)\b[^.!?;]{0,36}\b(?:promised|committed|offered|given|guaranteed)\b/iu,
    /\b(?:reduce|reduced)\s+(?:the\s+)?price\b/iu,
    /\b(?:agree|agreed)\s+to\s+(?:a\s+|the\s+)?(?:discount|pricing|price|commercial terms?)\b/iu,
    /\b(?:(?<!non-)renewal\b[^.!?;]{0,36}\b(?:committed|approved|completed|signed)|(?:commit|committed|approve|approved|complete|completed|sign|signed)\s+(?:the\s+)?(?<!non-)renewal)\b/iu,
    /\b(?:committing|approving|completing|signing)\s+(?:the\s+)?renewal\b/iu,
    /\brenew(?:ed)?\s+(?:the\s+)?(?:account|contract|subscription)\b/iu,
    /\b(?:account|contract|subscription)\s+(?:was|is|has been)\s+renewed\b/iu,
    /\b(?:agree|agreed)\s+to\s+(?:the\s+)?renewal\b|\brenewal\s+(?:was|is|has been)\s+agreed\b/iu,
    /\b(?:finalize|finalized)\s+(?:the\s+)?renewal\b/iu,
    /\brenewal\s+(?:went|goes)\s+through\b/iu,
    /\b(?:accept|accepted|approve|approved)\s+(?:the\s+)?risk\b|\brisk\b[^.!?;]{0,36}\b(?:accepted|approved)\b/iu,
    /\b(?:accepting|approving|assuming|waiving)\s+(?:the\s+)?risk\b/iu,
    /\b(?:assume|assumed)\s+(?:the\s+)?risk\b/iu,
    /\b(?:waive|waived)\s+(?:the\s+)?risk\b/iu,
    /\brisk\s+(?:was|is|has been)\s+(?:assumed|waived)\b/iu,
    /\btook on\s+(?:the\s+)?risk\b/iu,
    /\b(?:consent|consented)\s+to\s+(?:the\s+)?risk\b/iu,
    /\b(?:achieve|achieved|confirm|confirmed|claim|claimed)\s+customer success\b|\bcustomer success\b[^.!?;]{0,36}\b(?:achieved|confirmed|claimed|validated)\b/iu,
    /\b(?:achieving|confirming|claiming|validating)\s+customer success\b/iu,
    /\b(?:declare|declared)\s+(?:the\s+)?customer\s+successful\b/iu,
    /\b(?:the\s+)?customer\s+(?:is|was|has been)\s+successful\b/iu,
    /\b(?:the\s+)?customer\s+(?:met|meets)\s+(?:the\s+)?success criteria\b/iu,
    new RegExp(`\\b(?:${customer})\\b\\s+(?:is|was|has been)\\s+successful\\b`, "iu"),
    new RegExp(`\\b(?:${customer})\\b\\s+(?:met|meets)\\s+(?:the\\s+)?success criteria\\b`, "iu"),
    new RegExp(`\\b(?:declare|declared)\\s+(?:${customer})\\s+successful\\b`, "iu"),
    new RegExp(`\\b(?:${customer})\\b\\s+(?:was|is|has been)\\s+declared successful\\b`, "iu"),
    new RegExp(`\\b(?:${customer})\\b\\s+achieved success\\b`, "iu"),
    new RegExp(`\\b(?:${customer})\\b\\s+attained customer success\\b`, "iu"),
  ];
  if (
    /^\s*we did not (?:contact|email|call)(?:,\s*|\s+(?:and|or)\s+)(?:email|call|contact)(?:,\s*(?:or\s+)?(?:email|call|contact))?\s+(?:the\s+)?customer[.!]?\s*$/iu.test(
      text,
    )
  ) {
    return false;
  }
  const norScope = text.replace(/[.!?]\s*$/u, "");
  if (
    /^\s*(?:we\s+)?(?:did not|never|neither)\b[^.!?;]*\bnor\b/iu.test(text) &&
    !/[,.!?;]/u.test(norScope) &&
    !/\b(?:but|despite|although|yet|whereas|when|while|because|before|after)\b/iu.test(text)
  ) {
    return false;
  }
  if (
    /^\s*(?:we\s+)?did not\b[^.!?;]*\bor\s+(?:contact|email|call|phone|message|notify|change|update|configure|modify|commit|approve|sign|accept|waive|achieve|confirm|claim)\b/iu.test(
      text,
    ) &&
    !/[,.!?;]/u.test(norScope) &&
    !/\b(?:but|despite|although|yet|whereas|when|while|because|before|after)\b/iu.test(text)
  ) {
    return false;
  }
  if (
    /^\s*(?:the\s+)?customer\s+(?:was|is|has been)\s+(?:not|never)\s+(?:contacted|emailed|called|phoned|messaged|notified)\s+or\s+(?:contacted|emailed|called|phoned|messaged|notified)[.!]?\s*$/iu.test(
      text,
    ) ||
    /^\s*risk\s+(?:was|is|has been)\s+(?:not|never)\s+(?:accepted|approved|waived)\s+or\s+(?:accepted|approved|waived)[.!]?\s*$/iu.test(
      text,
    )
  ) {
    return false;
  }
  if (
    /^\s*(?:there is no evidence that|we cannot say that|it is false that)\s+[^.!?;]+[.!]?\s*$/iu.test(
      text,
    )
  ) {
    return false;
  }
  if (
    /^\s*(?:the\s+)?customer\s+(?:was|is|has been)\s+(?:not|never)\s+(?:contacted|emailed|called|phoned|messaged|notified)\s+nor\s+(?:was\s+)?(?<!non-)renewal\s+(?:committed|approved|completed|signed)[.!]?\s*$/iu.test(
      text,
    )
  ) {
    return false;
  }
  if (
    /^\s*(?:the\s+)?renewal\s+(?:was|is|has been)\s+(?:not|never)\s+(?:approved|committed|completed|signed)\s+or\s+(?:approved|committed|completed|signed)[.!]?\s*$/iu.test(
      text,
    )
  ) {
    return false;
  }
  let normalizedText = text.replace(/\bnon[\s‐‑‒–—-]+renewal\b/giu, "non-renewal");
  if (/\b(?:not|never)\b[^.!?;]*\bnor\b/iu.test(normalizedText)) {
    normalizedText = normalizedText.replace(/\bnor\b/giu, "and not");
  }
  const clauses = normalizedText.split(/[.!?;:]+|,\s*(?:(?:and|but|or|despite|when|while|whereas|although|yet|because|before|after)\s+)?|\s+(?:and|but|or|despite|when|while|whereas|although|yet|because|before|after)\s+/iu);
  let previousSubject = null;
  for (const clause of clauses) {
    const subject =
      /(?<!non-)\brenewal\b/iu.test(clause)
        ? "renewal"
        : /\brisk\b/iu.test(clause)
          ? "risk"
          : /\bcustomer success\b/iu.test(clause)
            ? "customer-success"
            : /\b(?:tenant|workload|account|service|support case|pricing|contract)\b/iu.test(clause)
              ? "system"
            : /\bcustomer\b/iu.test(clause)
            ? "customer"
            : null;
    const applicable = [...predicates];
    if (previousSubject === "renewal") {
      applicable.push(/^\s*(?:(?:they|it)\s+)?(?:(?:was|were|is|are|has been|have been|had been|being)\s+)?(?:committed|approved|completed|signed)\b/iu);
    } else if (previousSubject === "risk") {
      applicable.push(/^\s*(?:(?:they|it)\s+)?(?:(?:was|were|is|are|has been|have been|had been|being)\s+)?(?:accepted|approved|waived|assumed)\b/iu);
    } else if (previousSubject === "customer") {
      applicable.push(/^\s*(?:(?:they|it)\s+)?(?:(?:did|was|were|being)\s+)?(?:contact|email|call|phone|message|notify)(?:ed)?\b/iu);
    } else if (previousSubject === "customer-success") {
      applicable.push(/^\s*(?:(?:they|it)\s+)?(?:(?:was|were|is|are|has been|have been|had been|being)\s+)?(?:achieved|confirmed|claimed|validated)\b/iu);
    } else if (previousSubject === "system") {
      applicable.push(/^\s*(?:(?:they|it)\s+)?(?:(?:was|were|is|are|has been|have been|had been|being)\s+)?(?:changed|updated|configured|closed|modified|provisioned|enabled|disabled|deactivated|resolved|amended|altered)\b/iu);
    }
    for (const predicate of applicable) {
      const flags = predicate.flags.includes("g") ? predicate.flags : `${predicate.flags}g`;
      for (const match of clause.matchAll(new RegExp(predicate.source, flags))) {
      const matchedPredicate = match[0];
      const prefix = clause.slice(Math.max(0, match.index - 32), match.index);
      const suffix = clause.slice(match.index + match[0].length, match.index + match[0].length + 24);
      const negated =
        /\b(?:did|has|have|had|was|were|is|are|will|may|might|could|can|must|should)\s+(?:not|never)\s+(?:be\s+|been\s+|being\s+)?(?:contact(?:ed)?|email(?:ed)?|call(?:ed)?|phone(?:d)?|message(?:d)?|notify|notified|send|sent|receive|received|change|changed|update|updated|configure|configured|close|closed|modify|modified|commit|committed|approve|approved|complete|completed|sign|signed|accept|accepted|waive|waived|achieve|achieved|confirm|confirmed|claim|claimed)\b|n['’]t\s+(?:be\s+|been\s+|being\s+)?(?:contacted|emailed|called|phoned|messaged|notified|changed|updated|configured|closed|modified|committed|approved|completed|signed|accepted|waived|achieved|confirmed|claimed)\b/iu.test(
          matchedPredicate,
        ) ||
        /\b(?:no|not|not once)\s*$/iu.test(prefix) ||
        /\bnot once\s+(?:was|were)\s+(?:the\s+)?$/iu.test(prefix) ||
        /\bneither\b/iu.test(matchedPredicate) ||
        (/^\s*neither\b/iu.test(clause) && /\bnor\b/iu.test(matchedPredicate)) ||
        /^\s*neither\b[^.!?;]*\bnor\s*$/iu.test(prefix) ||
        /\b(?:did|has|have|had|was|were|is|are|will|may|might|could|can|must|should)\s+(?:\w+\s+){0,2}(?:not|never)\s*$/iu.test(
          prefix,
        ) ||
        /n['’]t\s*$/iu.test(prefix) ||
        /\b(?:(?:it\s+(?:is|remains)\s+)?not true that|(?:it\s+(?:is|remains)\s+)?not (?:been )?confirmed (?:that|whether)|(?:it\s+(?:is|remains)\s+)?unconfirmed whether|(?:it\s+is\s+)?pending confirmation whether)\s+(?:the\s+)?$/iu.test(
          prefix,
        ) ||
        /\b(?:pending|unconfirmed)\b/iu.test(matchedPredicate) ||
        /^\s+(?:is|remains)\s+(?:still\s+)?(?:pending|unconfirmed)\b/iu.test(suffix);
      if (!negated) return true;
      }
    }
    previousSubject = subject;
  }
  return false;
}

function renderedNarratives(value, collections, review, handoff) {
  const narratives = [
    ["review.customer.name", review.customer?.name],
    ["handoff.decisionNeeded", handoff.decisionNeeded],
    ["handoff.summary", handoff.summary],
  ];
  const add = (name, fields) => {
    for (const [index, item] of collections[name].entries()) {
      for (const field of fields) {
        narratives.push([`${name}[${index}].${field}`, item[field]]);
      }
    }
  };
  add("principals", ["role"]);
  add("workloads", ["name"]);
  add("services", ["name"]);
  add("metricDefinitions", ["name", "definition", "unit"]);
  add("risksAndBlockers", ["summary"]);
  add("actions", ["summary"]);
  add("decisions", ["result"]);
  for (const [index, milestone] of collections.milestones.entries()) {
    narratives.push([`milestones[${index}].name`, milestone.name]);
    const criteria = Array.isArray(milestone.acceptanceCriteria)
      ? milestone.acceptanceCriteria
      : [];
    for (const [criterionIndex, criterion] of criteria.entries()) {
      narratives.push(
        [`milestones[${index}].acceptanceCriteria[${criterionIndex}].description`, criterion.description],
      );
    }
  }
  return narratives.filter(([, text]) => typeof text === "string");
}

export function customerSuccessReviewFindings(value, options = {}) {
  const findings = [];
  if (!isRecord(value)) {
    return [finding("invalid_artifact", "$", "The customer success review must be an object.")];
  }
  if (value.schemaVersion !== CUSTOMER_SUCCESS_REVIEW_SCHEMA_VERSION) {
    findings.push(
      finding("invalid_schema_version", "schemaVersion", "The schema version is not supported."),
    );
  }

  const review = isRecord(value.review) ? value.review : {};
  const expected = expectedBinding(review);
  if (
    review?.tenant?.customerRef !== review?.customer?.id ||
    review?.account?.customerRef !== review?.customer?.id ||
    review?.account?.tenantRef !== review?.tenant?.id ||
    review?.plan?.customerRef !== review?.customer?.id ||
    review?.plan?.tenantRef !== review?.tenant?.id ||
    review?.plan?.accountRef !== review?.account?.id
  ) {
    findings.push(
      finding(
        "invalid_review_scope",
        "review",
        "Customer, tenant, account, and plan identities must form one exact scope.",
      ),
    );
  }

  const collections = {};
  for (const name of [
    "principals",
    "workloads",
    "services",
    "sources",
    "metricDefinitions",
    "metricObservations",
    "serviceHealthObservations",
    "milestones",
    "milestoneReceipts",
    "risksAndBlockers",
    "actions",
    "actionReceipts",
    "decisions",
  ]) {
    collections[name] = rows(value[name], name, findings);
  }

  const principals = idMap(collections.principals, "principals", findings);
  const workloads = idMap(collections.workloads, "workloads", findings);
  const services = idMap(collections.services, "services", findings);
  const sources = idMap(collections.sources, "sources", findings);
  const metricDefinitions = idMap(collections.metricDefinitions, "metricDefinitions", findings);
  const metricObservations = idMap(collections.metricObservations, "metricObservations", findings);
  idMap(collections.serviceHealthObservations, "serviceHealthObservations", findings);
  const milestones = idMap(collections.milestones, "milestones", findings);
  const milestoneReceipts = idMap(collections.milestoneReceipts, "milestoneReceipts", findings);
  const risks = idMap(collections.risksAndBlockers, "risksAndBlockers", findings);
  const actions = idMap(collections.actions, "actions", findings);
  const actionReceipts = idMap(collections.actionReceipts, "actionReceipts", findings);
  const decisions = idMap(collections.decisions, "decisions", findings);

  requireHumanRef(review.ownerRef, principals, "review.ownerRef", findings);
  requireHumanRef(review.plan?.approvedByRef, principals, "review.plan.approvedByRef", findings);
  const approvalDecision = decisions.get(review.approvalDecisionRef);
  if (
    !approvalDecision ||
    approvalDecision.kind !== "plan-approval" ||
    approvalDecision.madeByRef !== review.plan?.approvedByRef ||
    approvalDecision.madeAt !== review.plan?.approvedAt ||
    !bindingMatches(approvalDecision.binding, expected) ||
    !collections.sources.some(
      (source) =>
        source.kind === "approved-plan" &&
        approvalDecision.evidenceRefs?.includes(source.id) &&
        bindingMatches(source.binding, expected) &&
        hasValidApprovedPlanSignature(source, review.plan, options),
    ) ||
    !collections.metricDefinitions.every((definition) =>
      approvalDecision.evidenceRefs?.includes(definition.approvedPlanSourceRef),
    )
  ) {
    findings.push(
      finding(
        "invalid_plan_approval",
        "review.approvalDecisionRef",
        "The exact plan revision must have a matching human approval decision and controlled source.",
      ),
    );
  }

  for (const [index, service] of collections.services.entries()) {
    requireBinding(service, expected, `services[${index}]`, findings);
  }
  for (const [index, workload] of collections.workloads.entries()) {
    requireBinding(workload, expected, `workloads[${index}]`, findings);
    requireRef(workload.serviceRef, services, `workloads[${index}].serviceRef`, "Service", findings);
  }

  const trustedAsOf = TIMESTAMP_PATTERN.test(options.asOf ?? "")
    ? timestamp(options.asOf)
    : null;
  if (trustedAsOf === null) {
    findings.push(
      finding(
        "invalid_validation_context",
        "$",
        "A caller-supplied exact RFC 3339 asOf is required.",
      ),
    );
  }
  const asOf = timestamp(review.asOf);
  const periodStart = timestamp(review.periodStart);
  const periodEnd = timestamp(review.periodEnd);
  const approvedAt = timestamp(review.plan?.approvedAt);
  if (
    asOf === null ||
    periodStart === null ||
    periodEnd === null ||
    approvedAt === null ||
    periodStart > periodEnd ||
    periodEnd > asOf ||
    approvedAt > asOf ||
    trustedAsOf === null ||
    asOf > trustedAsOf
  ) {
    findings.push(
      finding(
        "invalid_review_chronology",
        "review",
        "The review period, plan approval, and trusted as-of timestamp must be coherent.",
      ),
    );
  }

  for (const [index, source] of collections.sources.entries()) {
    requireBinding(source, expected, `sources[${index}]`, findings);
    requireRef(source.suppliedByRef, principals, `sources[${index}].suppliedByRef`, "Principal", findings);
    if (source.workloadRef !== null) {
      requireRef(source.workloadRef, workloads, `sources[${index}].workloadRef`, "Workload", findings);
    }
    if (source.serviceRef !== null) {
      requireRef(source.serviceRef, services, `sources[${index}].serviceRef`, "Service", findings);
    }
    if (
      (source.workloadRef === null) !== (source.serviceRef === null) ||
      (source.workloadRef !== null &&
        workloads.get(source.workloadRef)?.serviceRef !== source.serviceRef)
    ) {
      findings.push(
        finding(
          "invalid_source_identity",
          `sources[${index}]`,
          "A scoped source must identify a matching workload and service pair.",
        ),
      );
    }
    const collectedAt = timestamp(source.collectedAt);
    if (collectedAt === null || (asOf !== null && collectedAt > asOf)) {
      findings.push(
        finding("invalid_source_timestamp", `sources[${index}].collectedAt`, "Source time exceeds the review as-of."),
      );
    }
  }

  const authoritativeMetricDefinitions = new Set();
  for (const [index, definition] of collections.metricDefinitions.entries()) {
    requireBinding(definition, expected, `metricDefinitions[${index}]`, findings);
    const source = sources.get(definition.sourceRef);
    const approvedPlanSource = sources.get(definition.approvedPlanSourceRef);
    if (
      !workloads.has(definition.workloadRef) ||
      workloads.get(definition.workloadRef)?.serviceRef !== definition.serviceRef ||
      !services.has(definition.serviceRef) ||
      !source ||
      source.kind !== "adoption-export" ||
      source.workloadRef !== definition.workloadRef ||
      source.serviceRef !== definition.serviceRef
    ) {
      findings.push(
        finding(
          "invalid_metric_definition",
          `metricDefinitions[${index}]`,
          "Metric definitions must bind a valid workload, service, and adoption source.",
        ),
      );
    }
    const expectedDigest = customerSuccessMetricDefinitionDigest(definition, source);
    if (
      !approvedPlanSource ||
      approvedPlanSource.kind !== "approved-plan" ||
      !bindingMatches(approvedPlanSource.binding, expected) ||
      !Array.isArray(approvedPlanSource.verifiedContentDigests) ||
      !hasValidApprovedPlanSignature(approvedPlanSource, review.plan, options) ||
      !approvedPlanSource.verifiedContentDigests.includes(definition.definitionDigest) ||
      trustedMetricDigest(review.plan, definition, options) !== definition.definitionDigest ||
      definition.definitionDigest !== expectedDigest ||
      definition.windowStart !== review.periodStart ||
      definition.windowEnd !== review.periodEnd
    ) {
      findings.push(
        finding(
          "invalid_authoritative_metric_definition",
          `metricDefinitions[${index}]`,
          "Metric semantics and window must match a verified content digest from the exact approved-plan evidence.",
        ),
      );
    } else {
      authoritativeMetricDefinitions.add(definition.id);
    }
    if (
      (definition.direction === "informational") !== (definition.target === null) ||
      (definition.target !== null && !Number.isFinite(definition.target))
    ) {
      findings.push(
        finding(
          "invalid_metric_target",
          `metricDefinitions[${index}].target`,
          "Only informational metrics may omit a finite target.",
        ),
      );
    }
  }

  for (const [index, observation] of collections.metricObservations.entries()) {
    requireBinding(observation, expected, `metricObservations[${index}]`, findings);
    const definition = metricDefinitions.get(observation.metricRef);
    const source = sources.get(observation.sourceRef);
    if (
      !definition ||
      !authoritativeMetricDefinitions.has(definition.id) ||
      definition.workloadRef !== observation.workloadRef ||
      definition.serviceRef !== observation.serviceRef ||
      definition.sourceRef !== observation.sourceRef ||
      !source ||
      source.workloadRef !== observation.workloadRef ||
      source.serviceRef !== observation.serviceRef
    ) {
      findings.push(
        finding(
          "invalid_metric_observation_binding",
          `metricObservations[${index}]`,
          "Observations must use their metric's exact workload, service, and source.",
        ),
      );
    }
    const start = timestamp(observation.windowStart);
    const end = timestamp(observation.windowEnd);
    const observedAt = timestamp(observation.observedAt);
    if (
      start !== periodStart ||
      end !== periodEnd ||
      observedAt === null ||
      end === null ||
      observedAt < end ||
      (asOf !== null && observedAt > asOf)
    ) {
      findings.push(
        finding(
          "invalid_metric_window",
          `metricObservations[${index}]`,
          "Metric observations must preserve the exact review window and observation time.",
        ),
      );
    }
    const collectedAt = timestamp(source?.collectedAt);
    if (
      source &&
      (collectedAt === null ||
        end === null ||
        observedAt === null ||
        collectedAt < end ||
        collectedAt < observedAt)
    ) {
      findings.push(
        finding(
          "invalid_observation_source_chronology",
          `metricObservations[${index}].sourceRef`,
          "Adoption source collection must be at or after the window end and observation time.",
        ),
      );
    }
    if (observation.status !== expectedMetricStatus(definition, observation.value)) {
      findings.push(
        finding(
          "invalid_metric_status",
          `metricObservations[${index}].status`,
          "Metric status must derive from the approved definition, direction, target, and value.",
        ),
      );
    }
  }

  for (const [index, observation] of collections.serviceHealthObservations.entries()) {
    requireBinding(observation, expected, `serviceHealthObservations[${index}]`, findings);
    const source = sources.get(observation.sourceRef);
    if (
      !workloads.has(observation.workloadRef) ||
      workloads.get(observation.workloadRef)?.serviceRef !== observation.serviceRef ||
      !services.has(observation.serviceRef) ||
      !source ||
      source.kind !== "service-health" ||
      source.workloadRef !== observation.workloadRef ||
      source.serviceRef !== observation.serviceRef
    ) {
      findings.push(
        finding(
          "invalid_service_health_binding",
          `serviceHealthObservations[${index}]`,
          "Service health must bind the exact workload, service, and approved health source.",
        ),
      );
    }
    const start = timestamp(observation.windowStart);
    const end = timestamp(observation.windowEnd);
    const observedAt = timestamp(observation.observedAt);
    if (
      start !== periodStart ||
      end !== periodEnd ||
      observedAt === null ||
      end === null ||
      observedAt < end ||
      (asOf !== null && observedAt > asOf)
    ) {
      findings.push(
        finding(
          "invalid_service_health_window",
          `serviceHealthObservations[${index}]`,
          "Service-health evidence must preserve the exact review window and observation time.",
        ),
      );
    }
    const collectedAt = timestamp(source?.collectedAt);
    if (
      source &&
      (collectedAt === null ||
        end === null ||
        observedAt === null ||
        collectedAt < end ||
        collectedAt < observedAt)
    ) {
      findings.push(
        finding(
          "invalid_observation_source_chronology",
          `serviceHealthObservations[${index}].sourceRef`,
          "Service-health source collection must be at or after the window end and observation time.",
        ),
      );
    }
    if ((observation.status === "healthy") !== (observation.incidentRef === null)) {
      findings.push(
        finding(
          "invalid_service_health_status",
          `serviceHealthObservations[${index}]`,
          "Healthy observations cannot cite an incident; non-healthy observations must cite one.",
        ),
      );
    }
  }

  const allCriterionIds = new Set();
  for (const [index, milestone] of collections.milestones.entries()) {
    requireBinding(milestone, expected, `milestones[${index}]`, findings);
    requireWorkloadServiceScope(
      milestone,
      workloads,
      services,
      `milestones[${index}]`,
      findings,
    );
    requireHumanRef(milestone.ownerRef, principals, `milestones[${index}].ownerRef`, findings);
    const criteria = rows(milestone.acceptanceCriteria, `milestones[${index}].acceptanceCriteria`, findings);
    for (const [criterionIndex, criterion] of criteria.entries()) {
      if (allCriterionIds.has(criterion.id)) {
        findings.push(
          finding(
            "duplicate_acceptance_criterion",
            `milestones[${index}].acceptanceCriteria[${criterionIndex}].id`,
            "Acceptance criterion ids must be unique across the review.",
          ),
        );
      }
      allCriterionIds.add(criterion.id);
      const evidence = sources.get(criterion.evidenceRef);
      if (!evidence || !sourceMatchesScope(evidence, milestone)) {
        findings.push(
          finding(
            "invalid_milestone_criterion_evidence",
            `milestones[${index}].acceptanceCriteria[${criterionIndex}].evidenceRef`,
            "Acceptance criteria must cite source evidence for the milestone's exact workload and service.",
          ),
        );
      }
      if (criterion.metricRef !== null) {
        const definition = metricDefinitions.get(criterion.metricRef);
        const observation = metricObservations.get(criterion.observationRef);
        if (
          !definition ||
          !observation ||
          definition.workloadRef !== milestone.workloadRef ||
          definition.serviceRef !== milestone.serviceRef ||
          observation.metricRef !== definition.id ||
          observation.workloadRef !== milestone.workloadRef ||
          observation.serviceRef !== milestone.serviceRef ||
          observation.sourceRef !== criterion.evidenceRef ||
          criterionTargetConflicts(
            criterion.description,
            definition,
            [...metricDefinitions.values()],
          ) ||
          observation.windowStart !== review.periodStart ||
          observation.windowEnd !== review.periodEnd ||
          (milestone.state === "accepted" &&
            (observation.status !== "on-target" ||
              expectedMetricStatus(definition, observation.value) !== "on-target"))
        ) {
          findings.push(
            finding(
              "invalid_metric_acceptance_criterion",
              `milestones[${index}].acceptanceCriteria[${criterionIndex}]`,
              "A metric-backed criterion must cite its exact scoped observation and evidence; accepted criteria require an on-target value under the immutable definition and target in the review window.",
            ),
          );
        }
      } else if (criterion.observationRef !== null) {
        findings.push(
          finding(
            "invalid_metric_acceptance_criterion",
            `milestones[${index}].acceptanceCriteria[${criterionIndex}].observationRef`,
            "Only a metric-backed criterion may cite a metric observation.",
          ),
        );
      } else if (
        [...metricDefinitions.values()].some(
          (definition) =>
            criterion.description.includes(definition.name) &&
            (targetClaimMatches(criterion.description).length > 0 ||
              /\bapproved target\b/iu.test(criterion.description)),
        )
      ) {
        findings.push(
          finding(
            "invalid_metric_acceptance_criterion",
            `milestones[${index}].acceptanceCriteria[${criterionIndex}]`,
            "A target-bearing criterion must bind the authoritative metric and observation.",
          ),
        );
      }
    }
    const receipts = collections.milestoneReceipts.filter((receipt) => receipt.milestoneRef === milestone.id);
    if (milestone.state === "accepted") {
      if (
        receipts.length !== criteria.length ||
        !sameSet(
          milestone.receiptRefs,
          receipts.map((receipt) => receipt.id),
        ) ||
        !criteria.every(
          (criterion) =>
            receipts.filter((receipt) => receipt.criterionRef === criterion.id).length === 1,
        )
      ) {
        findings.push(
          finding(
            "incomplete_milestone_acceptance",
            `milestones[${index}]`,
            "Accepted milestones require exactly one receipt for every acceptance criterion.",
          ),
        );
      }
    } else if (receipts.length > 0 || !sameSet(milestone.receiptRefs, [])) {
      findings.push(
        finding(
          "premature_milestone_acceptance",
          `milestones[${index}]`,
          "Only an accepted milestone may carry acceptance receipts.",
        ),
      );
    }
  }

  for (const [index, receipt] of collections.milestoneReceipts.entries()) {
    requireBinding(receipt, expected, `milestoneReceipts[${index}]`, findings);
    requireWorkloadServiceScope(
      receipt,
      workloads,
      services,
      `milestoneReceipts[${index}]`,
      findings,
    );
    const milestone = milestones.get(receipt.milestoneRef);
    const source = sources.get(receipt.sourceRef);
    const decision = decisions.get(receipt.decisionRef);
    const criterion = Array.isArray(milestone?.acceptanceCriteria)
      ? milestone.acceptanceCriteria.find((candidate) => candidate?.id === receipt.criterionRef)
      : undefined;
    if (
      !milestone ||
      receipt.workloadRef !== milestone.workloadRef ||
      receipt.serviceRef !== milestone.serviceRef ||
      !criterion ||
      !source ||
      source.kind !== "milestone-acceptance" ||
      !sourceMatchesScope(source, receipt) ||
      !decision ||
      decision.kind !== "milestone-acceptance" ||
      decision.madeByRef !== receipt.acceptedByRef ||
      decision.madeAt !== receipt.acceptedAt ||
      !decision.evidenceRefs?.includes(receipt.sourceRef) ||
      !decision.evidenceRefs?.includes(criterion.evidenceRef)
    ) {
      findings.push(
        finding(
          "invalid_milestone_receipt",
          `milestoneReceipts[${index}]`,
          "Milestone receipts must resolve one criterion, controlled source, and matching decision.",
        ),
      );
    }
    requireHumanRef(
      receipt.acceptedByRef,
      principals,
      `milestoneReceipts[${index}].acceptedByRef`,
      findings,
    );
  }

  for (const [index, action] of collections.actions.entries()) {
    requireBinding(action, expected, `actions[${index}]`, findings);
    requireWorkloadServiceScope(action, workloads, services, `actions[${index}]`, findings);
    requireHumanRef(action.ownerRef, principals, `actions[${index}].ownerRef`, findings);
    requireEvidenceRefs(action.evidenceRefs, sources, `actions[${index}].evidenceRefs`, findings);
    if (
      (action.evidenceRefs ?? []).some(
        (sourceRef) => !sourceMatchesScope(sources.get(sourceRef), action),
      )
    ) {
      findings.push(
        finding(
          "invalid_action_evidence_scope",
          `actions[${index}].evidenceRefs`,
          "Action evidence must match the action's exact workload and service.",
        ),
      );
    }
    const receipts = collections.actionReceipts.filter((receipt) => receipt.actionRef === action.id);
    if (
      action.status === "complete" &&
      (receipts.length === 0 ||
        receipts.some((receipt) => receipt.outcome !== "completed") ||
        !sameSet(
          action.receiptRefs,
          receipts.map((receipt) => receipt.id),
        ))
    ) {
      findings.push(
        finding(
          "incomplete_action_receipt",
          `actions[${index}]`,
          "Completed actions require matching completed receipts.",
        ),
      );
    }
    if (action.status !== "complete" && (receipts.length > 0 || !sameSet(action.receiptRefs, []))) {
      findings.push(
        finding(
          "premature_action_completion",
          `actions[${index}]`,
          "Open, blocked, or in-progress actions cannot carry completion receipts.",
        ),
      );
    }
  }

  for (const [index, receipt] of collections.actionReceipts.entries()) {
    requireBinding(receipt, expected, `actionReceipts[${index}]`, findings);
    requireWorkloadServiceScope(
      receipt,
      workloads,
      services,
      `actionReceipts[${index}]`,
      findings,
    );
    const source = sources.get(receipt.sourceRef);
    const action = actions.get(receipt.actionRef);
    if (
      !action ||
      receipt.workloadRef !== action.workloadRef ||
      receipt.serviceRef !== action.serviceRef ||
      !source ||
      source.kind !== "action-receipt" ||
      !sourceMatchesScope(source, receipt) ||
      source.collectedAt !== receipt.recordedAt
    ) {
      findings.push(
        finding(
          "invalid_action_receipt",
          `actionReceipts[${index}]`,
          "Action receipts must resolve an action and exact controlled receipt source.",
        ),
      );
    }
    requireHumanRef(
      receipt.recordedByRef,
      principals,
      `actionReceipts[${index}].recordedByRef`,
      findings,
    );
  }

  for (const [index, risk] of collections.risksAndBlockers.entries()) {
    requireBinding(risk, expected, `risksAndBlockers[${index}]`, findings);
    requireHumanRef(risk.ownerRef, principals, `risksAndBlockers[${index}].ownerRef`, findings);
    requireEvidenceRefs(
      risk.evidenceRefs,
      sources,
      `risksAndBlockers[${index}].evidenceRefs`,
      findings,
    );
    for (const [refIndex, ref] of (risk.actionRefs ?? []).entries()) {
      requireRef(ref, actions, `risksAndBlockers[${index}].actionRefs[${refIndex}]`, "Action", findings);
    }
    if (
      risk.status === "closed" &&
      (risk.actionRefs ?? []).some((ref) => actions.get(ref)?.status !== "complete")
    ) {
      findings.push(
        finding(
          "premature_risk_closure",
          `risksAndBlockers[${index}].status`,
          "A risk or blocker cannot close before all linked actions have receipts.",
        ),
      );
    }
  }

  for (const [index, decision] of collections.decisions.entries()) {
    requireBinding(decision, expected, `decisions[${index}]`, findings);
    requireHumanRef(decision.madeByRef, principals, `decisions[${index}].madeByRef`, findings);
    requireEvidenceRefs(decision.evidenceRefs, sources, `decisions[${index}].evidenceRefs`, findings);
    const madeAt = timestamp(decision.madeAt);
    if (madeAt === null || (asOf !== null && madeAt > asOf)) {
      findings.push(
        finding(
          "invalid_decision_timestamp",
          `decisions[${index}].madeAt`,
          "Decisions must have a parseable timestamp no later than the trusted as-of.",
        ),
      );
    }
  }

  const cadence = isRecord(value.cadence) ? value.cadence : {};
  requireBinding(cadence, expected, "cadence", findings);
  requireHumanRef(cadence.ownerRef, principals, "cadence.ownerRef", findings);
  const priorReviewAt = timestamp(cadence.priorReviewAt);
  const nextReviewAt = timestamp(cadence.nextReviewAt);
  if (
    priorReviewAt === null ||
    nextReviewAt === null ||
    asOf === null ||
    priorReviewAt >= asOf ||
    nextReviewAt <= asOf
  ) {
    findings.push(
      finding(
        "invalid_review_cadence",
        "cadence",
        "The prior review must precede the as-of and the next review must follow it.",
      ),
    );
  }

  const handoff = isRecord(value.handoff) ? value.handoff : {};
  requireBinding(handoff, expected, "handoff", findings);
  requireHumanRef(handoff.ownerRef, principals, "handoff.ownerRef", findings);
  requireHumanRef(handoff.renewal?.ownerRef, principals, "handoff.renewal.ownerRef", findings);
  requireHumanRef(handoff.escalation?.ownerRef, principals, "handoff.escalation.ownerRef", findings);
  requireEvidenceRefs(
    handoff.renewal?.evidenceRefs,
    sources,
    "handoff.renewal.evidenceRefs",
    findings,
    { allowEmpty: handoff.renewal?.state === "not-assessed" },
  );
  const activeMaterialRisks = collections.risksAndBlockers
    .filter(
      (risk) =>
        risk.status !== "closed" && ["high", "critical"].includes(risk.severity),
    )
    .map((risk) => risk.id);
  if (
    handoff.escalation?.state === "owner-review-required" &&
    !sameSet(handoff.escalation.riskRefs, activeMaterialRisks)
  ) {
    findings.push(
      finding(
        "invalid_escalation_handoff",
        "handoff.escalation.riskRefs",
        "Escalation review must identify every active high or critical risk exactly once.",
      ),
    );
  } else if (
    handoff.escalation?.state === "not-required" &&
    (!sameSet(handoff.escalation.riskRefs, []) || activeMaterialRisks.length > 0)
  ) {
    findings.push(
      finding(
        "invalid_escalation_handoff",
        "handoff.escalation",
        "Escalation cannot be marked unnecessary while material risks remain.",
      ),
    );
  }
  if (handoff.generatedAt !== review.asOf || timestamp(handoff.dueAt) < asOf) {
    findings.push(
      finding(
        "invalid_handoff_timestamp",
        "handoff",
        "The handoff must be generated at the trusted as-of with a current owner due time.",
      ),
    );
  }
  if (!sameSet(handoff.prohibitedActions, REQUIRED_PROHIBITED_ACTIONS)) {
    findings.push(
      finding(
        "missing_authority_gate",
        "handoff.prohibitedActions",
        "The handoff must preserve every customer, system, support, commercial, renewal, risk, and success authority prohibition.",
      ),
    );
  }

  const shouldBeBlocked =
    findings.some((item) =>
      [
        "cross_scope_or_revision_binding",
        "invalid_metric_observation_binding",
        "invalid_authoritative_metric_definition",
        "invalid_metric_window",
        "invalid_observation_source_chronology",
        "invalid_service_health_binding",
        "invalid_service_health_window",
        "invalid_workload_service_scope",
        "invalid_milestone_criterion_evidence",
        "invalid_metric_acceptance_criterion",
        "invalid_action_evidence_scope",
        "incomplete_milestone_acceptance",
        "incomplete_action_receipt",
        "invalid_plan_approval",
      ].includes(item.code),
    ) ||
    collections.metricObservations.some(
      (item) =>
        metricDefinitions.get(item.metricRef)?.direction !== "informational" &&
        item.status !== "on-target",
    ) ||
    collections.serviceHealthObservations.some((item) => item.status !== "healthy") ||
    collections.milestones.some((item) => item.state !== "accepted") ||
    collections.risksAndBlockers.some((item) => item.status !== "closed") ||
    collections.actions.some((item) => item.status !== "complete");
  const expectedState = shouldBeBlocked ? "blocked" : "ready-for-owner-review";
  if (review.state !== expectedState || handoff.state !== expectedState) {
    findings.push(
      finding(
        "premature_handoff_state",
        "handoff.state",
        "The review and handoff cannot be owner-ready while evidence, outcomes, risks, or actions remain unresolved.",
      ),
    );
  }

  const definitions = [...metricDefinitions.values()];
  for (const [path, text] of renderedNarratives(value, collections, review, handoff)) {
    if (hasUnauthorizedClaim(text, review)) {
      findings.push(
        finding(
          "unauthorized_outcome_claim",
          path,
          "Rendered narratives cannot claim customer contact, system or configuration mutation, commercial or renewal commitment, risk acceptance, or achieved customer success.",
        ),
      );
    }
    if (path.startsWith("metricDefinitions[")) continue;
    const mentionedDefinitions = definitions.filter(
      (definition) =>
        new RegExp(
          `(?<![\\p{L}\\p{N}])(?:${escapeRegExp(definition.name)}|${escapeRegExp(definition.id)})(?![\\p{L}\\p{N}])`,
          "iu",
        ).test(text),
    );
    if (
      mentionedDefinitions.length > 0 &&
      /\b(?:aggregation|window|definition|unit|weekly|daily|sum|average|ratio|count|measured as|lower values?|higher values?|ceiling|floor)\b/iu.test(
        text,
      )
    ) {
      findings.push(
        finding(
          "invalid_authoritative_metric_definition",
          path,
          "Rendered narratives cannot restate immutable metric semantics.",
        ),
      );
      continue;
    }
    for (const clause of text.split(/;|,\s*|\.(?=\s|$)|\s+(?:and|while|before|after)\s+(?=(?:the\s+)?[A-Z])/u)) {
      const normalizedClause = clause.toLocaleLowerCase();
      const matchedDefinitions = definitions.filter(
        (definition) =>
          (typeof definition.name === "string" &&
            new RegExp(
              `(?<![\\p{L}\\p{N}])${escapeRegExp(definition.name)}(?![\\p{L}\\p{N}])`,
              "iu",
            ).test(clause)) ||
          (typeof definition.id === "string" &&
            new RegExp(
              `(?<![\\p{L}\\p{N}])${escapeRegExp(definition.id)}(?![\\p{L}\\p{N}])`,
              "iu",
            ).test(clause)),
      );
      const longestNameLength = Math.max(
        0,
        ...matchedDefinitions.map((definition) => definition.name.length),
      );
      const namedDefinitions = matchedDefinitions.filter(
        (definition) =>
          definition.name.length === longestNameLength ||
          normalizedClause.includes(definition.id.toLocaleLowerCase()),
      );
      const canonicalCriterion =
        path.includes(".acceptanceCriteria[") &&
        namedDefinitions.length === 1 &&
        clause.trim() === `${namedDefinitions[0].name} reaches the approved target`;
      const canonicalInformational =
        namedDefinitions.length === 1 &&
        namedDefinitions[0].direction === "informational" &&
        new RegExp(
          `^${escapeRegExp(namedDefinitions[0].name)} (?:is informational|has no target)$`,
          "iu",
        ).test(clause.trim());
      if (
        namedDefinitions.length === 1 &&
        ((namedDefinitions[0].direction === "informational" &&
          /\btarget\b/iu.test(clause) &&
          !/\bhas no target\b/iu.test(clause)) ||
          (namedDefinitions[0].direction !== "informational" &&
            /\b(?:has no target|is informational)\b/iu.test(clause)))
      ) {
        findings.push(
          finding(
            "invalid_authoritative_metric_definition",
            path,
            "Rendered metric status and target language must match the immutable approved definition.",
          ),
        );
        break;
      }
      if (
        namedDefinitions.length > 0 &&
        targetClaimMatches(clause).length === 0 &&
        !canonicalCriterion &&
        !canonicalInformational
      ) {
        findings.push(
          finding(
            "invalid_authoritative_metric_definition",
            path,
            "Rendered narratives must not restate immutable metric semantics outside deterministic target clauses.",
          ),
        );
        break;
      }
      if (
        namedDefinitions.length > 0 &&
        targetClaimMatches(clause).length > 0 &&
        /\b(?:aggregation|window|definition|unit|weekly|daily|sum|average|ratio)\b/iu.test(
          clause,
        )
      ) {
        findings.push(
          finding(
            "invalid_authoritative_metric_definition",
            path,
            "Rendered metric semantics cannot be combined with a target restatement.",
          ),
        );
        break;
      }
      if (targetClaimMatches(clause).length === 0) continue;
      if (namedDefinitions.length !== 1 || targetClaimsConflict(clause, namedDefinitions[0])) {
        findings.push(
          finding(
            "invalid_authoritative_metric_definition",
            path,
            "Rendered metric target claims must match the immutable approved definition.",
          ),
        );
        break;
      }
    }
  }

  return findings;
}
