import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { medicalBillingFindings } from "./medical-bill-reconciliation-coordinator.mjs";
import { validateArtifact } from "./artifact-validator-registry.mjs";

const base = new URL("../sources/medical-bill-reconciliation-coordinator/", import.meta.url);
const fixture = JSON.parse(await readFile(new URL("fixtures/medical-billing.example.json", base), "utf8"));
const schema = JSON.parse(await readFile(new URL("schemas/medical-billing.schema.json", base), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const mutate = (change) => { const value = structuredClone(fixture); change(value); return value; };
const doc = (value, id) => value.documents.find((row) => row.id === id);
function reject(change, code) {
  const value = mutate(change);
  assert.equal(validate(value), true, ajv.errorsText(validate.errors));
  const findings = medicalBillingFindings(value);
  assert.ok(findings.some((row) => row.code === code), JSON.stringify(findings));
}

test("medical billing example is strict-schema valid and semantically clean", () => {
  assert.equal(validate(fixture), true, ajv.errorsText(validate.errors));
  assert.deepEqual(medicalBillingFindings(fixture), []);
});

test("registered artifact validator accepts the packaged billing example", async () => {
  const result = await validateArtifact({
    id: "medical-bill-reconciliation-coordinator",
    artifactPath: new URL("fixtures/medical-billing.example.json", base),
    scenarioType: "accepted-task", mode: "fixture",
  });
  assert.equal(result.valid, true, JSON.stringify(result));
  assert.equal(result.semantics.applicable, true);
});

test("malformed direct inputs fail closed without throwing", () => {
  for (const value of [null, undefined, true, 1, "billing", [], {}, {scope: {}, review: {}},
    {...fixture, documents: [null]}, {...fixture, associations: [false]}]) {
    assert.ok(medicalBillingFindings(value).length > 0);
  }
  const value = mutate((v) => { v.documents[0].lineRefs = null; v.associations[0].lineRefs = null; });
  assert.doesNotThrow(() => medicalBillingFindings(value));
  assert.ok(medicalBillingFindings(value).length > 0);
});

test("document and line indexes cannot drop or duplicate evidence", () => {
  reject((v) => v.scope.documentRefs.pop(), "incomplete_billing_index");
  reject((v) => v.scope.lineRefs.pop(), "incomplete_billing_index");
  reject((v) => v.documents[0].lineRefs.pop(), "incomplete_document_lines");
  reject((v) => v.associations.pop(), "incomplete_service_partition");
  reject((v) => { v.associations[4].lineRefs = ["line-bill-a"]; }, "incomplete_service_partition");
  reject((v) => { v.questions[0].id = v.documents[0].id; }, "duplicate_identity");
  reject((v) => { v.documents[1].controlledRef = v.documents[0].controlledRef; }, "duplicate_billing_source");
});

test("patient, provider, currency, service date, and issuer mismatches are rejected", () => {
  reject((v) => { v.documents[0].patientRef = "patient-b"; }, "cross_billing_scope");
  reject((v) => { v.documents[0].currency = "EUR"; }, "cross_billing_scope");
  reject((v) => { doc(v, "eob-a-corrected").providerRef = "provider-b"; }, "invalid_service_association");
  reject((v) => { v.lines[2].serviceDate = "2026-09-11"; }, "invalid_service_association");
  reject((v) => { v.lines[0].serviceDate = "2026-08-31"; }, "invalid_billing_chronology");
  reject((v) => { doc(v, "receipt-a").issuerKind = "patient"; }, "invalid_billing_issuer");
  reject((v) => { v.scope.asOf = "2026-09-16"; }, "invalid_billing_chronology");
});

test("line associations require exact supplied evidence", () => {
  reject((v) => { v.associations[0].evidenceRef = "missing-record"; }, "invalid_service_association");
  reject((v) => { v.associations[0].evidenceRef = "bill-a"; }, "invalid_service_association");
  reject((v) => { doc(v, "link-a").relatedLineRefs = ["line-bill-a", "line-eob-a-original"]; }, "invalid_service_association");
  reject((v) => { doc(v, "link-a").relatedLineRefs = ["missing-line"]; }, "invalid_billing_subject");
});

test("corrections and reversals retain an exact acyclic issuer chain", () => {
  reject((v) => { doc(v, "eob-a-corrected").supersedesRef = null; }, "invalid_claim_lineage");
  reject((v) => { doc(v, "eob-a-corrected").supersedesRef = "eob-b-original"; }, "invalid_claim_lineage");
  reject((v) => { doc(v, "eob-a-corrected").issuerRef = "insurer-b"; }, "invalid_claim_lineage");
  reject((v) => { doc(v, "eob-a-corrected").seriesRef = "claim-other"; }, "invalid_claim_lineage");
  reject((v) => { doc(v, "eob-a-original").supersedesRef = "eob-a-corrected"; }, "invalid_claim_lineage");
  reject((v) => { doc(v, "eob-a-corrected").issuedOn = "2026-09-14"; }, "invalid_claim_lineage");
  reject((v) => { v.comparisons.push({...v.comparisons[0], id:"comparison-reversal", associationRef:"association-b", differenceMinor:8000}); }, "incomplete_charge_comparisons");
});

test("arithmetic preserves attribution and cannot become a liability calculation", () => {
  reject((v) => { v.comparisons[0].differenceMinor = 15000 - 2000; }, "unsupported_charge_comparison");
  reject((v) => { v.comparisons = []; }, "incomplete_charge_comparisons");
  reject((v) => { v.lines[0].allowedMinor = 10000; }, "conflated_billing_amount");
  reject((v) => { v.lines[2].chargedMinor = null; }, "incomplete_charge_comparisons");
  reject((v) => { doc(v, "eob-a-corrected").amountMinor = 2000; }, "invalid_transfer_evidence");
});

test("payment and refund matches require independent exact evidence", () => {
  reject((v) => { v.transfers[0].counterpartRef = "eob-a-corrected"; v.transfers[0].state = "receipt-and-posting-observed"; }, "unsupported_transfer_match");
  reject((v) => { v.transfers[2].counterpartRef = "refund-a"; v.transfers[2].state = "notice-and-receipt-observed"; }, "unsupported_transfer_match");
  reject((v) => { doc(v, "posting-b").amountMinor = 999; }, "unsupported_transfer_match");
  reject((v) => { doc(v, "posting-b").transactionRef = "different-payment"; }, "unsupported_transfer_match");
  reject((v) => { doc(v, "posting-b").relatedLineRefs = ["line-eob-b-original"]; }, "unsupported_transfer_match");
  reject((v) => { v.transfers.pop(); }, "incomplete_transfer_partition");
  reject((v) => { v.transfers.push({...v.transfers[0], id:"duplicate-payment"}); }, "incomplete_transfer_partition");
  reject((v) => { v.documents.push({...doc(v, "receipt-a"), id:"duplicate-receipt", seriesRef:"series-duplicate"}); v.scope.documentRefs.push("duplicate-receipt"); }, "duplicate_transfer_observation");
});

test("gaps cannot disappear, deadlines cannot be invented, and helpers cannot claim ownership", () => {
  reject((v) => { v.questions.pop(); }, "hidden_billing_gap");
  reject((v) => { v.questions[0].deadline = "2026-10-16"; }, "unsupported_owner_question");
  reject((v) => { v.questions[0].sourceRef = "letter-a"; }, "unsupported_owner_question");
  reject((v) => { v.review.ownerRef = "helper-a"; }, "invalid_patient_authority");
  reject((v) => { v.questions[1].ownerRef = "helper-a"; }, "unsupported_owner_question");
});

test("schema rejects unauthorized actions, narrative claims, secrets, unsafe amounts, and extra fields", () => {
  for (const change of [
    (v) => { v.review.externalActions = "pay"; },
    (v) => { v.review.liabilityDetermination = "patient-owes-2000"; },
    (v) => { v.review.state = "settled"; },
    (v) => { v.documents[0].controlledRef = "https://portal.example/?token=secret"; },
    (v) => { v.documents[0].memberNumber = "sensitive"; },
    (v) => { v.lines[0].chargedMinor = 1.1; },
    (v) => { v.lines[0].chargedMinor = Number.MAX_SAFE_INTEGER + 1; },
    (v) => { doc(v, "receipt-a").amountMinor = -1; },
  ]) assert.equal(validate(mutate(change)), false);
});

test("ordering is immaterial and zero-difference evidence needs no invented discrepancy", () => {
  const value = mutate((v) => {
    v.lines[2].chargedMinor = 15000;
    v.comparisons[0].differenceMinor = 0;
    v.questions = v.questions.filter((q) => q.reason !== "charge-difference");
    for (const key of ["documents", "lines", "associations", "transfers", "questions"]) v[key].reverse();
  });
  assert.equal(validate(value), true, ajv.errorsText(validate.errors));
  assert.deepEqual(medicalBillingFindings(value), []);
});

test("a missing charge stays unknown, not zero or an inferred liability", () => {
  const value = mutate((v) => {
    v.lines[2].chargedMinor = null;
    v.comparisons = [];
    const question = v.questions.find((q) => q.reason === "charge-difference");
    question.targetRef = "association-a";
    question.reason = "missing-charge";
  });
  assert.equal(validate(value), true, ajv.errorsText(validate.errors));
  assert.deepEqual(medicalBillingFindings(value), []);
});

test("a refund receipt is accepted only as an independent exact observation", () => {
  const value = mutate((v) => {
    const notice = doc(v, "refund-a");
    v.documents.push({...notice, id:"refund-receipt-a", kind:"refund-receipt",
      issuerRef:"processor-a", issuerKind:"payment-processor", seriesRef:"series-refund-receipt-a",
      controlledRef:"controlled://medical-billing/source-refund-receipt-a"});
    v.scope.documentRefs.push("refund-receipt-a");
    v.transfers[2].counterpartRef = "refund-receipt-a";
    v.transfers[2].state = "notice-and-receipt-observed";
    v.questions = v.questions.filter((q) => q.targetRef !== "refund-pending");
  });
  assert.equal(validate(value), true, ajv.errorsText(validate.errors));
  assert.deepEqual(medicalBillingFindings(value), []);
});

test("an unmatched provider posting remains visible without a fabricated payment", () => {
  const value = mutate((v) => {
    v.transfers[1].counterpartRef = null;
    v.transfers[1].state = "posting-missing";
    v.transfers.push({id:"unmatched-posting", kind:"unmatched-posting",
      evidenceRef:"posting-b", counterpartRef:null, state:"unmatched"});
    for (const targetRef of ["payment-b", "unmatched-posting"]) {
      v.questions.push({id:`question-${targetRef}`, targetRef, reason:"transfer-evidence-gap",
        ownerRef:"patient-a", sourceRef:null, deadline:null});
    }
  });
  assert.equal(validate(value), true, ajv.errorsText(validate.errors));
  assert.deepEqual(medicalBillingFindings(value), []);
});

test("competing current line links cannot support arithmetic", () => {
  for (const includeHistory of [false, true]) reject((v) => {
    const other = {...v.lines[2], id:"line-eob-a-other"};
    v.lines.push(other);
    v.scope.lineRefs.push(other.id);
    doc(v, "eob-a-corrected").lineRefs.push(other.id);
    v.documents.push({...doc(v, "link-a"), id:"link-other", seriesRef:"series-link-other",
      controlledRef:"controlled://medical-billing/source-link-other",
      relatedLineRefs:["line-bill-a", other.id, ...(includeHistory ? ["line-eob-a-original"] : [])]});
    v.scope.documentRefs.push("link-other");
    v.associations.push({id:"unmatched-other", lineRefs:[other.id], evidenceRef:null, state:"unmatched"});
    v.questions.push({id:"question-other", targetRef:"unmatched-other", reason:"unmatched-line",
      ownerRef:"patient-a", sourceRef:null, deadline:null});
  }, "ambiguous_service_association");
});

test("a bill without itemization cannot disappear behind an empty line index", () => {
  reject((v) => {
    v.documents.push({...doc(v, "bill-a"), id:"bill-empty", seriesRef:"series-bill-empty",
      controlledRef:"controlled://medical-billing/source-bill-empty", lineRefs:[]});
    v.scope.documentRefs.push("bill-empty");
  }, "missing_service_itemization");
});

test("signed issuer amounts are preserved without normalizing credits into charges", () => {
  const value = mutate((v) => {
    v.lines[0].chargedMinor = -15000;
    v.lines[2].chargedMinor = -14000;
    v.lines[2].adjustmentMinor = -4000;
    v.comparisons[0].differenceMinor = -1000;
  });
  assert.equal(validate(value), true, ajv.errorsText(validate.errors));
  assert.deepEqual(medicalBillingFindings(value), []);
  value.lines[0].chargedMinor = Number.MAX_SAFE_INTEGER;
  value.lines[2].chargedMinor = -Number.MAX_SAFE_INTEGER;
  assert.ok(medicalBillingFindings(value).some((row) => row.code === "unsupported_charge_comparison"));
});
