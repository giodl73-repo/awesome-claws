import { createHash } from "node:crypto";
import { Temporal } from "@js-temporal/polyfill";

const require = (condition, message) => { if (!condition) throw new Error(message); };
const text = (value) => typeof value === "string" && value.trim().length > 0;
const id = (value) => typeof value === "string" && /^[A-Z][A-Z0-9-]{0,63}$/.test(value);
const canonical = (value) => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === "object"
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
const integer = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;
const unique = (rows, key) => {
  require(Array.isArray(rows), "Expected record list");
  const values = rows.map((row) => row?.[key]);
  require(values.every(id) && new Set(values).size === values.length, `Missing or duplicate ${key}`);
};

export function dispatchInputDigest(record) {
  const { schemaVersion, scope, technicians, jobs, travel } = record;
  return `sha256:${createHash("sha256").update(canonical({ schemaVersion, scope, technicians, jobs, travel })).digest("hex")}`;
}

// Explicit offsets make repeated DST hours unambiguous; Temporal rejects offset/zone conflicts.
function instant(value, scope) {
  require(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(value), "Use minute-precision local timestamps with explicit offsets");
  const time = Temporal.ZonedDateTime.from(`${value}[${scope.timeZone}]`, { disambiguation: "reject", offset: "reject", overflow: "reject" });
  require(time.toPlainDate().toString() === scope.date, "Timestamp outside planning date");
  return Number(time.epochMilliseconds / 60000);
}

function interval(value, scope) {
  const start = instant(value.start, scope), end = instant(value.end, scope);
  require(start < end, "Empty or reversed interval");
  return { start, end };
}

function source(row) {
  require(id(row.sourceRef) && text(row.revision), "Missing source identity or revision");
}

function technicianStops(record, technician) {
  const jobs = new Map(record.jobs.map((job) => [job.id, job]));
  return [
    ...record.plan.assignments.filter((row) => row.technicianId === technician.id).map((row) => ({
      ...interval(row, record.scope), site: jobs.get(row.jobId)?.site, id: row.jobId,
    })),
    ...technician.breaks.map((pause) => ({ ...interval(pause, record.scope), site: pause.site, id: pause.id })),
  ].sort((a, b) => a.start - b.start);
}

function validateInputs(record) {
  require(record?.schemaVersion === "awesomeClaws.serviceDispatch.v1", "Unknown dispatch contract");
  const { scope, technicians, jobs, travel } = record;
  require(scope && text(scope.revision) && text(scope.owner) && text(scope.priorityRule), "Missing scope or dispatcher");
  require(!/^(agent|assistant|service dispatch planner)$/.test(scope.owner.normalize("NFKC").trim().toLowerCase().replace(/[\s_-]+/gu, " ")), "A human dispatcher is required");
  require(Temporal.PlainDate.from(scope.date).toString() === scope.date, "Invalid planning date");
  require(text(scope.timeZone) && !/^[+-]/.test(scope.timeZone), "Use a named timezone");
  Temporal.ZonedDateTime.from(`${scope.date}T12:00[${scope.timeZone}]`);
  unique(technicians, "id"); unique(jobs, "id");
  require(technicians.length > 0 && jobs.length > 0, "Roster and jobs are required");
  for (const technician of technicians) {
    source(technician);
    require(id(technician.startSite) && id(technician.endSite), "Missing shift location");
    require(Array.isArray(technician.skills) && technician.skills.every(id) && new Set(technician.skills).size === technician.skills.length, "Invalid skills");
    const shift = interval(technician.shift, scope);
    unique(technician.breaks, "id");
    let previous = shift.start;
    for (const pause of [...technician.breaks].sort((a, b) => instant(a.start, scope) - instant(b.start, scope))) {
      require(id(pause.site), "Break location is required");
      const span = interval(pause, scope);
      require(span.start >= previous && span.end <= shift.end, "Break outside shift or overlapping");
      previous = span.end;
    }
  }
  for (const job of jobs) {
    source(job);
    require(id(job.site) && id(job.skill) && integer(job.priority, 1), "Missing job constraints");
    require(job.durationMinutes === null || integer(job.durationMinutes, 1), "Invalid job duration");
    interval(job.window, scope);
    require(["ready", "held", "unknown", "emergency"].includes(job.readiness), "Invalid readiness");
    require(text(job.readinessReason), "Readiness explanation required");
    if (job.locked !== null) {
      require(technicians.some((t) => t.id === job.locked.technicianId), "Unknown fixed technician");
      instant(job.locked.start, scope);
    }
  }
  source(travel);
  require(travel.validOn === scope.date && integer(travel.bufferMinutes), "Travel evidence is stale or buffer missing");
  require(Array.isArray(travel.legs), "Missing travel table");
  const routes = new Set();
  for (const leg of travel.legs) {
    require(id(leg.from) && id(leg.to) && (leg.minutes === null || integer(leg.minutes)), "Invalid travel leg");
    const key = `${leg.from}/${leg.to}`;
    require(!routes.has(key), "Duplicate directional travel leg"); routes.add(key);
  }
}

export function dispatchFindings(record) {
  const findings = [];
  const add = (code, message) => findings.push({ code, message });
  try {
    validateInputs(record);
    const { scope, jobs, technicians, travel, plan } = record;
    require(plan && Array.isArray(plan.assignments) && Array.isArray(plan.unassigned), "Missing draft schedule");
    if (plan.status !== "draft" || plan.approved !== false || plan.dispatched !== false) add("dispatch_authority", "Only an unapproved, undispatched draft is permitted.");
    if (plan.inputDigest !== dispatchInputDigest(record)) add("dispatch_revision", "Revalidate and bind the schedule to the current input snapshot.");
    unique(plan.assignments, "jobId"); unique(plan.unassigned, "jobId");
    const dispositions = [...plan.assignments, ...plan.unassigned].map((row) => row.jobId);
    if (dispositions.length !== jobs.length || new Set(dispositions).size !== jobs.length || dispositions.some((key) => !jobs.some((job) => job.id === key))) add("dispatch_coverage", "Every job must appear exactly once, including held jobs.");
    for (const row of plan.unassigned) {
      const job = jobs.find((item) => item.id === row.jobId);
      require(job && text(row.reason), "Unknown unassigned job or blank explanation");
      const code = job.readiness === "emergency" ? "human-escalation" : job.readiness !== "ready" ? "readiness" : job.durationMinutes === null ? "duration" : "dispatcher-decision";
      if (row.code !== code) add("dispatch_reason", `Preserve ${row.jobId}'s ${code} disposition.`);
    }
    for (const row of plan.assignments) {
      const job = jobs.find((item) => item.id === row.jobId), technician = technicians.find((item) => item.id === row.technicianId);
      require(job && technician, "Unknown assigned job or technician");
      const span = interval(row, scope), window = interval(job.window, scope);
      if (job.readiness !== "ready" || job.durationMinutes === null) add("dispatch_readiness", `${job.id} cannot be assigned without readiness and duration.`);
      if (!technician.skills.includes(job.skill)) add("dispatch_skill", `${job.id} lacks an approved matching skill.`);
      if (span.end - span.start !== job.durationMinutes) add("dispatch_duration", `${job.id} must retain its supplied elapsed duration.`);
      if (span.start < window.start || span.end > window.end) add("dispatch_window", `${job.id} is outside its appointment window.`);
      if (job.locked && (job.locked.technicianId !== row.technicianId || instant(job.locked.start, scope) !== span.start)) add("dispatch_locked", `${job.id}'s fixed appointment changed.`);
    }
    for (const job of jobs.filter((item) => item.locked)) {
      if (!plan.assignments.some((row) => row.jobId === job.id)) add("dispatch_locked", `${job.id}'s fixed appointment requires human resolution, not silent removal.`);
    }
    for (const technician of technicians) {
      const shift = interval(technician.shift, scope);
      const stops = technicianStops(record, technician);
      let previous = { end: shift.start, site: technician.startSite };
      for (const stop of [...stops, { start: shift.end, end: shift.end, site: technician.endSite, id: "SHIFT-END" }]) {
        const leg = travel.legs.find((item) => item.from === previous.site && item.to === stop.site);
        if (!leg || leg.minutes === null) add("dispatch_travel", `${technician.id}: missing ${previous.site} to ${stop.site} travel; do not infer zero.`);
        else if (previous.end + leg.minutes + travel.bufferMinutes > stop.start) add("dispatch_overlap", `${technician.id}: insufficient travel/buffer time before ${stop.id}.`);
        if (stop.start < shift.start || stop.end > shift.end) add("dispatch_shift", `${technician.id}: ${stop.id} is outside the shift.`);
        previous = stop;
      }
    }
  } catch (error) { add("dispatch_input", error.message); }
  return findings;
}

const cell = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll("|", "&#124;").replace(/[\r\n]+/g, " ").replaceAll(/([\\`*_\[\]])/g, "\\$1");
const table = (headers, rows) => [
  `| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
].join("\n");
const clock = (minute, scope) => Temporal.Instant.fromEpochMilliseconds(minute * 60000)
  .toZonedDateTimeISO(scope.timeZone).toString({ smallestUnit: "minute", timeZoneName: "never" });

export function compareDispatchPlans(record, previous) {
  if (previous === null) return null;
  validateInputs(record); validateInputs(previous);
  require(previous.scope.date === record.scope.date && previous.scope.timeZone === record.scope.timeZone, "Prior schedule is for a different planning day or timezone");
  require(dispatchFindings(previous).length === 0, "Prior schedule must be a validated supplied draft; do not inherit its approval");
  const state = (value, jobId) => {
    const job = value.jobs.find((item) => item.id === jobId);
    const row = value.plan.assignments.find((assignment) => assignment.jobId === jobId);
    if (row) return `${row.technicianId} at ${job.site}: ${row.start} to ${row.end}`;
    const unassigned = value.plan.unassigned.find((item) => item.jobId === jobId);
    return unassigned ? `Unassigned at ${job.site} (${unassigned.code}): ${unassigned.reason}` : "Not in supplied job set";
  };
  const ids = new Set([...previous.jobs, ...record.jobs].map((job) => job.id));
  return [...ids].map((jobId) => ({ jobId, before: state(previous, jobId), after: state(record, jobId) }))
    .filter((row) => row.before !== row.after);
}

export function renderDispatch(record, { previous = null } = {}) {
  validateInputs(record);
  const findings = dispatchFindings(record);
  require(!findings.some((finding) => finding.code === "dispatch_input"), "Correct malformed intake or schedule before rendering an itinerary");
  const { scope, technicians, jobs, travel, plan } = record;
  const changes = compareDispatchPlans(record, previous);
  const lines = [
    "# Service dispatch draft", "", "NOT APPROVED - NOT DISPATCHED", "",
    findings.length ? "BLOCKED DRAFT - resolve the findings below before relying on this itinerary." : "Feasible against the supplied constraints; not an optimality, safety or arrival guarantee.", "",
    `Date: ${cell(scope.date)} | Timezone: ${cell(scope.timeZone)} | Dispatcher: ${cell(scope.owner)}`,
    `Scope revision: ${cell(scope.revision)} | Current input fingerprint: ${dispatchInputDigest(record)}`,
    `Schedule-bound fingerprint: ${cell(plan.inputDigest)}`,
    `Priority rule: ${cell(scope.priorityRule)}`, "", "## Findings", "",
    ...findings.map((finding) => `- \`${finding.code}\`: ${cell(finding.message)}`),
    ...(findings.length ? [] : ["No feasibility findings. Source authenticity and priority tradeoffs still require dispatcher review."]),
    "", "## Technician itineraries", "",
  ];
  for (const technician of technicians) {
    const shift = interval(technician.shift, scope), stops = technicianStops(record, technician);
    lines.push(`### ${technician.id}`, "", `Shift: ${cell(technician.shift.start)} to ${cell(technician.shift.end)}; ${technician.startSite} to ${technician.endSite}.`, "",
      table(["Job or break", "Site", "Start", "Finish", "Fixed"], stops.map((stop) => [stop.id, stop.site, clock(stop.start, scope), clock(stop.end, scope), technician.breaks.some((pause) => pause.id === stop.id) || jobs.find((job) => job.id === stop.id)?.locked ? "yes" : "no"])), "");
    if (!plan.assignments.some((row) => row.technicianId === technician.id)) lines.push("No jobs assigned to this technician.", "");
    const routes = [];
    let prior = { end: shift.start, site: technician.startSite };
    for (const stop of [...stops, { start: shift.end, end: shift.end, site: technician.endSite }]) {
      const leg = travel.legs.find((item) => item.from === prior.site && item.to === stop.site);
      routes.push([prior.site, stop.site, clock(prior.end, scope), clock(stop.start, scope), leg?.minutes ?? "unknown", travel.bufferMinutes,
        leg?.minutes == null ? "unknown" : stop.start - prior.end - leg.minutes - travel.bufferMinutes]);
      prior = stop;
    }
    lines.push(table(["From", "To", "Available after", "Next stop starts", "Travel minutes", "Buffer", "Slack minutes"], routes), "");
  }
  lines.push("## Complete job disposition", "", table(["Job", "Disposition", "Readiness", "Explanation"], jobs.map((job) => {
    const assignment = plan.assignments.find((row) => row.jobId === job.id), unassigned = plan.unassigned.find((row) => row.jobId === job.id);
    return [job.id, assignment && unassigned ? "CONFLICT: assigned and unassigned" : assignment ? `Assigned: ${assignment.technicianId}` : unassigned ? `Unassigned: ${unassigned.code}` : "MISSING FROM PLAN", job.readiness, unassigned?.reason ?? job.readinessReason];
  })), "", "## Source register", "", table(["Record", "Source", "Revision"], [
    ...technicians.map((row) => [row.id, row.sourceRef, row.revision]),
    ...jobs.map((row) => [row.id, row.sourceRef, row.revision]),
    [`Travel valid ${travel.validOn}`, travel.sourceRef, travel.revision],
  ]), "", "## Changes and dispatcher decisions", "");
  if (changes === null) lines.push("No prior schedule supplied; changed-appointment comparison unavailable.");
  else {
    lines.push(`Prior scope revision: ${cell(previous.scope.revision)} | Prior input fingerprint: ${dispatchInputDigest(previous)}`);
    lines.push(changes.length ? table(["Job", "Prior disposition", "Current disposition"], changes.map((row) => [row.jobId, row.before, row.after])) : "No appointment or disposition changes against the supplied prior draft.");
    lines.push("Input revisions may have changed even when appointment times did not. Revalidate the entire affected itinerary; no prior review is inherited.");
  }
  lines.push("", "- Resolve findings and verify current parts, access, qualifications and source evidence.",
    "- Review priority tradeoffs and ready-but-unscheduled work; this checker does not prove no better schedule exists.",
    "- Release and any customer or technician communication remain the human dispatcher's decision.",
    "- No booking, cancellation, customer contact, technician dispatch, purchase, invoice or service-system change occurred.", "");
  return lines.join("\n");
}
