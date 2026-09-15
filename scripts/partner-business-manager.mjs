import { createHash, verify as verifySignature } from "node:crypto";

const DOMAIN_META = Object.freeze({
  capabilities: Object.freeze({
    collection: "capabilities",
    evidenceType: "capability",
    ownerField: "authorityOwnerRef",
    right: "capability-status",
  }),
  designations: Object.freeze({
    collection: "designations",
    evidenceType: "designation",
    ownerField: "authorityOwnerRef",
    right: "designation",
  }),
  "solution-plays": Object.freeze({
    collection: "solutionPlays",
    evidenceType: "solution-play",
    ownerField: "authorityOwnerRef",
    right: "solution-play",
  }),
  opportunities: Object.freeze({
    collection: "opportunities",
    evidenceType: "opportunity-reference",
    ownerField: "authorityOwnerRef",
    right: "opportunity-mutation",
  }),
  commitments: Object.freeze({
    collection: "commitments",
    evidenceType: "commitment",
    ownerField: null,
    right: "partner-commitment",
  }),
  benefits: Object.freeze({
    collection: "eligibilityEvidence",
    evidenceType: "benefit",
    ownerField: "authorityOwnerRef",
    right: "benefit-eligibility",
    kind: "benefit",
  }),
  incentives: Object.freeze({
    collection: "eligibilityEvidence",
    evidenceType: "incentive",
    ownerField: "authorityOwnerRef",
    right: "incentive-approval",
    kind: "incentive",
  }),
  dependencies: Object.freeze({
    collection: "dependencies",
    evidenceType: "dependency",
    ownerField: "ownerRef",
    right: "own-action",
  }),
  risks: Object.freeze({
    collection: "risks",
    evidenceType: "risk",
    ownerField: "ownerRef",
    right: "risk-acceptance",
  }),
  actions: Object.freeze({
    collection: "actions",
    evidenceType: "action",
    ownerField: "ownerRef",
    right: "own-action",
  }),
  "qbr-decisions": Object.freeze({
    collection: "qbrDecisions",
    evidenceType: "qbr-decision",
    ownerField: "decisionMakerRef",
    right: "qbr-decision",
  }),
  "revision-delta": Object.freeze({
    collection: "revisionDelta",
    evidenceType: "revision-delta",
    ownerField: "ownerRef",
    right: "reconcile-plan",
  }),
});

const SUBJECT_DOMAIN = Object.freeze(
  Object.fromEntries(
    Object.entries(DOMAIN_META)
      .filter(([, meta]) => meta.evidenceType)
      .map(([domain, meta]) => [meta.evidenceType, domain]),
  ),
);

const RESERVED_ACTION_RIGHT = Object.freeze({
  "partner-enrollment": "enrollment",
  "capability-award": "capability-status",
  "designation-award": "designation",
  "benefit-eligibility": "benefit-eligibility",
  "incentive-approval": "incentive-approval",
  "incentive-payment": "incentive-payment",
  "revenue-commitment": "revenue-commitment",
  "opportunity-mutation": "opportunity-mutation",
  "customer-contact": "customer-contact",
  "agreement-modification": "agreement-modification",
  "risk-acceptance": "risk-acceptance",
  "qbr-decision": "qbr-decision",
});

const DAY_MS = 86_400_000;
export const DEFAULT_PARTNER_GOVERNANCE_TRUST = Object.freeze([
  Object.freeze({
    partnerId: "partner-contoso-cloud",
    partnerName: "Contoso Cloud Services",
    signingKeyId: "partner-governance-ed25519-v1",
    publicKey: `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAec4JwSRXnG/Zh+9kkZ/N0MpkZFYPJYB0guBzBuCmzZ4=
-----END PUBLIC KEY-----`,
  }),
]);

const AUTHORITY_COMPLETION_VERB =
  String.raw`(?:complet(?:ed|es|ing)|finaliz(?:ed|es|ing)|issu(?:ed|es|ing)|execut(?:ed|es|ing)|process(?:ed|es|ing))`;

function nominalAuthorityPattern(objectPattern) {
  return new RegExp(
    String.raw`\b${AUTHORITY_COMPLETION_VERB}\b.{0,30}\b(?:${objectPattern})\b|\b(?:${objectPattern})\b.{0,30}\b${AUTHORITY_COMPLETION_VERB}\b`,
    "iu",
  );
}

const PROHIBITED_AUTHORITY_PATTERNS = Object.freeze([
  { right: "enrollment", pattern: /\b(?:enroll(?:ed|ing|s)?|register(?:ed|ing|s)?)\b.{0,40}\bpartner\b|\bpartner\b.{0,40}\b(?:enroll(?:ed|ing|s)?|register(?:ed|ing|s)?)\b/iu },
  { right: "enrollment", pattern: nominalAuthorityPattern(String.raw`partner\s+enrollment`) },
  { right: "capability-status", pattern: /\b(?:award(?:ed|ing|s)|grant(?:ed|ing|s))\b.{0,40}\bcapability\b|\bcapability\b.{0,40}\b(?:award(?:ed|ing|s)|grant(?:ed|ing|s))\b/iu },
  { right: "capability-status", pattern: /\b(?:we|i|agent|assistant|artifact|claw|system)\b.{0,30}\b(?:award|grant)\b.{0,30}\bcapability\b/iu },
  { right: "capability-status", pattern: nominalAuthorityPattern(String.raw`capability\s+award`) },
  { right: "designation", pattern: /\b(?:award(?:ed|ing|s)|grant(?:ed|ing|s))\b.{0,40}\bdesignation\b|\bdesignation\b.{0,40}\b(?:award(?:ed|ing|s)|grant(?:ed|ing|s))\b/iu },
  { right: "designation", pattern: /\b(?:we|i|agent|assistant|artifact|claw|system)\b.{0,30}\b(?:award|grant)\b.{0,30}\bdesignation\b/iu },
  { right: "designation", pattern: nominalAuthorityPattern(String.raw`designation\s+award`) },
  { right: "benefit-eligibility", pattern: /\b(?:determin(?:e|ed|es|ing)|confirm(?:ed|ing|s)?)\b.{0,40}\b(?:benefit\s+)?eligib(?:ility|le)\b|\b(?:benefit\s+)?eligib(?:ility|le)\b.{0,40}\b(?:determin(?:e|ed|es|ing)|confirm(?:ed|ing|s)?)\b/iu },
  { right: "benefit-eligibility", pattern: nominalAuthorityPattern(String.raw`benefit\s+eligibility`) },
  { right: "incentive-approval", pattern: /\b(?:approv(?:e|ed|es|ing)|authoriz(?:e|ed|es|ing))\b.{0,40}\bincentive\b|\bincentive\b.{0,40}\b(?:approv(?:e|ed|es|ing)|authoriz(?:e|ed|es|ing))\b/iu },
  { right: "incentive-approval", pattern: nominalAuthorityPattern(String.raw`incentive\s+approval`) },
  { right: "incentive-payment", pattern: /\b(?:pay|paid|pays|paying|disburs(?:e|ed|es|ing))\b.{0,40}\bincentive\b|\bincentive\b.{0,40}\b(?:pay|paid|pays|paying|disburs(?:e|ed|es|ing))\b/iu },
  { right: "incentive-payment", pattern: nominalAuthorityPattern(String.raw`incentive\s+payment`) },
  { right: "revenue-commitment", pattern: /\b(?:commit(?:ted|ting|s)?|guarantee(?:d|s)?)\b.{0,40}\brevenue\b|\brevenue\b.{0,40}\b(?:commit(?:ted|ting|s)?|guarantee(?:d|s)?)\b/iu },
  { right: "revenue-commitment", pattern: nominalAuthorityPattern(String.raw`revenue\s+commitment`) },
  { right: "opportunity-mutation", pattern: /\b(?:mutat(?:e|ed|es|ing)|updat(?:e|ed|es|ing)|chang(?:e|ed|es|ing))\b.{0,40}\bopportunit(?:y|ies)\b|\bopportunit(?:y|ies)\b.{0,40}\b(?:mutat(?:ed|es|ing)|updat(?:ed|es|ing)|chang(?:ed|es|ing))\b/iu },
  { right: "opportunity-mutation", pattern: nominalAuthorityPattern(String.raw`opportunity\s+(?:update|change|mutation)`) },
  { right: "customer-contact", pattern: /\b(?:contact(?:ed|ing|s)|email(?:ed|ing|s)|call(?:ed|ing|s))\b.{0,40}\bcustomer\b|\bcustomer\b.{0,40}\b(?:contact(?:ed|ing|s)|email(?:ed|ing|s)|call(?:ed|ing|s))\b/iu },
  { right: "customer-contact", pattern: /\b(?:we|i|agent|assistant|artifact|claw|system)\b.{0,30}\bcontact\b.{0,30}\bcustomer\b/iu },
  { right: "customer-contact", pattern: nominalAuthorityPattern(String.raw`customer\s+contact`) },
  { right: "agreement-modification", pattern: /\b(?:modif(?:y|ied|ies|ying)|amend(?:ed|ing|s)?|chang(?:e|ed|es|ing))\b.{0,40}\bagreement\b|\bagreement\b.{0,40}\b(?:modif(?:y|ied|ies|ying)|amend(?:ed|ing|s)?|chang(?:e|ed|es|ing))\b/iu },
  { right: "agreement-modification", pattern: nominalAuthorityPattern(String.raw`agreement\s+modification`) },
  { right: "risk-acceptance", pattern: /\b(?:accept(?:ed|ing|s)?|assum(?:e|ed|es|ing))\b.{0,40}\brisk\b|\brisk\b.{0,40}\b(?:accept(?:ed|ing|s)?)\b/iu },
  { right: "risk-acceptance", pattern: nominalAuthorityPattern(String.raw`risk\s+acceptance`) },
  { right: "qbr-decision", pattern: /\b(?:make|made|making|approv(?:e|ed|es|ing))\b.{0,40}\bqbr\s+decision\b|\bqbr\s+decision\b.{0,40}\b(?:make|made|making|approv(?:e|ed|es|ing))\b/iu },
  { right: "qbr-decision", pattern: nominalAuthorityPattern(String.raw`qbr\s+decision`) },
]);

const DIRECT_AUTHORITY_NEGATION =
  /\b(?:no|not|never|cannot|can't|didn't|doesn't|isn't|wasn't|won't|did\s+not|does\s+not|do\s+not|has\s+not|have\s+not|was\s+not|is\s+not|must\s+not|may\s+not|before\s+any)\s+(?:(?:a|an|the|any)\s+)?$/iu;
const NON_AFFIRMATIVE_AUTHORITY_STATUS =
  /\b(?:pending|awaiting|blocked|prohibited|forbidden|reserved)\b/iu;
const DIRECT_AUTHORITY_STATUS_PREFIX =
  /\b(?:pending|awaiting|blocked|prohibited|forbidden|reserved)\b(?:\s+\w+){0,2}\s*$/iu;
const DIRECT_AUTHORITY_STATUS_SUFFIX =
  /^(?:\s+(?:(?:is|are|remains?|still)\s+){0,2}|\s+and\s+(?:incentive\s+)?(?:approval|payment)\s+(?:is|are|remains?)\s+)\b(?:pending|awaiting|blocked|prohibited|forbidden|reserved)\b/iu;
const NEGATED_AUTHORITY_ACTION =
  /\b(?:no|not|never|cannot|can't|didn't|doesn't|isn't|wasn't|won't|must\s+not|may\s+not|does\s+not|do\s+not|did\s+not|has\s+not|have\s+not|was\s+not|is\s+not|remains?\s+not)\s+(?:\w+\s+){0,1}(?:enroll(?:ed|ing|s)?|register(?:ed|ing|s)?|award(?:ed|ing|s)?|grant(?:ed|ing|s)?|determin(?:e|ed|es|ing)|confirm(?:ed|ing|s)?|approv(?:al|e|ed|es|ing)|authoriz(?:ation|e|ed|es|ing)|pay|paid|pays|paying|payment|disburs(?:al|e|ed|es|ing)|commit(?:ted|ting|s)?|guarantee(?:d|s)?|mutat(?:e|ed|es|ing)|updat(?:e|ed|es|ing)|chang(?:e|ed|es|ing)|contact(?:ed|ing|s)?|email(?:ed|ing|s)?|call(?:ed|ing|s)?|modif(?:y|ied|ies|ying)|amend(?:ed|ing|s)?|accept(?:ed|ance|ing|s)?|assum(?:e|ed|es|ing)|make|made|making|complet(?:e|ed|es|ing)|finaliz(?:e|ed|es|ing)|issu(?:e|ed|es|ing)|execut(?:e|ed|es|ing)|process(?:ed|es|ing))\b/iu;

const NARRATIVE_FIELDS = new Set([
  "partnerName",
  "name",
  "sourceVersion",
  "reference",
  "measure",
  "target",
  "programItem",
  "response",
  "rationale",
  "description",
  "disposition",
  "trigger",
  "route",
  "reason",
]);

const SELF_ATTESTED_PRINCIPAL_NAME =
  /^(?:the\s+)?(?:we|i|artifact|system|partner business manager|awesome claws partner business manager)$|\b(?:agent|assistant|bot|automation|automated|claw)\b/iu;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function rows(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function strings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function finding(code, path, message) {
  return { code, path, message };
}

function byId(value) {
  return new Map(rows(value).map((row) => [row.id, row]).filter(([id]) => typeof id === "string"));
}

function uniqueIds(value) {
  const recordRows = rows(value);
  const recordIds = recordRows.map((row) => row.id).filter((id) => typeof id === "string");
  return recordIds.length === recordRows.length && new Set(recordIds).size === recordIds.length;
}

function sameSet(left, right) {
  const a = strings(left);
  const b = strings(right);
  const uniqueA = [...new Set(a)].sort();
  const uniqueB = [...new Set(b)].sort();
  return (
    uniqueA.length === a.length &&
    uniqueB.length === b.length &&
    uniqueA.length === uniqueB.length &&
    uniqueA.every((item, index) => item === uniqueB[index])
  );
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computePartnerRecordDigest(record) {
  if (!isRecord(record)) return null;
  const { contentDigest: _contentDigest, ...content } = record;
  return `sha256:${createHash("sha256").update(canonicalJson(content)).digest("hex")}`;
}

export function computePartnerTrustDigest(record) {
  if (!isRecord(record)) return null;
  const {
    contentDigest: _contentDigest,
    signature: _signature,
    ...content
  } = record;
  return `sha256:${createHash("sha256").update(canonicalJson(content)).digest("hex")}`;
}

export function partnerGovernanceSigningPayload(record) {
  if (!isRecord(record)) return null;
  const { signature: _signature, ...signedPayload } = record;
  return canonicalJson(signedPayload);
}

function hasValidPartnerGovernanceSignature(record, identity, trustedGovernanceKeys) {
  const matchingKeys = rows(trustedGovernanceKeys).filter(
    (key) =>
      key.partnerId === identity.partnerId &&
      key.partnerName === identity.partnerName &&
      key.signingKeyId === record?.signingKeyId &&
      typeof key.publicKey === "string",
  );
  if (
    !isRecord(record) ||
    matchingKeys.length !== 1 ||
    record.contentDigest !== computePartnerTrustDigest(record) ||
    typeof record.signature !== "string" ||
    !/^[A-Za-z0-9+/]{86}==$/.test(record.signature)
  ) {
    return false;
  }
  try {
    return verifySignature(
      null,
      Buffer.from(partnerGovernanceSigningPayload(record)),
      matchingKeys[0].publicKey,
      Buffer.from(record.signature, "base64"),
    );
  } catch {
    return false;
  }
}

function recordsForDomain(value, domain) {
  const meta = DOMAIN_META[domain];
  if (!meta) return [];
  const records = rows(value?.[meta.collection]);
  return meta.kind ? records.filter((row) => row.kind === meta.kind) : records;
}

function hasRight(principals, principalRef, right) {
  const principal = principals.get(principalRef);
  return Boolean(principal && strings(principal.decisionRights).includes(right));
}

function hasDomainRight(principals, domain, principalRef) {
  const principal = principals.get(principalRef);
  if (!principal) return false;
  if (domain === "commitments") {
    const right =
      principal.organization === "partner"
        ? "partner-commitment"
        : principal.organization === "vendor"
          ? "vendor-commitment"
          : null;
    return Boolean(right && strings(principal.decisionRights).includes(right));
  }
  return hasRight(principals, principalRef, DOMAIN_META[domain]?.right);
}

function dateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function timestamp(value) {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function trustedTimestamp(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  ) {
    return null;
  }
  return timestamp(value);
}

function orderedByTimestamp(value, property) {
  const times = rows(value).map((row) => timestamp(row[property]));
  return times.every(
    (time, index) => time !== null && (index === 0 || time >= times[index - 1]),
  );
}

function evidenceDomain(evidence, coverage) {
  if (evidence?.subjectType === "domain-applicability") {
    return coverage.get(evidence.subjectRef)?.domain ?? null;
  }
  return SUBJECT_DOMAIN[evidence?.subjectType] ?? null;
}

function fingerprintMap(value, refField = "recordRef") {
  return new Map(
    rows(value)
      .map((row) => [row[refField], row.contentDigest])
      .filter(
        ([recordRef, contentDigest]) =>
          typeof recordRef === "string" && typeof contentDigest === "string",
      ),
  );
}

function narrativeEntries(value, path = "") {
  if (typeof value === "string") {
    const field = path.match(/(?:^|\.)([^.[\]]+)$/u)?.[1];
    return NARRATIVE_FIELDS.has(field) ? [[path, value]] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => narrativeEntries(item, `${path}[${index}]`));
  }
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, item]) =>
    narrativeEntries(item, path ? `${path}.${key}` : key),
  );
}

function hasAffirmativeProhibitedAuthority(text) {
  return text
    .split(/(?<=[.!?;])\s+|\s+\bbut\b\s+/iu)
    .some((clause) =>
      PROHIBITED_AUTHORITY_PATTERNS.some(({ pattern }) => {
        const matches = clause.matchAll(new RegExp(pattern.source, `${pattern.flags}g`));
        return [...matches].some((match) => {
          const prefix = clause.slice(0, match.index);
          const suffix = clause.slice(match.index + match[0].length);
          return !(
            DIRECT_AUTHORITY_NEGATION.test(prefix) ||
            NEGATED_AUTHORITY_ACTION.test(match[0]) ||
            DIRECT_AUTHORITY_STATUS_PREFIX.test(prefix) ||
            DIRECT_AUTHORITY_STATUS_SUFFIX.test(suffix)
          );
        });
      }),
    );
}

export function resealPartnerBusinessPlan(value) {
  if (!isRecord(value)) return value;
  const currentCollections = new Set(
    Object.entries(DOMAIN_META)
      .filter(([domain]) => domain !== "revision-delta")
      .map(([, meta]) => meta.collection),
  );
  for (const collection of currentCollections) {
    for (const record of rows(value[collection])) {
      record.contentDigest = computePartnerRecordDigest(record);
    }
  }

  for (const delta of rows(value.revisionDelta)) {
    const universe = new Map(
      recordsForDomain(value, delta.domain).map((record) => [record.id, record]),
    );
    delta.currentRecordFingerprints = strings(delta.currentRecordRefs).map(
      (recordRef) => ({
        recordRef,
        contentDigest:
          universe.get(recordRef)?.contentDigest ?? `sha256:${"0".repeat(64)}`,
      }),
    );
    delta.predecessorRecordFingerprints = rows(delta.predecessorRecordFingerprints);
    const currentFingerprints = fingerprintMap(delta.currentRecordFingerprints);
    const predecessorFingerprints = fingerprintMap(delta.predecessorRecordFingerprints);
    const currentRefs = strings(delta.currentRecordRefs);
    const predecessorRefs = strings(delta.predecessorRecordRefs);
    const sameIdentity = sameSet(currentRefs, predecessorRefs);
    const sameContent =
      sameIdentity &&
      currentRefs.every(
        (recordRef) =>
          currentFingerprints.get(recordRef) === predecessorFingerprints.get(recordRef),
      );
    delta.change =
      currentRefs.length > 0 && predecessorRefs.length === 0
        ? "added"
        : currentRefs.length === 0 && predecessorRefs.length > 0
          ? "removed"
          : currentRefs.length > 0 && predecessorRefs.length > 0 && sameContent
            ? "unchanged"
            : currentRefs.length > 0 && predecessorRefs.length > 0
              ? "changed"
              : delta.change;
    delta.contentDigest = computePartnerRecordDigest(delta);
  }
  for (const row of rows(value.coverage)) {
    row.contentDigest = computePartnerRecordDigest(row);
  }

  return value;
}

function lineageFindings(value, {
  collection,
  parentField,
  timeField,
  code,
  label,
}) {
  const findings = [];
  const records = rows(value?.[collection]);
  const positions = new Map(records.map((row, index) => [row.id, index]));
  const recordsById = new Map(records.map((row) => [row.id, row]));

  for (const [index, record] of records.entries()) {
    const parentRef = record[parentField];
    if (parentRef === null) continue;
    const parent = recordsById.get(parentRef);
    const parentPosition = positions.get(parentRef);
    const parentTime = timestamp(parent?.[timeField]);
    const recordTime = timestamp(record[timeField]);
    if (
      !parent ||
      parentRef === record.id ||
      parentPosition >= index ||
      parentTime === null ||
      recordTime === null ||
      parentTime >= recordTime
    ) {
      findings.push(
        finding(
          code,
          `${collection}[${index}].${parentField}`,
          `${label} lineage must reference a strictly earlier record and cannot self- or forward-reference.`,
        ),
      );
    }
  }

  for (const [index, record] of records.entries()) {
    const visited = new Set([record.id]);
    let cursor = record;
    while (cursor?.[parentField] !== null && cursor?.[parentField] !== undefined) {
      const parentRef = cursor[parentField];
      if (visited.has(parentRef)) {
        findings.push(
          finding(code, `${collection}[${index}].${parentField}`, `${label} lineage is cyclic.`),
        );
        break;
      }
      visited.add(parentRef);
      cursor = recordsById.get(parentRef);
      if (!cursor) break;
    }
  }
  return findings;
}

export function partnerBusinessPlanFindings(
  value,
  {
    asOf: trustedAsOf,
    trustedGovernanceKeys = DEFAULT_PARTNER_GOVERNANCE_TRUST,
  } = {},
) {
  const findings = [];
  const add = (code, path, message) => findings.push(finding(code, path, message));
  if (!isRecord(value)) {
    return [finding("invalid_artifact", "", "Artifact must be an object.")];
  }

  const identity = isRecord(value.identity) ? value.identity : {};
  const principalRows = rows(value.principals);
  const principals = byId(value.principals);
  const evidenceRows = rows(value.evidence);
  const evidence = byId(value.evidence);
  const coverageRows = rows(value.coverage);
  const coverage = new Map(
    coverageRows.map((row) => [row.id, row]).filter(([id]) => typeof id === "string"),
  );
  const governance = isRecord(value.evidenceGovernance) ? value.evidenceGovernance : {};
  const freshnessRules = byId(governance.freshnessRules);
  const confidentialityScopes = byId(governance.confidentialityScopes);
  const conflicts = byId(governance.conflicts);
  const escalationPaths = byId(governance.escalationPaths);
  const embeddedAsOf = timestamp(identity.asOf);
  const validationAsOf = trustedTimestamp(trustedAsOf);
  if (
    validationAsOf === null ||
    embeddedAsOf === null ||
    (trustedAsOf !== undefined && embeddedAsOf > validationAsOf)
  ) {
    add(
      "invalid_validation_time",
      "identity.asOf",
      "The embedded review time must be valid and no later than the trusted caller-supplied asOf time.",
    );
  }
  const authorityRosterEvidence = isRecord(value.authorityRosterEvidence)
    ? value.authorityRosterEvidence
    : {};
  const authorityRows = rows(authorityRosterEvidence.principalAuthorities);
  const authorityFreshnessRows = rows(
    authorityRosterEvidence.freshnessRuleDigests,
  );
  const authorityRosterScope = confidentialityScopes.get(
    authorityRosterEvidence.confidentialityScopeRef,
  );
  for (const [index, principal] of principalRows.entries()) {
    if (
      typeof principal.name === "string" &&
      SELF_ATTESTED_PRINCIPAL_NAME.test(principal.name.trim())
    ) {
      add(
        "invalid_principal_identity",
        `principals[${index}].name`,
        "A declared principal must identify a genuine external human or team, not the agent or package itself.",
      );
    }
    const matchingAuthorities = authorityRows.filter(
      (row) =>
        row.principalRef === principal.id &&
        row.principalName === principal.name &&
        row.organization === principal.organization &&
        sameSet(row.decisionRights, principal.decisionRights),
    );
    if (matchingAuthorities.length !== 1) {
      add(
        "invalid_authority_evidence",
        `principals[${index}].decisionRights`,
        "Every principal's exact decision rights must be bound once by the controlled authority roster.",
      );
    }
  }
  if (
    authorityRows.length !== principalRows.length ||
    authorityFreshnessRows.length !== freshnessRules.size ||
    new Set(
      authorityFreshnessRows.map((row) => row.freshnessRuleRef),
    ).size !== authorityFreshnessRows.length ||
    [...freshnessRules.values()].some(
      (rule) =>
        authorityFreshnessRows.filter(
          (row) =>
            row.freshnessRuleRef === rule.id &&
            row.contentDigest === computePartnerRecordDigest(rule),
        ).length !== 1,
    ) ||
    !hasValidPartnerGovernanceSignature(
      authorityRosterEvidence,
      identity,
      trustedGovernanceKeys,
    ) ||
    timestamp(authorityRosterEvidence.observedAt) === null ||
    embeddedAsOf === null ||
    timestamp(authorityRosterEvidence.observedAt) > embeddedAsOf ||
    validationAsOf === null ||
    !Number.isInteger(authorityRosterEvidence.maxAgeDays) ||
    validationAsOf - timestamp(authorityRosterEvidence.observedAt) >
      authorityRosterEvidence.maxAgeDays * DAY_MS ||
    !hasRight(principals, authorityRosterEvidence.issuedByPrincipalRef, "authority-governance") ||
    !authorityRosterScope ||
    !strings(authorityRosterScope.audienceRefs).includes(value.handoff?.accountableOwnerRef)
  ) {
    add(
      "invalid_authority_evidence",
      "authorityRosterEvidence",
      "Authority roster evidence must exactly cover all principals and freshness rules, carry a valid independent partner-governance signature, predate the review, and use a declared confidentiality scope that includes the handoff owner.",
    );
  }

  for (const [path, text] of narrativeEntries(value)) {
    if (hasAffirmativeProhibitedAuthority(text)) {
      add(
        "prohibited_authority_narrative",
        path,
        "User-visible text must not make free-text affirmative reserved-authority claims; record verified outcomes in the structured evidence-bound fields, or use explicit negation, pending, or owner-reserved language.",
      );
    }
  }

  const identityCollections = new Set([
    "principals",
    "evidence",
    ...Object.values(DOMAIN_META).map((meta) => meta.collection),
    "coverage",
    "gaps",
  ]);
  for (const [path, records] of [
    ...[...identityCollections].map((name) => [name, value[name]]),
    ["authorityRosterEvidence", [authorityRosterEvidence]],
    ["evidenceGovernance.freshnessRules", governance.freshnessRules],
    ["evidenceGovernance.confidentialityScopes", governance.confidentialityScopes],
    ["evidenceGovernance.conflicts", governance.conflicts],
    ["evidenceGovernance.escalationPaths", governance.escalationPaths],
  ]) {
    if (!uniqueIds(records)) {
      add("duplicate_or_missing_identity", path, `${path} must use unique stable ids.`);
    }
  }
  const allIdentityRows = [
    ...[...identityCollections].flatMap((name) => rows(value[name])),
    authorityRosterEvidence,
    isRecord(value.predecessorManifest) ? value.predecessorManifest : {},
    ...rows(governance.freshnessRules),
    ...rows(governance.confidentialityScopes),
    ...rows(governance.conflicts),
    ...rows(governance.escalationPaths),
  ];
  const allIdentityIds = allIdentityRows
    .map((row) => row.id)
    .filter((id) => typeof id === "string");
  if (
    allIdentityIds.length !== allIdentityRows.length ||
    new Set(allIdentityIds).size !== allIdentityIds.length
  ) {
    add(
      "duplicate_or_missing_identity",
      "",
      "Every artifact identity must be present and unique across all collections.",
    );
  }
  for (const collection of new Set([
    ...Object.values(DOMAIN_META).map((meta) => meta.collection),
    "coverage",
  ])) {
    for (const [index, record] of rows(value[collection]).entries()) {
      if (record.contentDigest !== computePartnerRecordDigest(record)) {
        add(
          "invalid_record_fingerprint",
          `${collection}[${index}].contentDigest`,
          "Current record contentDigest must be the canonical digest of its complete immutable content.",
        );
      }
    }
  }

  if (
    !Number.isInteger(identity.planRevision) ||
    identity.predecessorRevision !== identity.planRevision - 1
  ) {
    add(
      "invalid_revision_lineage",
      "identity.predecessorRevision",
      "Predecessor must be the immediately prior plan revision.",
    );
  }

  const periodStart = dateOnly(identity.period?.start);
  const periodEnd = dateOnly(identity.period?.end);
  const segments = rows(identity.period?.segments);
  const segmentIds = segments.map((row) => row.id);
  const invalidSegmentRange = segments.some((segment) => {
    const start = dateOnly(segment.start);
    const end = dateOnly(segment.end);
    return (
      start === null ||
      end === null ||
      start > end ||
      periodStart === null ||
      periodEnd === null ||
      start < periodStart ||
      end > periodEnd
    );
  });
  const invalidContiguity =
    segments.length === 0 ||
    periodStart === null ||
    periodEnd === null ||
    periodStart > periodEnd ||
    segments[0]?.start !== identity.period?.start ||
    segments.at(-1)?.end !== identity.period?.end ||
    segments.some(
      (segment, index) =>
        index > 0 &&
        dateOnly(segment.start) !== dateOnly(segments[index - 1].end) + DAY_MS,
    );
  if (
    invalidSegmentRange ||
    invalidContiguity ||
    segmentIds.length !== new Set(segmentIds).size
  ) {
    add(
      "invalid_period_coverage",
      "identity.period",
      "The review period and unique segments must have start <= end, stay contained, and form exact contiguous coverage.",
    );
  }
  const segmentIdSet = new Set(segmentIds);

  for (const [index, row] of evidenceRows.entries()) {
    const expectedRevision =
      row.scope === "predecessor-revision"
        ? identity.predecessorRevision
        : identity.planRevision;
    if (
      row.partnerId !== identity.partnerId ||
      row.planId !== identity.planId ||
      row.planRevision !== expectedRevision
    ) {
      add(
        "mixed_plan_identity",
        `evidence[${index}]`,
        "Evidence must match the exact partner, plan, and scoped revision.",
      );
    }
    if (
      strings(row.segmentRefs).length === 0 ||
      new Set(row.segmentRefs).size !== row.segmentRefs.length ||
      !strings(row.segmentRefs).every((ref) => segmentIdSet.has(ref))
    ) {
      add(
        "invalid_period_coverage",
        `evidence[${index}].segmentRefs`,
        "Evidence must bind one or more unique segments from the declared plan period.",
      );
    }
    if (!principals.has(row.issuedByPrincipalRef)) {
      add(
        "unattributed_evidence",
        `evidence[${index}].issuedByPrincipalRef`,
        "Evidence issuer must resolve to a declared principal.",
      );
    }
    const observedAt = timestamp(row.observedAt);
    if (
      observedAt === null ||
      embeddedAsOf === null ||
      observedAt > embeddedAsOf
    ) {
      add(
        "invalid_evidence_chronology",
        `evidence[${index}].observedAt`,
        "Evidence must have a valid observation time no later than asOf.",
      );
    }

    const rule = freshnessRules.get(row.freshnessRuleRef);
    const domain = evidenceDomain(row, coverage);
    const assertionValid =
      row.assertion === undefined ||
      row.assertion === "observed" ||
      (row.subjectType === "commitment" &&
        ["approval-granted", "approval-denied"].includes(row.assertion) &&
        hasDomainRight(principals, "commitments", row.issuedByPrincipalRef)) ||
      (row.subjectType === "qbr-decision" &&
        row.assertion === "decision-recorded" &&
        hasDomainRight(principals, "qbr-decisions", row.issuedByPrincipalRef));
    if (!assertionValid) {
      add(
        "invalid_evidence_assertion",
        `evidence[${index}].assertion`,
        "Positive evidence assertions must match the subject domain and be issued by a principal with that domain's exact decision right.",
      );
    }
    if (
      !rule ||
      rule.subjectType !== row.subjectType ||
      rule.scope !== row.scope ||
      rule.domain !== domain
    ) {
      add(
        "invalid_freshness_governance",
        `evidence[${index}].freshnessRuleRef`,
        "Evidence must use the exact freshness rule for its domain, subject type, and revision scope.",
      );
    } else {
      if (!hasDomainRight(principals, domain, rule.ownerRef)) {
        add(
          "invalid_governance_owner",
          `evidenceGovernance.freshnessRules.${rule.id}.ownerRef`,
          "Freshness-rule owner lacks the exact domain decision right.",
        );
      }
      if (
        observedAt !== null &&
        validationAsOf !== null &&
        Number.isInteger(rule.maxAgeDays) &&
        validationAsOf - observedAt > rule.maxAgeDays * DAY_MS
      ) {
        add(
          "stale_evidence",
          `evidence[${index}].observedAt`,
          "Evidence exceeds its declared freshness limit.",
        );
      }
    }

    const confidentiality = confidentialityScopes.get(row.confidentialityScopeRef);
    if (!confidentiality) {
      add(
        "invalid_confidentiality_scope",
        `evidence[${index}].confidentialityScopeRef`,
        "Evidence confidentiality scope must resolve.",
      );
    }
    for (const conflictRef of strings(row.conflictRefs)) {
      if (!conflicts.has(conflictRef)) {
        add(
          "invalid_conflict_reference",
          `evidence[${index}].conflictRefs`,
          `Conflict ${conflictRef} does not resolve.`,
        );
      }
    }
    for (const conflictRef of strings(row.dispositionConflictRefs)) {
      const conflict = conflicts.get(conflictRef);
      if (!conflict || !strings(conflict.dispositionEvidenceRefs).includes(row.id)) {
        add(
          "invalid_conflict_disposition",
          `evidence[${index}].dispositionConflictRefs`,
          `Disposition binding ${conflictRef} must resolve and reciprocally list this evidence row.`,
        );
      }
    }
    for (const escalationRef of strings(row.resolutionEscalationRefs)) {
      const escalation = escalationPaths.get(escalationRef);
      if (
        !escalation ||
        escalation.state !== "resolved" ||
        !strings(escalation.resolutionEvidenceRefs).includes(row.id)
      ) {
        add(
          "invalid_escalation_resolution",
          `evidence[${index}].resolutionEscalationRefs`,
          `Escalation resolution binding ${escalationRef} must resolve to a resolved path that reciprocally lists this evidence row.`,
        );
      }
    }
  }

  const commitmentApprovalEvidence = evidenceRows.filter(
    (row) =>
      row.subjectType === "commitment" &&
      ["approval-granted", "approval-denied"].includes(row.assertion),
  );
  const approvalSubjects = new Set(
    commitmentApprovalEvidence.map(
      (row) => `${row.scope}\u0000${row.subjectRef}`,
    ),
  );
  for (const subjectKey of approvalSubjects) {
    const subjectEvidence = commitmentApprovalEvidence.filter(
      (row) => `${row.scope}\u0000${row.subjectRef}` === subjectKey,
    );
    const granted = subjectEvidence.filter((row) => row.assertion === "approval-granted");
    const denied = subjectEvidence.filter((row) => row.assertion === "approval-denied");
    if (granted.length === 0 || denied.length === 0) continue;
    const everyContradictionAccounted = granted.every((grant) =>
      denied.every((denial) =>
        strings(grant.conflictRefs).some((conflictRef) => {
          const conflict = conflicts.get(conflictRef);
          return (
            strings(denial.conflictRefs).includes(conflictRef) &&
            conflict?.domain === "commitments" &&
            conflict.scope === grant.scope &&
            strings(conflict.evidenceRefs).includes(grant.id) &&
            strings(conflict.evidenceRefs).includes(denial.id)
          );
        }),
      ),
    );
    if (!everyContradictionAccounted) {
      add(
        "unaccounted_evidence_conflict",
        "evidence",
        "Contradictory commitment approval assertions must share a reciprocal commitments conflict record.",
      );
    }
  }

  for (const [index, scope] of rows(governance.confidentialityScopes).entries()) {
    if (!hasRight(principals, scope.ownerRef, "reconcile-plan")) {
      add(
        "invalid_governance_owner",
        `evidenceGovernance.confidentialityScopes[${index}].ownerRef`,
        "Confidentiality-scope owner must hold reconcile-plan authority.",
      );
    }
    if (!strings(scope.audienceRefs).every((ref) => principals.has(ref))) {
      add(
        "invalid_confidentiality_scope",
        `evidenceGovernance.confidentialityScopes[${index}].audienceRefs`,
        "Every confidentiality audience reference must resolve to a principal.",
      );
    }
    if (
      evidenceRows.some((row) => row.confidentialityScopeRef === scope.id) &&
      !strings(scope.audienceRefs).includes(value.handoff?.accountableOwnerRef)
    ) {
      add(
        "invalid_confidentiality_scope",
        `evidenceGovernance.confidentialityScopes[${index}].audienceRefs`,
        "Every evidence scope rendered in the handoff must include the accountable handoff owner.",
      );
    }
  }
  for (const [index, rule] of rows(governance.freshnessRules).entries()) {
    const meta = DOMAIN_META[rule.domain];
    const subjectMatches =
      rule.subjectType === "domain-applicability" ||
      rule.subjectType === meta?.evidenceType;
    if (!meta || !subjectMatches || !hasDomainRight(principals, rule.domain, rule.ownerRef)) {
      add(
        "invalid_governance_owner",
        `evidenceGovernance.freshnessRules[${index}].ownerRef`,
        "Every freshness rule must map to one domain subject type and an owner with that domain's exact decision right.",
      );
    }
  }

  for (const [domain, meta] of Object.entries(DOMAIN_META)) {
    const records = recordsForDomain(value, domain);
    for (const [index, record] of records.entries()) {
      if (
        meta.ownerField &&
        !hasRight(principals, record[meta.ownerField], meta.right)
      ) {
        add(
          "invalid_record_owner",
          `${meta.collection}[${index}].${meta.ownerField}`,
          `${domain} owner must exist and hold ${meta.right}.`,
        );
      }
      if (domain === "revision-delta") continue;
      for (const evidenceRef of strings(record.evidenceRefs)) {
        const evidenceRow = evidence.get(evidenceRef);
        if (!evidenceRow) {
          add(
            "dangling_evidence",
            `${meta.collection}[${index}].evidenceRefs`,
            `Evidence ${evidenceRef} does not resolve.`,
          );
        } else if (
          evidenceRow.subjectRef !== record.id ||
          evidenceRow.subjectType !== meta.evidenceType ||
          evidenceRow.scope !== "current-revision"
        ) {
          add(
            "misattributed_evidence",
            `${meta.collection}[${index}].evidenceRefs`,
            `${domain} evidence must use subject type ${meta.evidenceType} and bind the exact current record.`,
          );
        }
      }
    }
  }

  const dependencyBlockTargets = [
    ...new Set(
      Object.entries(DOMAIN_META)
        .filter(([domain]) => domain !== "revision-delta")
        .map(([, meta]) => meta.collection),
    ),
  ].flatMap((collection) => rows(value[collection]));
  for (const [index, dependency] of rows(value.dependencies).entries()) {
    if (
      strings(dependency.blocksRefs).some(
        (ref) =>
          ref === dependency.id ||
          dependencyBlockTargets.filter((record) => record.id === ref).length !== 1,
      )
    ) {
      add(
        "invalid_dependency_reference",
        `dependencies[${index}].blocksRefs`,
        "Every dependency block reference must resolve to exactly one governed current record.",
      );
    }
  }

  for (const [index, commitment] of rows(value.commitments).entries()) {
      const owners = strings(commitment.authorityOwnerRefs)
        .map((ref) => principals.get(ref))
        .filter(Boolean);
      const ownerRefsComplete =
        owners.length === strings(commitment.authorityOwnerRefs).length;
      const partnerOwners = owners.filter(
        (owner) =>
          owner.organization === "partner" &&
          strings(owner.decisionRights).includes("partner-commitment"),
      );
      const vendorOwners = owners.filter(
        (owner) =>
          owner.organization === "vendor" &&
          strings(owner.decisionRights).includes("vendor-commitment"),
      );
      const ownerShapeValid =
        ownerRefsComplete &&
        ((commitment.committingParty === "partner" &&
          partnerOwners.length === owners.length &&
          partnerOwners.length > 0) ||
          (commitment.committingParty === "vendor" &&
            vendorOwners.length === owners.length &&
            vendorOwners.length > 0) ||
          (commitment.committingParty === "joint" &&
            partnerOwners.length > 0 &&
            vendorOwners.length > 0 &&
            partnerOwners.length + vendorOwners.length === owners.length));
      if (!ownerShapeValid) {
        add(
          "invalid_commitment_authority",
          `commitments[${index}].authorityOwnerRefs`,
          "Commitment owners must exist, match the committing party organization, and hold that party's exact commitment right; joint commitments require both parties.",
        );
      }

      const approvalRows = strings(commitment.approvalEvidenceRefs).map((ref) =>
        evidence.get(ref),
      );
      const approvalRowIsValid = (row) =>
        Boolean(
          row &&
          row.scope === "current-revision" &&
          row.subjectType === "commitment" &&
          row.assertion === "approval-granted" &&
          row.subjectRef === commitment.id &&
          row.subjectContentDigest === commitment.contentDigest &&
          strings(commitment.evidenceRefs).includes(row.id) &&
          strings(commitment.authorityOwnerRefs).includes(row.issuedByPrincipalRef),
        );
      const approvalIssuers = approvalRows
        .filter(approvalRowIsValid)
        .map((row) => principals.get(row.issuedByPrincipalRef))
        .filter(Boolean);
      const partnerApproval = approvalIssuers.some(
        (owner) =>
          owner.organization === "partner" &&
          strings(owner.decisionRights).includes("partner-commitment"),
      );
      const vendorApproval = approvalIssuers.some(
        (owner) =>
          owner.organization === "vendor" &&
          strings(owner.decisionRights).includes("vendor-commitment"),
      );
      const approvalsValid =
        approvalRows.every(approvalRowIsValid) &&
        ((commitment.committingParty === "partner" && partnerApproval) ||
          (commitment.committingParty === "vendor" && vendorApproval) ||
          (commitment.committingParty === "joint" && partnerApproval && vendorApproval));
      if (!approvalsValid) {
        add(
          "invalid_commitment_approval",
          `commitments[${index}].approvalEvidenceRefs`,
          "Commitment approvals must be reciprocal current evidence issued by the exact authorized party owners; joint commitments require approval evidence from both organizations.",
        );
      }
  }

  for (const [index, row] of evidenceRows.entries()) {
      if (row.scope !== "current-revision") continue;
      let candidates;
      let reciprocalRefs;
      if (row.subjectType === "domain-applicability") {
        candidates = coverageRows.filter((candidate) => candidate.id === row.subjectRef);
        reciprocalRefs = strings(candidates[0]?.applicabilityEvidenceRefs);
      } else {
        const domain = SUBJECT_DOMAIN[row.subjectType];
        candidates = recordsForDomain(value, domain).filter(
          (candidate) => candidate.id === row.subjectRef,
        );
        reciprocalRefs = strings(candidates[0]?.evidenceRefs);
      }
      if (candidates.length !== 1 || !reciprocalRefs.includes(row.id)) {
        add(
          "orphan_current_evidence",
          `evidence[${index}]`,
          "Every current evidence row must resolve to exactly one record in its declared subject domain and be reciprocally listed by that record.",
        );
      } else if (row.subjectContentDigest !== candidates[0].contentDigest) {
        add(
          "invalid_evidence_fingerprint",
          `evidence[${index}].subjectContentDigest`,
          "Current evidence must bind the exact immutable content digest of its subject record.",
        );
      }
  }

  if (!orderedByTimestamp(value.actions, "recordedAt")) {
    add("invalid_action_chronology", "actions", "Actions must be ordered by recordedAt.");
  }
  for (const [index, action] of rows(value.actions).entries()) {
    const recordedAt = timestamp(action.recordedAt);
    const dueAt = timestamp(action.dueAt);
    if (
      recordedAt === null ||
      dueAt === null ||
      recordedAt > embeddedAsOf ||
      dueAt < recordedAt
    ) {
      add(
        "invalid_action_chronology",
        `actions[${index}]`,
        "Action times must be valid, recordedAt must not exceed the review asOf, and dueAt must not predate recordedAt.",
      );
    }
  }
  findings.push(
    ...lineageFindings(value, {
      collection: "actions",
      parentField: "previousActionRef",
      timeField: "recordedAt",
      code: "invalid_action_lineage",
      label: "Action",
    }),
  );
  const decisionRows = rows(value.qbrDecisions);
  if (!orderedByTimestamp(decisionRows, "recordedAt")) {
    add(
      "invalid_decision_chronology",
      "qbrDecisions",
      "QBR decisions must be ordered by recordedAt.",
    );
  }
  for (const [index, decision] of decisionRows.entries()) {
    if (timestamp(decision.recordedAt) > embeddedAsOf) {
      add(
        "invalid_decision_chronology",
        `qbrDecisions[${index}].recordedAt`,
        "QBR decision recordedAt must not be later than the review asOf.",
      );
    }
    if (
      ["recorded", "superseded"].includes(decision.state) &&
      (strings(decision.evidenceRefs).length === 0 ||
        !strings(decision.evidenceRefs).every(
          (ref) => {
            const row = evidence.get(ref);
            return (
              row?.issuedByPrincipalRef === decision.decisionMakerRef &&
              row.assertion === "decision-recorded" &&
              timestamp(row.observedAt) !== null &&
              timestamp(row.observedAt) <= timestamp(decision.recordedAt)
            );
          },
        ))
    ) {
      add(
        "invalid_decision_evidence",
        `qbrDecisions[${index}].evidenceRefs`,
        "A recorded or superseded QBR decision requires decision-recorded evidence issued by its named decision maker no later than the decision time.",
      );
    }
    const successors = decisionRows.filter(
      (candidate) => candidate.supersedesDecisionRef === decision.id,
    );
    if (
      (decision.state === "superseded" &&
        (successors.length !== 1 ||
          !["recorded", "superseded"].includes(successors[0].state))) ||
      (decision.state !== "superseded" && successors.length !== 0)
    ) {
      add(
        "invalid_decision_supersession",
        `qbrDecisions[${index}].state`,
        "A superseded QBR decision must have exactly one recorded or superseded successor, and only superseded decisions may be referenced as predecessors.",
      );
    }
  }
  findings.push(
    ...lineageFindings(value, {
      collection: "qbrDecisions",
      parentField: "supersedesDecisionRef",
      timeField: "recordedAt",
      code: "invalid_decision_lineage",
      label: "QBR decision",
    }),
  );

  for (const [index, opportunity] of rows(value.opportunities).entries()) {
    if (opportunity.mutationState !== "reference-only") {
      add(
        "opportunity_mutation_claim",
        `opportunities[${index}].mutationState`,
        "Opportunities must remain reference-only.",
      );
    }
  }
  for (const [index, risk] of rows(value.risks).entries()) {
    if (risk.acceptanceState !== "not-accepted") {
      add(
        "risk_acceptance_claim",
        `risks[${index}].acceptanceState`,
        "The artifact cannot accept risk.",
      );
    }
  }

  const universes = new Map(
    Object.keys(DOMAIN_META).map((domain) => [
      domain,
      new Map(recordsForDomain(value, domain).map((row) => [row.id, row])),
    ]),
  );
  const predecessorManifest = isRecord(value.predecessorManifest)
    ? value.predecessorManifest
    : {};
  const predecessorManifestRows = rows(predecessorManifest.records);
  const predecessorManifestScope = confidentialityScopes.get(
    predecessorManifest.confidentialityScopeRef,
  );
  const predecessorManifestKeys = predecessorManifestRows.map(
    (row) => `${row.domain}:${row.recordRef}`,
  );
  if (
    predecessorManifest.partnerId !== identity.partnerId ||
    predecessorManifest.planId !== identity.planId ||
    predecessorManifest.planRevision !== identity.predecessorRevision ||
    !hasValidPartnerGovernanceSignature(
      predecessorManifest,
      identity,
      trustedGovernanceKeys,
    ) ||
    timestamp(predecessorManifest.observedAt) === null ||
    embeddedAsOf === null ||
    timestamp(predecessorManifest.observedAt) > embeddedAsOf ||
    !hasRight(principals, predecessorManifest.issuedByPrincipalRef, "reconcile-plan") ||
    !predecessorManifestScope ||
    !strings(predecessorManifestScope.audienceRefs).includes(value.handoff?.accountableOwnerRef) ||
    predecessorManifestRows.length === 0 ||
    new Set(predecessorManifestKeys).size !== predecessorManifestKeys.length
  ) {
    add(
      "invalid_predecessor_manifest",
      "predecessorManifest",
      "The predecessor manifest must be a unique, controlled, independently signed snapshot of the declared predecessor revision visible to the handoff owner.",
    );
  }
  const seenCurrentDeltaRefs = new Set();
  const seenPredecessorDeltaRefs = new Set();
  for (const [index, delta] of rows(value.revisionDelta).entries()) {
    const meta = DOMAIN_META[delta.domain];
    const currentUniverse = universes.get(delta.domain);
    if (!meta || delta.domain === "revision-delta" || !currentUniverse) {
      add(
        "invalid_revision_delta",
        `revisionDelta[${index}].domain`,
        "Revision delta must name an ordinary plan domain.",
      );
      continue;
    }
    const currentRefs = strings(delta.currentRecordRefs);
    const predecessorRefs = strings(delta.predecessorRecordRefs);
    const currentFingerprintRows = rows(delta.currentRecordFingerprints);
    const predecessorFingerprintRows = rows(delta.predecessorRecordFingerprints);
    const currentFingerprints = fingerprintMap(delta.currentRecordFingerprints);
    const predecessorFingerprints = fingerprintMap(
      delta.predecessorRecordFingerprints,
    );
    const manifestRows = predecessorManifestRows.filter(
      (row) => row.domain === delta.domain,
    );
    const manifestFingerprints = new Map(
      manifestRows.map((row) => [row.recordRef, row.contentDigest]),
    );
    const selectedManifestRows = predecessorRefs
      .map((ref) => manifestRows.find((row) => row.recordRef === ref))
      .filter(Boolean);
    const selectedManifestEvidenceRefs = selectedManifestRows.flatMap((row) =>
      strings(row.evidenceRefs),
    );
    if (
      selectedManifestRows.length !== predecessorRefs.length ||
      !sameSet(delta.predecessorEvidenceRefs, selectedManifestEvidenceRefs) ||
      predecessorRefs.some(
        (ref) => predecessorFingerprints.get(ref) !== manifestFingerprints.get(ref),
      )
    ) {
      add(
        "invalid_predecessor_manifest",
        `revisionDelta[${index}].predecessorRecordRefs`,
        "Each revision delta must match its selected predecessor manifest records, fingerprints, and evidence exactly.",
      );
    }
    for (const [refs, seen, path] of [
      [currentRefs, seenCurrentDeltaRefs, "currentRecordRefs"],
      [predecessorRefs, seenPredecessorDeltaRefs, "predecessorRecordRefs"],
    ]) {
      for (const ref of refs) {
        const key = `${delta.domain}:${ref}`;
        if (seen.has(key)) {
          add(
            "duplicate_revision_delta_record",
            `revisionDelta[${index}].${path}`,
            "A domain record may appear in only one delta on each revision side.",
          );
        }
        seen.add(key);
      }
    }
    if (!currentRefs.every((ref) => currentUniverse.has(ref))) {
      add(
        "invalid_revision_delta",
        `revisionDelta[${index}].currentRecordRefs`,
        "Every current record ref must resolve in the exact current domain universe.",
      );
    }
    if (
      currentFingerprintRows.length !== currentRefs.length ||
      currentFingerprints.size !== currentFingerprintRows.length ||
      !sameSet([...currentFingerprints.keys()], currentRefs) ||
      currentRefs.some(
        (ref) => currentFingerprints.get(ref) !== currentUniverse.get(ref)?.contentDigest,
      )
    ) {
      add(
        "invalid_revision_fingerprint",
        `revisionDelta[${index}].currentRecordFingerprints`,
        "Current fingerprints must exactly bind every current record ref to its canonical content digest.",
      );
    }
    if (
      predecessorFingerprintRows.length !== predecessorRefs.length ||
      predecessorFingerprints.size !== predecessorFingerprintRows.length ||
      !sameSet([...predecessorFingerprints.keys()], predecessorRefs)
    ) {
      add(
        "invalid_revision_fingerprint",
        `revisionDelta[${index}].predecessorRecordFingerprints`,
        "Predecessor fingerprints must exactly bind every predecessor record ref.",
      );
    }
    const expectedCurrentEvidence = currentRefs.flatMap(
      (ref) => strings(currentUniverse.get(ref)?.evidenceRefs),
    );
    if (!sameSet(delta.evidenceRefs, expectedCurrentEvidence)) {
      add(
        "invalid_revision_delta_evidence",
        `revisionDelta[${index}].evidenceRefs`,
        "Current delta evidence must exactly equal the current records' evidence.",
      );
    }
    const expectedPredecessorEvidence = evidenceRows
      .filter(
        (row) =>
          row.scope === "predecessor-revision" &&
          row.subjectType === meta.evidenceType &&
          predecessorRefs.includes(row.subjectRef),
      )
      .map((row) => row.id);
    if (
      !sameSet(delta.predecessorEvidenceRefs, expectedPredecessorEvidence) ||
      predecessorRefs.some(
        (ref) =>
          !evidenceRows.some(
            (row) =>
              row.scope === "predecessor-revision" &&
              row.subjectType === meta.evidenceType &&
              row.subjectRef === ref &&
              row.subjectContentDigest === predecessorFingerprints.get(ref),
          ),
      )
    ) {
      add(
        "invalid_revision_delta_evidence",
        `revisionDelta[${index}].predecessorEvidenceRefs`,
        "Predecessor evidence must exactly cover every predecessor record with the domain subject type and predecessor identity.",
      );
    }

    const sameIdentity = sameSet(currentRefs, predecessorRefs);
    const sameContent =
      sameIdentity &&
      currentRefs.every(
        (ref) => currentFingerprints.get(ref) === predecessorFingerprints.get(ref),
      );
    const derivedChange =
      currentRefs.length > 0 && predecessorRefs.length === 0
        ? "added"
        : currentRefs.length === 0 && predecessorRefs.length > 0
          ? "removed"
          : sameIdentity && sameContent
            ? "unchanged"
            : sameIdentity && currentRefs.length > 0
              ? "changed"
              : null;
    if (delta.change !== derivedChange) {
      add(
        "invalid_revision_delta_semantics",
        `revisionDelta[${index}].change`,
        "Added, removed, changed, and unchanged are derived from exact record identities plus immutable content-digest comparison.",
      );
    }
  }
  for (const [index, manifestRow] of predecessorManifestRows.entries()) {
    const meta = DOMAIN_META[manifestRow.domain];
    const manifestEvidenceRefs = strings(manifestRow.evidenceRefs);
    const manifestEvidence = manifestEvidenceRefs.map((ref) => evidence.get(ref));
    const manifestEvidenceFingerprints = fingerprintMap(
      manifestRow.evidenceFingerprints,
      "evidenceRef",
    );
    const consumingDeltas = rows(value.revisionDelta).filter(
      (delta) =>
        delta.domain === manifestRow.domain &&
        strings(delta.predecessorRecordRefs).includes(manifestRow.recordRef) &&
        manifestEvidenceRefs.every((ref) =>
          strings(delta.predecessorEvidenceRefs).includes(ref),
        ) &&
        fingerprintMap(delta.predecessorRecordFingerprints).get(manifestRow.recordRef) ===
          manifestRow.contentDigest,
    );
    if (
      !meta ||
      consumingDeltas.length !== 1 ||
      manifestEvidenceRefs.length === 0 ||
      !sameSet(
        manifestEvidenceRefs,
        rows(manifestRow.evidenceFingerprints).map((row) => row.evidenceRef),
      ) ||
      manifestEvidence.some(
        (predecessorEvidence) =>
          !predecessorEvidence ||
          predecessorEvidence.scope !== "predecessor-revision" ||
          predecessorEvidence.partnerId !== identity.partnerId ||
          predecessorEvidence.planId !== identity.planId ||
          predecessorEvidence.planRevision !== identity.predecessorRevision ||
          predecessorEvidence.subjectType !== meta.evidenceType ||
          predecessorEvidence.subjectRef !== manifestRow.recordRef ||
          predecessorEvidence.subjectContentDigest !== manifestRow.contentDigest ||
          manifestEvidenceFingerprints.get(predecessorEvidence.id) !==
            computePartnerRecordDigest(predecessorEvidence) ||
          timestamp(predecessorEvidence.observedAt) === null ||
          timestamp(predecessorEvidence.observedAt) >
            timestamp(predecessorManifest.observedAt),
      )
    ) {
      add(
        "invalid_predecessor_manifest",
        `predecessorManifest.records[${index}]`,
        "Every predecessor manifest row must have exact predecessor evidence and be consumed by exactly one matching revision delta.",
      );
    }
  }
  for (const [index, row] of evidenceRows.entries()) {
    if (row.scope !== "predecessor-revision") continue;
    const domain = SUBJECT_DOMAIN[row.subjectType];
    const matches = rows(value.revisionDelta).filter((delta) => {
      if (
        delta.domain !== domain ||
        !strings(delta.predecessorRecordRefs).includes(row.subjectRef) ||
        !strings(delta.predecessorEvidenceRefs).includes(row.id)
      ) {
        return false;
      }
      return (
        fingerprintMap(delta.predecessorRecordFingerprints).get(row.subjectRef) ===
        row.subjectContentDigest
      );
    });
    if (matches.length !== 1) {
      add(
        "orphan_predecessor_evidence",
        `evidence[${index}]`,
        "Every predecessor evidence row must bind exactly one predecessor record fingerprint in exactly one revision delta.",
      );
    }
  }
  for (const [domain, universe] of universes.entries()) {
    if (domain === "revision-delta") continue;
    for (const recordRef of universe.keys()) {
      const occurrences = rows(value.revisionDelta).filter(
        (delta) =>
          delta.domain === domain &&
          strings(delta.currentRecordRefs).includes(recordRef),
      ).length;
      if (occurrences !== 1) {
        add(
          "incomplete_revision_delta_coverage",
          DOMAIN_META[domain].collection,
          `Current ${domain} record ${recordRef} must appear exactly once in the revision trace.`,
        );
      }
    }
  }

  for (const [index, row] of coverageRows.entries()) {
    const meta = DOMAIN_META[row.domain];
    const universe = universes.get(row.domain);
    if (!meta || !universe) continue;
    if (!sameSet(row.segmentRefs, [...segmentIdSet])) {
      add(
        "invalid_period_coverage",
        `coverage[${index}].segmentRefs`,
        `Domain ${row.domain} must cover every period segment exactly once.`,
      );
    }
    const segmentEvidenceComplete = strings(row.segmentRefs).every((segmentRef) =>
      [...universe.values()].every((record) => {
        const recordEvidenceRefs =
          row.domain === "revision-delta"
            ? [
                ...strings(record.evidenceRefs),
                ...strings(record.predecessorEvidenceRefs),
              ]
            : strings(record.evidenceRefs);
        return recordEvidenceRefs.some((ref) =>
          strings(evidence.get(ref)?.segmentRefs).includes(segmentRef),
        );
      }),
    );
    if (
      ["covered", "gap"].includes(row.state) &&
      !segmentEvidenceComplete
    ) {
      add(
        "invalid_period_coverage",
        `coverage[${index}].segmentRefs`,
        `Every ${row.domain} record requires evidence bound to every claimed period segment.`,
      );
    }
    if (!hasDomainRight(principals, row.domain, row.ownerRef)) {
      add(
        "invalid_coverage_owner",
        `coverage[${index}].ownerRef`,
        `Coverage owner must exist and hold ${meta.right}.`,
      );
    }
    if (!strings(row.recordRefs).every((ref) => universe.has(ref))) {
      add(
        "invalid_domain_reference",
        `coverage[${index}].recordRefs`,
        `Domain ${row.domain} contains a record outside its exact universe.`,
      );
    }
    const coveredHasEvidence = [...universe.values()].every((record) =>
      row.domain === "revision-delta"
        ? strings(record.evidenceRefs).length > 0 ||
          strings(record.predecessorEvidenceRefs).length > 0
        : strings(record.evidenceRefs).length > 0,
    );
    if (
      ["covered", "gap"].includes(row.state) &&
      (universe.size === 0 ||
        !sameSet(row.recordRefs, [...universe.keys()]) ||
        !coveredHasEvidence)
    ) {
      add(
        "incomplete_domain_coverage",
        `coverage[${index}].recordRefs`,
        `Covered or gap domain ${row.domain} requires a non-empty exact record universe with required evidence.`,
      );
    }
    if (universe.size === 0 && row.state !== "not-applicable-by-owner") {
      add(
        "invalid_empty_domain_coverage",
        `coverage[${index}].state`,
        `Empty domain ${row.domain} must use owner-authorized not-applicable semantics.`,
      );
    }
    const matchingGaps = rows(value.gaps).filter((gap) => gap.domain === row.domain);
    if (row.state === "gap" && matchingGaps.length !== 1) {
      add(
        "invalid_gap_consistency",
        `coverage[${index}]`,
        `Gap domain ${row.domain} requires exactly one same-domain gap record.`,
      );
    }

    const exactApplicabilityEvidence = evidenceRows
      .filter(
        (evidenceRow) =>
          evidenceRow.subjectType === "domain-applicability" &&
          evidenceRow.subjectRef === row.id &&
          evidenceRow.scope === "current-revision",
      )
      .map((evidenceRow) => evidenceRow.id);
    if (row.state === "not-applicable-by-owner") {
      const attributable = strings(row.applicabilityEvidenceRefs).every(
        (ref) =>
          evidence.get(ref)?.issuedByPrincipalRef === row.ownerRef &&
          sameSet(evidence.get(ref)?.segmentRefs, row.segmentRefs),
      );
      if (
        universe.size !== 0 ||
        strings(row.recordRefs).length !== 0 ||
        strings(row.applicabilityEvidenceRefs).length === 0 ||
        !sameSet(row.applicabilityEvidenceRefs, exactApplicabilityEvidence) ||
        !attributable
      ) {
        add(
          "invalid_not_applicable",
          `coverage[${index}]`,
          "Not applicable requires an empty domain universe and exact current applicability evidence issued by the authorized domain owner.",
        );
      }
    } else if (
      strings(row.applicabilityEvidenceRefs).length > 0 ||
      exactApplicabilityEvidence.length > 0
    ) {
      add(
        "invalid_not_applicable",
        `coverage[${index}].applicabilityEvidenceRefs`,
        "Applicability evidence is permitted only for a not-applicable domain.",
      );
    }
  }
  for (const domain of Object.keys(DOMAIN_META)) {
    if (coverageRows.filter((row) => row.domain === domain).length !== 1) {
      add(
        "invalid_domain_coverage",
        "coverage",
        `Domain ${domain} must appear exactly once.`,
      );
    }
  }

  for (const [index, conflict] of rows(governance.conflicts).entries()) {
    const conflictEvidence = strings(conflict.evidenceRefs).map((ref) => evidence.get(ref));
    const domains = new Set(
      conflictEvidence.filter(Boolean).map((row) => evidenceDomain(row, coverage)),
    );
    const reciprocalRefs = evidenceRows
      .filter((row) => strings(row.conflictRefs).includes(conflict.id))
      .map((row) => row.id);
    if (
      conflictEvidence.some((row) => !row) ||
      domains.size !== 1 ||
      (domains.size === 1 && !domains.has(conflict.domain)) ||
      conflictEvidence.some((row) => row?.scope !== conflict.scope) ||
      !sameSet(conflict.evidenceRefs, reciprocalRefs)
    ) {
      add(
        "invalid_conflict_governance",
        `evidenceGovernance.conflicts[${index}].evidenceRefs`,
        "A conflict must declare its exact domain and scope and bind reciprocally to existing evidence from that domain and scope.",
      );
    }
    const domain = [...domains][0];
    if (!hasDomainRight(principals, domain, conflict.dispositionOwnerRef)) {
      add(
        "invalid_governance_owner",
        `evidenceGovernance.conflicts[${index}].dispositionOwnerRef`,
        "Conflict disposition owner lacks the exact domain decision right.",
      );
    }
    const dispositionRefs = strings(conflict.dispositionEvidenceRefs);
    const dispositionEvidence = dispositionRefs.map((ref) => evidence.get(ref));
    const reciprocalDispositionRefs = evidenceRows
      .filter((row) => strings(row.dispositionConflictRefs).includes(conflict.id))
      .map((row) => row.id);
    const latestConflictTime = Math.max(
      ...conflictEvidence.map((row) => timestamp(row?.observedAt) ?? Number.NEGATIVE_INFINITY),
    );
    if (
      (conflict.state === "unresolved" && dispositionRefs.length !== 0) ||
      (conflict.state !== "unresolved" &&
        (dispositionRefs.length === 0 ||
          !sameSet(dispositionRefs, reciprocalDispositionRefs) ||
          dispositionEvidence.some(
            (row) =>
              !row ||
              row.scope !== conflict.scope ||
              evidenceDomain(row, coverage) !== conflict.domain ||
              row.issuedByPrincipalRef !== conflict.dispositionOwnerRef ||
              (timestamp(row.observedAt) ?? Number.NEGATIVE_INFINITY) <= latestConflictTime,
          )))
    ) {
      add(
        "invalid_conflict_disposition",
        `evidenceGovernance.conflicts[${index}].dispositionEvidenceRefs`,
        "Resolved conflict evidence must reciprocally bind the exact conflict, match its domain, scope, and disposition owner, and postdate all conflicting evidence.",
      );
    }
  }

  for (const [index, path] of rows(governance.escalationPaths).entries()) {
    const meta = DOMAIN_META[path.domain];
    if (
      !meta ||
      !hasDomainRight(principals, path.domain, path.ownerRef) ||
      !hasRight(principals, path.escalationOwnerRef, "escalate")
    ) {
      add(
        "invalid_escalation_path",
        `evidenceGovernance.escalationPaths[${index}]`,
        "Escalation path must have the exact domain owner and an escalation-authorized owner.",
      );
    }
    const resolutionRefs = strings(path.resolutionEvidenceRefs);
    const resolutionEvidence = resolutionRefs.map((ref) => evidence.get(ref));
    const reciprocalResolutionRefs = evidenceRows
      .filter((row) => strings(row.resolutionEscalationRefs).includes(path.id))
      .map((row) => row.id);
    const resolvedAt = timestamp(path.resolvedAt);
    if (
      (path.state === "unresolved" &&
        (resolutionRefs.length !== 0 || path.resolvedAt !== null)) ||
      (path.state === "resolved" &&
        (resolutionRefs.length === 0 ||
          !sameSet(resolutionRefs, reciprocalResolutionRefs) ||
          resolvedAt === null ||
          resolvedAt > embeddedAsOf ||
          resolutionEvidence.some(
            (row) =>
              !row ||
              row.scope !== "current-revision" ||
              evidenceDomain(row, coverage) !== path.domain ||
              row.issuedByPrincipalRef !== path.escalationOwnerRef ||
              (timestamp(row.observedAt) ?? Number.POSITIVE_INFINITY) > resolvedAt,
          )))
    ) {
      add(
        "invalid_escalation_resolution",
        `evidenceGovernance.escalationPaths[${index}].resolutionEvidenceRefs`,
        "A resolved escalation requires reciprocal same-domain evidence issued by its escalation owner no later than its resolution time.",
      );
    }
  }
  for (const [index, gap] of rows(value.gaps).entries()) {
    const meta = DOMAIN_META[gap.domain];
    const path = escalationPaths.get(gap.escalationPathRef);
    if (!meta || !hasDomainRight(principals, gap.domain, gap.ownerRef)) {
      add(
        "invalid_gap_owner",
        `gaps[${index}].ownerRef`,
        "Gap owner lacks the exact domain decision right.",
      );
    }
    if (!path || path.domain !== gap.domain || path.ownerRef !== gap.ownerRef) {
      add(
        "invalid_escalation_path",
        `gaps[${index}].escalationPathRef`,
        "Gap escalation path must resolve to the same domain and accountable owner.",
      );
    }
    const matchingCoverage = coverageRows.filter(
      (row) => row.domain === gap.domain && row.state === "gap",
    );
    if (matchingCoverage.length !== 1) {
      add(
        "invalid_gap_consistency",
        `gaps[${index}].domain`,
        "Every gap record must map exactly once to its same-domain coverage row in gap state.",
      );
    }
  }

  const blocked = rows(value.handoff?.blockedAuthorityActions);
  if (!sameSet(blocked.map((row) => row.category), Object.keys(RESERVED_ACTION_RIGHT))) {
    add(
      "incomplete_authority_boundary",
      "handoff.blockedAuthorityActions",
      "Every reserved authority category must appear exactly once.",
    );
  }
  for (const [index, row] of blocked.entries()) {
    const right = RESERVED_ACTION_RIGHT[row.category];
    if (!right || !hasRight(principals, row.ownerRef, right)) {
      add(
        "invalid_authority_owner",
        `handoff.blockedAuthorityActions[${index}].ownerRef`,
        `Reserved action owner must exist and hold ${right ?? "the mapped decision right"}.`,
      );
    }
  }
  if (
    isRecord(value.authorityClaims) &&
    Object.values(value.authorityClaims).some((claim) => claim !== false)
  ) {
    add(
      "reserved_authority_claim",
      "authorityClaims",
      "All authority claims must remain false.",
    );
  }
  if (!hasRight(principals, value.handoff?.accountableOwnerRef, "reconcile-plan")) {
    add(
      "invalid_handoff_owner",
      "handoff.accountableOwnerRef",
      "Handoff owner must exist and hold reconcile-plan authority.",
    );
  }
  const readinessBlockers = [
    coverageRows.some((row) => row.state === "gap"),
    rows(value.gaps).length > 0,
    rows(governance.conflicts).some((conflict) => conflict.state === "unresolved"),
    rows(governance.escalationPaths).some((path) => path.state === "unresolved"),
    rows(value.capabilities).some((row) => row.observedState !== "evidence-current"),
    rows(value.designations).some((row) => row.observedState !== "evidence-current"),
    rows(value.solutionPlays).some((row) => row.observedState !== "evidence-current"),
    rows(value.eligibilityEvidence).some((row) => row.assessment !== "evidence-present"),
    rows(value.commitments).some((row) => ["at-risk", "blocked"].includes(row.state)),
    rows(value.dependencies).some((row) => row.state !== "resolved"),
    rows(value.risks).some((row) => row.state === "open"),
    rows(value.actions).some((row) => ["open", "blocked"].includes(row.state)),
  ];
  if (value.handoff?.state === "ready-for-owner-review" && readinessBlockers.some(Boolean)) {
    add(
      "invalid_handoff_readiness",
      "handoff.state",
      "Ready for owner review requires complete coverage and no outstanding gaps, unresolved conflicts or escalations, or other required blockers.",
    );
  }

  if (principalRows.length !== principals.size || evidenceRows.length !== evidence.size) {
    add(
      "duplicate_or_missing_identity",
      "",
      "Principal and evidence identities must be complete and unique.",
    );
  }
  return findings;
}
