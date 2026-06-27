/**
 * Aggressive, SEEDED loop-test of the spaced-retrieval engine (`srs.ts`).
 *
 * It simulates dozens of "middle-schooler" learners over ~30 simulated days
 * each, with random correct/incorrect answers and random session timing, and
 * asserts the SRS invariants at EVERY step. Because it is seeded, a failure is
 * reproducible; because it sweeps random start dates it crosses month, year, and
 * leap-year boundaries. The pure-function property tests below pin down the
 * per-operation contracts the simulation relies on.
 */
import { describe, expect, it } from 'vitest';
import {
  addDays,
  freshMemory,
  getDueConcepts,
  intervalForBox,
  reviewSkill,
  skillState,
  weaknessFromSkills,
} from './srs';
import type { SkillMemory } from './srs';
import { CONCEPTS } from './generate';
import type { ConceptId } from './types';

type SkillsMap = Partial<Record<ConceptId, SkillMemory>>;

/** Deterministic PRNG (mulberry32): same seed → same stream, so failures repro. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** Whole-day index for a 'YYYY-MM-DD' key (UTC, TZ-agnostic) — reference math. */
function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

/** Overdue days on `today` (0 when not yet due) — mirrors weaknessFromSkills. */
function overdueDays(memory: SkillMemory, today: string): number {
  return Math.max(0, dayNumber(today) - dayNumber(memory.dueDate));
}

/** Every per-review invariant, checked against the prior memory. */
function assertReviewInvariants(
  prev: SkillMemory | undefined,
  next: SkillMemory,
  correct: boolean,
  today: string,
  trace: string,
): void {
  // Shape: every field present, finite, and the right type (Firestore-safe).
  expect(typeof next.strength, trace).toBe('number');
  expect(Number.isFinite(next.strength), trace).toBe(true);
  expect(Number.isInteger(next.box), trace).toBe(true);
  expect(Number.isInteger(next.reviews), trace).toBe(true);
  expect(Number.isInteger(next.lapses), trace).toBe(true);
  expect(next.dueDate, trace).toMatch(DATE_KEY);
  expect(next.lastSeen, trace).toBe(today);

  // Ranges: box in [1,5], strength in [0,1].
  expect(next.box, trace).toBeGreaterThanOrEqual(1);
  expect(next.box, trace).toBeLessThanOrEqual(5);
  expect(next.strength, trace).toBeGreaterThanOrEqual(0);
  expect(next.strength, trace).toBeLessThanOrEqual(1);

  const base = prev ?? freshMemory(today);
  // reviews increment by exactly one; lapses are monotonic non-decreasing.
  expect(next.reviews, trace).toBe(base.reviews + 1);
  expect(next.lapses, trace).toBeGreaterThanOrEqual(base.lapses);

  if (correct) {
    expect(next.box, trace).toBe(Math.min(base.box + 1, 5));
    expect(next.dueDate, trace).toBe(addDays(today, intervalForBox(next.box)));
    expect(next.lapses, trace).toBe(base.lapses);
    expect(next.strength, trace).toBeGreaterThanOrEqual(base.strength);
    if (base.strength < 1) expect(next.strength, trace).toBeGreaterThan(base.strength);
  } else {
    expect(next.box, trace).toBe(1);
    expect(next.dueDate, trace).toBe(addDays(today, intervalForBox(1)));
    expect(next.dueDate, trace).toBe(addDays(today, 1)); // back tomorrow
    expect(next.lapses, trace).toBe(base.lapses + 1);
    expect(next.strength, trace).toBeLessThanOrEqual(base.strength);
    if (base.strength > 0) expect(next.strength, trace).toBeLessThan(base.strength);
  }
}

/** Reference: due = dueDate ≤ today, most-overdue (earliest due) first, stable. */
function expectedDue(skills: SkillsMap, today: string): ConceptId[] {
  return (Object.entries(skills) as [ConceptId, SkillMemory | undefined][])
    .filter((e): e is [ConceptId, SkillMemory] => Boolean(e[1]) && e[1]!.dueDate <= today)
    .map((e, index) => ({ e, index }))
    .sort((a, b) => (a.e[1].dueDate < b.e[1].dueDate ? -1 : a.e[1].dueDate > b.e[1].dueDate ? 1 : a.index - b.index))
    .map(({ e }) => e[0]);
}

/** Global invariants over a whole skills map on a given day. */
function assertMapInvariants(skills: SkillsMap, today: string, trace: string): void {
  const due = getDueConcepts(skills, today);

  // getDueConcepts returns only entries due on/before today.
  for (const concept of due) {
    expect(skills[concept]!.dueDate <= today, `${trace} ${concept} not actually due`).toBe(true);
  }
  // ...and nothing due was left out.
  expect(due, `${trace} due set/order`).toEqual(expectedDue(skills, today));
  // Order is non-decreasing by dueDate (most overdue first).
  for (let i = 1; i < due.length; i++) {
    expect(skills[due[i - 1]]!.dueDate <= skills[due[i]]!.dueDate, `${trace} due order`).toBe(true);
  }

  const weakness = weaknessFromSkills(skills, today);
  for (const concept of Object.keys(skills) as ConceptId[]) {
    const memory = skills[concept];
    if (!memory) continue;

    // weakness in [0,1].
    const w = weakness[concept]!;
    expect(w, `${trace} ${concept} weakness range`).toBeGreaterThanOrEqual(0);
    expect(w, `${trace} ${concept} weakness range`).toBeLessThanOrEqual(1);

    // A strong, not-yet-due skill stays near zero.
    if (memory.strength >= 0.8 && memory.dueDate > today) {
      expect(w, `${trace} ${concept} fresh-strong near zero`).toBeLessThan(0.2);
    }

    // skillState follows the box thresholds exactly.
    const state = skillState(memory);
    if (memory.box >= 5) expect(state, trace).toBe('mastered');
    else if (memory.box >= 3) expect(state, trace).toBe('practicing');
    else expect(state, trace).toBe('learning');
  }

  // weakness is monotonic: lower strength AND ≥ overdue ⇒ ≥ weakness.
  const concepts = (Object.keys(skills) as ConceptId[]).filter((c) => skills[c]);
  for (const a of concepts) {
    for (const b of concepts) {
      const ma = skills[a]!;
      const mb = skills[b]!;
      if (ma.strength <= mb.strength && overdueDays(ma, today) >= overdueDays(mb, today)) {
        expect(
          weakness[a]! >= weakness[b]! - 1e-9,
          `${trace} weakness monotonic ${a}(${weakness[a]}) vs ${b}(${weakness[b]})`,
        ).toBe(true);
      }
    }
  }
}

describe('srs simulation — dozens of learners across ~30 days each (seeded)', () => {
  const LEARNERS = 60;
  const DAYS = 30;

  it('holds every SRS invariant at every step, for every learner', () => {
    for (let learner = 0; learner < LEARNERS; learner++) {
      const rng = mulberry32(0x5eed + learner * 2654435761);
      // Random start date across 2024–2026, crossing leap day + year boundaries.
      let today = addDays('2024-01-01', Math.floor(rng() * 800));
      // Each learner engages a random subset of the five concepts.
      const engaged = CONCEPTS.filter(() => rng() < 0.7);
      if (engaged.length === 0) engaged.push('solve');
      // Per-learner accuracy and how often they actually show up.
      const accuracy = 0.45 + rng() * 0.5; // 0.45–0.95
      const showUpRate = 0.5 + rng() * 0.5;

      let skills: SkillsMap = {};
      // First exposure: each engaged concept gets its first review on day 0.
      for (const concept of engaged) {
        const correct = rng() < accuracy;
        const prev = skills[concept];
        const next = reviewSkill(prev, correct, today);
        assertReviewInvariants(prev, next, correct, today, `L${learner} init ${concept}`);
        skills = { ...skills, [concept]: next };
      }
      // Track the distinct calendar days each concept was reviewed, to prove
      // box 5 (Mastered) is only reachable after spaced reviews on ≥4 days.
      const reviewDays: Partial<Record<ConceptId, Set<string>>> = {};
      for (const concept of engaged) reviewDays[concept] = new Set([today]);

      for (let day = 0; day < DAYS; day++) {
        // Random session timing: usually 1–5 days between visits, but ~15% of the
        // time the learner vanishes for weeks (20–120 days) and returns to a pile
        // of overdue skills — the sporadic-middle-schooler pattern.
        today = rng() < 0.15
          ? addDays(today, 20 + Math.floor(rng() * 100))
          : addDays(today, 1 + Math.floor(rng() * 5));
        assertMapInvariants(skills, today, `L${learner} D${day} pre`);
        if (rng() > showUpRate) continue; // some days the learner doesn't show

        // Two realistic session shapes (each records once per concept):
        //  - 'review': only the due-today concepts (the Daily Review).
        //  - 'dig':    every engaged concept (the per-lesson Daily Treasure Dig).
        const due = getDueConcepts(skills, today);
        const session = rng() < 0.5 ? due : engaged;
        for (const concept of session) {
          const correct = rng() < accuracy;
          const prev = skills[concept];
          const next = reviewSkill(prev, correct, today);
          assertReviewInvariants(prev, next, correct, today, `L${learner} D${day} ${concept}`);
          skills = { ...skills, [concept]: next };
          (reviewDays[concept] ??= new Set()).add(today);

          // Mastered (box 5) must have taken ≥4 correct promotions on ≥4 days.
          if (next.box === 5) {
            expect(next.reviews, `L${learner} ${concept} box5 reviews`).toBeGreaterThanOrEqual(4);
            expect(
              reviewDays[concept]!.size,
              `L${learner} ${concept} box5 needs ≥4 distinct days`,
            ).toBeGreaterThanOrEqual(4);
          }
        }
        assertMapInvariants(skills, today, `L${learner} D${day} post`);
      }
    }
  });
});

describe('addDays — pure UTC math across month/year/leap boundaries (seeded fuzz)', () => {
  it('matches a reference UTC computation and round-trips for random offsets', () => {
    const rng = mulberry32(0xda7e);
    for (let i = 0; i < 5000; i++) {
      const start = addDays('2020-01-01', Math.floor(rng() * 4000)); // ~2020–2031
      const n = Math.floor(rng() * 1000) - 500; // -500..+500
      const got = addDays(start, n);
      // Reference: independent UTC math.
      const [y, m, d] = start.split('-').map(Number);
      const ref = new Date(Date.UTC(y, m - 1, d) + n * MS_PER_DAY);
      const refKey = `${ref.getUTCFullYear()}-${String(ref.getUTCMonth() + 1).padStart(2, '0')}-${String(
        ref.getUTCDate(),
      ).padStart(2, '0')}`;
      expect(got, `addDays(${start}, ${n})`).toBe(refKey);
      expect(got).toMatch(DATE_KEY);
      // Round-trips with no drift.
      expect(addDays(got, -n)).toBe(start);
    }
  });

  it('handles the named calendar edges exactly', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29'); // leap day exists
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDays('2023-02-28', 1)).toBe('2023-03-01'); // non-leap skips it
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01'); // year roll-over
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2100-02-28', 1)).toBe('2100-03-01'); // 2100 is NOT a leap year
    expect(addDays('2000-02-28', 1)).toBe('2000-02-29'); // 2000 IS a leap year
  });
});

describe('intervalForBox — strictly increasing schedule', () => {
  it('is strictly increasing across boxes 1..5 and clamps the ends', () => {
    const intervals = [1, 2, 3, 4, 5].map(intervalForBox);
    expect(intervals).toEqual([1, 2, 4, 9, 21]);
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
    }
    // Out-of-range and non-integer boxes clamp/round into [1,5].
    expect(intervalForBox(-3)).toBe(intervalForBox(1));
    expect(intervalForBox(0)).toBe(intervalForBox(1));
    expect(intervalForBox(6)).toBe(intervalForBox(5));
    expect(intervalForBox(999)).toBe(intervalForBox(5));
    expect(intervalForBox(2.4)).toBe(intervalForBox(2));
    expect(intervalForBox(2.6)).toBe(intervalForBox(3));
  });
});

describe('reviewSkill — robust against out-of-range / malformed prior box', () => {
  it('always clamps the output box into [1,5] and keeps fields well-formed', () => {
    const weird: SkillMemory = {
      strength: 0.5,
      box: 99, // corrupt (too high)
      dueDate: '2026-01-01',
      lastSeen: '2026-01-01',
      reviews: 3,
      lapses: 1,
    };
    const promoted = reviewSkill(weird, true, '2026-02-01');
    expect(promoted.box).toBe(5); // min(99+1, 5)
    assertReviewInvariants(weird, promoted, true, '2026-02-01', 'corrupt-high correct');

    const low: SkillMemory = { ...weird, box: -4 };
    const onWrong = reviewSkill(low, false, '2026-02-01');
    expect(onWrong.box).toBe(1);
    assertReviewInvariants(low, onWrong, false, '2026-02-01', 'corrupt-low wrong');
  });
});

describe('getDueConcepts — ordering and tie stability (seeded fuzz)', () => {
  it('returns only due concepts, most-overdue first, stable on ties', () => {
    const rng = mulberry32(0xd00d);
    for (let trial = 0; trial < 2000; trial++) {
      const today = addDays('2026-01-01', Math.floor(rng() * 400));
      const skills: SkillsMap = {};
      // Build a map with many duplicate due dates to stress tie stability.
      for (const concept of CONCEPTS) {
        if (rng() < 0.25) continue; // sometimes omit a concept entirely
        const dueDate = addDays(today, Math.floor(rng() * 11) - 5); // -5..+5 around today
        skills[concept] = {
          strength: rng(),
          box: 1 + Math.floor(rng() * 5),
          dueDate,
          lastSeen: addDays(dueDate, -1),
          reviews: 1 + Math.floor(rng() * 10),
          lapses: Math.floor(rng() * 3),
        };
      }
      expect(getDueConcepts(skills, today)).toEqual(expectedDue(skills, today));
    }
  });

  it('is calm (empty) when nothing is due and lists all when everything is overdue', () => {
    const future: SkillsMap = {
      balance: { strength: 1, box: 5, dueDate: '2026-12-31', lastSeen: '2026-01-01', reviews: 5, lapses: 0 },
      solve: { strength: 1, box: 5, dueDate: '2026-12-30', lastSeen: '2026-01-01', reviews: 5, lapses: 0 },
    };
    expect(getDueConcepts(future, '2026-06-01')).toEqual([]);

    const allOverdue: SkillsMap = {
      balance: { strength: 0.2, box: 1, dueDate: '2026-01-05', lastSeen: '2026-01-04', reviews: 2, lapses: 1 },
      solve: { strength: 0.1, box: 1, dueDate: '2026-01-02', lastSeen: '2026-01-01', reviews: 2, lapses: 2 },
      introX: { strength: 0.3, box: 2, dueDate: '2026-01-02', lastSeen: '2026-01-01', reviews: 1, lapses: 0 },
    };
    // Most overdue first; the two 01-02 ties keep insertion order (solve, introX).
    expect(getDueConcepts(allOverdue, '2026-06-01')).toEqual(['solve', 'introX', 'balance']);
  });
});

describe('weaknessFromSkills + skillState — edge maps', () => {
  it('skips undefined/empty entries and stays in range', () => {
    expect(weaknessFromSkills({}, '2026-01-01')).toEqual({});
    const withHole: SkillsMap = { solve: undefined };
    expect(weaknessFromSkills(withHole, '2026-01-01')).toEqual({});
    expect(getDueConcepts(withHole, '2026-01-01')).toEqual([]);
  });

  it('treats an unseen skill as learning', () => {
    expect(skillState(undefined)).toBe('learning');
  });

  it('reaches Mastered only by surviving the full spaced chain on different days', () => {
    // Review correctly, each time on the due date (so reviews land on real,
    // separate calendar days). Box climbs 2→3→4→5; 'mastered' arrives only on the
    // FOURTH correct review (box 5), never on a single good day.
    let today = '2026-03-01';
    let memory = reviewSkill(undefined, true, today); // box 2
    const days = new Set([today]);
    const states: string[] = [skillState(memory)];
    for (let i = 0; i < 4; i++) {
      today = memory.dueDate;
      memory = reviewSkill(memory, true, today);
      days.add(today);
      states.push(skillState(memory));
    }
    // box: 2(learning) → 3(practicing) → 4(practicing) → 5(mastered) → 5(mastered)
    expect(states).toEqual(['learning', 'practicing', 'practicing', 'mastered', 'mastered']);
    expect(memory.box).toBe(5);
    // Mastered required four correct reviews spread over four distinct days.
    expect(memory.reviews).toBeGreaterThanOrEqual(4);
    expect(days.size).toBeGreaterThanOrEqual(4);
  });
});
