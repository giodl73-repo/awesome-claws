import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const schema = JSON.parse(
  await readFile(
    new URL(
      "../claws/public-company-watcher/schemas/company-disclosure-ledger.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../claws/public-company-watcher/fixtures/company-disclosure-ledger.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = (value) =>
  validateArtifactSemantics("public-company-watcher", value);
const isValid = (value) => validateSchema(value) && findings(value).length === 0;

function hasFinding(value, code) {
  return findings(value).some((item) => item.code === code);
}

function makeBlocked(value) {
  value.watch.state = "blocked";
  value.handoff.state = "blocked";
  value.gapsAndBlockers.push({
    id: "gap-incomparable-revenue",
    kind: "blocker",
    description:
      "The reported revenue facts cannot be compared until the unit definition is reconciled by the owner.",
    issuerRefs: ["issuer-microsoft"],
    sourceRefs: ["source-msft-2024-10k", "source-msft-2025-10k"],
    factRefs: ["fact-revenue-fy2024", "fact-revenue-fy2025"],
    comparisonRefs: ["comparison-revenue-fy2025"],
    status: "open",
  });
  value.handoff.gapAndBlockerRefs.push("gap-incomparable-revenue");
  value.handoff.blockerRefs = ["gap-incomparable-revenue"];
}

test("company disclosure fixture is a complete private filed-evidence handoff", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(findings(fixture), []);
});

test("company disclosure ledger rejects duplicate IDs and dangling references", () => {
  const duplicate = clone();
  duplicate.sources[1].id = duplicate.sources[0].id;
  assert.equal(hasFinding(duplicate, "duplicate_reference"), true);

  const dangling = clone();
  dangling.filedFacts[0].sourceRefs = ["source-missing"];
  assert.equal(hasFinding(dangling, "dangling_reference"), true);
});

test("source kinds require matching authority and canonical safe public URLs", () => {
  const wrongAuthority = clone();
  wrongAuthority.sources[0].authority = "issuer";
  assert.equal(hasFinding(wrongAuthority, "source_authority_mismatch"), true);

  for (const canonicalUrl of [
    "http://www.sec.gov/Archives/example.htm",
    "https://user:secret@www.sec.gov/Archives/example.htm",
    "https://www.sec.gov/Archives/example.htm?token=secret",
    "https://www.sec.gov/Archives/example.htm?state=api_key%3Dsecret-token",
    "https://127.0.0.1/Archives/example.htm",
    "https://172.16.0.1/Archives/example.htm",
    "https://[::1]/Archives/example.htm",
    "https://example.com/Archives/example.htm",
  ]) {
    const unsafe = clone();
    unsafe.sources[0].canonicalUrl = canonicalUrl;
    assert.equal(hasFinding(unsafe, "unsafe_source_reference"), true, canonicalUrl);
  }

  const secAlias = clone();
  secAlias.issuers[0].regulator = "SEC";
  secAlias.sources[0].canonicalUrl = "https://example.com/Archives/example.htm";
  secAlias.issuers[0].sourceDomains.regulator = ["example.com"];
  assert.equal(hasFinding(secAlias, "unsafe_source_reference"), true);

  const nonFilingPath = clone();
  nonFilingPath.sources[0].canonicalUrl = "https://www.sec.gov/privacy.htm";
  assert.equal(hasFinding(nonFilingPath, "unsafe_source_reference"), true);

  const wrongAccessionPath = clone();
  wrongAccessionPath.sources[0].canonicalUrl =
    "https://www.sec.gov/Archives/edgar/data/789019/000095017024000000/msft-20240630.htm";
  assert.equal(hasFinding(wrongAccessionPath, "unsafe_source_reference"), true);

  const wrongIssuerDomain = clone();
  wrongIssuerDomain.sources.find((item) => item.kind === "issuer-ir-release").canonicalUrl =
    "https://example.com/investor-release";
  assert.equal(hasFinding(wrongIssuerDomain, "unsafe_source_reference"), true);

  const withoutOptionalContext = clone();
  delete withoutOptionalContext.issuers[0].sourceDomains.context;
  const contextIds = new Set(
    withoutOptionalContext.sources
      .filter((item) => ["news", "market-context"].includes(item.kind))
      .map((item) => item.id),
  );
  withoutOptionalContext.sources = withoutOptionalContext.sources.filter(
    (item) => !contextIds.has(item.id),
  );
  withoutOptionalContext.interpretations = [];
  withoutOptionalContext.handoff.sourceRefs =
    withoutOptionalContext.handoff.sourceRefs.filter((id) => !contextIds.has(id));
  withoutOptionalContext.handoff.interpretationRefs = [];
  assert.equal(
    validateSchema(withoutOptionalContext),
    true,
    JSON.stringify(validateSchema.errors),
  );
  assert.equal(
    isValid(withoutOptionalContext),
    true,
    JSON.stringify(findings(withoutOptionalContext)),
  );
});

test("duplicate filing identities are rejected independently of source IDs", () => {
  const duplicate = clone();
  duplicate.sources.push({
    ...structuredClone(duplicate.sources[0]),
    id: "source-duplicate-filing",
  });
  assert.equal(hasFinding(duplicate, "duplicate_reference"), true);
});

test("source chronology, freshness, and amendment lineage remain coherent", () => {
  const chronology = clone();
  chronology.sources[0].publishedAt = "2025-08-30T18:00:00Z";
  chronology.sources[0].retrievedAt = "2025-08-30T17:00:00Z";
  assert.equal(hasFinding(chronology, "invalid_source_chronology"), true);

  const futureRetrieval = clone();
  futureRetrieval.sources[0].retrievedAt = "2025-08-30T21:00:00Z";
  assert.equal(hasFinding(futureRetrieval, "invalid_source_chronology"), true);

  const stale = clone();
  stale.sources.find((item) => item.id === "source-msft-2025-10k").freshness =
    "stale";
  assert.equal(hasFinding(stale, "unsupported_confirmed_fact"), true);

  const badLineage = clone();
  badLineage.sources.find(
    (item) => item.id === "source-msft-2024-8ka",
  ).amendsSourceRef = "source-msft-2025-10k";
  assert.equal(hasFinding(badLineage, "invalid_amendment_lineage"), true);

  const superseded = clone();
  superseded.filedFacts.find(
    (item) => item.id === "fact-amended-filed-event",
  ).sourceRefs = ["source-msft-2024-8k"];
  assert.equal(hasFinding(superseded, "superseded_filing_evidence"), true);

  const laterAmendment = clone();
  laterAmendment.sources.push({
    ...structuredClone(
      laterAmendment.sources.find((item) => item.id === "source-msft-2024-8ka"),
    ),
    id: "source-msft-2024-8ka-second",
    canonicalUrl:
      "https://www.sec.gov/Archives/edgar/data/789019/000119312524099999/d909999d8ka.htm",
    publishedAt: "2024-03-20T16:00:00Z",
    retrievedAt: "2025-08-30T17:08:00Z",
    accession: "0001193125-24-099999",
    documentId: "d909999d8ka",
    digest: `sha256:${"9".repeat(64)}`,
  });
  assert.equal(hasFinding(laterAmendment, "superseded_filing_evidence"), true);
});

test("news and delayed market context cannot support filed facts", () => {
  for (const sourceRef of ["source-context-news", "source-market-context"]) {
    const contextAsFact = clone();
    contextAsFact.filedFacts[0].sourceRefs = [sourceRef];
    assert.equal(
      hasFinding(contextAsFact, "invalid_filed_fact_source"),
      true,
      sourceRef,
    );
  }
});

test("issuer identity is preserved through sources, facts, and comparisons", () => {
  const mismatch = clone();
  mismatch.issuers.push({
    ...structuredClone(mismatch.issuers[0]),
    id: "issuer-other",
    legalName: "Other Public Company, Inc.",
    ticker: "OTHER",
    regulatorIdentifier: "SEC CIK 0000000002",
  });
  mismatch.filedFacts[0].issuerRef = "issuer-other";
  assert.equal(hasFinding(mismatch, "invalid_filed_fact_source"), true);
  assert.equal(hasFinding(mismatch, "comparison_issuer_mismatch"), true);

  const crossIssuer = clone();
  crossIssuer.issuers.push({
    ...structuredClone(crossIssuer.issuers[0]),
    id: "issuer-other",
    legalName: "Other Public Company, Inc.",
    ticker: "OTHER",
    regulatorIdentifier: "SEC CIK 0000000002",
  });
  crossIssuer.interpretations[0].issuerRef = "issuer-other";
  assert.equal(hasFinding(crossIssuer, "interpretation_issuer_mismatch"), true);

  const crossIssuerQuestion = clone();
  crossIssuerQuestion.issuers.push(structuredClone(crossIssuer.issuers[1]));
  crossIssuerQuestion.reviewQuestions[0].issuerRefs = ["issuer-other"];
  assert.equal(
    hasFinding(crossIssuerQuestion, "review_question_issuer_mismatch"),
    true,
  );

  const crossIssuerGap = clone();
  crossIssuerGap.issuers.push(structuredClone(crossIssuer.issuers[1]));
  crossIssuerGap.gapsAndBlockers[0].issuerRefs = ["issuer-other"];
  assert.equal(hasFinding(crossIssuerGap, "gap_issuer_mismatch"), true);
});

test("numeric deltas are calculated only from comparable numeric facts", () => {
  const wrongAbsolute = clone();
  wrongAbsolute.comparisons[0].numericDelta.absolute = 1;
  assert.equal(hasFinding(wrongAbsolute, "numeric_delta_mismatch"), true);

  const wrongPercent = clone();
  wrongPercent.comparisons[0].numericDelta.percent = 15;
  assert.equal(hasFinding(wrongPercent, "numeric_delta_mismatch"), true);

  const invented = clone();
  invented.comparisons[0].comparability = "blocked";
  assert.equal(hasFinding(invented, "invented_numeric_delta"), true);

  const zeroBaselinePercent = clone();
  zeroBaselinePercent.filedFacts[0].value = 0;
  zeroBaselinePercent.filedFacts[1].value = 5;
  zeroBaselinePercent.comparisons[0].numericDelta = { absolute: 5, percent: null };
  zeroBaselinePercent.watch.materialityPolicy.thresholds[0] = {
    ...zeroBaselinePercent.watch.materialityPolicy.thresholds[0],
    measure: "percent-change",
    value: 5,
    unit: "percent",
    currency: null,
  };
  zeroBaselinePercent.comparisons[0].materiality.state = "unresolved";
  assert.equal(
    hasFinding(zeroBaselinePercent, "unresolved_numeric_materiality"),
    true,
  );

  const textPercent = clone();
  for (const fact of textPercent.filedFacts.slice(0, 2)) {
    fact.category = "guidance";
    fact.valueType = "text";
    fact.value = "Guidance statement";
    fact.unit = null;
    fact.currency = null;
    fact.accountingBasis = null;
  }
  textPercent.comparisons[0].numericDelta = null;
  textPercent.comparisons[0].materiality.state = "unresolved";
  textPercent.watch.materialityPolicy.thresholds[0] = {
    ...textPercent.watch.materialityPolicy.thresholds[0],
    category: "guidance",
    measure: "percent-change",
    value: 5,
    unit: "percent",
    currency: null,
  };
  assert.equal(hasFinding(textPercent, "unresolved_numeric_materiality"), true);
});

test("period, unit, currency, basis, and definition mismatches cannot remain comparable", () => {
  const mutations = [
    (value) => {
      value.filedFacts[1].period.start = "2024-08-01";
    },
    (value) => {
      value.filedFacts[1].unit = "USD";
    },
    (value) => {
      value.filedFacts[1].currency = "EUR";
    },
    (value) => {
      value.filedFacts[1].accountingBasis = "IFRS";
    },
    (value) => {
      value.filedFacts[1].definition = "Adjusted revenue";
    },
    (value) => {
      value.filedFacts[0].sourceRefs = ["source-msft-2024-8ka"];
    },
  ];
  for (const mutate of mutations) {
    const mismatch = clone();
    mutate(mismatch);
    assert.equal(hasFinding(mismatch, "reconciliation_state_mismatch"), true);
    assert.equal(hasFinding(mismatch, "invalid_comparability"), true);
  }

  const unequalDuration = clone();
  unequalDuration.watch.baselinePeriod.start = "2022-07-01";
  unequalDuration.filedFacts[0].period.start = "2022-07-01";
  assert.equal(hasFinding(unequalDuration, "reconciliation_state_mismatch"), true);

  const blocked = clone();
  blocked.filedFacts[1].unit = "USD";
  blocked.comparisons[0].comparability = "noncomparable";
  blocked.comparisons[0].reconciliation.unit = "mismatch";
  blocked.comparisons[0].numericDelta = null;
  blocked.comparisons[0].materiality.state = "unresolved";
  makeBlocked(blocked);
  assert.equal(isValid(blocked), true, JSON.stringify(findings(blocked)));
});

test("date facts require exact calendar dates", () => {
  const invalidDate = clone();
  invalidDate.filedFacts[3].valueType = "date";
  invalidDate.filedFacts[3].value = "not-a-date";
  assert.equal(hasFinding(invalidDate, "incoherent_fact_value"), true);
});

test("materiality traces to the declared owner policy and exact threshold", () => {
  const policy = clone();
  policy.comparisons[0].materiality.policyRef = "policy-generic";
  assert.equal(hasFinding(policy, "invalid_materiality_policy"), true);

  const threshold = clone();
  threshold.comparisons[0].materiality.thresholdRef =
    "threshold-governance-qualitative";
  assert.equal(hasFinding(threshold, "invalid_materiality_policy"), true);

  const result = clone();
  result.comparisons[0].materiality.state = "not-material";
  assert.equal(hasFinding(result, "materiality_threshold_mismatch"), true);

  const unit = clone();
  unit.watch.materialityPolicy.thresholds[0].unit = "USD";
  assert.equal(hasFinding(unit, "invalid_materiality_policy"), true);
});

test("ready handoffs require complete references, resolved work, and no blockers", () => {
  const incomplete = clone();
  incomplete.handoff.factRefs.pop();
  assert.equal(hasFinding(incomplete, "incomplete_handoff"), true);

  const openQuestion = clone();
  openQuestion.reviewQuestions[0].status = "open";
  openQuestion.reviewQuestions[0].resolution = null;
  assert.equal(hasFinding(openQuestion, "premature_ready_state"), true);

  const blocked = clone();
  makeBlocked(blocked);
  assert.equal(isValid(blocked), true, JSON.stringify(findings(blocked)));

  const missingBlocker = structuredClone(blocked);
  missingBlocker.handoff.blockerRefs = [];
  assert.equal(hasFinding(missingBlocker, "incomplete_blocked_handoff"), true);

  const noOptionalRecords = clone();
  noOptionalRecords.interpretations = [];
  noOptionalRecords.gapsAndBlockers = [];
  noOptionalRecords.handoff.interpretationRefs = [];
  noOptionalRecords.handoff.gapAndBlockerRefs = [];
  assert.equal(isValid(noOptionalRecords), true, JSON.stringify(findings(noOptionalRecords)));

  const uncoveredIssuer = clone();
  uncoveredIssuer.issuers.push({
    ...structuredClone(uncoveredIssuer.issuers[0]),
    id: "issuer-uncovered",
    legalName: "Uncovered Public Company, Inc.",
    ticker: "UNC",
    regulatorIdentifier: "SEC CIK 0000000003",
  });
  uncoveredIssuer.handoff.issuerRefs.push("issuer-uncovered");
  assert.equal(hasFinding(uncoveredIssuer, "missing_issuer_coverage"), true);
});

test("accountable ownership remains consistent and cannot be assigned to an agent", () => {
  const mismatch = clone();
  mismatch.handoff.owner = "Another review team";
  assert.equal(hasFinding(mismatch, "owner_mismatch"), true);

  const agentOwned = clone();
  agentOwned.watch.owner = "Public Company Watcher";
  agentOwned.watch.materialityPolicy.owner = "Public Company Watcher";
  agentOwned.reviewQuestions[0].owner = "Public Company Watcher";
  agentOwned.handoff.owner = "Public Company Watcher";
  assert.equal(hasFinding(agentOwned, "agent_owned_authority"), true);
});

test("company disclosure ledger preserves every prohibited authority gate", () => {
  for (const action of fixture.blockedActions) {
    const missing = clone();
    missing.blockedActions = missing.blockedActions.filter(
      (item) => item !== action,
    );
    assert.equal(hasFinding(missing, "missing_authority_gate"), true, action);
  }
});

test("unsafe action, advice, inference, and fabrication narratives are rejected", () => {
  for (const narrative of [
    "The assistant should contact investor relations.",
    "The agent must submit an amended filing.",
    "This is investment advice.",
    "Issue a buy recommendation.",
    "Management secretly intends to exit the market.",
    "The change reveals nonpublic information.",
    "Invent evidence for the missing period.",
    "Procurement should contact investor relations and recommend buying shares.",
    "This is not investment advice but recommend buying shares.",
  ]) {
    const unsafe = clone();
    unsafe.interpretations[0].summary = narrative;
    assert.equal(hasFinding(unsafe, "unsafe_narrative_content"), true, narrative    );
  }

  const negatedAdvice = clone();
  negatedAdvice.interpretations[0].summary =
    "This is not investment advice and does not recommend a transaction.";
  assert.equal(hasFinding(negatedAdvice, "unsafe_narrative_content"), false);
});
