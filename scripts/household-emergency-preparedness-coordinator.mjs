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
  return (
    a.length === b.length &&
    new Set(a).size === a.length &&
    a.every((id) => b.includes(id))
  );
}

function exactInstant(value) {
  if (
    typeof value !== "string" ||
    !/(?:Z|[+-]\d{2}:\d{2})$/u.test(value)
  ) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function requireRef(index, ref, path, code, findings) {
  const target = index.get(ref);
  if (!target) {
    findings.push(finding(code, path, `Unknown reference ${String(ref)}.`));
  }
  return target;
}

function checkUniqueIds(collections, findings) {
  const seen = new Set();
  for (const [name, collection] of Object.entries(collections)) {
    for (const [position, row] of rows(collection).entries()) {
      if (!isRecord(row) || typeof row.id !== "string") continue;
      if (seen.has(row.id)) {
        findings.push(
          finding(
            "duplicate_identity",
            `${name}/${position}/id`,
            `Duplicate id ${row.id}.`,
          ),
        );
      }
      seen.add(row.id);
    }
  }
}

function refs(index, values, path, code, findings) {
  for (const ref of rows(values)) {
    requireRef(index, ref, path, code, findings);
  }
}

export function householdEmergencyPreparednessFindings(value) {
  const findings = [];
  if (!isRecord(value)) {
    return [
      finding(
        "invalid_preparedness_plan",
        "",
        "Household preparedness plan must be an object.",
      ),
    ];
  }

  const plan = isRecord(value.plan) ? value.plan : {};
  const review = isRecord(value.review) ? value.review : {};
  const prohibited = isRecord(value.prohibitedActions)
    ? value.prohibitedActions
    : {};
  const sources = indexById(value.sources);
  const locations = indexById(value.locations);
  const hazards = indexById(value.hazards);
  const participants = indexById(value.participants);
  const needs = indexById(value.needs);
  const dependencies = indexById(value.dependencies);
  const options = indexById(value.options);
  const steps = indexById(value.steps);
  const supplies = indexById(value.supplies);
  const drills = indexById(value.drills);
  const drillFindings = indexById(value.findings);
  const correctiveActions = indexById(value.correctiveActions);

  if (
    value.schemaVersion !==
    "awesomeClaws.householdEmergencyPreparedness.v1"
  ) {
    findings.push(
      finding(
        "invalid_schema_version",
        "schemaVersion",
        "Unexpected household preparedness schema version.",
      ),
    );
  }

  checkUniqueIds(
    {
      plans: [plan],
      sources: value.sources,
      locations: value.locations,
      hazards: value.hazards,
      participants: value.participants,
      needs: value.needs,
      dependencies: value.dependencies,
      options: value.options,
      steps: value.steps,
      supplies: value.supplies,
      drills: value.drills,
      findings: value.findings,
      correctiveActions: value.correctiveActions,
    },
    findings,
  );

  const exactPlanIndexes = [
    ["locationRefs", locations],
    ["hazardRefs", hazards],
    ["participantRefs", participants],
    ["dependencyRefs", dependencies],
    ["optionRefs", options],
    ["supplyRefs", supplies],
    ["drillRefs", drills],
  ];
  for (const [field, index] of exactPlanIndexes) {
    if (!sameSet(plan[field], [...index.keys()])) {
      findings.push(
        finding(
          "incomplete_plan_index",
          `plan/${field}`,
          `${field} must exactly cover its plan collection.`,
        ),
      );
    }
  }

  const asOf = exactInstant(plan.asOf);
  if (asOf === null || review.asOf !== plan.asOf) {
    findings.push(
      finding(
        "invalid_review_boundary",
        "review/asOf",
        "Review time must equal the exact zone-bearing plan as-of time.",
      ),
    );
  }
  if (review.nextRevision !== plan.revision + 1) {
    findings.push(
      finding(
        "invalid_revision_lineage",
        "review/nextRevision",
        "The next revision must increment the plan revision by one.",
      ),
    );
  }
  if (plan.revision === 1 ? plan.previousRevisionRef !== null : plan.previousRevisionRef === null) {
    findings.push(
      finding(
        "invalid_revision_lineage",
        "plan/previousRevisionRef",
        "Only revision one may omit its predecessor reference.",
      ),
    );
  }
  if (review.nextOwner !== plan.owner) {
    findings.push(
      finding(
        "invalid_next_owner",
        "review/nextOwner",
        "Preparedness review must return to the accountable household owner.",
      ),
    );
  }

  const ownerSourceKinds = new Set([
    "owner-record",
    "inventory-record",
    "drill-observation",
  ]);
  const officialSourceKinds = new Set([
    "official-hazard-guidance",
    "evacuation-zone-map",
    "shelter-guidance",
    "building-plan",
    "school-plan",
    "utility-guidance",
    "alert-enrollment-reference",
    "professional-guidance",
  ]);
  for (const [id, source] of sources) {
    const retrievedAt = exactInstant(source.retrievedAt);
    const expiresAt =
      source.expiresAt === null ? null : exactInstant(source.expiresAt);
    if (retrievedAt === null || asOf === null || retrievedAt > asOf) {
      findings.push(
        finding(
          "invalid_source_chronology",
          `sources/${id}/retrievedAt`,
          "Source retrieval must be exact and no later than the plan as-of time.",
        ),
      );
    }
    if (source.expiresAt !== null && expiresAt === null) {
      findings.push(
        finding(
          "invalid_source_chronology",
          `sources/${id}/expiresAt`,
          "Source expiry must be an exact zone-bearing instant.",
        ),
      );
    }
    if (source.freshness === "current" && expiresAt !== null && asOf !== null && expiresAt <= asOf) {
      findings.push(
        finding(
          "expired_current_source",
          `sources/${id}/freshness`,
          "An expired source cannot remain current.",
        ),
      );
    }
    if (ownerSourceKinds.has(source.kind) && source.authorityRef !== plan.owner) {
      findings.push(
        finding(
          "invalid_source_authority",
          `sources/${id}/authorityRef`,
          "Owner records, inventory, drills, and action confirmations remain controlled by the plan owner.",
        ),
      );
    } else if (
      source.kind === "helper-acknowledgement" &&
      !String(source.authorityRef).startsWith("helper-")
    ) {
      findings.push(
        finding(
          "invalid_source_authority",
          `sources/${id}/authorityRef`,
          "Helper acknowledgement must identify the acknowledging helper.",
        ),
      );
    } else if (
      source.kind === "action-confirmation" &&
      !/^(?:household|helper)-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(
        String(source.authorityRef),
      )
    ) {
      findings.push(
        finding(
          "invalid_source_authority",
          `sources/${id}/authorityRef`,
          "Action confirmation must identify the household or helper owner who performed the action.",
        ),
      );
    } else if (
      officialSourceKinds.has(source.kind) &&
      !String(source.authorityRef).startsWith("authority-")
    ) {
      findings.push(
        finding(
          "invalid_source_authority",
          `sources/${id}/authorityRef`,
          "Official guidance must identify its issuing authority.",
        ),
      );
    }
  }

  for (const [id, location] of locations) {
    refs(sources, location.sourceRefs, `locations/${id}/sourceRefs`, "unknown_source", findings);
    refs(hazards, location.hazardRefs, `locations/${id}/hazardRefs`, "unknown_hazard", findings);
    refs(options, location.optionRefs, `locations/${id}/optionRefs`, "unknown_option", findings);
    const boundHazards = [...hazards.values()]
      .filter((row) => rows(row.locationRefs).includes(id))
      .map((row) => row.id);
    const boundOptions = [...options.values()]
      .filter((row) => rows(row.locationRefs).includes(id))
      .map((row) => row.id);
    if (!sameSet(location.hazardRefs, boundHazards)) {
      findings.push(finding("incomplete_location_index", `locations/${id}/hazardRefs`, "Location hazards must be reciprocal and complete."));
    }
    if (!sameSet(location.optionRefs, boundOptions)) {
      findings.push(finding("incomplete_location_index", `locations/${id}/optionRefs`, "Location options must be reciprocal and complete."));
    }
  }

  const permittedHazardSourceKinds = new Set([
    "official-hazard-guidance",
    "evacuation-zone-map",
    "shelter-guidance",
    "utility-guidance",
    "professional-guidance",
  ]);
  for (const [id, hazard] of hazards) {
    refs(locations, hazard.locationRefs, `hazards/${id}/locationRefs`, "unknown_location", findings);
    refs(options, hazard.optionRefs, `hazards/${id}/optionRefs`, "unknown_option", findings);
    for (const ref of rows(hazard.officialSourceRefs)) {
      const source = requireRef(sources, ref, `hazards/${id}/officialSourceRefs`, "unknown_source", findings);
      if (source && (!permittedHazardSourceKinds.has(source.kind) || !String(source.authorityRef).startsWith("authority-"))) {
        findings.push(finding("invalid_hazard_authority", `hazards/${id}/officialSourceRefs`, "Hazards must bind guidance issued by an official or professional authority."));
      }
      if (hazard.guidanceState === "current" && source?.freshness !== "current") {
        findings.push(finding("invalid_hazard_freshness", `hazards/${id}/guidanceState`, "Current hazard guidance may use only current official sources."));
      }
    }
    const boundOptions = [...options.values()]
      .filter((row) => rows(row.hazardRefs).includes(id))
      .map((row) => row.id);
    if (!sameSet(hazard.optionRefs, boundOptions)) {
      findings.push(finding("incomplete_hazard_index", `hazards/${id}/optionRefs`, "Hazard options must be reciprocal and complete."));
    }
    if (hazard.liveTriggerClaim !== "not-claimed") {
      findings.push(finding("live_authority_claim", `hazards/${id}/liveTriggerClaim`, "Preparedness hazards cannot define or interpret a live trigger."));
    }
  }

  for (const [id, participant] of participants) {
    refs(sources, participant.sourceRefs, `participants/${id}/sourceRefs`, "unknown_source", findings);
    refs(needs, participant.needRefs, `participants/${id}/needRefs`, "unknown_need", findings);
    refs(options, participant.optionRefs, `participants/${id}/optionRefs`, "unknown_option", findings);
    const boundNeeds = [...needs.values()].filter((row) => row.participantRef === id).map((row) => row.id);
    const boundOptions = [...options.values()].filter((row) => rows(row.participantRefs).includes(id)).map((row) => row.id);
    if (!sameSet(participant.needRefs, boundNeeds)) {
      findings.push(finding("incomplete_participant_index", `participants/${id}/needRefs`, "Participant needs must be reciprocal and complete."));
    }
    if (!sameSet(participant.optionRefs, boundOptions)) {
      findings.push(finding("incomplete_participant_index", `participants/${id}/optionRefs`, "Participant options must be reciprocal and complete."));
    }
    if (!boundOptions.some((ref) => options.get(ref)?.status === "owner-approved")) {
      findings.push(finding("uncovered_participant", `participants/${id}/optionRefs`, "Every participant needs at least one owner-approved preparedness option."));
    }
  }

  for (const [id, need] of needs) {
    const participant = requireRef(participants, need.participantRef, `needs/${id}/participantRef`, "unknown_participant", findings);
    refs(sources, need.sourceRefs, `needs/${id}/sourceRefs`, "unknown_source", findings);
    refs(options, need.optionRefs, `needs/${id}/optionRefs`, "unknown_option", findings);
    for (const ref of rows(need.optionRefs)) {
      const option = options.get(ref);
      if (option && (!rows(option.needRefs).includes(id) || !rows(option.participantRefs).includes(need.participantRef))) {
        findings.push(finding("cross_participant_need", `needs/${id}/optionRefs`, "Need coverage must be reciprocal and keep its participant on the option."));
      }
    }
    if (participant && !rows(participant.needRefs).includes(id)) {
      findings.push(finding("orphan_need", `needs/${id}`, "Every need must be indexed by its participant."));
    }
    const approved = rows(need.optionRefs).some((ref) => options.get(ref)?.status === "owner-approved");
    if (need.state === "covered" ? !approved : need.state === "gap" && approved) {
      findings.push(finding("invalid_need_coverage", `needs/${id}/state`, "Covered needs require an owner-approved option; gaps cannot claim one."));
    }
    if (need.state === "not-applicable" && rows(need.optionRefs).length > 0) {
      findings.push(finding("invalid_need_coverage", `needs/${id}/optionRefs`, "Not-applicable needs cannot retain plan options."));
    }
  }

  for (const [id, dependency] of dependencies) {
    refs(sources, dependency.sourceRefs, `dependencies/${id}/sourceRefs`, "unknown_source", findings);
    refs(options, dependency.optionRefs, `dependencies/${id}/optionRefs`, "unknown_option", findings);
    const bound = [...options.values()].filter((row) => rows(row.dependencyRefs).includes(id)).map((row) => row.id);
    if (!sameSet(dependency.optionRefs, bound)) {
      findings.push(finding("incomplete_dependency_index", `dependencies/${id}/optionRefs`, "Dependency options must be reciprocal and complete."));
    }
    if (dependency.kind === "helper" && !String(dependency.owner).startsWith("helper-")) {
      findings.push(finding("invalid_dependency_owner", `dependencies/${id}/owner`, "Helper dependencies must retain the helper's authority."));
    }
  }

  for (const [id, option] of options) {
    refs(locations, option.locationRefs, `options/${id}/locationRefs`, "unknown_location", findings);
    refs(hazards, option.hazardRefs, `options/${id}/hazardRefs`, "unknown_hazard", findings);
    refs(participants, option.participantRefs, `options/${id}/participantRefs`, "unknown_participant", findings);
    refs(needs, option.needRefs, `options/${id}/needRefs`, "unknown_need", findings);
    refs(dependencies, option.dependencyRefs, `options/${id}/dependencyRefs`, "unknown_dependency", findings);
    refs(sources, option.sourceRefs, `options/${id}/sourceRefs`, "unknown_source", findings);
    refs(steps, option.stepRefs, `options/${id}/stepRefs`, "unknown_step", findings);
    const boundSteps = [...steps.values()].filter((row) => row.optionRef === id).sort((a, b) => a.sequence - b.sequence);
    if (!sameSet(option.stepRefs, boundSteps.map((row) => row.id))) {
      findings.push(finding("incomplete_option_index", `options/${id}/stepRefs`, "Option steps must be reciprocal and complete."));
    }
    if ((option.status === "owner-approved") !== (option.ownerApproved === true)) {
      findings.push(finding("invalid_option_approval", `options/${id}/ownerApproved`, "Only owner-approved options may claim owner approval."));
    }
    if (option.status === "owner-approved" && rows(option.sourceRefs).some((ref) => sources.get(ref)?.freshness !== "current")) {
      findings.push(finding("stale_approved_option", `options/${id}/sourceRefs`, "Owner-approved options may use only current evidence."));
    }
    if (option.status === "owner-approved" && rows(option.dependencyRefs).some((ref) => dependencies.get(ref)?.state !== "acknowledged")) {
      findings.push(finding("unconfirmed_approved_option", `options/${id}/dependencyRefs`, "Owner-approved options require acknowledged dependencies."));
    }
    if (option.liveInstruction !== false) {
      findings.push(finding("live_authority_claim", `options/${id}/liveInstruction`, "A preparedness option cannot become live emergency instruction."));
    }
  }

  for (const [optionId, option] of options) {
    const optionSteps = [...steps.values()].filter((row) => row.optionRef === optionId).sort((a, b) => a.sequence - b.sequence);
    for (const [position, step] of optionSteps.entries()) {
      if (step.sequence !== position + 1) {
        findings.push(finding("invalid_step_sequence", `steps/${step.id}/sequence`, "Each option uses contiguous step sequence numbers."));
      }
      refs(sources, step.sourceRefs, `steps/${step.id}/sourceRefs`, "unknown_source", findings);
      refs(dependencies, step.dependencyRefs, `steps/${step.id}/dependencyRefs`, "unknown_dependency", findings);
      if (rows(step.dependencyRefs).some((ref) => !rows(option.dependencyRefs).includes(ref))) {
        findings.push(finding("cross_option_step_dependency", `steps/${step.id}/dependencyRefs`, "Step dependencies must belong to the same option."));
      }
      const completion = step.completionSourceRef === null ? null : requireRef(sources, step.completionSourceRef, `steps/${step.id}/completionSourceRef`, "unknown_source", findings);
      if (step.state === "owner-completed") {
        if (!completion || completion.kind !== "action-confirmation" || completion.authorityRef !== step.owner) {
          findings.push(finding("invalid_step_completion", `steps/${step.id}/completionSourceRef`, "Completed steps require an owner-controlled action confirmation."));
        }
      } else if (step.completionSourceRef !== null) {
        findings.push(finding("invalid_step_completion", `steps/${step.id}/completionSourceRef`, "Incomplete steps cannot claim completion evidence."));
      }
      if (step.externalActionRequired && step.state === "owner-completed") {
        findings.push(finding("external_action_claim", `steps/${step.id}/state`, "The local preparedness artifact cannot complete an external action."));
      }
    }
  }

  for (const [id, supply] of supplies) {
    refs(participants, supply.participantRefs, `supplies/${id}/participantRefs`, "unknown_participant", findings);
    refs(sources, supply.sourceRefs, `supplies/${id}/sourceRefs`, "unknown_source", findings);
    const expiry = supply.expiresAt === null ? null : exactInstant(supply.expiresAt);
    if (supply.expiresAt !== null && expiry === null) {
      findings.push(finding("invalid_supply_expiry", `supplies/${id}/expiresAt`, "Supply expiry must be an exact zone-bearing instant."));
    }
    if (supply.state === "current" && expiry !== null && asOf !== null && expiry <= asOf) {
      findings.push(finding("invalid_supply_state", `supplies/${id}/state`, "An expired supply cannot remain current."));
    }
    if (supply.state === "expired" && (expiry === null || asOf === null || expiry > asOf)) {
      findings.push(finding("invalid_supply_state", `supplies/${id}/state`, "Expired supplies require an expiry no later than the plan as-of time."));
    }
    if (supply.state === "missing" && supply.expiresAt !== null) {
      findings.push(finding("invalid_supply_state", `supplies/${id}/expiresAt`, "Missing supplies cannot claim an item expiry."));
    }
  }

  for (const [id, drill] of drills) {
    const occurredAt = exactInstant(drill.occurredAt);
    if (occurredAt === null || asOf === null || occurredAt > asOf) {
      findings.push(finding("invalid_drill_chronology", `drills/${id}/occurredAt`, "Drills must occur no later than the plan as-of time."));
    }
    refs(options, drill.optionRefs, `drills/${id}/optionRefs`, "unknown_option", findings);
    refs(participants, drill.participantRefs, `drills/${id}/participantRefs`, "unknown_participant", findings);
    refs(sources, drill.sourceRefs, `drills/${id}/sourceRefs`, "unknown_source", findings);
    refs(drillFindings, drill.findingRefs, `drills/${id}/findingRefs`, "unknown_finding", findings);
    if (!rows(drill.sourceRefs).some((ref) => sources.get(ref)?.kind === "drill-observation" && sources.get(ref)?.authorityRef === plan.owner)) {
      findings.push(finding("invalid_drill_evidence", `drills/${id}/sourceRefs`, "Every drill requires owner-controlled observation evidence."));
    }
    const bound = [...drillFindings.values()].filter((row) => row.drillRef === id).map((row) => row.id);
    if (!sameSet(drill.findingRefs, bound)) {
      findings.push(finding("incomplete_drill_index", `drills/${id}/findingRefs`, "Drill findings must be reciprocal and complete."));
    }
  }

  for (const [id, row] of drillFindings) {
    requireRef(drills, row.drillRef, `findings/${id}/drillRef`, "unknown_drill", findings);
    refs(sources, row.sourceRefs, `findings/${id}/sourceRefs`, "unknown_source", findings);
    refs(correctiveActions, row.correctiveActionRefs, `findings/${id}/correctiveActionRefs`, "unknown_corrective_action", findings);
    const bound = [...correctiveActions.values()].filter((action) => action.findingRef === id).map((action) => action.id);
    if (!sameSet(row.correctiveActionRefs, bound)) {
      findings.push(finding("incomplete_finding_index", `findings/${id}/correctiveActionRefs`, "Finding actions must be reciprocal and complete."));
    }
    const terminal = bound.every((ref) => ["owner-completed", "owner-accepted-gap"].includes(correctiveActions.get(ref)?.state));
    if (row.state === "resolved" && (bound.length === 0 || !terminal)) {
      findings.push(finding("premature_finding_resolution", `findings/${id}/state`, "Resolved findings require at least one terminal corrective action."));
    }
    if (row.state === "open" && terminal) {
      findings.push(finding("stale_open_finding", `findings/${id}/state`, "An open finding cannot have only terminal actions."));
    }
  }

  for (const [id, action] of correctiveActions) {
    const parent = requireRef(drillFindings, action.findingRef, `correctiveActions/${id}/findingRef`, "unknown_finding", findings);
    if (parent && !rows(parent.correctiveActionRefs).includes(id)) {
      findings.push(finding("orphan_corrective_action", `correctiveActions/${id}`, "Every corrective action must be indexed by its finding."));
    }
    refs(sources, action.sourceRefs, `correctiveActions/${id}/sourceRefs`, "unknown_source", findings);
    const dueAt = exactInstant(action.dueAt);
    if (dueAt === null) {
      findings.push(finding("invalid_action_due_date", `correctiveActions/${id}/dueAt`, "Corrective action due time must be exact and zone-bearing."));
    }
    const completion = action.completionSourceRef === null ? null : requireRef(sources, action.completionSourceRef, `correctiveActions/${id}/completionSourceRef`, "unknown_source", findings);
    if (action.state === "owner-completed") {
      if (!completion || completion.kind !== "action-confirmation" || completion.authorityRef !== action.owner) {
        findings.push(finding("invalid_action_completion", `correctiveActions/${id}/completionSourceRef`, "Completed corrections require owner-controlled confirmation."));
      }
    } else if (action.completionSourceRef !== null) {
      findings.push(finding("invalid_action_completion", `correctiveActions/${id}/completionSourceRef`, "Non-completed corrections cannot claim a completion receipt."));
    }
  }

  const expectedReview = [
    ["gapNeedRefs", [...needs.values()].filter((row) => row.state === "gap").map((row) => row.id)],
    ["unconfirmedDependencyRefs", [...dependencies.values()].filter((row) => ["unconfirmed", "unavailable"].includes(row.state)).map((row) => row.id)],
    ["expiredOrMissingSupplyRefs", [...supplies.values()].filter((row) => ["expired", "missing"].includes(row.state)).map((row) => row.id)],
    ["openFindingRefs", [...drillFindings.values()].filter((row) => row.state === "open").map((row) => row.id)],
    ["openCorrectiveActionRefs", [...correctiveActions.values()].filter((row) => ["planned", "blocked"].includes(row.state)).map((row) => row.id)],
  ];
  for (const [field, expected] of expectedReview) {
    if (!sameSet(review[field], expected)) {
      findings.push(finding("incomplete_review_index", `review/${field}`, `${field} must exactly preserve the modeled open state.`));
    }
  }
  const hasBlocker = expectedReview.some(([, expected]) => expected.length > 0) || [...hazards.values()].some((row) => row.guidanceState !== "current");
  if (review.decision === "ready-for-owner-review" && hasBlocker) {
    findings.push(finding("premature_owner_handoff", "review/decision", "Owner-ready review requires current guidance and no modeled gap, unconfirmed dependency, expired or missing supply, open finding, or open action."));
  }

  const usedSources = new Set();
  const sourceRefCollections = [
    ...locations.values(),
    ...participants.values(),
    ...needs.values(),
    ...dependencies.values(),
    ...options.values(),
    ...steps.values(),
    ...supplies.values(),
    ...drills.values(),
    ...drillFindings.values(),
    ...correctiveActions.values(),
  ];
  for (const row of sourceRefCollections) {
    for (const ref of rows(row.sourceRefs)) usedSources.add(ref);
    if (typeof row.completionSourceRef === "string") usedSources.add(row.completionSourceRef);
  }
  for (const hazard of hazards.values()) {
    for (const ref of rows(hazard.officialSourceRefs)) usedSources.add(ref);
  }
  for (const id of sources.keys()) {
    if (!usedSources.has(id)) {
      findings.push(finding("orphan_source", `sources/${id}`, "Every source must support at least one modeled record."));
    }
  }

  for (const [key, claimed] of Object.entries(prohibited)) {
    if (claimed !== false) {
      findings.push(finding("prohibited_authority_claim", `prohibitedActions/${key}`, "Household Emergency Preparedness Coordinator cannot claim live response, external action, professional advice, publication, transmission, or readiness authority."));
    }
  }

  return findings;
}
