import { createPublicKey, verify as verifySignature } from "node:crypto";

export const TYPED_CONTROL_SCHEMA_VERSION =
  "awesomeClaws.problemKnownErrorTypedControls.v1";
export const TYPED_CONTROL_KEYRING_SCHEMA_VERSION =
  "awesomeClaws.problemKnownErrorTypedControlKeyring.v1";

const REQUIREMENTS = Object.freeze([
  {
    id: "owner-signed-cross-incident-manifest",
    nodes: [
      ["incident-manifest", 1],
      ["incident-membership", 3],
    ],
    paths: [
      ["incident-manifest", "incident-membership", ["covers-membership"], 3],
    ],
    authority: [
      [
        "incident-manifest",
        "incident-membership-declarer",
        "verified-human",
      ],
    ],
  },
  {
    id: "hypothesis-proposal-disposition-lineage",
    nodes: [
      ["hypothesis-proposal", 1],
      ["test-result", 1],
      ["hypothesis-disposition", 1],
    ],
    paths: [
      ["hypothesis-proposal", "test-result", ["tested-by"], 1],
      ["hypothesis-proposal", "hypothesis-proposal", ["same-problem"], 2],
      ["test-result", "hypothesis-disposition", ["resolves"], 1],
    ],
    authority: [
      ["hypothesis-disposition", "hypothesis-owner", "verified-human"],
    ],
  },
  {
    id: "known-error-workaround-lineage",
    nodes: [
      ["known-error", 1],
      ["hypothesis-disposition", 1],
      ["workaround", 1],
    ],
    paths: [
      ["known-error", "hypothesis-disposition", ["declares-cause"], 1],
      ["known-error", "workaround", ["uses-workaround"], 1],
    ],
    authority: [
      ["known-error", "known-error-authority", "verified-human"],
      ["workaround", "workaround-approver", "verified-human"],
    ],
  },
  {
    id: "post-change-recurrence-lineage",
    nodes: [
      ["recurrence", 1],
      ["change-receipt", 1],
      ["incident-membership", 1],
    ],
    paths: [
      ["recurrence", "change-receipt", ["after-change"], 1],
      ["recurrence", "incident-membership", ["in-membership"], 1],
    ],
    authority: [
      ["recurrence", "incident-record-authority", "external-system"],
    ],
  },
  {
    id: "closed-problem-lifecycle-coverage",
    nodes: [["lifecycle-coverage", 1]],
    paths: [
      ["lifecycle-coverage", "incident-membership", ["covers"], 1],
      ["lifecycle-coverage", "hypothesis-disposition", ["covers"], 1],
      ["lifecycle-coverage", "workaround", ["covers"], 1],
      ["lifecycle-coverage", "known-error", ["covers"], 1],
      ["lifecycle-coverage", "change-receipt", ["covers"], 1],
      ["lifecycle-coverage", "recurrence", ["covers"], 1],
    ],
    authority: [
      ["lifecycle-coverage", "problem-owner", "verified-human"],
    ],
  },
]);

const EDGE_ENDPOINT_TYPES = Object.freeze({
  "after-change": [["recurrence", "change-receipt"]],
  "authorized-by": [
    ["incident-manifest", "authority"],
    ["hypothesis-disposition", "authority"],
    ["known-error", "authority"],
    ["workaround", "authority"],
    ["recurrence", "authority"],
    ["lifecycle-coverage", "authority"],
  ],
  covers: [
    ["lifecycle-coverage", "incident-membership"],
    ["lifecycle-coverage", "hypothesis-disposition"],
    ["lifecycle-coverage", "workaround"],
    ["lifecycle-coverage", "known-error"],
    ["lifecycle-coverage", "change-receipt"],
    ["lifecycle-coverage", "recurrence"],
  ],
  "covers-membership": [["incident-manifest", "incident-membership"]],
  "declares-cause": [["known-error", "hypothesis-disposition"]],
  "has-follow-up": [["incident-record", "incident-follow-up"]],
  "in-membership": [["recurrence", "incident-membership"]],
  "owner-executed": [["change-plan", "change-execution"]],
  predecessor: [["continuity-checkpoint", "continuity-checkpoint"]],
  "signed-by": [
    ["incident-manifest", "authority"],
    ["hypothesis-disposition", "authority"],
    ["known-error", "authority"],
    ["workaround", "authority"],
    ["recurrence", "authority"],
    ["lifecycle-coverage", "authority"],
  ],
  "same-problem": [["hypothesis-proposal", "hypothesis-proposal"]],
  "tested-by": [["hypothesis-proposal", "test-result"]],
  resolves: [["test-result", "hypothesis-disposition"]],
  "uses-workaround": [["known-error", "workaround"]],
});

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

function fail(message) {
  throw new Error(message);
}

function assertDigest(value, path) {
  if (!/^sha256:[a-f0-9]{64}$/u.test(value ?? "")) {
    fail(`${path} must be a SHA-256 digest.`);
  }
}

function validateNode(node, path, digest) {
  if (
    !exactKeys(node, [
      "id",
      "type",
      "identity",
      "identityDigest",
      "revision",
      "revisionDigest",
      "authorityDigest",
      "authority",
    ]) ||
    typeof node.id !== "string" ||
    typeof node.type !== "string" ||
    !isRecord(node.authority) ||
    !isRecord(node.identity) ||
    !isRecord(node.revision) ||
    !exactKeys(node.authority, ["kind", "scopes", "humanAssurance"]) ||
    typeof node.authority.kind !== "string" ||
    node.identity.id !== node.id ||
    node.identity.type !== node.type ||
    !Array.isArray(node.authority.scopes) ||
    !node.authority.scopes.every((scope) => typeof scope === "string") ||
    ![null, "verified-human"].includes(node.authority.humanAssurance)
  ) {
    fail(`${path} has an invalid typed node shape.`);
  }
  assertDigest(node.identityDigest, `${path}.identityDigest`);
  assertDigest(node.revisionDigest, `${path}.revisionDigest`);
  assertDigest(node.authorityDigest, `${path}.authorityDigest`);
  if (
    node.identityDigest !== digest(node.identity) ||
    node.revisionDigest !== digest(node.revision) ||
    node.authorityDigest !== digest(node.authority)
  ) {
    fail(`${path} content digests do not match the typed node.`);
  }
}

function validateEdge(edge, path, digest) {
  if (
    !exactKeys(edge, [
      "id",
      "from",
      "to",
      "type",
      "identity",
      "identityDigest",
      "revision",
      "revisionDigest",
      "authority",
      "authorityDigest",
    ]) ||
    !["id", "from", "to", "type"].every(
      (field) => typeof edge[field] === "string",
    ) ||
    !isRecord(edge.identity) ||
    !isRecord(edge.revision) ||
    !isRecord(edge.authority) ||
    edge.identity.id !== edge.id ||
    edge.identity.from !== edge.from ||
    edge.identity.to !== edge.to ||
    edge.identity.type !== edge.type
  ) {
    fail(`${path} has an invalid typed edge shape.`);
  }
  assertDigest(edge.identityDigest, `${path}.identityDigest`);
  assertDigest(edge.revisionDigest, `${path}.revisionDigest`);
  assertDigest(edge.authorityDigest, `${path}.authorityDigest`);
  if (
    edge.identityDigest !== digest(edge.identity) ||
    edge.revisionDigest !== digest(edge.revision) ||
    edge.authorityDigest !== digest(edge.authority)
  ) {
    fail(`${path} content digests do not match the typed edge.`);
  }
}

function edgeSemanticallyMatches(edge, from, to) {
  if (edge.type === "covers-membership") {
    return from.revision.membershipRevisionRefs?.includes(
      to.revision.revision,
    );
  }
  if (edge.type === "same-problem") {
    return (
      from.identity.problemRevision === to.identity.problemRevision
    );
  }
  if (edge.type === "tested-by") {
    return (
      from.identity.recordId === to.identity.hypothesisRef &&
      to.revision.hypothesisRevisionRef === from.revision.revision
    );
  }
  if (edge.type === "resolves") {
    return (
      from.identity.hypothesisRef === to.identity.recordId &&
      to.revision.testRevisionRefs?.includes(from.revision.revision)
    );
  }
  if (edge.type === "declares-cause") {
    return (
      from.identity.causeHypothesisRef === to.identity.recordId &&
      from.revision.causeHypothesisDispositionRevisionRef ===
        to.revision.revision
    );
  }
  if (edge.type === "uses-workaround") {
    return (
      from.identity.workaroundRef === to.identity.recordId &&
      from.revision.workaroundRevisionRef === to.revision.revision
    );
  }
  if (edge.type === "after-change") {
    return (
      from.identity.changeReceiptRef === to.identity.recordId &&
      from.revision.changeReceiptRevisionRef === to.revision.revision
    );
  }
  if (edge.type === "in-membership") {
    return (
      from.identity.incidentMembershipRef === to.identity.recordId &&
      from.revision.incidentMembershipRevisionRef ===
        to.revision.revision
    );
  }
  if (edge.type === "covers") {
    const coverage = from.revision.coverage;
    const expectedByType = {
      "incident-membership": coverage?.incidentMembershipRefs,
      "hypothesis-disposition":
        coverage?.hypothesisDispositionRevisionRefs,
      workaround: coverage?.workaroundRevisionRefs,
      "known-error": coverage?.knownErrorRevisionRefs,
      "change-receipt": coverage?.changeReceiptRefs,
      recurrence: coverage?.recurrenceRefs,
    };
    const expected = expectedByType[to.type];
    const actual = [
      "hypothesis-disposition",
      "workaround",
      "known-error",
    ].includes(to.type)
      ? to.revision.revision
      : to.identity.recordId;
    return Array.isArray(expected) && expected.includes(actual);
  }
  if (["signed-by", "authorized-by"].includes(edge.type)) {
    return from.authorityDigest === to.authorityDigest;
  }
  if (edge.type === "has-follow-up") {
    return (
      from.identity.incidentRef === to.identity.incidentRef
    );
  }
  if (edge.type === "owner-executed") {
    return (
      from.revision.planDigest === to.revision.planDigest
    );
  }
  if (edge.type === "predecessor") {
    return (
      from.revision.previousRef === to.identity.recordId
    );
  }
  return false;
}

export function normalizeTypedControlInput(
  input,
  baseNodes,
  baseEdgeIds,
  digest,
  keyring,
) {
  const baseNodeIds = baseNodes.map((node) => node.id);
  const value =
    input ??
    {
      schemaVersion: TYPED_CONTROL_SCHEMA_VERSION,
      issuerRef: null,
      signerKeyId: null,
      controls: [],
      closure: { nodeRefs: [], edgeRefs: [] },
      controlDigest: null,
      signature: null,
    };
  if (
    !exactKeys(value, [
      "schemaVersion",
      "issuerRef",
      "signerKeyId",
      "controls",
      "closure",
      "controlDigest",
      "signature",
    ]) ||
    value.schemaVersion !== TYPED_CONTROL_SCHEMA_VERSION ||
    !Array.isArray(value.controls) ||
    !isRecord(value.closure) ||
    !exactKeys(value.closure, ["nodeRefs", "edgeRefs"]) ||
    !Array.isArray(value.closure.nodeRefs) ||
    !Array.isArray(value.closure.edgeRefs)
  ) {
    fail("Typed-control input must use the closed v1 shape.");
  }
  if (value.controls.length > 0) {
    if (
      !exactKeys(keyring, [
        "schemaVersion",
        "allowedIssuerRefs",
        "keys",
      ]) ||
      keyring.schemaVersion !== TYPED_CONTROL_KEYRING_SCHEMA_VERSION ||
      !Array.isArray(keyring.allowedIssuerRefs) ||
      !Array.isArray(keyring.keys)
    ) {
      fail("Typed-control input requires a caller-supplied keyring.");
    }
    const keyIds = keyring.keys.map((key) => key.id);
    const signer = keyring.keys.find(
      (key) => key.id === value.signerKeyId,
    );
    const signedBody = {
      schemaVersion: value.schemaVersion,
      issuerRef: value.issuerRef,
      signerKeyId: value.signerKeyId,
      controls: value.controls,
      closure: value.closure,
    };
    let signatureValid = false;
    try {
      const parsedKey = createPublicKey(signer?.publicKeyPem);
      signatureValid =
        parsedKey.asymmetricKeyType === "ed25519" &&
        verifySignature(
          null,
          Buffer.from(
            JSON.stringify({
              kind: "typedControls",
              digest: digest(signedBody),
            }),
            "utf8",
          ),
          parsedKey,
          Buffer.from(value.signature ?? "", "base64"),
        );
    } catch {
      signatureValid = false;
    }
    if (
      new Set(keyIds).size !== keyIds.length ||
      !keyring.allowedIssuerRefs.includes(value.issuerRef) ||
      signer?.kind !== "issuer" ||
      signer?.issuerRef !== value.issuerRef ||
      signer?.algorithm !== "ed25519" ||
      value.controlDigest !== digest(signedBody) ||
      !signatureValid
    ) {
      fail("Typed-control signature is not trusted.");
    }
  } else if (
    value.issuerRef !== null ||
    value.signerKeyId !== null ||
    value.controlDigest !== null ||
    value.signature !== null
  ) {
    fail("Empty typed-control input cannot claim a signature.");
  }
  const nodes = [];
  const edges = [];
  const nodeLossIds = {};
  const edgeLossIds = {};
  const controlIds = new Set();
  for (const [index, control] of value.controls.entries()) {
    if (
      !exactKeys(control, ["id", "lossId", "nodes", "edges"]) ||
      typeof control.id !== "string" ||
      !REQUIREMENTS.some((requirement) => requirement.id === control.lossId) ||
      !Array.isArray(control.nodes) ||
      !Array.isArray(control.edges) ||
      controlIds.has(control.id)
    ) {
      fail(`controls[${index}] is invalid or duplicated.`);
    }
    controlIds.add(control.id);
    control.nodes.forEach((node, nodeIndex) => {
      validateNode(
        node,
        `controls[${index}].nodes[${nodeIndex}]`,
        digest,
      );
      nodes.push(node);
      nodeLossIds[node.id] = control.lossId;
    });
    control.edges.forEach((edge, edgeIndex) => {
      validateEdge(
        edge,
        `controls[${index}].edges[${edgeIndex}]`,
        digest,
      );
      edges.push(edge);
      edgeLossIds[edge.id] = control.lossId;
    });
  }
  const nodeIds = nodes.map((node) => node.id);
  const edgeIds = edges.map((edge) => edge.id);
  const baseNodeIdSet = new Set(baseNodeIds);
  const baseEdgeIdSet = new Set(baseEdgeIds);
  if (
    new Set(nodeIds).size !== nodeIds.length ||
    new Set(edgeIds).size !== edgeIds.length ||
    nodeIds.some((id) => baseNodeIdSet.has(id)) ||
    edgeIds.some((id) => baseEdgeIdSet.has(id)) ||
    new Set(value.closure.nodeRefs).size !== value.closure.nodeRefs.length ||
    new Set(value.closure.edgeRefs).size !== value.closure.edgeRefs.length ||
    [...nodeIds].sort().join("\0") !==
      [...value.closure.nodeRefs].sort().join("\0") ||
    [...edgeIds].sort().join("\0") !==
      [...value.closure.edgeRefs].sort().join("\0")
  ) {
    fail("Typed-control closure must exactly enumerate unique nodes and edges.");
  }
  const allNodeIds = new Set([...baseNodeIds, ...nodeIds]);
  const allNodeTypes = new Map(
    [
      ...baseNodes.map((node) => [node.id, node.type]),
      ...nodes.map((node) => [node.id, node.type]),
    ],
  );
  const allNodes = new Map(
    [...baseNodes, ...nodes].map((node) => [node.id, node]),
  );
  for (const edge of edges) {
    if (!allNodeIds.has(edge.from) || !allNodeIds.has(edge.to)) {
      fail(`Typed-control edge ${edge.id} has an unresolved endpoint.`);
    }
    const allowedEndpoints = EDGE_ENDPOINT_TYPES[edge.type];
    const fromType = allNodeTypes.get(edge.from);
    const toType = allNodeTypes.get(edge.to);
    if (
      !allowedEndpoints ||
      !allowedEndpoints.some(
        ([allowedFrom, allowedTo]) =>
          fromType === allowedFrom && toType === allowedTo,
      )
    ) {
      fail(`Typed-control edge ${edge.id} has invalid endpoint types.`);
    }
    if (
      !edgeSemanticallyMatches(
        edge,
        allNodes.get(edge.from),
        allNodes.get(edge.to),
      )
    ) {
      fail(`Typed-control edge ${edge.id} does not bind its referenced records.`);
    }
  }
  return {
    schemaVersion: value.schemaVersion,
    controls: structuredClone(value.controls),
    closure: structuredClone(value.closure),
    nodes: structuredClone(nodes),
    edges: structuredClone(edges),
    nodeLossIds,
    edgeLossIds,
    digest: digest(value),
  };
}

function reachableTargets(graph, source, targetType, edgeTypes) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const adjacency = new Map();
  for (const edge of graph.edges) {
    if (!edgeTypes.includes(edge.type)) continue;
    const rows = adjacency.get(edge.from) ?? [];
    rows.push(edge.to);
    adjacency.set(edge.from, rows);
  }
  const reached = new Set(
    source.type === targetType ? [source.id] : [],
  );
  const pending = [source.id];
  while (pending.length > 0) {
    const current = pending.shift();
    for (const next of adjacency.get(current) ?? []) {
      if (reached.has(next)) continue;
      reached.add(next);
      pending.push(next);
    }
  }
  return [...reached]
    .map((id) => nodeById.get(id))
    .filter((node) => node?.type === targetType);
}

function reachableComponent(graph, anchor, edgeTypes) {
  const adjacency = new Map();
  for (const edge of graph.edges) {
    if (!edgeTypes.includes(edge.type)) continue;
    const rows = adjacency.get(edge.from) ?? [];
    rows.push(edge.to);
    adjacency.set(edge.from, rows);
  }
  const reached = new Set([anchor.id]);
  const pending = [anchor.id];
  while (pending.length > 0) {
    const current = pending.shift();
    for (const next of adjacency.get(current) ?? []) {
      if (reached.has(next)) continue;
      reached.add(next);
      pending.push(next);
    }
  }
  return reached;
}

function authoritySatisfied(
  graph,
  componentIds,
  sourceType,
  scope,
  assurance,
) {
  const sources = graph.nodes.filter(
    (node) => componentIds.has(node.id) && node.type === sourceType,
  );
  return (
    sources.length > 0 &&
    sources.every((source) => {
    const authorities = reachableTargets(
      graph,
      source,
      "authority",
      ["signed-by", "authorized-by"],
    );
      return authorities.some(
        (node) =>
          componentIds.has(node.id) &&
          (node.authority.kind === assurance ||
            (assurance === "verified-human" &&
              node.authority.humanAssurance === "verified-human")) &&
          node.authority.scopes.includes(scope),
      );
    })
  );
}

export function evaluateTypedCompositionGraph(
  graph,
  universeNodes = {},
) {
  const comparisons = REQUIREMENTS.map((requirement) => {
    const scopedNodeIds = new Set(
      graph.nodes
        .filter(
          (node) =>
            graph.nodeLossIds?.[node.id] === undefined ||
            graph.nodeLossIds[node.id] === requirement.id,
        )
        .map((node) => node.id),
    );
    const scopedGraph = {
      nodes: graph.nodes.filter((node) => scopedNodeIds.has(node.id)),
      edges: graph.edges.filter(
        (edge) =>
          (graph.edgeLossIds?.[edge.id] === undefined ||
            graph.edgeLossIds[edge.id] === requirement.id) &&
          scopedNodeIds.has(edge.from) &&
          scopedNodeIds.has(edge.to),
      ),
    };
    const exactUniverseTypes = {
      "owner-signed-cross-incident-manifest": [
        "incident-manifest",
        "incident-membership",
      ],
      "hypothesis-proposal-disposition-lineage": [
        "hypothesis-proposal",
        "test-result",
        "hypothesis-disposition",
      ],
      "known-error-workaround-lineage": [
        "known-error",
        "hypothesis-disposition",
        "workaround",
      ],
      "post-change-recurrence-lineage": [
        "recurrence",
        "change-receipt",
        "incident-membership",
      ],
      "closed-problem-lifecycle-coverage": [
        "lifecycle-coverage",
        "incident-membership",
        "hypothesis-disposition",
        "workaround",
        "known-error",
        "change-receipt",
        "recurrence",
      ],
    }[requirement.id] ?? [];
    const anchorType = requirement.nodes[0][0];
    const componentEdgeTypes = [
      ...new Set([
        ...requirement.paths.flatMap(([, , edgeTypes]) => edgeTypes),
        "signed-by",
        "authorized-by",
      ]),
    ];
    const anchorCalculations = scopedGraph.nodes
      .filter((node) => node.type === anchorType)
      .map((anchor) => {
        const componentIds = reachableComponent(
          scopedGraph,
          anchor,
          componentEdgeTypes,
        );
        const componentNodes = scopedGraph.nodes.filter((node) =>
          componentIds.has(node.id),
        );
        const nodeCalculations = requirement.nodes.map(([type, minimum]) => {
          const actualNodes = componentNodes.filter(
            (node) => node.type === type,
          );
          const expectedNodes = exactUniverseTypes.includes(type)
            ? universeNodes.$requirements?.[requirement.id]?.[type] ??
              universeNodes[type]
            : undefined;
          const satisfied = Array.isArray(expectedNodes)
            ? expectedNodes.length >= minimum &&
              actualNodes.length === expectedNodes.length &&
              expectedNodes.every((expected) =>
                actualNodes.some(
                  (node) =>
                    node.id === expected.id &&
                    node.identityDigest === expected.identityDigest &&
                    node.revisionDigest === expected.revisionDigest &&
                    node.authorityDigest === expected.authorityDigest,
                ),
              )
            : actualNodes.length >= minimum;
          return {
            type,
            minimum,
            actual: actualNodes.length,
            expectedIds:
              expectedNodes?.map((node) => node.id) ?? null,
            satisfied,
          };
        });
        const pathCalculations = requirement.paths.map(
          ([fromType, toType, edgeTypes, minimumTargets]) => {
            const sources = componentNodes.filter(
              (node) => node.type === fromType,
            );
            const targets = new Set(
              sources.flatMap((source) =>
                reachableTargets(scopedGraph, source, toType, edgeTypes)
                  .filter((node) => componentIds.has(node.id))
                  .map((node) => node.id),
              ),
            );
            const expectedNodes = exactUniverseTypes.includes(toType)
              ? universeNodes.$requirements?.[requirement.id]?.[
                  toType
                ] ?? universeNodes[toType]
              : undefined;
            const targetNodes = componentNodes.filter((node) =>
              targets.has(node.id),
            );
            const satisfied = Array.isArray(expectedNodes)
              ? expectedNodes.length >= minimumTargets &&
                targetNodes.length === expectedNodes.length &&
                expectedNodes.every((expected) =>
                  targetNodes.some(
                    (node) =>
                      node.id === expected.id &&
                      node.identityDigest === expected.identityDigest &&
                      node.revisionDigest === expected.revisionDigest &&
                      node.authorityDigest === expected.authorityDigest,
                  ),
                )
              : targets.size >= minimumTargets;
            return {
              fromType,
              toType,
              edgeTypes,
              minimumTargets,
              actualTargets: targets.size,
              expectedIds:
                expectedNodes?.map((node) => node.id) ?? null,
              satisfied,
            };
          },
        );
        const authorityCalculations = requirement.authority.map(
          ([sourceType, scope, assurance]) => ({
            sourceType,
            scope,
            assurance,
            satisfied: authoritySatisfied(
              scopedGraph,
              componentIds,
              sourceType,
              scope,
              assurance,
            ),
          }),
        );
        return {
          anchorRef: anchor.id,
          preserved: [
            ...nodeCalculations,
            ...pathCalculations,
            ...authorityCalculations,
          ].every((row) => row.satisfied),
          nodeCalculations,
          pathCalculations,
          authorityCalculations,
        };
      });
    const selected =
      anchorCalculations.find((row) => row.preserved) ??
      anchorCalculations[0] ?? {
        preserved: false,
        nodeCalculations: [],
        pathCalculations: [],
        authorityCalculations: [],
      };
    return {
      id: requirement.id,
      preserved: anchorCalculations.some((row) => row.preserved),
      anchorCalculations,
      nodeCalculations: selected.nodeCalculations,
      pathCalculations: selected.pathCalculations,
      authorityCalculations: selected.authorityCalculations,
    };
  });
  return comparisons;
}
