import {
  acceptedFixture,
  failureCases,
  irreducibilityWitness,
  materializeFailureCase,
  ownerTrustPolicy,
} from "./procure-to-pay-three-way-match-exception-reconciler-fixtures.mjs";
import {
  evaluateIrreducibilityWitness,
  validateThreeWayMatch,
} from "./procure-to-pay-three-way-match-exception-reconciler.mjs";

const context = Object.freeze({
  cutoffAt: acceptedFixture.review.cutoffAt,
  asOf: "2026-09-16T12:00:00Z",
  ownerTrustPolicy,
});
const acceptedFindings = validateThreeWayMatch(acceptedFixture, context);
const failures = failureCases.map((definition) => {
  const findings = validateThreeWayMatch(materializeFailureCase(definition), context);
  const actualCodes = [...new Set(findings.map((finding) => finding.code))].sort();
  const expectedCodes = [...definition.expectedCodes].sort();
  return {
    id: definition.id,
    accepted: false,
    expectedCodes,
    actualCodes,
    findings,
    proved: JSON.stringify(actualCodes) === JSON.stringify(expectedCodes),
  };
});
const irreducibility = evaluateIrreducibilityWitness(irreducibilityWitness);
const proof = {
  clawId: acceptedFixture.clawId,
  accepted: {
    state: acceptedFixture.result.state,
    findingCount: acceptedFindings.length,
    exactManifestCount: acceptedFixture.manifests.length,
    sourceIdentityCount:
      acceptedFixture.purchaseOrderLines.length +
      acceptedFixture.receiptLines.length +
      acceptedFixture.invoiceLines.length,
    approvedPayloadDigestCount: 3,
    decisionBindingCount: acceptedFixture.matchGroups.length,
    partitionRootDigest: acceptedFixture.result.partitionRootDigest,
    groupCount: acceptedFixture.matchGroups.length,
    residualCount: acceptedFixture.residuals.length,
    proved: acceptedFindings.length === 0,
  },
  failures,
  irreducibility,
};

console.log(JSON.stringify(proof, null, 2));

if (
  !proof.accepted.proved ||
  failures.some((failure) => !failure.proved) ||
  !irreducibility.poReceiptAccepted ||
  !irreducibility.poInvoiceAccepted ||
  irreducibility.threeWayPartitionAccepted
) {
  process.exitCode = 1;
}
