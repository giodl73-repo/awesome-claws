import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateArtifactSemantics } from "../../scripts/artifact-semantics.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const json = async (path) => JSON.parse(await read(path));
const supplied = await json("supplied-evidence.json");
const project = await json("private-project.json");
const worker = await json("worker-draft.json");
const privateText = await read("private-handoff.md");
const workerText = await read("worker-draft.md");
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(await json("../../sources/project-manager/schemas/project-state.schema.json"));
const milestone = (id) => project.milestones.find((row) => row.id === id);
const prerequisite = (id) => supplied.prerequisites.find((row) => row.id === id);

test("private handoff passes the actual Project Manager schema and semantics", () => {
  assert.equal(validate(project), true, ajv.errorsText(validate.errors));
  assert.deepEqual(validateArtifactSemantics("project-manager", project), []);
  assert.equal(project.statusState, "blocked");
  assert(project.decisions.every((row) => row.state === "needed"));
});

test("all supplied prerequisites have owners, dependencies and retained evidence", () => {
  const ids = supplied.prerequisites.map((row) => row.id);
  assert.deepEqual(project.milestones.map((row) => row.id), [...ids, "HANDOFF"]);
  assert.deepEqual(milestone("HANDOFF").dependencies, ids);
  const refs = new Set([supplied.acceptance.ref, ...supplied.plans.map((p) => p.ref),
    ...supplied.impactRules.map((r) => r.ref),
    ...supplied.prerequisites.flatMap((p) => p.evidence.map((e) => e.ref))]);
  for (const row of project.milestones) {
    assert.equal(row.dueDate, supplied.ownerSuppliedDeadlines[row.id]);
    for (const ref of row.evidenceRefs) assert(refs.has(ref), ref);
  }
  for (const p of supplied.prerequisites) {
    assert.equal(milestone(p.id).owner, p.owner);
    assert(privateText.includes(p.id));
    assert(privateText.includes(p.owner));
    for (const e of p.evidence) {
      assert(milestone(p.id).evidenceRefs.includes(e.ref));
      assert(privateText.includes(e.ref));
    }
  }
});

test("supplied plan revision and worker-permitted dates agree without erasing history", () => {
  assert.equal(supplied.acceptance.state, "accepted");
  assert.equal(supplied.plans[0].state, "superseded");
  const current = supplied.plans[1];
  assert.equal(current.state, "owner-approved");
  assert.equal(project.targetDate, current.startDate);
  for (const key of ["startDate", "location", "timezone"]) {
    assert.equal(worker[key], current[key]);
  }
  assert.equal(worker.planRevision, current.revision);
  assert.equal(supplied.worker, worker.worker);
  assert(privateText.includes("PLAN-V1"));
  assert(privateText.includes("PLAN-V2"));
});

test("request and pending HR status are not completion evidence", () => {
  assert.equal(prerequisite("EQUIPMENT").evidence[0].state, "requested");
  assert.equal(prerequisite("EQUIPMENT").assessment, "delivery-evidence-missing");
  assert.equal(milestone("EQUIPMENT").state, "blocked");
  assert.equal(prerequisite("HR").evidence[0].state, "pending-owner-review");
  assert.equal(milestone("HR").state, "blocked");
});

test("supplied reconfirmation rule keeps IT v1 historical in the v2 handoff", () => {
  const p = prerequisite("ACCESS");
  assert.equal(p.evidence[0].planRevision, "v1");
  assert.equal(p.assessment, "historical-reconfirmation-required");
  assert.deepEqual(supplied.impactRules.find((r) => r.ref === p.impactRuleRef), {
    ref: "CHANGE-RULE-1", from: "v1", to: "v2", change: "startDate",
    prerequisite: "ACCESS", effect: "reconfirm", owner: "IT owner",
  });
  assert.equal(milestone("ACCESS").state, "blocked");
  assert(milestone("ACCESS").evidenceRefs.includes(p.impactRuleRef));
});

test("absent workspace impact rule remains unresolved, not an invented carry-forward", () => {
  const p = prerequisite("WORKSPACE");
  assert.equal(p.impactRuleRef, null);
  assert.equal(supplied.impactRules.some((r) => r.prerequisite === p.id), false);
  assert.equal(p.evidence[0].planRevision, "v1");
  assert.equal(p.assessment, "historical-applicability-unresolved");
  assert.equal(milestone(p.id).state, "blocked");
  assert.match(milestone(p.id).name, /impact rule missing, applicability unresolved/);
  assert(project.decisions.some((d) => d.owner === p.owner && d.state === "needed"));
});

test("orientation arrangement is not attendance, acceptance or start clearance", () => {
  assert.equal(prerequisite("ORIENTATION").assessment, "arranged-not-attended");
  assert.equal(milestone("ORIENTATION").state, "ready-for-acceptance");
  assert.equal(milestone("HANDOFF").state, "blocked");
  assert.match(worker.notice, /not start clearance/);
});

test("separately authored worker artifact contains exactly the permitted fixture facts", () => {
  assert.deepEqual(worker, {
    state: "draft-for-owner-review-not-sent",
    ...supplied.workerPermittedFacts,
    notice: "Itinerary draft only; not start clearance. Owner review required before sharing.",
  });
  assert.equal(supplied.publication, "owner-review-pending");
  const selected = ["worker", "planRevision", "startDate", "location", "timezone", "orientation", "contact"];
  assert.deepEqual(Object.keys(supplied.workerPermittedFacts), selected);
  const privateRefs = supplied.prerequisites.flatMap((p) => p.evidence.map((e) => e.ref));
  for (const ref of [...privateRefs, "PLAN-V1", "CHANGE-RULE-1"]) {
    assert.equal(JSON.stringify(worker).includes(ref), false);
    assert.equal(workerText.includes(ref), false);
  }
});

test("worker Markdown agrees exactly with the separately authored draft", () => {
  const labels = { worker: "Worker", planRevision: "Plan revision", startDate: "Planned start",
    location: "Location", timezone: "Timezone", orientation: "Orientation", contact: "Contact" };
  const expected = ["# First-day itinerary draft", "", `State: ${worker.state}`, "",
    ...Object.entries(labels).map(([key, label]) => `- ${label}: ${worker[key]}`),
    "", worker.notice, ""].join("\n");
  assert.equal(workerText.replace(/\r\n/g, "\n"), expected);
});

test("real semantic validator rejects a dangling onboarding dependency", () => {
  const changed = structuredClone(project);
  changed.milestones.at(-1).dependencies.push("UNKNOWN");
  assert.equal(validate(changed), true);
  assert(validateArtifactSemantics("project-manager", changed).length > 0);
});

test("real semantic validator rejects an onboarding dependency cycle", () => {
  const changed = structuredClone(project);
  changed.milestones[0].dependencies.push("HANDOFF");
  assert(validateArtifactSemantics("project-manager", changed).length > 0);
});

test("negative control: PM validation alone does not enforce revision applicability", () => {
  const changed = structuredClone(project);
  const access = changed.milestones.find((row) => row.id === "ACCESS");
  access.state = "accepted";
  access.name = "Incorrectly treating old confirmation as current";
  access.evidenceRefs = ["IT-V1"];
  assert.equal(validate(changed), true);
  assert.deepEqual(validateArtifactSemantics("project-manager", changed), []);
});
