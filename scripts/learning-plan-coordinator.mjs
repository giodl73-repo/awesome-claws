function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rows(value) {
  return Array.isArray(value) ? value : [];
}

function finding(code, path, message) {
  return { code, path, message };
}

function indexById(value) {
  return new Map(
    rows(value)
      .filter((row) => isRecord(row) && typeof row.id === "string")
      .map((row) => [row.id, row]),
  );
}

function sameSet(left, right) {
  const a = rows(left);
  const b = rows(right);
  return a.length === b.length && new Set(a).size === a.length && a.every((id) => b.includes(id));
}

function exactInstant(value) {
  if (typeof value !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/u.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function checkUniqueIds(collections, findings) {
  const seen = new Set();
  for (const [name, collection] of Object.entries(collections)) {
    for (const [index, row] of rows(collection).entries()) {
      if (!isRecord(row) || typeof row.id !== "string") continue;
      if (seen.has(row.id)) {
        findings.push(finding("duplicate_identity", `${name}/${index}/id`, `Duplicate id ${row.id}.`));
      }
      seen.add(row.id);
    }
  }
}

function requireRef(index, ref, path, code, findings) {
  const target = index.get(ref);
  if (!target) findings.push(finding(code, path, `Unknown reference ${String(ref)}.`));
  return target;
}

function hasPrerequisiteCycle(competencies) {
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const competency = competencies.get(id);
    for (const ref of rows(competency?.prerequisiteRefs)) {
      if (competencies.has(ref) && visit(ref)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }
  return [...competencies.keys()].some(visit);
}

export function learningPlanFindings(value) {
  const findings = [];
  if (!isRecord(value)) {
    return [finding("invalid_learning_plan", "", "Learning plan must be an object.")];
  }

  const plan = isRecord(value.plan) ? value.plan : {};
  const review = isRecord(value.review) ? value.review : {};
  const prohibited = isRecord(value.prohibitedActions) ? value.prohibitedActions : {};
  const sources = indexById(value.sources);
  const competencies = indexById(value.competencies);
  const resources = indexById(value.resources);
  const evidence = indexById(value.evidence);
  const checkpoints = indexById(value.checkpoints);
  const activities = indexById(value.activities);

  if (value.schemaVersion !== "awesomeClaws.learningPlan.v1") {
    findings.push(finding("invalid_schema_version", "schemaVersion", "Unexpected learning-plan schema version."));
  }
  checkUniqueIds(
    { sources: value.sources, competencies: value.competencies, resources: value.resources, evidence: value.evidence, checkpoints: value.checkpoints, activities: value.activities },
    findings,
  );

  for (const [field, index] of [
    ["competencyRefs", competencies],
    ["resourceRefs", resources],
    ["checkpointRefs", checkpoints],
    ["activityRefs", activities],
  ]) {
    if (!sameSet(plan[field], [...index.keys()])) {
      findings.push(finding("incomplete_plan_index", `plan/${field}`, `${field} must exactly cover its collection.`));
    }
  }

  const asOf = exactInstant(plan.asOf);
  if (asOf === null || review.asOf !== plan.asOf) {
    findings.push(finding("invalid_review_boundary", "review/asOf", "Review time must equal the exact zone-bearing plan as-of time."));
  }
  if (review.nextPlanRevision !== plan.revision + 1) {
    findings.push(finding("invalid_revision_lineage", "review/nextPlanRevision", "The next plan revision must increment the current revision by one."));
  }
  for (const [collectionName, collection, timeField] of [
    ["sources", value.sources, "observedAt"],
    ["resources", value.resources, "retrievedAt"],
    ["evidence", value.evidence, "observedAt"],
  ]) {
    for (const [index, row] of rows(collection).entries()) {
      const instant = exactInstant(row?.[timeField]);
      if (instant === null || asOf === null || instant > asOf) {
        findings.push(finding("invalid_evidence_chronology", `${collectionName}/${index}/${timeField}`, "Evidence time must be exact and no later than the plan as-of time."));
      }
    }
  }

  for (const [id, competency] of competencies) {
    for (const [index, ref] of rows(competency.prerequisiteRefs).entries()) {
      if (ref === id) findings.push(finding("invalid_prerequisite", `competencies/${id}/prerequisiteRefs/${index}`, "A competency cannot require itself."));
      requireRef(competencies, ref, `competencies/${id}/prerequisiteRefs/${index}`, "unknown_competency", findings);
    }
    for (const ref of rows(competency.evidenceRefs)) {
      const row = requireRef(evidence, ref, `competencies/${id}/evidenceRefs`, "unknown_evidence", findings);
      if (row && row.competencyRef !== id) findings.push(finding("cross_competency_evidence", `competencies/${id}/evidenceRefs`, "Competency evidence must bind the same competency."));
    }
    for (const ref of rows(competency.checkpointRefs)) {
      const row = requireRef(checkpoints, ref, `competencies/${id}/checkpointRefs`, "unknown_checkpoint", findings);
      if (row && row.competencyRef !== id) findings.push(finding("cross_competency_checkpoint", `competencies/${id}/checkpointRefs`, "Competency checkpoints must bind the same competency."));
    }
    const boundEvidenceRefs = [...evidence.values()].filter((row) => row.competencyRef === id).map((row) => row.id);
    if (!sameSet(competency.evidenceRefs, boundEvidenceRefs)) {
      findings.push(finding("incomplete_competency_evidence_index", `competencies/${id}/evidenceRefs`, "Competency evidence references must exactly cover evidence bound to the competency."));
    }
    const boundCheckpointRefs = [...checkpoints.values()].filter((row) => row.competencyRef === id).map((row) => row.id);
    if (!sameSet(competency.checkpointRefs, boundCheckpointRefs)) {
      findings.push(finding("incomplete_competency_checkpoint_index", `competencies/${id}/checkpointRefs`, "Competency checkpoint references must exactly cover checkpoints bound to the competency."));
    }
  }
  if (hasPrerequisiteCycle(competencies)) {
    findings.push(finding("cyclic_prerequisites", "competencies", "Competency prerequisites must be acyclic."));
  }

  for (const [id, row] of evidence) {
    requireRef(competencies, row.competencyRef, `evidence/${id}/competencyRef`, "unknown_competency", findings);
    for (const ref of rows(row.sourceRefs)) requireRef(sources, ref, `evidence/${id}/sourceRefs`, "unknown_source", findings);
  }

  for (const [id, resource] of resources) {
    for (const ref of rows(resource.sourceRefs)) requireRef(sources, ref, `resources/${id}/sourceRefs`, "unknown_source", findings);
    for (const ref of rows(resource.competencyRefs)) requireRef(competencies, ref, `resources/${id}/competencyRefs`, "unknown_competency", findings);
    if (resource.selected && (resource.currency !== plan.currency || (plan.freeResourcesOnly && resource.costMinor !== 0))) {
      findings.push(finding("invalid_resource_constraint", `resources/${id}`, "Selected resources must honor the plan currency and free-resource constraint."));
    }
  }
  const selectedCost = [...resources.values()].filter((row) => row.selected).reduce((sum, row) => sum + (Number.isInteger(row.costMinor) ? row.costMinor : 0), 0);
  if (selectedCost > plan.costLimitMinor) findings.push(finding("cost_limit_exceeded", "resources", "Selected resource cost exceeds the plan limit."));

  for (const [id, checkpoint] of checkpoints) {
    requireRef(competencies, checkpoint.competencyRef, `checkpoints/${id}/competencyRef`, "unknown_competency", findings);
    const checkpointEvidence = rows(checkpoint.evidenceRefs).map((ref) => requireRef(evidence, ref, `checkpoints/${id}/evidenceRefs`, "unknown_evidence", findings)).filter(Boolean);
    if (checkpointEvidence.some((row) => row.competencyRef !== checkpoint.competencyRef)) {
      findings.push(finding("cross_competency_checkpoint_evidence", `checkpoints/${id}/evidenceRefs`, "Checkpoint evidence must bind the checkpoint competency."));
    }
    if (checkpoint.status === "passed" && !checkpointEvidence.some((row) => row.result === "supports" && row.kind !== "self-report")) {
      findings.push(finding("unsupported_passed_checkpoint", `checkpoints/${id}`, "A passed checkpoint needs supporting non-self-report evidence."));
    }
  }

  const orderedActivities = rows(value.activities).filter(isRecord).sort((left, right) => left.sequence - right.sequence);
  const coveredWeeks = new Set();
  for (const [index, activity] of orderedActivities.entries()) {
    if (activity.sequence !== index + 1 || activity.startWeek > activity.endWeek || activity.endWeek > plan.durationWeeks) {
      findings.push(finding("invalid_activity_sequence", `activities/${activity.id}`, "Activities must have contiguous sequence numbers and valid week ranges."));
    }
    const competency = requireRef(competencies, activity.competencyRef, `activities/${activity.id}/competencyRef`, "unknown_competency", findings);
    if (competency && !sameSet(activity.prerequisiteRefs, competency.prerequisiteRefs)) {
      findings.push(finding("prerequisite_drift", `activities/${activity.id}/prerequisiteRefs`, "Activity prerequisites must equal the competency prerequisites."));
    }
    const checkpoint = requireRef(checkpoints, activity.checkpointRef, `activities/${activity.id}/checkpointRef`, "unknown_checkpoint", findings);
    if (checkpoint && checkpoint.competencyRef !== activity.competencyRef) findings.push(finding("cross_competency_activity_checkpoint", `activities/${activity.id}/checkpointRef`, "Activity checkpoint must bind the same competency."));
    for (const ref of rows(activity.resourceRefs)) {
      const resource = requireRef(resources, ref, `activities/${activity.id}/resourceRefs`, "unknown_resource", findings);
      if (resource && (!resource.selected || !rows(resource.competencyRefs).includes(activity.competencyRef))) findings.push(finding("invalid_activity_resource", `activities/${activity.id}/resourceRefs`, "Activity resources must be selected for the same competency."));
    }
    for (let week = activity.startWeek; week <= activity.endWeek; week += 1) {
      if (coveredWeeks.has(week)) findings.push(finding("overlapping_activity_weeks", `activities/${activity.id}`, `Week ${week} is covered more than once.`));
      coveredWeeks.add(week);
      if (activity.minutesPerWeek > plan.weeklyMinutes) findings.push(finding("weekly_budget_exceeded", `activities/${activity.id}/minutesPerWeek`, "Activity exceeds the weekly time budget."));
    }
    const unmetPrerequisite = rows(activity.prerequisiteRefs).some((ref) => competencies.get(ref)?.status !== "evidenced");
    if (unmetPrerequisite && activity.status !== "blocked") findings.push(finding("unmet_prerequisite", `activities/${activity.id}/status`, "An activity with an unevidenced prerequisite must remain blocked."));
  }
  if (coveredWeeks.size !== plan.durationWeeks) findings.push(finding("incomplete_week_coverage", "activities", "Activities must cover every plan week exactly once."));

  for (const [id, competency] of competencies) {
    if (competency.status === "evidenced") {
      const passed = rows(competency.checkpointRefs).some((ref) => checkpoints.get(ref)?.status === "passed");
      const supported = rows(competency.evidenceRefs).some((ref) => {
        const row = evidence.get(ref);
        return row?.result === "supports" && row.kind !== "self-report";
      });
      if (!passed || !supported) findings.push(finding("unsupported_evidenced_competency", `competencies/${id}/status`, "An evidenced competency needs a passed checkpoint and supporting non-self-report evidence."));
    }
  }

  const failedOrSkipped = [...checkpoints.values()].filter((row) => row.status === "failed" || row.status === "skipped").map((row) => row.id);
  const blocked = [...checkpoints.values()].filter((row) => row.status === "blocked").map((row) => row.id);
  if (!sameSet(review.failedOrSkippedCheckpointRefs, failedOrSkipped)) findings.push(finding("incomplete_failed_checkpoint_review", "review/failedOrSkippedCheckpointRefs", "Review must exactly cover failed and skipped checkpoints."));
  if (!sameSet(review.blockedCheckpointRefs, blocked)) findings.push(finding("incomplete_blocked_checkpoint_review", "review/blockedCheckpointRefs", "Review must exactly cover blocked checkpoints."));
  if ([...checkpoints.values()].some((row) => row.status !== "passed") && review.decision === "complete") {
    findings.push(finding("premature_completion", "review/decision", "A plan cannot be complete until every checkpoint has passed."));
  }

  for (const [key, action] of Object.entries(prohibited)) {
    if (action !== false) findings.push(finding("prohibited_authority_claim", `prohibitedActions/${key}`, "Learning Plan Coordinator cannot claim external or evaluative action."));
  }
  for (const [path, owner] of [["plan/owner", plan.owner], ["review/nextPlanOwner", review.nextPlanOwner], ...rows(value.checkpoints).map((row) => [`checkpoints/${row?.id}/owner`, row?.owner]), ...rows(value.activities).map((row) => [`activities/${row?.id}/owner`, row?.owner])]) {
    if (owner === "learning-plan-coordinator") findings.push(finding("invalid_owner_authority", path, "The Claw cannot own learner decisions or actions."));
  }

  return findings;
}
