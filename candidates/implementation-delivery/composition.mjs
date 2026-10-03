import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "../../scripts/artifact-semantics.mjs";

export const root = new URL("../../", import.meta.url);
export const json = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
export const digest = (value) => createHash("sha256").update(JSON.stringify(value) ?? "undefined").digest("hex");
export const owners = {
  project: ["project-manager", "project-state"],
  integration: ["api-integration-engineer", "integration-readiness"],
  migration: ["data-migration-planner", "mapping"],
  maintainer: ["software-maintainer", "change-delivery-record"],
  qa: ["quality-assurance-lead", "test-evidence"],
};
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validators = Object.fromEntries(await Promise.all(Object.entries(owners).map(async ([key, [id, stem]]) => [key, ajv.compile(await json(`sources/${id}/schemas/${stem}.schema.json`))])));

export function validateOwners(artifacts) {
  const gaps = [];
  for (const [key, [id]] of Object.entries(owners)) {
    const value = artifacts?.[key];
    if (!validators[key](value)) {
      gaps.push(`${key}: schema ${JSON.stringify(validators[key].errors)}`);
      continue;
    }
    try {
      gaps.push(...validateArtifactSemantics(id, value).map((f) => `${key}: ${f.code}`));
    } catch { gaps.push(`${key}: malformed owner artifact`); }
  }
  return gaps;
}

// This is an exact, supplied-artifact experiment, not a new coordinator or a
// general proof of identity, source authenticity, arbitrary prose or deployment.
export function compose(intake, artifacts, receipt, currentAdapterSourceDigest) {
  const gaps = validateOwners(artifacts);
  if (!receipt || receipt.intakeDigest !== digest(intake)) gaps.push("Intake/mapping/runbook changed; refresh evidence.");
  if (!receipt || receipt.adapterSourceDigest !== currentAdapterSourceDigest) gaps.push("Adapter changed; old results cannot be reused.");
  for (const key of Object.keys(owners)) {
    if (receipt?.ownerDigests?.[key] !== digest(artifacts?.[key])) gaps.push(`${key}: supplied artifact changed; refresh evidence.`);
  }
  if (gaps.length) return { state: "blocked", gaps, deployment: "not-authorized", support: "acceptance-pending" };
  const { project, integration, migration, maintainer, qa } = artifacts;
  const currentAdapterRevision = receipt.adapterRevision;
  if (project.project !== intake.project || !isDeepStrictEqual(project.scope.acceptanceCriteria, intake.requirements.map((r) => `${r.id}: ${r.description}`))) gaps.push("Project requirement coverage differs.");
  if (integration.integration.repository !== intake.repository || maintainer.repository.identity !== intake.repository) gaps.push("Repository identity differs across owners.");
  if (integration.integration.targetCommit !== currentAdapterRevision || maintainer.repository.headRevision !== currentAdapterRevision || qa.release.buildId !== currentAdapterRevision) gaps.push("Owner outputs are not for the same adapter revision.");
  if (integration.integration.environment !== intake.environment || qa.release.environment !== intake.environment) gaps.push("Owner environments differ.");
  if (integration.integration.snapshotRef !== intake.sourceSnapshot || migration.systems.source.snapshotId !== intake.sourceSnapshot || migration.systems.target.snapshotId !== intake.targetSnapshot || migration.systems.source.id !== intake.sourceSystem || migration.systems.target.id !== intake.targetSystem || migration.sourceVersion !== intake.sourceVersion || migration.targetVersion !== intake.targetVersion) gaps.push("Source/target identities or versions differ.");
  for (const [field, target] of [["userId", "assigneeId"], ["status", "state"]]) {
    if (!migration.requiredFields.includes(field) || !migration.mappings.some((m) => m.sourceField === field && m.targetField === target && m.required === true)) gaps.push(`Missing required mapping: ${field}.`);
  }
  if (!isDeepStrictEqual(migration.mappings.map((m) => m.lookup), [intake.mappings.users, intake.mappings.statuses])) gaps.push("Mapping values differ from the owner's supplied tables.");
  if (!isDeepStrictEqual(qa.requirements.map((r) => r.id), intake.requirements.map((r) => r.id))) gaps.push("QA requirement coverage differs.");
  for (const r of intake.requirements) {
    const criterion = maintainer.acceptanceCriteria.find((c) => c.id === r.id.replace("req-", "criterion-"));
    if (!criterion || criterion.state !== "met" || !criterion.verificationRefs.length) gaps.push(`Maintainer acceptance missing: ${r.id}.`);
    if (!receipt.acceptance?.some((t) => t.requirementId === r.id && t.result === "passed")) gaps.push(`Local acceptance missing: ${r.id}.`);
  }
  if (intake.cutover.state !== "draft-not-executed" || !isDeepStrictEqual(intake.cutover.steps.map((s) => s.id), ["authorize", "freeze", "snapshot", "rehearse", "switch", "observe", "handover"])) gaps.push("Ordered, permission-gated cutover draft required.");
  if (!intake.cutover.rollback.trigger || intake.cutover.rollback.steps.length !== 3 || intake.cutover.rollback.productionProof !== "not-executed") gaps.push("Rollback conditions or proof limits lost.");
  if (intake.support.state !== "acceptance-pending" || intake.support.acceptanceEvidence !== null || !intake.support.owner || !intake.support.queue || !intake.support.escalation) gaps.push("Support handoff missing or acceptance invented.");
  if (migration.cutoverApproval.state !== "pending" || maintainer.delivery.performed !== "local-commit" || maintainer.delivery.authority !== "local-only" || maintainer.ownerDecision.state !== "pending") gaps.push("Experiment cannot grant cutover, external delivery or owner acceptance.");
  return { state: gaps.length ? "blocked" : "draft-for-owner-review", gaps, deployment: "not-authorized", support: "acceptance-pending" };
}

export function handoff(intake, result, receipt) {
  return [`# ${intake.project}`, "", `State: ${result.state}. Adapter fixture Git revision: ${receipt.adapterRevision}.`, "",
    "## Requirements and owner outputs", "",
    ...intake.requirements.map((r) => `- ${r.id}: ${r.description}`), "",
    ...Object.entries(owners).map(([key, [id]]) => `- ${id}: artifacts/${key}.json (SHA-256 ${receipt.ownerDigests[key]}).`), "",
    "## Ordered cutover draft", "", ...intake.cutover.steps.map((s, i) => `${i + 1}. ${s.action}`), "",
    `Rollback owner: ${intake.cutover.rollback.owner}. Trigger: ${intake.cutover.rollback.trigger}`, "",
    ...intake.cutover.rollback.steps.map((s, i) => `${i + 1}. ${s}`), "",
    "## Support handoff", "", `Owner: ${intake.support.owner}; queue: ${intake.support.queue}; acceptance pending, no acknowledgement supplied.`, "",
    intake.support.escalation, "", intake.support.knownLimits, "",
    "No cutover, migration, deployment, communication or support acceptance occurred. In-memory tests are not live-system or production recovery proof.", "",
    ...result.gaps.map((g) => `- ${g}`), ""].join("\n").trimEnd() + "\n";
}
