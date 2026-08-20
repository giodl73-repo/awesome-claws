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

const validators = {
  "case-continuity-coordinator": caseContinuityFindings,
  "change-control-operator": changeControlFindings,
  "civic-data-analyst": civicDataFindings,
  "data-analyst": dataAnalysisFindings,
  "delegation-coordinator": delegationFindings,
  "financial-analyst": financialAnalysisFindings,
  "model-evaluation-adjudicator": modelEvaluationFindings,
  "project-manager": projectFindings,
  "product-manager": productFindings,
  "public-safety-monitor": publicSafetyFindings,
  "recruiting-coordinator": recruitingFindings,
  "research-briefing": researchFindings,
  "sales-operations": salesOperationsFindings,
};

export function validateArtifactSemantics(id, value) {
  const validate = validators[id];
  if (!validate) {
    throw new Error(`No semantic artifact validator is registered for ${id}.`);
  }
  return validate(value);
}
