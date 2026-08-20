import { createHash } from "node:crypto";

function finding(code, path, message) {
  return { code, path, message };
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeChangePlanDigest(plan) {
  const { digest: _digest, ...digestInput } = plan;
  return createHash("sha256").update(canonicalJson(digestInput)).digest("hex");
}

function duplicates(values) {
  const seen = new Set();
  return [...new Set(values.filter((value) => seen.size === seen.add(value).size))];
}

function uniqueFindings(values, path, label) {
  return duplicates(values).map((value) =>
    finding("duplicate_reference", path, `${label} ${JSON.stringify(value)} is duplicated.`),
  );
}

function referenceFindings(values, allowed, path, label) {
  return values
    .filter((value) => !allowed.has(value))
    .map((value) =>
      finding("dangling_reference", path, `${label} ${JSON.stringify(value)} does not resolve.`),
    );
}

function numbersEqual(left, right) {
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= Number.EPSILON * scale * 8;
}

function dataAnalysisFindings(value) {
  const sourceRefs = value.sources.map((source) => source.reference);
  const outputFields = value.transformations.map((transformation) => transformation.outputField);
  const metricNames = value.metrics.map((metric) => metric.name);
  const lineage = new Set([...sourceRefs, ...outputFields]);
  const findings = [
    ...uniqueFindings(sourceRefs, "sources", "Source reference"),
    ...uniqueFindings(outputFields, "transformations", "Transformation output"),
    ...uniqueFindings(metricNames, "metrics", "Metric name"),
  ];
  for (const [index, transformation] of value.transformations.entries()) {
    findings.push(
      ...referenceFindings(
        [transformation.inputRef],
        lineage,
        `transformations.${index}.inputRef`,
        "Transformation input",
      ),
    );
  }
  for (const [index, metric] of value.metrics.entries()) {
    findings.push(
      ...uniqueFindings(metric.lineageRefs, `metrics.${index}.lineageRefs`, "Lineage reference"),
      ...referenceFindings(
        metric.lineageRefs,
        lineage,
        `metrics.${index}.lineageRefs`,
        "Lineage reference",
      ),
    );
  }
  const metrics = new Set(metricNames);
  for (const [index, item] of value.findings.entries()) {
    findings.push(
      ...uniqueFindings(item.metricRefs, `findings.${index}.metricRefs`, "Metric reference"),
      ...referenceFindings(
        item.metricRefs,
        metrics,
        `findings.${index}.metricRefs`,
        "Metric reference",
      ),
    );
  }
  return findings;
}

function projectFindings(value) {
  const milestoneIds = value.milestones.map((milestone) => milestone.id);
  const known = new Set(milestoneIds);
  const findings = uniqueFindings(milestoneIds, "milestones", "Milestone id");
  const graph = new Map();
  for (const [index, milestone] of value.milestones.entries()) {
    findings.push(
      ...uniqueFindings(
        milestone.dependencies,
        `milestones.${index}.dependencies`,
        "Milestone dependency",
      ),
      ...referenceFindings(
        milestone.dependencies,
        known,
        `milestones.${index}.dependencies`,
        "Milestone dependency",
      ),
    );
    if (milestone.dependencies.includes(milestone.id)) {
      findings.push(
        finding(
          "dependency_cycle",
          `milestones.${index}.dependencies`,
          `Milestone ${JSON.stringify(milestone.id)} cannot depend on itself.`,
        ),
      );
    }
    graph.set(milestone.id, milestone.dependencies.filter((dependency) => known.has(dependency)));
  }
  const visited = new Set();
  const active = new Set();
  function visit(id) {
    if (active.has(id)) {
      findings.push(
        finding("dependency_cycle", "milestones", `Milestone dependency cycle reaches ${id}.`),
      );
      return;
    }
    if (visited.has(id)) {
      return;
    }
    active.add(id);
    for (const dependency of graph.get(id) ?? []) {
      visit(dependency);
    }
    active.delete(id);
    visited.add(id);
  }
  for (const id of milestoneIds) {
    visit(id);
  }
  return findings;
}

function productFindings(value) {
  const evidenceRefs = value.evidence.map((evidence) => evidence.reference);
  const known = new Set(evidenceRefs);
  const findings = uniqueFindings(evidenceRefs, "evidence", "Evidence reference");
  const evidenceByRef = new Map(
    value.evidence.map((evidence) => [evidence.reference, evidence]),
  );
  for (const [index, option] of value.options.entries()) {
    findings.push(
      ...uniqueFindings(option.evidenceRefs, `options.${index}.evidenceRefs`, "Evidence reference"),
      ...referenceFindings(
        option.evidenceRefs,
        known,
        `options.${index}.evidenceRefs`,
        "Evidence reference",
      ),
    );
    if (
      option.state === "recommended" &&
      !option.evidenceRefs.some((reference) => evidenceByRef.get(reference)?.state === "supported")
    ) {
      findings.push(
        finding(
          "unsupported_terminal_state",
          `options.${index}.state`,
          "A recommended option requires at least one supported evidence reference.",
        ),
      );
    }
  }
  return findings;
}

function researchFindings(value) {
  const claimRefs = value.claims.map((claim) => claim.claim);
  const known = new Set(claimRefs);
  const findings = uniqueFindings(claimRefs, "claims", "Claim");
  for (const [index, option] of value.options.entries()) {
    findings.push(
      ...uniqueFindings(option.claimRefs, `options.${index}.claimRefs`, "Claim reference"),
      ...referenceFindings(
        option.claimRefs,
        known,
        `options.${index}.claimRefs`,
        "Claim reference",
      ),
    );
  }
  return findings;
}

function financialAnalysisFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const assumptionIds = value.assumptions.map((item) => item.id);
  const scenarioIds = value.scenarios.map((item) => item.id);
  const sources = new Set(sourceIds);
  const assumptions = new Set(assumptionIds);
  const scenarios = new Set(scenarioIds);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(assumptionIds, "assumptions", "Assumption id"),
    ...uniqueFindings(scenarioIds, "scenarios", "Scenario id"),
    ...uniqueFindings(value.risks.map((item) => item.id), "risks", "Risk id"),
  ];
  for (const [index, assumption] of value.assumptions.entries()) {
    findings.push(
      ...uniqueFindings(assumption.sourceRefs, `assumptions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(
        assumption.sourceRefs,
        sources,
        `assumptions.${index}.sourceRefs`,
        "Source reference",
      ),
    );
  }
  for (const [index, scenario] of value.scenarios.entries()) {
    findings.push(
      ...uniqueFindings(
        scenario.assumptionRefs,
        `scenarios.${index}.assumptionRefs`,
        "Assumption reference",
      ),
      ...referenceFindings(
        scenario.assumptionRefs,
        assumptions,
        `scenarios.${index}.assumptionRefs`,
        "Assumption reference",
      ),
    );
  }
  for (const [index, risk] of value.risks.entries()) {
    findings.push(
      ...uniqueFindings(risk.sourceRefs, `risks.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(risk.sourceRefs, sources, `risks.${index}.sourceRefs`, "Source reference"),
      ...uniqueFindings(
        risk.scenarioRefs,
        `risks.${index}.scenarioRefs`,
        "Scenario reference",
      ),
      ...referenceFindings(
        risk.scenarioRefs,
        scenarios,
        `risks.${index}.scenarioRefs`,
        "Scenario reference",
      ),
    );
  }
  return findings;
}

function publicSafetyFindings(value) {
  const alertIds = value.alerts.map((item) => item.id);
  const alerts = new Set(alertIds);
  const findings = [
    ...uniqueFindings(alertIds, "alerts", "Alert id"),
    ...uniqueFindings(value.observations.map((item) => item.id), "observations", "Observation id"),
    ...uniqueFindings(value.actions.map((item) => item.id), "actions", "Action id"),
  ];
  for (const [index, alert] of value.alerts.entries()) {
    if (Date.parse(alert.expiresAt) <= Date.parse(alert.issuedAt)) {
      findings.push(
        finding(
          "invalid_time_range",
          `alerts.${index}.expiresAt`,
          "Alert expiry must be later than its issue time.",
        ),
      );
    }
  }
  for (const [index, observation] of value.observations.entries()) {
    findings.push(
      ...uniqueFindings(
        observation.alertRefs,
        `observations.${index}.alertRefs`,
        "Alert reference",
      ),
      ...referenceFindings(
        observation.alertRefs,
        alerts,
        `observations.${index}.alertRefs`,
        "Alert reference",
      ),
    );
  }
  for (const [index, action] of value.actions.entries()) {
    findings.push(
      ...uniqueFindings(action.alertRefs, `actions.${index}.alertRefs`, "Alert reference"),
      ...referenceFindings(
        action.alertRefs,
        alerts,
        `actions.${index}.alertRefs`,
        "Alert reference",
      ),
    );
  }
  return findings;
}

function recruitingFindings(value) {
  const interviewerIds = value.interviewers.map((item) => item.id);
  const competencyIds = value.competencies.map((item) => item.id);
  const constraintIds = value.constraints.map((item) => item.id);
  const sessionIds = value.sessions.map((item) => item.id);
  const interviewers = new Set(interviewerIds);
  const competencies = new Set(competencyIds);
  const constraints = new Set(constraintIds);
  const sessions = new Set(sessionIds);
  const findings = [
    ...uniqueFindings(interviewerIds, "interviewers", "Interviewer id"),
    ...uniqueFindings(competencyIds, "competencies", "Competency id"),
    ...uniqueFindings(constraintIds, "constraints", "Constraint id"),
    ...uniqueFindings(sessionIds, "sessions", "Session id"),
  ];
  for (const [index, session] of value.sessions.entries()) {
    findings.push(
      ...uniqueFindings(
        session.interviewerRefs,
        `sessions.${index}.interviewerRefs`,
        "Interviewer reference",
      ),
      ...referenceFindings(
        session.interviewerRefs,
        interviewers,
        `sessions.${index}.interviewerRefs`,
        "Interviewer reference",
      ),
      ...uniqueFindings(
        session.competencyRefs,
        `sessions.${index}.competencyRefs`,
        "Competency reference",
      ),
      ...referenceFindings(
        session.competencyRefs,
        competencies,
        `sessions.${index}.competencyRefs`,
        "Competency reference",
      ),
      ...uniqueFindings(
        session.constraintRefs,
        `sessions.${index}.constraintRefs`,
        "Constraint reference",
      ),
      ...referenceFindings(
        session.constraintRefs,
        constraints,
        `sessions.${index}.constraintRefs`,
        "Constraint reference",
      ),
    );
    if (Date.parse(session.end) <= Date.parse(session.start)) {
      findings.push(
        finding(
          "invalid_time_range",
          `sessions.${index}.end`,
          "Interview session end must be later than its start.",
        ),
      );
    }
  }
  for (const [index, communication] of value.communications.entries()) {
    findings.push(
      ...uniqueFindings(
        communication.sessionRefs,
        `communications.${index}.sessionRefs`,
        "Session reference",
      ),
      ...referenceFindings(
        communication.sessionRefs,
        sessions,
        `communications.${index}.sessionRefs`,
        "Session reference",
      ),
    );
  }
  return findings;
}

function salesOperationsFindings(value) {
  const dealIds = value.deals.map((item) => item.id);
  const deals = new Set(dealIds);
  const findings = [
    ...uniqueFindings(dealIds, "deals", "Deal id"),
    ...uniqueFindings(value.risks.map((item) => item.id), "risks", "Risk id"),
    ...uniqueFindings(value.actions.map((item) => item.id), "actions", "Action id"),
  ];
  for (const [index, change] of value.changes.entries()) {
    findings.push(
      ...referenceFindings([change.dealRef], deals, `changes.${index}.dealRef`, "Deal reference"),
    );
  }
  for (const [index, risk] of value.risks.entries()) {
    findings.push(
      ...uniqueFindings(risk.dealRefs, `risks.${index}.dealRefs`, "Deal reference"),
      ...referenceFindings(risk.dealRefs, deals, `risks.${index}.dealRefs`, "Deal reference"),
    );
  }
  for (const [index, action] of value.actions.entries()) {
    findings.push(
      ...uniqueFindings(action.dealRefs, `actions.${index}.dealRefs`, "Deal reference"),
      ...referenceFindings(
        action.dealRefs,
        deals,
        `actions.${index}.dealRefs`,
        "Deal reference",
      ),
    );
  }
  return findings;
}

function civicDataFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const measureIds = value.measures.map((item) => item.id);
  const sources = new Set(sourceIds);
  const measures = new Set(measureIds);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(measureIds, "measures", "Measure id"),
    ...uniqueFindings(value.comparisons.map((item) => item.id), "comparisons", "Comparison id"),
  ];
  for (const [index, measure] of value.measures.entries()) {
    findings.push(
      ...uniqueFindings(
        measure.sourceRefs,
        `measures.${index}.sourceRefs`,
        "Source reference",
      ),
      ...referenceFindings(
        measure.sourceRefs,
        sources,
        `measures.${index}.sourceRefs`,
        "Source reference",
      ),
    );
    if (measure.geographyRef !== value.geography.id) {
      findings.push(
        finding(
          "dangling_reference",
          `measures.${index}.geographyRef`,
          `Geography reference ${JSON.stringify(measure.geographyRef)} does not resolve.`,
        ),
      );
    }
  }
  for (const [index, comparison] of value.comparisons.entries()) {
    findings.push(
      ...uniqueFindings(
        comparison.measureRefs,
        `comparisons.${index}.measureRefs`,
        "Measure reference",
      ),
      ...referenceFindings(
        comparison.measureRefs,
        measures,
        `comparisons.${index}.measureRefs`,
        "Measure reference",
      ),
    );
  }
  return findings;
}

function changeControlFindings(value) {
  const stepIds = value.plan.steps.map((item) => item.id);
  const steps = new Set(stepIds);
  const findings = [
    ...uniqueFindings(stepIds, "plan.steps", "Step id"),
    ...uniqueFindings(value.execution.stepResults.map((item) => item.stepRef), "execution.stepResults", "Step result reference"),
  ];
  const expectedDigest = computeChangePlanDigest(value.plan);
  if (value.plan.digest !== expectedDigest) {
    findings.push(
      finding("invalid_plan_digest", "plan.digest", "Plan digest must be the SHA-256 of the canonical plan content."),
    );
  }
  if (value.decision.planDigest !== value.plan.digest) {
    findings.push(finding("digest_mismatch", "decision.planDigest", "Owner decision must bind the current plan digest."));
  }
  if (value.execution.planDigest !== value.plan.digest) {
    findings.push(finding("digest_mismatch", "execution.planDigest", "Execution must bind the current plan digest."));
  }
  for (const [index, result] of value.execution.stepResults.entries()) {
    findings.push(
      ...referenceFindings([result.stepRef], steps, `execution.stepResults.${index}.stepRef`, "Step reference"),
    );
  }
  if (
    value.execution.state === "verified" &&
    (value.decision.state !== "approved-by-owner" ||
      value.execution.stepResults.length !== value.plan.steps.length ||
      value.execution.stepResults.some((item) => item.state !== "passed") ||
      value.execution.verificationResults.length === 0)
  ) {
    findings.push(
      finding(
        "unsupported_terminal_state",
        "execution.state",
        "Verified execution requires owner approval, one passing result per plan step, and verification evidence.",
      ),
    );
  }
  if (Date.parse(value.decision.decidedAt) < Date.parse(value.plan.generatedAt)) {
    findings.push(
      finding("invalid_time_order", "decision.decidedAt", "Owner decision cannot predate plan generation."),
    );
  }
  return findings;
}

function caseContinuityFindings(value) {
  const evidenceIds = value.evidence.map((item) => item.id);
  const checkpointIds = value.checkpoints.map((item) => item.id);
  const evidence = new Set(evidenceIds);
  const checkpoints = new Set(checkpointIds);
  const findings = [
    ...uniqueFindings(evidenceIds, "evidence", "Evidence id"),
    ...uniqueFindings(checkpointIds, "checkpoints", "Checkpoint id"),
    ...uniqueFindings(value.actions.map((item) => item.id), "actions", "Action id"),
  ];
  const latestRecordedAt = Date.parse(value.checkpoints.at(-1).recordedAt);
  for (const [index, item] of value.evidence.entries()) {
    if (Date.parse(item.expiresAt) <= Date.parse(item.observedAt)) {
      findings.push(
        finding("invalid_time_range", `evidence.${index}.expiresAt`, "Evidence expiry must follow observation time."),
      );
    }
    if (item.state === "current" && Date.parse(item.expiresAt) <= latestRecordedAt) {
      findings.push(
        finding(
          "stale_evidence_state",
          `evidence.${index}.state`,
          "Evidence expired by the latest checkpoint cannot remain current.",
        ),
      );
    }
  }
  for (const [index, checkpoint] of value.checkpoints.entries()) {
    findings.push(
      ...uniqueFindings(checkpoint.evidenceRefs, `checkpoints.${index}.evidenceRefs`, "Evidence reference"),
      ...referenceFindings(
        checkpoint.evidenceRefs,
        evidence,
        `checkpoints.${index}.evidenceRefs`,
        "Evidence reference",
      ),
    );
    const expectedPrevious = index === 0 ? null : value.checkpoints[index - 1].id;
    if (checkpoint.previousRef !== expectedPrevious || checkpoint.version !== index + 1) {
      findings.push(
        finding(
          "invalid_checkpoint_chain",
          `checkpoints.${index}`,
          "Checkpoint versions must be ordered and link directly to their predecessor.",
        ),
      );
    }
    for (const reference of checkpoint.evidenceRefs) {
      const item = value.evidence.find((candidate) => candidate.id === reference);
      if (item && Date.parse(item.observedAt) > Date.parse(checkpoint.recordedAt)) {
        findings.push(
          finding(
            "future_evidence_reference",
            `checkpoints.${index}.evidenceRefs`,
            `Checkpoint cannot reference evidence ${JSON.stringify(reference)} observed later.`,
          ),
        );
      }
    }
  }
  for (const [index, action] of value.actions.entries()) {
    findings.push(
      ...uniqueFindings(action.evidenceRefs, `actions.${index}.evidenceRefs`, "Evidence reference"),
      ...referenceFindings(action.evidenceRefs, evidence, `actions.${index}.evidenceRefs`, "Evidence reference"),
    );
  }
  findings.push(
    ...referenceFindings([value.resume.checkpointRef], checkpoints, "resume.checkpointRef", "Checkpoint reference"),
  );
  if (value.resume.checkpointRef !== value.checkpoints.at(-1).id) {
    findings.push(
      finding("stale_resume_point", "resume.checkpointRef", "Resume instructions must reference the latest checkpoint."),
    );
  }
  return findings;
}

function delegationFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const assignmentIds = value.assignments.map((item) => item.id);
  const resultIds = value.results.map((item) => item.id);
  const sources = new Set(sourceIds);
  const assignments = new Map(value.assignments.map((item) => [item.id, item]));
  const results = new Set(resultIds);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(assignmentIds, "assignments", "Assignment id"),
    ...uniqueFindings(resultIds, "results", "Result id"),
    ...uniqueFindings(value.conflicts.map((item) => item.id), "conflicts", "Conflict id"),
  ];
  for (const [index, assignment] of value.assignments.entries()) {
    findings.push(
      ...uniqueFindings(assignment.sourceRefs, `assignments.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(
        assignment.sourceRefs,
        sources,
        `assignments.${index}.sourceRefs`,
        "Source reference",
      ),
    );
  }
  for (const [index, result] of value.results.entries()) {
    findings.push(
      ...referenceFindings(
        [result.assignmentRef],
        new Set(assignmentIds),
        `results.${index}.assignmentRef`,
        "Assignment reference",
      ),
      ...uniqueFindings(result.sourceRefs, `results.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(result.sourceRefs, sources, `results.${index}.sourceRefs`, "Source reference"),
    );
    const assignment = assignments.get(result.assignmentRef);
    if (assignment && assignment.workerSessionRef !== result.workerSessionRef) {
      findings.push(
        finding(
          "session_mismatch",
          `results.${index}.workerSessionRef`,
          "Worker result session must match its assignment.",
        ),
      );
    }
    if (
      assignment &&
      result.sourceRefs.some((reference) => !assignment.sourceRefs.includes(reference))
    ) {
      findings.push(
        finding(
          "scope_expansion",
          `results.${index}.sourceRefs`,
          "Worker result may cite only sources assigned to that worker.",
        ),
      );
    }
  }
  for (const [index, assignment] of value.assignments.entries()) {
    const matchingResults = value.results.filter((result) => result.assignmentRef === assignment.id);
    if (assignment.state === "completed" && matchingResults.length !== 1) {
      findings.push(
        finding(
          "missing_completed_result",
          `assignments.${index}.state`,
          "A completed assignment requires exactly one provenance-linked result.",
        ),
      );
    }
  }
  for (const [index, conflict] of value.conflicts.entries()) {
    findings.push(
      ...uniqueFindings(conflict.resultRefs, `conflicts.${index}.resultRefs`, "Result reference"),
      ...referenceFindings(
        conflict.resultRefs,
        results,
        `conflicts.${index}.resultRefs`,
        "Result reference",
      ),
    );
  }
  findings.push(
    ...uniqueFindings(value.synthesis.resultRefs, "synthesis.resultRefs", "Result reference"),
    ...referenceFindings(value.synthesis.resultRefs, results, "synthesis.resultRefs", "Result reference"),
  );
  if (value.synthesis.decisionOwner !== value.decisionOwner) {
    findings.push(
      finding(
        "owner_mismatch",
        "synthesis.decisionOwner",
        "Synthesis must preserve the parent accountable decision owner.",
      ),
    );
  }
  return findings;
}

function modelEvaluationFindings(value) {
  const criterionIds = value.criteria.map((item) => item.id);
  const anchorIds = value.anchors.map((item) => item.id);
  const outputIds = value.outputs.map((item) => item.id);
  const evaluatorIds = value.evaluators.map((item) => item.id);
  const judgmentIds = value.judgments.map((item) => item.id);
  const criteria = new Map(value.criteria.map((item) => [item.id, item]));
  const judgments = new Map(value.judgments.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(criterionIds, "criteria", "Criterion id"),
    ...uniqueFindings(anchorIds, "anchors", "Anchor id"),
    ...uniqueFindings(outputIds, "outputs", "Output id"),
    ...uniqueFindings(value.outputs.map((item) => item.blindLabel), "outputs", "Blind label"),
    ...uniqueFindings(value.outputs.map((item) => item.sourceRef), "outputs", "Blinded source"),
    ...uniqueFindings(evaluatorIds, "evaluators", "Evaluator id"),
    ...uniqueFindings(judgmentIds, "judgments", "Judgment id"),
    ...uniqueFindings(value.disagreements.map((item) => item.id), "disagreements", "Disagreement id"),
  ];
  const anchors = new Set(anchorIds);
  const requiredAnchors = new Set(anchorIds);
  const outputs = new Set(outputIds);
  const evaluators = new Set(evaluatorIds);
  const judgmentSet = new Set(judgmentIds);
  for (const [index, criterion] of value.criteria.entries()) {
    findings.push(
      ...uniqueFindings(criterion.anchorRefs, `criteria.${index}.anchorRefs`, "Anchor reference"),
      ...referenceFindings(
        criterion.anchorRefs,
        anchors,
        `criteria.${index}.anchorRefs`,
        "Anchor reference",
      ),
    );
    for (const anchorRef of criterion.anchorRefs) {
      const anchor = value.anchors.find((item) => item.id === anchorRef);
      if (anchor && anchor.criterionRef !== criterion.id) {
        findings.push(
          finding(
            "anchor_criterion_mismatch",
            `criteria.${index}.anchorRefs`,
            `Anchor ${JSON.stringify(anchorRef)} belongs to a different criterion.`,
          ),
        );
      }
    }
    if (criterion.scale.max <= criterion.scale.min) {
      findings.push(
        finding(
          "invalid_score_scale",
          `criteria.${index}.scale`,
          "Criterion score maximum must be greater than its minimum.",
        ),
      );
    }
  }
  for (const [index, anchor] of value.anchors.entries()) {
    findings.push(
      ...referenceFindings(
        [anchor.criterionRef],
        new Set(criterionIds),
        `anchors.${index}.criterionRef`,
        "Criterion reference",
      ),
    );
    const criterion = criteria.get(anchor.criterionRef);
    if (
      criterion &&
      (anchor.score < criterion.scale.min || anchor.score > criterion.scale.max)
    ) {
      findings.push(
        finding(
          "score_out_of_range",
          `anchors.${index}.score`,
          "Anchor score must fit the referenced criterion scale.",
        ),
      );
    }
  }
  for (const [index, output] of value.outputs.entries()) {
    const blindId = output.blindLabel.replace(/^System /, "").toLowerCase();
    if (
      output.id !== `output-${blindId}` ||
      output.sourceRef !== `blinded/system-${blindId}.json`
    ) {
      findings.push(
        finding(
          "exposed_output_identity",
          `outputs.${index}`,
          "Output ids and source paths must derive only from their opaque blind label.",
        ),
      );
    }
  }
  for (const [index, evaluator] of value.evaluators.entries()) {
    findings.push(
      ...uniqueFindings(evaluator.anchorRefs, `evaluators.${index}.anchorRefs`, "Anchor reference"),
      ...referenceFindings(
        evaluator.anchorRefs,
        anchors,
        `evaluators.${index}.anchorRefs`,
        "Anchor reference",
      ),
    );
    if (
      evaluator.calibrationState === "calibrated" &&
      (evaluator.anchorRefs.length !== requiredAnchors.size ||
        [...requiredAnchors].some((reference) => !evaluator.anchorRefs.includes(reference)))
    ) {
      findings.push(
        finding(
          "incomplete_calibration",
          `evaluators.${index}.anchorRefs`,
          "A calibrated evaluator must complete the full declared anchor set.",
        ),
      );
    }
  }
  const samplingKeys = value.samplingPlan.map(
    (item) => `${item.outputRef}\u0000${item.criterionRef}\u0000${item.evaluatorRef}`,
  );
  const samplingSet = new Set(samplingKeys);
  findings.push(...uniqueFindings(samplingKeys, "samplingPlan", "Sampling tuple"));
  for (const [index, item] of value.samplingPlan.entries()) {
    findings.push(
      ...referenceFindings(
        [item.outputRef],
        outputs,
        `samplingPlan.${index}.outputRef`,
        "Output reference",
      ),
      ...referenceFindings(
        [item.criterionRef],
        new Set(criterionIds),
        `samplingPlan.${index}.criterionRef`,
        "Criterion reference",
      ),
      ...referenceFindings(
        [item.evaluatorRef],
        evaluators,
        `samplingPlan.${index}.evaluatorRef`,
        "Evaluator reference",
      ),
    );
  }
  for (const [values, offset, label] of [
    [outputIds, 0, "output"],
    [criterionIds, 1, "criterion"],
    [evaluatorIds, 2, "evaluator"],
  ]) {
    for (const valueId of values) {
      if (![...samplingSet].some((key) => key.split("\u0000")[offset] === valueId)) {
        findings.push(
          finding(
            "incomplete_sampling_plan",
            "samplingPlan",
            `Sampling plan does not cover declared ${label} ${JSON.stringify(valueId)}.`,
          ),
        );
      }
    }
  }
  const judgmentKeys = new Set();
  for (const [index, judgment] of value.judgments.entries()) {
    findings.push(
      ...referenceFindings(
        [judgment.outputRef],
        outputs,
        `judgments.${index}.outputRef`,
        "Output reference",
      ),
      ...referenceFindings(
        [judgment.criterionRef],
        new Set(criterionIds),
        `judgments.${index}.criterionRef`,
        "Criterion reference",
      ),
      ...referenceFindings(
        [judgment.evaluatorRef],
        evaluators,
        `judgments.${index}.evaluatorRef`,
        "Evaluator reference",
      ),
    );
    const key = `${judgment.outputRef}\u0000${judgment.criterionRef}\u0000${judgment.evaluatorRef}`;
    if (judgmentKeys.has(key)) {
      findings.push(
        finding(
          "duplicate_judgment",
          `judgments.${index}`,
          "Each output, criterion, and evaluator combination may have only one judgment.",
        ),
      );
    }
    judgmentKeys.add(key);
    if (!samplingSet.has(key)) {
      findings.push(
        finding(
          "unplanned_judgment",
          `judgments.${index}`,
          "Every judgment must belong to the declared sampling plan.",
        ),
      );
    }
    const criterion = criteria.get(judgment.criterionRef);
    if (
      criterion &&
      (judgment.score < criterion.scale.min || judgment.score > criterion.scale.max)
    ) {
      findings.push(
        finding(
          "score_out_of_range",
          `judgments.${index}.score`,
          "Judgment score must fit the referenced criterion scale.",
        ),
      );
    }
  }
  const judgmentsByGroup = new Map();
  for (const judgment of value.judgments) {
    const key = `${judgment.outputRef}\u0000${judgment.criterionRef}`;
    const group = judgmentsByGroup.get(key) ?? [];
    group.push(judgment);
    judgmentsByGroup.set(key, group);
  }
  const disagreementGroups = new Map();
  for (const [index, disagreement] of value.disagreements.entries()) {
    findings.push(
      ...uniqueFindings(
        disagreement.judgmentRefs,
        `disagreements.${index}.judgmentRefs`,
        "Judgment reference",
      ),
      ...referenceFindings(
        disagreement.judgmentRefs,
        judgmentSet,
        `disagreements.${index}.judgmentRefs`,
        "Judgment reference",
      ),
    );
    const linked = disagreement.judgmentRefs
      .map((reference) => judgments.get(reference))
      .filter(Boolean);
    if (
      linked.length > 1 &&
      linked.some(
        (item) =>
          item.outputRef !== linked[0].outputRef || item.criterionRef !== linked[0].criterionRef,
      )
    ) {
      findings.push(
        finding(
          "incomparable_disagreement",
          `disagreements.${index}.judgmentRefs`,
          "A disagreement may compare judgments only for the same output and criterion.",
        ),
      );
    }
    if (linked.length > 1) {
      const groupKey = `${linked[0].outputRef}\u0000${linked[0].criterionRef}`;
      const completeGroup = judgmentsByGroup.get(groupKey) ?? [];
      if (disagreementGroups.has(groupKey)) {
        findings.push(
          finding(
            "duplicate_disagreement",
            `disagreements.${index}`,
            "Each output and criterion pair may have only one disagreement record.",
          ),
        );
      }
      disagreementGroups.set(groupKey, disagreement);
      if (
        disagreement.judgmentRefs.length !== completeGroup.length ||
        completeGroup.some((judgment) => !disagreement.judgmentRefs.includes(judgment.id))
      ) {
        findings.push(
          finding(
            "incomplete_disagreement",
            `disagreements.${index}.judgmentRefs`,
            "A disagreement must include every judgment for its output and criterion pair.",
          ),
        );
      }
      const scores = completeGroup.map((item) => item.score);
      const spread = Math.max(...scores) - Math.min(...scores);
      if (!numbersEqual(spread, disagreement.spread)) {
        findings.push(
          finding(
            "spread_mismatch",
            `disagreements.${index}.spread`,
            "Disagreement spread must equal the linked judgment score range.",
          ),
        );
      }
      if (
        disagreement.thresholdExceeded !==
        (spread >= value.study.disagreementThreshold)
      ) {
        findings.push(
          finding(
            "threshold_mismatch",
            `disagreements.${index}.thresholdExceeded`,
            "Threshold state must match the study disagreement threshold.",
          ),
        );
      }
    }
  }
  const materialDisagreementGroups = new Set();
  for (const [groupKey, group] of judgmentsByGroup.entries()) {
    if (group.length < 2) {
      continue;
    }
    const scores = group.map((item) => item.score);
    const spread = Math.max(...scores) - Math.min(...scores);
    if (spread < value.study.disagreementThreshold) {
      continue;
    }
    materialDisagreementGroups.add(groupKey);
    if (!disagreementGroups.has(groupKey)) {
      findings.push(
        finding(
          "missing_disagreement",
          "disagreements",
          "Every threshold-crossing output and criterion pair requires a disagreement record.",
        ),
      );
    }
  }
  const missingKeys = value.coverage.missing.map(
    (item) => `${item.outputRef}\u0000${item.criterionRef}\u0000${item.evaluatorRef}`,
  );
  findings.push(
    ...uniqueFindings(missingKeys, "coverage.missing", "Missing judgment key"),
  );
  for (const [index, item] of value.coverage.missing.entries()) {
    const key = `${item.outputRef}\u0000${item.criterionRef}\u0000${item.evaluatorRef}`;
    findings.push(
      ...referenceFindings(
        [item.outputRef],
        outputs,
        `coverage.missing.${index}.outputRef`,
        "Output reference",
      ),
      ...referenceFindings(
        [item.criterionRef],
        new Set(criterionIds),
        `coverage.missing.${index}.criterionRef`,
        "Criterion reference",
      ),
      ...referenceFindings(
        [item.evaluatorRef],
        evaluators,
        `coverage.missing.${index}.evaluatorRef`,
        "Evaluator reference",
      ),
    );
    if (!samplingSet.has(key)) {
      findings.push(
        finding(
          "unplanned_missing_judgment",
          `coverage.missing.${index}`,
          "Every missing judgment must belong to the declared sampling plan.",
        ),
      );
    }
  }
  for (const key of samplingSet) {
    const occurrences = Number(judgmentKeys.has(key)) + Number(missingKeys.includes(key));
    if (occurrences !== 1) {
      findings.push(
        finding(
          "sampling_coverage_mismatch",
          "samplingPlan",
          "Every planned judgment must appear exactly once as completed or explicitly missing.",
        ),
      );
    }
  }
  if (
    value.coverage.completedJudgments !== value.judgments.length ||
    value.coverage.expectedJudgments !== value.samplingPlan.length ||
    value.coverage.expectedJudgments !== value.coverage.completedJudgments + value.coverage.missing.length
  ) {
    findings.push(
      finding(
        "coverage_mismatch",
        "coverage",
        "Coverage totals must equal the judgment ledger plus explicit missing evaluations.",
      ),
    );
  }
  if (canonicalJson(value.handoff.decisionOwner) !== canonicalJson(value.study.decisionOwner)) {
    findings.push(
      finding(
        "owner_mismatch",
        "handoff.decisionOwner",
        "The comparison handoff must preserve the study decision owner.",
      ),
    );
  }
  if (
    value.study.decisionOwner.id === "model-evaluation-adjudicator" ||
    value.study.blinding.verifiedBy.id === "model-evaluation-adjudicator"
  ) {
    findings.push(
      finding(
        "agent_owned_authority",
        "study",
        "Decision ownership and blinding verification must remain human- or team-owned.",
      ),
    );
  }
  if (
    value.handoff.state === "ready-for-owner" &&
    (value.study.blinding.state !== "verified" ||
      value.evaluators.some((item) => item.calibrationState !== "calibrated") ||
      value.coverage.missing.length > 0 ||
      [...materialDisagreementGroups].some(
        (groupKey) => disagreementGroups.get(groupKey)?.state !== "adjudicated",
      ))
  ) {
    findings.push(
      finding(
        "unsupported_terminal_state",
        "handoff.state",
        "A ready handoff requires verified blinding, calibrated evaluators, complete coverage, and adjudicated threshold-crossing disagreements.",
      ),
    );
  }
  return findings;
}

function vehicleServiceFindings(value) {
  const evidenceIds = value.evidence.map((item) => item.id);
  const evidence = new Set(evidenceIds);
  const providerIds = value.providers.map((item) => item.id);
  const providers = new Set(providerIds);
  const findings = [
    ...uniqueFindings(evidenceIds, "evidence", "Evidence id"),
    ...uniqueFindings(value.observations.map((item) => item.id), "observations", "Observation id"),
    ...uniqueFindings(value.hypotheses.map((item) => item.id), "hypotheses", "Hypothesis id"),
    ...uniqueFindings(value.ownerChecks.map((item) => item.id), "ownerChecks", "Owner check id"),
    ...uniqueFindings(providerIds, "providers", "Provider id"),
  ];
  if (/\b[A-HJ-NPR-Z0-9]{17}\b/iu.test(canonicalJson(value))) {
    findings.push(
      finding(
        "exposed_vehicle_identifier",
        "vehicle",
        "Durable vehicle-service artifacts must not contain a VIN-like identifier.",
      ),
    );
  }
  const evidenceReferences = [
    ...value.observations.map((item) => [item.evidenceRefs, "observations"]),
    [value.assessment.evidenceRefs, "assessment.evidenceRefs"],
    ...value.hypotheses.map((item) => [item.evidenceRefs, "hypotheses"]),
    ...value.ownerChecks.map((item) => [item.evidenceRefs, "ownerChecks"]),
    ...value.providers.map((item) => [[item.sourceRef], "providers"]),
  ];
  for (const [references, path] of evidenceReferences) {
    findings.push(...uniqueFindings(references, path, "Evidence reference"));
    findings.push(...referenceFindings(references, evidence, path, "Evidence reference"));
  }
  for (const [index, hypothesis] of value.hypotheses.entries()) {
    if (
      hypothesis.status === "technician-confirmed" &&
      !hypothesis.evidenceRefs.some((reference) => {
        const item = value.evidence.find((candidate) => candidate.id === reference);
        return item?.authority === "qualified-technician";
      })
    ) {
      findings.push(
        finding(
          "unsupported_diagnosis",
          `hypotheses.${index}`,
          "Only qualified-technician evidence may confirm a vehicle diagnosis.",
        ),
      );
    }
  }
  for (const [index, check] of value.ownerChecks.entries()) {
    if (
      check.safetyClass === "manual-approved" &&
      !check.evidenceRefs.some((reference) => {
        const item = value.evidence.find((candidate) => candidate.id === reference);
        return item?.type === "manual" && item.authority === "manufacturer";
      })
    ) {
      findings.push(
        finding(
          "unsupported_owner_check",
          `ownerChecks.${index}.evidenceRefs`,
          "A manual-approved owner check must cite manufacturer manual evidence.",
        ),
      );
    }
  }
  if (
    value.assessment.safetyCritical &&
    !["stop-driving", "roadside-only", "uncertain"].includes(value.assessment.safeToDrive)
  ) {
    findings.push(
      finding(
        "unsafe_driving_state",
        "assessment.safeToDrive",
        "Safety-critical evidence cannot produce a routine or limited-use driving state.",
      ),
    );
  }
  if (
    ["stop-driving", "roadside-only", "uncertain"].includes(value.assessment.safeToDrive) &&
    !["emergency-services", "roadside-assistance", "qualified-specialist"].includes(
      value.assessment.escalation,
    )
  ) {
    findings.push(
      finding(
        "missing_safety_escalation",
        "assessment.escalation",
        "An unsafe or uncertain driving state requires a qualified escalation.",
      ),
    );
  }
  const appointment = value.appointment;
  const hasPlan = Boolean(appointment.plan);
  const hasApproval = Boolean(appointment.approval);
  const hasIntegration = Boolean(appointment.bookingIntegration);
  const hasReceipt = Boolean(appointment.receipt);
  if (
    (["options-ready", "awaiting-approval", "approved", "booked"].includes(
      appointment.state,
    ) &&
      !hasPlan) ||
    (["approved", "booked"].includes(appointment.state) && !hasApproval) ||
    (appointment.state === "booked" && (!hasIntegration || !hasReceipt)) ||
    (appointment.state !== "booked" && (hasIntegration || hasReceipt)) ||
    (!["approved", "booked"].includes(appointment.state) && hasApproval) ||
    (appointment.state === "not-requested" && hasPlan) ||
    (appointment.state === "blocked" && !appointment.blockedReason)
  ) {
    findings.push(
      finding(
        "incoherent_appointment_state",
        "appointment",
        "Appointment plan, approval, integration, receipt, and blocked reason must match the declared state.",
      ),
    );
  }
  if (appointment.plan) {
    findings.push(
      ...referenceFindings(
        [appointment.plan.providerRef],
        providers,
        "appointment.plan.providerRef",
        "Provider reference",
      ),
    );
    if (appointment.plan.maxDeposit > appointment.plan.maxCost) {
      findings.push(
        finding(
          "deposit_exceeds_cost",
          "appointment.plan.maxDeposit",
          "The approved deposit ceiling cannot exceed the total cost ceiling.",
        ),
      );
    }
  }
  const planDigest = appointment.plan
    ? `sha256:${createHash("sha256").update(canonicalJson(appointment.plan)).digest("hex")}`
    : undefined;
  if (["approved", "booked"].includes(appointment.state)) {
    if (!appointment.plan || !appointment.approval) {
      findings.push(
        finding(
          "missing_appointment_approval",
          "appointment",
          "Approved and booked appointments require an exact plan and owner approval.",
        ),
      );
    } else {
      if (appointment.approval.planDigest !== planDigest) {
        findings.push(
          finding(
            "appointment_digest_mismatch",
            "appointment.approval.planDigest",
            "Appointment approval must bind the exact plan.",
          ),
        );
      }
      if (canonicalJson(appointment.approval.owner) !== canonicalJson(value.owner)) {
        findings.push(
          finding(
            "appointment_owner_mismatch",
            "appointment.approval.owner",
            "Appointment approval must come from the accountable vehicle owner.",
          ),
        );
      }
    }
  }
  if (appointment.state === "booked") {
    if (!appointment.bookingIntegration || !appointment.receipt) {
      findings.push(
        finding(
          "unsupported_booking",
          "appointment",
          "A booked state requires an approved integration and verifiable receipt.",
        ),
      );
    } else {
      if (
        appointment.receipt.planDigest !== planDigest ||
        appointment.receipt.integrationId !== appointment.bookingIntegration.id ||
        appointment.receipt.providerRef !== appointment.plan.providerRef ||
        appointment.bookingIntegration.providerRef !== appointment.plan.providerRef ||
        !appointment.receipt.confirmationRef.startsWith(
          `provider://${appointment.plan.providerRef}/`,
        )
      ) {
        findings.push(
          finding(
            "booking_receipt_mismatch",
            "appointment.receipt",
            "The booking integration and receipt must bind the exact approved plan and provider.",
          ),
        );
      }
      if (
        canonicalJson(appointment.bookingIntegration.configuredBy) !==
        canonicalJson(value.owner)
      ) {
        findings.push(
          finding(
            "unapproved_booking_integration",
            "appointment.bookingIntegration.configuredBy",
            "The accountable owner must approve the configured booking integration.",
          ),
        );
      }
      if (
        appointment.approval &&
        Date.parse(appointment.receipt.bookedAt) < Date.parse(appointment.approval.approvedAt)
      ) {
        findings.push(
          finding(
            "booking_predates_approval",
            "appointment.receipt.bookedAt",
            "A booking receipt cannot predate the owner's exact plan approval.",
          ),
        );
      }
    }
  }
  if (
    canonicalJson(value.handoff.owner) !== canonicalJson(value.owner) ||
    value.owner.id === "vehicle-service-coordinator"
  ) {
    findings.push(
      finding(
        "agent_owned_authority",
        "handoff.owner",
        "Vehicle, repair, payment, and appointment authority must remain owner-controlled.",
      ),
    );
  }
  return findings;
}

function homeRepairFindings(value) {
  const evidenceIds = value.evidence.map((item) => item.id);
  const evidence = new Set(evidenceIds);
  const observationIds = value.observations.map((item) => item.id);
  const observations = new Set(observationIds);
  const hypothesisIds = value.repairPlan.hypotheses.map((item) => item.id);
  const hypotheses = new Set(hypothesisIds);
  const providerIds = value.providers.map((item) => item.id);
  const providers = new Set(providerIds);
  const findings = [
    ...uniqueFindings(evidenceIds, "evidence", "Evidence id"),
    ...uniqueFindings(observationIds, "observations", "Observation id"),
    ...uniqueFindings(
      hypothesisIds,
      "repairPlan.hypotheses",
      "Hypothesis id",
    ),
    ...uniqueFindings(
      value.repairPlan.steps.map((item) => item.id),
      "repairPlan.steps",
      "Repair step id",
    ),
    ...uniqueFindings(providerIds, "providers", "Provider id"),
  ];
  const evidenceReferences = [
    ...value.observations.map((item) => [item.evidenceRefs, "observations"]),
    [value.hazardAssessment.evidenceRefs, "hazardAssessment.evidenceRefs"],
    ...value.isolations.map((item) => [item.evidenceRefs, "isolations"]),
    ...value.repairPlan.hypotheses.map((item) => [
      item.evidenceRefs,
      "repairPlan.hypotheses",
    ]),
    ...value.repairPlan.steps.map((item) => [item.evidenceRefs, "repairPlan.steps"]),
    [value.verification.evidenceRefs, "verification.evidenceRefs"],
    ...value.providers.map((item) => [[item.sourceRef], "providers"]),
    ...(value.appointment.bookingIntegration
      ? [[[value.appointment.bookingIntegration.approvalEvidenceRef], "appointment.bookingIntegration"]]
      : []),
    ...(value.appointment.receipt
      ? [[[value.appointment.receipt.evidenceRef], "appointment.receipt"]]
      : []),
  ];
  for (const [references, path] of evidenceReferences) {
    findings.push(...uniqueFindings(references, path, "Evidence reference"));
    findings.push(...referenceFindings(references, evidence, path, "Evidence reference"));
  }
  if (/\b\d{1,6}[A-Za-z]?(?:-\d{1,6}[A-Za-z]?)?\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:Alley|Aly|Avenue|Ave|Boulevard|Blvd|Circle|Cir|Court|Ct|Crescent|Cres|Drive|Dr|Expressway|Expy|Freeway|Fwy|Highway|Hwy|Lane|Ln|Parkway|Pkwy|Place|Pl|Plaza|Plz|Road|Rd|Route|Rte|Square|Sq|Street|St|Terrace|Ter|Trail|Trl|Way)\b/iu.test(canonicalJson(value))) {
    findings.push(
      finding(
        "exposed_home_address",
        "home",
        "Durable home-repair artifacts must use room and system labels, not a street address.",
      ),
    );
  }
  const highHazards = new Set([
    "gas",
    "mains-electricity",
    "structural",
    "fire",
    "asbestos",
    "lead",
    "mold",
    "refrigerant",
    "roof",
    "height",
    "confined-space",
    "uncontrolled-water",
  ]);
  const hasHighHazard = value.hazardAssessment.hazards.some((item) =>
    highHazards.has(item),
  );
  if (
    (value.hazardAssessment.hazards.includes("none") &&
      value.hazardAssessment.hazards.length !== 1) ||
    (value.repairPlan.eligibility === "owner-repair" &&
      (value.hazardAssessment.level !== "low-risk" ||
        value.hazardAssessment.action !== "bounded-owner-check" ||
        canonicalJson(value.hazardAssessment.hazards) !== canonicalJson(["none"]))) ||
    (hasHighHazard &&
      (value.hazardAssessment.action === "bounded-owner-check" ||
        value.repairPlan.eligibility === "owner-repair" ||
        value.repairPlan.steps.length > 0))
  ) {
    findings.push(
      finding(
        "unsafe_repair_eligibility",
        "hazardAssessment",
        "High-hazard or contradictory hazard state cannot permit owner repair.",
      ),
    );
  }
  for (const [index, provider] of value.providers.entries()) {
    const providerEvidence = value.evidence.find(
      (item) => item.id === provider.sourceRef,
    );
    if (
      providerEvidence &&
      (providerEvidence.type !== "provider-info" ||
        !["service-provider", "qualified-specialist"].includes(
          providerEvidence.authority,
        ))
    ) {
      findings.push(
        finding(
          "unsupported_provider_evidence",
          `providers.${index}.sourceRef`,
          "Every provider must cite provider-information evidence from the provider or a qualified specialist.",
        ),
      );
    }
  }
  if (
    (value.repairPlan.eligibility === "owner-repair" &&
      (value.repairPlan.hypotheses.length === 0 || value.repairPlan.steps.length === 0)) ||
    (value.repairPlan.eligibility !== "owner-repair" && value.repairPlan.steps.length > 0)
  ) {
    findings.push(
      finding(
        "incoherent_owner_repair_plan",
        "repairPlan",
        "Owner repair requires an evidence-linked hypothesis and step; specialist-only or blocked plans cannot contain resident repair instructions.",
      ),
    );
  }
  if (
    value.repairPlan.eligibility === "owner-repair" &&
    !["verified-owner", "verified-tenant-permission"].includes(value.home.workAuthority)
  ) {
    findings.push(
      finding(
        "missing_work_authority",
        "home.workAuthority",
        "Owner repair requires verified authority for the bounded work.",
      ),
    );
  }
  if (
    value.repairPlan.eligibility === "owner-repair" &&
    value.isolations.some((item) => ["unknown", "specialist-only"].includes(item.state))
  ) {
    findings.push(
      finding(
        "unconfirmed_isolation",
        "isolations",
        "Owner repair requires every declared isolation to be confirmed or not required.",
      ),
    );
  }
  if (
    value.isolations.some(
      (item) => item.state === "confirmed" && item.evidenceRefs.length === 0,
    )
  ) {
    findings.push(
      finding(
        "unsupported_isolation",
        "isolations",
        "Every confirmed household isolation requires supporting evidence.",
      ),
    );
  }
  for (const [index, hypothesis] of value.repairPlan.hypotheses.entries()) {
    if (
      hypothesis.status === "specialist-confirmed" &&
      !hypothesis.evidenceRefs.some((reference) => {
        const item = value.evidence.find((candidate) => candidate.id === reference);
        return (
          item?.type === "specialist-finding" &&
          item.authority === "qualified-specialist"
        );
      })
    ) {
      findings.push(
        finding(
          "unsupported_diagnosis",
          `repairPlan.hypotheses.${index}`,
          "Only qualified-specialist evidence may confirm a household defect.",
        ),
      );
    }
  }
  for (const [index, step] of value.repairPlan.steps.entries()) {
    findings.push(
      ...referenceFindings(
        step.observationRefs,
        observations,
        `repairPlan.steps.${index}.observationRefs`,
        "Observation reference",
      ),
      ...referenceFindings(
        step.hypothesisRefs,
        hypotheses,
        `repairPlan.steps.${index}.hypothesisRefs`,
        "Hypothesis reference",
      ),
    );
    if (
      step.class === "manual-approved" &&
      !step.evidenceRefs.some((reference) => {
        const item = value.evidence.find((candidate) => candidate.id === reference);
        return item?.type === "manual" && item.authority === "manufacturer";
      })
    ) {
      findings.push(
        finding(
          "unsupported_repair_step",
          `repairPlan.steps.${index}.evidenceRefs`,
          "A manual-approved repair step must cite manufacturer manual evidence.",
        ),
      );
    }
  }
  if (
    value.verification.state === "passed" &&
    (value.verification.evidenceRefs.length === 0 ||
      value.verification.unresolvedConditions.length > 0 ||
      !value.verification.evidenceRefs.some((reference) => {
        const item = value.evidence.find((candidate) => candidate.id === reference);
        return ["photo", "recording", "measurement"].includes(item?.type);
      }))
  ) {
    findings.push(
      finding(
        "unsupported_verification",
        "verification",
        "Passed verification requires evidence and no unresolved conditions.",
      ),
    );
  }
  const appointment = value.appointment;
  const hasPlan = Boolean(appointment.plan);
  const hasApproval = Boolean(appointment.approval);
  const hasIntegration = Boolean(appointment.bookingIntegration);
  const hasReceipt = Boolean(appointment.receipt);
  if (
    (["options-ready", "awaiting-approval", "approved", "booked"].includes(
      appointment.state,
    ) &&
      !hasPlan) ||
    (["approved", "booked"].includes(appointment.state) && !hasApproval) ||
    (appointment.state === "booked" && (!hasIntegration || !hasReceipt)) ||
    (appointment.state !== "booked" && (hasIntegration || hasReceipt)) ||
    (!["approved", "booked"].includes(appointment.state) && hasApproval) ||
    (appointment.state === "not-requested" && hasPlan) ||
    (appointment.state === "blocked" && !appointment.blockedReason)
  ) {
    findings.push(
      finding(
        "incoherent_appointment_state",
        "appointment",
        "Appointment plan, approval, integration, receipt, and blocked reason must match the declared state.",
      ),
    );
  }
  if (appointment.plan) {
    findings.push(
      ...referenceFindings(
        [appointment.plan.providerRef],
        providers,
        "appointment.plan.providerRef",
        "Provider reference",
      ),
    );
    const provider = value.providers.find(
      (item) => item.id === appointment.plan.providerRef,
    );
    if (
      provider &&
      (provider.trade !== appointment.plan.trade ||
        provider.qualificationState !== "owner-verified")
    ) {
      findings.push(
        finding(
          "unsupported_provider",
          "appointment.plan",
          "The appointment trade must match an owner-verified provider.",
        ),
      );
    }
    if (appointment.plan.maxDeposit > appointment.plan.maxCost) {
      findings.push(
        finding(
          "deposit_exceeds_cost",
          "appointment.plan.maxDeposit",
          "The approved deposit ceiling cannot exceed the total cost ceiling.",
        ),
      );
    }
  }
  const planDigest = appointment.plan
    ? `sha256:${createHash("sha256").update(canonicalJson(appointment.plan)).digest("hex")}`
    : undefined;
  if (["approved", "booked"].includes(appointment.state) && appointment.approval) {
    if (
      appointment.approval.planDigest !== planDigest ||
      canonicalJson(appointment.approval.resident) !== canonicalJson(value.resident)
    ) {
      findings.push(
        finding(
          "appointment_approval_mismatch",
          "appointment.approval",
          "Appointment approval must bind the exact plan and accountable resident.",
        ),
      );
    }
  }
  if (
    appointment.state === "booked" &&
    appointment.plan &&
    appointment.approval &&
    appointment.bookingIntegration &&
    appointment.receipt
  ) {
    const integrationEvidence = value.evidence.find(
      (item) => item.id === appointment.bookingIntegration.approvalEvidenceRef,
    );
    const receiptEvidence = value.evidence.find(
      (item) => item.id === appointment.receipt.evidenceRef,
    );
    if (
      appointment.receipt.planDigest !== planDigest ||
      appointment.receipt.integrationId !== appointment.bookingIntegration.id ||
      appointment.receipt.providerRef !== appointment.plan.providerRef ||
      appointment.bookingIntegration.providerRef !== appointment.plan.providerRef ||
      !appointment.receipt.confirmationRef.startsWith(
        `provider://${appointment.plan.providerRef}/`,
      ) ||
      integrationEvidence?.type !== "integration-approval" ||
      integrationEvidence.authority !== "resident-supplied" ||
      integrationEvidence.reference !== appointment.bookingIntegration.approvalRef ||
      receiptEvidence?.type !== "provider-receipt" ||
      receiptEvidence.authority !== "service-provider" ||
      receiptEvidence.reference !== appointment.receipt.confirmationRef ||
      receiptEvidence.capturedAt !== appointment.receipt.bookedAt ||
      canonicalJson(appointment.bookingIntegration.configuredBy) !==
        canonicalJson(value.resident)
    ) {
      findings.push(
        finding(
          "booking_receipt_mismatch",
          "appointment.receipt",
          "The owner-approved integration and provider receipt must bind the exact appointment plan.",
        ),
      );
    }
    if (Date.parse(appointment.receipt.bookedAt) < Date.parse(appointment.approval.approvedAt)) {
      findings.push(
        finding(
          "booking_predates_approval",
          "appointment.receipt.bookedAt",
          "A specialist booking cannot predate the resident's exact plan approval.",
        ),
      );
    }
  }
  if (
    canonicalJson(value.handoff.resident) !== canonicalJson(value.resident) ||
    value.resident.id === "home-repair-coordinator"
  ) {
    findings.push(
      finding(
        "agent_owned_authority",
        "handoff.resident",
        "Repair, trade, payment, and appointment authority must remain resident-controlled.",
      ),
    );
  }
  return findings;
}

function greenThumbFindings(value) {
  const evidenceIds = value.evidence.map((item) => item.id);
  const evidence = new Set(evidenceIds);
  const observationIds = value.observations.map((item) => item.id);
  const observations = new Set(observationIds);
  const hypothesisIds = value.hypotheses.map((item) => item.id);
  const hypotheses = new Set(hypothesisIds);
  const monitoringIds = value.monitoring.map((item) => item.id);
  const monitoring = new Set(monitoringIds);
  const providerIds = value.providers.map((item) => item.id);
  const providers = new Set(providerIds);
  const findings = [
    ...uniqueFindings(evidenceIds, "evidence", "Evidence id"),
    ...uniqueFindings(observationIds, "observations", "Observation id"),
    ...uniqueFindings(hypothesisIds, "hypotheses", "Hypothesis id"),
    ...uniqueFindings(value.calendar.map((item) => item.id), "calendar", "Calendar id"),
    ...uniqueFindings(value.carePlan.steps.map((item) => item.id), "carePlan.steps", "Care step id"),
    ...uniqueFindings(monitoringIds, "monitoring", "Monitoring id"),
    ...uniqueFindings(providerIds, "providers", "Provider id"),
  ];
  const evidenceReferences = [
    ...value.observations.map((item) => [item.evidenceRefs, "observations"]),
    [value.riskAssessment.evidenceRefs, "riskAssessment.evidenceRefs"],
    ...value.hypotheses.map((item) => [item.evidenceRefs, "hypotheses"]),
    ...value.calendar.map((item) => [item.siteEvidenceRefs, "calendar"]),
    ...value.carePlan.steps.map((item) => [item.evidenceRefs, "carePlan.steps"]),
    ...value.monitoring.map((item) => [item.evidenceRefs, "monitoring"]),
    ...value.providers.map((item) => [[item.sourceRef], "providers"]),
    ...(value.appointment.bookingIntegration
      ? [[[value.appointment.bookingIntegration.approvalEvidenceRef], "appointment.bookingIntegration"]]
      : []),
    ...(value.appointment.receipt
      ? [[[value.appointment.receipt.evidenceRef], "appointment.receipt"]]
      : []),
  ];
  for (const [references, path] of evidenceReferences) {
    findings.push(...uniqueFindings(references, path, "Evidence reference"));
    findings.push(...referenceFindings(references, evidence, path, "Evidence reference"));
  }
  if (/\b\d{1,6}[A-Za-z]?(?:-\d{1,6}[A-Za-z]?)?\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:Alley|Aly|Avenue|Ave|Boulevard|Blvd|Circle|Cir|Court|Ct|Crescent|Cres|Drive|Dr|Expressway|Expy|Freeway|Fwy|Highway|Hwy|Lane|Ln|Parkway|Pkwy|Place|Pl|Plaza|Plz|Road|Rd|Route|Rte|Square|Sq|Street|St|Terrace|Ter|Trail|Trl|Way)\b/iu.test(canonicalJson(value))) {
    findings.push(
      finding(
        "exposed_home_address",
        "site",
        "Durable garden artifacts must use garden labels, not a street address.",
      ),
    );
  }
  const highRisks = new Set([
    "poison-exposure",
    "toxic-species",
    "invasive-species",
    "regulated-pesticide",
    "off-label-treatment",
    "hazardous-tree",
    "excavation",
    "mains-electricity",
    "pressurized-irrigation",
    "protected-species",
  ]);
  const hasHighRisk = value.riskAssessment.risks.some((item) => highRisks.has(item));
  if (
    (value.riskAssessment.risks.includes("none") &&
      value.riskAssessment.risks.length !== 1) ||
    (value.riskAssessment.risks.includes("none") &&
      value.riskAssessment.level !== "low-risk") ||
    (value.riskAssessment.level === "low-risk" &&
      value.riskAssessment.action !== "bounded-resident-care") ||
    (value.riskAssessment.level === "emergency" &&
      !["poison-control", "emergency-services"].includes(value.riskAssessment.action)) ||
    (["high", "qualified-specialist", "uncertain"].includes(value.riskAssessment.level) &&
      value.riskAssessment.action !== "qualified-specialist") ||
    (value.riskAssessment.risks.includes("poison-exposure") &&
      !["poison-control", "emergency-services"].includes(value.riskAssessment.action)) ||
    (hasHighRisk &&
      !["high", "qualified-specialist", "emergency"].includes(
        value.riskAssessment.level,
      )) ||
    (value.carePlan.eligibility === "resident-care" &&
      (value.riskAssessment.level !== "low-risk" ||
        value.riskAssessment.action !== "bounded-resident-care" ||
        canonicalJson(value.riskAssessment.risks) !== canonicalJson(["none"]))) ||
    (hasHighRisk && value.carePlan.steps.length > 0)
  ) {
    findings.push(
      finding(
        "unsafe_care_eligibility",
        "riskAssessment",
        "High-risk, uncertain, or contradictory states cannot permit resident care.",
      ),
    );
  }
  if (
    (value.carePlan.eligibility === "resident-care" &&
      (value.hypotheses.length === 0 || value.carePlan.steps.length === 0)) ||
    (value.carePlan.eligibility !== "resident-care" && value.carePlan.steps.length > 0)
  ) {
    findings.push(
      finding(
        "incoherent_care_plan",
        "carePlan",
        "Resident care requires an evidence-linked hypothesis and step; specialist-only or blocked plans cannot contain resident instructions.",
      ),
    );
  }
  if (
    value.carePlan.eligibility === "resident-care" &&
    !["verified-owner", "verified-tenant-permission"].includes(value.site.workAuthority)
  ) {
    findings.push(
      finding(
        "missing_work_authority",
        "site.workAuthority",
        "Resident garden work requires verified authority.",
      ),
    );
  }
  for (const [index, hypothesis] of value.hypotheses.entries()) {
    findings.push(
      ...referenceFindings(
        hypothesis.observationRefs,
        observations,
        `hypotheses.${index}.observationRefs`,
        "Observation reference",
      ),
    );
    if (
      hypothesis.status === "specialist-confirmed" &&
      !hypothesis.evidenceRefs.some((reference) => {
        const item = value.evidence.find((candidate) => candidate.id === reference);
        return item?.type === "specialist-finding" && item.authority === "qualified-specialist";
      })
    ) {
      findings.push(
        finding(
          "unsupported_diagnosis",
          `hypotheses.${index}`,
          "Only a qualified specialist finding may confirm a plant-health condition.",
        ),
      );
    }
  }
  for (const [index, item] of value.calendar.entries()) {
    if (
      Date.parse(item.windowEnd) < Date.parse(item.windowStart) ||
      !item.siteEvidenceRefs.some((reference) => {
        const evidenceItem = value.evidence.find((candidate) => candidate.id === reference);
        return ["zone-record", "weather-record", "soil-test", "species-record", "water-rule"].includes(
          evidenceItem?.type,
        );
      })
    ) {
      findings.push(
        finding(
          "unsupported_calendar_window",
          `calendar.${index}`,
          "Calendar windows require ordered dates and site, climate, species, soil, or water evidence.",
        ),
      );
    }
    if (
      item.executor === "resident" &&
      (value.riskAssessment.level !== "low-risk" ||
        value.riskAssessment.action !== "bounded-resident-care" ||
        hasHighRisk ||
        !["verified-owner", "verified-tenant-permission"].includes(value.site.workAuthority))
    ) {
      findings.push(
        finding(
          "unsafe_calendar_activity",
          `calendar.${index}`,
          "Resident calendar activities require verified authority and no high-risk condition.",
        ),
      );
    }
  }
  for (const [index, step] of value.carePlan.steps.entries()) {
    findings.push(
      ...referenceFindings(
        step.observationRefs,
        observations,
        `carePlan.steps.${index}.observationRefs`,
        "Observation reference",
      ),
      ...referenceFindings(
        step.hypothesisRefs,
        hypotheses,
        `carePlan.steps.${index}.hypothesisRefs`,
        "Hypothesis reference",
      ),
      ...referenceFindings(
        [step.monitoringRef],
        monitoring,
        `carePlan.steps.${index}.monitoringRef`,
        "Monitoring reference",
      ),
    );
    const labelEvidence = step.productUse
      ? value.evidence.find((item) => item.id === step.productUse.labelRef)
      : undefined;
    const localRuleEvidence = step.productUse?.localRuleRefs.map((reference) =>
      value.evidence.find((item) => item.id === reference),
    );
    if (
      (step.class === "label-approved-product" &&
        (!step.productUse ||
          step.productUse.licenseRequired ||
          !step.evidenceRefs.includes(step.productUse.labelRef) ||
          labelEvidence?.type !== "product-label" ||
          labelEvidence.authority !== "manufacturer" ||
          localRuleEvidence?.some(
            (item) => item?.type !== "treatment-rule" || item.authority !== "government",
          ))) ||
      (step.class !== "label-approved-product" && step.productUse !== null)
    ) {
      findings.push(
        finding(
          "unsupported_product_step",
          `carePlan.steps.${index}.productUse`,
          "A resident product step must bind its exact manufacturer label, permitted target and limits, applicable government rule, and non-licensed use.",
        ),
      );
    }
  }
  for (const [index, item] of value.monitoring.entries()) {
    if (
      ["passed", "failed"].includes(item.state) &&
      (!item.observedAt ||
        Date.parse(item.observedAt) < Date.parse(item.dueAt) ||
        !item.evidenceRefs.some((reference) => {
        const evidenceItem = value.evidence.find((candidate) => candidate.id === reference);
        return (
          ["photo", "measurement"].includes(evidenceItem?.type) &&
          evidenceItem.capturedAt === item.observedAt
        );
      }))
    ) {
      findings.push(
        finding(
          "unsupported_monitoring_result",
          `monitoring.${index}`,
          "Passed or failed monitoring requires timed outcome photo or measurement evidence.",
        ),
      );
    }
  }
  for (const [index, provider] of value.providers.entries()) {
    const providerEvidence = value.evidence.find((item) => item.id === provider.sourceRef);
    if (
      providerEvidence &&
      (providerEvidence.type !== "provider-info" ||
        !["service-provider", "qualified-specialist"].includes(providerEvidence.authority))
    ) {
      findings.push(
        finding(
          "unsupported_provider_evidence",
          `providers.${index}.sourceRef`,
          "Every provider must cite provider-information evidence.",
        ),
      );
    }
  }
  const appointment = value.appointment;
  const hasPlan = Boolean(appointment.plan);
  const hasApproval = Boolean(appointment.approval);
  const hasIntegration = Boolean(appointment.bookingIntegration);
  const hasReceipt = Boolean(appointment.receipt);
  if (
    (["options-ready", "awaiting-approval", "approved", "booked"].includes(appointment.state) &&
      !hasPlan) ||
    (["approved", "booked"].includes(appointment.state) && !hasApproval) ||
    (appointment.state === "booked" && (!hasIntegration || !hasReceipt)) ||
    (appointment.state !== "booked" && (hasIntegration || hasReceipt)) ||
    (!["approved", "booked"].includes(appointment.state) && hasApproval) ||
    (appointment.state === "not-requested" && hasPlan) ||
    (appointment.state === "blocked" && !appointment.blockedReason)
  ) {
    findings.push(
      finding(
        "incoherent_appointment_state",
        "appointment",
        "Appointment plan, approval, integration, receipt, and blocked reason must match the state.",
      ),
    );
  }
  if (appointment.plan) {
    findings.push(
      ...referenceFindings(
        [appointment.plan.providerRef],
        providers,
        "appointment.plan.providerRef",
        "Provider reference",
      ),
    );
    const provider = value.providers.find((item) => item.id === appointment.plan.providerRef);
    if (
      provider &&
      (provider.specialty !== appointment.plan.specialty ||
        provider.qualificationState !== "resident-verified")
    ) {
      findings.push(
        finding(
          "unsupported_provider",
          "appointment.plan",
          "The appointment specialty must match a resident-verified provider.",
        ),
      );
    }
    if (appointment.plan.maxDeposit > appointment.plan.maxCost) {
      findings.push(
        finding(
          "deposit_exceeds_cost",
          "appointment.plan.maxDeposit",
          "The deposit ceiling cannot exceed the cost ceiling.",
        ),
      );
    }
  }
  const planDigest = appointment.plan
    ? `sha256:${createHash("sha256").update(canonicalJson(appointment.plan)).digest("hex")}`
    : undefined;
  if (["approved", "booked"].includes(appointment.state) && appointment.approval) {
    if (
      appointment.approval.planDigest !== planDigest ||
      canonicalJson(appointment.approval.resident) !== canonicalJson(value.resident)
    ) {
      findings.push(
        finding(
          "appointment_approval_mismatch",
          "appointment.approval",
          "Appointment approval must bind the exact plan and resident.",
        ),
      );
    }
  }
  if (
    appointment.state === "booked" &&
    appointment.plan &&
    appointment.approval &&
    appointment.bookingIntegration &&
    appointment.receipt
  ) {
    const integrationEvidence = value.evidence.find(
      (item) => item.id === appointment.bookingIntegration.approvalEvidenceRef,
    );
    const receiptEvidence = value.evidence.find(
      (item) => item.id === appointment.receipt.evidenceRef,
    );
    if (
      appointment.receipt.planDigest !== planDigest ||
      appointment.receipt.integrationId !== appointment.bookingIntegration.id ||
      appointment.receipt.providerRef !== appointment.plan.providerRef ||
      appointment.bookingIntegration.providerRef !== appointment.plan.providerRef ||
      !appointment.receipt.confirmationRef.startsWith(
        `provider://${appointment.plan.providerRef}/`,
      ) ||
      integrationEvidence?.type !== "integration-approval" ||
      integrationEvidence.authority !== "resident-supplied" ||
      integrationEvidence.reference !== appointment.bookingIntegration.approvalRef ||
      receiptEvidence?.type !== "provider-receipt" ||
      receiptEvidence.authority !== "service-provider" ||
      receiptEvidence.reference !== appointment.receipt.confirmationRef ||
      receiptEvidence.capturedAt !== appointment.receipt.bookedAt ||
      Date.parse(integrationEvidence.capturedAt) > Date.parse(appointment.receipt.bookedAt) ||
      Date.parse(appointment.receipt.bookedAt) >= Date.parse(appointment.plan.startsAt) ||
      canonicalJson(appointment.bookingIntegration.configuredBy) !==
        canonicalJson(value.resident)
    ) {
      findings.push(
        finding(
          "booking_receipt_mismatch",
          "appointment.receipt",
          "The approved integration and provider receipt must bind the exact plan.",
        ),
      );
    }
    if (Date.parse(appointment.receipt.bookedAt) < Date.parse(appointment.approval.approvedAt)) {
      findings.push(
        finding(
          "booking_predates_approval",
          "appointment.receipt.bookedAt",
          "A specialist booking cannot predate resident approval.",
        ),
      );
    }
  }
  if (
    canonicalJson(value.handoff.resident) !== canonicalJson(value.resident) ||
    value.resident.id === "green-thumb-coordinator"
  ) {
    findings.push(
      finding(
        "agent_owned_authority",
        "handoff.resident",
        "Garden work, treatment, payment, and appointment authority remain resident-controlled.",
      ),
    );
  }
  return findings;
}

const validators = {
  "case-continuity-coordinator": caseContinuityFindings,
  "change-control-operator": changeControlFindings,
  "civic-data-analyst": civicDataFindings,
  "data-analyst": dataAnalysisFindings,
  "delegation-coordinator": delegationFindings,
  "financial-analyst": financialAnalysisFindings,
  "green-thumb-coordinator": greenThumbFindings,
  "home-repair-coordinator": homeRepairFindings,
  "model-evaluation-adjudicator": modelEvaluationFindings,
  "project-manager": projectFindings,
  "product-manager": productFindings,
  "public-safety-monitor": publicSafetyFindings,
  "recruiting-coordinator": recruitingFindings,
  "research-briefing": researchFindings,
  "sales-operations": salesOperationsFindings,
  "vehicle-service-coordinator": vehicleServiceFindings,
};

export function validateArtifactSemantics(id, value) {
  const validate = validators[id];
  if (!validate) {
    throw new Error(`No semantic artifact validator is registered for ${id}.`);
  }
  return validate(value);
}
