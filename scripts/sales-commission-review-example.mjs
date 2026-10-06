export function commissionExample() {
  const start = "2026-10-01T00:00:00Z", end = "2026-10-05T00:00:00Z", eventAt = "2026-10-02T12:00:00Z";
  const evidence = (kind, record, at = eventAt) => ({ sourceRef: kind.toUpperCase(), revision: "V1", record, at, state: "current", decisionOwner: "COMP-OWNER" });
  return {
    schemaVersion: "awesomeClaws.commissionInput.v1",
    scope: { employer: "EMPLOYER", cycle: "OCT-REVIEW", currency: "USD", scale: 2, periodStart: start, periodEnd: end, asOf: end,
      owner: "COMP-OWNER", privateDestination: "outputs/sales-commission-review-preparer-handoff.md", complete: true, eventOrder: ["E1"], eventIds: ["E1"], payeeIds: ["PAYEE-A"], payoutIds: ["PAYOUT1"], reversalIds: ["R1"] },
    sources: ["plan", "opening", "event", "credit", "original", "reversal", "payout"].map((kind) => ({ id: kind.toUpperCase(), revision: "V1", employer: "EMPLOYER", currency: "USD", capturedAt: end, kind })),
    payees: ["PAYEE-A"],
    plans: [{ id: "PLAN1", version: "V1", payee: "PAYEE-A", attainmentPeriod: "OCT", effectiveFrom: start, effectiveTo: "2026-11-01T00:00:00Z", mechanic: "marginal", basis: "owner-credited-amount", rounding: "half-up-per-credit", reversalPolicy: "original-amount-no-attainment-rewind", tiers: [{ upToMinor: 1000000, rateBps: 500 }, { upToMinor: null, rateBps: 1000 }], evidence: evidence("plan", "PLAN1", start) }],
    openings: [{ id: "OPEN1", payee: "PAYEE-A", planRef: "PLAN1", planVersion: "V1", asOf: start, amountMinor: 900000, evidence: evidence("opening", "OPEN1", start) }],
    events: [{ id: "E1", identity: "DEAL-EVENT1", at: eventAt, amountMinor: 200000, evidence: evidence("event", "E1") }],
    credits: [{ id: "C1", eventRef: "E1", payee: "PAYEE-A", planRef: "PLAN1", planVersion: "V1", amountMinor: 200000, evidence: evidence("credit", "C1") }],
    originals: [{ id: "OLD1", identity: "ORIGINAL-COMMISSION1", creditRef: "OLD-CREDIT1", payee: "PAYEE-A", planRef: "OLD-PLAN", planVersion: "V1", at: "2026-09-20T12:00:00Z", commissionMinor: 8000, previouslyReversedMinor: 0, historyComplete: true, reversalPolicy: "original-amount-no-attainment-rewind", evidence: evidence("original", "OLD1", start) }],
    reversals: [{ id: "R1", identity: "REV1", originalRef: "OLD1", payee: "PAYEE-A", at: eventAt, amountMinor: 8000, evidence: evidence("reversal", "R1") }],
    payouts: [{ id: "PAYOUT1", identity: "PAYOUT-LINE1", payee: "PAYEE-A", cycle: "OCT-REVIEW", amountMinor: 7000, evidence: evidence("payout", "PAYOUT1", end) }],
  };
}
