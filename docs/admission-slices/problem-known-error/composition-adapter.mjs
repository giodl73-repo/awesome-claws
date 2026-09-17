import { createHash } from "node:crypto";

export const COMPOSITION_SCHEMA_VERSION =
  "awesomeClaws.problemKnownErrorCompositionProbe.v1";

export const OWNER_CONTRACTS = Object.freeze({
  "incident-response": Object.freeze({
    artifactDigest:
      "sha256:5d0c28db08a2916ffd749988c4201c78d84df38e802567d1920a591e067a34d4",
    schemaDigest:
      "sha256:9b2e757855bde911fceaf4f294a8c1ecdbda82c37c7632992e4a309fbd72f3da",
  }),
  "quality-assurance-lead": Object.freeze({
    artifactDigest:
      "sha256:b9ef69917e16d3ff13c241ca4cedb6212239cf175805c5885d379dfa2bca71a1",
    schemaDigest:
      "sha256:f5eea136d8ec5a9e071d6afb4a206c1166021a20cbb9bb506d4a6ab68256afd5",
  }),
  "change-control-operator": Object.freeze({
    artifactDigest:
      "sha256:99d5ce538300782ddd0b134e0c8dd9f2a4200c685476180b40cb33f9cb4b23f5",
    schemaDigest:
      "sha256:de7279299a2545b37dc321c17d4afe8aed10d733e0643eb07e6390656cf14164",
  }),
  "repository-compliance-program-manager": Object.freeze({
    artifactDigest:
      "sha256:3f5868c2ec01b10eaadda9c51deeff8aef2c215520b85435c4a2af069604a824",
    schemaDigest:
      "sha256:696b283fc4bd912cc3f70941102ff9a2570f08b5c2d784a04b951309fc6c175c",
  }),
  "case-continuity-coordinator": Object.freeze({
    artifactDigest:
      "sha256:448bdfce7d6605331f68e389662ca3d5c1d10572df1e94800e5d722b07efef73",
    schemaDigest:
      "sha256:c1eb950921665cbe0a1692f3a559341396636e276268bdd42bf04abdefb306f7",
  }),
});

const REQUIRED_NATIVE_INVARIANTS = Object.freeze([
  Object.freeze({
    id: "owner-signed-cross-incident-manifest",
    ownerContracts: Object.freeze([
      "incident-response",
      "case-continuity-coordinator",
    ]),
    reason:
      "Incident Response owns one incident and one follow-up identity per artifact, but no owner contract signs one revision over the complete cross-incident membership universe.",
  }),
  Object.freeze({
    id: "hypothesis-proposal-disposition-lineage",
    ownerContracts: Object.freeze([
      "incident-response",
      "quality-assurance-lead",
    ]),
    reason:
      "Incident hypotheses and QA runs do not natively bind a test to an immutable problem-level proposal revision and then bind the resulting disposition revision.",
  }),
  Object.freeze({
    id: "known-error-workaround-lineage",
    ownerContracts: Object.freeze([
      "incident-response",
      "case-continuity-coordinator",
    ]),
    reason:
      "No owner contract has a typed known-error revision that jointly binds the declared cause disposition and the current expiring workaround revision.",
  }),
  Object.freeze({
    id: "post-change-recurrence-lineage",
    ownerContracts: Object.freeze([
      "incident-response",
      "change-control-operator",
    ]),
    reason:
      "The owner contracts do not join a later incident membership revision to the exact externally executed change receipt revision.",
  }),
  Object.freeze({
    id: "closed-problem-lifecycle-coverage",
    ownerContracts: Object.freeze([
      "repository-compliance-program-manager",
      "case-continuity-coordinator",
    ]),
    reason:
      "Repository Compliance has exact domain coverage, but its schema cannot enumerate the problem-specific lifecycle revision universe.",
  }),
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(message) {
  throw new Error(message);
}

function exactKeys(value, expected) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return (
    actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index])
  );
}

export function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function digest(value) {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

function replaceStrings(value, replacements) {
  if (typeof value === "string") {
    return replacements.reduce(
      (text, [search, replacement]) => text.replaceAll(search, replacement),
      value,
    );
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceStrings(item, replacements));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        replaceStrings(child, replacements),
      ]),
    );
  }
  return value;
}

function sorted(values) {
  return [...values].sort();
}

export function deriveIncidentArtifact(baseArtifact, membership) {
  const originalIncidentRef = baseArtifact.incident.id;
  const originalFollowUpRef = baseArtifact.followUps[0].id;
  const artifact = replaceStrings(baseArtifact, [
    [originalIncidentRef, membership.incidentRef],
    [originalIncidentRef.toLowerCase(), membership.incidentRef.toLowerCase()],
    [originalFollowUpRef, membership.followUpRef],
  ]);
  const actionRevision = (action) =>
    digest({
      incidentRef: action.incidentRef,
      serviceRef: action.serviceRef,
      kind: action.kind,
      summary: action.summary,
      target: action.target,
      timing: action.timing,
      verificationCriteria: action.verificationCriteria,
      rollbackCondition: action.rollbackCondition,
      proposedById: action.proposedById,
      ownerId: action.ownerId,
    });
  const communicationRevision = (communication) =>
    digest({
      incidentRef: communication.incidentRef,
      audience: communication.audience,
      channel: communication.channel,
      timing: communication.timing,
      authorId: communication.authorId,
      ownerId: communication.ownerId,
      messageRef: communication.messageRef,
    });
  artifact.updateCadence.revision = digest({
    id: artifact.updateCadence.id,
    incidentRef: artifact.updateCadence.incidentRef,
    managedById: artifact.updateCadence.managedById,
    intervalMinutes: artifact.updateCadence.intervalMinutes,
    anchorAt: artifact.updateCadence.anchorAt,
    updateIdPrefix: artifact.updateCadence.updateIdPrefix,
    requiredSections: sorted(artifact.updateCadence.requiredSections),
  });
  for (const action of artifact.actions) {
    action.revision = actionRevision(action);
  }
  for (const communication of artifact.communications) {
    communication.revision = communicationRevision(communication);
  }
  artifact.serviceRecovery.revision = digest({
    id: artifact.serviceRecovery.id,
    state: artifact.serviceRecovery.state,
    technicalDriId: artifact.serviceRecovery.technicalDriId,
    timelineSnapshotRef: artifact.serviceRecovery.timelineSnapshotRef,
    recoveryCheckRefs: sorted(artifact.serviceRecovery.recoveryCheckRefs),
    evaluatedAt: artifact.serviceRecovery.evaluatedAt,
  });
  artifact.incidentRecoveryRecommendation.revision = digest({
    id: artifact.incidentRecoveryRecommendation.id,
    state: artifact.incidentRecoveryRecommendation.state,
    serviceRecoveryRef:
      artifact.incidentRecoveryRecommendation.serviceRecoveryRef,
    technicalDriId: artifact.incidentRecoveryRecommendation.technicalDriId,
    incidentManagerId:
      artifact.incidentRecoveryRecommendation.incidentManagerId,
    recommendedAt: artifact.incidentRecoveryRecommendation.recommendedAt,
    rationale: artifact.incidentRecoveryRecommendation.rationale,
  });
  artifact.closure.revision = digest({
    id: artifact.closure.id,
    incidentRef: artifact.closure.incidentRef,
    incidentRecoveryRecommendationRef:
      artifact.closure.incidentRecoveryRecommendationRef,
    state: artifact.closure.state,
    incidentManagerId: artifact.closure.incidentManagerId,
    authorityOwnerId: artifact.closure.authorityOwnerId,
    closedAt: artifact.closure.closedAt,
  });
  for (const decision of artifact.decisions) {
    if (decision.decisionType === "severity-state") {
      decision.subjectRevision = artifact.incident.timelineSnapshotRef;
    } else if (decision.decisionType === "cadence") {
      decision.subjectRevision = artifact.updateCadence.revision;
    } else if (decision.decisionType === "action-approval") {
      decision.subjectRevision = artifact.actions.find(
        (row) => row.id === decision.subjectRef,
      )?.revision;
    } else if (decision.decisionType === "communication-approval") {
      decision.subjectRevision = artifact.communications.find(
        (row) => row.id === decision.subjectRef,
      )?.revision;
    } else if (
      decision.decisionType === "incident-recovery-recommendation"
    ) {
      decision.subjectRevision =
        artifact.incidentRecoveryRecommendation.revision;
    } else if (decision.decisionType === "owner-closure") {
      decision.subjectRevision = artifact.closure.revision;
    }
  }
  const followUp = artifact.followUps[0];
  followUp.identityKey = digest({
    incidentRef: followUp.incidentRef,
    originatingEvidenceRefs: sorted(followUp.originatingEvidenceRefs),
    originatingDecisionRefs: sorted(followUp.originatingDecisionRefs),
    originatingActionRefs: sorted(followUp.originatingActionRefs),
    assetRefs: sorted(followUp.assetRefs),
    serviceRefs: sorted(followUp.serviceRefs),
    controlRefs: sorted(followUp.controlRefs),
  });
  artifact.complianceHandoffs[0].deduplicationKey = followUp.identityKey;
  artifact.complianceHandoffs[0].followUpRef = followUp.id;
  return artifact;
}

function collectSurface(value, predicate, path = "$", rows = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectSurface(item, predicate, `${path}[${index}]`, rows),
    );
    return rows;
  }
  if (!isRecord(value)) return rows;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (predicate(key)) {
      rows.push({ path: childPath, value: structuredClone(child) });
    }
    collectSurface(child, predicate, childPath, rows);
  }
  return rows;
}

function ownerAnchor(id, artifact) {
  if (id === "incident-response") {
    const followUp = artifact.followUps?.[0];
    return {
      identity: {
        incidentRef: artifact.incident?.id,
        timelineSnapshotRef: artifact.incident?.timelineSnapshotRef,
        followUp: {
          id: followUp?.id,
          identityKey: followUp?.identityKey,
          incidentRef: followUp?.incidentRef,
        },
      },
      revision: collectSurface(artifact, (key) =>
        /(?:revision|digest|identityKey)/iu.test(key),
      ),
      chronology: collectSurface(artifact, (key) =>
        /(?:At|Through)$/u.test(key),
      ),
      coverage: {
        originatingEvidenceRefs: followUp?.originatingEvidenceRefs,
        originatingDecisionRefs: followUp?.originatingDecisionRefs,
        originatingActionRefs: followUp?.originatingActionRefs,
      },
      authority: {
        authority: artifact.authority,
        prohibitedActions: artifact.handoff?.prohibitedActions,
      },
    };
  }
  if (id === "quality-assurance-lead") {
    return {
      identity: {
        release: artifact.release?.id,
        testRuns: artifact.testRuns?.map((row) => row.id),
      },
      revision: {
        buildId: artifact.release?.buildId,
        evidenceRefs: artifact.testRuns?.map((row) => row.evidenceRef),
      },
      chronology: artifact.testRuns?.map((row) => ({
        id: row.id,
        executedAt: row.executedAt,
      })),
      coverage: {
        requirementRefs: artifact.requirements?.map((row) => row.id),
        testCaseRefs: artifact.testCases?.map((row) => row.id),
        testRunRefs: artifact.testRuns?.map((row) => row.id),
      },
      authority: {
        ownerId: artifact.ownerId,
        principals: artifact.principals,
        prohibitedActions: artifact.handoff?.prohibitedActions,
      },
    };
  }
  if (id === "change-control-operator") {
    return {
      identity: {
        planRef: artifact.plan?.id,
        targets: artifact.plan?.targets,
      },
      revision: {
        planDigest: artifact.plan?.digest,
        decisionPlanDigest: artifact.decision?.planDigest,
        executionPlanDigest: artifact.execution?.planDigest,
      },
      chronology: {
        generatedAt: artifact.plan?.generatedAt,
        decidedAt: artifact.decision?.decidedAt,
      },
      coverage: {
        stepRefs: artifact.plan?.steps?.map((row) => row.id),
        resultRefs: artifact.execution?.stepResults?.map((row) => row.stepRef),
      },
      authority: {
        decision: artifact.decision,
        executionState: artifact.execution?.state,
      },
    };
  }
  if (id === "repository-compliance-program-manager") {
    return {
      identity: {
        artifactId: artifact.artifactId,
        checkpointRef: artifact.run?.currentCheckpointRef,
        predecessorCheckpointRef: artifact.run?.predecessorCheckpointRef,
      },
      revision: {
        checkpointDigest: artifact.run?.currentCheckpointDigest,
        sourceSnapshotRoots: artifact.run?.sourceSnapshotRoots,
      },
      chronology: {
        asOf: artifact.run?.asOf,
        predecessorCreatedAt: artifact.predecessor?.createdAt,
      },
      coverage: artifact.coverage,
      authority: {
        principals: artifact.principals,
        authority: artifact.authority,
        handoff: artifact.handoff,
      },
    };
  }
  if (id === "case-continuity-coordinator") {
    return {
      identity: {
        caseRef: artifact.case?.id,
        checkpointRefs: artifact.checkpoints?.map((row) => row.id),
      },
      revision: artifact.checkpoints?.map((row) => ({
        id: row.id,
        version: row.version,
        previousRef: row.previousRef,
      })),
      chronology: artifact.checkpoints?.map((row) => ({
        id: row.id,
        recordedAt: row.recordedAt,
      })),
      coverage: artifact.checkpoints?.map((row) => ({
        id: row.id,
        evidenceRefs: row.evidenceRefs,
      })),
      authority: {
        decision: artifact.decision,
        resume: artifact.resume,
      },
    };
  }
  fail(`Unknown owner contract ${id}.`);
}

function verifiedSources(sources) {
  if (!exactKeys(sources, Object.keys(OWNER_CONTRACTS))) {
    fail("Composition requires exactly the five declared owner artifacts.");
  }
  const bindings = {};
  for (const [id, expected] of Object.entries(OWNER_CONTRACTS)) {
    const source = sources[id];
    if (!exactKeys(source, ["artifact", "schema"])) {
      fail(`Owner source ${id} must contain only artifact and schema.`);
    }
    const artifactDigest = digest(source.artifact);
    const schemaDigest = digest(source.schema);
    if (
      artifactDigest !== expected.artifactDigest ||
      schemaDigest !== expected.schemaDigest
    ) {
      fail(`Owner source ${id} drifted from its complete pinned contract.`);
    }
    bindings[id] = {
      artifactDigest,
      schemaDigest,
      anchor: ownerAnchor(id, source.artifact),
    };
  }
  return bindings;
}

function operationalInvariantComparisons(
  sources,
  proposal,
  incidentVariants,
) {
  const incident = sources["incident-response"].artifact;
  const qa = sources["quality-assurance-lead"].artifact;
  const change = sources["change-control-operator"].artifact;
  const compliance =
    sources["repository-compliance-program-manager"].artifact;
  const continuity = sources["case-continuity-coordinator"].artifact;
  const incidentHypotheses = incidentVariants.flatMap(
    (variant) => variant.artifact.hypotheses ?? [],
  );
  const incidentFollowUps = incidentVariants.map(
    (variant) => variant.artifact.followUps[0],
  );
  const qaRun = qa.testRuns?.[0];
  const proposalMemberships = Array.isArray(proposal.incidentMemberships)
    ? proposal.incidentMemberships
    : [];
  const matchingMemberships = proposalMemberships.filter((membership) => {
    const variant = incidentVariants.find(
      (candidate) => candidate.membershipRef === membership.id,
    );
    const followUp = variant?.artifact.followUps[0];
    return (
      membership.incidentRef === variant?.artifact.incident.id &&
      membership.followUpRef === followUp?.id &&
      membership.followUpIdentityKey === followUp?.identityKey
    );
  });
  const proposalHypotheses = Array.isArray(proposal.hypotheses)
    ? proposal.hypotheses
    : [];
  const matchingHypotheses = proposalHypotheses.filter((hypothesis) =>
    incidentHypotheses.some(
      (ownerHypothesis) =>
        hypothesis.id === ownerHypothesis.id &&
        hypothesis.state === ownerHypothesis.state &&
        hypothesis.ownerRef === ownerHypothesis.ownerId,
    ),
  );
  const proposalTests = Array.isArray(proposal.tests) ? proposal.tests : [];
  const matchingTests = proposalTests.filter((candidateTest) =>
    qa.testRuns?.some(
      (run) =>
        run.id === candidateTest.testRunRef &&
        run.buildId === candidateTest.buildId &&
        run.environment === candidateTest.environment &&
        run.executedAt === candidateTest.executedAt &&
        run.executedById === candidateTest.executedByRef &&
        (run.result === "passed" ? "supports" : "refutes") ===
          candidateTest.outcome,
    ),
  );
  const proposalChange = Array.isArray(proposal.changeReceipts)
    ? proposal.changeReceipts[0]
    : undefined;
  const proposalRecurrence = Array.isArray(proposal.recurrences)
    ? proposal.recurrences[0]
    : undefined;
  const recurrenceMembership = proposalMemberships.find(
    (membership) => membership.id === proposalRecurrence?.incidentMembershipRef,
  );

  const checks = {
    "owner-signed-cross-incident-manifest": {
      preserved:
        matchingMemberships.length === proposalMemberships.length &&
        Array.isArray(incident.incidentMemberships) &&
        isRecord(incident.incidentManifest) &&
        Array.isArray(incident.incidentManifest.membershipRevisionRefs) &&
        typeof incident.incidentManifest.signedByRef === "string",
      observedOwnerEvidence: {
        incidents: incidentVariants.map((variant) => ({
          membershipRef: variant.membershipRef,
          artifactDigest: variant.artifactDigest,
          incidentRef: variant.artifact.incident.id,
          followUpRef: variant.artifact.followUps[0].id,
          followUpIdentityKey: variant.artifact.followUps[0].identityKey,
        })),
        continuityCheckpointRefs: continuity.checkpoints?.map((row) => row.id),
      },
      proposalEvidence: {
        membershipCount: proposalMemberships.length,
        unmatchedMemberships: proposalMemberships
          .filter((row) => !matchingMemberships.includes(row))
          .map((row) => ({
            id: row.id,
            incidentRef: row.incidentRef,
            followUpRef: row.followUpRef,
            followUpIdentityKey: row.followUpIdentityKey,
          })),
      },
    },
    "hypothesis-proposal-disposition-lineage": {
      preserved:
        matchingHypotheses.length === proposalHypotheses.length &&
        matchingTests.length === proposalTests.length &&
        incidentHypotheses.length > 0 &&
        incidentHypotheses.every(
          (row) =>
            typeof row.revision === "string" &&
            typeof row.dispositionRevision === "string" &&
            Array.isArray(row.testRevisionRefs),
        ) &&
        typeof qaRun?.hypothesisRevisionRef === "string",
      observedOwnerEvidence: {
        incidentHypotheses: incidentHypotheses.map((row) => ({
          id: row.id,
          state: row.state,
          evidenceRefs: row.evidenceRefs,
          updatedAt: row.updatedAt,
        })),
        qaRun: qaRun
          ? {
              id: qaRun.id,
              testCaseRef: qaRun.testCaseRef,
              evidenceRef: qaRun.evidenceRef,
              executedAt: qaRun.executedAt,
            }
          : null,
      },
      proposalEvidence: {
        matchedTestRefs: matchingTests.map((row) => row.id),
        unmatchedHypothesisRefs: proposalHypotheses
          .filter((row) => !matchingHypotheses.includes(row))
          .map((row) => row.id),
        unmatchedTestRefs: proposalTests
          .filter((row) => !matchingTests.includes(row))
          .map((row) => row.id),
      },
    },
    "known-error-workaround-lineage": {
      preserved:
        Array.isArray(proposal.workarounds) &&
        proposal.workarounds.length > 0 &&
        Array.isArray(proposal.knownErrors) &&
        proposal.knownErrors.length > 0 &&
        Array.isArray(incident.workarounds) &&
        Array.isArray(incident.knownErrors) &&
        incident.knownErrors.some(
          (row) =>
            typeof row.causeHypothesisDispositionRevisionRef === "string" &&
            typeof row.workaroundRevisionRef === "string",
        ),
      observedOwnerEvidence: {
        incidentActionRefs: incident.actions?.map((row) => row.id),
        continuityActionRefs: continuity.actions?.map((row) => row.id),
      },
      proposalEvidence: {
        workaroundRefs: proposal.workarounds?.map((row) => row.id),
        knownErrorRefs: proposal.knownErrors?.map((row) => row.id),
      },
    },
    "post-change-recurrence-lineage": {
      preserved:
        proposalChange?.planDigest === change.plan?.digest &&
        proposalChange?.executedAt === change.execution?.executedAt &&
        incidentFollowUps.some(
          (followUp) =>
            recurrenceMembership?.followUpRef === followUp.id &&
            recurrenceMembership?.followUpIdentityKey ===
              followUp.identityKey,
        ) &&
        typeof change.execution?.executedAt === "string" &&
        Array.isArray(incident.recurrences) &&
        incident.recurrences.some(
          (row) =>
            typeof row.changeReceiptRevisionRef === "string" &&
            typeof row.incidentMembershipRevisionRef === "string",
        ),
      observedOwnerEvidence: {
        changePlanDigest: change.plan?.digest,
        changeExecutionState: change.execution?.state,
        incidentFollowUpRefs: incidentFollowUps.map((row) => row.id),
      },
      proposalEvidence: {
        changeReceiptRef: proposalChange?.id,
        planDigest: proposalChange?.planDigest,
        executedAt: proposalChange?.executedAt,
        recurrenceRef: proposalRecurrence?.id,
        recurrenceMembershipRef: proposalRecurrence?.incidentMembershipRef,
        resolvedMembershipFollowUpRef: recurrenceMembership?.followUpRef,
        resolvedMembershipFollowUpIdentityKey:
          recurrenceMembership?.followUpIdentityKey,
      },
    },
    "closed-problem-lifecycle-coverage": {
      preserved:
        isRecord(proposal.coverage) &&
        Array.isArray(compliance.coverage?.hypothesisDispositionRevisionRefs) &&
        Array.isArray(compliance.coverage?.workaroundRevisionRefs) &&
        Array.isArray(compliance.coverage?.knownErrorRevisionRefs) &&
        Array.isArray(compliance.coverage?.changeReceiptRefs) &&
        Array.isArray(compliance.coverage?.recurrenceRefs),
      observedOwnerEvidence: {
        complianceCoverage: compliance.coverage,
        continuityCheckpointCoverage: continuity.checkpoints?.map((row) => ({
          checkpointRef: row.id,
          evidenceRefs: row.evidenceRefs,
        })),
      },
      proposalEvidence: {
        coverage: proposal.coverage,
      },
    },
  };

  return REQUIRED_NATIVE_INVARIANTS.map((invariant) => ({
    ...structuredClone(invariant),
    ...checks[invariant.id],
  }));
}

export function buildStrongestCompositionProbe(proposal, sources) {
  const sourceBindings = verifiedSources(sources);
  const proposalMemberships = Array.isArray(proposal.incidentMemberships)
    ? proposal.incidentMemberships
    : [];
  const incidentVariants = proposalMemberships.map((membership) => {
    const artifact = deriveIncidentArtifact(
      sources["incident-response"].artifact,
      membership,
    );
    return {
      membershipRef: membership.id,
      artifact,
      artifactDigest: digest(artifact),
    };
  });
  sourceBindings["incident-response"].derivedArtifacts =
    incidentVariants.map(({ membershipRef, artifact, artifactDigest }) => ({
      membershipRef,
      artifactDigest,
      anchor: ownerAnchor("incident-response", artifact),
    }));
  const operationalComparisons = operationalInvariantComparisons(
    sources,
    proposal,
    incidentVariants,
  );
  const lostTypedInvariants = operationalComparisons.filter(
    (comparison) => !comparison.preserved,
  );
  const sourceProjection = Object.fromEntries(
    Object.entries(sourceBindings).map(([id, binding]) => [
      id,
      {
        ...structuredClone(binding.anchor),
        ...(binding.derivedArtifacts
          ? { derivedArtifacts: structuredClone(binding.derivedArtifacts) }
          : {}),
      },
    ]),
  );
  const body = {
    schemaVersion: COMPOSITION_SCHEMA_VERSION,
    sourceBindings,
    sourceProjection,
    sourceProjectionDigest: digest(sourceProjection),
    proposalDigest: digest(proposal),
    operationalComparisons,
    lostTypedInvariants,
    authorityMode: "owner-artifacts-remain-authoritative",
  };
  return {
    ...body,
    probeDigest: digest(body),
  };
}

export function roundTripOwnerProjection(probe, sources) {
  const { probeDigest, ...body } = probe;
  if (
    probe.schemaVersion !== COMPOSITION_SCHEMA_VERSION ||
    probe.authorityMode !== "owner-artifacts-remain-authoritative" ||
    probeDigest !== digest(body)
  ) {
    fail("Composition probe digest or authority mode drifted.");
  }
  const currentBindings = verifiedSources(sources);
  const expectedIncidentVariants =
    probe.sourceBindings["incident-response"].derivedArtifacts ?? [];
  currentBindings["incident-response"].derivedArtifacts =
    expectedIncidentVariants.map((entry) => {
      const artifact = deriveIncidentArtifact(
        sources["incident-response"].artifact,
        {
          incidentRef: entry.anchor.identity.incidentRef,
          followUpRef: entry.anchor.identity.followUp.id,
        },
      );
      return {
        membershipRef: entry.membershipRef,
        artifactDigest: digest(artifact),
        anchor: ownerAnchor("incident-response", artifact),
      };
    });
  if (canonicalJson(currentBindings) !== canonicalJson(probe.sourceBindings)) {
    fail("Composition source bindings drifted.");
  }
  const projection = Object.fromEntries(
    Object.entries(currentBindings).map(([id, binding]) => [
      id,
      {
        ...structuredClone(binding.anchor),
        ...(binding.derivedArtifacts
          ? { derivedArtifacts: structuredClone(binding.derivedArtifacts) }
          : {}),
      },
    ]),
  );
  if (digest(projection) !== probe.sourceProjectionDigest) {
    fail("Composition identity, revision, chronology, coverage, or authority drifted.");
  }
  return projection;
}

export function requireLosslessProposalComposition(probe) {
  if (probe.lostTypedInvariants.length > 0) {
    const ids = probe.lostTypedInvariants.map((row) => row.id).join(", ");
    fail(`Composition loses typed invariants: ${ids}.`);
  }
}
