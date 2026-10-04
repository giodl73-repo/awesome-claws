import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { compareDispatchPlans, dispatchFindings, dispatchInputDigest, renderDispatch } from "./service-dispatch-planner.mjs";

const root = new URL("../sources/service-dispatch-planner/", import.meta.url);
const fixture = JSON.parse(await readFile(new URL("fixtures/service-dispatch.example.json", root), "utf8"));
const schema = JSON.parse(await readFile(new URL("schemas/service-dispatch.schema.json", root), "utf8"));
const ajv = new Ajv2020({ strict: true, allErrors: true }); addFormats(ajv);
const validate = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const refresh = (value) => { value.plan.inputDigest = dispatchInputDigest(value); return value; };

test("dispatch: feasible itinerary preserves fixed job, travel, breaks and held work", () => {
  assert.equal(validate(fixture), true, JSON.stringify(validate.errors));
  assert.deepEqual(dispatchFindings(fixture), []);
  assert.equal(fixture.plan.assignments.length, 2);
  assert.equal(fixture.plan.unassigned[0].jobId, "JOB-3");
});

for (const [name, mutate, code] of [
  ["wrong skill", (r) => { r.technicians[0].skills = ["PLUMBING"]; }, "dispatch_skill"],
  ["missing duration", (r) => { r.jobs[1].durationMinutes = null; }, "dispatch_readiness"],
  ["changed duration", (r) => { r.jobs[1].durationMinutes = 90; }, "dispatch_duration"],
  ["parts hold", (r) => { r.jobs[1].readiness = "held"; }, "dispatch_readiness"],
  ["unknown access", (r) => { r.jobs[1].readiness = "unknown"; }, "dispatch_readiness"],
  ["emergency", (r) => { r.jobs[1].readiness = "emergency"; }, "dispatch_readiness"],
  ["window violation", (r) => { r.jobs[1].window.end = "2026-10-05T11:00-05:00"; }, "dispatch_window"],
  ["shift violation", (r) => { r.technicians[0].shift.start = "2026-10-05T09:30-05:00"; }, "dispatch_shift"],
  ["overlapping break", (r) => { r.technicians[0].breaks[0].start = "2026-10-05T11:00-05:00"; }, "dispatch_overlap"],
  ["missing travel", (r) => { r.travel.legs.splice(2, 1); }, "dispatch_travel"],
  ["unknown travel", (r) => { r.travel.legs[2].minutes = null; }, "dispatch_travel"],
  ["reverse-only travel", (r) => { [r.travel.legs[2].from, r.travel.legs[2].to] = [r.travel.legs[2].to, r.travel.legs[2].from]; }, "dispatch_travel"],
  ["travel overrun", (r) => { r.travel.legs[2].minutes = 31; }, "dispatch_overlap"],
  ["required buffer", (r) => { r.travel.bufferMinutes = 1; }, "dispatch_overlap"],
  ["return-to-base conflict", (r) => { r.travel.legs[3].minutes = 45; }, "dispatch_overlap"],
  ["missing same-site evidence", (r) => { r.travel.legs.shift(); }, "dispatch_travel"],
  ["duplicate travel", (r) => { r.travel.legs.push({ ...r.travel.legs[0] }); }, "dispatch_input"],
  ["stale travel", (r) => { r.travel.validOn = "2026-10-04"; }, "dispatch_input"],
  ["negative travel", (r) => { r.travel.legs[2].minutes = -1; }, "dispatch_input"],
  ["changed fixed time", (r) => { r.jobs[0].locked.start = "2026-10-05T09:15-05:00"; }, "dispatch_locked"],
  ["dropped fixed job", (r) => { r.plan.assignments.shift(); }, "dispatch_locked"],
  ["dropped held job", (r) => { r.plan.unassigned = []; }, "dispatch_coverage"],
  ["duplicate assignment", (r) => { r.plan.assignments.push({ ...r.plan.assignments[0] }); }, "dispatch_input"],
  ["duplicate across dispositions", (r) => { r.plan.unassigned.push({ jobId: "JOB-1", code: "dispatcher-decision", reason: "Review" }); }, "dispatch_coverage"],
  ["wrong unassigned reason code", (r) => { r.plan.unassigned[0].code = "dispatcher-decision"; }, "dispatch_reason"],
  ["blank unassigned reason", (r) => { r.plan.unassigned[0].reason = " "; }, "dispatch_input"],
  ["unknown technician", (r) => { r.plan.assignments[0].technicianId = "TECH-C"; }, "dispatch_input"],
  ["unknown job", (r) => { r.plan.assignments[0].jobId = "JOB-X"; }, "dispatch_coverage"],
  ["missing source revision", (r) => { r.jobs[0].revision = ""; }, "dispatch_input"],
  ["agent owner", (r) => { r.scope.owner = " service-dispatch-planner "; }, "dispatch_input"],
  ["wrong zone offset", (r) => { r.plan.assignments[0].start = "2026-10-05T09:00-06:00"; }, "dispatch_input"],
  ["absent offset", (r) => { r.plan.assignments[0].start = "2026-10-05T09:00"; }, "dispatch_input"],
  ["outside day", (r) => { r.plan.assignments[0].start = "2026-10-06T09:00-05:00"; }, "dispatch_input"],
  ["false approval", (r) => { r.plan.approved = true; }, "dispatch_authority"],
  ["false dispatch", (r) => { r.plan.dispatched = true; }, "dispatch_authority"],
  ["released schedule", (r) => { r.plan.status = "released"; }, "dispatch_authority"],
]) test(`dispatch: rejects ${name} even after rebinding the input digest`, () => {
  const record = clone(); mutate(record); refresh(record);
  assert(dispatchFindings(record).some((finding) => finding.code === code), JSON.stringify(dispatchFindings(record)));
});

test("dispatch: input changes invalidate previous schedule review", () => {
  for (const mutate of [
    (r) => { r.scope.revision = "r2"; },
    (r) => { r.jobs[0].revision = "r2"; },
    (r) => { r.technicians[0].revision = "r2"; },
    (r) => { r.travel.revision = "r2"; },
  ]) {
    const record = clone(); mutate(record);
    assert(dispatchFindings(record).some((finding) => finding.code === "dispatch_revision"));
  }
});

test("dispatch: input digest is property-order independent but includes all source inputs", () => {
  const record = clone(); record.scope = Object.fromEntries(Object.entries(record.scope).reverse());
  assert.equal(dispatchInputDigest(record), fixture.plan.inputDigest);
  record.scope.priorityRule = "Changed owner rule";
  assert.notEqual(dispatchInputDigest(record), fixture.plan.inputDigest);
});

test("dispatch: explanatory prose can vary without hiding held work", () => {
  const record = clone(); record.plan.unassigned[0].reason = "Dispatcher must wait for the missing replacement part.";
  assert.deepEqual(dispatchFindings(record), []);
});

test("dispatch: schema rejects undeclared private data and authority fields", () => {
  for (const mutate of [
    (r) => { r.jobs[0].customerPhone = "private"; },
    (r) => { r.jobs[0].accessCode = "private"; },
    (r) => { r.technicians[0].gps = [0, 0]; },
    (r) => { r.plan.sendMessages = true; },
  ]) { const record = clone(); mutate(record); assert.equal(validate(record), false); }
});

test("dispatch: emergency work is retained as human escalation, never silently assigned", () => {
  const record = clone(); record.jobs[2].readiness = "emergency";
  record.plan.unassigned[0].code = "human-escalation"; refresh(record);
  assert.deepEqual(dispatchFindings(record), []);
});

function dstRecord(date, shiftStart, shiftEnd, start, end) {
  const record = clone(); record.scope.date = date;
  record.technicians = [{ ...record.technicians[0], breaks: [], shift: { start: shiftStart, end: shiftEnd } }];
  record.jobs = [{ ...record.jobs[0], locked: null, site: "DEPOT", window: { start: shiftStart, end: shiftEnd } }];
  record.travel.validOn = date; record.travel.legs = [{ from: "DEPOT", to: "DEPOT", minutes: 0 }];
  record.plan.assignments = [{ jobId: "JOB-1", technicianId: "TECH-A", start, end }]; record.plan.unassigned = [];
  return refresh(record);
}

test("dispatch: repeated DST hour uses elapsed time and preserves explicit offsets", () => {
  const record = dstRecord("2026-11-01", "2026-11-01T00:00-05:00", "2026-11-01T04:00-06:00", "2026-11-01T01:30-05:00", "2026-11-01T01:30-06:00");
  assert.equal(validate(record), true, JSON.stringify(validate.errors));
  assert.deepEqual(dispatchFindings(record), []);
  assert.match(renderDispatch(record), /01:30-05:00.*01:30-06:00/);
});

test("dispatch: nonexistent spring DST time alone is enough to reject the schedule", () => {
  const record = dstRecord("2026-03-08", "2026-03-08T00:00-06:00", "2026-03-08T04:00-05:00", "2026-03-08T01:30-06:00", "2026-03-08T03:30-05:00");
  assert.deepEqual(dispatchFindings(record), []);
  record.plan.assignments[0].start = "2026-03-08T02:30-06:00";
  const findings = dispatchFindings(record);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, "dispatch_input");
  assert.match(findings[0].message, /offset|invalid|disambiguation/i);
});

test("dispatch: actual handoff shows travel, breaks, unused technician and every source", () => {
  const markdown = renderDispatch(fixture);
  assert.match(markdown, /SITE-A \| SITE-B \| 2026-10-05T10:00-05:00 \| 2026-10-05T10:30-05:00 \| 30 \| 0 \| 0/);
  assert.match(markdown, /BREAK-A/); assert.match(markdown, /BREAK-B/);
  assert.match(markdown, /No jobs assigned to this technician/);
  assert.match(markdown, /JOB-3 \| Unassigned: readiness/);
  assert.match(markdown, /No prior schedule supplied/);
  for (const row of [...fixture.technicians, ...fixture.jobs, fixture.travel]) assert(markdown.includes(row.sourceRef));
});

test("dispatch: packaged worked Markdown matches the current structured fixture", async () => {
  const markdown = await readFile(new URL("fixtures/dispatch-handoff.example.md", root), "utf8");
  assert.equal(markdown.replaceAll("\r\n", "\n"), renderDispatch(fixture));
});

test("dispatch: a held fixed appointment remains visible in a blocked handoff", () => {
  const record = clone(); record.jobs[0].readiness = "held"; refresh(record);
  const markdown = renderDispatch(record);
  assert.match(markdown, /BLOCKED DRAFT/);
  assert.match(markdown, /dispatch_readiness/);
  assert.match(markdown, /JOB-1 \| SITE-A/);
  assert.doesNotMatch(markdown, /Feasible against/);
});

test("dispatch: dropped jobs and missing routes cannot disappear in blocked Markdown", () => {
  const record = clone(); record.plan.unassigned = []; record.travel.legs.splice(2, 1); refresh(record);
  const markdown = renderDispatch(record);
  assert.match(markdown, /JOB-3 \| MISSING FROM PLAN/);
  assert.match(markdown, /SITE-A \| SITE-B .* unknown/);
  assert.match(markdown, /BLOCKED DRAFT/);
});

test("dispatch: stale schedule prints both fingerprints rather than silently rebinding", () => {
  const record = clone(); record.scope.revision = "r2";
  const markdown = renderDispatch(record);
  assert.match(markdown, /dispatch_revision/);
  assert(markdown.includes(fixture.plan.inputDigest));
  assert(markdown.includes(dispatchInputDigest(record)));
});

test("dispatch: previous supplied draft produces source-bound assignment changes", () => {
  const record = clone(); record.scope.revision = "r2";
  record.plan.assignments.pop();
  record.plan.unassigned.push({ jobId: "JOB-2", code: "dispatcher-decision", reason: "Owner review needed before rescheduling." });
  record.travel.legs.push({ from: "SITE-A", to: "DEPOT", minutes: 20 }); refresh(record);
  assert.deepEqual(dispatchFindings(record), []);
  const changes = compareDispatchPlans(record, fixture);
  assert.equal(changes.length, 1); assert.equal(changes[0].jobId, "JOB-2");
  const markdown = renderDispatch(record, { previous: fixture });
  assert.match(markdown, /Prior scope revision: dispatch-r1/);
  assert.match(markdown, /JOB-2.*TECH-A.*Unassigned/);
  assert.match(markdown, /no prior review is inherited/);
});

test("dispatch: prior source changes invalidate comparison and are not hidden", () => {
  const previous = clone(); previous.travel.revision = "stale";
  assert.throws(() => renderDispatch(fixture, { previous }), /validated supplied draft/);
});

test("dispatch: changed destination is visible even when technician and times are unchanged", () => {
  const record = clone(); record.scope.revision = "r2";
  record.jobs[1].site = "SITE-D"; record.jobs[1].revision = "r2";
  record.travel.revision = "r2";
  for (const leg of record.travel.legs) {
    if (leg.from === "SITE-B") leg.from = "SITE-D";
    if (leg.to === "SITE-B") leg.to = "SITE-D";
  }
  refresh(record);
  assert.equal(validate(record), true, JSON.stringify(validate.errors));
  assert.deepEqual(dispatchFindings(record), []);
  const changes = compareDispatchPlans(record, fixture);
  assert.equal(changes.length, 1); assert.equal(changes[0].jobId, "JOB-2");
  assert.match(changes[0].before, /TECH-A at SITE-B/);
  assert.match(changes[0].after, /TECH-A at SITE-D/);
  const markdown = renderDispatch(record, { previous: fixture });
  assert.match(markdown, /JOB-2.*TECH-A at SITE-B.*TECH-A at SITE-D/);
  assert.doesNotMatch(markdown, /No appointment or disposition changes/);
});

test("dispatch: changed destination on unassigned work is also shown", () => {
  const record = clone(); record.scope.revision = "r2";
  record.jobs[2].site = "SITE-D"; record.jobs[2].revision = "r2"; refresh(record);
  assert.deepEqual(dispatchFindings(record), []);
  const changes = compareDispatchPlans(record, fixture);
  assert.equal(changes.length, 1); assert.equal(changes[0].jobId, "JOB-3");
  assert.match(changes[0].before, /Unassigned at SITE-C/);
  assert.match(changes[0].after, /Unassigned at SITE-D/);
});

test("dispatch: handoff escapes pipe, markup and newline injection in source prose", () => {
  const record = clone(); record.plan.unassigned[0].reason = "Held | <script>bad</script>\nFake row";
  const markdown = renderDispatch(record);
  assert.match(markdown, /Held &#124; &lt;script&gt;bad&lt;\/script&gt; Fake row/);
  assert.doesNotMatch(markdown, /<script>/);
});

test("dispatch: packaged fingerprint recipe matches reference implementation", async () => {
  const reference = await readFile(new URL("references/dispatch-contract.md", root), "utf8");
  const code = reference.match(/```js\r?\n([\s\S]*?)\r?\n```/)[1];
  const recipe = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  assert.equal(recipe.dispatchInputDigest(fixture), dispatchInputDigest(fixture));
});

for (const [field, mutate] of [
  ["readiness evidence", (r, value) => { r.jobs[0].readinessReason = value; }],
  ["unassigned explanation", (r, value) => { r.plan.unassigned[0].reason = value; }],
  ["priority rule", (r, value) => { r.scope.priorityRule = value; }],
  ["source revision", (r, value) => { r.jobs[0].revision = value; }],
]) test(`dispatch: neutralizes Markdown image/link syntax in ${field}`, () => {
  const record = clone();
  const payload = String.raw`![status](https://example.invalid/track?job=JOB-1) [link](https://example.invalid) \ ![second](https://example.invalid/pixel)`;
  mutate(record, payload); refresh(record);
  assert.equal(validate(record), true, JSON.stringify(validate.errors));
  assert.deepEqual(dispatchFindings(record), []);
  const markdown = renderDispatch(record);
  assert(markdown.includes(String.raw`!\[status\](https://example.invalid/track?job=JOB-1)`));
  assert(markdown.includes(String.raw`\[link\](https://example.invalid)`));
  assert(markdown.includes(String.raw`\\ !\[second\](https://example.invalid/pixel)`));
  assert.doesNotMatch(markdown, /!\[status\]|!\[second\]|\[link\]\(/);
});
