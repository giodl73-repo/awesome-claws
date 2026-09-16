import { createHash } from "node:crypto";
import { hasUnnegatedNarrativeMatch } from "./narrative-safety.mjs";

const ROLE_PATTERN = /\bsupplier capacity assurance manager\b/iu;
const AGENT_PATTERN = /^(?:the\s+)?(?:agent|assistant|bot|claw|system|model|ai)$/iu;
const REQUIRED_PROHIBITED_ACTIONS = Object.freeze([
  "create-or-change-purchase-order",
  "change-forecast-of-record",
  "contact-supplier",
  "allocate-scarce-supply",
  "grant-quality-waiver",
  "commit-expedite",
  "make-payment",
  "make-sourcing-decision",
]);

function finding(code, path, message) {
  return { code, path, message };
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeSupplierCapacityEvidenceDigest(subjectType, payload) {
  return `sha256:${createHash("sha256")
    .update(canonicalJson({ subjectType, payload }))
    .digest("hex")}`;
}

export function computeSupplierCapacityBucketDigest(bucket) {
  return computeSupplierCapacityEvidenceDigest("time-bucket", {
    id: bucket?.id,
    start: bucket?.start,
    end: bucket?.end,
  });
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function equal(left, right) {
  return finite(left) && finite(right) && Math.abs(left - right) <= 1e-9;
}

function timestamp(value) {
  if (typeof value !== "string" || value.trim().length === 0) return NaN;
  return Date.parse(value);
}

function recordList(value, path, label, findings) {
  if (!Array.isArray(value)) {
    findings.push(finding("invalid_record_list", path, `${label} must be an array.`));
    return [];
  }
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      findings.push(
        finding("invalid_array_record", `${path}[${index}]`, `${label} entries must be objects.`),
      );
      return [];
    }
    return [{ item, index }];
  });
}

function indexRecords(entries, path, label, findings) {
  const byId = new Map();
  for (const { item, index } of entries) {
    if (typeof item.id !== "string" || item.id.trim().length === 0) {
      findings.push(
        finding("invalid_identity", `${path}[${index}].id`, `${label} must have a stable id.`),
      );
    } else if (byId.has(item.id)) {
      findings.push(
        finding("duplicate_identity", `${path}[${index}].id`, `${label} id ${item.id} is duplicated.`),
      );
    } else {
      byId.set(item.id, item);
    }
  }
  return byId;
}

function references(value, known, path, label, findings) {
  if (!Array.isArray(value)) {
    findings.push(finding("invalid_reference_list", path, `${label} references must be an array.`));
    return [];
  }
  const seen = new Set();
  for (const [index, ref] of value.entries()) {
    if (typeof ref !== "string" || !known.has(ref)) {
      findings.push(
        finding("dangling_reference", `${path}[${index}]`, `${label} reference does not resolve.`),
      );
    }
    if (seen.has(ref)) {
      findings.push(
        finding("duplicate_reference", `${path}[${index}]`, `${label} reference is duplicated.`),
      );
    }
    seen.add(ref);
  }
  return value.filter((ref) => typeof ref === "string" && known.has(ref));
}

function sameSet(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((item) => right.includes(item))
  );
}

function identityMatches(record, expected) {
  return (
    record &&
    Object.entries(expected).every(([field, value]) => record[field] === value)
  );
}

function validOwner(ownerRef, principals, value) {
  const owner = principals.get(ownerRef);
  return (
    owner &&
    owner.kind === "human" &&
    typeof owner.name === "string" &&
    owner.name.trim().length > 0 &&
    !AGENT_PATTERN.test(owner.name.trim()) &&
    !ROLE_PATTERN.test(owner.name)
  );
}

export function supplierCapacityAssuranceFindings(value) {
  const findings = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [finding("invalid_artifact", "", "Supplier capacity assurance must be an object.")];
  }

  const collections = {};
  for (const [field, label] of [
    ["principals", "Principal"],
    ["suppliers", "Supplier"],
    ["sites", "Site"],
    ["parts", "Part"],
    ["timeBuckets", "Time bucket"],
    ["demand", "Demand"],
    ["commits", "Supplier commit"],
    ["capacity", "Capacity"],
    ["inventorySnapshots", "Inventory snapshot"],
    ["qualityDispositions", "Quality disposition"],
    ["shipments", "Shipment"],
    ["receipts", "Receipt"],
    ["logisticsConstraints", "Logistics constraint"],
    ["allocationPolicies", "Allocation policy"],
    ["evidence", "Evidence"],
    ["supplyPositions", "Supply position"],
    ["reconciliations", "Reconciliation"],
    ["allocationProposals", "Allocation proposal"],
    ["recoveryActions", "Recovery action"],
    ["reviewCheckpoints", "Review checkpoint"],
  ]) {
    const entries = recordList(value[field], field, label, findings);
    collections[field] = {
      entries,
      items: entries.map(({ item }) => item),
      byId: indexRecords(entries, field, label, findings),
    };
  }

  const asOf = timestamp(value.asOf);
  if (!Number.isFinite(asOf)) {
    findings.push(finding("invalid_as_of", "asOf", "The artifact as-of timestamp must be parseable."));
  }

  const plan = value.plan && typeof value.plan === "object" ? value.plan : {};
  const handoff = value.handoff && typeof value.handoff === "object" ? value.handoff : {};
  const evidenceById = collections.evidence.byId;
  const planRevision = plan.revision;
  const subjectCollections = new Map([
    ["demand", collections.demand.byId],
    ["commit", collections.commits.byId],
    ["capacity", collections.capacity.byId],
    ["inventory", collections.inventorySnapshots.byId],
    ["quality-disposition", collections.qualityDispositions.byId],
    ["shipment", collections.shipments.byId],
    ["receipt", collections.receipts.byId],
    ["logistics-constraint", collections.logisticsConstraints.byId],
    ["allocation-policy", collections.allocationPolicies.byId],
    ["recovery-action", collections.recoveryActions.byId],
  ]);

  function subjectRecord(subjectType, subjectRef) {
    if (subjectType === "plan") {
      return plan.id === subjectRef ? plan : undefined;
    }
    return subjectCollections.get(subjectType)?.get(subjectRef);
  }

  const validEvidenceIds = new Set();
  for (const { item: evidence, index } of collections.evidence.entries) {
    const subject = subjectRecord(evidence.subjectType, evidence.subjectRef);
    const observedAt = timestamp(evidence.observedAt);
    const sourceDigest =
      typeof evidence.sourceRef === "string"
        ? /\?sha256=([a-f0-9]{64})$/u.exec(evidence.sourceRef)?.[1]
        : undefined;
    const validSource =
      typeof sourceDigest === "string" &&
      evidence.payloadDigest === `sha256:${sourceDigest}`;
    const validTime = Number.isFinite(observedAt) && Number.isFinite(asOf) && observedAt <= asOf;
    const expectedDigest = subject
      ? computeSupplierCapacityEvidenceDigest(evidence.subjectType, subject)
      : null;
    if (!subject) {
      findings.push(
        finding(
          "dangling_evidence_subject",
          `evidence[${index}].subjectRef`,
          "Evidence must resolve to its exact typed subject record.",
        ),
      );
    }
    if (!validSource || !validTime) {
      findings.push(
        finding(
          "invalid_evidence_provenance",
          `evidence[${index}]`,
          "Evidence must have a controlled source and an observation time no later than trusted asOf.",
        ),
      );
    }
    if (typeof sourceDigest !== "string" || evidence.payloadDigest !== `sha256:${sourceDigest}`) {
      findings.push(
        finding(
          "source_payload_digest_mismatch",
          `evidence[${index}].sourceRef`,
          "The controlled source reference must carry the exact canonical payload SHA-256.",
        ),
      );
    }
    if (evidence.payloadDigest !== expectedDigest) {
      findings.push(
        finding(
          "evidence_payload_digest_mismatch",
          `evidence[${index}].payloadDigest`,
          "Evidence must seal the canonical full payload of its exact typed subject.",
        ),
      );
    }
    if (subject && validSource && validTime && evidence.payloadDigest === expectedDigest) {
      validEvidenceIds.add(evidence.id);
    }
  }

  function grounded(evidenceRef, subjectType, subjectRef, path) {
    const evidence = evidenceById.get(evidenceRef);
    const valid =
      evidence?.subjectType === subjectType &&
      evidence?.subjectRef === subjectRef &&
      validEvidenceIds.has(evidenceRef);
    if (!valid) {
      findings.push(
        finding(
          "invalid_grounding_evidence",
          path,
          `Evidence must be controlled, current as of the artifact, and bound to ${subjectType} ${subjectRef}.`,
        ),
      );
    }
    return valid;
  }

  if (
    plan.status !== "approved" ||
    typeof plan.id !== "string" ||
    typeof planRevision !== "string" ||
    planRevision.trim().length === 0
  ) {
    findings.push(
      finding(
        "unapproved_demand_revision",
        "plan",
        "Reconciliation requires one exact approved demand-plan revision.",
      ),
    );
  }
  if (!validOwner(plan.ownerRef, collections.principals.byId, value)) {
    findings.push(
      finding("agent_owned_authority", "plan.ownerRef", "The demand plan needs a named human owner."),
    );
  }
  grounded(plan.evidenceRef, "plan", plan.id, "plan.evidenceRef");
  const approvedAt = timestamp(plan.approvedAt);
  const horizonStart = timestamp(`${plan.horizonStart}T00:00:00Z`);
  const horizonEnd = timestamp(`${plan.horizonEnd}T23:59:59Z`);
  if (
    !Number.isFinite(approvedAt) ||
    !Number.isFinite(asOf) ||
    approvedAt > asOf
  ) {
    findings.push(
      finding(
        "invalid_plan_approval_chronology",
        "plan.approvedAt",
        "The exact demand-plan revision must be approved no later than trusted asOf.",
      ),
    );
  }
  if (
    !Number.isFinite(horizonStart) ||
    !Number.isFinite(horizonEnd) ||
    horizonStart > horizonEnd
  ) {
    findings.push(
      finding(
        "invalid_plan_horizon",
        "plan.horizonStart",
        "The approved planning horizon must have ordered start and end boundaries.",
      ),
    );
  }

  for (const { item: bucket, index } of collections.timeBuckets.entries) {
    const bucketStart = timestamp(`${bucket.start}T00:00:00Z`);
    const bucketEnd = timestamp(`${bucket.end}T23:59:59Z`);
    if (
      !Number.isFinite(bucketStart) ||
      !Number.isFinite(bucketEnd) ||
      bucketStart > bucketEnd ||
      bucketStart < horizonStart ||
      bucketEnd > horizonEnd
    ) {
      findings.push(
        finding(
          "invalid_bucket_horizon",
          `timeBuckets[${index}]`,
          "Every ordered time bucket must be completely contained in the approved plan horizon.",
        ),
      );
    }
  }
  for (const field of [
    "demand",
    "commits",
    "capacity",
    "inventorySnapshots",
    "shipments",
    "receipts",
    "logisticsConstraints",
    "allocationPolicies",
    "supplyPositions",
    "reconciliations",
  ]) {
    for (const { item, index } of collections[field].entries) {
      const bucket = collections.timeBuckets.byId.get(item.bucketRef);
      if (!bucket || item.bucketDigest !== computeSupplierCapacityBucketDigest(bucket)) {
        findings.push(
          finding(
            "bucket_digest_mismatch",
            `${field}[${index}].bucketDigest`,
            "Every time-bucket reference must carry the canonical digest of the exact immutable calendar bucket.",
          ),
        );
      }
    }
  }

  for (const { item: site, index } of collections.sites.entries) {
    if (!collections.suppliers.byId.has(site.supplierRef)) {
      findings.push(
        finding("dangling_reference", `sites[${index}].supplierRef`, "Site supplier does not resolve."),
      );
    }
    references(
      site.qualifiedPartRefs,
      collections.parts.byId,
      `sites[${index}].qualifiedPartRefs`,
      "Qualified part",
      findings,
    );
  }

  const entityEvidence = [
    ["demand", "demand"],
    ["commits", "commit"],
    ["capacity", "capacity"],
    ["inventorySnapshots", "inventory"],
    ["qualityDispositions", "quality-disposition"],
    ["shipments", "shipment"],
    ["receipts", "receipt"],
    ["logisticsConstraints", "logistics-constraint"],
    ["allocationPolicies", "allocation-policy"],
  ];
  for (const [field, subjectType] of entityEvidence) {
    for (const { item, index } of collections[field].entries) {
      grounded(item.evidenceRef, subjectType, item.id, `${field}[${index}].evidenceRef`);
    }
  }

  const partIds = collections.parts.byId;
  const bucketIds = collections.timeBuckets.byId;
  const supplierIds = collections.suppliers.byId;
  const siteIds = collections.sites.byId;
  for (const { item: item, index } of [
    ...collections.commits.entries,
    ...collections.capacity.entries,
    ...collections.inventorySnapshots.entries,
    ...collections.qualityDispositions.entries,
    ...collections.shipments.entries,
    ...collections.receipts.entries,
    ...collections.logisticsConstraints.entries,
  ]) {
    if (!supplierIds.has(item.supplierRef) || !siteIds.has(item.siteRef) || !partIds.has(item.partRef)) {
      findings.push(
        finding(
          "dangling_identity",
          `supplyEvidence[${index}]`,
          "Supplier, site, and part identities must all resolve.",
        ),
      );
    }
    const site = siteIds.get(item.siteRef);
    if (site && site.supplierRef !== item.supplierRef) {
      findings.push(
        finding(
          "inconsistent_supplier_site",
          `supplyEvidence[${index}].siteRef`,
          "A site must belong to the same supplier named by the evidence record.",
        ),
      );
    }
    if (item.bucketRef !== undefined && !bucketIds.has(item.bucketRef)) {
      findings.push(
        finding("dangling_reference", `supplyEvidence[${index}].bucketRef`, "Time bucket does not resolve."),
      );
    }
  }

  for (const { item: demand, index } of collections.demand.entries) {
    if (
      demand.planRef !== plan.id ||
      demand.planRevision !== planRevision ||
      !partIds.has(demand.partRef) ||
      !bucketIds.has(demand.bucketRef)
    ) {
      findings.push(
        finding(
          "demand_revision_or_identity_mismatch",
          `demand[${index}]`,
          "Demand must bind to the exact approved plan revision, part, and time bucket.",
        ),
      );
    }
  }

  for (const { item: disposition, index } of collections.qualityDispositions.entries) {
    if (!validOwner(disposition.decidedByRef, collections.principals.byId, value)) {
      findings.push(
        finding(
          "unqualified_quality_authority",
          `qualityDispositions[${index}].decidedByRef`,
          "Quality disposition evidence requires a named human decision owner.",
        ),
      );
    }
    if (timestamp(disposition.decidedAt) > asOf) {
      findings.push(
        finding(
          "future_quality_disposition",
          `qualityDispositions[${index}].decidedAt`,
          "A future quality disposition cannot qualify current supply.",
        ),
      );
    }
  }

  for (const { item: inventory, index } of collections.inventorySnapshots.entries) {
    const snapshotAt = timestamp(inventory.asOf);
    const cutoffAt = timestamp(inventory.transactionCutoffAt);
    if (
      !Number.isFinite(snapshotAt) ||
      !Number.isFinite(cutoffAt) ||
      cutoffAt > snapshotAt ||
      snapshotAt > asOf
    ) {
      findings.push(
        finding(
          "invalid_inventory_cutoff",
          `inventorySnapshots[${index}].transactionCutoffAt`,
          "Inventory must declare an ordered transaction cutoff no later than its snapshot and trusted asOf.",
        ),
      );
    }
  }

  for (const { item: shipment, index } of collections.shipments.entries) {
    const departedAt = timestamp(shipment.departedAt);
    const deliveredAt = timestamp(shipment.deliveredAt);
    const eta = timestamp(shipment.eta);
    const shipmentEvidenceAt = timestamp(evidenceById.get(shipment.evidenceRef)?.observedAt);
    const planned =
      shipment.status === "planned" &&
      shipment.departedAt === null &&
      shipment.deliveredAt === null &&
      shipment.receiptRef === null;
    const inTransit =
      shipment.status === "in-transit" &&
      Number.isFinite(departedAt) &&
      departedAt <= asOf &&
      shipment.deliveredAt === null &&
      shipment.receiptRef === null;
    const delivered =
      shipment.status === "delivered" &&
      Number.isFinite(departedAt) &&
      Number.isFinite(deliveredAt) &&
      departedAt <= deliveredAt &&
      deliveredAt <= asOf &&
      shipmentEvidenceAt >= deliveredAt &&
      typeof shipment.receiptRef === "string";
    const cancelled =
      shipment.status === "cancelled" &&
      shipment.deliveredAt === null &&
      shipment.receiptRef === null;
    if (
      !Number.isFinite(eta) ||
      (Number.isFinite(departedAt) && departedAt > eta) ||
      !(planned || inTransit || delivered || cancelled)
    ) {
      findings.push(
        finding(
          "invalid_shipment_chronology",
          `shipments[${index}]`,
          "Shipment state, departure, ETA, delivery, receipt reference, evidence, and trusted asOf chronology must agree.",
        ),
      );
    }
  }

  for (const { item: receipt, index } of collections.receipts.entries) {
    const shipment = collections.shipments.byId.get(receipt.shipmentRef);
    const receivedAt = timestamp(receipt.receivedAt);
    const receiptEvidenceAt = timestamp(evidenceById.get(receipt.evidenceRef)?.observedAt);
    const bindingValid =
      identityMatches(shipment, {
        supplierRef: receipt.supplierRef,
        siteRef: receipt.siteRef,
        partRef: receipt.partRef,
        bucketRef: receipt.bucketRef,
      }) &&
      shipment?.receiptRef === receipt.id &&
      receipt.quantity <= (shipment?.quantity ?? -1);
    if (!bindingValid) {
      findings.push(
        finding(
          "invalid_shipment_receipt_binding",
          `receipts[${index}]`,
          "A receipt must bind to the same supplier, site, part, quantity, and reciprocal shipment reference.",
        ),
      );
    }
    if (
      !identityMatches(shipment, {
        supplierRef: receipt.supplierRef,
        siteRef: receipt.siteRef,
        partRef: receipt.partRef,
        bucketRef: receipt.bucketRef,
      }) ||
      shipment?.status !== "delivered" ||
      !Number.isFinite(receivedAt) ||
      receivedAt < timestamp(shipment?.deliveredAt) ||
      receivedAt > asOf ||
      receiptEvidenceAt < receivedAt
    ) {
      findings.push(
        finding(
          "invalid_shipment_receipt_chronology",
          `receipts[${index}]`,
          "A receipt must bind reciprocally to the same supplier, site, part, and quantity and follow delivery no later than trusted asOf and its evidence.",
        ),
      );
    }
  }

  const positionKeys = new Set();
  for (const { item: position, index } of collections.supplyPositions.entries) {
    const path = `supplyPositions[${index}]`;
    const identity = {
      supplierRef: position.supplierRef,
      siteRef: position.siteRef,
      partRef: position.partRef,
      bucketRef: position.bucketRef,
    };
    const key = Object.values(identity).join("\0");
    if (positionKeys.has(key)) {
      findings.push(
        finding("duplicate_supply_position", path, "Only one supply position may own an identity tuple."),
      );
    }
    positionKeys.add(key);

    const commit = collections.commits.byId.get(position.commitRef);
    const capacity = collections.capacity.byId.get(position.capacityRef);
    const inventory = collections.inventorySnapshots.byId.get(position.inventorySnapshotRef);
    const logistics = collections.logisticsConstraints.byId.get(position.logisticsConstraintRef);
    const site = siteIds.get(position.siteRef);
    if (
      !identityMatches(commit, identity) ||
      !identityMatches(capacity, identity) ||
      !identityMatches(logistics, identity) ||
      !identityMatches(inventory, {
        supplierRef: position.supplierRef,
        siteRef: position.siteRef,
        partRef: position.partRef,
        bucketRef: position.bucketRef,
      })
    ) {
      findings.push(
        finding(
          "cross_identity_supply_evidence",
          path,
          "Commit, capacity, inventory, and logistics records must match the supply position's supplier, site, part, and time bucket.",
        ),
      );
    }

    const bucket = bucketIds.get(position.bucketRef);
    const qualified =
      capacity?.qualified === true &&
      site?.qualifiedPartRefs?.includes(position.partRef) &&
      timestamp(`${capacity?.validThrough}T23:59:59Z`) >= timestamp(`${bucket?.end}T23:59:59Z`);
    if (!qualified) {
      findings.push(
        finding(
          "unqualified_capacity",
          `${path}.capacityRef`,
          "Capacity must be qualified for the same site and part through the end of the time bucket.",
        ),
      );
    }

    const leadReadyAt =
      timestamp(commit?.committedAt) + (finite(logistics?.leadTimeDays) ? logistics.leadTimeDays : NaN) * 86_400_000;
    const bucketEnd = timestamp(`${bucket?.end}T23:59:59Z`);
    const leadTimeFeasible =
      Number.isFinite(leadReadyAt) && Number.isFinite(bucketEnd) && leadReadyAt <= bucketEnd;
    if (!leadTimeFeasible) {
      findings.push(
        finding(
          "lead_time_infeasible",
          `${path}.commitRef`,
          "The supplier commit cannot become available inside the bound time bucket at the declared lead time.",
        ),
      );
    }

    const capacityAfterYield =
      qualified && finite(capacity?.quantity) && finite(capacity?.yieldRate)
        ? Math.floor(capacity.quantity * capacity.yieldRate)
        : 0;
    const expectedCommit =
      leadTimeFeasible && finite(commit?.quantity) && finite(logistics?.maxReceivableQuantity)
        ? logistics.status === "blocked"
          ? 0
          : logistics.status === "constrained"
            ? Math.min(commit.quantity, capacityAfterYield, logistics.maxReceivableQuantity)
            : logistics.status === "clear"
              ? Math.min(commit.quantity, capacityAfterYield, logistics.maxReceivableQuantity)
              : 0
        : 0;

    const disposition = collections.qualityDispositions.byId.get(inventory?.qualityDispositionRef);
    const inventoryFresh =
      Number.isFinite(timestamp(inventory?.asOf)) &&
      Number.isFinite(timestamp(inventory?.transactionCutoffAt)) &&
      Number.isFinite(asOf) &&
      asOf - timestamp(inventory.asOf) <= plan.inventoryMaxAgeDays * 86_400_000 &&
      timestamp(inventory.transactionCutoffAt) <= timestamp(inventory.asOf) &&
      timestamp(inventory.asOf) <= asOf;
    if (!inventoryFresh) {
      findings.push(
        finding(
          "stale_inventory_snapshot",
          `${path}.inventorySnapshotRef`,
          "Inventory snapshots outside the approved freshness window contribute no supply.",
        ),
      );
    }
    const dispositionMatches = identityMatches(disposition, {
      supplierRef: position.supplierRef,
      siteRef: position.siteRef,
      partRef: position.partRef,
    });
    if (!dispositionMatches || disposition?.heldQuantity > inventory?.quantity) {
      findings.push(
        finding(
          "invalid_quality_disposition_binding",
          `${path}.inventorySnapshotRef`,
          "Inventory needs a matching quality disposition whose held quantity does not exceed the snapshot.",
        ),
      );
    }
    const expectedInventory =
      inventoryFresh &&
      dispositionMatches &&
      inventory?.status === "usable" &&
      ["released", "partial-hold"].includes(disposition?.status)
        ? Math.max(0, inventory.quantity - disposition.heldQuantity)
        : 0;

    const shipmentRefs = references(
      position.shipmentRefs,
      collections.shipments.byId,
      `${path}.shipmentRefs`,
      "Shipment",
      findings,
    );
    let expectedReceipts = 0;
    for (const shipmentRef of shipmentRefs) {
      const shipment = collections.shipments.byId.get(shipmentRef);
      if (!identityMatches(shipment, identity)) {
        findings.push(
          finding(
            "cross_identity_shipment",
            `${path}.shipmentRefs`,
            "Every shipment must match the supply position identity.",
          ),
        );
        continue;
      }
      const receipt = collections.receipts.byId.get(shipment.receiptRef);
      if (
        shipment.status === "delivered" &&
        receipt?.status === "accepted" &&
        identityMatches(receipt, {
          supplierRef: position.supplierRef,
          siteRef: position.siteRef,
          partRef: position.partRef,
          bucketRef: position.bucketRef,
        }) &&
        timestamp(receipt.receivedAt) <= bucketEnd &&
        timestamp(receipt.receivedAt) <= asOf &&
        timestamp(receipt.receivedAt) > timestamp(inventory?.transactionCutoffAt)
      ) {
        expectedReceipts += receipt.quantity;
      }
    }

    const expectedSupply = expectedCommit + expectedInventory + expectedReceipts;
    for (const [field, expected, code] of [
      ["eligibleCommitQuantity", expectedCommit, "invalid_eligible_commit"],
      ["eligibleInventoryQuantity", expectedInventory, "invalid_eligible_inventory"],
      ["eligibleReceiptQuantity", expectedReceipts, "invalid_eligible_receipts"],
      ["eligibleSupplyQuantity", expectedSupply, "invalid_eligible_supply"],
    ]) {
      if (!equal(position[field], expected)) {
        findings.push(
          finding(code, `${path}.${field}`, `${field} must equal ${expected} from eligible evidence.`),
        );
      }
    }
  }

  const demandPartitionCounts = new Map(
    collections.demand.items.map((item) => [item.id, 0]),
  );
  const reconciliationScopeKeys = new Set();
  for (const { item: reconciliation, index } of collections.reconciliations.entries) {
    const path = `reconciliations[${index}]`;
    if (reconciliation.planRef !== plan.id || reconciliation.planRevision !== planRevision) {
      findings.push(
        finding(
          "reconciliation_revision_mismatch",
          path,
          "Reconciliation must bind to the exact approved demand-plan revision.",
        ),
      );
    }
    const demandRefs = references(
      reconciliation.demandRefs,
      collections.demand.byId,
      `${path}.demandRefs`,
      "Demand",
      findings,
    );
    for (const demandRef of demandRefs) {
      demandPartitionCounts.set(
        demandRef,
        (demandPartitionCounts.get(demandRef) ?? 0) + 1,
      );
    }
    const expectedDemandRefs = collections.demand.items
      .filter(
        (item) =>
          item.planRef === plan.id &&
          item.planRevision === planRevision &&
          item.partRef === reconciliation.partRef &&
          item.bucketRef === reconciliation.bucketRef,
      )
      .map((item) => item.id);
    const scopeKey = `${reconciliation.partRef}\0${reconciliation.bucketRef}`;
    if (
      reconciliationScopeKeys.has(scopeKey) ||
      !sameSet(demandRefs, expectedDemandRefs)
    ) {
      findings.push(
        finding(
          "incomplete_demand_partition",
          `${path}.demandRefs`,
          "Each plan-revision, part, and bucket scope must have exactly one reconciliation containing every approved demand line exactly once.",
        ),
      );
    }
    reconciliationScopeKeys.add(scopeKey);
    const supplyRefs = references(
      reconciliation.supplyPositionRefs,
      collections.supplyPositions.byId,
      `${path}.supplyPositionRefs`,
      "Supply position",
      findings,
    );
    const scopedDemand = demandRefs.map((ref) => collections.demand.byId.get(ref));
    const scopedSupply = supplyRefs.map((ref) => collections.supplyPositions.byId.get(ref));
    if (
      [...scopedDemand, ...scopedSupply].some(
        (item) =>
          item?.partRef !== reconciliation.partRef ||
          item?.bucketRef !== reconciliation.bucketRef,
      )
    ) {
      findings.push(
        finding(
          "cross_identity_reconciliation",
          path,
          "All demand and supply references must share the reconciliation part and time bucket.",
        ),
      );
    }
    const approvedDemand = scopedDemand.reduce((sum, item) => sum + (item?.quantity ?? 0), 0);
    const eligibleSupply = scopedSupply.reduce(
      (sum, item) => sum + (item?.eligibleSupplyQuantity ?? 0),
      0,
    );
    const allocated = Math.min(approvedDemand, eligibleSupply);
    const shortage = Math.max(0, approvedDemand - allocated);
    for (const [field, expected] of [
      ["approvedDemandQuantity", approvedDemand],
      ["eligibleSupplyQuantity", eligibleSupply],
      ["allocatedQuantity", allocated],
      ["shortageQuantity", shortage],
    ]) {
      if (!equal(reconciliation[field], expected)) {
        findings.push(
          finding(
            "inconsistent_reconciliation_arithmetic",
            `${path}.${field}`,
            `${field} must equal ${expected}.`,
          ),
        );
      }
    }
  }
  for (const [demandRef, count] of demandPartitionCounts) {
    if (count !== 1) {
      findings.push(
        finding(
          "incomplete_demand_partition",
          "reconciliations",
          `Approved demand ${demandRef} must occur in exactly one reconciliation; found ${count}.`,
        ),
      );
    }
  }

  for (const { item: policy, index } of collections.allocationPolicies.entries) {
    if (
      policy.planRef !== plan.id ||
      policy.planRevision !== planRevision ||
      !partIds.has(policy.partRef) ||
      !bucketIds.has(policy.bucketRef) ||
      policy.rule !== "priority-ascending" ||
      timestamp(policy.effectiveAt) > asOf ||
      !validOwner(policy.ownerRef, collections.principals.byId, value)
    ) {
      findings.push(
        finding(
          "invalid_allocation_policy",
          `allocationPolicies[${index}]`,
          "Allocation policy must be owner-controlled, effective by trusted asOf, and bound to the exact plan revision, part, bucket, and supported deterministic rule.",
        ),
      );
    }
  }

  for (const { item: proposal, index } of collections.allocationProposals.entries) {
    const path = `allocationProposals[${index}]`;
    const reconciliation = collections.reconciliations.byId.get(proposal.reconciliationRef);
    if (!reconciliation) {
      findings.push(
        finding("dangling_reference", `${path}.reconciliationRef`, "Reconciliation does not resolve."),
      );
      continue;
    }
    const policy = collections.allocationPolicies.byId.get(proposal.policyRef);
    if (
      !policy ||
      policy.planRef !== reconciliation.planRef ||
      policy.planRevision !== reconciliation.planRevision ||
      policy.partRef !== reconciliation.partRef ||
      policy.bucketRef !== reconciliation.bucketRef
    ) {
      findings.push(
        finding(
          "invalid_allocation_policy",
          `${path}.policyRef`,
          "The proposal must use a structured policy for the exact reconciled plan revision, part, and bucket.",
        ),
      );
    }
    if (proposal.state !== "proposed" || proposal.approvedByRef !== null || proposal.approvedAt !== null) {
      findings.push(
        finding(
          "unauthorized_allocation_state",
          path,
          "Scarce-supply allocation must remain an unapproved proposal.",
        ),
      );
    }
    const allocations = recordList(proposal.allocations, `${path}.allocations`, "Allocation", findings);
    const seenDemand = new Set();
    let allocatedTotal = 0;
    let shortageTotal = 0;
    let remaining = reconciliation.allocatedQuantity;
    const expectedAllocationByDemand = new Map();
    const prioritizedDemand = reconciliation.demandRefs
      .map((ref) => collections.demand.byId.get(ref))
      .filter(Boolean)
      .toSorted((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
    const priorities = prioritizedDemand.map((item) => item.priority);
    if (new Set(priorities).size !== priorities.length) {
      findings.push(
        finding(
          "ambiguous_allocation_priority",
          `${path}.allocations`,
          "Priority-ascending allocation requires a unique priority for every demand line.",
        ),
      );
    }
    for (const demand of prioritizedDemand) {
      const allocated =
        policy?.allowPartial === false
          ? remaining >= demand.quantity
            ? demand.quantity
            : 0
          : Math.min(demand.quantity, Math.max(0, remaining));
      expectedAllocationByDemand.set(demand.id, allocated);
      remaining -= allocated;
    }
    for (const { item: allocation, index: allocationIndex } of allocations) {
      const demand = collections.demand.byId.get(allocation.demandRef);
      if (!reconciliation.demandRefs?.includes(allocation.demandRef) || seenDemand.has(allocation.demandRef)) {
        findings.push(
          finding(
            "invalid_allocation_coverage",
            `${path}.allocations[${allocationIndex}].demandRef`,
            "Each reconciled demand line requires exactly one allocation.",
          ),
        );
      }
      seenDemand.add(allocation.demandRef);
      if (
        !demand ||
        !equal(allocation.allocatedQuantity + allocation.shortageQuantity, demand.quantity) ||
        !equal(allocation.allocatedQuantity, expectedAllocationByDemand.get(demand.id))
      ) {
        findings.push(
          finding(
            "allocation_policy_violation",
            `${path}.allocations[${allocationIndex}]`,
            "Allocation must reconcile to demand and follow the structured priority rule exactly.",
          ),
        );
      }
      allocatedTotal += allocation.allocatedQuantity ?? 0;
      shortageTotal += allocation.shortageQuantity ?? 0;
    }
    if (
      !sameSet([...seenDemand], reconciliation.demandRefs) ||
      !equal(allocatedTotal, reconciliation.allocatedQuantity) ||
      !equal(shortageTotal, reconciliation.shortageQuantity)
    ) {
      findings.push(
        finding(
          "incomplete_allocation_proposal",
          path,
          "The proposal must cover every demand line and reconcile exactly to allocated and shortage totals.",
        ),
      );
    }
  }

  for (const { item: action, index } of collections.recoveryActions.entries) {
    const path = `recoveryActions[${index}]`;
    if (!collections.reconciliations.byId.has(action.reconciliationRef)) {
      findings.push(
        finding("dangling_reference", `${path}.reconciliationRef`, "Reconciliation does not resolve."),
      );
    }
    if (!validOwner(action.ownerRef, collections.principals.byId, value)) {
      findings.push(
        finding("agent_owned_authority", `${path}.ownerRef`, "Recovery actions need a named human owner."),
      );
    }
    if (!["proposed", "blocked", "in-review"].includes(action.state)) {
      findings.push(
        finding(
          "unauthorized_recovery_state",
          `${path}.state`,
          "A recovery action cannot claim execution, commitment, or completion.",
        ),
      );
    }
    references(
      action.evidenceRefs,
      evidenceById,
      `${path}.evidenceRefs`,
      "Recovery evidence",
      findings,
    );
  }

  for (const { item: checkpoint, index } of collections.reviewCheckpoints.entries) {
    const path = `reviewCheckpoints[${index}]`;
    if (!validOwner(checkpoint.ownerRef, collections.principals.byId, value)) {
      findings.push(
        finding("agent_owned_authority", `${path}.ownerRef`, "Review checkpoints need a named human owner."),
      );
    }
    const actionRefs = references(
      checkpoint.actionRefs,
      collections.recoveryActions.byId,
      `${path}.actionRefs`,
      "Recovery action",
      findings,
    );
    const expectedActionRefs = collections.recoveryActions.items
      .filter((action) => action.checkpointRef === checkpoint.id)
      .map((action) => action.id);
    if (!sameSet(actionRefs, expectedActionRefs)) {
      findings.push(
        finding(
          "inconsistent_checkpoint_membership",
          `${path}.actionRefs`,
          "Each checkpoint must list exactly every action that points to it, with no omissions or extras.",
        ),
      );
    }
    for (const actionRef of actionRefs) {
      if (collections.recoveryActions.byId.get(actionRef)?.checkpointRef !== checkpoint.id) {
        findings.push(
          finding(
            "inconsistent_checkpoint_binding",
            `${path}.actionRefs`,
            "Checkpoint and recovery action references must be reciprocal.",
          ),
        );
      }
    }
  }
  for (const { item: action, index } of collections.recoveryActions.entries) {
    const checkpoint = collections.reviewCheckpoints.byId.get(action.checkpointRef);
    if (!checkpoint) {
      findings.push(
        finding(
          "dangling_reference",
          `recoveryActions[${index}].checkpointRef`,
          "Review checkpoint does not resolve.",
        ),
      );
    } else if (!Array.isArray(checkpoint.actionRefs) || !checkpoint.actionRefs.includes(action.id)) {
      findings.push(
        finding(
          "inconsistent_checkpoint_membership",
          `recoveryActions[${index}].checkpointRef`,
          "Every action-to-checkpoint reference must have one reciprocal checkpoint membership.",
        ),
      );
    }
  }

  const expectedHandoffRefs = [
    ["reconciliationRefs", collections.reconciliations.byId],
    ["allocationProposalRefs", collections.allocationProposals.byId],
    ["unresolvedActionRefs", collections.recoveryActions.byId],
    ["reviewCheckpointRefs", collections.reviewCheckpoints.byId],
  ];
  for (const [field, known] of expectedHandoffRefs) {
    const resolved = references(handoff[field], known, `handoff.${field}`, field, findings);
    if (!sameSet(resolved, [...known.keys()])) {
      findings.push(
        finding(
          "incomplete_handoff",
          `handoff.${field}`,
          `${field} must enumerate the complete corresponding ledger.`,
        ),
      );
    }
  }
  if (!validOwner(handoff.ownerRef, collections.principals.byId, value)) {
    findings.push(
      finding("agent_owned_authority", "handoff.ownerRef", "The handoff needs a named human owner."),
    );
  }
  if (!sameSet(handoff.prohibitedActions, REQUIRED_PROHIBITED_ACTIONS)) {
    findings.push(
      finding(
        "missing_authority_gate",
        "handoff.prohibitedActions",
        "The handoff must preserve every prohibited purchasing, planning, supplier, allocation, quality, expedite, payment, and sourcing action.",
      ),
    );
  }
  const narrativeTexts = [
    ...collections.evidence.items.map((item) => item.summary),
    ...collections.reconciliations.items.map((item) => item.explanation),
    ...collections.allocationProposals.items.flatMap((item) =>
      Array.isArray(item.allocations)
        ? item.allocations.map((allocation) => allocation?.rationale)
        : [],
    ),
    ...collections.recoveryActions.items.map((item) => item.description),
    ...collections.reviewCheckpoints.items.map((item) => item.decisionNeeded),
    handoff.summary,
  ].filter((text) => typeof text === "string");
  const prohibitedNarrative =
    /\b(?:contact(?:ed|s|ing)?\s+(?:the\s+)?supplier|allocat(?:e|ed|es|ing)\s+(?:the\s+)?(?:scarce\s+)?supply|approv(?:e|ed|es|ing)\s+(?:(?:a|the)\s+)?(?:purchase|allocation)|grant(?:ed|s|ing)?\s+(?:a\s+)?quality waiver|commit(?:ted|s|ting)?\s+(?:an\s+)?expedite|(?:make|made|issue[sd]?|chang(?:e|ed|es|ing))\s+(?:a\s+)?purchase order|chang(?:e|ed|es|ing)\s+(?:the\s+)?forecast|(?:pay|paid|pays|making payment)|(?:select|selected|source[sd]?)\s+(?:a\s+)?supplier|(?<=(?:supplier|suppliers) (?:was|were|has been|have been|had been) )contacted|(?<=(?:allocation|allocations) (?:was|were|has been|have been|had been) )approved|(?<=(?:waiver|waivers) (?:was|were|has been|have been|had been) )granted|(?<=(?:expedite|expedites) (?:was|were|has been|have been|had been) )committed|(?<=(?:payment|payments) (?:was|were|has been|have been|had been) )made|(?<=sourcing (?:was|has been|had been) )decided)\b/iu;
  if (
    typeof handoff.summary !== "string" ||
    hasUnnegatedNarrativeMatch(narrativeTexts, prohibitedNarrative)
  ) {
    findings.push(
      finding(
        "prohibited_authority_narrative",
        "narrative",
        "User-visible narrative cannot claim an external, transactional, allocation, waiver, expedite, payment, sourcing, or plan-change action.",
      ),
    );
  }
  if (
    handoff.state === "ready-for-owner-review" &&
    (findings.length > 0 ||
      collections.reconciliations.items.some((item) => item.shortageQuantity > 0) ||
      collections.recoveryActions.items.length > 0)
  ) {
    findings.push(
      finding(
        "premature_ready_state",
        "handoff.state",
        "A handoff with shortages, open recovery actions, or validation findings must remain blocked.",
      ),
    );
  }

  return findings;
}
