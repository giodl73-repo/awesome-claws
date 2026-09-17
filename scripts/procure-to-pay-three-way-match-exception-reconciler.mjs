import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schema = JSON.parse(
  await readFile(
    new URL(
      "../sources/procure-to-pay-three-way-match-exception-reconciler/schemas/procure-to-pay-three-way-match.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

const OFFSET_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const INTEGER = /^-?(?:0|[1-9][0-9]*)$/u;

const LINE_FIELDS = Object.freeze({
  "purchase-order": [
    "id",
    "manifestRef",
    "sourceSystemRef",
    "exportRef",
    "sourceNativeLineId",
    "revisionRef",
    "purchaseOrderId",
    "lineNumber",
    "itemRef",
    "unitOfMeasure",
    "quantity",
    "unitMinorUnits",
    "extendedMinorUnits",
    "currency",
  ],
  receipt: [
    "id",
    "manifestRef",
    "sourceSystemRef",
    "exportRef",
    "sourceNativeLineId",
    "poLineRef",
    "purchaseOrderRevisionRef",
    "receiptId",
    "kind",
    "reversesLineRef",
    "unitOfMeasure",
    "quantity",
    "recordedAt",
    "currency",
  ],
  invoice: [
    "id",
    "manifestRef",
    "sourceSystemRef",
    "exportRef",
    "sourceNativeLineId",
    "poLineRef",
    "purchaseOrderRevisionRef",
    "invoiceId",
    "kind",
    "reversesLineRef",
    "unitOfMeasure",
    "quantity",
    "unitMinorUnits",
    "lineMinorUnits",
    "recordedAt",
    "currency",
  ],
});

const POLICY_PAYLOAD_FIELDS = [
  "id",
  "version",
  "purchaseOrderId",
  "currency",
  "revisionRef",
  "groupShape",
  "quantityRule",
  "amountRule",
  "unitPriceRule",
  "correspondenceRule",
  "taxRule",
];

const REVISION_PAYLOAD_FIELDS = [
  "id",
  "purchaseOrderId",
  "revisionNumber",
  "supersedesRevisionRef",
  "amendmentRef",
  "amendmentPayloadDigest",
  "currency",
  "manifestRef",
  "lineManifestDigest",
];

const REQUIRED_ROLE_BY_SCOPE = Object.freeze({
  "matching-policy-approval": "matching-policy-owner",
  "purchase-order-amendment-approval": "purchase-order-amendment-approver",
  "match-decision": "match-reviewer",
  "owner-handoff": "exception-owner",
});

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function compareUtf16CodeUnits(left, right) {
  const a = String(left);
  const b = String(right);
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
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
  if (typeof value === "number") {
    return Number.isFinite(value) ? JSON.stringify(value) : "null";
  }
  if (typeof value === "bigint") return JSON.stringify(String(value));
  if (["string", "boolean"].includes(typeof value)) return JSON.stringify(value);
  return "null";
}

export function canonicalJson(value) {
  return canonicalJsonInner(value, new Set());
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function project(fields, source) {
  const value = object(source);
  return Object.fromEntries(fields.map((field) => [field, value[field] ?? null]));
}

export function computeLineManifestDigest(side, lines) {
  const fields = LINE_FIELDS[side] ?? [];
  const payload = records(lines)
    .map((line) => project(fields, line))
    .sort((left, right) => compareUtf16CodeUnits(left.id, right.id));
  return sha256(canonicalJson({ side, lines: payload }));
}

export function computeMatchingPolicyPayloadDigest(policy) {
  return sha256(canonicalJson(project(POLICY_PAYLOAD_FIELDS, policy)));
}

export function computeAmendmentPayloadDigest(amendment) {
  const value = object(amendment);
  const changes = records(value.changes)
    .map((change) => project(["lineRef", "field", "from", "to"], change))
    .sort((left, right) => compareUtf16CodeUnits(left.lineRef, right.lineRef));
  return sha256(
    canonicalJson({
      ...project(
        ["id", "purchaseOrderId", "fromRevisionRef", "toRevisionRef", "reasonCode"],
        value,
      ),
      changes,
    }),
  );
}

export function computePurchaseOrderRevisionPayloadDigest(revision) {
  return sha256(canonicalJson(project(REVISION_PAYLOAD_FIELDS, revision)));
}

export function computeMatchGroupPayloadDigest(group) {
  const value = object(group);
  return sha256(
    canonicalJson({
      id: value.id ?? null,
      policyRef: value.policyRef ?? null,
      poLineRefs: strings(value.poLineRefs).sort(compareUtf16CodeUnits),
      receiptLineRefs: strings(value.receiptLineRefs).sort(compareUtf16CodeUnits),
      invoiceLineRefs: strings(value.invoiceLineRefs).sort(compareUtf16CodeUnits),
      totals: project(
        [
          "purchaseOrderQuantity",
          "receiptQuantity",
          "invoiceQuantity",
          "purchaseOrderMinorUnits",
          "invoiceMinorUnits",
        ],
        value.totals,
      ),
    }),
  );
}

export function computePartitionRootDigest(candidate) {
  const value = object(candidate);
  const review = object(value.review);
  const policy = object(value.matchingPolicy);
  const revision = object(value.purchaseOrderRevision);
  const amendment = object(value.amendment);
  const coverage = object(value.coverage);
  const sortRows = (rows) =>
    records(rows).toSorted((left, right) => compareUtf16CodeUnits(left.id, right.id));
  return sha256(
    canonicalJson({
      schemaVersion: value.schemaVersion ?? null,
      clawId: value.clawId ?? null,
      review: project(
        [
          "id",
          "purchaseOrderId",
          "currency",
          "cutoffAt",
          "currentRevisionRef",
          "amendmentRef",
          "matchingPolicyRef",
          "destination",
          "nextOwnerRef",
        ],
        review,
      ),
      principals: sortRows(value.principals).map((row) =>
        project(["id", "name", "kind", "roles"], {
          ...row,
          roles: strings(row.roles).sort(compareUtf16CodeUnits),
        }),
      ),
      authorityGrants: sortRows(value.authorityGrants).map((row) =>
        project(
          [
            "id",
            "purchaseOrderId",
            "currency",
            "revisionRef",
            "scope",
            "granteeRef",
            "issuedByRef",
            "issuedAt",
            "activeFrom",
            "activeUntil",
          ],
          row,
        ),
      ),
      matchingPolicy: project(
        ["id", "version", "approvedPayloadDigest", "approvedByRef", "authorityGrantRef", "approvedAt"],
        policy,
      ),
      purchaseOrderRevision: project(
        [
          ...REVISION_PAYLOAD_FIELDS,
          "approvedPayloadDigest",
          "approvedByRef",
          "authorityGrantRef",
          "approvedAt",
        ],
        revision,
      ),
      amendment: {
        ...project(
          [
            "id",
            "purchaseOrderId",
            "fromRevisionRef",
            "toRevisionRef",
            "approvedPayloadDigest",
            "approvedByRef",
            "authorityGrantRef",
            "approvedAt",
            "reasonCode",
          ],
          amendment,
        ),
        changes: records(amendment.changes)
          .map((change) => project(["lineRef", "field", "from", "to"], change))
          .sort((left, right) => compareUtf16CodeUnits(left.lineRef, right.lineRef)),
      },
      manifests: sortRows(value.manifests).map((row) => ({
        ...project(
          [
            "id",
            "side",
            "purchaseOrderId",
            "currentRevisionRef",
            "sourceSystemRef",
            "exportRef",
            "generatedAt",
            "lineManifestDigest",
          ],
          row,
        ),
        lineRefs: strings(row.lineRefs).sort(compareUtf16CodeUnits),
      })),
      matchGroups: sortRows(value.matchGroups).map((group) => ({
        groupPayloadDigest: computeMatchGroupPayloadDigest(group),
        decision: project(
          [
            "id",
            "approvedByRef",
            "authorityGrantRef",
            "approvedAt",
            "policyRef",
            "policyVersion",
            "policyPayloadDigest",
            "groupPayloadDigest",
            "purchaseOrderManifestDigest",
            "receiptManifestDigest",
            "invoiceManifestDigest",
          ],
          group.decision,
        ),
      })),
      residuals: sortRows(value.residuals).map((row) =>
        project(
          ["id", "side", "lineRef", "poLineRef", "reasonCode", "ownerRef", "recordedAt"],
          row,
        ),
      ),
      coverage: {
        id: coverage.id ?? null,
        purchaseOrderLineRefs: strings(coverage.purchaseOrderLineRefs).sort(
          compareUtf16CodeUnits,
        ),
        receiptLineRefs: strings(coverage.receiptLineRefs).sort(compareUtf16CodeUnits),
        invoiceLineRefs: strings(coverage.invoiceLineRefs).sort(compareUtf16CodeUnits),
        groupRefs: strings(coverage.groupRefs).sort(compareUtf16CodeUnits),
        residualRefs: strings(coverage.residualRefs).sort(compareUtf16CodeUnits),
      },
      authorityClaims: object(value.authorityClaims),
    }),
  );
}

function integer(value) {
  return typeof value === "string" && INTEGER.test(value) ? BigInt(value) : null;
}

function timestamp(value) {
  if (typeof value !== "string" || !OFFSET_TIMESTAMP.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameExactSet(actual, expected) {
  if (
    !Array.isArray(actual) ||
    actual.some((item) => typeof item !== "string" || item.length === 0) ||
    new Set(actual).size !== actual.length
  ) {
    return false;
  }
  const left = [...actual].sort(compareUtf16CodeUnits);
  const right = [...expected].sort(compareUtf16CodeUnits);
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function finding(code, path, message, targetRefs = []) {
  return {
    code,
    path,
    message,
    targetRefs: [...new Set(strings(targetRefs))].sort(compareUtf16CodeUnits),
  };
}

function sortFindings(findings) {
  return findings.sort(
    (left, right) =>
      compareUtf16CodeUnits(left.code, right.code) ||
      compareUtf16CodeUnits(left.path, right.path) ||
      compareUtf16CodeUnits(left.message, right.message),
  );
}

function mapById(rows) {
  return new Map(records(rows).map((row) => [row.id, row]));
}

function addConsumption(counts, ref) {
  if (typeof ref === "string") counts.set(ref, (counts.get(ref) ?? 0) + 1);
}

function maximumTimestamp(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const parsed = values.map(timestamp);
  return parsed.some((value) => value === null) ? null : Math.max(...parsed);
}

export function validateThreeWayMatch(candidate, context = {}) {
  const findings = [];
  const add = (code, path, message, targetRefs = []) => {
    findings.push(finding(code, path, message, targetRefs));
  };

  const schemaValid = validateSchema(candidate);
  if (!schemaValid) {
    for (const error of validateSchema.errors ?? []) {
      add(
        "schema_invalid",
        error.instancePath || "/",
        error.message ?? "Schema validation failed.",
      );
    }
  }
  if (!isRecord(candidate)) {
    add("invalid_artifact", "/", "The candidate artifact must be an object.");
    return sortFindings(findings);
  }

  const value = candidate;
  const review = object(value.review);
  const policy = object(value.matchingPolicy);
  const revision = object(value.purchaseOrderRevision);
  const amendment = object(value.amendment);
  const coverage = object(value.coverage);
  const result = object(value.result);
  const principals = records(value.principals);
  const grants = records(value.authorityGrants);
  const manifests = records(value.manifests);
  const poLines = records(value.purchaseOrderLines);
  const receiptLines = records(value.receiptLines);
  const invoiceLines = records(value.invoiceLines);
  const groups = records(value.matchGroups);
  const residuals = records(value.residuals);
  const principalById = mapById(principals);
  const grantById = mapById(grants);
  const poLineById = mapById(poLines);
  const receiptLineById = mapById(receiptLines);
  const invoiceLineById = mapById(invoiceLines);
  const ownerTrustPolicy = object(object(context).ownerTrustPolicy);

  const asOf = timestamp(object(context).asOf);
  const callerCutoff = timestamp(object(context).cutoffAt);
  const artifactCutoff = timestamp(review.cutoffAt);
  if (
    asOf === null ||
    callerCutoff === null ||
    artifactCutoff === null ||
    object(context).cutoffAt !== review.cutoffAt ||
    callerCutoff > asOf
  ) {
    add(
      "invalid_validation_context",
      "/validationContext",
      "The caller must supply zone-bearing asOf and cutoffAt values, cutoffAt must equal the artifact cutoff, and cutoffAt cannot follow asOf.",
      [review.id],
    );
  }
  const trustScope = object(ownerTrustPolicy.scope);
  const trustMatchingPolicy = object(ownerTrustPolicy.matchingPolicy);
  const trustAuthority = object(ownerTrustPolicy.authority);
  const trustValidation = object(ownerTrustPolicy.validation);
  if (
    ownerTrustPolicy.schemaVersion !==
      "awesomeClaws.procureToPayOwnerTrustPolicy.v1" ||
    trustScope.purchaseOrderId !== review.purchaseOrderId ||
    trustScope.currency !== review.currency ||
    trustScope.currentRevisionRef !== review.currentRevisionRef ||
    trustMatchingPolicy.version !== policy.version ||
    trustMatchingPolicy.groupShape !== policy.groupShape ||
    trustMatchingPolicy.quantityRule !== policy.quantityRule ||
    trustMatchingPolicy.amountRule !== policy.amountRule ||
    trustMatchingPolicy.unitPriceRule !== policy.unitPriceRule ||
    trustMatchingPolicy.correspondenceRule !== policy.correspondenceRule ||
    trustMatchingPolicy.taxRule !== policy.taxRule ||
    trustMatchingPolicy.tolerancesPermitted !== false ||
    !sameExactSet(
      trustAuthority.requiredGrantScopes,
      Object.keys(REQUIRED_ROLE_BY_SCOPE),
    ) ||
    !sameExactSet(trustAuthority.grantTarget, [
      "purchaseOrderId",
      "currency",
      "revisionRef",
    ]) ||
    trustAuthority.namedHumanRequired !== true ||
    trustAuthority.independentIssuerRequired !== true ||
    trustValidation.callerSuppliesCutoffAt !== true ||
    trustValidation.callerSuppliesAsOf !== true ||
    trustValidation.zoneBearingRfc3339Required !== true ||
    trustValidation.wallClockFallbackPermitted !== false ||
    !sameExactSet(ownerTrustPolicy.reservedAuthority, [
      "accounting-interpretation",
      "tax-interpretation",
      "posting",
      "payment",
      "receipt-creation",
      "supplier-contact",
      "source-mutation",
    ])
  ) {
    add(
      "invalid_owner_trust_policy",
      "/validationContext/ownerTrustPolicy",
      "A current owner trust policy must bind the exact PO, currency, revision, source policy, target-bound authority model, caller-controlled time, and reserved actions.",
      [review.id, policy.id, revision.id],
    );
  }

  const idRecords = [
    review,
    ...principals,
    ...grants,
    policy,
    revision,
    amendment,
    ...manifests,
    ...poLines,
    ...receiptLines,
    ...invoiceLines,
    ...groups,
    ...groups.map((group) => object(group.decision)),
    ...residuals,
    coverage,
    result,
  ];
  const idCounts = new Map();
  for (const row of idRecords) {
    if (typeof row.id === "string") idCounts.set(row.id, (idCounts.get(row.id) ?? 0) + 1);
  }
  for (const [id, count] of idCounts) {
    if (count > 1) {
      add("duplicate_id", "/", `Every modeled id must be globally unique; ${id} appears ${count} times.`, [
        id,
      ]);
    }
  }

  const validateAuthority = (actorRef, grantRef, scope, actedAt, path) => {
    const actor = principalById.get(actorRef);
    const grant = grantById.get(grantRef);
    const issuer = principalById.get(object(grant).issuedByRef);
    const acted = timestamp(actedAt);
    const issued = timestamp(object(grant).issuedAt);
    const activeFrom = timestamp(object(grant).activeFrom);
    const activeUntil = timestamp(object(grant).activeUntil);
    const valid =
      actor?.kind === "named-human" &&
      strings(actor.roles).includes(REQUIRED_ROLE_BY_SCOPE[scope]) &&
      grant?.scope === scope &&
      grant.granteeRef === actorRef &&
      grant.purchaseOrderId === review.purchaseOrderId &&
      grant.currency === review.currency &&
      grant.revisionRef === review.currentRevisionRef &&
      issuer?.kind === "named-human" &&
      strings(issuer.roles).includes("authority-issuer") &&
      issuer.id !== actorRef &&
      acted !== null &&
      issued !== null &&
      activeFrom !== null &&
      activeUntil !== null &&
      issued <= activeFrom &&
      activeFrom <= acted &&
      acted <= activeUntil &&
      activeFrom < activeUntil;
    if (!valid) {
      add(
        "invalid_human_authority",
        path,
        `The ${scope} act requires a current, typed, independently issued grant to the named human actor.`,
        [actorRef, grantRef],
      );
    }
    return valid;
  };

  for (const [index, grant] of grants.entries()) {
    const grantee = principalById.get(grant.granteeRef);
    const issuer = principalById.get(grant.issuedByRef);
    if (
      grant.purchaseOrderId !== review.purchaseOrderId ||
      grant.currency !== review.currency ||
      grant.revisionRef !== review.currentRevisionRef ||
      !REQUIRED_ROLE_BY_SCOPE[grant.scope] ||
      grantee?.kind !== "named-human" ||
      !strings(grantee.roles).includes(REQUIRED_ROLE_BY_SCOPE[grant.scope]) ||
      issuer?.kind !== "named-human" ||
      !strings(issuer.roles).includes("authority-issuer") ||
      grant.granteeRef === grant.issuedByRef
    ) {
      add(
        "invalid_authority_grant",
        `/authorityGrants/${index}`,
        "Every authority grant must be scoped to the exact purchase order, currency, and current revision, typed, and independently issued to a named human with the required role.",
        [grant.id],
      );
    }
  }

  if (
    review.currentRevisionRef !== revision.id ||
    review.amendmentRef !== amendment.id ||
    review.matchingPolicyRef !== policy.id ||
    revision.purchaseOrderId !== review.purchaseOrderId ||
    amendment.purchaseOrderId !== review.purchaseOrderId ||
    policy.purchaseOrderId !== review.purchaseOrderId ||
    policy.currency !== review.currency ||
    policy.revisionRef !== review.currentRevisionRef ||
    revision.currency !== review.currency
  ) {
    add(
      "invalid_review_binding",
      "/review",
      "The review, current PO revision, amendment, policy, purchase order, and currency must bind exactly.",
      [review.id, revision.id, amendment.id, policy.id],
    );
  }

  validateAuthority(
    policy.approvedByRef,
    policy.authorityGrantRef,
    "matching-policy-approval",
    policy.approvedAt,
    "/matchingPolicy",
  );
  if (policy.approvedPayloadDigest !== computeMatchingPolicyPayloadDigest(policy)) {
    add(
      "invalid_policy_approval_digest",
      "/matchingPolicy/approvedPayloadDigest",
      "The matching-policy approval must bind the exact immutable policy payload.",
      [policy.id],
    );
  }
  if (timestamp(policy.approvedAt) === null || timestamp(policy.approvedAt) > artifactCutoff) {
    add(
      "invalid_matching_policy",
      "/matchingPolicy/approvedAt",
      "The owner-approved exact matching policy must be effective by the caller-controlled cutoff.",
      [policy.id],
    );
  }

  validateAuthority(
    amendment.approvedByRef,
    amendment.authorityGrantRef,
    "purchase-order-amendment-approval",
    amendment.approvedAt,
    "/amendment",
  );
  validateAuthority(
    revision.approvedByRef,
    revision.authorityGrantRef,
    "purchase-order-amendment-approval",
    revision.approvedAt,
    "/purchaseOrderRevision",
  );
  if (amendment.approvedPayloadDigest !== computeAmendmentPayloadDigest(amendment)) {
    add(
      "invalid_amendment_approval_digest",
      "/amendment/approvedPayloadDigest",
      "The amendment approval must bind the exact immutable amendment payload.",
      [amendment.id],
    );
  }
  if (
    revision.amendmentPayloadDigest !== amendment.approvedPayloadDigest ||
    revision.approvedPayloadDigest !== computePurchaseOrderRevisionPayloadDigest(revision)
  ) {
    add(
      "invalid_revision_approval_digest",
      "/purchaseOrderRevision/approvedPayloadDigest",
      "The PO revision approval must bind the exact current line manifest and approved amendment payload.",
      [revision.id, amendment.id],
    );
  }
  if (
    amendment.toRevisionRef !== revision.id ||
    amendment.fromRevisionRef !== revision.supersedesRevisionRef ||
    revision.amendmentRef !== amendment.id ||
    timestamp(amendment.approvedAt) === null ||
    timestamp(revision.approvedAt) === null ||
    timestamp(amendment.approvedAt) > timestamp(revision.approvedAt) ||
    timestamp(revision.approvedAt) > artifactCutoff
  ) {
    add(
      "invalid_purchase_order_revision",
      "/purchaseOrderRevision",
      "The current revision must be the owner-approved result of the exact amendment before cutoff.",
      [revision.id, amendment.id],
    );
  }

  const changedLineRefs = [];
  for (const [index, change] of records(amendment.changes).entries()) {
    const line = poLineById.get(change.lineRef);
    changedLineRefs.push(change.lineRef);
    if (
      !line ||
      change.field !== "quantity" ||
      change.from === change.to ||
      change.to !== line.quantity
    ) {
      add(
        "invalid_amendment_change",
        `/amendment/changes/${index}`,
        "Every amendment change must alter one current PO line quantity and its to value must equal the current revision.",
        [change.lineRef],
      );
    }
  }
  if (new Set(changedLineRefs).size !== changedLineRefs.length) {
    add(
      "invalid_amendment_change",
      "/amendment/changes",
      "An amendment may change each PO line at most once.",
      changedLineRefs,
    );
  }

  const linesBySide = Object.freeze({
    "purchase-order": poLines,
    receipt: receiptLines,
    invoice: invoiceLines,
  });
  const manifestBySide = new Map();
  for (const [index, manifest] of manifests.entries()) {
    if (manifestBySide.has(manifest.side)) {
      add(
        "invalid_line_manifest",
        `/manifests/${index}/side`,
        "Exactly one line manifest is allowed per source side.",
        [manifest.id],
      );
    }
    manifestBySide.set(manifest.side, manifest);
  }
  for (const side of Object.keys(linesBySide)) {
    const manifest = manifestBySide.get(side);
    const lines = linesBySide[side];
    if (
      !manifest ||
      manifest.purchaseOrderId !== review.purchaseOrderId ||
      manifest.currentRevisionRef !== revision.id ||
      !sameExactSet(
        manifest.lineRefs,
        lines.map((line) => line.id),
      ) ||
      manifest.lineManifestDigest !== computeLineManifestDigest(side, lines) ||
      lines.some((line) => line.manifestRef !== manifest.id)
    ) {
      add(
        "invalid_line_manifest",
        "/manifests",
        `The ${side} manifest must exactly enumerate and digest every current source line.`,
        [manifest?.id, ...lines.map((line) => line.id)],
      );
    }
    const sourceIdentityCounts = new Map();
    for (const [index, line] of lines.entries()) {
      const identity = [line.sourceSystemRef, line.exportRef, line.sourceNativeLineId];
      if (
        identity.some((part) => typeof part !== "string" || part.length === 0) ||
        line.sourceSystemRef !== manifest?.sourceSystemRef ||
        line.exportRef !== manifest?.exportRef
      ) {
        add(
          "invalid_source_line_identity",
          `/${side}Lines/${index}`,
          "Every source line must preserve its exact owner source system, export, and opaque native line identity from the containing manifest.",
          [line.id],
        );
      }
      const identityKey = canonicalJson(identity);
      sourceIdentityCounts.set(identityKey, (sourceIdentityCounts.get(identityKey) ?? 0) + 1);
    }
    for (const [identityKey, count] of sourceIdentityCounts) {
      if (count > 1) {
        add(
          "duplicate_source_line_identity",
          `/${side}Lines`,
          "One immutable owner source line identity cannot be split across multiple candidate rows.",
          lines
            .filter(
              (line) =>
                canonicalJson([
                  line.sourceSystemRef,
                  line.exportRef,
                  line.sourceNativeLineId,
                ]) === identityKey,
            )
            .map((line) => line.id),
        );
      }
    }
    const sourceTrustRoots = records(ownerTrustPolicy.sourceTrustRoots);
    for (const side of Object.keys(linesBySide)) {
      const manifest = manifestBySide.get(side);
      const roots = sourceTrustRoots.filter((root) => root.side === side);
      const root = roots[0];
      if (
        roots.length !== 1 ||
        root?.sourceSystemRef !== manifest?.sourceSystemRef ||
        root?.exportRef !== manifest?.exportRef ||
        typeof root?.owner !== "string" ||
        root.owner.length === 0
      ) {
        add(
          "invalid_owner_trust_policy",
          "/validationContext/ownerTrustPolicy/sourceTrustRoots",
          `The owner trust policy must name exactly one current ${side} source-system and export trust root with an accountable owner.`,
          [manifest?.id],
        );
      }
    }
    if (sourceTrustRoots.length !== 3) {
      add(
        "invalid_owner_trust_policy",
        "/validationContext/ownerTrustPolicy/sourceTrustRoots",
        "The owner trust policy must contain exactly the purchase-order, receipt, and invoice trust roots.",
        sourceTrustRoots.map((root) => root.side),
      );
    }
    const generatedAt = timestamp(manifest?.generatedAt);
    if (
      generatedAt === null ||
      artifactCutoff === null ||
      asOf === null ||
      generatedAt < artifactCutoff ||
      generatedAt > asOf
    ) {
      add(
        "invalid_manifest_chronology",
        "/manifests",
        `The ${side} manifest must be generated at or after cutoff and no later than caller-supplied asOf.`,
        [manifest?.id],
      );
    }
  }
  if (
    revision.manifestRef !== manifestBySide.get("purchase-order")?.id ||
    revision.lineManifestDigest !==
      manifestBySide.get("purchase-order")?.lineManifestDigest
  ) {
    add(
      "invalid_purchase_order_revision",
      "/purchaseOrderRevision/manifestRef",
      "The current revision must bind the exact purchase-order line manifest.",
      [revision.id],
    );
  }

  const lineNumbers = new Set();
  for (const [index, line] of poLines.entries()) {
    const quantity = integer(line.quantity);
    const unit = integer(line.unitMinorUnits);
    const extended = integer(line.extendedMinorUnits);
    if (
      line.revisionRef !== revision.id ||
      line.purchaseOrderId !== review.purchaseOrderId ||
      line.currency !== review.currency
    ) {
      add(
        "invalid_source_revision",
        `/purchaseOrderLines/${index}`,
        "Every PO line must bind the exact current revision, purchase order, and currency.",
        [line.id],
      );
    }
    if (
      quantity === null ||
      unit === null ||
      extended === null ||
      quantity <= 0n ||
      unit <= 0n ||
      quantity * unit !== extended
    ) {
      add(
        "invalid_integer_arithmetic",
        `/purchaseOrderLines/${index}`,
        "PO extension must equal positive integer quantity times positive integer unit minor units.",
        [line.id],
      );
    }
    if (lineNumbers.has(line.lineNumber)) {
      add(
        "duplicate_po_line_number",
        `/purchaseOrderLines/${index}/lineNumber`,
        "Current PO line numbers must be unique.",
        [line.id],
      );
    }
    lineNumbers.add(line.lineNumber);
  }

  const receiptReversalValid = new Map();
  for (const [index, line] of receiptLines.entries()) {
    const quantity = integer(line.quantity);
    const poLine = poLineById.get(line.poLineRef);
    if (
      line.purchaseOrderRevisionRef !== revision.id ||
      line.currency !== review.currency ||
      !poLine ||
      line.unitOfMeasure !== poLine.unitOfMeasure
    ) {
      add(
        "invalid_source_revision",
        `/receiptLines/${index}`,
        "Every receipt or return line must bind one current PO line, revision, and currency.",
        [line.id, line.poLineRef],
      );
    }
    if (
      quantity === null ||
      quantity === 0n ||
      (line.kind === "receipt" && quantity < 0n) ||
      (line.kind === "return" && quantity > 0n)
    ) {
      add(
        "invalid_integer_arithmetic",
        `/receiptLines/${index}/quantity`,
        "Receipt quantities must be positive integers and return quantities must be negative integers.",
        [line.id],
      );
    }
    const recordedAt = timestamp(line.recordedAt);
    if (recordedAt === null || artifactCutoff === null || recordedAt > artifactCutoff) {
      add(
        "record_after_cutoff",
        `/receiptLines/${index}/recordedAt`,
        "Receipt-side lines after the caller-controlled cutoff are outside this review.",
        [line.id],
      );
    }
    const reversed = receiptLineById.get(line.reversesLineRef);
    const reversedQuantity = integer(object(reversed).quantity);
    const reversalValid =
      line.kind === "receipt"
        ? line.reversesLineRef === null
        : reversed?.kind === "receipt" &&
          reversed.id !== line.id &&
          reversed.poLineRef === line.poLineRef &&
          reversed.purchaseOrderRevisionRef === line.purchaseOrderRevisionRef &&
          reversed.currency === line.currency &&
          reversed.unitOfMeasure === line.unitOfMeasure &&
          reversed.sourceSystemRef === line.sourceSystemRef &&
          reversedQuantity !== null &&
          quantity !== null &&
          -quantity <= reversedQuantity &&
          timestamp(reversed.recordedAt) !== null &&
          recordedAt !== null &&
          timestamp(reversed.recordedAt) < recordedAt;
    receiptReversalValid.set(line.id, reversalValid);
  }
  for (const source of receiptLines.filter((line) => line.kind === "receipt")) {
    const sourceQuantity = integer(source.quantity);
    const reversals = receiptLines.filter(
      (line) => line.kind === "return" && line.reversesLineRef === source.id,
    );
    const reversalQuantities = reversals.map((line) => integer(line.quantity));
    if (
      sourceQuantity === null ||
      reversalQuantities.some((quantity) => quantity === null) ||
      reversalQuantities.reduce((sum, quantity) => sum - quantity, 0n) > sourceQuantity
    ) {
      for (const reversal of reversals) receiptReversalValid.set(reversal.id, false);
    }
  }

  const invoiceReversalValid = new Map();
  for (const [index, line] of invoiceLines.entries()) {
    const quantity = integer(line.quantity);
    const unit = integer(line.unitMinorUnits);
    const amount = integer(line.lineMinorUnits);
    const poLine = poLineById.get(line.poLineRef);
    if (
      line.purchaseOrderRevisionRef !== revision.id ||
      line.currency !== review.currency ||
      !poLine ||
      line.unitOfMeasure !== poLine.unitOfMeasure
    ) {
      add(
        "invalid_source_revision",
        `/invoiceLines/${index}`,
        "Every invoice or credit line must bind one current PO line, revision, and currency.",
        [line.id, line.poLineRef],
      );
    }
    if (
      quantity === null ||
      unit === null ||
      amount === null ||
      quantity === 0n ||
      unit <= 0n ||
      quantity * unit !== amount ||
      (line.kind === "invoice" && quantity < 0n) ||
      (line.kind === "credit" && quantity > 0n)
    ) {
      add(
        "invalid_integer_arithmetic",
        `/invoiceLines/${index}`,
        "Invoice and credit line amounts must equal signed integer quantity times positive integer unit minor units.",
        [line.id],
      );
    }
    const recordedAt = timestamp(line.recordedAt);
    if (recordedAt === null || artifactCutoff === null || recordedAt > artifactCutoff) {
      add(
        "record_after_cutoff",
        `/invoiceLines/${index}/recordedAt`,
        "Invoice-side lines after the caller-controlled cutoff are outside this review.",
        [line.id],
      );
    }
    const reversed = invoiceLineById.get(line.reversesLineRef);
    const reversedQuantity = integer(object(reversed).quantity);
    const reversalValid =
      line.kind === "invoice"
        ? line.reversesLineRef === null
        : reversed?.kind === "invoice" &&
          reversed.id !== line.id &&
          reversed.poLineRef === line.poLineRef &&
          reversed.purchaseOrderRevisionRef === line.purchaseOrderRevisionRef &&
          reversed.currency === line.currency &&
          reversed.unitOfMeasure === line.unitOfMeasure &&
          reversed.unitMinorUnits === line.unitMinorUnits &&
          reversed.sourceSystemRef === line.sourceSystemRef &&
          reversedQuantity !== null &&
          quantity !== null &&
          -quantity <= reversedQuantity &&
          timestamp(reversed.recordedAt) !== null &&
          recordedAt !== null &&
          timestamp(reversed.recordedAt) < recordedAt;
    invoiceReversalValid.set(line.id, reversalValid);
  }
  for (const source of invoiceLines.filter((line) => line.kind === "invoice")) {
    const sourceQuantity = integer(source.quantity);
    const reversals = invoiceLines.filter(
      (line) => line.kind === "credit" && line.reversesLineRef === source.id,
    );
    const reversalQuantities = reversals.map((line) => integer(line.quantity));
    if (
      sourceQuantity === null ||
      reversalQuantities.some((quantity) => quantity === null) ||
      reversalQuantities.reduce((sum, quantity) => sum - quantity, 0n) > sourceQuantity
    ) {
      for (const reversal of reversals) invoiceReversalValid.set(reversal.id, false);
    }
  }

  const decisionPrerequisite = maximumTimestamp([
    review.cutoffAt,
    ...manifests.map((manifest) => manifest.generatedAt),
  ]);
  const consumption = Object.freeze({
    "purchase-order": new Map(),
    receipt: new Map(),
    invoice: new Map(),
  });

  for (const [index, group] of groups.entries()) {
    const path = `/matchGroups/${index}`;
    const poRefs = strings(group.poLineRefs);
    const receiptRefs = strings(group.receiptLineRefs);
    const invoiceRefs = strings(group.invoiceLineRefs);
    poRefs.forEach((ref) => addConsumption(consumption["purchase-order"], ref));
    receiptRefs.forEach((ref) => addConsumption(consumption.receipt, ref));
    invoiceRefs.forEach((ref) => addConsumption(consumption.invoice, ref));
    const poLine = poLineById.get(poRefs[0]);
    const selectedReceipts = receiptRefs.map((ref) => receiptLineById.get(ref));
    const selectedInvoices = invoiceRefs.map((ref) => invoiceLineById.get(ref));

    if (
      group.policyRef !== policy.id ||
      poRefs.length !== 1 ||
      receiptRefs.length === 0 ||
      invoiceRefs.length === 0 ||
      new Set([...poRefs, ...receiptRefs, ...invoiceRefs]).size !==
        poRefs.length + receiptRefs.length + invoiceRefs.length ||
      !poLine ||
      selectedReceipts.some((line) => !line) ||
      selectedInvoices.some((line) => !line)
    ) {
      add(
        "invalid_three_way_group",
        path,
        "A group must use the approved policy and contain one known PO line plus one or more distinct known receipt and invoice lines.",
        [group.id, ...poRefs, ...receiptRefs, ...invoiceRefs],
      );
      continue;
    }
    if (
      selectedReceipts.some((line) => line.poLineRef !== poLine.id) ||
      selectedInvoices.some((line) => line.poLineRef !== poLine.id)
    ) {
      add(
        "cross_po_line_group",
        path,
        "Every receipt, return, invoice, and credit in a group must explicitly reference its one PO line.",
        [group.id, poLine.id, ...receiptRefs, ...invoiceRefs],
      );
    }
    if (
      selectedReceipts.some((line) => !receiptReversalValid.get(line.id)) ||
      selectedInvoices.some((line) => !invoiceReversalValid.get(line.id)) ||
      selectedReceipts.some(
        (line) => line.kind === "return" && !receiptRefs.includes(line.reversesLineRef),
      ) ||
      selectedInvoices.some(
        (line) => line.kind === "credit" && !invoiceRefs.includes(line.reversesLineRef),
      )
    ) {
      add(
        "invalid_reversal",
        path,
        "Every grouped return or credit must reference an earlier exact source line with matching PO, revision, currency, unit, and source system.",
        [group.id, ...receiptRefs, ...invoiceRefs],
      );
    }

    const poQuantity = integer(poLine.quantity);
    const poAmount = integer(poLine.extendedMinorUnits);
    const poUnit = integer(poLine.unitMinorUnits);
    const receiptQuantities = selectedReceipts.map((line) => integer(line.quantity));
    const invoiceQuantities = selectedInvoices.map((line) => integer(line.quantity));
    const invoiceAmounts = selectedInvoices.map((line) => integer(line.lineMinorUnits));
    const arithmeticValid = [
      poQuantity,
      poAmount,
      poUnit,
      ...receiptQuantities,
      ...invoiceQuantities,
      ...invoiceAmounts,
    ].every((item) => item !== null);
    if (!arithmeticValid) {
      add(
        "invalid_integer_arithmetic",
        path,
        "Every group arithmetic input must be an integer string.",
        [group.id],
      );
    } else {
      const receiptQuantity = receiptQuantities.reduce((sum, item) => sum + item, 0n);
      const invoiceQuantity = invoiceQuantities.reduce((sum, item) => sum + item, 0n);
      const invoiceAmount = invoiceAmounts.reduce((sum, item) => sum + item, 0n);
      const declared = object(group.totals);
      if (
        selectedReceipts.some((line) => line.unitOfMeasure !== poLine.unitOfMeasure) ||
        selectedInvoices.some(
          (line) =>
            integer(line.unitMinorUnits) !== poUnit ||
            line.unitOfMeasure !== poLine.unitOfMeasure,
        ) ||
        receiptQuantity !== poQuantity ||
        invoiceQuantity !== poQuantity ||
        invoiceAmount !== poAmount ||
        declared.purchaseOrderQuantity !== String(poQuantity) ||
        declared.receiptQuantity !== String(receiptQuantity) ||
        declared.invoiceQuantity !== String(invoiceQuantity) ||
        declared.purchaseOrderMinorUnits !== String(poAmount) ||
        declared.invoiceMinorUnits !== String(invoiceAmount)
      ) {
        add(
          "three_way_mismatch",
          `${path}/totals`,
          "PO, net receipt/return, and net invoice/credit quantities plus PO and invoice minor-unit amounts must match exactly.",
          [group.id, poLine.id, ...receiptRefs, ...invoiceRefs],
        );
      }
    }

    const decision = object(group.decision);
    validateAuthority(
      decision.approvedByRef,
      decision.authorityGrantRef,
      "match-decision",
      decision.approvedAt,
      `${path}/decision`,
    );
    if (
      decision.policyRef !== policy.id ||
      decision.policyVersion !== policy.version ||
      decision.policyPayloadDigest !== policy.approvedPayloadDigest ||
      decision.groupPayloadDigest !== computeMatchGroupPayloadDigest(group) ||
      decision.purchaseOrderManifestDigest !==
        manifestBySide.get("purchase-order")?.lineManifestDigest ||
      decision.receiptManifestDigest !== manifestBySide.get("receipt")?.lineManifestDigest ||
      decision.invoiceManifestDigest !== manifestBySide.get("invoice")?.lineManifestDigest
    ) {
      add(
        "invalid_match_decision_binding",
        `${path}/decision`,
        "Every match decision must bind the exact policy revision and payload, group payload, and all three source manifest digests.",
        [group.id, decision.id, policy.id],
      );
    }
    const decidedAt = timestamp(decision.approvedAt);
    if (
      decidedAt === null ||
      decisionPrerequisite === null ||
      asOf === null ||
      decidedAt <= decisionPrerequisite ||
      decidedAt > asOf
    ) {
      add(
        "invalid_decision_chronology",
        `${path}/decision/approvedAt`,
        "A match decision must follow cutoff and all three exact manifests and must not follow caller-supplied asOf.",
        [group.id, decision.id],
      );
    }
  }

  for (const [index, residual] of residuals.entries()) {
    const path = `/residuals/${index}`;
    const sideLines = linesBySide[residual.side] ?? [];
    const line = sideLines.find((item) => item.id === residual.lineRef);
    addConsumption(consumption[residual.side] ?? new Map(), residual.lineRef);
    const owner = principalById.get(residual.ownerRef);
    const expectedPoRef =
      residual.side === "purchase-order" ? residual.lineRef : object(line).poLineRef;
    const relatedReceipts = receiptLines.filter((item) => item.poLineRef === residual.poLineRef);
    const relatedInvoices = invoiceLines.filter((item) => item.poLineRef === residual.poLineRef);
    const poLine = poLineById.get(residual.poLineRef);
    const poQuantity = integer(object(poLine).quantity);
    const poAmount = integer(object(poLine).extendedMinorUnits);
    const poUnit = integer(object(poLine).unitMinorUnits);
    const receiptQuantities = relatedReceipts.map((item) => integer(item.quantity));
    const invoiceQuantities = relatedInvoices.map((item) => integer(item.quantity));
    const invoiceAmounts = relatedInvoices.map((item) => integer(item.lineMinorUnits));
    const exactRelatedMatch =
      relatedReceipts.length > 0 &&
      relatedInvoices.length > 0 &&
      [
        poQuantity,
        poAmount,
        poUnit,
        ...receiptQuantities,
        ...invoiceQuantities,
        ...invoiceAmounts,
      ].every((item) => item !== null) &&
      relatedReceipts.every(
        (item) =>
          item.unitOfMeasure === object(poLine).unitOfMeasure &&
          receiptReversalValid.get(item.id),
      ) &&
      relatedInvoices.every(
        (item) =>
          integer(item.unitMinorUnits) === poUnit &&
          item.unitOfMeasure === object(poLine).unitOfMeasure &&
          invoiceReversalValid.get(item.id),
      ) &&
      receiptQuantities.reduce((sum, item) => sum + item, 0n) === poQuantity &&
      invoiceQuantities.reduce((sum, item) => sum + item, 0n) === poQuantity &&
      invoiceAmounts.reduce((sum, item) => sum + item, 0n) === poAmount;
    const validReason =
      residual.side === "purchase-order"
        ? (residual.reasonCode === "no-receipt-or-invoice-by-cutoff" &&
            relatedReceipts.length === 0 &&
            relatedInvoices.length === 0) ||
          (residual.reasonCode === "three-way-mismatch-needs-owner-review" &&
            (relatedReceipts.length > 0 || relatedInvoices.length > 0) &&
            !exactRelatedMatch)
        : residual.reasonCode ===
            (residual.side === "receipt"
              ? "receipt-needs-owner-review"
              : "invoice-needs-owner-review") && !exactRelatedMatch;
    const recordedAt = timestamp(residual.recordedAt);
    if (
      !line ||
      !poLineById.has(residual.poLineRef) ||
      residual.poLineRef !== expectedPoRef ||
      !validReason ||
      residual.ownerRef !== review.nextOwnerRef ||
      owner?.kind !== "named-human" ||
      !strings(owner.roles).includes("exception-owner") ||
      recordedAt === null ||
      decisionPrerequisite === null ||
      asOf === null ||
      recordedAt <= decisionPrerequisite ||
      recordedAt > asOf
    ) {
      add(
        "invalid_side_residual",
        path,
        "A side-specific residual must consume one exact source line, bind its PO line, use the evidence-derived closed reason for that side, and name the review's current exception owner after manifests; an exact match cannot be residualized.",
        [residual.id, residual.lineRef, residual.poLineRef, residual.ownerRef],
      );
    }
  }

  for (const [side, lines] of Object.entries(linesBySide)) {
    for (const line of lines) {
      const count = consumption[side].get(line.id) ?? 0;
      if (count !== 1) {
        add(
          count === 0 ? "line_omitted" : "line_reused",
          `/${side}Lines`,
          `Every ${side} line must be consumed exactly once by one allowed three-sided group or one ${side} residual; observed ${count}.`,
          [line.id],
        );
      }
    }
  }

  const expectedCoverage = Object.freeze({
    purchaseOrderLineRefs: poLines.map((line) => line.id),
    receiptLineRefs: receiptLines.map((line) => line.id),
    invoiceLineRefs: invoiceLines.map((line) => line.id),
    groupRefs: groups.map((group) => group.id),
    residualRefs: residuals.map((residual) => residual.id),
  });
  for (const [field, expected] of Object.entries(expectedCoverage)) {
    if (!sameExactSet(coverage[field], expected)) {
      add(
        "incomplete_coverage",
        `/coverage/${field}`,
        `Coverage ${field} must equal the exact derived source or partition index.`,
        [coverage.id, ...expected],
      );
    }
  }

  const expectedPartitionRootDigest = computePartitionRootDigest(value);
  if (result.partitionRootDigest !== expectedPartitionRootDigest) {
    add(
      "invalid_partition_root",
      "/result/partitionRootDigest",
      "The handoff must bind the complete partition, including authority, policy, amendment, current revision, all manifests, decisions, residuals, coverage, and non-claims.",
      [result.id],
    );
  }
  validateAuthority(
    result.preparedByRef,
    result.authorityGrantRef,
    "owner-handoff",
    result.generatedAt,
    "/result",
  );
  const latestPrerequisite = maximumTimestamp([
    review.cutoffAt,
    policy.approvedAt,
    amendment.approvedAt,
    revision.approvedAt,
    ...grants.flatMap((grant) => [grant.issuedAt, grant.activeFrom]),
    ...manifests.map((manifest) => manifest.generatedAt),
    ...groups.map((group) => object(group.decision).approvedAt),
    ...residuals.map((residual) => residual.recordedAt),
  ]);
  const generatedAt = timestamp(result.generatedAt);
  if (
    generatedAt === null ||
    latestPrerequisite === null ||
    asOf === null ||
    generatedAt <= latestPrerequisite ||
    generatedAt > asOf ||
    result.nextOwnerRef !== review.nextOwnerRef ||
    principalById.get(result.nextOwnerRef)?.kind !== "named-human" ||
    !strings(principalById.get(result.nextOwnerRef)?.roles).includes("exception-owner") ||
    !sameExactSet(
      result.groupRefs,
      groups.map((group) => group.id),
    ) ||
    !sameExactSet(
      result.residualRefs,
      residuals.map((residual) => residual.id),
    )
  ) {
    add(
      "invalid_result",
      "/result",
      "The result must follow every policy, amendment, grant, manifest, decision, and residual prerequisite, precede asOf, bind the review's typed next owner, and carry the exact group and residual indexes.",
      [result.id],
    );
  }

  const preResultFindings = findings.filter((item) => item.path !== "/result");
  const expectedFindingCodes = [
    ...new Set(preResultFindings.map((item) => item.code)),
  ].sort(compareUtf16CodeUnits);
  const completeState =
    residuals.length === 0 ? "accepted-for-owner-review" : "pending-owner-review";
  const validResultState =
    preResultFindings.length === 0
      ? result.state === completeState &&
        sameExactSet(result.findingCodes, [])
      : result.state === "blocked" &&
        sameExactSet(result.findingCodes, expectedFindingCodes);
  if (!validResultState) {
    add(
      "invalid_result",
      "/result/state",
      "A clean partition is accepted with no residuals and pending with residuals; a blocked result must list the exact distinct pre-result finding codes.",
      [result.id],
    );
  }

  return sortFindings(findings);
}

function pairwisePartitionAccepted(leftLines, rightLines, groups, rightRefField, checkAmount) {
  const leftById = mapById(leftLines);
  const rightById = mapById(rightLines);
  const leftCounts = new Map();
  const rightCounts = new Map();
  for (const group of records(groups)) {
    const leftRefs = strings(group.poLineRefs);
    const rightRefs = strings(group[rightRefField]);
    leftRefs.forEach((ref) => addConsumption(leftCounts, ref));
    rightRefs.forEach((ref) => addConsumption(rightCounts, ref));
    const selectedLeft = leftRefs.map((ref) => leftById.get(ref));
    const selectedRight = rightRefs.map((ref) => rightById.get(ref));
    if (
      selectedLeft.some((line) => !line) ||
      selectedRight.some((line) => !line) ||
      selectedLeft.length === 0 ||
      selectedRight.length === 0
    ) {
      return false;
    }
    const leftQuantities = selectedLeft.map((line) => integer(line.quantity));
    const rightQuantities = selectedRight.map((line) => integer(line.quantity));
    if ([...leftQuantities, ...rightQuantities].some((quantity) => quantity === null)) {
      return false;
    }
    const leftQuantity = leftQuantities.reduce((sum, quantity) => sum + quantity, 0n);
    const rightQuantity = rightQuantities.reduce((sum, quantity) => sum + quantity, 0n);
    if (leftQuantity !== rightQuantity) return false;
    if (checkAmount) {
      const leftAmounts = selectedLeft.map((line) => integer(line.extendedMinorUnits));
      const rightAmounts = selectedRight.map((line) => integer(line.lineMinorUnits));
      if ([...leftAmounts, ...rightAmounts].some((amount) => amount === null)) return false;
      const leftAmount = leftAmounts.reduce((sum, amount) => sum + amount, 0n);
      const rightAmount = rightAmounts.reduce((sum, amount) => sum + amount, 0n);
      if (leftAmount !== rightAmount) return false;
    }
  }
  return (
    [...leftById].every(([id]) => leftCounts.get(id) === 1) &&
    [...rightById].every(([id]) => rightCounts.get(id) === 1)
  );
}

export function evaluateIrreducibilityWitness(witness) {
  const value = object(witness);
  const poLines = records(value.purchaseOrderLines);
  const receiptLines = records(value.receiptLines);
  const invoiceLines = records(value.invoiceLines);
  const poReceiptAccepted = pairwisePartitionAccepted(
    poLines,
    receiptLines,
    value.poReceiptGroups,
    "receiptLineRefs",
    false,
  );
  const poInvoiceAccepted = pairwisePartitionAccepted(
    poLines,
    invoiceLines,
    value.poInvoiceGroups,
    "invoiceLineRefs",
    true,
  );
  const eachPairwiseGroupHasOnePo = [
    ...records(value.poReceiptGroups),
    ...records(value.poInvoiceGroups),
  ].every((group) => strings(group.poLineRefs).length === 1);
  const threeWayPartitionAccepted =
    poReceiptAccepted && poInvoiceAccepted && eachPairwiseGroupHasOnePo;
  return {
    poReceiptAccepted,
    poInvoiceAccepted,
    threeWayPartitionAccepted,
    reason: threeWayPartitionAccepted
      ? null
      : "The pairwise PO-to-invoice partition aggregates multiple PO lines into one invoice line, but the owner-approved three-way policy requires one PO line per atomic group and forbids splitting or reusing that invoice line.",
  };
}

export const procureToPayThreeWayMatchFindings = validateThreeWayMatch;
