import type { ConceptId } from './types';

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
