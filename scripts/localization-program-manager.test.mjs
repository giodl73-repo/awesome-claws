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
    "../claws/localization-program-manager/fixtures/locale-readiness.example.json",
    import.meta.url,
  ),
);
const schema = JSON.parse(
  await readFile(
    new URL("../claws/localization-program-manager/schemas/locale-readiness.schema.json", import.meta.url),
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
    validateArtifactSemantics("localization-program-manager", value).length === 0
  );
}

test("locale readiness fixture keeps locale, translation, defect, and recommendation data consistent", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("localization-program-manager", fixture), []);
});

test("localization validator is total over schema-valid malformed nested records", () => {
  for (const field of [
    "principals",
    "locales",
    "surfaces",
    "sourceStrings",
    "translationTasks",
    "translations",
    "evidence",
    "defects",
    "terminology",
  ]) {
    const malformed = clone();
    malformed[field].push({});
    assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
    assert.doesNotThrow(() => validateArtifactSemantics("localization-program-manager", malformed));
    assert.equal(isValid(malformed), false, field);
  }
});

// Malforming a required enriched field's array type (e.g. setting it to a
// bare object) breaks the enriched anyOf branch, and this schema's legacy
// branch shares "release" and "locales" field names with the enriched branch
// (deliberately excluded from enriched dispatch since every legacy document
// already carries both), so overlay the exact legacy required fields to keep
// the document validating via the legacy anyOf branch while the target
// enriched field is malformed; enriched semantic dispatch still fires
// because other enriched-only properties (owner, handoff, etc.) remain
// present.
function withLegacyOverlay(value) {
  return {
    ...value,
    release: "Legacy release note kept only to satisfy the legacy anyOf branch's required string type.",
    sourceLocale: "en-US",
  };
}

test("localization validator rejects non-array required ledgers", () => {
  for (const field of [
    "principals",
    "surfaces",
    "sourceStrings",
    "translationTasks",
    "translations",
    "evidence",
    "defects",
    "terminology",
  ]) {
    const malformed = withLegacyOverlay(clone());
    malformed[field] = {};
    assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
    assert.doesNotThrow(() => validateArtifactSemantics("localization-program-manager", malformed));
    assert.ok(
      validateArtifactSemantics("localization-program-manager", malformed).some(
        (item) => item.code === "invalid_array_list" && item.path === field,
      ),
      `expected invalid_array_list for ${field}`,
    );
  }
});

test("localization validator handles a non-array prohibitedActions without throwing", () => {
  const malformed = clone();
  malformed.handoff.prohibitedActions = {};
  assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("localization-program-manager", malformed));
  const findings = validateArtifactSemantics("localization-program-manager", malformed);
  assert.ok(findings.some((item) => item.code === "invalid_string_list"));
});

test("localization validator keeps the handoff blocked when recommendation is null or an incomplete object", () => {
  const nullRecommendation = clone();
  nullRecommendation.recommendation = null;
  assert.equal(validateSchema(nullRecommendation), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(nullRecommendation), false);
  assert.ok(
    validateArtifactSemantics("localization-program-manager", nullRecommendation).some(
      (item) => item.code === "premature_ready_state",
    ),
  );

  const emptyRecommendation = clone();
  emptyRecommendation.recommendation = {};
  assert.equal(validateSchema(emptyRecommendation), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(emptyRecommendation), false);
  assert.ok(
    validateArtifactSemantics("localization-program-manager", emptyRecommendation).some(
      (item) => item.code === "premature_ready_state",
    ),
  );
});

test("localization validator does not downgrade a malformed enriched owner field to legacy semantics", () => {
  const malformed = withLegacyOverlay(clone());
  malformed.owner = 42;
  assert.equal(validateSchema(malformed), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("localization-program-manager", malformed));
  assert.equal(isValid(malformed), false);
  assert.ok(
    validateArtifactSemantics("localization-program-manager", malformed).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );
});

test("localization validator fails closed on a hybrid record that satisfies the legacy branch but has a partially deleted enriched shape", () => {
  // A document can carry the exact HEAD legacy required fields (which the
  // legacy anyOf branch accepts regardless of any other properties present)
  // alongside most, but not all, of the enriched contract. Semantic dispatch
  // must still recognize the surviving enriched-only properties (owner,
  // handoff, etc.) and fail closed on the missing "principals" ledger rather
  // than silently accepting the now schema-valid-via-legacy-branch document.
  const hybrid = clone();
  delete hybrid.principals;
  hybrid.release = "legacy release note";
  hybrid.sourceLocale = "en-US";
  assert.equal(validateSchema(hybrid), true, JSON.stringify(validateSchema.errors));
  assert.doesNotThrow(() => validateArtifactSemantics("localization-program-manager", hybrid));
  assert.equal(isValid(hybrid), false);
  const findings = validateArtifactSemantics("localization-program-manager", hybrid);
  assert.ok(findings.some((item) => item.code === "invalid_array_list" && item.path === "principals"));
});

test("localization validator requires the exact enriched schema version", () => {
  const unknownVersion = clone();
  unknownVersion.schemaVersion = "bogus-future-version";
  assert.equal(validateSchema(unknownVersion), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(unknownVersion), false);
  const findings = validateArtifactSemantics("localization-program-manager", unknownVersion);
  assert.ok(
    findings.some((item) => item.code === "invalid_schema_version" && item.path === "schemaVersion"),
  );
  assert.ok(findings.some((item) => item.code === "premature_localization_recommendation"));
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("localization validator rejects a translation grounded in evidence from a different source snapshot (cross-snapshot evidence)", () => {
  const crossSnapshot = clone();
  crossSnapshot.evidence.find(
    (item) => item.id === "evidence-fr-total-qa",
  ).sourceSnapshotRef = "snapshot-2026-08-24-en-us";
  assert.equal(isValid(crossSnapshot), false);
  const findings = validateArtifactSemantics("localization-program-manager", crossSnapshot);
  assert.ok(findings.some((item) => item.code === "unsupported_translation"));
  assert.ok(findings.some((item) => item.code === "cross_scope_evidence"));
});

test("localization validator binds each translation to its task locale and source string", () => {
  const crossTask = clone();
  crossTask.translations.find((item) => item.id === "translation-fr-total").taskRef =
    "task-de-retry";
  assert.equal(isValid(crossTask), false);
  const findings = validateArtifactSemantics("localization-program-manager", crossTask);
  assert.ok(findings.some((item) => item.code === "cross_scope_translation_task"));
  assert.ok(findings.some((item) => item.code === "incomplete_locale_coverage"));
  assert.ok(findings.some((item) => item.code === "premature_localization_recommendation"));
});

test("localization validator rejects colliding missing record ids and references", () => {
  const missingIdentity = clone();
  delete missingIdentity.locales[0].id;
  delete missingIdentity.translationTasks[0].localeRef;
  assert.equal(validateSchema(missingIdentity), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(missingIdentity), false);
  const findings = validateArtifactSemantics("localization-program-manager", missingIdentity);
  assert.ok(
    findings.some((item) => item.code === "invalid_array_record" && item.path === "locales[0].id"),
  );
  assert.ok(
    findings.some(
      (item) => item.code === "dangling_reference" && item.path === "translationTasks[0].localeRef",
    ),
  );
  assert.ok(findings.some((item) => item.code === "premature_localization_recommendation"));
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("localization validator rejects a handoff recommendation while a locale's string is not covered", () => {
  const untested = clone();
  untested.translations = untested.translations.filter((item) => item.id !== "translation-de-retry");
  assert.equal(isValid(untested), false);
  const findings = validateArtifactSemantics("localization-program-manager", untested);
  assert.ok(findings.some((item) => item.code === "incomplete_locale_coverage"));
  assert.ok(findings.some((item) => item.code === "premature_localization_recommendation"));
});

test("localization validator rejects a translation that drops a required placeholder", () => {
  const droppedPlaceholder = clone();
  droppedPlaceholder.translations.find((item) => item.id === "translation-de-total").text = "Fälliger Betrag";
  assert.equal(isValid(droppedPlaceholder), false);
  const findings = validateArtifactSemantics("localization-program-manager", droppedPlaceholder);
  assert.ok(findings.some((item) => item.code === "placeholder_not_preserved"));
  assert.ok(findings.some((item) => item.code === "incomplete_locale_coverage"));
});

test("localization validator rejects a translation that abandons the approved glossary term", () => {
  const wrongTerm = clone();
  wrongTerm.translations.find((item) => item.id === "translation-de-retry").text = "Zahlung wiederholen";
  assert.equal(isValid(wrongTerm), false);
  const findings = validateArtifactSemantics("localization-program-manager", wrongTerm);
  assert.ok(findings.some((item) => item.code === "terminology_violation"));
  assert.ok(findings.some((item) => item.code === "incomplete_locale_coverage"));
});

test("localization validator rejects an open blocker-severity defect", () => {
  const openBlocker = clone();
  openBlocker.defects.push({
    id: "defect-blocker-open",
    translationRef: "translation-fr-total",
    kind: "markup-break",
    severity: "blocker",
    status: "open",
    foundAt: "2026-08-26T09:10:00Z",
  });
  assert.equal(isValid(openBlocker), false);
  const findings = validateArtifactSemantics("localization-program-manager", openBlocker);
  assert.ok(findings.some((item) => item.code === "unresolved_localization_defect"));
  assert.ok(findings.some((item) => item.code === "premature_localization_recommendation"));
});

test("localization validator blocks handoff while major or minor defects remain unresolved", () => {
  for (const [severity, status] of [
    ["major", "open"],
    ["minor", "fixed"],
  ]) {
    const unresolved = clone();
    unresolved.defects.push({
      id: `defect-${severity}-${status}`,
      translationRef: "translation-fr-total",
      kind: "truncation",
      severity,
      status,
      foundAt: "2026-08-26T09:10:00Z",
    });
    assert.equal(isValid(unresolved), false);
    const findings = validateArtifactSemantics("localization-program-manager", unresolved);
    assert.ok(findings.some((item) => item.code === "unresolved_localization_defect"));
    assert.ok(findings.some((item) => item.code === "premature_localization_recommendation"));
    assert.ok(findings.some((item) => item.code === "premature_ready_state"));
  }
});

test("localization validator rejects a defect verified by the same principal who produced the translation (self-verification)", () => {
  const selfVerified = clone();
  const defect = selfVerified.defects.find((item) => item.id === "defect-de-retry-terminology");
  defect.verifiedById = "principal-translator-de";
  assert.equal(isValid(selfVerified), false);
  const findings = validateArtifactSemantics("localization-program-manager", selfVerified);
  assert.ok(findings.some((item) => item.code === "self_verified_defect"));
});

test("localization validator rejects defect verification evidence bound to a different translation", () => {
  const crossTranslation = clone();
  crossTranslation.evidence.find(
    (item) => item.id === "evidence-de-retry-defect-verification",
  ).translationRef = "translation-de-total";
  assert.equal(isValid(crossTranslation), false);
  assert.ok(
    validateArtifactSemantics("localization-program-manager", crossTranslation).some(
      (item) => item.code === "unsupported_defect_verification",
    ),
  );
});

test("localization validator rejects defect verification evidence from another source version", () => {
  const staleVerification = clone();
  staleVerification.evidence.find(
    (item) => item.id === "evidence-de-retry-defect-verification",
  ).sourceVersion = "strings-v41";
  assert.equal(isValid(staleVerification), false);
  const findings = validateArtifactSemantics("localization-program-manager", staleVerification);
  assert.ok(findings.some((item) => item.code === "cross_scope_evidence"));
  assert.ok(findings.some((item) => item.code === "unsupported_defect_verification"));
  assert.ok(findings.some((item) => item.code === "premature_localization_recommendation"));
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("localization validator rejects verification evidence reused for another defect", () => {
  const crossDefect = clone();
  crossDefect.defects.find((item) => item.id === "defect-de-retry-terminology").id =
    "defect-de-retry-other";
  assert.equal(isValid(crossDefect), false);
  assert.ok(
    validateArtifactSemantics("localization-program-manager", crossDefect).some(
      (item) => item.code === "unsupported_defect_verification",
    ),
  );
});

test("localization validator rejects defect verification asserted after the recorded verification time", () => {
  const prematureVerification = clone();
  prematureVerification.defects[0].verifiedAt = "2026-08-26T10:00:00Z";
  assert.equal(isValid(prematureVerification), false);
  const findings = validateArtifactSemantics("localization-program-manager", prematureVerification);
  assert.ok(findings.some((item) => item.code === "unsupported_defect_verification"));
  assert.ok(findings.some((item) => item.code === "premature_localization_recommendation"));
  assert.ok(findings.some((item) => item.code === "premature_ready_state"));
});

test("localization validator rejects a recommendation signed before its grounding evidence", () => {
  const earlyRecommendation = clone();
  earlyRecommendation.evidence.find(
    (item) => item.id === "evidence-de-retry-qa",
  ).assertedAt = "2026-08-26T13:00:00Z";
  assert.equal(isValid(earlyRecommendation), false);
  assert.ok(
    validateArtifactSemantics("localization-program-manager", earlyRecommendation).some(
      (item) => item.code === "premature_localization_recommendation",
    ),
  );
});

test("localization validator rejects an arbitrary, unregistered recommendation reviewer", () => {
  const arbitraryReviewer = clone();
  arbitraryReviewer.recommendation.reviewerId = "principal-ghost";
  assert.equal(isValid(arbitraryReviewer), false);
  const findings = validateArtifactSemantics("localization-program-manager", arbitraryReviewer);
  assert.ok(findings.some((item) => item.code === "dangling_reference"));
  assert.ok(findings.some((item) => item.code === "premature_localization_recommendation"));
});

test("localization validator rejects evidence asserted before the release was requested (stale evidence)", () => {
  const stale = clone();
  stale.evidence.find((item) => item.id === "evidence-fr-total-qa").assertedAt = "2026-08-01T00:00:00Z";
  assert.equal(isValid(stale), false);
  const findings = validateArtifactSemantics("localization-program-manager", stale);
  assert.ok(findings.some((item) => item.code === "stale_evidence"));
});

test("localization validator rejects evidence asserted in the future", () => {
  const future = clone();
  future.evidence.find((item) => item.id === "evidence-fr-total-qa").assertedAt = "2099-01-01T00:00:00Z";
  assert.equal(isValid(future), false);
  const findings = validateArtifactSemantics("localization-program-manager", future);
  assert.ok(findings.some((item) => item.code === "future_evidence"));
});

test("localization validator rejects evidence asserted before the translation it grounds (out-of-order evidence)", () => {
  const outOfOrder = clone();
  outOfOrder.evidence.find((item) => item.id === "evidence-fr-total-qa").assertedAt = "2026-08-26T08:00:00Z";
  assert.equal(isValid(outOfOrder), false);
  const findings = validateArtifactSemantics("localization-program-manager", outOfOrder);
  assert.ok(findings.some((item) => item.code === "unsupported_translation"));
});

test("localization validator rejects an empty locale portfolio recommended for handoff (vacuous ready state)", () => {
  const vacuous = clone();
  vacuous.locales = [];
  vacuous.translationTasks = [];
  vacuous.translations = [];
  assert.equal(isValid(vacuous), false);
  const findings = validateArtifactSemantics("localization-program-manager", vacuous);
  assert.ok(findings.some((item) => item.code === "incomplete_locale_coverage"));
  assert.ok(findings.some((item) => item.code === "premature_localization_recommendation"));
});

test("localization validator rejects a missing release source scope", () => {
  const unscoped = clone();
  delete unscoped.release.sourceVersion;
  delete unscoped.release.sourceSnapshotRef;
  assert.equal(validateSchema(unscoped), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(unscoped), false);
  const findings = validateArtifactSemantics("localization-program-manager", unscoped);
  assert.ok(findings.some((item) => item.code === "invalid_source_scope"));
  assert.ok(findings.some((item) => item.code === "premature_localization_recommendation"));
});

test("localization validator requires a stable owner principal id", () => {
  const missingOwnerId = clone();
  delete missingOwnerId.ownerId;
  assert.equal(isValid(missingOwnerId), false);
  assert.ok(
    validateArtifactSemantics("localization-program-manager", missingOwnerId).some(
      (item) => item.code === "agent_owned_authority" && item.path === "ownerId",
    ),
  );
});

test("localization validator rejects a blank owner and the exact package self-attestation identity 'Localization Program Manager'", () => {
  const blankOwner = clone();
  blankOwner.owner = "   ";
  assert.equal(isValid(blankOwner), false);
  assert.ok(
    validateArtifactSemantics("localization-program-manager", blankOwner).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );

  const packageOwner = clone();
  packageOwner.handoff.owner = "Localization Program Manager";
  assert.equal(isValid(packageOwner), false);
  assert.ok(
    validateArtifactSemantics("localization-program-manager", packageOwner).some(
      (item) => item.code === "agent_owned_authority",
    ),
  );
});

test("localization validator allows an accountable human whose title is Localization Program Manager", () => {
  const titledHuman = clone();
  titledHuman.principals.find((item) => item.id === titledHuman.ownerId).name =
    "Jordan Blake, Localization Program Manager";
  titledHuman.owner = "Jordan Blake, Localization Program Manager";
  titledHuman.handoff.owner = "Jordan Blake, Localization Program Manager";
  assert.equal(validateSchema(titledHuman), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(titledHuman), true);
});

test("localization validator rejects an unauthorized narrative claim of publishing the strings", () => {
  const narrative = clone();
  narrative.handoff.summary = "We published the strings to production this morning.";
  assert.equal(isValid(narrative), false);
  const findings = validateArtifactSemantics("localization-program-manager", narrative);
  assert.ok(findings.some((item) => item.code === "unauthorized_narrative_action"));
});

test("localization validator requires every prohibited handoff action to remain listed", () => {
  const shortened = clone();
  shortened.handoff.prohibitedActions = shortened.handoff.prohibitedActions.filter(
    (action) => action !== "claim-linguistic-certification",
  );
  assert.equal(isValid(shortened), false);
  const findings = validateArtifactSemantics("localization-program-manager", shortened);
  assert.ok(findings.some((item) => item.code === "missing_authority_gate"));
});

// A HEAD-authored artifact predating the enriched locale-readiness ledger:
// the exact pre-checkpoint bare triple (release/sourceLocale/locales, no
// principals/translations/evidence/handoff/etc.).
const legacyLocaleReadiness = {
  release: "Q3 mobile checkout localization",
  sourceLocale: "en-US",
  locales: ["fr-FR", "de-DE", "ja-JP"],
};

test("locale readiness schema preserves the original HEAD legacy single-record shape as a distinct anyOf branch", () => {
  assert.equal(validateSchema(legacyLocaleReadiness), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("localization-program-manager", legacyLocaleReadiness), []);

  // The anyOf legacy branch is schemaVersion-agnostic (exactly like the
  // original HEAD schema), so a legacy-shaped document combined with an
  // arbitrary "schemaVersion" marker remains schema-valid -- HEAD would
  // have accepted it, and this schema must too. Semantic dispatch must
  // still treat it as legacy (bounded semantics) because it carries no
  // other enriched-only property.
  const bothShapesAtOnce = { ...legacyLocaleReadiness, schemaVersion: "awesomeClaws.localeReadiness.v1" };
  assert.equal(validateSchema(bothShapesAtOnce), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(validateArtifactSemantics("localization-program-manager", bothShapesAtOnce), []);

  for (const field of Object.keys(legacyLocaleReadiness)) {
    const incomplete = { ...legacyLocaleReadiness };
    delete incomplete[field];
    assert.equal(
      validateSchema(incomplete),
      false,
      `expected legacy shape missing "${field}" to fail schema validation`,
    );
  }
});

test("localization validator applies bounded legacy semantics without requiring enriched-only fields", () => {
  const blankField = { ...legacyLocaleReadiness, sourceLocale: "   " };
  assert.equal(validateSchema(blankField), true, JSON.stringify(validateSchema.errors));
  assert.ok(
    validateArtifactSemantics("localization-program-manager", blankField).some(
      (item) => item.code === "invalid_legacy_field",
    ),
  );

  const nonArrayLocales = { ...legacyLocaleReadiness, locales: "fr-FR,de-DE" };
  assert.equal(validateSchema(nonArrayLocales), false);
});

test("validate-artifact CLI accepts the packaged localization-program-manager fixture", () => {
  const result = spawnSync(
    process.execPath,
    [resolve(root, "scripts", "validate-artifact.mjs"), "localization-program-manager", fixturePath],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.valid, true);
  assert.deepEqual(output.semanticFindings, []);
});

test("validate-artifact CLI accepts an exact HEAD legacy locale readiness artifact", async () => {
  const scratchDir = resolve(root, ".tmp");
  const scratchPath = resolve(scratchDir, `localization-program-manager-legacy-cli-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(scratchPath, `${JSON.stringify(legacyLocaleReadiness, null, 2)}\n`);
  try {
    const result = spawnSync(
      process.execPath,
      [resolve(root, "scripts", "validate-artifact.mjs"), "localization-program-manager", scratchPath],
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

test("validate-artifact CLI reports semantic findings for a premature handoff recommendation artifact", async () => {
  const prematureRecommendation = clone();
  prematureRecommendation.defects.push({
    id: "defect-blocker-open",
    translationRef: "translation-fr-total",
    kind: "markup-break",
    severity: "blocker",
    status: "open",
    foundAt: "2026-08-26T09:10:00Z",
  });
  assert.equal(validateSchema(prematureRecommendation), true, JSON.stringify(validateSchema.errors));
  assert.equal(isValid(prematureRecommendation), false);
  const scratchDir = resolve(root, ".tmp");
  const scratchPath = resolve(scratchDir, `localization-program-manager-cli-negative-${process.pid}.json`);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(scratchPath, `${JSON.stringify(prematureRecommendation, null, 2)}\n`);
  try {
    const { NODE_TEST_CONTEXT: _nodeTestContext, ...childEnv } = process.env;
    const result = spawnSync(
      process.execPath,
      [resolve(root, "scripts", "validate-artifact.mjs"), "localization-program-manager", scratchPath],
      { cwd: root, encoding: "utf8", env: childEnv },
    );
    assert.equal(result.status, 1, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.schemaErrors.length, 0);
    assert.equal(output.valid, false);
    assert.equal(
      output.semanticFindings.some((finding) => finding.code === "premature_localization_recommendation"),
      true,
    );
  } finally {
    await rm(scratchPath, { force: true });
  }
});
