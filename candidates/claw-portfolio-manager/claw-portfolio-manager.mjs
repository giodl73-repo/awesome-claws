import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import {
  closeSync,
  openSync,
  readFileSync,
  readSync,
} from "node:fs";
import {
  readdir,
  readFile,
} from "node:fs/promises";
import {
  extname,
  join,
  relative,
  resolve,
} from "node:path";
import { pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { readCatalog, root } from "../../scripts/catalog-source.mjs";
import {
  contributionSimilarityReport,
  validateContributionProposal,
} from "../../scripts/contribution-lib.mjs";
import {
  JSON_LIMITS,
  canonicalJson,
  normalizeJsonValue,
  sha256Digest,
} from "./candidate-utils.mjs";
import { runStrongestComposition } from "./strongest-composition.mjs";

export const V2_SCHEMA_VERSION =
  "awesomeClaws.clawPortfolioManagerCandidate.v2";
export const V2_RESULT_VERSION =
  "awesomeClaws.clawPortfolioManagerResult.v2";
export const CLASSIFIER_VERSION = "claw-portfolio-classifier-v2";
export const PINNED_CATALOG_REVISION =
  "0c1bfb3c973a9940f301a5001e77435789993555";
export const CLASSIFIER_CODE_DIGEST = sha256Digest({
  version: CLASSIFIER_VERSION,
  precedence: [
    "prohibited-authority",
    "duplicate",
    "retire",
    "product-decision",
    "variant",
    "improve",
    "compose-if-feasible",
    "new-if-lossy-and-distinct",
  ],
});
export const PINNED_EXTERNAL_ROOT_PUBLIC_KEY_PEM =
  "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAFTAnp8n6VZ4sPY72cAXktF/YFu0ZN24Upu3eqq9xQJY=\n-----END PUBLIC KEY-----\n";
export const PINNED_TRUST_ROOT_REVISION =
  "sha256:1af5c3c40744e5db717bc2ffbf669fce44f9eff789744cbdf11709ee2583f847";
export const PINNED_TRUST_PREDECESSOR_REVISION =
  "sha256:981edeaf411ad41c3b2ae91818832db405fcc417e556a52abd0cc0f76b45d262";

const V2_LIMITS = Object.freeze({
  inputBytes: 1024 * 1024,
  trustBytes: 128 * 1024,
  packageTreeBytes: 2 * 1024 * 1024,
  outputBytes: 1024 * 1024,
});

const AUTHORITY = Object.freeze({
  merge: false,
  publish: false,
  budgetIncrease: false,
  riskAcceptance: false,
  externalMutation: false,
  productionClawMutation: false,
  sensitivePersonalInference: false,
  reseal: false,
});

const schema = JSON.parse(
  readFileSync(new URL("./schemas/claw-portfolio-manager.schema.json", import.meta.url)),
);
const trustSchema = JSON.parse(
  readFileSync(new URL("./schemas/public-trust.schema.json", import.meta.url)),
);
const packageTreeSchema = JSON.parse(
  readFileSync(new URL("./schemas/package-tree-v1.schema.json", import.meta.url)),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const validateTrustSchema = ajv.compile(trustSchema);
const validatePackageTreeSchema = ajv.compile(packageTreeSchema);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function rows(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function strings(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string")
    : [];
}

function compare(left, right) {
  return String(left) < String(right)
    ? -1
    : String(left) > String(right)
      ? 1
      : 0;
}

function sorted(value) {
  return [...strings(value)].sort(compare);
}

function timestamp(value) {
  if (typeof value !== "string") return null;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/u.exec(
      value,
    );
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const maximumDay =
    month >= 1 && month <= 12
      ? new Date(Date.UTC(year === 0 ? 400 : year, month, 0)).getUTCDate()
      : 0;
  if (
    day < 1 ||
    day > maximumDay ||
    Number(hourText) > 23 ||
    Number(minuteText) > 59 ||
    Number(secondText) > 59 ||
    (match[7] !== "Z" &&
      (Number(match[8]) > 23 || Number(match[9]) > 59))
  ) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function grantActiveAt(grant, instant) {
  const value = timestamp(instant);
  const notBefore = timestamp(grant?.notBefore);
  const expiresAt = timestamp(grant?.expiresAt);
  return (
    value !== null &&
    notBefore !== null &&
    expiresAt !== null &&
    notBefore <= value &&
    expiresAt >= value
  );
}

export function budgetPeriodContains(period, instant) {
  const value = timestamp(instant);
  const start = timestamp(`${period?.startsOn}T00:00:00Z`);
  const end = timestamp(`${period?.endsOn}T00:00:00Z`);
  const dayAfterEnd = end === null ? null : end + 86_400_000;
  return (
    value !== null &&
    start !== null &&
    end !== null &&
    start <= end &&
    start <= value &&
    value < dayAfterEnd
  );
}

function exactKeys(value, keys) {
  return (
    isRecord(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function mapById(value) {
  return new Map(rows(value).map((item) => [item.id, item]));
}

function sameSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const a = [...left].sort(compare);
  const b = [...right].sort(compare);
  return (
    new Set(a).size === a.length &&
    new Set(b).size === b.length &&
    a.length === b.length &&
    a.every((item, index) => item === b[index])
  );
}

function finding(code, path) {
  return { code, path };
}

function uniqueFindings(value) {
  const seen = new Set();
  return value
    .filter((item) => {
      const key = `${item.code}\0${item.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(
      (left, right) =>
        compare(left.code, right.code) || compare(left.path, right.path),
    );
}

function schemaFindings(validate, value, path) {
  if (validate(value)) return [];
  return (validate.errors ?? []).map((error) =>
    finding(
      "invalid-schema",
      `${path}${error.instancePath || "/"}#${error.keyword}`,
    ),
  );
}

function normalize(value, maxBytes) {
  return normalizeJsonValue(value, {
    ...JSON_LIMITS,
    maxBytes,
  });
}

function strictBase64(value) {
  if (typeof value !== "string") return null;
  try {
    const bytes = Buffer.from(value, "base64");
    return bytes.toString("base64") === value ? bytes : null;
  } catch {
    return null;
  }
}

function bytesDigest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function unsigned(value) {
  const { signature: _signature, ...content } = value;
  return content;
}

function signedPayload(value) {
  return Buffer.from(canonicalJson(unsigned(value)), "utf8");
}

function contentRevision(value) {
  const { revision: _revision, signature: _signature, ...content } = value;
  return sha256Digest(content);
}

export function computeProviderIssueRevision(value) {
  const {
    revision: _revision,
    observedAt: _observedAt,
    ...content
  } = value;
  return sha256Digest(content);
}

export function computeProviderSnapshotRoot(issues) {
  return sha256Digest(
    rows(issues)
      .map((item) => ({
        id: item.id,
        repository: item.repository,
        providerIssueId: item.providerIssueId,
        number: item.number,
        revision: item.revision,
        etag: item.etag,
      }))
      .sort((left, right) => compare(left.id, right.id)),
  );
}

export function computeProviderSnapshotRevision(value) {
  return contentRevision(value);
}

export function computeCompositionAssessmentIdempotency(value) {
  return sha256Digest({
    runId: value.runId,
    decisionId: value.decisionId,
    issueRef: value.issueRef,
    issueRevision: value.issueRevision,
    graphDigest: value.graphDigest,
    proposedClawRefs: sorted(value.proposedClawRefs),
    lossIds: sorted(value.lossIds),
  });
}

export function computeClassificationDecisionDigest(value) {
  return sha256Digest(unsigned(value));
}

export function computeGrantDigest(value) {
  return sha256Digest(unsigned(value));
}

export function computeRunIdempotencyKey(value) {
  return sha256Digest({
    id: value.id,
    decisionId: value.decisionId,
    mode: value.mode,
    budgetPeriodRef: value.budgetPeriodRef,
    portfolioRevision: value.portfolioRevision,
    providerSnapshotRef: value.providerSnapshotRef,
    providerSnapshotRevision: value.providerSnapshotRevision,
    providerSnapshotCompletenessRoot:
      value.providerSnapshotCompletenessRoot,
    packageTreeRef: value.packageTreeRef,
    packageTreeRevision: value.packageTreeRevision,
    predecessorResultDigest: value.predecessorResultDigest,
    predecessorDecisionDigest: value.predecessorDecisionDigest,
    predecessorBudgetDigest: value.predecessorBudgetDigest,
  });
}

export function computeReservationIdempotency(value) {
  return sha256Digest({
    periodId: value.periodId,
    runId: value.runId,
    decisionId: value.decisionId,
    issueRef: value.issueRef,
    issueRevision: value.issueRevision,
    classification: value.classification,
    amounts: value.amounts,
  });
}

export function reservationIdForIssue(issueRef, issueRevision) {
  return `reservation-${sha256Digest({
    issueRef,
    issueRevision,
  }).slice("sha256:".length)}`;
}

export function planIdForIssue(decisionId, issueRef) {
  const readable = `plan-${decisionId}-${issueRef}`;
  return readable.length <= 120
    ? readable
    : `plan-${sha256Digest({ decisionId, issueRef }).slice("sha256:".length)}`;
}

export function computeBudgetLedgerRevision(value) {
  return contentRevision(value);
}

export const BUDGET_HISTORY_GENESIS = sha256Digest({
  ledger: "claw-portfolio-budget-history",
  generation: 0,
});

export function computeBudgetHistoryEntryDigest(value) {
  return sha256Digest({
    sequence: value.sequence,
    periodId: value.periodId,
    runId: value.runId,
    decisionId: value.decisionId,
    runIdempotencyKey: value.runIdempotencyKey,
    reservationIdempotencyKeys: sorted(
      value.reservationIdempotencyKeys,
    ),
    previousEntryDigest: value.previousEntryDigest,
  });
}

export function computeBudgetHistoryRoot(history) {
  return history.length === 0
    ? BUDGET_HISTORY_GENESIS
    : history.at(-1).entryDigest;
}

export function computeUsageRecordRevision(value) {
  const { revision: _revision, ...content } = value;
  return sha256Digest(content);
}

export function computeUsageEnvelopeRevision(value) {
  return contentRevision(value);
}

export function computeTrustKeysRoot(keys) {
  return sha256Digest(
    rows(keys)
      .map((item) => ({ ...item }))
      .sort((left, right) => compare(left.keyId, right.keyId)),
  );
}

export function computeTrustRootRevision(value) {
  return contentRevision(value);
}

export function computePackageTreeRoot(files) {
  return sha256Digest(
    rows(files)
      .map((item) => ({
        path: item.path,
        mediaType: item.mediaType,
        byteLength: item.byteLength,
        digest: item.digest,
      }))
      .sort((left, right) => compare(left.path, right.path)),
  );
}

export function computePackageManifestRoot(trees) {
  return sha256Digest(
    rows(trees)
      .map((item) => ({
        clawId: item.clawId,
        root: item.root,
      }))
      .sort((left, right) => compare(left.clawId, right.clawId)),
  );
}

export function computePackageManifestRevision(value) {
  return contentRevision(value);
}

function publicKeyRecord(pem) {
  try {
    const key = createPublicKey({ key: pem, format: "pem" });
    if (key.type !== "public" || key.asymmetricKeyType !== "ed25519") return null;
    const der = key.export({ type: "spki", format: "der" });
    if (
      der.length !== 44 ||
      key.export({ type: "spki", format: "pem" }).toString() !== pem
    ) {
      return null;
    }
    return { key, fingerprint: bytesDigest(der) };
  } catch {
    return null;
  }
}

function verifyTrust(trust, asOf, findings) {
  findings.push(...schemaFindings(validateTrustSchema, trust, "$.trust"));
  if (!validateTrustSchema(trust)) return new Map();
  const asOfMs = timestamp(asOf);
  const rootKey = publicKeyRecord(PINNED_EXTERNAL_ROOT_PUBLIC_KEY_PEM);
  const signature = strictBase64(trust.root.signature.value);
  if (
    !rootKey ||
    !signature ||
    trust.root.keysRoot !== computeTrustKeysRoot(trust.keys) ||
    trust.root.revision !== computeTrustRootRevision(trust.root) ||
    trust.root.revision !== PINNED_TRUST_ROOT_REVISION ||
    trust.root.predecessorRevision !==
      PINNED_TRUST_PREDECESSOR_REVISION ||
    timestamp(trust.root.issuedAt) === null ||
    timestamp(trust.root.notBefore) === null ||
    timestamp(trust.root.expiresAt) === null ||
    timestamp(trust.root.issuedAt) > timestamp(trust.root.notBefore) ||
    timestamp(trust.root.notBefore) > asOfMs ||
    timestamp(trust.root.expiresAt) < asOfMs ||
    !verifySignature(null, signedPayload(trust.root), rootKey.key, signature)
  ) {
    findings.push(finding("invalid-externally-pinned-trust-root", "$.trust.root"));
  }
  const byId = new Map();
  const fingerprints = new Map();
  for (const [index, item] of trust.keys.entries()) {
    const record = publicKeyRecord(item.publicKeyPem);
    const activated = timestamp(item.activatedAt);
    const revoked = item.revokedAt === null ? null : timestamp(item.revokedAt);
    if (
      !record ||
      activated === null ||
      activated < timestamp(trust.root.notBefore) ||
      activated > timestamp(trust.root.expiresAt) ||
      activated > asOfMs ||
      (item.status === "active" && item.revokedAt !== null) ||
      (item.status === "revoked" &&
        (revoked === null || revoked <= activated || revoked > asOfMs))
    ) {
      findings.push(finding("invalid-trust-key-lifecycle", `$.trust.keys[${index}]`));
      continue;
    }
    if (byId.has(item.keyId) || fingerprints.has(record.fingerprint)) {
      findings.push(finding("shared-or-duplicate-trust-key", `$.trust.keys[${index}]`));
      continue;
    }
    byId.set(item.keyId, { ...item, ...record });
    fingerprints.set(record.fingerprint, item.domain);
  }
  const activeDomains = new Set(
    [...byId.values()]
      .filter((item) => item.status === "active")
      .map((item) => item.domain),
  );
  for (const domain of [
    "catalog",
    "issue",
    "usage",
    "human-grant",
    "classification",
    "composition",
    "run-result",
    "budget",
  ]) {
    if (!activeDomains.has(domain)) {
      findings.push(finding("missing-active-trust-domain", `$.trust.keys.${domain}`));
    }
  }
  return byId;
}

function verifySigned({
  value,
  domain,
  principalRef,
  principalKind,
  signedAt,
  asOf,
  keys,
  findings,
  path,
}) {
  const signer = keys.get(value?.signature?.keyId);
  const signature = strictBase64(value?.signature?.value);
  const signedMs = timestamp(signedAt);
  if (
    !signer ||
    !["active", "revoked"].includes(signer.status) ||
    signer.domain !== domain ||
    signer.principalRef !== principalRef ||
    signer.principalKind !== principalKind ||
    signedMs === null ||
    signedMs > timestamp(asOf) ||
    timestamp(signer.activatedAt) > signedMs ||
    (signer.status === "revoked" &&
      (signer.revokedAt === null ||
        timestamp(signer.revokedAt) <= signedMs)) ||
    !signature ||
    !verifySignature(null, signedPayload(value), signer.key, signature)
  ) {
    findings.push(finding("invalid-domain-signature", path));
    return false;
  }
  return true;
}

function bytesValue(value, path, findings) {
  const bytes = strictBase64(value?.contentBase64);
  if (
    !bytes ||
    bytes.length !== value.byteLength ||
    bytesDigest(bytes) !== value.digest
  ) {
    findings.push(finding("invalid-exact-bytes", path));
    return null;
  }
  return bytes;
}

function safePackagePath(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.includes("\\") &&
    !value.startsWith("/") &&
    !value.split("/").includes("..")
  );
}

function validUniqueStrings(value, maximum = 32) {
  return (
    Array.isArray(value) &&
    value.length <= maximum &&
    value.every(
      (item) =>
        typeof item === "string" &&
        item.length > 0 &&
        item.length <= 120,
    ) &&
    new Set(value).size === value.length
  );
}

function mediaType(path) {
  const extension = extname(path).toLowerCase();
  if (extension === ".json") return "application/json";
  if (extension === ".yml" || extension === ".yaml") return "application/yaml";
  if (extension === ".png") return "image/png";
  if (extension === ".md") return "text/markdown; charset=utf-8";
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".txt") return "text/plain; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  return null;
}

async function listFiles(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const output = { files: [], unsafeEntries: [] };
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      const nested = await listFiles(child);
      output.files.push(...nested.files);
      output.unsafeEntries.push(...nested.unsafeEntries);
    } else if (entry.isFile()) {
      output.files.push(child);
    } else {
      output.unsafeEntries.push(child);
    }
  }
  return output;
}

async function expectedPackageFiles(clawId, catalogById, targetRoot) {
  const entry = catalogById.get(clawId);
  if (!entry) {
    return {
      records: [],
      unsafeEntries: [],
      missingCatalogEntry: true,
    };
  }
  const virtualBytes = Buffer.from(`${canonicalJson(entry)}\n`, "utf8");
  const records = [
    {
      path: "catalog-entry.json",
      mediaType: "application/json",
      byteLength: virtualBytes.length,
      digest: bytesDigest(virtualBytes),
    },
  ];
  const unsafeEntries = [];
  for (const prefix of ["sources", "claws"]) {
    const base = join(targetRoot, prefix, clawId);
    let listed;
    try {
      listed = await listFiles(base);
    } catch {
      unsafeEntries.push(base);
      continue;
    }
    unsafeEntries.push(...listed.unsafeEntries);
    for (const file of listed.files) {
      let content;
      try {
        content = await readFile(file);
      } catch {
        unsafeEntries.push(file);
        continue;
      }
      const path = relative(targetRoot, file).replaceAll("\\", "/");
      records.push({
        path,
        mediaType: mediaType(path),
        byteLength: content.length,
        digest: bytesDigest(content),
      });
    }
  }
  return {
    records: records.sort((left, right) => compare(left.path, right.path)),
    unsafeEntries,
    missingCatalogEntry: false,
  };
}

async function validatePackageTree(
  manifest,
  input,
  keys,
  findings,
  targetRoot,
) {
  findings.push(
    ...schemaFindings(validatePackageTreeSchema, manifest, "$.packageTree"),
  );
  if (!validatePackageTreeSchema(manifest)) return;
  const principals = mapById(input.principals);
  const catalog = await readCatalog({ loadResources: false });
  const catalogById = new Map(catalog.entries.map((item) => [item.id, item]));
  if (
    manifest.revision !== computePackageManifestRevision(manifest) ||
    manifest.root !== computePackageManifestRoot(manifest.trees) ||
    manifest.catalogRevision !== input.run.catalogRevision ||
    manifest.catalogRevision !== PINNED_CATALOG_REVISION ||
    input.run.packageTreeRef !== manifest.id ||
    !principalHas(
      principals,
      manifest.custodianRef,
      "catalog-source-custodian",
      "system",
    ) ||
    !sameSet(
      manifest.trees.map((item) => item.clawId),
      input.onboarding.selectedClawIds,
    )
  ) {
    findings.push(finding("invalid-package-tree-root", "$.packageTree"));
  }
  verifySigned({
    value: manifest,
    domain: "catalog",
    principalRef: manifest.custodianRef,
    principalKind: "system",
    signedAt: manifest.capturedAt,
    asOf: input.run.asOf,
    keys,
    findings,
    path: "$.packageTree.signature",
  });
  for (const [index, tree] of manifest.trees.entries()) {
    const expected = await expectedPackageFiles(tree.clawId, catalogById, targetRoot);
    if (
      expected.missingCatalogEntry ||
      expected.unsafeEntries.length > 0 ||
      expected.records.some((item) => item.mediaType === null) ||
      tree.root !== computePackageTreeRoot(tree.files) ||
      canonicalJson(tree.files) !== canonicalJson(expected.records) ||
      tree.files.some((item) => !safePackagePath(item.path))
    ) {
      findings.push(
        finding("package-tree-resource-substitution", `$.packageTree.trees[${index}]`),
      );
    }
  }
}

function decodeRequest(issue, findings, path, catalogEntries) {
  const title = bytesValue(issue.title, `${path}.title`, findings);
  const body = bytesValue(issue.body, `${path}.body`, findings);
  if (
    !title ||
    !body ||
    issue.title.mediaType !== "text/plain; charset=utf-8" ||
    issue.body.mediaType !== "application/json"
  ) {
    findings.push(finding("invalid-issue-media-type", path));
    return null;
  }
  let request;
  let titleText;
  let bodyText;
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    titleText = decoder.decode(title);
    bodyText = decoder.decode(body);
    request = JSON.parse(bodyText);
  } catch {
    findings.push(finding("invalid-typed-issue-body", `${path}.body`));
    return null;
  }
  if (
    !exactKeys(request, [
      "schemaVersion",
      "requestType",
      "basePriority",
      "affectedClawIds",
      "compositionClawIds",
      "newInvariantIds",
      "requiredPortTypes",
      "requiredOutputType",
      "requestedAuthority",
      "duplicateOfIssueNumber",
      "demand",
      "evidenceRefs",
      "candidateProposal",
    ]) ||
    request.schemaVersion !== "awesomeClaws.portfolioIssueRequest.v1" ||
    ![
      "improve",
      "new-capability",
      "compose",
      "variant",
      "product-decision",
      "retire",
      "unsupported",
    ].includes(request.requestType) ||
    !Number.isInteger(request.basePriority) ||
    request.basePriority < 0 ||
    request.basePriority > 100 ||
    !validUniqueStrings(request.affectedClawIds) ||
    !validUniqueStrings(request.compositionClawIds) ||
    !validUniqueStrings(request.newInvariantIds) ||
    !validUniqueStrings(request.requiredPortTypes) ||
    typeof request.requiredOutputType !== "string" ||
    request.requiredOutputType.length === 0 ||
    request.requiredOutputType.length > 120 ||
    !validUniqueStrings(request.requestedAuthority) ||
    request.requestedAuthority.some(
      (item) =>
        ![
          "merge",
          "publish",
          "budget-increase",
          "risk-acceptance",
          "external-mutation",
          "production-claw-mutation",
          "sensitive-personal-inference",
        ].includes(item),
    ) ||
    !validUniqueStrings(request.evidenceRefs) ||
    (request.duplicateOfIssueNumber !== null &&
      (!Number.isInteger(request.duplicateOfIssueNumber) ||
        request.duplicateOfIssueNumber < 1)) ||
    !exactKeys(request.demand, [
      "candidateCount",
      "admissions",
      "workUnits",
      "costMicros",
      "durationMinutes",
    ]) ||
    Object.values(request.demand).some(
      (value) =>
        !Number.isInteger(value) ||
        value < 0 ||
        value > 1000000000000,
    ) ||
    (request.requestType === "new-capability"
      ? !isRecord(request.candidateProposal) ||
        !exactKeys(request.candidateProposal, ["proposal", "comparison"]) ||
        validateContributionProposal(
          request.candidateProposal.proposal,
          catalogEntries,
        ).length > 0 ||
        !exactKeys(request.candidateProposal.comparison, [
          "user",
          "job",
          "workflow",
          "outputs",
          "authority",
          "proof",
        ]) ||
        Object.values(request.candidateProposal.comparison).some(
          (item) => !["same", "different"].includes(item),
        )
      : request.candidateProposal !== null)
  ) {
    findings.push(finding("invalid-typed-issue-body", `${path}.body`));
    return null;
  }
  return {
    ...request,
    title: titleText,
    bodyDigest: issue.body.digest,
  };
}

function expectedCompositionAssessment(
  request,
  issue,
  graph,
  selectedClawIds,
) {
  const selected = new Set(selectedClawIds);
  const selectedNodes = graph.nodes.filter((item) =>
    request.compositionClawIds.includes(item.id),
  );
  const adapterId = "strongest-current-composition-adapter";
  const adapter = graph.nodes.find((item) => item.id === adapterId);
  if (!adapter) return null;
  const selectedEdges = graph.edges.filter(
    (edge) =>
      request.compositionClawIds.includes(edge.from.node) &&
      edge.to.node === adapterId,
  );
  const nodeById = new Map(graph.nodes.map((item) => [item.id, item]));
  const requiredOwnerNodes = [
    ...new Set(
      graph.edges
        .filter((edge) => edge.to.node === adapterId)
        .map((edge) => nodeById.get(edge.from.node))
        .filter(
          (item) => item?.kind === "schema-semantic-owner-artifact",
        )
        .map((item) => item.id),
    ),
  ];
  const connectedOutputTypes = new Set(
    selectedEdges.map((edge) =>
      nodeById
        .get(edge.from.node)
        ?.ports.find((item) => item.id === edge.from.port)?.type,
    ),
  );
  const selectedAdapterInputs = new Set(
    selectedEdges
      .filter((edge) => {
        const source = nodeById
          .get(edge.from.node)
          ?.ports.find((candidate) => candidate.id === edge.from.port);
        return source && request.requiredPortTypes.includes(source.type);
      })
      .map((edge) => edge.to.port),
  );
  const requestedOutput = adapter?.ports.find(
    (item) =>
      item.direction === "output" &&
      item.type === request.requiredOutputType,
  );
  const targetContract = graph.nodes
    .find((item) => item.id === "target-claw-portfolio-manager")
    ?.ports.find((item) => item.type === request.requiredOutputType);
  const outputComplete =
    requestedOutput &&
    (targetContract === undefined ||
      sameSet(requestedOutput.fields, targetContract.fields));
  const outputDerivedFromSelection =
    requestedOutput?.derivedFrom?.length > 0 &&
    sameSet(requestedOutput.derivedFrom, [...selectedAdapterInputs]);
  const compatible =
    request.compositionClawIds.length >= 2 &&
    request.compositionClawIds.every(
      (item) =>
        selected.has(item) &&
        selectedNodes.some((nodeValue) => nodeValue.id === item) &&
        selectedEdges.some((edge) => {
          if (edge.from.node !== item) return false;
          const outputType = nodeById
            .get(edge.from.node)
            ?.ports.find((candidate) => candidate.id === edge.from.port)?.type;
          return request.requiredPortTypes.includes(outputType);
        }),
    ) &&
    requiredOwnerNodes.every((item) =>
      request.compositionClawIds.includes(item),
    ) &&
    request.requiredPortTypes.length > 0 &&
    request.requiredPortTypes.every((type) =>
      connectedOutputTypes.has(type),
    ) &&
    outputComplete &&
    outputDerivedFromSelection &&
    adapter.ports
      .filter((item) => item.direction === "input")
      .every((item) =>
        graph.edges.some(
          (edge) =>
            edge.to.node === adapterId && edge.to.port === item.id,
        ),
      );
  const requestedLosses = graph.losses.filter((item) =>
    request.newInvariantIds.includes(item.targetPort) &&
    request.requiredPortTypes.includes(item.requiredType),
  );
  const relevant =
    request.requestType === "compose" ||
    request.requestType === "new-capability";
  return {
    feasible:
      request.requestType === "compose" &&
      compatible,
    proposedClawRefs:
      request.requestType === "compose"
        ? sorted(request.compositionClawIds)
        : [],
    requiredPortTypes: sorted(request.requiredPortTypes),
    requiredOutputType: request.requiredOutputType,
    lossIds:
      request.requestType === "new-capability"
        ? requestedLosses.map((item) => item.id)
        : [],
    relevant,
    issueRevision: issue.revision,
    graphDigest: graph.graphDigest,
  };
}

function automaticClassification(request, composition) {
  if (request.requestedAuthority.length > 0 || request.requestType === "unsupported") {
    return "UNSUPPORTED";
  }
  if (request.duplicateOfIssueNumber !== null) return "DUPLICATE";
  if (composition.feasible) return "COMPOSE";
  return null;
}

function humanDecisionIsCoherent(
  decision,
  request,
  composition,
  catalogIds,
  reportedNearestIds,
) {
  const comparison = decision.comparison;
  const operationalDimensions = [
    comparison.job,
    comparison.workflow,
    comparison.outputs,
    comparison.authority,
    comparison.proof,
  ];
  if (
    comparison.nearestClawIds.length === 0 ||
    comparison.nearestClawIds.some((item) => !catalogIds.has(item))
  ) {
    return false;
  }
  if (decision.classification === "NEW") {
    return (
      canonicalJson({
        user: comparison.user,
        job: comparison.job,
        workflow: comparison.workflow,
        outputs: comparison.outputs,
        authority: comparison.authority,
        proof: comparison.proof,
      }) === canonicalJson(request.candidateProposal?.comparison) &&
      comparison.nearestClawIds.length >= 3 &&
      reportedNearestIds.filter((item) =>
        comparison.nearestClawIds.includes(item),
      ).length >= Math.min(2, reportedNearestIds.length) &&
      !composition.feasible &&
      request.newInvariantIds.length > 0 &&
      composition.lossIds.length === request.newInvariantIds.length &&
      request.newInvariantIds.every((item) =>
        composition.lossIds.includes(`loss-${item}`),
      ) &&
      operationalDimensions.includes("different")
    );
  }
  if (decision.classification === "IMPROVE") {
    return (
      decision.affectedClawIds.length > 0 &&
      comparison.job === "same" &&
      [comparison.workflow, comparison.outputs, comparison.proof].includes(
        "different",
      )
    );
  }
  if (decision.classification === "VARIANT") {
    return (
      comparison.job === "same" &&
      comparison.workflow === "same" &&
      comparison.outputs === "same" &&
      comparison.authority === "same" &&
      comparison.proof === "same"
    );
  }
  if (decision.classification === "PRODUCT_DECISION") {
    return comparison.authority === "different";
  }
  if (decision.classification === "RETIRE") {
    return (
      decision.affectedClawIds.length > 0 &&
      comparison.proof === "different"
    );
  }
  return false;
}

function expectedRationale(classification) {
  return {
    NEW: ["typed-loss-remains"],
    IMPROVE: ["existing-job-preserved"],
    COMPOSE: ["typed-composition-feasible"],
    VARIANT: ["not-curated-catalog-material"],
    PRODUCT_DECISION: ["owner-product-decision"],
    RETIRE: ["owner-retirement-decision"],
    DUPLICATE: ["provider-duplicate"],
    UNSUPPORTED: ["prohibited-or-unsupported-request"],
  }[classification];
}

function addAmounts(left, right) {
  return Object.fromEntries(
    Object.keys(left).map((key) => [key, left[key] + right[key]]),
  );
}

function validAmounts(value) {
  return (
    exactKeys(value, [
      "candidateCount",
      "admissions",
      "workUnits",
      "costMicros",
      "durationMinutes",
    ]) &&
    Object.values(value).every(
      (amount) =>
        Number.isInteger(amount) &&
        amount >= 0 &&
        amount <= 1_000_000_000_000,
    )
  );
}

function fits(cumulative, demand, caps) {
  return Object.keys(caps).every(
    (key) => cumulative[key] + demand[key] <= caps[key],
  );
}

function withinCaps(amounts, caps) {
  return Object.keys(caps).every((key) => amounts[key] <= caps[key]);
}

function classificationDemandIsValid(classification, demand) {
  if (classification === "NEW") {
    return demand.candidateCount === 1 && demand.admissions === 1;
  }
  if (["IMPROVE", "COMPOSE"].includes(classification)) {
    return demand.candidateCount === 0 && demand.admissions === 1;
  }
  return Object.values(demand).every((value) => value === 0);
}

function validReplayHistory(
  previousBudget,
  previousResult,
  previousDecisions,
) {
  const runIds = previousBudget?.usedRunIds;
  const decisionIds = previousBudget?.usedDecisionIds;
  const keys = previousBudget?.usedIdempotencyKeys;
  const reservations = previousBudget?.reservations;
  const history = previousBudget?.history;
  const latest = Array.isArray(history) ? history.at(-1) : null;
  return (
    validUniqueStrings(runIds, 256) &&
    validUniqueStrings(decisionIds, 256) &&
    validUniqueStrings(keys, 512) &&
    keys.every((item) => /^sha256:[0-9a-f]{64}$/u.test(item)) &&
    validAmounts(previousBudget?.caps) &&
    validAmounts(previousBudget?.cumulativeAfter) &&
    Array.isArray(reservations) &&
    reservations.every(
      (item) =>
        exactKeys(item, [
          "id",
          "periodId",
          "runId",
          "decisionId",
          "issueRef",
          "issueRevision",
          "classification",
          "idempotencyKey",
          "amounts",
          "state",
        ]) &&
        /^sha256:[0-9a-f]{64}$/u.test(item.issueRevision) &&
        ["NEW", "IMPROVE", "COMPOSE"].includes(item.classification) &&
        ["reserved", "consumed"].includes(item.state) &&
        validAmounts(item.amounts) &&
        classificationDemandIsValid(item.classification, item.amounts) &&
        item.idempotencyKey === computeReservationIdempotency(item),
    ) &&
    new Set(reservations.map((item) => item.id)).size === reservations.length &&
    new Set(reservations.map((item) => item.idempotencyKey)).size ===
      reservations.length &&
    new Set(
      reservations.map((item) => `${item.issueRef}\0${item.issueRevision}`),
    ).size === reservations.length &&
    Array.isArray(history) &&
    history.length > 0 &&
    history.every(
      (item, index) =>
        exactKeys(item, [
          "sequence",
          "periodId",
          "runId",
          "decisionId",
          "runIdempotencyKey",
          "reservationIdempotencyKeys",
          "previousEntryDigest",
          "entryDigest",
        ]) &&
        item.sequence === index + 1 &&
        item.previousEntryDigest ===
          (index === 0
            ? BUDGET_HISTORY_GENESIS
            : history[index - 1].entryDigest) &&
        item.entryDigest === computeBudgetHistoryEntryDigest(item) &&
        validUniqueStrings(item.reservationIdempotencyKeys, 64) &&
        item.reservationIdempotencyKeys.every((key) =>
          /^sha256:[0-9a-f]{64}$/u.test(key),
        ),
    ) &&
    previousBudget.historyRoot === computeBudgetHistoryRoot(history) &&
    sameSet(runIds, history.map((item) => item.runId)) &&
    sameSet(decisionIds, history.map((item) => item.decisionId)) &&
    sameSet(
      keys,
      history.flatMap((item) => [
        item.runIdempotencyKey,
        ...item.reservationIdempotencyKeys,
      ]),
    ) &&
    sameSet(
      history.flatMap((item) => item.reservationIdempotencyKeys),
      reservations.map((item) => item.idempotencyKey),
    ) &&
    latest?.runId === previousResult?.runId &&
    latest?.periodId === previousBudget.periodId &&
    latest?.decisionId === previousResult?.decisionId &&
    latest?.runIdempotencyKey === previousResult?.idempotencyKey &&
    reservations.every(
      (item) => {
        const entry = history.find((candidate) => candidate.runId === item.runId);
        return (
          keys.includes(item.idempotencyKey) &&
          entry?.decisionId === item.decisionId &&
          entry?.periodId === item.periodId &&
          entry.reservationIdempotencyKeys.includes(item.idempotencyKey)
        );
      },
    ) &&
    reservations
      .filter((item) => item.runId === latest?.runId)
      .every((item) => item.periodId === previousBudget.periodId) &&
    rows(previousDecisions?.decisions)
      .filter((item) => ["reserved", "completed"].includes(item.state))
      .every((decision) =>
        reservations.some(
          (item) =>
            item.issueRef === decision.issueRef &&
            item.issueRevision === decision.issueRevision &&
            item.classification === decision.classification &&
            item.state ===
              (decision.state === "completed" ? "consumed" : "reserved"),
        ),
      ) &&
    reservations.every((item) =>
      rows(previousDecisions?.decisions).some(
        (decision) =>
          decision.issueRef === item.issueRef &&
          decision.issueRevision === item.issueRevision &&
          decision.classification === item.classification &&
          decision.state ===
            (item.state === "consumed" ? "completed" : "reserved"),
      ),
    ) &&
    canonicalJson(
      reservations
        .filter((item) => item.periodId === previousBudget.periodId)
        .reduce(
        (total, item) => addAmounts(total, item.amounts),
        {
          candidateCount: 0,
          admissions: 0,
          workUnits: 0,
          costMicros: 0,
          durationMinutes: 0,
        },
        ),
    ) === canonicalJson(previousBudget.cumulativeAfter) &&
    withinCaps(previousBudget.cumulativeAfter, previousBudget.caps)
  );
}

function validDecisionHistory(previousDecisions) {
  const decisions = previousDecisions?.decisions;
  if (
    !Array.isArray(decisions) ||
    decisions.length === 0 ||
    decisions.some(
      (item) =>
        !exactKeys(item, [
          "issueRef",
          "issueRevision",
          "classification",
          "state",
        ]) ||
        typeof item.issueRef !== "string" ||
        !/^sha256:[0-9a-f]{64}$/u.test(item.issueRevision) ||
        ![
          "NEW",
          "IMPROVE",
          "COMPOSE",
          "VARIANT",
          "PRODUCT_DECISION",
          "RETIRE",
          "DUPLICATE",
          "UNSUPPORTED",
        ].includes(item.classification) ||
        !["reserved", "completed", "blocked", "decision-required"].includes(
          item.state,
        ),
    )
  ) {
    return false;
  }
  const identities = decisions.map(
    (item) =>
      `${item.issueRef}\0${item.issueRevision}`,
  );
  return new Set(identities).size === identities.length;
}

function expectedReservations(
  input,
  requests,
  decisions,
  priorIssueDecisions = new Set(),
) {
  const decisionByIssue =
    decisions instanceof Map
      ? decisions
      : new Map(decisions.map((item) => [item.issueRef, item]));
  const eligible = [...requests.entries()]
    .map(([issueRef, request]) => ({
      issueRef,
      request,
      classification: decisionByIssue.get(issueRef)?.classification,
    }))
    .filter((item) =>
      ["IMPROVE", "COMPOSE", "NEW"].includes(item.classification),
    )
    .filter(
      (item) =>
        !priorIssueDecisions.has(
          `${item.issueRef}\0${decisionByIssue.get(item.issueRef)?.issueRevision}`,
        ),
    )
    .sort((left, right) => {
      const tier = { IMPROVE: 0, COMPOSE: 0, NEW: 1 };
      return (
        tier[left.classification] - tier[right.classification] ||
        right.request.basePriority - left.request.basePriority ||
        compare(left.issueRef, right.issueRef)
      );
    });
  let cumulative = { ...input.budgetLedger.cumulativeBefore };
  const reservations = [];
  for (const item of eligible) {
    if (!fits(cumulative, item.request.demand, input.budgetLedger.caps)) continue;
    const reservation = {
      id: reservationIdForIssue(
        item.issueRef,
        decisionByIssue.get(item.issueRef).issueRevision,
      ),
      periodId: input.budgetLedger.period.id,
      runId: input.run.id,
      decisionId: input.run.decisionId,
      issueRef: item.issueRef,
      issueRevision: decisionByIssue.get(item.issueRef).issueRevision,
      classification: item.classification,
      idempotencyKey: "",
      amounts: { ...item.request.demand },
      state: "reserved",
    };
    reservation.idempotencyKey = computeReservationIdempotency(reservation);
    reservations.push(reservation);
    cumulative = addAmounts(cumulative, item.request.demand);
  }
  return { reservations, cumulative };
}

function bytesRecord(value) {
  const bytes = Buffer.from(canonicalJson(value), "utf8");
  return {
    mediaType: "application/json",
    byteLength: bytes.length,
    digest: bytesDigest(bytes),
    contentBase64: bytes.toString("base64"),
  };
}

function decodeCanonicalRecord(value, path, findings) {
  const bytes = bytesValue(value, path, findings);
  if (!bytes) return null;
  try {
    const parsed = JSON.parse(bytes.toString("utf8"));
    if (canonicalJson(parsed) !== bytes.toString("utf8")) {
      findings.push(finding("noncanonical-predecessor-bytes", path));
      return null;
    }
    return parsed;
  } catch {
    findings.push(finding("invalid-predecessor-bytes", path));
    return null;
  }
}

function principalHas(principals, id, role, kind) {
  const principal = principals.get(id);
  return (
    principal?.kind === kind &&
    strings(principal.roles).includes(role)
  );
}

function authenticatedPrincipals(keys) {
  const rolesByPrincipal = new Map();
  for (const key of keys.values()) {
    if (key.status !== "active") continue;
    const role = {
      catalog: "catalog-source-custodian",
      issue: "issue-source-custodian",
      usage: "usage-evidence-issuer",
      "human-grant": "grant-issuer",
      composition: "composition-reviewer",
      "run-result": "portfolio-owner",
      budget: "budget-owner",
      classification:
        key.principalKind === "human" ? "decision-owner" : "classifier",
    }[key.domain];
    if (!role) continue;
    const current = rolesByPrincipal.get(key.principalRef) ?? {
      id: key.principalRef,
      kind: key.principalKind,
      roles: [],
    };
    if (current.kind !== key.principalKind) return null;
    current.roles.push(role);
    rolesByPrincipal.set(key.principalRef, current);
  }
  return new Map(
    [...rolesByPrincipal.entries()].map(([id, value]) => [
      id,
      {
        ...value,
        roles: [...new Set(value.roles)].sort(compare),
      },
    ]),
  );
}

function exactIssueIdentities(issues) {
  const ids = issues.map((item) => item.id);
  const providerIds = issues.map((item) => item.providerIssueId);
  const numbers = issues.map(
    (item) =>
      `${item.repository.provider}/${item.repository.owner}/${item.repository.name}#${item.number}`,
  );
  return (
    new Set(ids).size === ids.length &&
    new Set(providerIds).size === providerIds.length &&
    new Set(numbers).size === numbers.length
  );
}

function hasExactCanonicalIssueUrl(issue) {
  try {
    const url = new URL(issue.url);
    return (
      url.protocol === "https:" &&
      url.hostname === "github.com" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname ===
        `/${issue.repository.owner}/${issue.repository.name}/issues/${issue.number}` &&
      url.href ===
        `https://github.com/${issue.repository.owner}/${issue.repository.name}/issues/${issue.number}`
    );
  } catch {
    return false;
  }
}

function hasSafeControlledSource(scope) {
  try {
    const url = new URL(scope.sourceRef);
    return (
      url.protocol === "controlled:" &&
      url.hostname === scope.tenantRef &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.search &&
      !url.hash &&
      url.pathname !== "/" &&
      url.href === scope.sourceRef
    );
  } catch {
    return false;
  }
}

function invalidResult(findings) {
  return {
    schemaVersion: V2_RESULT_VERSION,
    resultStatus: "invalid",
    findings: uniqueFindings(findings),
    authority: { ...AUTHORITY },
  };
}

export function compositionAdmissionFinding(graph) {
  if (graph?.verdict === "NEW") return null;
  return graph?.verdict === "COMPOSE"
    ? finding("lossless-composition-requires-candidate-deletion", "$.composition")
    : finding("stale-or-invalid-composition-proof", "$.composition");
}

function prReadyPlan(input, issue, request, decision, assessment) {
  const composition =
    decision.classification === "COMPOSE"
      ? {
          clawRefs: sorted(assessment.proposedClawRefs),
          requiredPortTypes: sorted(assessment.requiredPortTypes),
          requiredOutputType: assessment.requiredOutputType,
        }
      : null;
  return {
    schemaVersion: "awesomeClaws.clawPortfolioPrReadyPlan.v1",
    id: planIdForIssue(input.run.decisionId, issue.id),
    issueRef: issue.id,
    issueRevision: issue.revision,
    classification: decision.classification,
    requestType: request.requestType,
    affectedClawIds: sorted(decision.affectedClawIds),
    evidenceRefs: sorted(request.evidenceRefs),
    packageTreeRevision: input.run.packageTreeRevision,
    composition,
    steps: [
      "prepare-draft-change-against-bound-package-revisions",
      "run-required-validation-and-attach-evidence",
      "request-owner-decision-before-opening-or-merging",
    ],
    authority: {
      externalMutation: false,
      merge: false,
      publish: false,
    },
  };
}

export async function evaluatePortfolioV2(
  inputValue,
  {
    asOf,
    publicTrust,
    packageTree,
    targetRoot = root,
  } = {},
) {
  const inputNormalized = normalize(inputValue, V2_LIMITS.inputBytes);
  const trustNormalized = normalize(publicTrust, V2_LIMITS.trustBytes);
  const treeNormalized = normalize(packageTree, V2_LIMITS.packageTreeBytes);
  if (!inputNormalized.ok || !trustNormalized.ok || !treeNormalized.ok) {
    return invalidResult([
      finding("unsafe-or-oversized-input", "$"),
    ]);
  }
  const input = inputNormalized.value;
  const trust = trustNormalized.value;
  const tree = treeNormalized.value;
  const inputSchemaFindings = schemaFindings(validateSchema, input, "$");
  const trustSchemaFindings = schemaFindings(
    validateTrustSchema,
    trust,
    "$.trust",
  );
  const treeSchemaFindings = schemaFindings(
    validatePackageTreeSchema,
    tree,
    "$.packageTree",
  );
  const findings = [
    ...inputSchemaFindings,
    ...trustSchemaFindings,
    ...treeSchemaFindings,
  ];
  const asOfMs = timestamp(asOf);
  if (
    inputSchemaFindings.length > 0 ||
    asOfMs === null ||
    input.run.asOf !== asOf
  ) {
    findings.push(finding("invalid-run-context", "$.run.asOf"));
    return invalidResult(findings);
  }
  if (trustSchemaFindings.length > 0 || treeSchemaFindings.length > 0) {
    return invalidResult(findings);
  }
  const graph = await runStrongestComposition();
  const compositionFinding = compositionAdmissionFinding(graph);
  if (compositionFinding) findings.push(compositionFinding);
  const catalogEntries = (await readCatalog({ loadResources: false })).entries;
  const catalogIds = new Set(catalogEntries.map((item) => item.id));
  const keys = verifyTrust(trust, asOf, findings);
  const trustedPrincipals = authenticatedPrincipals(keys);
  const principals = trustedPrincipals ?? new Map();
  if (
    trustedPrincipals === null ||
    canonicalJson(
      [...mapById(input.principals).values()]
        .map((item) => ({
          id: item.id,
          kind: item.kind,
          roles: sorted(item.roles),
        }))
        .sort((left, right) => compare(left.id, right.id)),
    ) !==
      canonicalJson(
        [...principals.values()].sort((left, right) =>
          compare(left.id, right.id),
        ),
      )
  ) {
    findings.push(finding("unauthenticated-principal-roster", "$.principals"));
  }
  await validatePackageTree(tree, input, keys, findings, targetRoot);

  const duplicateGlobal = new Set();
  const seenGlobal = new Set();
  for (const collection of [
    input.principals,
    input.grants,
    input.providerSnapshot.issues,
    input.compositionAssessments,
    input.classificationDecisions,
    input.budgetLedger.reservations,
    input.usageEnvelopes,
    input.usageEnvelopes.flatMap((item) => item.records),
  ]) {
    for (const item of rows(collection)) {
      if (seenGlobal.has(item.id)) duplicateGlobal.add(item.id);
      seenGlobal.add(item.id);
    }
  }
  if (duplicateGlobal.size > 0) {
    findings.push(finding("duplicate-global-identity", "$"));
  }

  verifySigned({
    value: input.run,
    domain: "run-result",
    principalRef: input.run.signerRef,
    principalKind: "human",
    signedAt: input.run.signedAt,
    asOf,
    keys,
    findings,
    path: "$.run.signature",
  });
  verifySigned({
    value: input.onboarding,
    domain: "run-result",
    principalRef: input.onboarding.ownerRef,
    principalKind: "human",
    signedAt: input.onboarding.signedAt,
    asOf,
    keys,
    findings,
    path: "$.onboarding.signature",
  });
  if (
    !principalHas(
      principals,
      input.onboarding.ownerRef,
      "portfolio-owner",
      "human",
    ) ||
    input.run.signerRef !== input.onboarding.ownerRef ||
    input.run.mode !== input.onboarding.mode ||
    input.run.portfolioRevision !== tree.root ||
    input.run.providerSnapshotRef !== input.providerSnapshot.id ||
    input.run.providerSnapshotRevision !== input.providerSnapshot.revision ||
    input.run.providerSnapshotCompletenessRoot !==
      input.providerSnapshot.completenessRoot ||
    input.run.packageTreeRef !== tree.id ||
    input.run.packageTreeRevision !== tree.revision ||
    input.run.budgetPeriodRef !== input.budgetLedger.period.id ||
    input.run.idempotencyKey !== computeRunIdempotencyKey(input.run) ||
    timestamp(input.run.signedAt) > asOfMs ||
    timestamp(input.onboarding.signedAt) > timestamp(input.run.signedAt) ||
    timestamp(tree.capturedAt) > timestamp(input.run.signedAt) ||
    timestamp(input.providerSnapshot.capturedAt) >
      timestamp(input.run.signedAt) ||
    input.compositionAssessments.some(
      (item) => timestamp(item.assessedAt) > timestamp(input.run.signedAt),
    ) ||
    input.classificationDecisions.some(
      (item) => timestamp(item.decidedAt) > timestamp(input.run.signedAt),
    ) ||
    timestamp(input.budgetLedger.issuedAt) > timestamp(input.run.signedAt) ||
    input.usageEnvelopes.some(
      (item) => timestamp(item.issuedAt) > timestamp(input.run.signedAt),
    ) ||
    (input.predecessor &&
      timestamp(input.predecessor.capturedAt) >
        timestamp(input.run.signedAt))
  ) {
    findings.push(finding("invalid-run-binding", "$.run"));
  }
  const modeLists = [
    input.onboarding.roles,
    input.onboarding.jobs,
    input.onboarding.processes,
    input.onboarding.capabilities,
  ];
  if (
    (input.run.mode === "bootstrap" &&
      modeLists.some((items) => items.length === 0)) ||
    (input.run.mode !== "bootstrap" &&
      modeLists.some((items) => items.length !== 0))
  ) {
    findings.push(finding("invalid-onboarding-mode", "$.onboarding"));
  }

  const snapshot = input.providerSnapshot;
  if (
    snapshot.revision !== computeProviderSnapshotRevision(snapshot) ||
    snapshot.completenessRoot !== computeProviderSnapshotRoot(snapshot.issues) ||
    input.run.providerSnapshotRef !== snapshot.id ||
    !sameSet(snapshot.issueRefs, snapshot.issues.map((item) => item.id)) ||
    !exactIssueIdentities(snapshot.issues) ||
    timestamp(snapshot.capturedAt) > asOfMs ||
    !principalHas(
      principals,
      snapshot.custodianRef,
      "issue-source-custodian",
      "system",
    )
  ) {
    findings.push(finding("invalid-provider-snapshot", "$.providerSnapshot"));
  }
  verifySigned({
    value: snapshot,
    domain: "issue",
    principalRef: snapshot.custodianRef,
    principalKind: "system",
    signedAt: snapshot.capturedAt,
    asOf,
    keys,
    findings,
    path: "$.providerSnapshot.signature",
  });
  const requests = new Map();
  for (const [index, issue] of snapshot.issues.entries()) {
    const path = `$.providerSnapshot.issues[${index}]`;
    if (
      canonicalJson(issue.repository) !== canonicalJson(snapshot.repository) ||
      issue.revision !== computeProviderIssueRevision(issue) ||
      timestamp(issue.observedAt) > timestamp(snapshot.capturedAt) ||
      !hasExactCanonicalIssueUrl(issue)
    ) {
      findings.push(finding("invalid-provider-issue-receipt", path));
    }
    const request = decodeRequest(issue, findings, path, catalogEntries);
    if (request) {
      if (!sameSet(request.evidenceRefs, [`source-${issue.id}`])) {
        findings.push(finding("unresolved-issue-evidence", `${path}.body`));
      }
      requests.set(issue.id, request);
    }
  }
  const issueByNumber = new Map(
    snapshot.issues.map((item) => [item.number, item]),
  );
  for (const issue of snapshot.issues) {
    const request = requests.get(issue.id);
    if (request?.duplicateOfIssueNumber === null) continue;
    const target = issueByNumber.get(request?.duplicateOfIssueNumber);
    const targetRequest = target ? requests.get(target.id) : null;
    if (
      !target ||
      target.id === issue.id ||
      targetRequest?.duplicateOfIssueNumber !== null
    ) {
      findings.push(
        finding(
          "invalid-duplicate-target",
          `$.providerSnapshot.issues.${issue.id}`,
        ),
      );
    }
  }

  const assessments = mapById(input.compositionAssessments);
  const decisions = mapById(input.classificationDecisions);
  if (
    !sameSet(
      snapshot.issueRefs,
      input.compositionAssessments.map((item) => item.issueRef),
    ) ||
    !sameSet(
      snapshot.issueRefs,
      input.classificationDecisions.map((item) => item.issueRef),
    )
  ) {
    findings.push(finding("issue-decision-coverage-mismatch", "$"));
  }
  const decisionByIssue = new Map();
  for (const [index, decision] of input.classificationDecisions.entries()) {
    const issue = snapshot.issues.find((item) => item.id === decision.issueRef);
    const request = requests.get(decision.issueRef);
    const assessment = assessments.get(decision.compositionAssessmentRef);
    const expectedAssessment =
      request && issue
        ? expectedCompositionAssessment(
            request,
            issue,
            graph,
            input.onboarding.selectedClawIds,
          )
        : null;
    const automatic =
      request && assessment
        ? automaticClassification(request, assessment)
        : null;
    const expected = automatic ?? decision.classification;
    const assessmentValid =
      expectedAssessment &&
      assessment &&
      assessment.issueRef === decision.issueRef &&
      assessment.runId === input.run.id &&
      assessment.decisionId === input.run.decisionId &&
      assessment.issueRevision === issue.revision &&
      assessment.graphDigest === expectedAssessment.graphDigest &&
      sameSet(
        assessment.requiredPortTypes,
        expectedAssessment.requiredPortTypes,
      ) &&
      assessment.requiredOutputType ===
        expectedAssessment.requiredOutputType &&
      assessment.feasible === expectedAssessment.feasible &&
      sameSet(
        assessment.proposedClawRefs,
        expectedAssessment.proposedClawRefs,
      ) &&
      sameSet(assessment.lossIds, expectedAssessment.lossIds) &&
      timestamp(assessment.assessedAt) >= timestamp(issue.observedAt) &&
      timestamp(assessment.assessedAt) >= timestamp(snapshot.capturedAt) &&
      timestamp(assessment.assessedAt) <= timestamp(decision.decidedAt) &&
      principalHas(
        principals,
        assessment.reviewerRef,
        "composition-reviewer",
        "system",
      );
    if (!assessmentValid) {
      findings.push(
        finding(
          "invalid-composition-assessment",
          `$.classificationDecisions[${index}]`,
        ),
      );
    }
    if (assessment) {
      verifySigned({
        value: assessment,
        domain: "composition",
        principalRef: assessment.reviewerRef,
        principalKind: "system",
        signedAt: assessment.assessedAt,
        asOf,
        keys,
        findings,
        path: `$.compositionAssessments.${assessment.id}.signature`,
      });
    }
    const typedComparison =
      decision.decisionKind === "typed-classifier" &&
      automatic !== null &&
      decision.comparison.nearestClawIds.length === 0 &&
      [
        decision.comparison.user,
        decision.comparison.job,
        decision.comparison.workflow,
        decision.comparison.outputs,
        decision.comparison.authority,
        decision.comparison.proof,
      ].every((item) => item === "not-applicable");
    const humanComparison =
      decision.decisionKind === "human-decision" &&
      automatic === null &&
      request &&
      assessment &&
      humanDecisionIsCoherent(
        decision,
        request,
        assessment,
        catalogIds,
        request
          ? contributionSimilarityReport(
              request.candidateProposal?.proposal?.entry ?? {},
              catalogEntries,
            ).matches.map((item) => item.id)
          : [],
      );
    const expectedDeciderKind =
      decision.decisionKind === "human-decision" ? "human" : "system";
    const expectedDeciderRole =
      decision.decisionKind === "human-decision"
        ? "decision-owner"
        : "classifier";
    if (
      !issue ||
      !request ||
      decision.issueRevision !== issue.revision ||
      decision.runId !== input.run.id ||
      decision.decisionId !== input.run.decisionId ||
      decision.classification !== expected ||
      decision.classifierVersion !== CLASSIFIER_VERSION ||
      decision.classifierCodeDigest !== CLASSIFIER_CODE_DIGEST ||
      !sameSet(decision.rationaleCodes, expectedRationale(expected)) ||
      !sameSet(decision.affectedClawIds, request.affectedClawIds) ||
      request.affectedClawIds.some(
        (item) => !input.onboarding.selectedClawIds.includes(item),
      ) ||
      !classificationDemandIsValid(
        decision.classification,
        request.demand,
      ) ||
      timestamp(decision.decidedAt) > asOfMs ||
      (!typedComparison && !humanComparison) ||
      !principalHas(
        principals,
        decision.deciderRef,
        expectedDeciderRole,
        expectedDeciderKind,
      )
    ) {
      findings.push(
        finding(
          "invalid-classification-decision",
          `$.classificationDecisions[${index}]`,
        ),
      );
    }
    verifySigned({
      value: decision,
      domain: "classification",
      principalRef: decision.deciderRef,
      principalKind: expectedDeciderKind,
      signedAt: decision.decidedAt,
      asOf,
      keys,
      findings,
      path: `$.classificationDecisions[${index}].signature`,
    });
    decisionByIssue.set(decision.issueRef, decision);
  }

  for (const [index, grant] of input.grants.entries()) {
    if (
      !principalHas(principals, grant.issuerRef, "grant-issuer", "human") ||
      !principals.has(grant.granteeRef) ||
      timestamp(grant.issuedAt) > timestamp(grant.notBefore) ||
      timestamp(grant.notBefore) >= timestamp(grant.expiresAt)
    ) {
      findings.push(finding("invalid-human-grant", `$.grants[${index}]`));
    }
    verifySigned({
      value: grant,
      domain: "human-grant",
      principalRef: grant.issuerRef,
      principalKind: "human",
      signedAt: grant.issuedAt,
      asOf,
      keys,
      findings,
      path: `$.grants[${index}].signature`,
    });
  }
  const portfolioGrants = input.grants.filter(
    (item) =>
      item.scope === "portfolio-review" &&
      item.granteeRef === input.onboarding.ownerRef &&
      sameSet(item.issueRefs, snapshot.issueRefs),
  );
  if (portfolioGrants.length !== 1) {
    findings.push(finding("invalid-portfolio-review-grant", "$.grants"));
  }
  if (
    portfolioGrants.length === 1 &&
    !grantActiveAt(portfolioGrants[0], input.run.signedAt)
  ) {
    findings.push(finding("invalid-portfolio-review-grant", "$.grants"));
  }
  for (const decision of input.classificationDecisions) {
    const requiredScope =
      decision.classification === "PRODUCT_DECISION"
        ? "product-decision-review"
        : decision.classification === "RETIRE"
          ? "retirement-review"
          : "classification-review";
    const matches = input.grants.filter(
      (item) =>
        item.scope === requiredScope &&
        item.issueRefs.includes(decision.issueRef) &&
        grantActiveAt(item, decision.decidedAt) &&
        (decision.decisionKind !== "human-decision" ||
          item.granteeRef === decision.deciderRef) &&
        principalHas(
          principals,
          item.granteeRef,
          "decision-owner",
          "human",
        ),
    );
    if (matches.length !== 1) {
      findings.push(
        finding(
          "invalid-decision-review-grant",
          `$.classificationDecisions.${decision.id}`,
        ),
      );
    }
  }
  const budgetGrant = input.grants.find(
    (item) => item.id === input.budgetLedger.grantRef,
  );
  const budgetLease = input.budgetLedger.lease;
  const decodedPreviousDecisions =
    input.run.mode === "manage" && input.predecessor
      ? decodeCanonicalRecord(
          input.predecessor.decisions,
          "$.predecessor.decisions",
          findings,
        )
      : null;
  const priorIssueDecisions = new Set(
    rows(decodedPreviousDecisions?.decisions)
      .filter((item) => ["reserved", "completed"].includes(item.state))
      .map(
        (item) =>
          `${item.issueRef}\0${item.issueRevision}`,
      ),
  );
  const priorWorkByIssueRevision = new Map(
    rows(decodedPreviousDecisions?.decisions)
      .filter((item) => ["reserved", "completed"].includes(item.state))
      .map((item) => [
        `${item.issueRef}\0${item.issueRevision}`,
        item.classification,
      ]),
  );
  for (const decision of input.classificationDecisions) {
    const priorClassification = priorWorkByIssueRevision.get(
      `${decision.issueRef}\0${decision.issueRevision}`,
    );
    if (
      priorClassification !== undefined &&
      priorClassification !== decision.classification
    ) {
      findings.push(
        finding(
          "invalid-completed-work-reclassification",
          `$.classificationDecisions.${decision.id}`,
        ),
      );
    }
  }
  const expectedBudget = expectedReservations(
    input,
    requests,
    decisionByIssue,
    priorIssueDecisions,
  );
  const reservedDecisionTimes = input.budgetLedger.reservations.map(
    (reservation) =>
      timestamp(decisionByIssue.get(reservation.issueRef)?.decidedAt),
  );
  if (
    input.budgetLedger.revision !==
      computeBudgetLedgerRevision(input.budgetLedger) ||
    input.budgetLedger.runId !== input.run.id ||
    input.budgetLedger.decisionId !== input.run.decisionId ||
    input.budgetLedger.period.id !== input.run.budgetPeriodRef ||
    budgetLease.periodId !== input.budgetLedger.period.id ||
    budgetLease.runId !== input.run.id ||
    budgetLease.decisionId !== input.run.decisionId ||
    budgetLease.expectedCheckpointDigest !==
      input.budgetLedger.predecessorBudgetDigest ||
    budgetLease.issuerRef !== input.budgetLedger.ownerRef ||
    timestamp(budgetLease.issuedAt) >
      timestamp(input.budgetLedger.issuedAt) ||
    timestamp(input.budgetLedger.issuedAt) >
      timestamp(budgetLease.expiresAt) ||
    !budgetPeriodContains(input.budgetLedger.period, asOf) ||
    budgetGrant?.scope !== "budget-reservation" ||
    budgetGrant?.granteeRef !== input.budgetLedger.ownerRef ||
    !sameSet(budgetGrant?.issueRefs, snapshot.issueRefs) ||
    !grantActiveAt(budgetGrant, input.budgetLedger.issuedAt) ||
    reservedDecisionTimes.some(
      (decidedAt) =>
        decidedAt === null ||
        decidedAt > timestamp(input.budgetLedger.issuedAt),
    ) ||
    !principalHas(
      principals,
      input.budgetLedger.ownerRef,
      "budget-owner",
      "human",
    ) ||
    canonicalJson(input.budgetLedger.reservations) !==
      canonicalJson(expectedBudget.reservations) ||
    canonicalJson(input.budgetLedger.cumulativeAfter) !==
      canonicalJson(expectedBudget.cumulative) ||
    !withinCaps(
      input.budgetLedger.cumulativeBefore,
      input.budgetLedger.caps,
    ) ||
    !withinCaps(
      input.budgetLedger.cumulativeAfter,
      input.budgetLedger.caps,
    )
  ) {
    findings.push(finding("invalid-cumulative-budget-ledger", "$.budgetLedger"));
  }
  verifySigned({
    value: budgetLease,
    domain: "budget",
    principalRef: budgetLease.issuerRef,
    principalKind: "human",
    signedAt: budgetLease.issuedAt,
    asOf,
    keys,
    findings,
    path: "$.budgetLedger.lease.signature",
  });
  verifySigned({
    value: input.budgetLedger,
    domain: "budget",
    principalRef: input.budgetLedger.ownerRef,
    principalKind: "human",
    signedAt: input.budgetLedger.issuedAt,
    asOf,
    keys,
    findings,
    path: "$.budgetLedger.signature",
  });

  const priorRunIds = new Set();
  const priorDecisionIds = new Set();
  const priorIdempotencyKeys = new Set();
  if (input.run.mode === "manage") {
    if (!input.predecessor) {
      findings.push(finding("missing-predecessor", "$.predecessor"));
    } else {
      const previousResult = decodeCanonicalRecord(
        input.predecessor.result,
        "$.predecessor.result",
        findings,
      );
      const previousDecisions = decodedPreviousDecisions;
      const previousBudget = decodeCanonicalRecord(
        input.predecessor.budget,
        "$.predecessor.budget",
        findings,
      );
      const previousPeriodStart = timestamp(
        `${previousBudget?.periodStart}T00:00:00Z`,
      );
      const previousPeriodEnd = timestamp(
        `${previousBudget?.periodEnd}T00:00:00Z`,
      );
      if (
        input.run.predecessorResultDigest !== input.predecessor.result.digest ||
        input.run.predecessorDecisionDigest !==
          input.predecessor.decisions.digest ||
        input.run.predecessorBudgetDigest !== input.predecessor.budget.digest ||
        input.budgetLedger.predecessorBudgetDigest !==
          input.predecessor.budget.digest ||
        input.predecessor.runId !== previousResult?.runId ||
        input.predecessor.decisionId !== previousResult?.decisionId ||
        !exactKeys(previousResult, [
          "schemaVersion",
          "runId",
          "decisionId",
          "idempotencyKey",
          "resultDigest",
        ]) ||
        previousResult?.schemaVersion !==
          "awesomeClaws.clawPortfolioPreviousResult.v1" ||
        !/^sha256:[0-9a-f]{64}$/u.test(
          previousResult?.idempotencyKey ?? "",
        ) ||
        !/^sha256:[0-9a-f]{64}$/u.test(
          previousResult?.resultDigest ?? "",
        ) ||
        !exactKeys(previousDecisions, ["schemaVersion", "decisions"]) ||
        previousDecisions?.schemaVersion !==
          "awesomeClaws.clawPortfolioPreviousDecisions.v1" ||
        !validDecisionHistory(previousDecisions) ||
        !exactKeys(previousBudget, [
          "schemaVersion",
          "periodId",
          "periodStart",
          "periodEnd",
          "caps",
          "cumulativeAfter",
          "reservations",
          "usedRunIds",
          "usedDecisionIds",
          "usedIdempotencyKeys",
          "history",
          "historyRoot",
        ]) ||
        previousBudget?.schemaVersion !==
          "awesomeClaws.clawPortfolioPreviousBudget.v1" ||
        previousPeriodStart === null ||
        previousPeriodEnd === null ||
        previousPeriodStart > previousPeriodEnd ||
        !validReplayHistory(
          previousBudget,
          previousResult,
          previousDecisions,
        ) ||
        (previousBudget?.periodId === input.budgetLedger.period.id
          ? previousBudget.periodStart !==
              input.budgetLedger.period.startsOn ||
            previousBudget.periodEnd !== input.budgetLedger.period.endsOn ||
            canonicalJson(previousBudget.caps) !==
              canonicalJson(input.budgetLedger.caps) ||
            canonicalJson(input.budgetLedger.cumulativeBefore) !==
              canonicalJson(previousBudget?.cumulativeAfter)
          : previousPeriodEnd + 86_400_000 >
              timestamp(
                `${input.budgetLedger.period.startsOn}T00:00:00Z`,
              ) ||
            Object.values(input.budgetLedger.cumulativeBefore).some(
              (value) => value !== 0,
            )) ||
        !Array.isArray(previousDecisions?.decisions)
      ) {
        findings.push(finding("invalid-predecessor-lineage", "$.predecessor"));
      }
      priorRunIds.add(previousResult?.runId);
      priorDecisionIds.add(previousResult?.decisionId);
      priorIdempotencyKeys.add(previousResult?.idempotencyKey);
      for (const item of strings(previousBudget?.usedRunIds)) {
        priorRunIds.add(item);
      }
      for (const item of strings(previousBudget?.usedDecisionIds)) {
        priorDecisionIds.add(item);
      }
      for (const item of strings(previousBudget?.usedIdempotencyKeys)) {
        priorIdempotencyKeys.add(item);
      }
      for (const item of rows(previousBudget?.reservations)) {
        priorIdempotencyKeys.add(item.idempotencyKey);
      }
      verifySigned({
        value: input.predecessor,
        domain: "run-result",
        principalRef: input.onboarding.ownerRef,
        principalKind: "human",
        signedAt: input.predecessor.capturedAt,
        asOf,
        keys,
        findings,
        path: "$.predecessor.signature",
      });
    }
  } else if (
    input.predecessor !== null ||
    input.run.predecessorResultDigest !== null ||
    input.run.predecessorDecisionDigest !== null ||
    input.run.predecessorBudgetDigest !== null ||
    input.budgetLedger.predecessorBudgetDigest !== null
  ) {
    findings.push(finding("unexpected-first-run-predecessor", "$.predecessor"));
  }
  if (
    input.run.mode !== "manage" &&
    Object.values(input.budgetLedger.cumulativeBefore).some(
      (value) => value !== 0,
    )
  ) {
    findings.push(
      finding(
        "invalid-first-run-budget-baseline",
        "$.budgetLedger.cumulativeBefore",
      ),
    );
  }
  if (
    priorRunIds.has(input.run.id) ||
    priorDecisionIds.has(input.run.decisionId) ||
    priorIdempotencyKeys.has(input.run.idempotencyKey) ||
    input.budgetLedger.reservations.some((item) =>
      priorIdempotencyKeys.has(item.idempotencyKey),
    ) ||
    input.budgetLedger.reservations.some((item) => {
      const issue = snapshot.issues.find(
        (candidate) => candidate.id === item.issueRef,
      );
      return priorIssueDecisions.has(
        `${item.issueRef}\0${issue?.revision}`,
      );
    })
  ) {
    findings.push(finding("replayed-run-or-budget", "$.run"));
  }

  const issueIds = new Set(snapshot.issueRefs);
  const approvedUsageScopes = new Set(
    input.onboarding.approvedUsageScopes
      .filter(hasSafeControlledSource)
      .map((item) => `${item.tenantRef}\0${item.sourceRef}`),
  );
  if (
    approvedUsageScopes.size !== input.onboarding.approvedUsageScopes.length
  ) {
    findings.push(
      finding("invalid-owner-approved-usage-scope", "$.onboarding"),
    );
  }
  for (const [envelopeIndex, envelope] of input.usageEnvelopes.entries()) {
    if (
      !principalHas(
        principals,
        envelope.issuerRef,
        "usage-evidence-issuer",
        "system",
      ) ||
      !approvedUsageScopes.has(
        `${envelope.tenantRef}\0${envelope.sourceRef}`,
      ) ||
      !hasSafeControlledSource(envelope) ||
      envelope.revision !== computeUsageEnvelopeRevision(envelope)
    ) {
      findings.push(
        finding("invalid-usage-envelope", `$.usageEnvelopes[${envelopeIndex}]`),
      );
    }
    verifySigned({
      value: envelope,
      domain: "usage",
      principalRef: envelope.issuerRef,
      principalKind: "system",
      signedAt: envelope.issuedAt,
      asOf,
      keys,
      findings,
      path: `$.usageEnvelopes[${envelopeIndex}].signature`,
    });
    for (const record of envelope.records) {
      if (
        record.revision !== computeUsageRecordRevision(record) ||
        !issueIds.has(record.issueRef) ||
        record.tenantRef !== envelope.tenantRef ||
        record.sourceRef !== envelope.sourceRef ||
        timestamp(record.observedAt) > timestamp(envelope.issuedAt) ||
        timestamp(record.validUntil) < asOfMs ||
        record.successCount + record.failureCount > record.eventCount ||
        !sameSet(record.minimizedFields, [
          "event-count",
          "success-count",
          "failure-count",
        ])
      ) {
        findings.push(
          finding("invalid-minimized-usage", `$.usageEnvelopes.${record.id}`),
        );
      }
    }
  }
  if (canonicalJson(input.authority) !== canonicalJson(AUTHORITY)) {
    findings.push(finding("invalid-authority-contract", "$.authority"));
  }

  const unique = uniqueFindings(findings);
  if (unique.length > 0) return invalidResult(unique);

  const reservationByIssue = new Map(
    input.budgetLedger.reservations.map((item) => [item.issueRef, item]),
  );
  const issueResults = snapshot.issueRefs.map((issueRef) => {
    const issue = snapshot.issues.find((item) => item.id === issueRef);
    const request = requests.get(issueRef);
    const decision = decisionByIssue.get(issueRef);
    const assessment = assessments.get(decision.compositionAssessmentRef);
    const reservation = reservationByIssue.get(issueRef);
    const priorState = rows(decodedPreviousDecisions?.decisions).find(
      (item) =>
        item.issueRef === issueRef &&
        item.issueRevision === issue.revision &&
        ["reserved", "completed"].includes(item.state),
    )?.state;
    const state =
      decision.classification === "VARIANT"
        ? "variant-outside-catalog"
        : ["PRODUCT_DECISION", "RETIRE"].includes(decision.classification)
          ? "owner-decision-required"
          : decision.classification === "DUPLICATE"
            ? "owner-action-required"
            : decision.classification === "UNSUPPORTED"
              ? "blocked-authority"
              : priorState === "completed"
                ? "previously-completed"
                : priorState === "reserved"
                  ? "previously-reserved"
                  : reservation
                    ? "plan-ready"
                    : "blocked-budget";
    return {
      issueRef,
      issueRevision: issue.revision,
      provider: {
        repository: issue.repository,
        providerIssueId: issue.providerIssueId,
        number: issue.number,
        url: issue.url,
        state: issue.state,
        revision: issue.revision,
        etag: issue.etag,
        titleDigest: issue.title.digest,
        bodyDigest: issue.body.digest,
      },
      classification: decision.classification,
      rationaleCodes: decision.rationaleCodes,
      affectedClawIds: decision.affectedClawIds,
      evidenceRefs: request.evidenceRefs,
      evidenceLinks: request.evidenceRefs.map((ref) => ({
        ref,
        sourceIssueRef: issue.id,
        sourceIssueRevision: issue.revision,
      })),
      state,
      reservationRef: reservation?.id ?? null,
      ownerHandoff: {
        decisionId: input.run.decisionId,
        grantRefs: input.grants
          .filter((item) => item.issueRefs.includes(issueRef))
          .map((item) => item.id),
        prReadyPlan:
          state === "plan-ready"
            ? prReadyPlan(input, issue, request, decision, assessment)
            : null,
        externalMutation: false,
      },
    };
  });
  const usageEffects = input.usageEnvelopes.flatMap((envelope) =>
    envelope.records.flatMap((record) => [
      {
        evidenceRef: record.id,
        issueRef: record.issueRef,
        effect: "reprioritize-existing-issue",
        priorityDelta: record.failureCount > 0 ? 1 : 0,
        advisoryOnly: true,
        productionMutation: false,
      },
      {
        evidenceRef: record.id,
        issueRef: record.issueRef,
        effect: "create-draft-issue",
        requiresAdmission: true,
        advisoryOnly: true,
        productionMutation: false,
      },
    ]),
  );
  const result = {
    schemaVersion: V2_RESULT_VERSION,
    resultStatus: issueResults.some((item) => item.state.startsWith("blocked-"))
      ? "blocked-owner-handoff"
      : "ready-for-owner-review",
    run: {
      id: input.run.id,
      decisionId: input.run.decisionId,
      mode: input.run.mode,
      asOf,
      idempotencyKey: input.run.idempotencyKey,
      portfolioRevision: input.run.portfolioRevision,
      providerSnapshotRevision: snapshot.revision,
      packageTreeRevision: tree.revision,
      predecessorResultDigest: input.run.predecessorResultDigest,
      predecessorDecisionDigest: input.run.predecessorDecisionDigest,
      predecessorBudgetDigest: input.run.predecessorBudgetDigest,
    },
    onboarding: {
      mode: input.onboarding.mode,
      selectedClawIds: input.onboarding.selectedClawIds,
      firstRun: input.run.mode !== "manage",
    },
    issues: issueResults,
    budget: {
      ledgerRef: input.budgetLedger.id,
      ledgerRevision: input.budgetLedger.revision,
      leaseRef: input.budgetLedger.lease.id,
      atomicCheckpointConsumption: true,
      period: input.budgetLedger.period,
      caps: input.budgetLedger.caps,
      cumulativeBefore: input.budgetLedger.cumulativeBefore,
      reservations: input.budgetLedger.reservations,
      cumulativeAfter: input.budgetLedger.cumulativeAfter,
      withinCaps: Object.keys(input.budgetLedger.caps).every(
        (key) =>
          input.budgetLedger.cumulativeAfter[key] <=
          input.budgetLedger.caps[key],
      ),
      replayed: false,
      increaseAllowed: false,
    },
    usage: {
      supplied: usageEffects.length > 0,
      effects: usageEffects,
      correctnessOrSafetyOverride: false,
      productionMutation: false,
    },
    composition: {
      graphDigest: graph.graphDigest,
      currentVerdict: graph.verdict,
      typedLossIds: graph.losses.map((item) => item.id),
      reachableAuthority: graph.reachableAuthority,
    },
    antiCountIncentives: {
      rawClawCountObjective: false,
      composeOrImproveReservedBeforeNew: true,
      reservedNewCount: input.budgetLedger.reservations.filter(
        (item) => item.classification === "NEW",
      ).length,
      reservedComposeOrImproveCount: input.budgetLedger.reservations.filter(
        (item) => ["COMPOSE", "IMPROVE"].includes(item.classification),
      ).length,
    },
    authority: { ...AUTHORITY },
    findings: [],
  };
  const sealed = {
    ...result,
    resultDigest: sha256Digest(result),
  };
  return JSON.parse(canonicalJson(sealed));
}

export function renderPortfolioV2Proof(result) {
  if (result.resultStatus === "invalid") {
    return `# Claw Portfolio Manager V2 proof\n\n**Status:** invalid\n\n${result.findings
      .map((item) => `- \`${item.code}\` at \`${item.path}\``)
      .join("\n")}\n`;
  }
  const rows = result.issues
    .map(
      (item) =>
        `| ${item.provider.number} | ${item.classification} | ${item.state} | ${item.rationaleCodes.join(", ")} |`,
    )
    .join("\n");
  return `# Claw Portfolio Manager V2 proof

**Status:** ${result.resultStatus}
**Mode:** ${result.run.mode}
**Run / decision:** \`${result.run.id}\` / \`${result.run.decisionId}\`
**Result digest:** \`${result.resultDigest}\`

| Issue | Classification | State | Rationale |
| ---: | --- | --- | --- |
${rows}

The signed budget ledger reserves IMPROVE and COMPOSE before NEW and remains
within every cumulative period cap. Usage creates only advisory issue proposals
or priority hints. Production mutation, merge, publication, risk acceptance,
budget increase, sensitive-person inference, and resealing remain false.
`;
}

function readBoundedJson(path, maximumBytes) {
  const descriptor = openSync(path, "r");
  try {
    const buffer = Buffer.allocUnsafe(maximumBytes + 1);
    let total = 0;
    while (total <= maximumBytes) {
      const count = readSync(
        descriptor,
        buffer,
        total,
        maximumBytes + 1 - total,
        null,
      );
      if (count === 0) break;
      total += count;
    }
    if (total > maximumBytes) throw new Error("bounded-input-exceeded");
    return JSON.parse(buffer.subarray(0, total).toString("utf8"));
  } finally {
    closeSync(descriptor);
  }
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function runCli() {
  const inputPath = process.argv[2];
  const asOf = valueAfter("--as-of");
  const trustPath = valueAfter("--trust");
  const packageTreePath = valueAfter("--package-tree");
  if (!inputPath || !asOf || !trustPath || !packageTreePath) {
    process.stderr.write(
      "usage: node claw-portfolio-manager.mjs <input.json> --as-of <timestamp> --trust <trust.json> --package-tree <package-tree.json> [--markdown]\n",
    );
    process.exitCode = 2;
    return;
  }
  try {
    const result = await evaluatePortfolioV2(
      readBoundedJson(inputPath, V2_LIMITS.inputBytes),
      {
        asOf,
        publicTrust: readBoundedJson(trustPath, V2_LIMITS.trustBytes),
        packageTree: readBoundedJson(
          packageTreePath,
          V2_LIMITS.packageTreeBytes,
        ),
      },
    );
    const output = process.argv.includes("--markdown")
      ? renderPortfolioV2Proof(result)
      : `${JSON.stringify(result, null, 2)}\n`;
    if (Buffer.byteLength(output) > V2_LIMITS.outputBytes) {
      throw new Error("bounded-output-exceeded");
    }
    process.stdout.write(output);
    process.exitCode = result.resultStatus === "invalid" ? 1 : 0;
  } catch {
    process.stdout.write(
      `${JSON.stringify(
        invalidResult([finding("bounded-cli-failure", "$")]),
      )}\n`,
    );
    process.exitCode = 1;
  }
}

export function predecessorBytes(value) {
  return bytesRecord(value);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
