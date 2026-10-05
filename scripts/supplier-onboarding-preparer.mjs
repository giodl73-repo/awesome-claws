const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sameSet = (a, b) => same([...a].sort(), [...b].sort());

export function supplierOnboardingFindings(value) {
  const findings = [];
  const fail = (code, message) => findings.push({ code, path: "/", message });
  if (!value?.policy || !value.scope || !value.setup || !value.handoff ||
      !["identities", "requirements", "reviews", "coverage", "requests"].every((key) => Array.isArray(value[key]))) {
    fail("supplier_structure", "A complete private setup packet is required.");
    return findings;
  }
  const rows = [...value.identities, ...value.requirements, ...value.reviews, ...value.requests,
    value.policy, value.scope, ...(value.selection ? [value.selection] : []),
    ...(value.entityDecision ? [value.entityDecision] : [])];
  if (new Set(rows.map((r) => r.id)).size !== rows.length) {
    fail("supplier_duplicate", "Packet identities must be globally unique.");
  }
  const requirementIds = value.requirements.map((r) => r.id);
  if (!same(value.coverage.map((r) => r.requirementId), requirementIds)) {
    fail("supplier_coverage", "Represent every supplied checklist item exactly once in policy order.");
  }
  const names = [...new Set(value.identities.map((r) => r.legalEntity))];
  const decision = value.entityDecision;
  const decisionValid = decision &&
    sameSet(decision.identityRefs, value.identities.map((r) => r.id)) &&
    decision.decidedBy === value.owner &&
    decision.scopeRevision === value.scope.revision && Date.parse(decision.decidedAt) <= Date.parse(value.asOf);
  if (decision && !decisionValid) fail("supplier_entity_decision", "Entity resolution must cover every conflicting record and the current scope without a future decision.");
  const entityState = decisionValid ? "resolved-by-owner" : names.length === 1 ? "consistent" : "unresolved";
  const entity = decisionValid ? decision.legalEntity : names.length === 1 ? names[0] : null;
  if (value.setup.entityState !== entityState || value.setup.legalEntity !== entity) {
    fail("supplier_entity_conflict", "Preserve entity conflicts; only a supplied scoped resolution may select a different legal name.");
  }
  if (value.setup.service !== value.scope.description || value.setup.personalData !== value.scope.personalData) {
    fail("supplier_scope", "Setup fields must preserve the exact current service and personal-data scope.");
  }
  if (value.selection && (value.selection.supplier !== value.supplier || value.selection.buyingEntity !== value.buyingEntity)) {
    fail("supplier_selection", "The supplied selection must identify this supplier and buying entity.");
  }
  const currentReview = (review, requirement) => entity !== null &&
    review.supplier === value.supplier && review.buyingEntity === value.buyingEntity && review.legalEntity === entity &&
    review.scopeRevision === value.scope.revision && review.policyRevision === value.policy.revision &&
    review.reviewer === requirement.owner && Date.parse(review.decidedAt) <= Date.parse(value.asOf) &&
    Date.parse(review.validUntil) >= Date.parse(value.asOf) && Date.parse(review.validUntil) >= Date.parse(review.decidedAt);
  for (const review of value.reviews) {
    const requirement = value.requirements.find((r) => r.id === review.requirementId);
    if (!requirement || ![requirement.kind, "not-applicable"].includes(review.kind)) {
      fail("supplier_review_target", "Every supplied specialist receipt must belong to its exact checklist item and review kind.");
    }
    if (Date.parse(review.decidedAt) > Date.parse(value.asOf) || Date.parse(review.validUntil) < Date.parse(review.decidedAt)) {
      fail("supplier_review_time", "A receipt cannot be future-dated or expire before its decision.");
    }
  }
  const blockers = [];
  for (const requirement of value.requirements) {
    const row = value.coverage.find((r) => r.requirementId === requirement.id);
    if (!row) continue;
    let expected;
    let expectedRefs;
    const reviews = value.reviews.filter((r) => r.requirementId === requirement.id);
    if (requirement.applicability === "owner-not-applicable") {
      const current = reviews.filter((r) => currentReview(r, requirement));
      expected = current.length > 0 && current.every((r) => r.kind === "not-applicable" && r.result === "not-applicable")
        ? "not-applicable" : "gap";
      expectedRefs = reviews.map((r) => r.id);
    } else if (requirement.kind === "entity") {
      expected = entity === null ? "gap" : "satisfied";
      expectedRefs = [...value.identities.map((r) => r.id), ...(decision ? [decision.id] : [])];
    } else if (requirement.kind === "scope") {
      expected = "satisfied";
      expectedRefs = [value.scope.id];
    } else if (requirement.kind === "selection") {
      expected = value.selection ? "satisfied" : "gap";
      expectedRefs = value.selection ? [value.selection.id] : [];
    } else {
      const current = reviews.filter((r) => currentReview(r, requirement));
      expected = current.length > 0 && current.every((r) => r.kind === requirement.kind && r.result === "satisfied")
        ? "satisfied" : current.some((r) => r.result === "changes-needed") ? "gap"
          : reviews.some((r) => r.result === "satisfied") ? "reopened" : "gap";
      expectedRefs = reviews.map((r) => r.id);
    }
    if (row.state !== expected) fail("supplier_item_state", `${requirement.id} must remain ${expected} under the supplied evidence and exact scope.`);
    if (new Set(row.evidenceRefs).size !== row.evidenceRefs.length || !sameSet(row.evidenceRefs, expectedRefs)) {
      fail("supplier_evidence_coverage", "Preserve all applicable identity and review evidence; do not borrow a receipt or omit a contradictory one.");
    }
    if (["gap", "reopened"].includes(expected)) {
      blockers.push(requirement.id);
      const request = value.requests.find((r) => r.id === row.requestId);
      if (!request || request.requirementId !== requirement.id || request.owner !== requirement.owner || !request.question.trim()) {
        fail("supplier_request", "Each gap or reopened review requires a specific question for the checklist's accountable owner.");
      }
    } else if (row.requestId !== null) {
      fail("supplier_request", "Satisfied items must not retain a resolved missing-information request.");
    }
  }
  for (const request of value.requests) {
    if (!value.coverage.some((r) => r.requirementId === request.requirementId && r.requestId === request.id)) {
      fail("supplier_request", "Every request must be carried by its exact unresolved checklist item.");
    }
  }
  if (!same(value.handoff.blockingRequirementIds, blockers) || value.handoff.state !== (blockers.length ? "blocked" : "review-draft")) {
    fail("supplier_handoff", "Handoff must preserve all unresolved prerequisites without asserting activation readiness.");
  }
  if ([value.handoff.activation, value.handoff.paymentVerification, value.handoff.contact].some((s) => s !== "not-performed") ||
      value.handoff.specialistApproval !== "not-granted") {
    fail("supplier_authority", "Preparation cannot claim activation, payment verification, contact or specialist approval.");
  }
  const principals = [value.owner, value.recipient, value.policy.owner, value.selection?.selectedBy,
    decision?.decidedBy, ...value.requirements.map((r) => r.owner), ...value.reviews.map((r) => r.reviewer)].filter(Boolean);
  if (principals.some((p) => /^(?:the )?(?:agent|assistant|claw|ai|supplier onboarding preparer)$/iu.test(p.trim()))) {
    fail("supplier_owner", "Selection, resolution, review and activation ownership must remain human-owned.");
  }
  const text = JSON.stringify(value);
  if (/\b\d{3}-\d{2}-\d{4}\b|\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu.test(text)) {
    fail("supplier_sensitive_text", "Do not retain tax identifiers, bank account identifiers or personal contact addresses in the packet.");
  }
  return findings;
}

export function renderSupplierOnboarding(value) {
  const findings = supplierOnboardingFindings(value);
  if (findings.length) throw new Error(findings.map((f) => `${f.code}: ${f.message}`).join("\n"));
  const cell = (s) => String(s).replaceAll("|", "\\|").replaceAll(/\r?\n/gu, " ");
  const lines = ["# Supplier setup packet", "", "Private review draft. Not activated, verified for payment or sent.", "",
    `Supplier: ${value.supplier}. Buying entity: ${value.buyingEntity}. Packet: ${value.packetRevision}.`,
    `Policy: ${value.policy.revision} (${value.policy.reference}). As of: ${value.asOf}.`,
    `Owner: ${value.owner}. Private recipient: ${value.recipient}.`, "", "## Setup fields", "",
    `Legal entity: ${value.setup.legalEntity ?? "Unresolved; preserve the records below"} (${value.setup.entityState}).`,
    `Service: ${value.setup.service}. Scope revision: ${value.scope.revision} (${value.scope.reference}).`,
    `Personal data: ${value.setup.personalData ? "included" : "not included in supplied scope"}.`,
    `Selection: ${value.selection ? `supplied by ${value.selection.selectedBy} (${value.selection.reference})` : "not supplied"}; not activation authority.`,
    "", "## Entity records", "", "| Record | Kind | Legal entity | Revision | Reference |", "| --- | --- | --- | --- | --- |",
    ...value.identities.map((r) => `| ${cell(r.id)} | ${r.kind} | ${cell(r.legalEntity)} | ${cell(r.revision)} | ${cell(r.reference)} |`)];
  if (value.entityDecision) lines.push("", `Supplied resolution: ${value.entityDecision.legalEntity}, ${value.entityDecision.decidedBy}, ${value.entityDecision.decidedAt} (${value.entityDecision.reference}).`);
  lines.push("", "## Checklist and evidence", "", "| Item | Requirement | State | Evidence | Owner |", "| --- | --- | --- | --- | --- |");
  for (const r of value.requirements) {
    const row = value.coverage.find((c) => c.requirementId === r.id);
    lines.push(`| ${cell(r.id)} | ${cell(r.label)} | ${row.state} | ${row.evidenceRefs.map(cell).join(", ") || "Not supplied"} | ${cell(r.owner)} |`);
  }
  lines.push("", "## Supplied specialist receipts", "");
  for (const r of value.reviews) lines.push(`- ${r.id}: ${r.kind}, ${r.legalEntity}, scope ${r.scopeRevision}, policy ${r.policyRevision}; supplied result ${r.result}, ${r.reviewer}, ${r.decidedAt}, valid through ${r.validUntil}. Controlled reference: ${r.reference}. The checklist determines whether this scope is usable.`);
  if (!value.reviews.length) lines.push("No specialist receipts supplied.");
  lines.push("", "## Exact owner questions", "");
  for (const r of value.requests) lines.push(`### ${r.owner}: ${r.requirementId}`, "", r.question, "");
  if (!value.requests.length) lines.push("No unresolved checklist questions; final human review and activation remain separate.", "");
  lines.push("## Handoff", "", `State: ${value.handoff.state}. Unresolved prerequisites: ${value.handoff.blockingRequirementIds.join(", ") || "none in supplied checklist"}.`,
    "Preparation does not select or activate a supplier, authenticate payment details, accept risk, grant specialist approval, contact anyone or change an external system.",
    "Compare this minimized packet with the original permitted records. A controlled reference is supplied evidence, not an independently authenticated decision.");
  return `${lines.join("\n")}\n`;
}
