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

function householdStewardFindings(value) {
  const evidenceIds = value.evidence.map((item) => item.id);
  const evidence = new Set(evidenceIds);
  const evidenceById = new Map(value.evidence.map((item) => [item.id, item]));
  const memberIds = value.members.map((item) => item.id);
  const members = new Set(memberIds);
  const memberById = new Map(value.members.map((item) => [item.id, item]));
  const artifactIds = value.sourceArtifacts.map((item) => item.id);
  const artifacts = new Set(artifactIds);
  const artifactById = new Map(value.sourceArtifacts.map((item) => [item.id, item]));
  const assignmentIds = value.assignments.map((item) => item.id);
  const assignments = new Set(assignmentIds);
  const assignmentById = new Map(value.assignments.map((item) => [item.id, item]));
  const resultIds = value.results.map((item) => item.id);
  const results = new Set(resultIds);
  const resultById = new Map(value.results.map((item) => [item.id, item]));
  const budgetIds = value.budgets.map((item) => item.id);
  const budgets = new Set(budgetIds);
  const budgetById = new Map(value.budgets.map((item) => [item.id, item]));
  const policyIds = value.approvalPolicies.map((item) => item.id);
  const policies = new Set(policyIds);
  const policyById = new Map(value.approvalPolicies.map((item) => [item.id, item]));
  const operationIds = value.operations.map((item) => item.id);
  const operations = new Set(operationIds);
  const operationById = new Map(value.operations.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(evidenceIds, "evidence", "Evidence id"),
    ...uniqueFindings(memberIds, "members", "Member id"),
    ...uniqueFindings(artifactIds, "sourceArtifacts", "Source artifact id"),
    ...uniqueFindings(assignmentIds, "assignments", "Assignment id"),
    ...uniqueFindings(resultIds, "results", "Result id"),
    ...uniqueFindings(budgetIds, "budgets", "Budget id"),
    ...uniqueFindings(value.availability.map((item) => item.id), "availability", "Availability id"),
    ...uniqueFindings(policyIds, "approvalPolicies", "Approval policy id"),
    ...uniqueFindings(operationIds, "operations", "Operation id"),
    ...uniqueFindings(value.conflicts.map((item) => item.id), "conflicts", "Conflict id"),
    ...uniqueFindings(value.views.map((item) => item.id), "views", "View id"),
  ];
  for (const [references, allowed, path, label] of [
    ...value.members.map((item, index) => [item.authorityEvidenceRefs, evidence, `members.${index}.authorityEvidenceRefs`, "Evidence reference"]),
    ...value.sourceArtifacts.map((item, index) => [item.permittedMemberRefs, members, `sourceArtifacts.${index}.permittedMemberRefs`, "Member reference"]),
    ...value.assignments.map((item, index) => [item.sourceArtifactRefs, artifacts, `assignments.${index}.sourceArtifactRefs`, "Artifact reference"]),
    ...value.assignments.map((item, index) => [item.permittedMemberRefs, members, `assignments.${index}.permittedMemberRefs`, "Member reference"]),
    ...value.results.map((item, index) => [item.sourceArtifactRefs, artifacts, `results.${index}.sourceArtifactRefs`, "Artifact reference"]),
    ...value.budgets.map((item, index) => [item.approverRefs, members, `budgets.${index}.approverRefs`, "Member reference"]),
    ...value.budgets.map((item, index) => [item.evidenceRefs, evidence, `budgets.${index}.evidenceRefs`, "Evidence reference"]),
    ...value.availability.map((item, index) => [[item.memberRef], members, `availability.${index}.memberRef`, "Member reference"]),
    ...value.availability.map((item, index) => [item.evidenceRefs, evidence, `availability.${index}.evidenceRefs`, "Evidence reference"]),
    ...value.approvalPolicies.map((item, index) => [item.requiredMemberRefs, members, `approvalPolicies.${index}.requiredMemberRefs`, "Member reference"]),
    ...value.operations.map((item, index) => [[item.sourceArtifactRef], artifacts, `operations.${index}.sourceArtifactRef`, "Artifact reference"]),
    ...value.operations.map((item, index) => [item.affectedMemberRefs, members, `operations.${index}.affectedMemberRefs`, "Member reference"]),
    ...value.operations.filter((item) => item.assigneeRef).map((item, index) => [[item.assigneeRef], members, `operations.${index}.assigneeRef`, "Member reference"]),
    ...value.operations.map((item, index) => [[item.budgetRef], budgets, `operations.${index}.budgetRef`, "Budget reference"]),
    ...value.operations.map((item, index) => [item.dependencyRefs, operations, `operations.${index}.dependencyRefs`, "Operation reference"]),
    ...value.operations.map((item, index) => [[item.approvalPolicyRef], policies, `operations.${index}.approvalPolicyRef`, "Policy reference"]),
    ...value.conflicts.map((item, index) => [item.operationRefs, operations, `conflicts.${index}.operationRefs`, "Operation reference"]),
    ...value.conflicts.map((item, index) => [item.memberRefs, members, `conflicts.${index}.memberRefs`, "Member reference"]),
    ...value.conflicts.map((item, index) => [item.requiredDecisionRefs, members, `conflicts.${index}.requiredDecisionRefs`, "Member reference"]),
    ...value.views.map((item, index) => [item.audienceMemberRefs, members, `views.${index}.audienceMemberRefs`, "Member reference"]),
    ...value.views.map((item, index) => [item.operationRefs, operations, `views.${index}.operationRefs`, "Operation reference"]),
    ...value.views.map((item, index) => [item.sourceArtifactRefs, artifacts, `views.${index}.sourceArtifactRefs`, "Artifact reference"]),
    [value.handoff.accountableMemberRefs, members, "handoff.accountableMemberRefs", "Member reference"],
  ]) {
    findings.push(...uniqueFindings(references, path, label));
    findings.push(...referenceFindings(references, allowed, path, label));
  }
  if (
    /\b\d{1,6}[A-Za-z]?(?:-\d{1,6}[A-Za-z]?)?\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:Alley|Aly|Avenue|Ave|Boulevard|Blvd|Circle|Cir|Court|Ct|Drive|Dr|Highway|Hwy|Lane|Ln|Parkway|Pkwy|Place|Pl|Road|Rd|Route|Rte|Street|St|Terrace|Ter|Trail|Trl|Way)\b/iu.test(
      canonicalJson(value),
    )
  ) {
    findings.push(
      finding(
        "exposed_household_address",
        "household",
        "Household artifacts must use privacy-safe labels, not a street address.",
      ),
    );
  }
  for (const [index, member] of value.members.entries()) {
    const authorityEvidence = member.authorityEvidenceRefs.map((reference) =>
      evidenceById.get(reference),
    );
    const decisionBearing = member.decisionScopes.some((scope) => scope !== "none");
    if (
      !authorityEvidence.some((item) =>
        ["member-declaration", "authority-record"].includes(item?.type),
      ) ||
      (["minor", "caregiver", "guest", "unknown"].includes(member.kind) &&
        decisionBearing) ||
      (member.decisionScopes.includes("none") && member.decisionScopes.length !== 1) ||
      member.id === "household-steward"
    ) {
      findings.push(
        finding(
          "unsupported_member_authority",
          `members.${index}`,
          "Member roles and decision scopes require direct declarations; limited or unknown roles cannot gain household decision authority.",
        ),
      );
    }
  }
  const clawDomains = {
    "home-repair-coordinator": "home-repair",
    "appliance-care-coordinator": "appliance-care",
    "green-thumb-coordinator": "green-thumb",
    "pet-care-coordinator": "pet-care",
    "vehicle-service-coordinator": "vehicle-service",
    "pond-water-feature-coordinator": "pond-water-feature",
  };
  const asOf = Date.parse(value.household.asOf);
  for (const [index, artifact] of value.sourceArtifacts.entries()) {
    const owner = memberById.get(artifact.decisionOwnerRef);
    if (
      !owner ||
      !owner.domainScopes.includes(clawDomains[artifact.clawId]) ||
      !artifact.permittedMemberRefs.includes(artifact.decisionOwnerRef) ||
      (artifact.state === "current" &&
        (Date.parse(artifact.capturedAt) > asOf || Date.parse(artifact.expiresAt) <= asOf)) ||
      (artifact.state === "stale" && Date.parse(artifact.expiresAt) > asOf) ||
      (artifact.visibility === "restricted" && artifact.permittedMemberRefs.length === memberIds.length)
    ) {
      findings.push(
        finding(
          "unsupported_source_artifact",
          `sourceArtifacts.${index}`,
          "Source artifacts must preserve a scoped human decision owner, truthful freshness, and meaningful restricted visibility.",
        ),
      );
    }
  }
  for (const [index, assignment] of value.assignments.entries()) {
    const assignedArtifacts = assignment.sourceArtifactRefs.map((reference) =>
      artifactById.get(reference),
    );
    const result = assignment.resultRef ? resultById.get(assignment.resultRef) : undefined;
    if (
      assignedArtifacts.some(
        (artifact) =>
          artifact?.clawId !== assignment.specialistClawId ||
          assignment.permittedMemberRefs.some(
            (memberRef) => !artifact.permittedMemberRefs.includes(memberRef),
          ),
      ) ||
      (assignment.state === "completed" &&
        (!result ||
          result.assignmentRef !== assignment.id ||
          result.workerSessionRef !== assignment.workerSessionRef)) ||
      (assignment.state !== "completed" && assignment.resultRef)
    ) {
      findings.push(
        finding(
          "unsafe_worker_assignment",
          `assignments.${index}`,
          "Worker scope, specialist Claw, permitted people, completion state, session, and result must remain exactly bounded.",
        ),
      );
    }
  }
  for (const [index, result] of value.results.entries()) {
    const assignment = assignmentById.get(result.assignmentRef);
    const sourceArtifacts = result.sourceArtifactRefs.map((reference) =>
      artifactById.get(reference),
    );
    if (
      !assignment ||
      assignment.workerSessionRef !== result.workerSessionRef ||
      canonicalJson([...result.sourceArtifactRefs].sort()) !==
        canonicalJson([...assignment.sourceArtifactRefs].sort()) ||
      sourceArtifacts.some(
        (artifact) =>
          artifact?.decisionOwnerRef !== result.decisionOwnerRef ||
          artifact.safetyState !== result.safetyState ||
          artifact.prohibitedActions.some(
            (action) => !result.prohibitedActions.includes(action),
          ),
      )
    ) {
      findings.push(
        finding(
          "worker_result_scope_drift",
          `results.${index}`,
          "Worker results must preserve assignment sources, session provenance, domain decision owner, safety state, and every prohibition.",
        ),
      );
    }
  }
  for (const [index, item] of value.availability.entries()) {
    if (Date.parse(item.startsAt) >= Date.parse(item.endsAt)) {
      findings.push(
        finding(
          "invalid_availability_window",
          `availability.${index}`,
          "Availability windows must be ordered.",
        ),
      );
    }
  }
  for (const [index, operation] of value.operations.entries()) {
    const artifact = artifactById.get(operation.sourceArtifactRef);
    const assignee = operation.assigneeRef
      ? memberById.get(operation.assigneeRef)
      : undefined;
    const budget = budgetById.get(operation.budgetRef);
    const policy = policyById.get(operation.approvalPolicyRef);
    const blocked = operation.state === "blocked";
    const assigneeUnavailable =
      assignee &&
      value.availability.some(
        (item) =>
          item.memberRef === assignee.id &&
          item.state === "unavailable" &&
          Date.parse(item.startsAt) < Date.parse(operation.dueEnd) &&
          Date.parse(item.endsAt) > Date.parse(operation.dueStart),
      );
    const unresolvedDependency = operation.dependencyRefs.some(
      (reference) => operationById.get(reference)?.state !== "completed",
    );
    if (
      Date.parse(operation.dueStart) >= Date.parse(operation.dueEnd) ||
      artifact?.clawId !==
        Object.keys(clawDomains).find((clawId) => clawDomains[clawId] === operation.domain) ||
      operation.affectedMemberRefs.some(
        (memberRef) => !artifact?.permittedMemberRefs.includes(memberRef),
      ) ||
      (assignee &&
        (!assignee.domainScopes.includes(operation.domain) ||
          !artifact?.permittedMemberRefs.includes(assignee.id))) ||
      !budget ||
      budget.currency !== operation.currency ||
      !policy ||
      (["ready", "completed"].includes(operation.state) &&
        (artifact?.state !== "current" ||
          ["emergency", "blocked", "unknown"].includes(artifact.safetyState) ||
          assigneeUnavailable ||
          unresolvedDependency)) ||
      (blocked && operation.blockedReasons.length === 0) ||
      (!blocked && operation.blockedReasons.length > 0)
    ) {
      findings.push(
        finding(
          "unsafe_household_operation",
          `operations.${index}`,
          "Household operations must preserve domain, visibility, member eligibility, time, budget, dependency, safety, and blocked-state boundaries.",
        ),
      );
    }
  }
  for (const budget of value.budgets) {
    const allocated = value.operations
      .filter((item) => item.budgetRef === budget.id && item.state !== "completed")
      .reduce((sum, item) => sum + item.cost, 0);
    const hasOpenBudgetConflict = value.conflicts.some(
      (item) =>
        item.kind === "budget" &&
        item.state === "open" &&
        item.operationRefs.some(
          (reference) => operationById.get(reference)?.budgetRef === budget.id,
        ),
    );
    if (allocated > budget.amount && !hasOpenBudgetConflict) {
      findings.push(
        finding(
          "hidden_budget_conflict",
          `budgets.${budget.id}`,
          "Overallocated household budgets require an explicit open conflict.",
        ),
      );
    }
  }
  for (const [index, conflict] of value.conflicts.entries()) {
    if (
      (conflict.state === "open" &&
        conflict.requiredDecisionRefs.length === 0) ||
      (conflict.state === "resolved-by-members" &&
        conflict.requiredDecisionRefs.length > 0)
    ) {
      findings.push(
        finding(
          "incoherent_household_conflict",
          `conflicts.${index}`,
          "Open conflicts retain every required human decision; resolved conflicts retain none.",
        ),
      );
    }
  }
  const requiredSharedExclusions = [
    "exact-address",
    "access-codes",
    "credentials",
    "private-messages",
    "health-details",
    "financial-details",
    "precise-presence",
    "restricted-artifacts",
  ];
  for (const [index, view] of value.views.entries()) {
    const visibleArtifacts = view.sourceArtifactRefs.map((reference) =>
      artifactById.get(reference),
    );
    if (
      visibleArtifacts.some((artifact) =>
        view.audienceMemberRefs.some(
          (memberRef) => !artifact?.permittedMemberRefs.includes(memberRef),
        ),
      ) ||
      (view.kind === "shared" &&
        (visibleArtifacts.some((artifact) => artifact?.visibility === "restricted") ||
          requiredSharedExclusions.some(
            (field) => !view.excludedFields.includes(field),
          ))) ||
      (view.kind === "member-private" && view.audienceMemberRefs.length !== 1)
    ) {
      findings.push(
        finding(
          "household_view_privacy_leak",
          `views.${index}`,
          "Shared and private views must respect every source-artifact audience and suppress sensitive household fields.",
        ),
      );
    }
  }
  for (const memberId of memberIds) {
    if (
      !value.views.some(
        (view) =>
          view.kind === "member-private" &&
          view.audienceMemberRefs.length === 1 &&
          view.audienceMemberRefs[0] === memberId,
      )
    ) {
      findings.push(
        finding(
          "missing_member_private_view",
          "views",
          `Member ${JSON.stringify(memberId)} requires a distinct private view.`,
        ),
      );
    }
  }
  const action = value.externalAction;
  const hasPlan = Boolean(action.plan);
  const approvals = action.approvals ?? [];
  const hasIntegration = Boolean(action.integration);
  const hasReceipt = Boolean(action.receipt);
  if (
    (["awaiting-approval", "approved", "completed"].includes(action.state) &&
      !hasPlan) ||
    (action.state === "completed" && (!hasIntegration || !hasReceipt)) ||
    (action.state !== "completed" && (hasIntegration || hasReceipt)) ||
    (action.state === "not-requested" && (hasPlan || approvals.length > 0)) ||
    (action.state === "blocked" && !action.blockedReason)
  ) {
    findings.push(
      finding(
        "incoherent_household_action",
        "externalAction",
        "External action plan, approvals, integration, receipt, and blocked reason must match the declared state.",
      ),
    );
  }
  const planDigest = action.plan
    ? `sha256:${createHash("sha256").update(canonicalJson(action.plan)).digest("hex")}`
    : undefined;
  if (action.plan) {
    findings.push(
      ...referenceFindings(
        [action.plan.operationRef],
        operations,
        "externalAction.plan.operationRef",
        "Operation reference",
      ),
      ...referenceFindings(
        action.plan.affectedMemberRefs,
        members,
        "externalAction.plan.affectedMemberRefs",
        "Member reference",
      ),
      ...referenceFindings(
        [action.plan.approvalPolicyRef],
        policies,
        "externalAction.plan.approvalPolicyRef",
        "Policy reference",
      ),
    );
    const operation = operationById.get(action.plan.operationRef);
    const policy = policyById.get(action.plan.approvalPolicyRef);
    const approvedMembers = approvals.map((approval) => approval.memberRef);
    const approvalComplete =
      policy &&
      policy.requiredMemberRefs.every((memberRef) => approvedMembers.includes(memberRef));
    if (
      !operation ||
      operation.approvalPolicyRef !== action.plan.approvalPolicyRef ||
      action.plan.maxDeposit > action.plan.maxCost ||
      approvals.some(
        (approval) =>
          approval.planDigest !== planDigest ||
          !policy?.requiredMemberRefs.includes(approval.memberRef),
      ) ||
      (["approved", "completed"].includes(action.state) && !approvalComplete) ||
      (action.state === "awaiting-approval" && approvalComplete)
    ) {
      findings.push(
        finding(
          "household_action_approval_mismatch",
          "externalAction",
          "Every policy-required member must separately approve the exact external action plan.",
        ),
      );
    }
  }
  if (
    action.state === "completed" &&
    action.plan &&
    action.integration &&
    action.receipt
  ) {
    const integrationEvidence = evidenceById.get(action.integration.approvalEvidenceRef);
    const receiptEvidence = evidenceById.get(action.receipt.evidenceRef);
    if (
      action.receipt.planDigest !== planDigest ||
      action.receipt.integrationId !== action.integration.id ||
      action.receipt.providerRef !== action.plan.providerRef ||
      action.integration.providerRef !== action.plan.providerRef ||
      !action.receipt.confirmationRef.startsWith(
        `provider://${action.plan.providerRef}/`,
      ) ||
      integrationEvidence?.type !== "integration-approval" ||
      integrationEvidence.authority !== "approved-integration" ||
      integrationEvidence.reference !== action.integration.approvalRef ||
      receiptEvidence?.type !== "provider-receipt" ||
      receiptEvidence.authority !== "provider" ||
      receiptEvidence.reference !== action.receipt.confirmationRef ||
      receiptEvidence.capturedAt !== action.receipt.completedAt ||
      Date.parse(action.receipt.completedAt) >= Date.parse(action.plan.startsAt)
    ) {
      findings.push(
        finding(
          "household_action_receipt_mismatch",
          "externalAction.receipt",
          "Approved integration and provider receipt evidence must bind the exact multi-member plan.",
        ),
      );
    }
  }
  const openConflicts = value.conflicts.some((item) => item.state === "open");
  if (
    (openConflicts && value.handoff.state !== "blocked") ||
    value.handoff.accountableMemberRefs.some((memberRef) => {
      const member = memberById.get(memberRef);
      return (
        !member ||
        member.kind !== "adult" ||
        !member.decisionScopes.includes("shared-maintenance")
      );
    })
  ) {
    findings.push(
      finding(
        "agent_owned_household_authority",
        "handoff",
        "Open conflicts block handoff, and household authority remains with explicitly scoped adult members.",
      ),
    );
  }
  return findings;
}

function workChiefOfStaffFindings(value) {
  const evidenceIds = value.evidence.map((item) => item.id);
  const evidence = new Set(evidenceIds);
  const evidenceById = new Map(value.evidence.map((item) => [item.id, item]));
  const principalIds = value.principals.map((item) => item.id);
  const principals = new Set(principalIds);
  const principalById = new Map(value.principals.map((item) => [item.id, item]));
  const artifactIds = value.sourceArtifacts.map((item) => item.id);
  const artifacts = new Set(artifactIds);
  const artifactById = new Map(value.sourceArtifacts.map((item) => [item.id, item]));
  const assignmentIds = value.assignments.map((item) => item.id);
  const assignments = new Set(assignmentIds);
  const assignmentById = new Map(value.assignments.map((item) => [item.id, item]));
  const resultIds = value.results.map((item) => item.id);
  const results = new Set(resultIds);
  const resultById = new Map(value.results.map((item) => [item.id, item]));
  const capacityIds = value.capacityEnvelopes.map((item) => item.id);
  const capacities = new Set(capacityIds);
  const capacityById = new Map(value.capacityEnvelopes.map((item) => [item.id, item]));
  const policyIds = value.approvalPolicies.map((item) => item.id);
  const policies = new Set(policyIds);
  const policyById = new Map(value.approvalPolicies.map((item) => [item.id, item]));
  const forumIds = value.decisionForums.map((item) => item.id);
  const forums = new Set(forumIds);
  const workstreamIds = value.workstreams.map((item) => item.id);
  const workstreams = new Set(workstreamIds);
  const workstreamById = new Map(value.workstreams.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(evidenceIds, "evidence", "Evidence id"),
    ...uniqueFindings(principalIds, "principals", "Principal id"),
    ...uniqueFindings(artifactIds, "sourceArtifacts", "Source artifact id"),
    ...uniqueFindings(assignmentIds, "assignments", "Assignment id"),
    ...uniqueFindings(resultIds, "results", "Result id"),
    ...uniqueFindings(capacityIds, "capacityEnvelopes", "Capacity envelope id"),
    ...uniqueFindings(policyIds, "approvalPolicies", "Approval policy id"),
    ...uniqueFindings(forumIds, "decisionForums", "Decision forum id"),
    ...uniqueFindings(workstreamIds, "workstreams", "Workstream id"),
    ...uniqueFindings(value.conflicts.map((item) => item.id), "conflicts", "Conflict id"),
    ...uniqueFindings(value.views.map((item) => item.id), "views", "View id"),
  ];
  if (
    Date.parse(value.portfolio.periodStart) > Date.parse(value.portfolio.periodEnd)
  ) {
    findings.push(
      finding(
        "invalid_portfolio_period",
        "portfolio",
        "The operating portfolio period must be ordered.",
      ),
    );
  }
  for (const [index, item] of value.evidence.entries()) {
    if (Date.parse(item.capturedAt) > Date.parse(value.portfolio.asOf)) {
      findings.push(
        finding(
          "future_work_evidence",
          `evidence.${index}.capturedAt`,
          "Portfolio evidence cannot establish authority or state before it was captured.",
        ),
      );
    }
  }
  for (const [references, allowed, path, label] of [
    ...value.evidence.filter((item) => item.subjectPrincipalRef).map((item, index) => [[item.subjectPrincipalRef], principals, `evidence.${index}.subjectPrincipalRef`, "Principal reference"]),
    ...value.evidence.filter((item) => item.authorizedPrincipalRefs).map((item, index) => [item.authorizedPrincipalRefs, principals, `evidence.${index}.authorizedPrincipalRefs`, "Principal reference"]),
    ...value.principals.map((item, index) => [item.authorityEvidenceRefs, evidence, `principals.${index}.authorityEvidenceRefs`, "Evidence reference"]),
    ...value.sourceArtifacts.map((item, index) => [item.permittedPrincipalRefs, principals, `sourceArtifacts.${index}.permittedPrincipalRefs`, "Principal reference"]),
    ...value.assignments.map((item, index) => [item.sourceArtifactRefs, artifacts, `assignments.${index}.sourceArtifactRefs`, "Artifact reference"]),
    ...value.assignments.map((item, index) => [item.permittedPrincipalRefs, principals, `assignments.${index}.permittedPrincipalRefs`, "Principal reference"]),
    ...value.results.map((item, index) => [item.sourceArtifactRefs, artifacts, `results.${index}.sourceArtifactRefs`, "Artifact reference"]),
    ...value.capacityEnvelopes.map((item, index) => [item.approverRefs, principals, `capacityEnvelopes.${index}.approverRefs`, "Principal reference"]),
    ...value.capacityEnvelopes.map((item, index) => [item.evidenceRefs, evidence, `capacityEnvelopes.${index}.evidenceRefs`, "Evidence reference"]),
    ...value.approvalPolicies.map((item, index) => [item.requiredPrincipalRefs, principals, `approvalPolicies.${index}.requiredPrincipalRefs`, "Principal reference"]),
    ...value.approvalPolicies.map((item, index) => [item.authorityEvidenceRefs, evidence, `approvalPolicies.${index}.authorityEvidenceRefs`, "Evidence reference"]),
    ...value.decisionForums.map((item, index) => [item.requiredPrincipalRefs, principals, `decisionForums.${index}.requiredPrincipalRefs`, "Principal reference"]),
    ...value.decisionForums.map((item, index) => [item.workstreamRefs, workstreams, `decisionForums.${index}.workstreamRefs`, "Workstream reference"]),
    ...value.workstreams.map((item, index) => [[item.sourceArtifactRef], artifacts, `workstreams.${index}.sourceArtifactRef`, "Artifact reference"]),
    ...value.workstreams.map((item, index) => [[item.accountableOwnerRef], principals, `workstreams.${index}.accountableOwnerRef`, "Principal reference"]),
    ...value.workstreams.map((item, index) => [[item.decisionOwnerRef], principals, `workstreams.${index}.decisionOwnerRef`, "Principal reference"]),
    ...value.workstreams.flatMap((item, index) => item.capacityDemands.map((demand) => [[demand.capacityRef], capacities, `workstreams.${index}.capacityDemands`, "Capacity reference"])),
    ...value.workstreams.map((item, index) => [item.dependencyRefs, workstreams, `workstreams.${index}.dependencyRefs`, "Workstream reference"]),
    ...value.workstreams.map((item, index) => [[item.forumRef], forums, `workstreams.${index}.forumRef`, "Forum reference"]),
    ...value.conflicts.map((item, index) => [item.workstreamRefs, workstreams, `conflicts.${index}.workstreamRefs`, "Workstream reference"]),
    ...value.conflicts.map((item, index) => [item.principalRefs, principals, `conflicts.${index}.principalRefs`, "Principal reference"]),
    ...value.conflicts.map((item, index) => [item.requiredDecisionRefs, principals, `conflicts.${index}.requiredDecisionRefs`, "Principal reference"]),
    ...value.views.map((item, index) => [item.audiencePrincipalRefs, principals, `views.${index}.audiencePrincipalRefs`, "Principal reference"]),
    ...value.views.map((item, index) => [item.workstreamRefs, workstreams, `views.${index}.workstreamRefs`, "Workstream reference"]),
    ...value.views.map((item, index) => [item.sourceArtifactRefs, artifacts, `views.${index}.sourceArtifactRefs`, "Artifact reference"]),
    [value.handoff.accountablePrincipalRefs, principals, "handoff.accountablePrincipalRefs", "Principal reference"],
  ]) {
    findings.push(...uniqueFindings(references, path, label));
    findings.push(...referenceFindings(references, allowed, path, label));
  }

  for (const [index, principal] of value.principals.entries()) {
    const authorityEvidence = principal.authorityEvidenceRefs.map((reference) =>
      evidenceById.get(reference),
    );
    if (
      !authorityEvidence.some(
        (item) =>
          (["principal-declaration", "decision-right-record"].includes(item?.type) &&
            item.subjectPrincipalRef === principal.id) ||
          (item?.type === "portfolio-charter" &&
            item.authorizedPrincipalRefs?.includes(principal.id)),
      ) ||
      principal.id === "work-chief-of-staff" ||
      (principal.delegationScopes.includes("none") &&
        principal.delegationScopes.length !== 1)
    ) {
      findings.push(
        finding(
          "unsupported_work_principal_authority",
          `principals.${index}`,
          "Leadership roles, decision rights, confidentiality, and delegation require direct authority evidence and can never belong to the agent.",
        ),
      );
    }
  }

  const clawDomains = {
    "executive-assistant": "leadership",
    "delegation-coordinator": "leadership",
    "meeting-intelligence": "leadership",
    "project-manager": "engineering",
    "product-manager": "product",
    "financial-analyst": "finance",
    "recruiting-coordinator": "recruiting",
    "sales-operations": "sales",
    "release-coordinator": "release",
    "change-control-operator": "change-control",
  };
  const domainDecisionScopes = {
    leadership: "portfolio",
    product: "product",
    engineering: "engineering",
    finance: "finance",
    recruiting: "staffing",
    sales: "sales",
    release: "release",
    "change-control": "change-control",
  };
  const asOf = Date.parse(value.portfolio.asOf);
  for (const [index, artifact] of value.sourceArtifacts.entries()) {
    const accountableOwner = principalById.get(artifact.accountableOwnerRef);
    const decisionOwner = principalById.get(artifact.decisionOwnerRef);
    const domain = clawDomains[artifact.clawId];
    if (
      !accountableOwner ||
      !decisionOwner ||
      !artifact.permittedPrincipalRefs.includes(artifact.accountableOwnerRef) ||
      !artifact.permittedPrincipalRefs.includes(artifact.decisionOwnerRef) ||
      !decisionOwner.decisionScopes.includes(domainDecisionScopes[domain]) ||
      Date.parse(artifact.capturedAt) > asOf ||
      Date.parse(artifact.capturedAt) >= Date.parse(artifact.expiresAt) ||
      artifact.permittedPrincipalRefs.some((principalRef) => {
        const principal = principalById.get(principalRef);
        return (
          artifact.confidentiality !== "portfolio-shared" &&
          !principal?.confidentialityScopes.includes(artifact.confidentiality)
        );
      }) ||
      (artifact.state === "current" && Date.parse(artifact.expiresAt) <= asOf) ||
      (artifact.state === "stale" && Date.parse(artifact.expiresAt) > asOf) ||
      (artifact.confidentiality !== "portfolio-shared" &&
        artifact.permittedPrincipalRefs.length === principalIds.length &&
        artifact.sharedSummary.length === 0)
    ) {
      findings.push(
        finding(
          "unsupported_work_source_artifact",
          `sourceArtifacts.${index}`,
          "Source artifacts must preserve truthful freshness, functional decision rights, accountable owners, audience, status meaning, and prohibitions.",
        ),
      );
    }
  }

  for (const [index, policy] of value.approvalPolicies.entries()) {
    const authorityEvidence = policy.authorityEvidenceRefs.map((reference) =>
      evidenceById.get(reference),
    );
    if (
      policy.requiredPrincipalRefs.some(
        (principalRef) =>
          !authorityEvidence.some(
            (item) =>
              (item?.type === "decision-right-record" &&
                item.subjectPrincipalRef === principalRef) ||
              (item?.type === "portfolio-charter" &&
                item.authorizedPrincipalRefs?.includes(principalRef)),
          ),
      )
    ) {
      findings.push(
        finding(
          "unsupported_work_approval_policy",
          `approvalPolicies.${index}`,
          "Commitment approval policies require direct decision-right or portfolio-charter evidence.",
        ),
      );
    }
  }
  for (const [index, capacity] of value.capacityEnvelopes.entries()) {
    const requiredScope = domainDecisionScopes[capacity.function];
    const capacityEvidence = capacity.evidenceRefs.map((reference) =>
      evidenceById.get(reference),
    );
    if (
      Date.parse(capacity.periodStart) > Date.parse(capacity.periodEnd) ||
      Date.parse(capacity.periodStart) < Date.parse(value.portfolio.periodStart) ||
      Date.parse(capacity.periodEnd) > Date.parse(value.portfolio.periodEnd) ||
      capacity.approverRefs.some((principalRef) => {
        const principal = principalById.get(principalRef);
        return (
          !principal?.decisionScopes.includes(requiredScope) &&
          !principal?.decisionScopes.includes("portfolio")
        );
      }) ||
      !capacityEvidence.some((item) => item?.type === "capacity-envelope")
    ) {
      findings.push(
        finding(
          "invalid_capacity_period",
          `capacityEnvelopes.${index}`,
          "Capacity envelopes require an in-horizon period, functionally authorized approvers, and direct capacity evidence.",
        ),
      );
    }
  }

  for (const [index, assignment] of value.assignments.entries()) {
    const assignedArtifacts = assignment.sourceArtifactRefs.map((reference) =>
      artifactById.get(reference),
    );
    const result = assignment.resultRef ? resultById.get(assignment.resultRef) : undefined;
    if (
      assignedArtifacts.some(
        (artifact) =>
          artifact?.clawId !== assignment.specialistClawId ||
          assignment.permittedPrincipalRefs.some(
            (principalRef) => !artifact.permittedPrincipalRefs.includes(principalRef),
          ),
      ) ||
      (assignment.state === "completed" &&
        (!result ||
          result.assignmentRef !== assignment.id ||
          result.workerSessionRef !== assignment.workerSessionRef)) ||
      (assignment.state !== "completed" && assignment.resultRef)
    ) {
      findings.push(
        finding(
          "unsafe_worker_assignment",
          `assignments.${index}`,
          "Worker scope, specialist Claw, sources, audience, completion state, session, and result must remain exactly bounded.",
        ),
      );
    }
  }

  for (const [index, result] of value.results.entries()) {
    const assignment = assignmentById.get(result.assignmentRef);
    const sourceArtifacts = result.sourceArtifactRefs.map((reference) =>
      artifactById.get(reference),
    );
    if (
      !assignment ||
      assignment.state !== "completed" ||
      assignment.resultRef !== result.id ||
      assignment.workerSessionRef !== result.workerSessionRef ||
      canonicalJson([...result.sourceArtifactRefs].sort()) !==
        canonicalJson([...assignment.sourceArtifactRefs].sort()) ||
      sourceArtifacts.some(
        (artifact) =>
          artifact?.decisionOwnerRef !== result.decisionOwnerRef ||
          artifact.statusSemantic !== result.statusSemantic ||
          artifact.prohibitedActions.some(
            (action) => !result.prohibitedActions.includes(action),
          ) ||
          Date.parse(result.producedAt) < Date.parse(artifact.capturedAt),
      ) ||
      Date.parse(result.producedAt) > asOf
    ) {
      findings.push(
        finding(
          "work_result_scope_drift",
          `results.${index}`,
          "Worker results must preserve assignment sources, session provenance, decision owner, source status meaning, and every prohibition.",
        ),
      );
    }
  }

  for (const [index, forum] of value.decisionForums.entries()) {
    const requiredParticipants = new Set(
      forum.workstreamRefs.map(
        (reference) => workstreamById.get(reference)?.decisionOwnerRef,
      ),
    );
    for (const conflict of value.conflicts) {
      if (
        conflict.state === "open" &&
        conflict.workstreamRefs.some((reference) =>
          forum.workstreamRefs.includes(reference),
        )
      ) {
        for (const principalRef of [
          ...conflict.principalRefs,
          ...conflict.requiredDecisionRefs,
        ]) {
          requiredParticipants.add(principalRef);
        }
      }
    }
    if (
      (forum.state === "completed"
        ? Date.parse(forum.startsAt) > asOf
        : Date.parse(forum.startsAt) <= asOf) ||
      forum.workstreamRefs.some(
        (reference) => workstreamById.get(reference)?.forumRef !== forum.id,
      ) ||
      [...requiredParticipants].some(
        (principalRef) =>
          principalRef && !forum.requiredPrincipalRefs.includes(principalRef),
      )
    ) {
      findings.push(
        finding(
          "incoherent_decision_forum",
          `decisionForums.${index}`,
          "Decision forums must be future-dated and contain only workstreams assigned to that exact forum.",
        ),
      );
    }
  }
  for (const [index, workstream] of value.workstreams.entries()) {
    const forumMemberships = value.decisionForums.filter((forum) =>
      forum.workstreamRefs.includes(workstream.id),
    );
    if (
      forumMemberships.length !== 1 ||
      forumMemberships[0].id !== workstream.forumRef
    ) {
      findings.push(
        finding(
          "incoherent_decision_forum",
          `workstreams.${index}.forumRef`,
          "Every workstream must appear exactly once in its declared decision forum.",
        ),
      );
    }
  }

  const overallocatedCapacities = new Set(
    value.capacityEnvelopes
      .filter((capacity) => {
        const allocated = value.workstreams
          .filter((item) => item.state !== "completed")
          .flatMap((item) => item.capacityDemands)
          .filter((item) => item.capacityRef === capacity.id)
          .reduce((sum, item) => sum + item.amount, 0);
        return allocated > capacity.amount;
      })
      .map((capacity) => capacity.id),
  );
  for (const [index, workstream] of value.workstreams.entries()) {
    const artifact = artifactById.get(workstream.sourceArtifactRef);
    const decisionOwner = principalById.get(workstream.decisionOwnerRef);
    const blocked = workstream.state === "blocked";
    const unresolvedDependency = workstream.dependencyRefs.some(
      (reference) => workstreamById.get(reference)?.state !== "completed",
    );
    const capacityMismatch = workstream.capacityDemands.some((demand) => {
      const capacity = capacityById.get(demand.capacityRef);
      return (
        capacity &&
        (Date.parse(capacity.periodStart) > Date.parse(capacity.periodEnd) ||
          Date.parse(workstream.periodStart) < Date.parse(capacity.periodStart) ||
          Date.parse(workstream.periodEnd) > Date.parse(capacity.periodEnd) ||
          (capacity.function !== workstream.domain &&
            capacity.function !== "finance" &&
            !(
              ["release", "change-control"].includes(workstream.domain) &&
              capacity.function === "engineering"
            )))
      );
    });
    const unresolvedCapacityConflict =
      workstream.capacityDemands.some((demand) =>
        overallocatedCapacities.has(demand.capacityRef),
      ) &&
      value.conflicts.some(
        (conflict) =>
          conflict.kind === "capacity" &&
          conflict.state === "open" &&
          conflict.workstreamRefs.includes(workstream.id),
      );
    const unresolvedConflict = value.conflicts.some(
      (conflict) =>
        conflict.state === "open" &&
        conflict.workstreamRefs.includes(workstream.id),
    );
    if (
      Date.parse(workstream.periodStart) > Date.parse(workstream.periodEnd) ||
      Date.parse(workstream.periodStart) < Date.parse(value.portfolio.periodStart) ||
      Date.parse(workstream.periodEnd) > Date.parse(value.portfolio.periodEnd) ||
      artifact?.clawId === undefined ||
      clawDomains[artifact.clawId] !== workstream.domain ||
      workstream.accountableOwnerRef !== artifact.accountableOwnerRef ||
      workstream.decisionOwnerRef !== artifact.decisionOwnerRef ||
      !decisionOwner?.decisionScopes.includes(domainDecisionScopes[workstream.domain]) ||
      capacityMismatch ||
      (["ready", "completed"].includes(workstream.state) &&
        (artifact.state !== "current" ||
          ["blocked", "unknown"].includes(artifact.statusSemantic) ||
          unresolvedDependency ||
          unresolvedCapacityConflict ||
          unresolvedConflict)) ||
      (workstream.state === "completed" &&
        (artifact.statusSemantic !== "completed" ||
          Date.parse(workstream.periodEnd) > asOf)) ||
      (blocked && workstream.blockedReasons.length === 0) ||
      (!blocked && workstream.blockedReasons.length > 0)
    ) {
      findings.push(
        finding(
          "unsafe_workstream",
          `workstreams.${index}`,
          "Workstreams must preserve source domain, owners, decision rights, dates, capacity, dependencies, status meaning, and blocked state.",
        ),
      );
    }
  }

  for (const capacity of value.capacityEnvelopes) {
    const allocated = value.workstreams
      .filter((item) => item.state !== "completed")
      .flatMap((item) => item.capacityDemands)
      .filter((item) => item.capacityRef === capacity.id)
      .reduce((sum, item) => sum + item.amount, 0);
    const hasOpenCapacityConflict = value.conflicts.some(
      (item) =>
        item.kind === "capacity" &&
        item.state === "open" &&
        item.workstreamRefs.some((reference) =>
          workstreamById
            .get(reference)
            ?.capacityDemands.some((demand) => demand.capacityRef === capacity.id),
        ),
    );
    if (allocated > capacity.amount && !hasOpenCapacityConflict) {
      findings.push(
        finding(
          "hidden_capacity_conflict",
          `capacityEnvelopes.${capacity.id}`,
          "Overallocated capacity requires an explicit open conflict and cannot be silently normalized.",
        ),
      );
    }
  }

  for (const [index, conflict] of value.conflicts.entries()) {
    if (
      (conflict.state === "open" && conflict.requiredDecisionRefs.length === 0) ||
      (conflict.state === "open" &&
        conflict.principalRefs.some(
          (principalRef) =>
            !conflict.requiredDecisionRefs.includes(principalRef),
        )) ||
      (conflict.state === "resolved-by-principals" &&
        conflict.requiredDecisionRefs.length > 0)
    ) {
      findings.push(
        finding(
          "incoherent_work_conflict",
          `conflicts.${index}`,
          "Open conflicts retain every required principal decision; resolved conflicts retain none.",
        ),
      );
    }
  }

  const requiredSharedExclusions = [
    "personnel-details",
    "compensation-details",
    "customer-details",
    "legal-details",
    "security-details",
    "financial-model-details",
    "roadmap-detail",
    "acquisition-detail",
    "credentials",
    "restricted-artifacts",
  ];
  for (const [index, view] of value.views.entries()) {
    const visibleArtifacts = view.sourceArtifactRefs.map((reference) =>
      artifactById.get(reference),
    );
    if (
      visibleArtifacts.some((artifact) =>
        view.audiencePrincipalRefs.some(
          (principalRef) => !artifact?.permittedPrincipalRefs.includes(principalRef),
        ),
      ) ||
      view.workstreamRefs.some((reference) => {
        const artifact = artifactById.get(
          workstreamById.get(reference)?.sourceArtifactRef,
        );
        return view.audiencePrincipalRefs.some(
          (principalRef) =>
            !artifact?.permittedPrincipalRefs.includes(principalRef) ||
            (artifact.confidentiality !== "portfolio-shared" &&
              !principalById
                .get(principalRef)
                ?.confidentialityScopes.includes(artifact.confidentiality)),
        );
      }) ||
      (view.kind === "leadership-shared" &&
        (visibleArtifacts.some(
          (artifact) => artifact?.confidentiality !== "portfolio-shared",
        ) ||
          requiredSharedExclusions.some(
            (field) => !view.excludedFields.includes(field),
          ))) ||
      (view.kind === "principal-private" &&
        view.audiencePrincipalRefs.length !== 1)
    ) {
      findings.push(
        finding(
          "work_portfolio_view_confidentiality_leak",
          `views.${index}`,
          "Leadership, forum, and private views must respect every source audience and suppress restricted organizational fields.",
        ),
      );
    }
  }
  for (const principalId of principalIds) {
    if (
      !value.views.some(
        (view) =>
          view.kind === "principal-private" &&
          view.audiencePrincipalRefs.length === 1 &&
          view.audiencePrincipalRefs[0] === principalId,
      )
    ) {
      findings.push(
        finding(
          "missing_principal_private_view",
          "views",
          `Principal ${JSON.stringify(principalId)} requires a distinct private view.`,
        ),
      );
    }
  }

  const commitment = value.commitment;
  const hasPlan = Boolean(commitment.plan);
  const approvals = commitment.approvals ?? [];
  const hasIntegration = Boolean(commitment.integration);
  const hasReceipt = Boolean(commitment.receipt);
  const actionDecisionScope = commitment.plan
    ? {
        "send-communication": "external-communication",
        "schedule-forum": "portfolio",
        "allocate-staff": "staffing",
        "approve-spend": "finance",
        "approve-hiring": "staffing",
        "change-forecast": "finance",
        "commit-roadmap": "product",
        "commit-customer": "sales",
        "publish-plan": "publication",
        merge: "release",
        release: "release",
        "execute-change": "change-control",
      }[commitment.plan.actionType]
    : undefined;
  if (
    (["awaiting-approval", "approved", "completed"].includes(commitment.state) &&
      !hasPlan) ||
    (commitment.state === "completed" && (!hasIntegration || !hasReceipt)) ||
    (commitment.state !== "completed" && (hasIntegration || hasReceipt)) ||
    (commitment.state === "not-requested" &&
      (hasPlan || approvals.length > 0)) ||
    (commitment.state === "blocked" && !commitment.blockedReason)
  ) {
    findings.push(
      finding(
        "incoherent_work_commitment",
        "commitment",
        "Commitment plan, approvals, integration, receipt, and blocked reason must match the declared state.",
      ),
    );
  }
  const planDigest = commitment.plan
    ? `sha256:${createHash("sha256").update(canonicalJson(commitment.plan)).digest("hex")}`
    : undefined;
  if (commitment.plan) {
    findings.push(
      ...referenceFindings(
        [commitment.plan.workstreamRef],
        workstreams,
        "commitment.plan.workstreamRef",
        "Workstream reference",
      ),
      ...referenceFindings(
        commitment.plan.affectedPrincipalRefs,
        principals,
        "commitment.plan.affectedPrincipalRefs",
        "Principal reference",
      ),
      ...referenceFindings(
        [commitment.plan.approvalPolicyRef],
        policies,
        "commitment.plan.approvalPolicyRef",
        "Policy reference",
      ),
    );
    const policy = policyById.get(commitment.plan.approvalPolicyRef);
    const workstream = workstreamById.get(commitment.plan.workstreamRef);
    const artifact = artifactById.get(workstream?.sourceArtifactRef);
    const requiredByAuthority = new Set([workstream?.decisionOwnerRef]);
    const actionAuthorizedPrincipals =
      commitment.plan.affectedPrincipalRefs.filter((principalRef) => {
        const principal = principalById.get(principalRef);
        return (
          principal?.decisionScopes.includes(actionDecisionScope) ||
          principal?.decisionScopes.includes("portfolio")
        );
      });
    for (const principalRef of commitment.plan.affectedPrincipalRefs) {
      const principal = principalById.get(principalRef);
      if (
        principal?.decisionScopes.includes(actionDecisionScope) ||
        principal?.decisionScopes.includes("portfolio")
      ) {
        requiredByAuthority.add(principalRef);
      }
    }
    const approvedPrincipals = approvals.map((approval) => approval.principalRef);
    const approvalComplete =
      policy &&
      policy.requiredPrincipalRefs.every((principalRef) =>
        approvedPrincipals.includes(principalRef),
      );
    if (
      !policy ||
      !policy.actionTypes.includes(commitment.plan.actionType) ||
      actionAuthorizedPrincipals.length === 0 ||
      [...requiredByAuthority].some(
        (principalRef) =>
          principalRef && !policy.requiredPrincipalRefs.includes(principalRef),
      ) ||
      approvals.some(
        (approval) =>
          approval.planDigest !== planDigest ||
          !policy.requiredPrincipalRefs.includes(approval.principalRef) ||
          Date.parse(approval.approvedAt) > asOf,
      ) ||
      (["approved", "completed"].includes(commitment.state) &&
        (!approvalComplete ||
          !workstream ||
          workstream.state === "blocked" ||
          artifact?.state !== "current" ||
          value.conflicts.some(
            (conflict) =>
              conflict.state === "open" &&
              conflict.workstreamRefs.includes(workstream.id),
          ))) ||
      (commitment.state === "awaiting-approval" && approvalComplete)
    ) {
      findings.push(
        finding(
          "work_commitment_approval_mismatch",
          "commitment",
          "Every policy-required principal must separately approve the exact commitment plan.",
        ),
      );
    }
  }
  if (
    commitment.state === "completed" &&
    commitment.plan &&
    commitment.integration &&
    commitment.receipt
  ) {
    const integrationEvidence = evidenceById.get(
      commitment.integration.approvalEvidenceRef,
    );
    const receiptEvidence = evidenceById.get(commitment.receipt.evidenceRef);
    const configuredBy = principalById.get(commitment.integration.configuredByRef);
    if (
      commitment.receipt.planDigest !== planDigest ||
      commitment.receipt.integrationId !== commitment.integration.id ||
      commitment.receipt.systemRef !== commitment.plan.systemRef ||
      commitment.integration.systemRef !== commitment.plan.systemRef ||
      !configuredBy ||
      commitment.integration.configuredByRef === "work-chief-of-staff" ||
      (!configuredBy.decisionScopes.includes(actionDecisionScope) &&
        !configuredBy.decisionScopes.includes("portfolio")) ||
      !commitment.receipt.confirmationRef.startsWith(
        `system://${commitment.plan.systemRef}/`,
      ) ||
      integrationEvidence?.type !== "integration-approval" ||
      integrationEvidence.authority !== "approved-integration" ||
      integrationEvidence.reference !== commitment.integration.approvalRef ||
      receiptEvidence?.type !== "system-receipt" ||
      receiptEvidence.authority !== "controlled-system" ||
      receiptEvidence.reference !== commitment.receipt.confirmationRef ||
      receiptEvidence.capturedAt !== commitment.receipt.completedAt ||
      Date.parse(commitment.receipt.completedAt) <
        Date.parse(commitment.plan.effectiveAt) ||
      Date.parse(integrationEvidence.capturedAt) >
        Date.parse(commitment.receipt.completedAt) ||
      approvals.some(
        (approval) =>
          Date.parse(approval.approvedAt) >
          Date.parse(commitment.receipt.completedAt),
      )
    ) {
      findings.push(
        finding(
          "work_commitment_receipt_mismatch",
          "commitment.receipt",
          "Approved integration and controlled-system receipt evidence must bind the exact multi-principal commitment.",
        ),
      );
    }
  }

  const openConflicts = value.conflicts.some((item) => item.state === "open");
  if (
    (openConflicts && value.handoff.state !== "blocked") ||
    !value.handoff.accountablePrincipalRefs.some(
      (principalRef) =>
        principalById.get(principalRef)?.decisionScopes.includes("portfolio"),
    )
  ) {
    findings.push(
      finding(
        "agent_owned_work_authority",
        "handoff",
        "Open conflicts block handoff, and portfolio authority remains with explicitly scoped human principals.",
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

function applianceCareFindings(value) {
  const evidenceIds = value.evidence.map((item) => item.id);
  const evidence = new Set(evidenceIds);
  const applianceIds = value.appliances.map((item) => item.id);
  const appliances = new Set(applianceIds);
  const providerIds = value.providers.map((item) => item.id);
  const providers = new Set(providerIds);
  const findings = [
    ...uniqueFindings(evidenceIds, "evidence", "Evidence id"),
    ...uniqueFindings(applianceIds, "appliances", "Appliance id"),
    ...uniqueFindings(value.maintenance.map((item) => item.id), "maintenance", "Maintenance id"),
    ...uniqueFindings(providerIds, "providers", "Provider id"),
    ...uniqueFindings(value.coverage.map((item) => item.applianceRef), "coverage", "Coverage appliance"),
    ...uniqueFindings(value.recalls.map((item) => item.applianceRef), "recalls", "Recall appliance"),
    ...uniqueFindings(value.incidents.map((item) => item.applianceRef), "incidents", "Incident appliance"),
    ...uniqueFindings(
      value.lifecycleDecisions.map((item) => item.applianceRef),
      "lifecycleDecisions",
      "Lifecycle appliance",
    ),
  ];
  const evidenceReferences = [
    ...value.appliances.map((item) => [item.modelEvidenceRefs, "appliances.modelEvidenceRefs"]),
    ...value.appliances.map((item) => [item.serialEvidenceRefs, "appliances.serialEvidenceRefs"]),
    ...value.maintenance.map((item) => [item.sourceRefs, "maintenance.sourceRefs"]),
    ...value.maintenance.map((item) => [
      item.completionEvidenceRefs,
      "maintenance.completionEvidenceRefs",
    ]),
    ...value.coverage.map((item) => [item.evidenceRefs, "coverage.evidenceRefs"]),
    ...value.recalls.map((item) => [item.evidenceRefs, "recalls.evidenceRefs"]),
    ...value.incidents.map((item) => [item.evidenceRefs, "incidents.evidenceRefs"]),
    ...value.lifecycleDecisions.map((item) => [
      item.evidenceRefs,
      "lifecycleDecisions.evidenceRefs",
    ]),
    ...value.providers.map((item) => [[item.sourceRef], "providers.sourceRef"]),
    ...(value.action.integration
      ? [[[value.action.integration.approvalEvidenceRef], "action.integration"]]
      : []),
    ...(value.action.receipt
      ? [[[value.action.receipt.evidenceRef], "action.receipt"]]
      : []),
  ];
  for (const [references, path] of evidenceReferences) {
    findings.push(...uniqueFindings(references, path, "Evidence reference"));
    findings.push(...referenceFindings(references, evidence, path, "Evidence reference"));
  }
  for (const [path, references] of [
    ["maintenance", value.maintenance.map((item) => item.applianceRef)],
    ["coverage", value.coverage.map((item) => item.applianceRef)],
    ["recalls", value.recalls.map((item) => item.applianceRef)],
    ["incidents", value.incidents.map((item) => item.applianceRef)],
    ["lifecycleDecisions", value.lifecycleDecisions.map((item) => item.applianceRef)],
  ]) {
    findings.push(...referenceFindings(references, appliances, path, "Appliance reference"));
  }
  if (
    /\b\d{1,6}[A-Za-z]?(?:-\d{1,6}[A-Za-z]?)?\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:Alley|Aly|Avenue|Ave|Boulevard|Blvd|Circle|Cir|Court|Ct|Crescent|Cres|Drive|Dr|Highway|Hwy|Lane|Ln|Parkway|Pkwy|Place|Pl|Road|Rd|Route|Rte|Street|St|Terrace|Ter|Trail|Trl|Way)\b/iu.test(
      canonicalJson(value),
    )
  ) {
    findings.push(
      finding(
        "exposed_home_address",
        "portfolio",
        "Appliance-care artifacts must use privacy-safe appliance and room labels, not a street address.",
      ),
    );
  }
  const asOf = Date.parse(value.portfolio.asOf);
  const evidenceById = new Map(value.evidence.map((item) => [item.id, item]));
  for (const [index, appliance] of value.appliances.entries()) {
    const modelEvidence = appliance.modelEvidenceRefs
      .map((reference) => evidenceById.get(reference))
      .filter(Boolean);
    const serialEvidence = appliance.serialEvidenceRefs
      .map((reference) => evidenceById.get(reference))
      .filter(Boolean);
    if (
      !modelEvidence.some(
        (item) =>
          ["label-photo", "purchase-record", "manual"].includes(item.type) &&
          ["owner-supplied", "manufacturer"].includes(item.authority),
      ) ||
      (appliance.serialScope === "verified" &&
        !serialEvidence.some(
          (item) =>
            ["label-photo", "purchase-record"].includes(item.type) &&
            item.authority === "owner-supplied",
        )) ||
      (appliance.serialScope === "masked" && serialEvidence.length === 0) ||
      (appliance.serialScope === "unverified" && serialEvidence.length > 0)
    ) {
      findings.push(
        finding(
          "unsupported_appliance_identity",
          `appliances.${index}`,
          "Model and serial identity states must be backed by direct label, purchase, or manufacturer evidence.",
        ),
      );
    }
  }
  const unsafeCarePattern =
    /\b(?:diagnose|repair|disassemble|rewire|bypass|defeat|open\s+(?:the\s+)?panel|handle\s+refrigerant|disconnect\s+(?:the\s+)?gas\s+line)\b/iu;
  for (const [index, item] of value.maintenance.entries()) {
    const sources = item.sourceRefs
      .map((reference) => evidenceById.get(reference))
      .filter(Boolean);
    const completionEvidence = item.completionEvidenceRefs
      .map((reference) => evidenceById.get(reference))
      .filter(Boolean);
    const manufacturerSupported = sources.some(
      (source) =>
        (["manual", "manufacturer-maintenance"].includes(source.type) &&
          source.authority === "manufacturer") ||
        (source.type === "recall-result" &&
          ["manufacturer", "government"].includes(source.authority)),
    );
    const completed = item.state === "completed";
    if (
      !manufacturerSupported ||
      unsafeCarePattern.test(item.task) ||
      (completed &&
        (!item.completedAt ||
          completionEvidence.length === 0 ||
          completionEvidence.every(
            (source) =>
              !["owner-report", "label-photo", "service-record"].includes(source.type) ||
              Date.parse(source.capturedAt) < Date.parse(item.completedAt),
          ))) ||
      (!completed && (item.completedAt || item.completionEvidenceRefs.length > 0)) ||
      (item.state === "blocked" && !item.blockedReason) ||
      (item.state !== "blocked" && item.blockedReason) ||
      (item.state === "upcoming" && Date.parse(item.dueAt) <= asOf) ||
      (item.state === "overdue" && Date.parse(item.dueAt) >= asOf)
    ) {
      findings.push(
        finding(
          "unsupported_maintenance",
          `maintenance.${index}`,
          "Maintenance must be model-bound manufacturer care with coherent timing, completion evidence, and no repair instructions.",
        ),
      );
    }
  }
  const requiredApplianceSet = canonicalJson([...appliances].sort());
  for (const [path, values] of [
    ["coverage", value.coverage.map((item) => item.applianceRef)],
    ["recalls", value.recalls.map((item) => item.applianceRef)],
    ["incidents", value.incidents.map((item) => item.applianceRef)],
    ["lifecycleDecisions", value.lifecycleDecisions.map((item) => item.applianceRef)],
  ]) {
    if (canonicalJson([...new Set(values)].sort()) !== requiredApplianceSet) {
      findings.push(
        finding(
          "incomplete_appliance_portfolio",
          path,
          "Coverage, recall, incident, and lifecycle state must cover every appliance exactly once.",
        ),
      );
    }
  }
  for (const [index, item] of value.coverage.entries()) {
    const sources = item.evidenceRefs
      .map((reference) => evidenceById.get(reference))
      .filter(Boolean);
    const hasWarranty = sources.some(
      (source) =>
        source.type === "warranty-terms" && source.authority === "manufacturer",
    );
    const hasRegistration = sources.some(
      (source) =>
        source.type === "registration-receipt" && source.authority === "manufacturer",
    );
    const hasPurchase = sources.some(
      (source) =>
        source.type === "purchase-record" && source.authority === "owner-supplied",
    );
    if (
      (item.registrationState === "registered" && !hasRegistration) ||
      (["active", "expired"].includes(item.warrantyState) && !hasWarranty) ||
      (item.warrantyState === "active" && (!hasPurchase || !item.expiresAt)) ||
      (item.expiresAt && Date.parse(item.expiresAt) <= Date.parse(item.assessedAt) &&
        item.warrantyState === "active") ||
      Date.parse(item.assessedAt) > asOf
    ) {
      findings.push(
        finding(
          "unsupported_coverage_state",
          `coverage.${index}`,
          "Registration and warranty conclusions require authoritative receipt, terms, purchase, and coherent date evidence.",
        ),
      );
    }
  }
  for (const [index, item] of value.recalls.entries()) {
    const appliance = value.appliances.find(
      (candidate) => candidate.id === item.applianceRef,
    );
    const sources = item.evidenceRefs
      .map((reference) => evidenceById.get(reference))
      .filter(Boolean);
    const authoritativeResult = sources.some(
      (source) =>
        source.type === "recall-result" &&
        ["manufacturer", "government"].includes(source.authority) &&
        source.capturedAt === item.checkedAt,
    );
    const serialMatch = ["serial", "model-and-serial"].includes(item.matchScope);
    if (
      !authoritativeResult ||
      (serialMatch && appliance?.serialScope !== "verified") ||
      (item.state === "matched" &&
        (item.matchScope === "unverified" || item.remedyState === "not-applicable")) ||
      (item.state === "no-match" && item.remedyState !== "not-applicable") ||
      (item.state === "unknown" &&
        (item.matchScope !== "unverified" || item.remedyState !== "unknown")) ||
      Date.parse(item.checkedAt) > asOf
    ) {
      findings.push(
        finding(
          "unsupported_recall_state",
          `recalls.${index}`,
          "Recall state requires a current authoritative result and exact identity evidence for any serial match.",
        ),
      );
    }
  }
  const incidentHandoffs = {
    none: ["none"],
    "active-fault": ["home-repair"],
    "active-hazard": ["emergency-services"],
    "recall-stop-use": ["manufacturer-recall"],
    uncertain: ["blocked", "home-repair"],
  };
  for (const [index, item] of value.incidents.entries()) {
    if (!incidentHandoffs[item.state].includes(item.handoff)) {
      findings.push(
        finding(
          "unsafe_incident_handoff",
          `incidents.${index}`,
          "Active faults, hazards, and stop-use recalls must route to the correct owner system without repair instructions.",
        ),
      );
    }
  }
  for (const [index, item] of value.lifecycleDecisions.entries()) {
    const sources = item.evidenceRefs
      .map((reference) => evidenceById.get(reference))
      .filter(Boolean);
    const relevant = sources.some((source) =>
      [
        "purchase-record",
        "manufacturer-maintenance",
        "warranty-terms",
        "recall-result",
        "service-record",
        "energy-label",
      ].includes(source.type),
    );
    const replacementEvidence =
      item.state !== "replacement-research" ||
      (sources.some((source) => source.type === "energy-label") &&
        sources.some((source) =>
          ["service-record", "warranty-terms", "purchase-record"].includes(source.type),
        ));
    if (
      !relevant ||
      !replacementEvidence ||
      (item.state === "blocked" && item.uncertainties.length === 0)
    ) {
      findings.push(
        finding(
          "unsupported_lifecycle_decision",
          `lifecycleDecisions.${index}`,
          "Lifecycle decisions require relevant ownership evidence; replacement research also requires energy and history or coverage evidence.",
        ),
      );
    }
  }
  for (const [index, provider] of value.providers.entries()) {
    const source = evidenceById.get(provider.sourceRef);
    if (
      source?.type !== "provider-info" ||
      !["manufacturer", "service-provider"].includes(source.authority)
    ) {
      findings.push(
        finding(
          "unsupported_provider",
          `providers.${index}.sourceRef`,
          "Manufacturer and authorized-servicer options require provider-controlled evidence.",
        ),
      );
    }
  }
  const action = value.action;
  const hasPlan = Boolean(action.plan);
  const hasApproval = Boolean(action.approval);
  const hasIntegration = Boolean(action.integration);
  const hasReceipt = Boolean(action.receipt);
  if (
    (["options-ready", "awaiting-approval", "approved", "completed"].includes(
      action.state,
    ) &&
      !hasPlan) ||
    (["approved", "completed"].includes(action.state) && !hasApproval) ||
    (action.state === "completed" && (!hasIntegration || !hasReceipt)) ||
    (action.state !== "completed" && (hasIntegration || hasReceipt)) ||
    (!["approved", "completed"].includes(action.state) && hasApproval) ||
    (action.state === "not-requested" && hasPlan) ||
    (action.state === "blocked" && !action.blockedReason)
  ) {
    findings.push(
      finding(
        "incoherent_action_state",
        "action",
        "Action plan, approval, integration, receipt, and blocked reason must match the declared state.",
      ),
    );
  }
  if (action.plan) {
    findings.push(
      ...referenceFindings(
        [action.plan.applianceRef],
        appliances,
        "action.plan.applianceRef",
        "Appliance reference",
      ),
      ...referenceFindings(
        [action.plan.providerRef],
        providers,
        "action.plan.providerRef",
        "Provider reference",
      ),
    );
    const provider = value.providers.find(
      (item) => item.id === action.plan.providerRef,
    );
    const recall = value.recalls.find(
      (item) => item.applianceRef === action.plan.applianceRef,
    );
    const coverage = value.coverage.find(
      (item) => item.applianceRef === action.plan.applianceRef,
    );
    if (
      !provider ||
      provider.qualificationState === "unverified" ||
      action.plan.maxDeposit > action.plan.maxCost ||
      (action.plan.actionType === "recall-remedy" && recall?.state !== "matched") ||
      (action.plan.actionType === "warranty-claim" &&
        coverage?.warrantyState !== "active")
    ) {
      findings.push(
        finding(
          "unsupported_external_action",
          "action.plan",
          "External actions require an eligible appliance state, verified provider, and bounded cost.",
        ),
      );
    }
  }
  const planDigest = action.plan
    ? `sha256:${createHash("sha256").update(canonicalJson(action.plan)).digest("hex")}`
    : undefined;
  if (["approved", "completed"].includes(action.state) && action.approval) {
    if (
      action.approval.planDigest !== planDigest ||
      canonicalJson(action.approval.owner) !== canonicalJson(value.owner)
    ) {
      findings.push(
        finding(
          "action_approval_mismatch",
          "action.approval",
          "Owner approval must bind the exact external action plan.",
        ),
      );
    }
  }
  if (
    action.state === "completed" &&
    action.plan &&
    action.approval &&
    action.integration &&
    action.receipt
  ) {
    const integrationEvidence = evidenceById.get(
      action.integration.approvalEvidenceRef,
    );
    const receiptEvidence = evidenceById.get(action.receipt.evidenceRef);
    if (
      action.receipt.planDigest !== planDigest ||
      action.receipt.integrationId !== action.integration.id ||
      action.receipt.providerRef !== action.plan.providerRef ||
      action.integration.providerRef !== action.plan.providerRef ||
      !action.receipt.confirmationRef.startsWith(
        `provider://${action.plan.providerRef}/`,
      ) ||
      integrationEvidence?.type !== "integration-approval" ||
      integrationEvidence.authority !== "owner-supplied" ||
      integrationEvidence.reference !== action.integration.approvalRef ||
      receiptEvidence?.type !== "action-receipt" ||
      !["manufacturer", "service-provider"].includes(receiptEvidence.authority) ||
      receiptEvidence.reference !== action.receipt.confirmationRef ||
      receiptEvidence.capturedAt !== action.receipt.completedAt ||
      canonicalJson(action.integration.configuredBy) !== canonicalJson(value.owner)
    ) {
      findings.push(
        finding(
          "action_receipt_mismatch",
          "action.receipt",
          "The owner-approved integration and provider receipt must bind the exact action plan.",
        ),
      );
    }
    if (
      Date.parse(action.receipt.completedAt) <
      Date.parse(action.approval.approvedAt)
    ) {
      findings.push(
        finding(
          "action_predates_approval",
          "action.receipt.completedAt",
          "An external action cannot predate the owner's exact approval.",
        ),
      );
    }
  }
  if (
    canonicalJson(value.handoff.owner) !== canonicalJson(value.owner) ||
    value.owner.id === "appliance-care-coordinator"
  ) {
    findings.push(
      finding(
        "agent_owned_authority",
        "handoff.owner",
        "Registration, claim, service, terms, payment, and lifecycle authority must remain owner-controlled.",
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

function pondWaterFeatureFindings(value) {
  const evidenceIds = value.evidence.map((item) => item.id);
  const evidence = new Set(evidenceIds);
  const componentIds = value.components.map((item) => item.id);
  const components = new Set(componentIds);
  const providerIds = value.providers.map((item) => item.id);
  const providers = new Set(providerIds);
  const evidenceById = new Map(value.evidence.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(evidenceIds, "evidence", "Evidence id"),
    ...uniqueFindings(componentIds, "components", "Component id"),
    ...uniqueFindings(value.observations.map((item) => item.id), "observations", "Observation id"),
    ...uniqueFindings(value.installation.requirements.map((item) => item.id), "installation.requirements", "Requirement id"),
    ...uniqueFindings(value.installation.requirements.map((item) => item.category), "installation.requirements", "Requirement category"),
    ...uniqueFindings(value.operationsCalendar.map((item) => item.id), "operationsCalendar", "Calendar id"),
    ...uniqueFindings(value.waterQuality.map((item) => item.id), "waterQuality", "Water-quality id"),
    ...uniqueFindings(value.habitat.map((item) => item.id), "habitat", "Habitat id"),
    ...uniqueFindings(value.incidents.map((item) => item.id), "incidents", "Incident id"),
    ...uniqueFindings(providerIds, "providers", "Provider id"),
  ];
  for (const [references, path] of [
    ...value.components.map((item, index) => [item.evidenceRefs, `components.${index}.evidenceRefs`]),
    ...value.observations.map((item, index) => [item.evidenceRefs, `observations.${index}.evidenceRefs`]),
    [value.riskAssessment.evidenceRefs, "riskAssessment.evidenceRefs"],
    ...value.installation.requirements.map((item, index) => [item.evidenceRefs, `installation.requirements.${index}.evidenceRefs`]),
    ...value.operationsCalendar.map((item, index) => [item.sourceRefs, `operationsCalendar.${index}.sourceRefs`]),
    ...value.waterQuality.map((item, index) => [[item.evidenceRef, ...item.thresholdRefs], `waterQuality.${index}`]),
    ...value.habitat.map((item, index) => [item.evidenceRefs, `habitat.${index}.evidenceRefs`]),
    ...value.incidents.map((item, index) => [item.evidenceRefs, `incidents.${index}.evidenceRefs`]),
    ...value.providers.map((item, index) => [[item.sourceRef], `providers.${index}.sourceRef`]),
    ...(value.appointment.bookingIntegration
      ? [[[value.appointment.bookingIntegration.approvalEvidenceRef], "appointment.bookingIntegration"]]
      : []),
    ...(value.appointment.receipt
      ? [[[value.appointment.receipt.evidenceRef], "appointment.receipt"]]
      : []),
  ]) {
    findings.push(...uniqueFindings(references, path, "Evidence reference"));
    findings.push(...referenceFindings(references, evidence, path, "Evidence reference"));
  }
  for (const [references, path] of [
    ...value.operationsCalendar.map((item, index) => [item.componentRefs, `operationsCalendar.${index}.componentRefs`]),
    ...value.incidents.map((item, index) => [item.componentRefs, `incidents.${index}.componentRefs`]),
  ]) {
    findings.push(...uniqueFindings(references, path, "Component reference"));
    findings.push(...referenceFindings(references, components, path, "Component reference"));
  }
  if (
    /\b\d{1,6}[A-Za-z]?(?:-\d{1,6}[A-Za-z]?)?\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:Alley|Aly|Avenue|Ave|Boulevard|Blvd|Circle|Cir|Court|Ct|Drive|Dr|Highway|Hwy|Lane|Ln|Parkway|Pkwy|Place|Pl|Road|Rd|Route|Rte|Street|St|Terrace|Ter|Trail|Trl|Way)\b/iu.test(
      canonicalJson(value),
    )
  ) {
    findings.push(
      finding(
        "exposed_home_address",
        "site",
        "Pond artifacts must use privacy-safe site labels, not a street address.",
      ),
    );
  }
  const directComponentEvidence = new Set([
    "site-plan",
    "manufacturer-manual",
    "equipment-record",
    "installation-record",
    "service-record",
  ]);
  for (const [index, component] of value.components.entries()) {
    const sources = component.evidenceRefs.map((reference) => evidenceById.get(reference));
    if (
      component.state === "installed" &&
      !sources.some(
        (source) =>
          directComponentEvidence.has(source?.type) &&
          ["resident-supplied", "manufacturer", "service-provider", "qualified-contractor"].includes(
            source.authority,
          ),
      )
    ) {
      findings.push(
        finding(
          "unsupported_installed_component",
          `components.${index}`,
          "Installed pond components require direct plan, equipment, installation, manufacturer, or service evidence.",
        ),
      );
    }
  }
  const requiredCategories = [
    "utility",
    "permit",
    "electrical",
    "structural",
    "hydraulic",
    "drainage",
    "access",
    "environmental",
  ];
  const requirementCategories = new Set(
    value.installation.requirements.map((item) => item.category),
  );
  const hasRequirementGap = value.installation.requirements.some((item) =>
    ["missing", "unknown"].includes(item.state),
  );
  const installationClaimsReady = ["bid-ready", "contracted", "complete"].includes(
    value.installation.state,
  );
  if (
    requiredCategories.some((category) => !requirementCategories.has(category)) ||
    (installationClaimsReady && hasRequirementGap) ||
    (value.installation.state === "blocked" && !value.installation.blockedReason) ||
    (value.installation.state !== "blocked" && value.installation.blockedReason)
  ) {
    findings.push(
      finding(
        "incoherent_installation_state",
        "installation",
        "All installation constraints must be represented, and missing or unknown requirements block ready, contracted, or complete state.",
      ),
    );
  }
  const requiredEvidenceTypes = {
    utility: ["utility-location"],
    permit: ["permit-record", "regulation"],
    electrical: ["electrical-record"],
    structural: ["structural-record", "site-plan"],
    hydraulic: ["site-plan", "installation-record", "specialist-finding"],
    drainage: ["site-plan", "installation-record", "specialist-finding"],
    access: ["site-plan", "site-photo", "specialist-finding"],
    environmental: ["permit-record", "regulation", "specialist-finding"],
  };
  for (const [index, requirement] of value.installation.requirements.entries()) {
    const sources = requirement.evidenceRefs.map((reference) => evidenceById.get(reference));
    if (
      ["verified", "not-required"].includes(requirement.state) &&
      !sources.some((source) =>
        requiredEvidenceTypes[requirement.category].includes(source?.type),
      )
    ) {
      findings.push(
        finding(
          "unsupported_installation_requirement",
          `installation.requirements.${index}`,
          "Verified and not-required installation constraints need category-relevant evidence.",
        ),
      );
    }
  }
  const unsafeOperation =
    /\b(?:excavat(?:e|ion)|dig|rewire|wire|hardwire|repair|disassembl|bypass|structural\s+work|pressuri[sz]ed\s+plumb|dose|chemical\s+treat|algaecide|herbicide|pesticide|saniti[sz]er|medicat(?:e|ion)|stock(?:ing)?|release)\b/iu;
  const qualifiedCalendarAuthorities = new Set([
    "manufacturer",
    "government",
    "laboratory",
    "university-extension",
    "qualified-contractor",
    "aquatic-specialist",
    "veterinarian",
  ]);
  const highRisk = ["emergency", "high", "qualified-specialist"].includes(
    value.riskAssessment.level,
  );
  for (const [index, item] of value.operationsCalendar.entries()) {
    const sources = item.sourceRefs.map((reference) => evidenceById.get(reference));
    const installedComponents = item.componentRefs.every(
      (reference) =>
        value.components.find((component) => component.id === reference)?.state === "installed",
    );
    if (
      Date.parse(item.windowStart) > Date.parse(item.windowEnd) ||
      !installedComponents ||
      !sources.some((source) => qualifiedCalendarAuthorities.has(source?.authority)) ||
      unsafeOperation.test(item.activity) ||
      (highRisk && item.executor === "resident")
    ) {
      findings.push(
        finding(
          "unsafe_or_unsupported_operation",
          `operationsCalendar.${index}`,
          "Operations require installed components, qualified evidence, ordered windows, and no high-risk, repair, treatment, stocking, or release instructions.",
        ),
      );
    }
  }
  if (
    (value.riskAssessment.risks.includes("none") &&
      (value.riskAssessment.risks.length !== 1 ||
        value.riskAssessment.level !== "low-risk" ||
        value.riskAssessment.action !== "bounded-resident-operation")) ||
    (highRisk && value.riskAssessment.action === "bounded-resident-operation")
  ) {
    findings.push(
      finding(
        "unsafe_risk_assessment",
        "riskAssessment",
        "High-risk pond states must suppress resident operations, while a no-risk state must be explicitly low-risk and bounded.",
      ),
    );
  }
  for (const [index, item] of value.waterQuality.entries()) {
    const measurement = evidenceById.get(item.evidenceRef);
    const thresholds = item.thresholdRefs.map((reference) => evidenceById.get(reference));
    if (
      measurement?.type !== "water-measurement" &&
      measurement?.type !== "laboratory-result"
    ) {
      findings.push(
        finding(
          "unsupported_water_measurement",
          `waterQuality.${index}.evidenceRef`,
          "Water-quality values require direct measurement or laboratory evidence.",
        ),
      );
    }
    if (
      item.status !== "unknown" &&
      !thresholds.some((source) =>
        ["government", "laboratory", "university-extension", "aquatic-specialist", "veterinarian"].includes(
          source?.authority,
        ),
      )
    ) {
      findings.push(
        finding(
          "unsupported_water_conclusion",
          `waterQuality.${index}.status`,
          "Within-range and outside-range conclusions require a qualified threshold source.",
        ),
      );
    }
  }
  const habitatHandoffs = {
    "aquatic-plant": ["green-thumb", "aquatic-specialist", "regulator"],
    fish: ["pet-care", "aquatic-specialist", "veterinarian", "regulator"],
    amphibian: ["aquatic-specialist", "veterinarian", "regulator"],
    wildlife: ["aquatic-specialist", "veterinarian", "regulator"],
    other: ["aquatic-specialist", "veterinarian", "regulator"],
  };
  for (const [index, item] of value.habitat.entries()) {
    const sources = item.evidenceRefs.map((reference) => evidenceById.get(reference));
    const qualifiedIdentity = sources.some(
      (source) =>
        source?.type === "species-record" &&
        ["government", "university-extension", "aquatic-specialist", "veterinarian"].includes(
          source.authority,
        ),
    );
    if (
      (item.identityState === "qualified-confirmed" && !qualifiedIdentity) ||
      (["concern-observed", "escalated"].includes(item.observationState) &&
        !habitatHandoffs[item.kind].includes(item.handoff)) ||
      (item.observationState === "escalated" && item.handoff === "none")
    ) {
      findings.push(
        finding(
          "unsafe_habitat_handoff",
          `habitat.${index}`,
          "Species identity and plant, fish, wildlife, invasive, or protected-species concerns must remain qualified and route to the correct owner system.",
        ),
      );
    }
  }
  const incidentHandoffs = {
    "equipment-fault": ["home-repair"],
    leak: ["home-repair", "qualified-plumber"],
    "electrical-warning": ["qualified-electrician", "emergency-services"],
    "structural-concern": ["home-repair"],
    "water-quality-exceedance": ["aquatic-specialist", "veterinarian"],
    "fish-health": ["pet-care", "veterinarian"],
    "plant-concern": ["green-thumb", "aquatic-specialist"],
    "environmental-discharge": ["regulator", "emergency-services"],
    other: ["aquatic-specialist", "regulator"],
  };
  for (const [index, item] of value.incidents.entries()) {
    if (
      item.state !== "resolved" &&
      !incidentHandoffs[item.kind].includes(item.handoff)
    ) {
      findings.push(
        finding(
          "unsafe_incident_handoff",
          `incidents.${index}`,
          "Open pond incidents must route faults, plants, fish health, electrical hazards, water quality, and discharge to the correct owner system.",
        ),
      );
    }
  }
  for (const [index, provider] of value.providers.entries()) {
    const source = evidenceById.get(provider.sourceRef);
    if (
      source?.type !== "provider-info" ||
      source.authority !== "service-provider" ||
      provider.qualificationState === "unverified"
    ) {
      findings.push(
        finding(
          "unsupported_provider",
          `providers.${index}`,
          "Pond provider options require provider-controlled evidence and resident or source verification.",
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
      !provider ||
      provider.qualificationState === "unverified" ||
      provider.specialty !== appointment.plan.specialty ||
      appointment.plan.maxDeposit > appointment.plan.maxCost
    ) {
      findings.push(
        finding(
          "unsupported_appointment",
          "appointment.plan",
          "Appointments require a verified matching specialist and a deposit within the approved cost ceiling.",
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
          "Resident approval must bind the exact appointment plan.",
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
    const integrationEvidence = evidenceById.get(
      appointment.bookingIntegration.approvalEvidenceRef,
    );
    const receiptEvidence = evidenceById.get(appointment.receipt.evidenceRef);
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
          "The approved integration and provider receipt must bind the exact resident-approved plan.",
        ),
      );
    }
    if (Date.parse(appointment.receipt.bookedAt) < Date.parse(appointment.approval.approvedAt)) {
      findings.push(
        finding(
          "booking_predates_approval",
          "appointment.receipt.bookedAt",
          "A pond-service booking cannot predate resident approval.",
        ),
      );
    }
  }
  if (
    canonicalJson(value.handoff.resident) !== canonicalJson(value.resident) ||
    value.resident.id === "pond-water-feature-coordinator" ||
    (value.site.workAuthority === "unverified" &&
      (value.handoff.state !== "blocked" ||
        !["not-requested", "blocked"].includes(appointment.state)))
  ) {
    findings.push(
      finding(
        "agent_owned_authority",
        "handoff.resident",
        "Site work, treatment, disclosure, payment, and appointment authority must remain with a verified resident.",
      ),
    );
  }
  return findings;
}

function petCareFindings(value) {
  const evidenceIds = value.evidence.map((item) => item.id);
  const evidence = new Set(evidenceIds);
  const providerIds = value.providers.map((item) => item.id);
  const providers = new Set(providerIds);
  const findings = [
    ...uniqueFindings(evidenceIds, "evidence", "Evidence id"),
    ...uniqueFindings(value.observations.map((item) => item.id), "observations", "Observation id"),
    ...uniqueFindings(value.careCalendar.map((item) => item.id), "careCalendar", "Calendar id"),
    ...uniqueFindings(value.monitoring.map((item) => item.id), "monitoring", "Monitoring id"),
    ...uniqueFindings(providerIds, "providers", "Provider id"),
  ];
  for (const [references, path] of [
    ...value.observations.map((item, index) => [item.evidenceRefs, `observations.${index}.evidenceRefs`]),
    [value.assessment.evidenceRefs, "assessment.evidenceRefs"],
    ...value.careCalendar.map((item, index) => [item.evidenceRefs, `careCalendar.${index}.evidenceRefs`]),
    ...value.monitoring.map((item, index) => [item.evidenceRefs, `monitoring.${index}.evidenceRefs`]),
    ...value.providers.map((item, index) => [[item.sourceRef], `providers.${index}.sourceRef`]),
  ]) {
    findings.push(...uniqueFindings(references, path, "Evidence reference"));
    findings.push(...referenceFindings(references, evidence, path, "Evidence reference"));
  }
  if (/\b\d{1,6}[A-Za-z]?(?:-\d{1,6}[A-Za-z]?)?\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:Alley|Aly|Avenue|Ave|Boulevard|Blvd|Circle|Cir|Court|Ct|Crescent|Cres|Drive|Dr|Expressway|Expy|Freeway|Fwy|Highway|Hwy|Lane|Ln|Parkway|Pkwy|Place|Pl|Plaza|Plz|Road|Rd|Route|Rte|Square|Sq|Street|St|Terrace|Ter|Trail|Trl|Way)\b/iu.test(canonicalJson(value))) {
    findings.push(finding("exposed_home_address", "pet", "Durable pet-care artifacts must use privacy-safe labels, not a street address."));
  }
  const emergencyRisks = new Set([
    "breathing-distress", "collapse", "uncontrolled-bleeding", "seizure",
    "toxic-exposure", "medication-error", "severe-pain", "rapid-decline",
  ]);
  const urgentRisks = new Set(["foreign-body", "persistent-vomiting"]);
  const hasEmergencyRisk = value.assessment.risks.some((risk) => emergencyRisks.has(risk));
  const hasNonToxicEmergencyRisk = value.assessment.risks.some(
    (risk) => emergencyRisks.has(risk) && risk !== "toxic-exposure",
  );
  const hasUrgentRisk = value.assessment.risks.some((risk) => urgentRisks.has(risk));
  if (
    (value.assessment.risks.includes("none") && value.assessment.risks.length !== 1) ||
    (value.assessment.risks.includes("none") && !["routine", "preventive"].includes(value.assessment.level)) ||
    (hasEmergencyRisk && value.assessment.level !== "emergency") ||
    (hasUrgentRisk && !["urgent", "emergency"].includes(value.assessment.level)) ||
    (value.assessment.level === "emergency" &&
      ((hasNonToxicEmergencyRisk &&
        value.assessment.action !== "emergency-veterinary") ||
        (!hasNonToxicEmergencyRisk &&
          !["emergency-veterinary", "poison-control"].includes(
            value.assessment.action,
          )))) ||
    (value.assessment.level === "urgent" &&
      value.assessment.action !== "urgent-veterinary") ||
    (value.assessment.level === "routine" &&
      value.assessment.action !== "routine-veterinary") ||
    (value.assessment.level === "preventive" &&
      value.assessment.action !== "preventive-tracking") ||
    (value.assessment.level === "uncertain" && value.assessment.action === "preventive-tracking")
  ) {
    findings.push(finding("unsafe_pet_assessment", "assessment", "Emergency, toxic-exposure, medication-error, and uncertain states must fail closed to qualified care."));
  }
  if (value.assessment.level !== "emergency" && value.careCalendar.length === 0) {
    findings.push(
      finding(
        "missing_care_calendar",
        "careCalendar",
        "Non-emergency pet-care handoffs require an evidence-bound care calendar.",
      ),
    );
  }
  for (const [index, item] of value.careCalendar.entries()) {
    if (Date.parse(item.dueStart) > Date.parse(item.dueEnd)) {
      findings.push(finding("invalid_care_window", `careCalendar.${index}`, "Care due windows must be ordered."));
    }
    const qualified = item.evidenceRefs.some((reference) => {
      const evidenceItem = value.evidence.find((candidate) => candidate.id === reference);
      return ["veterinarian", "veterinary-laboratory", "manufacturer", "government"].includes(evidenceItem?.authority);
    });
    const linkedEvidence = item.evidenceRefs
      .map((reference) => value.evidence.find((candidate) => candidate.id === reference))
      .filter(Boolean);
    const supportedMedication =
      item.kind !== "veterinarian-directed-medication" ||
      linkedEvidence.some(
        (evidenceItem) =>
          evidenceItem.type === "prescription-label" &&
          evidenceItem.authority === "veterinarian",
      );
    const supportedPreventive =
      item.kind !== "preventive" ||
      linkedEvidence.some(
        (evidenceItem) =>
          (evidenceItem.type === "veterinary-record" &&
            evidenceItem.authority === "veterinarian") ||
          (evidenceItem.type === "laboratory-result" &&
            evidenceItem.authority === "veterinary-laboratory") ||
          (evidenceItem.type === "manufacturer-label" &&
            evidenceItem.authority === "manufacturer") ||
          (evidenceItem.type === "government-guidance" &&
            evidenceItem.authority === "government"),
      );
    if (
      !qualified ||
      !supportedMedication ||
      !supportedPreventive ||
      (value.assessment.level === "emergency" && item.executor === "guardian")
    ) {
      findings.push(finding("unsupported_pet_care", `careCalendar.${index}`, "Care items require qualified evidence and emergency states cannot produce guardian care instructions."));
    }
  }
  for (const [index, item] of value.monitoring.entries()) {
    const timedOutcomeEvidence = item.evidenceRefs
      .map((reference) => value.evidence.find((candidate) => candidate.id === reference))
      .filter(
        (evidenceItem) =>
          evidenceItem &&
          ["guardian-report", "photo", "video", "measurement", "veterinary-record", "laboratory-result"].includes(
            evidenceItem.type,
          ) &&
          item.observedAt &&
          Date.parse(evidenceItem.capturedAt) <= Date.parse(item.observedAt) &&
          Date.parse(evidenceItem.capturedAt) >= Date.parse(item.dueAt),
      );
    if (
      (["stable", "worsened"].includes(item.state) &&
        (!item.observedAt || timedOutcomeEvidence.length === 0)) ||
      (item.state === "planned" && item.observedAt)
    ) {
      findings.push(finding("unsupported_monitoring_result", `monitoring.${index}`, "Completed monitoring requires timed outcome evidence captured at or after the checkpoint."));
    }
  }
  for (const [index, provider] of value.providers.entries()) {
    const source = value.evidence.find((item) => item.id === provider.sourceRef);
    if (source?.type !== "provider-info" || source.authority !== "service-provider") {
      findings.push(finding("unsupported_provider", `providers.${index}.sourceRef`, "Veterinary provider options require provider-controlled evidence."));
    }
  }
  const appointment = value.appointment;
  const hasPlan = Boolean(appointment.plan);
  const hasApproval = Boolean(appointment.approval);
  const hasIntegration = Boolean(appointment.bookingIntegration);
  const hasReceipt = Boolean(appointment.receipt);
  if (
    value.assessment.level === "emergency" &&
    (appointment.state !== "blocked" ||
      hasPlan ||
      !appointment.blockedReason ||
      value.handoff.state !== "blocked")
  ) {
    findings.push(
      finding(
        "unsafe_emergency_handoff",
        "appointment",
        "Emergency pet-care states must block routine scheduling and produce an immediate-care handoff.",
      ),
    );
  }
  if (
    (["options-ready", "awaiting-approval", "approved", "booked"].includes(appointment.state) && !hasPlan) ||
    (["approved", "booked"].includes(appointment.state) && !hasApproval) ||
    (appointment.state === "booked" && (!hasIntegration || !hasReceipt)) ||
    (appointment.state !== "booked" && (hasIntegration || hasReceipt)) ||
    (!["approved", "booked"].includes(appointment.state) && hasApproval) ||
    (appointment.state === "not-requested" && hasPlan) ||
    (appointment.state === "blocked" && !appointment.blockedReason)
  ) {
    findings.push(finding("incoherent_appointment_state", "appointment", "Appointment plan, approval, integration, and receipt must match the declared state."));
  }
  if (appointment.plan) {
    findings.push(...referenceFindings([appointment.plan.providerRef], providers, "appointment.plan.providerRef", "Provider reference"));
    const provider = value.providers.find((item) => item.id === appointment.plan.providerRef);
    if (
      provider &&
      (provider.specialty !== appointment.plan.specialty ||
        provider.qualificationState !== "guardian-verified")
    ) {
      findings.push(finding("appointment_specialty_mismatch", "appointment.plan.specialty", "Appointment specialty must match the selected veterinary provider."));
    }
    if (appointment.plan.maxDeposit > appointment.plan.maxCost) {
      findings.push(finding("deposit_exceeds_cost", "appointment.plan.maxDeposit", "Deposit cannot exceed the approved cost ceiling."));
    }
  }
  const planDigest = appointment.plan
    ? `sha256:${createHash("sha256").update(canonicalJson(appointment.plan)).digest("hex")}`
    : undefined;
  if (["approved", "booked"].includes(appointment.state) && appointment.approval) {
    if (
      appointment.approval.planDigest !== planDigest ||
      canonicalJson(appointment.approval.guardian) !== canonicalJson(value.guardian)
    ) {
      findings.push(finding("appointment_approval_mismatch", "appointment.approval", "Appointment approval must bind the exact plan and guardian."));
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
      integrationEvidence.authority !== "guardian-supplied" ||
      integrationEvidence.reference !== appointment.bookingIntegration.approvalRef ||
      receiptEvidence?.type !== "provider-receipt" ||
      receiptEvidence.authority !== "service-provider" ||
      receiptEvidence.reference !== appointment.receipt.confirmationRef ||
      receiptEvidence.capturedAt !== appointment.receipt.bookedAt ||
      Date.parse(integrationEvidence.capturedAt) > Date.parse(appointment.receipt.bookedAt) ||
      Date.parse(appointment.receipt.bookedAt) >= Date.parse(appointment.plan.startsAt) ||
      canonicalJson(appointment.bookingIntegration.configuredBy) !==
        canonicalJson(value.guardian)
    ) {
      findings.push(finding("booking_receipt_mismatch", "appointment.receipt", "The approved integration and provider receipt must bind the exact guardian-approved plan."));
    }
    if (Date.parse(appointment.receipt.bookedAt) < Date.parse(appointment.approval.approvedAt)) {
      findings.push(finding("booking_predates_approval", "appointment.receipt.bookedAt", "A veterinary booking cannot predate guardian approval."));
    }
  }
  if (
    canonicalJson(value.handoff.guardian) !== canonicalJson(value.guardian) ||
    value.guardian.id === "pet-care-coordinator"
  ) {
    findings.push(finding("agent_owned_authority", "handoff.guardian", "Diagnosis, treatment, disclosure, payment, and appointment authority remain guardian-controlled."));
  }
  return findings;
}

function careCircleFindings(value) {
  const evidenceIds = value.evidence.map((item) => item.id);
  const helperIds = value.helpers.map((item) => item.id);
  const needIds = value.needs.map((item) => item.id);
  const scopeIds = value.consentScopes.map((item) => item.id);
  const taskIds = value.supportTasks.map((item) => item.id);
  const people = new Set([value.recipient.id, value.organizer.id, ...helperIds]);
  const evidence = new Set(evidenceIds);
  const helpers = new Set(helperIds);
  const needs = new Set(needIds);
  const scopes = new Set(scopeIds);
  const tasks = new Set(taskIds);
  const evidenceById = new Map(value.evidence.map((item) => [item.id, item]));
  const helperById = new Map(value.helpers.map((item) => [item.id, item]));
  const needById = new Map(value.needs.map((item) => [item.id, item]));
  const scopeById = new Map(value.consentScopes.map((item) => [item.id, item]));
  const commitmentByTask = new Map(value.commitments.map((item) => [item.taskRef, item]));
  const findings = [
    ...uniqueFindings(evidenceIds, "evidence", "Evidence id"),
    ...uniqueFindings(helperIds, "helpers", "Helper id"),
    ...uniqueFindings(needIds, "needs", "Need id"),
    ...uniqueFindings(scopeIds, "consentScopes", "Consent scope id"),
    ...uniqueFindings(taskIds, "supportTasks", "Support task id"),
    ...uniqueFindings(value.commitments.map((item) => item.id), "commitments", "Commitment id"),
    ...uniqueFindings(value.blockedItems.map((item) => item.id), "blockedItems", "Blocked item id"),
  ];
  for (const [references, allowed, path, label] of [
    ...value.helpers.map((item, index) => [
      item.availabilityEvidenceRefs,
      evidence,
      `helpers.${index}.availabilityEvidenceRefs`,
      "Evidence reference",
    ]),
    ...value.needs.map((item, index) => [
      item.evidenceRefs,
      evidence,
      `needs.${index}.evidenceRefs`,
      "Evidence reference",
    ]),
    ...value.consentScopes.map((item, index) => [
      item.evidenceRefs,
      evidence,
      `consentScopes.${index}.evidenceRefs`,
      "Evidence reference",
    ]),
    ...value.consentScopes.map((item, index) => [
      item.audienceRefs,
      people,
      `consentScopes.${index}.audienceRefs`,
      "Audience reference",
    ]),
    ...value.commitments.map((item, index) => [
      item.evidenceRefs,
      evidence,
      `commitments.${index}.evidenceRefs`,
      "Evidence reference",
    ]),
  ]) {
    findings.push(...uniqueFindings(references, path, label));
    findings.push(...referenceFindings(references, allowed, path, label));
  }
  for (const [index, need] of value.needs.entries()) {
    if (Date.parse(need.dueEnd) <= Date.parse(need.dueStart)) {
      findings.push(finding("invalid_time_range", `needs.${index}`, "Care need due windows must be ordered."));
    }
    if (
      ["urgent", "emergency"].includes(need.priority) &&
      need.professionalBoundary === "practical-support"
    ) {
      findings.push(
        finding(
          "unsafe_care_need",
          `needs.${index}`,
          "Urgent and emergency care questions must route to professional or emergency owners.",
        ),
      );
    }
  }
  for (const [index, scope] of value.consentScopes.entries()) {
    findings.push(
      ...referenceFindings([scope.recipientRef], new Set([value.recipient.id]), `consentScopes.${index}.recipientRef`, "Recipient reference"),
    );
    const consentEvidence = scope.evidenceRefs
      .map((reference) => evidenceById.get(reference))
      .filter(Boolean);
    if (
      consentEvidence.every(
        (item) => item.type !== "recipient-consent" || item.authority !== "recipient-supplied",
      ) ||
      Date.parse(scope.expiresAt) <= Math.max(...consentEvidence.map((item) => Date.parse(item.capturedAt)))
    ) {
      findings.push(
        finding(
          "unsupported_consent_scope",
          `consentScopes.${index}`,
          "Shared care-circle details require current recipient-supplied consent.",
        ),
      );
    }
  }
  for (const [index, task] of value.supportTasks.entries()) {
    findings.push(
      ...referenceFindings([task.needRef], needs, `supportTasks.${index}.needRef`, "Need reference"),
    );
    if (task.helperRef) {
      findings.push(
        ...referenceFindings([task.helperRef], helpers, `supportTasks.${index}.helperRef`, "Helper reference"),
      );
    }
    if (task.scopeRef) {
      findings.push(
        ...referenceFindings([task.scopeRef], scopes, `supportTasks.${index}.scopeRef`, "Consent scope reference"),
      );
    }
    if (Date.parse(task.endsAt) <= Date.parse(task.startsAt)) {
      findings.push(finding("invalid_time_range", `supportTasks.${index}`, "Support task windows must be ordered."));
    }
    const need = needById.get(task.needRef);
    const helper = task.helperRef ? helperById.get(task.helperRef) : undefined;
    const scope = task.scopeRef ? scopeById.get(task.scopeRef) : undefined;
    const commitment = commitmentByTask.get(task.id);
    if (
      need &&
      need.professionalBoundary !== "practical-support" &&
      !["blocked", "escalation-required"].includes(task.state)
    ) {
      findings.push(
        finding(
          "unsupported_professional_care",
          `supportTasks.${index}`,
          "Medical, legal, financial, and emergency needs cannot become ordinary helper support tasks.",
        ),
      );
    }
    if (
      task.state === "accepted" &&
      (!helper ||
        !scope ||
        !scope.audienceRefs.includes(helper.id) ||
        !scope.audienceRefs.includes(value.organizer.id) ||
        !helper.allowedTaskKinds.includes(need?.kind) ||
        !commitment ||
        commitment.state !== "accepted" ||
        commitment.helperRef !== helper.id ||
        commitment.acceptedAt === null)
    ) {
      findings.push(
        finding(
          "unsupported_helper_commitment",
          `supportTasks.${index}`,
          "Accepted care tasks require a permitted helper, consent scope, and exact accepted commitment.",
        ),
      );
    }
  }
  for (const [index, commitment] of value.commitments.entries()) {
    findings.push(
      ...referenceFindings([commitment.taskRef], tasks, `commitments.${index}.taskRef`, "Task reference"),
      ...referenceFindings([commitment.helperRef], helpers, `commitments.${index}.helperRef`, "Helper reference"),
    );
    if (
      (commitment.state === "accepted" && !commitment.acceptedAt) ||
      (commitment.state !== "accepted" && commitment.acceptedAt)
    ) {
      findings.push(
        finding(
          "incoherent_commitment_state",
          `commitments.${index}`,
          "Only accepted helper commitments may carry an acceptedAt timestamp.",
        ),
      );
    }
  }
  for (const [index, item] of value.blockedItems.entries()) {
    findings.push(
      ...referenceFindings([item.ownerRef], people, `blockedItems.${index}.ownerRef`, "Owner reference"),
    );
  }
  if (/\b\d{1,6}[A-Za-z]?(?:-\d{1,6}[A-Za-z]?)?\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:Alley|Aly|Avenue|Ave|Boulevard|Blvd|Circle|Cir|Court|Ct|Crescent|Cres|Drive|Dr|Expressway|Expy|Freeway|Fwy|Highway|Hwy|Lane|Ln|Parkway|Pkwy|Place|Pl|Plaza|Plz|Road|Rd|Route|Rte|Square|Sq|Street|St|Terrace|Ter|Trail|Trl|Way)\b/iu.test(canonicalJson(value))) {
    findings.push(
      finding(
        "exposed_private_location",
        "recipient",
        "Durable care-circle artifacts must use privacy-safe labels, not a street address.",
      ),
    );
  }
  if (
    value.handoff.recipientRef !== value.recipient.id ||
    value.handoff.organizerRef !== value.organizer.id ||
    value.recipient.id === "care-circle-coordinator" ||
    value.organizer.id === "care-circle-coordinator"
  ) {
    findings.push(
      finding(
        "agent_owned_authority",
        "handoff",
        "Care, privacy, helper commitments, and escalation authority must remain with named humans.",
      ),
    );
  }
  if (
    value.handoff.state === "ready-for-organizer" &&
    (value.supportTasks.some((item) => ["blocked", "escalation-required", "pending-recipient"].includes(item.state)) ||
      value.blockedItems.some((item) => item.state !== "resolved-by-human"))
  ) {
    findings.push(
      finding(
        "unsupported_terminal_state",
        "handoff.state",
        "Ready handoff requires all blocked, escalation, and recipient-pending items to be resolved by humans.",
      ),
    );
  }
  return findings;
}

function sportsTeamWatchFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const teamIds = value.teams.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const teamSet = new Set(teamIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(teamIds, "teams", "Team id"),
    ...uniqueFindings(value.games.map((item) => item.id), "games", "Game id"),
    ...uniqueFindings(value.rosterNotes.map((item) => item.id), "rosterNotes", "Roster note id"),
    ...uniqueFindings(value.watchItems.map((item) => item.id), "watchItems", "Watch item id"),
  ];
  for (const [index, team] of value.teams.entries()) {
    findings.push(
      ...uniqueFindings(team.sourceRefs, `teams.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(team.sourceRefs, sourceSet, `teams.${index}.sourceRefs`, "Source reference"),
    );
    const officialSources = team.sourceRefs
      .map((ref) => sourceById.get(ref))
      .filter((item) => item && ["official-league", "official-team"].includes(item.authority));
    if (officialSources.length === 0) {
      findings.push(finding("unofficial_team_facts", `teams.${index}.sourceRefs`, "Team facts require official league or team source evidence."));
    }
  }
  for (const [index, game] of value.games.entries()) {
    findings.push(
      ...referenceFindings([game.teamRef], teamSet, `games.${index}.teamRef`, "Team reference"),
      ...uniqueFindings(game.sourceRefs, `games.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(game.sourceRefs, sourceSet, `games.${index}.sourceRefs`, "Source reference"),
    );
    if ((game.status === "final" && !game.score) || (game.status !== "final" && game.score !== null)) {
      findings.push(finding("incoherent_game_score", `games.${index}.score`, "Only final games may carry a score, and final games require one."));
    }
  }
  for (const [collection, path] of [
    [value.standings, "standings"],
    [value.rosterNotes, "rosterNotes"],
    [value.watchItems, "watchItems"],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...referenceFindings([item.teamRef], teamSet, `${path}.${index}.teamRef`, "Team reference"),
        ...uniqueFindings(item.sourceRefs, `${path}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${path}.${index}.sourceRefs`, "Source reference"),
      );
    }
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready sports watches cannot depend on stale, missing, or conflicting sources."));
  }
  const fanText = canonicalJson({
    games: value.games.map(({ opponent, score }) => ({ opponent, score })),
    rosterNotes: value.rosterNotes.map(({ subject, note }) => ({ subject, note })),
    standings: value.standings.map(({ summary }) => summary),
    watchItems: value.watchItems.map(({ title, whyItMatters }) => ({ title, whyItMatters })),
  });
  if (/\b(odds|spread|parlay|moneyline|wager|bet|betting)\b/iu.test(fanText)) {
    findings.push(finding("betting_content", "watchItems", "Sports watch artifacts must exclude betting, odds, and wagering content."));
  }
  if (value.handoff.owner === "sports-team-watcher") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Review, betting, ticketing, calendar, and messaging authority must remain with the named owner."));
  }
  return findings;
}

function movieStreamingFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const titleIds = value.titles.map((item) => item.id);
  const availabilityIds = value.availability.map((item) => item.id);
  const preferenceIds = value.preferences.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const titleSet = new Set(titleIds);
  const availabilitySet = new Set(availabilityIds);
  const preferenceSet = new Set(preferenceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const titleById = new Map(value.titles.map((item) => [item.id, item]));
  const availabilityById = new Map(value.availability.map((item) => [item.id, item]));
  const collectionServices = new Set(value.collection.services);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(titleIds, "titles", "Title id"),
    ...uniqueFindings(availabilityIds, "availability", "Availability id"),
    ...uniqueFindings(preferenceIds, "preferences", "Preference id"),
    ...uniqueFindings(value.shortlist.map((item) => item.id), "shortlist", "Shortlist id"),
  ];
  for (const [index, title] of value.titles.entries()) {
    findings.push(
      ...uniqueFindings(title.sourceRefs, `titles.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(title.sourceRefs, sourceSet, `titles.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, row] of value.availability.entries()) {
    findings.push(
      ...referenceFindings([row.titleRef], titleSet, `availability.${index}.titleRef`, "Title reference"),
      ...uniqueFindings(row.sourceRefs, `availability.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(row.sourceRefs, sourceSet, `availability.${index}.sourceRefs`, "Source reference"),
    );
    const supportedSource = row.sourceRefs.some((ref) =>
      ["streaming-availability", "title-metadata"].includes(sourceById.get(ref)?.kind),
    );
    if (!supportedSource) {
      findings.push(finding("unsupported_availability_source", `availability.${index}.sourceRefs`, "Availability rows require streaming availability or title metadata source evidence."));
    }
    if (!collectionServices.has(row.service)) {
      findings.push(finding("unsupported_service", `availability.${index}.service`, "Availability must be scoped to services the owner says they have."));
    }
    if (row.region !== value.collection.region) {
      findings.push(finding("region_mismatch", `availability.${index}.region`, "Availability region must match the watchlist region."));
    }
  }
  for (const [index, preference] of value.preferences.entries()) {
    findings.push(
      ...uniqueFindings(preference.sourceRefs, `preferences.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(preference.sourceRefs, sourceSet, `preferences.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, pick] of value.shortlist.entries()) {
    findings.push(
      ...referenceFindings([pick.titleRef], titleSet, `shortlist.${index}.titleRef`, "Title reference"),
      ...referenceFindings([pick.availabilityRef], availabilitySet, `shortlist.${index}.availabilityRef`, "Availability reference"),
      ...uniqueFindings(pick.preferenceRefs, `shortlist.${index}.preferenceRefs`, "Preference reference"),
      ...referenceFindings(pick.preferenceRefs, preferenceSet, `shortlist.${index}.preferenceRefs`, "Preference reference"),
    );
    const title = titleById.get(pick.titleRef);
    const availability = availabilityById.get(pick.availabilityRef);
    if (availability && availability.titleRef !== pick.titleRef) {
      findings.push(finding("availability_title_mismatch", `shortlist.${index}.availabilityRef`, "Shortlist availability must belong to the same title."));
    }
    if (
      pick.state === "recommended" &&
      (!availability ||
        availability.freshness !== "current" ||
        availability.accessMode !== "included" ||
        availability.accountConstraint !== "included-in-owner-plan")
    ) {
      findings.push(finding("unsupported_recommendation", `shortlist.${index}`, "Recommended titles require current included availability on the owner's declared services."));
    }
    if (pick.state === "recommended" && ["watched", "disliked", "blocked"].includes(title?.tasteState)) {
      findings.push(finding("taste_state_conflict", `shortlist.${index}.titleRef`, "Recommended titles cannot conflict with watched, disliked, or blocked taste state."));
    }
    if (
      (pick.state === "blocked" && !pick.blockedReason) ||
      (pick.state !== "blocked" && pick.blockedReason !== null)
    ) {
      findings.push(finding("incoherent_blocked_state", `shortlist.${index}.blockedReason`, "Only blocked shortlist items may carry a blocked reason."));
    }
  }
  const accountActionText = canonicalJson({
    shortlist: value.shortlist.map(({ fitReason, blockedReason }) => ({ fitReason, blockedReason })),
  });
  if (/\b(rent|buy|subscribe|cancel|publish|rate|message|modify account|bypass)\b/iu.test(accountActionText)) {
    findings.push(finding("account_action_content", "shortlist", "Watch artifacts must not instruct account, purchase, subscription, posting, messaging, or restriction-bypass actions."));
  }
  if (value.handoff.owner === "movie-streaming-organizer") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Streaming account, purchase, rating, messaging, and viewing decisions must remain with the named owner."));
  }
  return findings;
}

function stockPortfolioFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const positionIds = value.positions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const positionSet = new Set(positionIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const positionById = new Map(value.positions.map((item) => [item.id, item]));
  const quoteByPosition = new Map(value.quotes.map((item) => [item.positionRef, item]));
  const allocationByPosition = new Map(value.allocations.map((item) => [item.positionRef, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(positionIds, "positions", "Position id"),
    ...uniqueFindings(value.quotes.map((item) => item.positionRef), "quotes", "Quote position reference"),
    ...uniqueFindings(value.allocations.map((item) => item.positionRef), "allocations", "Allocation position reference"),
    ...uniqueFindings(value.issuerEvents.map((item) => item.id), "issuerEvents", "Issuer event id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, position] of value.positions.entries()) {
    findings.push(
      ...referenceFindings([position.positionSourceRef], sourceSet, `positions.${index}.positionSourceRef`, "Source reference"),
    );
    if (!quoteByPosition.has(position.id) || !allocationByPosition.has(position.id)) {
      findings.push(finding("missing_position_valuation", `positions.${index}`, "Every position requires exactly one quote and one allocation."));
    }
    if (position.costBasis.state === "supplied") {
      if (position.costBasis.amount === null || !position.costBasis.currency || !position.costBasis.sourceRef) {
        findings.push(finding("unsupported_cost_basis", `positions.${index}.costBasis`, "Supplied cost basis requires amount, currency, and source evidence."));
      } else {
        findings.push(
          ...referenceFindings([position.costBasis.sourceRef], sourceSet, `positions.${index}.costBasis.sourceRef`, "Source reference"),
        );
      }
    }
    if (
      position.costBasis.state === "not-supplied" &&
      (position.costBasis.amount !== null || position.costBasis.currency !== null || position.costBasis.sourceRef !== null)
    ) {
      findings.push(finding("unsupported_cost_basis", `positions.${index}.costBasis`, "Missing cost basis cannot carry inferred values."));
    }
  }
  for (const [index, quote] of value.quotes.entries()) {
    findings.push(
      ...referenceFindings([quote.positionRef], positionSet, `quotes.${index}.positionRef`, "Position reference"),
      ...referenceFindings([quote.sourceRef], sourceSet, `quotes.${index}.sourceRef`, "Source reference"),
    );
    const source = sourceById.get(quote.sourceRef);
    if (!source || source.kind !== "market-quote" || !["exchange", "market-data-provider"].includes(source.authority)) {
      findings.push(finding("unsupported_quote_source", `quotes.${index}.sourceRef`, "Quotes require market-quote evidence from an exchange or approved market-data provider."));
    }
    if (["stale", "missing", "conflicting"].includes(quote.freshness) || ["stale", "missing", "conflicting"].includes(source?.freshness)) {
      findings.push(finding("stale_market_quote", `quotes.${index}.freshness`, "Ready portfolio monitors require non-stale market quote evidence."));
    }
  }
  for (const [index, allocation] of value.allocations.entries()) {
    findings.push(...referenceFindings([allocation.positionRef], positionSet, `allocations.${index}.positionRef`, "Position reference"));
    const position = positionById.get(allocation.positionRef);
    const quote = quoteByPosition.get(allocation.positionRef);
    if (position && quote) {
      if (quote.currency !== allocation.currency || !numbersEqual(allocation.marketValue, position.quantity * quote.price)) {
        findings.push(finding("allocation_mismatch", `allocations.${index}.marketValue`, "Allocation market value must equal supplied quantity times sourced quote price."));
      }
    }
  }
  const allocationTotal = value.allocations.reduce((total, item) => total + item.allocationPct, 0);
  if (!numbersEqual(allocationTotal, 100)) {
    findings.push(finding("allocation_total_mismatch", "allocations", "Allocation percentages must sum to 100."));
  }
  for (const [index, event] of value.issuerEvents.entries()) {
    findings.push(
      ...referenceFindings([event.positionRef], positionSet, `issuerEvents.${index}.positionRef`, "Position reference"),
      ...uniqueFindings(event.sourceRefs, `issuerEvents.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(event.sourceRefs, sourceSet, `issuerEvents.${index}.sourceRefs`, "Source reference"),
    );
    const supported = event.sourceRefs.every((ref) =>
      ["issuer-filing", "issuer-news", "dividend-calendar"].includes(sourceById.get(ref)?.kind),
    );
    if (!supported) {
      findings.push(finding("unsupported_issuer_event_source", `issuerEvents.${index}.sourceRefs`, "Issuer events require filing, issuer-news, or dividend-calendar sources."));
    }
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }
  const adviceText = canonicalJson({
    issuerEvents: value.issuerEvents.map(({ summary }) => summary),
    reviewQuestions: value.reviewQuestions.map(({ question }) => question),
  });
  if (/\b(buy|sell|hold|trim|accumulate|overweight|underweight|add shares|increase position|reduce position)\b/iu.test(adviceText)) {
    findings.push(finding("portfolio_recommendation", "reviewQuestions", "Portfolio monitor artifacts must not recommend buy, sell, hold, tax, legal, or trading actions."));
  }
  if (value.handoff.owner === "stock-portfolio-monitor") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Trading, broker, tax, legal, and suitability authority must remain with the named owner."));
  }
  return findings;
}

const validators = {
  "appliance-care-coordinator": applianceCareFindings,
  "care-circle-coordinator": careCircleFindings,
  "case-continuity-coordinator": caseContinuityFindings,
  "change-control-operator": changeControlFindings,
  "civic-data-analyst": civicDataFindings,
  "data-analyst": dataAnalysisFindings,
  "delegation-coordinator": delegationFindings,
  "financial-analyst": financialAnalysisFindings,
  "green-thumb-coordinator": greenThumbFindings,
  "home-repair-coordinator": homeRepairFindings,
  "household-steward": householdStewardFindings,
  "model-evaluation-adjudicator": modelEvaluationFindings,
  "movie-streaming-organizer": movieStreamingFindings,
  "pet-care-coordinator": petCareFindings,
  "pond-water-feature-coordinator": pondWaterFeatureFindings,
  "project-manager": projectFindings,
  "product-manager": productFindings,
  "public-safety-monitor": publicSafetyFindings,
  "recruiting-coordinator": recruitingFindings,
  "research-briefing": researchFindings,
  "sales-operations": salesOperationsFindings,
  "sports-team-watcher": sportsTeamWatchFindings,
  "stock-portfolio-monitor": stockPortfolioFindings,
  "vehicle-service-coordinator": vehicleServiceFindings,
  "work-chief-of-staff": workChiefOfStaffFindings,
};

export function validateArtifactSemantics(id, value) {
  const validate = validators[id];
  if (!validate) {
    throw new Error(`No semantic artifact validator is registered for ${id}.`);
  }
  return validate(value);
}
