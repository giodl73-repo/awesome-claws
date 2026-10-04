import { rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function writePortfolioSummary(proofRoot, summary) {
  // The portfolio has one writer; a timeout must not truncate its last checkpoint.
  const temporary = join(proofRoot, "summary.json.tmp");
  await writeFile(temporary, `${JSON.stringify(summary, null, 2)}\n`);
  await rename(temporary, join(proofRoot, "summary.json"));
}
