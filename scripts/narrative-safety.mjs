export function hasUnnegatedNarrativeMatch(narrativeTexts, prohibitedNarrative) {
  const matcher = prohibitedNarrative.global
    ? prohibitedNarrative
    : new RegExp(prohibitedNarrative.source, `${prohibitedNarrative.flags}g`);
  const adjacentNegation =
    /\b(?:do not|does not|doesn't|did not|didn't|is not|isn't|are not|aren't|was not|wasn't|were not|weren't|not|no|never|without|cannot|can't|must not|mustn't|should not|shouldn't|will not|won't)\s*$/iu;
  const coordinatedNegation =
    /^\s*(?:(?:[A-Za-z0-9_-]+\s+){0,6})(?:,?\s*(?:and|or)\s*)$/iu;
  const coordinatedAnd =
    /^\s*(?:(?:[A-Za-z0-9_-]+\s+){0,6})(?:,?\s*and\s*)$/iu;
  const pastNegation = /\b(?:did not|didn't|was not|wasn't|were not|weren't)\s*$/iu;
  const inflectedPastAction = /^(?:[a-z]+ed|gave|made|paid|sent|wrote)\b/iu;
  function hasUnnegatedMatch(clause) {
    let previousEnd = 0;
    let previousNegated = false;
    let previousNegationWasPast = false;
    for (const match of clause.matchAll(matcher)) {
      const prefix = clause.slice(0, match.index);
      const connector = clause.slice(previousEnd, match.index);
      const directlyNegated = adjacentNegation.test(prefix);
      const negated =
        directlyNegated ||
        (previousNegated &&
          coordinatedNegation.test(connector) &&
          !(
            previousNegationWasPast &&
            coordinatedAnd.test(connector) &&
            inflectedPastAction.test(match[0])
          ));
      if (!negated) {
        return true;
      }
      previousEnd = match.index + match[0].length;
      previousNegated = true;
      if (directlyNegated) {
        previousNegationWasPast = pastNegation.test(prefix);
      }
    }
    return false;
  }

  return narrativeTexts.some((text) =>
    text
      .replaceAll("’", "'")
      .replace(/\s+/gu, " ")
      .split(
        /[.!?]\s*|\s*[;:]\s*|\s*,?\s*\b(?:but|however|yet|although|despite|nevertheless|nonetheless|still|even though)\b\s*/iu,
      )
      .some((clause) => hasUnnegatedMatch(clause)),
  );
}
