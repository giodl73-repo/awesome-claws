import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  buildCandidateUniverse,
  buildStrongestCompositionProbe,
  canonicalJson,
  deriveIncidentArtifact,
  digest,
  OWNER_CONTRACTS,
  requireLosslessProposalComposition,
  roundTripOwnerProjection,
} from "./composition-adapter.mjs";
import {
  TYPED_CONTROL_KEYRING_SCHEMA_VERSION,
  TYPED_CONTROL_SCHEMA_VERSION,
} from "./typed-composition-graph.mjs";
import {
  artifactSemanticValidationOptions,
  validateArtifactSemantics,
} from "../../../scripts/artifact-semantics.mjs";

async function json(relative) {
  return JSON.parse(await readFile(new URL(relative, import.meta.url), "utf8"));
}

const definitions = {
  "incident-response": {
    artifact: "../../../sources/incident-response/fixtures/incident-state.example.json",
    schema: "../../../sources/incident-response/schemas/incident-state.schema.json",
  },
  "quality-assurance-lead": {
    artifact:
      "../../../sources/quality-assurance-lead/fixtures/test-evidence.example.json",
    schema:
      "../../../sources/quality-assurance-lead/schemas/test-evidence.schema.json",
  },
  "change-control-operator": {
    artifact:
      "../../../sources/change-control-operator/fixtures/change-plan.example.json",
    schema:
      "../../../sources/change-control-operator/schemas/change-plan.schema.json",
  },
  "repository-compliance-program-manager": {
    artifact:
      "../../../sources/repository-compliance-program-manager/fixtures/repository-compliance-program.example.json",
    schema:
      "../../../sources/repository-compliance-program-manager/schemas/repository-compliance-program.schema.json",
  },
  "case-continuity-coordinator": {
    artifact:
      "../../../sources/case-continuity-coordinator/fixtures/case-checkpoint.example.json",
    schema:
      "../../../sources/case-continuity-coordinator/schemas/case-checkpoint.schema.json",
  },
};

const proposal = await json("./accepted.json");
const sources = Object.fromEntries(
  await Promise.all(
    Object.entries(definitions).map(async ([id, paths]) => [
      id,
      {
        artifact: await json(paths.artifact),
        schema: await json(paths.schema),
      },
    ]),
  ),
);

function clone(value) {
  return structuredClone(value);
}

function typedNode(
  id,
  type,
  scopes = [],
  kind = "verified-human",
) {
  const authority = {
    kind,
    scopes: [...scopes].sort(),
    humanAssurance: kind === "verified-human" ? "verified-human" : null,
  };
  const identity = { id, type };
  const revision = { controlRevision: "future-v1" };
  return {
    id,
    type,
    identity,
    identityDigest: digest(identity),
    revision,
    revisionDigest: digest(revision),
    authorityDigest: digest(authority),
    authority,
  };
}

function typedEdge(id, from, to, type) {
  const identity = { id, from, to, type };
  const revision = { controlRevision: "future-v1" };
  const authority = { source: "future-control" };
  return {
    id,
    from,
    to,
    type,
    identity,
    identityDigest: digest(identity),
    revision,
    revisionDigest: digest(revision),
    authority,
    authorityDigest: digest(authority),
  };
}

function signTypedControl(unsigned) {
  const issuerRef = "issuer-future-control";
  const signerKeyId = "key-future-control-issuer";
  const keys = generateKeyPairSync("ed25519");
  const body = {
    schemaVersion: unsigned.schemaVersion,
    issuerRef,
    signerKeyId,
    controls: unsigned.controls,
    closure: unsigned.closure,
  };
  const controlDigest = digest(body);
  return {
    input: {
      ...body,
      controlDigest,
      signature: sign(
        null,
        Buffer.from(
          JSON.stringify({
            kind: "typedControls",
            digest: controlDigest,
          }),
          "utf8",
        ),
        keys.privateKey,
      ).toString("base64"),
    },
    keyring: {
      schemaVersion: TYPED_CONTROL_KEYRING_SCHEMA_VERSION,
      allowedIssuerRefs: [issuerRef],
      keys: [
        {
          id: signerKeyId,
          kind: "issuer",
          principalRef: null,
          issuerRef,
          keyRef: "https://awesome-claws.example/keys/future-control",
          algorithm: "ed25519",
          publicKeyPem: keys.publicKey.export({
            type: "spki",
            format: "pem",
          }),
        },
      ],
    },
  };
}

function buildWithControl(bundle) {
  return buildStrongestCompositionProbe(
    proposal,
    sources,
    bundle.input,
    bundle.keyring,
  );
}

function futureControl(lossId) {
  const universe = buildCandidateUniverse(proposal);
  const expected = universe.$requirements[lossId];
  const exact = (type) => structuredClone(universe[type] ?? []);
  const required = (type) => structuredClone(expected[type] ?? []);
  const membershipNodes = exact("incident-membership");
  const membershipIds = membershipNodes.map((node) => node.id);
  const proposalNodes = exact("hypothesis-proposal");
  const proposalIds = proposalNodes.map((node) => node.id);
  const dispositionNodes = exact("hypothesis-disposition");
  const dispositionIds = dispositionNodes.map((node) => node.id);
  const testNodes = exact("test-result");
  const testIds = testNodes.map((node) => node.id);
  const workaroundNodes = exact("workaround");
  const workaroundId = workaroundNodes[0]?.id;
  const knownErrorNodes = exact("known-error");
  const knownErrorId = knownErrorNodes[0]?.id;
  const changeNodes = exact("change-receipt");
  const changeId = changeNodes[0]?.id;
  const recurrenceNodes = exact("recurrence");
  const recurrenceId = recurrenceNodes[0]?.id;
  const controls = {
    "owner-signed-cross-incident-manifest": {
      nodes: [
        ...exact("incident-manifest"),
        ...membershipNodes,
        typedNode(
          "future:manifest-authority",
          "authority",
          ["incident-membership-declarer"],
        ),
      ],
      edges: [
        typedEdge(
          "future:manifest:covers:1",
          exact("incident-manifest")[0].id,
          membershipIds[0],
          "covers-membership",
        ),
        typedEdge(
          "future:manifest:covers:2",
          exact("incident-manifest")[0].id,
          membershipIds[1],
          "covers-membership",
        ),
        typedEdge(
          "future:manifest:covers:3",
          exact("incident-manifest")[0].id,
          membershipIds[2],
          "covers-membership",
        ),
        typedEdge(
          "future:manifest:signed",
          exact("incident-manifest")[0].id,
          "future:manifest-authority",
          "signed-by",
        ),
      ],
    },
    "hypothesis-proposal-disposition-lineage": {
      nodes: [
        ...proposalNodes,
        ...testNodes,
        ...dispositionNodes,
        typedNode(
          "future:hypothesis-authority",
          "authority",
          ["hypothesis-owner"],
        ),
      ],
      edges: [
        typedEdge(
          "future:proposal:same-problem",
          proposalIds[0],
          proposalIds[1],
          "same-problem",
        ),
        ...proposal.hypotheses.flatMap((hypothesis, index) => {
          const testIndex = proposal.tests.findIndex(
            (row) => row.hypothesisRef === hypothesis.id,
          );
          return [
            typedEdge(
              `future:proposal:test:${index}`,
              proposalIds[index],
              testIds[testIndex],
              "tested-by",
            ),
            typedEdge(
              `future:test:disposition:${index}`,
              testIds[testIndex],
              dispositionIds[index],
              "resolves",
            ),
            typedEdge(
              `future:disposition:signed:${index}`,
              dispositionIds[index],
              "future:hypothesis-authority",
              "signed-by",
            ),
          ];
        }),
      ],
    },
    "known-error-workaround-lineage": {
      nodes: [
        ...required("known-error"),
        ...required("hypothesis-disposition"),
        ...required("workaround"),
        typedNode(
          "future:known-authority",
          "authority",
          ["known-error-authority"],
        ),
        typedNode(
          "future:workaround-authority",
          "authority",
          ["workaround-approver"],
        ),
      ],
      edges: [
        typedEdge(
          "future:known:cause",
          knownErrorId,
          dispositionIds[0],
          "declares-cause",
        ),
        typedEdge(
          "future:known:workaround",
          knownErrorId,
          workaroundId,
          "uses-workaround",
        ),
        typedEdge(
          "future:known:signed",
          knownErrorId,
          "future:known-authority",
          "signed-by",
        ),
        typedEdge(
          "future:workaround:signed",
          workaroundId,
          "future:workaround-authority",
          "signed-by",
        ),
      ],
    },
    "post-change-recurrence-lineage": {
      nodes: [
        ...required("recurrence"),
        ...required("change-receipt"),
        ...required("incident-membership"),
        typedNode(
          "future:incident-authority",
          "authority",
          ["incident-record-authority"],
          "external-system",
        ),
      ],
      edges: [
        typedEdge(
          "future:recurrence:change",
          recurrenceId,
          changeId,
          "after-change",
        ),
        typedEdge(
          "future:recurrence:membership",
          recurrenceId,
          membershipIds[2],
          "in-membership",
        ),
        typedEdge(
          "future:recurrence:signed",
          recurrenceId,
          "future:incident-authority",
          "signed-by",
        ),
      ],
    },
    "closed-problem-lifecycle-coverage": {
      nodes: [
        ...exact("lifecycle-coverage"),
        ...membershipNodes,
        ...dispositionNodes,
        ...workaroundNodes,
        ...knownErrorNodes,
        ...changeNodes,
        ...recurrenceNodes,
        typedNode(
          "future:coverage-authority",
          "authority",
          ["problem-owner"],
        ),
      ],
      edges: [
        ...[
          ...membershipIds,
          ...dispositionIds,
          workaroundId,
          knownErrorId,
          changeId,
          recurrenceId,
        ].map((targetId, index) =>
          typedEdge(
            `future:coverage:${index + 1}`,
            exact("lifecycle-coverage")[0].id,
            targetId,
            "covers",
          ),
        ),
        typedEdge(
          "future:coverage:signed",
          exact("lifecycle-coverage")[0].id,
          "future:coverage-authority",
          "signed-by",
        ),
      ],
    },
  };
  const selected = controls[lossId];
  const control = {
    id: `control:${lossId}`,
    lossId,
    nodes: selected.nodes,
    edges: selected.edges,
  };
  return signTypedControl({
    schemaVersion: TYPED_CONTROL_SCHEMA_VERSION,
    controls: [control],
    closure: {
      nodeRefs: selected.nodes.map((node) => node.id),
      edgeRefs: selected.edges.map((edge) => edge.id),
    },
  });
}

test("all five owner artifacts are schema and semantic valid at their pinned digests", () => {
  for (const [id, source] of Object.entries(sources)) {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const validateSchema = ajv.compile(source.schema);
    assert.equal(
      validateSchema(source.artifact),
      true,
      `${id}: ${ajv.errorsText(validateSchema.errors)}`,
    );
    assert.deepEqual(
      validateArtifactSemantics(
        id,
        source.artifact,
        artifactSemanticValidationOptions(id),
      ),
      [],
      id,
    );
    assert.equal(digest(source.artifact), OWNER_CONTRACTS[id].artifactDigest);
    assert.equal(digest(source.schema), OWNER_CONTRACTS[id].schemaDigest);
  }

  const incidentSchema = sources["incident-response"].schema;
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validateIncident = ajv.compile(incidentSchema);
  const variants = proposal.incidentMemberships.map((membership) =>
    deriveIncidentArtifact(
      sources["incident-response"].artifact,
      membership,
    ),
  );
  assert.equal(new Set(variants.map((row) => row.incident.id)).size, 3);
  for (const [index, variant] of variants.entries()) {
    assert.equal(
      validateIncident(variant),
      true,
      ajv.errorsText(validateIncident.errors),
    );
    assert.deepEqual(
      validateArtifactSemantics("incident-response", variant),
      [],
    );
    assert.equal(
      variant.incident.id,
      proposal.incidentMemberships[index].incidentRef,
    );
    assert.equal(
      variant.followUps[0].id,
      proposal.incidentMemberships[index].followUpRef,
    );
    assert.equal(
      variant.followUps[0].identityKey,
      proposal.incidentMemberships[index].followUpIdentityKey,
    );
  }

  const overlappingIdentity = {
    ...proposal.incidentMemberships[0],
    incidentRef: "inc-2048-extra",
  };
  const overlappingVariant = deriveIncidentArtifact(
    sources["incident-response"].artifact,
    overlappingIdentity,
  );
  assert.equal(overlappingVariant.incident.id, "inc-2048-extra");
});

test("source-derived projection round-trips exact owner contract surfaces", () => {
  const probe = buildStrongestCompositionProbe(proposal, sources);
  const roundTripped = roundTripOwnerProjection(
    probe,
    sources,
    proposal,
  );
  assert.equal(
    canonicalJson(roundTripped),
    canonicalJson(probe.sourceProjection),
  );
  assert.deepEqual(
    roundTripped["incident-response"].identity.followUp,
    {
      id: sources["incident-response"].artifact.followUps[0].id,
      identityKey:
        sources["incident-response"].artifact.followUps[0].identityKey,
      incidentRef:
        sources["incident-response"].artifact.followUps[0].incidentRef,
    },
  );
});

test("strongest composition reports concrete typed lineage losses", () => {
  const probe = buildStrongestCompositionProbe(proposal, sources);
  assert.deepEqual(
    probe.lostTypedInvariants.map((row) => row.id),
    [
      "owner-signed-cross-incident-manifest",
      "hypothesis-proposal-disposition-lineage",
      "known-error-workaround-lineage",
      "post-change-recurrence-lineage",
      "closed-problem-lifecycle-coverage",
    ],
  );
  assert.throws(
    () => requireLosslessProposalComposition(probe),
    /Composition loses typed invariants/u,
  );

  const unrelatedProposal = clone(proposal);
  unrelatedProposal.incidentMemberships[0].incidentRef =
    "incident-not-in-owner-artifact";
  assert.throws(
    () => buildStrongestCompositionProbe(unrelatedProposal, sources),
    /does not preserve membership identity/u,
  );
});

test("one closed typed future control independently clears each graph loss", () => {
  const baseline = buildStrongestCompositionProbe(proposal, sources);
  const lossIds = baseline.operationalComparisons.map((row) => row.id);
  assert.equal(
    baseline.operationalComparisons.every((row) => !row.preserved),
    true,
  );

  for (const lossId of lossIds) {
    const controls = futureControl(lossId);
    const probe = buildWithControl(controls);
    assert.equal(
      probe.operationalComparisons.find((row) => row.id === lossId)
        .preserved,
      true,
      lossId,
    );
    assert.equal(
      canonicalJson(
        roundTripOwnerProjection(
          probe,
          sources,
          proposal,
          controls.input,
          controls.keyring,
        ),
      ),
      canonicalJson(probe.sourceProjection),
      lossId,
    );
    assert.equal(
      canonicalJson(probe.sourceBindings),
      canonicalJson(baseline.sourceBindings),
      lossId,
    );
  }
});

test("typed controls bind exact identity revision authority and closure", () => {
  const controls = futureControl(
    "owner-signed-cross-incident-manifest",
  );
  for (const mutate of [
    (value) => {
      value.controls[0].nodes[0].identity.id = "drifted";
    },
    (value) => {
      value.controls[0].nodes[0].revision.controlRevision =
        "future-v2";
    },
    (value) => {
      value.controls[0].nodes.at(-1).authority.scopes = [];
    },
    (value) => {
      value.controls[0].nodes[0].type = "known-error";
    },
    (value) => {
      value.controls[0].edges[0].type = "uses-workaround";
    },
    (value) => {
      value.controls[0].edges[0].from = "future:membership:1";
      value.controls[0].edges[0].identity = {
        ...value.controls[0].edges[0].identity,
        from: "future:membership:1",
      };
      value.controls[0].edges[0].identityDigest = digest(
        value.controls[0].edges[0].identity,
      );
    },
    (value) => {
      value.controls[0].edges[0].identity = null;
    },
    (value) => {
      value.controls[0].edges[0].revision = null;
    },
    (value) => {
      value.controls[0].edges[0].authority = null;
    },
    (value) => {
      value.closure.nodeRefs.pop();
    },
    (value) => {
      value.controls[0].edges[0].to = "missing-node";
      value.controls[0].edges[0].identity = {
        ...value.controls[0].edges[0].identity,
        to: "missing-node",
      };
      value.controls[0].edges[0].identityDigest = digest(
        value.controls[0].edges[0].identity,
      );
    },
  ]) {
    const changed = clone(controls.input);
    mutate(changed);
    assert.throws(() =>
      buildStrongestCompositionProbe(
        proposal,
        sources,
        changed,
        controls.keyring,
      ),
    );
  }

  const collision = futureControl(
    "owner-signed-cross-incident-manifest",
  );
  const baseline = buildStrongestCompositionProbe(proposal, sources);
  const collidedNode = collision.input.controls[0].nodes[0];
  const originalId = collidedNode.id;
  collidedNode.id = baseline.graph.nodes[0].id;
  collidedNode.identity.id = collidedNode.id;
  collidedNode.identityDigest = digest(collidedNode.identity);
  for (const edge of collision.input.controls[0].edges) {
    if (edge.from === originalId) edge.from = collidedNode.id;
    if (edge.to === originalId) edge.to = collidedNode.id;
    edge.identity = {
      id: edge.id,
      from: edge.from,
      to: edge.to,
      type: edge.type,
    };
    edge.identityDigest = digest(edge.identity);
  }
  collision.input.closure.nodeRefs = collision.input.controls[0].nodes.map(
    (node) => node.id,
  );
  const resignedCollision = signTypedControl(collision.input);
  assert.throws(
    () => buildWithControl(resignedCollision),
    /closure|duplicated/u,
  );

  const crossedLineage = futureControl(
    "hypothesis-proposal-disposition-lineage",
  );
  const testedByEdges = crossedLineage.input.controls[0].edges.filter(
    (edge) => edge.type === "tested-by",
  );
  [testedByEdges[0].to, testedByEdges[1].to] = [
    testedByEdges[1].to,
    testedByEdges[0].to,
  ];
  for (const edge of testedByEdges) {
    edge.identity = {
      id: edge.id,
      from: edge.from,
      to: edge.to,
      type: edge.type,
    };
    edge.identityDigest = digest(edge.identity);
  }
  const resignedCrossedLineage = signTypedControl(crossedLineage.input);
  assert.throws(
    () => buildWithControl(resignedCrossedLineage),
    /does not bind its referenced records/u,
  );

  for (const mutate of [
    (value) => {
      const node = value.controls[0].nodes[0];
      node.identity.recordId = "different-manifest";
      node.identityDigest = digest(node.identity);
    },
    (value) => {
      const node = value.controls[0].nodes[0];
      node.revision.revision =
        "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      node.revisionDigest = digest(node.revision);
    },
  ]) {
    const changed = futureControl(
      "owner-signed-cross-incident-manifest",
    );
    mutate(changed.input);
    const probe = buildWithControl(signTypedControl(changed.input));
    assert.equal(
      probe.operationalComparisons.find(
        (row) => row.id === "owner-signed-cross-incident-manifest",
      ).preserved,
      false,
    );
  }

  const invalidAuthority = futureControl(
    "owner-signed-cross-incident-manifest",
  );
  const authorityNode = invalidAuthority.input.controls[0].nodes.at(-1);
  authorityNode.authority.scopes = [];
  authorityNode.authorityDigest = digest(authorityNode.authority);
  const resignedInvalidAuthority = signTypedControl(
    invalidAuthority.input,
  );
  assert.throws(
    () => buildWithControl(resignedInvalidAuthority),
    /does not bind its referenced records/u,
  );
});

test("typed graph cannot combine disconnected manifests into one invariant", () => {
  const universe = buildCandidateUniverse(proposal);
  const memberships = structuredClone(universe["incident-membership"]);
  const manifests = memberships.map((membership, index) => {
    const node = typedNode(
      `split:manifest:${index + 1}`,
      "incident-manifest",
      ["incident-membership-declarer"],
    );
    node.revision = {
      membershipRevisionRefs: [membership.revision.revision],
    };
    node.revisionDigest = digest(node.revision);
    return node;
  });
  const authority = typedNode(
    "split:manifest-authority",
    "authority",
    ["incident-membership-declarer"],
  );
  const edges = [
    ...manifests.map((manifest, index) =>
      typedEdge(
        `split:covers:${index + 1}`,
        manifest.id,
        memberships[index].id,
        "covers-membership",
      ),
    ),
    typedEdge(
      "split:signed",
      manifests[0].id,
      authority.id,
      "signed-by",
    ),
  ];
  const control = signTypedControl({
    schemaVersion: TYPED_CONTROL_SCHEMA_VERSION,
    controls: [
      {
        id: "control:split-manifests",
        lossId: "owner-signed-cross-incident-manifest",
        nodes: [...manifests, ...memberships, authority],
        edges,
      },
    ],
    closure: {
      nodeRefs: [...manifests, ...memberships, authority].map(
        (node) => node.id,
      ),
      edgeRefs: edges.map((edge) => edge.id),
    },
  });
  const probe = buildWithControl(control);
  assert.equal(
    probe.operationalComparisons.find(
      (row) => row.id === "owner-signed-cross-incident-manifest",
    ).preserved,
    false,
  );
});

test("typed controls cannot affect a loss they do not declare", () => {
  const mislabeled = futureControl(
    "owner-signed-cross-incident-manifest",
  );
  mislabeled.input.controls[0].lossId =
    "known-error-workaround-lineage";
  const resigned = signTypedControl(mislabeled.input);
  const probe = buildWithControl(resigned);
  assert.equal(
    probe.operationalComparisons.find(
      (row) => row.id === "owner-signed-cross-incident-manifest",
    ).preserved,
    false,
  );
  assert.equal(
    probe.operationalComparisons.find(
      (row) => row.id === "known-error-workaround-lineage",
    ).preserved,
    false,
  );
});

test("composition fails closed on owner artifact and follow-up drift", () => {
  const probe = buildStrongestCompositionProbe(proposal, sources);
  const changedFollowUp = clone(sources);
  changedFollowUp["incident-response"].artifact.followUps[0].identityKey =
    "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
  assert.throws(
    () =>
      roundTripOwnerProjection(
        probe,
        changedFollowUp,
        proposal,
      ),
    /complete pinned contract/u,
  );

  const invalidDerivedArtifact = clone(proposal);
  invalidDerivedArtifact.incidentMemberships[0].followUpRef =
    "follow-up.invalid";
  assert.throws(
    () => buildStrongestCompositionProbe(invalidDerivedArtifact, sources),
    /not schema and semantic valid/u,
  );
});
