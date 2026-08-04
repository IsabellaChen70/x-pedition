import { describe, expect, it } from 'vitest';
import { headerStatsFromProgress } from './courseStats';
import { earnedXp, levelForXp, XP_PER_LEVEL, xpIntoLevel } from './xp';
import type { CourseProgress } from './progress';

function baseProgress(overrides: Partial<CourseProgress> = {}): CourseProgress {
  return {
    currentLessonId: 'l1',
    unlockedLessonIds: ['l1'],
    completedLessonIds: [],
    lessons: {},
    streakCount: 0,
    lastStreakDate: null,
    lastCelebratedStreak: 0,
    acknowledgedBadgeIds: [],
    practice: { bestLevel: 0, solvedTotal: 0, digsCompleted: 0 },
    reflectionsCompleted: 0,
    finalChallengePassed: false,
    lastCelebratedLevel: 0,
    cosmetics: { unlocked: [], equipped: {}, xpSpent: 0 },
    skills: {},
    mistakeLog: [],
    ...overrides,
  };
}

describe('headerStatsFromProgress', () => {
  it('returns a fresh level-1 header when progress has not loaded', () => {
    expect(headerStatsFromProgress(null, ['l1', 'l2'])).toEqual({
      level: 1,
      xp: 0,
      xpToNext: XP_PER_LEVEL,
      streak: 0,
    });
  });

  it('gathers completed lessons, mastery-correct, practice, and reflections into the XP total', () => {
    const progress = baseProgress({
      completedLessonIds: ['l1'],
      streakCount: 4,
      practice: { bestLevel: 2, solvedTotal: 3, digsCompleted: 1 },
      reflectionsCompleted: 2,
      lessons: {
        l1: {
          phase: 'mastery',
          stepIndex: 2,
          finished: true,
          passed: true,
          answerHistory: {},
          masteryResults: { m1: true, m2: true, m3: false },
        },
      },
    });

    const expectedXp = earnedXp({
      completedCount: 1,
      masteryCorrect: 2,
      practiceSolved: 3,
      reflectionsCompleted: 2,
    });
    const stats = headerStatsFromProgress(progress, ['l1', 'l2']);

    expect(stats.streak).toBe(4);
    expect(stats.level).toBe(levelForXp(expectedXp));
    expect(stats.xp).toBe(xpIntoLevel(expectedXp));
    expect(stats.xpToNext).toBe(XP_PER_LEVEL);
  });
});
