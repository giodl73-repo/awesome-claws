import { createHash } from "node:crypto";

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

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
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
  for (const action of artifact.actions) action.revision = actionRevision(action);
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
