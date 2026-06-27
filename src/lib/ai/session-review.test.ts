/**
 * Integration-granularity tests for the spaced-repetition write rules that live
 * in the components (LessonPlayer + PracticeSession). The exact accumulation
 * logic is replicated here as small, faithful mirrors of the component code
 * (commented with their source), wired to the REAL pure functions they call
 * (`digReviewCorrect`, `reviewSkill`, `masteryPass`, `countMasteryCorrect`), so a
 * drift in the rule is caught. The load-bearing invariant: each study session
 * (one mastery completion, one dig) advances a concept's Leitner box by at most
 * one step, so "Mastered" can only be earned by surviving real spaced delays.
 */
import { describe, expect, it } from 'vitest';
import { digReviewCorrect } from './adaptive';
import { conceptsForLesson } from './concepts';
import { addDays, freshMemory, getDueConcepts, intervalForBox, reviewSkill, skillState } from './srs';
import type { SkillMemory } from './srs';
import type { ConceptId } from './types';
import { countMasteryCorrect, masteryPass } from '../mastery';

type SkillsMap = Partial<Record<ConceptId, SkillMemory>>;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dayGap(from: string, to: string): number {
  const day = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / 86_400_000;
  };
  return day(to) - day(from);
}

/**
 * Faithful mirror of PracticeSession's per-dig spaced-review accumulation:
 *  - `appeared`        — every concept that showed up this dig (any submit).
 *  - `firstTryCorrect` — problems answered right on the first attempt.
 *  - `mistakes`        — distinct problems missed (first wrong attempt only).
 *  - `reviewsRecorded` — the once-per-dig guard; `restart()` re-arms it.
 * `finishDig` records exactly one review per appeared concept via the real
 * `digReviewCorrect` + `reviewSkill`, exactly like the component.
 */
class DigSim {
  appeared = new Set<ConceptId>();
  firstTryCorrect: Partial<Record<ConceptId, number>> = {};
  mistakes: Partial<Record<ConceptId, number>> = {};
  reviewsRecorded = false;

  /** Replay one problem: `attempts` is the ordered correct/wrong sequence. */
  playProblem(concept: ConceptId, attempts: boolean[]): void {
    let wrongAttempts = 0; // resets per problem in the component
    for (const ok of attempts) {
      this.appeared.add(concept); // appeared on every submit
      if (ok) {
        if (wrongAttempts === 0) {
          this.firstTryCorrect[concept] = (this.firstTryCorrect[concept] ?? 0) + 1;
        }
        return; // a correct answer ends the problem
      }
      if (wrongAttempts === 0) {
        this.mistakes[concept] = (this.mistakes[concept] ?? 0) + 1;
      }
      wrongAttempts += 1;
    }
  }

  /** Mirror of finishDig: one review per appeared concept, guarded once. */
  finishDig(prior: SkillsMap, today: string): { skills: SkillsMap; reviewedConcepts: ConceptId[] } {
    if (this.reviewsRecorded) return { skills: prior, reviewedConcepts: [] };
    this.reviewsRecorded = true;
    let skills: SkillsMap = { ...prior };
    const reviewedConcepts: ConceptId[] = [];
    for (const concept of this.appeared) {
      const correct = digReviewCorrect(
        this.firstTryCorrect[concept] ?? 0,
        this.mistakes[concept] ?? 0,
      );
      skills = { ...skills, [concept]: reviewSkill(skills[concept], correct, today) };
      reviewedConcepts.push(concept);
    }
    return { skills, reviewedConcepts };
  }

  /** Mirror of restart(): a fresh dig is a new session, re-arming the guard. */
  restart(): void {
    this.appeared = new Set();
    this.firstTryCorrect = {};
    this.mistakes = {};
    this.reviewsRecorded = false;
  }
}

describe('digReviewCorrect (per-concept dig outcome)', () => {
  it('counts a concept as correct iff first-try wins ≥ distinct misses', () => {
    expect(digReviewCorrect(1, 0)).toBe(true); // clean first-try win
    expect(digReviewCorrect(0, 0)).toBe(true); // appeared, no data → correct
    expect(digReviewCorrect(0, 1)).toBe(false); // a 2nd-try win / a miss
    expect(digReviewCorrect(2, 1)).toBe(true); // more wins than misses
    expect(digReviewCorrect(1, 1)).toBe(true); // a tie counts as correct
    expect(digReviewCorrect(1, 2)).toBe(false); // missed more than won
  });
});

describe('one dig = at most one box step per concept (session granularity)', () => {
  it('advances a repeated concept exactly once, however many times it appears', () => {
    const prior: SkillsMap = {
      solve: { strength: 0.5, box: 2, dueDate: '2026-01-01', lastSeen: '2026-01-01', reviews: 1, lapses: 0 },
    };
    const dig = new DigSim();
    // `solve` shows up in four problems this dig, mixed outcomes; net wins ≥ misses.
    dig.playProblem('solve', [true]); // first-try win
    dig.playProblem('solve', [false, true]); // 2nd-try win (a miss)
    dig.playProblem('solve', [true]); // first-try win
    dig.playProblem('solve', [false, false]); // missed + skipped
    expect(dig.firstTryCorrect.solve).toBe(2);
    expect(dig.mistakes.solve).toBe(2);

    const { skills, reviewedConcepts } = dig.finishDig(prior, '2026-02-01');
    // Exactly one review recorded for the concept, box advanced by one (2 → 3).
    expect(reviewedConcepts).toEqual(['solve']);
    expect(skills.solve!.reviews).toBe(prior.solve!.reviews + 1);
    expect(skills.solve!.box).toBe(3);
  });

  it('records each appeared concept exactly once across a fuzzed dig (seeded)', () => {
    const pool: ConceptId[] = ['balance', 'introX', 'solve', 'combine', 'expression'];
    for (let trial = 0; trial < 400; trial++) {
      const rng = mulberry32(0xd16 + trial * 40503);
      // A random but valid prior memory per concept.
      const prior: SkillsMap = {};
      for (const concept of pool) {
        if (rng() < 0.3) continue;
        prior[concept] = {
          strength: rng(),
          box: 1 + Math.floor(rng() * 5),
          dueDate: addDays('2026-01-01', Math.floor(rng() * 30)),
          lastSeen: '2026-01-01',
          reviews: 1 + Math.floor(rng() * 8),
          lapses: Math.floor(rng() * 3),
        };
      }
      const dig = new DigSim();
      const problemCount = 1 + Math.floor(rng() * 12);
      for (let p = 0; p < problemCount; p++) {
        const concept = pool[Math.floor(rng() * pool.length)];
        // Up to two attempts (correct ends it); model a realistic spread.
        const attempts: boolean[] = [];
        if (rng() < 0.7) {
          attempts.push(true); // first-try win
        } else {
          attempts.push(false); // a miss
          if (rng() < 0.6) attempts.push(true); // sometimes recover
          else attempts.push(false); // else skip after two misses
        }
        dig.playProblem(concept, attempts);
      }

      const today = '2026-02-15';
      const { skills, reviewedConcepts } = dig.finishDig(prior, today);

      // Exactly the distinct appeared concepts were reviewed, once each.
      expect(new Set(reviewedConcepts)).toEqual(dig.appeared);
      expect(reviewedConcepts.length).toBe(dig.appeared.size);

      for (const concept of pool) {
        const before = prior[concept];
        const after = skills[concept];
        if (!dig.appeared.has(concept)) {
          expect(after).toEqual(before); // untouched if it never appeared
          continue;
        }
        // Reviewed exactly once: reviews +1 and box moved at most one step.
        expect(after!.reviews).toBe((before?.reviews ?? 0) + 1);
        const beforeBox = before?.box ?? 1;
        if (after!.box === 1) {
          // a wrong review resets to box 1 (a legitimate single step down)
          expect(after!.dueDate).toBe(addDays(today, 1));
        } else {
          expect(after!.box).toBe(Math.min(beforeBox + 1, 5)); // at most +1
        }
      }
    }
  });

  it('guards against a double finishDig, but re-arms on Dig again (new session)', () => {
    const start: SkillsMap = {};
    const dig = new DigSim();
    dig.playProblem('balance', [true]);

    const first = dig.finishDig(start, '2026-03-01');
    expect(first.reviewedConcepts).toEqual(['balance']);
    expect(first.skills.balance!.box).toBe(2);

    // A second finishDig in the SAME dig is a no-op (the once-per-dig guard).
    const second = dig.finishDig(first.skills, '2026-03-01');
    expect(second.reviewedConcepts).toEqual([]);
    expect(second.skills.balance!.box).toBe(2);

    // "Dig again" starts a new study session: the guard re-arms and a fresh
    // win advances the box a second time (now legitimately a separate session).
    dig.restart();
    dig.playProblem('balance', [true]);
    const third = dig.finishDig(first.skills, '2026-03-02');
    expect(third.reviewedConcepts).toEqual(['balance']);
    expect(third.skills.balance!.box).toBe(3);
  });

  it('still reviews a concept that was only ever missed (correct = false)', () => {
    const prior: SkillsMap = {
      combine: { strength: 0.8, box: 4, dueDate: '2026-01-10', lastSeen: '2026-01-01', reviews: 4, lapses: 0 },
    };
    const dig = new DigSim();
    dig.playProblem('combine', [false, false]); // missed + skipped
    const { skills, reviewedConcepts } = dig.finishDig(prior, '2026-02-01');
    expect(reviewedConcepts).toEqual(['combine']);
    expect(skills.combine!.box).toBe(1); // lapse pulls it back to box 1
    expect(skills.combine!.lapses).toBe(1);
    expect(skills.combine!.dueDate).toBe(addDays('2026-02-01', 1));
  });

  it('records nothing when no concept appeared (empty dig)', () => {
    const dig = new DigSim();
    const { skills, reviewedConcepts } = dig.finishDig({}, '2026-02-01');
    expect(reviewedConcepts).toEqual([]);
    expect(skills).toEqual({});
  });

  it('the engine clamps same-day box advances, and the once-per-dig guard is a second layer', () => {
    // The engine caps a skill's box to advance at most once per calendar day: a
    // second correct review the same day raises strength but holds the box and due
    // date, so in-session grinding cannot fast-track "mastered".
    const firstReview = reviewSkill(undefined, true, '2026-02-01');
    const sameDay = reviewSkill(firstReview, true, '2026-02-01');
    expect(firstReview.box).toBe(2); // 1 -> 2 on the first review
    expect(sameDay.box).toBe(2); // the same-day repeat holds at 2 (no inflation)
    expect(sameDay.dueDate).toBe(firstReview.dueDate); // schedule unchanged
    expect(sameDay.reviews).toBe(firstReview.reviews + 1); // still counted
    expect(sameDay.strength).toBeGreaterThan(firstReview.strength); // strength still climbs

    // The once-per-dig guard is a second layer: a repeated concept in one dig is
    // recorded only once regardless, and a re-run on the same day is also clamped.
    const dig = new DigSim();
    dig.playProblem('solve', [true]);
    dig.playProblem('solve', [true]); // same concept again, same dig
    const first = dig.finishDig({}, '2026-02-01');
    expect(first.skills.solve!.box).toBe(2); // one step for the whole dig
    const second = dig.finishDig(first.skills, '2026-02-01'); // guard holds
    expect(second.skills.solve!.box).toBe(2);
  });
});

/**
 * Mirror of LessonPlayer.evaluateMastery's spaced-review write: exactly ONE
 * review per mastery completion, correct = the pass result, projected from the
 * same prior memory the persisted write advances.
 */
function recordMasteryReview(
  prior: SkillMemory | undefined,
  masteryResults: Record<string, boolean>,
  masteryIds: string[],
  today: string,
): { memory: SkillMemory; cueDays: number } {
  const passed = masteryPass(countMasteryCorrect(masteryIds, masteryResults));
  const projected = reviewSkill(prior, passed, today);
  return { memory: projected, cueDays: intervalForBox(projected.box) };
}

describe('mastery completion = exactly one review, correct = pass result', () => {
  const ids = ['m1', 'm2', 'm3'];

  it('a pass (2/3) pushes the schedule out; the "back in N days" cue matches the due date', () => {
    const { memory, cueDays } = recordMasteryReview(undefined, { m1: true, m2: true, m3: false }, ids, '2026-01-01');
    expect(memory.box).toBe(2); // one promotion from fresh
    expect(memory.reviews).toBe(1); // exactly one review for the whole check
    expect(memory.lapses).toBe(0);
    // The completion cue ("back in N days") equals the real gap to the due date.
    expect(cueDays).toBe(dayGap('2026-01-01', memory.dueDate));
    expect(memory.dueDate).toBe('2026-01-03');
  });

  it('a fail (1/3) resurfaces the skill the next day and counts a lapse', () => {
    const prior: SkillMemory = {
      strength: 0.6, box: 3, dueDate: '2026-01-01', lastSeen: '2026-01-01', reviews: 3, lapses: 0,
    };
    const { memory, cueDays } = recordMasteryReview(prior, { m1: true, m2: false, m3: false }, ids, '2026-03-10');
    expect(memory.box).toBe(1);
    expect(memory.lapses).toBe(1);
    expect(memory.reviews).toBe(4); // still just one review added
    expect(cueDays).toBe(1);
    expect(memory.dueDate).toBe('2026-03-11');
  });

  it('cannot inflate the box on a single day no matter the score', () => {
    // Even a perfect 3/3 advances the box by exactly one step.
    const before: SkillMemory = {
      strength: 0.4, box: 2, dueDate: '2026-01-01', lastSeen: '2026-01-01', reviews: 1, lapses: 0,
    };
    const { memory } = recordMasteryReview(before, { m1: true, m2: true, m3: true }, ids, '2026-02-01');
    expect(memory.box).toBe(3); // 2 → 3, never a leap to 5
  });
});

describe('Daily Review pool derivation (reviewConcepts prop)', () => {
  // Mirror of PracticeSession: isReview only when a NON-EMPTY pool is passed,
  // and the review pool is the de-duplicated reviewConcepts; otherwise it falls
  // back to the per-lesson concept pool.
  const derivePool = (lessonId: string, reviewConcepts?: ConceptId[]) => {
    const isReview = Array.isArray(reviewConcepts) && reviewConcepts.length > 0;
    return {
      isReview,
      concepts: isReview ? [...new Set(reviewConcepts)] : conceptsForLesson(lessonId),
    };
  };

  it('falls back to the per-lesson pool when reviewConcepts is missing or empty', () => {
    const lessonPool = conceptsForLesson('lesson-03');
    expect(derivePool('lesson-03', undefined)).toEqual({ isReview: false, concepts: lessonPool });
    expect(derivePool('lesson-03', [])).toEqual({ isReview: false, concepts: lessonPool });
  });

  it('uses the de-duplicated due-today pool in review mode', () => {
    const { isReview, concepts } = derivePool('lesson-03', ['solve', 'solve', 'balance']);
    expect(isReview).toBe(true);
    expect(concepts).toEqual(['solve', 'balance']);
  });
});

describe('multi-day learner journey (mastery → Daily Review → mastery)', () => {
  it('schedules, grows the interval, recovers from a lapse, and reaches Mastered', () => {
    const concept: ConceptId = 'solve';
    let skills: SkillsMap = {};
    const ids = ['m1', 'm2', 'm3'];

    // Day 0: finish the lesson's mastery check with a pass. The concept is
    // scheduled for the first time (box 2, due in 2 days), state = learning.
    let today = '2026-01-01';
    skills = { ...skills, [concept]: recordMasteryReview(skills[concept], { m1: true, m2: true, m3: true }, ids, today).memory };
    expect(skills[concept]!.box).toBe(2);
    expect(skills[concept]!.dueDate).toBe('2026-01-03');
    expect(skillState(skills[concept])).toBe('learning');
    expect(getDueConcepts(skills, '2026-01-02')).toEqual([]); // not due early

    // Days pass; it becomes due and is cleared in a Daily Review. The gap to the
    // next review grows each time (2 → 4 → 9 → 21), reaching box 5 = Mastered.
    const gaps: number[] = [];
    for (let i = 0; i < 3; i++) {
      today = skills[concept]!.dueDate;
      expect(getDueConcepts(skills, today)).toEqual([concept]); // surfaces when due
      const dig = new DigSim();
      dig.playProblem(concept, [true]); // a clean review
      const before = today;
      skills = dig.finishDig(skills, today).skills;
      gaps.push(dayGap(before, skills[concept]!.dueDate));
    }
    expect(gaps).toEqual([4, 9, 21]);
    expect(skills[concept]!.box).toBe(5);
    expect(skillState(skills[concept])).toBe('mastered');

    // A wrong review (a lapse) pulls a Mastered skill all the way back to box 1
    // and brings it due the very next day; state falls back to learning.
    today = skills[concept]!.dueDate;
    const dig = new DigSim();
    dig.playProblem(concept, [false, false]); // missed it
    const strengthBefore = skills[concept]!.strength;
    skills = dig.finishDig(skills, today).skills;
    expect(skills[concept]!.box).toBe(1);
    expect(skills[concept]!.lapses).toBe(1);
    expect(skills[concept]!.strength).toBeLessThan(strengthBefore);
    expect(skills[concept]!.dueDate).toBe(addDays(today, 1));
    expect(skillState(skills[concept])).toBe('learning');
    expect(getDueConcepts(skills, today)).toEqual([]); // not due the day it lapsed
    expect(getDueConcepts(skills, addDays(today, 1))).toEqual([concept]); // due tomorrow

    // Climb back to Mastered by surviving the spaced chain again.
    for (let i = 0; i < 4; i++) {
      today = skills[concept]!.dueDate;
      const climb = new DigSim();
      climb.playProblem(concept, [true]);
      skills = climb.finishDig(skills, today).skills;
    }
    expect(skills[concept]!.box).toBe(5);
    expect(skillState(skills[concept])).toBe('mastered');
    expect(skills[concept]!.lapses).toBe(1); // the one lapse persists in history
  });
});

describe('calm + empty states', () => {
  it('a brand-new learner has nothing due and an empty review', () => {
    const skills: SkillsMap = {};
    expect(getDueConcepts(skills, '2026-01-01')).toEqual([]);
  });

  it('a fully-scheduled, not-yet-due learner is calm (all caught up)', () => {
    const skills: SkillsMap = {};
    let working: SkillsMap = skills;
    for (const concept of conceptsForLesson('lesson-05')) {
      working = { ...working, [concept]: reviewSkill(undefined, true, '2026-01-01') };
    }
    // Everything was just reviewed correctly, so nothing is due the same day.
    expect(getDueConcepts(working, '2026-01-01')).toEqual([]);
    // A freshMemory placed for "today" would be due immediately (the new-skill case).
    const withFresh: SkillsMap = { ...working, balance: freshMemory('2026-01-02') };
    expect(getDueConcepts(withFresh, '2026-01-02')).toContain('balance');
  });
});
