import { createHash } from "node:crypto";

const STOP_WORDS = new Set([
  "all",
  "and",
  "any",
  "are",
  "about",
  "after",
  "agent",
  "against",
  "before",
  "between",
  "current",
  "each",
  "every",
  "for",
  "from",
  "has",
  "have",
  "into",
  "only",
  "prepare",
  "record",
  "should",
  "that",
  "their",
  "them",
  "these",
  "this",
  "those",
  "through",
  "using",
  "was",
  "were",
  "when",
  "where",
  "which",
  "while",
  "with",
  "without",
]);

const CATEGORIES = new Set([
  "analysis",
  "engineering",
  "governance",
  "operations",
  "product",
  "productivity",
]);

function tokens(values) {
  const words = values
    .flat()
    .filter((value) => typeof value === "string")
    .join(" ")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .split(/\s+/u)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
  return new Set(words.map((word) => (word.length > 4 ? word.replace(/s$/u, "") : word)));
}

function jaccard(left, right) {
  if (left.size === 0 && right.size === 0) return 0;
  const intersection = [...left].filter((value) => right.has(value));
  return intersection.length / new Set([...left, ...right]).size;
}

function shared(left, right) {
  return [...left].filter((value) => right.has(value)).toSorted().slice(0, 8);
}

function capabilityTokens(entry) {
  const profile = entry.openclawProfile?.agent?.tools;
  return [
    ...(entry.packages ?? []).flatMap((item) => [item.kind, item.ref]),
    ...Object.keys(entry.mcpServers ?? {}),
    ...(entry.cronJobs ?? []).map((item) => item.id),
    profile?.profile,
    ...(profile?.allow ?? []),
    ...(profile?.alsoAllow ?? []),
  ];
}

function dimensions(entry) {
  return {
    job: tokens([
      entry.description,
      entry.workflow,
      entry.example?.request,
      entry.example?.outcome,
    ]),
    outputs: tokens([entry.deliverables, entry.doneWhen]),
    audience: tokens([entry.audience, entry.intake]),
    boundaries: tokens(entry.boundaries ?? []),
    capabilities: tokens(capabilityTokens(entry)),
  };
}

export function compareClaws(candidate, existing) {
  const left = dimensions(candidate);
  const right = dimensions(existing);
  const weights = {
    job: 0.45,
    outputs: 0.25,
    audience: 0.15,
    boundaries: 0.1,
    capabilities: 0.05,
  };
  const scores = Object.fromEntries(
    Object.keys(weights).map((key) => [key, jaccard(left[key], right[key])]),
  );
  const score = Object.entries(weights).reduce(
    (total, [key, weight]) => total + scores[key] * weight,
    candidate.category === existing.category ? 0.03 : 0,
  );
  return {
    id: existing.id,
    name: existing.name,
    category: existing.category,
    score: Math.min(1, score),
    dimensions: Object.fromEntries(
      Object.keys(weights).map((key) => [
        key,
        { score: scores[key], sharedTerms: shared(left[key], right[key]) },
      ]),
    ),
  };
}

export function contributionSimilarityReport(candidate, entries, limit = 5) {
  const matches = entries
    .filter((entry) => entry.id !== candidate.id)
    .map((entry) => compareClaws(candidate, entry))
    .toSorted((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, limit);
  const highest = matches[0]?.score ?? 0;
  return {
    schemaVersion: "awesomeClaws.contributionSimilarity.v1",
    candidate: { id: candidate.id, name: candidate.name, category: candidate.category },
    algorithm: "weighted-token-jaccard-v1",
    advisoryVerdict:
      highest >= 0.35
        ? "likely-extension"
        : highest >= 0.15
          ? "needs-distinction-review"
          : "distinct-on-declared-contract",
    matches,
  };
}

export function nearestMatchDiscussion(candidate, entries, alternatives, limit = 5) {
  const nearest = contributionSimilarityReport(candidate, entries, limit).matches.map(
    (match) => match.id,
  );
  const discussed = new Set(alternatives.map((alternative) => alternative.id));
  const required = Math.min(2, nearest.length);
  const discussedCount = nearest.filter((id) => discussed.has(id)).length;
  return {
    nearest,
    required,
    discussedCount,
    valid: discussedCount >= required,
  };
}

export function renderSimilarityMarkdown(report) {
  const rows = report.matches
    .map((match) => {
      const strongest = Object.entries(match.dimensions)
        .toSorted((left, right) => right[1].score - left[1].score)
        .slice(0, 2)
        .map(([name, detail]) => `${name}: ${detail.sharedTerms.join(", ") || "no shared terms"}`)
        .join("; ");
      return `| \`${match.id}\` | ${(match.score * 100).toFixed(1)}% | ${strongest} |`;
    })
    .join("\n");
  return `# Contribution similarity review: ${report.candidate.name}

**Advisory result:** \`${report.advisoryVerdict}\`

This lexical comparison is a review aid, not an admission decision. Maintainers
must compare the actual user, repeatable job, workflow, outputs, authority, and
proof—not titles alone.

| Existing Claw | Weighted overlap | Strongest shared signals |
| --- | ---: | --- |
${rows}
`;
}

export function catalogIdentityDigest(entries) {
  return createHash("sha256")
    .update(entries.map((entry) => entry.id).toSorted().join("\n"))
    .digest("hex");
}

export function validateContributionProposal(
  proposal,
  catalog,
  { validateAlternatives = true } = {},
) {
  const errors = [];
  const entry = proposal?.entry;
  const contribution = proposal?.contribution;
  if (proposal?.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!entry || typeof entry !== "object") return [...errors, "entry is required"];
  if (!/^[a-z][a-z0-9-]{2,63}$/u.test(entry.id ?? "")) {
    errors.push("entry.id must be a stable lowercase slug");
  }
  if (
    /^(?:claw-?)?\d+(?:-|$)|(?:^|-)\d+(?:-|$)|(?:^|-)v\d+(?:-|$)|[a-z]\d+$/u.test(
      entry.id ?? "",
    )
  ) {
    errors.push("entry.id must not use a sequence number");
  }
  const scalarFields = ["name", "category", "description", "audience"];
  for (const field of scalarFields) {
    if (typeof entry[field] !== "string" || entry[field].trim().length < 3) {
      errors.push(`entry.${field} must be a meaningful string`);
    }
  }
  if (!CATEGORIES.has(entry.category)) {
    errors.push(`entry.category must be one of ${[...CATEGORIES].join(", ")}`);
  }
  const minimums = {
    principles: 3,
    boundaries: 2,
    intake: 3,
    workflow: 4,
    deliverables: 4,
    doneWhen: 3,
    capabilityGuidance: 2,
  };
  for (const [field, minimum] of Object.entries(minimums)) {
    if (
      !Array.isArray(entry[field]) ||
      entry[field].length < minimum ||
      entry[field].some((value) => typeof value !== "string" || value.trim().length < 8)
    ) {
      errors.push(`entry.${field} requires at least ${minimum} substantive items`);
    }
  }
  if (
    typeof entry.example?.request !== "string" ||
    typeof entry.example?.outcome !== "string"
  ) {
    errors.push("entry.example requires request and outcome");
  }
  if (!contribution || typeof contribution !== "object") {
    errors.push("contribution is required");
  } else {
    for (const field of ["problem", "repeatableJob", "proofPlan"]) {
      if (typeof contribution[field] !== "string" || contribution[field].trim().length < 20) {
        errors.push(`contribution.${field} must explain the proposal`);
      }
    }
    const alternatives = contribution.existingAlternatives;
    if (validateAlternatives && (!Array.isArray(alternatives) || alternatives.length < 3)) {
      errors.push("contribution.existingAlternatives requires at least three comparisons");
    } else if (validateAlternatives) {
      const known = new Set(catalog.map((item) => item.id));
      for (const [index, alternative] of alternatives.entries()) {
        if (alternative.id === entry.id) {
          errors.push(`existingAlternatives[${index}].id must not name the proposed Claw`);
        }
        if (!known.has(alternative.id)) {
          errors.push(`existingAlternatives[${index}].id must name an existing Claw`);
        }
        for (const field of ["overlap", "difference"]) {
          if (
            typeof alternative[field] !== "string" ||
            alternative[field].trim().length < 20
          ) {
            errors.push(`existingAlternatives[${index}].${field} must be substantive`);
          }
        }
      }
      if (new Set(alternatives.map((item) => item.id)).size !== alternatives.length) {
        errors.push("existingAlternatives ids must be unique");
      }
    }
  }
  return errors;
}
