import { describe, expect, it } from 'vitest';
import {
  buildWeaknessMap,
  bumpSessionWeakness,
  rankConceptMistakes,
  weaknessFromMasteryFraction,
} from './adaptive';
import { pickNextConcept } from './generate';
import type { ConceptId } from './types';

describe('weaknessFromMasteryFraction', () => {
  it('is neutral when there is no mastery data', () => {
    expect(weaknessFromMasteryFraction(null)).toBe(0);
  });

  it('maps perfect mastery to zero weakness', () => {
    expect(weaknessFromMasteryFraction(1)).toBe(0);
  });

  it('maps zero mastery to full weakness', () => {
    expect(weaknessFromMasteryFraction(0)).toBe(1);
  });

  it('maps partial mastery inversely', () => {
    expect(weaknessFromMasteryFraction(0.67)).toBeCloseTo(0.33, 2);
    expect(weaknessFromMasteryFraction(2 / 3)).toBeCloseTo(1 / 3, 2);
  });
});

describe('buildWeaknessMap', () => {
  it('builds a map from concept fractions', () => {
    const map = buildWeaknessMap({ balance: 1, introX: 0.33, solve: null });
    expect(map.balance).toBe(0);
    expect(map.introX).toBeCloseTo(0.67, 2);
    expect(map.solve).toBe(0);
  });
});

describe('bumpSessionWeakness', () => {
  it('raises a concept and caps at 1', () => {
    expect(bumpSessionWeakness({ balance: 0.5 }, 'balance')).toEqual({ balance: 0.7 });
    expect(bumpSessionWeakness({ balance: 0.9 }, 'balance', 0.2)).toEqual({ balance: 1 });
  });

  it('does not change other concepts', () => {
    expect(bumpSessionWeakness({ balance: 0.2, introX: 0.8 }, 'balance')).toEqual({
      balance: 0.4,
      introX: 0.8,
    });
  });
});

describe('rankConceptMistakes (what to revisit)', () => {
  it('returns nothing when no problems were missed', () => {
    expect(rankConceptMistakes({})).toEqual([]);
    expect(rankConceptMistakes({ solve: 0 })).toEqual([]);
  });

  it('orders concepts by most-missed first and limits to top N', () => {
    const ranked = rankConceptMistakes({ solve: 1, combine: 3, balance: 2 });
    expect(ranked).toEqual([
      { concept: 'combine', count: 3 },
      { concept: 'balance', count: 2 },
    ]);
  });
});

/** Simulate a full Daily Dig (8 problems) and return concept counts. */
function simulateDig(
  pool: ConceptId[],
  weakness: Partial<Record<ConceptId, number>>,
  problems = 8,
): Record<ConceptId, number> {
  const counts = Object.fromEntries(pool.map((c) => [c, 0])) as Record<ConceptId, number>;
  let last: ConceptId | null = null;
  for (let i = 0; i < problems; i++) {
    const next = pickNextConcept(pool, last, weakness);
    counts[next] += 1;
    last = next;
  }
  return counts;
}

describe('adaptive path dig simulation', () => {
  const pool: ConceptId[] = ['balance', 'introX', 'solve'];

  it('leans toward a fully weak skill over an 8-problem dig (Monte Carlo)', () => {
    const trials = 200;
    let neutralTotal = 0;
    let weakTotal = 0;
    for (let t = 0; t < trials; t++) {
      neutralTotal += simulateDig(pool, {}, 8).balance;
      weakTotal += simulateDig(pool, { balance: 1 }, 8).balance;
    }
    expect(weakTotal / trials).toBeGreaterThan(neutralTotal / trials + 1);
  });

  it('still surfaces every skill at least once when the pool has three', () => {
    const counts = simulateDig(pool, { balance: 1, introX: 0.8, solve: 0.6 }, 8);
    for (const concept of pool) {
      expect(counts[concept], `${concept} never appeared`).toBeGreaterThanOrEqual(1);
    }
  });

  it('session bumps raise pick rate for a missed skill', () => {
    const runs = 3000;
    const count = (weakness: Partial<Record<ConceptId, number>>) => {
      let n = 0;
      for (let i = 0; i < runs; i++) {
        if (pickNextConcept(pool, null, weakness) === 'balance') n += 1;
      }
      return n;
    };
    expect(count(bumpSessionWeakness({}, 'balance'))).toBeGreaterThan(count({}));
  });

  it('pulls an old weak skill up even when newer skills are in the pool', () => {
    const fullPool: ConceptId[] = ['balance', 'introX', 'solve', 'combine', 'expression'];
    const runs = 3000;
    const count = (weakness: Partial<Record<ConceptId, number>>) => {
      let n = 0;
      for (let i = 0; i < runs; i++) {
        if (pickNextConcept(fullPool, null, weakness) === 'balance') n += 1;
      }
      return n / runs;
    };
    expect(count({ balance: 1 })).toBeGreaterThan(count({}));
  });

  it('never repeats the same concept back-to-back when there is a choice', () => {
    for (let trial = 0; trial < 200; trial++) {
      let last: ConceptId | null = null;
      for (let i = 0; i < 8; i++) {
        const next = pickNextConcept(pool, last, { balance: 1 });
        if (last !== null) expect(next).not.toBe(last);
        last = next;
      }
    }
  });
});

describe('pickNextConcept weakness bias (adaptive path)', () => {
  it('picks a weak skill more often than with no weakness', () => {
    const pool: ConceptId[] = ['balance', 'introX', 'solve'];
    const runs = 3000;
    const countBalance = (weakness: Partial<Record<ConceptId, number>>) => {
      let n = 0;
      for (let i = 0; i < runs; i++) {
        if (pickNextConcept(pool, null, weakness) === 'balance') n += 1;
      }
      return n;
    };
    expect(countBalance({ balance: 1 })).toBeGreaterThan(countBalance({}));
  });
});
