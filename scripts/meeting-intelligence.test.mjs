import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { endOfLocalDayMs, validateArtifactSemantics } from "./artifact-semantics.mjs";

const schema = JSON.parse(
  await readFile(
    new URL("../claws/meeting-intelligence/schemas/meeting-record.schema.json", import.meta.url),
    "utf8",
  ),
);
const fixture = JSON.parse(
  await readFile(
    new URL("../claws/meeting-intelligence/fixtures/meeting-record.example.json", import.meta.url),
    "utf8",
  ),
);
const template = await readFile(
  new URL("../claws/meeting-intelligence/templates/meeting-record.md", import.meta.url),
  "utf8",
);
const validatorSource = await readFile(
  new URL("./artifact-semantics.mjs", import.meta.url),
  "utf8",
);
const validatorStart = validatorSource.indexOf("function meetingRecordFindings(");
const validatorEnd = validatorSource.indexOf(
  "\nfunction legacyVideoConceptGenerationManifestFindings(",
  validatorStart + 1,
);
assert.notEqual(validatorStart, -1);
assert.notEqual(validatorEnd, -1);
const validatorBody = validatorSource.slice(
  validatorStart,
  validatorEnd,
);
const emittedFindingCodes = new Set(
  [...validatorBody.matchAll(/finding\(\s*"([a-z_]+)"/gu)].map((match) => match[1]),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const clone = () => structuredClone(fixture);
const findings = (value) => validateArtifactSemantics("meeting-intelligence", value);
const isValid = (value) => validateSchema(value) && findings(value).length === 0;

function hasFinding(value, code) {
  return findings(value).some((item) => item.code === code);
}

function assertSchemaValid(value) {
  assert.equal(validateSchema(value), true, JSON.stringify(validateSchema.errors));
}

function segment(value, id) {
  return value.transcript.find((item) => item.id === id);
}

function participant(value, id) {
  return value.participants.find((item) => item.id === id);
}

function decision(value, id) {
  return value.decisions.find((item) => item.id === id);
}

function action(value, id) {
  return value.actionItems.find((item) => item.id === id);
}

function setOwner(value, owner) {
  value.meeting.decisionOwner = owner;
  value.meeting.retentionOwner = owner;
  value.handoff.owner = owner;
}

function setReviewer(value, reviewer) {
  value.meeting.reviewer = reviewer;
  value.handoff.reviewer = reviewer;
  value.ownerReview.reviewer = reviewer;
}

function uncreatedDocumentDraft(value) {
  value.documentDraft.state = "not-created";
  value.documentDraft.templateSourceRef = null;
  value.documentDraft.templatePath = null;
  value.documentDraft.outputPath = null;
  value.documentDraft.decisionRefs = [];
  value.documentDraft.actionRefs = [];
}

function shiftedRecord(hours) {
  const value = clone();
  const delta = hours * 3600 * 1000;
  const shift = (object, key) => {
    if (object[key] !== null) {
      object[key] = new Date(Date.parse(object[key]) + delta).toISOString();
    }
  };
  for (const key of ["startedAt", "endedAt", "asOf", "deleteAfter"]) {
    shift(value.meeting, key);
  }
  shift(value.consent, "noticeGivenAt");
  for (const source of value.sources) {
    shift(source, "capturedAt");
  }
  for (const item of value.participants) {
    shift(item, "consentRecordedAt");
    shift(item, "consentWithdrawnAt");
  }
  for (const item of value.corrections) {
    shift(item, "correctedAt");
  }
  for (const item of value.decisions) {
    shift(item, "recordedAt");
  }
  shift(value.ownerReview, "reviewedAt");
  return value;
}

// Closes every silent stretch of the processed window so the transcript covers it
// end to end, including the intentionally overlapping corrected passages.
function fullyTranscribedRecord() {
  const value = clone();
  const ordered = [...value.transcript].sort(
    (left, right) => left.startSeconds - right.startSeconds,
  );
  value.recording.windowStartSeconds = ordered[0].startSeconds;
  for (const [index, item] of ordered.entries()) {
    const next = ordered[index + 1];
    if (next !== undefined) {
      item.endSeconds = Math.max(item.endSeconds, next.startSeconds);
    }
  }
  value.recording.windowEndSeconds = Math.max(...ordered.map((item) => item.endSeconds));
  value.gapsAndBlockers = value.gapsAndBlockers.filter(
    (item) => item.id !== "gap-untranscribed-window",
  );
  value.handoff.gapRefs = value.handoff.gapRefs.filter(
    (id) => id !== "gap-untranscribed-window",
  );
  return value;
}

function addAbsentConsentedOwner(value) {
  value.participants.push({
    id: "participant-alvarez",
    displayName: "Nina Alvarez",
    role: "decision-maker",
    organization: "Data Platform",
    attendance: "absent",
    speakerLabel: null,
    consentStatus: "limited",
    consentBasis: "signed-consent-record",
    consentScopes: ["recording", "action-assignment"],
    consentRecordedAt: "2026-08-26T17:20:00-07:00",
    consentSourceRef: "src-consent-register",
    consentWithdrawnAt: null,
  });
  return "participant-alvarez";
}

function blockedRecord() {
  const value = clone();
  value.meeting.state = "blocked";
  value.handoff.state = "blocked";
  value.gapsAndBlockers.push({
    id: "gap-missing-decision-authority",
    kind: "missing-decision-authority",
    description:
      "The delegation record for the migration sequencing decision has not been produced, so the owner must confirm who held the decision right.",
    segmentRefs: ["segment-migration-proposal"],
    blocking: true,
    ownerRef: "participant-raman",
  });
  value.handoff.gapRefs.push("gap-missing-decision-authority");
  value.handoff.blockingRefs = ["gap-missing-decision-authority"];
  uncreatedDocumentDraft(value);
  return value;
}

function unusableAudioDraft() {
  const value = clone();
  value.meeting.state = "draft";
  value.handoff.state = "blocked";
  value.recording.audioQuality = "unusable";
  value.gapsAndBlockers.push({
    id: "gap-unusable-recording",
    kind: "unusable-recording",
    description:
      "The exported conference audio clips repeatedly after the midpoint, so the remaining passages cannot be transcribed and are left empty.",
    segmentRefs: [],
    blocking: true,
    ownerRef: "participant-raman",
  });
  value.handoff.gapRefs.push("gap-unusable-recording");
  value.handoff.blockingRefs = ["gap-unusable-recording"];
  uncreatedDocumentDraft(value);
  return value;
}

function zeroOutcomeRecord() {
  const value = clone();
  value.meeting.outcome = "no-decisions-or-actions";
  value.decisions = [];
  value.actionItems = [];
  value.conflicts = [];
  value.deliberations = value.deliberations.filter(
    (item) => item.outcome !== "carried-to-decision",
  );
  value.documentDraft.decisionRefs = [];
  value.documentDraft.actionRefs = [];
  value.handoff.deliberationRefs = value.deliberations.map((item) => item.id);
  value.handoff.decisionRefs = [];
  value.handoff.actionRefs = [];
  value.handoff.conflictRefs = [];
  return value;
}

function completedReview() {
  const value = clone();
  value.ownerReview.state = "completed";
  value.ownerReview.reviewedAt = "2026-08-28T09:00:00-07:00";
  value.ownerReview.resolution =
    "The review owner confirmed the tiered storage decision and left the migration sequencing conditional on the benchmark.";
  decision(value, "decision-storage-tier").reviewState = "confirmed-by-owner";
  return value;
}

test("meeting record fixture is a complete consent-bound decision and action record", () => {
  assertSchemaValid(fixture);
  assert.deepEqual(findings(fixture), []);
  assert.equal(fixture.meeting.state, "ready-for-owner-review");
  assert.equal(fixture.documentDraft.state, "review-draft");
  assert.equal(fixture.blockedActions.length, 14);
  for (const section of [
    "Participants and consent",
    "Deliberations, decisions, and dissent",
    "Questions, parking lot, conflicts, and gaps",
  ]) {
    assert.match(template, new RegExp(section, "u"));
  }
});

test("draft, blocked, and zero-outcome meetings stay representable", () => {
  for (const candidate of [
    blockedRecord(),
    unusableAudioDraft(),
    zeroOutcomeRecord(),
    completedReview(),
  ]) {
    assertSchemaValid(candidate);
    assert.deepEqual(findings(candidate), []);
  }
});

test("consent, attribution, and quotation stay bound to recorded evidence", () => {
  const inferredConsent = clone();
  participant(inferredConsent, "participant-okafor").consentBasis = "assumed-from-attendance";
  assert.equal(hasFinding(inferredConsent, "inferred_consent_basis"), true);

  const prematureConsentEvidence = clone();
  prematureConsentEvidence.sources.find(
    (item) => item.id === "src-consent-register",
  ).capturedAt = "2026-08-27T16:39:00-07:00";
  assert.equal(
    hasFinding(prematureConsentEvidence, "incoherent_participant_consent"),
    true,
  );

  const withdrawnStillUsed = clone();
  const withheld = segment(withdrawnStillUsed, "segment-security-caveat");
  withheld.state = "current";
  withheld.withheldReason = null;
  assert.equal(hasFinding(withdrawnStillUsed, "unconsented_transcript_use"), true);

  const fabricatedSpeaker = clone();
  segment(fabricatedSpeaker, "segment-open-scope").speakerRef = "participant-nakamura";
  assert.equal(hasFinding(fabricatedSpeaker, "fabricated_speaker_attribution"), true);

  const unconsentedQuote = clone();
  segment(unconsentedQuote, "segment-cost-discussion").verbatim = true;
  assert.equal(hasFinding(unconsentedQuote, "unsupported_verbatim_quote"), true);

  const disputedAttribution = clone();
  const probable = segment(disputedAttribution, "segment-probable-lin");
  probable.attributionState = "disputed";
  probable.speakerRef = null;
  probable.attributionConfidence = 0.4;
  assert.equal(hasFinding(disputedAttribution, "broken_conflict_link"), true);
  assert.equal(hasFinding(disputedAttribution, "premature_ready_state"), true);
});

test("decisions and actions cannot be inferred, assumed, or self-committed", () => {
  const silentDecision = clone();
  decision(silentDecision, "decision-storage-tier").agreementBasis = "silence";
  assert.equal(hasFinding(silentDecision, "decision_inferred_from_silence"), true);

  const seniorityDecision = clone();
  decision(seniorityDecision, "decision-storage-tier").authorityBasis = "assumed-from-seniority";
  assert.equal(hasFinding(seniorityDecision, "inferred_decision_authority"), true);

  const unauthorizedMaker = clone();
  decision(unauthorizedMaker, "decision-storage-tier").decisionMakerRef = "participant-lin";
  assert.equal(hasFinding(unauthorizedMaker, "unauthorized_decision_maker"), true);

  const autonomousDelivery = clone();
  action(autonomousDelivery, "action-latency-benchmark").deliveryState =
    "calendar-invite-sent-by-agent";
  assert.equal(hasFinding(autonomousDelivery, "autonomous_commitment"), true);

  const unassignedAtReady = clone();
  const proposed = action(unassignedAtReady, "action-rollback-drill");
  proposed.assignmentState = "unassigned";
  proposed.assigneeRef = null;
  assert.equal(hasFinding(unassignedAtReady, "premature_ready_state"), true);
});

test("owner, reviewer, and retention authority reject agent identities without rejecting human titles", () => {
  for (const owner of [
    "Priya Raman, Director of Platform Engineering",
    "Assistant Director of Engineering Operations",
    "Chief of Staff, Platform Organization",
    "Aiden Clawson",
    "Roberta Botsford",
    "AI Governance Board",
    "AI Ethics Committee, Legal Department",
    "Chief AI Officer",
    "Minute Taker Working Group",
  ]) {
    const candidate = clone();
    setOwner(candidate, owner);
    assert.equal(hasFinding(candidate, "agent_owned_authority"), false, owner);
  }
  for (const owner of [
    "AI",
    "bot",
    "GPT",
    "the assistant",
    "Claw",
    "Copilot",
    "AI assistant",
    "Automated minute taker",
    "the AI note taker",
    "AI note-taker",
    "AI notetaker",
    "the automated note-taker",
    "Synthetic meeting taker",
    "gpt-5 planning model",
    "An internal language model",
    "Meeting intelligence",
  ]) {
    const candidate = clone();
    setOwner(candidate, owner);
    assert.equal(hasFinding(candidate, "agent_owned_authority"), true, owner);
  }
  const agentReviewer = clone();
  setReviewer(agentReviewer, "Meeting intelligence");
  assert.equal(hasFinding(agentReviewer, "agent_owned_authority"), true);
});

test("every meeting-record finding code has a focused case", () => {
  const cases = [
    [
      "duplicate_reference",
      (value) => value.transcript.push(structuredClone(segment(value, "segment-open-scope"))),
    ],
    [
      "dangling_reference",
      (value) => {
        decision(value, "decision-storage-tier").deliberationRefs = ["deliberation-missing"];
      },
    ],
    [
      "invalid_meeting_chronology",
      (value) => {
        value.meeting.deleteAfter = "2026-08-27T23:59:00-07:00";
      },
    ],
    [
      "unsafe_handoff_destination",
      (value) => {
        value.meeting.destination = "outputs/../private/meeting-minutes.md";
      },
    ],
    [
      "invalid_recording_window",
      (value) => {
        value.recording.windowEndSeconds = 4000;
      },
    ],
    [
      "unsafe_source_path",
      (value) => {
        value.sources[0].path = "evidence/../../private/architecture-review.m4a";
      },
    ],
    [
      "source_authority_mismatch",
      (value) => {
        value.sources[1].authority = "reviewer";
      },
    ],
    [
      "future_source_evidence",
      (value) => {
        value.sources[0].capturedAt = "2026-08-29T10:00:00-07:00";
      },
    ],
    [
      "incoherent_source_digest",
      (value) => {
        value.sources[0].sha256 = null;
      },
    ],
    [
      "invalid_authority_reference",
      (value) => {
        value.consent.consentPolicySourceRef = "src-retention-policy";
      },
    ],
    [
      "inferred_consent_basis",
      (value) => {
        value.consent.basis = "assumed-from-organizational-policy";
      },
    ],
    [
      "incoherent_participant_consent",
      (value) => {
        participant(value, "participant-raman").consentScopes = ["recording"];
      },
    ],
    [
      "absent_participant_speaker",
      (value) => {
        participant(value, "participant-nakamura").speakerLabel = "speaker-nakamura";
      },
    ],
    [
      "invalid_segment_window",
      (value) => {
        segment(value, "segment-open-scope").startSeconds = 90;
      },
    ],
    [
      "incoherent_speaker_attribution",
      (value) => {
        segment(value, "segment-open-scope").attributionConfidence = 0.5;
      },
    ],
    [
      "fabricated_speaker_attribution",
      (value) => {
        segment(value, "segment-open-scope").speakerRef = "participant-nakamura";
      },
    ],
    [
      "unconsented_transcript_use",
      (value) => {
        const withheld = segment(value, "segment-security-caveat");
        withheld.state = "current";
        withheld.withheldReason = null;
      },
    ],
    [
      "unconsented_minutes_use",
      (value) => {
        participant(value, "participant-okafor").consentScopes =
          participant(value, "participant-okafor").consentScopes.filter(
            (scope) => scope !== "internal-minutes",
          );
      },
    ],
    [
      "unsupported_verbatim_quote",
      (value) => {
        segment(value, "segment-cost-discussion").verbatim = true;
      },
    ],
    [
      "incoherent_segment_state",
      (value) => {
        segment(value, "segment-open-scope").withheldReason =
          "A reason that no withheld state supports.";
      },
    ],
    [
      "broken_correction_lineage",
      (value) => {
        value.corrections[0].supersededSegmentRef = "segment-open-scope";
      },
    ],
    [
      "incoherent_deliberation_outcome",
      (value) => {
        value.deliberations[0].outcome = "unresolved";
      },
    ],
    [
      "broken_deliberation_link",
      (value) => {
        decision(value, "decision-storage-tier").deliberationRefs = [
          "deliberation-migration-sequence",
        ];
      },
    ],
    [
      "unsupported_evidence_state",
      (value) => {
        decision(value, "decision-storage-tier").segmentRefs.push(
          "segment-rollback-window-draft",
        );
      },
    ],
    [
      "unauthorized_decision_maker",
      (value) => {
        decision(value, "decision-storage-tier").decisionMakerRef = "participant-diaz";
      },
    ],
    [
      "inferred_decision_authority",
      (value) => {
        decision(value, "decision-storage-tier").authorityBasis = "assumed-from-majority-mood";
      },
    ],
    [
      "decision_inferred_from_silence",
      (value) => {
        decision(value, "decision-storage-tier").agreementBasis =
          "absence-of-objection-unprompted";
      },
    ],
    [
      "incoherent_decision_conditions",
      (value) => {
        decision(value, "decision-storage-tier").conditions = [
          "A condition that an unconditional decision cannot carry.",
        ];
      },
    ],
    [
      "incoherent_dissent",
      (value) => {
        decision(value, "decision-migration-sequence").dissentRefs = ["participant-okafor"];
      },
    ],
    [
      "invalid_decision_chronology",
      (value) => {
        decision(value, "decision-storage-tier").recordedAt = "2026-08-27T16:00:00-07:00";
      },
    ],
    [
      "premature_decision_confirmation",
      (value) => {
        decision(value, "decision-storage-tier").reviewState = "confirmed-by-owner";
      },
    ],
    [
      "unsupported_action_acknowledgement",
      (value) => {
        action(value, "action-latency-benchmark").acknowledgementSourceRef = "src-owner-note";
      },
    ],
    [
      "unconsented_action_assignment",
      (value) => {
        action(value, "action-latency-benchmark").assigneeRef = "participant-shah";
      },
    ],
    [
      "invalid_action_due_date",
      (value) => {
        action(value, "action-latency-benchmark").dueDate = "2026-08-20";
      },
    ],
    [
      "incoherent_action_status",
      (value) => {
        action(value, "action-rollback-drill").status = "in-progress";
      },
    ],
    [
      "cyclic_action_dependency",
      (value) => {
        action(value, "action-latency-benchmark").dependsOn = ["action-rollback-drill"];
      },
    ],
    [
      "unsupported_action_decision",
      (value) => {
        decision(value, "decision-storage-tier").status = "deferred";
        action(value, "action-latency-benchmark").decisionRef = "decision-storage-tier";
      },
    ],
    [
      "autonomous_commitment",
      (value) => {
        action(value, "action-cutover-runbook").deliveryState = "task-created-by-agent";
      },
    ],
    [
      "incoherent_question_state",
      (value) => {
        value.openQuestions[0].ownerRef = null;
      },
    ],
    [
      "broken_conflict_link",
      (value) => {
        value.conflicts[0].decisionRefs = ["decision-storage-tier"];
      },
    ],
    [
      "incoherent_conflict_resolution",
      (value) => {
        value.conflicts[0].resolutionState = "resolved-on-record";
      },
    ],
    [
      "incoherent_gap_state",
      (value) => {
        value.gapsAndBlockers[0].blocking = true;
      },
    ],
    [
      "premature_document_final",
      (value) => {
        value.documentDraft.state = "final";
      },
    ],
    [
      "unpreserved_source_material",
      (value) => {
        value.documentDraft.preservesSourceRecording = false;
      },
    ],
    [
      "unauthorized_distribution",
      (value) => {
        value.documentDraft.distributionState = "distributed-by-agent";
      },
    ],
    [
      "incomplete_document_coverage",
      (value) => {
        value.documentDraft.actionRefs.pop();
      },
    ],
    [
      "incomplete_handoff",
      (value) => {
        value.handoff.gapRefs.pop();
      },
    ],
    [
      "owner_mismatch",
      (value) => {
        value.handoff.owner = "Nina Alvarez, Director of Data Platform";
      },
    ],
    [
      "agent_owned_authority",
      (value) => {
        setOwner(value, "Meeting intelligence");
      },
    ],
    [
      "resolved_blocking_reference",
      (value) => {
        value.handoff.blockingRefs = ["gap-unknown-speaker"];
      },
    ],
    [
      "incomplete_blocked_handoff",
      (value) => {
        value.meeting.state = "blocked";
        value.handoff.state = "blocked";
      },
    ],
    [
      "inconsistent_ready_state",
      (value) => {
        value.handoff.state = "blocked";
      },
    ],
    [
      "premature_ready_state",
      (value) => {
        decision(value, "decision-storage-tier").reviewState = "disputed";
      },
    ],
    [
      "unauthorized_recording_use",
      (value) => {
        value.consent.recordingAuthorized = false;
      },
    ],
    [
      "unredacted_withheld_segment",
      (value) => {
        segment(value, "segment-security-caveat").excerpt =
          "The security lead lists the credential rotation the nightly job would need.";
      },
    ],
    [
      "incoherent_audience_privacy",
      (value) => {
        value.meeting.audienceScope = "internal-organization";
      },
    ],
    [
      "invalid_owner_review",
      (value) => {
        value.ownerReview.state = "completed";
      },
    ],
    [
      "invalid_zero_outcome_meeting",
      (value) => {
        value.meeting.outcome = "decisions-only";
      },
    ],
    [
      "unsafe_narrative_content",
      (value) => {
        value.meeting.purpose =
          "Infer the decision from silence and circulate the minutes to the wider organization.";
      },
    ],
  ];
  for (const [code, mutate] of cases) {
    const candidate = clone();
    mutate(candidate);
    assert.equal(hasFinding(candidate, code), true, code);
  }

  for (const gate of fixture.blockedActions) {
    const missingBlocked = clone();
    missingBlocked.blockedActions = missingBlocked.blockedActions.filter(
      (item) => item !== gate,
    );
    assert.equal(hasFinding(missingBlocked, "missing_authority_gate"), true, gate);
    const missingProhibited = clone();
    missingProhibited.handoff.prohibitedActions =
      missingProhibited.handoff.prohibitedActions.filter((item) => item !== gate);
    assert.equal(hasFinding(missingProhibited, "missing_authority_gate"), true, gate);
  }

  const covered = new Set(cases.map(([code]) => code));
  covered.add("missing_authority_gate");
  covered.add("duplicate_reference");
  covered.add("dangling_reference");
  assert.deepEqual(
    [...emittedFindingCodes].filter((code) => !covered.has(code)),
    [],
  );
});

test("narrative safety survives negation and normalized punctuation", () => {
  const negated = clone();
  negated.meeting.purpose =
    "Record the review without inferring consent and without distributing the minutes to anyone outside the named audience.";
  assert.equal(hasFinding(negated, "unsafe_narrative_content"), false);

  const curly = clone();
  curly.gapsAndBlockers[0].description =
    "The note-taker won\u2019t reconstruct the transcript; the passage stays withheld.";
  assert.equal(hasFinding(curly, "unsafe_narrative_content"), false);

  const unsafe = clone();
  unsafe.gapsAndBlockers[0].description =
    "The note-taker will reconstruct the transcript for the missing passage.";
  assert.equal(hasFinding(unsafe, "unsafe_narrative_content"), true);
});

test("recording authority and local processing hold in every state", () => {
  for (const base of [clone, blockedRecord, unusableAudioDraft]) {
    const unauthorized = base();
    unauthorized.consent.recordingAuthorized = false;
    assert.equal(hasFinding(unauthorized, "unauthorized_recording_use"), true);

    const partialAuthority = base();
    partialAuthority.consent.authorizedUses = partialAuthority.consent.authorizedUses.filter(
      (use) => use !== "internal-minutes-draft",
    );
    assert.equal(hasFinding(partialAuthority, "unauthorized_recording_use"), true);

    const remoteProcessing = base();
    remoteProcessing.recording.processedLocally = false;
    assert.equal(hasFinding(remoteProcessing, "unauthorized_recording_use"), true);
  }
});

test("participation credit stays bound to attendance, consent, and cited speech", () => {
  const absentRaiser = clone();
  absentRaiser.deliberations[0].raisedByRef = "participant-nakamura";
  assert.equal(hasFinding(absentRaiser, "fabricated_speaker_attribution"), true);

  const withdrawnRaiser = clone();
  withdrawnRaiser.openQuestions[0].raisedByRef = "participant-shah";
  assert.equal(hasFinding(withdrawnRaiser, "fabricated_speaker_attribution"), true);

  const uncitedRaiser = clone();
  uncitedRaiser.deliberations[1].raisedByRef = "participant-raman";
  assert.equal(hasFinding(uncitedRaiser, "fabricated_speaker_attribution"), true);

  const unidentifiedRaiser = clone();
  unidentifiedRaiser.openQuestions[1].raisedByRef = null;
  assertSchemaValid(unidentifiedRaiser);
  assert.deepEqual(findings(unidentifiedRaiser), []);

  const absentConflictParticipant = clone();
  absentConflictParticipant.conflicts[0].participantRefs = [
    "participant-nakamura",
    "participant-okafor",
  ];
  assert.equal(hasFinding(absentConflictParticipant, "fabricated_speaker_attribution"), true);

  const absentDissenter = clone();
  decision(absentDissenter, "decision-migration-sequence").dissentRefs = [
    "participant-nakamura",
  ];
  assert.equal(hasFinding(absentDissenter, "fabricated_speaker_attribution"), true);

  const uncitedDissenter = clone();
  decision(uncitedDissenter, "decision-migration-sequence").dissentRefs = [
    "participant-diaz",
  ];
  assert.equal(hasFinding(uncitedDissenter, "fabricated_speaker_attribution"), true);

  const unconsentedOwner = clone();
  unconsentedOwner.gapsAndBlockers[0].ownerRef = "participant-shah";
  assert.equal(hasFinding(unconsentedOwner, "unconsented_action_assignment"), true);

  const unconsentedParkingOwner = clone();
  unconsentedParkingOwner.parkingLot[0].ownerRef = "participant-shah";
  assert.equal(hasFinding(unconsentedParkingOwner, "unconsented_action_assignment"), true);

  const absentFollowUpOwner = clone();
  const owner = addAbsentConsentedOwner(absentFollowUpOwner);
  absentFollowUpOwner.gapsAndBlockers[0].ownerRef = owner;
  absentFollowUpOwner.openQuestions[0].ownerRef = owner;
  assertSchemaValid(absentFollowUpOwner);
  assert.deepEqual(findings(absentFollowUpOwner), []);
});

test("substantive conflicts require usable transcript evidence", () => {
  for (const segmentRef of [
    "segment-security-caveat",
    "segment-rollback-window-draft",
  ]) {
    const unsupportedConflict = clone();
    unsupportedConflict.conflicts[0].segmentRefs = [segmentRef];
    assertSchemaValid(unsupportedConflict);
    assert.equal(
      hasFinding(unsupportedConflict, "unsupported_evidence_state"),
      true,
      segmentRef,
    );
  }

  const disputedAttribution = clone();
  const disputedSegment = segment(disputedAttribution, "segment-security-caveat");
  disputedSegment.attributionState = "disputed";
  disputedSegment.speakerRef = null;
  disputedSegment.attributionConfidence = 0.4;
  disputedSegment.uncertainty =
    "The withheld passage remains disputed because the speaker identity is not retained.";
  disputedAttribution.conflicts.push({
    id: "conflict-overlapping-speakers",
    kind: "disputed-attribution",
    description:
      "The overlapping passage cannot be assigned to a participant and remains disputed.",
    segmentRefs: [disputedSegment.id],
    decisionRefs: [],
    actionRefs: [],
    participantRefs: [],
    resolutionState: "unresolved",
    resolutionSegmentRef: null,
  });
  disputedAttribution.handoff.conflictRefs.push("conflict-overlapping-speakers");
  assertSchemaValid(disputedAttribution);
  assert.equal(
    hasFinding(disputedAttribution, "unsupported_evidence_state"),
    false,
  );

  const mislabeledAttributionDispute = clone();
  mislabeledAttributionDispute.conflicts.push({
    id: "conflict-confirmed-speaker",
    kind: "disputed-attribution",
    description:
      "The record incorrectly labels a confirmed speaker passage as an attribution dispute.",
    segmentRefs: ["segment-open-scope"],
    decisionRefs: [],
    actionRefs: [],
    participantRefs: [],
    resolutionState: "unresolved",
    resolutionSegmentRef: null,
  });
  mislabeledAttributionDispute.handoff.conflictRefs.push("conflict-confirmed-speaker");
  assertSchemaValid(mislabeledAttributionDispute);
  assert.equal(hasFinding(mislabeledAttributionDispute, "broken_conflict_link"), true);

  const unconsentedDispute = clone();
  unconsentedDispute.conflicts.push({
    id: "conflict-withheld-speaker",
    kind: "contradictory-statements",
    description:
      "The retained attribution remains disputed, but the speaker withheld minutes consent.",
    segmentRefs: ["segment-security-caveat"],
    decisionRefs: [],
    actionRefs: [],
    participantRefs: [],
    resolutionState: "unresolved",
    resolutionSegmentRef: null,
  });
  unconsentedDispute.handoff.conflictRefs.push("conflict-withheld-speaker");
  assertSchemaValid(unconsentedDispute);
  assert.equal(hasFinding(unconsentedDispute, "unconsented_minutes_use"), true);
});

test("withheld segments keep a redaction marker instead of the speech", () => {
  const retainedSpeech = clone();
  segment(retainedSpeech, "segment-security-caveat").excerpt =
    "The security lead lists the credential rotation the nightly job would need.";
  assert.equal(validateSchema(retainedSpeech), false);
  assert.equal(hasFinding(retainedSpeech, "unredacted_withheld_segment"), true);

  const quotedRedaction = clone();
  segment(quotedRedaction, "segment-security-caveat").excerpt =
    '[Withheld: the speaker said "rotate the credential nightly" before withdrawing consent.]';
  assert.equal(validateSchema(quotedRedaction), false);
  assert.equal(hasFinding(quotedRedaction, "unredacted_withheld_segment"), true);

  const falseMarker = clone();
  segment(falseMarker, "segment-open-scope").excerpt =
    "[Withheld: a retained segment cannot pose as a redaction.]";
  assert.equal(hasFinding(falseMarker, "unredacted_withheld_segment"), true);
});

test("narrative safety scans agent-authored text and leaves transcript excerpts alone", () => {
  const unsafeCondition = clone();
  decision(unsafeCondition, "decision-migration-sequence").conditions = [
    "The owner may infer consent from attendance before the staged cutover begins.",
  ];
  assert.equal(hasFinding(unsafeCondition, "unsafe_narrative_content"), true);

  const unsafeAudience = clone();
  unsafeAudience.meeting.audience =
    "Named platform leads, once we circulate the minutes to the wider organization.";
  assert.equal(hasFinding(unsafeAudience, "unsafe_narrative_content"), true);

  const unsafeUncertainty = clone();
  segment(unsafeUncertainty, "segment-probable-lin").uncertainty =
    "The note-taker will identify the speaker by their voiceprint before the handoff.";
  assert.equal(hasFinding(unsafeUncertainty, "unsafe_narrative_content"), true);

  const unsafeWithheldReason = clone();
  segment(unsafeWithheldReason, "segment-security-caveat").withheldReason =
    "The note-taker will reconstruct the transcript for the owner instead.";
  assert.equal(hasFinding(unsafeWithheldReason, "unsafe_narrative_content"), true);

  const quotedSpeech = clone();
  segment(quotedSpeech, "segment-cost-discussion").excerpt =
    "Asks whether we should delete the source recording and fabricate a quotation for the minutes.";
  assert.equal(hasFinding(quotedSpeech, "unsafe_narrative_content"), false);
});

test("restricted material cannot be handed to the whole organization", () => {
  const organizationWide = clone();
  organizationWide.meeting.audienceScope = "internal-organization";
  assert.equal(hasFinding(organizationWide, "incoherent_audience_privacy"), true);

  const restrictedRecord = clone();
  restrictedRecord.meeting.privacy = "restricted";
  restrictedRecord.meeting.audienceScope = "internal-organization";
  for (const source of restrictedRecord.sources) {
    source.privacy = "internal";
  }
  assert.equal(hasFinding(restrictedRecord, "incoherent_audience_privacy"), true);

  const organizationWideConfidential = clone();
  organizationWideConfidential.meeting.audienceScope = "internal-organization";
  for (const source of organizationWideConfidential.sources) {
    source.privacy = source.privacy === "restricted" ? "confidential" : source.privacy;
  }
  assert.equal(hasFinding(organizationWideConfidential, "incoherent_audience_privacy"), false);

  const namedTeam = clone();
  namedTeam.meeting.privacy = "restricted";
  assert.equal(hasFinding(namedTeam, "incoherent_audience_privacy"), false);
});

test("gaps stay truthful about speakers, audio quality, and transcript coverage", () => {
  const missingUnknownSpeaker = clone();
  missingUnknownSpeaker.gapsAndBlockers = missingUnknownSpeaker.gapsAndBlockers.filter(
    (item) => item.id !== "gap-unknown-speaker",
  );
  missingUnknownSpeaker.handoff.gapRefs = missingUnknownSpeaker.handoff.gapRefs.filter(
    (id) => id !== "gap-unknown-speaker",
  );
  assert.equal(hasFinding(missingUnknownSpeaker, "incoherent_gap_state"), true);

  const misdirectedUnknownSpeaker = clone();
  misdirectedUnknownSpeaker.gapsAndBlockers.find(
    (item) => item.id === "gap-unknown-speaker",
  ).segmentRefs = ["segment-open-scope"];
  assert.equal(hasFinding(misdirectedUnknownSpeaker, "incoherent_gap_state"), true);

  const missingDegradedAudio = clone();
  missingDegradedAudio.gapsAndBlockers = missingDegradedAudio.gapsAndBlockers.filter(
    (item) => item.id !== "gap-degraded-audio",
  );
  missingDegradedAudio.handoff.gapRefs = missingDegradedAudio.handoff.gapRefs.filter(
    (id) => id !== "gap-degraded-audio",
  );
  assert.equal(hasFinding(missingDegradedAudio, "incoherent_gap_state"), true);

  const clearAudioGap = clone();
  clearAudioGap.recording.audioQuality = "clear";
  assert.equal(hasFinding(clearAudioGap, "incoherent_gap_state"), true);

  const citedAudioGap = clone();
  citedAudioGap.gapsAndBlockers.find(
    (item) => item.id === "gap-degraded-audio",
  ).segmentRefs = ["segment-open-scope"];
  assert.equal(hasFinding(citedAudioGap, "incoherent_gap_state"), true);

  const missingUntranscribedWindow = clone();
  missingUntranscribedWindow.gapsAndBlockers =
    missingUntranscribedWindow.gapsAndBlockers.filter(
      (item) => item.id !== "gap-untranscribed-window",
    );
  missingUntranscribedWindow.handoff.gapRefs =
    missingUntranscribedWindow.handoff.gapRefs.filter(
      (id) => id !== "gap-untranscribed-window",
    );
  assert.equal(hasFinding(missingUntranscribedWindow, "incoherent_gap_state"), true);

  const covered = fullyTranscribedRecord();
  assertSchemaValid(covered);
  assert.deepEqual(findings(covered), []);

  const inventedUntranscribedWindow = fullyTranscribedRecord();
  inventedUntranscribedWindow.gapsAndBlockers.push({
    id: "gap-untranscribed-window",
    kind: "untranscribed-window",
    description: "A coverage claim that the transcript itself contradicts.",
    segmentRefs: [],
    blocking: false,
    ownerRef: "participant-raman",
  });
  inventedUntranscribedWindow.handoff.gapRefs.push("gap-untranscribed-window");
  assert.equal(hasFinding(inventedUntranscribedWindow, "incoherent_gap_state"), true);
});

test("blocked handoffs name real unresolved work without inventing a blocking gap", () => {
  const blockedByDocument = clone();
  blockedByDocument.meeting.state = "draft";
  blockedByDocument.handoff.state = "blocked";
  uncreatedDocumentDraft(blockedByDocument);
  assertSchemaValid(blockedByDocument);
  assert.deepEqual(findings(blockedByDocument), []);

  const blockedByQuestion = clone();
  blockedByQuestion.meeting.state = "blocked";
  blockedByQuestion.handoff.state = "blocked";
  blockedByQuestion.openQuestions[1].state = "open";
  blockedByQuestion.openQuestions[1].answerSegmentRef = null;
  assertSchemaValid(blockedByQuestion);
  assert.deepEqual(findings(blockedByQuestion), []);

  const blockedByConflict = clone();
  blockedByConflict.meeting.state = "blocked";
  blockedByConflict.handoff.state = "blocked";
  blockedByConflict.conflicts[0].resolutionState = "unresolved";
  assertSchemaValid(blockedByConflict);
  assert.deepEqual(findings(blockedByConflict), []);

  const blockedWithoutReason = clone();
  blockedWithoutReason.meeting.state = "blocked";
  blockedWithoutReason.handoff.state = "blocked";
  assert.equal(hasFinding(blockedWithoutReason, "incomplete_blocked_handoff"), true);

  const hiddenBlocker = blockedRecord();
  hiddenBlocker.handoff.blockingRefs = [];
  assert.equal(hasFinding(hiddenBlocker, "incomplete_blocked_handoff"), true);
  assert.equal(hasFinding(hiddenBlocker, "incoherent_gap_state"), true);
});

test("the private destination cannot overwrite the generated document", () => {
  const collision = clone();
  collision.meeting.destination = collision.documentDraft.outputPath;
  assertSchemaValid(collision);
  assert.equal(hasFinding(collision, "unsafe_handoff_destination"), true);

  const templateCollision = clone();
  templateCollision.documentDraft.outputPath = "outputs/decision-record.docx";
  templateCollision.documentDraft.templatePath = "outputs/decision-record.docx";
  templateCollision.sources.find(
    (item) => item.id === "src-decision-record-template",
  ).path = "outputs/decision-record.docx";
  assert.equal(hasFinding(templateCollision, "unsafe_source_path"), true);

  const draftSourceCollision = clone();
  draftSourceCollision.sources.find(
    (item) => item.kind === "recording-file",
  ).path = draftSourceCollision.documentDraft.outputPath;
  assertSchemaValid(draftSourceCollision);
  assert.equal(hasFinding(draftSourceCollision, "unsafe_source_path"), true);

  const handoffSourceCollision = clone();
  handoffSourceCollision.sources.find(
    (item) => item.kind === "recording-file",
  ).path = handoffSourceCollision.meeting.destination;
  assertSchemaValid(handoffSourceCollision);
  assert.equal(hasFinding(handoffSourceCollision, "unsafe_handoff_destination"), true);
});

test("recording and acknowledgement evidence keep meeting chronology", () => {
  const earlyRecording = clone();
  earlyRecording.sources[0].capturedAt = "2026-08-27T13:00:00-07:00";
  assert.equal(hasFinding(earlyRecording, "invalid_meeting_chronology"), true);

  const lateRecording = clone();
  lateRecording.sources[0].capturedAt = "2026-08-27T15:30:00-07:00";
  assert.equal(hasFinding(lateRecording, "invalid_meeting_chronology"), true);

  const prematureAcknowledgement = clone();
  prematureAcknowledgement.sources.find(
    (item) => item.id === "src-acknowledgement-lin",
  ).capturedAt = "2026-08-27T14:30:00-07:00";
  assert.equal(hasFinding(prematureAcknowledgement, "invalid_meeting_chronology"), true);

  const offsetRecordingWindow = clone();
  const offset = 3600;
  offsetRecordingWindow.recording.durationSeconds += offset;
  offsetRecordingWindow.recording.windowStartSeconds += offset;
  offsetRecordingWindow.recording.windowEndSeconds += offset;
  for (const item of offsetRecordingWindow.transcript) {
    item.startSeconds += offset;
    item.endSeconds += offset;
  }
  assertSchemaValid(offsetRecordingWindow);
  assert.deepEqual(findings(offsetRecordingWindow), []);

  const prematureCorrection = clone();
  prematureCorrection.sources.find(
    (item) => item.id === "src-correction-note",
  ).capturedAt = "2026-08-27T13:30:00-07:00";
  assert.equal(hasFinding(prematureCorrection, "invalid_meeting_chronology"), true);

  const correctionEvidencePredatesCorrection = clone();
  correctionEvidencePredatesCorrection.sources.find(
    (item) => item.id === "src-correction-note",
  ).capturedAt = "2026-08-28T08:39:00-07:00";
  assert.equal(
    hasFinding(correctionEvidencePredatesCorrection, "broken_correction_lineage"),
    true,
  );

  const correctionPredatesPassage = clone();
  correctionPredatesPassage.corrections[0].correctedAt =
    correctionPredatesPassage.meeting.startedAt;
  correctionPredatesPassage.sources.find(
    (item) => item.id === "src-correction-note",
  ).capturedAt = correctionPredatesPassage.meeting.startedAt;
  assert.equal(hasFinding(correctionPredatesPassage, "broken_correction_lineage"), true);

  const overlongWindow = clone();
  overlongWindow.recording.durationSeconds = 7200;
  overlongWindow.recording.windowEndSeconds = 5000;
  assert.equal(hasFinding(overlongWindow, "invalid_recording_window"), true);
});

test("date-only deadlines resolve to the end of the local day", () => {
  assert.equal(
    endOfLocalDayMs("2026-09-04", "America/Los_Angeles"),
    Date.parse("2026-09-05T06:59:59.999Z"),
  );
  assert.equal(
    endOfLocalDayMs("2026-11-01", "America/Los_Angeles"),
    Date.parse("2026-11-02T07:59:59.999Z"),
  );
  assert.equal(
    endOfLocalDayMs("2026-08-27", "Pacific/Kiritimati"),
    Date.parse("2026-08-27T09:59:59.999Z"),
  );
  assert.equal(endOfLocalDayMs("2026-08-27", "UTC"), Date.parse("2026-08-27T23:59:59.999Z"));
  assert.equal(endOfLocalDayMs("2026-08-27", "Mars/Olympus"), null);
});

test("due and revisit dates are judged in their own zone, not in UTC", () => {
  const eveningMeeting = shiftedRecord(3);
  assertSchemaValid(eveningMeeting);
  assert.deepEqual(findings(eveningMeeting), []);
  assert.equal(
    Date.parse(eveningMeeting.meeting.endedAt) > Date.parse("2026-08-28T00:00:00Z"),
    true,
  );

  const localSameDayDue = shiftedRecord(3);
  action(localSameDayDue, "action-latency-benchmark").dueDate = "2026-08-27";
  localSameDayDue.parkingLot[0].proposedRevisitBy = "2026-08-27";
  assert.equal(hasFinding(localSameDayDue, "invalid_action_due_date"), false);
  assert.equal(hasFinding(localSameDayDue, "invalid_meeting_chronology"), false);

  const aheadOfUtcDue = clone();
  const benchmark = action(aheadOfUtcDue, "action-latency-benchmark");
  benchmark.dueDate = "2026-08-27";
  benchmark.dueTimezone = "Pacific/Kiritimati";
  assert.equal(hasFinding(aheadOfUtcDue, "invalid_action_due_date"), true);

  const unresolvableDueZone = clone();
  action(unresolvableDueZone, "action-latency-benchmark").dueTimezone = "Mars/Olympus";
  assertSchemaValid(unresolvableDueZone);
  assert.equal(hasFinding(unresolvableDueZone, "invalid_action_due_date"), true);

  const unresolvableMeetingZone = clone();
  unresolvableMeetingZone.meeting.timezone = "Mars/Olympus";
  assertSchemaValid(unresolvableMeetingZone);
  assert.equal(hasFinding(unresolvableMeetingZone, "invalid_meeting_chronology"), true);
});

test("consent scopes are checked against the named scope set", () => {
  const incompleteGrant = clone();
  participant(incompleteGrant, "participant-raman").consentScopes = [
    "recording",
    "transcription",
    "attributed-quotation",
    "internal-minutes",
  ];
  assert.equal(hasFinding(incompleteGrant, "incoherent_participant_consent"), true);

  const unlimitedLimit = clone();
  participant(unlimitedLimit, "participant-okafor").consentScopes = [
    "recording",
    "transcription",
    "attributed-quotation",
    "internal-minutes",
    "action-assignment",
  ];
  assert.equal(hasFinding(unlimitedLimit, "incoherent_participant_consent"), true);

  const renamedScopeCount = clone();
  participant(renamedScopeCount, "participant-okafor").consentScopes = [
    "recording",
    "transcription",
    "internal-minutes",
  ];
  assert.equal(hasFinding(renamedScopeCount, "incoherent_participant_consent"), false);
});

test("schema-valid records never crash the semantic validator", () => {
  const emptied = clone();
  emptied.decisions = [];
  emptied.actionItems = [];
  emptied.conflicts = [];
  emptied.corrections = [];
  emptied.openQuestions = [];
  emptied.parkingLot = [];
  emptied.gapsAndBlockers = [];
  assertSchemaValid(emptied);
  assert.equal(Array.isArray(findings(emptied)), true);
  assert.equal(isValid(emptied), false);
});
