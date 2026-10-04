export function rfpWordCount(text) {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

export function rfpResponseFindings(value) {
  const findings = [];
  const fail = (code, message) => findings.push({ code, path: "/", message });
  if (!value || !Array.isArray(value.questions) || !Array.isArray(value.answers) ||
      !Array.isArray(value.sources) || !Array.isArray(value.amendments) ||
      !Array.isArray(value.attachments) || !Array.isArray(value.reviews) ||
      !Array.isArray(value.reviewRequests)) {
    fail("rfp_structure", "The complete response record is required.");
    return findings;
  }
  const exact = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const unique = (items, label, key = "id") => {
    const ids = items.map((item) => item?.[key]);
    if (new Set(ids).size !== ids.length) fail("rfp_duplicate", `${label} identities must be unique.`);
  };
  for (const key of ["questions", "sources", "amendments", "attachments", "reviews", "reviewRequests"]) {
    unique(value[key], key);
  }
  const questionIds = value.questions.map((q) => q.id);
  if (!exact(value.answers.map((a) => a.questionId), questionIds)) {
    fail("rfp_question_coverage", "Answer every current buyer question once in buyer order.");
  }
  const questions = new Map(value.questions.map((q) => [q.id, q]));
  const sources = new Map(value.sources.map((s) => [s.id, s]));
  const amendments = new Set(value.amendments.map((a) => a.id));
  const requiredAttachments = value.questions.flatMap((q) => q.attachmentIds ?? []);
  if (new Set(requiredAttachments).size !== requiredAttachments.length ||
      !exact([...requiredAttachments].sort(), value.attachments.map((a) => a.id).sort())) {
    fail("rfp_attachment_coverage", "Every buyer-required attachment must occur exactly once in the manifest.");
  }
  for (const source of value.sources) {
    unique(source.claims ?? [], `claims in ${source.id}`);
    for (const claim of source.claims ?? []) {
      if (!claim.questionIds?.length || claim.questionIds.some((id) => !questions.has(id))) {
        fail("rfp_source_scope", "Every source claim must name applicable current questions.");
      }
    }
  }
  const checkEvidence = (content, questionId) => {
    if (!content || typeof content.text !== "string" || !content.text.trim() || !Array.isArray(content.evidence)) {
      fail("rfp_structure", "Response text and explicit evidence references are required.");
      return;
    }
    const refs = new Set();
    for (const ref of content.evidence) {
      const key = `${ref.sourceId}/${ref.claimId}`;
      if (refs.has(key)) fail("rfp_duplicate", "Evidence references must not be duplicated.");
      refs.add(key);
      const source = sources.get(ref.sourceId);
      const claim = source?.claims?.find((c) => c.id === ref.claimId);
      if (!source || !claim) {
        fail("rfp_evidence_reference", "Every citation must resolve to a supplied source claim.");
      } else if (!source.current || source.audience !== "buyer-permitted" || source.product !== value.product) {
        fail("rfp_evidence_scope", "Buyer claims need current, permitted evidence for this product.");
      } else if (questionId && !claim.questionIds.includes(questionId)) {
        fail("rfp_claim_question", "The cited claim does not apply to this buyer question.");
      }
    }
  };
  for (const q of value.questions) {
    if (!Array.isArray(q.parts) || !q.parts.length || new Set(q.parts).size !== q.parts.length) {
      fail("rfp_part_coverage", "Current questions require unique subquestion identities.");
    }
    if (!Array.isArray(q.amendmentIds) || q.amendmentIds.some((id) => !amendments.has(id))) {
      fail("rfp_amendment_reference", "Question amendment lineage must resolve.");
    }
  }
  for (const answer of value.answers) {
    const q = questions.get(answer.questionId);
    if (!q) continue;
    const parts = Array.isArray(answer.parts) ? answer.parts : [];
    if (!exact(parts.map((p) => p.id), q.parts)) {
      fail("rfp_part_coverage", "Answer every compound subquestion once in its declared order.");
    }
    if (q.values?.length ? !q.values.includes(answer.responseValue) : answer.responseValue !== null) {
      fail("rfp_answer_value", "Use the buyer's exact response vocabulary, or null for prose-only questions.");
    }
    const text = [answer.responseValue, ...parts.map((p) => p.text)].filter(Boolean).join("\n\n");
    if (rfpWordCount(text) > q.maxWords) fail("rfp_word_limit", "Answer exceeds the buyer's word limit.");
    for (const part of parts) {
      checkEvidence(part, q.id);
      if (part.state === "supported" && !part.evidence?.length) {
        fail("rfp_unsupported_claim", "Supported parts require applicable permitted source claims.");
      }
      if (part.state === "gap" && !value.reviewRequests.some((r) => r.questionIds?.includes(q.id))) {
        fail("rfp_gap_owner", "Every unresolved answer needs a specific owner review request.");
      }
    }
  }
  checkEvidence(value.summary);
  if (typeof value.summary?.text === "string" && rfpWordCount(value.summary.text) > value.summaryMaxWords) {
    fail("rfp_word_limit", "Executive summary exceeds the buyer's word limit.");
  }
  for (const attachment of value.attachments) {
    if (!questions.get(attachment.questionId)?.attachmentIds?.includes(attachment.id)) {
      fail("rfp_attachment_question", "Attachment must map to the buyer question that requires it.");
    }
    const expected = attachment.availableRevision === null ? "missing"
      : attachment.availableRevision !== attachment.requiredRevision ? "wrong-version"
      : !attachment.buyerPermitted ? "restricted"
      : !attachment.bytesSupplied ? "missing" : "available-for-review";
    if (attachment.state !== expected) {
      fail("rfp_attachment_state", "Attachment state must reflect exact revision, permission and supplied bytes.");
    }
    if (expected !== "available-for-review" && !value.reviewRequests.some((r) => r.questionIds?.includes(attachment.questionId))) {
      fail("rfp_gap_owner", "Missing, restricted or wrong-version attachments need owner follow-up.");
    }
  }
  for (const review of value.reviews) {
    if (!questions.has(review.questionId)) fail("rfp_review_reference", "Review must name a current question.");
    if (review.state === "approved" && (review.baseline !== value.baseline || review.answerRevision !== value.revision)) {
      fail("rfp_stale_review", "Approval cannot carry across buyer-baseline or answer-version changes.");
    }
  }
  for (const request of value.reviewRequests) {
    if (!request.questionIds?.length || request.questionIds.some((id) => !questions.has(id))) {
      fail("rfp_review_reference", "Review requests must name exact current questions.");
    }
  }
  const buyerText = [value.summary?.text, ...value.answers.flatMap((a) =>
    [a.responseValue, ...(a.parts ?? []).map((p) => p.text)])].filter(Boolean).join("\n").toLowerCase();
  for (const restricted of value.restrictedStrings ?? []) {
    if (typeof restricted === "string" && restricted.trim() && buyerText.includes(restricted.toLowerCase())) {
      fail("rfp_restricted_text", "Buyer copy contains a supplied restricted disclosure marker.");
    }
  }
  if (value.handoff?.state !== "private-review-draft" || value.handoff?.submission !== "not-performed" ||
      value.handoff?.commitments !== "not-authorized" || value.handoff?.approvals !== "not-granted") {
    fail("rfp_authority", "The artifact cannot claim submission, commitment or approval authority.");
  }
  return findings;
}

// Buyer copy and internal provenance are deliberately rendered as separate documents.
export function renderRfpResponse(value) {
  const findings = rfpResponseFindings(value);
  if (findings.length) throw new Error(findings.map((f) => `${f.code}: ${f.message}`).join("\n"));
  const buyer = ["# RFP response draft", "Private review copy. Not approved or submitted.",
    "## Executive summary", value.summary.text];
  for (const answer of value.answers) {
    buyer.push(`## ${answer.questionId}`, [answer.responseValue, ...answer.parts.map((p) => p.text)].filter(Boolean).join("\n\n"));
  }
  const cell = (text) => String(text).replaceAll("|", "\\|").replaceAll(/\r?\n/gu, " ");
  const coverage = ["| Question | Part | State | Source claims |", "| --- | --- | --- | --- |"];
  for (const answer of value.answers) for (const part of answer.parts) {
    coverage.push(`| ${cell(answer.questionId)} | ${cell(part.id)} | ${part.state} | ${part.evidence.map((r) => `${cell(r.sourceId)}/${cell(r.claimId)}`).join(", ") || "Unresolved"} |`);
  }
  const constraints = ["| Question | Mandatory | Words / limit | Amendments | Attachments |", "| --- | --- | --- | --- | --- |"];
  for (const q of value.questions) {
    const answer = value.answers.find((a) => a.questionId === q.id);
    const words = rfpWordCount([answer.responseValue, ...answer.parts.map((p) => p.text)].filter(Boolean).join(" "));
    constraints.push(`| ${cell(q.id)} | ${q.mandatory ? "yes" : "no"} | ${words} / ${q.maxWords} | ${q.amendmentIds.map(cell).join(", ") || "none"} | ${q.attachmentIds.map(cell).join(", ") || "none"} |`);
  }
  const internal = ["# RFP internal review", `${value.opportunity}; ${value.product}; ${value.baseline}; revision ${value.revision}.`,
    `Owner: ${value.owner}. Deadline: ${value.deadline}.`,
    `Delivery format: ${value.deliveryFormat}. Conversion complete: ${value.formatComplete ? "yes" : "no"}.`,
    "Coverage is not approval, commercial viability or authority to submit.",
    "## Buyer constraints", constraints.join("\n"), "## Requirement coverage", coverage.join("\n")];
  internal.push("## Source notes", ...value.sources.flatMap((s) => [
    `### ${s.id}`, `Version ${s.version}; product ${s.product}; ${s.audience}; current: ${s.current ? "yes" : "no"}.`,
    ...s.claims.map((c) => `- ${c.id} (${c.questionIds.join(", ")}): ${c.text}`)]),
    "## Summary evidence", value.summary.evidence.map((r) => `${r.sourceId}/${r.claimId}`).join(", "),
    "## Buyer amendments", ...value.amendments.map((a) => `- ${a.id}: ${a.changes}`),
    "## Attachments", ...value.attachments.map((a) => `- ${a.id}: ${a.name}, required ${a.requiredRevision}, available ${a.availableRevision ?? "none"}: ${a.state}.`),
    "## Review history", ...value.reviews.map((r) => `- ${r.id}: ${r.questionId}, ${r.baseline}, answer ${r.answerRevision}: ${r.state} (${r.owner}).`),
    "## Owner questions", ...value.reviewRequests.map((r) => `- ${r.priority} ${r.owner} (${r.questionIds.join(", ")}): ${r.question}`),
    "## Private notes", ...value.privateNotes.map((n) => `- ${n}`),
    "## Authority", "No submission, attachment distribution, approval, contractual acceptance or commitment performed.");
  return { buyer: `${buyer.join("\n\n")}\n`, internal: `${internal.join("\n\n")}\n` };
}
