import { readFile, writeFile } from "node:fs/promises";

const [mode, inputPath, outputPath] = process.argv.slice(2);

if (mode === "continuity-v1") {
  const fixture = JSON.parse(await readFile(inputPath, "utf8"));
  const checkpoint = {
    ...fixture,
    evidence: fixture.evidence.filter((item) => item.id === "prior-handoff"),
    checkpoints: [fixture.checkpoints[0]],
    actions: [],
    resume: {
      ...fixture.resume,
      checkpointRef: fixture.checkpoints[0].id,
      nextCustodian: "day shift",
    },
  };
  await writeFile(outputPath, `${JSON.stringify(checkpoint, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify({ pid: process.pid, checkpointRef: checkpoint.resume.checkpointRef }));
} else if (mode === "continuity-v2") {
  const [prior, fixture] = await Promise.all([
    readFile(outputPath, "utf8").then(JSON.parse),
    readFile(inputPath, "utf8").then(JSON.parse),
  ]);
  if (prior.resume.checkpointRef !== fixture.checkpoints[0].id) {
    throw new Error("Continuity worker did not resume from the persisted first checkpoint.");
  }
  const resumed = {
    ...fixture,
    checkpoints: [...prior.checkpoints, fixture.checkpoints[1]],
  };
  await writeFile(outputPath, `${JSON.stringify(resumed, null, 2)}\n`);
  console.log(JSON.stringify({ pid: process.pid, checkpointRef: resumed.resume.checkpointRef }));
} else if (mode === "delegation") {
  const assignment = JSON.parse(await readFile(inputPath, "utf8"));
  const source = await readFile(assignment.sourcePath, "utf8");
  if (!source.includes(assignment.expectedMarker)) {
    throw new Error(`Assigned source did not contain ${assignment.expectedMarker}.`);
  }
  console.log(
    JSON.stringify({
      pid: process.pid,
      id: `${assignment.id}-result`,
      assignmentRef: assignment.id,
      sourceRefs: assignment.sourceRefs,
      summary: assignment.summary,
      confidence: assignment.confidence,
    }),
  );
} else if (mode === "household") {
  const assignment = JSON.parse(await readFile(inputPath, "utf8"));
  const source = await readFile(assignment.sourcePath, "utf8");
  if (!source.includes(assignment.expectedMarker)) {
    throw new Error(`Assigned household source did not contain ${assignment.expectedMarker}.`);
  }
  console.log(
    JSON.stringify({
      pid: process.pid,
      id: assignment.result.id,
      assignmentRef: assignment.id,
      sourceArtifactRefs: assignment.sourceArtifactRefs,
      decisionOwnerRef: assignment.result.decisionOwnerRef,
      status: assignment.result.status,
      safetyState: assignment.result.safetyState,
      prohibitedActions: assignment.result.prohibitedActions,
      summary: assignment.result.summary,
      producedAt: assignment.result.producedAt,
    }),
  );
} else {
  throw new Error(`Unknown capstone worker mode: ${mode ?? "missing"}.`);
}
