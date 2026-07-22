import { describe, expect, it } from 'vitest';
import { resolveResume } from './resume';
import type { CourseProgress, LessonProgressSnapshot } from './progress';

const ORDER = ['lesson-01', 'lesson-02', 'lesson-03'];
const allHaveContent = () => true;

function snapshot(overrides: Partial<LessonProgressSnapshot> = {}): LessonProgressSnapshot {
  return {
    phase: 'scaffolded',
    stepIndex: 0,
    masteryResults: {},
    finished: false,
    passed: false,
    answerHistory: {},
    ...overrides,
  };
}

function progress(overrides: Partial<CourseProgress> = {}): CourseProgress {
  return {
    currentLessonId: 'lesson-01',
    unlockedLessonIds: ['lesson-01'],
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

describe('resolveResume', () => {
  it('starts the first lesson for a brand-new learner', () => {
    expect(resolveResume(progress(), ORDER, allHaveContent)).toEqual({
      lessonId: 'lesson-01',
      mode: 'start',
    });
  });

  it('resumes the current lesson when it is in progress', () => {
    const result = resolveResume(
      progress({
        currentLessonId: 'lesson-02',
        unlockedLessonIds: ['lesson-01', 'lesson-02'],
        completedLessonIds: ['lesson-01'],
        lessons: { 'lesson-02': snapshot({ phase: 'mastery', stepIndex: 1 }) },
      }),
      ORDER,
      allHaveContent,
    );
    expect(result).toEqual({ lessonId: 'lesson-02', mode: 'continue' });
  });

  it('moves on to the next unlocked lesson when the current one is finished', () => {
    const result = resolveResume(
      progress({
        currentLessonId: 'lesson-01',
        unlockedLessonIds: ['lesson-01', 'lesson-02'],
        completedLessonIds: ['lesson-01'],
        lessons: { 'lesson-01': snapshot({ finished: true, passed: true }) },
      }),
      ORDER,
      allHaveContent,
    );
    expect(result).toEqual({ lessonId: 'lesson-02', mode: 'start' });
  });

  it('offers a replay once every lesson is completed', () => {
    const result = resolveResume(
      progress({
        currentLessonId: 'lesson-03',
        unlockedLessonIds: ORDER,
        completedLessonIds: ORDER,
        lessons: { 'lesson-03': snapshot({ finished: true, passed: true }) },
      }),
      ORDER,
      allHaveContent,
    );
    expect(result).toEqual({ lessonId: 'lesson-03', mode: 'done' });
  });

  it('skips lessons that have no content yet', () => {
    const hasContent = (id: string) => id !== 'lesson-01';
    const result = resolveResume(
      progress({ unlockedLessonIds: ['lesson-01', 'lesson-02'] }),
      ORDER,
      hasContent,
    );
    expect(result).toEqual({ lessonId: 'lesson-02', mode: 'start' });
  });

  it('returns null when nothing is playable', () => {
    expect(resolveResume(progress(), ORDER, () => false)).toBeNull();
  });
});
