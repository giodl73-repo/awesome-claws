import { createHash } from "node:crypto";
import { isSafePackagePath, portablePathKey } from "./portable-paths.mjs";

function hasUnnegatedNarrativeMatch(narrativeTexts, prohibitedNarrative) {
  const adjacentNegation =
    /\b(?:do not|does not|did not|is not|are not|was not|were not|not|no|never|without|cannot|can't|must not|mustn't|should not|shouldn't|will not|won't)\s*$/iu;
  const coordinatedNegation =
    /^\s*(?:(?:[A-Za-z0-9_-]+\s+){0,6})(?:,?\s*(?:and|or)\s*)$/iu;
  function hasUnnegatedMatch(clause) {
    let previousEnd = 0;
    let previousNegated = false;
    for (const match of clause.matchAll(prohibitedNarrative)) {
      const prefix = clause.slice(0, match.index);
      const connector = clause.slice(previousEnd, match.index);
      const negated =
        adjacentNegation.test(prefix) ||
        (previousNegated && coordinatedNegation.test(connector));
      if (!negated) {
        return true;
      }
      previousEnd = match.index + match[0].length;
      previousNegated = true;
    }
    return false;
  }

  return narrativeTexts.some((text) =>
    text
      .replaceAll("’", "'")
      .replace(/\s+/gu, " ")
      .split(
        /[.!?]\s*|\s*[;:]\s*|\s*,?\s*\b(?:but|however|yet|although|despite|nevertheless|nonetheless|still|even though)\b\s*/iu,
      )
      .some((clause) => hasUnnegatedMatch(clause)),
  );
}

function hasUnsafePublicHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  if (
    /^(?:localhost(?:\.localdomain)?|.+\.localhost|0(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|127(?:\.\d{1,3}){3}|169\.254(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2}|::1|f[cd][0-9a-f:]*|fe[89ab][0-9a-f:]*)$/u.test(
      host,
    )
  ) {
    return true;
  }
  const match = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/u.exec(host);
  return match !== null && Number(match[1]) >= 16 && Number(match[1]) <= 31;
}

function isCredentialFreePublicHttpsReference(reference) {
  const unsafeQueryKeys =
    /^(?:access[_-]?token|api[_-]?key|auth|code|credential|key|password|secret|token)$/iu;
  const unsafeQuery =
    [...reference.searchParams.keys()].some((key) => unsafeQueryKeys.test(key)) ||
    [...reference.searchParams.values()].some((value) =>
      /\b(?:access[_-]?token|api[_-]?key|auth|credential|password|secret|token)\s*[:=]/iu.test(
        value,
      ),
    );
  return (
    reference.protocol === "https:" &&
    !reference.username &&
    !reference.password &&
    !reference.hash &&
    !hasUnsafePublicHost(reference.hostname) &&
    !unsafeQuery
  );
}

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

function documentIntakeFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const outputIds = value.outputs.map((item) => item.id);
  const findingIds = value.findings.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const outputSet = new Set(outputIds);
  const findingSet = new Set(findingIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(outputIds, "outputs", "Output id"),
    ...uniqueFindings(
      value.outputs.map((item) => portablePathKey(item.path)),
      "outputs",
      "Portable output path",
    ),
    ...uniqueFindings(findingIds, "findings", "Finding id"),
    ...uniqueFindings(
      value.reviewQuestions.map((item) => item.id),
      "reviewQuestions",
      "Review question id",
    ),
  ];

  for (const [index, source] of value.sources.entries()) {
    const external = source.processingAuthorization === "external-approved";
    if (
      (external &&
        (typeof source.provider !== "string" || !source.provider.trim())) ||
      (!external && source.provider !== null)
    ) {
      findings.push(
        finding(
          "incoherent_provider_authority",
          `sources.${index}.provider`,
          "Only externally approved processing may name a provider, and approved external processing must name one.",
        ),
      );
    }
    if (
      value.intake.processingBoundary === "local-only" &&
      source.processingAuthorization === "external-approved"
    ) {
      findings.push(
        finding(
          "processing_boundary_violation",
          `sources.${index}.processingAuthorization`,
          "A local-only intake cannot authorize external processing.",
        ),
      );
    }
    const sourceOutputs = value.outputs.filter(
      (output) => output.sourceRef === source.id,
    );
    if (source.state !== "excluded" && sourceOutputs.length === 0) {
      findings.push(
        finding(
          "missing_source_output",
          `sources.${index}.state`,
          "Every non-excluded source requires a source-linked output record.",
        ),
      );
    }
    if (
      ["converted", "review-needed"].includes(source.state) &&
      !sourceOutputs.some((output) => output.conversionState !== "not-produced")
    ) {
      findings.push(
        finding(
          "missing_produced_output",
          `sources.${index}.state`,
          "Every converted or review-needed source requires a produced normalized output.",
        ),
      );
    }
  }

  for (const [index, output] of value.outputs.entries()) {
    findings.push(
      ...referenceFindings(
        [output.sourceRef],
        sourceSet,
        `outputs.${index}.sourceRef`,
        "Source reference",
      ),
    );
    const source = sourceById.get(output.sourceRef);
    if (
      !isSafePackagePath(output.path) ||
      !output.path.startsWith("outputs/")
    ) {
      findings.push(
        finding(
          "unsafe_output_path",
          `outputs.${index}.path`,
          "Normalized output paths must remain inside outputs/ without empty or traversal segments.",
        ),
      );
    }
    if (
      output.processingMode === "external" &&
      source?.processingAuthorization !== "external-approved"
    ) {
      findings.push(
        finding(
          "unauthorized_processing",
          `outputs.${index}.processingMode`,
          "External conversion requires explicit source-level external approval.",
        ),
      );
    }
    if (
      output.processingMode === "external" &&
      value.intake.processingBoundary === "local-only"
    ) {
      findings.push(
        finding(
          "processing_boundary_violation",
          `outputs.${index}.processingMode`,
          "A local-only intake cannot contain externally processed outputs.",
        ),
      );
    }
    if (
      (output.conversionState === "not-produced" &&
        (output.processingMode !== "none" ||
          output.fidelityState !== "blocked" ||
          output.reviewState !== "blocked")) ||
      (output.conversionState !== "not-produced" &&
        output.processingMode === "none")
    ) {
      findings.push(
        finding(
          "incoherent_conversion_state",
          `outputs.${index}.conversionState`,
          "Not-produced outputs must use no processing and blocked fidelity/review states; produced outputs require a processing mode.",
        ),
      );
    }
    if (output.originalState !== "unchanged") {
      findings.push(
        finding(
          "original_not_preserved",
          `outputs.${index}.originalState`,
          "Every normalized output must record that its original source remained unchanged.",
        ),
      );
    }
    if (
      source &&
      ["blocked", "excluded"].includes(source.state) &&
      output.conversionState !== "not-produced"
    ) {
      findings.push(
        finding(
          "output_from_unprocessed_source",
          `outputs.${index}.conversionState`,
          "Blocked or excluded sources cannot have a produced normalized output.",
        ),
      );
    }
    const outputFindings = value.findings.filter(
      (item) => item.outputRef === output.id,
    );
    const unresolvedOutputFindings = outputFindings.filter(
      (item) => item.state !== "resolved",
    );
    if (
      output.fidelityState === "sampled-with-exceptions" &&
      (output.limitations.length === 0 || outputFindings.length === 0)
    ) {
      findings.push(
        finding(
          "missing_fidelity_exception",
          `outputs.${index}.fidelityState`,
          "Sampled outputs with exceptions require explicit limitations and linked findings.",
        ),
      );
    }
    if (
      output.conversionState === "partial" &&
      (output.limitations.length === 0 ||
        outputFindings.length === 0 ||
        output.fidelityState !== "sampled-with-exceptions" ||
        !["needs-review", "blocked"].includes(output.reviewState))
    ) {
      findings.push(
        finding(
          "unsupported_partial_output",
          `outputs.${index}.conversionState`,
          "Partial outputs require explicit limitations, linked findings, exception fidelity, and a non-ready review state.",
        ),
      );
    }
    if (
      output.reviewState === "ready" &&
      output.fidelityState !== "sampled-pass"
    ) {
      findings.push(
        finding(
          "unsupported_ready_output",
          `outputs.${index}.reviewState`,
          "Ready outputs require sampled-pass fidelity.",
        ),
      );
    }
    if (
      unresolvedOutputFindings.length > 0 &&
      (output.fidelityState !== "sampled-with-exceptions" ||
        !["needs-review", "blocked"].includes(output.reviewState))
    ) {
      findings.push(
        finding(
          "unresolved_fidelity_claim",
          `outputs.${index}.fidelityState`,
          "Outputs with unresolved findings must retain exception fidelity and a non-ready review state.",
        ),
      );
    }
  }

  for (const [index, item] of value.findings.entries()) {
    findings.push(
      ...referenceFindings(
        [item.outputRef],
        outputSet,
        `findings.${index}.outputRef`,
        "Output reference",
      ),
      ...uniqueFindings(
        item.sourceRefs,
        `findings.${index}.sourceRefs`,
        "Source reference",
      ),
      ...referenceFindings(
        item.sourceRefs,
        sourceSet,
        `findings.${index}.sourceRefs`,
        "Source reference",
      ),
    );
    const output = value.outputs.find((candidate) => candidate.id === item.outputRef);
    if (output && !item.sourceRefs.includes(output.sourceRef)) {
      findings.push(
        finding(
          "finding_source_mismatch",
          `findings.${index}.sourceRefs`,
          "A fidelity finding must include the source linked to its output.",
        ),
      );
    }
  }

  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(
        question.sourceRefs,
        `reviewQuestions.${index}.sourceRefs`,
        "Source reference",
      ),
      ...referenceFindings(
        question.sourceRefs,
        sourceSet,
        `reviewQuestions.${index}.sourceRefs`,
        "Source reference",
      ),
      ...uniqueFindings(
        question.outputRefs,
        `reviewQuestions.${index}.outputRefs`,
        "Output reference",
      ),
      ...referenceFindings(
        question.outputRefs,
        outputSet,
        `reviewQuestions.${index}.outputRefs`,
        "Output reference",
      ),
    );
    for (const outputRef of question.outputRefs) {
      const output = value.outputs.find((item) => item.id === outputRef);
      if (output && !question.sourceRefs.includes(output.sourceRef)) {
        findings.push(
          finding(
            "review_source_mismatch",
            `reviewQuestions.${index}.sourceRefs`,
            "Every reviewed output must be paired with its own source reference.",
          ),
        );
      }
    }
  }

  findings.push(
    ...uniqueFindings(
      value.handoff.outputRefs,
      "handoff.outputRefs",
      "Output reference",
    ),
    ...referenceFindings(
      value.handoff.outputRefs,
      outputSet,
      "handoff.outputRefs",
      "Output reference",
    ),
    ...uniqueFindings(
      value.handoff.blockingFindingRefs,
      "handoff.blockingFindingRefs",
      "Finding reference",
    ),
    ...referenceFindings(
      value.handoff.blockingFindingRefs,
      findingSet,
      "handoff.blockingFindingRefs",
      "Finding reference",
    ),
  );

  const unresolvedHighFindings = value.findings
    .filter((item) => item.severity === "high" && item.state !== "resolved")
    .map((item) => item.id);
  if (
    unresolvedHighFindings.some(
      (id) => !value.handoff.blockingFindingRefs.includes(id),
    )
  ) {
    findings.push(
      finding(
        "missing_blocking_finding",
        "handoff.blockingFindingRefs",
        "Every unresolved high-severity fidelity finding must block the handoff.",
      ),
    );
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    (value.sources.some((item) =>
      ["blocked", "review-needed"].includes(item.state),
    ) ||
      unresolvedHighFindings.length > 0 ||
      value.outputs.some((item) =>
        item.conversionState === "not-produced" ||
        ["unreviewed", "blocked"].includes(item.fidelityState) ||
        item.reviewState === "blocked",
      ))
  ) {
    findings.push(
      finding(
        "unsupported_ready_state",
        "handoff.state",
        "Owner-ready document intake requires no unresolved high-severity findings or unreviewed outputs.",
      ),
    );
  }
  const producedOutputIds = value.outputs
    .filter((item) => item.conversionState !== "not-produced")
    .map((item) => item.id);
  if (
    value.handoff.state === "ready-for-owner-review" &&
    producedOutputIds.some((id) => !value.handoff.outputRefs.includes(id))
  ) {
    findings.push(
      finding(
        "incomplete_handoff",
        "handoff.outputRefs",
        "Owner-ready handoffs must include every produced normalized output.",
      ),
    );
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.handoff.blockingFindingRefs.length > 0
  ) {
    findings.push(
      finding(
        "ready_with_blockers",
        "handoff.blockingFindingRefs",
        "Owner-ready handoffs cannot retain blocking findings.",
      ),
    );
  }
  if (
    value.handoff.blockingFindingRefs.some(
      (id) => value.findings.find((item) => item.id === id)?.state === "resolved",
    )
  ) {
    findings.push(
      finding(
        "resolved_blocking_finding",
        "handoff.blockingFindingRefs",
        "Resolved findings cannot remain handoff blockers.",
      ),
    );
  }

  const requiredActions = [
    "overwrite-original",
    "delete-source",
    "external-processing",
    "upload-source",
    "publish-output",
    "share-output",
    "change-permissions",
    "claim-perfect-fidelity",
  ];
  for (const action of requiredActions) {
    if (
      !value.blockedActions.includes(action) ||
      !value.handoff.prohibitedActions.includes(action)
    ) {
      findings.push(
        finding(
          "missing_authority_gate",
          "blockedActions",
          `Document intake must keep ${action} explicitly prohibited.`,
        ),
      );
    }
  }
  const mutationPattern =
    /\b(?:overwrites?|overwrote|overwritten|replaces?|replaced|modif(?:y|ies|ied)|edits?|edited|alters?|altered|deletes?|deleted|redacts?|redacted|truncates?|truncated|sanitizes?|sanitized)\b/iu;
  const originalPattern = /\boriginals?\b/iu;
  const actionProseStatements = [
    ...value.outputs.flatMap((item) => [
      item.conversionMethod,
      ...item.limitations,
    ]),
    ...value.findings.map((item) => item.description),
    ...value.reviewQuestions.map((item) => item.reason),
  ];
  const mutationStatements = [
    ...actionProseStatements,
    ...value.reviewQuestions.map((item) => item.question),
  ];
  if (
    mutationStatements.some(
      (statement) =>
        originalPattern.test(statement) && mutationPattern.test(statement),
    )
  ) {
    findings.push(
      finding(
        "external_action_content",
        "reviewQuestions",
        "Document-intake artifacts must not instruct external processing, file mutation, publication, or sharing.",
      ),
    );
  }
  const actionVerb =
    String.raw`(?:uploads?|publishes?|shares?|deletes?|overwrites?|replaces?|sends?|changes?\s+(?:the\s+)?permissions?|process(?:es|ed|ing)?\b[^.!?]{0,40}\bexternally|externally\b[^.!?]{0,40}\bprocess(?:es|ed|ing)?|claims?\s+(?:perfect|lossless)\s+fidelity)`;
  const unsupportedFidelityPattern = /\b(?:perfect|lossless)\s+fidelity\b/iu;
  const directActionPattern =
    new RegExp(
      String.raw`^(?:(?:please|must|need to|you (?:should|must|need to)|the agent (?:should|must|needs to))\s+)?${actionVerb}\b`,
      "iu",
    );
  const actionOccurrencePattern =
    /\b(?:uploads?|publishes?|shares?|deletes?|overwrites?|replaces?|sends?)\b|\bchanges?\s+(?:the\s+)?permissions?\b|\bprocess(?:es|ed|ing)?\b(?=[^.!?]{0,40}\bexternally\b)|\bexternally\b(?=[^.!?]{0,40}\bprocess(?:es|ed|ing)?\b)|\bclaims?\b(?=[^.!?]{0,20}\b(?:perfect|lossless)\s+fidelity\b)/giu;
  const mandatoryActionPattern = new RegExp(
    String.raw`\b(?:must|needs? to|should)\b[^.!?]{0,60}\b${actionVerb}\b`,
    "iu",
  );
  const normalizedOwner = value.handoff.owner
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, " ")
    .trim();
  const ownerQuestionPrefix = /^(?:should|can|may|will)\b/iu;
  const ownerActorPattern = new RegExp(
    String.raw`^(?:should|can|may|will) (?:the )?${normalizedOwner.replaceAll(" ", String.raw`\s+`)} ${actionVerb}\b`,
    "iu",
  );
  const actionStatements = [
    ...actionProseStatements.map((statement) => ({
      statement,
      question: false,
    })),
    ...value.reviewQuestions.map((item) => ({
      statement: item.question,
      question: true,
    })),
  ];
  if (
    actionStatements.some(({ statement, question }) =>
      statement
        .split(/[.!?]\s*/u)
        .flatMap((sentence) =>
          sentence.split(
            /(?:\s*[,;:]\s*|\s+(?:and|but|or|yet)\s+)(?=(?:should|can|may|will)\b)/iu,
          ),
        )
        .some((sentence) => {
          const trimmed = sentence.trim();
          const normalized = trimmed
            .toLowerCase()
            .replaceAll(/[^a-z0-9]+/gu, " ")
            .trim();
          const actionCount = [
            ...normalized.matchAll(actionOccurrencePattern),
          ].length;
          const ownerGated =
            question &&
            actionCount === 1 &&
            ownerQuestionPrefix.test(trimmed) &&
            ownerActorPattern.test(normalized);
          return (
            (!question && unsupportedFidelityPattern.test(trimmed)) ||
            (!ownerGated &&
              (directActionPattern.test(trimmed) ||
                mandatoryActionPattern.test(trimmed)))
          );
        }),
    )
  ) {
    findings.push(
      finding(
        "external_action_content",
        "reviewQuestions",
        "Document-intake artifacts must not instruct external processing, file mutation, publication, or sharing.",
      ),
    );
  }
  if (
    /^(?:the )?(?:agent|assistant|claw)$/u.test(normalizedOwner) ||
    /(?:^| )document intake (?:analyst|assistant|bot)(?: |$)/u.test(
      normalizedOwner,
    ) ||
    /(?:^| )(?:ai|gpt|bot|language model)(?: |$)/u.test(normalizedOwner) ||
    /(?:^| )(?:automation|automated|ai) (?:agent|assistant)(?: |$)/u.test(
      normalizedOwner,
    )
  ) {
    findings.push(
      finding(
        "agent_owned_authority",
        "handoff.owner",
        "Processing, source mutation, disclosure, and fidelity acceptance must remain with the named owner.",
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

function personalArchiveFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const itemIds = value.items.map((item) => item.id);
  const collectionIds = value.collections.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const itemSet = new Set(itemIds);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(itemIds, "items", "Archive item id"),
    ...uniqueFindings(collectionIds, "collections", "Collection id"),
    ...uniqueFindings(value.duplicates.map((item) => item.id), "duplicates", "Duplicate id"),
    ...uniqueFindings(value.retrievalCues.map((item) => item.id), "retrievalCues", "Retrieval cue id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, item] of value.items.entries()) {
    findings.push(
      ...uniqueFindings(item.sourceRefs, `items.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `items.${index}.sourceRefs`, "Source reference"),
    );
    if (
      ["sensitive", "location-sensitive", "account-sensitive", "face-sensitive", "valuable-sensitive"].includes(item.privacy) &&
      item.pathDisclosure === "owner-visible-path"
    ) {
      findings.push(finding("private_path_disclosure", `items.${index}.pathDisclosure`, "Sensitive archive items cannot expose owner-visible paths in general handoffs."));
    }
    if (["photo", "memory"].includes(item.kind) && item.retentionState !== "do-not-delete") {
      findings.push(finding("unsafe_retention_state", `items.${index}.retentionState`, "Photo and memory archive items require do-not-delete retention until the owner reviews them."));
    }
  }
  for (const [index, collection] of value.collections.entries()) {
    findings.push(
      ...uniqueFindings(collection.itemRefs, `collections.${index}.itemRefs`, "Archive item reference"),
      ...referenceFindings(collection.itemRefs, itemSet, `collections.${index}.itemRefs`, "Archive item reference"),
    );
  }
  for (const [index, duplicate] of value.duplicates.entries()) {
    findings.push(
      ...uniqueFindings(duplicate.itemRefs, `duplicates.${index}.itemRefs`, "Archive item reference"),
      ...referenceFindings(duplicate.itemRefs, itemSet, `duplicates.${index}.itemRefs`, "Archive item reference"),
    );
    if (duplicate.action !== "owner-review") {
      findings.push(finding("unsupported_duplicate_action", `duplicates.${index}.action`, "Duplicate findings must remain owner-review only and cannot authorize cleanup."));
    }
  }
  for (const [index, cue] of value.retrievalCues.entries()) {
    findings.push(
      ...uniqueFindings(cue.itemRefs, `retrievalCues.${index}.itemRefs`, "Archive item reference"),
      ...referenceFindings(cue.itemRefs, itemSet, `retrievalCues.${index}.itemRefs`, "Archive item reference"),
      ...uniqueFindings(cue.sourceRefs, `retrievalCues.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(cue.sourceRefs, sourceSet, `retrievalCues.${index}.sourceRefs`, "Source reference"),
    );
    const hasSupportedNeedSource = cue.sourceRefs.some((ref) => {
      const source = value.sources.find((item) => item.id === ref);
      return source && (
        (cue.need === "receipt" && source.kind === "receipt-list") ||
        (cue.need === "warranty" && ["warranty-record", "receipt-list"].includes(source.kind)) ||
        (cue.need === "photo" && source.kind === "photo-description") ||
        (cue.need === "memory" && source.kind === "owner-memory-note") ||
        !["receipt", "warranty", "photo", "memory"].includes(cue.need)
      );
    });
    if (!hasSupportedNeedSource) {
      findings.push(finding("unsupported_retrieval_source", `retrievalCues.${index}.sourceRefs`, "Retrieval cues require source evidence matching the retrieval need."));
    }
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.itemRefs, `reviewQuestions.${index}.itemRefs`, "Archive item reference"),
      ...referenceFindings(question.itemRefs, itemSet, `reviewQuestions.${index}.itemRefs`, "Archive item reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready archive indexes cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    collections: value.collections.map(({ proposedFolder, rationale }) => ({ proposedFolder, rationale })),
    duplicates: value.duplicates.map(({ reason, action }) => ({ reason, action })),
    retrievalCues: value.retrievalCues.map(({ cue }) => cue),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(delete|rename|upload|publish|change permissions|train memory|face recognition|identify faces|infer|private path|exact path|full path|move file|move files|share file|share files)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Archive artifacts must not instruct file mutation, sharing, upload, memory training, face recognition, private path exposure, or sensitive inference."));
  }
  if (value.handoff.owner === "personal-archive-curator") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Archive deletion, movement, sharing, upload, permission, memory, biometric, and sensitive-inference decisions must remain with the named owner."));
  }
  return findings;
}

function restaurantVenueFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const venueIds = value.venues.map((item) => item.id);
  const constraintIds = value.constraints.map((item) => item.id);
  const availabilityIds = value.availability.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const venueSet = new Set(venueIds);
  const constraintSet = new Set(constraintIds);
  const availabilitySet = new Set(availabilityIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const availabilityById = new Map(value.availability.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(venueIds, "venues", "Venue id"),
    ...uniqueFindings(constraintIds, "constraints", "Constraint id"),
    ...uniqueFindings(availabilityIds, "availability", "Availability id"),
    ...uniqueFindings(value.shortlist.map((item) => item.id), "shortlist", "Shortlist id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, venue] of value.venues.entries()) {
    findings.push(
      ...uniqueFindings(venue.sourceRefs, `venues.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(venue.sourceRefs, sourceSet, `venues.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, constraint] of value.constraints.entries()) {
    findings.push(
      ...uniqueFindings(constraint.sourceRefs, `constraints.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(constraint.sourceRefs, sourceSet, `constraints.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, row] of value.availability.entries()) {
    findings.push(
      ...referenceFindings([row.venueRef], venueSet, `availability.${index}.venueRef`, "Venue reference"),
      ...uniqueFindings(row.sourceRefs, `availability.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(row.sourceRefs, sourceSet, `availability.${index}.sourceRefs`, "Source reference"),
    );
    const hasSupportedSource = row.sourceRefs.some((ref) =>
      ["official-page", "menu", "reservation-page", "accessibility-note", "dietary-note"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasSupportedSource) {
      findings.push(finding("unsupported_availability_source", `availability.${index}.sourceRefs`, "Venue availability requires official, menu, reservation, dietary, or accessibility evidence."));
    }
  }
  for (const [index, pick] of value.shortlist.entries()) {
    findings.push(
      ...referenceFindings([pick.venueRef], venueSet, `shortlist.${index}.venueRef`, "Venue reference"),
      ...referenceFindings([pick.availabilityRef], availabilitySet, `shortlist.${index}.availabilityRef`, "Availability reference"),
      ...uniqueFindings(pick.constraintRefs, `shortlist.${index}.constraintRefs`, "Constraint reference"),
      ...referenceFindings(pick.constraintRefs, constraintSet, `shortlist.${index}.constraintRefs`, "Constraint reference"),
    );
    const availability = availabilityById.get(pick.availabilityRef);
    if (availability && availability.venueRef !== pick.venueRef) {
      findings.push(finding("availability_venue_mismatch", `shortlist.${index}.availabilityRef`, "Shortlist availability must belong to the same venue."));
    }
    const requiredConstraints = value.constraints.filter((constraint) => constraint.required);
    const missingRequired = requiredConstraints.some((constraint) => !pick.constraintRefs.includes(constraint.id));
    if (
      pick.state === "recommended" &&
      (!availability ||
        missingRequired ||
        availability.hoursState !== "open-in-window" ||
        !["slot-visible", "walk-in-only"].includes(availability.reservationState) ||
        availability.dietaryState !== "supported" ||
        availability.accessibilityState !== "supported")
    ) {
      findings.push(finding("unsupported_recommendation", `shortlist.${index}`, "Recommended venues require current open-window, dietary, accessibility, and required-constraint support."));
    }
    if (
      (pick.state === "blocked" && !pick.blockedReason) ||
      (pick.state !== "blocked" && pick.blockedReason !== null)
    ) {
      findings.push(finding("incoherent_blocked_state", `shortlist.${index}.blockedReason`, "Only blocked venue shortlist items may carry a blocked reason."));
    }
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.venueRefs, `reviewQuestions.${index}.venueRefs`, "Venue reference"),
      ...referenceFindings(question.venueRefs, venueSet, `reviewQuestions.${index}.venueRefs`, "Venue reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready venue shortlists cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    shortlist: value.shortlist.map(({ fitReason, blockedReason }) => ({ fitReason, blockedReason })),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(reserve|make a reservation|book|join waitlist|order|pay|tip|message|call|calendar|post review|leave review|share location|allergen safe|allergy safe|guaranteed accessible)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Venue artifacts must not instruct reservations, orders, payments, messages, calls, calendar edits, review posting, location sharing, or unsupported dietary/accessibility certainty."));
  }
  if (value.handoff.owner === "restaurant-venue-scout") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Reservation, ordering, payment, messaging, calendar, location-sharing, and review-posting decisions must remain with the named owner."));
  }
  return findings;
}

function localEventsFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const venueIds = value.venues.map((item) => item.id);
  const constraintIds = value.constraints.map((item) => item.id);
  const eventIds = value.events.map((item) => item.id);
  const ticketingIds = value.ticketing.map((item) => item.id);
  const conflictIds = value.conflicts.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const venueSet = new Set(venueIds);
  const constraintSet = new Set(constraintIds);
  const eventSet = new Set(eventIds);
  const ticketingSet = new Set(ticketingIds);
  const conflictSet = new Set(conflictIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const eventById = new Map(value.events.map((item) => [item.id, item]));
  const ticketingById = new Map(value.ticketing.map((item) => [item.id, item]));
  const conflictById = new Map(value.conflicts.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(venueIds, "venues", "Venue id"),
    ...uniqueFindings(constraintIds, "constraints", "Constraint id"),
    ...uniqueFindings(eventIds, "events", "Event id"),
    ...uniqueFindings(ticketingIds, "ticketing", "Ticketing id"),
    ...uniqueFindings(conflictIds, "conflicts", "Conflict id"),
    ...uniqueFindings(value.watchlist.map((item) => item.id), "watchlist", "Watchlist id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, venue] of value.venues.entries()) {
    findings.push(
      ...uniqueFindings(venue.sourceRefs, `venues.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(venue.sourceRefs, sourceSet, `venues.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, constraint] of value.constraints.entries()) {
    findings.push(
      ...uniqueFindings(constraint.sourceRefs, `constraints.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(constraint.sourceRefs, sourceSet, `constraints.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, event] of value.events.entries()) {
    findings.push(
      ...referenceFindings([event.venueRef], venueSet, `events.${index}.venueRef`, "Venue reference"),
      ...uniqueFindings(event.sourceRefs, `events.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(event.sourceRefs, sourceSet, `events.${index}.sourceRefs`, "Source reference"),
    );
    const hasSupportedSource = event.sourceRefs.some((ref) =>
      ["official-event-page", "venue-page", "calendar-listing", "community-feed", "school-notice", "accessibility-note"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasSupportedSource) {
      findings.push(finding("unsupported_event_source", `events.${index}.sourceRefs`, "Event facts require official, venue, calendar, community, school, or accessibility evidence."));
    }
  }
  for (const [index, row] of value.ticketing.entries()) {
    findings.push(
      ...referenceFindings([row.eventRef], eventSet, `ticketing.${index}.eventRef`, "Event reference"),
      ...uniqueFindings(row.sourceRefs, `ticketing.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(row.sourceRefs, sourceSet, `ticketing.${index}.sourceRefs`, "Source reference"),
    );
    const hasTicketingSource = row.sourceRefs.some((ref) =>
      ["official-event-page", "ticketing-page", "venue-page", "community-feed", "school-notice"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasTicketingSource) {
      findings.push(finding("unsupported_ticketing_source", `ticketing.${index}.sourceRefs`, "Ticketing state requires official, ticketing, venue, community, or school evidence."));
    }
  }
  for (const [index, row] of value.conflicts.entries()) {
    findings.push(
      ...referenceFindings([row.eventRef], eventSet, `conflicts.${index}.eventRef`, "Event reference"),
      ...uniqueFindings(row.sourceRefs, `conflicts.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(row.sourceRefs, sourceSet, `conflicts.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, item] of value.watchlist.entries()) {
    findings.push(
      ...referenceFindings([item.eventRef], eventSet, `watchlist.${index}.eventRef`, "Event reference"),
      ...referenceFindings([item.ticketingRef], ticketingSet, `watchlist.${index}.ticketingRef`, "Ticketing reference"),
      ...referenceFindings([item.conflictRef], conflictSet, `watchlist.${index}.conflictRef`, "Conflict reference"),
      ...uniqueFindings(item.constraintRefs, `watchlist.${index}.constraintRefs`, "Constraint reference"),
      ...referenceFindings(item.constraintRefs, constraintSet, `watchlist.${index}.constraintRefs`, "Constraint reference"),
    );
    const event = eventById.get(item.eventRef);
    const ticketing = ticketingById.get(item.ticketingRef);
    const conflict = conflictById.get(item.conflictRef);
    if (ticketing && ticketing.eventRef !== item.eventRef) {
      findings.push(finding("ticketing_event_mismatch", `watchlist.${index}.ticketingRef`, "Watchlist ticketing must belong to the same event."));
    }
    if (conflict && conflict.eventRef !== item.eventRef) {
      findings.push(finding("conflict_event_mismatch", `watchlist.${index}.conflictRef`, "Watchlist conflict must belong to the same event."));
    }
    const requiredConstraints = value.constraints.filter((constraint) => constraint.required);
    const missingRequired = requiredConstraints.some((constraint) => !item.constraintRefs.includes(constraint.id));
    if (
      item.state === "recommended" &&
      (!event ||
        !ticketing ||
        !conflict ||
        missingRequired ||
        !["available", "limited", "free"].includes(ticketing.availabilityState) ||
        !["inside-budget", "free"].includes(ticketing.priceState) ||
        event.ageFit !== "supported" ||
        event.accessibilityState !== "supported" ||
        conflict.state !== "clear")
    ) {
      findings.push(finding("unsupported_recommendation", `watchlist.${index}`, "Recommended events require current availability, budget, age-fit, accessibility, conflict, and required-constraint support."));
    }
    if (
      (item.state === "blocked" && !item.blockedReason) ||
      (item.state !== "blocked" && item.blockedReason !== null)
    ) {
      findings.push(finding("incoherent_blocked_state", `watchlist.${index}.blockedReason`, "Only blocked event watchlist items may carry a blocked reason."));
    }
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.eventRefs, `reviewQuestions.${index}.eventRefs`, "Event reference"),
      ...referenceFindings(question.eventRefs, eventSet, `reviewQuestions.${index}.eventRefs`, "Event reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready event watchlists cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    watchlist: value.watchlist.map(({ fitReason, blockedReason }) => ({ fitReason, blockedReason })),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(buy tickets?|purchase tickets?|join waitlist|rsvp|contact venue|message|invite|arrange ride|pay|edit calendar|modify calendar|calendar edit|share location|post publicly|public post|age safe|safe for kids|guaranteed accessible)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Event artifacts must not instruct ticket purchases, waitlists, RSVPs, venue contact, messages, rides, payments, calendar edits, location sharing, public posting, or unsupported age/accessibility certainty."));
  }
  if (value.handoff.owner === "local-events-watcher") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Ticketing, waitlist, RSVP, contact, ride, calendar, location-sharing, and posting decisions must remain with the named owner."));
  }
  return findings;
}

function neighborhoodOperationsFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const zoneIds = value.zones.map((item) => item.id);
  const noticeIds = value.notices.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const zoneSet = new Set(zoneIds);
  const noticeSet = new Set(noticeIds);
  const questionSet = new Set(value.reviewQuestions.map((item) => item.id));
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(zoneIds, "zones", "Zone id"),
    ...uniqueFindings(noticeIds, "notices", "Notice id"),
    ...uniqueFindings(value.schedules.map((item) => item.id), "schedules", "Schedule id"),
    ...uniqueFindings(value.routineImpacts.map((item) => item.id), "routineImpacts", "Routine impact id"),
    ...uniqueFindings(value.conflicts.map((item) => item.id), "conflicts", "Conflict id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, zone] of value.zones.entries()) {
    findings.push(
      ...uniqueFindings(zone.sourceRefs, `zones.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(zone.sourceRefs, sourceSet, `zones.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, notice] of value.notices.entries()) {
    findings.push(
      ...uniqueFindings(notice.zoneRefs, `notices.${index}.zoneRefs`, "Zone reference"),
      ...referenceFindings(notice.zoneRefs, zoneSet, `notices.${index}.zoneRefs`, "Zone reference"),
      ...uniqueFindings(notice.sourceRefs, `notices.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(notice.sourceRefs, sourceSet, `notices.${index}.sourceRefs`, "Source reference"),
    );
    const supported = notice.sourceRefs.some((ref) =>
      ["public-works-page", "city-notice", "utility-notice", "waste-calendar", "road-map", "permit-page", "meeting-agenda", "school-board-notice", "transit-notice", "hoa-newsletter", "owner-note"].includes(sourceById.get(ref)?.kind),
    );
    if (!supported) {
      findings.push(finding("unsupported_notice_source", `notices.${index}.sourceRefs`, "Neighborhood notices require public works, city, utility, waste, road, permit, agenda, transit, HOA, school-board, or owner evidence."));
    }
  }
  for (const [index, schedule] of value.schedules.entries()) {
    findings.push(
      ...referenceFindings([schedule.noticeRef], noticeSet, `schedules.${index}.noticeRef`, "Notice reference"),
      ...uniqueFindings(schedule.sourceRefs, `schedules.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(schedule.sourceRefs, sourceSet, `schedules.${index}.sourceRefs`, "Source reference"),
    );
    if (Date.parse(schedule.endsAt) <= Date.parse(schedule.startsAt)) {
      findings.push(finding("invalid_time_range", `schedules.${index}.endsAt`, "Neighborhood schedules must end after they start."));
    }
    if (schedule.certainty === "confirmed" && schedule.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_certainty", `schedules.${index}.sourceRefs`, "Confirmed schedules require current source evidence."));
    }
  }
  for (const [collectionName, collection] of [
    ["routineImpacts", value.routineImpacts],
    ["conflicts", value.conflicts],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.noticeRefs, `${collectionName}.${index}.noticeRefs`, "Notice reference"),
        ...referenceFindings(item.noticeRefs, noticeSet, `${collectionName}.${index}.noticeRefs`, "Notice reference"),
        ...uniqueFindings(item.sourceRefs, `${collectionName}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${collectionName}.${index}.sourceRefs`, "Source reference"),
      );
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, questionSet, "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready neighborhood ledgers cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    notices: value.notices.map(({ title }) => title),
    impacts: value.routineImpacts.map(({ routine, impact }) => ({ routine, impact })),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(file complaint|call agency|call city|contact utility|submit permit|post publicly|public post|message neighbor|edit calendar|modify calendar|change account|pay bill|request service|report issue|share address|legal claim|legal advice|emergency advice|safe area|area is safe|ignore emergency)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Neighborhood artifacts must not instruct complaints, calls, submissions, utility contact, public posts, neighbor messages, account/payment changes, calendar edits, service requests, address disclosure, legal claims, emergency advice, or safety certainty."));
  }
  if (value.handoff.owner === "neighborhood-operations-watcher") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Neighborhood operations, disclosure, account, contact, submission, and safety decisions must remain with the named owner."));
  }
  return findings;
}

function schoolCoordinatorFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const studentIds = value.students.map((item) => item.id);
  const itemIds = value.items.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const studentSet = new Set(studentIds);
  const itemSet = new Set(itemIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(studentIds, "students", "Student id"),
    ...uniqueFindings(itemIds, "items", "Item id"),
    ...uniqueFindings(value.accommodations.map((item) => item.id), "accommodations", "Accommodation id"),
    ...uniqueFindings(value.conflicts.map((item) => item.id), "conflicts", "Conflict id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, student] of value.students.entries()) {
    findings.push(
      ...uniqueFindings(student.sourceRefs, `students.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(student.sourceRefs, sourceSet, `students.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, item] of value.items.entries()) {
    findings.push(
      ...referenceFindings([item.studentRef], studentSet, `items.${index}.studentRef`, "Student reference"),
      ...uniqueFindings(item.sourceRefs, `items.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `items.${index}.sourceRefs`, "Source reference"),
    );
    const hasSupportedSource = item.sourceRefs.some((ref) =>
      ["lms-export", "assignment-page", "teacher-note", "school-calendar", "form", "supply-list", "handbook", "portal-screenshot", "guardian-note"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasSupportedSource) {
      findings.push(finding("unsupported_school_source", `items.${index}.sourceRefs`, "School items require LMS, assignment, teacher, calendar, form, supply, handbook, portal, or guardian evidence."));
    }
    if (
      item.state !== "blocked" &&
      item.kind !== "supply" &&
      item.dueAt === null
    ) {
      findings.push(finding("unsupported_ready_state", `items.${index}.dueAt`, "Non-supply school items need a due date before leaving blocked or unknown state."));
    }
    if (
      (item.state === "blocked" && !item.blockedReason) ||
      (item.state !== "blocked" && item.blockedReason !== null)
    ) {
      findings.push(finding("incoherent_blocked_state", `items.${index}.blockedReason`, "Only blocked school items may carry a blocked reason."));
    }
  }
  for (const [index, accommodation] of value.accommodations.entries()) {
    findings.push(
      ...referenceFindings([accommodation.studentRef], studentSet, `accommodations.${index}.studentRef`, "Student reference"),
      ...uniqueFindings(accommodation.itemRefs, `accommodations.${index}.itemRefs`, "Item reference"),
      ...referenceFindings(accommodation.itemRefs, itemSet, `accommodations.${index}.itemRefs`, "Item reference"),
      ...uniqueFindings(accommodation.sourceRefs, `accommodations.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(accommodation.sourceRefs, sourceSet, `accommodations.${index}.sourceRefs`, "Source reference"),
    );
    const supported = accommodation.sourceRefs.some((ref) =>
      ["accommodation-note", "guardian-note", "teacher-note", "handbook"].includes(sourceById.get(ref)?.kind),
    );
    if (accommodation.state === "supported" && !supported) {
      findings.push(finding("unsupported_accommodation", `accommodations.${index}.sourceRefs`, "Supported accommodation state requires accommodation, guardian, teacher, or handbook evidence."));
    }
  }
  for (const [index, conflict] of value.conflicts.entries()) {
    findings.push(
      ...uniqueFindings(conflict.itemRefs, `conflicts.${index}.itemRefs`, "Item reference"),
      ...referenceFindings(conflict.itemRefs, itemSet, `conflicts.${index}.itemRefs`, "Item reference"),
      ...uniqueFindings(conflict.sourceRefs, `conflicts.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(conflict.sourceRefs, sourceSet, `conflicts.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.itemRefs, `reviewQuestions.${index}.itemRefs`, "Item reference"),
      ...referenceFindings(question.itemRefs, itemSet, `reviewQuestions.${index}.itemRefs`, "Item reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }
  if (
    value.handoff.state === "ready-for-guardian-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Guardian-ready school ledgers cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    items: value.items.map(({ title, blockedReason }) => ({ title, blockedReason })),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(submit|message teacher|email teacher|contact school|pay fee|edit calendar|modify calendar|change enrollment|change attendance|disclose|diagnose|eligible|discipline|legal advice|medical decision|education decision)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "School artifacts must not instruct form submission, teacher or school contact, payments, calendar edits, enrollment or attendance changes, disclosure, or education/medical/legal/discipline decisions."));
  }
  if (value.handoff.guardian === "school-coordinator") {
    findings.push(finding("agent_owned_authority", "handoff.guardian", "School actions and student disclosure decisions must remain with the named guardian."));
  }
  return findings;
}

function childActivityFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const childIds = value.children.map((item) => item.id);
  const activityIds = value.activities.map((item) => item.id);
  const sessionIds = value.sessions.map((item) => item.id);
  const helperIds = value.helpers.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const childSet = new Set(childIds);
  const activitySet = new Set(activityIds);
  const sessionSet = new Set(sessionIds);
  const helperSet = new Set(helperIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(childIds, "children", "Child id"),
    ...uniqueFindings(activityIds, "activities", "Activity id"),
    ...uniqueFindings(sessionIds, "sessions", "Session id"),
    ...uniqueFindings(value.registrations.map((item) => item.id), "registrations", "Registration id"),
    ...uniqueFindings(value.fees.map((item) => item.id), "fees", "Fee id"),
    ...uniqueFindings(value.waivers.map((item) => item.id), "waivers", "Waiver id"),
    ...uniqueFindings(value.equipment.map((item) => item.id), "equipment", "Equipment id"),
    ...uniqueFindings(value.transportation.map((item) => item.id), "transportation", "Transportation id"),
    ...uniqueFindings(helperIds, "helpers", "Helper id"),
    ...uniqueFindings(value.conflicts.map((item) => item.id), "conflicts", "Conflict id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, child] of value.children.entries()) {
    findings.push(
      ...uniqueFindings(child.sourceRefs, `children.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(child.sourceRefs, sourceSet, `children.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, activity] of value.activities.entries()) {
    findings.push(
      ...referenceFindings([activity.childRef], childSet, `activities.${index}.childRef`, "Child reference"),
      ...uniqueFindings(activity.sourceRefs, `activities.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(activity.sourceRefs, sourceSet, `activities.${index}.sourceRefs`, "Source reference"),
    );
    const supported = activity.sourceRefs.some((ref) =>
      ["team-app", "coach-note", "camp-email", "club-calendar", "lesson-schedule", "fee-notice", "location-page", "guardian-note", "roster"].includes(sourceById.get(ref)?.kind),
    );
    if (!supported) {
      findings.push(finding("unsupported_activity_source", `activities.${index}.sourceRefs`, "Activities require team-app, coach, camp, club, lesson, location, roster, or guardian evidence."));
    }
  }
  for (const [index, session] of value.sessions.entries()) {
    findings.push(
      ...referenceFindings([session.activityRef], activitySet, `sessions.${index}.activityRef`, "Activity reference"),
      ...uniqueFindings(session.sourceRefs, `sessions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(session.sourceRefs, sourceSet, `sessions.${index}.sourceRefs`, "Source reference"),
    );
    if (Date.parse(session.endsAt) <= Date.parse(session.startsAt)) {
      findings.push(finding("invalid_time_range", `sessions.${index}.endsAt`, "Activity sessions must end after they start."));
    }
  }
  for (const [collectionName, collection] of [
    ["registrations", value.registrations],
    ["fees", value.fees],
    ["waivers", value.waivers],
    ["equipment", value.equipment],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...referenceFindings([item.activityRef], activitySet, `${collectionName}.${index}.activityRef`, "Activity reference"),
        ...uniqueFindings(item.sourceRefs, `${collectionName}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${collectionName}.${index}.sourceRefs`, "Source reference"),
      );
      const supported = item.sourceRefs.some((ref) =>
        ["team-app", "coach-note", "camp-email", "club-calendar", "lesson-schedule", "fee-notice", "waiver-link", "equipment-list", "location-page", "guardian-note", "roster"].includes(sourceById.get(ref)?.kind),
      );
      if (!supported) {
        findings.push(finding("unsupported_activity_item_source", `${collectionName}.${index}.sourceRefs`, "Activity logistics items require activity, fee, waiver, equipment, location, roster, or guardian evidence."));
      }
      if (
        (item.state === "blocked" && !item.blockedReason) ||
        (item.state !== "blocked" && item.blockedReason !== null && ["register", "pay", "sign", "message", "contact"].some((word) => item.blockedReason.toLowerCase().includes(word)))
      ) {
        findings.push(finding("incoherent_blocked_state", `${collectionName}.${index}.blockedReason`, "Only blocked items may carry action-blocking instructions as blocked reasons."));
      }
    }
  }
  for (const [index, transport] of value.transportation.entries()) {
    findings.push(
      ...uniqueFindings(transport.sessionRefs, `transportation.${index}.sessionRefs`, "Session reference"),
      ...referenceFindings(transport.sessionRefs, sessionSet, `transportation.${index}.sessionRefs`, "Session reference"),
      ...uniqueFindings(transport.sourceRefs, `transportation.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(transport.sourceRefs, sourceSet, `transportation.${index}.sourceRefs`, "Source reference"),
    );
    if (transport.helperRef !== null) {
      findings.push(...referenceFindings([transport.helperRef], helperSet, `transportation.${index}.helperRef`, "Helper reference"));
    }
  }
  for (const [index, helper] of value.helpers.entries()) {
    findings.push(
      ...uniqueFindings(helper.sourceRefs, `helpers.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(helper.sourceRefs, sourceSet, `helpers.${index}.sourceRefs`, "Source reference"),
    );
    const supported = helper.sourceRefs.some((ref) => sourceById.get(ref)?.kind === "guardian-note");
    if (helper.permissionState === "approved-by-guardian" && !supported) {
      findings.push(finding("unsupported_helper_permission", `helpers.${index}.sourceRefs`, "Approved helper permission requires guardian-note evidence."));
    }
  }
  for (const [index, conflict] of value.conflicts.entries()) {
    findings.push(
      ...uniqueFindings(conflict.sessionRefs, `conflicts.${index}.sessionRefs`, "Session reference"),
      ...referenceFindings(conflict.sessionRefs, sessionSet, `conflicts.${index}.sessionRefs`, "Session reference"),
      ...uniqueFindings(conflict.sourceRefs, `conflicts.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(conflict.sourceRefs, sourceSet, `conflicts.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.activityRefs, `reviewQuestions.${index}.activityRefs`, "Activity reference"),
      ...referenceFindings(question.activityRefs, activitySet, `reviewQuestions.${index}.activityRefs`, "Activity reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, new Set(value.reviewQuestions.map((item) => item.id)), "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-guardian-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Guardian-ready activity ledgers cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    registrations: value.registrations.map(({ label, blockedReason }) => ({ label, blockedReason })),
    fees: value.fees.map(({ label, blockedReason }) => ({ label, blockedReason })),
    waivers: value.waivers.map(({ label, blockedReason }) => ({ label, blockedReason })),
    transportation: value.transportation.map(({ mode, state, pickupCommitment }) => ({ mode, state, pickupCommitment })),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(register (the )?child|register now|pay fee|pay now|message coach|message parent|contact organizer|edit calendar|modify calendar|arrange ride|commit pickup|commit drop-?off|sign waiver|share location|disclose child|medical decision|legal decision|custody decision|eligible|eligibility claim|safe to attend|cleared to play)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Activity artifacts must not instruct registration, payment, coach/parent/organizer contact, calendar edits, ride arrangements, pickup commitments, waiver signatures, location sharing, child disclosure, or medical/legal/custody/eligibility claims."));
  }
  if (value.handoff.owner === "child-activity-manager" || value.handoff.guardian === "child-activity-manager") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Activity, transportation, disclosure, and child-related decisions must remain with the named guardian."));
  }
  return findings;
}

function gamesBacklogFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const gameIds = value.games.map((item) => item.id);
  const constraintIds = value.constraints.map((item) => item.id);
  const availabilityIds = value.availability.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const gameSet = new Set(gameIds);
  const constraintSet = new Set(constraintIds);
  const availabilitySet = new Set(availabilityIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const availabilityById = new Map(value.availability.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(gameIds, "games", "Game id"),
    ...uniqueFindings(constraintIds, "constraints", "Constraint id"),
    ...uniqueFindings(availabilityIds, "availability", "Availability id"),
    ...uniqueFindings(value.shortlist.map((item) => item.id), "shortlist", "Shortlist id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, game] of value.games.entries()) {
    findings.push(
      ...uniqueFindings(game.sourceRefs, `games.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(game.sourceRefs, sourceSet, `games.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, constraint] of value.constraints.entries()) {
    findings.push(
      ...uniqueFindings(constraint.sourceRefs, `constraints.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(constraint.sourceRefs, sourceSet, `constraints.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, row] of value.availability.entries()) {
    findings.push(
      ...referenceFindings([row.gameRef], gameSet, `availability.${index}.gameRef`, "Game reference"),
      ...uniqueFindings(row.sourceRefs, `availability.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(row.sourceRefs, sourceSet, `availability.${index}.sourceRefs`, "Source reference"),
    );
    const supported = row.sourceRefs.some((ref) =>
      ["library-export", "store-page", "subscription-catalog", "rating-page", "co-op-reference", "accessibility-note"].includes(sourceById.get(ref)?.kind),
    );
    if (!supported) {
      findings.push(finding("unsupported_availability_source", `availability.${index}.sourceRefs`, "Game availability requires library, store, subscription, rating, co-op, or accessibility evidence."));
    }
  }
  for (const [index, pick] of value.shortlist.entries()) {
    findings.push(
      ...referenceFindings([pick.gameRef], gameSet, `shortlist.${index}.gameRef`, "Game reference"),
      ...referenceFindings([pick.availabilityRef], availabilitySet, `shortlist.${index}.availabilityRef`, "Availability reference"),
      ...uniqueFindings(pick.constraintRefs, `shortlist.${index}.constraintRefs`, "Constraint reference"),
      ...referenceFindings(pick.constraintRefs, constraintSet, `shortlist.${index}.constraintRefs`, "Constraint reference"),
    );
    const availability = availabilityById.get(pick.availabilityRef);
    if (availability && availability.gameRef !== pick.gameRef) {
      findings.push(finding("availability_game_mismatch", `shortlist.${index}.availabilityRef`, "Shortlist availability must belong to the same game."));
    }
    const requiredConstraints = value.constraints.filter((constraint) => constraint.required);
    const missingRequired = requiredConstraints.some((constraint) => !pick.constraintRefs.includes(constraint.id));
    if (
      pick.state === "recommended" &&
      (!availability ||
        missingRequired ||
        !["owned", "subscription-access"].includes(availability.ownershipState) ||
        availability.platformFit !== "supported" ||
        availability.coOpState !== "supported" ||
        availability.contentState !== "supported" ||
        !["short", "medium"].includes(availability.sessionFit))
    ) {
      findings.push(finding("unsupported_recommendation", `shortlist.${index}`, "Recommended games require owned/subscription access, platform, co-op, content, session, and required-constraint support."));
    }
    if (
      (pick.state === "blocked" && !pick.blockedReason) ||
      (pick.state !== "blocked" && pick.blockedReason !== null)
    ) {
      findings.push(finding("incoherent_blocked_state", `shortlist.${index}.blockedReason`, "Only blocked game shortlist items may carry a blocked reason."));
    }
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.gameRefs, `reviewQuestions.${index}.gameRefs`, "Game reference"),
      ...referenceFindings(question.gameRefs, gameSet, `reviewQuestions.${index}.gameRefs`, "Game reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready game backlogs cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    shortlist: value.shortlist.map(({ fitReason, blockedReason }) => ({ fitReason, blockedReason })),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(buy|purchase|install|download|launch|join multiplayer|message|add friend|parental controls|change account|post review|stream|share play history|safe for kids|guaranteed compatible)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Game backlog artifacts must not instruct purchases, installs, launches, multiplayer joins, messages, account changes, parental controls, reviews, streaming, or unsupported suitability claims."));
  }
  if (value.handoff.owner === "games-backlog-manager") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Purchase, install, account, multiplayer, messaging, parental-control, and posting decisions must remain with the named owner."));
  }
  return findings;
}

function mealGroceryFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const constraintIds = value.constraints.map((item) => item.id);
  const inventoryIds = value.inventory.map((item) => item.id);
  const mealIds = value.meals.map((item) => item.id);
  const groceryIds = value.groceryItems.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const constraintSet = new Set(constraintIds);
  const inventorySet = new Set(inventoryIds);
  const mealSet = new Set(mealIds);
  const grocerySet = new Set(groceryIds);
  const questionSet = new Set(questionIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const constraintsById = new Map(value.constraints.map((item) => [item.id, item]));
  const requiredConstraints = value.constraints.filter((constraint) => constraint.required);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(constraintIds, "constraints", "Constraint id"),
    ...uniqueFindings(inventoryIds, "inventory", "Inventory id"),
    ...uniqueFindings(mealIds, "meals", "Meal id"),
    ...uniqueFindings(groceryIds, "groceryItems", "Grocery item id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];

  for (const [index, constraint] of value.constraints.entries()) {
    findings.push(
      ...uniqueFindings(constraint.sourceRefs, `constraints.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(constraint.sourceRefs, sourceSet, `constraints.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, item] of value.inventory.entries()) {
    findings.push(
      ...uniqueFindings(item.sourceRefs, `inventory.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `inventory.${index}.sourceRefs`, "Source reference"),
    );
    const hasInventorySource = item.sourceRefs.some((ref) =>
      ["pantry-note", "fridge-note", "freezer-note", "receipt", "owner-note"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasInventorySource) {
      findings.push(finding("unsupported_inventory_source", `inventory.${index}.sourceRefs`, "Inventory state requires pantry, fridge, freezer, receipt, or owner-note evidence."));
    }
  }
  for (const [index, meal] of value.meals.entries()) {
    findings.push(
      ...uniqueFindings(meal.recipeRefs, `meals.${index}.recipeRefs`, "Recipe source reference"),
      ...referenceFindings(meal.recipeRefs, sourceSet, `meals.${index}.recipeRefs`, "Recipe source reference"),
      ...uniqueFindings(meal.constraintRefs, `meals.${index}.constraintRefs`, "Constraint reference"),
      ...referenceFindings(meal.constraintRefs, constraintSet, `meals.${index}.constraintRefs`, "Constraint reference"),
      ...uniqueFindings(meal.inventoryRefs, `meals.${index}.inventoryRefs`, "Inventory reference"),
      ...referenceFindings(meal.inventoryRefs, inventorySet, `meals.${index}.inventoryRefs`, "Inventory reference"),
      ...uniqueFindings(meal.groceryRefs, `meals.${index}.groceryRefs`, "Grocery item reference"),
      ...referenceFindings(meal.groceryRefs, grocerySet, `meals.${index}.groceryRefs`, "Grocery item reference"),
      ...uniqueFindings(meal.sourceRefs, `meals.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(meal.sourceRefs, sourceSet, `meals.${index}.sourceRefs`, "Source reference"),
    );
    const hasMealSource = [...meal.recipeRefs, ...meal.sourceRefs].some((ref) =>
      ["recipe", "owner-note", "dietary-note", "allergy-note", "care-scope"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasMealSource) {
      findings.push(finding("unsupported_meal_source", `meals.${index}.sourceRefs`, "Meal fit requires recipe, owner, dietary, allergy, or care-scope evidence."));
    }
    const missingRequired = requiredConstraints.some((constraint) => !meal.constraintRefs.includes(constraint.id));
    const requiredEvidenceProblem = meal.constraintRefs
      .map((ref) => constraintsById.get(ref))
      .filter(Boolean)
      .some((constraint) =>
        ["allergy", "dietary"].includes(constraint.kind) &&
        constraint.sourceRefs.some((ref) => ["stale", "unknown", "conflicting"].includes(sourceById.get(ref)?.freshness)),
      );
    if (
      meal.fitState === "ready-for-review" &&
      (missingRequired || requiredEvidenceProblem || meal.blockedReason)
    ) {
      findings.push(finding("unsupported_meal_ready_state", `meals.${index}`, "Ready meals require all required constraints, supported dietary/allergy evidence, and no blocked reason."));
    }
    if (
      (meal.fitState === "blocked" && !meal.blockedReason) ||
      (meal.fitState !== "blocked" && meal.blockedReason && meal.fitState !== "possible")
    ) {
      findings.push(finding("incoherent_blocked_state", `meals.${index}.blockedReason`, "Only blocked or possible meals may carry a blocked reason."));
    }
  }
  for (const [index, item] of value.groceryItems.entries()) {
    findings.push(
      ...uniqueFindings(item.neededForMealRefs, `groceryItems.${index}.neededForMealRefs`, "Meal reference"),
      ...referenceFindings(item.neededForMealRefs, mealSet, `groceryItems.${index}.neededForMealRefs`, "Meal reference"),
      ...uniqueFindings(item.sourceRefs, `groceryItems.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `groceryItems.${index}.sourceRefs`, "Source reference"),
      ...uniqueFindings(item.substitutionRefs, `groceryItems.${index}.substitutionRefs`, "Substitution reference"),
      ...referenceFindings(item.substitutionRefs, grocerySet, `groceryItems.${index}.substitutionRefs`, "Substitution reference"),
    );
    const hasGrocerySource = item.sourceRefs.some((ref) =>
      ["store-page", "circular", "coupon", "receipt", "pantry-note", "fridge-note", "freezer-note", "owner-note"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasGrocerySource) {
      findings.push(finding("unsupported_grocery_source", `groceryItems.${index}.sourceRefs`, "Grocery state requires store, circular, coupon, receipt, pantry, fridge, freezer, or owner-note evidence."));
    }
    if (
      item.availabilityState === "in-stock" &&
      item.sourceRefs.some((ref) => ["stale", "unknown", "conflicting"].includes(sourceById.get(ref)?.freshness))
    ) {
      findings.push(finding("unsupported_in_stock_state", `groceryItems.${index}.availabilityState`, "In-stock grocery claims require current or recent source evidence."));
    }
  }
  const knownRefs = new Set([...sourceIds, ...constraintIds, ...inventoryIds, ...mealIds, ...groceryIds]);
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.refs, `reviewQuestions.${index}.refs`, "Review reference"),
      ...referenceFindings(question.refs, knownRefs, `reviewQuestions.${index}.refs`, "Review reference"),
    );
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, questionSet, "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "unknown", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready meal and grocery plans cannot depend on stale, unknown, or conflicting sources."));
  }
  const actionText = canonicalJson({
    meals: value.meals.map(({ blockedReason }) => blockedReason),
    reviewQuestions: value.reviewQuestions.map(({ reason }) => reason),
  });
  if (/\b(order groceries|checkout|check out|schedule delivery|subscribe now|modify subscription|edit calendar|message|text them|share address|publish|discard|throw away|allergen safe|allergy safe|give medical diet advice|nutrition advice)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Meal and grocery artifacts must not instruct orders, checkout, delivery, subscriptions, calendar edits, messages, address sharing, publishing, discarding, allergen certainty, or medical diet advice."));
  }
  if (value.handoff.nextOwner === "meal-grocery-planner") {
    findings.push(finding("agent_owned_authority", "handoff.nextOwner", "Grocery, delivery, calendar, household-message, disclosure, and medical diet decisions must remain with the named owner."));
  }
  return findings;
}

function homeInventoryFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const roomIds = value.rooms.map((item) => item.id);
  const itemIds = value.items.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const roomSet = new Set(roomIds);
  const itemSet = new Set(itemIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(roomIds, "rooms", "Room id"),
    ...uniqueFindings(itemIds, "items", "Item id"),
    ...uniqueFindings(value.evidence.map((item) => item.id), "evidence", "Evidence id"),
    ...uniqueFindings(value.warranties.map((item) => item.id), "warranties", "Warranty id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, room] of value.rooms.entries()) {
    findings.push(
      ...uniqueFindings(room.sourceRefs, `rooms.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(room.sourceRefs, sourceSet, `rooms.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, item] of value.items.entries()) {
    findings.push(
      ...referenceFindings([item.roomRef], roomSet, `items.${index}.roomRef`, "Room reference"),
      ...uniqueFindings(item.sourceRefs, `items.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `items.${index}.sourceRefs`, "Source reference"),
    );
    const supported = item.sourceRefs.some((ref) =>
      ["owner-note", "receipt", "photo", "warranty", "manual", "serial-label", "app-export", "maintenance-note", "purchase-record"].includes(sourceById.get(ref)?.kind),
    );
    if (!supported) {
      findings.push(finding("unsupported_item_source", `items.${index}.sourceRefs`, "Inventory items require owner, receipt, photo, warranty, manual, serial, app, maintenance, or purchase evidence."));
    }
    if (
      item.state === "inventory-ready" &&
      (item.condition !== "documented" || !["supported", "possible"].includes(item.valueState))
    ) {
      findings.push(finding("unsupported_ready_item", `items.${index}`, "Inventory-ready items require documented condition and supported or possible value evidence."));
    }
    if (
      (item.state === "blocked" && !item.blockedReason) ||
      (item.state !== "blocked" && item.blockedReason !== null)
    ) {
      findings.push(finding("incoherent_blocked_state", `items.${index}.blockedReason`, "Only blocked inventory items may carry a blocked reason."));
    }
  }
  for (const [index, evidence] of value.evidence.entries()) {
    findings.push(
      ...referenceFindings([evidence.itemRef], itemSet, `evidence.${index}.itemRef`, "Item reference"),
      ...uniqueFindings(evidence.sourceRefs, `evidence.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(evidence.sourceRefs, sourceSet, `evidence.${index}.sourceRefs`, "Source reference"),
    );
    const expectedKind = {
      receipt: "receipt",
      photo: "photo",
      serial: "serial-label",
      manual: "manual",
      "purchase-record": "purchase-record",
      "value-note": "valuation-note",
      "condition-note": "maintenance-note",
    }[evidence.kind];
    if (evidence.state === "supported" && !evidence.sourceRefs.some((ref) => sourceById.get(ref)?.kind === expectedKind)) {
      findings.push(finding("unsupported_evidence_source", `evidence.${index}.sourceRefs`, "Supported inventory evidence must cite a matching source kind."));
    }
  }
  for (const [index, warranty] of value.warranties.entries()) {
    findings.push(
      ...referenceFindings([warranty.itemRef], itemSet, `warranties.${index}.itemRef`, "Item reference"),
      ...uniqueFindings(warranty.sourceRefs, `warranties.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(warranty.sourceRefs, sourceSet, `warranties.${index}.sourceRefs`, "Source reference"),
    );
    if (warranty.state === "active" && !warranty.sourceRefs.some((ref) => sourceById.get(ref)?.kind === "warranty")) {
      findings.push(finding("unsupported_warranty_source", `warranties.${index}.sourceRefs`, "Active warranty state requires warranty evidence."));
    }
    if (warranty.state === "active" && warranty.expiresAt === null) {
      findings.push(finding("missing_warranty_expiry", `warranties.${index}.expiresAt`, "Active warranty state requires an expiration timestamp."));
    }
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.itemRefs, `reviewQuestions.${index}.itemRefs`, "Item reference"),
      ...referenceFindings(question.itemRefs, itemSet, `reviewQuestions.${index}.itemRefs`, "Item reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready inventories cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    items: value.items.map(({ blockedReason }) => blockedReason),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(file claim|insurance advice|legal advice|upload|share publicly|contact insurer|contact seller|sell|donate|discard|move item|edit cloud|disclose address|disclose valuables|claim eligible|covered by insurance)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Home inventory artifacts must not instruct claims, advice, uploads, sharing, contact, sale, donation, disposal, moves, cloud edits, or address/valuables disclosure."));
  }
  if (value.handoff.owner === "home-inventory-binder") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Inventory disclosure, claim, advice, upload, contact, sale, donation, disposal, and move decisions must remain with the named owner."));
  }
  return findings;
}

function insurancePolicyFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const policyIds = value.policies.map((item) => item.id);
  const coverageIds = value.coverageItems.map((item) => item.id);
  const assetIds = value.assets.map((item) => item.id);
  const premiumIds = value.premiumItems.map((item) => item.id);
  const claimIds = value.claimReadiness.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const policySet = new Set(policyIds);
  const assetSet = new Set(assetIds);
  const questionSet = new Set(questionIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const knownRefs = new Set([...sourceIds, ...policyIds, ...coverageIds, ...assetIds, ...premiumIds, ...claimIds]);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(policyIds, "policies", "Policy id"),
    ...uniqueFindings(coverageIds, "coverageItems", "Coverage id"),
    ...uniqueFindings(assetIds, "assets", "Asset id"),
    ...uniqueFindings(premiumIds, "premiumItems", "Premium id"),
    ...uniqueFindings(claimIds, "claimReadiness", "Claim-readiness id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];

  for (const [index, policy] of value.policies.entries()) {
    findings.push(
      ...uniqueFindings(policy.sourceRefs, `policies.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(policy.sourceRefs, sourceSet, `policies.${index}.sourceRefs`, "Source reference"),
    );
    const hasPolicySource = policy.sourceRefs.some((ref) =>
      ["policy-document", "declarations-page", "endorsement", "renewal-notice", "carrier-page"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasPolicySource) {
      findings.push(finding("unsupported_policy_source", `policies.${index}.sourceRefs`, "Policy state requires policy, declarations, endorsement, renewal, or carrier evidence."));
    }
  }
  for (const [index, coverage] of value.coverageItems.entries()) {
    findings.push(
      ...referenceFindings([coverage.policyRef], policySet, `coverageItems.${index}.policyRef`, "Policy reference"),
      ...uniqueFindings(coverage.sourceRefs, `coverageItems.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(coverage.sourceRefs, sourceSet, `coverageItems.${index}.sourceRefs`, "Source reference"),
    );
    const hasCoverageSource = coverage.sourceRefs.some((ref) =>
      ["policy-document", "declarations-page", "endorsement", "carrier-page"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasCoverageSource) {
      findings.push(finding("unsupported_coverage_source", `coverageItems.${index}.sourceRefs`, "Coverage, limit, and deductible states require policy, declarations, endorsement, or carrier evidence."));
    }
    if (
      coverage.coverageState === "supported" &&
      (coverage.limitState === "unknown" || coverage.deductibleState === "unknown")
    ) {
      findings.push(finding("unsupported_coverage_certainty", `coverageItems.${index}`, "Supported coverage must keep limit and deductible state supported, not-applicable, or explicitly conflicting."));
    }
  }
  for (const [index, asset] of value.assets.entries()) {
    findings.push(
      ...uniqueFindings(asset.sourceRefs, `assets.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(asset.sourceRefs, sourceSet, `assets.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, premium] of value.premiumItems.entries()) {
    findings.push(
      ...referenceFindings([premium.policyRef], policySet, `premiumItems.${index}.policyRef`, "Policy reference"),
      ...uniqueFindings(premium.sourceRefs, `premiumItems.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(premium.sourceRefs, sourceSet, `premiumItems.${index}.sourceRefs`, "Source reference"),
    );
    const hasPremiumSource = premium.sourceRefs.some((ref) =>
      ["premium-notice", "renewal-notice", "receipt", "declarations-page", "carrier-page"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasPremiumSource) {
      findings.push(finding("unsupported_premium_source", `premiumItems.${index}.sourceRefs`, "Premium amount and due-date states require premium, renewal, receipt, declarations, or carrier evidence."));
    }
    if (premium.amountState === "supported" && premium.sourceRefs.some((ref) => ["stale", "unknown", "conflicting"].includes(sourceById.get(ref)?.freshness))) {
      findings.push(finding("unsupported_premium_state", `premiumItems.${index}.amountState`, "Supported premium state requires current or recent non-conflicting evidence."));
    }
  }
  for (const [index, item] of value.claimReadiness.entries()) {
    findings.push(
      ...referenceFindings([item.policyRef], policySet, `claimReadiness.${index}.policyRef`, "Policy reference"),
      ...uniqueFindings(item.assetRefs, `claimReadiness.${index}.assetRefs`, "Asset reference"),
      ...referenceFindings(item.assetRefs, assetSet, `claimReadiness.${index}.assetRefs`, "Asset reference"),
      ...uniqueFindings(item.evidenceRefs, `claimReadiness.${index}.evidenceRefs`, "Evidence source reference"),
      ...referenceFindings(item.evidenceRefs, sourceSet, `claimReadiness.${index}.evidenceRefs`, "Evidence source reference"),
      ...uniqueFindings(item.sourceRefs, `claimReadiness.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `claimReadiness.${index}.sourceRefs`, "Source reference"),
    );
    const readinessRefs = [...item.evidenceRefs, ...item.sourceRefs];
    const hasClaimPrepEvidence = readinessRefs.some((ref) =>
      ["declarations-page", "endorsement", "claim-correspondence", "asset-inventory", "receipt", "carrier-page", "owner-note"].includes(sourceById.get(ref)?.kind),
    );
    const hasFreshnessProblem = readinessRefs.some((ref) =>
      ["stale", "unknown", "conflicting"].includes(sourceById.get(ref)?.freshness),
    );
    if (item.state === "ready-for-owner-review" && (!hasClaimPrepEvidence || hasFreshnessProblem || item.blockedReason)) {
      findings.push(finding("unsupported_claim_readiness", `claimReadiness.${index}`, "Ready claim-readiness items require current/recent policy and asset evidence and no blocked reason."));
    }
    if (
      (item.state === "blocked" && !item.blockedReason) ||
      (item.state !== "blocked" && item.state !== "needs-evidence" && item.blockedReason !== null)
    ) {
      findings.push(finding("incoherent_blocked_state", `claimReadiness.${index}.blockedReason`, "Only blocked or needs-evidence claim-readiness items may carry a blocked reason."));
    }
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.refs, `reviewQuestions.${index}.refs`, "Review reference"),
      ...referenceFindings(question.refs, knownRefs, `reviewQuestions.${index}.refs`, "Review reference"),
    );
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, questionSet, "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "unknown", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready insurance binders cannot depend on stale, unknown, or conflicting sources."));
  }
  const actionText = canonicalJson({
    claimReadiness: value.claimReadiness.map(({ blockedReason }) => blockedReason),
    reviewQuestions: value.reviewQuestions.map(({ reason }) => reason),
    handoff: value.handoff.summary,
  });
  if (/\b(file (a )?claim|submit (a )?claim|change coverage|cancel policy|renew policy|pay premium|contact (the )?(carrier|agent)|upload documents|share (the )?(address|policy number)|legal advice|insurance advice|claim value|covered by insurance|coverage applies)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Insurance policy artifacts must not instruct claims, coverage changes, cancellations, renewals, payments, carrier or agent contact, uploads, disclosure, advice, claim values, or coverage certainty."));
  }
  return findings;
}

function taxDocumentFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const documentIds = value.documents.map((item) => item.id);
  const evidenceIds = value.evidenceItems.map((item) => item.id);
  const deadlineIds = value.deadlines.map((item) => item.id);
  const missingIds = value.missingItems.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const documentSet = new Set(documentIds);
  const questionSet = new Set(questionIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const knownRefs = new Set([...sourceIds, ...documentIds, ...evidenceIds, ...deadlineIds, ...missingIds]);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(documentIds, "documents", "Document id"),
    ...uniqueFindings(evidenceIds, "evidenceItems", "Evidence id"),
    ...uniqueFindings(deadlineIds, "deadlines", "Deadline id"),
    ...uniqueFindings(missingIds, "missingItems", "Missing-item id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];

  for (const [index, document] of value.documents.entries()) {
    findings.push(
      ...uniqueFindings(document.sourceRefs, `documents.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(document.sourceRefs, sourceSet, `documents.${index}.sourceRefs`, "Source reference"),
    );
    const hasDocumentSource = document.sourceRefs.some((ref) =>
      ["wage-form", "contractor-form", "interest-form", "dividend-form", "brokerage-statement", "mortgage-statement", "tuition-form", "charitable-receipt", "medical-receipt", "property-tax-statement", "business-expense-log", "prior-year-checklist", "preparer-note", "owner-note", "agency-notice", "bank-statement"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasDocumentSource) {
      findings.push(finding("unsupported_document_source", `documents.${index}.sourceRefs`, "Tax documents require supplied form, statement, receipt, checklist, preparer, or owner evidence."));
    }
    if (
      document.receivedState === "received" &&
      (document.taxYearState !== "supported" || document.sourceRefs.some((ref) => ["stale", "unknown", "conflicting"].includes(sourceById.get(ref)?.freshness)))
    ) {
      findings.push(finding("unsupported_received_document", `documents.${index}`, "Received tax documents require supported tax-year state and current or recent non-conflicting evidence."));
    }
  }
  for (const [index, evidence] of value.evidenceItems.entries()) {
    findings.push(
      ...referenceFindings([evidence.documentRef], documentSet, `evidenceItems.${index}.documentRef`, "Document reference"),
      ...uniqueFindings(evidence.sourceRefs, `evidenceItems.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(evidence.sourceRefs, sourceSet, `evidenceItems.${index}.sourceRefs`, "Source reference"),
    );
    const allowedKinds = {
      "income-form": ["wage-form", "contractor-form", "interest-form", "dividend-form", "brokerage-statement"],
      "deduction-receipt": ["charitable-receipt", "medical-receipt", "property-tax-statement", "mortgage-statement"],
      "account-statement": ["bank-statement", "brokerage-statement", "mortgage-statement", "interest-form", "dividend-form"],
      "deadline-note": ["prior-year-checklist", "preparer-note", "owner-note", "agency-notice"],
      "preparer-question": ["preparer-note", "owner-note", "prior-year-checklist"],
      "identity-note": ["wage-form", "contractor-form", "owner-note", "agency-notice"],
      "expense-log": ["business-expense-log", "owner-note", "preparer-note"],
    }[evidence.kind];
    if (evidence.state === "supported" && !evidence.sourceRefs.some((ref) => allowedKinds.includes(sourceById.get(ref)?.kind))) {
      findings.push(finding("unsupported_evidence_source", `evidenceItems.${index}.sourceRefs`, "Supported tax evidence must cite a matching form, statement, receipt, checklist, preparer, or owner source kind."));
    }
  }
  for (const [index, deadline] of value.deadlines.entries()) {
    findings.push(
      ...uniqueFindings(deadline.sourceRefs, `deadlines.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(deadline.sourceRefs, sourceSet, `deadlines.${index}.sourceRefs`, "Source reference"),
    );
    if (
      ["owner-supplied", "preparer-supplied"].includes(deadline.deadlineState) &&
      !deadline.sourceRefs.some((ref) => ["owner-note", "preparer-note", "agency-notice", "prior-year-checklist"].includes(sourceById.get(ref)?.kind))
    ) {
      findings.push(finding("unsupported_deadline_source", `deadlines.${index}.sourceRefs`, "Deadline notes require owner, preparer, agency, or checklist evidence."));
    }
  }
  for (const [index, item] of value.missingItems.entries()) {
    findings.push(
      ...uniqueFindings(item.refs, `missingItems.${index}.refs`, "Missing-item reference"),
      ...referenceFindings(item.refs, knownRefs, `missingItems.${index}.refs`, "Missing-item reference"),
    );
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.refs, `reviewQuestions.${index}.refs`, "Review reference"),
      ...referenceFindings(question.refs, knownRefs, `reviewQuestions.${index}.refs`, "Review reference"),
    );
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, questionSet, "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "unknown", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready tax packets cannot depend on stale, unknown, or conflicting sources."));
  }
  const actionText = canonicalJson({
    missingItems: value.missingItems.map(({ reason }) => reason),
    reviewQuestions: value.reviewQuestions.map(({ reason }) => reason),
    handoff: value.handoff.summary,
  });
  if (/\b(prepare (the )?return|file (the )?return|amend (the )?return|sign (the )?form|pay (the )?tax|request (a )?refund|contact (the )?(employer|bank|broker|agency|preparer)|upload documents|change account|edit calendar|share (the )?(ssn|tax id)|tax advice|legal advice|estimate liability|claim (the )?deduction|eligible for (a )?(deduction|credit)|refund amount)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Tax document artifacts must not instruct return preparation, filing, amendments, signatures, payments, refunds, contact, uploads, account or calendar changes, SSN/tax-id sharing, tax/legal advice, liability estimates, or deduction/credit claims."));
  }
  return findings;
}

function purchaseResearchFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const constraintIds = value.constraints.map((item) => item.id);
  const candidateIds = value.candidates.map((item) => item.id);
  const claimIds = value.claims.map((item) => item.id);
  const policyIds = value.policyNotes.map((item) => item.id);
  const riskIds = value.risks.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const constraintSet = new Set(constraintIds);
  const candidateSet = new Set(candidateIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const claimsByCandidate = Map.groupBy(value.claims, (item) => item.candidateRef);
  const policiesByCandidate = Map.groupBy(value.policyNotes, (item) => item.candidateRef);
  const risksByCandidate = Map.groupBy(value.risks, (item) => item.candidateRef);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(constraintIds, "constraints", "Constraint id"),
    ...uniqueFindings(candidateIds, "candidates", "Candidate id"),
    ...uniqueFindings(claimIds, "claims", "Claim id"),
    ...uniqueFindings(policyIds, "policyNotes", "Policy id"),
    ...uniqueFindings(riskIds, "risks", "Risk id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];

  for (const [index, constraint] of value.constraints.entries()) {
    findings.push(
      ...uniqueFindings(constraint.sourceRefs, `constraints.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(constraint.sourceRefs, sourceSet, `constraints.${index}.sourceRefs`, "Source reference"),
    );
    if (!constraint.sourceRefs.some((ref) => sourceById.get(ref)?.kind === "owner-note")) {
      findings.push(finding("unsupported_constraint_source", `constraints.${index}.sourceRefs`, "Purchase constraints require owner-supplied evidence."));
    }
  }
  for (const [index, candidate] of value.candidates.entries()) {
    findings.push(
      ...uniqueFindings(candidate.sourceRefs, `candidates.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(candidate.sourceRefs, sourceSet, `candidates.${index}.sourceRefs`, "Source reference"),
    );
    const hasProductSource = candidate.sourceRefs.some((ref) =>
      ["manufacturer-page", "merchant-page", "marketplace-listing", "manual", "prior-purchase"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasProductSource) {
      findings.push(finding("unsupported_candidate_source", `candidates.${index}.sourceRefs`, "Product candidates require manufacturer, merchant, marketplace, manual, or prior-purchase evidence."));
    }
    if (candidate.currency !== value.plan.budgetCurrency) {
      findings.push(finding("currency_mismatch", `candidates.${index}.currency`, "Candidate prices must use the plan budget currency."));
    }
    if (
      candidate.price !== null &&
      ((value.plan.budgetMin !== null && candidate.price < value.plan.budgetMin) ||
        (value.plan.budgetMax !== null && candidate.price > value.plan.budgetMax)) &&
      candidate.recommendationState === "recommended"
    ) {
      findings.push(finding("budget_mismatch", `candidates.${index}.price`, "Recommended candidates must fit the owner-supplied budget range."));
    }
    const candidateClaims = claimsByCandidate.get(candidate.id) ?? [];
    const candidatePolicies = policiesByCandidate.get(candidate.id) ?? [];
    const candidateRisks = risksByCandidate.get(candidate.id) ?? [];
    const hasSupportedPrice = candidateClaims.some((item) => item.kind === "price" && item.state === "supported");
    const hasSupportedFit = candidateClaims.some((item) => ["fit", "compatibility", "feature"].includes(item.kind) && item.state === "supported");
    const hasReturn = candidatePolicies.some((item) => item.kind === "return" && item.state === "supported");
    const hasWarranty = candidatePolicies.some((item) => item.kind === "warranty" && item.state === "supported");
    const hasOpenRisk = candidateRisks.some((item) => item.state !== "resolved");
    const hasBadSource = candidate.sourceRefs.some((ref) =>
      ["stale", "missing", "conflicting"].includes(sourceById.get(ref)?.freshness) ||
      ["anecdotal", "unsupported"].includes(sourceById.get(ref)?.support),
    );
    if (
      candidate.recommendationState === "recommended" &&
      (candidate.availability !== "available" ||
        candidate.fitState !== "supported-fit" ||
        hasBadSource ||
        !hasSupportedPrice ||
        !hasSupportedFit ||
        !hasReturn ||
        !hasWarranty ||
        hasOpenRisk)
    ) {
      findings.push(finding("unsupported_recommendation", `candidates.${index}`, "Recommended candidates require available, supported-fit, current primary/secondary evidence, supported price and fit claims, supported return and warranty notes, and no open risks."));
    }
    if (
      (candidate.recommendationState === "blocked" && !candidate.blockedReason) ||
      (candidate.recommendationState !== "blocked" && candidate.blockedReason !== null)
    ) {
      findings.push(finding("incoherent_blocked_state", `candidates.${index}.blockedReason`, "Only blocked purchase candidates may carry a blocked reason."));
    }
  }
  for (const [index, claim] of value.claims.entries()) {
    findings.push(
      ...referenceFindings([claim.candidateRef], candidateSet, `claims.${index}.candidateRef`, "Candidate reference"),
      ...uniqueFindings(claim.constraintRefs, `claims.${index}.constraintRefs`, "Constraint reference"),
      ...referenceFindings(claim.constraintRefs, constraintSet, `claims.${index}.constraintRefs`, "Constraint reference"),
      ...uniqueFindings(claim.sourceRefs, `claims.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(claim.sourceRefs, sourceSet, `claims.${index}.sourceRefs`, "Source reference"),
    );
    const allowedKinds = {
      price: ["merchant-page", "marketplace-listing", "owner-note", "prior-purchase"],
      availability: ["merchant-page", "marketplace-listing", "manufacturer-page"],
      compatibility: ["manufacturer-page", "manual", "expert-review", "owner-note", "prior-purchase"],
      feature: ["manufacturer-page", "manual", "expert-review", "owner-note"],
      "review-quality": ["expert-review", "user-review", "owner-note"],
      safety: ["manufacturer-page", "manual", "expert-review"],
      authenticity: ["manufacturer-page", "merchant-page", "marketplace-listing"],
      fit: ["manufacturer-page", "manual", "expert-review", "owner-note", "prior-purchase"],
      shipping: ["shipping-policy", "merchant-page", "marketplace-listing"],
    }[claim.kind];
    if (claim.state === "supported" && !claim.sourceRefs.some((ref) => allowedKinds.includes(sourceById.get(ref)?.kind))) {
      findings.push(finding("unsupported_claim_source", `claims.${index}.sourceRefs`, "Supported purchase claims must cite a matching owner, product, policy, merchant, marketplace, review, manual, or prior-purchase source kind."));
    }
  }
  for (const [index, policy] of value.policyNotes.entries()) {
    findings.push(
      ...referenceFindings([policy.candidateRef], candidateSet, `policyNotes.${index}.candidateRef`, "Candidate reference"),
      ...uniqueFindings(policy.sourceRefs, `policyNotes.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(policy.sourceRefs, sourceSet, `policyNotes.${index}.sourceRefs`, "Source reference"),
    );
    const expectedKind = `${policy.kind}-policy`;
    if (policy.state === "supported" && !policy.sourceRefs.some((ref) => sourceById.get(ref)?.kind === expectedKind)) {
      findings.push(finding("unsupported_policy_source", `policyNotes.${index}.sourceRefs`, "Supported warranty, return, and shipping notes require matching policy evidence."));
    }
  }
  for (const [index, risk] of value.risks.entries()) {
    findings.push(
      ...referenceFindings([risk.candidateRef], candidateSet, `risks.${index}.candidateRef`, "Candidate reference"),
      ...uniqueFindings(risk.sourceRefs, `risks.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(risk.sourceRefs, sourceSet, `risks.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.candidateRefs, `reviewQuestions.${index}.candidateRefs`, "Candidate reference"),
      ...referenceFindings(question.candidateRefs, candidateSet, `reviewQuestions.${index}.candidateRefs`, "Candidate reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }
  findings.push(
    ...uniqueFindings(value.handoff.candidateRefs, "handoff.candidateRefs", "Candidate reference"),
    ...referenceFindings(value.handoff.candidateRefs, candidateSet, "handoff.candidateRefs", "Candidate reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready purchase research cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    candidates: value.candidates.map(({ blockedReason }) => blockedReason),
    policyNotes: value.policyNotes.map(({ summary }) => summary),
    risks: value.risks.map(({ kind, state }) => ({ kind, state })),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(buy|purchase now|complete (the )?purchase|add to cart|reserve|subscribe|apply for credit|open credit|contact (the )?(seller|merchant|manufacturer)|make payment|pay now|checkout|edit account|change wishlist|initiate return|return it|register warranty|post review|objective best|best choice|guaranteed compatible|safe for|authentic product)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Purchase research artifacts must not instruct purchases, cart/account changes, credit, seller contact, payments, returns, warranty registration, public reviews, or unsupported best/safe/authentic/compatible claims."));
  }
  if (value.handoff.owner === "purchase-researcher") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Purchase, payment, account, credit, seller-contact, return, warranty, and final choice authority must remain with the named owner."));
  }
  return findings;
}

function householdBudgetFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const categoryIds = value.categories.map((item) => item.id);
  const incomeIds = value.incomeNotes.map((item) => item.id);
  const billIds = value.bills.map((item) => item.id);
  const expenseIds = value.expenses.map((item) => item.id);
  const targetIds = value.targets.map((item) => item.id);
  const varianceIds = value.variances.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const categorySet = new Set(categoryIds);
  const questionSet = new Set(questionIds);
  const knownRefs = new Set([...categoryIds, ...incomeIds, ...billIds, ...expenseIds, ...targetIds, ...varianceIds]);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const targetByCategory = new Map(value.targets.map((item) => [item.categoryRef, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(categoryIds, "categories", "Category id"),
    ...uniqueFindings(incomeIds, "incomeNotes", "Income id"),
    ...uniqueFindings(billIds, "bills", "Bill id"),
    ...uniqueFindings(expenseIds, "expenses", "Expense id"),
    ...uniqueFindings(targetIds, "targets", "Target id"),
    ...uniqueFindings(varianceIds, "variances", "Variance id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];

  if (Date.parse(value.budget.periodEnd) < Date.parse(value.budget.periodStart)) {
    findings.push(finding("invalid_period", "budget.periodEnd", "Budget period end must not predate period start."));
  }

  for (const [index, source] of value.sources.entries()) {
    if (source.kind === "bank-feed" || source.authority === "banking-system") {
      findings.push(finding("bank_source_not_allowed", `sources.${index}`, "Household Budget Steward artifacts must not depend on connected bank or card feeds."));
    }
  }

  for (const [index, category] of value.categories.entries()) {
    findings.push(
      ...uniqueFindings(category.sourceRefs, `categories.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(category.sourceRefs, sourceSet, `categories.${index}.sourceRefs`, "Source reference"),
    );
  }

  for (const [path, collection] of [
    ["incomeNotes", value.incomeNotes],
    ["bills", value.bills],
    ["expenses", value.expenses],
    ["targets", value.targets],
  ]) {
    for (const [index, item] of collection.entries()) {
      if (item.categoryRef) {
        findings.push(...referenceFindings([item.categoryRef], categorySet, `${path}.${index}.categoryRef`, "Category reference"));
      }
      findings.push(
        ...uniqueFindings(item.sourceRefs, `${path}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${path}.${index}.sourceRefs`, "Source reference"),
      );
      if (["supplied", "owner-supplied"].includes(item.state ?? item.amountState)) {
        if (item.amount === null || item.currency !== value.budget.currency) {
          findings.push(finding("unsupported_amount_state", `${path}.${index}.amount`, "Supplied household budget amounts require a value in the budget currency."));
        }
      }
      if (["missing", "conflicting"].includes(item.state ?? item.amountState) && item.amount !== null) {
        findings.push(finding("inferred_amount", `${path}.${index}.amount`, "Missing or conflicting household budget amounts cannot carry inferred values."));
      }
    }
  }

  const actualByCategory = new Map();
  for (const item of [...value.bills, ...value.expenses]) {
    if (item.amountState === "supplied" && item.amount !== null && item.currency === value.budget.currency) {
      actualByCategory.set(item.categoryRef, (actualByCategory.get(item.categoryRef) ?? 0) + item.amount);
    }
  }

  for (const [index, variance] of value.variances.entries()) {
    findings.push(
      ...referenceFindings([variance.categoryRef], categorySet, `variances.${index}.categoryRef`, "Category reference"),
      ...uniqueFindings(variance.sourceRefs, `variances.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(variance.sourceRefs, sourceSet, `variances.${index}.sourceRefs`, "Source reference"),
    );
    const target = targetByCategory.get(variance.categoryRef);
    const actual = actualByCategory.get(variance.categoryRef);
    if (variance.state === "supported") {
      if (
        variance.currency !== value.budget.currency ||
        variance.actual === null ||
        variance.target === null ||
        actual === undefined ||
        !target ||
        target.amount === null ||
        !numbersEqual(variance.actual, actual) ||
        !numbersEqual(variance.target, target.amount)
      ) {
        findings.push(finding("unsupported_variance", `variances.${index}`, "Supported budget variance must equal supplied bill and expense totals against an owner-supplied target in the budget currency."));
      }
    }
  }

  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.refs, `reviewQuestions.${index}.refs`, "Review reference"),
      ...referenceFindings(question.refs, knownRefs, `reviewQuestions.${index}.refs`, "Review reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }

  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, questionSet, "handoff.reviewQuestionRefs", "Review question reference"),
  );

  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready household budgets cannot depend on stale, missing, or conflicting sources."));
  }

  const actionText = canonicalJson({
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(connect (a )?(bank|credit card)|pay (the )?(bill|rent|invoice)|move money|set (the )?budget|cancel (the )?(service|subscription)|negotiate (the )?bill|contact (the )?(vendor|utility|landlord|lender)|change payment|modify account|apply for credit|edit calendar|send (a )?message|tax advice|legal advice|financial advice|investment advice|you should|save money by)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Household budget artifacts must not instruct banking, payments, money movement, budget commitments, cancellations, negotiation, vendor contact, account changes, credit, calendar edits, messages, advice, or financial decisions."));
  }
  if (value.handoff.owner === "household-budget-steward") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Budget, bill, payment, account, vendor-contact, credit, calendar, messaging, and financial decisions must remain with the named owner."));
  }
  return findings;
}

function lifeTimelineFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const personIds = value.people.map((item) => item.id);
  const placeIds = value.places.map((item) => item.id);
  const eventIds = value.events.map((item) => item.id);
  const pointerIds = value.pointers.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const personSet = new Set(personIds);
  const placeSet = new Set(placeIds);
  const pointerSet = new Set(pointerIds);
  const questionSet = new Set(questionIds);
  const knownRefs = new Set([...personIds, ...placeIds, ...eventIds, ...pointerIds]);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(personIds, "people", "Person id"),
    ...uniqueFindings(placeIds, "places", "Place id"),
    ...uniqueFindings(eventIds, "events", "Event id"),
    ...uniqueFindings(pointerIds, "pointers", "Pointer id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];

  for (const [path, collection] of [
    ["people", value.people],
    ["places", value.places],
    ["pointers", value.pointers],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.sourceRefs, `${path}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${path}.${index}.sourceRefs`, "Source reference"),
      );
    }
  }

  for (const [index, event] of value.events.entries()) {
    findings.push(
      ...uniqueFindings(event.personRefs, `events.${index}.personRefs`, "Person reference"),
      ...referenceFindings(event.personRefs, personSet, `events.${index}.personRefs`, "Person reference"),
      ...uniqueFindings(event.placeRefs, `events.${index}.placeRefs`, "Place reference"),
      ...referenceFindings(event.placeRefs, placeSet, `events.${index}.placeRefs`, "Place reference"),
      ...uniqueFindings(event.pointerRefs, `events.${index}.pointerRefs`, "Pointer reference"),
      ...referenceFindings(event.pointerRefs, pointerSet, `events.${index}.pointerRefs`, "Pointer reference"),
      ...uniqueFindings(event.sourceRefs, `events.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(event.sourceRefs, sourceSet, `events.${index}.sourceRefs`, "Source reference"),
    );
    if (event.dateEnd !== null && event.date !== null && Date.parse(event.dateEnd) < Date.parse(event.date)) {
      findings.push(finding("invalid_event_range", `events.${index}.dateEnd`, "Timeline event end date must not predate its start date."));
    }
    if (event.dateState === "exact" && (event.date === null || event.dateEnd !== null)) {
      findings.push(finding("invalid_exact_date", `events.${index}.date`, "Exact timeline events require one date and no date range."));
    }
    if (event.dateState === "range" && (event.date === null || event.dateEnd === null)) {
      findings.push(finding("invalid_date_range", `events.${index}.dateEnd`, "Range timeline events require a start and end date."));
    }
    if (event.certainty === "supported") {
      const hasDocumentedSource = event.sourceRefs.some((ref) =>
        ["photo-list", "video-list", "calendar-export", "travel-record", "school-record", "certificate", "message-export", "document-pointer", "archive-reference"].includes(sourceById.get(ref)?.kind),
      );
      if (!hasDocumentedSource) {
        findings.push(finding("unsupported_event_certainty", `events.${index}.sourceRefs`, "Supported timeline events require documentary, media, calendar, message, travel, school, certificate, or archive evidence."));
      }
    }
  }

  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.refs, `reviewQuestions.${index}.refs`, "Review reference"),
      ...referenceFindings(question.refs, knownRefs, `reviewQuestions.${index}.refs`, "Review reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }

  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, questionSet, "handoff.reviewQuestionRefs", "Review question reference"),
  );

  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready life timelines cannot depend on stale, missing, or conflicting sources."));
  }

  const actionText = canonicalJson({
    events: value.events.map(({ title }) => title),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(post|publish|share (the )?(timeline|album|photos?)|identify (the )?(face|faces|person)|tag (the )?(person|people)|contact (the )?(person|people|family)|edit (the )?album|move (the )?files?|delete (the )?files?|change permissions|legal claim|medical claim|genealogical claim|family history proves|custody|immigration|diagnosis|disclose)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Life timeline artifacts must not instruct posting, publishing, sharing, face identification, tagging, contact, album/file mutations, permission changes, sensitive disclosure, or legal/medical/genealogical claims."));
  }
  if (value.handoff.owner === "life-timeline-keeper") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Timeline sharing, posting, tagging, contact, file, permission, interpretation, and sensitive-disclosure decisions must remain with the named owner."));
  }
  return findings;
}

function giftRelationshipFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const recipientIds = value.recipients.map((item) => item.id);
  const occasionIds = value.occasions.map((item) => item.id);
  const preferenceIds = value.preferences.map((item) => item.id);
  const giftIds = value.giftIdeas.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const recipientSet = new Set(recipientIds);
  const occasionSet = new Set(occasionIds);
  const preferenceSet = new Set(preferenceIds);
  const giftSet = new Set(giftIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const occasionById = new Map(value.occasions.map((item) => [item.id, item]));
  const giftById = new Map(value.giftIdeas.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(recipientIds, "recipients", "Recipient id"),
    ...uniqueFindings(occasionIds, "occasions", "Occasion id"),
    ...uniqueFindings(preferenceIds, "preferences", "Preference id"),
    ...uniqueFindings(giftIds, "giftIdeas", "Gift id"),
    ...uniqueFindings(value.shortlist.map((item) => item.id), "shortlist", "Shortlist id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, recipient] of value.recipients.entries()) {
    findings.push(
      ...uniqueFindings(recipient.sourceRefs, `recipients.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(recipient.sourceRefs, sourceSet, `recipients.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, occasion] of value.occasions.entries()) {
    findings.push(
      ...referenceFindings([occasion.recipientRef], recipientSet, `occasions.${index}.recipientRef`, "Recipient reference"),
      ...uniqueFindings(occasion.sourceRefs, `occasions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(occasion.sourceRefs, sourceSet, `occasions.${index}.sourceRefs`, "Source reference"),
    );
    if (occasion.budget !== null && occasion.currency !== value.plan.currency) {
      findings.push(finding("budget_currency_mismatch", `occasions.${index}.currency`, "Occasion budgets must use the plan currency."));
    }
  }
  for (const [index, preference] of value.preferences.entries()) {
    findings.push(
      ...referenceFindings([preference.recipientRef], recipientSet, `preferences.${index}.recipientRef`, "Recipient reference"),
      ...uniqueFindings(preference.sourceRefs, `preferences.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(preference.sourceRefs, sourceSet, `preferences.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, gift] of value.giftIdeas.entries()) {
    findings.push(
      ...referenceFindings([gift.recipientRef], recipientSet, `giftIdeas.${index}.recipientRef`, "Recipient reference"),
      ...referenceFindings([gift.occasionRef], occasionSet, `giftIdeas.${index}.occasionRef`, "Occasion reference"),
      ...uniqueFindings(gift.sourceRefs, `giftIdeas.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(gift.sourceRefs, sourceSet, `giftIdeas.${index}.sourceRefs`, "Source reference"),
    );
    const occasion = occasionById.get(gift.occasionRef);
    if (occasion && occasion.recipientRef !== gift.recipientRef) {
      findings.push(finding("occasion_recipient_mismatch", `giftIdeas.${index}.occasionRef`, "Gift occasion must belong to the same recipient."));
    }
    if (gift.estimatedCost !== null) {
      if (gift.currency !== value.plan.currency) {
        findings.push(finding("gift_currency_mismatch", `giftIdeas.${index}.currency`, "Gift costs must use the plan currency."));
      }
      if (occasion?.budget !== null && gift.estimatedCost > occasion.budget) {
        findings.push(finding("budget_exceeded", `giftIdeas.${index}.estimatedCost`, "Gift ideas over the occasion budget cannot be recommended without owner review."));
      }
    }
    const hasMerchantOrHistory = gift.sourceRefs.some((ref) =>
      ["merchant-page", "gift-history", "recipient-preference", "owner-note", "relationship-note"].includes(sourceById.get(ref)?.kind),
    );
    if (!hasMerchantOrHistory) {
      findings.push(finding("unsupported_gift_source", `giftIdeas.${index}.sourceRefs`, "Gift ideas require owner, recipient, merchant, or gift-history evidence."));
    }
  }
  for (const [index, pick] of value.shortlist.entries()) {
    findings.push(
      ...referenceFindings([pick.giftRef], giftSet, `shortlist.${index}.giftRef`, "Gift reference"),
      ...uniqueFindings(pick.preferenceRefs, `shortlist.${index}.preferenceRefs`, "Preference reference"),
      ...referenceFindings(pick.preferenceRefs, preferenceSet, `shortlist.${index}.preferenceRefs`, "Preference reference"),
    );
    const gift = giftById.get(pick.giftRef);
    const occasion = gift ? occasionById.get(gift.occasionRef) : null;
    if (
      pick.state === "recommended" &&
      (!gift ||
        !["available", "limited"].includes(gift.availability) ||
        !["arrives-before-occasion", "not-needed"].includes(gift.shippingState) ||
        (gift.estimatedCost !== null && occasion?.budget !== null && gift.estimatedCost > occasion.budget))
    ) {
      findings.push(finding("unsupported_recommendation", `shortlist.${index}`, "Recommended gifts require available evidence, acceptable timing, and budget fit."));
    }
    if (
      (pick.state === "blocked" && !pick.blockedReason) ||
      (pick.state !== "blocked" && pick.blockedReason !== null)
    ) {
      findings.push(finding("incoherent_blocked_state", `shortlist.${index}.blockedReason`, "Only blocked gift shortlist items may carry a blocked reason."));
    }
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.recipientRefs, `reviewQuestions.${index}.recipientRefs`, "Recipient reference"),
      ...referenceFindings(question.recipientRefs, recipientSet, `reviewQuestions.${index}.recipientRefs`, "Recipient reference"),
      ...uniqueFindings(question.giftRefs, `reviewQuestions.${index}.giftRefs`, "Gift reference"),
      ...referenceFindings(question.giftRefs, giftSet, `reviewQuestions.${index}.giftRefs`, "Gift reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready gift plans cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    shortlist: value.shortlist.map(({ fitReason, blockedReason }) => ({ fitReason, blockedReason })),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(buy|purchase|reserve|return|ship|send|message|invite|calendar|post|publish|share the surprise|store address|relationship status|infer)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "shortlist", "Gift artifacts must not instruct purchase, shipping, messaging, calendar, posting, surprise-sharing, address-storage, or sensitive inference actions."));
  }
  if (value.handoff.owner === "gift-relationship-manager") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Gift, message, calendar, address, privacy, and relationship-sensitive decisions must remain with the named owner."));
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

function fantasySportsFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const ruleIds = value.rules.map((item) => item.id);
  const playerIds = value.players.map((item) => item.id);
  const lineupIds = value.lineup.map((item) => item.id);
  const waiverIds = value.waiverWatch.map((item) => item.id);
  const tradeIds = value.tradeIdeas.map((item) => item.id);
  const riskIds = value.matchupRisks.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const playerSet = new Set(playerIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const playerById = new Map(value.players.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(ruleIds, "rules", "Rule id"),
    ...uniqueFindings(playerIds, "players", "Player id"),
    ...uniqueFindings(lineupIds, "lineup", "Lineup id"),
    ...uniqueFindings(waiverIds, "waiverWatch", "Waiver id"),
    ...uniqueFindings(tradeIds, "tradeIdeas", "Trade id"),
    ...uniqueFindings(riskIds, "matchupRisks", "Risk id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, rule] of value.rules.entries()) {
    findings.push(
      ...uniqueFindings(rule.sourceRefs, `rules.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(rule.sourceRefs, sourceSet, `rules.${index}.sourceRefs`, "Source reference"),
    );
    if (rule.state === "current" && rule.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_rule_state", `rules.${index}.sourceRefs`, "Current fantasy rules require current source evidence."));
    }
  }
  for (const [index, player] of value.players.entries()) {
    findings.push(
      ...uniqueFindings(player.sourceRefs, `players.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(player.sourceRefs, sourceSet, `players.${index}.sourceRefs`, "Source reference"),
    );
    if (player.projection.sourceRef !== null) {
      findings.push(
        ...referenceFindings([player.projection.sourceRef], sourceSet, `players.${index}.projection.sourceRef`, "Projection source"),
      );
    }
    if (player.projection.state === "supported" && player.projection.sourceRef === null) {
      findings.push(finding("unsupported_projection_state", `players.${index}.projection.sourceRef`, "Supported projections require a source."));
    }
    if (player.availability === "available" && player.sourceRefs.some((ref) => sourceById.get(ref)?.freshness === "stale")) {
      findings.push(finding("unsupported_availability", `players.${index}.sourceRefs`, "Available players cannot depend on stale source evidence."));
    }
  }
  for (const [index, slot] of value.lineup.entries()) {
    findings.push(
      ...referenceFindings([slot.playerRef], playerSet, `lineup.${index}.playerRef`, "Player reference"),
      ...uniqueFindings(slot.sourceRefs, `lineup.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(slot.sourceRefs, sourceSet, `lineup.${index}.sourceRefs`, "Source reference"),
    );
    const player = playerById.get(slot.playerRef);
    if (slot.reviewState === "ready-for-owner-review" && (slot.lockState !== "open" || !player || !["available", "questionable"].includes(player.availability))) {
      findings.push(finding("unsupported_lineup_state", `lineup.${index}.reviewState`, "Ready lineup review requires an open slot and a player with supported availability."));
    }
    if (slot.reviewState === "ready-for-owner-review" && slot.sourceRefs.some((ref) => ["stale", "missing", "conflicting"].includes(sourceById.get(ref)?.freshness))) {
      findings.push(finding("unsupported_lineup_sources", `lineup.${index}.sourceRefs`, "Ready lineup review cannot depend on stale, missing, or conflicting sources."));
    }
  }
  for (const [collectionName, collection] of [
    ["waiverWatch", value.waiverWatch],
    ["matchupRisks", value.matchupRisks],
  ]) {
    for (const [index, item] of collection.entries()) {
      const refs = item.playerRefs ?? [item.playerRef];
      findings.push(
        ...uniqueFindings(refs, `${collectionName}.${index}.playerRefs`, "Player reference"),
        ...referenceFindings(refs, playerSet, `${collectionName}.${index}.playerRefs`, "Player reference"),
        ...uniqueFindings(item.sourceRefs, `${collectionName}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${collectionName}.${index}.sourceRefs`, "Source reference"),
      );
    }
  }
  for (const [index, idea] of value.tradeIdeas.entries()) {
    findings.push(
      ...uniqueFindings(idea.playerRefs, `tradeIdeas.${index}.playerRefs`, "Player reference"),
      ...referenceFindings(idea.playerRefs, playerSet, `tradeIdeas.${index}.playerRefs`, "Player reference"),
      ...uniqueFindings(idea.sourceRefs, `tradeIdeas.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(idea.sourceRefs, sourceSet, `tradeIdeas.${index}.sourceRefs`, "Source reference"),
    );
    if (idea.reviewState === "owner-review" && idea.deadlineState !== "open") {
      findings.push(finding("unsupported_trade_state", `tradeIdeas.${index}.deadlineState`, "Owner-review trade ideas require an open deadline state."));
    }
  }
  const knownRefs = new Set([...sourceIds, ...ruleIds, ...playerIds, ...lineupIds, ...waiverIds, ...tradeIds, ...riskIds]);
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.refs, `reviewQuestions.${index}.refs`, "Review reference"),
      ...referenceFindings(question.refs, knownRefs, `reviewQuestions.${index}.refs`, "Review reference"),
    );
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, new Set(questionIds), "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready fantasy roster packets cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    lineup: value.lineup.map(({ reason }) => reason),
    waiverWatch: value.waiverWatch.map(({ rosterImpact }) => rosterImpact),
    tradeIdeas: value.tradeIdeas.map(({ riskSummary }) => riskSummary),
    matchupRisks: value.matchupRisks.map(({ summary }) => summary),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(submit lineup|set lineup|claim waiver|drop player|add player|propose trade|accept trade|enter contest|place bet|betting advice|gambling advice|message league|pay fee|change settings|change account|guaranteed points|lock it in)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Fantasy roster artifacts must not instruct lineup, waiver, trade, contest, betting, payment, message, settings, or account actions."));
  }
  if (value.handoff.owner === "fantasy-sports-manager") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Fantasy lineup, waiver, trade, contest, betting, payment, messaging, settings, and account authority must remain with the named owner."));
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

function musicOrganizerFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const itemIds = value.items.map((item) => item.id);
  const availabilityIds = value.availability.map((item) => item.id);
  const preferenceIds = value.preferences.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const itemSet = new Set(itemIds);
  const availabilitySet = new Set(availabilityIds);
  const preferenceSet = new Set(preferenceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const itemById = new Map(value.items.map((item) => [item.id, item]));
  const availabilityById = new Map(value.availability.map((item) => [item.id, item]));
  const libraryServices = new Set(value.library.services);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(itemIds, "items", "Music item id"),
    ...uniqueFindings(availabilityIds, "availability", "Availability id"),
    ...uniqueFindings(preferenceIds, "preferences", "Preference id"),
    ...uniqueFindings(value.playlistPlan.map((item) => item.id), "playlistPlan", "Playlist pick id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, item] of value.items.entries()) {
    findings.push(
      ...uniqueFindings(item.sourceRefs, `items.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `items.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, row] of value.availability.entries()) {
    findings.push(
      ...referenceFindings([row.itemRef], itemSet, `availability.${index}.itemRef`, "Music item reference"),
      ...uniqueFindings(row.sourceRefs, `availability.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(row.sourceRefs, sourceSet, `availability.${index}.sourceRefs`, "Source reference"),
    );
    const supportedSource = row.sourceRefs.some((ref) =>
      ["streaming-availability", "library-export", "rights-metadata"].includes(sourceById.get(ref)?.kind),
    );
    if (!supportedSource) {
      findings.push(finding("unsupported_availability_source", `availability.${index}.sourceRefs`, "Music availability requires streaming, library-export, or rights source evidence."));
    }
    if (!libraryServices.has(row.service)) {
      findings.push(finding("unsupported_service", `availability.${index}.service`, "Music availability must be scoped to services or libraries the owner declared."));
    }
    if (row.region !== value.library.region) {
      findings.push(finding("region_mismatch", `availability.${index}.region`, "Music availability region must match the library region."));
    }
  }
  for (const [index, preference] of value.preferences.entries()) {
    findings.push(
      ...uniqueFindings(preference.sourceRefs, `preferences.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(preference.sourceRefs, sourceSet, `preferences.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, pick] of value.playlistPlan.entries()) {
    findings.push(
      ...referenceFindings([pick.itemRef], itemSet, `playlistPlan.${index}.itemRef`, "Music item reference"),
      ...referenceFindings([pick.availabilityRef], availabilitySet, `playlistPlan.${index}.availabilityRef`, "Availability reference"),
      ...uniqueFindings(pick.preferenceRefs, `playlistPlan.${index}.preferenceRefs`, "Preference reference"),
      ...referenceFindings(pick.preferenceRefs, preferenceSet, `playlistPlan.${index}.preferenceRefs`, "Preference reference"),
    );
    const item = itemById.get(pick.itemRef);
    const availability = availabilityById.get(pick.availabilityRef);
    if (availability && availability.itemRef !== pick.itemRef) {
      findings.push(finding("availability_item_mismatch", `playlistPlan.${index}.availabilityRef`, "Playlist availability must belong to the same music item."));
    }
    if (
      pick.state === "recommended" &&
      (!availability ||
        availability.freshness !== "current" ||
        !["owned-local", "included"].includes(availability.accessMode) ||
        !["playable-in-owner-library", "streamable-in-owner-plan"].includes(availability.rightsConstraint))
    ) {
      findings.push(finding("unsupported_recommendation", `playlistPlan.${index}`, "Recommended music requires current owned or included availability under the owner's declared rights."));
    }
    if (pick.state === "recommended" && ["skipped", "disliked", "blocked"].includes(item?.tasteState)) {
      findings.push(finding("taste_state_conflict", `playlistPlan.${index}.itemRef`, "Recommended playlist items cannot conflict with skipped, disliked, or blocked taste state."));
    }
    if (pick.state === "recommended" && item?.explicitState === "explicit") {
      const cleanLimit = pick.preferenceRefs.some((ref) => value.preferences.find((pref) => pref.id === ref)?.kind === "explicit-limit");
      if (cleanLimit) {
        findings.push(finding("explicit_content_conflict", `playlistPlan.${index}.itemRef`, "Recommended items cannot be explicit when the linked owner preference asks for clean versions."));
      }
    }
    if (
      (pick.state === "blocked" && !pick.blockedReason) ||
      (pick.state !== "blocked" && pick.blockedReason !== null)
    ) {
      findings.push(finding("incoherent_blocked_state", `playlistPlan.${index}.blockedReason`, "Only blocked playlist items may carry a blocked reason."));
    }
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.itemRefs, `reviewQuestions.${index}.itemRefs`, "Music item reference"),
      ...referenceFindings(question.itemRefs, itemSet, `reviewQuestions.${index}.itemRefs`, "Music item reference"),
      ...uniqueFindings(question.sourceRefs, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(question.sourceRefs, sourceSet, `reviewQuestions.${index}.sourceRefs`, "Source reference"),
    );
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready music library plans cannot depend on stale, missing, or conflicting sources."));
  }
  const accountActionText = canonicalJson({
    playlistPlan: value.playlistPlan.map(({ fitReason, blockedReason }) => ({ fitReason, blockedReason })),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(buy|purchase|subscribe|cancel|publish|post|follow artist|download|message|modify account|bypass|rip|pirate)\b/iu.test(accountActionText)) {
    findings.push(finding("account_action_content", "playlistPlan", "Music organizer artifacts must not instruct purchase, subscription, account, public sharing, download, messaging, or rights-bypass actions."));
  }
  if (value.handoff.owner === "music-organizer") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Music account, purchase, publishing, downloading, messaging, and rights decisions must remain with the named owner."));
  }
  return findings;
}

function companyDisclosureLedgerFindings(value) {
 const issuerIds = value.issuers.map((item) => item.id);
 const sourceIds = value.sources.map((item) => item.id);
 const factIds = value.filedFacts.map((item) => item.id);
 const comparisonIds = value.comparisons.map((item) => item.id);
 const interpretationIds = value.interpretations.map((item) => item.id);
 const questionIds = value.reviewQuestions.map((item) => item.id);
 const gapIds = value.gapsAndBlockers.map((item) => item.id);
 const thresholdIds = value.watch.materialityPolicy.thresholds.map((item) => item.id);
 const issuerSet = new Set(issuerIds);
 const sourceSet = new Set(sourceIds);
 const factSet = new Set(factIds);
 const comparisonSet = new Set(comparisonIds);
 const interpretationSet = new Set(interpretationIds);
 const questionSet = new Set(questionIds);
 const gapSet = new Set(gapIds);
 const thresholdSet = new Set(thresholdIds);
 const issuerById = new Map(value.issuers.map((item) => [item.id, item]));
 const sourceById = new Map(value.sources.map((item) => [item.id, item]));
 const factById = new Map(value.filedFacts.map((item) => [item.id, item]));
 const comparisonById = new Map(value.comparisons.map((item) => [item.id, item]));
 const thresholdById = new Map(
   value.watch.materialityPolicy.thresholds.map((item) => [item.id, item]),
 );
 const authoritativeKinds = new Set([
   "regulator-filing",
   "amended-regulator-filing",
   "regulator-ownership-filing",
   "exchange-notice",
   "issuer-ir-release",
 ]);
 const regulatorKinds = new Set([
   "regulator-filing",
   "amended-regulator-filing",
   "regulator-ownership-filing",
 ]);
 const requiredActions = [
   "connect-trading-account",
   "place-trade-or-order",
   "recommend-buy",
   "recommend-sell",
   "recommend-hold",
   "recommend-allocation",
   "give-tax-advice",
   "give-legal-advice",
   "give-investment-advice",
   "give-accounting-advice",
   "contact-issuer-or-ir",
   "purchase-subscription",
   "submit-or-amend-filing",
   "publish-or-communicate-publicly",
   "disclose-private-output",
   "infer-nonpublic-information",
   "infer-issuer-intent",
   "fabricate-evidence",
 ];
 const findings = [
   ...uniqueFindings(issuerIds, "issuers", "Issuer id"),
   ...uniqueFindings(sourceIds, "sources", "Source id"),
   ...uniqueFindings(
     value.sources.map((item) =>
       [
         item.issuerRef,
         item.accession ?? "",
         item.documentId,
         item.version,
         item.canonicalUrl,
         item.digest,
       ].join("\u0000"),
     ),
     "sources",
     "Source identity",
   ),
   ...uniqueFindings(factIds, "filedFacts", "Filed fact id"),
   ...uniqueFindings(comparisonIds, "comparisons", "Comparison id"),
   ...uniqueFindings(interpretationIds, "interpretations", "Interpretation id"),
   ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
   ...uniqueFindings(gapIds, "gapsAndBlockers", "Gap or blocker id"),
   ...uniqueFindings(thresholdIds, "watch.materialityPolicy.thresholds", "Threshold id"),
 ];

 function periodValid(period) {
   return period === null || Date.parse(`${period.start}T00:00:00Z`) <= Date.parse(`${period.end}T00:00:00Z`);
 }

 function samePeriod(left, right) {
   return left?.start === right?.start && left?.end === right?.end;
 }

 function comparablePeriods(left, right) {
   const duration = (period) =>
     Date.parse(`${period.end}T00:00:00Z`) -
     Date.parse(`${period.start}T00:00:00Z`);
   return Boolean(
     left &&
       right &&
       left.start.slice(5) === right.start.slice(5) &&
       left.end.slice(5) === right.end.slice(5) &&
       Math.abs(duration(left) - duration(right)) <= 2 * 86_400_000,
   );
 }

 function expectedReconciliation(left, right, dimension) {
   if (dimension === "period") {
     if (left.period === null && right.period === null) return "not-applicable";
     return comparablePeriods(left.period, right.period) ? "matched" : "mismatch";
   }
   if (dimension === "amendmentLineage") {
     const lineageState = (fact) =>
       fact.sourceRefs.some((ref) => sourceById.get(ref)?.version === "amended")
         ? "amended"
         : "original";
     return lineageState(left) === lineageState(right) ? "matched" : "mismatch";
   }
   if (left[dimension] === null && right[dimension] === null) return "not-applicable";
   return left[dimension] === right[dimension] ? "matched" : "mismatch";
 }

 function requireReferences(refs, known, path, label) {
   findings.push(
     ...uniqueFindings(refs, path, label),
     ...referenceFindings(refs, known, path, label),
   );
 }

 function requireCompleteReferences(actual, expected, path, label) {
   requireReferences(actual, new Set(expected), path, label);
   for (const id of expected) {
     if (!actual.includes(id)) {
       findings.push(
         finding(
           "incomplete_handoff",
           path,
           `${label} ${JSON.stringify(id)} is missing from the private handoff.`,
         ),
       );
     }
   }
 }

 if (!periodValid(value.watch.baselinePeriod) || !periodValid(value.watch.reviewPeriod)) {
   findings.push(
     finding(
       "invalid_watch_chronology",
       "watch.baselinePeriod",
       "Baseline and review periods must each have an ordered start and end.",
     ),
   );
 }
 if (
   Date.parse(`${value.watch.baselinePeriod.end}T23:59:59Z`) >=
   Date.parse(`${value.watch.reviewPeriod.start}T00:00:00Z`)
 ) {
   findings.push(
     finding(
       "invalid_watch_chronology",
       "watch.reviewPeriod",
       "The review period must begin after the baseline period ends.",
     ),
   );
 }
 if (
   !isSafePackagePath(value.watch.destination) ||
   !value.watch.destination.startsWith("outputs/")
 ) {
   findings.push(
     finding(
       "unsafe_handoff_destination",
       "watch.destination",
       "The private disclosure destination must remain a portable path under outputs/.",
     ),
   );
 }

 const expectedSourceAuthority = {
   "regulator-filing": "regulator",
   "amended-regulator-filing": "regulator",
   "regulator-ownership-filing": "regulator",
   "exchange-notice": "exchange",
   "issuer-ir-release": "issuer",
   news: "news-provider",
   "market-context": "market-data-provider",
 };
 const unsafeQueryKeys =
   /^(?:access[_-]?token|api[_-]?key|auth|code|credential|key|password|secret|token)$/iu;
 for (const [index, source] of value.sources.entries()) {
   requireReferences(
     [source.issuerRef],
     issuerSet,
     `sources.${index}.issuerRef`,
     "Issuer reference",
   );
   if (source.authority !== expectedSourceAuthority[source.kind]) {
     findings.push(
       finding(
         "source_authority_mismatch",
         `sources.${index}.authority`,
         `${source.kind} evidence must use ${expectedSourceAuthority[source.kind]} authority.`,
       ),
     );
   }
   if (
     Date.parse(source.publishedAt) > Date.parse(source.retrievedAt) ||
     Date.parse(source.retrievedAt) > Date.parse(value.watch.asOf)
   ) {
     findings.push(
       finding(
         "invalid_source_chronology",
         `sources.${index}.retrievedAt`,
         "Sources must be published no later than retrieval and retrieved no later than the watch as-of time.",
       ),
     );
   }
   if (!periodValid(source.reportingPeriod)) {
     findings.push(
       finding(
         "invalid_source_period",
         `sources.${index}.reportingPeriod`,
         "Source reporting periods must have an ordered start and end.",
       ),
     );
   }
   try {
     const reference = new URL(source.canonicalUrl);
     const hostname = reference.hostname.toLowerCase().replace(/^\[|\]$/gu, "");
     const unsafeHost =
       /^(?:localhost(?:\.localdomain)?|.+\.localhost|0(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|127(?:\.\d{1,3}){3}|169\.254(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2}|::1|f[cd][0-9a-f:]*|fe[89ab][0-9a-f:]*)$/u.test(
         hostname,
       ) ||
       (() => {
         const match = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/u.exec(hostname);
         return match !== null && Number(match[1]) >= 16 && Number(match[1]) <= 31;
       })();
     const unsafeQuery = [...reference.searchParams.keys()].some((key) =>
       unsafeQueryKeys.test(key),
     ) ||
       [...reference.searchParams.values()].some((value) =>
         /\b(?:access[_-]?token|api[_-]?key|auth|credential|password|secret|token)\s*[:=]/iu.test(
           value,
         ),
       );
     const issuer = issuerById.get(source.issuerRef);
     const domainGroup =
       source.authority === "regulator"
         ? "regulator"
         : source.authority === "exchange"
           ? "exchange"
           : source.authority === "issuer"
             ? "issuer"
             : "context";
     const allowedDomains = issuer?.sourceDomains[domainGroup] ?? [];
     const allowedHost = allowedDomains.some(
       (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
     );
     const secIssuer = /^(?:u\.?s\.?\s+)?(?:securities and exchange commission|sec)$/iu.test(
       issuer?.regulator.trim() ?? "",
     );
     const secSource = regulatorKinds.has(source.kind) && secIssuer;
     const cik = /\bCIK\s*0*(\d+)\b/iu.exec(
       issuer?.regulatorIdentifier ?? "",
     )?.[1];
     const accession = source.accession?.replaceAll("-", "");
     const pathParts = reference.pathname.split("/").filter(Boolean);
     const documentName = pathParts.at(-1)?.replace(/\.[^.]+$/u, "");
     const secPathValid =
       !secSource ||
       (cik !== undefined &&
         accession !== undefined &&
         pathParts.slice(0, 3).join("/").toLowerCase() ===
           "archives/edgar/data" &&
         pathParts[3] === cik &&
         pathParts[4] === accession &&
         documentName === source.documentId);
     if (
       reference.protocol !== "https:" ||
       reference.username ||
       reference.password ||
       reference.hash ||
       unsafeHost ||
       unsafeQuery ||
       !allowedHost ||
       (secSource &&
         ((hostname !== "sec.gov" && !hostname.endsWith(".sec.gov")) ||
           !secPathValid))
     ) {
       throw new Error("unsafe");
     }
   } catch {
     findings.push(
       finding(
         "unsafe_source_reference",
         `sources.${index}.canonicalUrl`,
         "Sources require a canonical credential-free public HTTPS URL without fragments, private hosts, or sensitive query values.",
       ),
     );
   }
   if (
     (regulatorKinds.has(source.kind) && source.accession === null) ||
     (!regulatorKinds.has(source.kind) && source.accession !== null)
   ) {
     findings.push(
       finding(
         "incoherent_accession",
         `sources.${index}.accession`,
         "Regulator filings require an accession and non-regulator disclosures must leave accession null.",
       ),
     );
   }
   if (
     (source.kind === "amended-regulator-filing" &&
       (source.version !== "amended" || source.amendsSourceRef === null)) ||
     (source.kind !== "amended-regulator-filing" &&
       (source.version !== "original" || source.amendsSourceRef !== null))
   ) {
     findings.push(
       finding(
         "incoherent_amendment_state",
         `sources.${index}.amendsSourceRef`,
         "Only amended regulator filings may name an original source, and they must use the amended version state.",
       ),
     );
   }
   if (source.kind === "amended-regulator-filing") {
     requireReferences(
       [source.amendsSourceRef],
       sourceSet,
       `sources.${index}.amendsSourceRef`,
       "Amended source reference",
     );
     const original = sourceById.get(source.amendsSourceRef);
     if (
       !original ||
       original.kind !== "regulator-filing" ||
       original.issuerRef !== source.issuerRef ||
       !samePeriod(original.reportingPeriod, source.reportingPeriod) ||
       Date.parse(original.publishedAt) >= Date.parse(source.publishedAt) ||
       original.accession === source.accession ||
       original.documentId === source.documentId
     ) {
       findings.push(
         finding(
           "invalid_amendment_lineage",
           `sources.${index}.amendsSourceRef`,
           "An amendment must follow a distinct original regulator filing for the same issuer and reporting period.",
         ),
       );
     }
   }
 }

 for (const [index, threshold] of value.watch.materialityPolicy.thresholds.entries()) {
   if (
     (threshold.measure === "qualitative" &&
       (threshold.operator !== "owner-judgment" ||
         threshold.value !== null ||
         threshold.unit !== null ||
         threshold.currency !== null)) ||
     (threshold.measure !== "qualitative" &&
       (threshold.operator !== "gte" ||
         threshold.value === null ||
         threshold.unit === null))
   ) {
     findings.push(
       finding(
         "invalid_materiality_threshold",
         `watch.materialityPolicy.thresholds.${index}`,
         "Qualitative thresholds require owner judgment and no numeric value; numeric thresholds require a gte value and unit.",
       ),
     );
   }
 }

 const amendmentsByOriginal = new Map();
 for (const source of value.sources.filter(
   (item) => item.kind === "amended-regulator-filing",
 )) {
   const amendments = amendmentsByOriginal.get(source.amendsSourceRef) ?? [];
   amendments.push(source);
   amendmentsByOriginal.set(source.amendsSourceRef, amendments);
 }
 const controllingAmendment = new Map();
 for (const [originalId, amendments] of amendmentsByOriginal) {
   const latest = amendments.toSorted(
     (left, right) =>
       Date.parse(right.publishedAt) - Date.parse(left.publishedAt) ||
       right.id.localeCompare(left.id),
   )[0];
   controllingAmendment.set(originalId, latest.id);
   for (const amendment of amendments) {
     controllingAmendment.set(amendment.id, latest.id);
   }
 }
 for (const [index, fact] of value.filedFacts.entries()) {
   requireReferences(
     [fact.issuerRef],
     issuerSet,
     `filedFacts.${index}.issuerRef`,
     "Issuer reference",
   );
   requireReferences(
     fact.sourceRefs,
     sourceSet,
     `filedFacts.${index}.sourceRefs`,
     "Filed fact source reference",
   );
   const factSources = fact.sourceRefs.map((ref) => sourceById.get(ref)).filter(Boolean);
   if (
     factSources.some(
       (source) =>
         !authoritativeKinds.has(source.kind) ||
         source.issuerRef !== fact.issuerRef,
     )
   ) {
     findings.push(
       finding(
         "invalid_filed_fact_source",
         `filedFacts.${index}.sourceRefs`,
         "Filed facts require canonical regulator, exchange, or issuer disclosure sources for the same issuer; news and market context are context only.",
       ),
     );
   }
   if (
     factSources.some(
       (source) =>
         controllingAmendment.has(source.id) &&
         !fact.sourceRefs.includes(controllingAmendment.get(source.id)),
     )
   ) {
     findings.push(
       finding(
         "superseded_filing_evidence",
         `filedFacts.${index}.sourceRefs`,
         "A fact from an amended filing lineage must cite the controlling amendment rather than the superseded original alone.",
       ),
     );
   }
   if (
     fact.period !== null &&
     !factSources.some((source) => samePeriod(source.reportingPeriod, fact.period))
   ) {
     findings.push(
       finding(
         "fact_period_source_mismatch",
         `filedFacts.${index}.period`,
         "A dated filed fact must match the reporting period of at least one authoritative source.",
       ),
     );
   }
   const exactDate =
     fact.valueType === "date" &&
     typeof fact.value === "string" &&
     /^\d{4}-\d{2}-\d{2}$/u.test(fact.value) &&
     !Number.isNaN(Date.parse(`${fact.value}T00:00:00Z`)) &&
     new Date(`${fact.value}T00:00:00Z`).toISOString().slice(0, 10) === fact.value;
   const coherentValue =
     (fact.valueType === "number" && typeof fact.value === "number") ||
     (fact.valueType === "text" && typeof fact.value === "string") ||
     exactDate ||
     (fact.valueType === "boolean" && typeof fact.value === "boolean") ||
     (fact.valueType === "not-reported" && fact.value === null);
   if (!coherentValue) {
     findings.push(
       finding(
         "incoherent_fact_value",
         `filedFacts.${index}.value`,
         "The filed fact value must match its declared value type.",
       ),
     );
   }
   if (
     fact.category === "reported-figure" &&
     (fact.valueType !== "number" ||
       fact.unit === null ||
       fact.currency === null ||
       fact.period === null ||
       fact.accountingBasis === null)
   ) {
     findings.push(
       finding(
         "incomplete_reported_figure",
         `filedFacts.${index}`,
         "Reported figures require a numeric value, unit, currency, period, and accounting basis.",
       ),
     );
   }
   if (
     fact.evidenceState === "confirmed" &&
     (fact.confidence === "low" ||
       factSources.some((source) => source.freshness !== "current"))
   ) {
     findings.push(
       finding(
         "unsupported_confirmed_fact",
         `filedFacts.${index}.evidenceState`,
         "Confirmed filed facts require non-low confidence and current authoritative evidence.",
       ),
     );
   }
 }

 for (const [index, comparison] of value.comparisons.entries()) {
   requireReferences(
     [comparison.issuerRef],
     issuerSet,
     `comparisons.${index}.issuerRef`,
     "Issuer reference",
   );
   requireReferences(
     [comparison.baselineFactRef, comparison.currentFactRef],
     factSet,
     `comparisons.${index}`,
     "Filed fact reference",
   );
   const baseline = factById.get(comparison.baselineFactRef);
   const current = factById.get(comparison.currentFactRef);
   if (!baseline || !current) continue;
   if (
     baseline.id === current.id ||
     baseline.issuerRef !== comparison.issuerRef ||
     current.issuerRef !== comparison.issuerRef
   ) {
     findings.push(
       finding(
         "comparison_issuer_mismatch",
         `comparisons.${index}.issuerRef`,
         "Baseline and current facts must be distinct and belong to the comparison issuer.",
       ),
     );
   }
   if (
     !samePeriod(baseline.period, value.watch.baselinePeriod) ||
     !samePeriod(current.period, value.watch.reviewPeriod)
   ) {
     findings.push(
       finding(
         "comparison_period_scope_mismatch",
         `comparisons.${index}`,
         "Comparison facts must map exactly to the declared baseline and review periods.",
       ),
     );
   }
   const dimensions = [
     "period",
     "unit",
     "currency",
     "accountingBasis",
     "definition",
     "amendmentLineage",
   ];
   const expectedStates = dimensions.map((dimension) => [
     dimension,
     expectedReconciliation(baseline, current, dimension),
   ]);
   for (const [dimension, expected] of expectedStates) {
     if (comparison.reconciliation[dimension] !== expected) {
       findings.push(
         finding(
           "reconciliation_state_mismatch",
           `comparisons.${index}.reconciliation.${dimension}`,
           `The ${dimension} reconciliation must reflect the referenced facts.`,
         ),
       );
     }
   }
   const reconciled = expectedStates.every(([, state]) =>
     ["matched", "not-applicable"].includes(state),
   );
   if (
     (comparison.comparability === "comparable" && !reconciled) ||
     (comparison.comparability !== "comparable" && reconciled)
   ) {
     findings.push(
       finding(
         "invalid_comparability",
         `comparisons.${index}.comparability`,
         "Comparable facts require reconciled period, unit, currency, accounting basis, definition, and amendment lineage; unresolved or mismatched facts must remain noncomparable or blocked.",
       ),
     );
   }
   const numericFacts =
     baseline.valueType === "number" &&
     current.valueType === "number" &&
     typeof baseline.value === "number" &&
     typeof current.value === "number";
   if (comparison.comparability !== "comparable" && comparison.numericDelta !== null) {
     findings.push(
       finding(
         "invented_numeric_delta",
         `comparisons.${index}.numericDelta`,
         "Noncomparable or blocked facts must not carry a numeric delta.",
       ),
     );
   } else if (comparison.comparability === "comparable" && numericFacts) {
     const expectedAbsolute = current.value - baseline.value;
     const expectedPercent =
       baseline.value === 0 ? null : (expectedAbsolute / baseline.value) * 100;
     if (
       comparison.numericDelta === null ||
       !numbersEqual(comparison.numericDelta.absolute, expectedAbsolute) ||
       (expectedPercent === null
         ? comparison.numericDelta.percent !== null
         : comparison.numericDelta.percent === null ||
           !numbersEqual(comparison.numericDelta.percent, expectedPercent))
     ) {
       findings.push(
         finding(
           "numeric_delta_mismatch",
           `comparisons.${index}.numericDelta`,
           "Comparable numeric deltas must equal current minus baseline and the corresponding baseline percentage.",
         ),
       );
     }
   } else if (comparison.numericDelta !== null) {
     findings.push(
       finding(
         "unsupported_numeric_delta",
         `comparisons.${index}.numericDelta`,
         "Only comparable numeric facts may carry a numeric delta.",
       ),
     );
   }
   if (
     comparison.materiality.policyRef !== value.watch.materialityPolicy.id ||
     comparison.materiality.thresholdRef === null ||
     !thresholdSet.has(comparison.materiality.thresholdRef)
   ) {
     findings.push(
       finding(
         "invalid_materiality_policy",
         `comparisons.${index}.materiality`,
         "Every materiality result must reference the declared owner policy and an exact threshold.",
       ),
     );
   } else {
     const threshold = thresholdById.get(comparison.materiality.thresholdRef);
     if (threshold.category !== current.category) {
       findings.push(
         finding(
           "invalid_materiality_policy",
           `comparisons.${index}.materiality.thresholdRef`,
           "The referenced materiality threshold must apply to the compared fact category.",
         ),
       );
     }
     if (
       comparison.comparability === "comparable" &&
       ((threshold.measure === "absolute-change" &&
         (threshold.unit !== current.unit ||
           threshold.currency !== current.currency)) ||
         (threshold.measure === "percent-change" &&
           (threshold.unit !== "percent" || threshold.currency !== null)))
     ) {
       findings.push(
         finding(
           "invalid_materiality_policy",
           `comparisons.${index}.materiality.thresholdRef`,
           "Absolute thresholds must match the fact unit and currency; percent thresholds must use the percent unit and no currency.",
         ),
       );
     }
     const numericThreshold = threshold.measure !== "qualitative";
     const observedNumericMeasure =
       numericFacts &&
       comparison.numericDelta !== null &&
       (threshold.measure !== "percent-change" ||
         comparison.numericDelta.percent !== null);
     if (
       numericThreshold &&
       comparison.comparability === "comparable" &&
       !observedNumericMeasure
     ) {
       findings.push(
         finding(
           "unresolved_numeric_materiality",
           `comparisons.${index}.materiality`,
           "Numeric materiality requires comparable numeric facts and a calculable observed measure; otherwise materiality must remain unresolved.",
         ),
       );
       if (comparison.materiality.state !== "unresolved") {
         findings.push(
           finding(
             "unsupported_materiality_state",
             `comparisons.${index}.materiality.state`,
             "A numeric threshold without a calculable observed measure cannot claim material or not-material.",
           ),
         );
       }
     }
     if (
       numericThreshold &&
       observedNumericMeasure &&
       comparison.comparability === "comparable" &&
       comparison.numericDelta !== null
     ) {
       const observed =
         threshold.measure === "absolute-change"
           ? Math.abs(comparison.numericDelta.absolute)
           : Math.abs(comparison.numericDelta.percent ?? Number.NaN);
       const expectedMaterial = observed >= threshold.value;
       if (
         (expectedMaterial && comparison.materiality.state !== "material") ||
         (!expectedMaterial && comparison.materiality.state !== "not-material")
       ) {
         findings.push(
           finding(
             "materiality_threshold_mismatch",
             `comparisons.${index}.materiality.state`,
             "Numeric materiality must follow the exact owner-declared threshold.",
           ),
         );
       }
     }
   }
   if (
     comparison.comparability !== "comparable" &&
     comparison.materiality.state !== "unresolved"
   ) {
     findings.push(
       finding(
         "unsupported_materiality_state",
         `comparisons.${index}.materiality.state`,
         "Noncomparable or blocked changes must keep materiality unresolved.",
       ),
     );
   }
 }

 for (const [index, item] of value.interpretations.entries()) {
   requireReferences(
     [item.issuerRef],
     issuerSet,
     `interpretations.${index}.issuerRef`,
     "Issuer reference",
   );
   requireReferences(
     item.factRefs,
     factSet,
     `interpretations.${index}.factRefs`,
     "Filed fact reference",
   );
   requireReferences(
     item.comparisonRefs,
     comparisonSet,
     `interpretations.${index}.comparisonRefs`,
     "Comparison reference",
   );
   requireReferences(
     item.sourceRefs,
     sourceSet,
     `interpretations.${index}.sourceRefs`,
     "Context source reference",
   );
   if (
     item.factRefs.some((ref) => factById.get(ref)?.issuerRef !== item.issuerRef) ||
     item.comparisonRefs.some(
       (ref) => comparisonById.get(ref)?.issuerRef !== item.issuerRef,
     ) ||
     item.sourceRefs.some((ref) => sourceById.get(ref)?.issuerRef !== item.issuerRef)
   ) {
     findings.push(
       finding(
         "interpretation_issuer_mismatch",
         `interpretations.${index}`,
         "Interpretation evidence must belong to the named issuer.",
       ),
     );
   }
 }

 for (const [index, question] of value.reviewQuestions.entries()) {
   requireReferences(
     question.issuerRefs,
     issuerSet,
     `reviewQuestions.${index}.issuerRefs`,
     "Issuer reference",
   );
   requireReferences(
     question.factRefs,
     factSet,
     `reviewQuestions.${index}.factRefs`,
     "Filed fact reference",
   );
   requireReferences(
     question.comparisonRefs,
     comparisonSet,
     `reviewQuestions.${index}.comparisonRefs`,
     "Comparison reference",
   );
   const questionIssuerSet = new Set(question.issuerRefs);
   if (
     question.factRefs.some(
       (ref) => !questionIssuerSet.has(factById.get(ref)?.issuerRef),
     ) ||
     question.comparisonRefs.some(
       (ref) => !questionIssuerSet.has(comparisonById.get(ref)?.issuerRef),
     )
   ) {
     findings.push(
       finding(
         "review_question_issuer_mismatch",
         `reviewQuestions.${index}`,
         "Review-question facts and comparisons must belong to one of the question's named issuers.",
       ),
     );
   }
   if (question.owner !== value.watch.owner) {
     findings.push(
       finding(
         "owner_mismatch",
         `reviewQuestions.${index}.owner`,
         "Review questions must remain assigned to the declared watch owner.",
       ),
     );
   }
   if (
     (question.status === "resolved" && !question.resolution?.trim()) ||
     (question.status === "open" && question.resolution !== null)
   ) {
     findings.push(
       finding(
         "incoherent_question_state",
         `reviewQuestions.${index}.resolution`,
         "Resolved questions require a resolution and open questions must leave it null.",
       ),
     );
   }
 }

 for (const [index, item] of value.gapsAndBlockers.entries()) {
   requireReferences(
     item.issuerRefs,
     issuerSet,
     `gapsAndBlockers.${index}.issuerRefs`,
     "Issuer reference",
   );
   requireReferences(
     item.sourceRefs,
     sourceSet,
     `gapsAndBlockers.${index}.sourceRefs`,
     "Source reference",
   );
   requireReferences(
     item.factRefs,
     factSet,
     `gapsAndBlockers.${index}.factRefs`,
     "Filed fact reference",
   );
   requireReferences(
     item.comparisonRefs,
     comparisonSet,
     `gapsAndBlockers.${index}.comparisonRefs`,
     "Comparison reference",
   );
   const itemIssuerSet = new Set(item.issuerRefs);
   if (
     item.sourceRefs.some(
       (ref) => !itemIssuerSet.has(sourceById.get(ref)?.issuerRef),
     ) ||
     item.factRefs.some(
       (ref) => !itemIssuerSet.has(factById.get(ref)?.issuerRef),
     ) ||
     item.comparisonRefs.some(
       (ref) => !itemIssuerSet.has(comparisonById.get(ref)?.issuerRef),
     )
   ) {
     findings.push(
       finding(
         "gap_issuer_mismatch",
         `gapsAndBlockers.${index}`,
         "Gap and blocker evidence must belong to one of the record's named issuers.",
       ),
     );
   }
 }

 if (
   value.watch.materialityPolicy.owner !== value.watch.owner ||
   value.handoff.owner !== value.watch.owner
 ) {
   findings.push(
     finding(
       "owner_mismatch",
       "handoff.owner",
       "The watch, materiality policy, review questions, and handoff must name the same accountable human or team owner.",
     ),
   );
 }
 if (
   /^(?:the )?(?:agent|assistant|claw)$/iu.test(value.watch.owner.trim()) ||
   /\b(?:ai|bot|gpt|language model|public company watcher)\b/iu.test(value.watch.owner)
 ) {
   findings.push(
     finding(
       "agent_owned_authority",
       "watch.owner",
       "Disclosure review, materiality, and handoff authority must remain with a named human or team.",
     ),
   );
 }
 if (
   value.handoff.classification !== value.watch.outputClassification ||
   value.handoff.destination !== value.watch.destination ||
   !isSafePackagePath(value.handoff.destination) ||
   !value.handoff.destination.startsWith("outputs/")
 ) {
   findings.push(
     finding(
       "private_handoff_mismatch",
       "handoff",
       "The handoff must preserve the watch's private classification and portable outputs/ destination.",
     ),
   );
 }

 requireCompleteReferences(value.handoff.issuerRefs, issuerIds, "handoff.issuerRefs", "Issuer");
 requireCompleteReferences(value.handoff.sourceRefs, sourceIds, "handoff.sourceRefs", "Source");
 requireCompleteReferences(value.handoff.factRefs, factIds, "handoff.factRefs", "Filed fact");
 requireCompleteReferences(
   value.handoff.comparisonRefs,
   comparisonIds,
   "handoff.comparisonRefs",
   "Comparison",
 );
 requireCompleteReferences(
   value.handoff.interpretationRefs,
   interpretationIds,
   "handoff.interpretationRefs",
   "Interpretation",
 );
 requireCompleteReferences(
   value.handoff.reviewQuestionRefs,
   questionIds,
   "handoff.reviewQuestionRefs",
   "Review question",
 );
 requireCompleteReferences(
   value.handoff.gapAndBlockerRefs,
   gapIds,
   "handoff.gapAndBlockerRefs",
   "Gap or blocker",
 );

 const openBlockerIds = value.gapsAndBlockers
   .filter((item) => item.kind === "blocker" && item.status === "open")
   .map((item) => item.id);
 requireReferences(
   value.handoff.blockerRefs,
   gapSet,
   "handoff.blockerRefs",
   "Blocker reference",
 );
 if (
   value.handoff.blockerRefs.some(
     (ref) =>
       !openBlockerIds.includes(ref),
   )
 ) {
   findings.push(
     finding(
       "resolved_or_nonblocking_reference",
       "handoff.blockerRefs",
       "Only open blocker records may appear as handoff blockers.",
     ),
   );
 }
 if (
   value.handoff.state === "blocked" &&
   (openBlockerIds.length === 0 ||
     openBlockerIds.some((id) => !value.handoff.blockerRefs.includes(id)))
 ) {
   findings.push(
     finding(
       "incomplete_blocked_handoff",
       "handoff.blockerRefs",
       "Blocked handoffs require every open blocker reference.",
     ),
   );
 }
 if (
   value.handoff.state === "ready-for-owner-review" &&
   (value.watch.state !== "ready" ||
     value.reviewQuestions.some((item) => item.status !== "resolved") ||
     value.gapsAndBlockers.some((item) => item.status !== "resolved") ||
     value.filedFacts.some((item) => item.evidenceState !== "confirmed") ||
     value.comparisons.some(
       (item) =>
         item.comparability !== "comparable" ||
         item.materiality.state === "unresolved",
     ) ||
     value.handoff.blockerRefs.length > 0)
 ) {
   findings.push(
     finding(
       "premature_ready_state",
       "handoff.state",
       "Ready handoffs require a ready watch, confirmed facts, comparable and resolved materiality, resolved questions and gaps, complete references, and no blockers.",
     ),
   );
 }
 if (value.handoff.state === "ready-for-owner-review") {
   for (const issuerId of issuerIds) {
     if (
       !value.sources.some((item) => item.issuerRef === issuerId) ||
       !value.filedFacts.some((item) => item.issuerRef === issuerId) ||
       !value.comparisons.some((item) => item.issuerRef === issuerId)
     ) {
       findings.push(
         finding(
           "missing_issuer_coverage",
           "issuers",
           `Ready disclosure ledgers require source, filed-fact, and comparison coverage for issuer ${JSON.stringify(issuerId)}.`,
         ),
       );
     }
   }
 }
 const expectedHandoffState =
   value.watch.state === "ready"
     ? "ready-for-owner-review"
     : value.watch.state;
 if (value.handoff.state !== expectedHandoffState) {
   findings.push(
     finding(
       "inconsistent_ready_state",
       "handoff.state",
       "Watch and handoff states must remain consistent.",
     ),
   );
 }

 for (const action of requiredActions) {
   if (
     !value.blockedActions.includes(action) ||
     !value.handoff.prohibitedActions.includes(action)
   ) {
     findings.push(
       finding(
         "missing_authority_gate",
         "blockedActions",
         `Company disclosure ledgers must keep ${action} explicitly prohibited.`,
       ),
     );
   }
 }

 const narrativeTexts = [
   ...value.issuers.flatMap((item) => item.watchQuestions),
   ...value.filedFacts.flatMap((item) => [
     item.label,
     typeof item.value === "string" ? item.value : "",
     item.definition,
   ]),
   ...value.comparisons.flatMap((item) => [
     item.changeSummary,
     item.reconciliation.notes,
     item.materiality.rationale,
   ]),
   ...value.interpretations.flatMap((item) => [
     item.summary,
     item.uncertainty,
   ]),
   ...value.reviewQuestions.flatMap((item) => [
     item.question,
     item.resolution ?? "",
   ]),
   ...value.gapsAndBlockers.map((item) => item.description),
 ];
 const prohibitedNarrative =
   /\b(?:buy|sell|hold|trade|place (?:a|an|the)? ?(?:trade|order)|connect (?:a|the)? ?(?:broker|brokerage|trading)? ?account|contact (?:the )?(?:issuer|investor relations|ir team)|subscribe|purchase (?:a )?subscription|submit (?:(?:a|an|the) )?(?:amended )?filing|amend (?:a|the)? ?filing|publish|communicate publicly|disclose (?:the )?private|recommend(?:s|ed|ing)? (?:buying|selling|holding|an? allocation)|(?:buy|sell|hold|allocation) recommendation|(?:tax|legal|investment|accounting) advice|nonpublic information|undisclosed intent|secretly intends?|infer(?:s|red|ring)? (?:issuer |management )?intent|fabricat(?:e|ed|ing)|invent(?:ed|ing)? evidence)\b/iu;
 const negation =
   /\b(?:do not|does not|did not|not|no|never|without|cannot|can't|must not|mustn't|should not|shouldn't|will not|won't)\b/iu;
 if (
   narrativeTexts.some((text) =>
     text
       .replaceAll("’", "'")
       .split(/[.!?]\s*|\s*[;:]\s*|\s*,?\s*\b(?:but|however|yet)\b\s*/iu)
       .some(
         (clause) =>
           prohibitedNarrative.test(clause) && !negation.test(clause),
       ),
   )
 ) {
   findings.push(
     finding(
       "unsafe_narrative_content",
       "interpretations",
       "Disclosure artifacts must not instruct transactions, account connection, issuer contact, subscriptions, filings, publication, private disclosure, professional advice, nonpublic or intent inference, or fabrication.",
     ),
   );
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

function subscriptionManagerFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const subscriptionIds = value.subscriptions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const subscriptionSet = new Set(subscriptionIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(subscriptionIds, "subscriptions", "Subscription id"),
    ...uniqueFindings(value.renewals.map((item) => item.id), "renewals", "Renewal id"),
    ...uniqueFindings(value.usage.map((item) => item.subscriptionRef), "usage", "Usage subscription reference"),
    ...uniqueFindings(value.overlaps.map((item) => item.id), "overlaps", "Overlap id"),
    ...uniqueFindings(value.reviewQuestions.map((item) => item.id), "reviewQuestions", "Review question id"),
  ];
  for (const [index, source] of value.sources.entries()) {
    if (source.kind === "bank-feed" || source.authority === "banking-system") {
      findings.push(finding("bank_source_not_allowed", `sources.${index}`, "Subscription Manager artifacts must not depend on connected bank or card feeds."));
    }
  }
  for (const [index, item] of value.subscriptions.entries()) {
    findings.push(
      ...uniqueFindings(item.sourceRefs, `subscriptions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `subscriptions.${index}.sourceRefs`, "Source reference"),
    );
    if (item.amountState === "supplied" && (item.amount === null || item.currency !== value.portfolio.currency)) {
      findings.push(finding("unsupported_amount_state", `subscriptions.${index}.amount`, "Supplied subscription amounts require a value in the portfolio currency."));
    }
    if (item.amountState !== "supplied" && (item.amount !== null || item.currency !== null)) {
      findings.push(finding("unsupported_amount_state", `subscriptions.${index}.amount`, "Missing or conflicting amounts cannot carry inferred values."));
    }
  }
  for (const [index, renewal] of value.renewals.entries()) {
    findings.push(
      ...referenceFindings([renewal.subscriptionRef], subscriptionSet, `renewals.${index}.subscriptionRef`, "Subscription reference"),
      ...uniqueFindings(renewal.sourceRefs, `renewals.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(renewal.sourceRefs, sourceSet, `renewals.${index}.sourceRefs`, "Source reference"),
    );
    if (
      renewal.windowState === "inside-review-window" &&
      renewal.renewsAt &&
      Date.parse(renewal.renewsAt) > Date.parse(value.portfolio.asOf) + value.portfolio.reviewWindowDays * 24 * 60 * 60 * 1000
    ) {
      findings.push(finding("renewal_window_mismatch", `renewals.${index}.renewsAt`, "Inside-window renewals must fall within the declared review window."));
    }
    if (["increase", "decrease"].includes(renewal.priceChange.state)) {
      if (
        renewal.priceChange.previousAmount === null ||
        renewal.priceChange.newAmount === null ||
        renewal.priceChange.currency !== value.portfolio.currency
      ) {
        findings.push(finding("unsupported_price_change", `renewals.${index}.priceChange`, "Price changes require previous and new amounts in the portfolio currency."));
      }
    }
  }
  for (const [collection, path] of [
    [value.usage, "usage"],
    [value.overlaps, "overlaps"],
    [value.reviewQuestions, "reviewQuestions"],
  ]) {
    for (const [index, item] of collection.entries()) {
      const refs = item.subscriptionRefs ?? [item.subscriptionRef];
      findings.push(
        ...uniqueFindings(refs, `${path}.${index}.subscriptionRefs`, "Subscription reference"),
        ...referenceFindings(refs, subscriptionSet, `${path}.${index}.subscriptionRefs`, "Subscription reference"),
        ...uniqueFindings(item.sourceRefs, `${path}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${path}.${index}.sourceRefs`, "Source reference"),
      );
    }
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready subscription ledgers cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    overlaps: value.overlaps.map(({ summary }) => summary),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(cancel|subscribe|downgrade|upgrade|negotiate|contact vendor|change payment|connect bank|financial advice|save money by)\b/iu.test(actionText)) {
    findings.push(finding("account_action_content", "reviewQuestions", "Subscription review artifacts must not recommend account, payment, vendor-contact, or financial-advice actions."));
  }
  if (value.handoff.owner === "subscription-manager") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Subscription, payment, vendor-contact, calendar, and financial decisions must remain with the named owner."));
  }
  return findings;
}

function wardrobeFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const itemIds = value.items.map((item) => item.id);
  const gapIds = value.gaps.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const itemSet = new Set(itemIds);
  const gapSet = new Set(gapIds);
  const questionSet = new Set(questionIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const itemById = new Map(value.items.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(itemIds, "items", "Item id"),
    ...uniqueFindings(value.outfits.map((item) => item.id), "outfits", "Outfit id"),
    ...uniqueFindings(value.careTasks.map((item) => item.id), "careTasks", "Care task id"),
    ...uniqueFindings(value.packingLists.map((item) => item.id), "packingLists", "Packing list id"),
    ...uniqueFindings(gapIds, "gaps", "Gap id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, item] of value.items.entries()) {
    findings.push(
      ...uniqueFindings(item.sourceRefs, `items.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `items.${index}.sourceRefs`, "Source reference"),
    );
    if (item.fitState === "fits" && item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_fit_state", `items.${index}.sourceRefs`, "Fit-ready wardrobe items require current supplied evidence."));
    }
  }
  for (const [index, outfit] of value.outfits.entries()) {
    findings.push(
      ...uniqueFindings(outfit.itemRefs, `outfits.${index}.itemRefs`, "Item reference"),
      ...referenceFindings(outfit.itemRefs, itemSet, `outfits.${index}.itemRefs`, "Item reference"),
      ...uniqueFindings(outfit.sourceRefs, `outfits.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(outfit.sourceRefs, sourceSet, `outfits.${index}.sourceRefs`, "Source reference"),
    );
    if (outfit.state === "ready-for-review") {
      const blockedItems = outfit.itemRefs.filter((ref) => itemById.get(ref)?.careState !== "ready");
      if (blockedItems.length > 0) {
        findings.push(finding("outfit_blocked_by_care", `outfits.${index}.itemRefs`, "Ready-for-review outfits cannot include items with unresolved care, repair, alteration, or unknown state."));
      }
      if (outfit.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
        findings.push(finding("unsupported_outfit_state", `outfits.${index}.sourceRefs`, "Ready-for-review outfits require current source evidence."));
      }
    }
  }
  for (const [collectionName, collection] of [
    ["careTasks", value.careTasks],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.itemRefs, `${collectionName}.${index}.itemRefs`, "Item reference"),
        ...referenceFindings(item.itemRefs, itemSet, `${collectionName}.${index}.itemRefs`, "Item reference"),
        ...uniqueFindings(item.sourceRefs, `${collectionName}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${collectionName}.${index}.sourceRefs`, "Source reference"),
      );
    }
  }
  for (const [index, list] of value.packingLists.entries()) {
    findings.push(
      ...uniqueFindings(list.itemRefs, `packingLists.${index}.itemRefs`, "Item reference"),
      ...referenceFindings(list.itemRefs, itemSet, `packingLists.${index}.itemRefs`, "Item reference"),
      ...uniqueFindings(list.gapRefs, `packingLists.${index}.gapRefs`, "Gap reference"),
      ...referenceFindings(list.gapRefs, gapSet, `packingLists.${index}.gapRefs`, "Gap reference"),
      ...uniqueFindings(list.sourceRefs, `packingLists.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(list.sourceRefs, sourceSet, `packingLists.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, gap] of value.gaps.entries()) {
    findings.push(
      ...uniqueFindings(gap.sourceRefs, `gaps.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(gap.sourceRefs, sourceSet, `gaps.${index}.sourceRefs`, "Source reference"),
    );
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, questionSet, "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready wardrobe plans cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    items: value.items.map(({ name, fitState, careState }) => ({ name, fitState, careState })),
    outfits: value.outfits.map(({ occasion, state }) => ({ occasion, state })),
    gaps: value.gaps.map(({ need, reason }) => ({ need, reason })),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(buy|purchase|sell|resell|donate|return item|list resale|share photo|post publicly|message tailor|message cleaner|book service|schedule pickup|change account|infer body|body shape|body size|weight|health condition|pregnancy|gender identity|medical advice|legal advice)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Wardrobe artifacts must not instruct purchases, sales, donations, returns, resale listings, photo sharing, public posts, messages, bookings, pickups, account changes, body or health inference, or professional advice."));
  }
  if (value.handoff.owner === "wardrobe-organizer") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Wardrobe purchase, resale, donation, photo, account, body-adjacent, care, alteration, and disclosure decisions must remain with the named owner."));
  }
  return findings;
}

function medicalAppointmentFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const appointmentIds = value.appointments.map((item) => item.id);
  const appointmentSet = new Set(appointmentIds);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const questionSet = new Set(questionIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(appointmentIds, "appointments", "Appointment id"),
    ...uniqueFindings(value.concerns.map((item) => item.id), "concerns", "Concern id"),
    ...uniqueFindings(value.medications.map((item) => item.id), "medications", "Medication id"),
    ...uniqueFindings(value.priorInstructions.map((item) => item.id), "priorInstructions", "Prior instruction id"),
    ...uniqueFindings(value.documents.map((item) => item.id), "documents", "Document id"),
    ...uniqueFindings(value.logistics.map((item) => item.id), "logistics", "Logistics id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, appointment] of value.appointments.entries()) {
    findings.push(
      ...uniqueFindings(appointment.sourceRefs, `appointments.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(appointment.sourceRefs, sourceSet, `appointments.${index}.sourceRefs`, "Source reference"),
    );
    if (appointment.preparationState === "ready-for-owner-review" && appointment.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_preparation_state", `appointments.${index}.sourceRefs`, "Ready appointment packets require current source evidence."));
    }
  }
  for (const [collectionName, collection] of [
    ["concerns", value.concerns],
    ["priorInstructions", value.priorInstructions],
    ["documents", value.documents],
    ["logistics", value.logistics],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.appointmentRefs, `${collectionName}.${index}.appointmentRefs`, "Appointment reference"),
        ...referenceFindings(item.appointmentRefs, appointmentSet, `${collectionName}.${index}.appointmentRefs`, "Appointment reference"),
        ...uniqueFindings(item.sourceRefs, `${collectionName}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${collectionName}.${index}.sourceRefs`, "Source reference"),
      );
    }
  }
  for (const [index, med] of value.medications.entries()) {
    findings.push(
      ...uniqueFindings(med.sourceRefs, `medications.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(med.sourceRefs, sourceSet, `medications.${index}.sourceRefs`, "Source reference"),
    );
    if (med.freshness === "current" && med.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_medication_freshness", `medications.${index}.sourceRefs`, "Current medication lists require current source evidence."));
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, questionSet, "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready appointment packets cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    concerns: value.concerns.map(({ label, ownerReported }) => ({ label, ownerReported })),
    priorInstructions: value.priorInstructions.map(({ label }) => label),
    documents: value.documents.map(({ label }) => label),
    logistics: value.logistics.map(({ note }) => note),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(diagnos(?:e|is)|triage|recommend treatment|treatment recommendation|change med(?:ication)?s?|change medication|advise dosage|dosage advice|interpret test results?|decide urgency|urgent decision|emergency determination|schedule appointments?|cancel appointments?|message providers?|contact providers?|submit portal forms?|portal submission|upload records?|pay bills?|file insurance claims?|contact insurers?|billing advice|insurance advice|medical advice|legal advice)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Medical appointment packets must not instruct diagnosis, triage, treatment, medication, scheduling, provider-contact, portal, upload, billing, insurance, legal, or emergency actions."));
  }
  if (value.handoff.owner === "medical-appointment-prep") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Clinical, scheduling, provider-contact, portal, billing, insurance, legal, and emergency authority must remain with the named owner or qualified humans."));
  }
  return findings;
}

function healthRecordsFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const recordIds = value.records.map((item) => item.id);
  const recordSet = new Set(recordIds);
  const timelineIds = value.timeline.map((item) => item.id);
  const medIds = value.medicationReview.map((item) => item.id);
  const packetIds = value.sharingPackets.map((item) => item.id);
  const gapIds = value.gaps.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const crossRefs = new Set([
    ...sourceIds,
    ...recordIds,
    ...timelineIds,
    ...medIds,
    ...packetIds,
    ...gapIds,
    ...questionIds,
  ]);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(recordIds, "records", "Record id"),
    ...uniqueFindings(timelineIds, "timeline", "Timeline id"),
    ...uniqueFindings(medIds, "medicationReview", "Medication review id"),
    ...uniqueFindings(packetIds, "sharingPackets", "Sharing packet id"),
    ...uniqueFindings(gapIds, "gaps", "Gap id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, record] of value.records.entries()) {
    findings.push(
      ...uniqueFindings(record.sourceRefs, `records.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(record.sourceRefs, sourceSet, `records.${index}.sourceRefs`, "Source reference"),
    );
    if (record.dateState === "known" && !record.date) {
      findings.push(finding("missing_record_date", `records.${index}.date`, "Known health record dates must include the supplied date."));
    }
    if (
      record.privacy === "shareable-after-review" &&
      record.sourceRefs.some((ref) => ["owner-only", "dependent-sensitive", "redact-before-sharing"].includes(sourceById.get(ref)?.privacy))
    ) {
      findings.push(finding("unsafe_record_privacy", `records.${index}.privacy`, "Records cannot be marked shareable when any supporting source still requires owner-only, dependent-sensitive, or redaction review."));
    }
  }
  for (const [index, item] of value.timeline.entries()) {
    findings.push(
      ...uniqueFindings(item.recordRefs, `timeline.${index}.recordRefs`, "Record reference"),
      ...referenceFindings(item.recordRefs, recordSet, `timeline.${index}.recordRefs`, "Record reference"),
      ...uniqueFindings(item.sourceRefs, `timeline.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `timeline.${index}.sourceRefs`, "Source reference"),
    );
    if (item.state === "current" && item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_timeline_state", `timeline.${index}.sourceRefs`, "Current timeline items require current source evidence."));
    }
  }
  for (const [index, item] of value.medicationReview.entries()) {
    findings.push(
      ...uniqueFindings(item.recordRefs, `medicationReview.${index}.recordRefs`, "Record reference"),
      ...referenceFindings(item.recordRefs, recordSet, `medicationReview.${index}.recordRefs`, "Record reference"),
      ...uniqueFindings(item.sourceRefs, `medicationReview.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `medicationReview.${index}.sourceRefs`, "Source reference"),
    );
    if (item.freshness === "current" && item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_medication_freshness", `medicationReview.${index}.sourceRefs`, "Current medication review entries require current source evidence."));
    }
  }
  for (const [index, item] of value.sharingPackets.entries()) {
    findings.push(
      ...uniqueFindings(item.recordRefs, `sharingPackets.${index}.recordRefs`, "Record reference"),
      ...referenceFindings(item.recordRefs, recordSet, `sharingPackets.${index}.recordRefs`, "Record reference"),
      ...uniqueFindings(item.sourceRefs, `sharingPackets.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `sharingPackets.${index}.sourceRefs`, "Source reference"),
    );
    if (item.reviewState === "ready-for-owner-review" && item.privacyState !== "owner-approved") {
      findings.push(finding("unapproved_sharing_packet", `sharingPackets.${index}.privacyState`, "Ready sharing packets require explicit owner-approved privacy state."));
    }
    if (
      item.privacyState === "owner-approved" &&
      item.sourceRefs.some((ref) => ["owner-only", "dependent-sensitive", "redact-before-sharing"].includes(sourceById.get(ref)?.privacy))
    ) {
      findings.push(finding("unsafe_sharing_privacy", `sharingPackets.${index}.sourceRefs`, "Sharing packets cannot be owner-approved while any supporting source still requires redaction, owner-only handling, or dependent-sensitive handling."));
    }
  }
  for (const [collectionName, collection] of [
    ["gaps", value.gaps],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.refs, `${collectionName}.${index}.refs`, "Reference"),
        ...referenceFindings(item.refs, crossRefs, `${collectionName}.${index}.refs`, "Reference"),
      );
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, new Set(questionIds), "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting", "sensitive"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready health records binders cannot depend on stale, missing, conflicting, or sensitive sources."));
  }
  const actionText = canonicalJson({
    timeline: value.timeline.map(({ summary }) => summary),
    medicationReview: value.medicationReview.map(({ label, ownerQuestion }) => ({ label, ownerQuestion })),
    sharingPackets: value.sharingPackets.map(({ purpose }) => purpose),
    gaps: value.gaps.map(({ reason }) => reason),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(diagnos(?:e|is)|triage|recommend treatment|treatment recommendation|interpret results?|interpret test results?|change med(?:ication)?s?|change medication|advise dosage|dosage advice|decide urgency|urgent decision|emergency advice|message providers?|contact providers?|submit portal forms?|portal submission|upload records?|share phi|share protected health|schedule appointments?|pay bills?|file insurance claims?|contact insurers?|change accounts?|billing advice|insurance advice|medical advice|legal advice)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Health records binders must not instruct diagnosis, triage, treatment, result interpretation, medication, portal, provider-contact, upload, PHI-sharing, scheduling, billing, insurance, account, legal, or emergency actions."));
  }
  if (value.handoff.owner === "health-records-binder") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Clinical, portal, provider-contact, upload, PHI-sharing, scheduling, billing, insurance, account, legal, and emergency authority must remain with the named owner or qualified humans."));
  }
  return findings;
}

function benefitsEnrollmentFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const windowIds = value.windows.map((item) => item.id);
  const optionIds = value.options.map((item) => item.id);
  const dependentIds = value.dependentRequirements.map((item) => item.id);
  const costIds = value.costNotes.map((item) => item.id);
  const costSet = new Set(costIds);
  const changeIds = value.coverageChanges.map((item) => item.id);
  const changeSet = new Set(changeIds);
  const gapIds = value.gaps.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const crossRefs = new Set([
    ...sourceIds,
    ...windowIds,
    ...optionIds,
    ...dependentIds,
    ...costIds,
    ...changeIds,
    ...gapIds,
    ...questionIds,
  ]);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(windowIds, "windows", "Window id"),
    ...uniqueFindings(optionIds, "options", "Option id"),
    ...uniqueFindings(dependentIds, "dependentRequirements", "Dependent requirement id"),
    ...uniqueFindings(costIds, "costNotes", "Cost note id"),
    ...uniqueFindings(changeIds, "coverageChanges", "Coverage change id"),
    ...uniqueFindings(gapIds, "gaps", "Gap id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, item] of value.windows.entries()) {
    findings.push(
      ...uniqueFindings(item.sourceRefs, `windows.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `windows.${index}.sourceRefs`, "Source reference"),
    );
    if (Date.parse(item.closesAt) <= Date.parse(item.opensAt)) {
      findings.push(finding("invalid_enrollment_window", `windows.${index}.closesAt`, "Enrollment windows must close after they open."));
    }
    if (["open", "closing-soon", "future"].includes(item.state) && item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_window_state", `windows.${index}.sourceRefs`, "Active or future enrollment windows require current source evidence."));
    }
  }
  for (const [index, item] of value.options.entries()) {
    findings.push(
      ...uniqueFindings(item.costRefs, `options.${index}.costRefs`, "Cost reference"),
      ...referenceFindings(item.costRefs, costSet, `options.${index}.costRefs`, "Cost reference"),
      ...uniqueFindings(item.coverageChangeRefs, `options.${index}.coverageChangeRefs`, "Coverage change reference"),
      ...referenceFindings(item.coverageChangeRefs, changeSet, `options.${index}.coverageChangeRefs`, "Coverage change reference"),
      ...uniqueFindings(item.sourceRefs, `options.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `options.${index}.sourceRefs`, "Source reference"),
    );
    if (item.status === "available" && item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_option_status", `options.${index}.sourceRefs`, "Available benefit options require current source evidence."));
    }
  }
  for (const [collectionName, collection] of [
    ["dependentRequirements", value.dependentRequirements],
    ["costNotes", value.costNotes],
    ["coverageChanges", value.coverageChanges],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.sourceRefs, `${collectionName}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${collectionName}.${index}.sourceRefs`, "Source reference"),
      );
      if (
        ["complete", "supplied", "confirmed"].includes(item.state ?? item.amountState) &&
        item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
      ) {
        findings.push(finding("unsupported_ready_item", `${collectionName}.${index}.sourceRefs`, "Complete, supplied, or confirmed benefits items require current source evidence."));
      }
    }
  }
  for (const [collectionName, collection] of [
    ["gaps", value.gaps],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.refs, `${collectionName}.${index}.refs`, "Reference"),
        ...referenceFindings(item.refs, crossRefs, `${collectionName}.${index}.refs`, "Reference"),
      );
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, new Set(questionIds), "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting", "sensitive"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready benefits packets cannot depend on stale, missing, conflicting, or sensitive sources."));
  }
  const actionText = canonicalJson({
    options: value.options.map(({ label, status }) => ({ label, status })),
    dependentRequirements: value.dependentRequirements.map(({ label, state }) => ({ label, state })),
    costNotes: value.costNotes.map(({ label, payrollImpact }) => ({ label, payrollImpact })),
    coverageChanges: value.coverageChanges.map(({ label, state }) => ({ label, state })),
    gaps: value.gaps.map(({ reason }) => reason),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(choose plans?|choose benefits?|recommend coverage|submit elections?|change payroll|enroll dependents?|certify eligibility|file claims?|contact employers?|contact carriers?|pay premiums?|change accounts?|medical advice|legal advice|tax advice|financial advice|insurance advice|employment advice|benefits advice|eligibility advice)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Benefits enrollment artifacts must not instruct plan choice, coverage recommendations, election submission, payroll changes, dependent enrollment, eligibility certification, claims, employer or carrier contact, premium payments, account changes, or professional advice."));
  }
  if (value.handoff.owner === "benefits-open-enrollment-planner") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Benefits election, payroll, dependent, eligibility, claim, contact, payment, account, and professional-advice authority must remain with the named owner."));
  }
  return findings;
}

function certificationRenewalFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const credentialIds = value.credentials.map((item) => item.id);
  const credentialSet = new Set(credentialIds);
  const requirementIds = value.requirements.map((item) => item.id);
  const requirementSet = new Set(requirementIds);
  const evidenceIds = value.evidenceItems.map((item) => item.id);
  const riskIds = value.deadlineRisks.map((item) => item.id);
  const gapIds = value.gaps.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const crossRefs = new Set([
    ...sourceIds,
    ...credentialIds,
    ...requirementIds,
    ...evidenceIds,
    ...riskIds,
    ...gapIds,
    ...questionIds,
  ]);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(credentialIds, "credentials", "Credential id"),
    ...uniqueFindings(requirementIds, "requirements", "Requirement id"),
    ...uniqueFindings(evidenceIds, "evidenceItems", "Evidence id"),
    ...uniqueFindings(riskIds, "deadlineRisks", "Deadline risk id"),
    ...uniqueFindings(gapIds, "gaps", "Gap id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, credential] of value.credentials.entries()) {
    findings.push(
      ...uniqueFindings(credential.sourceRefs, `credentials.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(credential.sourceRefs, sourceSet, `credentials.${index}.sourceRefs`, "Source reference"),
    );
    if (
      credential.status === "current" &&
      credential.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
    ) {
      findings.push(finding("unsupported_credential_state", `credentials.${index}.sourceRefs`, "Current credential status requires current issuer or owner-supplied evidence."));
    }
  }
  for (const [index, requirement] of value.requirements.entries()) {
    findings.push(
      ...referenceFindings([requirement.credentialRef], credentialSet, `requirements.${index}.credentialRef`, "Credential reference"),
      ...uniqueFindings(requirement.sourceRefs, `requirements.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(requirement.sourceRefs, sourceSet, `requirements.${index}.sourceRefs`, "Source reference"),
    );
    if (
      requirement.state === "satisfied" &&
      requirement.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
    ) {
      findings.push(finding("unsupported_requirement_state", `requirements.${index}.sourceRefs`, "Satisfied renewal requirements require current source evidence."));
    }
  }
  for (const [index, item] of value.evidenceItems.entries()) {
    findings.push(
      ...uniqueFindings(item.requirementRefs, `evidenceItems.${index}.requirementRefs`, "Requirement reference"),
      ...referenceFindings(item.requirementRefs, requirementSet, `evidenceItems.${index}.requirementRefs`, "Requirement reference"),
      ...uniqueFindings(item.sourceRefs, `evidenceItems.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `evidenceItems.${index}.sourceRefs`, "Source reference"),
    );
    if (
      item.state === "available" &&
      item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
    ) {
      findings.push(finding("unsupported_evidence_state", `evidenceItems.${index}.sourceRefs`, "Available renewal evidence requires current source evidence."));
    }
  }
  for (const [index, risk] of value.deadlineRisks.entries()) {
    findings.push(
      ...referenceFindings([risk.credentialRef], credentialSet, `deadlineRisks.${index}.credentialRef`, "Credential reference"),
      ...uniqueFindings(risk.sourceRefs, `deadlineRisks.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(risk.sourceRefs, sourceSet, `deadlineRisks.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [collectionName, collection] of [
    ["gaps", value.gaps],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.refs, `${collectionName}.${index}.refs`, "Reference"),
        ...referenceFindings(item.refs, crossRefs, `${collectionName}.${index}.refs`, "Reference"),
      );
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, new Set(questionIds), "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting", "sensitive"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready certification renewal packets cannot depend on stale, missing, conflicting, or sensitive sources."));
  }
  const actionText = canonicalJson({
    credentials: value.credentials.map(({ name, issuer, status }) => ({ name, issuer, status })),
    requirements: value.requirements.map(({ label, state }) => ({ label, state })),
    evidenceItems: value.evidenceItems.map(({ label, state }) => ({ label, state })),
    deadlineRisks: value.deadlineRisks.map(({ reason }) => reason),
    gaps: value.gaps.map(({ reason }) => reason),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(submit renewals?|pay fees?|contact issuers?|change accounts?|schedule exams?|enroll (?:in )?courses?|claim validity|claim compliance|issue certificates?|change employer records?|legal advice|compliance advice|education advice|employment advice|tax advice|immigration advice|financial advice|professional advice)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Certification renewal artifacts must not instruct filing, payment, issuer contact, account changes, exam scheduling, course enrollment, validity or compliance claims, certificate issuance, employer-record changes, or professional advice."));
  }
  if (value.handoff.owner === "certification-renewal-planner") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Renewal, payment, issuer-contact, account, exam, course, validity, compliance, certificate, employer-record, and professional-advice authority must remain with the named owner."));
  }
  return findings;
}

function warrantyReturnsFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const itemIds = value.items.map((item) => item.id);
  const itemSet = new Set(itemIds);
  const returnIds = value.returnWindows.map((item) => item.id);
  const termIds = value.warrantyTerms.map((item) => item.id);
  const issueIds = value.issuePackets.map((item) => item.id);
  const gapIds = value.gaps.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const crossRefs = new Set([
    ...sourceIds,
    ...itemIds,
    ...returnIds,
    ...termIds,
    ...issueIds,
    ...gapIds,
    ...questionIds,
  ]);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(itemIds, "items", "Item id"),
    ...uniqueFindings(returnIds, "returnWindows", "Return window id"),
    ...uniqueFindings(termIds, "warrantyTerms", "Warranty term id"),
    ...uniqueFindings(issueIds, "issuePackets", "Issue packet id"),
    ...uniqueFindings(gapIds, "gaps", "Gap id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, item] of value.items.entries()) {
    findings.push(
      ...uniqueFindings(item.sourceRefs, `items.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `items.${index}.sourceRefs`, "Source reference"),
    );
    if (item.purchaseState === "supported" && item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_purchase_state", `items.${index}.sourceRefs`, "Supported purchase states require current source evidence."));
    }
  }
  for (const [index, item] of value.returnWindows.entries()) {
    findings.push(
      ...referenceFindings([item.itemRef], itemSet, `returnWindows.${index}.itemRef`, "Item reference"),
      ...uniqueFindings(item.sourceRefs, `returnWindows.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(item.sourceRefs, sourceSet, `returnWindows.${index}.sourceRefs`, "Source reference"),
    );
    if (Date.parse(item.closesAt) <= Date.parse(item.opensAt)) {
      findings.push(finding("invalid_return_window", `returnWindows.${index}.closesAt`, "Return windows must close after they open."));
    }
    if (["open", "closing-soon"].includes(item.state) && item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_return_state", `returnWindows.${index}.sourceRefs`, "Open return windows require current source evidence."));
    }
  }
  for (const [collectionName, collection] of [
    ["warrantyTerms", value.warrantyTerms],
    ["issuePackets", value.issuePackets],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...referenceFindings([item.itemRef], itemSet, `${collectionName}.${index}.itemRef`, "Item reference"),
        ...uniqueFindings(item.sourceRefs, `${collectionName}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${collectionName}.${index}.sourceRefs`, "Source reference"),
      );
      if (
        ["supported", "ready-for-owner-review"].includes(item.state ?? item.readiness) &&
        item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
      ) {
        findings.push(finding("unsupported_ready_item", `${collectionName}.${index}.sourceRefs`, "Supported warranty terms and ready issue packets require current source evidence."));
      }
    }
  }
  for (const [collectionName, collection] of [
    ["gaps", value.gaps],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.refs, `${collectionName}.${index}.refs`, "Reference"),
        ...referenceFindings(item.refs, crossRefs, `${collectionName}.${index}.refs`, "Reference"),
      );
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, new Set(questionIds), "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting", "sensitive"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready warranty packets cannot depend on stale, missing, conflicting, or sensitive sources."));
  }
  const actionText = canonicalJson({
    items: value.items.map(({ label, purchaseState, serialState, conditionState }) => ({ label, purchaseState, serialState, conditionState })),
    returnWindows: value.returnWindows.map(({ label, state }) => ({ label, state })),
    warrantyTerms: value.warrantyTerms.map(({ label, state }) => ({ label, state })),
    issuePackets: value.issuePackets.map(({ label, readiness }) => ({ label, readiness })),
    gaps: value.gaps.map(({ reason }) => reason),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(initiate returns?|start returns?|file warranty claims?|submit claims?|contact sellers?|contact manufacturers?|contact carriers?|create shipping labels?|request refunds?|dispute charges?|change accounts?|order replacements?|schedule repairs?|sell item|donate item|discard item|dispose|legal advice|financial advice|tax advice|safety advice|repair advice|warranty advice|insurance advice|consumer-rights advice)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Warranty artifacts must not instruct returns, claims, contacts, labels, refunds, chargebacks, account changes, replacements, repairs, disposal, resale, donation, or professional advice."));
  }
  if (value.handoff.owner === "warranty-returns-manager") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Return, warranty, contact, shipping, refund, chargeback, account, replacement, repair, disposal, resale, donation, and professional-advice authority must remain with the named owner."));
  }
  return findings;
}

function documentRenewalFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const documentIds = value.documents.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const documentSet = new Set(documentIds);
  const questionSet = new Set(questionIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(documentIds, "documents", "Document id"),
    ...uniqueFindings(value.renewalWindows.map((item) => item.id), "renewalWindows", "Renewal window id"),
    ...uniqueFindings(value.materials.map((item) => item.id), "materials", "Material id"),
    ...uniqueFindings(value.conflicts.map((item) => item.id), "conflicts", "Conflict id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, doc] of value.documents.entries()) {
    findings.push(
      ...uniqueFindings(doc.sourceRefs, `documents.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(doc.sourceRefs, sourceSet, `documents.${index}.sourceRefs`, "Source reference"),
    );
    if (["current", "renew-soon"].includes(doc.expirationState) && doc.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_expiration_state", `documents.${index}.sourceRefs`, "Current or renew-soon document states require current source evidence."));
    }
  }
  for (const [index, window] of value.renewalWindows.entries()) {
    findings.push(
      ...referenceFindings([window.documentRef], documentSet, `renewalWindows.${index}.documentRef`, "Document reference"),
      ...uniqueFindings(window.sourceRefs, `renewalWindows.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(window.sourceRefs, sourceSet, `renewalWindows.${index}.sourceRefs`, "Source reference"),
    );
    if (Date.parse(window.dueAt) <= Date.parse(window.opensAt)) {
      findings.push(finding("invalid_renewal_window", `renewalWindows.${index}.dueAt`, "Renewal windows must be due after they open."));
    }
    if (["review-soon", "urgent"].includes(window.urgency) && window.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_urgency", `renewalWindows.${index}.sourceRefs`, "Urgent or review-soon renewal windows require current source evidence."));
    }
  }
  for (const [collectionName, collection] of [
    ["materials", value.materials],
    ["conflicts", value.conflicts],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      const refs = item.documentRefs ?? [item.documentRef];
      findings.push(
        ...uniqueFindings(refs, `${collectionName}.${index}.documentRefs`, "Document reference"),
        ...referenceFindings(refs, documentSet, `${collectionName}.${index}.documentRefs`, "Document reference"),
        ...uniqueFindings(item.sourceRefs, `${collectionName}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${collectionName}.${index}.sourceRefs`, "Source reference"),
      );
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, questionSet, "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready renewal ledgers cannot depend on stale, missing, or conflicting sources."));
  }
  const actionText = canonicalJson({
    conflicts: value.conflicts.map(({ reason }) => reason),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(file forms?|submit documents?|pay fees?|book appointments?|contact agenc(?:y|ies)|change accounts?|upload documents?|certify eligibility|legal advice|immigration advice|tax advice|medical advice|licensing advice|identity decision)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Document renewal artifacts must not instruct filing, submission, payment, appointment booking, agency contact, uploads, account changes, eligibility certification, or professional advice."));
  }
  if (value.handoff.owner === "document-renewal-tracker") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Renewal, filing, payment, appointment, account, upload, eligibility, legal, immigration, tax, medical, licensing, and identity authority must remain with the named owner."));
  }
  return findings;
}

function jobApplicationFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const applicationIds = value.applications.map((item) => item.id);
  const applicationSet = new Set(applicationIds);
  const materialIds = value.materials.map((item) => item.id);
  const interviewIds = value.interviews.map((item) => item.id);
  const followupIds = value.followUps.map((item) => item.id);
  const offerIds = value.offerQuestions.map((item) => item.id);
  const gapIds = value.gaps.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const crossRefs = new Set([
    ...sourceIds,
    ...applicationIds,
    ...materialIds,
    ...interviewIds,
    ...followupIds,
    ...offerIds,
    ...gapIds,
    ...questionIds,
  ]);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(applicationIds, "applications", "Application id"),
    ...uniqueFindings(materialIds, "materials", "Material id"),
    ...uniqueFindings(interviewIds, "interviews", "Interview id"),
    ...uniqueFindings(followupIds, "followUps", "Follow-up id"),
    ...uniqueFindings(offerIds, "offerQuestions", "Offer question id"),
    ...uniqueFindings(gapIds, "gaps", "Gap id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, application] of value.applications.entries()) {
    findings.push(
      ...uniqueFindings(application.sourceRefs, `applications.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(application.sourceRefs, sourceSet, `applications.${index}.sourceRefs`, "Source reference"),
    );
    if (
      application.status === "ready-for-owner-review" &&
      application.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
    ) {
      findings.push(finding("unsupported_application_state", `applications.${index}.sourceRefs`, "Owner-ready applications require current source evidence."));
    }
  }
  for (const [collectionName, collection] of [
    ["materials", value.materials],
    ["interviews", value.interviews],
    ["followUps", value.followUps],
    ["offerQuestions", value.offerQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...referenceFindings([item.applicationRef], applicationSet, `${collectionName}.${index}.applicationRef`, "Application reference"),
        ...uniqueFindings(item.sourceRefs, `${collectionName}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${collectionName}.${index}.sourceRefs`, "Source reference"),
      );
      if (
        ["supplied", "scheduled-by-owner", "sent-by-owner", "answered-by-owner"].includes(item.state) &&
        item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
      ) {
        findings.push(finding("unsupported_ready_item", `${collectionName}.${index}.sourceRefs`, "Supplied, scheduled, sent, or answered job-search items require current source evidence."));
      }
    }
  }
  for (const [collectionName, collection] of [
    ["gaps", value.gaps],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.refs, `${collectionName}.${index}.refs`, "Reference"),
        ...referenceFindings(item.refs, crossRefs, `${collectionName}.${index}.refs`, "Reference"),
      );
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, new Set(questionIds), "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting", "sensitive"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready job-search packets cannot depend on stale, missing, conflicting, or sensitive sources."));
  }
  const actionText = canonicalJson({
    applications: value.applications.map(({ role, company, status, priority }) => ({ role, company, status, priority })),
    materials: value.materials.map(({ label, state }) => ({ label, state })),
    interviews: value.interviews.map(({ label, state }) => ({ label, state })),
    followUps: value.followUps.map(({ label, state }) => ({ label, state })),
    offerQuestions: value.offerQuestions.map(({ question, state }) => ({ question, state })),
    gaps: value.gaps.map(({ reason }) => reason),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(submit applications?|upload resumes?|message recruiters?|contact employers?|schedule interviews?|cancel interviews?|change accounts?|fabricate|fake credential|accept offers?|reject offers?|negotiate terms?|legal advice|immigration advice|tax advice|financial advice|employment advice|career advice|salary advice|benefits advice|relocation advice)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Job application artifacts must not instruct submissions, uploads, recruiter or employer contact, scheduling, account changes, credential fabrication, offer decisions, negotiation, or professional advice."));
  }
  if (value.handoff.owner === "job-application-tracker") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Application, upload, contact, scheduling, account, credential, offer, negotiation, and professional-advice authority must remain with the named owner."));
  }
  return findings;
}

function resumePortfolioFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const claimIds = value.claims.map((item) => item.id);
  const claimSet = new Set(claimIds);
  const claimById = new Map(value.claims.map((item) => [item.id, item]));
  const materialIds = value.materials.map((item) => item.id);
  const materialSet = new Set(materialIds);
  const fitIds = value.roleFits.map((item) => item.id);
  const redactionIds = value.redactions.map((item) => item.id);
  const gapIds = value.gaps.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const crossRefs = new Set([
    ...sourceIds,
    ...claimIds,
    ...materialIds,
    ...fitIds,
    ...redactionIds,
    ...gapIds,
    ...questionIds,
  ]);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(claimIds, "claims", "Claim id"),
    ...uniqueFindings(materialIds, "materials", "Material id"),
    ...uniqueFindings(fitIds, "roleFits", "Role-fit id"),
    ...uniqueFindings(redactionIds, "redactions", "Redaction id"),
    ...uniqueFindings(gapIds, "gaps", "Gap id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, claim] of value.claims.entries()) {
    findings.push(
      ...uniqueFindings(claim.sourceRefs, `claims.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(claim.sourceRefs, sourceSet, `claims.${index}.sourceRefs`, "Source reference"),
    );
    if (
      claim.state === "supported" &&
      claim.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
    ) {
      findings.push(finding("unsupported_claim_state", `claims.${index}.sourceRefs`, "Supported resume and portfolio claims require current source evidence."));
    }
  }
  for (const [index, material] of value.materials.entries()) {
    findings.push(
      ...uniqueFindings(material.claimRefs, `materials.${index}.claimRefs`, "Claim reference"),
      ...referenceFindings(material.claimRefs, claimSet, `materials.${index}.claimRefs`, "Claim reference"),
      ...uniqueFindings(material.sourceRefs, `materials.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(material.sourceRefs, sourceSet, `materials.${index}.sourceRefs`, "Source reference"),
    );
    if (
      material.state === "ready-for-owner-review" &&
      (material.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current") ||
        material.claimRefs.some((ref) => !["supported", "needs-owner-review"].includes(claimById.get(ref)?.state)))
    ) {
      findings.push(finding("unsupported_material_state", `materials.${index}`, "Owner-ready career materials require current sources and supported or owner-review claims."));
    }
  }
  for (const [index, fit] of value.roleFits.entries()) {
    findings.push(
      ...uniqueFindings(fit.claimRefs, `roleFits.${index}.claimRefs`, "Claim reference"),
      ...referenceFindings(fit.claimRefs, claimSet, `roleFits.${index}.claimRefs`, "Claim reference"),
      ...uniqueFindings(fit.materialRefs, `roleFits.${index}.materialRefs`, "Material reference"),
      ...referenceFindings(fit.materialRefs, materialSet, `roleFits.${index}.materialRefs`, "Material reference"),
    );
    if (
      fit.state === "supported" &&
      fit.claimRefs.some((ref) => claimById.get(ref)?.state !== "supported")
    ) {
      findings.push(finding("unsupported_role_fit", `roleFits.${index}.claimRefs`, "Supported role-fit statements require supported claims."));
    }
  }
  for (const [collectionName, collection] of [
    ["redactions", value.redactions],
    ["gaps", value.gaps],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.refs, `${collectionName}.${index}.refs`, "Reference"),
        ...referenceFindings(item.refs, crossRefs, `${collectionName}.${index}.refs`, "Reference"),
      );
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, new Set(questionIds), "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting", "sensitive"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready resume portfolio packets cannot depend on stale, missing, conflicting, or sensitive sources."));
  }
  const actionText = canonicalJson({
    claims: value.claims.map(({ kind, claim, state }) => ({ kind, claim, state })),
    materials: value.materials.map(({ label, state }) => ({ label, state })),
    roleFits: value.roleFits.map(({ roleNeed, fit, state }) => ({ roleNeed, fit, state })),
    redactions: value.redactions.map(({ reason, state }) => ({ reason, state })),
    gaps: value.gaps.map(({ reason }) => reason),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(submit applications?|upload files?|publish profiles?|update portfolios?|message recruiters?|contact employers?|change accounts?|fabricate|invent metrics?|alter employment dates?|claim degrees?|claim awards?|claim publications?|legal advice|immigration advice|tax advice|compensation advice|career advice|employment advice)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Resume portfolio artifacts must not instruct submissions, uploads, publication, profile or portfolio updates, recruiter or employer contact, account changes, credential fabrication, invented metrics, altered dates, unsupported claims, or professional advice."));
  }
  if (value.handoff.owner === "resume-portfolio-curator") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Application, upload, publication, profile, portfolio, contact, account, credential, metrics, employment-date, and professional-advice authority must remain with the named owner."));
  }
  return findings;
}

function freelancePipelineFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const clientIds = value.clients.map((item) => item.id);
  const clientSet = new Set(clientIds);
  const opportunityIds = value.opportunities.map((item) => item.id);
  const opportunitySet = new Set(opportunityIds);
  const scopeIds = value.scopeItems.map((item) => item.id);
  const proposalIds = value.proposalItems.map((item) => item.id);
  const followupIds = value.followUps.map((item) => item.id);
  const riskIds = value.commitmentRisks.map((item) => item.id);
  const gapIds = value.gaps.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const crossRefs = new Set([
    ...sourceIds,
    ...clientIds,
    ...opportunityIds,
    ...scopeIds,
    ...proposalIds,
    ...followupIds,
    ...riskIds,
    ...gapIds,
    ...questionIds,
  ]);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(clientIds, "clients", "Client id"),
    ...uniqueFindings(opportunityIds, "opportunities", "Opportunity id"),
    ...uniqueFindings(scopeIds, "scopeItems", "Scope id"),
    ...uniqueFindings(proposalIds, "proposalItems", "Proposal id"),
    ...uniqueFindings(followupIds, "followUps", "Follow-up id"),
    ...uniqueFindings(riskIds, "commitmentRisks", "Commitment risk id"),
    ...uniqueFindings(gapIds, "gaps", "Gap id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, client] of value.clients.entries()) {
    findings.push(
      ...uniqueFindings(client.sourceRefs, `clients.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(client.sourceRefs, sourceSet, `clients.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, opportunity] of value.opportunities.entries()) {
    findings.push(
      ...referenceFindings([opportunity.clientRef], clientSet, `opportunities.${index}.clientRef`, "Client reference"),
      ...uniqueFindings(opportunity.sourceRefs, `opportunities.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(opportunity.sourceRefs, sourceSet, `opportunities.${index}.sourceRefs`, "Source reference"),
    );
    if (
      ["owner-review", "waiting-on-client", "won-by-owner"].includes(opportunity.stage) &&
      opportunity.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
    ) {
      findings.push(finding("unsupported_opportunity_stage", `opportunities.${index}.sourceRefs`, "Advanced freelance opportunity stages require current source evidence."));
    }
  }
  for (const [collectionName, collection] of [
    ["scopeItems", value.scopeItems],
    ["proposalItems", value.proposalItems],
    ["followUps", value.followUps],
    ["commitmentRisks", value.commitmentRisks],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...referenceFindings([item.opportunityRef], opportunitySet, `${collectionName}.${index}.opportunityRef`, "Opportunity reference"),
        ...uniqueFindings(item.sourceRefs, `${collectionName}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${collectionName}.${index}.sourceRefs`, "Source reference"),
      );
      if (
        ["supported", "ready-for-owner-review", "sent-by-owner"].includes(item.state) &&
        item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
      ) {
        findings.push(finding("unsupported_ready_item", `${collectionName}.${index}.sourceRefs`, "Supported, ready, or sent freelance pipeline items require current source evidence."));
      }
    }
  }
  for (const [collectionName, collection] of [
    ["gaps", value.gaps],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.refs, `${collectionName}.${index}.refs`, "Reference"),
        ...referenceFindings(item.refs, crossRefs, `${collectionName}.${index}.refs`, "Reference"),
      );
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, new Set(questionIds), "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting", "sensitive"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready freelance pipeline packets cannot depend on stale, missing, conflicting, or sensitive sources."));
  }
  const actionText = canonicalJson({
    clients: value.clients.map(({ name, relationship }) => ({ name, relationship })),
    opportunities: value.opportunities.map(({ label, stage, priority }) => ({ label, stage, priority })),
    scopeItems: value.scopeItems.map(({ label, state }) => ({ label, state })),
    proposalItems: value.proposalItems.map(({ label, state }) => ({ label, state })),
    followUps: value.followUps.map(({ label, state }) => ({ label, state })),
    commitmentRisks: value.commitmentRisks.map(({ reason }) => reason),
    gaps: value.gaps.map(({ reason }) => reason),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(send messages?|contact clients?|submit proposals?|sign contracts?|accept work|quote binding prices?|promise availability|invoice clients?|collect payments?|change accounts?|invent requirements?|invent prices?|invent credentials?|invent case studies?|legal advice|tax advice|financial advice|accounting advice|employment advice|contracting advice|professional advice)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Freelance pipeline artifacts must not instruct messaging, client contact, proposal submission, contracts, work acceptance, binding prices, availability promises, invoicing, payment collection, account changes, invented evidence, or professional advice."));
  }
  if (value.handoff.owner === "freelance-client-pipeline") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Messaging, client-contact, proposal, contract, acceptance, pricing, availability, invoice, payment, account, evidence, and professional-advice authority must remain with the named owner."));
  }
  return findings;
}

function conferenceOpportunityFindings(value) {
  const requiredBlockedActions = [
    "submit-proposal",
    "register",
    "book-travel",
    "buy-ticket",
    "pay-fee",
    "contact-organizer",
    "publish-abstract",
    "change-calendar",
    "change-account",
  ];
  const officialKinds = new Set([
    "official-event",
    "official-cfp",
    "official-registration",
    "official-rights",
    "official-closure",
  ]);
  const ownerKinds = new Set([
    "owner-goals",
    "owner-availability",
    "owner-budget",
    "owner-credentials",
    "owner-portfolio",
    "owner-draft",
    "owner-approval",
    "owner-action-record",
  ]);
  const sourceIds = value.sources.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const eventIds = value.events.map((item) => item.id);
  const eventSet = new Set(eventIds);
  const eventById = new Map(value.events.map((item) => [item.id, item]));
  const opportunityIds = value.opportunities.map((item) => item.id);
  const opportunitySet = new Set(opportunityIds);
  const opportunityById = new Map(value.opportunities.map((item) => [item.id, item]));
  const fitIds = value.fitAssessments.map((item) => item.id);
  const fitByOpportunity = new Map(
    value.fitAssessments.map((item) => [item.opportunityRef, item]),
  );
  const readinessIds = value.readinessItems.map((item) => item.id);
  const gateIds = value.actionGates.map((item) => item.id);
  const gatePairs = value.actionGates.map(
    (item) => `${item.opportunityRef}\u0000${item.action}`,
  );
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const intrinsicActions = {
    speaking: ["submit-proposal", "contact-organizer", "publish-abstract", "change-calendar"],
    attendance: [
      "register",
      "book-travel",
      "buy-ticket",
      "pay-fee",
      "contact-organizer",
      "change-calendar",
      "change-account",
    ],
    sponsorship: ["pay-fee", "contact-organizer", "change-account"],
    networking: [
      "register",
      "book-travel",
      "buy-ticket",
      "pay-fee",
      "contact-organizer",
      "change-calendar",
      "change-account",
    ],
  };
  const requiredReadinessKinds = {
    speaking: ["abstract", "eligibility", "availability", "rights"],
    attendance: ["budget", "availability", "travel", "accessibility"],
    sponsorship: ["budget", "rights", "employer-approval"],
    networking: ["budget", "availability", "travel", "accessibility"],
  };
  const closureActions = {
    speaking: new Set(["submit-proposal"]),
    attendance: new Set(["register", "buy-ticket"]),
    sponsorship: new Set(["pay-fee"]),
    networking: new Set(["register"]),
  };
  const crossRefs = new Set([
    ...sourceIds,
    ...eventIds,
    ...opportunityIds,
    ...fitIds,
    ...readinessIds,
    ...gateIds,
    ...questionIds,
  ]);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(eventIds, "events", "Event id"),
    ...uniqueFindings(opportunityIds, "opportunities", "Opportunity id"),
    ...uniqueFindings(fitIds, "fitAssessments", "Fit assessment id"),
    ...uniqueFindings(readinessIds, "readinessItems", "Readiness item id"),
    ...uniqueFindings(gateIds, "actionGates", "Action gate id"),
    ...uniqueFindings(gatePairs, "actionGates", "Opportunity/action gate pair"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
    ...requiredBlockedActions
      .filter((action) => !value.blockedActions.includes(action))
      .map((action) =>
        finding(
          "missing_authority_gate",
          "blockedActions",
          `Required owner authority gate ${JSON.stringify(action)} is missing.`,
        ),
      ),
  ];
  for (const [index, source] of value.sources.entries()) {
    if (source.asOf > value.scout.asOf) {
      findings.push(
        finding(
          "future_source_evidence",
          `sources.${index}.asOf`,
          "Conference source evidence must not postdate the scout as-of date.",
        ),
      );
    }
    if (
      (officialKinds.has(source.kind) && source.provenance !== "official-public") ||
      (ownerKinds.has(source.kind) && source.provenance !== "owner-supplied")
    ) {
      findings.push(
        finding(
          "invalid_source_provenance",
          `sources.${index}.provenance`,
          "Official source kinds require official-public provenance and owner source kinds require owner-supplied provenance.",
        ),
      );
    }
    if (source.provenance === "official-public" && !source.url) {
      findings.push(
        finding(
          "missing_official_url",
          `sources.${index}.url`,
          "Official public evidence requires an HTTPS source URL.",
        ),
      );
    }
    if (
      ["official-closure", "owner-action-record"].includes(source.kind) &&
      !opportunitySet.has(source.opportunityRef)
    ) {
      findings.push(
        finding(
          "dangling_reference",
          `sources.${index}.opportunityRef`,
          `Opportunity reference ${JSON.stringify(source.opportunityRef)} does not resolve.`,
        ),
      );
    }
    if (source.kind === "owner-action-record" && source.owner !== value.scout.owner) {
      findings.push(
        finding(
          "owner_mismatch",
          `sources.${index}.owner`,
          "Owner action records must name the scout owner.",
        ),
      );
    }
  }
  for (const [index, event] of value.events.entries()) {
    findings.push(
      ...referenceFindings(event.sourceRefs, sourceSet, `events.${index}.sourceRefs`, "Source reference"),
    );
    if (event.startDate > event.endDate) {
      findings.push(
        finding(
          "invalid_event_chronology",
          `events.${index}.endDate`,
          "Conference end date must not precede its start date.",
        ),
      );
    }
    if (
      ["scheduled", "tentative"].includes(event.status) &&
      !event.sourceRefs.some((ref) => {
        const source = sourceById.get(ref);
        return source?.kind === "official-event" && source.freshness === "current";
      })
    ) {
      findings.push(
        finding(
          "unsupported_event_state",
          `events.${index}.sourceRefs`,
          "Scheduled and tentative events require a current official-event source.",
        ),
      );
    }
    if (
      event.status === "cancelled" &&
      !event.sourceRefs.some((ref) => {
        const source = sourceById.get(ref);
        return source?.kind === "official-event" && source.freshness === "current";
      })
    ) {
      findings.push(
        finding(
          "unsupported_event_state",
          `events.${index}.sourceRefs`,
          "Cancelled events require a current official-event source.",
        ),
      );
    }
    if (event.status === "scheduled" && event.endDate < value.scout.asOf) {
      findings.push(
        finding(
          "stale_scheduled_event",
          `events.${index}.status`,
          "A scheduled event must not have ended before the scout as-of date.",
        ),
      );
    }
    if (event.status === "completed" && event.endDate >= value.scout.asOf) {
      findings.push(
        finding(
          "premature_completed_event",
          `events.${index}.status`,
          "A completed event must have ended before the scout as-of date.",
        ),
      );
    }
  }
  for (const [index, opportunity] of value.opportunities.entries()) {
    findings.push(
      ...referenceFindings(
        [opportunity.eventRef],
        eventSet,
        `opportunities.${index}.eventRef`,
        "Event reference",
      ),
      ...referenceFindings(
        opportunity.sourceRefs,
        sourceSet,
        `opportunities.${index}.sourceRefs`,
        "Source reference",
      ),
    );
    const event = eventById.get(opportunity.eventRef);
    const hasDeadline = typeof opportunity.deadline === "string";
    if (event && hasDeadline && opportunity.deadline > event.startDate) {
      findings.push(
        finding(
          "invalid_deadline_chronology",
          `opportunities.${index}.deadline`,
          "Opportunity deadline must not be after the event starts.",
        ),
      );
    }
    const requiredKind =
      opportunity.kind === "speaking" ? "official-cfp" : "official-registration";
    const hasCurrentOfficialSource = opportunity.sourceRefs.some((ref) => {
      const source = sourceById.get(ref);
      return source?.kind === requiredKind && source.freshness === "current";
    });
    if (opportunity.state === "current" && !hasCurrentOfficialSource) {
      findings.push(
        finding(
          "unsupported_opportunity_state",
          `opportunities.${index}.sourceRefs`,
          `Current ${opportunity.kind} opportunities require a current ${requiredKind} source.`,
        ),
      );
    }
    if (
      opportunity.state === "current" &&
      (!hasDeadline || opportunity.deadline < value.scout.asOf)
    ) {
      findings.push(
        finding(
          "expired_current_opportunity",
          `opportunities.${index}.deadline`,
          "A current opportunity requires a known deadline on or after the scout as-of date.",
        ),
      );
    }
    const exactOwnerActionEvidence = value.actionGates.some(
      (gate) =>
        gate.opportunityRef === opportunity.id &&
        gate.state === "completed-by-owner" &&
        gate.owner === value.scout.owner &&
        closureActions[opportunity.kind].has(gate.action) &&
        gate.evidenceRefs.some((ref) => {
          const source = sourceById.get(ref);
          return (
            source?.kind === "owner-action-record" &&
            source.freshness === "current" &&
            source.owner === value.scout.owner &&
            source.opportunityRef === gate.opportunityRef &&
            source.action === gate.action
          );
        }),
    );
    const currentOfficialClosure =
      opportunity.sourceRefs.some((ref) => {
        const source = sourceById.get(ref);
        return (
          source?.kind === "official-closure" &&
          source.freshness === "current" &&
          source.opportunityRef === opportunity.id
        );
      }) ||
      (event?.status === "cancelled" &&
        event.sourceRefs.some((ref) => {
          const source = sourceById.get(ref);
          return source?.kind === "official-event" && source.freshness === "current";
        }));
    if (
      opportunity.state === "closed" &&
      (!hasDeadline || opportunity.deadline >= value.scout.asOf) &&
      !currentOfficialClosure &&
      !exactOwnerActionEvidence
    ) {
      findings.push(
        finding(
          "unsupported_early_closure",
          `opportunities.${index}.state`,
          "Closure before a known deadline expires requires current official cancellation or closure evidence, or an exact current owner action record.",
        ),
      );
    }
    if (
      opportunity.state === "current" &&
      event &&
      !["scheduled", "tentative"].includes(event.status)
    ) {
      findings.push(
        finding(
          "invalid_event_opportunity_state",
          `opportunities.${index}.state`,
          "Current opportunities must belong to scheduled or tentative events.",
        ),
      );
    }
    for (const action of intrinsicActions[opportunity.kind]) {
      if (
        !value.actionGates.some(
          (gate) =>
            gate.opportunityRef === opportunity.id && gate.action === action,
        )
      ) {
        findings.push(
          finding(
            "missing_intrinsic_action_gate",
            "actionGates",
            `Opportunity ${JSON.stringify(opportunity.id)} requires an ${JSON.stringify(action)} gate.`,
          ),
        );
      }
    }
  }
  for (const [index, fit] of value.fitAssessments.entries()) {
    findings.push(
      ...referenceFindings(
        [fit.opportunityRef],
        opportunitySet,
        `fitAssessments.${index}.opportunityRef`,
        "Opportunity reference",
      ),
      ...referenceFindings(
        fit.officialSourceRefs,
        sourceSet,
        `fitAssessments.${index}.officialSourceRefs`,
        "Official source reference",
      ),
      ...referenceFindings(
        fit.ownerEvidenceRefs,
        sourceSet,
        `fitAssessments.${index}.ownerEvidenceRefs`,
        "Owner evidence reference",
      ),
    );
    if (
      fit.state === "supported" &&
      (!fit.officialSourceRefs.every((ref) => {
        const source = sourceById.get(ref);
        return source?.provenance === "official-public" && source.freshness === "current";
      }) ||
        !fit.ownerEvidenceRefs.every((ref) => {
          const source = sourceById.get(ref);
          return source?.provenance === "owner-supplied" && source.freshness === "current";
        }))
    ) {
      findings.push(
        finding(
          "unsupported_fit_state",
          `fitAssessments.${index}`,
          "Supported fit requires current official opportunity evidence and current owner-supplied evidence.",
        ),
      );
    }
  }
  for (const [index, item] of value.readinessItems.entries()) {
    findings.push(
      ...referenceFindings(
        [item.opportunityRef],
        opportunitySet,
        `readinessItems.${index}.opportunityRef`,
        "Opportunity reference",
      ),
      ...referenceFindings(
        item.evidenceRefs,
        sourceSet,
        `readinessItems.${index}.evidenceRefs`,
        "Evidence reference",
      ),
    );
    if (item.owner !== value.scout.owner || item.owner !== value.handoff.owner) {
      findings.push(
        finding(
          "owner_mismatch",
          `readinessItems.${index}.owner`,
          "Readiness ownership must name the scout and handoff owner.",
        ),
      );
    }
    if (
      item.state === "ready-for-owner-review" &&
      (fitByOpportunity.get(item.opportunityRef)?.state !== "supported" ||
        item.evidenceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current") ||
        !item.evidenceRefs.some(
          (ref) => sourceById.get(ref)?.provenance === "official-public",
        ) ||
        !item.evidenceRefs.some(
          (ref) => sourceById.get(ref)?.provenance === "owner-supplied",
        ))
    ) {
      findings.push(
        finding(
          "unsupported_readiness_state",
          `readinessItems.${index}`,
          "Review-ready items require supported fit plus current official and owner-supplied evidence.",
        ),
      );
    }
  }
  for (const [index, gate] of value.actionGates.entries()) {
    findings.push(
      ...referenceFindings(
        [gate.opportunityRef],
        opportunitySet,
        `actionGates.${index}.opportunityRef`,
        "Opportunity reference",
      ),
      ...referenceFindings(
        gate.evidenceRefs,
        sourceSet,
        `actionGates.${index}.evidenceRefs`,
        "Evidence reference",
      ),
    );
    if (gate.owner !== value.scout.owner || gate.owner !== value.handoff.owner) {
      findings.push(
        finding(
          "owner_mismatch",
          `actionGates.${index}.owner`,
          "External action gates must name the scout and handoff owner.",
        ),
      );
    }
    if (
      gate.state === "completed-by-owner" &&
      !gate.evidenceRefs.some((ref) => {
        const source = sourceById.get(ref);
        return (
          source?.kind === "owner-action-record" &&
          source.freshness === "current" &&
          source.owner === gate.owner &&
          source.opportunityRef === gate.opportunityRef &&
          source.action === gate.action
        );
      })
    ) {
      findings.push(
        finding(
          "missing_owner_action_evidence",
          `actionGates.${index}.evidenceRefs`,
          "Completed external actions require a current owner-action-record source bound to the exact owner, opportunity, and action.",
        ),
      );
    }
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...referenceFindings(question.refs, crossRefs, `reviewQuestions.${index}.refs`, "Reference"),
    );
    if (question.owner !== value.scout.owner || question.owner !== value.handoff.owner) {
      findings.push(
        finding(
          "owner_mismatch",
          `reviewQuestions.${index}.owner`,
          "Review questions must name the scout and handoff owner.",
        ),
      );
    }
  }
  findings.push(
    ...referenceFindings(
      value.handoff.reviewQuestionRefs,
      new Set(questionIds),
      "handoff.reviewQuestionRefs",
      "Review question reference",
    ),
  );
  if (value.handoff.owner !== value.scout.owner) {
    findings.push(
      finding(
        "owner_mismatch",
        "handoff.owner",
        "Handoff authority must remain with the named scout owner.",
      ),
    );
  }
  if (
    value.handoff.state === "ready-for-owner-review"
  ) {
    for (const opportunity of value.opportunities) {
      const fits = value.fitAssessments.filter(
        (item) => item.opportunityRef === opportunity.id,
      );
      const readiness = value.readinessItems.filter(
        (item) => item.opportunityRef === opportunity.id,
      );
      const missingReadiness = requiredReadinessKinds[opportunity.kind].filter(
        (kind) =>
          !readiness.some(
            (item) =>
              item.kind === kind &&
              ["ready-for-owner-review", "not-applicable"].includes(item.state),
          ),
      );
      if (
        opportunity.state !== "current" ||
        fits.length === 0 ||
        fits.some((item) => item.state !== "supported") ||
        readiness.some((item) =>
          ["blocked", "needs-evidence"].includes(item.state),
        ) ||
        missingReadiness.length > 0
      ) {
        findings.push(
          finding(
            "unsupported_ready_state",
            "handoff.state",
            `Owner-ready opportunity ${JSON.stringify(opportunity.id)} requires current state, supported fit, and resolved ${requiredReadinessKinds[opportunity.kind].join(", ")} readiness coverage.`,
          ),
        );
      }
    }
  }
  const prohibitedActionPattern =
    /\b(submit (?:a |the )?proposals?|register|book (?:a |the )?travel|buy (?:a |the )?tickets?|pay (?:a |the )?fees?|contact (?:an? |the )?organizers?|publish (?:an? |the )?abstracts?|change (?:a |the )?calendars?|change (?:an? |the )?accounts?|legal advice|tax advice|financial advice|visa advice|immigration advice|employment advice|sponsorship advice|professional advice)\b/iu;
  const actionText = canonicalJson({
    events: value.events.map(({ name }) => name),
    opportunities: value.opportunities.map(({ title, cost, rights }) => ({
      title,
      cost,
      rights,
    })),
    fitRationales: value.fitAssessments.map(({ rationale }) => rationale),
    reviewQuestionReasons: value.reviewQuestions.map(({ reason }) => reason),
  });
  if (prohibitedActionPattern.test(actionText)) {
    findings.push(
      finding(
        "external_action_content",
        "reviewQuestions",
        "Conference artifacts must not instruct submissions, registration, booking, payment, organizer contact, publication, account or calendar changes, or professional advice.",
      ),
    );
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    if (
      prohibitedActionPattern.test(question.question) &&
      !question.question.toLocaleLowerCase().includes(question.owner.toLocaleLowerCase())
    ) {
      findings.push(
        finding(
          "ungated_owner_action",
          `reviewQuestions.${index}.question`,
          "Questions about external actions must name the accountable owner who would decide or act.",
        ),
      );
    }
  }
  if (value.handoff.owner === "conference-opportunity-scout") {
    findings.push(
      finding(
        "agent_owned_authority",
        "handoff.owner",
        "Submission, registration, travel, payment, contact, publication, calendar, account, and professional-advice authority must remain with the named owner.",
      ),
    );
  }
  return findings;
}

function invoiceReceivablesFindings(value) {
  const requiredBlockedActions = [
    "issue-invoice",
    "alter-invoice",
    "send-reminder",
    "contact-client",
    "collect-payment",
    "initiate-refund",
    "apply-fee",
    "write-off-balance",
    "change-account",
    "change-payment-instructions",
  ];
  const sourceIds = value.sources.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const clientIds = value.clients.map((item) => item.id);
  const clientSet = new Set(clientIds);
  const invoiceIds = value.invoices.map((item) => item.id);
  const invoiceSet = new Set(invoiceIds);
  const invoiceById = new Map(value.invoices.map((item) => [item.id, item]));
  const paymentIds = value.paymentEvidence.map((item) => item.id);
  const adjustmentIds = value.adjustments.map((item) => item.id);
  const discrepancyIds = value.discrepancies.map((item) => item.id);
  const followupIds = value.followUps.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const crossRefs = new Set([
    ...sourceIds,
    ...clientIds,
    ...invoiceIds,
    ...paymentIds,
    ...adjustmentIds,
    ...discrepancyIds,
    ...followupIds,
    ...questionIds,
  ]);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(clientIds, "clients", "Client id"),
    ...uniqueFindings(invoiceIds, "invoices", "Invoice id"),
    ...uniqueFindings(paymentIds, "paymentEvidence", "Payment evidence id"),
    ...uniqueFindings(adjustmentIds, "adjustments", "Adjustment id"),
    ...uniqueFindings(discrepancyIds, "discrepancies", "Discrepancy id"),
    ...uniqueFindings(followupIds, "followUps", "Follow-up id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
    ...requiredBlockedActions
      .filter((action) => !value.blockedActions.includes(action))
      .map((action) =>
        finding(
          "missing_authority_gate",
          "blockedActions",
          `Required owner authority gate ${JSON.stringify(action)} is missing.`,
        ),
      ),
  ];
  for (const [index, source] of value.sources.entries()) {
    if (source.asOf > value.ledger.asOf) {
      findings.push(
        finding(
          "future_source_evidence",
          `sources.${index}.asOf`,
          "Receivables source evidence must not postdate the ledger as-of date.",
        ),
      );
    }
  }
  for (const [index, client] of value.clients.entries()) {
    findings.push(
      ...uniqueFindings(client.sourceRefs, `clients.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(client.sourceRefs, sourceSet, `clients.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, invoice] of value.invoices.entries()) {
    findings.push(
      ...referenceFindings([invoice.clientRef], clientSet, `invoices.${index}.clientRef`, "Client reference"),
      ...uniqueFindings(invoice.sourceRefs, `invoices.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(invoice.sourceRefs, sourceSet, `invoices.${index}.sourceRefs`, "Source reference"),
    );
    if (
      ["open", "paid", "partial", "overdue"].includes(invoice.status) &&
      invoice.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
    ) {
      findings.push(finding("unsupported_invoice_state", `invoices.${index}.sourceRefs`, "Open, paid, partial, and overdue invoice states require current source evidence."));
    }
    if (invoice.balanceDue > invoice.originalAmount) {
      findings.push(finding("invalid_invoice_balance", `invoices.${index}.balanceDue`, "Balance due must not exceed the supplied original invoice amount."));
    }
    if (invoice.dueDate < invoice.issueDate) {
      findings.push(finding("invalid_invoice_chronology", `invoices.${index}.dueDate`, "Invoice due date must not be before its issue date."));
    }
    if (invoice.issueDate > value.ledger.asOf) {
      findings.push(finding("future_invoice_issue", `invoices.${index}.issueDate`, "Invoice issue date must not postdate the ledger as-of date."));
    }
    if (invoice.status === "paid" && !numbersEqual(invoice.balanceDue, 0)) {
      findings.push(finding("invalid_paid_balance", `invoices.${index}.balanceDue`, "Paid invoices must have a zero balance due."));
    }
    if (invoice.status === "partial" && (numbersEqual(invoice.balanceDue, 0) || numbersEqual(invoice.balanceDue, invoice.originalAmount))) {
      findings.push(finding("invalid_partial_balance", `invoices.${index}.balanceDue`, "Partially paid invoices must have a positive balance below the original amount."));
    }
    if (["open", "overdue"].includes(invoice.status) && numbersEqual(invoice.balanceDue, 0)) {
      findings.push(finding("invalid_open_balance", `invoices.${index}.balanceDue`, "Open and overdue invoices must have a positive balance due."));
    }
    if (invoice.status === "overdue" && invoice.dueDate >= value.ledger.asOf) {
      findings.push(finding("premature_overdue_state", `invoices.${index}.status`, "An overdue invoice must have a due date before the ledger as-of date."));
    }
    const confirmedAmount = value.paymentEvidence
      .filter(
        (payment) =>
          payment.invoiceRef === invoice.id &&
          payment.state === "confirmed" &&
          payment.currency === invoice.currency,
      )
      .reduce((total, payment) => total + payment.amount, 0);
    const confirmedAdjustmentAmount = value.adjustments
      .filter(
        (adjustment) =>
          adjustment.invoiceRef === invoice.id &&
          adjustment.state === "confirmed" &&
          adjustment.currency === invoice.currency,
      )
      .reduce((total, adjustment) => total + adjustment.amount, 0);
    const reconciles = numbersEqual(
      confirmedAmount + confirmedAdjustmentAmount,
      invoice.originalAmount - invoice.balanceDue,
    );
    const hasDiscrepancy = value.discrepancies.some(
      (discrepancy) => discrepancy.invoiceRef === invoice.id,
    );
    if (
      ["open", "paid", "partial", "overdue"].includes(invoice.status) &&
      !reconciles
    ) {
      findings.push(
        finding(
          "unreconciled_invoice_balance",
          `invoices.${index}.balanceDue`,
          "Resolved invoice states must reconcile the original amount and balance due with confirmed same-currency payment evidence.",
        ),
      );
    }
    if (["disputed", "conflicting"].includes(invoice.status) && !hasDiscrepancy) {
      findings.push(
        finding(
          "missing_invoice_discrepancy",
          `invoices.${index}.status`,
          "Disputed and conflicting invoice states require an explicit discrepancy.",
        ),
      );
    }
  }
  for (const [index, payment] of value.paymentEvidence.entries()) {
    findings.push(
      ...referenceFindings([payment.invoiceRef], invoiceSet, `paymentEvidence.${index}.invoiceRef`, "Invoice reference"),
      ...uniqueFindings(payment.sourceRefs, `paymentEvidence.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(payment.sourceRefs, sourceSet, `paymentEvidence.${index}.sourceRefs`, "Source reference"),
    );
    const invoice = invoiceById.get(payment.invoiceRef);
    if (invoice && payment.currency !== invoice.currency) {
      findings.push(finding("payment_currency_mismatch", `paymentEvidence.${index}.currency`, "Payment evidence currency must match its referenced invoice."));
    }
    if (
      payment.state === "confirmed" &&
      payment.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
    ) {
      findings.push(finding("unsupported_payment_state", `paymentEvidence.${index}.sourceRefs`, "Confirmed payment evidence requires current source evidence."));
    }
    if (
      payment.state === "confirmed" &&
      !payment.sourceRefs.some((ref) => sourceById.get(ref)?.kind === "payment-record")
    ) {
      findings.push(
        finding(
          "missing_payment_evidence",
          `paymentEvidence.${index}.sourceRefs`,
          "Confirmed payments require at least one current payment-record source.",
        ),
      );
    }
  }
  for (const [index, adjustment] of value.adjustments.entries()) {
    findings.push(
      ...referenceFindings([adjustment.invoiceRef], invoiceSet, `adjustments.${index}.invoiceRef`, "Invoice reference"),
      ...uniqueFindings(adjustment.sourceRefs, `adjustments.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(adjustment.sourceRefs, sourceSet, `adjustments.${index}.sourceRefs`, "Source reference"),
    );
    const invoice = invoiceById.get(adjustment.invoiceRef);
    if (invoice && adjustment.currency !== invoice.currency) {
      findings.push(finding("adjustment_currency_mismatch", `adjustments.${index}.currency`, "Adjustment currency must match its referenced invoice."));
    }
    if (
      adjustment.state === "confirmed" &&
      (adjustment.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current") ||
        !adjustment.sourceRefs.some((ref) => sourceById.get(ref)?.kind === "credit-note"))
    ) {
      findings.push(finding("unsupported_adjustment_state", `adjustments.${index}.sourceRefs`, "Confirmed adjustments require a current credit-note source."));
    }
  }
  for (const [index, discrepancy] of value.discrepancies.entries()) {
    findings.push(
      ...referenceFindings([discrepancy.invoiceRef], invoiceSet, `discrepancies.${index}.invoiceRef`, "Invoice reference"),
      ...uniqueFindings(discrepancy.refs, `discrepancies.${index}.refs`, "Reference"),
      ...referenceFindings(discrepancy.refs, crossRefs, `discrepancies.${index}.refs`, "Reference"),
    );
  }
  for (const [index, followup] of value.followUps.entries()) {
    findings.push(
      ...referenceFindings([followup.invoiceRef], invoiceSet, `followUps.${index}.invoiceRef`, "Invoice reference"),
      ...uniqueFindings(followup.sourceRefs, `followUps.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(followup.sourceRefs, sourceSet, `followUps.${index}.sourceRefs`, "Source reference"),
    );
    const invoice = invoiceById.get(followup.invoiceRef);
    if (
      ["draft-for-owner-review", "sent-by-owner"].includes(followup.state) &&
      (followup.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current") ||
        ["stale", "conflicting", "unknown"].includes(invoice?.status))
    ) {
      findings.push(finding("unsupported_followup_state", `followUps.${index}`, "Review-ready or owner-sent follow-ups require a current, resolved invoice and current source evidence."));
    }
    if (
      followup.state === "sent-by-owner" &&
      !followup.sourceRefs.some((ref) =>
        ["owner-note", "followup-history"].includes(sourceById.get(ref)?.kind),
      )
    ) {
      findings.push(
        finding(
          "missing_owner_action_evidence",
          `followUps.${index}.sourceRefs`,
          "Owner-sent follow-ups require a current owner-note or followup-history source.",
        ),
      );
    }
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...uniqueFindings(question.refs, `reviewQuestions.${index}.refs`, "Reference"),
      ...referenceFindings(question.refs, crossRefs, `reviewQuestions.${index}.refs`, "Reference"),
    );
    if (question.owner !== value.ledger.owner || question.owner !== value.handoff.owner) {
      findings.push(finding("owner_mismatch", `reviewQuestions.${index}.owner`, "Review questions and handoff authority must name the ledger owner."));
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, new Set(questionIds), "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (value.handoff.owner !== value.ledger.owner) {
    findings.push(finding("owner_mismatch", "handoff.owner", "Handoff authority must remain with the named ledger owner."));
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    (value.sources.some((item) => ["stale", "missing", "conflicting", "sensitive"].includes(item.freshness)) ||
      value.invoices.some((item) => ["stale", "conflicting", "unknown"].includes(item.status)) ||
      value.discrepancies.length > 0)
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready receivables handoffs cannot depend on stale, missing, conflicting, or sensitive sources, unresolved invoice states, or discrepancies."));
  }
  const actionText = canonicalJson({
    clients: value.clients.map(({ name }) => ({ name })),
    invoices: value.invoices.map(({ invoiceNumber, status }) => ({ invoiceNumber, status })),
    paymentEvidence: value.paymentEvidence.map(({ state }) => ({ state })),
    adjustments: value.adjustments.map(({ label, state }) => ({ label, state })),
    discrepancies: value.discrepancies.map(({ reason }) => reason),
    followUps: value.followUps.map(({ label, state }) => ({ label, state })),
    reviewQuestionReasons: value.reviewQuestions.map(({ reason }) => reason),
  });
  const prohibitedActionPattern = /\b(issue (?:an? |the )?invoices?|alter (?:an? |the )?invoices?|send (?:a |the )?reminders?|contact (?:a |the )?clients?|collect (?:a |the )?payments?|initiate (?:a |the )?refunds?|apply (?:a |the )?fees?|write off (?:a |the )?balances?|change (?:an? |the )?accounts?|change (?:a |the )?payment instructions?|invent (?:a |the )?balances?|invent (?:a |the )?due dates?|invent (?:a |the )?payment status|invent (?:a |the )?contract terms?|invent (?:a |the )?tax treatment|invent (?:a |the )?disputes?|accounting advice|tax advice|legal advice|debt-collection advice|credit advice|financial advice)\b/iu;
  if (prohibitedActionPattern.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Receivables artifacts must not instruct invoice changes, outbound reminders, client contact, collection, refunds, fees, write-offs, account or payment-instruction changes, invented financial facts, or professional advice."));
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    if (
      prohibitedActionPattern.test(question.question) &&
      !question.question.toLocaleLowerCase().includes(question.owner.toLocaleLowerCase())
    ) {
      findings.push(
        finding(
          "ungated_owner_action",
          `reviewQuestions.${index}.question`,
          "Questions about prohibited actions must name the accountable owner who would decide or act.",
        ),
      );
    }
  }
  if (value.handoff.owner === "invoice-payment-followup") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Invoice, communication, collection, refund, fee, write-off, account, payment, financial-fact, and professional-advice authority must remain with the named owner."));
  }
  return findings;
}

function travelLoyaltyFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const programIds = value.programs.map((item) => item.id);
  const programSet = new Set(programIds);
  const balanceIds = value.balances.map((item) => item.id);
  const balanceSet = new Set(balanceIds);
  const certificateIds = value.certificates.map((item) => item.id);
  const benefitIds = value.benefits.map((item) => item.id);
  const tripIds = value.tripGoals.map((item) => item.id);
  const tripSet = new Set(tripIds);
  const candidateIds = value.redemptionCandidates.map((item) => item.id);
  const gapIds = value.gaps.map((item) => item.id);
  const gapSet = new Set(gapIds);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const crossRefs = new Set([
    ...sourceIds,
    ...programIds,
    ...balanceIds,
    ...certificateIds,
    ...benefitIds,
    ...tripIds,
    ...candidateIds,
    ...gapIds,
    ...questionIds,
  ]);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(programIds, "programs", "Program id"),
    ...uniqueFindings(balanceIds, "balances", "Balance id"),
    ...uniqueFindings(certificateIds, "certificates", "Certificate id"),
    ...uniqueFindings(benefitIds, "benefits", "Benefit id"),
    ...uniqueFindings(tripIds, "tripGoals", "Trip goal id"),
    ...uniqueFindings(candidateIds, "redemptionCandidates", "Redemption candidate id"),
    ...uniqueFindings(gapIds, "gaps", "Gap id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, program] of value.programs.entries()) {
    findings.push(
      ...uniqueFindings(program.sourceRefs, `programs.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(program.sourceRefs, sourceSet, `programs.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, balance] of value.balances.entries()) {
    findings.push(
      ...referenceFindings([balance.programRef], programSet, `balances.${index}.programRef`, "Program reference"),
      ...uniqueFindings(balance.sourceRefs, `balances.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(balance.sourceRefs, sourceSet, `balances.${index}.sourceRefs`, "Source reference"),
    );
    if (balance.state === "current" && balance.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_balance_state", `balances.${index}.sourceRefs`, "Current loyalty balances require current source evidence."));
    }
  }
  for (const [collectionName, collection] of [
    ["certificates", value.certificates],
    ["benefits", value.benefits],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...referenceFindings([item.programRef], programSet, `${collectionName}.${index}.programRef`, "Program reference"),
        ...uniqueFindings(item.sourceRefs, `${collectionName}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${collectionName}.${index}.sourceRefs`, "Source reference"),
      );
      if (
        ["usable-after-owner-review", "supported"].includes(item.state) &&
        item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
      ) {
        findings.push(finding("unsupported_ready_item", `${collectionName}.${index}.sourceRefs`, "Usable certificates and supported benefits require current source evidence."));
      }
    }
  }
  for (const [index, trip] of value.tripGoals.entries()) {
    findings.push(
      ...uniqueFindings(trip.sourceRefs, `tripGoals.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(trip.sourceRefs, sourceSet, `tripGoals.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, candidate] of value.redemptionCandidates.entries()) {
    findings.push(
      ...referenceFindings([candidate.tripRef], tripSet, `redemptionCandidates.${index}.tripRef`, "Trip reference"),
      ...referenceFindings([candidate.programRef], programSet, `redemptionCandidates.${index}.programRef`, "Program reference"),
      ...uniqueFindings(candidate.balanceRefs, `redemptionCandidates.${index}.balanceRefs`, "Balance reference"),
      ...referenceFindings(candidate.balanceRefs, balanceSet, `redemptionCandidates.${index}.balanceRefs`, "Balance reference"),
      ...uniqueFindings(candidate.riskRefs, `redemptionCandidates.${index}.riskRefs`, "Gap reference"),
      ...referenceFindings(candidate.riskRefs, gapSet, `redemptionCandidates.${index}.riskRefs`, "Gap reference"),
      ...uniqueFindings(candidate.sourceRefs, `redemptionCandidates.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(candidate.sourceRefs, sourceSet, `redemptionCandidates.${index}.sourceRefs`, "Source reference"),
    );
    if (
      candidate.state === "review-candidate" &&
      candidate.sourceRefs.some((ref) => !["current"].includes(sourceById.get(ref)?.freshness))
    ) {
      findings.push(finding("unsupported_redemption_candidate", `redemptionCandidates.${index}.sourceRefs`, "Reviewable redemption candidates require current source evidence."));
    }
  }
  for (const [collectionName, collection] of [
    ["gaps", value.gaps],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.refs, `${collectionName}.${index}.refs`, "Reference"),
        ...referenceFindings(item.refs, crossRefs, `${collectionName}.${index}.refs`, "Reference"),
      );
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, new Set(questionIds), "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting", "sensitive"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready loyalty packets cannot depend on stale, missing, conflicting, or sensitive sources."));
  }
  const actionText = canonicalJson({
    programs: value.programs.map(({ name, accountLabel }) => ({ name, accountLabel })),
    balances: value.balances.map(({ state }) => state),
    certificates: value.certificates.map(({ label, state }) => ({ label, state })),
    benefits: value.benefits.map(({ label, state }) => ({ label, state })),
    redemptionCandidates: value.redemptionCandidates.map(({ label, state }) => ({ label, state })),
    gaps: value.gaps.map(({ reason }) => reason),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(book travel|redeem awards?|transfer points?|buy points?|buy miles?|apply certificates?|change accounts?|pay fees?|contact providers?|alter itinerar(?:y|ies)|assign cash value|tax advice|legal advice|financial advice|credit-card advice|travel advice|immigration advice|insurance advice|loyalty-program advice)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Travel loyalty artifacts must not instruct booking, redemption, transfers, point purchases, certificate use, payments, provider contact, account changes, itinerary changes, cash valuation, or professional advice."));
  }
  if (value.handoff.owner === "travel-loyalty-points-organizer") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Booking, redemption, transfer, purchase, payment, provider-contact, account, itinerary, cash-value, and professional-advice authority must remain with the named owner."));
  }
  return findings;
}

function professionalNetworkingFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const contactIds = value.contacts.map((item) => item.id);
  const contactSet = new Set(contactIds);
  const interactionIds = value.interactions.map((item) => item.id);
  const followupIds = value.followUps.map((item) => item.id);
  const introIds = value.introductions.map((item) => item.id);
  const reminderIds = value.reminders.map((item) => item.id);
  const gapIds = value.gaps.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const crossRefs = new Set([
    ...sourceIds,
    ...contactIds,
    ...interactionIds,
    ...followupIds,
    ...introIds,
    ...reminderIds,
    ...gapIds,
    ...questionIds,
  ]);
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(contactIds, "contacts", "Contact id"),
    ...uniqueFindings(interactionIds, "interactions", "Interaction id"),
    ...uniqueFindings(followupIds, "followUps", "Follow-up id"),
    ...uniqueFindings(introIds, "introductions", "Introduction id"),
    ...uniqueFindings(reminderIds, "reminders", "Reminder id"),
    ...uniqueFindings(gapIds, "gaps", "Gap id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  for (const [index, contact] of value.contacts.entries()) {
    findings.push(
      ...uniqueFindings(contact.sourceRefs, `contacts.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(contact.sourceRefs, sourceSet, `contacts.${index}.sourceRefs`, "Source reference"),
    );
  }
  for (const [index, interaction] of value.interactions.entries()) {
    findings.push(
      ...uniqueFindings(interaction.contactRefs, `interactions.${index}.contactRefs`, "Contact reference"),
      ...referenceFindings(interaction.contactRefs, contactSet, `interactions.${index}.contactRefs`, "Contact reference"),
      ...uniqueFindings(interaction.sourceRefs, `interactions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(interaction.sourceRefs, sourceSet, `interactions.${index}.sourceRefs`, "Source reference"),
    );
    if (interaction.state === "current" && interaction.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")) {
      findings.push(finding("unsupported_interaction_state", `interactions.${index}.sourceRefs`, "Current networking interactions require current source evidence."));
    }
  }
  for (const [collectionName, collection] of [
    ["followUps", value.followUps],
    ["reminders", value.reminders],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...referenceFindings([item.contactRef], contactSet, `${collectionName}.${index}.contactRef`, "Contact reference"),
        ...uniqueFindings(item.sourceRefs, `${collectionName}.${index}.sourceRefs`, "Source reference"),
        ...referenceFindings(item.sourceRefs, sourceSet, `${collectionName}.${index}.sourceRefs`, "Source reference"),
      );
      if (
        ["sent-by-owner", "completed-by-owner"].includes(item.state) &&
        item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
      ) {
        findings.push(finding("unsupported_completed_item", `${collectionName}.${index}.sourceRefs`, "Sent or completed networking items require current source evidence."));
      }
    }
  }
  for (const [index, intro] of value.introductions.entries()) {
    findings.push(
      ...uniqueFindings(intro.contactRefs, `introductions.${index}.contactRefs`, "Contact reference"),
      ...referenceFindings(intro.contactRefs, contactSet, `introductions.${index}.contactRefs`, "Contact reference"),
      ...uniqueFindings(intro.sourceRefs, `introductions.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(intro.sourceRefs, sourceSet, `introductions.${index}.sourceRefs`, "Source reference"),
    );
    if (
      intro.state === "needs-owner-review" &&
      intro.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current")
    ) {
      findings.push(finding("unsupported_introduction_state", `introductions.${index}.sourceRefs`, "Owner-review introductions require current consent evidence."));
    }
  }
  for (const [collectionName, collection] of [
    ["gaps", value.gaps],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...uniqueFindings(item.refs, `${collectionName}.${index}.refs`, "Reference"),
        ...referenceFindings(item.refs, crossRefs, `${collectionName}.${index}.refs`, "Reference"),
      );
    }
  }
  findings.push(
    ...uniqueFindings(value.handoff.reviewQuestionRefs, "handoff.reviewQuestionRefs", "Review question reference"),
    ...referenceFindings(value.handoff.reviewQuestionRefs, new Set(questionIds), "handoff.reviewQuestionRefs", "Review question reference"),
  );
  if (
    value.handoff.state === "ready-for-owner-review" &&
    value.sources.some((item) => ["stale", "missing", "conflicting", "sensitive"].includes(item.freshness))
  ) {
    findings.push(finding("unsupported_ready_state", "handoff.state", "Owner-ready networking packets cannot depend on stale, missing, conflicting, or sensitive sources."));
  }
  const actionText = canonicalJson({
    contacts: value.contacts.map(({ name, organization, relationship }) => ({ name, organization, relationship })),
    interactions: value.interactions.map(({ label, state }) => ({ label, state })),
    followUps: value.followUps.map(({ label, state }) => ({ label, state })),
    introductions: value.introductions.map(({ label, state }) => ({ label, state })),
    reminders: value.reminders.map(({ label, state }) => ({ label, state })),
    gaps: value.gaps.map(({ reason }) => reason),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({ question, reason })),
  });
  if (/\b(send messages?|make introductions?|schedule meetings?|cancel meetings?|commit referrals?|contact employers?|contact prospects?|change accounts?|scrape contacts?|update crm|recruiting actions?|sales outreach|career advice|legal advice|financial advice|employment advice|compensation advice|immigration advice|privacy advice|relationship advice)\b/iu.test(actionText)) {
    findings.push(finding("external_action_content", "reviewQuestions", "Networking artifacts must not instruct outbound messages, introductions, scheduling, scraping, account changes, referral commitments, recruiting actions, sales outreach, or professional advice."));
  }
  if (value.handoff.owner === "professional-networking-followup") {
    findings.push(finding("agent_owned_authority", "handoff.owner", "Messaging, introduction, scheduling, scraping, CRM, account, referral, recruiting, sales, and professional-advice authority must remain with the named owner."));
  }
  return findings;
}

function movingPlanFindings(value) {
  const requiredActions = [
    "sign-contract",
    "make-booking",
    "make-payment",
    "send-message",
    "change-address",
    "change-utility",
    "change-insurance",
    "change-school",
    "change-registration",
    "change-mail",
    "book-travel",
    "change-account",
  ];
  const sourceIds = value.sources.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const evidenceIds = value.evidenceRecords.map((item) => item.id);
  const evidenceById = new Map(value.evidenceRecords.map((item) => [item.id, item]));
  const evidenceBySource = new Map();
  for (const item of value.evidenceRecords) {
    const records = evidenceBySource.get(item.sourceRef) ?? [];
    records.push(item);
    evidenceBySource.set(item.sourceRef, records);
  }
  const locationIds = value.locations.map((item) => item.id);
  const locationSet = new Set(locationIds);
  const locationById = new Map(value.locations.map((item) => [item.id, item]));
  const memberIds = value.members.map((item) => item.id);
  const memberSet = new Set(memberIds);
  const memberById = new Map(value.members.map((item) => [item.id, item]));
  const workstreamIds = value.workstreams.map((item) => item.id);
  const workstreamSet = new Set(workstreamIds);
  const workstreamById = new Map(value.workstreams.map((item) => [item.id, item]));
  const milestoneIds = value.milestones.map((item) => item.id);
  const milestoneSet = new Set(milestoneIds);
  const milestoneById = new Map(value.milestones.map((item) => [item.id, item]));
  const evidenceSet = new Set(evidenceIds);
  const dependencyIds = value.dependencies.map((item) => item.id);
  const readinessIds = value.readinessItems.map((item) => item.id);
  const readinessSet = new Set(readinessIds);
  const readinessById = new Map(value.readinessItems.map((item) => [item.id, item]));
  const gateIds = value.actionGates.map((item) => item.id);
  const gateSet = new Set(gateIds);
  const gateById = new Map(value.actionGates.map((item) => [item.id, item]));
  const gapIds = value.gaps.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const crossRefs = new Set([
    ...sourceIds,
    ...locationIds,
    ...memberIds,
    ...workstreamIds,
    ...milestoneIds,
    ...dependencyIds,
    ...readinessIds,
    ...gateIds,
    ...gapIds,
    ...questionIds,
  ]);
  const gatePairs = value.actionGates.map(
    (item) => `${item.workstreamRef}\u0000${item.action}`,
  );
  const dependencyPairs = value.dependencies.map(
    (item) => `${item.prerequisiteRef}\u0000${item.dependentRef}`,
  );
  const readinessPairs = value.readinessItems.map(
    (item) => `${item.workstreamRef}\u0000${item.kind}`,
  );
  const gateWorkstreamKinds = {
    "sign-contract": new Set(["moving-service"]),
    "make-booking": new Set(["moving-service"]),
    "make-payment": new Set(["moving-service"]),
    "send-message": new Set(["moving-service"]),
    "change-address": new Set(["documents-and-address"]),
    "change-utility": new Set(["utilities"]),
    "change-insurance": new Set(["insurance", "documents-and-address"]),
    "change-school": new Set(["school-and-care"]),
    "change-registration": new Set(["registration", "documents-and-address"]),
    "change-mail": new Set(["mail", "documents-and-address"]),
    "book-travel": new Set(["travel"]),
    "change-account": new Set(["accounts", "documents-and-address"]),
  };
  const intrinsicActionsByWorkstreamKind = {
    "moving-service": new Set([
      "sign-contract",
      "make-booking",
      "make-payment",
      "send-message",
    ]),
    utilities: new Set(["change-utility"]),
    "documents-and-address": new Set(["change-address"]),
    insurance: new Set(["change-insurance"]),
    "school-and-care": new Set(["change-school"]),
    registration: new Set(["change-registration"]),
    mail: new Set(["change-mail"]),
    accounts: new Set(["change-account"]),
  };
  const applicabilitySourceKinds = {
    "sign-contract": new Set(["owner-plan", "vendor-quote", "service-record"]),
    "make-booking": new Set(["owner-plan", "vendor-quote", "service-record"]),
    "make-payment": new Set(["owner-plan", "vendor-quote", "budget-record"]),
    "send-message": new Set(["owner-plan", "vendor-quote", "service-record"]),
    "change-address": new Set([
      "owner-plan",
      "lease-or-sale-record",
      "document-record",
    ]),
    "change-utility": new Set([
      "owner-plan",
      "utility-record",
      "service-record",
    ]),
    "change-insurance": new Set(["owner-plan", "insurance-record"]),
    "change-school": new Set(["owner-plan", "school-or-care-record"]),
    "change-registration": new Set(["owner-plan", "registration-record"]),
    "change-mail": new Set(["owner-plan", "mail-record"]),
    "book-travel": new Set(["owner-plan", "travel-plan"]),
    "change-account": new Set(["owner-plan", "account-record"]),
  };
  const readinessSourceKinds = {
    date: new Set(["owner-plan", "lease-or-sale-record", "school-or-care-record"]),
    access: new Set(["lease-or-sale-record", "access-rule"]),
    inventory: new Set(["inventory-record"]),
    vendor: new Set(["vendor-quote"]),
    service: new Set(["service-record", "utility-record"]),
    document: new Set([
      "owner-plan",
      "document-record",
      "insurance-record",
      "registration-record",
      "mail-record",
      "account-record",
    ]),
    budget: new Set(["budget-record"]),
    travel: new Set(["travel-plan"]),
    resident: new Set(["owner-plan", "school-or-care-record"]),
    consent: new Set(["consent-record"]),
    approval: new Set(["owner-plan", "owner-action-record"]),
    "move-day": new Set([
      "owner-plan",
      "lease-or-sale-record",
      "access-rule",
      "inventory-record",
      "vendor-quote",
      "travel-plan",
    ]),
  };
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(evidenceIds, "evidenceRecords", "Evidence record id"),
    ...uniqueFindings(locationIds, "locations", "Location id"),
    ...uniqueFindings(memberIds, "members", "Member id"),
    ...uniqueFindings(workstreamIds, "workstreams", "Workstream id"),
    ...uniqueFindings(milestoneIds, "milestones", "Milestone id"),
    ...uniqueFindings(dependencyIds, "dependencies", "Dependency id"),
    ...uniqueFindings(dependencyPairs, "dependencies", "Dependency edge"),
    ...uniqueFindings(readinessIds, "readinessItems", "Readiness id"),
    ...uniqueFindings(
      readinessPairs,
      "readinessItems",
      "Workstream/readiness-kind pair",
    ),
    ...uniqueFindings(gateIds, "actionGates", "Action gate id"),
    ...uniqueFindings(gatePairs, "actionGates", "Workstream/action gate pair"),
    ...uniqueFindings(gapIds, "gaps", "Gap id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
    ...requiredActions
      .filter((action) => !value.blockedActions.includes(action))
      .map((action) =>
        finding(
          "missing_authority_gate",
          "blockedActions",
          `Required moving authority gate ${JSON.stringify(action)} is missing.`,
        ),
      ),
    ...requiredActions
      .filter((action) => !value.actionGates.some((gate) => gate.action === action))
      .map((action) =>
        finding(
          "missing_action_gate",
          "actionGates",
          `The moving plan requires an explicit ${JSON.stringify(action)} gate.`,
        ),
      ),
  ];
  const moveDayWorkstreams = value.workstreams.filter(
    (item) => item.kind === "move-day",
  );
  if (moveDayWorkstreams.length !== 1) {
    findings.push(
      finding(
        "invalid_move_day_workstream_count",
        "workstreams",
        "A moving plan requires exactly one move-day workstream.",
      ),
    );
  }

  const owner = memberById.get(value.plan.ownerRef);
  if (!owner || owner.role !== "owner") {
    findings.push(
      finding(
        "invalid_plan_owner",
        "plan.ownerRef",
        "The plan owner must resolve to a member with the owner role.",
      ),
    );
  }
  if (value.handoff.ownerRef !== value.plan.ownerRef) {
    findings.push(
      finding(
        "owner_mismatch",
        "handoff.ownerRef",
        "The handoff must remain with the named plan owner.",
      ),
    );
  }
  findings.push(
    ...uniqueFindings(value.plan.sourceRefs, "plan.sourceRefs", "Source reference"),
    ...referenceFindings(
      value.plan.sourceRefs,
      sourceSet,
      "plan.sourceRefs",
      "Source reference",
    ),
  );

  function hasEvidenceRecord(sourceRefs, predicate) {
    return sourceRefs.some((ref) =>
      (evidenceBySource.get(ref) ?? []).some(predicate),
    );
  }

  function sourceSupportsWorkstream(source, workstreamRef) {
    const workstream = workstreamById.get(workstreamRef);
    return (
      (source?.kind === "owner-plan" &&
        !source.workstreamRef &&
        !source.subjectRef) ||
      source?.workstreamRef === workstreamRef ||
      source?.subjectRef === workstreamRef ||
      workstream?.locationRefs.includes(source?.subjectRef)
    );
  }

  const candidateFindings = (candidates, path, claimKind, subjectRef, workstreamRef) => {
    const results = [
      ...referenceFindings(
        candidates.map((item) => item.sourceRef),
        sourceSet,
        path,
        "Date candidate source reference",
      ),
    ];
    for (const [index, candidate] of candidates.entries()) {
      if (!value.plan.sourceRefs.includes(candidate.sourceRef) && claimKind === "move-date") {
        results.push(
          finding(
            "unbound_date_candidate",
            `${path}.${index}.sourceRef`,
            "Every move-date candidate source must be included in plan.sourceRefs.",
          ),
        );
      }
      if (
        !hasEvidenceRecord([candidate.sourceRef], (record) =>
          record.claimKind === claimKind &&
          record.subjectRef === subjectRef &&
          record.workstreamRef === workstreamRef &&
          record.readinessKind === null &&
          record.assertedDate === candidate.date &&
          record.assertedValue === null
        )
      ) {
        results.push(
          finding(
            "unsupported_date_candidate",
            `${path}.${index}`,
            "Every candidate date requires a source-bound record for the exact claim, subject, workstream, and date.",
          ),
        );
      }
    }
    return results;
  };

  findings.push(
    ...candidateFindings(
      value.plan.dateCandidates,
      "plan.dateCandidates",
      "move-date",
      value.plan.id,
      null,
    ),
  );
  const moveCandidateDates = new Set(
    value.plan.dateCandidates.map((item) => item.date),
  );
  const moveDateStateSupported =
    (value.plan.moveDateState === "known" &&
      moveCandidateDates.size === 1 &&
      moveCandidateDates.has(value.plan.moveDate) &&
      value.plan.sourceRefs.every(
        (ref) => sourceById.get(ref)?.freshness === "current",
      ) &&
      value.plan.dateCandidates.every(
        (item) => sourceById.get(item.sourceRef)?.freshness === "current",
      )) ||
    (value.plan.moveDateState === "missing" &&
      value.plan.dateCandidates.length === 0 &&
      hasEvidenceRecord(value.plan.sourceRefs, (record) =>
        record.claimKind === "move-date" &&
        record.subjectRef === value.plan.id &&
        record.workstreamRef === null &&
        record.readinessKind === null &&
        record.assertedDate === null &&
        record.assertedValue === "missing" &&
        sourceById.get(record.sourceRef)?.freshness === "missing"
      )) ||
    (value.plan.moveDateState === "conflicting" &&
      moveCandidateDates.size >= 2 &&
      value.plan.dateCandidates.every((item) =>
        ["current", "conflicting"].includes(
          sourceById.get(item.sourceRef)?.freshness,
        ),
      ));
  if (!moveDateStateSupported) {
    findings.push(
      finding(
        "unsupported_move_date",
        "plan",
        "The move date state and resolved value require exact source-bound candidate dates or an exact missing-date record.",
      ),
    );
  }

  const roles = value.locations.map((item) => item.role);
  for (const role of ["origin", "destination"]) {
    if (roles.filter((candidate) => candidate === role).length !== 1) {
      findings.push(
        finding(
          "invalid_location_roles",
          "locations",
          `A moving plan requires exactly one ${role} location.`,
        ),
      );
    }
  }

  for (const [index, source] of value.sources.entries()) {
    if (source.asOf > value.plan.asOf) {
      findings.push(
        finding(
          "future_source_evidence",
          `sources.${index}.asOf`,
          "Moving evidence must not postdate the plan as-of date.",
        ),
      );
    }
    if (
      source.freshness === "current" &&
      typeof source.validThrough === "string" &&
      source.validThrough < value.plan.asOf
    ) {
      findings.push(
        finding(
          "expired_current_source",
          `sources.${index}.freshness`,
          "Evidence past its validity window cannot remain current.",
        ),
      );
    }
    if (
      source.kind === "owner-action-record" &&
      (source.provenance !== "owner-supplied" ||
        source.privacy !== "private" ||
        source.ownerRef !== value.plan.ownerRef)
    ) {
      findings.push(
        finding(
          "invalid_owner_action_record",
          `sources.${index}`,
          "Owner action records must be private, owner-supplied, and name the plan owner.",
        ),
      );
    }
    if (
      source.kind === "milestone-completion-record" &&
      (source.provenance !== "owner-supplied" ||
        source.privacy !== "private" ||
        source.freshness !== "current" ||
        !milestoneSet.has(source.subjectRef) ||
        source.workstreamRef !== milestoneById.get(source.subjectRef)?.workstreamRef ||
        source.ownerRef !== milestoneById.get(source.subjectRef)?.ownerRef)
    ) {
      findings.push(
        finding(
          "invalid_milestone_completion_source",
          `sources.${index}`,
          "Milestone completion sources must be current, private, owner-supplied, and bind the exact milestone, workstream, and accountable owner.",
        ),
      );
    }
    if (source.workstreamRef) {
      findings.push(
        ...referenceFindings(
          [source.workstreamRef],
          workstreamSet,
          `sources.${index}.workstreamRef`,
          "Workstream reference",
        ),
      );
    }
    if (source.ownerRef) {
      findings.push(
        ...referenceFindings(
          [source.ownerRef],
          memberSet,
          `sources.${index}.ownerRef`,
          "Member reference",
        ),
      );
    }
    if (source.memberRefs) {
      findings.push(
        ...uniqueFindings(
          source.memberRefs,
          `sources.${index}.memberRefs`,
          "Member reference",
        ),
        ...referenceFindings(
          source.memberRefs,
          memberSet,
          `sources.${index}.memberRefs`,
          "Member reference",
        ),
      );
    }
    if (
      ["consent-record", "assignment-record"].includes(source.kind) &&
      (source.provenance !== "owner-supplied" || source.privacy !== "private")
    ) {
      findings.push(
        finding(
          "invalid_member_authority_record",
          `sources.${index}`,
          "Consent and assignment records must be private owner-supplied evidence.",
        ),
      );
    }
    if (
      source.kind === "consent-record" &&
      (!source.subjectRef || !memberSet.has(source.subjectRef))
    ) {
      findings.push(
        finding(
          "invalid_consent_subject",
          `sources.${index}.subjectRef`,
          "Consent records must identify the exact household member.",
        ),
      );
    }
    if (source.subjectRef && !crossRefs.has(source.subjectRef)) {
      findings.push(
        finding(
          "dangling_reference",
          `sources.${index}.subjectRef`,
          `Subject reference ${JSON.stringify(source.subjectRef)} does not resolve.`,
        ),
      );
    }
  }

  for (const [index, record] of value.evidenceRecords.entries()) {
    findings.push(
      ...referenceFindings(
        [record.sourceRef],
        sourceSet,
        `evidenceRecords.${index}.sourceRef`,
        "Source reference",
      ),
    );
    const source = sourceById.get(record.sourceRef);
    if (source && source.kind !== record.sourceKind) {
      findings.push(
        finding(
          "evidence_source_kind_mismatch",
          `evidenceRecords.${index}.sourceKind`,
          "Evidence records must repeat the exact kind of their referenced source.",
        ),
      );
    }
    if (record.claimKind === "move-date") {
      if (
        record.subjectRef !== value.plan.id ||
        record.workstreamRef !== null ||
        record.readinessKind !== null ||
        ((record.assertedDate === null) ===
          (record.assertedValue !== "missing")) ||
        !["owner-plan", "lease-or-sale-record"].includes(record.sourceKind)
      ) {
        findings.push(
          finding(
            "invalid_move_date_evidence",
            `evidenceRecords.${index}`,
            "Move-date evidence must bind the plan and use an owner plan or lease/sale source.",
          ),
        );
      }
    } else if (record.claimKind === "milestone-date") {
      const milestone = milestoneById.get(record.subjectRef);
      if (
        !milestoneSet.has(record.subjectRef) ||
        record.workstreamRef !== milestone?.workstreamRef ||
        record.readinessKind !== null ||
        ((record.assertedDate === null) ===
          (record.assertedValue !== "missing")) ||
        !sourceSupportsWorkstream(source, record.workstreamRef) ||
        ["consent-record", "assignment-record", "owner-action-record"].includes(
          record.sourceKind,
        )
      ) {
        findings.push(
          finding(
            "invalid_milestone_date_evidence",
            `evidenceRecords.${index}`,
            "Milestone-date evidence must bind the exact milestone and workstream and use date-relevant source evidence.",
          ),
        );
      }
    } else if (record.claimKind === "milestone-completion") {
      const milestone = milestoneById.get(record.subjectRef);
      if (
        !milestone ||
        record.workstreamRef !== milestone.workstreamRef ||
        record.ownerRef !== milestone.ownerRef ||
        record.readinessKind !== null ||
        record.assertedDate !== null ||
        record.assertedValue !== "completed" ||
        source?.kind !== "milestone-completion-record" ||
        source.subjectRef !== milestone.id ||
        source.workstreamRef !== milestone.workstreamRef ||
        source.ownerRef !== milestone.ownerRef ||
        source.freshness !== "current"
      ) {
        findings.push(
          finding(
            "invalid_milestone_completion_evidence",
            `evidenceRecords.${index}`,
            "Milestone completion evidence must bind a current completion source to the exact milestone, workstream, and accountable owner.",
          ),
        );
      }
    } else if (record.claimKind === "readiness") {
      const readiness = readinessById.get(record.subjectRef);
      if (
        !readinessSet.has(record.subjectRef) ||
        record.workstreamRef !== readiness?.workstreamRef ||
        record.readinessKind !== readiness?.kind ||
        record.assertedDate !== null ||
        record.assertedValue !== readiness?.state ||
        !sourceSupportsWorkstream(source, record.workstreamRef) ||
        !readinessSourceKinds[readiness?.kind]?.has(record.sourceKind)
      ) {
        findings.push(
          finding(
            "invalid_readiness_evidence",
            `evidenceRecords.${index}`,
            "Readiness evidence must bind the exact readiness item, workstream, kind, state, and a semantically relevant source kind.",
          ),
        );
      }
    } else if (record.claimKind === "gate-applicability") {
      const gate = gateById.get(record.subjectRef);
      if (
        !gateSet.has(record.subjectRef) ||
        record.workstreamRef !== gate?.workstreamRef ||
        record.readinessKind !== null ||
        record.assertedDate !== null ||
        record.assertedValue !== gate?.applicability.state ||
        !applicabilitySourceKinds[gate?.action]?.has(record.sourceKind) ||
        !sourceSupportsWorkstream(source, record.workstreamRef)
      ) {
        findings.push(
          finding(
            "invalid_gate_applicability_evidence",
            `evidenceRecords.${index}`,
            "Gate applicability evidence must bind the exact gate, workstream, applicability state, and a source kind and subject relevant to that action.",
          ),
        );
      }
    }
  }

  for (const [index, location] of value.locations.entries()) {
    findings.push(
      ...uniqueFindings(location.sourceRefs, `locations.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(
        location.sourceRefs,
        sourceSet,
        `locations.${index}.sourceRefs`,
        "Source reference",
      ),
      ...uniqueFindings(
        location.privateAddressSourceRefs,
        `locations.${index}.privateAddressSourceRefs`,
        "Private address source reference",
      ),
      ...referenceFindings(
        location.privateAddressSourceRefs,
        sourceSet,
        `locations.${index}.privateAddressSourceRefs`,
        "Private address source reference",
      ),
    );
    if (
      location.privateAddressSourceRefs.some(
        (ref) =>
          sourceById.get(ref)?.privacy !== "private" ||
          !["owner-only-reference", "redacted"].includes(
            sourceById.get(ref)?.locationDataHandling,
          ),
      )
    ) {
      findings.push(
        finding(
          "public_address_evidence",
          `locations.${index}.privateAddressSourceRefs`,
          "Exact address evidence must remain an owner-only or redacted reference.",
        ),
      );
    }
    if (
      location.privateAddressSourceRefs.some(
        (ref) =>
          !location.sourceRefs.includes(ref) ||
          sourceById.get(ref)?.subjectRef !== location.id,
      )
    ) {
      findings.push(
        finding(
          "unbound_address_evidence",
          `locations.${index}.privateAddressSourceRefs`,
          "Private address references must also belong to the location and identify that exact location as their subject.",
        ),
      );
    }
    if (!location.alias.startsWith(`${location.role}-`)) {
      findings.push(
        finding(
          "invalid_location_alias",
          `locations.${index}.alias`,
          "Location aliases must identify their origin or destination role without containing address data.",
        ),
      );
    }
    if (
      location.addressState === "supplied" &&
      !location.privateAddressSourceRefs.some(
        (ref) => sourceById.get(ref)?.freshness === "current",
      )
    ) {
      findings.push(
        finding(
          "unsupported_address_state",
          `locations.${index}.addressState`,
          "A supplied address requires current private address evidence.",
        ),
      );
    }
    if (
      ["missing", "conflicting"].includes(location.addressState) &&
      !location.sourceRefs.some(
        (ref) => sourceById.get(ref)?.freshness === location.addressState,
      )
    ) {
      findings.push(
        finding(
          "unsupported_address_state",
          `locations.${index}.addressState`,
          "Missing or conflicting addresses require evidence with the same visible gap state.",
        ),
      );
    }
  }

  for (const [index, member] of value.members.entries()) {
    findings.push(
      ...uniqueFindings(member.sourceRefs, `members.${index}.sourceRefs`, "Source reference"),
      ...referenceFindings(
        member.sourceRefs,
        sourceSet,
        `members.${index}.sourceRefs`,
        "Source reference",
      ),
      ...uniqueFindings(
        member.privateDetailSourceRefs,
        `members.${index}.privateDetailSourceRefs`,
        "Private detail source reference",
      ),
      ...referenceFindings(
        member.privateDetailSourceRefs,
        sourceSet,
        `members.${index}.privateDetailSourceRefs`,
        "Private detail source reference",
      ),
    );
    if (
      member.privateDetailSourceRefs.some(
        (ref) => sourceById.get(ref)?.privacy !== "private",
      )
    ) {
      findings.push(
        finding(
          "public_resident_detail",
          `members.${index}.privateDetailSourceRefs`,
          "Resident details must remain in private sources.",
        ),
      );
    }
    if (
      member.assignmentEligible &&
      !["confirmed", "not-required"].includes(member.consentState)
    ) {
      findings.push(
        finding(
          "assignment_without_consent",
          `members.${index}.assignmentEligible`,
          "Assignment eligibility requires confirmed or not-required consent.",
        ),
      );
    }
    if (
      member.assignmentEligible &&
      member.consentState === "confirmed" &&
      !member.sourceRefs.some((ref) => {
        const source = sourceById.get(ref);
        return (
          source?.kind === "consent-record" &&
          source.freshness === "current" &&
          source.subjectRef === member.id
        );
      })
    ) {
      findings.push(
        finding(
          "unsupported_member_consent",
          `members.${index}.sourceRefs`,
          "Confirmed assignment consent requires exact current member consent evidence.",
        ),
      );
    }
  }

  const readinessByWorkstream = new Map();
  for (const item of value.readinessItems) {
    const list = readinessByWorkstream.get(item.workstreamRef) ?? [];
    list.push(item);
    readinessByWorkstream.set(item.workstreamRef, list);
  }
  const milestonesByWorkstream = new Map();
  for (const item of value.milestones) {
    const list = milestonesByWorkstream.get(item.workstreamRef) ?? [];
    list.push(item);
    milestonesByWorkstream.set(item.workstreamRef, list);
  }

  for (const [index, workstream] of value.workstreams.entries()) {
    findings.push(
      ...uniqueFindings(
        workstream.locationRefs,
        `workstreams.${index}.locationRefs`,
        "Location reference",
      ),
      ...referenceFindings(
        workstream.locationRefs,
        locationSet,
        `workstreams.${index}.locationRefs`,
        "Location reference",
      ),
      ...referenceFindings(
        [workstream.ownerRef, ...workstream.assignedMemberRefs],
        memberSet,
        `workstreams.${index}.assignedMemberRefs`,
        "Member reference",
      ),
      ...uniqueFindings(
        workstream.assignedMemberRefs,
        `workstreams.${index}.assignedMemberRefs`,
        "Assigned member reference",
      ),
      ...uniqueFindings(
        workstream.sourceRefs,
        `workstreams.${index}.sourceRefs`,
        "Source reference",
      ),
      ...referenceFindings(
        workstream.sourceRefs,
        sourceSet,
        `workstreams.${index}.sourceRefs`,
        "Source reference",
      ),
    );
    const assigned = new Set(workstream.assignedMemberRefs);
    const applicableActions = new Set(workstream.applicableActions);
    for (const action of intrinsicActionsByWorkstreamKind[workstream.kind] ?? []) {
      if (!applicableActions.has(action)) {
        findings.push(
          finding(
            "missing_intrinsic_action",
            `workstreams.${index}.applicableActions`,
            `The intrinsic ${action} action cannot be omitted from this workstream.`,
          ),
        );
      }
    }
    for (const action of applicableActions) {
      if (
        !value.actionGates.some(
          (gate) =>
            gate.workstreamRef === workstream.id &&
            gate.action === action &&
            gate.state !== "not-applicable",
        )
      ) {
        findings.push(
          finding(
            "missing_applicable_action_gate",
            `workstreams.${index}.applicableActions`,
            `Applicable action ${JSON.stringify(action)} requires a non-bypassed gate on this exact workstream.`,
          ),
        );
      }
    }
    if (!assigned.has(workstream.ownerRef)) {
      findings.push(
        finding(
          "owner_not_assigned",
          `workstreams.${index}.assignedMemberRefs`,
          "The accountable workstream owner must also be an assigned member.",
        ),
      );
    }
    for (const memberRef of assigned) {
      const member = memberById.get(memberRef);
      if (
        member &&
        (!member.assignmentEligible ||
          !["confirmed", "not-required"].includes(member.consentState))
      ) {
        findings.push(
          finding(
            "invalid_member_assignment",
            `workstreams.${index}.assignedMemberRefs`,
            `Assigned member ${JSON.stringify(memberRef)} is not eligible with sufficient consent.`,
          ),
        );
      }
    }
    const locationRoles = new Set(
      workstream.locationRefs
        .map((ref) => locationById.get(ref)?.role)
        .filter(Boolean),
    );
    if (
      (workstream.kind === "origin-property" && !locationRoles.has("origin")) ||
      (workstream.kind === "destination-property" && !locationRoles.has("destination")) ||
      (["moving-service", "move-day"].includes(workstream.kind) &&
        (!locationRoles.has("origin") || !locationRoles.has("destination")))
    ) {
      findings.push(
        finding(
          "invalid_workstream_location",
          `workstreams.${index}.locationRefs`,
          "Property and move-through workstreams must reference their required origin or destination roles.",
        ),
      );
    }
    if (!readinessByWorkstream.has(workstream.id)) {
      findings.push(
        finding(
          "missing_readiness",
          `workstreams.${index}.id`,
          "Every workstream requires at least one readiness item.",
        ),
      );
    }
    if (
      workstream.kind === "move-day" &&
      !(milestonesByWorkstream.get(workstream.id) ?? []).some(
        (item) => item.phase === "move-day",
      )
    ) {
      findings.push(
        finding(
          "missing_move_day_milestone",
          `workstreams.${index}.id`,
          "The move-day workstream requires a move-day milestone.",
        ),
      );
    }
    const exactAssignments = workstream.sourceRefs.some((ref) => {
      const source = sourceById.get(ref);
      return (
        source?.kind === "assignment-record" &&
        source.freshness === "current" &&
        source.workstreamRef === workstream.id &&
        source.memberRefs?.length === workstream.assignedMemberRefs.length &&
        source.memberRefs.every((memberRef) => assigned.has(memberRef))
      );
    });
    if (!exactAssignments) {
      findings.push(
        finding(
          "missing_assignment_evidence",
          `workstreams.${index}.sourceRefs`,
          "Every workstream requires a current exact assignment record.",
        ),
      );
    }
    const expectedFreshness = {
      stale: "stale",
      missing: "missing",
      conflicting: "conflicting",
    }[workstream.state];
    if (
      expectedFreshness &&
      !workstream.sourceRefs.some(
        (ref) => sourceById.get(ref)?.freshness === expectedFreshness,
      )
    ) {
      findings.push(
        finding(
          "unsupported_workstream_state",
          `workstreams.${index}.state`,
          `The ${workstream.state} workstream state requires matching source freshness.`,
        ),
      );
    }
    if (
      ["current", "owner-review"].includes(workstream.state) &&
      workstream.sourceRefs.some(
        (ref) => sourceById.get(ref)?.freshness !== "current",
      )
    ) {
      findings.push(
        finding(
          "unsupported_workstream_state",
          `workstreams.${index}.state`,
          "Current and owner-review workstreams require only current source evidence.",
        ),
      );
    }
    if (
      workstream.state === "complete" &&
      (workstream.sourceRefs.some(
        (ref) => sourceById.get(ref)?.freshness !== "current",
      ) ||
        (readinessByWorkstream.get(workstream.id) ?? []).some(
          (item) => !["ready-for-owner-review", "not-applicable"].includes(item.state),
        ) ||
        (milestonesByWorkstream.get(workstream.id) ?? []).some(
          (item) => item.dateState !== "known" || item.status !== "completed",
        ) ||
        !milestonesByWorkstream.has(workstream.id))
    ) {
      findings.push(
        finding(
          "unsupported_complete_workstream",
          `workstreams.${index}.state`,
          "Complete workstreams require current evidence, resolved readiness, and every declared milestone completed on a known date.",
        ),
      );
    }
  }

  for (const [index, milestone] of value.milestones.entries()) {
    findings.push(
      ...referenceFindings(
        [milestone.workstreamRef],
        workstreamSet,
        `milestones.${index}.workstreamRef`,
        "Workstream reference",
      ),
      ...uniqueFindings(
        milestone.sourceRefs,
        `milestones.${index}.sourceRefs`,
        "Source reference",
      ),
      ...referenceFindings(
        milestone.sourceRefs,
        sourceSet,
        `milestones.${index}.sourceRefs`,
        "Source reference",
      ),
      ...uniqueFindings(
        milestone.completionEvidenceRefs,
        `milestones.${index}.completionEvidenceRefs`,
        "Completion evidence reference",
      ),
      ...referenceFindings(
        milestone.completionEvidenceRefs,
        evidenceSet,
        `milestones.${index}.completionEvidenceRefs`,
        "Completion evidence reference",
      ),
    );
    if (
      !memberSet.has(milestone.ownerRef) ||
      milestone.ownerRef !== workstreamById.get(milestone.workstreamRef)?.ownerRef
    ) {
      findings.push(
        finding(
          "invalid_milestone_owner",
          `milestones.${index}.ownerRef`,
          "A milestone accountable owner must match the owner of its workstream.",
        ),
      );
    }
    findings.push(
      ...candidateFindings(
        milestone.dateCandidates,
        `milestones.${index}.dateCandidates`,
        "milestone-date",
        milestone.id,
        milestone.workstreamRef,
      ),
    );
    if (
      milestone.dateCandidates.some(
        (candidate) => !milestone.sourceRefs.includes(candidate.sourceRef),
      )
    ) {
      findings.push(
        finding(
          "unbound_date_candidate",
          `milestones.${index}.dateCandidates`,
          "Every milestone date candidate source must be included in milestone.sourceRefs.",
        ),
      );
    }
    const candidateDates = new Set(
      milestone.dateCandidates.map((item) => item.date),
    );
    const dateStateSupported =
      (milestone.dateState === "known" &&
        candidateDates.size === 1 &&
        candidateDates.has(milestone.date) &&
        milestone.sourceRefs.every(
          (ref) => sourceById.get(ref)?.freshness === "current",
        ) &&
        milestone.dateCandidates.every(
          (item) => sourceById.get(item.sourceRef)?.freshness === "current",
        )) ||
      (milestone.dateState === "missing" &&
        milestone.dateCandidates.length === 0 &&
        hasEvidenceRecord(milestone.sourceRefs, (record) =>
          record.claimKind === "milestone-date" &&
          record.subjectRef === milestone.id &&
          record.workstreamRef === milestone.workstreamRef &&
          record.readinessKind === null &&
          record.assertedDate === null &&
          record.assertedValue === "missing" &&
          sourceById.get(record.sourceRef)?.freshness === "missing"
        )) ||
      (milestone.dateState === "conflicting" &&
        candidateDates.size >= 2 &&
        milestone.dateCandidates.every((item) =>
          ["current", "conflicting"].includes(
            sourceById.get(item.sourceRef)?.freshness,
          ),
        ));
    if (!dateStateSupported) {
      findings.push(
        finding(
          "unsupported_date_state",
          `milestones.${index}`,
          "Milestone date state and resolved value require exact source-bound candidate dates or an exact missing-date record.",
        ),
      );
    }
    if (value.plan.moveDateState === "known" && milestone.dateState === "known") {
      if (
        (milestone.phase === "pre-move" && milestone.date > value.plan.moveDate) ||
        (milestone.phase === "move-day" && milestone.date !== value.plan.moveDate) ||
        (milestone.phase === "post-move" && milestone.date < value.plan.moveDate)
      ) {
        findings.push(
          finding(
            "invalid_milestone_chronology",
            `milestones.${index}.date`,
            "Milestone phase and date must be chronological relative to the known move date.",
          ),
        );
      }
    }
    if (
      milestone.status === "completed" &&
      (milestone.dateState !== "known" ||
        milestone.date > value.plan.asOf ||
        milestone.sourceRefs.some(
          (ref) => sourceById.get(ref)?.freshness !== "current",
        ) ||
        milestone.completionEvidenceRefs.length === 0 ||
        milestone.completionEvidenceRefs.some((ref) => {
          const record = evidenceById.get(ref);
          return (
            record?.claimKind !== "milestone-completion" ||
            record.subjectRef !== milestone.id ||
            record.workstreamRef !== milestone.workstreamRef ||
            record.ownerRef !== milestone.ownerRef ||
            record.assertedValue !== "completed" ||
            sourceById.get(record.sourceRef)?.freshness !== "current"
          );
        }))
    ) {
      findings.push(
        finding(
          "unsupported_completed_milestone",
          `milestones.${index}.status`,
          "Completed milestones require a known past-or-present date plus current completion evidence bound to the exact milestone, workstream, and accountable owner.",
        ),
      );
    }
    if (
      milestone.status === "pending" &&
      milestone.dateState === "known" &&
      milestone.date < value.plan.asOf
    ) {
      findings.push(
        finding(
          "overdue_pending_milestone",
          `milestones.${index}.status`,
          "A known milestone before the plan as-of date cannot remain pending.",
        ),
      );
    }
  }

  const dependencyGraph = new Map(workstreamIds.map((id) => [id, []]));
  for (const [index, dependency] of value.dependencies.entries()) {
    findings.push(
      ...referenceFindings(
        [dependency.prerequisiteRef, dependency.dependentRef],
        workstreamSet,
        `dependencies.${index}`,
        "Workstream reference",
      ),
      ...uniqueFindings(
        dependency.sourceRefs,
        `dependencies.${index}.sourceRefs`,
        "Source reference",
      ),
      ...referenceFindings(
        dependency.sourceRefs,
        sourceSet,
        `dependencies.${index}.sourceRefs`,
        "Source reference",
      ),
    );
    if (dependency.prerequisiteRef === dependency.dependentRef) {
      findings.push(
        finding(
          "self_dependency",
          `dependencies.${index}`,
          "A workstream cannot depend on itself.",
        ),
      );
    }
    dependencyGraph
      .get(dependency.prerequisiteRef)
      ?.push(dependency.dependentRef);
    const prerequisiteDates = (milestonesByWorkstream.get(
      dependency.prerequisiteRef,
    ) ?? [])
      .filter((item) => item.dateState === "known")
      .map((item) => item.date);
    const dependentDates = (milestonesByWorkstream.get(dependency.dependentRef) ?? [])
      .filter((item) => item.dateState === "known")
      .map((item) => item.date);
    if (
      prerequisiteDates.length > 0 &&
      dependentDates.length > 0 &&
      prerequisiteDates.sort().at(-1) > dependentDates.sort().at(0)
    ) {
      findings.push(
        finding(
          "invalid_dependency_chronology",
          `dependencies.${index}`,
          "Known prerequisite milestones must not occur after known dependent milestones.",
        ),
      );
    }
    if (
      dependency.state === "satisfied" &&
      (workstreamById.get(dependency.prerequisiteRef)?.state !== "complete" ||
        dependency.sourceRefs.some(
          (ref) => sourceById.get(ref)?.freshness !== "current",
        ))
    ) {
      findings.push(
        finding(
          "unsupported_satisfied_dependency",
          `dependencies.${index}.state`,
          "Satisfied dependencies require a complete prerequisite and current evidence.",
        ),
      );
    }
  }
  const visiting = new Set();
  const visited = new Set();
  function visitWorkstream(id) {
    if (visiting.has(id)) {
      return true;
    }
    if (visited.has(id)) {
      return false;
    }
    visiting.add(id);
    for (const next of dependencyGraph.get(id) ?? []) {
      if (visitWorkstream(next)) {
        return true;
      }
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }
  if (workstreamIds.some((id) => visitWorkstream(id))) {
    findings.push(
      finding(
        "dependency_cycle",
        "dependencies",
        "Moving workstream dependencies must remain acyclic.",
      ),
    );
  }

  for (const [index, readiness] of value.readinessItems.entries()) {
    findings.push(
      ...referenceFindings(
        [readiness.workstreamRef],
        workstreamSet,
        `readinessItems.${index}.workstreamRef`,
        "Workstream reference",
      ),
      ...referenceFindings(
        [readiness.ownerRef],
        memberSet,
        `readinessItems.${index}.ownerRef`,
        "Member reference",
      ),
      ...uniqueFindings(
        readiness.evidenceRefs,
        `readinessItems.${index}.evidenceRefs`,
        "Evidence reference",
      ),
      ...referenceFindings(
        readiness.evidenceRefs,
        sourceSet,
        `readinessItems.${index}.evidenceRefs`,
        "Evidence reference",
      ),
    );
    const workstream = workstreamById.get(readiness.workstreamRef);
    if (workstream && readiness.ownerRef !== workstream.ownerRef) {
      findings.push(
        finding(
          "readiness_owner_mismatch",
          `readinessItems.${index}.ownerRef`,
          "Readiness must remain with the named workstream owner.",
        ),
      );
    }
    if (
      !hasEvidenceRecord(readiness.evidenceRefs, (record) =>
        record.claimKind === "readiness" &&
        record.subjectRef === readiness.id &&
        record.workstreamRef === readiness.workstreamRef &&
        record.readinessKind === readiness.kind &&
        record.assertedDate === null &&
        record.assertedValue === readiness.state &&
        readinessSourceKinds[readiness.kind].has(record.sourceKind)
      )
    ) {
      findings.push(
        finding(
          "unsupported_ready_item",
          `readinessItems.${index}.evidenceRefs`,
          "Readiness requires evidence for the exact item, workstream, kind, and asserted state.",
        ),
      );
    }
    if (
      readiness.state === "ready-for-owner-review" &&
      readiness.evidenceRefs.some(
        (ref) => sourceById.get(ref)?.freshness !== "current",
      )
    ) {
      findings.push(
        finding(
          "unsupported_ready_item",
          `readinessItems.${index}.state`,
          "Ready moving items require only current evidence.",
        ),
      );
    }
  }

  for (const [index, gate] of value.actionGates.entries()) {
    findings.push(
      ...referenceFindings(
        [gate.workstreamRef],
        workstreamSet,
        `actionGates.${index}.workstreamRef`,
        "Workstream reference",
      ),
      ...referenceFindings(
        [gate.ownerRef, ...gate.requiredMemberRefs],
        memberSet,
        `actionGates.${index}.requiredMemberRefs`,
        "Member reference",
      ),
      ...uniqueFindings(
        gate.requiredMemberRefs,
        `actionGates.${index}.requiredMemberRefs`,
        "Required member reference",
      ),
      ...uniqueFindings(
        gate.consentSourceRefs,
        `actionGates.${index}.consentSourceRefs`,
        "Consent source reference",
      ),
      ...referenceFindings(
        gate.consentSourceRefs,
        sourceSet,
        `actionGates.${index}.consentSourceRefs`,
        "Consent source reference",
      ),
      ...uniqueFindings(
        gate.evidenceRefs,
        `actionGates.${index}.evidenceRefs`,
        "Evidence reference",
      ),
      ...referenceFindings(
        gate.evidenceRefs,
        sourceSet,
        `actionGates.${index}.evidenceRefs`,
        "Evidence reference",
      ),
    );
    if (gate.ownerRef !== value.plan.ownerRef) {
      findings.push(
        finding(
          "gate_owner_mismatch",
          `actionGates.${index}.ownerRef`,
          "External moving actions must remain with the named plan owner.",
        ),
      );
    }
    const workstreamKind = workstreamById.get(gate.workstreamRef)?.kind;
    if (
      workstreamKind &&
      !gateWorkstreamKinds[gate.action].has(workstreamKind)
    ) {
      findings.push(
        finding(
          "invalid_gate_workstream",
          `actionGates.${index}.workstreamRef`,
          `The ${gate.action} gate is not attached to an applicable moving workstream.`,
        ),
      );
    }
    const workstream = workstreamById.get(gate.workstreamRef);
    const declaredApplicable = workstream?.applicableActions.includes(gate.action);
    if (
      (gate.applicability.state === "applicable" && !declaredApplicable) ||
      (gate.applicability.state === "not-applicable" && declaredApplicable)
    ) {
      findings.push(
        finding(
          "gate_applicability_mismatch",
          `actionGates.${index}.applicability.state`,
          "Gate applicability must match the action list declared by its workstream.",
        ),
      );
    }
    if (
      gate.state === "not-applicable" &&
      intrinsicActionsByWorkstreamKind[workstreamKind]?.has(gate.action)
    ) {
      findings.push(
        finding(
          "intrinsic_action_not_applicable",
          `actionGates.${index}.state`,
          "An action intrinsic to the corresponding workstream cannot be marked not applicable.",
        ),
      );
    }
    if (
      gate.state === "not-applicable" &&
      (gate.applicability.rationale.trim().length === 0 ||
        gate.applicability.evidenceRefs.some(
          (ref) => sourceById.get(ref)?.freshness !== "current",
        ))
    ) {
      findings.push(
        finding(
          "unsupported_not_applicable_gate",
          `actionGates.${index}.applicability`,
          "A not-applicable gate requires a substantive rationale and current exact applicability evidence.",
        ),
      );
    }
    findings.push(
      ...uniqueFindings(
        gate.applicability.evidenceRefs,
        `actionGates.${index}.applicability.evidenceRefs`,
        "Applicability evidence reference",
      ),
      ...referenceFindings(
        gate.applicability.evidenceRefs,
        sourceSet,
        `actionGates.${index}.applicability.evidenceRefs`,
        "Applicability evidence reference",
      ),
    );
    if (
      !hasEvidenceRecord(gate.applicability.evidenceRefs, (record) =>
        record.claimKind === "gate-applicability" &&
        record.subjectRef === gate.id &&
        record.workstreamRef === gate.workstreamRef &&
        record.readinessKind === null &&
        record.assertedDate === null &&
        record.assertedValue === gate.applicability.state
      )
    ) {
      findings.push(
        finding(
          "missing_gate_applicability_evidence",
          `actionGates.${index}.applicability.evidenceRefs`,
          "Every action gate requires exact structured applicability evidence.",
        ),
      );
    }
    if (!gate.requiredMemberRefs.includes(gate.ownerRef)) {
      findings.push(
        finding(
          "missing_owner_consent",
          `actionGates.${index}.requiredMemberRefs`,
          "The named action owner must be included among required principals.",
        ),
      );
    }
    if (
      gate.requiredMemberRefs.some((ref) => {
        const member = memberById.get(ref);
        return member && !["confirmed", "not-required"].includes(member.consentState);
      })
    ) {
      findings.push(
        finding(
          "insufficient_member_consent",
          `actionGates.${index}.requiredMemberRefs`,
          "Required principals must have confirmed or not-required consent.",
        ),
      );
    }
    for (const memberRef of gate.requiredMemberRefs) {
      if (
        !gate.consentSourceRefs.some((ref) => {
          const source = sourceById.get(ref);
          return (
            source?.kind === "consent-record" &&
            source.freshness === "current" &&
            source.subjectRef === memberRef
          );
        })
      ) {
        findings.push(
          finding(
            "missing_consent_evidence",
            `actionGates.${index}.consentSourceRefs`,
            `Required principal ${JSON.stringify(memberRef)} needs exact current consent evidence.`,
          ),
        );
      }
    }
    if (gate.state === "completed-by-owner") {
      const exactRecord = gate.evidenceRefs.some((ref) => {
        const source = sourceById.get(ref);
        return (
          source?.kind === "owner-action-record" &&
          source.freshness === "current" &&
          source.provenance === "owner-supplied" &&
          source.ownerRef === gate.ownerRef &&
          source.workstreamRef === gate.workstreamRef &&
          source.action === gate.action
        );
      });
      if (!exactRecord) {
        findings.push(
          finding(
            "missing_exact_action_evidence",
            `actionGates.${index}.evidenceRefs`,
            "Completed owner actions require a current exact owner, workstream, and action record.",
          ),
        );
      }
    }
  }

  for (const [collectionName, collection] of [
    ["gaps", value.gaps],
    ["reviewQuestions", value.reviewQuestions],
  ]) {
    for (const [index, item] of collection.entries()) {
      findings.push(
        ...referenceFindings(
          [item.ownerRef],
          memberSet,
          `${collectionName}.${index}.ownerRef`,
          "Member reference",
        ),
        ...uniqueFindings(item.refs, `${collectionName}.${index}.refs`, "Reference"),
        ...referenceFindings(
          item.refs,
          crossRefs,
          `${collectionName}.${index}.refs`,
          "Reference",
        ),
      );
      if (item.ownerRef !== value.plan.ownerRef) {
        findings.push(
          finding(
            "owner_mismatch",
            `${collectionName}.${index}.ownerRef`,
            "Move gaps and owner decisions must remain with the named plan owner.",
          ),
        );
      }
    }
  }
  findings.push(
    ...uniqueFindings(
      value.handoff.reviewQuestionRefs,
      "handoff.reviewQuestionRefs",
      "Review question reference",
    ),
    ...referenceFindings(
      value.handoff.reviewQuestionRefs,
      new Set(questionIds),
      "handoff.reviewQuestionRefs",
      "Review question reference",
    ),
    ...uniqueFindings(
      value.handoff.blockingRefs,
      "handoff.blockingRefs",
      "Blocking reference",
    ),
    ...referenceFindings(
      value.handoff.blockingRefs,
      crossRefs,
      "handoff.blockingRefs",
      "Blocking reference",
    ),
  );
  const unresolved =
    value.plan.moveDateState !== "known" ||
    value.sources.some((item) =>
      ["stale", "missing", "conflicting"].includes(item.freshness),
    ) ||
    value.workstreams.some((item) => item.state !== "complete") ||
    value.milestones.some(
      (item) => item.dateState !== "known" || item.status !== "completed",
    ) ||
    value.readinessItems.some(
      (item) => !["ready-for-owner-review", "not-applicable"].includes(item.state),
    ) ||
    value.dependencies.some((item) => item.state !== "satisfied") ||
    value.actionGates.some(
      (item) => !["completed-by-owner", "not-applicable"].includes(item.state),
    ) ||
    value.gaps.length > 0 ||
    value.reviewQuestions.length > 0;
  if (value.handoff.state === "ready-for-owner-review" && unresolved) {
    findings.push(
      finding(
        "unsupported_ready_state",
        "handoff.state",
        "An owner-ready moving handoff requires resolved dates, evidence, workstreams, readiness, dependencies, action gates, and gaps.",
      ),
    );
  }
  if (
    value.handoff.state === "blocked" &&
    value.handoff.blockingRefs.length === 0
  ) {
    findings.push(
      finding(
        "missing_blocking_reference",
        "handoff.blockingRefs",
        "A blocked moving handoff must name at least one blocking reference.",
      ),
    );
  }
  const blockingStateById = new Map([
    ...value.sources.map((item) => [
      item.id,
      ["stale", "missing", "conflicting"].includes(item.freshness),
    ]),
    ...value.workstreams.map((item) => [
      item.id,
      ["stale", "missing", "blocked", "conflicting"].includes(item.state),
    ]),
    ...value.milestones.map((item) => [
      item.id,
      item.status !== "completed" || item.dateState !== "known",
    ]),
    ...value.dependencies.map((item) => [item.id, item.state === "blocked"]),
    ...value.readinessItems.map((item) => [
      item.id,
      ["needs-evidence", "blocked"].includes(item.state),
    ]),
    ...value.actionGates.map((item) => [
      item.id,
      ["blocked", "pending-owner-decision"].includes(item.state),
    ]),
    ...value.gaps.map((item) => [item.id, true]),
    ...value.reviewQuestions.map((item) => [item.id, true]),
  ]);
  for (const [index, ref] of value.handoff.blockingRefs.entries()) {
    if (blockingStateById.has(ref) && !blockingStateById.get(ref)) {
      findings.push(
        finding(
          "nonblocking_handoff_reference",
          `handoff.blockingRefs.${index}`,
          `Handoff reference ${JSON.stringify(ref)} is not in a blocking state.`,
        ),
      );
    }
  }

  const decodeUrlForPrivacyScan = (url) => {
    if (typeof url !== "string") {
      return url;
    }
    return url
      .split(/([/?&=#])/u)
      .map((component) => {
        let decoded = component;
        for (let attempt = 0; attempt < 4; attempt += 1) {
          try {
            const decodable = decoded.replace(/%(?![0-9a-f]{2})/giu, "%25");
            const next = decodeURIComponent(decodable);
            if (next === decoded) {
              break;
            }
            decoded = next;
          } catch {
            break;
          }
        }
        return decoded;
      })
      .join("");
  };
  const publicText = canonicalJson({
    sources: value.sources.map(({ label, url }) => ({
      label,
      url: decodeUrlForPrivacyScan(url),
    })),
    locations: value.locations.map(({ alias }) => alias),
    members: value.members.map(({ displayName }) => displayName),
    workstreams: value.workstreams.map(({ title }) => title),
    milestones: value.milestones.map(({ title }) => title),
    gaps: value.gaps.map(({ reason }) => reason),
    reviewQuestions: value.reviewQuestions.map(({ question, reason }) => ({
      question,
      reason,
    })),
    applicabilityRationales: value.actionGates.map(
      ({ applicability }) => applicability.rationale,
    ),
    handoff: value.handoff.prohibitedActions,
  });
  const addressScanText = publicText.replace(/[-/_+]/gu, " ");
  if (
    /\b\d{1,6}[\p{L}]?(?:[-/]\d{1,6}[\p{L}]?)?\s+[\p{L}0-9.'-]+(?:\s+[\p{L}0-9.'-]+){0,5}\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|court|ct|way|parkway|pkwy|place|pl|terrace|ter|trail|trl|circle|cir|highway|hwy)\b/iu.test(
      addressScanText,
    )
  ) {
    findings.push(
      finding(
        "private_address_exposure",
        "locations",
        "Moving-plan text and source URLs must not expose an exact street address.",
      ),
    );
  }
  if (
    /\b(?:book|reserve|sign|pay|send|contact|change|submit|enroll|register|forward)\b[^.!?]{0,80}\b(?:now|immediately|for (?:me|us|the owner)|on (?:my|our|their) behalf)\b/iu.test(
      publicText,
    )
  ) {
    findings.push(
      finding(
        "external_action_content",
        "reviewQuestions",
        "Moving artifacts must not instruct the agent to execute external actions.",
      ),
    );
  }
  return findings;
}

function spreadsheetChangeFindings(value) {
  const sheetIds = value.sheets.map((item) => item.id);
  const transformationIds = value.transformations.map((item) => item.id);
  const checkIds = value.checks.map((item) => item.id);
  const exceptionIds = value.exceptions.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const sheetSet = new Set(sheetIds);
  const transformationSet = new Set(transformationIds);
  const checkSet = new Set(checkIds);
  const exceptionSet = new Set(exceptionIds);
  const questionSet = new Set(questionIds);
  const allRefs = new Set([
    value.workbook.id,
    ...sheetIds,
    ...transformationIds,
    ...checkIds,
    ...exceptionIds,
    ...questionIds,
  ]);
  const requiredActions = [
    "overwrite-source",
    "replace-formulas-with-values",
    "execute-macros",
    "upload-workbook",
    "disclose-sensitive-data",
    "infer-missing-facts",
    "accept-output",
  ];
  const requiredCheckKinds = [
    "source-hash",
    "formula-preservation",
    "recalculation",
    "formatting",
    "links",
    "charts",
    "macros",
    "validation",
    "output-open",
  ];
  const findings = [
    ...uniqueFindings(sheetIds, "sheets", "Sheet id"),
    ...uniqueFindings(transformationIds, "transformations", "Transformation id"),
    ...uniqueFindings(checkIds, "checks", "Check id"),
    ...uniqueFindings(exceptionIds, "exceptions", "Exception id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  if (
    !isSafePackagePath(value.workbook.sourcePath) ||
    !value.workbook.sourcePath.startsWith("inputs/") ||
    !isSafePackagePath(value.workbook.outputPath) ||
    !value.workbook.outputPath.startsWith("outputs/") ||
    portablePathKey(value.workbook.sourcePath) ===
      portablePathKey(value.workbook.outputPath)
  ) {
    findings.push(
      finding(
        "unsafe_workbook_path",
        "workbook.outputPath",
        "Source and output workbook paths must be distinct portable paths under inputs/ and outputs/.",
      ),
    );
  }
  for (const [index, sheet] of value.sheets.entries()) {
    if (
      !sheet.sourcePreserved ||
      (["source", "calculation", "lookup"].includes(sheet.role) &&
        sheet.formulaCountBefore !== sheet.formulaCountAfter)
    ) {
      findings.push(
        finding(
          "source_sheet_mutation",
          `sheets.${index}`,
          "Source, calculation, and lookup sheets must remain preserved with unchanged formula counts.",
        ),
      );
    }
  }
  const availableInputs = new Set(sheetIds);
  for (const [index, item] of value.transformations.entries()) {
    findings.push(
      ...referenceFindings(
        [item.targetSheetRef],
        sheetSet,
        `transformations.${index}.targetSheetRef`,
        "Transformation target sheet",
      ),
      ...referenceFindings(
        item.inputRefs,
        availableInputs,
        `transformations.${index}.inputRefs`,
        "Transformation input",
      ),
    );
    if (
      ["add-formula", "add-sheet"].includes(item.kind) &&
      item.formulaPolicy !== "add-only"
    ) {
      findings.push(
        finding(
          "unsafe_formula_policy",
          `transformations.${index}.formulaPolicy`,
          "Formula-creating transformations must use the add-only policy.",
        ),
      );
    }
    availableInputs.add(item.id);
  }
  for (const [index, check] of value.checks.entries()) {
    findings.push(
      ...referenceFindings(
        check.refs,
        allRefs,
        `checks.${index}.refs`,
        "Check reference",
      ),
    );
  }
  for (const kind of requiredCheckKinds) {
    if (!value.checks.some((item) => item.kind === kind)) {
      findings.push(
        finding(
          "missing_verification_check",
          "checks",
          `Spreadsheet manifests must report a ${kind} check, using not-applicable with an explanation when the check does not apply.`,
        ),
      );
    }
  }
  for (const [index, item] of value.exceptions.entries()) {
    findings.push(
      ...referenceFindings(
        item.refs,
        allRefs,
        `exceptions.${index}.refs`,
        "Exception reference",
      ),
    );
  }
  for (const [index, item] of value.reviewQuestions.entries()) {
    findings.push(
      ...referenceFindings(
        item.refs,
        allRefs,
        `reviewQuestions.${index}.refs`,
        "Review question reference",
      ),
    );
  }
  findings.push(
    ...referenceFindings(
      value.handoff.transformationRefs,
      transformationSet,
      "handoff.transformationRefs",
      "Handoff transformation reference",
    ),
    ...referenceFindings(
      value.handoff.checkRefs,
      checkSet,
      "handoff.checkRefs",
      "Handoff check reference",
    ),
    ...referenceFindings(
      value.handoff.exceptionRefs,
      exceptionSet,
      "handoff.exceptionRefs",
      "Handoff exception reference",
    ),
    ...referenceFindings(
      value.handoff.reviewQuestionRefs,
      questionSet,
      "handoff.reviewQuestionRefs",
      "Handoff question reference",
    ),
    ...referenceFindings(
      value.handoff.blockingRefs,
      allRefs,
      "handoff.blockingRefs",
      "Handoff blocker reference",
    ),
  );
  if (value.handoff.owner !== value.workbook.owner) {
    findings.push(
      finding(
        "owner_mismatch",
        "handoff.owner",
        "The workbook and handoff must name the same accountable owner.",
      ),
    );
  }
  if (
    /^(?:the )?(?:agent|assistant|claw)$/iu.test(value.handoff.owner.trim()) ||
    /\b(?:ai|bot|gpt|language model|spreadsheet analyst)\b/iu.test(
      value.handoff.owner,
    )
  ) {
    findings.push(
      finding(
        "agent_owned_authority",
        "handoff.owner",
        "Workbook acceptance authority must remain with a named human or team.",
      ),
    );
  }
  const failedChecks = value.checks.filter((item) =>
    ["failed", "not-run"].includes(item.status),
  );
  const unresolvedHighExceptions = value.exceptions.filter(
    (item) => item.severity === "high" && item.state !== "resolved",
  );
  const blockedTransforms = value.transformations.filter(
    (item) => item.state === "blocked",
  );
  const requiredBlockerIds = [
    ...failedChecks.map((item) => item.id),
    ...unresolvedHighExceptions.map((item) => item.id),
    ...blockedTransforms.map((item) => item.id),
  ];
  if (
    value.handoff.state === "ready-for-owner-review" &&
    (value.workbook.state !== "ready-for-owner-review" ||
      value.transformations.some((item) => item.state !== "verified") ||
      failedChecks.length > 0 ||
      unresolvedHighExceptions.length > 0 ||
      value.handoff.blockingRefs.length > 0 ||
      transformationIds.some(
        (id) => !value.handoff.transformationRefs.includes(id),
      ) ||
      checkIds.some((id) => !value.handoff.checkRefs.includes(id)) ||
      exceptionIds.some((id) => !value.handoff.exceptionRefs.includes(id)) ||
      questionIds.some((id) => !value.handoff.reviewQuestionRefs.includes(id)))
  ) {
    findings.push(
      finding(
        "premature_ready_state",
        "handoff.state",
        "Owner-ready spreadsheet handoffs require verified transformations, completed checks, no unresolved high exceptions, complete references, and no blockers.",
      ),
    );
  }
  if (
    value.handoff.state === "blocked" &&
    (requiredBlockerIds.some((id) => !value.handoff.blockingRefs.includes(id)) ||
      (requiredBlockerIds.length === 0 &&
        value.workbook.state === "ready-for-owner-review"))
  ) {
    findings.push(
      finding(
        "incomplete_blocked_handoff",
        "handoff",
        "Blocked spreadsheet handoffs must include every failed check, unresolved high exception, and blocked transformation.",
      ),
    );
  }
  if (
    value.workbook.state === "ready-for-owner-review" &&
    value.handoff.state !== "ready-for-owner-review"
  ) {
    findings.push(
      finding(
        "inconsistent_ready_state",
        "workbook.state",
        "A workbook cannot claim owner-review readiness while its handoff remains blocked.",
      ),
    );
  }
  for (const action of requiredActions) {
    if (
      !value.blockedActions.includes(action) ||
      !value.handoff.prohibitedActions.includes(action)
    ) {
      findings.push(
        finding(
          "missing_authority_gate",
          "blockedActions",
          `Spreadsheet artifacts must keep ${action} explicitly prohibited.`,
        ),
      );
    }
  }
  return findings;
}

function mediaEvidenceFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const evidenceIds = value.evidence.map((item) => item.id);
  const observationIds = value.observations.map((item) => item.id);
  const gapIds = value.gaps.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const evidenceSet = new Set(evidenceIds);
  const observationSet = new Set(observationIds);
  const gapSet = new Set(gapIds);
  const questionSet = new Set(questionIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const evidenceById = new Map(value.evidence.map((item) => [item.id, item]));
  const observationById = new Map(value.observations.map((item) => [item.id, item]));
  const requiredUses = [
    "local-frame-extraction",
    "local-transcription",
    "question-focused-analysis",
    "redacted-internal-handoff",
  ];
  const requiredActions = [
    "identify-person",
    "infer-identity",
    "infer-intent",
    "fill-missing-events",
    "fabricate-quotation",
    "process-out-of-scope",
    "retain-beyond-policy",
    "distribute-media",
    "publish-evidence",
    "upload-external",
    "disable-redaction",
  ];
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(evidenceIds, "evidence", "Evidence id"),
    ...uniqueFindings(
      value.evidence.map((item) => portablePathKey(item.path)),
      "evidence",
      "Evidence path",
    ),
    ...uniqueFindings(observationIds, "observations", "Observation id"),
    ...uniqueFindings(gapIds, "gaps", "Gap id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];

  if (
    value.review.windowStartSeconds > value.review.windowEndSeconds ||
    value.review.windowEndSeconds > value.review.sourceDurationSeconds
  ) {
    findings.push(
      finding(
        "invalid_review_window",
        "review.windowEndSeconds",
        "The review window must be ordered and remain within the source duration.",
      ),
    );
  }
  if (
    !isSafePackagePath(value.review.destination) ||
    !value.review.destination.startsWith("outputs/")
  ) {
    findings.push(
      finding(
        "unsafe_handoff_destination",
        "review.destination",
        "The media-review destination must remain a portable path under outputs/.",
      ),
    );
  }

  const expectedSourceAuthority = {
    "media-file": "media-owner",
    "authority-record": "data-controller",
    "consent-record": "data-controller",
    "retention-policy": "policy-owner",
    "reviewer-note": "reviewer",
  };
  for (const [index, source] of value.sources.entries()) {
    if (source.authority !== expectedSourceAuthority[source.kind]) {
      findings.push(
        finding(
          "source_authority_mismatch",
          `sources.${index}.authority`,
          `${source.kind} evidence must use its declared authority.`,
        ),
      );
    }
    if (Date.parse(source.capturedAt) > Date.parse(value.review.asOf)) {
      findings.push(
        finding(
          "future_source_evidence",
          `sources.${index}.capturedAt`,
          "Media-review sources must not postdate the artifact as-of time.",
        ),
      );
    }
    if (
      (source.kind === "media-file" && source.sha256 === null) ||
      (source.kind !== "media-file" && source.sha256 !== null)
    ) {
      findings.push(
        finding(
          "incoherent_source_digest",
          `sources.${index}.sha256`,
          "Media files require a digest and non-media authority records must leave it null.",
        ),
      );
    }
  }

  const authorityRefs = [
    ["authoritySourceRef", "authority-record"],
    ["consentSourceRef", "consent-record"],
    ["retentionSourceRef", "retention-policy"],
  ];
  for (const [field, expectedKind] of authorityRefs) {
    const source = sourceById.get(value.authority[field]);
    if (!source || source.kind !== expectedKind || source.integrity !== "verified") {
      findings.push(
        finding(
          "invalid_authority_reference",
          `authority.${field}`,
          `${field} must reference verified ${expectedKind} evidence.`,
        ),
      );
    }
  }

  for (const [index, item] of value.evidence.entries()) {
    findings.push(
      ...referenceFindings(
        [item.sourceRef],
        sourceSet,
        `evidence.${index}.sourceRef`,
        "Evidence source reference",
      ),
    );
    if (
      item.startSeconds > item.endSeconds ||
      item.startSeconds < value.review.windowStartSeconds ||
      item.endSeconds > value.review.windowEndSeconds
    ) {
      findings.push(
        finding(
          "evidence_outside_review_window",
          `evidence.${index}.startSeconds`,
          "Evidence timestamps must be ordered and remain inside the authorized review window.",
        ),
      );
    }
    if (!isSafePackagePath(item.path)) {
      findings.push(
        finding(
          "unsafe_evidence_path",
          `evidence.${index}.path`,
          "Evidence paths must remain portable and workspace-relative.",
        ),
      );
    }
    if (sourceById.get(item.sourceRef)?.kind !== "media-file") {
      findings.push(
        finding(
          "invalid_media_source",
          `evidence.${index}.sourceRef`,
          "Frames, clips, and transcripts must derive from a media-file source.",
        ),
      );
    }
    if (
      (item.kind === "transcript" && item.transcript === null) ||
      (item.kind !== "transcript" && item.transcript !== null)
    ) {
      findings.push(
        finding(
          "incoherent_transcript",
          `evidence.${index}.transcript`,
          "Transcript evidence requires transcript detail and non-transcript evidence must leave it null.",
        ),
      );
    }
    const redactionApproval = sourceById.get(item.redactionApprovalSourceRef);
    if (
      (item.redactionState === "approved-unredacted" &&
        (!redactionApproval ||
          !["authority-record", "consent-record"].includes(
            redactionApproval.kind,
          ) ||
          redactionApproval.integrity !== "verified")) ||
      (item.redactionState !== "approved-unredacted" &&
        item.redactionApprovalSourceRef !== null)
    ) {
      findings.push(
        finding(
          "invalid_redaction_approval",
          `evidence.${index}.redactionApprovalSourceRef`,
          "Approved unredacted evidence requires a verified authority or consent source, and other redaction states must not claim one.",
        ),
      );
    }
    if (item.sensitivity.length > 0 && item.redactionState === "not-required") {
      findings.push(
        finding(
          "missing_sensitive_evidence_redaction",
          `evidence.${index}.redactionState`,
          "Evidence with declared sensitivity must be redacted, pending redaction, or explicitly approved unredacted.",
        ),
      );
    }
    if (
      item.transcript &&
      item.transcript.confidence < 0.8 &&
      item.transcript.ambiguity === null
    ) {
      findings.push(
        finding(
          "unmarked_transcript_ambiguity",
          `evidence.${index}.transcript.ambiguity`,
          "Low-confidence transcripts must explain their ambiguity.",
        ),
      );
    }
  }

  for (const [index, item] of value.observations.entries()) {
    findings.push(
      ...referenceFindings(
        item.evidenceRefs,
        evidenceSet,
        `observations.${index}.evidenceRefs`,
        "Observation evidence reference",
      ),
    );
    const evidence = item.evidenceRefs
      .map((ref) => evidenceById.get(ref))
      .filter(Boolean);
    if (
      item.state === "supported" &&
      (evidence.some(
        (record) =>
          record.extractionState !== "complete" ||
          record.redactionState === "pending" ||
          sourceById.get(record.sourceRef)?.integrity !== "verified",
      ) ||
        item.confidence === "low")
    ) {
      findings.push(
        finding(
          "unsupported_observation_state",
          `observations.${index}.state`,
          "Supported observations require complete, reviewable evidence from verified media and cannot have low confidence.",
        ),
      );
    }
    if (
      ["identity", "intent", "missing-event"].includes(item.kind) &&
      item.state !== "blocked"
    ) {
      findings.push(
        finding(
          "prohibited_inference_state",
          `observations.${index}.state`,
          "Identity, intent, and missing-event claims must remain blocked.",
        ),
      );
    }
    if (
      item.exactQuote &&
      !evidence.some(
        (record) =>
          record.kind === "transcript" &&
          record.transcript?.confidence >= 0.9 &&
          record.transcript.ambiguity === null,
      )
    ) {
      findings.push(
        finding(
          "unsupported_exact_quote",
          `observations.${index}.exactQuote`,
          "Exact quotations require unambiguous transcript evidence with confidence of at least 0.9.",
        ),
      );
    }
    if (item.state !== "supported" && item.limitations.length === 0) {
      findings.push(
        finding(
          "missing_observation_limitation",
          `observations.${index}.limitations`,
          "Uncertain or blocked observations must preserve a visible limitation.",
        ),
      );
    }
  }

  for (const [index, gap] of value.gaps.entries()) {
    findings.push(
      ...referenceFindings(
        gap.evidenceRefs,
        evidenceSet,
        `gaps.${index}.evidenceRefs`,
        "Gap evidence reference",
      ),
    );
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...referenceFindings(
        question.observationRefs,
        observationSet,
        `reviewQuestions.${index}.observationRefs`,
        "Question observation reference",
      ),
      ...referenceFindings(
        question.gapRefs,
        gapSet,
        `reviewQuestions.${index}.gapRefs`,
        "Question gap reference",
      ),
    );
  }

  findings.push(
    ...referenceFindings(
      value.handoff.observationRefs,
      observationSet,
      "handoff.observationRefs",
      "Handoff observation reference",
    ),
    ...referenceFindings(
      value.handoff.gapRefs,
      gapSet,
      "handoff.gapRefs",
      "Handoff gap reference",
    ),
    ...referenceFindings(
      value.handoff.reviewQuestionRefs,
      questionSet,
      "handoff.reviewQuestionRefs",
      "Handoff question reference",
    ),
    ...referenceFindings(
      value.handoff.blockingObservationRefs,
      observationSet,
      "handoff.blockingObservationRefs",
      "Blocking observation reference",
    ),
  );
  if (value.handoff.owner !== value.review.owner) {
    findings.push(
      finding(
        "owner_mismatch",
        "handoff.owner",
        "The review and handoff must name the same accountable owner.",
      ),
    );
  }
  if (
    /^(?:the )?(?:agent|assistant|claw)$/iu.test(value.handoff.owner.trim()) ||
    /\b(?:ai|bot|gpt|language model|media evidence reviewer)\b/iu.test(
      value.handoff.owner,
    )
  ) {
    findings.push(
      finding(
        "agent_owned_authority",
        "handoff.owner",
        "Media-processing and disclosure authority must remain with a named human or team.",
      ),
    );
  }

  const blockedObservationIds = value.observations
    .filter((item) => item.state === "blocked")
    .map((item) => item.id);
  if (
    value.handoff.blockingObservationRefs.some(
      (ref) => observationById.get(ref)?.state !== "blocked",
    )
  ) {
    findings.push(
      finding(
        "resolved_blocking_observation",
        "handoff.blockingObservationRefs",
        "Only blocked observations may remain handoff blockers.",
      ),
    );
  }
  if (
    value.handoff.state === "blocked" &&
    (blockedObservationIds.some(
      (id) => !value.handoff.blockingObservationRefs.includes(id),
    ) ||
      (blockedObservationIds.length === 0 &&
        value.review.state === "ready-for-owner-review"))
  ) {
    findings.push(
      finding(
        "incomplete_blocked_handoff",
        "handoff",
        "Blocked handoffs must include every blocked observation and retain a visible blocker.",
      ),
    );
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    (value.review.state !== "ready-for-owner-review" ||
      !value.authority.processingAuthorized ||
      value.authority.consentState !== "verified" ||
      requiredUses.some((use) => !value.authority.authorizedUses.includes(use)) ||
      value.sources.some((source) => source.integrity !== "verified") ||
      value.evidence.some((item) => item.redactionState === "pending") ||
      blockedObservationIds.length > 0 ||
      value.handoff.blockingObservationRefs.length > 0 ||
      observationIds.some((id) => !value.handoff.observationRefs.includes(id)) ||
      gapIds.some((id) => !value.handoff.gapRefs.includes(id)) ||
      questionIds.some((id) => !value.handoff.reviewQuestionRefs.includes(id)))
  ) {
    findings.push(
      finding(
        "premature_ready_state",
        "handoff.state",
        "Owner-ready handoffs require verified authority, consent, uses, source integrity, completed redaction, complete references, and no blocked observations.",
      ),
    );
  }
  if (
    value.review.state === "ready-for-owner-review" &&
    value.handoff.state !== "ready-for-owner-review"
  ) {
    findings.push(
      finding(
        "inconsistent_ready_state",
        "review.state",
        "A media review cannot claim owner-review readiness while its handoff remains blocked.",
      ),
    );
  }
  for (const action of requiredActions) {
    if (
      !value.blockedActions.includes(action) ||
      !value.handoff.prohibitedActions.includes(action)
    ) {
      findings.push(
        finding(
          "missing_authority_gate",
          "blockedActions",
          `Media evidence artifacts must keep ${action} explicitly prohibited.`,
        ),
      );
    }
  }
  return findings;
}

function itineraryPlanFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const constraintIds = value.constraints.map((item) => item.id);
  const placeIds = value.places.map((item) => item.id);
  const dayIds = value.itineraryDays.map((item) => item.id);
  const itineraryItems = value.itineraryDays.flatMap((day) => day.items);
  const itemIds = itineraryItems.map((item) => item.id);
  const alternativeIds = itineraryItems.flatMap((item) =>
    item.alternatives.map((alternative) => alternative.id),
  );
  const budgetIds = value.budget.items.map((item) => item.id);
  const checkIds = value.readinessChecks.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const blockerIds = value.blockers.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const constraintSet = new Set(constraintIds);
  const placeSet = new Set(placeIds);
  const daySet = new Set(dayIds);
  const itemSet = new Set(itemIds);
  const budgetSet = new Set(budgetIds);
  const checkSet = new Set(checkIds);
  const questionSet = new Set(questionIds);
  const blockerSet = new Set(blockerIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const allIds = new Set([
    ...sourceIds,
    ...constraintIds,
    ...placeIds,
    ...dayIds,
    ...itemIds,
    ...alternativeIds,
    ...budgetIds,
    ...checkIds,
    ...questionIds,
    ...blockerIds,
  ]);
  const requiredCheckKinds = [
    "entry-visa",
    "passport-readiness",
    "health",
    "safety-advisory",
    "weather",
    "transit",
    "accessibility",
    "opening-hours",
    "booking-availability-price",
    "packing",
  ];
  const timeSensitiveCheckKinds = new Set([
    "entry-visa",
    "health",
    "safety-advisory",
    "weather",
    "transit",
    "accessibility",
    "opening-hours",
    "booking-availability-price",
  ]);
  const requiredEvidenceKinds = new Map([
    ["entry-visa", new Set(["government-entry"])],
    ["passport-readiness", new Set(["government-entry"])],
    ["health", new Set(["government-health"])],
    ["safety-advisory", new Set(["government-advisory"])],
    ["weather", new Set(["open-meteo"])],
    ["transit", new Set(["official-transit", "official-operator", "gtfs"])],
    ["accessibility", new Set(["official-transit", "official-operator", "official-venue"])],
    ["opening-hours", new Set(["official-venue"])],
    ["booking-availability-price", new Set(["official-operator", "official-venue"])],
    ["packing", new Set(["traveler-note"])],
  ]);
  const requiredActions = [
    "book",
    "reserve",
    "purchase",
    "cancel",
    "modify-booking",
    "check-in",
    "submit-form",
    "contact-provider",
    "mutate-calendar",
    "send-message",
    "submit-sensitive-traveler-data",
    "store-sensitive-traveler-data",
    "submit-payment-data",
    "store-payment-data",
    "submit-verification-data",
    "store-verification-data",
    "accept-terms",
    "guarantee-visa",
    "guarantee-medical",
    "guarantee-legal",
    "guarantee-safety",
  ];
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(constraintIds, "constraints", "Constraint id"),
    ...uniqueFindings(placeIds, "places", "Place id"),
    ...uniqueFindings(dayIds, "itineraryDays", "Itinerary day id"),
    ...uniqueFindings(itemIds, "itineraryDays", "Itinerary item id"),
    ...uniqueFindings(alternativeIds, "itineraryDays", "Alternative id"),
    ...uniqueFindings(budgetIds, "budget.items", "Budget item id"),
    ...uniqueFindings(checkIds, "readinessChecks", "Readiness check id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
    ...uniqueFindings(blockerIds, "blockers", "Blocker id"),
  ];

  if (value.trip.startDate > value.trip.endDate) {
    findings.push(
      finding(
        "invalid_trip_chronology",
        "trip.startDate",
        "Trip start date must not follow its end date.",
      ),
    );
  }

  let timezoneValid = true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value.trip.timezone }).format();
  } catch {
    timezoneValid = false;
    findings.push(
      finding(
        "invalid_timezone",
        "trip.timezone",
        "Trip timezone must be a valid IANA timezone.",
      ),
    );
  }
  function localDate(timestamp) {
    if (!timezoneValid) return null;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: value.trip.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(timestamp));
    const part = (type) => parts.find((item) => item.type === type)?.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  }

  const expectedSourceAuthority = {
    "government-entry": "government",
    "government-advisory": "government",
    "government-health": "government",
    "official-transit": "official-operator",
    "official-operator": "official-operator",
    "official-venue": "official-venue",
    openstreetmap: "openstreetmap",
    "open-meteo": "open-meteo",
    gtfs: "gtfs-publisher",
    "traveler-note": "traveler",
  };
  const governmentKinds = new Set([
    "government-entry",
    "government-advisory",
    "government-health",
  ]);
  const unsafeQueryKeys = /^(?:access[_-]?token|api[_-]?key|auth|code|credential|key|password|secret|token)$/iu;
  for (const [index, source] of value.sources.entries()) {
    if (source.authority !== expectedSourceAuthority[source.kind]) {
      findings.push(
        finding(
          "source_authority_mismatch",
          `sources.${index}.authority`,
          `${source.kind} evidence must use its declared authority.`,
        ),
      );
    }
    if (Date.parse(source.retrievedAt) > Date.parse(value.trip.asOf)) {
      findings.push(
        finding(
          "future_source_evidence",
          `sources.${index}.retrievedAt`,
          "Travel evidence must not postdate the itinerary as-of time.",
        ),
      );
    }
    if (governmentKinds.has(source.kind) && source.effectiveDate === null) {
      findings.push(
        finding(
          "missing_effective_date",
          `sources.${index}.effectiveDate`,
          "Government entry, advisory, and health sources require an effective date.",
        ),
      );
    }
    if (
      source.effectiveDate !== null &&
      source.validThrough !== null &&
      source.effectiveDate > source.validThrough
    ) {
      findings.push(
        finding(
          "invalid_source_validity",
          `sources.${index}.validThrough`,
          "A source validity date cannot precede its effective date.",
        ),
      );
    }
    const asOfDate = new Date(value.trip.asOf).toISOString().slice(0, 10);
    if (source.effectiveDate !== null && source.effectiveDate > asOfDate) {
      findings.push(
        finding(
          "future_effective_source",
          `sources.${index}.effectiveDate`,
          "A source cannot support the current plan before its effective date.",
        ),
      );
    }
    if (
      source.freshness === "current" &&
      source.validThrough !== null &&
      source.validThrough < asOfDate
    ) {
      findings.push(
        finding(
          "expired_current_source",
          `sources.${index}.validThrough`,
          "A source whose validity has expired cannot be marked current.",
        ),
      );
    }
    try {
      const reference = new URL(source.reference);
      const travelerReference =
        source.kind === "traveler-note" &&
        reference.protocol === "traveler:";
      const publicReference =
        source.kind !== "traveler-note" &&
        reference.protocol === "https:";
      const hostname = reference.hostname.toLowerCase().replace(/^\[|\]$/gu, "");
      const unsafeHost =
        /^(?:localhost(?:\.localdomain)?|.+\.localhost|0(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|127(?:\.\d{1,3}){3}|169\.254(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2}|::1|f[cd][0-9a-f:]*|fe[89ab][0-9a-f:]*)$/u.test(
          hostname,
        ) ||
        (() => {
          const match = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/u.exec(hostname);
          return match !== null && Number(match[1]) >= 16 && Number(match[1]) <= 31;
        })();
      const unsafeQuery = [...reference.searchParams.keys()].some((key) =>
        unsafeQueryKeys.test(key),
      );
      if (
        (!travelerReference && !publicReference) ||
        reference.username ||
        reference.password ||
        unsafeHost ||
        unsafeQuery
      ) {
        throw new Error("unsafe");
      }
    } catch {
      findings.push(
        finding(
          "unsafe_source_reference",
          `sources.${index}.reference`,
          "Sources require a credential-free HTTPS URL or a traveler:// reference without sensitive query values.",
        ),
      );
    }
  }

  for (const [index, constraint] of value.constraints.entries()) {
    findings.push(
      ...referenceFindings(
        constraint.sourceRefs,
        sourceSet,
        `constraints.${index}.sourceRefs`,
        "Constraint source reference",
      ),
    );
    if (
      !constraint.sourceRefs.some(
        (reference) => sourceById.get(reference)?.kind === "traveler-note",
      )
    ) {
      findings.push(
        finding(
          "constraint_without_traveler_evidence",
          `constraints.${index}.sourceRefs`,
          "Every traveler constraint requires traveler-supplied evidence.",
        ),
      );
    }
  }

  for (const [index, place] of value.places.entries()) {
    findings.push(
      ...referenceFindings(
        place.sourceRefs,
        sourceSet,
        `places.${index}.sourceRefs`,
        "Place source reference",
      ),
    );
  }

  const expectedDates = [];
  for (
    let cursor = Date.parse(`${value.trip.startDate}T00:00:00Z`);
    cursor <= Date.parse(`${value.trip.endDate}T00:00:00Z`);
    cursor += 86_400_000
  ) {
    expectedDates.push(new Date(cursor).toISOString().slice(0, 10));
  }
  const dayDates = value.itineraryDays.map((day) => day.date);
  if (
    expectedDates.some((date) => !dayDates.includes(date)) ||
    dayDates.some((date) => !expectedDates.includes(date))
  ) {
    findings.push(
      finding(
        "incomplete_trip_dates",
        "itineraryDays",
        "Itinerary days must cover every date in the trip range exactly once.",
      ),
    );
  }
  for (const [dayIndex, day] of value.itineraryDays.entries()) {
    if (day.timezone !== value.trip.timezone) {
      findings.push(
        finding(
          "timezone_mismatch",
          `itineraryDays.${dayIndex}.timezone`,
          "Each itinerary day must use the trip planning timezone.",
        ),
      );
    }
    if (dayIndex > 0 && day.date <= value.itineraryDays[dayIndex - 1].date) {
      findings.push(
        finding(
          "itinerary_day_order",
          `itineraryDays.${dayIndex}.date`,
          "Itinerary days must be unique and chronological.",
        ),
      );
    }
    for (const [itemIndex, item] of day.items.entries()) {
      findings.push(
        ...referenceFindings(
          item.placeRef === null ? [] : [item.placeRef],
          placeSet,
          `itineraryDays.${dayIndex}.items.${itemIndex}.placeRef`,
          "Itinerary place reference",
        ),
        ...referenceFindings(
          item.sourceRefs,
          sourceSet,
          `itineraryDays.${dayIndex}.items.${itemIndex}.sourceRefs`,
          "Itinerary source reference",
        ),
        ...referenceFindings(
          item.constraintRefs,
          constraintSet,
          `itineraryDays.${dayIndex}.items.${itemIndex}.constraintRefs`,
          "Itinerary constraint reference",
        ),
      );
      const start = Date.parse(item.startAt);
      const end = Date.parse(item.endAt);
      if (start >= end) {
        findings.push(
          finding(
            "invalid_item_chronology",
            `itineraryDays.${dayIndex}.items.${itemIndex}.startAt`,
            "An itinerary item must start before it ends.",
          ),
        );
      }
      if (localDate(item.startAt) !== day.date || localDate(item.endAt) !== day.date) {
        findings.push(
          finding(
            "itinerary_local_date_mismatch",
            `itineraryDays.${dayIndex}.items.${itemIndex}.startAt`,
            "Item timestamps must fall on the itinerary day in the declared timezone.",
          ),
        );
      }
      const previous = day.items[itemIndex - 1];
      if (previous) {
        const previousStart = Date.parse(previous.startAt);
        const previousEnd = Date.parse(previous.endAt);
        if (start < previousStart) {
          findings.push(
            finding(
              "itinerary_order",
              `itineraryDays.${dayIndex}.items.${itemIndex}.startAt`,
              "Itinerary items must appear in chronological order.",
            ),
          );
        }
        if (start < previousEnd) {
          findings.push(
            finding(
              "itinerary_overlap",
              `itineraryDays.${dayIndex}.items.${itemIndex}.startAt`,
              "Itinerary items must not overlap.",
            ),
          );
        }
        if (
          item.placeRef !== previous.placeRef &&
          item.transferBufferBeforeMinutes < 15
        ) {
          findings.push(
            finding(
              "insufficient_transfer_buffer",
              `itineraryDays.${dayIndex}.items.${itemIndex}.transferBufferBeforeMinutes`,
              "A change of place requires at least a 15-minute transfer buffer.",
            ),
          );
        }
        if (
          start - previousEnd <
          item.transferBufferBeforeMinutes * 60_000
        ) {
          findings.push(
            finding(
              "unrealized_transfer_buffer",
              `itineraryDays.${dayIndex}.items.${itemIndex}.startAt`,
              "The scheduled gap must realize the declared transfer buffer.",
            ),
          );
        }
      }
      if (item.requiresDisruptionAlternative && item.alternatives.length === 0) {
        findings.push(
          finding(
            "missing_disruption_alternative",
            `itineraryDays.${dayIndex}.items.${itemIndex}.alternatives`,
            "Items marked disruption-sensitive require a sourced alternative.",
          ),
        );
      }
      for (const [alternativeIndex, alternative] of item.alternatives.entries()) {
        findings.push(
          ...referenceFindings(
            alternative.placeRef === null ? [] : [alternative.placeRef],
            placeSet,
            `itineraryDays.${dayIndex}.items.${itemIndex}.alternatives.${alternativeIndex}.placeRef`,
            "Alternative place reference",
          ),
          ...referenceFindings(
            alternative.sourceRefs,
            sourceSet,
            `itineraryDays.${dayIndex}.items.${itemIndex}.alternatives.${alternativeIndex}.sourceRefs`,
            "Alternative source reference",
          ),
        );
      }
    }
  }

  let totalMinimum = 0;
  let totalMaximum = 0;
  for (const [index, item] of value.budget.items.entries()) {
    findings.push(
      ...referenceFindings(
        item.sourceRefs,
        sourceSet,
        `budget.items.${index}.sourceRefs`,
        "Budget source reference",
      ),
    );
    if (item.minimum > item.maximum) {
      findings.push(
        finding(
          "invalid_budget_range",
          `budget.items.${index}.minimum`,
          "Budget item minimum must not exceed its maximum.",
        ),
      );
    }
    if (
      item.currency !== value.trip.budgetCurrency ||
      item.currency !== value.budget.currency
    ) {
      findings.push(
        finding(
          "currency_mismatch",
          `budget.items.${index}.currency`,
          "Every budget item must use the trip budget currency.",
        ),
      );
    }
    if (item.inclusionState !== "excluded") {
      totalMinimum += item.minimum;
      totalMaximum += item.maximum;
    }
  }
  if (value.budget.currency !== value.trip.budgetCurrency) {
    findings.push(
      finding(
        "currency_mismatch",
        "budget.currency",
        "Budget total currency must match the trip budget currency.",
      ),
    );
  }
  if (
    !numbersEqual(totalMinimum, value.budget.totalMinimum) ||
    !numbersEqual(totalMaximum, value.budget.totalMaximum) ||
    value.budget.totalMinimum > value.budget.totalMaximum
  ) {
    findings.push(
      finding(
        "budget_total_mismatch",
        "budget",
        "Budget totals must equal all included and contingency line-item ranges.",
      ),
    );
  }

  for (const kind of requiredCheckKinds) {
    if (
      !value.readinessChecks.some(
        (check) => check.kind === kind && check.mandatory,
      )
    ) {
      findings.push(
        finding(
          "missing_readiness_check",
          "readinessChecks",
          `A mandatory ${kind} readiness check is required.`,
        ),
      );
    }
  }
  for (const [index, check] of value.readinessChecks.entries()) {
    findings.push(
      ...referenceFindings(
        check.sourceRefs,
        sourceSet,
        `readinessChecks.${index}.sourceRefs`,
        "Readiness source reference",
      ),
    );
    const sources = check.sourceRefs
      .map((reference) => sourceById.get(reference))
      .filter(Boolean);
    if (
      !sources.some((source) => requiredEvidenceKinds.get(check.kind)?.has(source.kind))
    ) {
      findings.push(
        finding(
          "inappropriate_readiness_evidence",
          `readinessChecks.${index}.sourceRefs`,
          `${check.kind} readiness requires evidence from an appropriate authoritative source kind.`,
        ),
      );
    }
    if (
      sources.some(
        (source) =>
          Date.parse(check.verifiedAt) < Date.parse(source.retrievedAt),
      )
    ) {
      findings.push(
        finding(
          "verification_before_retrieval",
          `readinessChecks.${index}.verifiedAt`,
          "A readiness check cannot be verified before its evidence was retrieved.",
        ),
      );
    }
    if (Date.parse(check.verifiedAt) > Date.parse(value.trip.asOf)) {
      findings.push(
        finding(
          "future_verification",
          `readinessChecks.${index}.verifiedAt`,
          "A readiness check cannot postdate the itinerary as-of time.",
        ),
      );
    }
    if (
      check.status === "passed" &&
      timeSensitiveCheckKinds.has(check.kind) &&
      sources.some((source) => source.freshness !== "current")
    ) {
      findings.push(
        finding(
          "stale_current_evidence",
          `readinessChecks.${index}.sourceRefs`,
          "A passed time-sensitive readiness check requires current, non-conflicting evidence.",
        ),
      );
    }
    if (
      check.recheckDeadline !== null &&
      Date.parse(check.recheckDeadline) < Date.parse(check.verifiedAt)
    ) {
      findings.push(
        finding(
          "invalid_recheck_deadline",
          `readinessChecks.${index}.recheckDeadline`,
          "A recheck deadline cannot precede verification.",
        ),
      );
    }
    if (
      (check.recheckState === "not-required") !==
      (check.recheckDeadline === null)
    ) {
      findings.push(
        finding(
          "incoherent_recheck_state",
          `readinessChecks.${index}.recheckState`,
          "Only not-required checks omit a recheck deadline.",
        ),
      );
    }
    if (check.recheckDeadline !== null) {
      const deadline = Date.parse(check.recheckDeadline);
      const asOf = Date.parse(value.trip.asOf);
      if (
        deadline <= asOf &&
        !["due", "overdue", "complete"].includes(check.recheckState)
      ) {
        findings.push(
          finding(
            "stale_recheck_state",
            `readinessChecks.${index}.recheckState`,
            "A recheck at or before the plan as-of time must be due, overdue, or complete.",
          ),
        );
      }
      if (
        deadline > asOf &&
        ["due", "overdue"].includes(check.recheckState)
      ) {
        findings.push(
          finding(
            "premature_recheck_state",
            `readinessChecks.${index}.recheckState`,
            "A future recheck deadline cannot already be due or overdue.",
          ),
        );
      }
      if (
        check.recheckState !== "complete" &&
        localDate(check.recheckDeadline) > value.trip.startDate
      ) {
        findings.push(
          finding(
            "late_recheck_deadline",
            `readinessChecks.${index}.recheckDeadline`,
            "An incomplete final-verification recheck must be due no later than trip departure.",
          ),
        );
      }
    }
  }

  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...referenceFindings(
        question.refs,
        allIds,
        `reviewQuestions.${index}.refs`,
        "Review question reference",
      ),
    );
    if (
      (question.status === "resolved" && question.resolution === null) ||
      (question.status === "open" && question.resolution !== null)
    ) {
      findings.push(
        finding(
          "incoherent_question_state",
          `reviewQuestions.${index}.resolution`,
          "Resolved questions require a resolution and open questions must leave it null.",
        ),
      );
    }
  }
  for (const [index, blocker] of value.blockers.entries()) {
    findings.push(
      ...referenceFindings(
        blocker.refs,
        allIds,
        `blockers.${index}.refs`,
        "Blocker reference",
      ),
    );
  }

  findings.push(
    ...referenceFindings(value.handoff.dayRefs, daySet, "handoff.dayRefs", "Handoff day reference"),
    ...referenceFindings(
      value.handoff.itineraryItemRefs,
      itemSet,
      "handoff.itineraryItemRefs",
      "Handoff itinerary item reference",
    ),
    ...referenceFindings(
      value.handoff.budgetItemRefs,
      budgetSet,
      "handoff.budgetItemRefs",
      "Handoff budget item reference",
    ),
    ...referenceFindings(
      value.handoff.checkRefs,
      checkSet,
      "handoff.checkRefs",
      "Handoff readiness check reference",
    ),
    ...referenceFindings(
      value.handoff.reviewQuestionRefs,
      questionSet,
      "handoff.reviewQuestionRefs",
      "Handoff review question reference",
    ),
    ...referenceFindings(
      value.handoff.blockerRefs,
      blockerSet,
      "handoff.blockerRefs",
      "Handoff blocker reference",
    ),
  );

  if (value.handoff.owner !== value.trip.owner) {
    findings.push(
      finding(
        "owner_mismatch",
        "handoff.owner",
        "The trip and handoff must name the same accountable traveler.",
      ),
    );
  }
  if (
    /^(?:the )?(?:agent|assistant|claw)$/iu.test(value.handoff.owner.trim()) ||
    /\b(?:ai|bot|gpt|language model|travel planner)\b/iu.test(value.handoff.owner)
  ) {
    findings.push(
      finding(
        "agent_owned_authority",
        "handoff.owner",
        "Travel planning, verification, and transaction authority must remain with a named human traveler.",
      ),
    );
  }
  if (value.trip.state !== value.handoff.state) {
    findings.push(
      finding(
        "inconsistent_ready_state",
        "handoff.state",
        "Trip and handoff readiness states must match.",
      ),
    );
  }

  const openBlockers = value.blockers.filter((item) => item.status === "open");
  const blockingIssueIds = [
    ...itineraryItems
      .filter((item) => item.status === "blocked")
      .map((item) => item.id),
    ...value.readinessChecks
      .filter(
        (item) =>
          item.mandatory &&
          (item.status === "pending" || item.status === "failed"),
      )
      .map((item) => item.id),
    ...value.reviewQuestions
      .filter((item) => item.status === "open")
      .map((item) => item.id),
  ];
  const coveredBlockingIssues = new Set(
    openBlockers.flatMap((item) => item.refs),
  );
  if (
    value.handoff.state === "blocked" &&
    (openBlockers.length === 0 ||
      openBlockers.some(
        (item) => !value.handoff.blockerRefs.includes(item.id),
      ) ||
      blockingIssueIds.some((id) => !coveredBlockingIssues.has(id)))
  ) {
    findings.push(
      finding(
        "incomplete_blocked_handoff",
        "handoff",
        "Blocked handoffs require every open blocker and every blocking item, mandatory check, or question to be represented.",
      ),
    );
  }

  const incompleteHandoff =
    dayIds.some((id) => !value.handoff.dayRefs.includes(id)) ||
    itemIds.some((id) => !value.handoff.itineraryItemRefs.includes(id)) ||
    budgetIds.some((id) => !value.handoff.budgetItemRefs.includes(id)) ||
    checkIds.some((id) => !value.handoff.checkRefs.includes(id)) ||
    questionIds.some((id) => !value.handoff.reviewQuestionRefs.includes(id)) ||
    blockerIds.some((id) => !value.handoff.blockerRefs.includes(id));
  if (value.handoff.state === "ready" && incompleteHandoff) {
    findings.push(
      finding(
        "incomplete_handoff",
        "handoff",
        "Ready handoffs must reference every itinerary day and item, budget item, check, question, and blocker.",
      ),
    );
  }
  if (
    value.handoff.state === "ready" &&
    (itineraryItems.some((item) => item.status === "blocked") ||
      value.readinessChecks.some(
        (item) =>
          item.mandatory &&
          (item.status === "pending" || item.status === "failed"),
      ) ||
      value.readinessChecks.some(
        (item) =>
          item.recheckState === "due" || item.recheckState === "overdue",
      ) ||
      value.reviewQuestions.some((item) => item.status === "open") ||
      openBlockers.length > 0 ||
      value.budget.totalMaximum > value.trip.budgetLimit)
  ) {
    findings.push(
      finding(
        "premature_ready_state",
        "handoff.state",
        "Ready handoffs require non-blocked itinerary items, complete mandatory checks, resolved questions and blockers, current rechecks, and a budget within the owner limit.",
      ),
    );
  }
  if (
    value.handoff.state === "ready" &&
    value.budget.totalMaximum > value.trip.budgetLimit
  ) {
    findings.push(
      finding(
        "budget_limit_exceeded",
        "budget.totalMaximum",
        "A ready plan's maximum included range must remain within the owner budget.",
      ),
    );
  }
  if (value.handoff.state === "ready") {
    for (const [dayIndex, day] of value.itineraryDays.entries()) {
      for (const [itemIndex, item] of day.items.entries()) {
        if (
          item.sourceRefs.some(
            (reference) => sourceById.get(reference)?.freshness !== "current",
          )
        ) {
          findings.push(
            finding(
              "stale_current_evidence",
              `itineraryDays.${dayIndex}.items.${itemIndex}.sourceRefs`,
              "A ready itinerary item requires current source evidence.",
            ),
          );
        }
      }
    }
    const supportingEvidence = [
      ...value.constraints.map((item, index) => ({
        path: `constraints.${index}.sourceRefs`,
        refs: item.sourceRefs,
      })),
      ...value.places.map((item, index) => ({
        path: `places.${index}.sourceRefs`,
        refs: item.sourceRefs,
      })),
      ...itineraryItems.flatMap((item, itemIndex) =>
        item.alternatives.map((alternative, alternativeIndex) => ({
          path: `itineraryItems.${itemIndex}.alternatives.${alternativeIndex}.sourceRefs`,
          refs: alternative.sourceRefs,
        })),
      ),
      ...value.budget.items
        .filter((item) => item.inclusionState !== "excluded")
        .map((item, index) => ({
          path: `budget.items.${index}.sourceRefs`,
          refs: item.sourceRefs,
        })),
    ];
    for (const evidence of supportingEvidence) {
      if (
        evidence.refs.some(
          (reference) => sourceById.get(reference)?.freshness !== "current",
        )
      ) {
        findings.push(
          finding(
            "stale_current_evidence",
            evidence.path,
            "Ready constraints, places, alternatives, and included budget items require current source evidence.",
          ),
        );
      }
    }
  }

  const sensitiveValuePattern =
    /\b(?:passport\s*(?:number|no\.?|#|id)|(?:payment|credit|debit)?\s*card\s*(?:number|no\.?|#)|loyalty(?:\s+account)?\s*(?:number|no\.?|#|id)?|health\s+record|government\s+(?:identifier|id)|verification\s+code)(?:\s+(?:is|was)\s+|\s*[:=]\s*)[A-Z0-9][A-Z0-9 ._-]{3,}\b|(?:\b\d[ -]*?){13,19}\b/iu;
  function visitText(current, path = "") {
    if (typeof current === "string") {
      if (sensitiveValuePattern.test(current)) {
        findings.push(
          finding(
            "sensitive_value",
            path,
            "Travel artifacts must not store passport, payment-card, loyalty-account, health-record, government-ID, or verification-code values.",
          ),
        );
      }
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((item, index) => visitText(item, `${path}.${index}`));
      return;
    }
    if (current && typeof current === "object") {
      for (const [key, item] of Object.entries(current)) {
        if (key !== "blockedActions" && key !== "prohibitedActions") {
          visitText(item, path ? `${path}.${key}` : key);
        }
      }
    }
  }
  visitText(value);

  for (const action of requiredActions) {
    if (
      !value.blockedActions.includes(action) ||
      !value.handoff.prohibitedActions.includes(action)
    ) {
      findings.push(
        finding(
          "missing_authority_gate",
          "blockedActions",
          `Travel itinerary artifacts must keep ${action} explicitly prohibited.`,
        ),
      );
    }
  }

  const actionVerb =
    String.raw`(?:book(?:s|ed)?(?: (?:the|a|an))?|booking (?:the|a|an)|reserv(?:e|es|ed|ing)|purchas(?:e|es|ed|ing)|buy(?:s|ing)?|bought|cancel(?:s|ed|ing|led|ling)?|modif(?:y|ies|ied|ying) (?:the )?(?:trip|reservation|booking)|check(?:s|ed|ing)? in|submit(?:s|ted|ting)? (?:the )?(?:entry|visa|traveler|passenger|payment|card|verification)? ?(?:form|data|details|information|code)?|contact(?:s|ed|ing)? (?:the )?(?:(?:transit|travel) )?(?:provider|venue|hotel|airline|operator)|(?:add|write|put|update|chang(?:e|es|ed|ing)) (?:the |this )?(?:plan|trip|itinerary|event)? ?(?:to|in|on)? ?(?:the )?(?:traveler'?s )?calendar|(?:send|email)(?:s|ed|ing)? (?:the |this )?(?:hotel|provider|venue|airline|operator|itinerary|travel|calendar)? ?(?:message|email)?|stor(?:e|es|ed|ing) (?:the )?(?:passport|traveler|payment|card|loyalty|health|government|verification)(?:\s+\S+){0,3}|accept(?:s|ed|ing)? (?:the )?(?:provider )?terms|guarantee(?:s|d|ing)? (?:the |this )?(?:traveler )?(?:visa|medical|legal|safety))`;
  const actionOccurrencePattern = new RegExp(String.raw`\b${actionVerb}\b`, "iu");
  const externalActionTexts = [
    ...value.constraints.map((item, index) => ({
      path: `constraints.${index}.description`,
      text: item.description,
    })),
    ...itineraryItems.flatMap((item, index) => [
      { path: `itineraryItems.${index}.title`, text: item.title },
      {
        path: `itineraryItems.${index}.accessibilityNotes`,
        text: item.accessibilityNotes,
      },
      ...item.alternatives.flatMap((alternative, alternativeIndex) => [
        {
          path: `itineraryItems.${index}.alternatives.${alternativeIndex}.title`,
          text: alternative.title,
        },
        {
          path: `itineraryItems.${index}.alternatives.${alternativeIndex}.reason`,
          text: alternative.reason,
        },
      ]),
    ]),
    ...value.budget.items.map((item, index) => ({
      path: `budget.items.${index}.description`,
      text: item.description,
    })),
    ...value.readinessChecks.map((item, index) => ({
      path: `readinessChecks.${index}.notes`,
      text: item.notes,
    })),
    ...value.reviewQuestions.flatMap((item, index) => [
      { path: `reviewQuestions.${index}.question`, text: item.question },
      { path: `reviewQuestions.${index}.reason`, text: item.reason },
      ...(item.resolution === null
        ? []
        : [
            {
              path: `reviewQuestions.${index}.resolution`,
              text: item.resolution,
            },
          ]),
    ]),
    ...value.blockers.map((item, index) => ({
      path: `blockers.${index}.description`,
      text: item.description,
    })),
  ];
  for (const { path, text } of externalActionTexts) {
    const clauses = text
      .replaceAll("’", "'")
      .split(/[.!?]\s*/u)
      .flatMap((sentence) => sentence.split(/\s*[;:]\s*/u));
    if (
      clauses.some((clause) => {
        const trimmed = clause.trim();
        if (!trimmed || !actionOccurrencePattern.test(trimmed)) return false;
        const negated =
          /^(?:(?:the )?\S+\s+){0,5}(?:do not|does not|don't|doesn't|must not|mustn't|should not|shouldn't|can not|cannot|can't|may not|will not|won't|never|no)\b/iu.test(
            trimmed,
          );
        const lower = trimmed.toLowerCase();
        const ownerPrefix = value.handoff.owner.trim().toLowerCase();
        const travelerOwned =
          /^(?:the )?(?:traveler|travelers|owner)\b[^.!?]{0,50}\b(?:will|may|can|must|should|chooses? to|decides? to|owns?)\b/iu.test(
            trimmed,
          ) ||
          (lower.startsWith(ownerPrefix) &&
            /\b(?:will|may|can|must|should|chooses? to|decides? to|owns?)\b/iu.test(
              trimmed.slice(ownerPrefix.length),
            ));
        const guarantee = /\bguarantee(?:s|d|ing)?\b/iu.test(trimmed);
        return !negated && (guarantee || !travelerOwned);
      })
    ) {
      findings.push(
        finding(
          "external_action_content",
          path,
          "Travel itinerary artifacts must not instruct transactions, submissions, provider contact, calendar or message mutation, sensitive-data handling, term acceptance, or visa, medical, legal, or safety guarantees.",
        ),
      );
    }
  }

  return findings;
}

function travelShortlistFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const constraintIds = value.constraints.map((item) => item.id);
  const optionIds = value.options.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const constraintSet = new Set(constraintIds);
  const optionSet = new Set(optionIds);
  const questionSet = new Set(questionIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const constraintById = new Map(value.constraints.map((item) => [item.id, item]));
  const optionById = new Map(value.options.map((item) => [item.id, item]));
  const requiredActions = [
    "book",
    "reserve",
    "purchase",
    "cancel",
    "modify-reservation",
    "check-in",
    "submit-traveler-data",
    "submit-payment-data",
    "accept-terms",
    "contact-provider",
    "send-verification-email",
    "store-verification-code",
  ];
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(constraintIds, "constraints", "Constraint id"),
    ...uniqueFindings(optionIds, "options", "Option id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];

  if (value.trip.departureDate > value.trip.returnDate) {
    findings.push(
      finding(
        "invalid_trip_chronology",
        "trip.departureDate",
        "Trip departure date must not follow the return date.",
      ),
    );
  }

  const expectedSourceAuthority = {
    "expedia-flight-search": "expedia",
    "expedia-lodging-search": "expedia",
    "mapbox-place": "mapbox",
    "mapbox-route": "mapbox",
    "traveler-note": "user-supplied",
  };
  for (const [index, source] of value.sources.entries()) {
    if (source.authority !== expectedSourceAuthority[source.kind]) {
      findings.push(
        finding(
          "source_authority_mismatch",
          `sources.${index}.authority`,
          `${source.kind} evidence must use its declared source authority.`,
        ),
      );
    }
    if (Date.parse(source.capturedAt) > Date.parse(value.trip.asOf)) {
      findings.push(
        finding(
          "future_source_evidence",
          `sources.${index}.capturedAt`,
          "Travel evidence must not postdate the shortlist as-of time.",
        ),
      );
    }
  }

  for (const [index, constraint] of value.constraints.entries()) {
    findings.push(
      ...referenceFindings(
        constraint.sourceRefs,
        sourceSet,
        `constraints.${index}.sourceRefs`,
        "Constraint source reference",
      ),
    );
  }

  const applicableConstraintKinds = {
    flight: new Set(["dates", "budget", "accessibility", "baggage", "nonstop", "loyalty", "party", "other"]),
    lodging: new Set(["dates", "budget", "location", "accessibility", "cancellation", "loyalty", "party", "room", "other"]),
  };
  for (const [index, option] of value.options.entries()) {
    findings.push(
      ...referenceFindings(
        option.sourceRefs,
        sourceSet,
        `options.${index}.sourceRefs`,
        "Option source reference",
      ),
      ...referenceFindings(
        option.constraintRefs,
        constraintSet,
        `options.${index}.constraintRefs`,
        "Option constraint reference",
      ),
    );
    const sources = option.sourceRefs.map((ref) => sourceById.get(ref)).filter(Boolean);
    const expectedKind =
      option.kind === "flight" ? "expedia-flight-search" : "expedia-lodging-search";
    if (
      !sources.some(
        (source) => source.kind === expectedKind && source.authority === "expedia",
      )
    ) {
      findings.push(
        finding(
          "unsupported_option_source",
          `options.${index}.sourceRefs`,
          `${option.kind} options require matching Expedia search evidence.`,
        ),
      );
    }
    if (Date.parse(option.retrievedAt) > Date.parse(value.trip.asOf)) {
      findings.push(
        finding(
          "future_option_evidence",
          `options.${index}.retrievedAt`,
          "Travel options must not postdate the shortlist as-of time.",
        ),
      );
    }
    if (option.price.currency !== value.trip.currency) {
      findings.push(
        finding(
          "currency_mismatch",
          `options.${index}.price.currency`,
          "Option currency must match the trip comparison currency.",
        ),
      );
    }
    if (
      (option.kind === "flight" && option.baggageSummary === null) ||
      (option.kind === "lodging" && option.baggageSummary !== null)
    ) {
      findings.push(
        finding(
          "incoherent_baggage_summary",
          `options.${index}.baggageSummary`,
          "Flights require a baggage summary and lodging options must leave it null.",
        ),
      );
    }
    const missingRequiredConstraints = value.constraints.filter(
      (constraint) =>
        constraint.required &&
        applicableConstraintKinds[option.kind].has(constraint.kind) &&
        !option.constraintRefs.includes(constraint.id),
    );
    if (
      option.state === "recommended" &&
      (option.availabilityState !== "visible" ||
        sources.some((source) => source.freshness !== "current") ||
        missingRequiredConstraints.length > 0 ||
        (option.kind === "lodging" &&
          value.constraints.some(
            (constraint) => constraint.required && constraint.kind === "cancellation",
          ) &&
          option.cancellationState !== "refundable"))
    ) {
      findings.push(
        finding(
          "unsupported_recommendation",
          `options.${index}.state`,
          "Recommended travel options require current matching evidence, visible availability, every applicable required constraint, and refundable lodging when required.",
        ),
      );
    }
    if (
      (option.state === "blocked" && option.blockedReason === null) ||
      (option.state !== "blocked" && option.blockedReason !== null)
    ) {
      findings.push(
        finding(
          "incoherent_blocked_state",
          `options.${index}.blockedReason`,
          "Only blocked travel options may carry a blocked reason.",
        ),
      );
    }
  }

  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...referenceFindings(
        question.optionRefs,
        optionSet,
        `reviewQuestions.${index}.optionRefs`,
        "Review question option reference",
      ),
      ...referenceFindings(
        question.sourceRefs,
        sourceSet,
        `reviewQuestions.${index}.sourceRefs`,
        "Review question source reference",
      ),
    );
  }

  findings.push(
    ...referenceFindings(
      value.handoff.optionRefs,
      optionSet,
      "handoff.optionRefs",
      "Handoff option reference",
    ),
    ...referenceFindings(
      value.handoff.blockingOptionRefs,
      optionSet,
      "handoff.blockingOptionRefs",
      "Blocking option reference",
    ),
    ...referenceFindings(
      value.handoff.reviewQuestionRefs,
      questionSet,
      "handoff.reviewQuestionRefs",
      "Handoff question reference",
    ),
  );
  if (value.handoff.owner !== value.trip.owner) {
    findings.push(
      finding(
        "owner_mismatch",
        "handoff.owner",
        "The trip and handoff must name the same accountable traveler.",
      ),
    );
  }
  if (
    /^(?:the )?(?:agent|assistant|claw)$/iu.test(value.handoff.owner.trim()) ||
    /\b(?:ai|bot|gpt|language model|travel concierge)\b/iu.test(value.handoff.owner)
  ) {
    findings.push(
      finding(
        "agent_owned_authority",
        "handoff.owner",
        "Travel review and transaction authority must remain with a named traveler.",
      ),
    );
  }

  const blockedOptionIds = value.options
    .filter((option) => option.state === "blocked")
    .map((option) => option.id);
  if (
    value.handoff.state === "blocked" &&
    (blockedOptionIds.some(
      (id) => !value.handoff.blockingOptionRefs.includes(id),
    ) ||
      (blockedOptionIds.length === 0 &&
        value.trip.state === "ready-for-traveler-review"))
  ) {
    findings.push(
      finding(
        "incomplete_blocked_handoff",
        "handoff",
        "Blocked handoffs must include every blocked option and retain a visible trip or option blocker.",
      ),
    );
  }
  if (
    value.handoff.blockingOptionRefs.some(
      (ref) => optionById.get(ref)?.state !== "blocked",
    )
  ) {
    findings.push(
      finding(
        "resolved_blocking_option",
        "handoff.blockingOptionRefs",
        "Only blocked options may remain handoff blockers.",
      ),
    );
  }
  if (
    value.handoff.state === "ready-for-traveler-review" &&
    (value.trip.state !== "ready-for-traveler-review" ||
      blockedOptionIds.length > 0 ||
      value.handoff.blockingOptionRefs.length > 0 ||
      optionIds.some((id) => !value.handoff.optionRefs.includes(id)) ||
      questionIds.some((id) => !value.handoff.reviewQuestionRefs.includes(id)) ||
      value.trip.requestedKinds.some(
        (kind) =>
          !value.options.some(
            (option) => option.kind === kind && option.state === "recommended",
          ),
      ))
  ) {
    findings.push(
      finding(
        "premature_ready_state",
        "handoff.state",
        "Traveler-ready handoffs require matching trip readiness, complete option and question references, no blockers, and a supported recommendation for every requested kind.",
      ),
    );
  }
  if (
    value.trip.state === "ready-for-traveler-review" &&
    value.handoff.state !== "ready-for-traveler-review"
  ) {
    findings.push(
      finding(
        "inconsistent_ready_state",
        "trip.state",
        "A trip cannot claim traveler-review readiness while its handoff remains blocked.",
      ),
    );
  }

  for (const action of requiredActions) {
    if (
      !value.blockedActions.includes(action) ||
      !value.handoff.prohibitedActions.includes(action)
    ) {
      findings.push(
        finding(
          "missing_authority_gate",
          "blockedActions",
          `Travel artifacts must keep ${action} explicitly prohibited.`,
        ),
      );
    }
  }
  const actionVerb =
    String.raw`(?:(?:(?:re|pre)[- ]?)?(?:book(?:s|ed|ing)?|reserv(?:e|es|ed|ing)|purchas(?:e|es|ed|ing)|cancel(?:s|ed|ing|led|ling)?)|buy(?:s|ing)?|bought|modif(?:y|ies|ied|ying) (?:the )?(?:trip|reservation|booking)|check(?:s|ed|ing)? in|submit(?:s|ted|ting)? (?:the )?(?:traveler|passenger|payment|card) (?:data|details|information)|accept(?:s|ed|ing)? (?:the )?terms|contact(?:s|ed|ing)? (?:the )?(?:provider|hotel|airline|Expedia)|(?:send(?:s|ing)?|sent) (?:the )?(?:signup|verification|authentication) email|stor(?:e|es|ed|ing) (?:the )?verification code)`;
  const actionOccurrencePattern = new RegExp(String.raw`\b${actionVerb}\b`, "giu");
  const normalizedOwner = value.handoff.owner
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, " ")
    .trim();
  const ownerActorPattern = new RegExp(
    String.raw`(?:the\s+)?(?:traveler|owner|${normalizedOwner.replaceAll(" ", String.raw`\s+`)})\s+(?:must|should|can|may|will|is|was|will be|may be|needs? to|chooses? to|decides? to)(?:\s+personally)?\s*$`,
    "iu",
  );
  const contrastiveActionPattern = new RegExp(
    String.raw`\s+(?:and|but|yet)(?:\s+then)?\s+(?=(?:please\s+)?${actionVerb}\b)`,
    "iu",
  );
  const statements = [
    ...value.sources.map((item, index) => ({
      path: `sources.${index}.scope`,
      text: item.scope,
    })),
    ...value.constraints.map((item, index) => ({
      path: `constraints.${index}.label`,
      text: item.label,
    })),
    ...value.options.flatMap((item, index) => [
      { path: `options.${index}.fitReason`, text: item.fitReason },
      ...item.caveats.map((text, caveatIndex) => ({
        path: `options.${index}.caveats.${caveatIndex}`,
        text,
      })),
      ...(item.blockedReason === null
        ? []
        : [{ path: `options.${index}.blockedReason`, text: item.blockedReason }]),
    ]),
    ...value.reviewQuestions.flatMap((item, index) => [
      { path: `reviewQuestions.${index}.question`, text: item.question },
      { path: `reviewQuestions.${index}.reason`, text: item.reason },
    ]),
  ];
  for (const { path, text } of statements) {
    const clauses = text
      .replaceAll("’", "'")
      .split(/[.!?]\s*/u)
      .flatMap((sentence) =>
        sentence.split(
          /\s*[;:]\s*|\s+(?:and|but|or|yet)\s+(?=(?:(?:you|the(?:\s+\S+){1,4})\s+)?(?:do not|does not|don't|doesn't|must|mustn't|should|shouldn't|can|can not|can't|cannot|couldn't|may|may not|shall|shall not|will|will not|won't|wouldn't|need(?:s)? to|never)\b)/iu,
        ),
      )
      .flatMap((clause) => clause.split(contrastiveActionPattern));
    if (
      clauses.some((clause) => {
        const trimmed = clause.trim();
        if (!trimmed) return false;
        const negated =
          /^(?:\S+\s+){0,5}(?:do not|does not|don't|doesn't|must not|mustn't|should not|shouldn't|can not|cannot|can't|could not|couldn't|may not|shall not|will not|would not|wouldn't|won't|never)\b/iu.test(
            trimmed,
          );
        if (negated) return false;
        return [...trimmed.matchAll(actionOccurrencePattern)].some((match) => {
          const prefix = trimmed.slice(0, match.index);
          const nominalUse =
            /\b(?:before|after|without|for|at|until|prior to)\s+(?:any\s+)?$/iu.test(
              prefix,
            );
          return !nominalUse && !ownerActorPattern.test(prefix);
        });
      })
    ) {
      findings.push(
        finding(
          "external_action_content",
          path,
          "Travel artifacts must not instruct booking, purchase, account, provider-contact, traveler-data, payment-data, or verification-code actions.",
        ),
      );
    }
  }
  return findings;
}

function fundraisingCampaignFindings(value) {
  const sourceIds = value.sources.map((item) => item.id);
  const claimIds = value.claims.map((item) => item.id);
  const audienceIds = value.audiences.map((item) => item.id);
  const assetIds = value.assets.map((item) => item.id);
  const stewardshipIds = value.stewardship.map((item) => item.id);
  const metricIds = value.metrics.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const sourceSet = new Set(sourceIds);
  const claimSet = new Set(claimIds);
  const audienceSet = new Set(audienceIds);
  const assetSet = new Set(assetIds);
  const questionSet = new Set(questionIds);
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const claimById = new Map(value.claims.map((item) => [item.id, item]));
  const audienceById = new Map(value.audiences.map((item) => [item.id, item]));
  const allIds = new Set([
    ...sourceIds,
    ...claimIds,
    ...audienceIds,
    ...assetIds,
    ...stewardshipIds,
    ...metricIds,
    ...questionIds,
  ]);
  const requiredActions = [
    "contact-donors",
    "segment-donors",
    "send-solicitation",
    "publish-assets",
    "process-gifts",
    "issue-receipts",
    "make-tax-claims",
    "accept-terms",
    "alter-donor-records",
  ];
  const findings = [
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(claimIds, "claims", "Claim id"),
    ...uniqueFindings(audienceIds, "audiences", "Audience id"),
    ...uniqueFindings(assetIds, "assets", "Asset id"),
    ...uniqueFindings(stewardshipIds, "stewardship", "Stewardship id"),
    ...uniqueFindings(metricIds, "metrics", "Metric id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
  ];
  if (value.campaign.startDate > value.campaign.endDate) {
    findings.push(
      finding(
        "invalid_campaign_chronology",
        "campaign.startDate",
        "Campaign start date must not follow its end date.",
      ),
    );
  }
  for (const [index, source] of value.sources.entries()) {
    if (source.asOf > value.campaign.asOf) {
      findings.push(
        finding(
          "future_source_evidence",
          `sources.${index}.asOf`,
          "Campaign evidence must not postdate the artifact as-of date.",
        ),
      );
    }
  }
  const requiredKinds = {
    impact: ["program-results", "impact-report"],
    program: ["program-results", "impact-report"],
    "financial-need": ["program-results", "impact-report", "offer-terms"],
    matching: ["matching-terms"],
    urgency: ["offer-terms"],
    endorsement: ["legal-review", "owner-note"],
    "restricted-fund": ["restriction-policy"],
    tax: ["legal-review"],
  };
  for (const [index, claim] of value.claims.entries()) {
    findings.push(
      ...referenceFindings(
        claim.sourceRefs,
        sourceSet,
        `claims.${index}.sourceRefs`,
        "Claim source reference",
      ),
    );
    const sources = claim.sourceRefs
      .map((ref) => sourceById.get(ref))
      .filter(Boolean);
    if (
      claim.state === "supported" &&
      sources.some(
        (source) =>
          source.freshness !== "current" ||
          source.approval !== "approved-for-campaign",
      )
    ) {
      findings.push(
        finding(
          "unsupported_claim_state",
          `claims.${index}`,
          "Supported claims require current, campaign-approved evidence.",
        ),
      );
    }
    if (
      claim.state === "supported" &&
      !sources.some((source) => requiredKinds[claim.kind].includes(source.kind))
    ) {
      findings.push(
        finding(
          "unsupported_claim_kind",
          `claims.${index}.sourceRefs`,
          `Supported ${claim.kind} claims require evidence of the matching source kind.`,
        ),
      );
    }
  }
  for (const [index, audience] of value.audiences.entries()) {
    findings.push(
      ...referenceFindings(
        audience.sourceRefs,
        sourceSet,
        `audiences.${index}.sourceRefs`,
        "Audience source reference",
      ),
    );
    if (
      audience.consentState === "documented" &&
      !audience.sourceRefs.some(
        (ref) =>
          sourceById.get(ref)?.kind === "consent-policy" &&
          sourceById.get(ref)?.freshness === "current" &&
          sourceById.get(ref)?.approval === "approved-for-campaign",
      )
    ) {
      findings.push(
        finding(
          "unsupported_consent_state",
          `audiences.${index}.consentState`,
          "Documented consent requires a current, campaign-approved consent policy.",
        ),
      );
    }
  }
  for (const [index, asset] of value.assets.entries()) {
    findings.push(
      ...referenceFindings(
        asset.audienceRefs,
        audienceSet,
        `assets.${index}.audienceRefs`,
        "Asset audience reference",
      ),
      ...referenceFindings(
        asset.claimRefs,
        claimSet,
        `assets.${index}.claimRefs`,
        "Asset claim reference",
      ),
    );
    const claims = asset.claimRefs
      .map((ref) => claimById.get(ref))
      .filter(Boolean);
    if (
      asset.state === "ready-for-owner-review" &&
      (claims.some(
        (claim) =>
          claim.state !== "supported" ||
          !claim.allowedChannels.includes(asset.channel),
      ) ||
        asset.audienceRefs.some(
          (ref) => audienceById.get(ref)?.consentState !== "documented",
        ) ||
        value.metrics.some((metric) => metric.state !== "defined"))
    ) {
      findings.push(
        finding(
          "unsupported_asset_state",
          `assets.${index}.state`,
          "Owner-ready assets require supported channel-approved claims and documented audience consent.",
        ),
      );
    }
  }
  for (const [index, item] of value.stewardship.entries()) {
    findings.push(
      ...referenceFindings(
        [item.audienceRef],
        audienceSet,
        `stewardship.${index}.audienceRef`,
        "Stewardship audience reference",
      ),
      ...referenceFindings(
        item.sourceRefs,
        sourceSet,
        `stewardship.${index}.sourceRefs`,
        "Stewardship source reference",
      ),
    );
  }
  for (const [index, metric] of value.metrics.entries()) {
    findings.push(
      ...referenceFindings(
        metric.sourceRefs,
        sourceSet,
        `metrics.${index}.sourceRefs`,
        "Metric source reference",
      ),
    );
    if (
      metric.state === "defined" &&
      (metric.sourceRefs.some(
        (ref) =>
          sourceById.get(ref)?.freshness !== "current" ||
          sourceById.get(ref)?.approval !== "approved-for-campaign",
      ) ||
        !metric.sourceRefs.some(
          (ref) => sourceById.get(ref)?.kind === "measurement-plan",
        ))
    ) {
      findings.push(
        finding(
          "unsupported_metric_state",
          `metrics.${index}.state`,
          "Defined metrics require current, campaign-approved source definitions.",
        ),
      );
    }
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    findings.push(
      ...referenceFindings(
        question.refs,
        allIds,
        `reviewQuestions.${index}.refs`,
        "Review question reference",
      ),
    );
  }
  findings.push(
    ...referenceFindings(
      value.handoff.assetRefs,
      assetSet,
      "handoff.assetRefs",
      "Handoff asset reference",
    ),
    ...referenceFindings(
      value.handoff.blockingClaimRefs,
      claimSet,
      "handoff.blockingClaimRefs",
      "Blocking claim reference",
    ),
    ...referenceFindings(
      value.handoff.reviewQuestionRefs,
      questionSet,
      "handoff.reviewQuestionRefs",
      "Handoff question reference",
    ),
  );
  if (
    value.handoff.owner !== value.campaign.owner ||
    value.handoff.ownerType !== value.campaign.ownerType
  ) {
    findings.push(
      finding(
        "owner_mismatch",
        "handoff.owner",
        "The campaign and handoff must name the same accountable owner and owner type.",
      ),
    );
  }
  if (
    /^(?:the )?(?:agent|assistant|claw)$/iu.test(value.handoff.owner.trim()) ||
    /\b(?:ai|bot|gpt|language model|fundraising campaign manager)\b/iu.test(
      value.handoff.owner,
    )
  ) {
    findings.push(
      finding(
        "agent_owned_authority",
        "handoff.owner",
        "Fundraising approval and publication authority must remain with a named human or team.",
      ),
    );
  }
  const unresolvedClaims = value.claims.filter(
    (claim) => claim.state !== "supported",
  );
  const missingBlockingClaims = unresolvedClaims.filter(
    (claim) => !value.handoff.blockingClaimRefs.includes(claim.id),
  );
  const missingReviewQuestions = questionIds.filter(
    (id) => !value.handoff.reviewQuestionRefs.includes(id),
  );
  const hasNonReferenceBlocker =
    value.campaign.state !== "ready-for-owner-review" ||
    value.assets.some((asset) => asset.state !== "ready-for-owner-review") ||
    value.audiences.some(
      (audience) => audience.consentState !== "documented",
    ) ||
    value.metrics.some((metric) => metric.state !== "defined");
  if (
    value.handoff.state === "blocked" &&
    (missingBlockingClaims.length > 0 ||
      missingReviewQuestions.length > 0 ||
      (unresolvedClaims.length === 0 &&
        questionIds.length === 0 &&
        !hasNonReferenceBlocker))
  ) {
    findings.push(
      finding(
        "incomplete_blocked_handoff",
        "handoff",
        "Blocked campaign handoffs must include every unresolved claim and review question and retain at least one blocker.",
      ),
    );
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    (value.campaign.state !== "ready-for-owner-review" ||
      unresolvedClaims.length > 0 ||
      value.assets.some((asset) => asset.state !== "ready-for-owner-review") ||
      value.audiences.some(
        (audience) => audience.consentState !== "documented",
      ) ||
      value.metrics.some((metric) => metric.state !== "defined") ||
      value.reviewQuestions.length > 0 ||
      value.handoff.blockingClaimRefs.length > 0 ||
      value.handoff.reviewQuestionRefs.length > 0)
  ) {
    findings.push(
      finding(
        "premature_ready_state",
        "handoff.state",
        "Owner-ready campaign handoffs require supported claims, review-ready assets, documented consent, defined metrics, and no unresolved questions or blockers.",
      ),
    );
  }
  if (
    value.campaign.state === "ready-for-owner-review" &&
    value.handoff.state !== "ready-for-owner-review"
  ) {
    findings.push(
      finding(
        "inconsistent_ready_state",
        "campaign.state",
        "A campaign cannot claim owner-review readiness while its handoff remains blocked.",
      ),
    );
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    assetIds.some((id) => !value.handoff.assetRefs.includes(id))
  ) {
    findings.push(
      finding(
        "incomplete_handoff",
        "handoff.assetRefs",
        "Owner-ready campaign handoffs must include every draft asset.",
      ),
    );
  }
  if (
    value.handoff.blockingClaimRefs.some(
      (ref) => claimById.get(ref)?.state === "supported",
    )
  ) {
    findings.push(
      finding(
        "resolved_blocking_claim",
        "handoff.blockingClaimRefs",
        "Supported claims cannot remain handoff blockers.",
      ),
    );
  }
  for (const action of requiredActions) {
    if (
      !value.blockedActions.includes(action) ||
      !value.handoff.prohibitedActions.includes(action)
    ) {
      findings.push(
        finding(
          "missing_authority_gate",
          "blockedActions",
          `Fundraising artifacts must keep ${action} explicitly prohibited.`,
        ),
      );
    }
  }
  const actionVerb =
    String.raw`(?:contact (?:the )?donors?|segment (?:the )?donors?|send (?:the )?(?:appeal|solicitation|message|email)|publish (?:the )?(?:asset|campaign|page|post)|process (?:a )?(?:gift|donation|payment)|issue (?:a )?(?:receipt|tax receipt)|make tax claims?|accept (?:the )?(?:terms|offer)|alter donor records?|change donor records?|donate|give)`;
  const directActionPattern = new RegExp(
    String.raw`^(?:(?:please|must|need to|you (?:should|must|need to)|the agent (?:should|must|needs to))\s+)?${actionVerb}\b`,
    "iu",
  );
  const mandatoryActionPattern = new RegExp(
    String.raw`\b(?:must|needs? to|should)\b[^.!?]{0,60}\b${actionVerb}\b`,
    "iu",
  );
  const actionOccurrencePattern = new RegExp(actionVerb, "giu");
  const normalizedOwner = value.handoff.owner
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, " ")
    .trim();
  const ownerActorPattern = new RegExp(
    String.raw`^(?:should|can|may|will) (?:the )?${normalizedOwner.replaceAll(" ", String.raw`\s+`)} ${actionVerb}\b`,
    "iu",
  );
  const statements = [
    {
      path: "campaign.objective",
      text: value.campaign.objective,
      question: false,
    },
    {
      path: "campaign.approvedProgram",
      text: value.campaign.approvedProgram,
      question: false,
    },
    ...value.claims.flatMap((item, index) => [
      {
        path: `claims.${index}.statement`,
        text: item.statement,
        question: false,
      },
      ...item.restrictions.map((text, restrictionIndex) => ({
        path: `claims.${index}.restrictions.${restrictionIndex}`,
        text,
        question: false,
      })),
    ]),
    ...value.audiences.flatMap((item, index) => [
      { path: `audiences.${index}.basis`, text: item.basis, question: false },
      ...item.suppressionRules.map((text, ruleIndex) => ({
        path: `audiences.${index}.suppressionRules.${ruleIndex}`,
        text,
        question: false,
      })),
    ]),
    ...value.assets.flatMap((item, index) => [
      {
        path: `assets.${index}.title`,
        text: item.title,
        question: false,
      },
      ...item.accessibilityChecks.map((text, checkIndex) => ({
        path: `assets.${index}.accessibilityChecks.${checkIndex}`,
        text,
        question: false,
      })),
    ]),
    ...value.stewardship.map((item, index) => ({
      path: `stewardship.${index}.description`,
      text: item.description,
      question: false,
    })),
    ...value.metrics.map((item, index) => ({
      path: `metrics.${index}.definition`,
      text: item.definition,
      question: false,
    })),
    ...value.reviewQuestions.flatMap((item, index) => [
      {
        path: `reviewQuestions.${index}.question`,
        text: item.question,
        question: true,
      },
      {
        path: `reviewQuestions.${index}.reason`,
        text: item.reason,
        question: false,
      },
    ]),
  ];
  for (const { path, text, question } of statements) {
    const clauses = text
      .split(/[.!?]\s*/u)
      .flatMap((sentence) =>
        sentence.split(
          /\s*[;:]\s*|\s*,\s*(?:and|but|or|yet)\s+|\s+(?:and|but|or|yet)\s+(?=(?:(?:you|the(?:\s+\S+){1,4})\s+)?(?:do not|does not|must|should|can|may|will|need(?:s)? to|never)\b)/iu,
        ),
      );
    for (const sentence of clauses) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;
      const negated =
        /^(?:\S+\s+){0,5}(?:do not|does not|must not|should not|need not|needs not|cannot|can't|never)\b/iu.test(
          trimmed,
        );
      if (
        !negated &&
        (/\b(?:tax[- ]deductible|guaranteed match)\b/iu.test(trimmed) ||
          (() => {
            const normalized = trimmed
              .toLowerCase()
              .replaceAll(/[^a-z0-9]+/gu, " ")
              .trim();
            const actionCount = [
              ...normalized.matchAll(actionOccurrencePattern),
            ].length;
            const ownerGated =
              question &&
              actionCount === 1 &&
              ownerActorPattern.test(normalized);
            return (
              !ownerGated &&
              (directActionPattern.test(trimmed) ||
                mandatoryActionPattern.test(trimmed))
            );
          })())
      ) {
        findings.push(
          finding(
            "external_action_content",
            path,
            "Fundraising artifacts must not instruct donor contact or segmentation, solicitation, publication, gift processing, receipts, tax claims, term acceptance, or donor-record changes.",
          ),
        );
        break;
      }
    }
  }
  return findings;
}

function researchEvidenceDeltaFindings(value) {
  const authorityIds = value.watch.protocol.authorities.map((item) => item.id);
  const queryIds = value.watch.protocol.queries.map((item) => item.id);
  const sourceIds = value.sources.map((item) => item.id);
  const evidenceIds = value.evidenceItems.map((item) => item.id);
  const deltaIds = value.deltas.map((item) => item.id);
  const reviewIds = value.reviewQueue.map((item) => item.id);
  const gapIds = value.gapsAndBlockers.map((item) => item.id);
  const authoritySet = new Set(authorityIds);
  const sourceSet = new Set(sourceIds);
  const evidenceSet = new Set(evidenceIds);
  const deltaSet = new Set(deltaIds);
  const reviewSet = new Set(reviewIds);
  const gapSet = new Set(gapIds);
  const authorityById = new Map(value.watch.protocol.authorities.map((item) => [item.id, item]));
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const evidenceById = new Map(value.evidenceItems.map((item) => [item.id, item]));
  const requiredActions = [
    "bypass-access-controls",
    "reproduce-restricted-text",
    "contact-authors",
    "enroll-subjects",
    "publish-conclusions",
    "make-clinical-decision",
    "fabricate-evidence-or-identifiers",
    "disclose-sensitive-research-question",
    "change-decision-autonomously",
  ];
  const findings = [
    ...uniqueFindings(authorityIds, "watch.protocol.authorities", "Authority id"),
    ...uniqueFindings(queryIds, "watch.protocol.queries", "Query id"),
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(
      value.sources.map(
        (item) =>
          `${item.provider}\u0000${idKey(item.persistentId)}\u0000${item.version}`,
      ),
      "sources",
      "Source provider identity and version",
    ),
    ...uniqueFindings(evidenceIds, "evidenceItems", "Evidence item id"),
    ...uniqueFindings(
      value.evidenceItems.map((item) => item.deduplicationKey),
      "evidenceItems",
      "Evidence deduplication key",
    ),
    ...uniqueFindings(deltaIds, "deltas", "Delta id"),
    ...uniqueFindings(reviewIds, "reviewQueue", "Review queue id"),
    ...uniqueFindings(gapIds, "gapsAndBlockers", "Gap or blocker id"),
  ];

  function requireReferences(refs, known, path, label) {
    findings.push(
      ...uniqueFindings(refs, path, label),
      ...referenceFindings(refs, known, path, label),
    );
  }

  function requireCompleteReferences(actual, expected, path, label) {
    requireReferences(actual, new Set(expected), path, label);
    for (const id of expected) {
      if (!actual.includes(id)) {
        findings.push(
          finding(
            "incomplete_handoff",
            path,
            `${label} ${JSON.stringify(id)} is missing from the private handoff.`,
          ),
        );
      }
    }
  }

  function idKey(item) {
    return `${item.kind}\u0000${item.value.toLowerCase()}`;
  }

  function sourceUrlIsBound(source, reference) {
    const { kind, value } = source.persistentId;
    const host = reference.hostname.toLowerCase();
    const pathname = reference.pathname;
    if (source.provider === "crossref") {
      return (
        source.recordType === "bibliographic-record" &&
        kind === "doi" &&
        host === "api.crossref.org" &&
        pathname.startsWith("/works/") &&
        decodeURIComponent(pathname.slice("/works/".length)).toLowerCase() === value.toLowerCase()
      );
    }
    if (source.provider === "pubmed") {
      return (
        source.recordType === "bibliographic-record" &&
        kind === "pmid" &&
        /^\d+$/.test(value) &&
        host === "pubmed.ncbi.nlm.nih.gov" &&
        pathname === `/${value}/`
      );
    }
    if (source.provider === "arxiv") {
      return (
        source.recordType === "preprint-record" &&
        kind === "arxiv" &&
        /^\d{4}\.\d{4,5}(?:v\d+)?$/u.test(value) &&
        host === "arxiv.org" &&
        pathname === `/abs/${value}`
      );
    }
    if (source.provider === "clinicaltrials") {
      return (
        source.recordType === "trial-record" &&
        kind === "nct" &&
        /^NCT\d{8}$/u.test(value) &&
        host === "clinicaltrials.gov" &&
        pathname === `/study/${value}`
      );
    }
    if (source.provider === "orcid") {
      const digits = value.replaceAll("-", "").toUpperCase();
      let total = 0;
      for (const digit of digits.slice(0, -1)) {
        total = (total + Number(digit)) * 2;
      }
      const remainder = (12 - (total % 11)) % 11;
      const expectedCheck = remainder === 10 ? "X" : String(remainder);
      return (
        source.recordType === "author-record" &&
        kind === "orcid" &&
        /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/u.test(value) &&
        digits.at(-1) === expectedCheck &&
        host === "orcid.org" &&
        pathname === `/${value}`
      );
    }
    return (
      source.recordType === "journal-notice" &&
      kind === "journal-notice" &&
      pathname !== "/" &&
      pathname.length > 1
    );
  }

  const windowStart = Date.parse(value.watch.window.start);
  const windowEnd = Date.parse(value.watch.window.end);
  const runStarted = Date.parse(value.watch.run.startedAt);
  const runCompleted = Date.parse(value.watch.run.completedAt);
  const runAsOf = Date.parse(value.watch.run.asOf);
  const baselineAsOf = Date.parse(value.watch.baseline.asOf);
  if (
    windowStart >= windowEnd ||
    baselineAsOf > windowStart ||
    runStarted < windowStart ||
    runStarted > runCompleted ||
    runCompleted > runAsOf ||
    runAsOf > windowEnd ||
    value.watch.baseline.runId === value.watch.run.id
  ) {
    findings.push(
      finding(
        "invalid_watch_chronology",
        "watch",
        "The baseline must precede the review window and the current run must be ordered and contained by that window.",
      ),
    );
  }
  if (
    !isSafePackagePath(value.watch.destination) ||
    !value.watch.destination.startsWith("outputs/")
  ) {
    findings.push(
      finding(
        "unsafe_handoff_destination",
        "watch.destination",
        "The private research handoff destination must remain a portable path under outputs/.",
      ),
    );
  }

  for (const [index, authority] of value.watch.protocol.authorities.entries()) {
    const expectedPurpose = {
      crossref: "scholarly-index",
      pubmed: "scholarly-index",
      arxiv: "scholarly-index",
      clinicaltrials: "trial-registry",
      orcid: "author-registry",
      journal: "journal-correction-or-retraction",
    }[authority.provider];
    if (authority.purpose !== expectedPurpose) {
      findings.push(
        finding(
          "authority_purpose_mismatch",
          `watch.protocol.authorities.${index}.purpose`,
          `${authority.provider} must use its matching public-authority purpose.`,
        ),
      );
    }
  }

  for (const [index, query] of value.watch.protocol.queries.entries()) {
    requireReferences(
      [query.authorityRef],
      authoritySet,
      `watch.protocol.queries.${index}.authorityRef`,
      "Query authority reference",
    );
    requireReferences(
      query.resultSourceRefs,
      sourceSet,
      `watch.protocol.queries.${index}.resultSourceRefs`,
      "Query result source reference",
    );
    const executedAt = Date.parse(query.executedAt);
    if (executedAt < windowStart || executedAt > runAsOf) {
      findings.push(
        finding(
          "query_outside_review_window",
          `watch.protocol.queries.${index}.executedAt`,
          "Reproducible queries must execute inside the declared review window and no later than the run as-of time.",
        ),
      );
    }
    if (
      query.resultSourceRefs.some(
        (ref) => sourceById.get(ref)?.authorityRef !== query.authorityRef,
      )
    ) {
      findings.push(
        finding(
          "query_authority_mismatch",
          `watch.protocol.queries.${index}.resultSourceRefs`,
          "A query may return only records from its declared approved public authority.",
        ),
      );
    }
  }
  const queriedSourceSet = new Set(
    value.watch.protocol.queries.flatMap((query) => query.resultSourceRefs),
  );
  for (const source of value.sources) {
    if (!queriedSourceSet.has(source.id)) {
      findings.push(
        finding(
          "unqueried_source",
          "sources",
          `Source ${JSON.stringify(source.id)} must be returned by a declared reproducible query.`,
        ),
      );
    }
  }

  for (const [index, source] of value.sources.entries()) {
    requireReferences(
      [source.authorityRef],
      authoritySet,
      `sources.${index}.authorityRef`,
      "Source authority reference",
    );
    const authority = authorityById.get(source.authorityRef);
    if (authority?.provider !== source.provider) {
      findings.push(
        finding(
          "source_authority_mismatch",
          `sources.${index}.provider`,
          "Each source provider must match a declared approved public authority.",
        ),
      );
    }
    const publishedAt = Date.parse(source.publishedAt);
    const updatedAt = Date.parse(source.updatedAt);
    const retrievedAt = Date.parse(source.retrievedAt);
    if (publishedAt > updatedAt || updatedAt > retrievedAt || retrievedAt > runAsOf) {
      findings.push(
        finding(
          "invalid_source_chronology",
          `sources.${index}.retrievedAt`,
          "Sources must be published no later than updated or retrieved and retrieved no later than the current run as-of time.",
        ),
      );
    }
    try {
      const reference = new URL(source.canonicalUrl);
      const hostname = reference.hostname.toLowerCase();
      const allowedHost = authority?.domains.some(
        (domain) =>
          hostname === domain.toLowerCase() ||
          hostname.endsWith(`.${domain.toLowerCase()}`),
      );
      if (
        !isCredentialFreePublicHttpsReference(reference) ||
        !allowedHost ||
        !sourceUrlIsBound(source, reference)
      ) {
        throw new Error("unsafe source");
      }
    } catch {
      findings.push(
        finding(
          "unsafe_source_reference",
          `sources.${index}.canonicalUrl`,
          "Sources require an approved, credential-free public HTTPS URL whose canonical path binds to the provider-specific persistent identifier.",
        ),
      );
    }
    for (const [field, targetId] of [
      ["supersedesSourceRef", source.supersedesSourceRef],
      ["correctsSourceRef", source.correctsSourceRef],
      ["retractsSourceRef", source.retractsSourceRef],
    ]) {
      if (targetId !== null) {
        requireReferences(
          [targetId],
          sourceSet,
          `sources.${index}.${field}`,
          "Lifecycle source reference",
        );
        const target = sourceById.get(targetId);
        if (
          targetId === source.id ||
          !target ||
          Date.parse(target.publishedAt) >= publishedAt
        ) {
          findings.push(
            finding(
              "invalid_lifecycle_lineage",
              `sources.${index}.${field}`,
              "Lifecycle links must point to an earlier distinct source; supersession must preserve persistent identity.",
            ),
          );
        }
      }
    }
    if (
      (source.publicationState === "corrected" &&
        (source.correctsSourceRef === null || source.retractsSourceRef !== null)) ||
      (source.publicationState === "retracted" &&
        (source.retractsSourceRef === null || source.correctsSourceRef !== null)) ||
      (!["corrected", "retracted"].includes(source.publicationState) &&
        (source.correctsSourceRef !== null || source.retractsSourceRef !== null))
    ) {
      findings.push(
        finding(
          "incoherent_lifecycle_state",
          `sources.${index}`,
          "Only correction and retraction records may name their corresponding lifecycle target, and each requires its target.",
        ),
      );
    }
    if (
      value.watch.state === "ready" &&
      source.freshness === "current" &&
      retrievedAt < windowStart
    ) {
      findings.push(
        finding(
          "stale_current_source",
          `sources.${index}.retrievedAt`,
          "A current source in a ready research handoff must be retrieved inside the declared review window.",
        ),
      );
    }
  }

  const baselineSourceSet = new Set(value.watch.baseline.sourceRefs);
  const baselineEvidenceSet = new Set(value.watch.baseline.evidenceItemRefs);
  requireReferences(
    value.watch.baseline.sourceRefs,
    sourceSet,
    "watch.baseline.sourceRefs",
    "Baseline source reference",
  );
  requireReferences(
    value.watch.baseline.evidenceItemRefs,
    evidenceSet,
    "watch.baseline.evidenceItemRefs",
    "Baseline evidence item reference",
  );

  const claimIds = [];
  const persistentEvidenceOwners = new Map();
  for (const [index, item] of value.evidenceItems.entries()) {
    requireReferences(
      item.sourceRefs,
      sourceSet,
      `evidenceItems.${index}.sourceRefs`,
      "Evidence source reference",
    );
    const itemPersistentIds = new Set(item.persistentIds.map(idKey));
    findings.push(
      ...uniqueFindings(
        item.persistentIds.map(idKey),
        `evidenceItems.${index}.persistentIds`,
        "Evidence persistent identifier",
      ),
    );
    for (const persistentId of item.persistentIds) {
      const key = idKey(persistentId);
      const owner = persistentEvidenceOwners.get(key);
      if (owner && owner !== item.id) {
        findings.push(
          finding(
            "duplicate_evidence_identity",
            `evidenceItems.${index}.persistentIds`,
            `Persistent identifier ${JSON.stringify(persistentId.value)} belongs to both ${owner} and ${item.id}; deduplicate the work.`,
          ),
        );
      }
      persistentEvidenceOwners.set(key, item.id);
    }
    const itemSources = item.sourceRefs.map((ref) => sourceById.get(ref)).filter(Boolean);
    if (
      itemSources.some(
        (source) =>
          source.screeningState !== "included" ||
          !itemPersistentIds.has(idKey(source.persistentId)),
      )
    ) {
      findings.push(
        finding(
          "invalid_evidence_source",
          `evidenceItems.${index}.sourceRefs`,
          "Evidence items may cite only included sources whose persistent identifiers are retained on the deduplicated item.",
        ),
      );
    }
    if (
      item.persistentIds.some(
        (persistentId) =>
          !itemSources.some((source) => idKey(source.persistentId) === idKey(persistentId)),
      )
    ) {
      findings.push(
        finding(
          "unbound_evidence_identity",
          `evidenceItems.${index}.persistentIds`,
          "Every evidence persistent identifier must be present on one of the item’s included source records.",
        ),
      );
    }
    requireReferences(
      item.lifecycle.map((event) => event.sourceRef),
      sourceSet,
      `evidenceItems.${index}.lifecycle`,
      "Lifecycle source reference",
    );
    let priorObservedAt = Number.NEGATIVE_INFINITY;
    for (const [eventIndex, event] of item.lifecycle.entries()) {
      const observedAt = Date.parse(event.observedAt);
      const source = sourceById.get(event.sourceRef);
      if (
        !item.sourceRefs.includes(event.sourceRef) ||
        observedAt < priorObservedAt ||
        source?.publicationState !== event.state
      ) {
        findings.push(
          finding(
            "invalid_evidence_lifecycle",
            `evidenceItems.${index}.lifecycle.${eventIndex}`,
            "Evidence lifecycle events must be chronological, cite the item’s own source, and match that source’s publication state.",
          ),
        );
      }
      priorObservedAt = observedAt;
    }
    if (item.lifecycle.at(-1)?.state !== item.publicationState) {
      findings.push(
        finding(
          "publication_state_mismatch",
          `evidenceItems.${index}.publicationState`,
          "An evidence item’s publication state must equal its latest lifecycle event.",
        ),
      );
    }
    if (item.quality.rubricRef !== value.watch.protocol.qualityRubric.id) {
      findings.push(
        finding(
          "quality_rubric_mismatch",
          `evidenceItems.${index}.quality.rubricRef`,
          "Every evidence-quality assessment must name the declared protocol rubric.",
        ),
      );
    }
    if (
      (item.publicationState === "retracted" && item.quality.rating !== "insufficient") ||
      (item.publicationState === "preprint" &&
        ["high", "moderate"].includes(item.confidence.rating))
    ) {
      findings.push(
        finding(
          "unsupported_evidence_quality",
          `evidenceItems.${index}.quality`,
          "Retracted evidence is insufficient for current support, and an unreviewed preprint cannot claim moderate or high confidence.",
        ),
      );
    }
    for (const [claimIndex, claim] of item.claimLinks.entries()) {
      claimIds.push(claim.id);
      requireReferences(
        claim.sourceRefs,
        sourceSet,
        `evidenceItems.${index}.claimLinks.${claimIndex}.sourceRefs`,
        "Claim source reference",
      );
      if (claim.sourceRefs.some((ref) => !item.sourceRefs.includes(ref))) {
        findings.push(
          finding(
            "claim_source_mismatch",
            `evidenceItems.${index}.claimLinks.${claimIndex}.sourceRefs`,
            "Claims may cite only source records already retained by their evidence item.",
          ),
        );
      }
    }
  }
  findings.push(...uniqueFindings(claimIds, "evidenceItems.claimLinks", "Claim id"));

  for (const [index, source] of value.sources.entries()) {
    if (
      source.screeningState === "included" &&
      source.supersedesSourceRef !== null &&
      sourceById.get(source.supersedesSourceRef)?.screeningState === "included" &&
      !value.evidenceItems.some(
        (item) =>
          item.sourceRefs.includes(source.id) &&
          item.sourceRefs.includes(source.supersedesSourceRef),
      )
    ) {
      findings.push(
        finding(
          "invalid_lifecycle_lineage",
          `sources.${index}.supersedesSourceRef`,
          "A superseding source must be linked with its prior source by the same evidence item.",
        ),
      );
    }
    for (const [field, label] of [
      ["correctsSourceRef", "correcting"],
      ["retractsSourceRef", "retracting"],
    ]) {
      const priorSourceRef = source[field];
      if (
        source.screeningState === "included" &&
        priorSourceRef !== null &&
        sourceById.get(priorSourceRef)?.screeningState === "included" &&
        !value.evidenceItems.some(
          (item) =>
            item.sourceRefs.includes(source.id) && item.sourceRefs.includes(priorSourceRef),
        )
      ) {
        findings.push(
          finding(
            "invalid_lifecycle_lineage",
            `sources.${index}.${field}`,
            `An included ${label} source must be linked with its prior source by the same evidence item.`,
          ),
        );
      }
    }
  }

  for (const [index, delta] of value.deltas.entries()) {
    requireReferences(
      delta.evidenceItemRefs,
      evidenceSet,
      `deltas.${index}.evidenceItemRefs`,
      "Delta evidence item reference",
    );
    requireReferences(
      delta.baselineEvidenceItemRefs,
      evidenceSet,
      `deltas.${index}.baselineEvidenceItemRefs`,
      "Delta baseline evidence item reference",
    );
    requireReferences(
      delta.contradictsDeltaRefs,
      deltaSet,
      `deltas.${index}.contradictsDeltaRefs`,
      "Contradicted delta reference",
    );
    const needsBaseline = [
      "updated",
      "corrected",
      "retracted",
      "contradictory",
      "unchanged",
    ].includes(delta.classification);
    if (
      (delta.classification === "new" &&
        (delta.baselineEvidenceItemRefs.length > 0 ||
          delta.evidenceItemRefs.some((ref) => baselineEvidenceSet.has(ref)))) ||
      (needsBaseline &&
        (delta.baselineEvidenceItemRefs.length === 0 ||
          delta.baselineEvidenceItemRefs.some((ref) => !baselineEvidenceSet.has(ref)))) ||
      (delta.classification === "contradictory" &&
        (delta.contradictsDeltaRefs.length === 0 ||
          delta.contradictsDeltaRefs.includes(delta.id))) ||
      (delta.classification === "unchanged" &&
        delta.decisionRelevance.state !== "no-change") ||
      (delta.classification !== "unchanged" &&
        delta.decisionRelevance.state === "no-change")
    ) {
      findings.push(
        finding(
          "invalid_delta_classification",
          `deltas.${index}`,
          "Delta classifications must preserve their declared baseline, contradiction relationship, and decision-relevance state.",
        ),
      );
    }
    const evidenceStates = delta.evidenceItemRefs.map(
      (ref) => evidenceById.get(ref)?.publicationState,
    );
    const hasPublicationSupersession = delta.evidenceItemRefs.some((ref) => {
      const item = evidenceById.get(ref);
      if (!item || !["peer-reviewed", "version-of-record"].includes(item.publicationState)) {
        return false;
      }
      const preprintSources = new Set(
        item.lifecycle
          .filter((event) => event.state === "preprint")
          .map((event) => event.sourceRef),
      );
      return item.lifecycle
        .filter((event) => ["peer-reviewed", "version-of-record"].includes(event.state))
        .some((event) => preprintSources.has(sourceById.get(event.sourceRef)?.supersedesSourceRef));
    });
    if (
      (delta.classification === "corrected" && !evidenceStates.includes("corrected")) ||
      (delta.classification === "retracted" && !evidenceStates.includes("retracted")) ||
      (delta.classification === "updated" &&
        !evidenceStates.includes("trial-update") &&
        !hasPublicationSupersession)
    ) {
      findings.push(
        finding(
          "delta_lifecycle_mismatch",
          `deltas.${index}.classification`,
          "Corrected and retracted deltas require matching lifecycle state; updated deltas require a trial update or a preprint-to-reviewed supersession.",
        ),
      );
    }
  }

  const deltaBaselineRefs = value.deltas.flatMap((item) => item.baselineEvidenceItemRefs);
  const deltaEvidenceRefs = new Set(value.deltas.flatMap((item) => item.evidenceItemRefs));
  for (const evidenceItem of value.evidenceItems) {
    if (!deltaEvidenceRefs.has(evidenceItem.id)) {
      findings.push(
        finding(
          "unclassified_evidence",
          "evidenceItems",
          `Evidence item ${JSON.stringify(evidenceItem.id)} must be classified by at least one delta.`,
        ),
      );
    }
  }
  for (const baselineEvidenceRef of baselineEvidenceSet) {
    if (!deltaBaselineRefs.includes(baselineEvidenceRef)) {
      findings.push(
        finding(
          "untracked_baseline_evidence",
          "watch.baseline.evidenceItemRefs",
          `Baseline evidence item ${JSON.stringify(baselineEvidenceRef)} must be named by at least one delta baseline reference.`,
        ),
      );
    }
  }
  for (const baselineSourceRef of baselineSourceSet) {
    if (
      !value.watch.baseline.evidenceItemRefs.some((evidenceRef) =>
        evidenceById.get(evidenceRef)?.sourceRefs.includes(baselineSourceRef),
      )
    ) {
      findings.push(
        finding(
          "unrelated_baseline_source",
          "watch.baseline.sourceRefs",
          `Baseline source ${JSON.stringify(baselineSourceRef)} must back a declared baseline evidence item.`,
        ),
      );
    }
  }

  for (const [index, item] of value.reviewQueue.entries()) {
    requireReferences(
      item.evidenceItemRefs,
      evidenceSet,
      `reviewQueue.${index}.evidenceItemRefs`,
      "Review evidence item reference",
    );
    requireReferences(
      item.deltaRefs,
      deltaSet,
      `reviewQueue.${index}.deltaRefs`,
      "Review delta reference",
    );
    if (
      item.owner !== value.watch.decisionOwner ||
      (item.status === "resolved" && !item.resolution?.trim()) ||
      (item.status === "open" && item.resolution !== null)
    ) {
      findings.push(
        finding(
          "incoherent_review_queue",
          `reviewQueue.${index}`,
          "Review and replication items must remain with the decision owner and keep status and resolution coherent.",
        ),
      );
    }
  }
  if (
    !value.reviewQueue.some((item) => item.kind === "domain-review") ||
    !value.reviewQueue.some((item) => item.kind === "replication")
  ) {
    findings.push(
      finding(
        "missing_review_queue",
        "reviewQueue",
        "Research evidence deltas require both an accountable domain-review and replication queue.",
      ),
    );
  }

  for (const [index, item] of value.gapsAndBlockers.entries()) {
    requireReferences(
      item.sourceRefs,
      sourceSet,
      `gapsAndBlockers.${index}.sourceRefs`,
      "Gap source reference",
    );
    requireReferences(
      item.evidenceItemRefs,
      evidenceSet,
      `gapsAndBlockers.${index}.evidenceItemRefs`,
      "Gap evidence item reference",
    );
    requireReferences(
      item.deltaRefs,
      deltaSet,
      `gapsAndBlockers.${index}.deltaRefs`,
      "Gap delta reference",
    );
    if (item.owner !== value.watch.decisionOwner) {
      findings.push(
        finding(
          "owner_mismatch",
          `gapsAndBlockers.${index}.owner`,
          "Gaps and blockers must remain assigned to the declared decision owner.",
        ),
      );
    }
  }

  requireReferences(
    value.synthesis.consensus.evidenceItemRefs,
    evidenceSet,
    "synthesis.consensus.evidenceItemRefs",
    "Consensus evidence item reference",
  );
  if (
    (value.synthesis.consensus.state === "not-inferred" &&
      value.synthesis.consensus.evidenceItemRefs.length > 0) ||
    (value.synthesis.consensus.state === "reviewed-with-cited-evidence" &&
      value.synthesis.consensus.evidenceItemRefs.length === 0)
  ) {
    findings.push(
      finding(
        "unsupported_consensus_state",
        "synthesis.consensus",
        "Consensus must either remain explicitly not inferred or cite the evidence used for a reviewed assessment.",
      ),
    );
  }

  if (
    value.handoff.owner !== value.watch.decisionOwner ||
    value.handoff.classification !== value.watch.outputClassification ||
    value.handoff.destination !== value.watch.destination ||
    !isSafePackagePath(value.handoff.destination) ||
    !value.handoff.destination.startsWith("outputs/")
  ) {
    findings.push(
      finding(
        "private_handoff_mismatch",
        "handoff",
        "The private handoff must preserve the declared decision owner, classification, and portable outputs/ destination.",
      ),
    );
  }
  if (
    /^(?:the )?(?:agent|assistant|claw)$/iu.test(value.watch.decisionOwner.trim()) ||
    /\b(?:ai|bot|gpt|language model|research scout)\b/iu.test(
      value.watch.decisionOwner,
    )
  ) {
    findings.push(
      finding(
        "agent_owned_authority",
        "watch.decisionOwner",
        "Research review, replication, and decision authority must remain with a named human or team.",
      ),
    );
  }

  requireCompleteReferences(value.handoff.sourceRefs, sourceIds, "handoff.sourceRefs", "Source");
  requireCompleteReferences(
    value.handoff.evidenceItemRefs,
    evidenceIds,
    "handoff.evidenceItemRefs",
    "Evidence item",
  );
  requireCompleteReferences(value.handoff.deltaRefs, deltaIds, "handoff.deltaRefs", "Delta");
  requireCompleteReferences(
    value.handoff.reviewQueueRefs,
    reviewIds,
    "handoff.reviewQueueRefs",
    "Review queue item",
  );
  requireCompleteReferences(
    value.handoff.gapAndBlockerRefs,
    gapIds,
    "handoff.gapAndBlockerRefs",
    "Gap or blocker",
  );
  const openBlockerIds = value.gapsAndBlockers
    .filter((item) => item.kind === "blocker" && item.status === "open")
    .map((item) => item.id);
  requireReferences(
    value.handoff.blockerRefs,
    gapSet,
    "handoff.blockerRefs",
    "Handoff blocker reference",
  );
  if (
    value.handoff.blockerRefs.some((ref) => !openBlockerIds.includes(ref)) ||
    (value.handoff.state === "blocked" &&
      (openBlockerIds.length === 0 ||
        openBlockerIds.some((id) => !value.handoff.blockerRefs.includes(id))))
  ) {
    findings.push(
      finding(
        "incomplete_blocked_handoff",
        "handoff.blockerRefs",
        "Blocked handoffs must name every and only open blocker.",
      ),
    );
  }
  const expectedHandoffState =
    value.watch.state === "ready" ? "ready-for-owner-review" : value.watch.state;
  if (value.handoff.state !== expectedHandoffState) {
    findings.push(
      finding(
        "inconsistent_ready_state",
        "handoff.state",
        "The watch and handoff state must remain consistent.",
      ),
    );
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    (value.sources.some((item) => item.freshness !== "current") ||
      value.evidenceItems.some((item) =>
        item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current"),
      ) ||
      value.deltas.some((item) => item.decisionRelevance.state === "unresolved") ||
      value.reviewQueue.some((item) => item.status !== "resolved") ||
      value.gapsAndBlockers.some((item) => item.status !== "resolved") ||
      openBlockerIds.length > 0 ||
      value.handoff.blockerRefs.length > 0)
  ) {
    findings.push(
      finding(
        "premature_ready_state",
        "handoff.state",
        "Ready handoffs require current retained evidence, resolved classifications, review and replication queues, resolved gaps, and no blockers.",
      ),
    );
  }

  for (const action of requiredActions) {
    if (!value.blockedActions.includes(action)) {
      findings.push(
        finding(
          "missing_authority_gate",
          "blockedActions",
          `Research evidence deltas must keep ${action} explicitly prohibited.`,
        ),
      );
    }
    if (!value.handoff.prohibitedActions.includes(action)) {
      findings.push(
        finding(
          "missing_authority_gate",
          "handoff.prohibitedActions",
          `Research evidence deltas must keep ${action} explicitly prohibited.`,
        ),
      );
    }
  }

  const narrativeTexts = [
    value.watch.question,
    ...value.watch.protocol.inclusionCriteria,
    ...value.watch.protocol.exclusionCriteria,
    ...value.sources.flatMap((item) => [item.title, item.screeningRationale, item.scope]),
    ...value.evidenceItems.flatMap((item) => [
      item.design,
      item.populationOrDataset,
      ...item.outcomes,
      ...item.limitations,
      item.conflicts.notes,
      item.quality.rationale,
      item.confidence.rationale,
      ...item.claimLinks.map((claim) => claim.claim),
    ]),
    ...value.deltas.flatMap((item) => [item.summary, item.decisionRelevance.rationale]),
    ...value.reviewQueue.flatMap((item) => [item.question, item.resolution ?? ""]),
    ...value.gapsAndBlockers.map((item) => item.description),
    value.synthesis.consensus.rationale,
    value.synthesis.summary,
  ];
  const prohibitedNarrative =
    /\b(?:(?:bypass|circumvent)(?:ing)?|rout(?:e|ing) around) (?:publisher )?access controls?|\b(?:reproduc(?:e|ing)|copy(?:ing)?|past(?:e|ing)|quot(?:e|ing)|extract(?:ing)?) (?:restricted|paywalled) (?:full )?text|\b(?:contact(?:ing)?|email(?:ing)?|messag(?:e|ing)|call(?:ing)?) (?:an? )?authors?|\benroll(?:ing)? (?:human )?subjects?|\b(?:publish(?:ing)?|post(?:ing)?|announc(?:e|ing)|communicat(?:e|ing)) (?:the )?conclusions?|\b(?:mak(?:e|ing)|issu(?:e|ing)|provid(?:e|ing)|determin(?:e|ing)) (?:a )?(?:clinical|treatment) (?:decision|recommendation)|\b(?:fabricat(?:e|ed|ing)|invent(?:ed|ing)?) (?:evidence|(?:persistent )?identifiers?)|\b(?:disclos(?:e|ing)|leak(?:ing)?|expos(?:e|ing)|send(?:ing)?) (?:(?:a|the) )?(?:sensitive|private|confidential) (?:research )?question|\b(?:autonomously|automatically) (?:chang(?:e|ing)|updat(?:e|ing)|mak(?:e|ing)) (?:a |the )?(?:decision|protocol)|\b(?:chang(?:e|ing)|updat(?:e|ing)|mak(?:e|ing)) (?:a |the )?(?:decision|protocol) (?:autonomously|without (?:the )?(?:owner|review))\b/giu;
  const unsafeNarrative = hasUnnegatedNarrativeMatch(
    narrativeTexts,
    prohibitedNarrative,
  );
  if (unsafeNarrative) {
    findings.push(
      finding(
        "unsafe_narrative_content",
        "evidenceItems",
        "Research artifacts must not bypass access controls, reproduce restricted text, contact authors, enroll subjects, publish conclusions, make clinical decisions, fabricate evidence or identifiers, disclose sensitive research questions, or change decisions autonomously.",
      ),
    );
  }
  return findings;
}

function topicWatchDeltaLedgerFindings(value) {
  const findings = [];
  const requiredActions = [
    "bypass-access-controls",
    "reproduce-restricted-content",
    "publish-or-contact-externally",
    "subscribe-or-change-accounts",
    "disclose-credentials-or-sensitive-queries",
    "fabricate-sources-or-claims",
    "change-decisions-or-actions-autonomously",
  ];
  const authorities = value.watch.authorities;
  const authorityIds = authorities.map((item) => item.id);
  const sourceIds = value.sources.map((item) => item.id);
  const observationIds = value.observations.map((item) => item.id);
  const deltaIds = value.deltas.map((item) => item.id);
  const reviewIds = value.reviewQueue.map((item) => item.id);
  const gapIds = value.gapsAndBlockers.map((item) => item.id);
  const authoritySet = new Set(authorityIds);
  const sourceSet = new Set(sourceIds);
  const observationSet = new Set(observationIds);
  const deltaSet = new Set(deltaIds);
  const reviewSet = new Set(reviewIds);
  const gapSet = new Set(gapIds);
  const authorityById = new Map(authorities.map((item) => [item.id, item]));
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const observationById = new Map(value.observations.map((item) => [item.id, item]));
  const deltaById = new Map(value.deltas.map((item) => [item.id, item]));

  findings.push(
    ...uniqueFindings(authorityIds, "watch.authorities", "Authority id"),
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(observationIds, "observations", "Observation id"),
    ...uniqueFindings(deltaIds, "deltas", "Delta id"),
    ...uniqueFindings(reviewIds, "reviewQueue", "Review queue id"),
    ...uniqueFindings(gapIds, "gapsAndBlockers", "Gap or blocker id"),
  );

  function requireReferences(refs, known, path, label) {
    findings.push(...referenceFindings(refs, known, path, label));
  }

  function requireCompleteReferences(actual, expected, path, label) {
    requireReferences(actual, new Set(expected), path, label);
    for (const id of expected) {
      if (!actual.includes(id)) {
        findings.push(
          finding(
            "incomplete_handoff",
            path,
            `${label} ${JSON.stringify(id)} is missing from the private handoff.`,
          ),
        );
      }
    }
  }

  const windowStart = Date.parse(value.watch.window.start);
  const windowEnd = Date.parse(value.watch.window.end);
  const baselineAsOf = Date.parse(value.watch.baseline.asOf);
  const runStarted = Date.parse(value.watch.run.startedAt);
  const runCompleted = Date.parse(value.watch.run.completedAt);
  const runAsOf = Date.parse(value.watch.run.asOf);
  if (
    windowStart >= windowEnd ||
    baselineAsOf >= windowStart ||
    runStarted < windowStart ||
    runStarted > runCompleted ||
    runCompleted > runAsOf ||
    runAsOf > windowEnd ||
    value.watch.baseline.runId === value.watch.run.id
  ) {
    findings.push(
      finding(
        "invalid_watch_chronology",
        "watch",
        "The baseline must precede the review window and the current run must be ordered and contained by that window.",
      ),
    );
  }
  if (
    !isSafePackagePath(value.watch.destination) ||
    !value.watch.destination.startsWith("outputs/")
  ) {
    findings.push(
      finding(
        "unsafe_handoff_destination",
        "watch.destination",
        "The private topic-watch handoff destination must remain a portable path under outputs/.",
      ),
    );
  }

  const purposesByProvider = {
    official: new Set(["implementation-guidance", "official-notice"]),
    "public-record": new Set(["legal-text", "regulatory-notice"]),
    "standards-body": new Set(["standards-update"]),
    "primary-operator": new Set(["operational-status", "technical-release"]),
  };
  for (const [index, authority] of authorities.entries()) {
    if (!purposesByProvider[authority.provider]?.has(authority.purpose)) {
      findings.push(
        finding(
          "authority_purpose_mismatch",
          `watch.authorities.${index}.purpose`,
          "Each approved authority purpose must match its declared provider.",
        ),
      );
    }
  }

  for (const [index, query] of value.watch.queries.entries()) {
    requireReferences(
      [query.authorityRef],
      authoritySet,
      `watch.queries.${index}.authorityRef`,
      "Query authority reference",
    );
    requireReferences(
      query.resultSourceRefs,
      sourceSet,
      `watch.queries.${index}.resultSourceRefs`,
      "Query result source reference",
    );
    const executedAt = Date.parse(query.executedAt);
    if (executedAt < windowStart || executedAt > runAsOf) {
      findings.push(
        finding(
          "query_outside_review_window",
          `watch.queries.${index}.executedAt`,
          "Reproducible queries must execute inside the declared review window and no later than the run as-of time.",
        ),
      );
    }
    if (
      query.resultSourceRefs.some(
        (ref) => sourceById.get(ref)?.authorityRef !== query.authorityRef,
      )
    ) {
      findings.push(
        finding(
          "query_authority_mismatch",
          `watch.queries.${index}.resultSourceRefs`,
          "A query may return only records from its declared approved authority.",
        ),
      );
    }
  }
  const queriedSourceSet = new Set(
    value.watch.queries.flatMap((query) => query.resultSourceRefs),
  );
  for (const source of value.sources) {
    if (!queriedSourceSet.has(source.id)) {
      findings.push(
        finding(
          "unqueried_source",
          "sources",
          `Source ${JSON.stringify(source.id)} must be returned by a declared reproducible query.`,
        ),
      );
    }
  }

  const recordTypesByProvider = {
    official: new Set([
      "implementation-guidance",
      "faq",
      "official-notice",
      "correction-notice",
      "withdrawal-notice",
    ]),
    "public-record": new Set(["legal-text", "regulatory-notice"]),
    "standards-body": new Set(["standard", "standards-update", "correction-notice"]),
    "primary-operator": new Set(["operator-release", "status-notice"]),
  };
  const sourceIdentityOwners = new Map();
  for (const [index, source] of value.sources.entries()) {
    requireReferences(
      [source.authorityRef],
      authoritySet,
      `sources.${index}.authorityRef`,
      "Source authority reference",
    );
    const authority = authorityById.get(source.authorityRef);
    if (
      authority?.provider !== source.provider ||
      !recordTypesByProvider[source.provider]?.has(source.recordType)
    ) {
      findings.push(
        finding(
          "source_authority_mismatch",
          `sources.${index}`,
          "Each source must use a record type and provider that match a declared approved authority.",
        ),
      );
    }
    const identityKey = `${source.authorityRef}\u0000${source.canonicalKey.toLowerCase()}`;
    const priorIdentityOwner = sourceIdentityOwners.get(identityKey);
    if (priorIdentityOwner && priorIdentityOwner !== source.id) {
      findings.push(
        finding(
          "duplicate_reference",
          `sources.${index}.canonicalKey`,
          `Canonical source identity ${JSON.stringify(source.canonicalKey)} belongs to both ${priorIdentityOwner} and ${source.id}.`,
        ),
      );
    }
    sourceIdentityOwners.set(identityKey, source.id);

    const publishedAt = Date.parse(source.publishedAt);
    const updatedAt = Date.parse(source.updatedAt);
    const retrievedAt = Date.parse(source.retrievedAt);
    if (publishedAt > updatedAt || updatedAt > retrievedAt || retrievedAt > runAsOf) {
      findings.push(
        finding(
          "invalid_source_chronology",
          `sources.${index}.retrievedAt`,
          "Sources must be published no later than updated or retrieved and retrieved no later than the run as-of time.",
        ),
      );
    }
    try {
      const reference = new URL(source.canonicalUrl);
      const host = reference.hostname.toLowerCase();
      const allowedHost = authority?.domains.some(
        (domain) => host === domain.toLowerCase() || host.endsWith(`.${domain.toLowerCase()}`),
      );
      if (
        !isCredentialFreePublicHttpsReference(reference) ||
        !allowedHost ||
        reference.pathname === "/"
      ) {
        throw new Error("unsafe source");
      }
    } catch {
      findings.push(
        finding(
          "unsafe_source_reference",
          `sources.${index}.canonicalUrl`,
          "Sources require an approved, credential-free public HTTPS URL without fragments, private hosts, or sensitive query values.",
        ),
      );
    }

    const lineage = [
      ["supersedesSourceRef", source.supersedesSourceRef],
      ["correctsSourceRef", source.correctsSourceRef],
      ["withdrawsSourceRef", source.withdrawsSourceRef],
    ];
    for (const [field, targetId] of lineage) {
      if (targetId === null) continue;
      requireReferences(
        [targetId],
        sourceSet,
        `sources.${index}.${field}`,
        "Source lineage reference",
      );
      const target = sourceById.get(targetId);
      if (
        targetId === source.id ||
        !target ||
        Date.parse(target.publishedAt) >= publishedAt ||
        target.authorityRef !== source.authorityRef ||
        target.canonicalKey === source.canonicalKey
      ) {
        findings.push(
          finding(
            "invalid_source_lineage",
            `sources.${index}.${field}`,
            "Source lineage must point to an earlier distinct source from the same approved authority.",
          ),
        );
      }
    }
    const isCorrection = source.recordType === "correction-notice";
    const isWithdrawal = source.recordType === "withdrawal-notice";
    if (
      (isCorrection &&
        (source.correctsSourceRef === null ||
          source.supersedesSourceRef !== null ||
          source.withdrawsSourceRef !== null)) ||
      (isWithdrawal &&
        (source.withdrawsSourceRef === null ||
          source.supersedesSourceRef !== null ||
          source.correctsSourceRef !== null)) ||
      (!isCorrection &&
        !isWithdrawal &&
        (source.correctsSourceRef !== null || source.withdrawsSourceRef !== null))
    ) {
      findings.push(
        finding(
          "incoherent_source_lifecycle",
          `sources.${index}`,
          "Only correction and withdrawal notices may name those lifecycle targets, and each notice requires its target.",
        ),
      );
    }
    if (
      value.watch.state === "ready" &&
      (source.freshness !== "current" ||
        retrievedAt < windowStart ||
        runAsOf - retrievedAt > value.watch.freshnessPolicy.maxAgeHours * 3_600_000)
    ) {
      findings.push(
        finding(
          "stale_current_source",
          `sources.${index}`,
          "Ready handoffs require every retained source to be current and retrieved inside the freshness policy window.",
        ),
      );
    }
  }

  const baselineSourceSet = new Set(value.watch.baseline.sourceRefs);
  const baselineObservationSet = new Set(value.watch.baseline.observationRefs);
  requireReferences(
    value.watch.baseline.sourceRefs,
    sourceSet,
    "watch.baseline.sourceRefs",
    "Baseline source reference",
  );
  requireReferences(
    value.watch.baseline.observationRefs,
    observationSet,
    "watch.baseline.observationRefs",
    "Baseline observation reference",
  );

  const claimIds = [];
  const observationIdentityOwners = new Map();
  const observedSourceSet = new Set();
  const thresholdById = new Map(
    value.watch.priorityPolicy.thresholds.map((item) => [item.id, item]),
  );
  findings.push(
    ...uniqueFindings(
      value.watch.priorityPolicy.thresholds.map((item) => item.id),
      "watch.priorityPolicy.thresholds",
      "Priority threshold id",
    ),
  );
  if (value.watch.priorityPolicy.owner !== value.watch.decisionOwner) {
    findings.push(
      finding(
        "invalid_priority_policy",
        "watch.priorityPolicy.owner",
        "Priority thresholds must remain owned by the declared decision owner.",
      ),
    );
  }

  for (const [index, observation] of value.observations.entries()) {
    requireReferences(
      observation.sourceRefs,
      sourceSet,
      `observations.${index}.sourceRefs`,
      "Observation source reference",
    );
    observation.sourceRefs.forEach((ref) => observedSourceSet.add(ref));
    const priorIdentityOwner = observationIdentityOwners.get(observation.deduplicationKey);
    if (priorIdentityOwner && priorIdentityOwner !== observation.id) {
      findings.push(
        finding(
          "duplicate_observation_identity",
          `observations.${index}.deduplicationKey`,
          `Observation identity ${JSON.stringify(observation.deduplicationKey)} belongs to both ${priorIdentityOwner} and ${observation.id}.`,
        ),
      );
    }
    observationIdentityOwners.set(observation.deduplicationKey, observation.id);

    const observationSources = observation.sourceRefs
      .map((ref) => sourceById.get(ref))
      .filter(Boolean);
    const hasCorrection = observationSources.some(
      (source) =>
        source.recordType === "correction-notice" &&
        source.correctsSourceRef !== null &&
        observation.sourceRefs.includes(source.correctsSourceRef),
    );
    const hasWithdrawal = observationSources.some(
      (source) =>
        source.recordType === "withdrawal-notice" &&
        source.withdrawsSourceRef !== null &&
        observation.sourceRefs.includes(source.withdrawsSourceRef),
    );
    if (
      (observation.status === "current" && (hasCorrection || hasWithdrawal)) ||
      (observation.status === "corrected" && !hasCorrection) ||
      (observation.status === "withdrawn" && !hasWithdrawal)
    ) {
      findings.push(
        finding(
          "incoherent_observation_status",
          `observations.${index}.status`,
          "Observation status must visibly reflect linked correction or withdrawal lineage.",
        ),
      );
    }
    for (const [claimIndex, claim] of observation.claims.entries()) {
      claimIds.push(claim.id);
      requireReferences(
        claim.sourceRefs,
        sourceSet,
        `observations.${index}.claims.${claimIndex}.sourceRefs`,
        "Claim source reference",
      );
      if (
        claim.sourceRefs.some((ref) => !observation.sourceRefs.includes(ref)) ||
        (observation.status === "withdrawn" && claim.status !== "withdrawn") ||
        (observation.status !== "withdrawn" && claim.status === "withdrawn")
      ) {
        findings.push(
          finding(
            "claim_source_mismatch",
            `observations.${index}.claims.${claimIndex}`,
            "Claims must cite their observation sources and visibly preserve withdrawn support status.",
          ),
        );
      }
    }
    if (
      observation.priority.policyRef !== value.watch.priorityPolicy.id ||
      !thresholdById.has(observation.priority.thresholdRef) ||
      thresholdById.get(observation.priority.thresholdRef)?.level !== observation.priority.level
    ) {
      findings.push(
        finding(
          "invalid_priority_policy",
          `observations.${index}.priority`,
          "Observation priority must cite the declared policy and a matching owner-review threshold.",
        ),
      );
    }
  }
  findings.push(...uniqueFindings(claimIds, "observations.claims", "Claim id"));
  for (const source of value.sources) {
    if (!observedSourceSet.has(source.id)) {
      findings.push(
        finding(
          "unobserved_source",
          "sources",
          `Source ${JSON.stringify(source.id)} must support a retained typed observation.`,
        ),
      );
    }
  }

  for (const [index, delta] of value.deltas.entries()) {
    requireReferences(
      delta.observationRefs,
      observationSet,
      `deltas.${index}.observationRefs`,
      "Delta observation reference",
    );
    requireReferences(
      delta.baselineObservationRefs,
      observationSet,
      `deltas.${index}.baselineObservationRefs`,
      "Baseline observation reference",
    );
    requireReferences(
      delta.contradictsDeltaRefs,
      deltaSet,
      `deltas.${index}.contradictsDeltaRefs`,
      "Contradicted delta reference",
    );
    requireReferences(
      delta.supersedesDeltaRefs,
      deltaSet,
      `deltas.${index}.supersedesDeltaRefs`,
      "Superseded delta reference",
    );
    const requiresBaseline = [
      "changed",
      "corrected",
      "withdrawn",
      "contradictory",
      "unchanged",
    ].includes(delta.classification);
    if (
      (delta.classification === "new" &&
        (delta.baselineObservationRefs.length > 0 ||
          delta.observationRefs.some((ref) => baselineObservationSet.has(ref)))) ||
      (requiresBaseline &&
        (delta.baselineObservationRefs.length === 0 ||
          delta.baselineObservationRefs.some((ref) => !baselineObservationSet.has(ref)))) ||
      (delta.classification === "contradictory" &&
        (delta.observationRefs.length < 2 ||
          delta.contradictsDeltaRefs.length === 0 ||
          delta.contradictsDeltaRefs.includes(delta.id))) ||
      delta.supersedesDeltaRefs.includes(delta.id) ||
      (delta.classification === "unchanged" &&
        delta.decisionRelevance.state !== "no-change") ||
      (delta.classification !== "unchanged" &&
        delta.decisionRelevance.state === "no-change")
    ) {
      findings.push(
        finding(
          "invalid_delta_classification",
          `deltas.${index}`,
          "Delta classifications must preserve baseline, contradiction, supersession, and decision-relevance state.",
        ),
      );
    }
    const observations = delta.observationRefs
      .map((ref) => observationById.get(ref))
      .filter(Boolean);
    if (
      (delta.classification === "changed" &&
        !observations.some((item) =>
          item.sourceRefs.some((ref) => sourceById.get(ref)?.supersedesSourceRef !== null),
        )) ||
      (delta.classification === "corrected" &&
        !observations.some((item) => item.status === "corrected")) ||
      (delta.classification === "withdrawn" &&
        !observations.some((item) => item.status === "withdrawn"))
    ) {
      findings.push(
        finding(
          "delta_lifecycle_mismatch",
          `deltas.${index}.classification`,
          "Changed, corrected, and withdrawn deltas require matching source and observation lifecycle evidence.",
        ),
      );
    }
  }

  const deltaObservationRefs = new Set(value.deltas.flatMap((item) => item.observationRefs));
  const baselineDeltaRefs = value.deltas.flatMap((item) => item.baselineObservationRefs);
  for (const observation of value.observations) {
    if (!deltaObservationRefs.has(observation.id)) {
      findings.push(
        finding(
          "unclassified_observation",
          "observations",
          `Observation ${JSON.stringify(observation.id)} must be classified by at least one delta.`,
        ),
      );
    }
  }
  for (const baselineObservation of baselineObservationSet) {
    if (!baselineDeltaRefs.includes(baselineObservation)) {
      findings.push(
        finding(
          "untracked_baseline_observation",
          "watch.baseline.observationRefs",
          `Baseline observation ${JSON.stringify(baselineObservation)} must be named by a delta baseline reference.`,
        ),
      );
    }
  }
  for (const baselineSource of baselineSourceSet) {
    if (
      !value.watch.baseline.observationRefs.some((ref) =>
        observationById.get(ref)?.sourceRefs.includes(baselineSource),
      )
    ) {
      findings.push(
        finding(
          "unrelated_baseline_source",
          "watch.baseline.sourceRefs",
          `Baseline source ${JSON.stringify(baselineSource)} must support a declared baseline observation.`,
        ),
      );
    }
  }

  for (const [index, review] of value.reviewQueue.entries()) {
    requireReferences(
      review.observationRefs,
      observationSet,
      `reviewQueue.${index}.observationRefs`,
      "Review observation reference",
    );
    requireReferences(
      review.deltaRefs,
      deltaSet,
      `reviewQueue.${index}.deltaRefs`,
      "Review delta reference",
    );
    if (
      review.owner !== value.watch.decisionOwner ||
      (review.status === "resolved" && !review.resolution?.trim()) ||
      (review.status === "open" && review.resolution !== null)
    ) {
      findings.push(
        finding(
          "incoherent_review_queue",
          `reviewQueue.${index}`,
          "Owner review items must retain the declared owner and coherent status and resolution.",
        ),
      );
    }
  }
  const highObservationIds = value.observations
    .filter((item) => item.priority.level === "high")
    .map((item) => item.id);
  if (
    highObservationIds.some(
      (id) =>
        !value.reviewQueue.some(
          (item) => item.priority === "high" && item.observationRefs.includes(id),
        ),
    )
  ) {
    findings.push(
      finding(
        "missing_priority_review",
        "reviewQueue",
        "Every high-priority observation must be visible in an owner review queue item.",
      ),
    );
  }
  const requiredReviewDeltaIds = value.deltas
    .filter((item) => item.decisionRelevance.state === "decision-relevant")
    .map((item) => item.id);
  if (
    requiredReviewDeltaIds.some(
      (id) => !value.reviewQueue.some((item) => item.deltaRefs.includes(id)),
    )
  ) {
    findings.push(
      finding(
        "missing_required_review",
        "reviewQueue",
        "Every decision-relevant delta must be routed to an accountable owner review.",
      ),
    );
  }

  for (const [index, item] of value.gapsAndBlockers.entries()) {
    requireReferences(
      item.sourceRefs,
      sourceSet,
      `gapsAndBlockers.${index}.sourceRefs`,
      "Gap source reference",
    );
    requireReferences(
      item.observationRefs,
      observationSet,
      `gapsAndBlockers.${index}.observationRefs`,
      "Gap observation reference",
    );
    requireReferences(
      item.deltaRefs,
      deltaSet,
      `gapsAndBlockers.${index}.deltaRefs`,
      "Gap delta reference",
    );
    if (item.owner !== value.watch.decisionOwner) {
      findings.push(
        finding(
          "owner_mismatch",
          `gapsAndBlockers.${index}.owner`,
          "Gaps and blockers must remain assigned to the declared decision owner.",
        ),
      );
    }
  }

  if (
    value.handoff.owner !== value.watch.decisionOwner ||
    value.handoff.classification !== value.watch.outputClassification ||
    value.handoff.destination !== value.watch.destination ||
    !isSafePackagePath(value.handoff.destination) ||
    !value.handoff.destination.startsWith("outputs/")
  ) {
    findings.push(
      finding(
        "private_handoff_mismatch",
        "handoff",
        "The private handoff must preserve the declared owner, classification, and portable outputs/ destination.",
      ),
    );
  }
  if (
    /^(?:the )?(?:agent|assistant|claw)$/iu.test(value.watch.decisionOwner.trim()) ||
    /\b(?:ai|bot|gpt|language model|research monitor)\b/iu.test(
      value.watch.decisionOwner,
    )
  ) {
    findings.push(
      finding(
        "agent_owned_authority",
        "watch.decisionOwner",
        "Topic-watch review and decision authority must remain with a named human or team.",
      ),
    );
  }

  requireCompleteReferences(value.handoff.sourceRefs, sourceIds, "handoff.sourceRefs", "Source");
  requireCompleteReferences(
    value.handoff.observationRefs,
    observationIds,
    "handoff.observationRefs",
    "Observation",
  );
  requireCompleteReferences(value.handoff.deltaRefs, deltaIds, "handoff.deltaRefs", "Delta");
  requireCompleteReferences(
    value.handoff.reviewQueueRefs,
    reviewIds,
    "handoff.reviewQueueRefs",
    "Review queue item",
  );
  requireCompleteReferences(
    value.handoff.gapAndBlockerRefs,
    gapIds,
    "handoff.gapAndBlockerRefs",
    "Gap or blocker",
  );
  const openBlockerIds = value.gapsAndBlockers
    .filter((item) => item.kind === "blocker" && item.status === "open")
    .map((item) => item.id);
  requireReferences(
    value.handoff.blockerRefs,
    gapSet,
    "handoff.blockerRefs",
    "Handoff blocker reference",
  );
  if (
    value.handoff.blockerRefs.some((ref) => !openBlockerIds.includes(ref)) ||
    (value.handoff.state === "blocked" &&
      (openBlockerIds.length === 0 ||
        openBlockerIds.some((id) => !value.handoff.blockerRefs.includes(id))))
  ) {
    findings.push(
      finding(
        "incomplete_blocked_handoff",
        "handoff.blockerRefs",
        "Blocked handoffs must name every and only open blocker.",
      ),
    );
  }
  const expectedHandoffState =
    value.watch.state === "ready" ? "ready-for-owner-review" : value.watch.state;
  if (value.handoff.state !== expectedHandoffState) {
    findings.push(
      finding(
        "inconsistent_ready_state",
        "handoff.state",
        "The watch and handoff state must remain consistent.",
      ),
    );
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    (value.sources.some((item) => item.freshness !== "current") ||
      value.observations.some((item) =>
        item.sourceRefs.some((ref) => sourceById.get(ref)?.freshness !== "current"),
      ) ||
      value.observations.some((item) => item.decisionRelevance.state === "unresolved") ||
      value.deltas.some((item) => item.decisionRelevance.state === "unresolved") ||
      value.reviewQueue.some((item) => item.status !== "resolved") ||
      value.gapsAndBlockers.some((item) => item.status !== "resolved") ||
      openBlockerIds.length > 0 ||
      value.handoff.blockerRefs.length > 0)
  ) {
    findings.push(
      finding(
        "premature_ready_state",
        "handoff.state",
        "Ready handoffs require current retained evidence, complete classifications, resolved owner reviews and gaps, and no blockers.",
      ),
    );
  }

  for (const action of requiredActions) {
    if (!value.blockedActions.includes(action)) {
      findings.push(
        finding(
          "missing_authority_gate",
          "blockedActions",
          `Topic watch delta ledgers must keep ${action} explicitly prohibited.`,
        ),
      );
    }
    if (!value.handoff.prohibitedActions.includes(action)) {
      findings.push(
        finding(
          "missing_authority_gate",
          "handoff.prohibitedActions",
          `Topic watch delta ledgers must keep ${action} explicitly prohibited.`,
        ),
      );
    }
  }

  const narrativeTexts = [
    value.watch.topic,
    ...value.watch.questions,
    ...value.sources.flatMap((item) => [item.title, item.scope]),
    ...value.observations.flatMap((item) => [
      item.summary,
      item.uncertainty,
      item.topicRelevance.rationale,
      item.decisionRelevance.rationale,
      item.priority.rationale,
      ...item.claims.flatMap((claim) => [claim.statement, claim.uncertainty]),
    ]),
    ...value.deltas.flatMap((item) => [item.summary, item.decisionRelevance.rationale]),
    ...value.reviewQueue.flatMap((item) => [item.question, item.resolution ?? ""]),
    ...value.gapsAndBlockers.map((item) => item.description),
    value.synthesis.consensus.rationale,
    value.synthesis.causalInference.rationale,
    value.synthesis.summary,
  ];
  const prohibitedNarrative =
    /\b(?:(?:bypass|circumvent)(?:ing)?|rout(?:e|ing) around) (?:publisher )?access controls?|\b(?:reproduc(?:e|ing)|copy(?:ing)?|past(?:e|ing)|quot(?:e|ing)|extract(?:ing)?) (?:restricted|paywalled) (?:content|text)|\b(?:publish(?:ed|ing)?|post(?:ed|ing)?|announc(?:e|ed|ing)|communicat(?:e|ed|ing)|contact(?:ed|ing)?|email(?:ed|ing)?|messag(?:e|ed|ing)) (?:an? )?(?:external|public|source|authority|audience|party)|\b(?:subscribe|subscribed|subscribing|create|created|creating|change|changed|changing|updat(?:e|ed|ing)) (?:an? )?(?:account|subscription)|\b(?:disclos(?:e|ed|ing)|leak(?:ed|ing)?|expos(?:e|ed|ing)|send(?:ing|sent)?) (?:(?:a|the) )?(?:credential|secret|token|sensitive (?:query|topic|question))|\b(?:fabricat(?:e|ed|ing)|invent(?:ed|ing)?) (?:a |the )?(?:source|claim|evidence)|\b(?:autonomously|automatically) (?:chang(?:e|ed|ing)|updat(?:e|ed|ing)|mak(?:e|ing)) (?:a |the )?(?:decision|action)|\b(?:chang(?:e|ed|ing)|updat(?:e|ed|ing)|mak(?:e|ing)) (?:a |the )?(?:decision|action) (?:autonomously|without (?:the )?(?:owner|review))|\b(?:infer|inferred|assert|asserted|declare|declared) (?:a )?consensus|\b(?:prove|proved|proving|establish|establishes|established|establishing|assert|asserts|asserted|asserting|infer|infers|inferred|inferring) (?:a )?(?:causal|cause-and-effect) (?:effect|relationship)|\b(?:causes?|causing|caused by|will cause)\b/giu;
  if (hasUnnegatedNarrativeMatch(narrativeTexts, prohibitedNarrative)) {
    findings.push(
      finding(
        "unsafe_narrative_content",
        "observations",
        "Topic-watch artifacts must not bypass controls, reproduce restricted content, contact or publish externally, change accounts, disclose credentials or sensitive queries, fabricate records, infer consensus or causality, or change decisions autonomously.",
      ),
    );
  }
  return findings;
}

function feedIntelligenceDeltaLedgerFindings(value) {
  const requiredActions = [
    "subscribe-or-unsubscribe",
    "publish-or-contact-externally",
    "change-accounts",
    "send-notifications-or-messages",
    "disclose-credentials",
    "reproduce-restricted-content",
    "fabricate-signals-or-sources",
    "infer-consensus-or-causality",
    "take-autonomous-actions-or-decisions",
  ];
  const subscriptions = value.subscriptions;
  const subscriptionIds = subscriptions.map((item) => item.id);
  const itemIds = value.items.map((item) => item.id);
  const signalIds = value.signals.map((item) => item.id);
  const deltaIds = value.deltas.map((item) => item.id);
  const reviewIds = value.reviewQueue.map((item) => item.id);
  const deliveryIds = value.deliveryQueue.map((item) => item.id);
  const gapIds = value.gapsAndBlockers.map((item) => item.id);
  const subscriptionSet = new Set(subscriptionIds);
  const itemSet = new Set(itemIds);
  const signalSet = new Set(signalIds);
  const deltaSet = new Set(deltaIds);
  const reviewSet = new Set(reviewIds);
  const gapSet = new Set(gapIds);
  const subscriptionById = new Map(subscriptions.map((item) => [item.id, item]));
  const itemById = new Map(value.items.map((item) => [item.id, item]));
  const findings = [
    ...uniqueFindings(subscriptionIds, "subscriptions", "Subscription id"),
    ...uniqueFindings(itemIds, "items", "Item id"),
    ...uniqueFindings(signalIds, "signals", "Signal id"),
    ...uniqueFindings(deltaIds, "deltas", "Delta id"),
    ...uniqueFindings(reviewIds, "reviewQueue", "Review queue id"),
    ...uniqueFindings(deliveryIds, "deliveryQueue", "Delivery queue id"),
    ...uniqueFindings(gapIds, "gapsAndBlockers", "Gap or blocker id"),
    ...uniqueFindings(
      value.deliveryQueue.map((item) => item.idempotencyKey),
      "deliveryQueue",
      "Delivery idempotency key",
    ),
  ];

  function requireReferences(refs, known, path, label) {
    findings.push(
      ...uniqueFindings(refs, path, label),
      ...referenceFindings(refs, known, path, label),
    );
  }

  function requireCompleteReferences(actual, expected, path, label) {
    requireReferences(actual, new Set(expected), path, label);
    for (const id of expected) {
      if (!actual.includes(id)) {
        findings.push(
          finding(
            "incomplete_handoff",
            path,
            `${label} ${JSON.stringify(id)} is missing from the private handoff.`,
          ),
        );
      }
    }
  }

  function isPublicUrlForSubscription(url, subscription) {
    try {
      const reference = new URL(url);
      const host = reference.hostname.toLowerCase();
      const allowedHost = subscription?.approvedDomains.some(
        (domain) =>
          host === domain.toLowerCase() || host.endsWith(`.${domain.toLowerCase()}`),
      );
      return (
        isCredentialFreePublicHttpsReference(reference) &&
        allowedHost &&
        reference.pathname !== "/"
      );
    } catch {
      return false;
    }
  }

  function itemLineageRefs(item) {
    return [
      item.supersedesItemRef,
      item.correctsItemRef,
      item.withdrawsItemRef,
      item.duplicateOfItemRef,
    ].filter(Boolean);
  }

  function itemHasDirectLineage(left, right) {
    return (
      itemLineageRefs(left).includes(right.id) ||
      itemLineageRefs(right).includes(left.id)
    );
  }

  const windowStart = Date.parse(value.monitor.window.start);
  const windowEnd = Date.parse(value.monitor.window.end);
  const baselineAsOf = Date.parse(value.monitor.baseline.asOf);
  const runStarted = Date.parse(value.monitor.run.startedAt);
  const runCompleted = Date.parse(value.monitor.run.completedAt);
  const runAsOf = Date.parse(value.monitor.run.asOf);
  if (
    windowStart >= windowEnd ||
    baselineAsOf >= windowStart ||
    runStarted < windowStart ||
    runStarted > runCompleted ||
    runCompleted > runAsOf ||
    runAsOf > windowEnd ||
    value.monitor.baseline.runId === value.monitor.run.id
  ) {
    findings.push(
      finding(
        "invalid_monitor_chronology",
        "monitor",
        "The checkpoint must precede the review window and the current run must be ordered inside that window.",
      ),
    );
  }
  if (
    !isSafePackagePath(value.monitor.destination) ||
    !value.monitor.destination.startsWith("outputs/")
  ) {
    findings.push(
      finding(
        "unsafe_handoff_destination",
        "monitor.destination",
        "The private feed-intelligence handoff destination must remain a portable path under outputs/.",
      ),
    );
  }
  if (
    (value.items.length === 0 && value.monitor.run.outcome !== "zero-items") ||
    (value.monitor.run.outcome === "zero-items" &&
      (value.items.length > 0 ||
        value.signals.length > 0 ||
        value.deltas.length > 0 ||
        value.reviewQueue.length > 0 ||
        value.deliveryQueue.length > 0))
  ) {
    findings.push(
      finding(
        "invalid_zero_item_run",
        "monitor.run.outcome",
        "Zero-item runs must explicitly say zero-items and cannot retain item, signal, delta, review, or delivery work.",
      ),
    );
  }

  const feedKeys = new Set();
  for (const [index, subscription] of subscriptions.entries()) {
    const feedKey = subscription.canonicalFeedKey.toLowerCase();
    if (feedKeys.has(feedKey)) {
      findings.push(
        finding(
          "duplicate_reference",
          `subscriptions.${index}.canonicalFeedKey`,
          `Canonical feed identity ${JSON.stringify(subscription.canonicalFeedKey)} is duplicated.`,
        ),
      );
    }
    feedKeys.add(feedKey);
    if (
      subscription.owner !== value.monitor.owner ||
      !subscription.ownerApproved ||
      subscription.sourceClassification !== "public"
    ) {
      findings.push(
        finding(
          "subscription_owner_gate",
          `subscriptions.${index}`,
          "Every subscription must be owner-approved, public, and controlled by the named monitor owner.",
        ),
      );
    }
    if (!isPublicUrlForSubscription(subscription.canonicalFeedUrl, subscription)) {
      findings.push(
        finding(
          "unsafe_subscription_reference",
          `subscriptions.${index}.canonicalFeedUrl`,
          "Feed subscriptions require an owner-approved, credential-free public HTTPS URL on an approved domain.",
        ),
      );
    }
    const cursorAdvanced = Date.parse(subscription.cursor.advancedAt);
    const attemptedAt = Date.parse(subscription.retrieval.lastAttemptedAt);
    const successfulAt =
      subscription.retrieval.lastSuccessfulAt === null
        ? null
        : Date.parse(subscription.retrieval.lastSuccessfulAt);
    if (
      subscription.cursor.checkpoint !== value.monitor.baseline.checkpointId ||
      cursorAdvanced > runAsOf ||
      (subscription.retrieval.state === "complete" && cursorAdvanced < runStarted) ||
      (subscription.retrieval.state !== "complete" &&
        successfulAt !== null &&
        cursorAdvanced > successfulAt)
    ) {
      findings.push(
        finding(
          "invalid_cursor_chronology",
          `subscriptions.${index}.cursor`,
          "Completed retrieval cursors must advance during the current run; partial or failed retrievals may retain only the latest successful cursor.",
        ),
      );
    }
    const staleByPolicy =
      successfulAt === null ||
      runAsOf - successfulAt > value.monitor.freshnessPolicy.maxAgeHours * 3_600_000;
    if (
      attemptedAt < runStarted ||
      attemptedAt > runAsOf ||
      (successfulAt !== null && successfulAt > runAsOf) ||
      (subscription.retrieval.state === "complete" &&
        (successfulAt === null ||
          successfulAt < attemptedAt ||
          subscription.retrieval.freshness !== "current" ||
          subscription.retrieval.recheckState === "requested")) ||
      (subscription.retrieval.state === "partial" &&
        (subscription.retrieval.freshness !== "recheck-needed" ||
          subscription.retrieval.recheckState !== "requested")) ||
      (subscription.retrieval.state === "failed" &&
        (subscription.retrieval.freshness === "current" ||
          subscription.retrieval.recheckState !== "requested" ||
          (successfulAt !== null && successfulAt > attemptedAt))) ||
      (subscription.retrieval.state === "not-run" &&
        (successfulAt !== null ||
          subscription.retrieval.freshness === "current" ||
          subscription.retrieval.recheckState !== "requested"))
    ) {
      findings.push(
        finding(
          "invalid_retrieval_state",
          `subscriptions.${index}.retrieval`,
          "Feed retrieval state must distinguish a current complete retrieval from a partial or failed current attempt that retains an earlier successful retrieval for recheck.",
        ),
      );
    }
    if (
      value.monitor.state === "ready" &&
      (subscription.retrieval.state !== "complete" ||
        subscription.retrieval.freshness !== "current" ||
        subscription.retrieval.recheckState === "requested" ||
        staleByPolicy)
    ) {
      findings.push(
        finding(
          "stale_subscription",
          `subscriptions.${index}.retrieval`,
          "Ready handoffs require each subscription to complete with current, timely retrieval state and no pending recheck.",
        ),
      );
    }
  }

  requireReferences(
    value.monitor.baseline.subscriptionRefs,
    subscriptionSet,
    "monitor.baseline.subscriptionRefs",
    "Checkpoint subscription reference",
  );
  for (const subscriptionId of subscriptionIds) {
    if (!value.monitor.baseline.subscriptionRefs.includes(subscriptionId)) {
      findings.push(
        finding(
          "incomplete_subscription_coverage",
          "monitor.baseline.subscriptionRefs",
          `Subscription ${JSON.stringify(subscriptionId)} is absent from the declared checkpoint.`,
        ),
      );
    }
  }

  const itemIdentityOwners = new Map();
  const observedBySubscription = new Map();
  for (const [index, item] of value.items.entries()) {
    requireReferences(
      [item.subscriptionRef],
      subscriptionSet,
      `items.${index}.subscriptionRef`,
      "Item subscription reference",
    );
    const subscription = subscriptionById.get(item.subscriptionRef);
    observedBySubscription.set(
      item.subscriptionRef,
      (observedBySubscription.get(item.subscriptionRef) ?? 0) + 1,
    );
    if (
      item.sourceClassification !== "public" ||
      !isPublicUrlForSubscription(item.canonicalUrl, subscription)
    ) {
      findings.push(
        finding(
          "unsafe_item_reference",
          `items.${index}.canonicalUrl`,
          "Feed items require a credential-free public HTTPS canonical URL on the subscription's approved domain.",
        ),
      );
    }
    const publishedAt = Date.parse(item.publishedAt);
    const updatedAt = Date.parse(item.updatedAt);
    const retrievedAt = Date.parse(item.retrievedAt);
    const subscriptionSuccess =
      subscription?.retrieval.lastSuccessfulAt === null
        ? null
        : Date.parse(subscription?.retrieval.lastSuccessfulAt);
    if (
      publishedAt > updatedAt ||
      updatedAt > retrievedAt ||
      retrievedAt > runAsOf ||
      (subscriptionSuccess !== null && retrievedAt > subscriptionSuccess)
    ) {
      findings.push(
        finding(
          "invalid_item_chronology",
          `items.${index}`,
          "Feed item publication, update, retrieval, and subscription retrieval times must be chronologically coherent.",
        ),
      );
    }
    for (const [kind, identity] of [
      ["guid", item.guid],
      ["canonical URL", item.canonicalUrl.toLowerCase()],
      ["content digest", item.contentDigest],
    ]) {
      if (identity === null) continue;
      const key = `${kind}\u0000${identity}`;
      const existingId = itemIdentityOwners.get(key);
      if (existingId && existingId !== item.id) {
        const existing = itemById.get(existingId);
        if (!existing || !itemHasDirectLineage(item, existing)) {
          findings.push(
            finding(
              "duplicate_item_identity",
              `items.${index}`,
              `Feed item ${kind} ${JSON.stringify(identity)} duplicates ${JSON.stringify(existingId)} without declared lineage.`,
            ),
          );
        }
      }
      itemIdentityOwners.set(key, item.id);
    }
    for (const [field, targetId] of [
      ["supersedesItemRef", item.supersedesItemRef],
      ["correctsItemRef", item.correctsItemRef],
      ["withdrawsItemRef", item.withdrawsItemRef],
      ["duplicateOfItemRef", item.duplicateOfItemRef],
    ]) {
      if (targetId === null) continue;
      requireReferences(
        [targetId],
        itemSet,
        `items.${index}.${field}`,
        "Item lineage reference",
      );
      const target = itemById.get(targetId);
      if (
        targetId === item.id ||
        !target ||
        (field !== "duplicateOfItemRef" &&
          Date.parse(target.publishedAt) >= publishedAt) ||
        (field !== "duplicateOfItemRef" && target.subscriptionRef !== item.subscriptionRef)
      ) {
        findings.push(
          finding(
            "invalid_item_lineage",
            `items.${index}.${field}`,
            "Item lineage must point to an earlier distinct item from the same feed unless a declared duplicate is cross-feed.",
          ),
        );
      }
    }
    const hasSuccessor = value.items.some((candidate) =>
      itemLineageRefs(candidate).includes(item.id),
    );
    const lifecycleFields = itemLineageRefs(item);
    if (
      (item.status === "current" &&
        (item.correctsItemRef !== null ||
          item.withdrawsItemRef !== null ||
          item.duplicateOfItemRef !== null)) ||
      (item.status === "corrected" &&
        (item.correctsItemRef === null || lifecycleFields.length !== 1)) ||
      (item.status === "withdrawn" &&
        (item.withdrawsItemRef === null || lifecycleFields.length !== 1)) ||
      (item.status === "duplicate" &&
        (item.duplicateOfItemRef === null || lifecycleFields.length !== 1)) ||
      (item.status === "superseded" &&
        (lifecycleFields.length !== 0 || !hasSuccessor))
    ) {
      findings.push(
        finding(
          "incoherent_item_lifecycle",
          `items.${index}`,
          "Corrected, withdrawn, duplicate, and superseded item states must preserve their matching lineage without silent replacement.",
        ),
      );
    }
  }

  requireReferences(
    value.monitor.baseline.itemRefs,
    itemSet,
    "monitor.baseline.itemRefs",
    "Checkpoint item reference",
  );
  const baselineItemSet = new Set(value.monitor.baseline.itemRefs);
  const thresholdById = new Map(
    value.monitor.triagePolicy.thresholds.map((item) => [item.id, item]),
  );
  findings.push(
    ...uniqueFindings(
      value.monitor.triagePolicy.thresholds.map((item) => item.id),
      "monitor.triagePolicy.thresholds",
      "Triage threshold id",
    ),
  );
  if (value.monitor.triagePolicy.owner !== value.monitor.owner) {
    findings.push(
      finding(
        "invalid_triage_policy",
        "monitor.triagePolicy.owner",
        "Triage thresholds must remain owned by the named monitor owner.",
      ),
    );
  }

  const signaledItemSet = new Set();
  for (const [index, signal] of value.signals.entries()) {
    requireReferences(
      [signal.itemRef],
      itemSet,
      `signals.${index}.itemRef`,
      "Signal item reference",
    );
    const item = itemById.get(signal.itemRef);
    if (
      !item ||
      signal.sourceUrl !== item.canonicalUrl ||
      !isPublicUrlForSubscription(
        signal.sourceUrl,
        subscriptionById.get(item.subscriptionRef),
      )
    ) {
      findings.push(
        finding(
          "signal_provenance_mismatch",
          `signals.${index}`,
          "Every signal must link directly to its retained item's approved canonical public URL.",
        ),
      );
    }
    signaledItemSet.add(signal.itemRef);
    const expectedStatus = {
      current: "current",
      corrected: "qualified",
      withdrawn: "withdrawn",
      superseded: "qualified",
      duplicate: "duplicate",
    }[item?.status];
    if (signal.status !== expectedStatus) {
      findings.push(
        finding(
          "incoherent_signal_state",
          `signals.${index}.status`,
          "Signal status must visibly preserve the retained feed item's lifecycle state.",
        ),
      );
    }
    if (
      signal.confidence === "insufficient" &&
      signal.relevance.state !== "unresolved"
    ) {
      findings.push(
        finding(
          "insufficient_confidence_requires_review",
          `signals.${index}`,
          "Insufficient-confidence signals must remain unresolved for accountable owner review.",
        ),
      );
    }
    if (
      signal.priority.policyRef !== value.monitor.triagePolicy.id ||
      !thresholdById.has(signal.priority.thresholdRef) ||
      thresholdById.get(signal.priority.thresholdRef)?.level !== signal.priority.level
    ) {
      findings.push(
        finding(
          "invalid_triage_policy",
          `signals.${index}.priority`,
          "Signal priority must cite the declared owner policy and a matching threshold.",
        ),
      );
    }
  }
  for (const item of value.items) {
    if (!signaledItemSet.has(item.id)) {
      findings.push(
        finding(
          "untriaged_item",
          "items",
          `Retained item ${JSON.stringify(item.id)} must have a typed provenance-linked signal.`,
        ),
      );
    }
  }

  for (const [index, delta] of value.deltas.entries()) {
    requireReferences(delta.itemRefs, itemSet, `deltas.${index}.itemRefs`, "Delta item reference");
    requireReferences(
      delta.baselineItemRefs,
      itemSet,
      `deltas.${index}.baselineItemRefs`,
      "Baseline item reference",
    );
    requireReferences(
      delta.contradictsDeltaRefs,
      deltaSet,
      `deltas.${index}.contradictsDeltaRefs`,
      "Contradicted delta reference",
    );
    requireReferences(
      delta.supersedesDeltaRefs,
      deltaSet,
      `deltas.${index}.supersedesDeltaRefs`,
      "Superseded delta reference",
    );
    const currentItems = delta.itemRefs.map((id) => itemById.get(id)).filter(Boolean);
    const baselineItems = delta.baselineItemRefs
      .map((id) => itemById.get(id))
      .filter(Boolean);
    const requiresBaseline = [
      "changed",
      "corrected",
      "withdrawn",
      "contradictory",
      "unchanged",
    ].includes(delta.disposition);
    if (
      ((delta.disposition === "new" || delta.disposition === "duplicate") &&
        (delta.baselineItemRefs.length > 0 ||
          delta.itemRefs.some((id) => baselineItemSet.has(id)))) ||
      (requiresBaseline &&
        (delta.baselineItemRefs.length === 0 ||
          delta.baselineItemRefs.some((id) => !baselineItemSet.has(id)))) ||
      (delta.disposition === "contradictory" &&
        (delta.itemRefs.length < 2 ||
          delta.contradictsDeltaRefs.length === 0 ||
          delta.contradictsDeltaRefs.includes(delta.id))) ||
      delta.supersedesDeltaRefs.includes(delta.id) ||
      (["unchanged", "duplicate"].includes(delta.disposition) &&
        delta.relevance.state !== "no-change") ||
      (!["unchanged", "duplicate"].includes(delta.disposition) &&
        delta.relevance.state === "no-change")
    ) {
      findings.push(
        finding(
          "invalid_delta_disposition",
          `deltas.${index}`,
          "Item dispositions must preserve checkpoint, contradiction, supersession, and owner-routing state.",
        ),
      );
    }
    const lifecycleMatches =
      (delta.disposition === "changed" &&
        currentItems.some((item) =>
          baselineItems.some((baseline) => item.supersedesItemRef === baseline.id),
        )) ||
      (delta.disposition === "corrected" &&
        currentItems.some(
          (item) =>
            item.status === "corrected" &&
            baselineItems.some((baseline) => item.correctsItemRef === baseline.id),
        )) ||
      (delta.disposition === "withdrawn" &&
        currentItems.some(
          (item) =>
            item.status === "withdrawn" &&
            baselineItems.some((baseline) => item.withdrawsItemRef === baseline.id),
        )) ||
      (delta.disposition === "duplicate" &&
        currentItems.every((item) => item.status === "duplicate")) ||
      !["changed", "corrected", "withdrawn", "duplicate"].includes(delta.disposition);
    if (!lifecycleMatches) {
      findings.push(
        finding(
          "delta_lifecycle_mismatch",
          `deltas.${index}.disposition`,
          "Changed, corrected, withdrawn, and duplicate dispositions require matching item lineage.",
        ),
      );
    }
  }
  const classifiedItemIds = new Set(
    value.deltas.flatMap((item) => [...item.itemRefs, ...item.baselineItemRefs]),
  );
  for (const item of value.items) {
    if (!classifiedItemIds.has(item.id)) {
      findings.push(
        finding(
          "unclassified_item",
          "items",
          `Retained item ${JSON.stringify(item.id)} lacks an explicit checkpoint disposition.`,
        ),
      );
    }
  }
  const baselineDeltaRefs = value.deltas.flatMap((item) => item.baselineItemRefs);
  for (const itemId of baselineItemSet) {
    if (!baselineDeltaRefs.includes(itemId)) {
      findings.push(
        finding(
          "untracked_baseline_item",
          "monitor.baseline.itemRefs",
          `Checkpoint item ${JSON.stringify(itemId)} must appear in a delta baseline reference.`,
        ),
      );
    }
  }

  for (const [index, review] of value.reviewQueue.entries()) {
    requireReferences(
      review.signalRefs,
      signalSet,
      `reviewQueue.${index}.signalRefs`,
      "Review signal reference",
    );
    requireReferences(
      review.deltaRefs,
      deltaSet,
      `reviewQueue.${index}.deltaRefs`,
      "Review delta reference",
    );
    if (
      review.owner !== value.monitor.owner ||
      (review.status === "resolved" && !review.resolution?.trim()) ||
      (review.status === "open" && review.resolution !== null)
    ) {
      findings.push(
        finding(
          "incoherent_review_queue",
          `reviewQueue.${index}`,
          "Review queue items must retain the named owner and coherent resolution state.",
        ),
      );
    }
  }
  const highSignalIds = value.signals
    .filter((item) => item.priority.level === "high")
    .map((item) => item.id);
  if (
    highSignalIds.some(
      (id) =>
        !value.reviewQueue.some(
          (item) => item.priority === "high" && item.signalRefs.includes(id),
        ),
    )
  ) {
    findings.push(
      finding(
        "missing_priority_review",
        "reviewQueue",
        "Every high-priority signal must be visible in a high-priority owner review.",
      ),
    );
  }
  const requiredReviewDeltaIds = value.deltas
    .filter(
      (item) =>
        item.relevance.state === "review-required" ||
        item.relevance.state === "unresolved" ||
        ["corrected", "withdrawn", "contradictory"].includes(item.disposition),
    )
    .map((item) => item.id);
  if (
    requiredReviewDeltaIds.some(
      (id) => !value.reviewQueue.some((item) => item.deltaRefs.includes(id)),
    )
  ) {
    findings.push(
      finding(
        "missing_required_review",
        "reviewQueue",
        "Every routed, unresolved, corrected, withdrawn, or contradictory delta must have an accountable owner review.",
      ),
    );
  }
  const requiredReviewSignalIds = value.signals
  .filter(
    (item) =>
      item.relevance.state === "unresolved" || item.confidence === "insufficient",
  )
  .map((item) => item.id);
  if (
  requiredReviewSignalIds.some(
    (id) => !value.reviewQueue.some((item) => item.signalRefs.includes(id)),
  )
  ) {
  findings.push(
    finding(
      "missing_required_review",
      "reviewQueue",
      "Every unresolved or insufficient-confidence signal must have an accountable owner review.",
    ),
  );
  }

  const recheckRules = new Map([
    ["corrected", { trigger: "item-correction", reviewKind: "lineage-review" }],
    ["withdrawn", { trigger: "item-withdrawal", reviewKind: "lineage-review" }],
    ["contradictory", { trigger: "contradiction", reviewKind: "contradiction-review" }],
  ]);
  for (const [index, delta] of value.deltas.entries()) {
    const rule = recheckRules.get(delta.disposition);
    if (!rule || !value.monitor.freshnessPolicy.recheckOn.includes(rule.trigger)) {
      continue;
    }
    const relatedSignals = value.signals.filter((signal) =>
      delta.itemRefs.includes(signal.itemRef),
    );
    const relatedSubscriptions = new Set(
      delta.itemRefs
        .map((id) => itemById.get(id)?.subscriptionRef)
        .filter(Boolean),
    );
    const recordsCarryRecheckState =
      delta.recheckState !== "not-required" &&
      delta.itemRefs.every(
        (id) => itemById.get(id)?.recheckState !== "not-required",
      ) &&
      relatedSignals.every((signal) => signal.recheckState !== "not-required") &&
      [...relatedSubscriptions].every(
        (id) =>
          subscriptionById.get(id)?.retrieval.recheckState !== "not-required",
      );
    const hasEquivalentOwnerReview = value.reviewQueue.some(
      (review) =>
        review.owner === value.monitor.owner &&
        review.kind === rule.reviewKind &&
        review.deltaRefs.includes(delta.id) &&
        relatedSignals.every((signal) => review.signalRefs.includes(signal.id)),
    );
    if (!recordsCarryRecheckState && !hasEquivalentOwnerReview) {
      findings.push(
        finding(
          "missing_recheck_handling",
          `deltas.${index}`,
          `${delta.disposition} requires ${rule.trigger} recheck state on its subscription, item, signal, and delta or an explicit linked ${rule.reviewKind} owned by the named monitor owner.`,
        ),
      );
    }
  }

  const deliveredSignals = new Set();
  const deliveredDeltas = new Set();
  for (const [index, delivery] of value.deliveryQueue.entries()) {
    requireReferences(
      delivery.signalRefs,
      signalSet,
      `deliveryQueue.${index}.signalRefs`,
      "Delivery signal reference",
    );
    requireReferences(
      delivery.deltaRefs,
      deltaSet,
      `deliveryQueue.${index}.deltaRefs`,
      "Delivery delta reference",
    );
    requireReferences(
      delivery.reviewRefs,
      reviewSet,
      `deliveryQueue.${index}.reviewRefs`,
      "Delivery review reference",
    );
    const relevantReviews = value.reviewQueue.filter(
      (review) =>
        review.signalRefs.some((id) => delivery.signalRefs.includes(id)) ||
        review.deltaRefs.some((id) => delivery.deltaRefs.includes(id)),
    );
    const missingRelevantReviewIds = relevantReviews
      .map((review) => review.id)
      .filter((id) => !delivery.reviewRefs.includes(id));
    if (missingRelevantReviewIds.length > 0) {
      findings.push(
        finding(
          "incomplete_delivery_review",
          `deliveryQueue.${index}.reviewRefs`,
          `Private delivery must retain every review derived from its linked signals and deltas: ${missingRelevantReviewIds.join(", ")}.`,
        ),
      );
    }
    delivery.signalRefs.forEach((id) => deliveredSignals.add(id));
    delivery.deltaRefs.forEach((id) => deliveredDeltas.add(id));
    if (
      delivery.owner !== value.monitor.owner ||
      delivery.classification !== value.monitor.classification ||
      delivery.destination !== value.monitor.destination ||
      !isSafePackagePath(delivery.destination) ||
      !delivery.destination.startsWith("outputs/") ||
      (delivery.state === "prepared" &&
        relevantReviews.some((review) => review.status !== "resolved"))
    ) {
      findings.push(
        finding(
          "incoherent_delivery_queue",
          `deliveryQueue.${index}`,
          "Private delivery entries must preserve owner and destination and cannot be prepared while a review derived from linked signals or deltas remains unresolved.",
        ),
      );
    }
  }
  if (
    signalIds.some((id) => !deliveredSignals.has(id)) ||
    deltaIds.some((id) => !deliveredDeltas.has(id))
  ) {
    findings.push(
      finding(
        "missing_delivery_queue",
        "deliveryQueue",
        "Every retained signal and delta must be retained in a private idempotent delivery queue.",
      ),
    );
  }

  for (const [index, item] of value.gapsAndBlockers.entries()) {
    requireReferences(
      item.subscriptionRefs,
      subscriptionSet,
      `gapsAndBlockers.${index}.subscriptionRefs`,
      "Gap subscription reference",
    );
    requireReferences(
      item.itemRefs,
      itemSet,
      `gapsAndBlockers.${index}.itemRefs`,
      "Gap item reference",
    );
    requireReferences(
      item.signalRefs,
      signalSet,
      `gapsAndBlockers.${index}.signalRefs`,
      "Gap signal reference",
    );
    requireReferences(
      item.deltaRefs,
      deltaSet,
      `gapsAndBlockers.${index}.deltaRefs`,
      "Gap delta reference",
    );
    if (item.owner !== value.monitor.owner) {
      findings.push(
        finding(
          "owner_mismatch",
          `gapsAndBlockers.${index}.owner`,
          "Gaps and blockers must remain assigned to the named monitor owner.",
        ),
      );
    }
  }

  if (
    value.handoff.owner !== value.monitor.owner ||
    value.handoff.classification !== value.monitor.classification ||
    value.handoff.destination !== value.monitor.destination ||
    !isSafePackagePath(value.handoff.destination) ||
    !value.handoff.destination.startsWith("outputs/")
  ) {
    findings.push(
      finding(
        "private_handoff_mismatch",
        "handoff",
        "The private handoff must preserve the named owner, classification, and portable outputs/ destination.",
      ),
    );
  }
  if (
    /^(?:the )?(?:agent|assistant|claw)$/iu.test(value.monitor.owner.trim()) ||
    /\b(?:ai|bot|gpt|language model|feed intelligence monitor)\b/iu.test(value.monitor.owner)
  ) {
    findings.push(
      finding(
        "agent_owned_authority",
        "monitor.owner",
        "Feed subscriptions, triage, queues, and decisions must remain with a named human or team.",
      ),
    );
  }

  requireCompleteReferences(
    value.handoff.subscriptionRefs,
    subscriptionIds,
    "handoff.subscriptionRefs",
    "Subscription",
  );
  requireCompleteReferences(value.handoff.itemRefs, itemIds, "handoff.itemRefs", "Item");
  requireCompleteReferences(
    value.handoff.signalRefs,
    signalIds,
    "handoff.signalRefs",
    "Signal",
  );
  requireCompleteReferences(value.handoff.deltaRefs, deltaIds, "handoff.deltaRefs", "Delta");
  requireCompleteReferences(
    value.handoff.reviewQueueRefs,
    reviewIds,
    "handoff.reviewQueueRefs",
    "Review queue item",
  );
  requireCompleteReferences(
    value.handoff.deliveryQueueRefs,
    deliveryIds,
    "handoff.deliveryQueueRefs",
    "Delivery queue item",
  );
  requireCompleteReferences(
    value.handoff.gapAndBlockerRefs,
    gapIds,
    "handoff.gapAndBlockerRefs",
    "Gap or blocker",
  );
  const openBlockerIds = value.gapsAndBlockers
    .filter((item) => item.kind === "blocker" && item.status === "open")
    .map((item) => item.id);
  requireReferences(
    value.handoff.blockerRefs,
    gapSet,
    "handoff.blockerRefs",
    "Handoff blocker reference",
  );
  if (
    value.handoff.blockerRefs.some((id) => !openBlockerIds.includes(id)) ||
    (value.handoff.state === "blocked" &&
      (openBlockerIds.length === 0 ||
        openBlockerIds.some((id) => !value.handoff.blockerRefs.includes(id))))
  ) {
    findings.push(
      finding(
        "incomplete_blocked_handoff",
        "handoff.blockerRefs",
        "Blocked handoffs must name every and only open blocker.",
      ),
    );
  }
  const expectedHandoffState =
    value.monitor.state === "ready" ? "ready-for-owner-review" : value.monitor.state;
  if (value.handoff.state !== expectedHandoffState) {
    findings.push(
      finding(
        "inconsistent_ready_state",
        "handoff.state",
        "The monitor and handoff state must remain consistent.",
      ),
    );
  }
  if (
    value.handoff.state === "ready-for-owner-review" &&
    (subscriptions.some(
      (item) =>
        item.retrieval.state !== "complete" ||
        item.retrieval.freshness !== "current" ||
        item.retrieval.recheckState === "requested",
    ) ||
      value.reviewQueue.some((item) => item.status !== "resolved") ||
      value.gapsAndBlockers.some((item) => item.status !== "resolved") ||
      value.deliveryQueue.some((item) => item.state !== "prepared") ||
      value.signals.some(
        (item) =>
          item.relevance.state === "unresolved" ||
          item.confidence === "insufficient",
      ) ||
      value.deltas.some((item) => item.relevance.state === "unresolved") ||
      openBlockerIds.length > 0 ||
      value.handoff.blockerRefs.length > 0)
  ) {
    findings.push(
      finding(
        "premature_ready_state",
        "handoff.state",
        "Ready handoffs require complete current subscriptions, no unresolved or insufficient-confidence signal or delta relevance, resolved owner review and gaps, prepared private queues, and no blocker.",
      ),
    );
  }

  for (const action of requiredActions) {
    if (!value.blockedActions.includes(action)) {
      findings.push(
        finding(
          "missing_authority_gate",
          "blockedActions",
          `Feed intelligence ledgers must keep ${action} explicitly prohibited.`,
        ),
      );
    }
    if (!value.handoff.prohibitedActions.includes(action)) {
      findings.push(
        finding(
          "missing_authority_gate",
          "handoff.prohibitedActions",
          `Feed intelligence ledgers must keep ${action} explicitly prohibited.`,
        ),
      );
    }
  }

  const narrativeTexts = [
    value.monitor.routingIntent,
    ...value.monitor.routingQuestions,
    ...subscriptions.flatMap((item) => [item.name, item.cursor.value]),
    ...value.items.flatMap((item) => [item.title]),
    ...value.signals.flatMap((item) => [
      item.statement,
      item.uncertainty,
      item.relevance.rationale,
      item.priority.rationale,
    ]),
    ...value.deltas.flatMap((item) => [item.summary, item.relevance.rationale]),
    ...value.reviewQueue.flatMap((item) => [item.question, item.resolution ?? ""]),
    ...value.gapsAndBlockers.map((item) => item.description),
  ];
  const prohibitedNarrative =
    /\b(?:subscribe|subscribed|subscribing|unsubscribe|unsubscribed|unsubscribing) (?:to |from )?(?:a |the )?(?:feed|subscription)|\b(?:publish(?:ed|ing)?|post(?:ed|ing)?|announc(?:e|ed|ing)|communicat(?:e|ed|ing)|contact(?:ed|ing)?|email(?:ed|ing)?|messag(?:e|ed|ing)) (?:an? )?(?:external|public|source|authority|audience|party)|\b(?:change|changed|changing|creat(?:e|ed|ing)|updat(?:e|ed|ing)) (?:an? )?account|\b(?:send(?:ing|sent)?|deliver(?:ed|ing)?) (?:a |the )?(?:notification|message|alert)|\b(?:disclos(?:e|ed|ing)|leak(?:ed|ing)?|expos(?:e|ed|ing)|send(?:ing|sent)?) (?:(?:a|the) )?(?:credential|secret|token)|\b(?:bypass|circumvent)(?:ing)? (?:publisher )?access controls?|\b(?:reproduc(?:e|ing)|copy(?:ing)?|past(?:e|ing)|quot(?:e|ing)|extract(?:ing)?) (?:restricted|paywalled) (?:content|text)|\b(?:fabricat(?:e|ed|ing)|invent(?:ed|ing)?) (?:a |the )?(?:signal|source|claim|evidence)|\b(?:infer|inferred|assert|asserted|declare|declared) (?:a )?consensus|\b(?:prove|proved|proving|establish|establishes|established|establishing|assert|asserts|asserted|asserting|infer|infers|inferred|inferring) (?:a )?(?:causal|cause-and-effect) (?:effect|relationship)|\b(?:causes?|causing|caused by|will cause)\b|\b(?:autonomously|automatically) (?:chang(?:e|ed|ing)|updat(?:e|ed|ing)|mak(?:e|ing)|tak(?:e|ing)) (?:a |the )?(?:decision|action)|\b(?:chang(?:e|ed|ing)|updat(?:e|ed|ing)|mak(?:e|ing)|tak(?:e|ing)) (?:a |the )?(?:decision|action) (?:autonomously|without (?:the )?(?:owner|review))/giu;
  if (hasUnnegatedNarrativeMatch(narrativeTexts, prohibitedNarrative)) {
    findings.push(
      finding(
        "unsafe_narrative_content",
        "signals",
        "Feed intelligence artifacts must not subscribe, publish, contact, change accounts, send notifications, disclose credentials, reproduce restricted content, fabricate signals, infer consensus or causality, or act autonomously.",
      ),
    );
  }
  return findings;
}

function claimEvidenceInvestigationLedgerFindings(value) {
  const findings = [];
  const requiredActions = [
    "bypass-access-controls",
    "reproduce-restricted-content",
    "publish-or-contact-externally",
    "subscribe-or-change-accounts",
    "disclose-credentials-or-sensitive-queries",
    "fabricate-sources-or-claims",
    "make-consensus-causal-legal-medical-or-financial-inference",
    "change-decisions-or-actions-autonomously",
  ];
  const { investigation } = value;
  const authorities = investigation.authorities;
  const authorityIds = authorities.map((item) => item.id);
  const queryIds = investigation.queries.map((item) => item.id);
  const sourceIds = value.sources.map((item) => item.id);
  const hypothesisIds = value.hypotheses.map((item) => item.id);
  const claimIds = value.claims.map((item) => item.id);
  const evidenceIds = value.evidence.map((item) => item.id);
  const conflictIds = value.conflicts.map((item) => item.id);
  const questionIds = value.reviewQuestions.map((item) => item.id);
  const gapIds = value.gapsAndBlockers.map((item) => item.id);
  const authoritySet = new Set(authorityIds);
  const querySet = new Set(queryIds);
  const sourceSet = new Set(sourceIds);
  const hypothesisSet = new Set(hypothesisIds);
  const claimSet = new Set(claimIds);
  const evidenceSet = new Set(evidenceIds);
  const conflictSet = new Set(conflictIds);
  const questionSet = new Set(questionIds);
  const gapSet = new Set(gapIds);
  const authorityById = new Map(authorities.map((item) => [item.id, item]));
  const queryById = new Map(investigation.queries.map((item) => [item.id, item]));
  const sourceById = new Map(value.sources.map((item) => [item.id, item]));
  const hypothesisById = new Map(value.hypotheses.map((item) => [item.id, item]));
  const claimById = new Map(value.claims.map((item) => [item.id, item]));
  const evidenceById = new Map(value.evidence.map((item) => [item.id, item]));

  findings.push(
    ...uniqueFindings(authorityIds, "investigation.authorities", "Authority id"),
    ...uniqueFindings(queryIds, "investigation.queries", "Query id"),
    ...uniqueFindings(sourceIds, "sources", "Source id"),
    ...uniqueFindings(hypothesisIds, "hypotheses", "Hypothesis id"),
    ...uniqueFindings(claimIds, "claims", "Claim id"),
    ...uniqueFindings(evidenceIds, "evidence", "Evidence id"),
    ...uniqueFindings(conflictIds, "conflicts", "Conflict id"),
    ...uniqueFindings(questionIds, "reviewQuestions", "Review question id"),
    ...uniqueFindings(gapIds, "gapsAndBlockers", "Gap or blocker id"),
  );

  function requireReferences(refs, known, path, label) {
    findings.push(
      ...uniqueFindings(refs, path, label),
      ...referenceFindings(refs, known, path, label),
    );
  }

  function requireCompleteReferences(actual, expected, path, label) {
    requireReferences(actual, new Set(expected), path, label);
    for (const id of expected) {
      if (!actual.includes(id)) {
        findings.push(
          finding(
            "incomplete_handoff",
            path,
            `${label} ${JSON.stringify(id)} is missing from the private handoff.`,
          ),
        );
      }
    }
  }

  function ownerIsAgent(owner) {
    return (
      /^(?:the )?(?:agent|assistant|claw)$/iu.test(owner.trim()) ||
      /\b(?:ai|bot|gpt|language model|web evidence researcher)\b/iu.test(owner)
    );
  }

  const runStarted = Date.parse(investigation.run.startedAt);
  const runCompleted = Date.parse(investigation.run.completedAt);
  const runAsOf = Date.parse(investigation.run.asOf);
  const asOf = Date.parse(investigation.asOf);
  if (
    runStarted > runCompleted ||
    runCompleted > runAsOf ||
    runAsOf !== asOf
  ) {
    findings.push(
      finding(
        "invalid_investigation_chronology",
        "investigation.run",
        "The bounded investigation run must be ordered and share the declared as-of time.",
      ),
    );
  }
  if (
    !isSafePackagePath(investigation.destination) ||
    !investigation.destination.startsWith("outputs/")
  ) {
    findings.push(
      finding(
        "unsafe_handoff_destination",
        "investigation.destination",
        "The private investigation destination must remain a portable path under outputs/.",
      ),
    );
  }

  for (const [index, query] of investigation.queries.entries()) {
    requireReferences(
      [query.authorityRef],
      authoritySet,
      `investigation.queries.${index}.authorityRef`,
      "Query authority reference",
    );
    requireReferences(
      query.resultSourceRefs,
      sourceSet,
      `investigation.queries.${index}.resultSourceRefs`,
      "Query result source reference",
    );
    if (
      Date.parse(query.executedAt) < runStarted ||
      Date.parse(query.executedAt) > runCompleted
    ) {
      findings.push(
        finding(
          "query_outside_investigation_run",
          `investigation.queries.${index}.executedAt`,
          "Each reproducible query must execute inside the bounded investigation run.",
        ),
      );
    }
    if (
      query.resultSourceRefs.some(
        (sourceRef) => sourceById.get(sourceRef)?.authorityRef !== query.authorityRef,
      )
    ) {
      findings.push(
        finding(
          "query_authority_mismatch",
          `investigation.queries.${index}.resultSourceRefs`,
          "A query may retain only sources from its declared owner-approved authority.",
        ),
      );
    }
    if (
      query.resultSourceRefs.some(
        (sourceRef) => !sourceById.get(sourceRef)?.queryRefs.includes(query.id),
      )
    ) {
      findings.push(
        finding(
          "invalid_query_provenance",
          `investigation.queries.${index}.resultSourceRefs`,
          "Every query result must name the same query in its retained source provenance.",
        ),
      );
    }
  }

  const sourceIdentityOwners = new Map();
  for (const [index, source] of value.sources.entries()) {
    requireReferences(
      [source.authorityRef],
      authoritySet,
      `sources.${index}.authorityRef`,
      "Source authority reference",
    );
    requireReferences(
      source.queryRefs,
      querySet,
      `sources.${index}.queryRefs`,
      "Source query reference",
    );
    requireReferences(
      source.derivedFromSourceRefs,
      sourceSet,
      `sources.${index}.derivedFromSourceRefs`,
      "Derived source reference",
    );
    const authority = authorityById.get(source.authorityRef);
    if (
      !authority?.ownerApproved ||
      !authority.sourceTypes.includes(source.sourceType)
    ) {
      findings.push(
        finding(
          "source_authority_mismatch",
          `sources.${index}`,
          "Each source type must be approved by its named public authority.",
        ),
      );
    }
    const sourceIdentity = `${source.authorityRef}\u0000${source.canonicalKey.toLowerCase()}`;
    const priorIdentityOwner = sourceIdentityOwners.get(sourceIdentity);
    if (priorIdentityOwner && priorIdentityOwner !== source.id) {
      findings.push(
        finding(
          "duplicate_source_identity",
          `sources.${index}.canonicalKey`,
          `Canonical source identity ${JSON.stringify(source.canonicalKey)} belongs to both ${priorIdentityOwner} and ${source.id}.`,
        ),
      );
    }
    sourceIdentityOwners.set(sourceIdentity, source.id);
    const publishedAt = Date.parse(source.publishedAt);
    const updatedAt = Date.parse(source.updatedAt);
    const retrievedAt = Date.parse(source.retrievedAt);
    if (
      publishedAt > updatedAt ||
      updatedAt > retrievedAt ||
      retrievedAt > runAsOf
    ) {
      findings.push(
        finding(
          "invalid_source_chronology",
          `sources.${index}.retrievedAt`,
          "Sources must be published no later than updated or retrieved and retrieved no later than the investigation as-of time.",
        ),
      );
    }
    try {
      const reference = new URL(source.canonicalUrl);
      const host = reference.hostname.toLowerCase();
      const allowedHost = authority?.domains.some(
        (domain) =>
          host === domain.toLowerCase() ||
          host.endsWith(`.${domain.toLowerCase()}`),
      );
      if (
        !isCredentialFreePublicHttpsReference(reference) ||
        !allowedHost ||
        reference.pathname === "/"
      ) {
        throw new Error("unsafe source");
      }
    } catch {
      findings.push(
        finding(
          "unsafe_source_reference",
          `sources.${index}.canonicalUrl`,
          "Sources require an approved, credential-free public HTTPS URL without fragments, private hosts, or sensitive query values.",
        ),
      );
    }
    const queryProvenanceValid = source.queryRefs.every((queryRef) => {
      const query = queryById.get(queryRef);
      return (
        query?.authorityRef === source.authorityRef &&
        query.resultSourceRefs.includes(source.id)
      );
    });
    if (!queryProvenanceValid) {
      findings.push(
        finding(
          "invalid_query_provenance",
          `sources.${index}.queryRefs`,
          "Every retained source must be returned by each named query from the same approved authority.",
        ),
      );
    }
    if (
      (source.derivation === "primary" || source.derivation === "independent") &&
      source.derivedFromSourceRefs.length > 0
    ) {
      findings.push(
        finding(
          "invalid_source_derivation",
          `sources.${index}.derivedFromSourceRefs`,
          "Primary and independent sources cannot claim a derived source lineage.",
        ),
      );
    }
    if (
      ["derived", "syndicated"].includes(source.derivation) &&
      (source.derivedFromSourceRefs.length === 0 ||
        source.derivedFromSourceRefs.includes(source.id))
    ) {
      findings.push(
        finding(
          "invalid_source_derivation",
          `sources.${index}.derivedFromSourceRefs`,
          "Derived and syndicated sources require a distinct retained origin source.",
        ),
      );
    }
    if (
      investigation.state === "ready" &&
      (source.freshness !== "current" ||
        source.recheckState !== "current" ||
        runAsOf - retrievedAt > investigation.freshnessPolicy.maxAgeHours * 3_600_000)
    ) {
      findings.push(
        finding(
          "stale_current_source",
          `sources.${index}`,
          "Ready handoffs require every retained source to be current, rechecked, and within the freshness window.",
        ),
      );
    }
  }

  for (const [index, hypothesis] of value.hypotheses.entries()) {
    requireReferences(
      hypothesis.claimRefs,
      claimSet,
      `hypotheses.${index}.claimRefs`,
      "Hypothesis claim reference",
    );
    if (
      hypothesis.claimRefs.some(
        (claimRef) => claimById.get(claimRef)?.hypothesisRef !== hypothesis.id,
      )
    ) {
      findings.push(
        finding(
          "claim_hypothesis_mismatch",
          `hypotheses.${index}.claimRefs`,
          "Every hypothesis claim must name that hypothesis as its owner.",
        ),
      );
    }
  }

  for (const [index, claim] of value.claims.entries()) {
    requireReferences(
      [claim.hypothesisRef],
      hypothesisSet,
      `claims.${index}.hypothesisRef`,
      "Claim hypothesis reference",
    );
    requireReferences(
      claim.evidenceRefs,
      evidenceSet,
      `claims.${index}.evidenceRefs`,
      "Claim evidence reference",
    );
    requireReferences(
      claim.corroboration.independentEvidenceRefs,
      evidenceSet,
      `claims.${index}.corroboration.independentEvidenceRefs`,
      "Independent evidence reference",
    );
    if (
      !hypothesisById.get(claim.hypothesisRef)?.claimRefs.includes(claim.id)
    ) {
      findings.push(
        finding(
          "claim_hypothesis_mismatch",
          `claims.${index}.hypothesisRef`,
          "Every claim must be included in its named hypothesis decomposition.",
        ),
      );
    }
    const claimEvidence = claim.evidenceRefs
      .map((evidenceRef) => evidenceById.get(evidenceRef))
      .filter(Boolean);
    if (claimEvidence.some((item) => item.claimRef !== claim.id)) {
      findings.push(
        finding(
          "claim_evidence_mismatch",
          `claims.${index}.evidenceRefs`,
          "Claim evidence references must point to evidence records owned by the same claim.",
        ),
      );
    }
    const stances = new Set(claimEvidence.map((item) => item.stance));
    const validAssessment =
      (claim.assessment === "supported" && stances.has("supports")) ||
      (claim.assessment === "refuted" && stances.has("refutes")) ||
      (claim.assessment === "mixed" &&
        stances.has("supports") &&
        stances.has("refutes")) ||
      (claim.assessment === "context-only" &&
        [...stances].every((stance) => stance === "context")) ||
      (claim.assessment === "unknown" && stances.has("unknown"));
    if (!validAssessment) {
      findings.push(
        finding(
          "invalid_claim_assessment",
          `claims.${index}.assessment`,
          "Claim assessment must remain consistent with its typed evidence stances.",
        ),
      );
    }
    const independentEvidence = claim.corroboration.independentEvidenceRefs
      .map((evidenceRef) => evidenceById.get(evidenceRef))
      .filter(Boolean);
    const independentKeys = new Set();
    const corroboratingStances =
      claim.assessment === "supported"
        ? new Set(["supports"])
        : claim.assessment === "refuted"
          ? new Set(["refutes"])
          : claim.assessment === "mixed"
            ? new Set(["supports", "refutes"])
            : new Set();
    const validIndependentEvidence = independentEvidence.every((item) => {
      const source = sourceById.get(item.sourceRef);
      if (
        !claim.evidenceRefs.includes(item.id) ||
        !["primary", "independent"].includes(source?.derivation) ||
        !corroboratingStances.has(item.stance)
      ) {
        return false;
      }
      independentKeys.add(source.independenceKey);
      return true;
    });
    const minimumIndependentSources =
      claim.confidence === "high" ? 2 : claim.confidence === "moderate" ? 1 : 0;
    if (
      !validIndependentEvidence ||
      independentKeys.size !== independentEvidence.length ||
      independentKeys.size < claim.corroboration.requiredIndependentSources ||
      claim.corroboration.requiredIndependentSources < minimumIndependentSources
    ) {
      findings.push(
        finding(
          "invalid_corroboration",
          `claims.${index}.corroboration`,
          "Independent corroboration must match the claim assessment and use distinct primary or independent origins; derived and syndicated pages never count.",
        ),
      );
    }
    if (
      claim.status === "resolved" &&
      claim.assessment === "unknown" &&
      claim.confidence !== "insufficient"
    ) {
      findings.push(
        finding(
          "invalid_claim_assessment",
          `claims.${index}`,
          "An unknown claim must retain insufficient confidence even when its investigation status is resolved.",
        ),
      );
    }
  }

  for (const [index, evidence] of value.evidence.entries()) {
    requireReferences(
      [evidence.claimRef],
      claimSet,
      `evidence.${index}.claimRef`,
      "Evidence claim reference",
    );
    requireReferences(
      [evidence.sourceRef],
      sourceSet,
      `evidence.${index}.sourceRef`,
      "Evidence source reference",
    );
    const claim = claimById.get(evidence.claimRef);
    if (!claim?.evidenceRefs.includes(evidence.id)) {
      findings.push(
        finding(
          "unclassified_evidence",
          `evidence.${index}`,
          "Every evidence record must be explicitly retained by its claim.",
        ),
      );
    }
    if (
      (evidence.type === "source-context" && !["context", "unknown"].includes(evidence.stance)) ||
      (evidence.type !== "source-context" && evidence.stance === "context")
    ) {
      findings.push(
        finding(
          "invalid_evidence_stance",
          `evidence.${index}.stance`,
          "Source-context records may only provide context or uncertainty; claim evidence cannot disguise support as context.",
        ),
      );
    }
  }

  for (const [index, conflict] of value.conflicts.entries()) {
    requireReferences(
      conflict.claimRefs,
      claimSet,
      `conflicts.${index}.claimRefs`,
      "Conflict claim reference",
    );
    requireReferences(
      conflict.evidenceRefs,
      evidenceSet,
      `conflicts.${index}.evidenceRefs`,
      "Conflict evidence reference",
    );
    if (
      conflict.owner !== investigation.decisionOwner ||
      (conflict.status === "resolved" && !conflict.resolution?.trim()) ||
      (conflict.status === "open" && conflict.resolution !== null)
    ) {
      findings.push(
        finding(
          "invalid_conflict_state",
          `conflicts.${index}`,
          "Conflicts must remain owner-owned and have a resolution only after owner resolution.",
        ),
      );
    }
  }
  for (const [index, question] of value.reviewQuestions.entries()) {
    requireReferences(
      question.claimRefs,
      claimSet,
      `reviewQuestions.${index}.claimRefs`,
      "Review question claim reference",
    );
    requireReferences(
      question.evidenceRefs,
      evidenceSet,
      `reviewQuestions.${index}.evidenceRefs`,
      "Review question evidence reference",
    );
    if (
      question.owner !== investigation.decisionOwner ||
      (question.status === "resolved" && !question.resolution?.trim()) ||
      (question.status === "open" && question.resolution !== null)
    ) {
      findings.push(
        finding(
          "incoherent_review_question",
          `reviewQuestions.${index}`,
          "Review questions must remain owner-owned and have a resolution only when resolved.",
        ),
      );
    }
  }
  for (const [index, gap] of value.gapsAndBlockers.entries()) {
    requireReferences(
      gap.claimRefs,
      claimSet,
      `gapsAndBlockers.${index}.claimRefs`,
      "Gap claim reference",
    );
    requireReferences(
      gap.evidenceRefs,
      evidenceSet,
      `gapsAndBlockers.${index}.evidenceRefs`,
      "Gap evidence reference",
    );
    if (gap.owner !== investigation.decisionOwner) {
      findings.push(
        finding(
          "owner_mismatch",
          `gapsAndBlockers.${index}.owner`,
          "Every gap or blocker must belong to the named decision owner.",
        ),
      );
    }
  }

  const handoff = value.handoff;
  if (
    handoff.owner !== investigation.decisionOwner ||
    value.ownerReview.owner !== investigation.decisionOwner
  ) {
    findings.push(
      finding(
        "owner_mismatch",
        "handoff.owner",
        "The owner review and handoff must remain assigned to the investigation decision owner.",
      ),
    );
  }
  for (const owner of [
    investigation.decisionOwner,
    handoff.owner,
    value.ownerReview.owner,
    ...value.conflicts.map((item) => item.owner),
    ...value.reviewQuestions.map((item) => item.owner),
    ...value.gapsAndBlockers.map((item) => item.owner),
  ]) {
    if (ownerIsAgent(owner)) {
      findings.push(
        finding(
          "agent_owned_authority",
          "investigation.decisionOwner",
          "A named accountable human or team, not an agent, must own the investigation and handoff.",
        ),
      );
      break;
    }
  }
  if (
    handoff.classification !== investigation.classification ||
    handoff.destination !== investigation.destination ||
    handoff.ownerReviewRef !== value.ownerReview.id
  ) {
    findings.push(
      finding(
        "private_handoff_mismatch",
        "handoff",
        "The private handoff must preserve the declared classification, destination, and owner review.",
      ),
    );
  }
  if (
    !isSafePackagePath(handoff.destination) ||
    !handoff.destination.startsWith("outputs/")
  ) {
    findings.push(
      finding(
        "unsafe_handoff_destination",
        "handoff.destination",
        "The private handoff destination must remain a portable path under outputs/.",
      ),
    );
  }
  requireCompleteReferences(handoff.sourceRefs, sourceIds, "handoff.sourceRefs", "Source");
  requireCompleteReferences(
    handoff.hypothesisRefs,
    hypothesisIds,
    "handoff.hypothesisRefs",
    "Hypothesis",
  );
  requireCompleteReferences(handoff.claimRefs, claimIds, "handoff.claimRefs", "Claim");
  requireCompleteReferences(
    handoff.evidenceRefs,
    evidenceIds,
    "handoff.evidenceRefs",
    "Evidence",
  );
  requireCompleteReferences(
    handoff.conflictRefs,
    conflictIds,
    "handoff.conflictRefs",
    "Conflict",
  );
  requireCompleteReferences(
    handoff.questionRefs,
    questionIds,
    "handoff.questionRefs",
    "Review question",
  );
  requireCompleteReferences(
    handoff.gapAndBlockerRefs,
    gapIds,
    "handoff.gapAndBlockerRefs",
    "Gap or blocker",
  );
  const openBlockers = value.gapsAndBlockers
    .filter((item) => item.kind === "blocker" && item.status === "open")
    .map((item) => item.id);
  requireReferences(
    handoff.blockerRefs,
    gapSet,
    "handoff.blockerRefs",
    "Handoff blocker reference",
  );
  if (
    openBlockers.some((id) => !handoff.blockerRefs.includes(id)) ||
    handoff.blockerRefs.some((id) => !openBlockers.includes(id))
  ) {
    findings.push(
      finding(
        "incomplete_blocked_handoff",
        "handoff.blockerRefs",
        "Every and only open blockers must remain visible in the private handoff.",
      ),
    );
  }
  if (investigation.state === "ready" && handoff.state !== "ready-for-owner-review") {
    findings.push(
      finding(
        "inconsistent_ready_state",
        "handoff.state",
        "A ready investigation must produce a ready-for-owner-review handoff.",
      ),
    );
  }
  if (investigation.state !== "ready" && handoff.state === "ready-for-owner-review") {
    findings.push(
      finding(
        "inconsistent_ready_state",
        "handoff.state",
        "Only a ready investigation can produce a ready-for-owner-review handoff.",
      ),
    );
  }
  if (
    handoff.state === "ready-for-owner-review" &&
    (value.claims.some((item) => item.status !== "resolved") ||
      value.hypotheses.some((item) => item.status !== "resolved") ||
      value.conflicts.some((item) => item.status !== "resolved") ||
      value.reviewQuestions.some((item) => item.status !== "resolved") ||
      value.gapsAndBlockers.some((item) => item.status !== "resolved") ||
      openBlockers.length > 0 ||
      value.ownerReview.status !== "completed" ||
      !value.ownerReview.resolution?.trim() ||
      Date.parse(value.ownerReview.reviewedAt) > runAsOf)
  ) {
    findings.push(
      finding(
        "premature_ready_state",
        "handoff.state",
        "Ready handoffs cannot hide unresolved claims, conflicts, questions, gaps, blockers, stale work, or incomplete owner review.",
      ),
    );
  }
  requireCompleteReferences(
    value.ownerReview.claimRefs,
    claimIds,
    "ownerReview.claimRefs",
    "Owner-review claim",
  );
  requireCompleteReferences(
    value.ownerReview.questionRefs,
    questionIds,
    "ownerReview.questionRefs",
    "Owner-review question",
  );
  requireCompleteReferences(
    value.ownerReview.gapAndBlockerRefs,
    gapIds,
    "ownerReview.gapAndBlockerRefs",
    "Owner-review gap or blocker",
  );
  if (
    (value.ownerReview.status === "completed" && !value.ownerReview.resolution?.trim()) ||
    (value.ownerReview.status === "pending" && value.ownerReview.resolution !== null)
  ) {
    findings.push(
      finding(
        "incoherent_owner_review",
        "ownerReview",
        "A completed owner review requires a recorded human resolution; a pending review cannot have one.",
      ),
    );
  }
  for (const action of requiredActions) {
    if (
      !value.blockedActions.includes(action) ||
      !handoff.prohibitedActions.includes(action)
    ) {
      findings.push(
        finding(
          "missing_authority_gate",
          "blockedActions",
          `The investigation and private handoff must preserve the ${action} authority gate.`,
        ),
      );
    }
  }
  const narrativeTexts = [
    investigation.question,
    investigation.decision,
    ...investigation.scope.included,
    ...investigation.scope.excluded,
    ...value.sources.flatMap((item) => [item.title, item.scope]),
    ...value.hypotheses.map((item) => item.statement),
    ...value.claims.flatMap((item) => [
      item.statement,
      item.decisionImplication,
      item.uncertainty,
      ...item.limitations,
    ]),
    ...value.evidence.flatMap((item) => [item.excerpt, item.limitation]),
    ...value.conflicts.flatMap((item) => [item.description, item.resolution ?? ""]),
    ...value.reviewQuestions.flatMap((item) => [item.question, item.resolution ?? ""]),
    ...value.gapsAndBlockers.map((item) => item.description),
    value.ownerReview.resolution ?? "",
  ];
  const prohibitedNarrative =
    /\b(?:bypass|circumvent)(?:ing)? (?:publisher )?access controls?|\b(?:reproduc(?:e|ed|ing)|copy(?:ing)?|past(?:e|ed|ing)|quot(?:e|ed|ing)|extract(?:ed|ing)?) (?:restricted|paywalled) (?:content|text)|\b(?:publish(?:ed|ing)?|post(?:ed|ing)?|communicat(?:e|ed|ing)|contact(?:ed|ing)?|email(?:ed|ing)?|messag(?:e|ed|ing)) (?:an? )?(?:external|public|source|authority|audience|party)|\b(?:subscribe|subscribed|subscribing|unsubscribe|unsubscribed|unsubscribing) (?:to |from )?(?:a |the )?(?:feed|subscription)|\b(?:change|changed|changing|creat(?:e|ed|ing)|updat(?:e|ed|ing)) (?:an? )?account|\b(?:disclos(?:e|ed|ing)|leak(?:ed|ing)?|expos(?:e|ed|ing)|send(?:ing|sent)?) (?:(?:a|the) )?(?:credential|secret|token|sensitive query)|\b(?:fabricat(?:e|ed|ing)|invent(?:ed|ing)?) (?:a |the )?(?:source|quote|claim|evidence)|\b(?:infer|inferred|assert|asserted|declare|declared) (?:a )?consensus|\b(?:prove|proved|proving|establish|establishes|established|establishing|assert|asserts|asserted|asserting|infer|infers|inferred|inferring) (?:a )?(?:causal|cause-and-effect) (?:effect|relationship)|\b(?:give|provid(?:e|d|ing)|offer(?:ed|ing)) (?:a )?(?:legal|medical|financial|investment) (?:conclusion|advice|determination)|\b(?:autonomously|automatically) (?:chang(?:e|ed|ing)|updat(?:e|ed|ing)|mak(?:e|ing)|tak(?:e|ing)) (?:a |the )?(?:decision|action)|\b(?:chang(?:e|ed|ing)|updat(?:e|ed|ing)|mak(?:e|ing)|tak(?:e|ing)) (?:a |the )?(?:decision|action) (?:autonomously|without (?:the )?(?:owner|review))/giu;
  if (hasUnnegatedNarrativeMatch(narrativeTexts, prohibitedNarrative)) {
    findings.push(
      finding(
        "unsafe_narrative_content",
        "investigation",
        "Web evidence artifacts must not bypass access controls, reproduce restricted content, publish or contact externally, change subscriptions or accounts, disclose sensitive material, fabricate evidence, infer consensus, causality, legal, medical, or financial conclusions, or act autonomously.",
      ),
    );
  }
  return findings;
}

const validators = {
  "appliance-care-coordinator": applianceCareFindings,
  "benefits-open-enrollment-planner": benefitsEnrollmentFindings,
  "care-circle-coordinator": careCircleFindings,
  "case-continuity-coordinator": caseContinuityFindings,
  "certification-renewal-planner": certificationRenewalFindings,
  "conference-opportunity-scout": conferenceOpportunityFindings,
  "change-control-operator": changeControlFindings,
  "child-activity-manager": childActivityFindings,
  "civic-data-analyst": civicDataFindings,
  "data-analyst": dataAnalysisFindings,
  "delegation-coordinator": delegationFindings,
  "document-renewal-tracker": documentRenewalFindings,
  "document-intake-analyst": documentIntakeFindings,
  "financial-analyst": financialAnalysisFindings,
  "feed-intelligence-monitor": feedIntelligenceDeltaLedgerFindings,
  "freelance-client-pipeline": freelancePipelineFindings,
  "fundraising-campaign-manager": fundraisingCampaignFindings,
  "fantasy-sports-manager": fantasySportsFindings,
  "games-backlog-manager": gamesBacklogFindings,
  "gift-relationship-manager": giftRelationshipFindings,
  "green-thumb-coordinator": greenThumbFindings,
  "health-records-binder": healthRecordsFindings,
  "home-repair-coordinator": homeRepairFindings,
  "household-budget-steward": householdBudgetFindings,
  "home-inventory-binder": homeInventoryFindings,
  "household-steward": householdStewardFindings,
  "insurance-policy-organizer": insurancePolicyFindings,
  "invoice-payment-followup": invoiceReceivablesFindings,
  "job-application-tracker": jobApplicationFindings,
  "life-timeline-keeper": lifeTimelineFindings,
  "local-events-watcher": localEventsFindings,
  "meal-grocery-planner": mealGroceryFindings,
  "media-evidence-reviewer": mediaEvidenceFindings,
  "medical-appointment-prep": medicalAppointmentFindings,
  "model-evaluation-adjudicator": modelEvaluationFindings,
  "moving-checklist-coordinator": movingPlanFindings,
  "movie-streaming-organizer": movieStreamingFindings,
  "music-organizer": musicOrganizerFindings,
  "neighborhood-operations-watcher": neighborhoodOperationsFindings,
  "personal-archive-curator": personalArchiveFindings,
  "pet-care-coordinator": petCareFindings,
  "pond-water-feature-coordinator": pondWaterFeatureFindings,
  "professional-networking-followup": professionalNetworkingFindings,
  "public-company-watcher": companyDisclosureLedgerFindings,
  "research-monitor": topicWatchDeltaLedgerFindings,
  "research-scout": researchEvidenceDeltaFindings,
  "resume-portfolio-curator": resumePortfolioFindings,
  "project-manager": projectFindings,
  "product-manager": productFindings,
  "purchase-researcher": purchaseResearchFindings,
  "public-safety-monitor": publicSafetyFindings,
  "recruiting-coordinator": recruitingFindings,
  "restaurant-venue-scout": restaurantVenueFindings,
  "research-briefing": researchFindings,
  "sales-operations": salesOperationsFindings,
  "school-coordinator": schoolCoordinatorFindings,
  "sports-team-watcher": sportsTeamWatchFindings,
  "spreadsheet-analyst": spreadsheetChangeFindings,
  "stock-portfolio-monitor": stockPortfolioFindings,
  "subscription-manager": subscriptionManagerFindings,
  "tax-document-organizer": taxDocumentFindings,
  "travel-concierge": travelShortlistFindings,
  "travel-planner": itineraryPlanFindings,
  "travel-loyalty-points-organizer": travelLoyaltyFindings,
  "vehicle-service-coordinator": vehicleServiceFindings,
  "wardrobe-organizer": wardrobeFindings,
  "web-evidence-researcher": claimEvidenceInvestigationLedgerFindings,
  "warranty-returns-manager": warrantyReturnsFindings,
  "work-chief-of-staff": workChiefOfStaffFindings,
};

export function hasArtifactSemanticValidator(id) {
  return Object.hasOwn(validators, id);
}

export function validateArtifactSemantics(id, value) {
  const validate = validators[id];
  if (!validate) {
    throw new Error(`No semantic artifact validator is registered for ${id}.`);
  }
  return validate(value);
}
