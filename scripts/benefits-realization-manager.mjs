import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import { readFileSync } from "node:fs";
import {
  readFile as readFileAsync,
  stat,
  writeFile as writeFileAsync,
} from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schema = JSON.parse(
  readFileSync(
    new URL(
      "../sources/benefits-realization-manager/schemas/benefits-realization-ledger.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateInputSchema = ajv.compile(schema);
const TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/u;

export const BENEFITS_REALIZATION_LIMITS = Object.freeze({
  maxInputBytes: 1024 * 1024,
  maxEvidenceRecords: 64,
  maxSourceRecords: 64,
  maxSourceBytesPerRecord: 256 * 1024,
  maxSourceBytesTotal: 1024 * 1024,
  maxSourceBundleFileBytes: 2 * 1024 * 1024,
});

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compareUtf16CodeUnits(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
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

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function computeInternalRecordDigest(record) {
  const { recordDigest: _recordDigest, ...content } = record;
  return sha256(canonicalJson(content));
}

export function computeInternalEvidenceDigest(evidence) {
  const { bindingDigest: _bindingDigest, ...content } = evidence;
  return sha256(canonicalJson(content));
}

export function sourceAuthoritySigningPayload(value) {
  const { signature: _signature, ...authority } = value.sourceAuthority;
  return canonicalJson({ ...value, sourceAuthority: authority });
}

function subjectEntries(value) {
  return [
    ["predecessor-ledger", value.predecessor],
    ...value.predecessor.transitions.map((record) => [
      "predecessor-transition",
      record,
    ]),
    ...value.kpis.map((record) => ["kpi", record]),
    ...value.benefits.map((record) => ["benefit", record]),
    ...value.allocationRules.map((record) => ["allocation-rule", record]),
    ...value.attributions.map((record) => ["attribution", record]),
    ["finance-review", value.financeReview],
  ];
}

function subjectMap(value) {
  return new Map(
    subjectEntries(value).map(([subjectType, record]) => [
      `${subjectType}:${record.id}`,
      { subjectType, record },
    ]),
  );
}

function normalizedSchemaPath(error) {
  if (error.keyword === "required") {
    return `${error.instancePath}/${error.params.missingProperty}` || "$";
  }
  if (error.keyword === "additionalProperties") {
    return `${error.instancePath}/${error.params.additionalProperty}` || "$";
  }
  return error.instancePath || "$";
}

function schemaCode(keyword) {
  return `schema-${keyword.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`;
}

export function benefitsRealizationSchemaFindings(input) {
  if (validateInputSchema(input)) return [];
  return (validateInputSchema.errors ?? [])
    .map((error) => ({
      code: schemaCode(error.keyword),
      path: normalizedSchemaPath(error),
      keyword: error.keyword,
      message: error.message ?? "Schema validation failed.",
    }))
    .sort((left, right) =>
      compareUtf16CodeUnits(
        `${left.path}\0${left.keyword}\0${left.message}`,
        `${right.path}\0${right.keyword}\0${right.message}`,
      ),
    );
}

function schemaFailureResult(input, schemaFindings) {
  const request = isRecord(input?.request) ? input.request : {};
  return {
    schemaVersion: "awesomeClaws.benefitsRealizationResult.v1",
    ledgerId:
      typeof request.ledgerId === "string" ? request.ledgerId : null,
    plan: null,
    predecessor: null,
    period: {
      start:
        typeof request.periodStart === "string" ? request.periodStart : null,
      end: typeof request.periodEnd === "string" ? request.periodEnd : null,
      cutoffAt:
        typeof request.cutoffAt === "string" ? request.cutoffAt : null,
    },
    status: "invalid-schema",
    sharedKpi: null,
    allocationRule: null,
    benefitResults: [],
    finance: null,
    evidenceProof: null,
    blockers: [],
    schemaFindings,
    contractFindings: [],
  };
}

function finding(code, path, message) {
  return { code, path, message };
}

function sameSet(left, right) {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((value) => right.includes(value))
  );
}

function time(value) {
  if (typeof value !== "string") return null;
  const match = TIMESTAMP_PATTERN.exec(value);
  if (!match) return null;
  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    offsetHourText,
    offsetMinuteText,
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = offsetHourText === undefined ? 0 : Number(offsetHourText);
  const offsetMinute =
    offsetMinuteText === undefined ? 0 : Number(offsetMinuteText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth[month - 1] ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function decodeCanonicalBase64(value) {
  const decoded = Buffer.from(value, "base64");
  return decoded.toString("base64") === value ? decoded : null;
}

function latestTimestamp(records, select) {
  let latest = Number.NEGATIVE_INFINITY;
  for (const record of records) {
    const current = select(record);
    if (current !== null && current > latest) latest = current;
  }
  return latest;
}

function supportedNumber(value) {
  const minimum = BigInt(Number.MIN_SAFE_INTEGER);
  const maximum = BigInt(Number.MAX_SAFE_INTEGER);
  return value >= minimum && value <= maximum ? Number(value) : null;
}

function directionalDelta(direction, baselineMinor, pointMinor) {
  return direction === "increase"
    ? pointMinor - baselineMinor
    : baselineMinor - pointMinor;
}

export function allocateMinorUnits(totalMinor, allocations) {
  if (
    !Number.isSafeInteger(totalMinor) ||
    !Array.isArray(allocations) ||
    allocations.some(
      (row) =>
        !Number.isInteger(row.basisPoints) ||
        row.basisPoints <= 0 ||
        typeof row.benefitRef !== "string",
    ) ||
    allocations.reduce((sum, row) => sum + row.basisPoints, 0) !== 10000
  ) {
    return null;
  }
  const sign = totalMinor < 0 ? -1 : 1;
  const absolute = BigInt(Math.abs(totalMinor));
  const denominator = 10000n;
  const apportioned = allocations.map((row) => {
    const numerator = absolute * BigInt(row.basisPoints);
    return {
      benefitRef: row.benefitRef,
      amount: numerator / denominator,
      remainder: numerator % denominator,
    };
  });
  let residual =
    absolute -
    apportioned.reduce((sum, row) => sum + row.amount, 0n);
  for (const row of [...apportioned].sort(
    (left, right) =>
      Number(right.remainder - left.remainder) ||
      compareUtf16CodeUnits(left.benefitRef, right.benefitRef),
  )) {
    if (residual === 0n) break;
    row.amount += 1n;
    residual -= 1n;
  }
  const result = new Map();
  for (const row of apportioned) {
    const amount = Number(row.amount) * sign;
    if (!Number.isSafeInteger(amount)) return null;
    result.set(row.benefitRef, amount);
  }
  return result;
}

function uniqueIds(records, path, findings) {
  const ids = records.map((record) => record.id);
  if (new Set(ids).size !== ids.length) {
    findings.push(
      finding(
        "duplicate-ledger-id",
        path,
        "Every ledger record must keep a stable, globally unique identity.",
      ),
    );
  }
}

function evidenceExpectation(
  evidence,
  subject,
  metricOwnerRef,
  financeOwnerRef,
  planOwnerRef,
) {
  const record = subject.record;
  if (subject.subjectType === "kpi") {
    const eventTimes = {
      "metric-baseline": record.baseline.asOf,
      "metric-target-approval": record.target.approvedAt,
      "metric-observation": record.observed.observedAt,
    };
    return {
      kinds: Object.keys(eventTimes),
      suppliers: [record.ownerRef],
      observedAt: eventTimes[evidence.kind],
    };
  }
  if (subject.subjectType === "predecessor-ledger") {
    return {
      kinds: ["predecessor-ledger"],
      suppliers: [planOwnerRef],
      observedAt: record.observedAt,
    };
  }
  if (subject.subjectType === "benefit") {
    return record.kind === "benefit"
      ? {
          kinds: ["benefit-profile"],
          suppliers: [record.ownerRef],
          observedAt: record.profileApprovedAt,
        }
      : {
          kinds: ["disbenefit-observation"],
          suppliers: [record.ownerRef],
          observedAt: record.directMeasure.observedAt,
        };
  }
  if (subject.subjectType === "predecessor-transition") {
    return {
      kinds: ["lifecycle-decision"],
      suppliers: [record.decidedByRef],
      observedAt: record.decidedAt,
    };
  }
  if (subject.subjectType === "allocation-rule") {
    return {
      kinds: ["allocation-approval"],
      suppliers: record.approvedByRefs,
      observedAt: record.approvedAt,
    };
  }
  if (subject.subjectType === "attribution") {
    return {
      kinds: ["attribution-support"],
      suppliers: [metricOwnerRef],
      observedAt: record.assessedAt,
    };
  }
  return {
    kinds: ["finance-reconciliation"],
    suppliers: [financeOwnerRef],
    observedAt: record.reviewedAt,
  };
}

function trustStoreEntry(options, ownerRef, signingKeyId) {
  const entry = options?.trustStore?.authorities?.[ownerRef]?.[signingKeyId];
  return typeof entry?.publicKeyDerBase64 === "string" ? entry : null;
}

function validSourceAuthority(
  value,
  financeOwnerRef,
  cutoff,
  options,
  findings,
) {
  const authority = value.sourceAuthority;
  const trusted = trustStoreEntry(
    options,
    authority.ownerRef,
    authority.signingKeyId,
  );
  if (!trusted) {
    findings.push(
      finding(
        "missing-trust-store",
        "sourceAuthority",
        "Validation requires an injected trust-store entry keyed by both ownerRef and signingKeyId; there is no production default.",
      ),
    );
  }
  let signatureValid = false;
  if (trusted !== null) {
    try {
      signatureValid = verifySignature(
        null,
        Buffer.from(sourceAuthoritySigningPayload(value)),
        createPublicKey({
          key: Buffer.from(trusted.publicKeyDerBase64, "base64"),
          format: "der",
          type: "spki",
        }),
        Buffer.from(authority.signature, "base64"),
      );
    } catch (error) {
      findings.push(
        finding(
          "invalid-trust-store-key",
          "sourceAuthority.signingKeyId",
          `The injected public key could not verify this authority envelope: ${error.message}`,
        ),
      );
    }
  }
  const issuedAt = time(authority.issuedAt);
  const latestEvidence = latestTimestamp(
    value.evidence,
    (record) => time(record.observedAt),
  );
  if (
    authority.ownerRef !== financeOwnerRef ||
    issuedAt === null ||
    issuedAt < latestEvidence ||
    issuedAt > cutoff ||
    !signatureValid
  ) {
    findings.push(
      finding(
        "invalid-source-authority",
        "sourceAuthority",
        "The source manifest must be signed by a trusted key for the typed finance owner after its evidence and no later than the caller cutoff.",
      ),
    );
  }
  return signatureValid;
}

function sourceBytesFindings(value, options, findings) {
  if (
    Number.isFinite(options?.sourceBundleByteLength) &&
    options.sourceBundleByteLength >
      BENEFITS_REALIZATION_LIMITS.maxSourceBundleFileBytes
  ) {
    findings.push(
      finding(
        "source-bundle-too-large",
        "sourceBundle",
        `The source bundle exceeds ${BENEFITS_REALIZATION_LIMITS.maxSourceBundleFileBytes} bytes.`,
      ),
    );
    return { verified: new Set(), bytesByEvidence: new Map() };
  }
  const sourceRows = Array.isArray(options?.sourceBundle?.sources)
    ? options.sourceBundle.sources
    : [];
  if (sourceRows.length > BENEFITS_REALIZATION_LIMITS.maxSourceRecords) {
    findings.push(
      finding(
        "source-record-limit-exceeded",
        "sourceBundle.sources",
        `The source bundle may contain at most ${BENEFITS_REALIZATION_LIMITS.maxSourceRecords} records.`,
      ),
    );
    return { verified: new Set(), bytesByEvidence: new Map() };
  }
  const referencedSourceKeys = new Set(
    value.evidence.map(
      (record) => `${record.sourceRef}\0${record.sourceVersion}`,
    ),
  );
  const sources = new Map();
  let totalSourceBytes = 0;
  for (const [index, source] of sourceRows.entries()) {
    if (
      typeof source?.sourceRef !== "string" ||
      typeof source?.sourceVersion !== "string" ||
      typeof source?.bytesBase64 !== "string"
    ) {
      findings.push(
        finding(
          "invalid-source-record",
          `sourceBundle.sources[${index}]`,
          "Every supplied source record requires sourceRef, sourceVersion, and Base64 bytes.",
        ),
      );
      continue;
    }
    const sourceKey = `${source.sourceRef}\0${source.sourceVersion}`;
    if (sources.has(sourceKey)) {
      findings.push(
        finding(
          "duplicate-source-record",
          `sourceBundle.sources[${index}]`,
          "Each supplied sourceRef and sourceVersion pair must appear exactly once.",
        ),
      );
    }
    if (!referencedSourceKeys.has(sourceKey)) {
      findings.push(
        finding(
          "unreferenced-source-record",
          `sourceBundle.sources[${index}]`,
          "This supplied source record is not referenced by any evidence row.",
        ),
      );
    }
    const maximumBase64Length =
      Math.ceil(
        BENEFITS_REALIZATION_LIMITS.maxSourceBytesPerRecord / 3,
      ) *
        4 +
      4;
    if (source.bytesBase64.length > maximumBase64Length) {
      findings.push(
        finding(
          "source-item-too-large",
          `sourceBundle.sources[${index}]`,
          `One source may contain at most ${BENEFITS_REALIZATION_LIMITS.maxSourceBytesPerRecord} decoded bytes.`,
        ),
      );
      continue;
    }
    const sourceBytes = decodeCanonicalBase64(source.bytesBase64);
    if (sourceBytes === null) {
      findings.push(
        finding(
          "invalid-source-bytes",
          `sourceBundle.sources[${index}].bytesBase64`,
          "Supplied source bytes must use canonical Base64 encoding.",
        ),
      );
      continue;
    }
    totalSourceBytes += sourceBytes.length;
    if (
      sourceBytes.length >
      BENEFITS_REALIZATION_LIMITS.maxSourceBytesPerRecord
    ) {
      findings.push(
        finding(
          "source-item-too-large",
          `sourceBundle.sources[${index}]`,
          "Supplied source bytes exceed the supported per-record boundary.",
        ),
      );
      continue;
    }
    if (!sources.has(sourceKey)) {
      sources.set(sourceKey, { source, sourceBytes });
    }
  }
  if (totalSourceBytes > BENEFITS_REALIZATION_LIMITS.maxSourceBytesTotal) {
    findings.push(
      finding(
        "source-total-too-large",
        "sourceBundle.sources",
        `Supplied source records contain ${totalSourceBytes} decoded bytes; the aggregate limit is ${BENEFITS_REALIZATION_LIMITS.maxSourceBytesTotal}.`,
      ),
    );
  }

  const verified = new Set();
  const bytesByEvidence = new Map();
  for (const [index, evidence] of value.evidence.entries()) {
    const prepared = sources.get(
      `${evidence.sourceRef}\0${evidence.sourceVersion}`,
    );
    if (!prepared) {
      findings.push(
        finding(
          "missing-source-bytes",
          `evidence[${index}]`,
          "Validation requires supplied source bytes for the exact sourceRef and sourceVersion.",
        ),
      );
      continue;
    }
    const digest = sha256(prepared.sourceBytes);
    if (digest !== evidence.sourceContentDigest) {
      findings.push(
        finding(
          "source-content-digest-mismatch",
          `evidence[${index}].sourceContentDigest`,
          "The declared source content digest must match the supplied source bytes.",
        ),
      );
      continue;
    }
    verified.add(evidence.id);
    bytesByEvidence.set(evidence.id, prepared.sourceBytes);
  }
  return { verified, bytesByEvidence };
}

function groupIntegerDigits(digits) {
  const firstGroupLength = digits.length % 3 || 3;
  let grouped = digits.slice(0, firstGroupLength);
  for (let index = firstGroupLength; index < digits.length; index += 3) {
    grouped += `,${digits.slice(index, index + 3)}`;
  }
  return grouped;
}

export function formatMinorUnits(value, currency, scale) {
  if (
    !Number.isSafeInteger(value) ||
    !Number.isSafeInteger(scale) ||
    scale <= 0 ||
    !/^10*$/u.test(String(scale))
  ) {
    return "blocked";
  }
  let minorUnits = BigInt(value);
  const negative = minorUnits < 0n;
  if (negative) minorUnits = -minorUnits;
  const scaleUnits = BigInt(scale);
  const majorUnits = minorUnits / scaleUnits;
  const remainder = minorUnits % scaleUnits;
  const fractionDigits = String(scale).length - 1;
  const fraction =
    fractionDigits === 0
      ? ""
      : `.${remainder.toString().padStart(fractionDigits, "0")}`;
  const currencyPrefix = currency === "USD" ? "$" : `${currency} `;
  return `${negative ? "-" : ""}${currencyPrefix}${groupIntegerDigits(majorUnits.toString())}${fraction}`;
}

export function evaluateBenefitsRealizationSlice(input, options = {}) {
  let inputByteLength = options.inputByteLength;
  if (!Number.isSafeInteger(inputByteLength) || inputByteLength < 0) {
    try {
      inputByteLength = Buffer.byteLength(JSON.stringify(input));
    } catch (error) {
      return schemaFailureResult(input, [
        {
          code: "input-not-json-compatible",
          path: "$",
          keyword: "serialization",
          message: `Input cannot be measured as JSON: ${error.message}`,
        },
      ]);
    }
  }
  if (inputByteLength > BENEFITS_REALIZATION_LIMITS.maxInputBytes) {
    return schemaFailureResult(input, [
      {
        code: "input-too-large",
        path: "$",
        keyword: "maxBytes",
        message: `Input exceeds ${BENEFITS_REALIZATION_LIMITS.maxInputBytes} bytes.`,
      },
    ]);
  }
  const schemaFindings = benefitsRealizationSchemaFindings(input);
  if (schemaFindings.length > 0) {
    return schemaFailureResult(input, schemaFindings);
  }

  const value = input;
  const findings = [];
  const blockers = [];
  const {
    plan,
    predecessor,
    request,
    principals,
    kpis,
    benefits,
    allocationRules,
    attributions,
    financeReview,
    evidence,
  } = value;
  const principalById = new Map(principals.map((record) => [record.id, record]));
  const benefitById = new Map(benefits.map((record) => [record.id, record]));
  const attributionById = new Map(
    attributions.map((record) => [record.id, record]),
  );
  const evidenceById = new Map(evidence.map((record) => [record.id, record]));
  const subjects = subjectMap(value);
  const kpi = kpis[0];
  const allocationRule = allocationRules[0];
  const metricOwnerRef = kpi.ownerRef;
  const financeOwnerRef = financeReview.ownerRef;
  const positiveBenefits = benefits.filter((record) => record.kind === "benefit");
  const disbenefits = benefits.filter((record) => record.kind === "disbenefit");

  uniqueIds(
    [
      ...principals,
      ...subjectEntries(value).map(([, record]) => record),
      ...evidence,
    ],
    "$",
    findings,
  );

  const periodStart = time(`${request.periodStart}T00:00:00Z`);
  const periodEnd = time(`${request.periodEnd}T23:59:59.999Z`);
  const cutoff = time(request.cutoffAt);
  const trustedAsOf = time(options.asOf);
  if (
    trustedAsOf === null ||
    cutoff > trustedAsOf ||
    periodStart > periodEnd ||
    periodEnd > cutoff
  ) {
    findings.push(
      finding(
        trustedAsOf === null || cutoff > trustedAsOf
          ? "invalid-validation-context"
          : "invalid-caller-window",
        "request",
        "The caller must supply a trusted asOf that bounds the signed cutoff and an ordered period ending no later than that cutoff; validation never substitutes wall-clock time.",
      ),
    );
  }
  const planApprovedAt = time(plan.approvedAt);
  const predecessorObservedAt = time(predecessor.observedAt);
  const linkedPredecessor = predecessor.state === "linked";
  if (
    principalById.get(plan.ownerRef)?.role !== "benefit-owner" ||
    planApprovedAt >= periodStart ||
    planApprovedAt > cutoff ||
    (plan.revision === 1
      ? plan.predecessorRevision !== null ||
        predecessor.state !== "first-plan" ||
        predecessor.revision !== null ||
        predecessor.ledgerRef !== null ||
        predecessor.ledgerContentDigest !== null ||
        predecessor.periodEnd !== null ||
        predecessor.observedAt !== null ||
        predecessor.benefitCount !== 0 ||
        predecessor.transitions.length !== 0
      : !linkedPredecessor ||
        plan.predecessorRevision !== plan.revision - 1 ||
        predecessor.revision !== plan.predecessorRevision ||
        predecessor.ledgerRef === null ||
        predecessor.ledgerContentDigest === null ||
        predecessor.periodEnd === null ||
        predecessorObservedAt === null ||
        time(`${predecessor.periodEnd}T23:59:59.999Z`) >= periodStart ||
        predecessorObservedAt < time(`${predecessor.periodEnd}T00:00:00Z`) ||
        predecessorObservedAt > planApprovedAt ||
        predecessor.benefitCount !== predecessor.transitions.length)
  ) {
    findings.push(
      finding(
        "invalid-plan-lineage",
        "plan",
        "The owner-approved plan revision must bind an exact prior revision and complete predecessor benefit universe, or declare an empty first plan, before the current period.",
      ),
    );
  }

  if (linkedPredecessor) {
    const transitionIds = predecessor.transitions.map((record) => record.id);
    const predecessorBenefitRefs = predecessor.transitions.map(
      (record) => record.predecessorBenefitRef,
    );
    const currentTransitionRefs = predecessor.transitions
      .map((record) => record.currentBenefitRef)
      .filter((reference) => reference !== null);
    if (
      new Set(transitionIds).size !== transitionIds.length ||
      new Set(predecessorBenefitRefs).size !== predecessorBenefitRefs.length ||
      new Set(currentTransitionRefs).size !== currentTransitionRefs.length
    ) {
      findings.push(
        finding(
          "invalid-predecessor-coverage",
          "predecessor.transitions",
          "Predecessor transition, predecessor benefit, and current benefit identities must each be unique.",
        ),
      );
    }
    for (const [index, transition] of predecessor.transitions.entries()) {
      const current =
        transition.currentBenefitRef === null
          ? null
          : benefitById.get(transition.currentBenefitRef);
      const expectedOwner = current?.ownerRef ?? plan.ownerRef;
      const dispositionMatches =
        transition.disposition === "retired"
          ? transition.currentBenefitRef === null
          : current !== undefined &&
            current.lifecycle.predecessorBenefitRef ===
              transition.predecessorBenefitRef &&
            ((transition.disposition === "continued" &&
              current.lifecycle.origin === "continued") ||
              (transition.disposition === "superseded" &&
                current.lifecycle.origin === "superseding"));
      if (
        !dispositionMatches ||
        transition.decidedByRef !== expectedOwner ||
        principalById.get(transition.decidedByRef)?.role !== "benefit-owner" ||
        time(transition.decidedAt) < predecessorObservedAt ||
        time(transition.decidedAt) > planApprovedAt ||
        (current !== null &&
          time(transition.decidedAt) >= time(current.profileApprovedAt))
      ) {
        findings.push(
          finding(
            "invalid-predecessor-transition",
            `predecessor.transitions[${index}]`,
            "Each predecessor benefit must be continued, superseded, or retired once by the responsible benefit owner after predecessor evidence and before current profile approval.",
          ),
        );
      }
    }
    for (const [index, benefit] of benefits.entries()) {
      const matches = predecessor.transitions.filter(
        (record) => record.currentBenefitRef === benefit.id,
      );
      const valid =
        benefit.lifecycle.origin === "new"
          ? benefit.lifecycle.predecessorBenefitRef === null &&
            matches.length === 0
          : benefit.lifecycle.predecessorBenefitRef !== null &&
            matches.length === 1;
      if (!valid) {
        findings.push(
          finding(
            "invalid-benefit-lineage",
            `benefits[${index}].lifecycle`,
            "Every current benefit must be exactly new or covered by one predecessor continuation or supersession.",
          ),
        );
      }
    }
  }

  for (const [index, principal] of principals.entries()) {
    if (
      time(principal.authorityObservedAt) > cutoff ||
      principal.kind !== "human"
    ) {
      findings.push(
        finding(
          "invalid-owner-authority",
          `principals[${index}]`,
          "Typed owner authority must belong to a named human and predate the caller cutoff.",
        ),
      );
    }
  }
  const normalizedNames = principals.map((record) =>
    record.name.trim().toLocaleLowerCase("en-US"),
  );
  const identityRefs = principals.map((record) => record.humanIdentityRef);
  const authorityRefs = principals.map((record) => record.authoritySourceRef);
  if (
    new Set(normalizedNames).size !== normalizedNames.length ||
    new Set(identityRefs).size !== identityRefs.length ||
    new Set(authorityRefs).size !== authorityRefs.length
  ) {
    findings.push(
      finding(
        "duplicate-owner-identity",
        "principals",
        "Distinct owner records require distinct normalized names, stable human identity refs, and authority source refs.",
      ),
    );
  }

  if (
    positiveBenefits.length === 0 ||
    attributions.length !== positiveBenefits.length
  ) {
    findings.push(
      finding(
        "invalid-falsification-scope",
        "$",
        "The ledger requires at least one benefit, optional disbenefits, one shared KPI, one allocation rule, and exactly one attribution per benefit.",
      ),
    );
  }

  const benefitOwnerRefs = positiveBenefits.map((record) => record.ownerRef);
  if (
    new Set(benefitOwnerRefs).size !== benefitOwnerRefs.length ||
    benefitOwnerRefs.some(
      (ownerRef) => principalById.get(ownerRef)?.role !== "benefit-owner",
    )
  ) {
    findings.push(
      finding(
        "benefits-not-separately-owned",
        "benefits",
        "The candidate claims separately owned benefits, so each benefit must have a different typed benefit owner.",
      ),
    );
  }

  if (
    kpi.unit !== request.currency ||
    principalById.get(metricOwnerRef)?.role !== "metric-owner"
  ) {
    findings.push(
      finding(
        "incompatible-kpi-unit",
        "kpis[0].unit",
        "Financial V1 requires the shared KPI unit to equal the request currency and remain owned by the typed metric owner.",
      ),
    );
  }
  if (
    time(kpi.baseline.asOf) > periodStart ||
    time(kpi.target.approvedAt) > cutoff ||
    time(kpi.target.approvedAt) >= time(kpi.target.dueAt) ||
    time(kpi.target.approvedAt) >= periodStart ||
    time(kpi.target.approvedAt) >= time(kpi.observed.observedAt) ||
    kpi.target.dueAt !== `${request.periodEnd}T23:59:59Z` ||
    kpi.observed.windowStart !== request.periodStart ||
    kpi.observed.windowEnd !== request.periodEnd ||
    time(kpi.observed.observedAt) < periodEnd ||
    time(kpi.observed.observedAt) > cutoff
  ) {
    findings.push(
      finding(
        "invalid-shared-kpi-chronology",
        "kpis[0]",
        "The KPI must preserve its baseline, approved target, exact period observation, and caller cutoff chronology.",
      ),
    );
  }
  const kpiEvidence = kpi.evidenceRefs
    .map((reference) => evidenceById.get(reference))
    .filter(Boolean);
  if (
    !sameSet(
      kpiEvidence.map((record) => record.kind),
      ["metric-baseline", "metric-target-approval", "metric-observation"],
    ) ||
    kpiEvidence.some((record) => record.suppliedByRef !== metricOwnerRef)
  ) {
    findings.push(
      finding(
        "incomplete-kpi-evidence",
        "kpis[0].evidenceRefs",
        "The metric owner must reciprocally supply separate baseline, target-approval, and observation evidence.",
      ),
    );
  }

  const allocationIds = allocationRule.allocations.map(
    (record) => record.benefitRef,
  );
  const positiveIds = positiveBenefits.map((record) => record.id);
  const requiredApprovers = [metricOwnerRef, financeOwnerRef];
  const allocationApprovalEvidence = allocationRule.evidenceRefs
    .map((reference) => evidenceById.get(reference))
    .filter(Boolean);
  if (
    allocationRule.metricRef !== kpi.id ||
    allocationRule.effectivePeriodStart !== request.periodStart ||
    allocationRule.effectivePeriodEnd !== request.periodEnd ||
    !sameSet(allocationIds, positiveIds) ||
    allocationRule.allocations.reduce(
      (sum, record) => sum + record.basisPoints,
      0,
    ) !== 10000 ||
    !sameSet(allocationRule.approvedByRefs, requiredApprovers) ||
    !sameSet(
      allocationApprovalEvidence.map((record) => record.suppliedByRef),
      requiredApprovers,
    ) ||
    allocationApprovalEvidence.some(
      (record) =>
        record.kind !== "allocation-approval" ||
        record.observedAt !== allocationRule.approvedAt,
    )
  ) {
    findings.push(
      finding(
        "invalid-allocation-rule",
        "allocationRules[0]",
        "The allocation must cover each benefit once, total 10,000 basis points, and carry reciprocal approvals from both the metric and finance owners.",
      ),
    );
  }

  const targetDeltaMinor = directionalDelta(
    kpi.direction,
    kpi.baseline.valueMinor,
    kpi.target.valueMinor,
  );
  const observedDeltaMinor = directionalDelta(
    kpi.direction,
    kpi.baseline.valueMinor,
    kpi.observed.valueMinor,
  );
  const baselineShares = allocateMinorUnits(
    kpi.baseline.valueMinor,
    allocationRule.allocations,
  );
  const targetShares = allocateMinorUnits(
    targetDeltaMinor,
    allocationRule.allocations,
  );
  const observedShares = allocateMinorUnits(
    observedDeltaMinor,
    allocationRule.allocations,
  );
  if (
    targetDeltaMinor < 0 ||
    baselineShares === null ||
    targetShares === null ||
    observedShares === null
  ) {
    findings.push(
      finding(
        "invalid-realization-math",
        "kpis[0]",
        "Direction-aware KPI deltas and largest-remainder allocation must be exactly representable in safe integer currency minor units.",
      ),
    );
  }

  for (const [index, benefit] of benefits.entries()) {
    if (principalById.get(benefit.ownerRef)?.role !== "benefit-owner") {
      findings.push(
        finding(
          "invalid-benefit-owner",
          `benefits[${index}].ownerRef`,
          "Every benefit and disbenefit must retain a typed human benefit owner.",
        ),
      );
    }
    if (benefit.kind === "benefit") {
      if (
        benefit.metricRef !== kpi.id ||
        benefit.allocationRuleRef !== allocationRule.id ||
        benefit.directMeasure !== null ||
        attributionById.get(benefit.attributionRef)?.benefitRef !== benefit.id ||
        time(benefit.profileApprovedAt) >= time(kpi.observed.observedAt)
      ) {
        findings.push(
          finding(
            "invalid-benefit-profile",
            `benefits[${index}]`,
            "Each benefit must retain its identity, distinct owner, shared KPI, allocation rule, and attribution.",
          ),
        );
      }
    } else if (
      benefit.metricRef !== null ||
      benefit.allocationRuleRef !== null ||
      benefit.attributionRef !== null ||
      benefit.directMeasure.observedMinor <
        benefit.directMeasure.baselineMinor ||
      benefit.directMeasure.targetMinor <
        benefit.directMeasure.baselineMinor ||
      time(benefit.profileApprovedAt) >=
        time(benefit.directMeasure.observedAt) ||
      time(benefit.directMeasure.observedAt) < periodEnd ||
      time(benefit.directMeasure.observedAt) > cutoff
    ) {
      findings.push(
        finding(
          "invalid-disbenefit-profile",
          `benefits[${index}]`,
          "The disbenefit must stay outside shared-KPI allocation and retain its own baseline, target, observation, owner, and cutoff chronology.",
        ),
      );
    }
  }

  for (const [index, attribution] of attributions.entries()) {
    const benefit = benefitById.get(attribution.benefitRef);
    const structurallyBound =
      benefit?.kind === "benefit" &&
      benefit.attributionRef === attribution.id &&
      attribution.metricRef === kpi.id &&
      attribution.allocationRuleRef === allocationRule.id &&
      attribution.causalClaim === false &&
      time(allocationRule.approvedAt) < time(attribution.assessedAt) &&
      time(kpi.observed.observedAt) <= time(attribution.assessedAt) &&
      time(attribution.assessedAt) <= cutoff;
    if (!structurallyBound) {
      findings.push(
        finding(
          "invalid-attribution-binding",
          `attributions[${index}]`,
          "Attribution must follow allocation approval and KPI observation, bind the exact benefit and rule, and make no causal claim.",
        ),
      );
      continue;
    }
    if (attribution.status === "supported" && attribution.evidenceRefs.length === 0) {
      findings.push(
        finding(
          "invalid-supported-attribution",
          `attributions[${index}]`,
          "Supported attribution requires reciprocal owner-anchored evidence.",
        ),
      );
    }
    if (attribution.status === "unsupported") {
      blockers.push({
        code: "unsupported-attribution",
        targetRefs: [benefit.id, attribution.id],
        ownerRef: benefit.ownerRef,
        metricRef: attribution.metricRef,
        allocationRuleRef: attribution.allocationRuleRef,
        evidenceRefs: [...attribution.evidenceRefs],
        reason:
          "The benefit remains unrecognized because its allocation lacks owner-anchored reciprocal attribution evidence.",
      });
    }
  }

  const subjectDigestValid = new Set();
  for (const [subjectType, record] of subjectEntries(value)) {
    const key = `${subjectType}:${record.id}`;
    if (record.recordDigest === computeInternalRecordDigest(record)) {
      subjectDigestValid.add(key);
    } else {
      findings.push(
        finding(
          "internal-record-digest-mismatch",
          key,
          "The self-resealable record digest is an internal consistency check and must match current content.",
        ),
      );
    }
  }

  const sourceAuthoritySignatureVerified = validSourceAuthority(
    value,
    financeOwnerRef,
    cutoff,
    options,
    findings,
  );
  const {
    verified: sourceBytesVerified,
    bytesByEvidence: sourceBytesByEvidence,
  } = sourceBytesFindings(value, options, findings);
  if (linkedPredecessor) {
    const predecessorEvidence =
      predecessor.evidenceRefs.length === 1
        ? evidenceById.get(predecessor.evidenceRefs[0])
        : null;
    const predecessorBytes = predecessorEvidence
      ? sourceBytesByEvidence.get(predecessorEvidence.id)
      : null;
    if (
      predecessor.evidenceRefs.length !== 1 ||
      predecessorEvidence?.kind !== "predecessor-ledger" ||
      predecessorEvidence.subjectType !== "predecessor-ledger" ||
      predecessorEvidence.subjectRef !== predecessor.id ||
      predecessorEvidence.sourceRef !== predecessor.ledgerRef ||
      predecessorEvidence.sourceVersion !== predecessor.ledgerSourceVersion ||
      predecessorEvidence.sourceContentDigest !==
        predecessor.ledgerContentDigest ||
      !predecessorBytes
    ) {
      findings.push(
        finding(
          "invalid-predecessor-source",
          "predecessor",
          "A linked predecessor requires exactly one reciprocal source record whose verified bytes bind the exact ledger reference, version, and content digest.",
        ),
      );
    } else {
      let predecessorContent;
      try {
        predecessorContent = JSON.parse(predecessorBytes.toString("utf8"));
      } catch (error) {
        findings.push(
          finding(
            "invalid-predecessor-content",
            "predecessor.ledgerContentDigest",
            `Verified predecessor bytes are not valid JSON: ${error.message}`,
          ),
        );
      }
      if (!isRecord(predecessorContent)) {
        findings.push(
          finding(
            "invalid-predecessor-content",
            "predecessor.ledgerContentDigest",
            "Verified predecessor bytes must contain one JSON object.",
          ),
        );
      } else {
        const predecessorBenefitIds = Array.isArray(
          predecessorContent.benefits,
        )
          ? predecessorContent.benefits.map((record) => record?.id)
          : [];
        const transitionBenefitIds = predecessor.transitions.map(
          (record) => record.predecessorBenefitRef,
        );
        const exactTopLevel =
          Object.keys(predecessorContent).toSorted().join("\0") ===
            [
              "benefits",
              "periodEnd",
              "planId",
              "revision",
              "schemaVersion",
            ].join("\0");
        const exactBenefitRows =
          Array.isArray(predecessorContent.benefits) &&
          predecessorContent.benefits.every(
            (record) =>
              isRecord(record) &&
              Object.keys(record).toSorted().join("\0") === "id\0kind" &&
              typeof record.id === "string" &&
              ["benefit", "disbenefit"].includes(record.kind),
          );
        if (
          !exactTopLevel ||
          !exactBenefitRows ||
          predecessorContent.schemaVersion !==
            "awesomeClaws.predecessorBenefitUniverse.v1" ||
          predecessorContent.planId !== plan.id ||
          predecessorContent.revision !== predecessor.revision ||
          predecessorContent.periodEnd !== predecessor.periodEnd ||
          predecessorBenefitIds.length !==
            new Set(predecessorBenefitIds).size ||
          predecessorBenefitIds.length !== predecessor.benefitCount ||
          !sameSet(predecessorBenefitIds, transitionBenefitIds)
        ) {
          findings.push(
            finding(
              "invalid-predecessor-coverage",
              "predecessor.transitions",
              "Transitions must exactly cover the unique benefit identities parsed from the verified predecessor-ledger bytes; caller counts or renamed identities are not authoritative.",
            ),
          );
        }
      }
    }
  } else if (predecessor.evidenceRefs.length !== 0) {
    findings.push(
      finding(
        "invalid-predecessor-source",
        "predecessor.evidenceRefs",
        "A first plan cannot carry predecessor-ledger evidence.",
      ),
    );
  }
  const manifestByEvidence = new Map(
    value.sourceAuthority.records.map((record) => [
      record.evidenceRef,
      record,
    ]),
  );
  if (
    manifestByEvidence.size !== value.sourceAuthority.records.length ||
    !sameSet(
      value.sourceAuthority.records.map((record) => record.evidenceRef),
      evidence.map((record) => record.id),
    )
  ) {
    findings.push(
      finding(
        "invalid-source-manifest-coverage",
        "sourceAuthority.records",
        "The signed source manifest must cover every evidence row exactly once and no others.",
      ),
    );
  }

  const internalEvidenceValid = new Set();
  const reciprocalEvidence = new Set();
  const sourceAnchoredEvidence = new Set();
  for (const [index, record] of evidence.entries()) {
    const key = `${record.subjectType}:${record.subjectRef}`;
    const subject = subjects.get(key);
    const expectation = subject
      ? evidenceExpectation(
          record,
          subject,
          metricOwnerRef,
          financeOwnerRef,
          plan.ownerRef,
        )
      : null;
    const manifestRecord = manifestByEvidence.get(record.id);
    if (record.bindingDigest === computeInternalEvidenceDigest(record)) {
      internalEvidenceValid.add(record.id);
    } else {
      findings.push(
        finding(
          "internal-evidence-digest-mismatch",
          `evidence[${index}].bindingDigest`,
          "The self-resealable evidence digest is an internal consistency check and must match current content.",
        ),
      );
    }
    if (
      !subject ||
      record.subjectRecordDigest !== subject.record.recordDigest ||
      !subject.record.evidenceRefs.includes(record.id)
    ) {
      findings.push(
        finding(
          "nonreciprocal-evidence",
          `evidence[${index}]`,
          "Evidence must bind one exact internal subject digest and be reciprocally listed by that subject.",
        ),
      );
    } else {
      reciprocalEvidence.add(record.id);
    }
    if (
      !expectation ||
      !expectation.kinds.includes(record.kind) ||
      !expectation.suppliers.includes(record.suppliedByRef) ||
      record.observedAt !== expectation.observedAt ||
      time(record.observedAt) > cutoff
    ) {
      findings.push(
        finding(
          "invalid-evidence-authority-or-chronology",
          `evidence[${index}]`,
          "Evidence kind, supplier, and timestamp must match the exact subject owner event and caller cutoff.",
        ),
      );
    }
    const manifested = {
      evidenceRef: record.id,
      subjectType: record.subjectType,
      subjectRef: record.subjectRef,
      subjectRecordDigest: record.subjectRecordDigest,
      sourceRef: record.sourceRef,
      sourceVersion: record.sourceVersion,
      sourceContentDigest: record.sourceContentDigest,
      suppliedByRef: record.suppliedByRef,
    };
    if (
      record.sourceAuthorityRef !== value.sourceAuthority.id ||
      canonicalJson(manifestRecord) !== canonicalJson(manifested)
    ) {
      findings.push(
        finding(
          "untrusted-source-evidence",
          `evidence[${index}]`,
          "Evidence must exactly match a record in the signed owner-supplied source manifest; fixture sealing cannot update that trust root.",
        ),
      );
    } else if (sourceAuthoritySignatureVerified) {
      sourceAnchoredEvidence.add(record.id);
    }
  }

  for (const [subjectType, record] of subjectEntries(value)) {
    for (const evidenceRef of record.evidenceRefs) {
      const linked = evidenceById.get(evidenceRef);
      if (
        linked?.subjectType !== subjectType ||
        linked?.subjectRef !== record.id
      ) {
        findings.push(
          finding(
            "nonreciprocal-evidence",
            `${subjectType}:${record.id}.evidenceRefs`,
            "Every subject evidence reference must point back to that exact subject.",
          ),
        );
      }
    }
  }

  const allAttributionsSupported = attributions.every(
    (record) => record.status === "supported",
  );
  const disbenefitMinorBigInt = disbenefits.reduce(
    (total, disbenefit) =>
      total +
      BigInt(disbenefit.directMeasure.observedMinor) -
      BigInt(disbenefit.directMeasure.baselineMinor),
    0n,
  );
  const disbenefitMinor = supportedNumber(disbenefitMinorBigInt);
  const latestAttribution = latestTimestamp(
    attributions,
    (record) => time(record.assessedAt),
  );
  const financeCloseInvalid =
    principalById.get(financeOwnerRef)?.role !== "finance-owner" ||
    financeOwnerRef === metricOwnerRef ||
    positiveBenefits.some((record) => record.ownerRef === financeOwnerRef) ||
    (allAttributionsSupported &&
      (financeReview.reviewedAt === null ||
        financeReview.evidenceRefs.length !== 1 ||
        time(financeReview.reviewedAt) <= latestAttribution ||
        time(financeReview.reviewedAt) <= time(allocationRule.approvedAt) ||
        time(financeReview.reviewedAt) > cutoff)) ||
    (!allAttributionsSupported &&
      (financeReview.reviewedAt !== null ||
        financeReview.evidenceRefs.length !== 0));
  if (financeCloseInvalid) {
    findings.push(
      finding(
        "invalid-finance-close",
        "financeReview",
        "The distinct finance owner may close only after allocation approval and every supported attribution; otherwise the finance close remains absent.",
      ),
    );
  }

  for (const [index, principal] of principals.entries()) {
    const actionTimes = [];
    for (const benefit of benefits.filter(
      (record) => record.ownerRef === principal.id,
    )) {
      actionTimes.push(time(benefit.profileApprovedAt));
      if (benefit.kind === "disbenefit") {
        actionTimes.push(time(benefit.directMeasure.observedAt));
      }
    }
    if (principal.id === metricOwnerRef) {
      actionTimes.push(
        time(kpi.baseline.asOf),
        time(kpi.target.approvedAt),
        time(kpi.observed.observedAt),
        time(allocationRule.approvedAt),
        ...attributions.map((record) => time(record.assessedAt)),
      );
    }
    if (principal.id === financeOwnerRef) {
      actionTimes.push(
        time(allocationRule.approvedAt),
        time(value.sourceAuthority.issuedAt),
      );
      if (financeReview.reviewedAt !== null) {
        actionTimes.push(time(financeReview.reviewedAt));
      }
    }
    if (principal.id === plan.ownerRef) {
      actionTimes.push(planApprovedAt);
    }
    for (const transition of predecessor.transitions.filter(
      (record) => record.decidedByRef === principal.id,
    )) {
      actionTimes.push(time(transition.decidedAt));
    }
    if (
      actionTimes.some(
        (actionTime) =>
          actionTime !== null &&
          time(principal.authorityObservedAt) >= actionTime,
      )
    ) {
      findings.push(
        finding(
          "authority-after-action",
          `principals[${index}].authorityObservedAt`,
          "A principal's signed stable identity authority must predate every benefit, metric, allocation, attribution, finance, or manifest action attributed to that principal.",
        ),
      );
    }
  }

  if (
    financeReview.reviewedAt !== null &&
    (disbenefits.some(
      (disbenefit) =>
        time(disbenefit.directMeasure.observedAt) >=
        time(financeReview.reviewedAt),
    ) ||
      time(value.sourceAuthority.issuedAt) < time(financeReview.reviewedAt))
  ) {
    findings.push(
      finding(
        "invalid-close-chronology",
        "financeReview.reviewedAt",
        "Every disbenefit observation must predate finance close, and the signed manifest must be issued at or after that close.",
      ),
    );
  }

  let aggregateGrossMinor = null;
  let aggregateNetMinor = null;
  if (
    allAttributionsSupported &&
    !financeCloseInvalid &&
    observedShares !== null
  ) {
    let grossBigInt = 0n;
    for (const amount of observedShares.values()) {
      grossBigInt += BigInt(amount);
    }
    const netBigInt = grossBigInt - disbenefitMinorBigInt;
    aggregateGrossMinor = supportedNumber(grossBigInt);
    aggregateNetMinor = supportedNumber(netBigInt);
    if (
      aggregateGrossMinor === null ||
      disbenefitMinor === null ||
      aggregateNetMinor === null
    ) {
      findings.push(
        finding(
          "aggregate-out-of-supported-range",
          "finance",
          "Gross benefit, disbenefit, and net realization must fit exactly within the supported safe-integer minor-unit range.",
        ),
      );
    }
  }

  const status =
    findings.length > 0
      ? "invalid-contract"
      : blockers.length > 0
        ? "blocked"
        : "ready-for-owner-review";
  const realizedShares =
    status === "ready-for-owner-review" ? observedShares : null;
  const grossBenefitMinor =
    status === "ready-for-owner-review" ? aggregateGrossMinor : null;
  const netRealizedMinor =
    status === "ready-for-owner-review" ? aggregateNetMinor : null;
  return {
    schemaVersion: "awesomeClaws.benefitsRealizationResult.v1",
    ledgerId: request.ledgerId,
    plan: {
      id: plan.id,
      revision: plan.revision,
      predecessorRevision: plan.predecessorRevision,
      ownerRef: plan.ownerRef,
      state: plan.state,
    },
    predecessor: {
      state: predecessor.state,
      revision: predecessor.revision,
      benefitCount: predecessor.benefitCount,
      continued: predecessor.transitions.filter(
        (record) => record.disposition === "continued",
      ).length,
      superseded: predecessor.transitions.filter(
        (record) => record.disposition === "superseded",
      ).length,
      retired: predecessor.transitions.filter(
        (record) => record.disposition === "retired",
      ).length,
    },
    period: {
      start: request.periodStart,
      end: request.periodEnd,
      cutoffAt: request.cutoffAt,
    },
    status,
    sharedKpi: {
      id: kpi.id,
      ownerRef: metricOwnerRef,
      direction: kpi.direction,
      baselineMinor: kpi.baseline.valueMinor,
      targetMinor: kpi.target.valueMinor,
      observedMinor: kpi.observed.valueMinor,
      targetDeltaMinor,
      observedDeltaMinor,
      unit: kpi.unit,
    },
    allocationRule: {
      id: allocationRule.id,
      method: allocationRule.method,
      residualRule: "largest-remainder-then-benefit-id",
      allocations: allocationRule.allocations.map((record) => ({
        benefitRef: record.benefitRef,
        basisPoints: record.basisPoints,
      })),
    },
    benefitResults: benefits.map((benefit) => {
      if (benefit.kind === "disbenefit") {
        return {
          id: benefit.id,
          kind: benefit.kind,
          ownerRef: benefit.ownerRef,
          baselineMinor: benefit.directMeasure.baselineMinor,
          targetDeltaMinor:
            benefit.directMeasure.targetMinor -
            benefit.directMeasure.baselineMinor,
          recognizedDeltaMinor:
            benefit.directMeasure.observedMinor -
            benefit.directMeasure.baselineMinor,
          attributionState: "direct-observation",
        };
      }
      const attribution = attributionById.get(benefit.attributionRef);
      return {
        id: benefit.id,
        kind: benefit.kind,
        ownerRef: benefit.ownerRef,
        baselineMinor: baselineShares?.get(benefit.id) ?? null,
        targetDeltaMinor: targetShares?.get(benefit.id) ?? null,
        recognizedDeltaMinor:
          attribution?.status === "supported"
            ? (realizedShares?.get(benefit.id) ?? null)
            : null,
        attributionState: attribution?.status ?? "missing",
      };
    }),
    finance: {
      ownerRef: financeOwnerRef,
      grossBenefitMinor,
      disbenefitMinor,
      netRealizedMinor,
      currency: request.currency,
      minorUnitScale: request.minorUnitScale,
    },
    evidenceProof: {
      subjectCount: subjects.size,
      evidenceCount: evidence.length,
      internalRecordDigestsVerified: subjectDigestValid.size,
      internalEvidenceDigestsVerified: internalEvidenceValid.size,
      reciprocalBindingsVerified: reciprocalEvidence.size,
      sourceRecordsAnchored: sourceAnchoredEvidence.size,
      sourceBytesVerified: sourceBytesVerified.size,
      sourceAuthoritySignatureVerified,
    },
    blockers,
    schemaFindings: [],
    contractFindings: findings,
  };
}

export function renderBenefitsRealizationProof(result) {
  if (
    !isRecord(result) ||
    !["ready-for-owner-review", "blocked"].includes(result.status) ||
    !isRecord(result.period)
  ) {
    const status =
      isRecord(result) && typeof result.status === "string"
        ? result.status
        : "invalid-result";
    const count =
      (Array.isArray(result?.schemaFindings)
        ? result.schemaFindings.length
        : 0) +
      (Array.isArray(result?.contractFindings)
        ? result.contractFindings.length
        : 0);
    return [
      "# Benefits Realization Manager proof refused",
      "",
      `- Status: **${status}**`,
      `- Findings: ${count}`,
      "- Reason: invalid input or contract state cannot be rendered as realization proof.",
      "",
    ].join("\n");
  }
  const { currency, minorUnitScale } = result.finance;
  return [
    "# Benefits Realization Manager candidate slice proof",
    "",
    `- Ledger: \`${result.ledgerId}\``,
    `- Plan: \`${result.plan.id}\` revision ${result.plan.revision} (predecessor ${result.plan.predecessorRevision ?? "none"})`,
    `- Period: ${result.period.start} through ${result.period.end}`,
    `- Caller cutoff: ${result.period.cutoffAt}`,
    `- Status: **${result.status}**`,
    `- Predecessor coverage: ${result.predecessor.benefitCount} records (${result.predecessor.continued} continued, ${result.predecessor.superseded} superseded, ${result.predecessor.retired} retired)`,
    "",
    "## Shared KPI and allocation",
    "",
    `- KPI: \`${result.sharedKpi.id}\` (${result.sharedKpi.ownerRef})`,
    `- Direction: ${result.sharedKpi.direction}`,
    `- Baseline / target / observed: ${formatMinorUnits(result.sharedKpi.baselineMinor, currency, minorUnitScale)} / ${formatMinorUnits(result.sharedKpi.targetMinor, currency, minorUnitScale)} / ${formatMinorUnits(result.sharedKpi.observedMinor, currency, minorUnitScale)}`,
    `- Direction-aware observed delta: ${formatMinorUnits(result.sharedKpi.observedDeltaMinor, currency, minorUnitScale)}`,
    `- Allocation: ${result.allocationRule.allocations.map((row) => `${row.benefitRef}=${row.basisPoints / 100}%`).join(", ")}`,
    `- Residual rule: ${result.allocationRule.residualRule}`,
    "",
    "## Closed benefit ledger",
    "",
    "| Record | Kind | Owner | Baseline share | Target change | Recognized change | Attribution |",
    "| --- | --- | --- | ---: | ---: | ---: | --- |",
    ...result.benefitResults.map(
      (row) =>
        `| ${row.id} | ${row.kind} | ${row.ownerRef} | ${formatMinorUnits(row.baselineMinor, currency, minorUnitScale)} | ${formatMinorUnits(row.targetDeltaMinor, currency, minorUnitScale)} | ${formatMinorUnits(row.recognizedDeltaMinor, currency, minorUnitScale)} | ${row.attributionState} |`,
    ),
    "",
    "## Derived finance reconciliation",
    "",
    `- Finance owner: ${result.finance.ownerRef}`,
    `- Gross benefit: ${formatMinorUnits(result.finance.grossBenefitMinor, currency, minorUnitScale)}`,
    `- Disbenefit: ${formatMinorUnits(result.finance.disbenefitMinor, currency, minorUnitScale)}`,
    `- Net realized value: ${formatMinorUnits(result.finance.netRealizedMinor, currency, minorUnitScale)}`,
    "",
    "## Evidence proof",
    "",
    `- Internal record consistency: ${result.evidenceProof.internalRecordDigestsVerified}/${result.evidenceProof.subjectCount}`,
    `- Internal evidence consistency: ${result.evidenceProof.internalEvidenceDigestsVerified}/${result.evidenceProof.evidenceCount}`,
    `- Reciprocal bindings: ${result.evidenceProof.reciprocalBindingsVerified}/${result.evidenceProof.evidenceCount}`,
    `- Signed source-manifest anchors: ${result.evidenceProof.sourceRecordsAnchored}/${result.evidenceProof.evidenceCount}`,
    `- Source bytes verified: ${result.evidenceProof.sourceBytesVerified}/${result.evidenceProof.evidenceCount}`,
    `- Source-authority signature: ${result.evidenceProof.sourceAuthoritySignatureVerified ? "verified" : "invalid"}`,
    "",
    "Allocation recognizes a direction-aware share of an observed KPI delta; it does not claim that a benefit caused the KPI movement.",
    "",
  ].join("\n");
}

export const BENEFITS_REALIZATION_EXAMPLE_VALIDATION_OPTIONS = Object.freeze({
  asOf: "2026-10-07T17:00:00Z",
  trustStore: JSON.parse(
    readFileSync(
      new URL(
        "../sources/benefits-realization-manager/references/trust-roots.example.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
  sourceBundle: JSON.parse(
    readFileSync(
      new URL(
        "../sources/benefits-realization-manager/references/source-bytes.example.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
});

export const BENEFITS_REALIZATION_EXAMPLE_PROFILE_OPTIONS = Object.freeze({
  asOf: "2026-10-07T17:00:00Z",
  fixtureTrustProfile: "packaged-example-v1",
  fixtureSourceProfile: "packaged-example-v1",
});

export function benefitsRealizationFindings(value, options = {}) {
  const fixtureProfiles =
    options.fixtureTrustProfile === "packaged-example-v1" &&
    options.fixtureSourceProfile === "packaged-example-v1";
  const effectiveOptions = fixtureProfiles
    ? {
        ...options,
        trustStore: BENEFITS_REALIZATION_EXAMPLE_VALIDATION_OPTIONS.trustStore,
        sourceBundle:
          BENEFITS_REALIZATION_EXAMPLE_VALIDATION_OPTIONS.sourceBundle,
      }
    : options;
  const result = evaluateBenefitsRealizationSlice(value, effectiveOptions);
  return [
    ...result.schemaFindings,
    ...result.contractFindings,
  ];
}

function invalidJsonResult(error) {
  return schemaFailureResult(null, [
    {
      code: "schema-invalid-json",
      path: "$",
      keyword: "parse",
      message: error.message,
    },
  ]);
}

async function readAuxiliaryJson(path, label, maximumBytes = null) {
  if (!path) return { value: undefined, byteLength: undefined, finding: null };
  const resolvedPath = resolve(path);
  try {
    const fileStats = await stat(resolvedPath);
    if (maximumBytes !== null && fileStats.size > maximumBytes) {
      return {
        value: undefined,
        byteLength: fileStats.size,
        finding: null,
      };
    }
    const text = await readFileAsync(resolvedPath, "utf8");
    try {
      return {
        value: JSON.parse(text),
        byteLength: fileStats.size,
        finding: null,
      };
    } catch (error) {
      return {
        value: undefined,
        byteLength: fileStats.size,
        finding: finding(
          `invalid-${label}-json`,
          label,
          `${label} is not valid JSON: ${error.message}`,
        ),
      };
    }
  } catch (error) {
    return {
      value: undefined,
      byteLength: undefined,
      finding: finding(
        `${label}-file-unavailable`,
        label,
        `${label} could not be read: ${error.message}`,
      ),
    };
  }
}

async function main() {
  const [command, inputPath, outputPath, ...args] = process.argv.slice(2);
  const optionValue = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const trustStorePath = optionValue("--trust-store");
  const sourceBundlePath = optionValue("--source-bundle");
  const proofPath = optionValue("--proof");
  const asOf = optionValue("--as-of");
  if (
    command !== "evaluate" ||
    !inputPath ||
    !outputPath
  ) {
    throw new Error(
      "Usage: node benefits-realization-manager.mjs evaluate <input> <output> --as-of <timestamp> --trust-store <trust.json> --source-bundle <sources.json> [--proof <proof.md>]",
    );
  }
  const inputStats = await stat(resolve(inputPath));
  if (inputStats.size > BENEFITS_REALIZATION_LIMITS.maxInputBytes) {
    const result = schemaFailureResult(null, [
      {
        code: "input-too-large",
        path: "$",
        keyword: "maxBytes",
        message: `Input exceeds ${BENEFITS_REALIZATION_LIMITS.maxInputBytes} bytes.`,
      },
    ]);
    await writeFileAsync(
      resolve(outputPath),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    if (proofPath) {
      await writeFileAsync(
        resolve(proofPath),
        renderBenefitsRealizationProof(result),
      );
    }
    process.exitCode = 2;
    return;
  }
  let input;
  try {
    input = JSON.parse(await readFileAsync(resolve(inputPath), "utf8"));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    const result = invalidJsonResult(error);
    await writeFileAsync(resolve(outputPath), `${JSON.stringify(result, null, 2)}\n`);
    if (proofPath) {
      await writeFileAsync(
        resolve(proofPath),
        renderBenefitsRealizationProof(result),
      );
    }
    process.exitCode = 2;
    return;
  }
  const [trustStoreInput, sourceBundleInput] = await Promise.all([
    readAuxiliaryJson(trustStorePath, "trust-store"),
    readAuxiliaryJson(
      sourceBundlePath,
      "source-bundle",
      BENEFITS_REALIZATION_LIMITS.maxSourceBundleFileBytes,
    ),
  ]);
  const result = evaluateBenefitsRealizationSlice(input, {
    trustStore: trustStoreInput.value,
    sourceBundle: sourceBundleInput.value,
    asOf,
    inputByteLength: inputStats.size,
    sourceBundleByteLength: sourceBundleInput.byteLength,
  });
  for (const auxiliaryFinding of [
    trustStoreInput.finding,
    sourceBundleInput.finding,
  ]) {
    if (auxiliaryFinding) result.contractFindings.push(auxiliaryFinding);
  }
  if (result.contractFindings.length > 0) {
    result.status = "invalid-contract";
    if (isRecord(result.finance)) {
      result.finance.grossBenefitMinor = null;
      result.finance.netRealizedMinor = null;
    }
  }
  await writeFileAsync(resolve(outputPath), `${JSON.stringify(result, null, 2)}\n`);
  if (proofPath) {
    await writeFileAsync(
      resolve(proofPath),
      renderBenefitsRealizationProof(result),
    );
  }
  process.exitCode =
    result.status === "ready-for-owner-review"
      ? 0
      : result.status === "blocked"
        ? 3
        : 2;
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await main();
}
