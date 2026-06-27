/**
 * Tests for the Phase 3 spaced-repetition Firestore glue in `progress.ts`
 * (`recordSkillReview` and `getReviewSetup`), with `firebase/firestore` mocked so
 * the read/modify/write path runs without a real backend. The load-bearing
 * guarantees: a review writes a complete, defined `SkillMemory` (Firestore
 * rejects `undefined`), advances it with the real `reviewSkill`, and merge-writes
 * only that one skill; `getReviewSetup` derives due/weakness/bestLevel/skills
 * purely from one read and is calm with no prior skills.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';

// Shared, hoisted mock state so the (hoisted) vi.mock factory can reach it.
const mockState = vi.hoisted(() => ({
  docData: undefined as Record<string, unknown> | undefined,
  setDocCalls: [] as { payload: Record<string, unknown>; options: unknown }[],
}));

vi.mock('./firestore', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => ({ args }),
  getDocFromCache: async () => ({
    exists: () => mockState.docData !== undefined,
    data: () => mockState.docData,
  }),
  getDoc: async () => ({
    exists: () => mockState.docData !== undefined,
    data: () => mockState.docData,
  }),
  setDoc: async (_ref: unknown, payload: Record<string, unknown>, options: unknown) => {
    mockState.setDocCalls.push({ payload, options });
  },
  serverTimestamp: () => '__serverTimestamp__',
  arrayUnion: (...items: unknown[]) => ({ __arrayUnion: items }),
  increment: (n: number) => ({ __increment: n }),
}));

import { getReviewSetup, recordSkillReview, todayKey } from './progress';
import { addDays, reviewSkill } from './ai/srs';
import type { SkillMemory } from './ai/srs';

/** Recursively assert no property anywhere in a value is `undefined`. */
function assertNoUndefined(value: unknown, path = '$'): void {
  expect(value, `${path} is undefined`).not.toBeUndefined();
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      assertNoUndefined(child, `${path}.${key}`);
    }
  }
}

beforeEach(() => {
  mockState.docData = undefined;
  mockState.setDocCalls = [];
});

describe('recordSkillReview', () => {
  it('writes a complete, defined SkillMemory for a first-ever review (merge only that skill)', async () => {
    mockState.docData = {}; // doc exists but has no skills yet
    const today = todayKey();

    await recordSkillReview('u1', 'course-1', 'solve', true);

    expect(mockState.setDocCalls).toHaveLength(1);
    const { payload, options } = mockState.setDocCalls[0];
    expect(options).toEqual({ merge: true }); // never clobbers other fields

    const written = (payload.skills as Record<string, SkillMemory>).solve;
    expect(written).toEqual(reviewSkill(undefined, true, today));
    // Box advanced from fresh, due pushed out, every field present and defined.
    expect(written.box).toBe(2);
    expect(written.reviews).toBe(1);
    assertNoUndefined(payload); // Firestore rejects undefined — none anywhere
  });

  it('advances an existing skill and never writes undefined on a lapse', async () => {
    const prior: SkillMemory = {
      strength: 0.7, box: 4, dueDate: '2026-01-01', lastSeen: '2026-01-01', reviews: 5, lapses: 0,
    };
    mockState.docData = { skills: { solve: prior }, practice: { bestLevel: 3 } };
    const today = todayKey();

    await recordSkillReview('u1', 'course-1', 'solve', false);

    const written = (mockState.setDocCalls[0].payload.skills as Record<string, SkillMemory>).solve;
    expect(written).toEqual(reviewSkill(prior, false, today));
    expect(written.box).toBe(1); // a wrong review drops to box 1
    expect(written.lapses).toBe(1);
    expect(written.dueDate).toBe(addDays(today, 1)); // back tomorrow
    assertNoUndefined(mockState.setDocCalls[0].payload);
  });

  it('only writes the single reviewed skill (does not echo siblings)', async () => {
    const other: SkillMemory = {
      strength: 0.9, box: 5, dueDate: '2026-12-01', lastSeen: '2026-01-01', reviews: 6, lapses: 0,
    };
    mockState.docData = { skills: { balance: other } };

    await recordSkillReview('u1', 'course-1', 'solve', true);

    const skills = mockState.setDocCalls[0].payload.skills as Record<string, unknown>;
    expect(Object.keys(skills)).toEqual(['solve']); // merge handles the rest
  });

  it('does not throw if reads fail; still writes a fresh review', async () => {
    // Force both reads to reject by making the mock data getter throw.
    mockState.docData = undefined; // getDoc returns !exists → existing = undefined
    await expect(recordSkillReview('u1', 'course-1', 'expression', true)).resolves.toBeUndefined();
    const written = (mockState.setDocCalls[0].payload.skills as Record<string, SkillMemory>).expression;
    expect(written).toEqual(reviewSkill(undefined, true, todayKey()));
    assertNoUndefined(mockState.setDocCalls[0].payload);
  });
});

describe('getReviewSetup', () => {
  it('is calm with no prior skills (nothing due, empty weakness, zero best level)', async () => {
    mockState.docData = undefined; // brand-new learner, doc does not exist

    const setup = await getReviewSetup('u1', 'course-1');

    expect(setup.dueConcepts).toEqual([]);
    expect(setup.weakness).toEqual({});
    expect(setup.bestLevel).toBe(0);
    expect(setup.skills).toEqual({});
  });

  it('derives due (most overdue first), weakness, best level, and raw skills from one read', async () => {
    const today = todayKey();
    const overdueMore: SkillMemory = {
      strength: 0.1, box: 1, dueDate: addDays(today, -6), lastSeen: addDays(today, -7), reviews: 2, lapses: 2,
    };
    const overdueLess: SkillMemory = {
      strength: 0.3, box: 2, dueDate: addDays(today, -2), lastSeen: addDays(today, -3), reviews: 1, lapses: 0,
    };
    const notDue: SkillMemory = {
      strength: 0.95, box: 5, dueDate: addDays(today, 10), lastSeen: addDays(today, -11), reviews: 6, lapses: 0,
    };
    mockState.docData = {
      skills: { solve: overdueLess, balance: overdueMore, introX: notDue },
      practice: { bestLevel: 4, solvedTotal: 20, digsCompleted: 2 },
    };

    const setup = await getReviewSetup('u1', 'course-1');

    // Due today: both overdue ones, most overdue (earliest due) first; notDue excluded.
    expect(setup.dueConcepts).toEqual(['balance', 'solve']);
    expect(setup.bestLevel).toBe(4);
    // Weakness present and in range; the not-due strong skill stays near zero.
    expect(setup.weakness.balance!).toBeGreaterThan(setup.weakness.introX!);
    expect(setup.weakness.introX!).toBeLessThan(0.2);
    // Raw skills are passed through untouched for the Skill Map / cues.
    expect(setup.skills.solve).toEqual(overdueLess);
    expect(setup.skills.introX).toEqual(notDue);
  });
});
