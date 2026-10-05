import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { rfpResponseFindings, renderRfpResponse, rfpWordCount } from "./rfp-response-producer.mjs";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";
import { ARTIFACT_SCHEMA_NAMES } from "./artifact-validator-registry.mjs";

const root = new URL("../sources/rfp-response-producer/", import.meta.url);
const fixture = JSON.parse(await readFile(new URL("fixtures/rfp-response.example.json", root), "utf8"));
const schema = JSON.parse(await readFile(new URL("schemas/rfp-response.schema.json", root), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const clone = () => structuredClone(fixture);

test("RFP: substantive worked response validates through the registered semantic path", () => {
  assert.equal(validate(fixture), true, JSON.stringify(validate.errors));
  assert.deepEqual(rfpResponseFindings(fixture), []);
  assert.deepEqual(validateArtifactSemantics("rfp-response-producer", fixture), []);
  assert.equal(ARTIFACT_SCHEMA_NAMES["rfp-response-producer"], "rfp-response.schema.json");
  assert.equal(fixture.answers.length, 8);
  assert.equal(fixture.answers.flatMap((a) => a.parts).length, 21);
});

const mutations = [
  ["blank answer", "rfp_structure", (x) => { x.answers[0].parts[0].text = " \n\t "; }],
  ["blank summary", "rfp_structure", (x) => { x.summary.text = " \n\t "; }],
  ["omitted question", "rfp_question_coverage", (x) => x.answers.pop()],
  ["duplicate question", "rfp_question_coverage", (x) => x.answers.push(structuredClone(x.answers[0]))],
  ["buyer order", "rfp_question_coverage", (x) => x.answers.reverse()],
  ["omitted compound part", "rfp_part_coverage", (x) => x.answers[0].parts.pop()],
  ["duplicate compound part", "rfp_part_coverage", (x) => x.answers[0].parts.push(structuredClone(x.answers[0].parts[0]))],
  ["wrong response value", "rfp_answer_value", (x) => { x.answers[1].responseValue = "Mostly"; }],
  ["word limit", "rfp_word_limit", (x) => { x.answers[1].parts[0].text = "Word ".repeat(60); }],
  ["summary word limit", "rfp_word_limit", (x) => { x.summary.text = "Word ".repeat(101); }],
  ["absent source", "rfp_evidence_reference", (x) => { x.answers[0].parts[0].evidence[0].sourceId = "MISSING"; }],
  ["wrong claim for question", "rfp_claim_question", (x) => { x.answers[0].parts[0].evidence[0].claimId = "sso"; }],
  ["stale library claim", "rfp_evidence_scope", (x) => { x.answers[2].parts[0].evidence = [{ sourceId: "LIBRARY-2025", claimId: "old-region" }]; }],
  ["wrong product", "rfp_evidence_scope", (x) => { x.sources[0].product = "Different product"; }],
  ["restricted evidence", "rfp_evidence_scope", (x) => { x.sources[0].audience = "internal-only"; }],
  ["supported without evidence", "rfp_unsupported_claim", (x) => { x.answers[0].parts[0].evidence = []; }],
  ["gap without owner", "rfp_gap_owner", (x) => { x.reviewRequests = x.reviewRequests.filter((r) => !r.questionIds.includes("Q5")); }],
  ["missing amendment", "rfp_amendment_reference", (x) => { x.amendments = []; }],
  ["old baseline approval", "rfp_stale_review", (x) => { x.reviews[0].state = "approved"; }],
  ["wrong answer revision approval", "rfp_stale_review", (x) => { x.reviews[0].state = "approved"; x.reviews[0].baseline = x.baseline; }],
  ["attachment revision mismatch", "rfp_attachment_state", (x) => { x.attachments[0].state = "available-for-review"; }],
  ["omitted required attachment", "rfp_attachment_coverage", (x) => x.attachments.pop()],
  ["wrong attachment requirement", "rfp_attachment_question", (x) => { x.attachments[0].questionId = "Q1"; }],
  ["metadata is not attachment bytes", "rfp_attachment_state", (x) => { x.attachments[1].state = "available-for-review"; }],
  ["restricted attachment", "rfp_attachment_state", (x) => { Object.assign(x.attachments[0], { availableRevision: "3", bytesSupplied: true, state: "available-for-review" }); }],
  ["reference disclosure", "rfp_restricted_text", (x) => { x.answers[5].parts[0].text = "Our reference is CEDAR SAMPLE LTD."; }],
  ["contact disclosure", "rfp_restricted_text", (x) => { x.summary.text += " reference@example.invalid"; }],
  ["false submission", "rfp_authority", (x) => { x.handoff.submission = "submitted"; }],
  ["invented commitment", "rfp_authority", (x) => { x.handoff.commitments = "authorized"; }],
  ["false approval", "rfp_authority", (x) => { x.handoff.approvals = "approved"; }],
  ["duplicate source identity", "rfp_duplicate", (x) => x.sources.push(structuredClone(x.sources[0]))],
  ["unknown review target", "rfp_review_reference", (x) => { x.reviewRequests[0].questionIds = ["Q99"]; }],
  ["unknown attachment target", "rfp_attachment_question", (x) => { x.attachments[0].questionId = "Q99"; }],
  ["source outside question universe", "rfp_source_scope", (x) => { x.sources[0].claims[0].questionIds = ["Q99"]; }],
];
for (const [name, code, change] of mutations) {
  test(`RFP rejects ${name}`, () => {
    const value = clone();
    change(value);
    assert.ok(rfpResponseFindings(value).some((f) => f.code === code), code);
    assert.throws(() => renderRfpResponse(value));
  });
}

test("RFP schema rejects undeclared commitment fields and incomplete content", () => {
  const value = clone();
  value.approved = true;
  assert.equal(validate(value), false);
  delete value.approved;
  value.answers[0].parts[0].text = "";
  assert.equal(validate(value), false);
});

test("RFP keeps explicit gaps usable and separate from current human reviews", () => {
  const value = clone();
  Object.assign(value.reviews[0], { state: "approved", baseline: value.baseline, answerRevision: value.revision });
  Object.assign(value.attachments[1], { bytesSupplied: true, state: "available-for-review" });
  assert.deepEqual(rfpResponseFindings(value), []);
  assert.equal(value.handoff.submission, "not-performed");
  assert.equal(value.answers[2].responseValue, "No");
});

test("RFP renderer emits useful separate buyer and internal documents", async () => {
  const output = renderRfpResponse(fixture);
  assert.equal(output.buyer, await readFile(new URL("fixtures/response-draft.example.md", root), "utf8"));
  assert.equal(output.internal, await readFile(new URL("fixtures/response-review.example.md", root), "utf8"));
  assert.match(output.buyer, /SAML 2.0 SSO/);
  assert.match(output.buyer, /We do not meet Amendment 2/);
  assert.match(output.buyer, /Service credits also remain pending/);
  assert.match(output.internal, /superseded/);
  assert.match(output.internal, /wrong-version/);
  for (const secret of fixture.restrictedStrings) assert.ok(!output.buyer.toLowerCase().includes(secret.toLowerCase()));
  for (const source of fixture.sources) assert.ok(!output.buyer.includes(source.id));
  for (const answer of fixture.answers) {
    const q = fixture.questions.find((q) => q.id === answer.questionId);
    assert.ok(rfpWordCount([answer.responseValue, ...answer.parts.map((p) => p.text)].filter(Boolean).join(" ")) <= q.maxWords);
  }
});

test("RFP malformed top-level input produces a finding", () => {
  assert.equal(rfpResponseFindings(null)[0].code, "rfp_structure");
});
