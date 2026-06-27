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

/** A SkillMemory with sensible defaults, overridable per field, for table tests. */
function makeMemory(overrides: Partial<SkillMemory> = {}): SkillMemory {
  return {
    strength: 0.5,
    box: 2,
    dueDate: '2026-01-01',
    lastSeen: '2026-01-01',
    reviews: 1,
    lapses: 0,
    ...overrides,
  };
}

/** Whole-day gap between two 'YYYY-MM-DD' keys (TZ-agnostic, UTC). */
function dayGap(from: string, to: string): number {
  const days = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / 86_400_000;
  };
  return days(to) - days(from);
}

describe('addDays (pure, TZ-agnostic date math)', () => {
  it('adds and subtracts whole days', () => {
    expect(addDays('2026-01-01', 1)).toBe('2026-01-02');
    expect(addDays('2026-01-10', 5)).toBe('2026-01-15');
    expect(addDays('2026-01-10', -3)).toBe('2026-01-07');
    expect(addDays('2026-01-01', 0)).toBe('2026-01-01');
  });

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });
});

describe('intervalForBox (growing schedule)', () => {
  it('returns growing day intervals for boxes 1..5', () => {
    expect([1, 2, 3, 4, 5].map(intervalForBox)).toEqual([1, 2, 4, 9, 21]);
  });

  it('strictly grows as the box climbs', () => {
    expect(intervalForBox(2)).toBeGreaterThan(intervalForBox(1));
    expect(intervalForBox(3)).toBeGreaterThan(intervalForBox(2));
    expect(intervalForBox(4)).toBeGreaterThan(intervalForBox(3));
    expect(intervalForBox(5)).toBeGreaterThan(intervalForBox(4));
  });

  it('clamps out-of-range boxes to the 1..5 ends', () => {
    expect(intervalForBox(0)).toBe(intervalForBox(1));
    expect(intervalForBox(99)).toBe(intervalForBox(5));
  });
});

describe('freshMemory', () => {
  it('is a never-reviewed skill due today in box 1', () => {
    expect(freshMemory('2026-01-01')).toEqual({
      strength: 0,
      box: 1,
      dueDate: '2026-01-01',
      lastSeen: '2026-01-01',
      reviews: 0,
      lapses: 0,
    });
  });
});

describe('reviewSkill — consecutive correct reviews', () => {
  it('pushes the box up and grows the interval (dueDate gets further out each time)', () => {
    // Review on each due date, the way real spaced reviews land.
    const steps: { today: string; memory: SkillMemory }[] = [];
    let today = '2026-01-01';
    let memory = reviewSkill(undefined, true, today);
    steps.push({ today, memory });
    for (let i = 0; i < 4; i++) {
      today = memory.dueDate;
      memory = reviewSkill(memory, true, today);
      steps.push({ today, memory });
    }

    // Box climbs 2 -> 3 -> 4 -> 5 then caps at 5.
    expect(steps.map((s) => s.memory.box)).toEqual([2, 3, 4, 5, 5]);

    // The gap from review day to the next due date grows each correct review.
    const gaps = steps.map((s) => dayGap(s.today, s.memory.dueDate));
    expect(gaps).toEqual([2, 4, 9, 21, 21]);
    expect(gaps[0]).toBeLessThan(gaps[1]);
    expect(gaps[1]).toBeLessThan(gaps[2]);
    expect(gaps[2]).toBeLessThan(gaps[3]);

    // Strength rises monotonically and review count increments.
    const strengths = steps.map((s) => s.memory.strength);
    for (let i = 1; i < strengths.length; i++) {
      expect(strengths[i]).toBeGreaterThan(strengths[i - 1]);
    }
    expect(steps.map((s) => s.memory.reviews)).toEqual([1, 2, 3, 4, 5]);
    expect(steps.every((s) => s.memory.lapses === 0)).toBe(true);
  });

  it('treats an undefined prior memory as fresh', () => {
    const first = reviewSkill(undefined, true, '2026-01-01');
    expect(first.box).toBe(2);
    expect(first.reviews).toBe(1);
    expect(first.lapses).toBe(0);
    expect(first.dueDate).toBe(addDays('2026-01-01', intervalForBox(2)));
  });
});

describe('reviewSkill — a wrong review', () => {
  it('resets the box to 1 and sets dueDate to addDays(today, intervalForBox(1))', () => {
    // Build a well-known skill (box 4) first.
    let known = reviewSkill(undefined, true, '2026-01-01');
    known = reviewSkill(known, true, known.dueDate);
    known = reviewSkill(known, true, known.dueDate);
    expect(known.box).toBe(4);

    const today = '2026-03-10';
    const lapsed = reviewSkill(known, false, today);

    expect(lapsed.box).toBe(1);
    expect(lapsed.dueDate).toBe(addDays(today, intervalForBox(1)));
    expect(lapsed.dueDate).toBe('2026-03-11');
    expect(lapsed.lastSeen).toBe(today);
    expect(lapsed.lapses).toBe(known.lapses + 1);
    expect(lapsed.reviews).toBe(known.reviews + 1);
    expect(lapsed.strength).toBeLessThan(known.strength);
  });
});

describe('reviewSkill — per-day clamp (box advances at most once per day)', () => {
  it('holds the box and due date on a second correct review the same day, but still raises strength', () => {
    const first = reviewSkill(undefined, true, '2026-01-01'); // box 2, due +2
    const sameDay = reviewSkill(first, true, '2026-01-01');
    expect(sameDay.box).toBe(first.box); // no second promotion today
    expect(sameDay.dueDate).toBe(first.dueDate); // schedule unchanged
    expect(sameDay.lastSeen).toBe('2026-01-01');
    expect(sameDay.reviews).toBe(first.reviews + 1); // the review still counts
    expect(sameDay.lapses).toBe(0);
    expect(sameDay.strength).toBeGreaterThan(first.strength); // strength still climbs
  });

  it('cannot fast-track Mastered by grinding many correct reviews in one day', () => {
    let memory = reviewSkill(undefined, true, '2026-01-01'); // box 2
    for (let i = 0; i < 10; i++) {
      memory = reviewSkill(memory, true, '2026-01-01');
    }
    expect(memory.box).toBe(2); // still box 2 after a day of grinding
    expect(skillState(memory)).not.toBe('mastered');
  });

  it('advances again the next day (the clamp is per calendar day, not permanent)', () => {
    const day1 = reviewSkill(undefined, true, '2026-01-01'); // box 2, due 2026-01-03
    const day1Again = reviewSkill(day1, true, '2026-01-01'); // held at box 2
    const nextDay = reviewSkill(day1Again, true, day1Again.dueDate); // a later calendar day
    expect(nextDay.box).toBe(3); // promotes normally once the day changes
  });

  it('a wrong review still lapses on the same day (the clamp only blocks upward inflation)', () => {
    const first = reviewSkill(undefined, true, '2026-01-01'); // box 2
    const sameDayWrong = reviewSkill(first, false, '2026-01-01');
    expect(sameDayWrong.box).toBe(1); // a genuine miss still resets
    expect(sameDayWrong.lapses).toBe(1);
    expect(sameDayWrong.dueDate).toBe(addDays('2026-01-01', 1));
  });

  it('treats a brand-new skill as a real first review, not an already-seen same-day repeat', () => {
    const first = reviewSkill(undefined, true, '2026-01-01');
    expect(first.box).toBe(2); // first ever review still promotes from box 1
  });
});

describe('getDueConcepts', () => {
  it('returns only concepts due on or before today, most overdue first', () => {
    const today = '2026-02-01';
    const skills: Partial<Record<'balance' | 'introX' | 'solve' | 'combine', SkillMemory>> = {
      balance: makeMemory({ dueDate: '2026-01-20' }), // 12 days overdue
      introX: makeMemory({ dueDate: '2026-02-01' }), // due exactly today
      solve: makeMemory({ dueDate: '2026-02-10' }), // not due yet
      combine: makeMemory({ dueDate: '2026-01-28' }), // 4 days overdue
    };

    expect(getDueConcepts(skills, today)).toEqual(['balance', 'combine', 'introX']);
  });

  it('returns an empty list when nothing is due', () => {
    const skills = { balance: makeMemory({ dueDate: '2026-02-10' }) };
    expect(getDueConcepts(skills, '2026-02-01')).toEqual([]);
  });
});

describe('skillState (durable mastery signal)', () => {
  it('maps box thresholds to learning / practicing / mastered', () => {
    expect(skillState(undefined)).toBe('learning');
    expect(skillState(makeMemory({ box: 1 }))).toBe('learning');
    expect(skillState(makeMemory({ box: 2 }))).toBe('learning');
    expect(skillState(makeMemory({ box: 3 }))).toBe('practicing');
    expect(skillState(makeMemory({ box: 4 }))).toBe('practicing');
    expect(skillState(makeMemory({ box: 5 }))).toBe('mastered');
  });
});

describe('weaknessFromSkills', () => {
  it('weights low-strength and overdue skills above a fresh, strong, not-yet-due one', () => {
    const today = '2026-02-01';

    // Strong: a chain of correct reviews leaves high strength and a far-future due.
    let strong = reviewSkill(undefined, true, '2026-01-25');
    strong = reviewSkill(strong, true, strong.dueDate);
    strong = reviewSkill(strong, true, strong.dueDate);
    expect(strong.dueDate > today).toBe(true);

    // Weak: a wrong review leaves zero strength, but it is not overdue (due tomorrow).
    const weak = reviewSkill(undefined, false, today);
    expect(weak.dueDate > today).toBe(true);

    // Overdue: decent strength but a long-past due date.
    const overdue = reviewSkill(undefined, true, '2026-01-01');
    expect(overdue.dueDate < today).toBe(true);

    const weakness = weaknessFromSkills(
      { balance: strong, introX: weak, solve: overdue },
      today,
    );

    expect(weakness.introX!).toBeGreaterThan(weakness.balance!); // low strength beats strong
    expect(weakness.solve!).toBeGreaterThan(weakness.balance!); // overdue beats strong
    expect(weakness.balance!).toBeLessThan(0.2); // fresh + strong + not due ≈ near zero
  });

  it('skips missing entries and stays within 0..1', () => {
    const weakness = weaknessFromSkills(
      { balance: makeMemory({ strength: 0, dueDate: '2025-01-01' }) },
      '2026-02-01',
    );
    expect(weakness.balance!).toBeGreaterThanOrEqual(0);
    expect(weakness.balance!).toBeLessThanOrEqual(1);
    expect(weakness.introX).toBeUndefined();
  });
});
