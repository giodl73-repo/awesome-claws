import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";

const canonicalJson = value => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

const sameSet = (a, b) => Array.isArray(a) && new Set(a).size === a.length &&
  a.length === b.length && a.every((id) => b.includes(id));
const exact = (values) => {
  if (!values.every(Number.isSafeInteger)) throw new Error("Unsafe minor-unit input");
  const sum = values.reduce((total, value) => total + BigInt(value), 0n);
  if (sum > BigInt(Number.MAX_SAFE_INTEGER) || sum < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error("Unsafe minor-unit result");
  }
  return Number(sum);
};
const timestamp = (value) => typeof value === "string" &&
  /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));

export function deriveMerchantPayoutReview(value) {
  const rows = value.payouts.map((payout) => {
    const members = payout.memberRefs.map((id) => value.transactions.find((row) => row.id === id));
    if (members.some((row) => !row)) throw new Error("Unknown member");
    const membershipKnown = payout.membershipSourceRef !== null && members.length > 0;
    const grossMinor = membershipKnown ? exact(members.map((row) => row.grossMinor)) : null;
    const feeMinor = membershipKnown ? exact(members.map((row) => row.feeMinor)) : null;
    const netMinor = membershipKnown ? exact(members.map((row) => row.netMinor)) : null;
    const mapped = value.mappings.filter((row) => row.payoutRef === payout.id);
    const receipts = mapped.map((row) => value.bankReceipts.find((receipt) => receipt.id === row.receiptRef));
    if (receipts.some((row) => !row)) throw new Error("Unknown bank receipt");
    const bankMinor = receipts.length ? exact(receipts.map((row) => row.amountMinor)) : null;
    const memberResidualMinor = membershipKnown ? exact([netMinor, -payout.amountMinor]) : null;
    const bankResidualMinor = bankMinor === null ? null : exact([bankMinor, -payout.amountMinor]);
    const issues = [];
    if (!membershipKnown) issues.push("membership-missing");
    if (memberResidualMinor !== null && memberResidualMinor !== 0) issues.push("member-residual");
    if (bankMinor === null) issues.push("bank-evidence-missing");
    if (bankResidualMinor !== null && bankResidualMinor !== 0) issues.push("bank-residual");
    if (payout.status !== "paid") issues.push(`processor-${payout.status}`);
    return { payoutRef: payout.id, grossMinor, feeMinor, netMinor, memberResidualMinor,
      receiptRefs: receipts.map((row) => row.id), bankMinor, bankResidualMinor,
      current: !value.payouts.some((row) => row.priorAttemptRef === payout.id), issues };
  });
  const questions = rows.flatMap((row) => row.issues.map((reason) => ({
    targetRef: row.payoutRef, reason, ownerRef: value.scope.reviewerRef,
  })));
  for (const row of value.transactions.filter((row) => row.disposition !== "assigned")) {
    questions.push({ targetRef: row.id, reason: row.disposition, ownerRef: value.scope.reviewerRef });
  }
  for (const row of value.bankReceipts.filter((row) => !value.mappings.some((mapping) => mapping.receiptRef === row.id))) {
    questions.push({ targetRef: row.id, reason: "unmapped-bank-row", ownerRef: value.scope.reviewerRef });
  }
  const { review, ...evidence } = value;
  const evidenceDigest = `sha256:${createHash("sha256").update(canonicalJson(evidence)).digest("hex")}`;
  return { evidenceDigest, rows, questions, unsettledMinor: exact(value.transactions.filter((row) => row.disposition === "unsettled").map((row) => row.netMinor)),
    state: "owner-review-required", externalActions: "none", settlementCertification: "not-made" };
}

export function merchantPayoutFindings(value) {
  const findings = [];
  const fail = (code, path, message) => findings.push({ code, path, message });
  const lists = ["sources", "transactions", "payouts", "bankReceipts", "mappings"];
  if (!value || typeof value !== "object" || !value.scope || !value.review ||
      lists.some((key) => !Array.isArray(value[key]) || value[key].some((row) => !row || typeof row !== "object"))) {
    fail("invalid_merchant_payout_shape", "$", "A complete bounded reconciliation record is required.");
    return findings;
  }
  try {
    const { scope, sources, transactions, payouts, bankReceipts, mappings } = value;
    const all = lists.flatMap((key) => value[key]);
    if (all.some((row) => typeof row.id !== "string") || new Set(all.map((row) => row.id)).size !== all.length) {
      fail("duplicate_payout_identity", "$", "Every source and observation needs a unique identity.");
    }
    const sourceMap = new Map(sources.map((row) => [row.id, row]));
    const payoutMap = new Map(payouts.map((row) => [row.id, row]));
    const transactionMap = new Map(transactions.map((row) => [row.id, row]));
    const receiptMap = new Map(bankReceipts.map((row) => [row.id, row]));
    if (!timestamp(scope.asOf) || !timestamp(scope.start) || Date.parse(scope.start) > Date.parse(scope.asOf) ||
        scope.destination !== "private-reviewer-workspace" || scope.feeConvention !== "gross-minus-signed-fee" ||
        !Number.isInteger(scope.scale) || scope.scale < 0 || scope.scale > 3 ||
        !sameSet(scope.transactionRefs, transactions.map((row) => row.id)) ||
        !sameSet(scope.payoutRefs, payouts.map((row) => row.id)) ||
        !sameSet(scope.bankReceiptRefs, bankReceipts.map((row) => row.id))) {
      fail("invalid_payout_scope", "scope", "Preserve exact declared populations, cutoff, convention, and private destination.");
    }
    const sourceValid = (ref, kinds) => {
      const source = sourceMap.get(ref);
      return source && kinds.includes(source.kind) && source.current === true && source.complete === true &&
        source.merchantRef === scope.merchantRef && source.accountRef === scope.accountRef &&
        source.currency === scope.currency && source.scale === scope.scale && timestamp(source.issuedAt) &&
        Date.parse(source.issuedAt) <= Date.parse(scope.asOf);
    };
    for (const source of sources) {
      if (!sourceValid(source.id, ["transactions", "payouts", "membership", "bank", "mapping"]) ||
          !/^controlled:\/\/merchant-payout\/source-[a-z0-9-]{1,48}$/.test(source.controlledRef) ||
          !source.revision || new Set(sources.map((row) => row.controlledRef)).size !== sources.length) {
        fail("invalid_payout_source", `sources.${source.id}`, "Use current complete scoped revisions and minimized source references.");
      }
      const expectedIssuer = ["bank"].includes(source.kind) ? "bank" : source.kind === "mapping" ? "reviewer" : "processor";
      if (source.issuerKind !== expectedIssuer || (expectedIssuer === "reviewer" && source.issuerRef !== scope.reviewerRef)) {
        fail("invalid_payout_issuer", `sources.${source.id}`, "Processor, bank, and owner mapping evidence are not interchangeable.");
      }
      if (source.kind === "bank" && sources.some(other => other.issuerKind === "processor" && other.issuerRef === source.issuerRef)) {
        fail("invalid_payout_issuer", `sources.${source.id}`, "Bank receipt evidence must retain its independent issuer identity.");
      }
      if ((source.kind === "membership" && payouts.filter(row => row.membershipSourceRef === source.id).length !== 1) ||
          (source.kind === "mapping" && mappings.filter(row => row.sourceRef === source.id).length !== 1)) {
        fail("unbound_payout_source", `sources.${source.id}`, "Membership and mapping evidence must bind exactly one reviewed association.");
      }
      if (["transactions", "payouts", "bank"].includes(source.kind)) {
        const expected = {
          transactionRefs: transactions.filter(row => row.sourceRef === source.id).map(row => row.id),
          payoutRefs: payouts.filter(row => row.sourceRef === source.id).map(row => row.id),
          bankReceiptRefs: bankReceipts.filter(row => row.sourceRef === source.id).map(row => row.id),
        };
        if (Object.entries(expected).some(([key, ids]) => !sameSet(source[key], ids))) {
          fail("incomplete_payout_population", `sources.${source.id}`, "Every declared source row must be retained exactly once.");
        }
      }
    }
    const chronological = (row, field) => timestamp(row[field]) &&
      Date.parse(row[field]) >= Date.parse(scope.start) && Date.parse(row[field]) <= Date.parse(scope.asOf) &&
      Date.parse(row[field]) <= Date.parse(sourceMap.get(row.sourceRef)?.issuedAt);
    for (const [key, rows] of [["transactions", transactions], ["payouts", payouts], ["bank", bankReceipts]]) {
      if (new Set(rows.map((row) => row.nativeId)).size !== rows.length) {
        fail("duplicate_processor_observation", key, "A native observation cannot be counted twice across report revisions.");
      }
    }
    for (const row of transactions) {
      if (!sourceValid(row.sourceRef, ["transactions"]) || !chronological(row, "occurredAt")) {
        fail("invalid_transaction_evidence", `transactions.${row.id}`, "Transactions require scoped processor evidence at the cutoff.");
      }
      if (exact([row.grossMinor, -row.feeMinor]) !== row.netMinor) {
        fail("incorrect_processor_net", `transactions.${row.id}`, "Net is gross minus signed fee; do not subtract standalone fees twice.");
      }
      const current = payouts.filter((p) => !payouts.some((next) => next.priorAttemptRef === p.id) && p.memberRefs.includes(row.id));
      if (row.disposition === "assigned") {
        if (current.length !== 1 || current[0].id !== row.payoutRef) {
          fail("invalid_current_membership", `transactions.${row.id}`, "Each assigned transaction belongs to exactly one current payout attempt.");
        }
      } else if (!["unsettled", "unresolved"].includes(row.disposition) || row.payoutRef !== null ||
          payouts.some((p) => p.memberRefs.includes(row.id))) {
        fail("invalid_current_membership", `transactions.${row.id}`, "Unsettled and unresolved rows cannot also be payout members.");
      }
    }
    for (const payout of payouts) {
      const path = `payouts.${payout.id}`;
      if (!sourceValid(payout.sourceRef, ["payouts"]) || !chronological(payout, "occurredAt") ||
          !Number.isSafeInteger(payout.amountMinor) || !Array.isArray(payout.memberRefs) ||
          !sameSet(payout.memberRefs, [...new Set(payout.memberRefs)]) || payout.memberRefs.some((id) => !transactionMap.has(id))) {
        fail("invalid_payout_evidence", path, "Payout attempts retain exact processor amounts, dates, and member identities.");
      }
      if ((payout.memberRefs.length || payout.membershipSourceRef !== null) && !sourceValid(payout.membershipSourceRef, ["membership"])) {
        fail("missing_attributable_membership", path, "Automatic, manual, and instant memberships all need attributable processor evidence.");
      }
      const membership = sourceMap.get(payout.membershipSourceRef);
      if (membership && (!sameSet(membership.payoutRefs, [payout.id]) || !sameSet(membership.transactionRefs, payout.memberRefs) ||
          membership.bankReceiptRefs.length !== 0 || Date.parse(membership.issuedAt) < Date.parse(payout.occurredAt))) {
        fail("mismatched_membership_evidence", path, "Membership evidence must name this exact attempt and complete transaction set.");
      }
      for (const id of payout.memberRefs) {
        if (Date.parse(transactionMap.get(id)?.occurredAt) > Date.parse(payout.occurredAt)) {
          fail("invalid_payout_chronology", path, "Payout membership cannot borrow later transactions.");
        }
      }
      const prior = payoutMap.get(payout.priorAttemptRef);
      if (payout.priorAttemptRef !== null && (!prior || !["failed", "returned"].includes(prior.status) ||
          Date.parse(prior.occurredAt) >= Date.parse(payout.occurredAt) ||
          !sameSet(prior.memberRefs, payout.memberRefs) || prior.amountMinor !== payout.amountMinor)) {
        fail("invalid_payout_retry", path, "A retry preserves the exact failed/returned attempt, members and amount; changed batches need owner clarification.");
      }
      if (payouts.filter((next) => next.priorAttemptRef === payout.id).length > 1) {
        fail("invalid_payout_retry", path, "Competing retries remain unresolved, not two current payouts.");
      }
      const seen = new Set([payout.id]);
      let ancestor = prior;
      while (ancestor) {
        if (seen.has(ancestor.id)) { fail("invalid_payout_retry", path, "Retry lineage must be acyclic."); break; }
        seen.add(ancestor.id);
        ancestor = payoutMap.get(ancestor.priorAttemptRef);
      }
    }
    for (const receipt of bankReceipts) {
      if (!sourceValid(receipt.sourceRef, ["bank"]) || !chronological(receipt, "postedAt") || !Number.isSafeInteger(receipt.amountMinor)) {
        fail("invalid_bank_evidence", `bankReceipts.${receipt.id}`, "Receipt evidence comes from the bank, not a processor paid status.");
      }
    }
    if (new Set(mappings.map((row) => row.receiptRef)).size !== mappings.length) {
      fail("duplicate_bank_mapping", "mappings", "Map a bank row once or leave it explicitly unresolved.");
    }
    for (const mapping of mappings) {
      const evidence = sourceMap.get(mapping.sourceRef);
      const receipt = receiptMap.get(mapping.receiptRef);
      const payout = payoutMap.get(mapping.payoutRef);
      if (!sourceValid(mapping.sourceRef, ["mapping"]) || mapping.ownerRef !== scope.reviewerRef ||
          !receipt || receipt.amountMinor < 0 || !payout || !sameSet(evidence?.payoutRefs, [mapping.payoutRef]) ||
          !sameSet(evidence?.bankReceiptRefs, [mapping.receiptRef]) ||
          evidence?.transactionRefs.length !== 0 ||
          Date.parse(evidence?.issuedAt) < Date.parse(receipt?.postedAt) ||
          Date.parse(receipt?.postedAt) < Date.parse(payout?.occurredAt)) {
        fail("invalid_bank_mapping", `mappings.${mapping.id}`, "Use an explicit reviewer mapping bound to the exact bank row and payout attempt.");
      }
    }
    if (!isDeepStrictEqual(value.review, deriveMerchantPayoutReview(value))) {
      fail("incorrect_payout_review", "review", "Preserve independent arithmetic, every gap, reviewer ownership and non-settlement authority.");
    }
  } catch {
    fail("invalid_merchant_payout_shape", "$", "Malformed or unsafe values cannot produce a reconciled workpaper.");
  }
  return findings;
}
