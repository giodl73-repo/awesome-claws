function compatible(result) {
  return (
    result?.status === "lifecycle-passed" &&
    ["runtime-wiring-passed", "installed-visual-runtime-passed"].includes(
      result.applicationScenario?.status,
    )
  );
}

export function buildCompatibilityReport({
  catalog,
  portfolioSummary,
  execution = { status: 0 },
  generatedAt = new Date().toISOString(),
}) {
  const results = new Map(
    (portfolioSummary?.results ?? []).map((result) => [result.id, result]),
  );
  const catalogIds = new Set(catalog.entries.map((entry) => entry.id));
  const unknownResultIds = [...results.keys()].filter((id) => !catalogIds.has(id)).toSorted();
  const entries = catalog.entries.map((entry) => {
    const result = results.get(entry.id);
    const status = result ? (compatible(result) ? "compatible" : "incompatible") : "not-run";
    return {
      id: entry.id,
      name: entry.name,
      maintenance: entry.maintenance,
      status,
      ...(result
        ? {
            lifecycle: result.status,
            applicationScenario: result.applicationScenario?.status ?? "not-run",
            ...(result.failure ? { failure: result.failure } : {}),
          }
        : {}),
    };
  });
  const counts = {
    total: entries.length,
    compatible: entries.filter((entry) => entry.status === "compatible").length,
    incompatible: entries.filter((entry) => entry.status === "incompatible").length,
    notRun: entries.filter((entry) => entry.status === "not-run").length,
  };
  const passed =
    execution.status === 0 &&
    !execution.error &&
    unknownResultIds.length === 0 &&
    counts.compatible === counts.total;
  return {
    schemaVersion: "awesomeClaws.compatibilityCanary.v1",
    generatedAt,
    status: passed ? "passed" : "failed",
    revisions: portfolioSummary?.revisions,
    evidenceClaims: portfolioSummary?.evidenceClaims,
    execution: {
      status: execution.status,
      signal: execution.signal ?? null,
      ...(execution.error ? { error: execution.error } : {}),
      ...(execution.summaryError ? { summaryError: execution.summaryError } : {}),
    },
    counts,
    unknownResultIds,
    entries,
  };
}

export function renderCompatibilityReport(report) {
  const failures = report.entries.filter((entry) => entry.status !== "compatible");
  const revisions = Object.entries(report.revisions ?? {})
    .map(([name, revision]) => `- ${name}: \`${revision}\``)
    .join("\n");
  const executionFailure = [report.execution.error, report.execution.summaryError]
    .filter(Boolean)
    .map((message) => `- ${message}`)
    .join("\n");
  const failureRows =
    failures.length === 0
      ? "All catalog entries passed."
      : [
          "| Claw | Status | Phase | Provisional owner |",
          "| --- | --- | --- | --- |",
          ...failures.map(
            (entry) =>
              `| \`${entry.id}\` | ${entry.status} | ${entry.failure?.phase ?? "not run"} | ${entry.failure?.provisionalOwner ?? "unclassified"} |`,
          ),
        ].join("\n");
  return `# Awesome Claws compatibility canary

**Status:** ${report.status}
**Checked:** ${report.generatedAt}
**Coverage:** ${report.counts.compatible}/${report.counts.total} compatible; ${report.counts.incompatible} incompatible; ${report.counts.notRun} not run

## Revisions

${revisions || "- Exact revisions unavailable because proof did not start."}

## Results requiring attention

${executionFailure ? `### Proof execution\n\n${executionFailure}\n\n` : ""}${failureRows}

This is scheduled compatibility evidence against a moving OpenClaw revision. It
does not change reviewed catalog maintenance state or replace pinned pull-request
proof.
`;
}
