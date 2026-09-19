import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { validateArtifactSemantics } from "../../scripts/artifact-semantics.mjs";
import { buildCatalogQualityScorecard } from "../../scripts/catalog-quality-score.mjs";
import { readCatalog, root } from "../../scripts/catalog-source.mjs";
import {
  contributionSimilarityReport,
  validateContributionProposal,
} from "../../scripts/contribution-lib.mjs";
import { readExperienceCases } from "../../scripts/experience-cases.mjs";
import { loadMockPlusContext } from "../../scripts/mock-plus-lib.mjs";
import { readRegressionCases, runRepositoryRegressionCases } from "../../scripts/regression-cases.mjs";
import { repositoryComplianceProgramFindings } from "../../scripts/repository-compliance-program-manager.mjs";
import { repositoryOperationsFindings } from "../../scripts/repository-operations-manager.mjs";
import {
  buildScenarios,
  preflightBudgets,
  readRuntimeProfile,
} from "../../scripts/runtime-evidence-lib.mjs";
import {
  JSON_LIMITS,
  normalizeJsonValue,
} from "./candidate-utils.mjs";

export const COMPOSITION_GRAPH_VERSION =
  "awesomeClaws.clawPortfolioCompositionGraph.v2";
export const PINNED_FUTURE_CONTROL_PUBLIC_KEY_PEM =
  "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAomPvkZFjjhEfFKCMJ9JQrCtfGP2BwqgBk1rHnvPm6rY=\n-----END PUBLIC KEY-----\n";

const ANALOGUE_IDS = Object.freeze([
  "repository-operations-manager",
  "repository-compliance-program-manager",
  "work-chief-of-staff",
]);

export const CANDIDATE_ENTRY = Object.freeze({
  id: "claw-portfolio-manager",
  name: "Claw Portfolio Manager",
  category: "operations",
  maintenance: {
    status: "active",
    maintainers: ["@giodl73-repo"],
    lastVerified: "2026-09-17",
  },
  description:
    "Stewards an owner-selected Claw portfolio by classifying exact repository issues, enforcing compose-first admission and cumulative budgets, and producing evidence-bound proposals without changing production Claws.",
  audience:
    "Owners and maintainers responsible for an evolving portfolio of repository-defined Claws.",
  principles: [
    "Treat owner manifests, provider issue snapshots, package trees, and prior checkpoints as immutable evidence",
    "Prefer improvement or composition whenever existing Claws preserve the requested operating job",
    "Optimize for portfolio outcomes and consolidation rather than raw Claw count",
    "Keep publication, mutation, budget increase, risk acceptance, and final decisions owner-controlled",
  ],
  boundaries: [
    "Do not merge, publish, mutate production Claws, increase budgets, accept risk, grant authority, or infer sensitive personal facts",
    "Do not classify from caller booleans, unauthenticated issues, incomplete portfolios, optional usage alone, or stale predecessor state",
    "Do not reserve a NEW candidate while a feasible IMPROVE or COMPOSE request would be displaced",
  ],
  intake: [
    "Owner-signed bootstrap, adoption, or management manifest selecting exact Claw package revisions",
    "Provider-signed complete issue snapshot with exact minimized title and body bytes",
    "Typed classifications or signed human decisions, bounded grants, cumulative budget lineage, and externally pinned public trust",
    "Optional owner-approved minimized usage evidence that remains advisory",
  ],
  workflow: [
    "Validate the public trust revision, signer domains, owner manifest, selected package trees, provider snapshot completeness, and predecessor lineage",
    "Decode each exact issue revision and derive a typed classification through deterministic rules or an authorized signed human decision",
    "Execute the strongest current composition graph and stop NEW whenever existing validated Claws can preserve the requested contract",
    "Allocate IMPROVE and COMPOSE before NEW under exact cumulative candidate, admission, work, cost, and duration caps",
    "Produce a versioned evidence ledger, blocked states, proposal plans, and an owner decision or pull-request handoff without external mutation",
  ],
  deliverables: [
    "Exact issue classification ledger with rationale and evidence links",
    "Affected Claw identities and package revisions",
    "Candidate, improvement, composition, product-decision, deprecation, or retirement plan",
    "Cumulative budget reservations and explicit blocked states",
    "Owner-controlled decision and pull-request-ready handoff",
  ],
  example: {
    request:
      "Adopt this signed Claw subset and reconcile its complete issue queue within the supplied cumulative budget, using optional scoped usage only as advisory evidence.",
    outcome:
      "A versioned ledger classifies every issue, proves composition feasibility first, reserves only permitted work, blocks overruns, and hands proposals to the owner without changing the catalog.",
  },
  doneWhen: [
    "Every selected package file and provider issue is covered exactly by independently authenticated complete manifests",
    "Every issue has one revision-bound typed classification, rationale, evidence set, affected Claw set, and proposal or blocked state",
    "Composition-first ordering and cumulative replay-safe budgets prevent feasible reuse from being displaced by new candidates",
    "No output grants merge, publish, mutation, budget-increase, risk-acceptance, resealing, or sensitive-inference authority",
  ],
  capabilityGuidance: [
    "Use read-only repository evidence and independently pinned public verification keys; never accept private key material or unsafe URLs.",
    "Use optional minimized usage only to inform, create, or reprioritize an issue and never to override correctness or safety.",
  ],
});

export const CANDIDATE_CONTRIBUTION = Object.freeze({
  problem:
    "Claw owners need a repeatable, evidence-bound way to bootstrap or adopt a portfolio and reconcile its complete issue queue without silently multiplying Claws or granting mutation authority.",
  repeatableJob:
    "Validate an exact owner-selected Claw portfolio and provider issue snapshot, classify every request, execute compose-first admission under cumulative budgets, and prepare owner-controlled proposals.",
  proofPlan:
    "Exercise bootstrap, adopt, and predecessor-bound management; exact issue and package coverage; typed classification; no-sidecar composition; cumulative replay-safe budgets; scoped minimized usage; and structural non-authority.",
});

function compareText(left, right) {
  return String(left) < String(right)
    ? -1
    : String(left) > String(right)
      ? 1
      : 0;
}

const PINNED_FILES = Object.freeze({
  "catalog.json":
    "sha256:a86ba7a0b72d9b8434e8dae2d0e91d5dee228d734cc3fd548b86795660140621",
  "contributions/repository-compliance-program-manager.json":
    "sha256:c2e71fedf3dd8affb947f6550e4dda5d3405678367e04c81204a73b76a6d18ff",
  "contributions/repository-operations-manager.json":
    "sha256:9fbd4093521edff574ef9479da0e157165231d631c2b8819848f0590c289a29e",
  "contributions/work-chief-of-staff.json":
    "sha256:83045be11462ef0130590e29eedd40b88711afcdbea1e73800b9465175578a65",
  "experience-cases.json":
    "sha256:54c994b15688c4b32d077392b9fef8a11bf9e4bc71bee88a66e5d76b1194c164",
  "required-lifecycle-recipes.json":
    "sha256:de691b212e818109eaf1207ec93877de1d7ce2570bd42231261f192ff25ccf76",
  "required-safety-recipes.json":
    "sha256:489786e149cab34342eeb37f0e01b5bc6b35c587fb8be4af33b8215aa4b26018",
  "required-semantic-recipes.json":
    "sha256:089ed57c43b747f120f2f237b925c4a7796fc9feaa0ad7b612f5a1b9e4737ed0",
  "scripts/artifact-validator-registry.mjs":
    "sha256:b310fbe823734a82a25b2a047bd3562a63786154ef66e4a09006abf7b93036fe",
  "scripts/capability-classes.mjs":
    "sha256:5324a3f1109c39f350e6b1947a12a7a5735be68ffec373b3b25c6e873a121709",
  "scripts/catalog-health.mjs":
    "sha256:ac46240add15fb23972ab4cdac4bc12aa36597bc29a519f6bb44f398fcab9acc",
  "scripts/catalog-source.mjs":
    "sha256:2dd71a1b35eb182d8dd6eca5fa5396a67755358f44c01a57c1bd7d2a45a35021",
  "scripts/experience-cases.mjs":
    "sha256:fcdf8a31d63fee3baf7214bf6602f5d7ed85fcf42548ad061b8f5352e047bddb",
  "scripts/portable-paths.mjs":
    "sha256:ebad03f1873a221e28f32843d163e76480bb18af263a8e1993bac157d379b40a",
  "scripts/repository-operations-manager.mjs":
    "sha256:5dd45f766a680e8c4e974acc09e74bc1770f69713dc36dccd5b4ba344851a1ea",
  "sources/repository-operations-manager/schemas/repository-operations.schema.json":
    "sha256:ed96bbfc7068e11493a75461c8c02c1fa9a6f3298de69dd5df5f3cd71baac677",
  "sources/repository-operations-manager/fixtures/repository-operations.example.json":
    "sha256:e04a703ffcbd362afa57e3e616858d3f0d0182f5de2f59ac32612883f9ea03c6",
  "scripts/repository-compliance-program-manager.mjs":
    "sha256:0163b1580ead609f7722c417b78a063395045c9542fbc5aa7d78f888417dd202",
  "sources/repository-compliance-program-manager/schemas/repository-compliance-program.schema.json":
    "sha256:11249af3ac39950f054aa8cb1d0c7d2c9da016ae1b9f814cbf0e72ea6d9dfb57",
  "sources/repository-compliance-program-manager/fixtures/repository-compliance-program.example.json":
    "sha256:8aff6f0ba5f3c54b16dffcbb56c739af813d7ba6aa93e9fa1852fdc27b203a87",
  "scripts/artifact-semantics.mjs":
    "sha256:c64c0cabf7e5ee9ad4b0f585b2b38d950c417a013d96aa9889e93ed61fe61f25",
  "sources/work-chief-of-staff/schemas/operating-portfolio.schema.json":
    "sha256:b5bb22d109dacd1a9377774e45b69ab06c7eb4b11471aa7cbf7152f8165c372a",
  "sources/work-chief-of-staff/fixtures/operating-portfolio.example.json":
    "sha256:8a8ad689b975f58b0be19ec52abfaa9f633dcffe631214689be3865951e78e67",
  "scripts/contribution-lib.mjs":
    "sha256:2022abee643543867a5615e31f738309e67351d52baa28a58dd1cc856009b6ce",
  "scripts/catalog-quality-score.mjs":
    "sha256:8b022814145f628b29c391831f39e181134adbb9eab43059a6264982c592c7db",
  "catalog-quality-scores.json":
    "sha256:997865b40508412a24b317c779e9f2cbb61a0dd4b54f5f07d1d46f37879be139",
  "scripts/regression-cases.mjs":
    "sha256:72c10a0bd9f7b7df8d6d5aae61af4366b0c1e633cd26f0fc094ad358db98470e",
  "regression-cases.json":
    "sha256:fe693c0a31ec9562f6fb80bc6e93db644c3b5ed005ae4718d023bf701c75689e",
  "scripts/runtime-evidence-lib.mjs":
    "sha256:c89526bee2d916d28c1b47d6fc76e56de2d550cb90dc4bc869dd3bbbb23e6f91",
  "runtime-evidence-profile.json":
    "sha256:4b4426f870ffe04bcb2d1c5d8351fe73551fb65011231bf34ec0d722da6a5825",
  "scripts/mock-plus-lib.mjs":
    "sha256:5aa6a14c9aa3bdca71864de2456296235d013e802fb95cc8595e0820418a8d19",
});

export const FUTURE_CONTROL_SOURCE_REVISION = digest(
  Object.entries(PINNED_FILES).sort(([left], [right]) =>
    compareText(left, right),
  ),
);

const TARGET_CONTRACTS = Object.freeze([
  {
    id: "portfolio-run-lineage",
    family: "lineage",
    type: "claw-portfolio.run-lineage.v2",
    fields: [
      "mode",
      "runId",
      "decisionId",
      "portfolioRevision",
      "predecessorResultDigest",
      "predecessorDecisionDigest",
      "predecessorBudgetDigest",
      "firstRun",
    ],
  },
  {
    id: "provider-issue-snapshot",
    family: "issue",
    type: "claw-portfolio.provider-issue-snapshot.v2",
    fields: [
      "repositoryIdentity",
      "providerIssueId",
      "number",
      "url",
      "state",
      "revisionOrEtag",
      "titleBytes",
      "bodyBytes",
      "sourceCustodian",
      "snapshotCompletenessRoot",
    ],
  },
  {
    id: "typed-admission-decision",
    family: "classification",
    type: "claw-portfolio.typed-admission.v2",
    fields: [
      "issueRevision",
      "classification",
      "classifierOrHumanDecision",
      "rationale",
      "affectedClaws",
      "compositionFeasibility",
    ],
  },
  {
    id: "signed-package-tree",
    family: "package",
    type: "claw-portfolio.package-tree.v1",
    fields: [
      "catalogRevision",
      "clawId",
      "path",
      "mediaType",
      "byteLength",
      "digest",
      "treeRoot",
      "sourceCustodian",
    ],
  },
  {
    id: "cumulative-budget-ledger",
    family: "budget",
    type: "claw-portfolio.budget-ledger.v2",
    fields: [
      "budgetPeriod",
      "runId",
      "decisionId",
      "predecessorBudgetDigest",
      "reservationId",
      "idempotencyKey",
      "candidateCount",
      "admissions",
      "workUnits",
      "costMicros",
      "durationMinutes",
      "cumulativeUsage",
    ],
  },
  {
    id: "externally-pinned-trust",
    family: "trust",
    type: "claw-portfolio.trust-root.v2",
    fields: [
      "externallyPinnedRoot",
      "revision",
      "predecessorRevision",
      "activation",
      "revocation",
      "domain",
      "publicSpki",
      "signature",
    ],
  },
  {
    id: "minimized-usage-evidence",
    family: "usage",
    type: "claw-portfolio.usage-evidence.v2",
    fields: [
      "tenant",
      "source",
      "revision",
      "minimizedMetrics",
      "validity",
      "issuer",
      "advisoryOnly",
    ],
  },
  {
    id: "proposal-owner-handoff",
    family: "handoff",
    type: "claw-portfolio.proposal-handoff.v1",
    fields: [
      "classification",
      "evidenceLinks",
      "affectedClaws",
      "blockedState",
      "ownerDecision",
      "prReadyPlan",
      "productionMutationFalse",
    ],
  },
]);

const PROHIBITED_AUTHORITY = Object.freeze([
  "merge",
  "publish",
  "budget-increase",
  "risk-acceptance",
  "external-mutation",
  "production-claw-mutation",
  "sensitive-personal-inference",
]);

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

function digestBytes(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function digest(value) {
  return digestBytes(canonicalJson(value));
}

function strictBase64(value) {
  if (typeof value !== "string") return null;
  try {
    const bytes = Buffer.from(value, "base64");
    return bytes.toString("base64") === value ? bytes : null;
  } catch {
    return null;
  }
}

function futureControlPayload(value) {
  const { signature: _signature, ...content } = value;
  return Buffer.from(canonicalJson(content), "utf8");
}

export function futureControlTimestamp(value) {
  if (typeof value !== "string") return null;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/u.exec(
      value,
    );
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const maximumDay =
    month >= 1 && month <= 12
      ? new Date(Date.UTC(year === 0 ? 400 : year, month, 0)).getUTCDate()
      : 0;
  if (
    day < 1 ||
    day > maximumDay ||
    Number(match[4]) > 23 ||
    Number(match[5]) > 59 ||
    Number(match[6]) > 59 ||
    (match[7] !== "Z" &&
      (Number(match[8]) > 23 || Number(match[9]) > 59))
  ) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function verifyFutureControlSignature(control, asOf) {
  try {
    const key = createPublicKey({
      key: PINNED_FUTURE_CONTROL_PUBLIC_KEY_PEM,
      format: "pem",
    });
    const signature = strictBase64(control.signature?.value);
    const signedAt = futureControlTimestamp(control.signedAt);
    const validFrom = futureControlTimestamp(control.validFrom);
    const validUntil = futureControlTimestamp(control.validUntil);
    const evaluatedAt = futureControlTimestamp(asOf);
    return (
      control.signerRef === "future-composition-authority" &&
      control.signature?.keyId === "future-composition-authority-key" &&
      control.signature?.algorithm === "Ed25519" &&
      key.type === "public" &&
      key.asymmetricKeyType === "ed25519" &&
      control.sourceRevision === FUTURE_CONTROL_SOURCE_REVISION &&
      signedAt !== null &&
      validFrom !== null &&
      validUntil !== null &&
      evaluatedAt !== null &&
      validFrom <= signedAt &&
      signedAt <= validUntil &&
      signedAt <= evaluatedAt &&
      validFrom <= evaluatedAt &&
      evaluatedAt <= validUntil &&
      signature !== null &&
      verifySignature(null, futureControlPayload(control), key, signature)
    );
  } catch {
    return false;
  }
}

function sorted(values) {
  return [...values].sort(compareText);
}

function port(
  id,
  direction,
  type,
  family,
  fields,
  authority = [],
  derivedFrom,
) {
  const value = {
    id,
    direction,
    type,
    family,
    fields: sorted(fields),
    authority: sorted(authority),
  };
  if (derivedFrom !== undefined) value.derivedFrom = sorted(derivedFrom);
  return value;
}

function node({ id, kind, codeDigest, schemaDigest, artifactDigest, ports }) {
  return {
    id,
    kind,
    codeDigest,
    schemaDigest,
    artifactDigest,
    ports: [...ports].sort((left, right) => compareText(left.id, right.id)),
  };
}

async function bytes(relativePath) {
  return readFile(join(root, ...relativePath.split("/")));
}

async function json(relativePath) {
  return JSON.parse(await readFile(join(root, ...relativePath.split("/")), "utf8"));
}

export async function inspectPinnedFile(
  path,
  expectedDigest,
  readPinned = bytes,
) {
  try {
    const observedDigest = digestBytes(await readPinned(path));
    return {
      path,
      expectedDigest,
      observedDigest,
      valid: observedDigest === expectedDigest,
    };
  } catch {
    return {
      path,
      expectedDigest,
      observedDigest: null,
      valid: false,
    };
  }
}

async function loadPinnedDigests() {
  const records = await Promise.all(
    Object.entries(PINNED_FILES).map(([path, expectedDigest]) =>
      inspectPinnedFile(path, expectedDigest),
    ),
  );
  return records.sort((left, right) => compareText(left.path, right.path));
}

async function pinnedDigests() {
  return loadPinnedDigests();
}

function compile(schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(schema);
}

function graphEdge(fromNode, fromPort, toNode, toPort) {
  return {
    id: `${fromNode}.${fromPort}->${toNode}.${toPort}`,
    from: { node: fromNode, port: fromPort },
    to: { node: toNode, port: toPort },
  };
}

function targetNode() {
  return node({
    id: "target-claw-portfolio-manager",
    kind: "target-contract",
    codeDigest: digest({ target: COMPOSITION_GRAPH_VERSION }),
    schemaDigest: digest(TARGET_CONTRACTS),
    artifactDigest: null,
    ports: TARGET_CONTRACTS.map((contract) =>
      port(
        contract.id,
        "input",
        contract.type,
        contract.family,
        contract.fields,
      ),
    ),
  });
}

function sourcePort(nodeValue, portId) {
  return nodeValue?.ports?.find(
    (candidate) => candidate.id === portId && candidate.direction === "output",
  );
}

function targetPort(nodeValue, portId) {
  return nodeValue?.ports?.find(
    (candidate) => candidate.id === portId && candidate.direction === "input",
  );
}

function sameFields(left, right) {
  return (
    left.length === right.length &&
    sorted(left).every((item, index) => item === sorted(right)[index])
  );
}

export function reachableTargetPorts(nodes, edges) {
  const byId = new Map(nodes.map((item) => [item.id, item]));
  function outputIsReachable(nodeValue, output, seen = new Set()) {
    if (!nodeValue || !output) return false;
    if (output.derivedFrom === undefined) return true;
    const marker = `${nodeValue.id}.${output.id}`;
    if (seen.has(marker)) return false;
    const nextSeen = new Set(seen).add(marker);
    return output.derivedFrom.every((inputId) => {
      const input = nodeValue.ports.find(
        (candidate) =>
          candidate.id === inputId && candidate.direction === "input",
      );
      if (!input) return false;
      return edges.some((edge) => {
        if (edge.to.node !== nodeValue.id || edge.to.port !== input.id) {
          return false;
        }
        const sourceNode = byId.get(edge.from.node);
        const source = sourcePort(sourceNode, edge.from.port);
        return (
          source &&
          source.type === input.type &&
          sameFields(source.fields, input.fields) &&
          outputIsReachable(sourceNode, source, nextSeen)
        );
      });
    });
  }
  const reached = new Map();
  for (const edge of edges) {
    if (edge.to.node !== "target-claw-portfolio-manager") continue;
    const sourceNode = byId.get(edge.from.node);
    const source = sourcePort(sourceNode, edge.from.port);
    const target = targetPort(byId.get(edge.to.node), edge.to.port);
    if (
      !source ||
      !target ||
      source.type !== target.type ||
      !sameFields(source.fields, target.fields) ||
      !outputIsReachable(sourceNode, source)
    ) {
      continue;
    }
    const existing = reached.get(target.id);
    reached.set(target.id, {
      edgeIds: [...(existing?.edgeIds ?? []), edge.id].sort(compareText),
      sourceNodes: [
        ...new Set([...(existing?.sourceNodes ?? []), edge.from.node]),
      ].sort(compareText),
      sourcePorts: [
        ...new Set([...(existing?.sourcePorts ?? []), source.id]),
      ].sort(compareText),
      authority: [
        ...new Set([
          ...(existing?.authority ?? []),
          ...source.authority,
        ]),
      ].sort(compareText),
    });
  }
  return reached;
}

function relatedPorts(contract, nodes) {
  return nodes
    .flatMap((item) =>
      item.ports
        .filter(
          (candidate) =>
            candidate.direction === "output" &&
            candidate.family === contract.family,
        )
        .map((candidate) => ({
          nodeId: item.id,
          portId: candidate.id,
          type: candidate.type,
          fields: candidate.fields,
          missingFields: contract.fields.filter(
            (field) => !candidate.fields.includes(field),
          ),
          extraFields: candidate.fields.filter(
            (field) => !contract.fields.includes(field),
          ),
        })),
    )
    .sort((left, right) =>
      compareText(
        `${left.nodeId}.${left.portId}`,
        `${right.nodeId}.${right.portId}`,
      ),
    );
}

function graphLosses(nodes, edges) {
  const reached = reachableTargetPorts(nodes, edges);
  return TARGET_CONTRACTS.filter((contract) => !reached.has(contract.id)).map(
    (contract) => ({
      id: `loss-${contract.id}`,
      targetPort: contract.id,
      requiredType: contract.type,
      requiredFields: sorted(contract.fields),
      availableRelatedPorts: relatedPorts(contract, nodes),
      futureControl: {
        schemaVersion: "awesomeClaws.futureTypedCompositionControl.v1",
        requiredOutputType: contract.type,
        requiredFields: sorted(contract.fields),
        validationOperation: "exact-closed-port-v1",
      },
    }),
  );
}

function reachableAuthority(nodes, edges) {
  const reached = reachableTargetPorts(nodes, edges);
  return sorted(
    new Set([...reached.values()].flatMap((item) => item.authority)),
  );
}

function executeFutureControl(control, asOf) {
  const normalized = normalizeJsonValue(control, {
    ...JSON_LIMITS,
    maxBytes: 256 * 1024,
    maxArrayLength: 64,
  });
  if (!normalized.ok) return null;
  control = normalized.value;
  if (
    control?.schemaVersion !== "awesomeClaws.futureTypedCompositionControl.v1" ||
    !TARGET_CONTRACTS.some((item) => item.type === control.output?.type)
  ) {
    return null;
  }
  const target = TARGET_CONTRACTS.find(
    (item) => item.type === control.output.type,
  );
  const schema = {
    type: control.output.type,
    family: target.family,
    fields: sorted(target.fields),
    fieldValueContract: {
      required: ["evidenceDigest", "value"],
      evidenceDigestPattern: "^sha256:[0-9a-f]{64}$",
      valueMustBeNonNull: true,
    },
    additionalProperties: false,
  };
  const validator = {
    operation: "exact-closed-port-v1",
    schemaDigest: digest(schema),
  };
  const artifact = {
    type: control.output.type,
    value: control.output.value,
    authority: control.output.authority,
  };
  const sourceArtifacts = [
    ["schema", schema],
    ["validator", validator],
    ["artifact", artifact],
  ].map(([kind, value]) => {
    const bytes = Buffer.from(canonicalJson(value), "utf8");
    return {
      kind,
      digest: digestBytes(bytes),
      bytesBase64: bytes.toString("base64"),
    };
  });
  const valueFields = Object.keys(control.output.value ?? {}).sort();
  const valuesValid = target.fields.every((field) => {
    const record = control.output.value?.[field];
    return (
      record &&
      typeof record === "object" &&
      !Array.isArray(record) &&
      Object.keys(record).length === 2 &&
      Object.hasOwn(record, "evidenceDigest") &&
      Object.hasOwn(record, "value") &&
      record.value !== null &&
      /^sha256:[0-9a-f]{64}$/u.test(record.evidenceDigest) &&
      record.evidenceDigest ===
        digest({
          type: target.type,
          field,
          value: record.value,
        })
    );
  });
  if (
    control.schemaDigest !== digest(schema) ||
    control.validatorDigest !== digest(validator) ||
    control.artifactDigest !== digest(artifact) ||
    !Array.isArray(control.output.authority) ||
    new Set(control.output.authority).size !==
      control.output.authority.length ||
    !control.output.authority.every(
      (item) => PROHIBITED_AUTHORITY.includes(item),
    ) ||
    canonicalJson(control.sourceArtifacts) !==
      canonicalJson(sourceArtifacts) ||
    !verifyFutureControlSignature(control, asOf) ||
    canonicalJson(valueFields) !== canonicalJson(sorted(target.fields)) ||
    !valuesValid
  ) {
    return null;
  }
  return node({
    id: control.id,
    kind: "future-typed-control",
    codeDigest: control.validatorDigest,
    schemaDigest: control.schemaDigest,
    artifactDigest: control.artifactDigest,
    ports: [
      port(
        "validated-output",
        "output",
        target.type,
        target.family,
        target.fields,
        control.output.authority,
      ),
    ],
  });
}

export function createFutureTypedControl(loss) {
  const target = TARGET_CONTRACTS.find(
    (item) => item.type === loss.requiredType,
  );
  if (!target) {
    throw new TypeError("Unknown typed composition loss.");
  }

  const schema = {
    type: target.type,
    family: target.family,
    fields: sorted(target.fields),
    fieldValueContract: {
      required: ["evidenceDigest", "value"],
      evidenceDigestPattern: "^sha256:[0-9a-f]{64}$",
      valueMustBeNonNull: true,
    },
    additionalProperties: false,
  };
  const validator = {
    operation: "exact-closed-port-v1",
    schemaDigest: digest(schema),
  };
  const value = Object.fromEntries(
    target.fields.map((field) => {
      const fieldValue = { control: target.id, field };
      return [
        field,
        {
          evidenceDigest: digest({
            type: target.type,
            field,
            value: fieldValue,
          }),
          value: fieldValue,
        },
      ];
    }),
  );
  const artifact = {
    type: target.type,
    value,
    authority: [],
  };
  const sourceArtifacts = [
    ["schema", schema],
    ["validator", validator],
    ["artifact", artifact],
  ].map(([kind, sourceValue]) => {
    const bytes = Buffer.from(canonicalJson(sourceValue), "utf8");
    return {
      kind,
      digest: digestBytes(bytes),
      bytesBase64: bytes.toString("base64"),
    };
  });
  return {
    schemaVersion: "awesomeClaws.futureTypedCompositionControl.v1",
    id: `future-control-${target.id}`,
    output: { type: target.type, value, authority: [] },
    schemaDigest: digest(schema),
    validatorDigest: digest(validator),
    artifactDigest: digest(artifact),
    sourceArtifacts,
    signerRef: "future-composition-authority",
    signedAt: "2026-09-17T18:00:00Z",
    validFrom: "2026-09-17T18:00:00Z",
    validUntil: "2026-09-18T18:00:00Z",
    sourceRevision: FUTURE_CONTROL_SOURCE_REVISION,
    signature: null,
  };
}

export function compositionVerdictFor({
  pins,
  execution,
  authoritySafe,
  losses,
  futureControlsValid = true,
}) {
  const executionValid =
    execution.schemaValid.repositoryOperations === true &&
    execution.schemaValid.repositoryCompliance === true &&
    execution.schemaValid.workChiefOfStaff === true &&
    Object.values(execution.semanticFindingCounts).every(
      (count) => count === 0,
    ) &&
    execution.contribution.candidate.id === CANDIDATE_ENTRY.id &&
    execution.contribution.proposalErrors.length === 0 &&
    execution.contribution.nearestMatches.length > 0 &&
    execution.contribution.nearestMatchesCovered === true &&
    execution.quality.every((item) => item.qualified === true) &&
    execution.regressionIds.length === ANALOGUE_IDS.length &&
    execution.mockPlusIds.length === ANALOGUE_IDS.length &&
    execution.runtimeBudgetCovered === true;
  if (
    !pins.every((item) => item.valid) ||
    !executionValid ||
    !futureControlsValid
  ) {
    return "BLOCKED";
  }
  if (!authoritySafe) return "BLOCKED";
  return losses.length === 0 ? "COMPOSE" : "NEW";
}

let analogueNodesCache;
let analogueNodesCacheKey;

async function loadAnalogueNodes() {
  const [
    repoOpsSchema,
    repoOpsArtifact,
    complianceSchema,
    complianceArtifact,
    workChiefSchema,
    workChiefArtifact,
    catalog,
    experienceCases,
    regressionRegistry,
    runtimeProfile,
    mockContext,
  ] = await Promise.all([
    json("sources/repository-operations-manager/schemas/repository-operations.schema.json"),
    json("sources/repository-operations-manager/fixtures/repository-operations.example.json"),
    json("sources/repository-compliance-program-manager/schemas/repository-compliance-program.schema.json"),
    json("sources/repository-compliance-program-manager/fixtures/repository-compliance-program.example.json"),
    json("sources/work-chief-of-staff/schemas/operating-portfolio.schema.json"),
    json("sources/work-chief-of-staff/fixtures/operating-portfolio.example.json"),
    readCatalog({ loadResources: false }),
    readCatalog({ loadResources: false }).then((value) =>
      readExperienceCases(value),
    ),
    readRegressionCases(),
    readRuntimeProfile(),
    loadMockPlusContext(),
  ]);

  const repoOpsSchemaValid = compile(repoOpsSchema)(repoOpsArtifact);
  const complianceSchemaValid = compile(complianceSchema)(complianceArtifact);
  const workChiefSchemaValid = compile(workChiefSchema)(workChiefArtifact);
  const repoOpsSemantic = repositoryOperationsFindings(repoOpsArtifact, {
    asOf: repoOpsArtifact.run.asOf,
  });
  const complianceSemantic = repositoryComplianceProgramFindings(
    complianceArtifact,
    { asOf: complianceArtifact.run.asOf },
  );
  const workChiefSemantic = validateArtifactSemantics(
    "work-chief-of-staff",
    workChiefArtifact,
  );
  if (
    !repoOpsSchemaValid ||
    !complianceSchemaValid ||
    !workChiefSchemaValid ||
    repoOpsSemantic.length > 0 ||
    complianceSemantic.length > 0 ||
    workChiefSemantic.length > 0
  ) {
    throw new Error("An actual analogue schema or semantic validator failed.");
  }

  const entries = catalog.entries.filter((entry) =>
    ANALOGUE_IDS.includes(entry.id),
  );
  const contributions = (
    await Promise.all(
      entries.map((entry) =>
        readFile(join(root, "contributions", `${entry.id}.json`), "utf8").then(
          JSON.parse,
          () => null,
        ),
      ),
    )
  ).filter(Boolean);
  const selectedExperience = experienceCases.filter((item) =>
    ANALOGUE_IDS.includes(item.id),
  );
  const selectedRegression = regressionRegistry.cases.filter((item) =>
    ANALOGUE_IDS.includes(item.id),
  );
  const quality = await buildCatalogQualityScorecard({
    catalog: { entries },
    contributions,
    experienceCases: selectedExperience,
    regressionCases: selectedRegression,
    asOf: "2026-09-17",
  });
  const regressions = await runRepositoryRegressionCases({
    onlyIds: ANALOGUE_IDS,
  });
  const runtimeScenarios = selectedRegression.flatMap((contract) =>
    buildScenarios(contract).map((scenario) => ({
      clawId: contract.id,
      scenarioType: scenario.scenarioType,
      expectedOutcome: scenario.expectedOutcome,
    })),
  );
  const runtimeBudget = preflightBudgets({
    mode: "mock",
    selectedTrialCount: runtimeScenarios.length,
    catalogClawCount: catalog.entries.length,
    limits: {
      concurrency: 1,
      trialTimeoutMs: 120_000,
      cleanupTimeoutMs: 30_000,
      infrastructureRetries: 0,
      maxInputTokensPerTrial: 1,
      maxOutputTokensPerTrial: 1,
      maxTotalTokens: runtimeScenarios.length * 2,
      maxUsd: null,
    },
    pricing: { inputUsdPerMillion: 0, outputUsdPerMillion: 0 },
  });
  const similarity = contributionSimilarityReport(
    CANDIDATE_ENTRY,
    catalog.entries,
  );
  const proposal = {
    schemaVersion: 1,
    entry: CANDIDATE_ENTRY,
    contribution: {
      ...CANDIDATE_CONTRIBUTION,
      existingAlternatives: similarity.matches.map((match) => ({
        id: match.id,
        overlap: `The repository similarity scorer reports ${(match.score * 100).toFixed(1)} percent weighted operating-contract overlap with ${match.name}.`,
        difference: `${match.name} does not expose the candidate's complete eight-port issue-native admission ledger with compose-first cumulative allocation and owner-only proposal handoff.`,
      })),
    },
  };
  const proposalErrors = validateContributionProposal(proposal, catalog.entries);
  const discussedAlternativeIds = proposal.contribution.existingAlternatives.map(
    (item) => item.id,
  );

  const nodes = [
    node({
      id: "repository-operations-manager",
      kind: "schema-semantic-owner-artifact",
      codeDigest: PINNED_FILES["scripts/repository-operations-manager.mjs"],
      schemaDigest:
        PINNED_FILES[
          "sources/repository-operations-manager/schemas/repository-operations.schema.json"
        ],
      artifactDigest:
        PINNED_FILES[
          "sources/repository-operations-manager/fixtures/repository-operations.example.json"
        ],
      ports: [
        port(
          "portfolio-lineage",
          "output",
          "repository.portfolio-lineage.v1",
          "lineage",
          [
            "firstRun",
            "predecessorCheckpointRef",
            "currentCheckpointDigest",
            "rosterRevision",
            "sourceSnapshotRoots",
          ],
        ),
        port(
          "private-handoff",
          "output",
          "repository.private-handoff.v1",
          "handoff",
          ["checkpointDigest", "state", "blockerRefs", "authorityGates"],
        ),
      ],
    }),
    node({
      id: "repository-compliance-program-manager",
      kind: "schema-semantic-owner-artifact",
      codeDigest:
        PINNED_FILES["scripts/repository-compliance-program-manager.mjs"],
      schemaDigest:
        PINNED_FILES[
          "sources/repository-compliance-program-manager/schemas/repository-compliance-program.schema.json"
        ],
      artifactDigest:
        PINNED_FILES[
          "sources/repository-compliance-program-manager/fixtures/repository-compliance-program.example.json"
        ],
      ports: [
        port(
          "provider-issues",
          "output",
          "repository.issue-snapshot.v1",
          "issue",
          [
            "providerIssueId",
            "url",
            "state",
            "revisionOrEtag",
            "ownerContentDigest",
            "snapshotIndexRefs",
          ],
        ),
        port(
          "issue-mutation",
          "output",
          "repository.issue-mutation.v1",
          "mutation",
          [
            "operation",
            "idempotencyKey",
            "providerRequestId",
            "beforeRevision",
            "afterRevision",
            "receipt",
          ],
          ["external-mutation"],
        ),
      ],
    }),
    node({
      id: "work-chief-of-staff",
      kind: "schema-semantic-owner-artifact",
      codeDigest: PINNED_FILES["scripts/artifact-semantics.mjs"],
      schemaDigest:
        PINNED_FILES[
          "sources/work-chief-of-staff/schemas/operating-portfolio.schema.json"
        ],
      artifactDigest:
        PINNED_FILES[
          "sources/work-chief-of-staff/fixtures/operating-portfolio.example.json"
        ],
      ports: [
        port(
          "capacity-envelopes",
          "output",
          "work.capacity-envelope.v1",
          "budget",
          [
            "periodStart",
            "periodEnd",
            "amount",
            "unit",
            "approverRefs",
            "evidenceRefs",
          ],
        ),
        port(
          "source-artifacts",
          "output",
          "work.source-artifact-reference.v1",
          "package",
          [
            "clawId",
            "artifactRef",
            "artifactVersion",
            "capturedAt",
            "expiresAt",
            "owner",
          ],
        ),
        port(
          "portfolio-handoff",
          "output",
          "work.portfolio-handoff.v1",
          "handoff",
          ["state", "accountablePrincipalRefs", "prohibitedActions"],
        ),
      ],
    }),
    node({
      id: "contribution-admission",
      kind: "executed-repository-validator",
      codeDigest: PINNED_FILES["scripts/contribution-lib.mjs"],
      schemaDigest: digest({ proposalSchemaVersion: 1 }),
      artifactDigest: digest({ proposalErrors, similarity }),
      ports: [
        port(
          "advisory-similarity",
          "output",
          "catalog.admission-advisory.v1",
          "classification",
          [
            "candidate",
            "matches",
            "advisoryVerdict",
            "proposalErrors",
          ],
        ),
      ],
    }),
    node({
      id: "catalog-quality",
      kind: "executed-repository-output",
      codeDigest: PINNED_FILES["scripts/catalog-quality-score.mjs"],
      schemaDigest: digest({ schemaVersion: "awesomeClaws.catalogQuality.v1" }),
      artifactDigest: digest(quality),
      ports: [
        port(
          "quality-evidence",
          "output",
          "catalog.quality-evidence.v1",
          "classification",
          ["score", "gates", "dimensions", "repositoryObservableOnly"],
        ),
      ],
    }),
    node({
      id: "runtime-evidence",
      kind: "executed-repository-output",
      codeDigest: PINNED_FILES["scripts/runtime-evidence-lib.mjs"],
      schemaDigest: PINNED_FILES["runtime-evidence-profile.json"],
      artifactDigest: digest({
        runtimeScenarios,
        runtimeBudget,
        runtimeProfile,
      }),
      ports: [
        port(
          "runtime-observations",
          "output",
          "runtime.usage-observation.v1",
          "usage",
          [
            "scenario",
            "classification",
            "tokenBudget",
            "usdBudget",
            "safeEvidence",
          ],
        ),
      ],
    }),
    node({
      id: "regression-mock-plus",
      kind: "executed-repository-output",
      codeDigest: digest({
        regression:
          PINNED_FILES["scripts/regression-cases.mjs"],
        mockPlus: PINNED_FILES["scripts/mock-plus-lib.mjs"],
      }),
      schemaDigest: PINNED_FILES["regression-cases.json"],
      artifactDigest: digest({
        regressions: regressions.map((item) => item.id),
        mockPlus: mockContext.inventory.entries
          .filter((item) => ANALOGUE_IDS.includes(item.id))
          .map((item) => ({
            id: item.id,
            schema: item.schema.registered,
            semantics: item.semanticValidator,
          })),
      }),
      ports: [
        port(
          "contract-proof",
          "output",
          "catalog.contract-proof.v1",
          "classification",
          ["accepted", "missingEvidence", "prohibitedAuthority", "semanticMutants"],
        ),
      ],
    }),
    node({
      id: "strongest-current-composition-adapter",
      kind: "typed-no-sidecar-adapter",
      codeDigest: digest({
        operation: "normalize-validated-owner-ports-v1",
      }),
      schemaDigest: digest({
        inputs: [
          "repository.portfolio-lineage.v1",
          "repository.issue-snapshot.v1",
          "work.capacity-envelope.v1",
          "work.source-artifact-reference.v1",
          "work.portfolio-handoff.v1",
          "catalog.admission-advisory.v1",
          "catalog.quality-evidence.v1",
          "runtime.usage-observation.v1",
          "catalog.contract-proof.v1",
        ],
      }),
      artifactDigest: digest({
        sourceArtifacts: [
          PINNED_FILES[
            "sources/repository-operations-manager/fixtures/repository-operations.example.json"
          ],
          PINNED_FILES[
            "sources/repository-compliance-program-manager/fixtures/repository-compliance-program.example.json"
          ],
          PINNED_FILES[
            "sources/work-chief-of-staff/fixtures/operating-portfolio.example.json"
          ],
        ],
      }),
      ports: [
        port(
          "repository-lineage",
          "input",
          "repository.portfolio-lineage.v1",
          "lineage",
          [
            "firstRun",
            "predecessorCheckpointRef",
            "currentCheckpointDigest",
            "rosterRevision",
            "sourceSnapshotRoots",
          ],
        ),
        port(
          "repository-issues",
          "input",
          "repository.issue-snapshot.v1",
          "issue",
          [
            "providerIssueId",
            "url",
            "state",
            "revisionOrEtag",
            "ownerContentDigest",
            "snapshotIndexRefs",
          ],
        ),
        port(
          "capacity",
          "input",
          "work.capacity-envelope.v1",
          "budget",
          [
            "periodStart",
            "periodEnd",
            "amount",
            "unit",
            "approverRefs",
            "evidenceRefs",
          ],
        ),
        port(
          "source-artifacts",
          "input",
          "work.source-artifact-reference.v1",
          "package",
          [
            "clawId",
            "artifactRef",
            "artifactVersion",
            "capturedAt",
            "expiresAt",
            "owner",
          ],
        ),
        port(
          "work-handoff",
          "input",
          "work.portfolio-handoff.v1",
          "handoff",
          ["state", "accountablePrincipalRefs", "prohibitedActions"],
        ),
        port(
          "admission",
          "input",
          "catalog.admission-advisory.v1",
          "classification",
          ["candidate", "matches", "advisoryVerdict", "proposalErrors"],
        ),
        port(
          "quality",
          "input",
          "catalog.quality-evidence.v1",
          "classification",
          ["score", "gates", "dimensions", "repositoryObservableOnly"],
        ),
        port(
          "runtime",
          "input",
          "runtime.usage-observation.v1",
          "usage",
          [
            "scenario",
            "classification",
            "tokenBudget",
            "usdBudget",
            "safeEvidence",
          ],
        ),
        port(
          "contract-proof",
          "input",
          "catalog.contract-proof.v1",
          "classification",
          ["accepted", "missingEvidence", "prohibitedAuthority", "semanticMutants"],
        ),
        port(
          "partial-ledger",
          "output",
          "claw-portfolio.partial-ledger.v1",
          "handoff",
          [
            "repositoryLineage",
            "issueIdentities",
            "capacityEnvelopes",
            "advisoryClassification",
            "qualityEvidence",
            "runtimeEvidence",
            "ownerHandoff",
          ],
          [],
          [
            "repository-lineage",
            "repository-issues",
            "capacity",
            "work-handoff",
          ],
        ),
        port(
          "partial-portfolio-run-lineage",
          "output",
          "claw-portfolio.run-lineage.v2",
          "lineage",
          ["firstRun"],
          [],
          ["repository-lineage"],
        ),
        port(
          "partial-provider-issue-snapshot",
          "output",
          "claw-portfolio.provider-issue-snapshot.v2",
          "issue",
          ["providerIssueId", "revisionOrEtag", "state", "url"],
          [],
          ["repository-issues"],
        ),
        port(
          "partial-typed-admission-decision",
          "output",
          "claw-portfolio.typed-admission.v2",
          "classification",
          [],
          [],
          ["admission", "quality", "contract-proof"],
        ),
        port(
          "partial-signed-package-tree",
          "output",
          "claw-portfolio.package-tree.v1",
          "package",
          ["clawId"],
          [],
          ["source-artifacts"],
        ),
        port(
          "partial-cumulative-budget-ledger",
          "output",
          "claw-portfolio.budget-ledger.v2",
          "budget",
          [],
          [],
          ["capacity"],
        ),
        port(
          "partial-minimized-usage-evidence",
          "output",
          "claw-portfolio.usage-evidence.v2",
          "usage",
          [],
          [],
          ["runtime"],
        ),
        port(
          "partial-proposal-owner-handoff",
          "output",
          "claw-portfolio.proposal-handoff.v1",
          "handoff",
          [],
          [],
          ["work-handoff", "admission"],
        ),
      ],
    }),
  ];
  return {
    nodes,
    executed: {
      schemaValid: {
        repositoryOperations: repoOpsSchemaValid,
        repositoryCompliance: complianceSchemaValid,
        workChiefOfStaff: workChiefSchemaValid,
      },
      semanticFindingCounts: {
        repositoryOperations: repoOpsSemantic.length,
        repositoryCompliance: complianceSemantic.length,
        workChiefOfStaff: workChiefSemantic.length,
      },
      contribution: {
        candidate: similarity.candidate,
        proposalErrors,
        nearestMatches: similarity.matches.map((item) => item.id),
        discussedAlternativeIds,
        nearestMatchesCovered: similarity.matches.every((item) =>
          discussedAlternativeIds.includes(item.id),
        ),
      },
      quality: quality.scores.map((item) => ({
        id: item.id,
        total: item.total,
        qualified: item.gates.qualified,
      })),
      regressionIds: regressions.map((item) => item.id),
      runtimeScenarioCount: runtimeScenarios.length,
      runtimeBudgetCovered:
        runtimeBudget.tokenBudgetCoversSelectedWorstCase &&
        runtimeBudget.usdBudgetCoversSelectedWorstCase,
      mockPlusIds: mockContext.inventory.entries
        .filter((item) => ANALOGUE_IDS.includes(item.id))
        .map((item) => item.id),
    },
  };
}

async function analogueNodes(pins) {
  const cacheKey = digest(
    pins.map((item) => ({
      path: item.path,
      observedDigest: item.observedDigest,
    })),
  );
  if (analogueNodesCacheKey !== cacheKey) {
    analogueNodesCache = await loadAnalogueNodes();
    analogueNodesCacheKey = cacheKey;
  }
  return structuredClone(analogueNodesCache);
}

function blockedExecution() {
  return {
    schemaValid: {
      repositoryOperations: false,
      repositoryCompliance: false,
      workChiefOfStaff: false,
    },
    semanticFindingCounts: {
      repositoryOperations: 1,
      repositoryCompliance: 1,
      workChiefOfStaff: 1,
    },
    contribution: {
      candidate: {
        id: CANDIDATE_ENTRY.id,
        name: CANDIDATE_ENTRY.name,
        category: CANDIDATE_ENTRY.category,
      },
      proposalErrors: ["pinned composition input unavailable"],
      nearestMatches: [],
      discussedAlternativeIds: [],
      nearestMatchesCovered: false,
    },
    quality: [],
    regressionIds: [],
    runtimeScenarioCount: 0,
    runtimeBudgetCovered: false,
    mockPlusIds: [],
  };
}

export async function runStrongestComposition({
  futureControls = [],
  asOf,
} = {}) {
  const pins = await pinnedDigests();
  let actual;
  try {
    actual = pins.every((item) => item.valid)
      ? await analogueNodes(pins)
      : { nodes: [], executed: blockedExecution() };
  } catch {
    actual = { nodes: [], executed: blockedExecution() };
  }
  const target = targetNode();
  const nodes = [...actual.nodes, target];
  const edges = [
    graphEdge(
      "repository-operations-manager",
      "portfolio-lineage",
      "strongest-current-composition-adapter",
      "repository-lineage",
    ),
    graphEdge(
      "repository-compliance-program-manager",
      "provider-issues",
      "strongest-current-composition-adapter",
      "repository-issues",
    ),
    graphEdge(
      "work-chief-of-staff",
      "capacity-envelopes",
      "strongest-current-composition-adapter",
      "capacity",
    ),
    graphEdge(
      "work-chief-of-staff",
      "source-artifacts",
      "strongest-current-composition-adapter",
      "source-artifacts",
    ),
    graphEdge(
      "work-chief-of-staff",
      "portfolio-handoff",
      "strongest-current-composition-adapter",
      "work-handoff",
    ),
    graphEdge(
      "contribution-admission",
      "advisory-similarity",
      "strongest-current-composition-adapter",
      "admission",
    ),
    graphEdge(
      "catalog-quality",
      "quality-evidence",
      "strongest-current-composition-adapter",
      "quality",
    ),
    graphEdge(
      "runtime-evidence",
      "runtime-observations",
      "strongest-current-composition-adapter",
      "runtime",
    ),
    graphEdge(
      "regression-mock-plus",
      "contract-proof",
      "strongest-current-composition-adapter",
      "contract-proof",
    ),
    graphEdge(
      "strongest-current-composition-adapter",
      "partial-portfolio-run-lineage",
      "target-claw-portfolio-manager",
      "portfolio-run-lineage",
    ),
    graphEdge(
      "strongest-current-composition-adapter",
      "partial-provider-issue-snapshot",
      "target-claw-portfolio-manager",
      "provider-issue-snapshot",
    ),
    graphEdge(
      "strongest-current-composition-adapter",
      "partial-typed-admission-decision",
      "target-claw-portfolio-manager",
      "typed-admission-decision",
    ),
    graphEdge(
      "strongest-current-composition-adapter",
      "partial-signed-package-tree",
      "target-claw-portfolio-manager",
      "signed-package-tree",
    ),
    graphEdge(
      "strongest-current-composition-adapter",
      "partial-cumulative-budget-ledger",
      "target-claw-portfolio-manager",
      "cumulative-budget-ledger",
    ),
    graphEdge(
      "strongest-current-composition-adapter",
      "partial-minimized-usage-evidence",
      "target-claw-portfolio-manager",
      "minimized-usage-evidence",
    ),
    graphEdge(
      "strongest-current-composition-adapter",
      "partial-proposal-owner-handoff",
      "target-claw-portfolio-manager",
      "proposal-owner-handoff",
    ),
  ];
  const normalizedControls = normalizeJsonValue(futureControls, {
    ...JSON_LIMITS,
    maxBytes: 512 * 1024,
    maxArrayLength: TARGET_CONTRACTS.length,
  });
  const controls =
    normalizedControls.ok && Array.isArray(normalizedControls.value)
      ? normalizedControls.value
      : [];
  const acceptedFutureControls = [];
  const rejectedFutureControls =
    normalizedControls.ok && Array.isArray(normalizedControls.value)
      ? []
      : [{ id: "unknown-control", code: "invalid-control" }];
  const claimedTargetPorts = new Set();
  const claimedNodeIds = new Set(nodes.map((item) => item.id));
  for (const control of controls) {
    const controlNode = executeFutureControl(control, asOf);
    const matchingTarget = controlNode
      ? TARGET_CONTRACTS.find(
          (item) => item.type === controlNode.ports[0].type,
        )
      : null;
    if (!controlNode || !matchingTarget) {
      rejectedFutureControls.push({
        id: control?.id ?? "unknown-control",
        code: "invalid-control",
      });
      continue;
    }
    if (claimedNodeIds.has(controlNode.id)) {
      rejectedFutureControls.push({
        id: controlNode.id,
        code: "duplicate-node-id",
      });
      continue;
    }
    if (claimedTargetPorts.has(matchingTarget.id)) {
      rejectedFutureControls.push({
        id: control.id,
        code: "duplicate-target-control",
        targetPort: matchingTarget.id,
      });
      continue;
    }
    claimedNodeIds.add(controlNode.id);
    claimedTargetPorts.add(matchingTarget.id);
    nodes.push(controlNode);
    acceptedFutureControls.push(controlNode.id);
    edges.push(
      graphEdge(
        controlNode.id,
        controlNode.ports[0].id,
        target.id,
        matchingTarget.id,
      ),
    );
  }
  const losses = graphLosses(nodes, edges);
  const authority = reachableAuthority(nodes, edges);
  const authoritySafe = PROHIBITED_AUTHORITY.every(
    (item) => !authority.includes(item),
  );
  const graph = {
    schemaVersion: COMPOSITION_GRAPH_VERSION,
    sourceMode: "repository-owner-artifacts-only",
    candidateSidecarUsed: false,
    pins,
    nodes: [...nodes].sort((left, right) => compareText(left.id, right.id)),
    edges: [...edges].sort((left, right) => compareText(left.id, right.id)),
    execution: actual.executed,
    acceptedFutureControls: sorted(acceptedFutureControls),
    rejectedFutureControls,
    futureControlsValid: rejectedFutureControls.length === 0,
    reachableTargetPorts: sorted([
      ...reachableTargetPorts(nodes, edges).keys(),
    ]),
    reachableAuthority: authority,
    unusedAuthorityPorts: nodes
      .flatMap((item) =>
        item.ports
          .filter(
            (candidate) =>
              candidate.direction === "output" &&
              candidate.authority.length > 0 &&
              !edges.some(
                (edge) =>
                  edge.from.node === item.id &&
                  edge.from.port === candidate.id,
              ),
          )
          .map((candidate) => ({
            nodeId: item.id,
            portId: candidate.id,
            authority: candidate.authority,
          })),
      )
      .sort((left, right) =>
        compareText(
          `${left.nodeId}.${left.portId}`,
          `${right.nodeId}.${right.portId}`,
        ),
      ),
    prohibitedAuthority: PROHIBITED_AUTHORITY,
    authoritySafe,
    losses,
  };
  graph.verdict = compositionVerdictFor(graph);
  return {
    ...graph,
    graphDigest: digest(graph),
  };
}
