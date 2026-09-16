import { createHash } from "node:crypto";

export const COMMERCIAL_DEAL_DESK_SCHEMA_VERSION =
  "awesomeClaws.commercialDealDesk.v1";

const INPUT_KINDS = Object.freeze([
  "opportunity-snapshot",
  "quote-revision",
  "product-catalog",
  "product-configuration",
  "price-book",
  "discount-policy",
  "margin-policy",
  "approval-matrix",
  "approval-history",
  "licensing-rules",
  "legal-baseline",
  "dependency-register",
]);
const DOMAINS = Object.freeze([
  "configuration",
  "pricing",
  "discount",
  "margin",
  "licensing",
  "legal",
  "dependency",
  "validity",
]);
const APPROVAL_ROLE = Object.freeze({
  pricing: "pricing-approver",
  legal: "legal-approver",
  licensing: "licensing-approver",
});
const RULE_KIND = Object.freeze({
  configuration: "product-configuration",
  pricing: "price-book",
  discount: "discount-policy",
  margin: "margin-policy",
  licensing: "licensing-rules",
  legal: "legal-baseline",
  dependency: "dependency-register",
  validity: "quote-revision",
});
const TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/u;
const BLOCKER_CODE_BY_DOMAIN = Object.freeze({
  configuration: "invalid-configuration",
  pricing: "invalid-pricing",
  discount: "threshold-exception-unapproved",
  margin: "threshold-exception-unapproved",
  licensing: "licensing-exception-unapproved",
  legal: "legal-exception-unapproved",
  dependency: "dependency-unresolved",
  validity: "quote-expired",
});
const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function object(value) {
  return isRecord(value) ? value : {};
}

function records(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function strings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

export function compareUtf16CodeUnits(left, right) {
  const a = String(left);
  const b = String(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function canonicalJsonInner(value, ancestors) {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (ancestors.has(value)) return JSON.stringify("[circular]");
    const next = new Set(ancestors).add(value);
    return `[${value.map((item) => canonicalJsonInner(item, next)).join(",")}]`;
  }
  if (isRecord(value)) {
    if (ancestors.has(value)) return JSON.stringify("[circular]");
    const next = new Set(ancestors).add(value);
    return `{${Object.keys(value)
      .sort(compareUtf16CodeUnits)
      .map((key) => `${JSON.stringify(key)}:${canonicalJsonInner(value[key], next)}`)
      .join(",")}}`;
  }
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : "null";
  if (typeof value === "bigint") return JSON.stringify(String(value));
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  return "null";
}

export function canonicalJson(value) {
  return canonicalJsonInner(value, new Set());
}

function digest(value) {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

function sorted(values) {
  return strings(values).sort(compareUtf16CodeUnits);
}

function sameExactSet(actual, expected) {
  const left = sorted(actual);
  const right = sorted(expected);
  return (
    Array.isArray(actual) &&
    Array.isArray(expected) &&
    left.length === actual.length &&
    right.length === expected.length &&
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

function timestamp(value) {
  if (typeof value !== "string" || !TIMESTAMP_PATTERN.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function finding(code, path, message) {
  return { code, path, message };
}

function byId(rows) {
  return new Map(records(rows).map((row) => [row.id, row]));
}

function key(lineRef, domain) {
  return `${lineRef}\0${domain}`;
}

function mapEntryPayload(row) {
  const value = object(row);
  return {
    digest: value.digest ?? null,
    ref: value.ref ?? null,
    sourceRecordDigest: value.sourceRecordDigest ?? null,
  };
}

function inputPayload(input) {
  const row = object(input);
  return {
    digest: row.digest ?? null,
    effectiveFrom: row.effectiveFrom ?? null,
    id: row.id ?? null,
    kind: row.kind ?? null,
    opportunityId: row.opportunityId ?? null,
    quoteId: row.quoteId ?? null,
    quoteRevision: row.quoteRevision ?? null,
    supersedesRef: row.supersedesRef ?? null,
    validUntil: row.validUntil ?? null,
    version: row.version ?? null,
  };
}

export function computeInputSnapshotDigest(inputs) {
  return digest(
    records(inputs)
      .map(inputPayload)
      .sort((left, right) => compareUtf16CodeUnits(left.id, right.id)),
  );
}

function productPayload(product) {
  const value = object(product);
  return {
    approved: value.approved ?? null,
    catalogInputRef: value.catalogInputRef ?? null,
    configurationInputRef: value.configurationInputRef ?? null,
    currency: value.currency ?? null,
    id: value.id ?? null,
    licensingRuleRefs: sorted(value.licensingRuleRefs),
    listUnitAmount: value.listUnitAmount ?? null,
    maxDiscountBps: value.maxDiscountBps ?? null,
    minMarginBps: value.minMarginBps ?? null,
    priceBookInputRef: value.priceBookInputRef ?? null,
    requiredDependencySkus: sorted(value.requiredDependencySkus),
    sku: value.sku ?? null,
    unitCostAmount: value.unitCostAmount ?? null,
  };
}

function linePayload(line) {
  const value = object(line);
  return {
    currency: value.currency ?? null,
    dependencySkus: sorted(value.dependencySkus),
    discountBps: value.discountBps ?? null,
    extendedCostAmount: value.extendedCostAmount ?? null,
    extendedListAmount: value.extendedListAmount ?? null,
    extendedNetAmount: value.extendedNetAmount ?? null,
    id: value.id ?? null,
    legalDeviation: value.legalDeviation ?? null,
    licensingDeviation: value.licensingDeviation ?? null,
    licensingRuleRefs: sorted(value.licensingRuleRefs),
    listUnitAmount: value.listUnitAmount ?? null,
    marginBps: value.marginBps ?? null,
    netUnitAmount: value.netUnitAmount ?? null,
    productRef: value.productRef ?? null,
    quantity: value.quantity ?? null,
    sku: value.sku ?? null,
    termMonths: value.termMonths ?? null,
    unitCostAmount: value.unitCostAmount ?? null,
  };
}

export function computeProductPayloadDigest(product) {
  return digest(productPayload(product));
}

export function computeLinePayloadDigest(line) {
  return digest(linePayload(line));
}

export function computePayloadDigestMaps(value) {
  const evidence = byId(value?.evidence);
  const products = records(value?.products)
    .map((row) => ({
      ref: row.id,
      digest: computeProductPayloadDigest(row),
      sourceRecordDigest: evidence.get(row.evidenceRef)?.sourceRecordDigest ?? null,
    }))
    .sort((left, right) => compareUtf16CodeUnits(left.ref, right.ref));
  const lines = records(value?.lines)
    .map((row) => {
      const proof = records(value?.evidence).find(
        (item) => item.kind === "quote-line-record" && strings(item.subjectRefs).includes(row.id),
      );
      return {
        ref: row.id,
        digest: computeLinePayloadDigest(row),
        sourceRecordDigest: proof?.sourceRecordDigest ?? null,
      };
    })
    .sort((left, right) => compareUtf16CodeUnits(left.ref, right.ref));
  return {
    products,
    lines,
    root: digest({ products, lines }),
  };
}

export function computeHistoryDigest(history) {
  const value = object(history);
  return digest({
    approvalRefs: sorted(value.approvalRefs),
    conflictEdges: records(value.conflictEdges)
      .map((row) => ({
        conflictRef: row.conflictRef ?? null,
        resolvedByApprovalRef: row.resolvedByApprovalRef ?? null,
        subjectRefs: sorted(row.subjectRefs),
      }))
      .sort((left, right) => compareUtf16CodeUnits(left.conflictRef, right.conflictRef)),
    conflictRefs: sorted(value.conflictRefs),
    inputRef: value.inputRef ?? null,
    supersessionEdges: records(value.supersessionEdges)
      .map((row) => ({
        currentApprovalRef: row.currentApprovalRef ?? null,
        priorApprovalRef: row.priorApprovalRef ?? null,
      }))
      .sort((left, right) =>
        compareUtf16CodeUnits(
          `${left.priorApprovalRef}\0${left.currentApprovalRef}`,
          `${right.priorApprovalRef}\0${right.currentApprovalRef}`,
        ),
      ),
  });
}

export function computeCoverageDigest(coverage) {
  const { contentDigest: _contentDigest, ...value } = object(coverage);
  return digest({
    ...value,
    inputRefs: sorted(value.inputRefs),
    lineRefs: sorted(value.lineRefs),
    findingRefs: sorted(value.findingRefs),
    exceptionRefs: sorted(value.exceptionRefs),
    currentApprovalRefs: sorted(value.currentApprovalRefs),
    conflictRefs: sorted(value.conflictRefs),
    blockerRefs: sorted(value.blockerRefs),
    productPayloadDigests: records(value.productPayloadDigests)
      .map(mapEntryPayload)
      .sort((left, right) => compareUtf16CodeUnits(left.ref, right.ref)),
    linePayloadDigests: records(value.linePayloadDigests)
      .map(mapEntryPayload)
      .sort((left, right) => compareUtf16CodeUnits(left.ref, right.ref)),
  });
}

export function computeHandoffDigest(handoff) {
  const { contentDigest: _contentDigest, ...value } = object(handoff);
  return digest({
    ...value,
    lineRefs: sorted(value.lineRefs),
    findingRefs: sorted(value.findingRefs),
    exceptionRefs: sorted(value.exceptionRefs),
    approvalRefs: sorted(value.approvalRefs),
    conflictRefs: sorted(value.conflictRefs),
    blockerRefs: sorted(value.blockerRefs),
    productPayloadDigests: records(value.productPayloadDigests)
      .map(mapEntryPayload)
      .sort((left, right) => compareUtf16CodeUnits(left.ref, right.ref)),
    linePayloadDigests: records(value.linePayloadDigests)
      .map(mapEntryPayload)
      .sort((left, right) => compareUtf16CodeUnits(left.ref, right.ref)),
  });
}

export function resealCommercialDealDesk(value) {
  const candidate = structuredClone(value);
  const evidence = byId(candidate.evidence);
  for (const product of records(candidate.products)) {
    product.payloadDigest = computeProductPayloadDigest(product);
    const proof = evidence.get(product.evidenceRef);
    if (proof) proof.payloadDigest = product.payloadDigest;
  }
  for (const line of records(candidate.lines)) {
    line.payloadDigest = computeLinePayloadDigest(line);
    const proof = records(candidate.evidence).find(
      (row) => row.kind === "quote-line-record" && strings(row.subjectRefs).includes(line.id),
    );
    if (proof) proof.payloadDigest = line.payloadDigest;
  }
  candidate.history.contentDigest = computeHistoryDigest(candidate.history);
  const historyInput = records(candidate.inputs).find((row) => row.kind === "approval-history");
  const historyEvidence = evidence.get(candidate.history.evidenceRef);
  if (historyEvidence) historyEvidence.payloadDigest = candidate.history.contentDigest;
  candidate.review.inputSnapshotDigest = computeInputSnapshotDigest(candidate.inputs);
  const payloads = computePayloadDigestMaps(candidate);
  candidate.coverage.inputSnapshotDigest = candidate.review.inputSnapshotDigest;
  candidate.coverage.historyDigest = candidate.history.contentDigest;
  candidate.coverage.historyEvidenceRef = candidate.history.evidenceRef;
  candidate.coverage.historySourceRecordDigest = historyEvidence?.sourceRecordDigest ?? null;
  candidate.coverage.productPayloadDigests = payloads.products;
  candidate.coverage.linePayloadDigests = payloads.lines;
  candidate.coverage.payloadRootDigest = payloads.root;
  candidate.handoff.inputSnapshotDigest = candidate.review.inputSnapshotDigest;
  candidate.handoff.historyDigest = candidate.history.contentDigest;
  candidate.handoff.historyEvidenceRef = candidate.history.evidenceRef;
  candidate.handoff.historySourceRecordDigest = historyEvidence?.sourceRecordDigest ?? null;
  candidate.handoff.productPayloadDigests = payloads.products;
  candidate.handoff.linePayloadDigests = payloads.lines;
  candidate.handoff.payloadRootDigest = payloads.root;
  candidate.coverage.contentDigest = computeCoverageDigest(candidate.coverage);
  candidate.handoff.coverageDigest = candidate.coverage.contentDigest;
  candidate.handoff.contentDigest = computeHandoffDigest(candidate.handoff);
  return candidate;
}

function isSafeInteger(value, minimum = Number.MIN_SAFE_INTEGER) {
  return Number.isSafeInteger(value) && value >= minimum;
}

function roundRatio(numerator, denominator) {
  if (denominator <= 0n) return null;
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const magnitude = remainder < 0n ? -remainder : remainder;
  if (numerator >= 0n) {
    return magnitude * 2n >= denominator ? quotient + 1n : quotient;
  }
  return magnitude * 2n > denominator ? quotient - 1n : quotient;
}

export function exactCommercialLineArithmetic(line) {
  const fields = [
    "quantity",
    "listUnitAmount",
    "netUnitAmount",
    "unitCostAmount",
    "extendedListAmount",
    "extendedNetAmount",
    "extendedCostAmount",
    "discountBps",
    "marginBps",
  ];
  if (
    fields.some((field) => !isSafeInteger(line?.[field], field === "marginBps" ? -10000 : 0)) ||
    line.quantity < 1
  ) {
    return false;
  }
  const quantity = BigInt(line.quantity);
  const list = BigInt(line.listUnitAmount);
  const net = BigInt(line.netUnitAmount);
  const cost = BigInt(line.unitCostAmount);
  const extendedList = quantity * list;
  const extendedNet = quantity * net;
  const extendedCost = quantity * cost;
  if (
    [extendedList, extendedNet, extendedCost].some(
      (amount) => amount < 0n || amount > MAX_SAFE_INTEGER_BIGINT,
    )
  ) {
    return false;
  }
  const discount = list > 0n ? roundRatio((list - net) * 10000n, list) : 0n;
  const margin = net > 0n ? roundRatio((net - cost) * 10000n, net) : 0n;
  return (
    BigInt(line.extendedListAmount) === extendedList &&
    BigInt(line.extendedNetAmount) === extendedNet &&
    BigInt(line.extendedCostAmount) === extendedCost &&
    BigInt(line.discountBps) === discount &&
    BigInt(line.marginBps) === margin
  );
}

function expectedStatus(line, product, domain, asOf, review) {
  if (!line || !product) return "blocked";
  switch (domain) {
    case "configuration":
      return product.approved === true && line.sku === product.sku ? "conforms" : "blocked";
    case "pricing":
      return line.currency === product.currency &&
        line.listUnitAmount === product.listUnitAmount &&
        line.unitCostAmount === product.unitCostAmount &&
        exactCommercialLineArithmetic(line)
        ? "conforms"
        : "blocked";
    case "discount":
      return line.discountBps <= product.maxDiscountBps ? "conforms" : "exception";
    case "margin":
      return line.marginBps >= product.minMarginBps ? "conforms" : "exception";
    case "licensing":
      return line.licensingDeviation ? "exception" : "conforms";
    case "legal":
      return line.legalDeviation ? "exception" : "conforms";
    case "dependency":
      return sameExactSet(line.dependencySkus, product.requiredDependencySkus)
        ? "conforms"
        : "blocked";
    case "validity":
      return timestamp(review.validUntil) > asOf ? "conforms" : "blocked";
    default:
      return "blocked";
  }
}

function expectedApprovalDomain(domain) {
  if (["pricing", "discount", "margin"].includes(domain)) return "pricing";
  return domain;
}

function validateRoot(value, findings) {
  if (!isRecord(value)) {
    findings.push(finding("invalid_commercial_deal_desk_artifact", "", "Artifact must be an object."));
    return false;
  }
  if (value.schemaVersion !== COMMERCIAL_DEAL_DESK_SCHEMA_VERSION) {
    findings.push(
      finding(
        "invalid_commercial_deal_desk_artifact",
        "/schemaVersion",
        "Schema version is missing or unsupported.",
      ),
    );
  }
  return true;
}

function validateIdentities(value, findings) {
  const collections = [
    "inputs",
    "principals",
    "products",
    "lines",
    "findings",
    "exceptions",
    "approvals",
    "conflicts",
    "evidence",
    "blockers",
  ];
  const seen = new Map();
  for (const collection of collections) {
    if (!Array.isArray(value[collection])) {
      findings.push(
        finding(
          "invalid_commercial_deal_desk_shape",
          `/${collection}`,
          `${collection} must be an array.`,
        ),
      );
    }
    for (const [index, row] of records(value[collection]).entries()) {
      if (typeof row.id !== "string") {
        findings.push(
          finding(
            "invalid_commercial_deal_desk_identity",
            `/${collection}/${index}/id`,
            "Every record requires an id.",
          ),
        );
      } else if (seen.has(row.id)) {
        findings.push(
          finding(
            "duplicate_commercial_deal_desk_identity",
            `/${collection}/${index}/id`,
            `${row.id} duplicates ${seen.get(row.id)}.`,
          ),
        );
      } else {
        seen.set(row.id, `/${collection}/${index}/id`);
      }
    }
  }
}

function validateInputs(value, asOf, findings) {
  const review = object(value.review);
  const inputs = records(value.inputs);
  if (!sameExactSet(review.inputRefs, inputs.map((row) => row.id))) {
    findings.push(
      finding(
        "incomplete_commercial_input_coverage",
        "/review/inputRefs",
        "Review inputRefs must equal the exact input ledger.",
      ),
    );
  }
  for (const kind of INPUT_KINDS) {
    const matches = inputs.filter((row) => row.kind === kind);
    if (matches.length !== 1) {
      findings.push(
        finding(
          "incomplete_commercial_input_coverage",
          "/inputs",
          `Exactly one ${kind} input is required.`,
        ),
      );
    }
  }

  if (review.inputSnapshotDigest !== computeInputSnapshotDigest(inputs)) {
    findings.push(
      finding(
        "invalid_commercial_input_digest",
        "/review/inputSnapshotDigest",
        "Input snapshot digest does not bind the exact immutable input ledger.",
      ),
    );
  }
  const evidence = byId(value.evidence);
  for (const [index, input] of inputs.entries()) {
    if (
      input.opportunityId !== review.opportunityId ||
      input.quoteId !== review.quoteId ||
      input.quoteRevision !== review.quoteRevision
    ) {
      findings.push(
        finding(
          "invalid_commercial_input_binding",
          `/inputs/${index}`,
          "Every input must bind the exact opportunity and quote revision.",
        ),
      );
    }
    const starts = timestamp(input.effectiveFrom);
    const ends = input.validUntil === null ? Number.POSITIVE_INFINITY : timestamp(input.validUntil);
    if (starts === null || ends === null || starts > asOf || ends <= asOf || starts >= ends) {
      findings.push(
        finding(
          "invalid_commercial_input_validity",
          `/inputs/${index}`,
          "Every input must be effective and unexpired at trusted asOf.",
        ),
      );
    }
    const proof = evidence.get(input.evidenceRef);
    if (
      !proof ||
      proof.kind !== "source-export" ||
      !strings(proof.subjectRefs).includes(input.id) ||
      proof.opportunityId !== review.opportunityId ||
      proof.quoteId !== review.quoteId ||
      proof.quoteRevision !== review.quoteRevision
    ) {
      findings.push(
        finding(
          "invalid_commercial_input_evidence",
          `/inputs/${index}/evidenceRef`,
          "Every immutable input requires reciprocal exact-revision source evidence.",
        ),
      );
    }
  }
  const opportunity = inputs.find((row) => row.kind === "opportunity-snapshot");
  const quote = inputs.find((row) => row.kind === "quote-revision");
  if (opportunity?.digest !== review.opportunityDigest || quote?.digest !== review.quoteDigest) {
    findings.push(
      finding(
        "invalid_commercial_input_binding",
        "/review",
        "Review opportunity and quote digests must equal their exact input records.",
      ),
    );
  }
  const issued = timestamp(review.quoteIssuedAt);
  const validUntil = timestamp(review.validUntil);
  if (issued === null || validUntil === null || issued > asOf || validUntil <= asOf || issued >= validUntil) {
    findings.push(
      finding(
        "invalid_commercial_quote_validity",
        "/review",
        "The exact quote revision must be issued and unexpired at trusted asOf.",
      ),
    );
  }
}

function normalizedSupersessionEdges(approvals) {
    return records(approvals)
      .filter((row) => typeof row.supersedesRef === "string")
      .map((row) => ({
        priorApprovalRef: row.supersedesRef,
        currentApprovalRef: row.id,
      }))
      .sort((left, right) =>
        compareUtf16CodeUnits(
          `${left.priorApprovalRef}\0${left.currentApprovalRef}`,
          `${right.priorApprovalRef}\0${right.currentApprovalRef}`,
        ),
      );
  }

function normalizedConflictEdges(conflicts) {
    return records(conflicts)
      .map((row) => ({
        conflictRef: row.id,
        subjectRefs: sorted(row.subjectRefs),
        resolvedByApprovalRef: row.resolvedByApprovalRef ?? null,
      }))
      .sort((left, right) => compareUtf16CodeUnits(left.conflictRef, right.conflictRef));
  }

function sameCanonical(left, right) {
    return canonicalJson(left) === canonicalJson(right);
  }

function validateHistory(value, findings) {
    const history = object(value.history);
    const review = object(value.review);
    const approvals = records(value.approvals);
    const conflicts = records(value.conflicts);
    const historyInput = records(value.inputs).find((row) => row.kind === "approval-history");
    const proof = byId(value.evidence).get(history.evidenceRef);
    const sourceCustodianRefs = new Set(
      records(value.principals)
        .filter(
          (row) =>
            row.kind === "owner-system" && strings(row.roles).includes("source-custodian"),
        )
        .map((row) => row.id),
    );
    const expectedSubjects = [
      history.inputRef,
      ...approvals.map((row) => row.id),
      ...conflicts.map((row) => row.id),
    ];
    const latestHistoryEvent = Math.max(
      ...approvals.map((row) => timestamp(row.decidedAt) ?? Number.POSITIVE_INFINITY),
      ...conflicts.map((row) => timestamp(row.detectedAt) ?? Number.POSITIVE_INFINITY),
    );
    const historyObservedAt = timestamp(proof?.observedAt);
    if (
      !historyInput ||
      history.inputRef !== historyInput.id ||
      !sameExactSet(history.approvalRefs, approvals.map((row) => row.id)) ||
      !sameExactSet(history.conflictRefs, conflicts.map((row) => row.id)) ||
      !sameCanonical(
        records(history.supersessionEdges)
          .map((row) => ({
            priorApprovalRef: row.priorApprovalRef,
            currentApprovalRef: row.currentApprovalRef,
          }))
          .sort((left, right) =>
            compareUtf16CodeUnits(
              `${left.priorApprovalRef}\0${left.currentApprovalRef}`,
              `${right.priorApprovalRef}\0${right.currentApprovalRef}`,
            ),
          ),
        normalizedSupersessionEdges(approvals),
      ) ||
      !sameCanonical(
        records(history.conflictEdges)
          .map((row) => ({
            conflictRef: row.conflictRef,
            subjectRefs: sorted(row.subjectRefs),
            resolvedByApprovalRef: row.resolvedByApprovalRef ?? null,
          }))
          .sort((left, right) => compareUtf16CodeUnits(left.conflictRef, right.conflictRef)),
        normalizedConflictEdges(conflicts),
      ) ||
      history.contentDigest !== computeHistoryDigest(history) ||
      historyInput.digest !== history.contentDigest ||
      historyInput.evidenceRef !== history.evidenceRef ||
      !proof ||
      proof.kind !== "source-export" ||
      proof.payloadDigest !== history.contentDigest ||
      proof.sourceRecordDigest !== historyInput.digest ||
      !sourceCustodianRefs.has(proof.suppliedByRef) ||
      !sameExactSet(proof.subjectRefs, expectedSubjects) ||
      proof.opportunityId !== review.opportunityId ||
      proof.quoteId !== review.quoteId ||
      proof.quoteRevision !== review.quoteRevision ||
      historyObservedAt === null ||
      historyObservedAt < latestHistoryEvent ||
      historyObservedAt !== timestamp(historyInput.effectiveFrom)
    ) {
      findings.push(
        finding(
          "invalid_commercial_history_binding",
          "/history",
          "Authenticated approval and conflict history must equal the complete ledgers and all supersession and conflict edges.",
        ),
      );
    }
  }
function validatePrincipals(value, findings) {
  const principals = records(value.principals);
  const byPrincipal = byId(principals);
  const review = object(value.review);
  const required = [
    [review.sellerRef, "seller"],
    [review.quoteOwnerRef, "quote-owner"],
    [review.destinationApproverRef, "destination-approver"],
    [review.nextOwnerRef, "order-readiness-recipient"],
  ];
  for (const [ref, role] of required) {
    const principal = byPrincipal.get(ref);
    if (!principal || principal.kind !== "named-human" || !strings(principal.roles).includes(role)) {
      findings.push(
        finding(
          "invalid_commercial_principal_role",
          "/review",
          `${role} must resolve to a named human with the exact role.`,
        ),
      );
    }
  }
}

function validateProductsAndLines(value, findings) {
  const review = object(value.review);
  const inputs = byId(value.inputs);
  const products = byId(value.products);
  const evidence = byId(value.evidence);
  const sourceCustodianRefs = new Set(
    records(value.principals)
      .filter(
        (row) =>
          row.kind === "owner-system" && strings(row.roles).includes("source-custodian"),
      )
      .map((row) => row.id),
  );
  for (const [index, product] of records(value.products).entries()) {
    for (const [field, kind] of [
      ["catalogInputRef", "product-catalog"],
      ["configurationInputRef", "product-configuration"],
      ["priceBookInputRef", "price-book"],
    ]) {
      if (inputs.get(product[field])?.kind !== kind) {
        findings.push(
          finding(
            "invalid_commercial_product_binding",
            `/products/${index}/${field}`,
            `Product ${field} must resolve to the exact ${kind} input.`,
          ),
        );
      }
    }
    const productProof = evidence.get(product.evidenceRef);
    if (
      !isSafeInteger(product.listUnitAmount, 0) ||
      !isSafeInteger(product.unitCostAmount, 0) ||
      !isSafeInteger(product.maxDiscountBps, 0) ||
      !isSafeInteger(product.minMarginBps, -10000) ||
      product.payloadDigest !== computeProductPayloadDigest(product) ||
      !productProof ||
      productProof.kind !== "product-record" ||
      productProof.payloadDigest !== product.payloadDigest ||
      !sourceCustodianRefs.has(productProof.suppliedByRef) ||
      !sameExactSet(productProof.subjectRefs, [product.id]) ||
      productProof.quoteRevision !== review.quoteRevision
    ) {
      findings.push(
        finding(
          "invalid_commercial_product_payload",
          `/products/${index}`,
          "Every canonical product requires safe integers, an exact payload digest, and one authenticated reciprocal product record.",
        ),
      );
    }
  }
  for (const [index, line] of records(value.lines).entries()) {
    const product = products.get(line.productRef);
    if (
      !product ||
      line.sku !== product.sku ||
      line.currency !== review.currency ||
      !exactCommercialLineArithmetic(line)
    ) {
      findings.push(
        finding(
          "invalid_commercial_line_arithmetic",
          `/lines/${index}`,
          "Line identity, currency, extensions, discount, and margin must recompute exactly.",
        ),
      );
    }
    if (!sameExactSet(line.licensingRuleRefs, product?.licensingRuleRefs ?? [])) {
      findings.push(
        finding(
          "invalid_commercial_licensing_binding",
          `/lines/${index}/licensingRuleRefs`,
          "Line licensing rules must equal the approved product rules.",
        ),
      );
    }
    const lineProofs = records(value.evidence).filter(
      (row) => row.kind === "quote-line-record" && strings(row.subjectRefs).includes(line.id),
    );
    if (
      lineProofs.length !== 1 ||
      !evidence.has(lineProofs[0]?.id) ||
      lineProofs[0].quoteRevision !== review.quoteRevision ||
      line.payloadDigest !== computeLinePayloadDigest(line) ||
      lineProofs[0].payloadDigest !== line.payloadDigest ||
      lineProofs[0].suppliedByRef !== review.quoteOwnerRef ||
      !sameExactSet(lineProofs[0].subjectRefs, [line.id])
    ) {
      findings.push(
        finding(
          "invalid_commercial_line_evidence",
          `/lines/${index}`,
          "Every quote line requires exactly one exact-revision authenticated record bound to its canonical payload digest.",
        ),
      );
    }
  }
}

function validateFindingsAndExceptions(value, asOf, findings) {
  const review = object(value.review);
  const quoteIssuedAt = timestamp(review.quoteIssuedAt);
  const handoffAt = timestamp(object(value.handoff).handedOffAt);
  const evidence = byId(value.evidence);
  const lines = records(value.lines);
  const products = byId(value.products);
  const inputs = byId(value.inputs);
  const findingRows = records(value.findings);
  const exceptions = records(value.exceptions);
  const exceptionById = byId(exceptions);
  const findingById = byId(findingRows);
  const cells = new Map();
  for (const [index, row] of findingRows.entries()) {
    const cell = key(row.lineRef, row.domain);
    cells.set(cell, (cells.get(cell) ?? 0) + 1);
    const line = lines.find((item) => item.id === row.lineRef);
    const product = products.get(line?.productRef);
    const expected = expectedStatus(line, product, row.domain, asOf, review);
    if (
      row.status !== expected ||
      inputs.get(row.ruleInputRef)?.kind !== RULE_KIND[row.domain]
    ) {
      findings.push(
        finding(
          "invalid_commercial_domain_finding",
          `/findings/${index}`,
          "Finding status and rule input must derive from the exact line and domain.",
        ),
      );
    }
    const requiresException = row.status === "exception";
    if (
      (requiresException && !exceptionById.has(row.exceptionRef)) ||
      (!requiresException && row.exceptionRef !== null)
    ) {
      findings.push(
        finding(
          "invalid_commercial_exception_binding",
          `/findings/${index}/exceptionRef`,
          "Only exception findings may carry one exact exception reference.",
        ),
      );
    }
    for (const evidenceRef of strings(row.evidenceRefs)) {
      const proof = evidence.get(evidenceRef);
      const observedAt = timestamp(proof?.observedAt);
      if (
        !proof ||
        proof.kind !== "finding-record" ||
        !strings(proof.subjectRefs).includes(row.id) ||
        !strings(proof.subjectRefs).includes(row.lineRef) ||
        proof.quoteRevision !== review.quoteRevision ||
        observedAt === null ||
        observedAt < quoteIssuedAt ||
        observedAt > handoffAt
      ) {
        findings.push(
          finding(
            "invalid_commercial_finding_evidence",
            `/findings/${index}/evidenceRefs`,
            "Every finding evidence reference must reciprocally bind the finding, line, exact revision, and event chronology.",
          ),
        );
      }
    }
  }
  for (const line of lines) {
    for (const domain of DOMAINS) {
      if (cells.get(key(line.id, domain)) !== 1) {
        findings.push(
          finding(
            "incomplete_commercial_finding_coverage",
            "/findings",
            `Line ${line.id} requires exactly one ${domain} finding.`,
          ),
        );
      }
    }
  }
  for (const [index, row] of exceptions.entries()) {
    const source = findingById.get(row.findingRef);
    if (
      !source ||
      source.exceptionRef !== row.id ||
      source.lineRef !== row.lineRef ||
      source.domain !== row.domain ||
      source.status !== "exception" ||
      row.approvalDomain !== expectedApprovalDomain(row.domain)
    ) {
      findings.push(
        finding(
          "invalid_commercial_exception_binding",
          `/exceptions/${index}`,
          "Every exception must bind one exact exception finding and approval domain.",
        ),
      );
    }
    if (timestamp(row.raisedAt) === null || timestamp(row.raisedAt) > asOf) {
      findings.push(
        finding(
          "invalid_commercial_exception_chronology",
          `/exceptions/${index}/raisedAt`,
          "Exception chronology must be valid and not future-dated.",
        ),
      );
    }
    const proof = evidence.get(row.evidenceRef);
    const proofAt = timestamp(proof?.observedAt);
    if (
      quoteIssuedAt === null ||
      timestamp(row.raisedAt) < quoteIssuedAt ||
      timestamp(row.raisedAt) > handoffAt ||
      !proof ||
      proof.kind !== "exception-record" ||
      ![row.id, row.findingRef, row.lineRef].every((ref) =>
        strings(proof.subjectRefs).includes(ref),
      ) ||
      proof.quoteRevision !== review.quoteRevision ||
      proofAt === null ||
      proofAt < timestamp(row.raisedAt) ||
      proofAt > handoffAt
    ) {
      findings.push(
        finding(
          "invalid_commercial_exception_evidence",
          `/exceptions/${index}/evidenceRef`,
          "Exception evidence must reciprocally bind its exception, finding, line, revision, and event chronology.",
        ),
      );
    }
  }
  const requiredExceptions = findingRows
    .filter((row) => row.status === "exception")
    .map((row) => row.exceptionRef);
  if (!sameExactSet(exceptions.map((row) => row.id), requiredExceptions)) {
    findings.push(
      finding(
        "incomplete_commercial_exception_coverage",
        "/exceptions",
        "Exception ledger must equal the exact exception-finding universe.",
      ),
    );
  }
  for (const [evidenceIndex, proof] of records(value.evidence).entries()) {
    if (proof.kind === "finding-record") {
      const consumers = findingRows.filter((row) =>
        strings(row.evidenceRefs).includes(proof.id),
      );
      const expectedSubjects = [
        ...consumers.map((row) => row.id),
        ...consumers.map((row) => row.lineRef),
      ];
      if (!sameExactSet(proof.subjectRefs, [...new Set(expectedSubjects)])) {
        findings.push(
          finding(
            "invalid_commercial_finding_evidence",
            `/evidence/${evidenceIndex}/subjectRefs`,
            "Finding-record subjects must equal every finding and line that references the record.",
          ),
        );
      }
    }
    if (proof.kind === "exception-record") {
      const consumers = exceptions.filter((row) => row.evidenceRef === proof.id);
      const expectedSubjects = [
        ...consumers.map((row) => row.id),
        ...consumers.map((row) => row.findingRef),
        ...consumers.map((row) => row.lineRef),
      ];
      if (!sameExactSet(proof.subjectRefs, [...new Set(expectedSubjects)])) {
        findings.push(
          finding(
            "invalid_commercial_exception_evidence",
            `/evidence/${evidenceIndex}/subjectRefs`,
            "Exception-record subjects must equal every exception, finding, and line that references the record.",
          ),
        );
      }
    }
  }
}

function validateApprovals(value, asOf, findings) {
  const review = object(value.review);
  const handoffAt = timestamp(object(value.handoff).handedOffAt);
  const quoteIssuedAt = timestamp(review.quoteIssuedAt);
  const approvals = records(value.approvals);
  const approvalById = byId(approvals);
  const principals = byId(value.principals);
  const exceptions = records(value.exceptions);
  const current = approvals.filter((row) => row.status === "current");
  const currentApprovers = [];
  for (const domain of Object.keys(APPROVAL_ROLE)) {
    const domainApprovals = current.filter((row) => row.domain === domain);
    if (domainApprovals.length > 1) {
      findings.push(
        finding(
          "incomplete_commercial_approval_coverage",
          "/approvals",
          `At most one current ${domain} approval may be supplied; absence is represented by exact derived blockers.`,
        ),
      );
      continue;
    }
    if (domainApprovals.length === 0) continue;
    const approval = domainApprovals[0];
    const principal = principals.get(approval.approverRef);
    const expectedExceptions = exceptions
      .filter((row) => row.approvalDomain === domain)
      .map((row) => row.id);
    const decidedAt = timestamp(approval.decidedAt);
    const validFrom = timestamp(approval.validFrom);
    const validUntil = timestamp(approval.validUntil);
    if (
      approval.decision !== "approved" ||
      approval.opportunityId !== review.opportunityId ||
      approval.quoteId !== review.quoteId ||
      approval.quoteRevision !== review.quoteRevision ||
      approval.quoteDigest !== review.quoteDigest ||
      !sameExactSet(approval.exceptionRefs, expectedExceptions) ||
      !principal ||
      principal.kind !== "named-human" ||
      !strings(principal.roles).includes(APPROVAL_ROLE[domain]) ||
      [review.sellerRef, review.quoteOwnerRef].includes(approval.approverRef) ||
      decidedAt === null ||
      validFrom === null ||
      validUntil === null ||
      validFrom > decidedAt ||
      decidedAt < quoteIssuedAt ||
      decidedAt > asOf ||
      decidedAt > handoffAt ||
      validUntil <= asOf ||
      validFrom >= validUntil
    ) {
      findings.push(
        finding(
          "invalid_commercial_current_approval",
          `/approvals/${approvals.indexOf(approval)}`,
          `Current ${domain} approval must be exact, independent, approved, and time-valid.`,
        ),
      );
    }
    currentApprovers.push(approval.approverRef);
    for (const exception of exceptions.filter((row) => row.approvalDomain === domain)) {
      if (
        exception.currentApprovalRef !== approval.id ||
        timestamp(exception.raisedAt) >= decidedAt
      ) {
        findings.push(
          finding(
            "invalid_commercial_approval_chronology",
            `/exceptions/${exceptions.indexOf(exception)}`,
            "Current approval must follow and exactly cover its exception.",
          ),
        );
      }
    }
  }
  if (new Set(currentApprovers).size !== currentApprovers.length) {
    findings.push(
      finding(
        "invalid_commercial_approval_independence",
        "/approvals",
        "Pricing, legal, and licensing approvals require different named humans.",
      ),
    );
  }
  for (const [index, approval] of approvals.entries()) {
    const proof = byId(value.evidence).get(approval.evidenceRef);
    const proofAt = timestamp(proof?.observedAt);
    if (
      !proof ||
      proof.kind !== "approval-record" ||
      proof.suppliedByRef !== approval.approverRef ||
      !sameExactSet(proof.subjectRefs, [approval.id, ...strings(approval.exceptionRefs)]) ||
      proof.quoteRevision !== review.quoteRevision ||
      proofAt === null ||
      proofAt !== timestamp(approval.decidedAt) ||
      proofAt < quoteIssuedAt ||
      proofAt > handoffAt ||
      proofAt > asOf
    ) {
      findings.push(
        finding(
          "invalid_commercial_approval_evidence",
          `/approvals/${index}/evidenceRef`,
          "Every approval requires reciprocal approver-supplied evidence.",
        ),
      );
    }
    if (approval.supersedesRef !== null) {
      const prior = approvalById.get(approval.supersedesRef);
      if (
        !prior ||
        prior.status !== "superseded" ||
        prior.domain !== approval.domain ||
        timestamp(prior.decidedAt) >= timestamp(approval.decidedAt)
      ) {
        findings.push(
          finding(
            "invalid_commercial_approval_supersession",
            `/approvals/${index}/supersedesRef`,
            "Every superseding approval must follow a superseded approval in the same domain.",
          ),
        );
      }
    }
    if (approval.status === "superseded") {
      const successors = approvals.filter((row) => row.supersedesRef === approval.id);
      const successor = successors[0];
      const matchingEdges = records(object(value.history).supersessionEdges).filter(
        (edge) =>
          edge.priorApprovalRef === approval.id &&
          edge.currentApprovalRef === successor?.id,
      );
      if (
        successors.length !== 1 ||
        !successor ||
        successor.domain !== approval.domain ||
        !["current", "superseded"].includes(successor.status) ||
        successor.decision !== "approved" ||
        timestamp(successor.decidedAt) <= timestamp(approval.decidedAt) ||
        matchingEdges.length !== 1
      ) {
        findings.push(
          finding(
            "invalid_commercial_approval_supersession",
            `/approvals/${index}`,
            "Every superseded approval must have exactly one valid later same-domain successor and one exact history edge.",
          ),
        );
      }
    }
    if (approval.status === "current" && approval.quoteRevision !== review.quoteRevision) {
      findings.push(
        finding(
          "invalid_commercial_current_approval",
          `/approvals/${index}/quoteRevision`,
          "Cross-revision approval cannot be current.",
        ),
      );
    }
  }
}

function validateConflicts(value, asOf, findings) {
  const review = object(value.review);
  const quoteIssuedAt = timestamp(review.quoteIssuedAt);
  const handoffAt = timestamp(object(value.handoff).handedOffAt);
  const approvals = byId(value.approvals);
  const evidence = byId(value.evidence);
  for (const [index, conflict] of records(value.conflicts).entries()) {
    const resolvedBy = approvals.get(conflict.resolvedByApprovalRef);
    const subjects = strings(conflict.subjectRefs).map((ref) => approvals.get(ref)).filter(Boolean);
    const detectedAt = timestamp(conflict.detectedAt);
    const latestSubject = Math.max(...subjects.map((row) => timestamp(row.decidedAt) ?? -Infinity));
    const chronologyInvalid =
      detectedAt === null ||
      detectedAt < quoteIssuedAt ||
      detectedAt > asOf ||
      detectedAt > handoffAt ||
      detectedAt <= latestSubject;
    const resolutionInvalid =
      conflict.status === "open"
        ? conflict.resolvedByApprovalRef !== null
        : conflict.status !== "resolved" ||
          !resolvedBy ||
          resolvedBy.status !== "current" ||
          detectedAt >= timestamp(resolvedBy.decidedAt);
    if (chronologyInvalid || resolutionInvalid) {
      findings.push(
        finding(
          "invalid_commercial_conflict_chronology",
          `/conflicts/${index}`,
          "Every conflict must be resolved chronologically by a later current approval.",
        ),
      );
    }
    const proof = evidence.get(conflict.evidenceRef);
    if (
      !proof ||
      proof.kind !== "conflict-record" ||
      !sameExactSet(proof.subjectRefs, [conflict.id, ...strings(conflict.subjectRefs)]) ||
      proof.quoteRevision !== review.quoteRevision ||
      timestamp(proof.observedAt) !== detectedAt
    ) {
      findings.push(
        finding(
          "invalid_commercial_conflict_evidence",
          `/conflicts/${index}/evidenceRef`,
          "Every conflict requires reciprocal evidence.",
        ),
      );
    }
  }
}

function validateEvidence(value, asOf, findings) {
  const review = object(value.review);
  const principals = byId(value.principals);
  const handoffAt = timestamp(object(value.handoff).handedOffAt);
  for (const [index, row] of records(value.evidence).entries()) {
    const observedAt = timestamp(row.observedAt);
    if (
      !principals.has(row.suppliedByRef) ||
      row.opportunityId !== review.opportunityId ||
      row.quoteId !== review.quoteId ||
      row.quoteRevision !== review.quoteRevision ||
      observedAt === null ||
      observedAt > asOf ||
      observedAt > handoffAt
    ) {
      findings.push(
        finding(
          "invalid_commercial_evidence_binding",
          `/evidence/${index}`,
          "Evidence must bind the exact revision, supplied principal, and trusted chronology.",
        ),
      );
    }
  }
}

function currentApprovalCovers(value, exception, asOf) {
    const review = object(value.review);
    const approval = byId(value.approvals).get(exception.currentApprovalRef);
    const expectedDomain = expectedApprovalDomain(exception.domain);
    return Boolean(
      approval &&
        approval.status === "current" &&
        approval.decision === "approved" &&
        approval.domain === expectedDomain &&
        approval.opportunityId === review.opportunityId &&
        approval.quoteId === review.quoteId &&
        approval.quoteRevision === review.quoteRevision &&
        approval.quoteDigest === review.quoteDigest &&
        strings(approval.exceptionRefs).includes(exception.id) &&
        timestamp(approval.validFrom) <= asOf &&
        timestamp(approval.validUntil) > asOf,
    );
  }

export function deriveCommercialBlockers(value, context = {}) {
    const review = object(value?.review);
    const asOf =
      typeof context.asOf === "number" && Number.isFinite(context.asOf)
        ? context.asOf
        : timestamp(context.asOf);
    const derived = [];
    for (const kind of INPUT_KINDS) {
      if (records(value?.inputs).filter((row) => row.kind === kind).length !== 1) {
        derived.push({
          id: `blocker-missing-input-${kind}`,
          code: "missing-input",
          subjectRefs: [review.id].filter(Boolean),
          ownerRef: review.quoteOwnerRef,
        });
      }
    }
    const products = byId(value?.products);
    const lines = byId(value?.lines);
    for (const row of records(value?.findings)) {
      const line = lines.get(row.lineRef);
      const product = products.get(line?.productRef);
      if (expectedStatus(line, product, row.domain, asOf, review) === "blocked") {
        derived.push({
          id: `blocker-${row.id}`,
          code: BLOCKER_CODE_BY_DOMAIN[row.domain] ?? "coverage-incomplete",
          subjectRefs: [row.id, row.lineRef].filter(Boolean),
          ownerRef: review.quoteOwnerRef,
        });
      }
    }
    for (const exception of records(value?.exceptions)) {
      if (!currentApprovalCovers(value, exception, asOf)) {
        derived.push({
          id: `blocker-${exception.id}-approval`,
          code: BLOCKER_CODE_BY_DOMAIN[exception.domain] ?? "coverage-incomplete",
          subjectRefs: [exception.id, exception.findingRef, exception.lineRef].filter(Boolean),
          ownerRef: review.quoteOwnerRef,
        });
      }
    }
    for (const conflict of records(value?.conflicts).filter((row) => row.status === "open")) {
      derived.push({
        id: `blocker-${conflict.id}`,
        code: "approval-conflict",
        subjectRefs: [conflict.id, ...strings(conflict.subjectRefs)],
        ownerRef: review.quoteOwnerRef,
      });
    }
    if (asOf !== null && timestamp(review.validUntil) !== null && timestamp(review.validUntil) <= asOf) {
      derived.push({
        id: "blocker-quote-expired",
        code: "quote-expired",
        subjectRefs: [review.id].filter(Boolean),
        ownerRef: review.quoteOwnerRef,
      });
    }
    return derived.sort((left, right) => compareUtf16CodeUnits(left.id, right.id));
  }

function validateBlockers(value, asOf, findings) {
    const review = object(value.review);
    const handoffAt = timestamp(object(value.handoff).handedOffAt);
    const principals = byId(value.principals);
    const evidence = byId(value.evidence);
    const blockers = records(value.blockers);
    const derived = deriveCommercialBlockers(value, { asOf });
    const actualCore = blockers
      .map((row) => ({
        id: row.id,
        code: row.code,
        subjectRefs: sorted(row.subjectRefs),
        ownerRef: row.ownerRef,
      }))
      .sort((left, right) => compareUtf16CodeUnits(left.id, right.id));
    const expectedCore = derived.map((row) => ({
      ...row,
      subjectRefs: sorted(row.subjectRefs),
    }));
    if (!sameCanonical(actualCore, expectedCore)) {
      findings.push(
        finding(
          "invalid_commercial_blocker_equality",
          "/blockers",
          "Blocker ledger must equal every derived blocked domain and other blocking condition exactly.",
        ),
      );
    }
    for (const [index, blocker] of blockers.entries()) {
      const detectedAt = timestamp(blocker.detectedAt);
      if (
        !principals.has(blocker.ownerRef) ||
        detectedAt === null ||
        detectedAt < timestamp(review.quoteIssuedAt) ||
        detectedAt > handoffAt ||
        detectedAt > asOf
      ) {
        findings.push(
          finding(
            "invalid_commercial_blocker_evidence",
            `/blockers/${index}`,
            "Every blocker needs a valid owner and quote-to-handoff chronology.",
          ),
        );
      }
      for (const evidenceRef of strings(blocker.evidenceRefs)) {
        const proof = evidence.get(evidenceRef);
        const proofAt = timestamp(proof?.observedAt);
        if (
          !proof ||
          proof.kind !== "blocker-record" ||
          proof.suppliedByRef !== blocker.ownerRef ||
          ![blocker.id, ...strings(blocker.subjectRefs)].every((ref) =>
            strings(proof.subjectRefs).includes(ref),
          ) ||
          proof.quoteRevision !== review.quoteRevision ||
          proofAt === null ||
          proofAt < detectedAt ||
          proofAt > handoffAt
        ) {
          findings.push(
            finding(
              "invalid_commercial_blocker_evidence",
              `/blockers/${index}/evidenceRefs`,
              "Blocker evidence must reciprocally bind its owner, subjects, exact revision, and chronology.",
            ),
          );
      }
    }
  }
  for (const [evidenceIndex, proof] of records(value.evidence).entries()) {
    if (proof.kind !== "blocker-record") continue;
    const consumers = blockers.filter((row) => strings(row.evidenceRefs).includes(proof.id));
    const expectedSubjects = [
      ...consumers.map((row) => row.id),
      ...consumers.flatMap((row) => strings(row.subjectRefs)),
    ];
    if (!sameExactSet(proof.subjectRefs, [...new Set(expectedSubjects)])) {
      findings.push(
        finding(
          "invalid_commercial_blocker_evidence",
          `/evidence/${evidenceIndex}/subjectRefs`,
          "Blocker-record subjects must equal every blocker and subject that references the record.",
        ),
      );
    }
  }
}

function validateCoverageAndHandoff(value, asOf, findings) {
  const review = object(value.review);
  const coverage = object(value.coverage);
  const handoff = object(value.handoff);
  const current = records(value.approvals).filter((row) => row.status === "current");
  const payloads = computePayloadDigestMaps(value);
  const derivedBlockers = deriveCommercialBlockers(value, { asOf });
  const exact = [
    ["inputRefs", value.inputs],
    ["lineRefs", value.lines],
    ["findingRefs", value.findings],
    ["exceptionRefs", value.exceptions],
    ["currentApprovalRefs", current],
    ["conflictRefs", value.conflicts],
    ["blockerRefs", value.blockers],
  ];
  if (
    coverage.reviewRef !== review.id ||
    coverage.inputSnapshotDigest !== review.inputSnapshotDigest ||
    coverage.historyDigest !== object(value.history).contentDigest ||
    coverage.historyEvidenceRef !== object(value.history).evidenceRef ||
    coverage.historySourceRecordDigest !==
      byId(value.evidence).get(object(value.history).evidenceRef)?.sourceRecordDigest ||
    !sameCanonical(
      records(coverage.productPayloadDigests)
        .map(mapEntryPayload)
        .sort((left, right) => compareUtf16CodeUnits(left.ref, right.ref)),
      payloads.products,
    ) ||
    !sameCanonical(
      records(coverage.linePayloadDigests)
        .map(mapEntryPayload)
        .sort((left, right) => compareUtf16CodeUnits(left.ref, right.ref)),
      payloads.lines,
    ) ||
    coverage.payloadRootDigest !== payloads.root ||
    coverage.contentDigest !== computeCoverageDigest(coverage)
  ) {
    findings.push(
      finding(
        "invalid_commercial_coverage_digest",
        "/coverage",
        "Coverage must bind the exact review and recompute.",
      ),
    );
  }
  for (const [field, rows] of exact) {
    if (!sameExactSet(coverage[field], records(rows).map((row) => row.id))) {
      findings.push(
        finding(
          "incomplete_commercial_coverage",
          `/coverage/${field}`,
          `${field} must equal its exact current ledger.`,
        ),
      );
    }
  }
  for (const field of ["lineRefs", "findingRefs", "exceptionRefs", "conflictRefs", "blockerRefs"]) {
    if (!sameExactSet(handoff[field], coverage[field])) {
      findings.push(
        finding(
          "invalid_commercial_handoff",
          `/handoff/${field}`,
          `Handoff ${field} must equal exact coverage.`,
        ),
      );
    }
  }
  if (!sameExactSet(handoff.approvalRefs, coverage.currentApprovalRefs)) {
    findings.push(
      finding(
        "invalid_commercial_handoff",
        "/handoff/approvalRefs",
        "Handoff approvalRefs must equal current approval coverage.",
      ),
    );
  }
  const reserved = [
    "negotiationClaim",
    "customerCommunicationClaim",
    "discountApprovalClaim",
    "termApprovalClaim",
    "legalConclusionClaim",
    "signatureClaim",
    "bookingClaim",
    "invoicingClaim",
    "contractModificationClaim",
    "revenueClaim",
  ];
  if (
    handoff.reviewRef !== review.id ||
    handoff.opportunityId !== review.opportunityId ||
    handoff.opportunityDigest !== review.opportunityDigest ||
    handoff.quoteId !== review.quoteId ||
    handoff.quoteRevision !== review.quoteRevision ||
    handoff.quoteDigest !== review.quoteDigest ||
    handoff.inputSnapshotDigest !== review.inputSnapshotDigest ||
    handoff.historyDigest !== object(value.history).contentDigest ||
    handoff.historyEvidenceRef !== object(value.history).evidenceRef ||
    handoff.historySourceRecordDigest !==
      byId(value.evidence).get(object(value.history).evidenceRef)?.sourceRecordDigest ||
    !sameCanonical(
      records(handoff.productPayloadDigests)
        .map(mapEntryPayload)
        .sort((left, right) => compareUtf16CodeUnits(left.ref, right.ref)),
      payloads.products,
    ) ||
    !sameCanonical(
      records(handoff.linePayloadDigests)
        .map(mapEntryPayload)
        .sort((left, right) => compareUtf16CodeUnits(left.ref, right.ref)),
      payloads.lines,
    ) ||
    handoff.payloadRootDigest !== payloads.root ||
    handoff.coverageDigest !== coverage.contentDigest ||
    handoff.destination !== review.destination ||
    handoff.approvedByRef !== review.destinationApproverRef ||
    handoff.nextOwnerRef !== review.nextOwnerRef ||
    reserved.some((field) => handoff[field] !== "not-claimed") ||
    handoff.contentDigest !== computeHandoffDigest(handoff)
  ) {
    findings.push(
      finding(
        "invalid_commercial_handoff",
        "/handoff",
        "Handoff identity, destination, authority non-claims, and digest must bind exactly.",
      ),
    );
  }
  const handoffProof = byId(value.evidence).get(handoff.evidenceRef);
  if (
    !handoffProof ||
    handoffProof.kind !== "handoff-record" ||
    handoffProof.suppliedByRef !== review.destinationApproverRef ||
    !sameExactSet(handoffProof.subjectRefs, [handoff.id]) ||
    timestamp(handoffProof.observedAt) !== timestamp(handoff.handedOffAt)
  ) {
    findings.push(
      finding(
        "invalid_commercial_handoff",
        "/handoff/evidenceRef",
        "Handoff requires reciprocal exact-revision evidence.",
      ),
    );
  }
  if (
    timestamp(handoff.handedOffAt) < timestamp(review.quoteIssuedAt) ||
    timestamp(handoff.handedOffAt) > asOf ||
    (derivedBlockers.length === 0 && handoff.state !== "ready-for-order-review") ||
    (derivedBlockers.length > 0 && handoff.state !== "blocked")
  ) {
    findings.push(
      finding(
        "invalid_commercial_handoff_state",
        "/handoff/state",
        "Handoff chronology and state must derive exactly from the authenticated event history and derived blocker universe.",
      ),
    );
  }
}

export function commercialDealDeskFindings(value, context = {}) {
  const findings = [];
  if (!validateRoot(value, findings)) return findings;
  const asOf = timestamp(context.asOf);
  if (asOf === null) {
    findings.push(
      finding(
        "invalid_commercial_validation_context",
        "/context/asOf",
        "A trusted zone-bearing RFC 3339 asOf is required.",
      ),
    );
  }
  validateIdentities(value, findings);
  validateInputs(value, asOf ?? Number.NEGATIVE_INFINITY, findings);
  validateHistory(value, findings);
  validatePrincipals(value, findings);
  validateProductsAndLines(value, findings);
  validateFindingsAndExceptions(value, asOf ?? Number.NEGATIVE_INFINITY, findings);
  validateApprovals(value, asOf ?? Number.NEGATIVE_INFINITY, findings);
  validateConflicts(value, asOf ?? Number.NEGATIVE_INFINITY, findings);
  validateEvidence(value, asOf ?? Number.NEGATIVE_INFINITY, findings);
  validateBlockers(value, asOf ?? Number.NEGATIVE_INFINITY, findings);
  validateCoverageAndHandoff(value, asOf ?? Number.NEGATIVE_INFINITY, findings);
  if (
    object(value.handoff).state === "ready-for-order-review" &&
    findings.some((row) => !["invalid_commercial_validation_context"].includes(row.code))
  ) {
    findings.push(
      finding(
        "premature_commercial_order_readiness",
        "/handoff/state",
        "Ready state is forbidden while any semantic finding remains.",
      ),
    );
  }
  return findings;
}
