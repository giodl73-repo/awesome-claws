export function requiresPortfolioGateway(entry, options = {}) {
  return (
    (entry.cronJobs?.length ?? 0) > 0 ||
    entry.packages?.some((item) => item.kind === "plugin") === true ||
    options.visualRuntimeProof === true
  );
}
