const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sameSet = (a, b) => same([...a].sort(), [...b].sort());
const latestValue = (rows, timeKey, valueKey) => {
  if (!rows.length) return null;
  const time = Math.max(...rows.map((r) => Date.parse(r[timeKey])));
  const values = [...new Set(rows.filter((r) => Date.parse(r[timeKey]) === time).map((r) => r[valueKey]))];
  return values.length === 1 ? values[0] : null;
};

export function documentControlFindings(value) {
  const findings = [];
  const fail = (code, message) => findings.push({ code, path: "/", message });
  if (!value?.policy || !value.handoff || !["requiredDocs", "revisions", "useReviews", "supersessions", "useDirections", "register", "workItems", "followUps", "transmittals", "authorizations"].every((k) => Array.isArray(value[k]))) {
    fail("document_structure", "A complete private document-control package is required.");
    return findings;
  }
  const ids = [value.requiredDocs, value.revisions, value.useReviews, value.supersessions, value.useDirections, value.workItems, value.transmittals, value.authorizations].flat().map((r) => r.id);
  if (new Set(ids).size !== ids.length) fail("document_duplicate", "Record identities must be globally unique.");
  const codes = new Set(value.policy.codes.map((c) => c.code));
  if (codes.size !== value.policy.codes.length) fail("document_duplicate", "Supplied status-code definitions must be unique.");
  const docs = new Map(value.requiredDocs.map((d) => [d.id, d]));
  const revisions = new Map(value.revisions.map((r) => [r.id, r]));
  const asOf = Date.parse(value.asOf);
  if (new Set(value.revisions.map((r) => JSON.stringify([r.documentId, r.label]))).size !== value.revisions.length) fail("document_duplicate", "Document and revision-label pairs must be unambiguous.");
  for (const r of value.revisions) {
    if (r.project !== value.project || !docs.has(r.documentId)) fail("document_scope", "Every receipt must belong to this project and required document universe.");
    if (Date.parse(r.receivedAt) > asOf) fail("document_chronology", "A receipt cannot postdate the package as-of time.");
  }
  for (const r of value.useReviews) {
    const revision = revisions.get(r.revisionRef);
    if (!revision || r.project !== value.project || r.documentId !== revision.documentId || r.reviewer !== value.engineeringOwner) fail("document_review_scope", "Use review must identify the exact project, document, revision and supplied engineering owner.");
    if (Date.parse(r.decidedAt) > asOf || (revision && Date.parse(r.decidedAt) < Date.parse(revision.receivedAt))) fail("document_chronology", "Use decisions must follow the referenced receipt and not be future-dated.");
  }
  for (const change of value.supersessions) {
    const from = revisions.get(change.fromRef);
    const to = revisions.get(change.toRef);
    if (!from || change.project !== value.project || change.owner !== value.engineeringOwner ||
        (change.effect === "withdrawn" ? change.toRef !== null : !to || to.documentId !== from.documentId || to.id === from.id)) {
      fail("document_supersession", "Supersession or withdrawal needs supplied engineering evidence for exact same-document revisions.");
    }
    if (Date.parse(change.decidedAt) > asOf || [from, to].filter(Boolean).some((r) => Date.parse(change.decidedAt) < Date.parse(r.receivedAt))) fail("document_chronology", "A supplied change must follow its referenced receipts and precede the package as-of time.");
  }
  for (const direction of value.useDirections) {
    const baseline = revisions.get(direction.baselineRef);
    const target = revisions.get(direction.revisionRef);
    if (!baseline || !target || direction.project !== value.project || baseline.documentId !== direction.documentId || target.documentId !== direction.documentId || direction.owner !== value.engineeringOwner) fail("document_direction_scope", "Continued-use direction must bind the same document, received baseline and exact target revision to its engineering owner.");
    if (Date.parse(direction.decidedAt) > asOf || [baseline, target].filter(Boolean).some((r) => Date.parse(direction.decidedAt) < Date.parse(r.receivedAt))) fail("document_chronology", "A direction cannot predate its baseline or reference future evidence.");
  }
  const removed = (revisionRef) => {
    const changes = value.supersessions.filter((s) => s.fromRef === revisionRef);
    return changes.length > 0 && latestValue(changes, "decidedAt", "effect") !== "continues";
  };
  const approved = (revisionRef, purpose, at = asOf) => latestValue(value.useReviews.filter((r) =>
    r.revisionRef === revisionRef && r.purpose === purpose && Date.parse(r.decidedAt) <= at), "decidedAt", "decision") === "approved";
  if (!same(value.register.map((r) => r.documentId), [...docs.keys()])) fail("document_register_coverage", "The register must cover every required document once, in required-package order.");
  const expectedUse = new Map();
  const unresolved = [];
  for (const doc of value.requiredDocs) {
    const received = value.revisions.filter((r) => r.documentId === doc.id);
    const latest = latestValue(received, "receivedAt", "id");
    const lastApproved = latestValue(value.useReviews.filter((r) => r.documentId === doc.id && r.purpose === value.intendedUse && r.decision === "approved"), "decidedAt", "revisionRef");
    const usable = (id) => {
      const r = revisions.get(id);
      return r && r.bytesSupplied && codes.has(r.statusCode) && !removed(id) && approved(id, value.intendedUse);
    };
    const directions = value.useDirections.filter((d) => d.documentId === doc.id && d.purpose === value.intendedUse && d.baselineRef === latest);
    const directed = [...new Set(directions.map((d) => d.revisionRef))];
    let current = latest && usable(latest) ? latest : null;
    if (directions.length) current = directed.length === 1 && directions.every((d) => usable(d.revisionRef) && approved(d.revisionRef, d.purpose, Date.parse(d.decidedAt))) ? directed[0] : null;
    if (directed.length > 1 || !latest || !codes.has(revisions.get(latest)?.statusCode)) current = null;
    const state = !received.length ? "missing" : current ? "usable" : "review-required";
    const unknown = [...new Set(received.filter((r) => !codes.has(r.statusCode)).map((r) => r.statusCode))];
    const row = value.register.find((r) => r.documentId === doc.id);
    if (!row || row.latestReceivedRef !== latest || row.lastApprovedRef !== lastApproved || row.currentUseRef !== current || row.state !== state || !same(row.unknownStatusCodes, unknown)) {
      fail("document_register_state", "Keep latest receipt, historical approval and current authorized-use evidence separate; do not order revision labels lexically.");
    }
    if (state !== "usable") {
      unresolved.push(doc.id);
      if (!row?.question?.trim()) fail("document_question", "Every missing, ambiguous or use-unresolved document needs an exact owner question.");
    } else if (row?.question !== null) fail("document_question", "Resolved register items must not retain a resolved question.");
    expectedUse.set(doc.id, current);
  }
  if (!same(value.followUps.map((f) => f.itemId), value.workItems.map((w) => w.id))) fail("document_followup_coverage", "Preserve every RFI and submittal once, including its original revision references.");
  for (const item of value.workItems) {
    if (item.revisionRefs.some((r) => !revisions.has(r))) fail("document_work_reference", "Every RFI or submittal reference must resolve to an exact supplied revision.");
    if (item.response && (!sameSet(item.response.revisionRefs, item.revisionRefs) || Date.parse(item.response.respondedAt) > asOf ||
        item.revisionRefs.some((id) => Date.parse(item.response.respondedAt) < Date.parse(revisions.get(id)?.receivedAt)))) fail("document_response", "A response must address the exact original revisions, follow their receipt and not be future-dated.");
    const state = item.response ? "answered" : item.deadline && Date.parse(item.deadline) < asOf ? "overdue" : "open";
    const follow = value.followUps.find((f) => f.itemId === item.id);
    if (follow?.state !== state || (state !== "answered" ? !follow?.question?.trim() : follow?.question !== null)) fail("document_followup_state", "Compute unanswered and overdue states from supplied response evidence and timezone-bearing deadlines.");
    if (state !== "answered") unresolved.push(item.id);
  }
  for (const auth of value.authorizations) {
    if (!value.transmittals.some((t) => t.id === auth.transmittalId) || auth.revisionRefs.some((r) => !revisions.has(r))) fail("document_authorization_reference", "Issue and recipient-access evidence must refer to a known transmittal and exact revisions.");
    if (Date.parse(auth.decidedAt) > asOf || Date.parse(auth.validUntil) < Date.parse(auth.decidedAt) ||
        auth.revisionRefs.some((id) => Date.parse(auth.decidedAt) < Date.parse(revisions.get(id)?.receivedAt))) fail("document_chronology", "Authorization evidence must follow referenced receipts, cannot be future-dated or expire before its decision.");
  }
  for (const draft of value.transmittals) {
    if (draft.project !== value.project) fail("document_scope", "Draft transmittal must belong to the current project.");
    const reasons = new Set();
    for (const id of draft.revisionRefs) {
      const revision = revisions.get(id);
      if (!revision) { reasons.add("unknown-revision"); continue; }
      if (!revision.bytesSupplied) reasons.add("missing-file");
      if (!codes.has(revision.statusCode)) reasons.add("unknown-status");
      if (removed(id) || (draft.purpose === "construction" && (value.intendedUse !== "construction" || expectedUse.get(revision.documentId) !== id))) reasons.add("use-unresolved");
    }
    for (const [kind, owner, reason] of [["recipient-access", value.accessOwner, "recipient-permission-missing"], ["issue", value.controller, "issue-authorization-missing"]]) {
      const authorized = value.authorizations.some((a) => a.kind === kind && a.project === value.project && a.transmittalId === draft.id &&
        a.transmittalRevision === draft.revision && a.recipient === draft.recipient && a.purpose === draft.purpose &&
        same(a.revisionRefs, draft.revisionRefs) && a.owner === owner && Date.parse(a.decidedAt) <= asOf && Date.parse(a.validUntil) >= asOf);
      if (!authorized) reasons.add(reason);
    }
    const state = reasons.size ? "held" : "ready-for-owner-issue";
    if (draft.state !== state || !sameSet(draft.holdReasons, [...reasons])) fail("document_transmittal_state", "Hold the exact draft for unresolved use, unavailable bytes, unknown status or missing scoped recipient/issue evidence.");
    if (state === "held") unresolved.push(draft.id);
  }
  if (!same(value.handoff.unresolvedRefs, unresolved)) fail("document_handoff", "Preserve every unresolved document, follow-up and held transmittal in the private handoff.");
  if (value.handoff.state !== "private-review-draft" || value.handoff.engineeringApproval !== "not-granted" ||
      [value.handoff.issued, value.handoff.edmsChanges, value.handoff.contacts].some((s) => s !== "not-performed")) fail("document_authority", "The preparer cannot claim engineering approval, document issue, distribution, EDMS changes or contact.");
  const principals = [value.controller, value.engineeringOwner, value.accessOwner, ...value.workItems.map((w) => w.owner)];
  if (principals.some((p) => /^(?:the )?(?:agent|assistant|claw|ai|project document controller)$/iu.test(p.trim()))) fail("document_owner", "Engineering, document control, access and follow-up decisions remain human-owned.");
  return findings;
}

export function renderDocumentControl(value) {
  const findings = documentControlFindings(value);
  if (findings.length) throw new Error(findings.map((f) => `${f.code}: ${f.message}`).join("\n"));
  const cell = (s) => String(s).replaceAll("|", "\\|").replaceAll(/\r?\n/gu, " ");
  const rev = (id) => {
    if (!id) return "None established";
    const r = value.revisions.find((item) => item.id === id);
    return r ? `${r.documentId} ${r.label} (${id})` : `${id} (revision not supplied)`;
  };
  const lines = ["# Project document control package", "", "Private review draft. No document issued or engineering approval granted.", "",
    `Project ${value.project}; package ${value.package}; register ${value.registerRevision}; as of ${value.asOf}.`,
    `Controller: ${value.controller}. Private recipient: ${value.recipient}. Register use: ${value.intendedUse}.`,
    "", "## Revision register", "", "| Document | Latest recorded receipt | Last explicit approval | Current use | State |", "| --- | --- | --- | --- | --- |"];
  for (const r of value.register) lines.push(`| ${cell(r.documentId)} | ${cell(rev(r.latestReceivedRef))} | ${cell(rev(r.lastApprovedRef))} | ${cell(rev(r.currentUseRef))} | ${r.state} |`);
  lines.push("", "## Source revision history", "");
  for (const r of value.revisions) lines.push(`- ${rev(r.id)}: received ${r.receivedAt}; supplied status ${r.statusCode}; ${r.bytesSupplied ? "file availability supplied" : "file bytes not supplied"}; reference ${r.fileRef}.`);
  lines.push("", `Status meanings supplied by ${value.policy.reference}:`, ...value.policy.codes.map((c) => `- ${c.code}: ${c.meaning}`), "", "## Review and change evidence", "");
  for (const r of value.useReviews) lines.push(`- ${r.id}: ${rev(r.revisionRef)}, ${r.purpose}, ${r.decision}; ${r.reviewer}, ${r.decidedAt} (${r.reference}). This is historical supplied evidence, not approval of another revision.`);
  for (const s of value.supersessions) lines.push(`- ${s.id}: ${rev(s.fromRef)} to ${rev(s.toRef)}, ${s.effect}; ${s.owner}, ${s.decidedAt} (${s.reference}).`);
  if (!value.supersessions.length) lines.push("No explicit supersession relationship supplied; receipt of a newer revision is not a use decision.");
  for (const d of value.useDirections) lines.push(`- ${d.id}: use ${rev(d.revisionRef)} for ${d.purpose} against baseline ${rev(d.baselineRef)}; ${d.owner}, ${d.decidedAt} (${d.reference}).`);
  lines.push("", "## Exact document questions", "");
  for (const r of value.register) {
    if (r.unknownStatusCodes.length) lines.push(`- ${r.documentId}: unknown status meanings: ${r.unknownStatusCodes.join(", ")}.`);
    if (r.question) lines.push(`- ${r.documentId}: ${r.question}`);
  }
  lines.push("", "## Submittal and RFI follow-ups", "");
  for (const w of value.workItems) {
    const f = value.followUps.find((r) => r.itemId === w.id);
    lines.push(`### ${w.id}: ${w.kind}`, "", `Original references: ${w.revisionRefs.map(rev).join(", ")}. Owner: ${w.owner}. Deadline: ${w.deadline ?? "not supplied"}. State: ${f.state}.`, "", f.question ?? `Supplied response ${w.response.reference}, ${w.response.respondedAt}: ${w.response.summary}`, "");
  }
  lines.push("## Draft transmittal manifest", "", "| Draft | Exact revisions | Purpose | Recipient | Disposition |", "| --- | --- | --- | --- | --- |");
  for (const t of value.transmittals) lines.push(`| ${cell(t.id)} ${cell(t.revision)} | ${cell(t.revisionRefs.map(rev).join(", "))} | ${t.purpose} | ${cell(t.recipient)} | ${t.state}: ${t.holdReasons.join(", ") || "human issue remains separate"} |`);
  lines.push("", "## Scoped authorization evidence", "");
  for (const a of value.authorizations) lines.push(`- ${a.id}: ${a.kind} for ${a.transmittalId} ${a.transmittalRevision}, ${a.recipient}, ${a.purpose}, ${a.revisionRefs.map(rev).join(", ")}; ${a.owner}, ${a.decidedAt}, valid until ${a.validUntil} (${a.reference}).`);
  if (!value.authorizations.length) lines.push("No recipient-access or exact-draft issue authorization supplied.");
  lines.push("", "## Private handoff", "", `Unresolved references: ${value.handoff.unresolvedRefs.join(", ") || "none in supplied scope"}.`,
    "Do not substitute another revision into a draft or transfer approval to it. Engineering use, recipient access and exact-draft issue authorization are separate owner decisions. No issue, distribution, source deletion, EDMS change or contact is performed.",
    "Reconcile this draft with original permitted project records and actual files. Metadata checks do not establish engineering adequacy or authenticate approval evidence.");
  return `${lines.join("\n")}\n`;
}
