import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "./artifact-semantics.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = fileURLToPath(
  new URL(
    "../claws/ux-research-synthesizer/fixtures/research-evidence.example.json",
    import.meta.url,
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL("../claws/ux-research-synthesizer/schemas/research-evidence.schema.json", import.meta.url),
    "utf8",
  ),
);
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function clone(value = fixture) {
  return structuredClone(value);
}

function isValid(value) {
  return (
    validateSchema(value) &&
    validateArtifactSemantics("ux-research-synthesizer", value).length === 0
  );
}

test("research evidence fixture keeps source, evidence, theme, and decision-question data consistent", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("ux-research-synthesizer", fixture), []);
});

test("research synthesis validator is total over schema-valid malformed nested records", () => {
  const malformedSource = clone();
  malformedSource.sources.push({});
  assert.equal(validateSchema(malformedSource), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("ux-research-synthesizer", malformedSource));
  assert.equal(isValid(malformedSource), false);

  const malformedEvidence = clone();
  malformedEvidence.evidence.push({});
  assert.equal(validateSchema(malformedEvidence), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("ux-research-synthesizer", malformedEvidence));
  assert.equal(isValid(malformedEvidence), false);

  const malformedTheme = clone();
  malformedTheme.themes.push({});
  assert.equal(validateSchema(malformedTheme), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("ux-research-synthesizer", malformedTheme));
  assert.equal(isValid(malformedTheme), false);

  const malformedQuestion = clone();
  malformedQuestion.decisionQuestions.push({});
  assert.equal(validateSchema(malformedQuestion), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("ux-research-synthesizer", malformedQuestion));
  assert.equal(isValid(malformedQuestion), false);
});

test("research synthesis validator rejects non-array required ledgers", () => {
  for (const field of ["sources", "evidence", "themes", "decisionQuestions", "principals"]) {
    const malformed = {
      ...clone(),
      evidenceId: "legacy-evidence-1",
      observation: "A minimized observation.",
      theme: "Navigation",
      confidence: "high",
      [field]: {},
    };
    assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
    assert.doesNotThrow(() => validateArtifactSemantics("ux-research-synthesizer", malformed));
    assert.ok(
      validateArtifactSemantics("ux-research-synthesizer", malformed).some(
        (item) => item.code === "invalid_array_list" && item.path === field,
      ),
      `expected invalid_array_list for ${field}`,
    );
  }
});

test("research synthesis validator handles a non-array prohibitedActions without throwing", () => {
  const malformed = clone();
  malformed.handoff.prohibitedActions = {};
  assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("ux-research-synthesizer", malformed));
  const findings = validateArtifactSemantics("ux-research-synthesizer", malformed);
  assert.ok(findings.some((item) => item.code === "invalid_string_list"));
});

test("research synthesis validator handles a non-array reference list without throwing", () => {
  const malformed = clone();
  malformed.evidence[0].themeRefs = {};
  assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("ux-research-synthesizer", malformed));
  const findings = validateArtifactSemantics("ux-research-synthesizer", malformed);
  assert.ok(findings.some((item) => item.code === "invalid_reference_list"));
});

test("research synthesis validator fails closed on a matching-length object masquerading as a reference list", () => {
  const fakeArray = clone();
  fakeArray.handoff.sourceRefs = { length: 3 };
  assert.equal(validateSchema(fakeArray), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("ux-research-synthesizer", fakeArray));
  assert.equal(isValid(fakeArray), false);
});

test("research synthesis validator rejects an unminimized (full-name-shaped) participant alias", () => {
  const identified = clone();
  identified.sources.find((item) => item.id === "source-p1").participantAlias = "Jane Doe";
  assert.equal(isValid(identified), false);
  const findings = validateArtifactSemantics("ux-research-synthesizer", identified);
  assert.ok(findings.some((item) => item.code === "unminimized_participant_reference"));
});

test("research synthesis validator rejects an email-like participant alias", () => {
  const identified = clone();
  identified.sources.find((item) => item.id === "source-p1").participantAlias = "p1@example.com";
  assert.equal(isValid(identified), false);
  const findings = validateArtifactSemantics("ux-research-synthesizer", identified);
  assert.ok(findings.some((item) => item.code === "unminimized_participant_reference"));
});

test("research synthesis validator rejects a theme's supportingEvidenceRefs that drift from evidence back-links", () => {
  const drifted = clone();
  drifted.themes.find((item) => item.id === "theme-discoverability").supportingEvidenceRefs = [
    "evidence-p1-backup-codes",
  ];
  assert.equal(isValid(drifted), false);
  const findings = validateArtifactSemantics("ux-research-synthesizer", drifted);
  assert.ok(findings.some((item) => item.code === "theme_evidence_link_mismatch"));
});

test("research synthesis validator rejects a hasContradiction flag that does not match a genuine cross-referenced contradiction", () => {
  const falseFlag = clone();
  falseFlag.themes.find((item) => item.id === "theme-email-fallback-strength").hasContradiction = true;
  falseFlag.themes.find((item) => item.id === "theme-email-fallback-strength").contradictionNote =
    "Fabricated contradiction note.";
  assert.equal(isValid(falseFlag), false);
  const findings = validateArtifactSemantics("ux-research-synthesizer", falseFlag);
  assert.ok(findings.some((item) => item.code === "contradiction_flag_mismatch"));
});

test("research synthesis validator rejects a decision question answered by the accountable researcher (researcher-as-owner)", () => {
  const selfAnswered = clone();
  // Independence is bound by stable principal id, not display-name text: the
  // researcher's own registered principal id answering the question is what
  // must be rejected, regardless of how "answeredBy" is displayed.
  selfAnswered.decisionQuestions.find((item) => item.id === "question-backup-codes-placement").answeredById =
    "principal-renee-okafor";
  assert.equal(isValid(selfAnswered), false);
  const findings = validateArtifactSemantics("ux-research-synthesizer", selfAnswered);
  assert.ok(findings.some((item) => item.code === "premature_question_resolution"));
});

test("research synthesis validator rejects the exact package self-attestation identity 'ux research synthesizer' as a decision-question answerer", () => {
  const packageAnswered = clone();
  packageAnswered.principals.push({
    id: "principal-package-self",
    name: "UX Research Synthesizer",
    roles: ["product-manager"],
    scopes: ["product-decision-authority"],
  });
  packageAnswered.decisionQuestions.find(
    (item) => item.id === "question-backup-codes-placement",
  ).answeredById = "principal-package-self";
  assert.equal(isValid(packageAnswered), false);
  const findings = validateArtifactSemantics("ux-research-synthesizer", packageAnswered);
  assert.ok(findings.some((item) => item.code === "premature_question_resolution"));
});

test("research synthesis validator rejects a decision question answered by an arbitrary, unregistered principal id", () => {
  const arbitraryAnswerer = clone();
  arbitraryAnswerer.decisionQuestions.find(
    (item) => item.id === "question-backup-codes-placement",
  ).answeredById = "principal-ghost";
  assert.equal(isValid(arbitraryAnswerer), false);
  const findings = validateArtifactSemantics("ux-research-synthesizer", arbitraryAnswerer);
  assert.ok(findings.some((item) => item.code === "dangling_reference"));
  assert.ok(findings.some((item) => item.code === "premature_question_resolution"));
});

test("research synthesis validator does not treat a distinct principal id with the same display name as self-attestation", () => {
  // A different registered principal happening to share a display name with
  // the researcher is not the same principal, so it must not be flagged as
  // researcher self-attestation -- independence is judged by id, not text.
  const distinctIdSameName = clone();
  distinctIdSameName.principals.push({
    id: "principal-renee-okafor-2",
    name: "Renee Okafor",
    roles: ["product-manager"],
    scopes: ["product-decision-authority"],
  });
  const question = distinctIdSameName.decisionQuestions.find(
    (item) => item.id === "question-backup-codes-placement",
  );
  question.answeredById = "principal-renee-okafor-2";
  question.answeredBy = "Renee Okafor";
  assert.deepEqual(validateArtifactSemantics("ux-research-synthesizer", distinctIdSameName), []);
});

test("research synthesis validator rejects a decision question answered before the study's synthesis snapshot", () => {
  const earlyAnswer = clone();
  earlyAnswer.decisionQuestions.find(
    (item) => item.id === "question-backup-codes-placement",
  ).answeredAt = "2026-08-01T00:00:00Z";
  assert.equal(isValid(earlyAnswer), false);
  const findings = validateArtifactSemantics("ux-research-synthesizer", earlyAnswer);
  assert.ok(findings.some((item) => item.code === "premature_question_resolution"));
});

test("research synthesis validator rejects evidence with a null sourceRef (a null source cannot support anything)", () => {
  const nullSource = clone();
  nullSource.evidence.find((item) => item.id === "evidence-p3-email-fallback").sourceRef = null;
  assert.equal(isValid(nullSource), false);
  const findings = validateArtifactSemantics("ux-research-synthesizer", nullSource);
  assert.ok(findings.some((item) => item.code === "missing_evidence_source"));
});

test("research synthesis validator rejects evidence resolving to a withdrawn (unapproved) source", () => {
  const withdrawnSource = clone();
  withdrawnSource.sources.find((item) => item.id === "source-p3").consentStatus = "withdrawn";
  assert.equal(isValid(withdrawnSource), false);
  const findings = validateArtifactSemantics("ux-research-synthesizer", withdrawnSource);
  assert.ok(findings.some((item) => item.code === "unapproved_evidence_source"));
});

test("research synthesis validator scans observation, quote, theme, decision, limitation, and handoff text for leaked identifiers", () => {
  const cases = [
    [
      "evidence[0].observation",
      (draft) => { draft.evidence[0].observation = "Follow up with jane.doe@example.com about the finding."; },
      "participant_identifier_leak",
    ],
    [
      "evidence[0].observation embedded full name",
      (draft) => { draft.evidence[0].observation = "Participant Jane Doe struggled with the flow."; },
      "participant_identifier_leak",
    ],
    [
      "evidence[0].observation attributed full name",
      (draft) => { draft.evidence[0].observation = "Jane Doe explained the confusion in detail."; },
      "participant_identifier_leak",
    ],
    [
      "evidence[0].observation contacted full name",
      (draft) => { draft.evidence[0].observation = "We followed up with Jane Doe after the session."; },
      "participant_identifier_leak",
    ],
    [
      "evidence[0].observation per full name",
      (draft) => { draft.evidence[0].observation = "Per Jane Doe, the label was unclear."; },
      "participant_identifier_leak",
    ],
    [
      "evidence[0].quote",
      (draft) => { draft.evidence[0].quote = "Contact me at jane.doe@example.com if this fails."; },
      "participant_identifier_leak",
    ],
    ["themes[0].name", (draft) => { draft.themes[0].name = "Jane Doe"; }, "participant_identifier_leak"],
    [
      "themes[0].contradictionNote",
      (draft) => { draft.themes[0].contradictionNote = "Reach Jane Doe at 555-123-4567 for detail."; },
      "participant_identifier_leak",
    ],
    [
      "decisionQuestions[0].question",
      (draft) => { draft.decisionQuestions[0].question = "Should we email jane.doe@example.com about this placement?"; },
      "participant_identifier_leak",
    ],
    [
      "decisionQuestions[0].decisionNote",
      // decisionNote's leak check is folded into isQuestionResolved's
      // boolean gate rather than emitted as a standalone finding, so a
      // leaked decisionNote surfaces as premature_question_resolution.
      (draft) => { draft.decisionQuestions[0].decisionNote = "Approved after confirming at 555-123-4567."; },
      "premature_question_resolution",
    ],
    [
      "limitations[0]",
      (draft) => { draft.limitations[0] = "Findings depend on reaching jane.doe@example.com."; },
      "participant_identifier_leak",
    ],
    [
      "handoff.summary",
      (draft) => { draft.handoff.summary = "Synthesis is ready; reach out to 555-123-4567 with questions."; },
      "participant_identifier_leak",
    ],
  ];
  for (const [label, mutate, expectedCode] of cases) {
    const draft = clone();
    mutate(draft);
    assert.equal(isValid(draft), false, `expected leaked identifier at ${label} to be rejected`);
    const findings = validateArtifactSemantics("ux-research-synthesizer", draft);
    assert.ok(
      findings.some((item) => item.code === expectedCode),
      `expected ${expectedCode} finding for ${label}`,
    );
  }
});

test("research synthesis validator does not mistake ordinary capitalized phrases for participant names", () => {
  const ordinaryPhrase = clone();
  ordinaryPhrase.handoff.summary =
    "Synthesis is ready for product review in New York; no participant identification occurred.";
  const findings = validateArtifactSemantics("ux-research-synthesizer", ordinaryPhrase);
  assert.ok(!findings.some((item) => item.code === "participant_identifier_leak"));
  assert.deepEqual(findings, []);
});

test("research synthesis validator does not downgrade incomplete hybrid records to legacy semantics", () => {
  const incomplete = {
    ...clone(),
    evidenceId: "legacy-evidence-1",
    observation: "A minimized observation.",
    theme: "Navigation",
    confidence: "high",
  };
  delete incomplete.handoff;
  assert.equal(validateSchema(incomplete), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("ux-research-synthesizer", incomplete));
  assert.equal(isValid(incomplete), false);
  assert.ok(validateArtifactSemantics("ux-research-synthesizer", incomplete).length > 0);
});

test("research synthesis validator rejects a future source capture timestamp (after the study's asOfDate)", () => {
  const futureCapture = clone();
  futureCapture.sources.find((item) => item.id === "source-p3").capturedAt = "2026-09-15T00:00:00Z";
  assert.equal(isValid(futureCapture), false);
  const findings = validateArtifactSemantics("ux-research-synthesizer", futureCapture);
  assert.ok(findings.some((item) => item.code === "future_capture_timestamp"));
});

test("research synthesis validator rejects missing limitation/uncertainty coverage", () => {
  const noLimitations = clone();
  noLimitations.limitations = [];
  assert.equal(isValid(noLimitations), false);
  const findings = validateArtifactSemantics("ux-research-synthesizer", noLimitations);
  assert.ok(findings.some((item) => item.code === "missing_limitation_coverage"));
});

test("research synthesis validator rejects a malformed/empty controlled source provenance reference", () => {
  const emptyControlled = clone();
  emptyControlled.sources.find((item) => item.id === "source-p1").provenanceRef = "controlled://";
  assert.equal(isValid(emptyControlled), false);
  const findings = validateArtifactSemantics("ux-research-synthesizer", emptyControlled);
  assert.ok(findings.some((item) => item.code === "untrusted_source_provenance"));
});

test("research synthesis validator rejects an empty ledger claiming a ready handoff state", () => {
  const emptyLedger = clone();
  emptyLedger.sources = [];
  emptyLedger.evidence = [];
  emptyLedger.themes = [];
  emptyLedger.decisionQuestions = [];
  emptyLedger.limitations = [];
  emptyLedger.handoff.sourceRefs = [];
  emptyLedger.handoff.themeRefs = [];
  emptyLedger.handoff.openQuestionRefs = [];
  emptyLedger.handoff.state = "blocked";
  const blockedFindings = validateArtifactSemantics("ux-research-synthesizer", emptyLedger);
  assert.ok(!blockedFindings.some((item) => item.code === "premature_ready_state"));

  const readyLedger = clone(emptyLedger);
  readyLedger.handoff.state = "ready";
  assert.equal(isValid(readyLedger), false);
  const readyFindings = validateArtifactSemantics("ux-research-synthesizer", readyLedger);
  assert.ok(readyFindings.some((item) => item.code === "premature_ready_state"));
});

test("research synthesis validator requires an open (unresolved) decision question to keep the handoff blocked", () => {
  const openQuestion = clone();
  const question = openQuestion.decisionQuestions.find((item) => item.id === "question-backup-codes-placement");
  question.status = "open";
  delete question.answeredBy;
  delete question.answeredAt;
  delete question.decisionNote;
  openQuestion.handoff.openQuestionRefs = ["question-backup-codes-placement"];
  openQuestion.handoff.state = "blocked";
  assert.deepEqual(validateArtifactSemantics("ux-research-synthesizer", openQuestion), []);

  const prematureReady = clone(openQuestion);
  prematureReady.handoff.state = "ready";
  assert.equal(isValid(prematureReady), false);
  const findings = validateArtifactSemantics("ux-research-synthesizer", prematureReady);
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("research synthesis validator rejects a study lacking confirmed consent or participant minimization", () => {
  const withdrawnConsent = clone();
  withdrawnConsent.study.consentStatus = "withdrawn";
  assert.equal(isValid(withdrawnConsent), false);
  assert.ok(
    validateArtifactSemantics("ux-research-synthesizer", withdrawnConsent).some(
      (item) => item.code === "premature_ready_state",
    ),
  );

  const noMinimization = clone();
  noMinimization.study.participantMinimizationApplied = false;
  assert.equal(isValid(noMinimization), false);
  assert.ok(
    validateArtifactSemantics("ux-research-synthesizer", noMinimization).some(
      (item) => item.code === "participant_minimization_not_applied",
    ),
  );
});

test("research synthesis validator rejects a blank handoff owner and the exact package self-attestation identity", () => {
  const blankOwner = clone();
  blankOwner.handoff.owner = "   ";
  assert.equal(isValid(blankOwner), false);
  assert.ok(
    validateArtifactSemantics("ux-research-synthesizer", blankOwner).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );

  const packageOwner = clone();
  packageOwner.handoff.owner = "UX Research Synthesizer";
  assert.equal(isValid(packageOwner), false);
  assert.ok(
    validateArtifactSemantics("ux-research-synthesizer", packageOwner).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );
});

test("research synthesis validator rejects an unauthorized narrative claim of contacting a participant", () => {
  const narrative = clone();
  narrative.handoff.summary = "We contacted the participant to confirm follow-up availability.";
  assert.equal(isValid(narrative), false);
  const findings = validateArtifactSemantics("ux-research-synthesizer", narrative);
  assert.ok(findings.some((item) => item.code === "unauthorized_narrative_action"));
});

// A HEAD-authored artifact predating the ledger contract: the exact
// pre-checkpoint-3 single-observation shape (evidenceId/observation/theme/
// confidence, no study/sources/themes/decisionQuestions/etc.).
const legacyResearchEvidence = {
  evidenceId: "obs-legacy-001",
  observation: "Participant struggled to locate the settings menu during onboarding.",
  theme: "Navigation discoverability",
  confidence: "medium",
};

test("research evidence schema preserves the original HEAD legacy single-observation shape as a distinct anyOf branch", () => {
  assert.equal(validateSchema(legacyResearchEvidence), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("ux-research-synthesizer", legacyResearchEvidence), []);

  // The anyOf legacy branch is schemaVersion-agnostic (exactly like the
  // original HEAD schema), so a legacy-shaped document combined with an
  // arbitrary "schemaVersion" marker remains schema-valid -- HEAD would
  // have accepted it, and this schema must too. Semantic dispatch must
  // still treat it as legacy (bounded semantics) because it lacks the
  // complete enriched required shape.
  const bothShapesAtOnce = { ...legacyResearchEvidence, schemaVersion: "awesomeClaws.researchEvidence.v1" };
  assert.equal(validateSchema(bothShapesAtOnce), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("ux-research-synthesizer", bothShapesAtOnce), []);

  for (const field of Object.keys(legacyResearchEvidence)) {
    const incomplete = { ...legacyResearchEvidence };
    delete incomplete[field];
    assert.equal(
      validateSchema(incomplete),
      false,
      `expected legacy shape missing "${field}" to fail schema validation`,
    );
  }
});

test("research synthesis validator dispatches an overlapping legacy+enriched artifact to the full enriched contract", () => {
  const overlap = { ...clone(), ...legacyResearchEvidence };
  assert.equal(validateSchema(overlap), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("ux-research-synthesizer", overlap), []);
});

test("research synthesis validator applies bounded legacy semantics without requiring ledger-only fields", () => {
  const blankField = { ...legacyResearchEvidence, observation: "   " };
  assert.equal(validateSchema(blankField), true, JSON.stringify(validateSchema.errors));
  assert.ok(
    validateArtifactSemantics("ux-research-synthesizer", blankField).some(
      (item) => item.code === "invalid_legacy_field",
    ),
  );

  const unknownConfidence = { ...legacyResearchEvidence, confidence: "extreme" };
  assert.equal(validateSchema(unknownConfidence), true, JSON.stringify(validateSchema.errors));
  assert.ok(
    validateArtifactSemantics("ux-research-synthesizer", unknownConfidence).some(
      (item) => item.code === "invalid_legacy_confidence",
    ),
  );
});

test("validate-artifact CLI accepts the packaged ux-research-synthesizer fixture", () => {
  const result = spawnSync(
    process.execPath,
    [resolve(root, "scripts", "validate-artifact.mjs"), "ux-research-synthesizer", fixturePath],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.valid, true);
  assert.deepEqual(output.semanticFindings, []);
});

test("validate-artifact CLI accepts an exact HEAD legacy research evidence artifact", async () => {
  const scratchDir = resolve(root, ".tmp");
  const scratchPath = resolve(scratchDir, `ux-research-synthesizer-legacy-cli-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(scratchPath, `${JSON.stringify(legacyResearchEvidence, null, 2)}\n`);
  try {
    const result = spawnSync(
      process.execPath,
      [resolve(root, "scripts", "validate-artifact.mjs"), "ux-research-synthesizer", scratchPath],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.valid, true);
    assert.deepEqual(output.schemaErrors, []);
    assert.deepEqual(output.semanticFindings, []);
  } finally {
    await rm(scratchPath, { force: true });
  }
});

test("validate-artifact CLI reports semantic findings for a premature-ready research synthesis artifact", async () => {
  const prematureReady = clone();
  prematureReady.study.consentStatus = "withdrawn";
  assert.equal(validateSchema(prematureReady), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(prematureReady), false);
  const scratchDir = resolve(root, ".tmp");
  const scratchPath = resolve(scratchDir, `ux-research-synthesizer-cli-negative-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(scratchPath, `${JSON.stringify(prematureReady, null, 2)}\n`);
  try {
    const { NODE_TEST_CONTEXT: _nodeTestContext, ...childEnv } = process.env;
    const result = spawnSync(
      process.execPath,
      [resolve(root, "scripts", "validate-artifact.mjs"), "ux-research-synthesizer", scratchPath],
      { cwd: root, encoding: "utf8", env: childEnv },
    );
    assert.equal(result.status, 1, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.schemaErrors.length, 0);
    assert.equal(output.valid, false);
    assert.equal(
      output.semanticFindings.some((finding) => finding.code === "premature_ready_state"),
      true,
    );
  } finally {
    await rm(scratchPath, { force: true });
  }
});
