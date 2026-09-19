import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
} from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  COMPOSITION_MAPPINGS,
  composePortfolioPlan,
  expectedSourceBindings,
  renderCompositionPlan,
  trustRevision,
} from "./composition.mjs";
import { canonicalJson, sha256Digest } from "./candidate-utils.mjs";
import { root } from "../../scripts/catalog-source.mjs";

const ED25519_PKCS8_SEED_PREFIX = Buffer.from(
  "302e020100300506032b657004220420",
  "hex",
);

const fixtureRoot = new URL("./fixtures/", import.meta.url);
const input = JSON.parse(
  await readFile(new URL("composition-input.test.json", fixtureRoot), "utf8"),
);
const trust = JSON.parse(
  await readFile(new URL("composition-trust.test.json", fixtureRoot), "utf8"),
);
const trustPin = JSON.parse(
  await readFile(
    new URL("composition-trust-pin.test.json", fixtureRoot),
    "utf8",
  ),
);

function digestBytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function fixturePrivateKey(domain) {
  const seed = createHash("sha256")
    .update(`awesome-claws-composition-fixture:${domain}`, "utf8")
    .digest();
  return createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_SEED_PREFIX, seed]),
    format: "der",
    type: "pkcs8",
  });
}

function signRecord(value, key) {
  delete value.signature;
  value.signature = {
    keyId: key.record.keyId,
    algorithm: "Ed25519",
    value: sign(
      null,
      Buffer.from(canonicalJson(value), "utf8"),
      key.privateKey,
    ).toString("base64"),
  };
}

function providerRevision(value) {
  const {
    revision: _revision,
    completenessRoot: _completenessRoot,
    signature: _signature,
    ...content
  } = value;
  return sha256Digest(content);
}

function contentRevision(value) {
  const {
    revision: _revision,
    signature: _signature,
    ...content
  } = value;
  return sha256Digest(content);
}

function sortedRoot(items) {
  return sha256Digest(
    [...items].sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    ),
  );
}

function mediaType(path) {
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".yml") || path.endsWith(".yaml")) {
    return "application/yaml";
  }
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".md")) return "text/markdown; charset=utf-8";
  return "text/javascript";
}

const keys = new Map();
for (const record of trust.keys) {
  const privateKey = fixturePrivateKey(record.domain);
  record.publicKeyPem = createPublicKey(privateKey).export({
    type: "spki",
    format: "pem",
  });
  keys.set(record.domain, { record, privateKey });
}
trust.revision = trustRevision(trust);
Object.assign(trustPin, {
  trustSchemaVersion: trust.schemaVersion,
  trustRevision: trust.revision,
  notBefore: "2026-09-01T00:00:00Z",
  expiresAt: "2026-10-01T00:00:00Z",
});

input.sourceBindings = await expectedSourceBindings();
const bindingsRoot = sortedRoot(input.sourceBindings);
input.portfolio.sourceBindingsRoot = bindingsRoot;
input.portfolio.revision = sha256Digest({
  id: input.portfolio.id,
  selectedClawIds: input.portfolio.selectedClawIds,
  sourceBindingsRoot: bindingsRoot,
  capacityEnvelopeRef: input.portfolio.capacityEnvelopeRef,
});

input.admission.dispositionEvidence = {
  requiredOwnerIds: [...input.portfolio.selectedClawIds],
  availableOwnerIds: [...input.portfolio.selectedClawIds],
  existingMatch: null,
  lifecycle: {
    action: "retain",
    evidenceRefs: [],
  },
  variantBasis: "none",
  productDecisionRefs: [],
  proposedDemand: {
    capacityEnvelopeRef: input.portfolio.capacityEnvelopeRef,
    amount: 4,
    unit: "person-weeks",
  },
};
input.admission.proposalDigest = sha256Digest(input.admission.proposal);
input.admission.compositionContract.proposalDigest =
  input.admission.proposalDigest;
input.admission.compositionContract.requiredOutputPorts =
  COMPOSITION_MAPPINGS.map((item) => item.outputPort);
input.admission.compositionContract.ownerMappings = COMPOSITION_MAPPINGS;

const providerBody = JSON.parse(
  Buffer.from(input.providerIssue.body.contentBase64, "base64").toString("utf8"),
);
providerBody.evidenceRefs = [
  {
    id: input.providerIssue.baseIssueRef,
    kind: "provider-issue",
    subjectRef: input.admission.proposal.entry.id,
    authority: "provider-custodian-attestation",
  },
  {
    id: input.continuation.predecessorCheckpointRef,
    kind: "continuation-checkpoint",
    subjectRef: input.continuation.id,
    authority: "repository-operations-attestation",
  },
];
providerBody.proposalDigest = input.admission.proposalDigest;
const providerBodyBytes = Buffer.from(canonicalJson(providerBody), "utf8");
input.providerIssue.body.byteLength = providerBodyBytes.length;
input.providerIssue.body.digest = digestBytes(providerBodyBytes);
input.providerIssue.body.contentBase64 = providerBodyBytes.toString("base64");
input.providerIssue.ownerContentMapping.replacementDigest = sha256Digest({
  titleDigest: input.providerIssue.title.digest,
  bodyDigest: input.providerIssue.body.digest,
});
input.providerIssue.revision = providerRevision(input.providerIssue);
input.providerIssue.completenessRoot = sha256Digest({
  id: input.providerIssue.id,
  revision: input.providerIssue.revision,
});
signRecord(input.providerIssue, keys.get("provider"));

input.admission.issueRevision = input.providerIssue.revision;
input.continuation.portfolioRevision = input.portfolio.revision;
input.continuation.sourceBindingsRoot = bindingsRoot;
signRecord(input.continuation, keys.get("continuation"));
signRecord(input.admission, keys.get("admission"));

input.packageManifest.files = await Promise.all(
  input.sourceBindings.map(async (binding) => {
    const bytes = await readFile(join(root, ...binding.path.split("/")));
    return {
      path: binding.path,
      mediaType: mediaType(binding.path),
      byteLength: bytes.length,
      digest: digestBytes(bytes),
    };
  }),
);
input.packageManifest.root = sortedRoot(input.packageManifest.files);
signRecord(input.packageManifest, keys.get("catalog"));

for (const receipt of input.idempotencyReceipts) {
  receipt.issueRevision = input.providerIssue.revision;
  signRecord(receipt, keys.get("receipt"));
}
input.usageEvidence.issueRevision = input.providerIssue.revision;
input.usageEvidence.revision = contentRevision(input.usageEvidence);
signRecord(input.usageEvidence, keys.get("usage"));
signRecord(input.runtimeBudget, keys.get("runtime-budget"));

await Promise.all([
  writeFile(
    new URL("composition-input.test.json", fixtureRoot),
    `${JSON.stringify(input, null, 2)}\n`,
  ),
  writeFile(
    new URL("composition-trust.test.json", fixtureRoot),
    `${JSON.stringify(trust, null, 2)}\n`,
  ),
  writeFile(
    new URL("composition-trust-pin.test.json", fixtureRoot),
    `${JSON.stringify(trustPin, null, 2)}\n`,
  ),
]);

const result = await composePortfolioPlan(input, trust, trustPin, {
  asOf: "2026-09-17T19:00:00Z",
});
if (result.verdict !== "IMPROVE_COMPOSE") {
  throw new Error(JSON.stringify(result));
}
await Promise.all([
  writeFile(
    new URL("./expected/composition.expected.json", import.meta.url),
    `${JSON.stringify(result, null, 2)}\n`,
  ),
  writeFile(
    new URL("./proof/composition-plan.md", import.meta.url),
    renderCompositionPlan(result),
  ),
]);
