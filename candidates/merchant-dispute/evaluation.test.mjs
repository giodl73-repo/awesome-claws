import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "../../scripts/artifact-semantics.mjs";
import { rfpResponseFindings } from "../../scripts/rfp-response-producer.mjs";

const read = path => readFile(new URL(path, import.meta.url), "utf8");
const json = async path => JSON.parse(await read(path));
const supplied = await json("supplied-evidence.json");
const project = await json("private-project.json");
const handoff = await read("private-handoff.md");
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const projectSchema = ajv.compile(await json("../../sources/project-manager/schemas/project-state.schema.json"));
const rfpSchema = ajv.compile(await json("../../sources/rfp-response-producer/schemas/rfp-response.schema.json"));
const rfp = await json("../../sources/rfp-response-producer/fixtures/rfp-response.example.json");
const current = supplied.notices.find(n => n.ref === supplied.currentNoticeRef);
const record = ref => supplied.records.find(r => r.ref === ref);
const projectFindings = value => validateArtifactSemantics("project-manager", value);
const acceptedRfp = value => {
  assert(rfpSchema(value), ajv.errorsText(rfpSchema.errors));
  assert.deepEqual(rfpResponseFindings(value), []);
};

test("actual Project Manager contract accepts the private blocked task handoff", () => {
  assert(projectSchema(project), ajv.errorsText(projectSchema.errors));
  assert.deepEqual(projectFindings(project), []);
  assert.equal(project.statusState, "blocked");
  assert(project.milestones.every(m => m.state === "blocked" && m.owner === supplied.owner));
  assert(project.decisions.every(d => d.state === "needed"));
});

test("all supplied references remain covered, with explicit handoff dependencies", () => {
  const refs = [...supplied.notices.map(n => n.ref), supplied.priorReview.ref, ...supplied.records.map(r => r.ref)];
  const used = new Set(project.milestones.flatMap(m => m.evidenceRefs));
  assert.deepEqual([...used].sort(), [...refs].sort());
  for (const ref of refs) assert(handoff.includes(ref), ref);
  assert.deepEqual(project.milestones.at(-1).dependencies, project.milestones.slice(0, -1).map(m => m.id));
  assert.equal(project.targetDate, supplied.ownerTaskDate);
  assert(project.milestones.every(m => m.dueDate === supplied.ownerTaskDate));
});

test("manually authored case/payment/order aliases agree without claiming authentication", () => {
  for (const id of [supplied.caseId, supplied.paymentId, supplied.orderId]) {
    assert(handoff.includes(id), id);
    assert(project.scope.in.some(text => text.includes(id)), id);
  }
  for (const row of supplied.records) {
    if (row.paymentId) assert.equal(row.paymentId, supplied.paymentId);
    if (row.orderId) assert.equal(row.orderId, supplied.orderId);
  }
  assert.equal(record("ORDER-17-V1").assessment, "supplied-link-awaiting-owner-confirmation");
  assert.equal(project.milestones.find(m => m.id === "MAP").state, "blocked");
});

test("notice requirements and proposed attachment references preserve both adverse records", () => {
  assert.deepEqual(supplied.requirements.map(r => r.id), current.requirements);
  assert.deepEqual(supplied.proposedAttachments.map(a => a.requirement), current.requirements);
  for (const requirement of supplied.requirements) {
    assert(handoff.includes(requirement.id));
    for (const ref of requirement.refs) assert(record(ref), ref);
    assert.deepEqual(supplied.proposedAttachments.find(a => a.requirement === requirement.id).sourceRefs, requirement.refs);
  }
  assert(supplied.requirements.find(r => r.id === "delivery").refs.includes("MESSAGE-17-V1"));
  assert(supplied.requirements.find(r => r.id === "executed-refund-evidence").refs.includes("REFUND-17-V1"));
});

test("requested and executed refunds do not establish a reduced dispute amount", () => {
  assert.equal(record("REFUND-REQUEST-17-V1").amountMinor, 12000);
  assert.equal(record("REFUND-17-V1").amountMinor, 4000);
  assert.equal(current.disputedMinor, 12000);
  assert.equal(supplied.reconciledDisputeMinor, null);
  assert.equal(record("REFUND-17-V1").paymentId, supplied.paymentId);
  assert.equal(record("RETURN-17-V1").assessment, "authorized-physical-receipt-not-supplied");
  for (const text of ["USD 120.00 requested", "USD 40.00 executed-refund", "Do not reduce the dispute automatically to USD 80.00"]) assert(handoff.includes(text));
});

test("changed stage and deadline retain historical review without an invented impact rule", () => {
  const prior = supplied.notices.find(n => n.ref === supplied.priorReview.noticeRef);
  assert.notEqual(prior.stage, current.stage);
  assert.notDeepEqual(prior.requirements, current.requirements);
  assert(Date.parse(current.deadline) > Date.parse(prior.deadline));
  assert.equal(current.state, "supplied-current-unreviewed");
  assert.equal(supplied.priorReview.state, "historical");
  assert.equal(supplied.carryForwardRule, null);
  for (const notice of supplied.notices) assert(handoff.includes(notice.deadline));
  assert(handoff.includes(current.timezone));
});

test("no proposed attachment or private label is presented as qualified bytes or permission", () => {
  assert.equal(supplied.attachmentConstraints.actualBytesSupplied, false);
  assert.equal(supplied.attachmentConstraints.disclosureApproved, false);
  assert.equal(supplied.attachmentConstraints.sourceRef, current.ref);
  assert.equal(supplied.proposedAttachments.length, supplied.attachmentConstraints.maxFiles);
  for (const attachment of supplied.proposedAttachments) {
    assert.deepEqual(Object.keys(attachment).sort(), ["name", "requirement", "sourceRefs"]);
    assert(handoff.includes(attachment.name));
  }
  assert(handoff.includes("No PDF bytes exist"));
  assert.equal(supplied.submissionPerformed, false);
  assert.equal(supplied.refundPerformed, false);
  assert.equal(supplied.handoffState, "blocked-private-unsubmitted");
});

test("Project Manager rejects dangling task dependencies", () => {
  const value = structuredClone(project);
  value.milestones.at(-1).dependencies.push("UNKNOWN-TASK");
  assert(projectFindings(value).length > 0);
});

test("scope limit: Project Manager does not authenticate a supplied payment reference", () => {
  const value = structuredClone(project);
  value.milestones[0].evidenceRefs = ["PAY-OTHER"];
  assert(projectSchema(value));
  assert.deepEqual(projectFindings(value), []);
});

test("RFP control fixture remains valid; not a merchant artifact", () => acceptedRfp(structuredClone(rfp)));

test("RFP already rejects missing required attachments", () => {
  const value = structuredClone(rfp);
  value.attachments.pop();
  assert(rfpResponseFindings(value).some(f => f.code === "rfp_attachment_coverage"));
});

test("RFP already invalidates explicit baseline-bound review", () => {
  const value = structuredClone(rfp);
  Object.assign(value.reviews[0], { state: "approved", baseline: value.baseline, answerRevision: value.revision });
  acceptedRfp(value);
  value.baseline = "Synthetic changed baseline";
  assert(rfpResponseFindings(value).some(f => f.code === "rfp_stale_review"));
});

test("scope limit: RFP does not interpret payment identity or case stage in prose", () => {
  const value = structuredClone(rfp);
  value.sources[0].claims[0].text = "Synthetic PAY-OTHER rather than PAY-17.";
  value.summary.text = "Synthetic CASE-17 changed processor stage.";
  acceptedRfp(value);
});

test("RFP cannot be extended with undeclared processor fields", () => {
  const value = structuredClone(rfp);
  value.processorCase = { id: supplied.caseId, payment: supplied.paymentId };
  assert.equal(rfpSchema(value), false);
  assert(rfpSchema.errors.some(e => e.keyword === "additionalProperties"));
});
