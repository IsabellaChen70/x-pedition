import type { ConceptId } from './types';

// Weakness derived from persisted spaced-repetition memory (low strength and/or
// overdue => higher weight) is defined once in srs.ts. Re-exported here so the
// Daily Dig builds its skills-based weakness map from the same place it gets the
// mastery-fraction one, with no duplicated logic.
export { weaknessFromSkills } from './srs';

/** Maps a lesson mastery fraction (0-1 correct) to a practice weakness score (0-1). */
export function weaknessFromMasteryFraction(fraction: number | null): number {
  if (fraction === null) return 0;
  return Math.max(0, Math.min(1, 1 - fraction));
}

/**
 * Build a per-concept weakness map from mastery fractions. Missing entries are
 * neutral (0). Used by the Daily Dig to lean toward skills the learner missed.
 */
export function buildWeaknessMap(
  fractions: Partial<Record<ConceptId, number | null>>,
): Partial<Record<ConceptId, number>> {
  const out: Partial<Record<ConceptId, number>> = {};
  for (const [concept, fraction] of Object.entries(fractions) as [ConceptId, number | null][]) {
    out[concept] = weaknessFromMasteryFraction(fraction);
  }
  return out;
}

/**
 * Whether a concept that appeared during one dig counts as a CORRECT spaced
 * review: the learner answered it right on the first try at least as often as
 * they missed it (first-try wins ≥ distinct misses). Recorded exactly once per
 * concept per dig so a Leitner box advances at most one step per study session.
 * Pure; a concept that only ever appeared (0 wins, 0 misses) counts as correct.
 */
export function digReviewCorrect(firstTryWins: number, misses: number): boolean {
  return firstTryWins >= misses;
}

/** After a miss in the dig, nudge that skill's weight up (capped at 1). */
export function bumpSessionWeakness(
  weakness: Partial<Record<ConceptId, number>>,
  concept: ConceptId,
  amount = 0.2,
): Partial<Record<ConceptId, number>> {
  const prev = weakness[concept] ?? 0;
  return { ...weakness, [concept]: Math.min(1, prev + amount) };
}

/**
 * Rank the concepts a learner missed during a dig, most-missed first, for the
 * "what to revisit" nudge on the completion screen. Pure; zero/empty -> [].
 */
export function rankConceptMistakes(
  mistakes: Partial<Record<ConceptId, number>>,
  limit = 2,
): { concept: ConceptId; count: number }[] {
  return (Object.entries(mistakes) as [ConceptId, number][])
    .filter(([, count]) => count > 0)
    .map(([concept, count]) => ({ concept, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
