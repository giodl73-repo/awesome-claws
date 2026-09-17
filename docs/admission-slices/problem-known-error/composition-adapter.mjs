import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  evaluateTypedCompositionGraph,
  normalizeTypedControlInput,
} from "./typed-composition-graph.mjs";
import {
  artifactSemanticValidationOptions,
  validateArtifactSemantics,
} from "../../../scripts/artifact-semantics.mjs";

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
const ownerValidationCache = new Set();
const schemaValidatorCache = new Map();
const derivedIncidentValidationCache = new Set();

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function records(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
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
    [originalIncidentRef.toLowerCase(), membership.incidentRef.toLowerCase()],
    [originalIncidentRef, membership.incidentRef],
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
    const validationKey = `${id}:${artifactDigest}:${schemaDigest}`;
    if (!ownerValidationCache.has(validationKey)) {
      let validateSchema = schemaValidatorCache.get(schemaDigest);
      if (!validateSchema) {
        const ajv = new Ajv2020({ allErrors: true, strict: true });
        addFormats(ajv);
        validateSchema = ajv.compile(source.schema);
        schemaValidatorCache.set(schemaDigest, validateSchema);
      }
      if (
        !validateSchema(source.artifact) ||
        validateArtifactSemantics(
          id,
          source.artifact,
          artifactSemanticValidationOptions(id),
        ).length > 0
      ) {
        fail(`Owner source ${id} is not schema and semantic valid.`);
      }
      ownerValidationCache.add(validationKey);
    }
    bindings[id] = {
      artifactDigest,
      schemaDigest,
      anchor: ownerAnchor(id, source.artifact),
    };
  }
  return bindings;
}

function graphNode(id, type, identity, revision, authority = {}) {
  const normalizedIdentity = { ...identity, id, type };
  const normalizedAuthority = {
    kind: authority.kind ?? "owner-contract",
    scopes: [...(authority.scopes ?? [])].sort(),
    humanAssurance: authority.humanAssurance ?? null,
  };
  return {
    id,
    type,
    identity: normalizedIdentity,
    identityDigest: digest(normalizedIdentity),
    revision,
    revisionDigest: digest(revision),
    authorityDigest: digest(normalizedAuthority),
    authority: normalizedAuthority,
  };
}

function graphEdge(id, from, to, type, revision, authority = {}) {
  return {
    id,
    from,
    to,
    type,
    identity: { id, from, to, type },
    identityDigest: digest({ id, from, to, type }),
    revision,
    revisionDigest: digest(revision),
    authority,
    authorityDigest: digest(authority),
  };
}

export function buildCandidateUniverse(proposal) {
  const node = (id, type, identity, revision, authority) =>
    graphNode(id, type, identity, revision, authority);
  const all = {
    "incident-manifest": [
      node(
        `candidate:incident-manifest:${proposal.incidentManifest.id}`,
        "incident-manifest",
        {
          recordId: proposal.incidentManifest.id,
        },
        {
          revision: proposal.incidentManifest.revision,
          membershipRevisionRefs:
            proposal.incidentManifest.membershipRevisionRefs,
        },
        {
          kind: "verified-human",
          scopes: ["incident-membership-declarer"],
          humanAssurance: "verified-human",
        },
      ),
    ],
    "incident-membership": records(proposal.incidentMemberships).map((row) =>
      node(
        `candidate:incident-membership:${row.id}`,
        "incident-membership",
        {
          recordId: row.id,
          incidentRef: row.incidentRef,
          followUpRef: row.followUpRef,
          followUpIdentityKey: row.followUpIdentityKey,
        },
        {
          revision: row.revision,
          incidentRevision: row.incidentRevision,
          ownerArtifactDigest: row.ownerArtifactDigest,
        },
        {
          kind: "verified-human",
          scopes: ["incident-membership-declarer"],
          humanAssurance: "verified-human",
        },
      ),
    ),
    "hypothesis-proposal": records(proposal.hypotheses).map((row) =>
      node(
        `candidate:hypothesis-proposal:${row.id}`,
        "hypothesis-proposal",
        { recordId: row.id, problemRevision: row.problemRevision },
        { revision: row.revision, proposedAt: row.proposedAt },
        {
          kind: "verified-human",
          scopes: ["hypothesis-owner"],
          humanAssurance: "verified-human",
        },
      ),
    ),
    "hypothesis-disposition": records(proposal.hypotheses).map((row) =>
      node(
        `candidate:hypothesis-disposition:${row.id}`,
        "hypothesis-disposition",
        { recordId: row.id, proposalRevision: row.revision },
        {
          revision: row.dispositionRevision,
          testRevisionRefs: row.testRevisionRefs,
          revisedAt: row.revisedAt,
        },
        {
          kind: "verified-human",
          scopes: ["hypothesis-owner"],
          humanAssurance: "verified-human",
        },
      ),
    ),
    "test-result": records(proposal.tests).map((row) =>
      node(
        `candidate:test-result:${row.id}`,
        "test-result",
        {
          recordId: row.id,
          hypothesisRef: row.hypothesisRef,
          testRunRef: row.testRunRef,
        },
        {
          revision: row.revision,
          hypothesisRevisionRef: row.hypothesisRevisionRef,
          ownerArtifactDigest: row.ownerArtifactDigest,
          executedAt: row.executedAt,
        },
        {
          kind: "verified-human",
          scopes: ["test-executor"],
          humanAssurance: "verified-human",
        },
      ),
    ),
    workaround: records(proposal.workarounds).map((row) =>
      node(
        `candidate:workaround:${row.id}`,
        "workaround",
        { recordId: row.id, hypothesisRef: row.hypothesisRef },
        {
          revision: row.revision,
          hypothesisDispositionRevisionRef:
            row.hypothesisDispositionRevisionRef,
          approvedAt: row.approvedAt,
          expiresAt: row.expiresAt,
        },
        {
          kind: "verified-human",
          scopes: ["workaround-approver"],
          humanAssurance: "verified-human",
        },
      ),
    ),
    "known-error": records(proposal.knownErrors).map((row) =>
      node(
        `candidate:known-error:${row.id}`,
        "known-error",
        {
          recordId: row.id,
          causeHypothesisRef: row.causeHypothesisRef,
          workaroundRef: row.workaroundRef,
        },
        {
          revision: row.revision,
          causeHypothesisDispositionRevisionRef:
            row.causeHypothesisDispositionRevisionRef,
          workaroundRevisionRef: row.workaroundRevisionRef,
          declaredAt: row.declaredAt,
        },
        {
          kind: "verified-human",
          scopes: ["known-error-authority"],
          humanAssurance: "verified-human",
        },
      ),
    ),
    "change-receipt": records(proposal.changeReceipts).map((row) =>
      node(
        `candidate:change-receipt:${row.id}`,
        "change-receipt",
        { recordId: row.id, changePlanRef: row.changePlanRef },
        {
          revision: row.revision,
          planDigest: row.planDigest,
          ownerArtifactDigest: row.ownerArtifactDigest,
          executedAt: row.executedAt,
          linkedAt: row.linkedAt,
        },
        {
          kind: "verified-human",
          scopes: ["change-executor"],
          humanAssurance: "verified-human",
        },
      ),
    ),
    recurrence: records(proposal.recurrences).map((row) =>
      node(
        `candidate:recurrence:${row.id}`,
        "recurrence",
        {
          recordId: row.id,
          incidentMembershipRef: row.incidentMembershipRef,
          changeReceiptRef: row.changeReceiptRef,
        },
        {
          revision: row.revision,
          incidentMembershipRevisionRef:
            row.incidentMembershipRevisionRef,
          changeReceiptRevisionRef: row.changeReceiptRevisionRef,
          observedAt: row.observedAt,
        },
        {
          kind: "external-system",
          scopes: ["incident-record-authority"],
          humanAssurance: null,
        },
      ),
    ),
    "lifecycle-coverage": [
      node(
        "candidate:lifecycle-coverage",
        "lifecycle-coverage",
        { state: proposal.coverage?.state },
        { coverage: proposal.coverage },
        {
          kind: "verified-human",
          scopes: ["problem-owner"],
          humanAssurance: "verified-human",
        },
      ),
    ],
  };
  const select = (type, ids) =>
    all[type].filter((candidate) =>
      ids.includes(candidate.identity.recordId),
    );
  const knownErrors = records(proposal.knownErrors);
  const recurrences = records(proposal.recurrences);
  const recurrenceMembershipIds = recurrences.map(
    (row) => row.incidentMembershipRef,
  );
  const recurrenceChangeIds = recurrences.map(
    (row) => row.changeReceiptRef,
  );
  return {
    ...all,
    $requirements: {
      "owner-signed-cross-incident-manifest": {
        "incident-manifest": all["incident-manifest"],
        "incident-membership": all["incident-membership"],
      },
      "hypothesis-proposal-disposition-lineage": {
        "hypothesis-proposal": all["hypothesis-proposal"],
        "test-result": all["test-result"],
        "hypothesis-disposition": all["hypothesis-disposition"],
      },
      "known-error-workaround-lineage": {
        "known-error": all["known-error"],
        workaround: select(
          "workaround",
          knownErrors.map((row) => row.workaroundRef),
        ),
        "hypothesis-disposition": select(
          "hypothesis-disposition",
          knownErrors.map((row) => row.causeHypothesisRef),
        ),
      },
      "post-change-recurrence-lineage": {
        recurrence: all.recurrence,
        "change-receipt": select(
          "change-receipt",
          recurrenceChangeIds,
        ),
        "incident-membership": select(
          "incident-membership",
          recurrenceMembershipIds,
        ),
      },
      "closed-problem-lifecycle-coverage": {
        "lifecycle-coverage": all["lifecycle-coverage"],
        "incident-membership": all["incident-membership"],
        "hypothesis-disposition": all["hypothesis-disposition"],
        workaround: all.workaround,
        "known-error": all["known-error"],
        "change-receipt": all["change-receipt"],
        recurrence: all.recurrence,
      },
    },
  };
}

function buildOwnerGraph(sources, incidentVariants) {
  const nodes = [];
  const edges = [];
  for (const variant of incidentVariants) {
    const incidentId = `incident:${variant.membershipRef}`;
    const followUpId = `follow-up:${variant.membershipRef}`;
    nodes.push(
      graphNode(
        incidentId,
        "incident-record",
        {
          incidentRef: variant.artifact.incident.id,
          timelineSnapshotRef: variant.artifact.incident.timelineSnapshotRef,
        },
        { artifactDigest: variant.artifactDigest },
      ),
      graphNode(
        followUpId,
        "incident-follow-up",
        {
          id: variant.artifact.followUps[0].id,
          identityKey: variant.artifact.followUps[0].identityKey,
          incidentRef: variant.artifact.followUps[0].incidentRef,
        },
        { artifactDigest: variant.artifactDigest },
      ),
    );
    edges.push(
      graphEdge(
        `edge:${incidentId}:follow-up`,
        incidentId,
        followUpId,
        "has-follow-up",
        { artifactDigest: variant.artifactDigest },
      ),
    );
  }

  const qa = sources["quality-assurance-lead"].artifact;
  for (const run of qa.testRuns) {
    nodes.push(
      graphNode(
        `qa-run:${run.id}`,
        "qa-run",
        {
          id: run.id,
          testCaseRef: run.testCaseRef,
          evidenceRef: run.evidenceRef,
        },
        {
          ownerArtifactDigest:
            OWNER_CONTRACTS["quality-assurance-lead"].artifactDigest,
          buildId: run.buildId,
          environment: run.environment,
          executedAt: run.executedAt,
          result: run.result,
        },
      ),
    );
  }

  const change = sources["change-control-operator"].artifact;
  nodes.push(
    graphNode(
      `change-plan:${change.plan.id}`,
      "change-plan",
      { id: change.plan.id, targets: change.plan.targets },
      { planDigest: change.plan.digest },
    ),
    graphNode(
      `change-execution:${change.plan.id}`,
      "change-execution",
      { planRef: change.plan.id, state: change.execution.state },
      {
        artifactDigest:
          OWNER_CONTRACTS["change-control-operator"].artifactDigest,
        planDigest: change.execution.planDigest,
      },
    ),
  );
  edges.push(
    graphEdge(
      `edge:change-plan:${change.plan.id}:execution`,
      `change-plan:${change.plan.id}`,
      `change-execution:${change.plan.id}`,
      "owner-executed",
      { planDigest: change.plan.digest },
    ),
  );

  const compliance =
    sources["repository-compliance-program-manager"].artifact;
  nodes.push(
    graphNode(
      `compliance-coverage:${compliance.run.currentCheckpointRef}`,
      "domain-coverage",
      {
        checkpointRef: compliance.run.currentCheckpointRef,
        coverage: compliance.coverage,
      },
      {
        checkpointDigest: compliance.run.currentCheckpointDigest,
        predecessorCheckpointRef: compliance.run.predecessorCheckpointRef,
      },
    ),
  );

  const continuity = sources["case-continuity-coordinator"].artifact;
  for (const checkpoint of continuity.checkpoints) {
    const checkpointId = `continuity:${checkpoint.id}`;
    nodes.push(
      graphNode(
        checkpointId,
        "continuity-checkpoint",
        { id: checkpoint.id, version: checkpoint.version },
        {
          previousRef: checkpoint.previousRef,
          recordedAt: checkpoint.recordedAt,
          evidenceRefs: checkpoint.evidenceRefs,
        },
      ),
    );
    if (checkpoint.previousRef !== null) {
      edges.push(
        graphEdge(
          `edge:${checkpointId}:previous`,
          checkpointId,
          `continuity:${checkpoint.previousRef}`,
          "predecessor",
          { recordedAt: checkpoint.recordedAt },
        ),
      );
    }
  }
  return { nodes, edges };
}

export function buildStrongestCompositionProbe(
  proposal,
  sources,
  typedControlInput,
  typedControlKeyring,
) {
  const sourceBindings = verifiedSources(sources);
  const proposalMemberships = Array.isArray(proposal.incidentMemberships)
    ? proposal.incidentMemberships
    : [];
  const incidentVariants = proposalMemberships.map((membership) => {
    const artifact = deriveIncidentArtifact(
      sources["incident-response"].artifact,
      membership,
    );
    const artifactDigest = digest(artifact);
    if (!derivedIncidentValidationCache.has(artifactDigest)) {
      const schemaDigest =
        OWNER_CONTRACTS["incident-response"].schemaDigest;
      const validateSchema = schemaValidatorCache.get(schemaDigest);
      if (
        !validateSchema?.(artifact) ||
        validateArtifactSemantics("incident-response", artifact).length >
          0
      ) {
        fail(
          `Derived Incident Response artifact for ${membership.id} is not schema and semantic valid.`,
        );
      }
      derivedIncidentValidationCache.add(artifactDigest);
    }
    if (
      artifact.incident.id !== membership.incidentRef ||
      artifact.followUps[0].id !== membership.followUpRef ||
      artifact.followUps[0].identityKey !==
        membership.followUpIdentityKey
    ) {
      fail(
        `Derived Incident Response artifact for ${membership.id} does not preserve membership identity.`,
      );
    }
    return {
      membershipRef: membership.id,
      artifact,
      artifactDigest,
    };
  });
  sourceBindings["incident-response"].derivedArtifacts =
    incidentVariants.map(({ membershipRef, artifact, artifactDigest }) => ({
      membershipRef,
      artifactDigest,
      anchor: ownerAnchor("incident-response", artifact),
    }));
  const baseGraph = buildOwnerGraph(sources, incidentVariants);
  const typedControls = normalizeTypedControlInput(
    typedControlInput,
    baseGraph.nodes,
    baseGraph.edges.map((edge) => edge.id),
    digest,
    typedControlKeyring,
  );
  const graph = {
    nodes: [...baseGraph.nodes, ...typedControls.nodes],
    edges: [...baseGraph.edges, ...typedControls.edges],
    nodeLossIds: typedControls.nodeLossIds,
    edgeLossIds: typedControls.edgeLossIds,
  };
  const universeNodes = buildCandidateUniverse(proposal);
  const operationalComparisons = evaluateTypedCompositionGraph(
    graph,
    universeNodes,
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
    typedControlDigest: typedControls.digest,
    graph,
    graphDigest: digest(graph),
    universeNodes,
    operationalComparisons,
    lostTypedInvariants,
    authorityMode: "owner-artifacts-remain-authoritative",
  };
  return {
    ...body,
    probeDigest: digest(body),
  };
}

export function roundTripOwnerProjection(
  probe,
  sources,
  proposal,
  typedControlInput,
  typedControlKeyring,
) {
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
  const currentProbe = buildStrongestCompositionProbe(
    proposal,
    sources,
    typedControlInput,
    typedControlKeyring,
  );
  if (
    currentProbe.graphDigest !== probe.graphDigest ||
    currentProbe.typedControlDigest !== probe.typedControlDigest ||
    currentProbe.proposalDigest !== probe.proposalDigest
  ) {
    fail("Composition graph, controls, or proposal binding drifted.");
  }
  return projection;
}

export function requireLosslessProposalComposition(probe) {
  if (probe.lostTypedInvariants.length > 0) {
    const ids = probe.lostTypedInvariants.map((row) => row.id).join(", ");
    fail(`Composition loses typed invariants: ${ids}.`);
  }
}
